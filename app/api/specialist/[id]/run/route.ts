import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loggaAnrop } from "@/lib/ai-usage";
import { getSpecialist, buildUserPrompt, guardrailsFor } from "@/lib/specialists";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { iterateGenerate } from "@/lib/iterate";
import { byggTextPrompt } from "@/lib/prompt-core";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-5";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const t0 = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY saknas i miljövariabler" },
        { status: 500 }
      );
    }

    const specialist = await getSpecialist(id);
    if (!specialist) {
      return NextResponse.json({ error: "Specialist saknas" }, { status: 404 });
    }
    if (specialist.target_app !== "cockpit" && specialist.target_app !== "both") {
      return NextResponse.json({ error: "Specialist är inte för Cockpit" }, { status: 400 });
    }

    const body = await req.json();
    const inputs: Record<string, string> = body?.inputs ?? {};

    for (const f of specialist.inputs) {
      if (f.required && !inputs[f.key]?.trim()) {
        return NextResponse.json(
          { error: `Saknar obligatoriskt fält: ${f.label}` },
          { status: 400 }
        );
      }
    }

    const clientId = await getActiveClientId();
    const userPrompt = buildUserPrompt(specialist, inputs);
    const useIterate = specialist.iterate === true;

    // TEXT-1 T-3: prompten byggs av prompt-core — specialisterna får därmed brand-profil
    // (saknades helt förut), röst, winning examples, anatomi och skrivregler i fast ordning.
    // Uppdraget = specialistens systemprompt, oförändrad.
    // ⚠ G-3d: INGEN rotation här, med flit. En specialist körs på HANDS input, en gång,
    // och specialist_runs blandar alla specialister i en tabell — de senaste raderna är
    // oftast en helt annan specialists svar och hör inte hemma som undvik-lista.
    // Nattloopen delar syftet "specialist" men HAR en egen serie i ideas_bank och
    // roterar där (app/api/agents/night-iterate).
    const bygg = await byggTextPrompt({
      clientId,
      syfte: "specialist",
      uppdrag: specialist.systemPrompt,
      underlag: userPrompt,
      kategori: specialist.category,
    });

    // Offertkategorin räknar med riktiga pengar. Valutakursen hämtas live från Riksbanken och
    // marknadsbilden med sökgrundad generering, båda som färdigt underlag i prompten — modellen
    // ska aldrig gissa en kurs eller ett marknadspris. Misslyckas hämtningen står det i blocket.
    let fxVarning: string | null = null;
    if (specialist.category === "offert") {
      const { byggOffertunderlag } = await import("@/lib/offert/underlag");
      const underlag = await byggOffertunderlag(inputs, clientId);
      bygg.user += underlag.block;
      fxVarning = underlag.fxVarning;
    }

    let text: string;
    let tokens_in: number | null = null;
    let tokens_out: number | null = null;
    let voice_score: number | null = null;
    let variant_count = 1;

    if (useIterate) {
      const targetLength =
        specialist.target_length_min && specialist.target_length_max
          ? { min: specialist.target_length_min, max: specialist.target_length_max }
          : undefined;
      const result = await iterateGenerate({
        prebuilt: { system: bygg.system, fingerprint: bygg.fingerprint, winning: bygg.winning },
        userPrompt: bygg.user,
        clientId,
        model: MODEL,
        maxTokens: 4096,
        variants: specialist.variants ?? 3,
        category: specialist.category,
        targetLength,
      });
      text = result.output;
      tokens_in = result.total_tokens_in;
      tokens_out = result.total_tokens_out;
      voice_score = result.score?.total ?? null;
      variant_count = result.variant_count;
    } else {
      const anthropic = new Anthropic({ apiKey });
      // Streama (finalMessage) — håller anslutningen vid liv vid lång generering så
      // Vercel inte timear och returnerar icke-JSON. Samma beprövade recept som djupgranskningen.
      // KOSTNAD-1: SDK-anrop loggas via loggaAnrop (samma logg och budgetgrind som fetch-vägen).
      const msg = await loggaAnrop(
        { provider: "anthropic", model: MODEL, flow: "specialist" },
        async () => {
          const m = await anthropic.messages.stream({
            model: MODEL,
            max_tokens: 4096,
            // Samma prompt-core-bygge som iterate-vägen — även direktkörda specialister
            // får brand-profil + röst + anatomi. Guardrails läggs sist (Anthropic-specifika).
            system: bygg.system + guardrailsFor(specialist.category),
            messages: [{ role: "user", content: bygg.user }],
          }).finalMessage();
          return { resultat: m, tokensIn: m.usage?.input_tokens ?? 0, tokensUt: m.usage?.output_tokens ?? 0 };
        },
      );
      text = msg.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("")
        .trim();
      tokens_in = msg.usage?.input_tokens ?? null;
      tokens_out = msg.usage?.output_tokens ?? null;
      // Specialister utan iterate-flagga får ändå voice-score så användaren
      // ser kvaliteten direkt.
      try {
        const { scoreText } = await import("@/lib/voice-enforce");
        const s = await scoreText(text, clientId, "specialist");
        voice_score = s.total;
      } catch {}
    }

    const duration = Date.now() - t0;

    const sb = supabaseServer();
    await sb.from("specialist_runs").insert({
      specialist_id: specialist.id,
      app: "cockpit",
      client_id: clientId,
      inputs,
      output: text,
      model: MODEL,
      tokens_in,
      tokens_out,
      duration_ms: duration,
      status: "completed",
    });

    await logActivity(
      clientId,
      "specialist_run",
      `Körde specialist: ${specialist.name}${useIterate ? ` (${variant_count} varianter, score ${voice_score ?? "-"})` : ""}`,
      `/dashboard/specialister/${specialist.id}`,
      { specialist_id: specialist.id, tokens_out, voice_score, variant_count }
    );

    return NextResponse.json({
      output: text,
      model: MODEL,
      tokens_in,
      tokens_out,
      duration_ms: duration,
      voice_score,
      variant_count,
      iterated: useIterate,
      fx_varning: fxVarning,
    });
  } catch (e) {
    const message = (e as Error).message ?? "Okänt fel";
    try {
      const sb = supabaseServer();
      await sb.from("specialist_runs").insert({
        specialist_id: id,
        app: "cockpit",
        inputs: {},
        status: "failed",
        error: message,
        duration_ms: Date.now() - t0,
      });
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
