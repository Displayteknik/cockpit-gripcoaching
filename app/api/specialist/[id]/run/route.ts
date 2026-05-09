import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSpecialist, buildUserPrompt } from "@/lib/specialists";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { iterateGenerate } from "@/lib/iterate";

export const runtime = "nodejs";
export const maxDuration = 90;

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
        systemPrompt: specialist.systemPrompt,
        userPrompt,
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
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: specialist.systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      text = msg.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("")
        .trim();
      tokens_in = msg.usage?.input_tokens ?? null;
      tokens_out = msg.usage?.output_tokens ?? null;
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
