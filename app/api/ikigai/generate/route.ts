import { NextRequest, NextResponse } from "next/server";
import { getKnowledge } from "@/lib/knowledge";
import { supabaseService } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { generateIkigai, buildInputBlock, ALLOWED_BRAND_FIELDS, type IkigaiInputs } from "@/lib/ikigai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const sb = supabaseService(); // ikigai_sessions har RLS på → service-role (admin-grindad i proxy, tenant-scopad via clientId)
  const clientId = await getActiveClientId();
  let inputs: IkigaiInputs = {};
  try {
    inputs = (await req.json()) as IkigaiInputs;

    // Knowledge = ikigai-metodik + (via getProfileAsMarkdown) den aktiva klientens brand-profil &
    // voice-fingerprint. Voice-fingerprinten styr coaching-TONEN; innehållet handlar om personen.
    const knowledge = await getKnowledge("ikigai-method");
    const personLabel = inputs.person_name?.trim() || "personen";
    const inputBlock = buildInputBlock(inputs);

    const result = await generateIkigai(inputs, knowledge);
    const markdown = result.markdown;
    if (!markdown) throw new Error("AI returnerade tom leverans");
    const diagram = result.diagram ?? null;

    // 1) Spara coaching-sessionen.
    const transcript = `# Ikigai-underlag (${personLabel})\n\n${inputBlock}`;
    const { data: ikigaiRow } = await sb
      .from("ikigai_sessions")
      .insert({
        client_id: clientId,
        person_name: inputs.person_name?.trim() || null,
        person_email: inputs.person_email?.trim() || null,
        inputs,
        result_markdown: markdown,
        diagram,
        source: "admin",
        status: "done",
      })
      .select("id")
      .single();

    // 2) Skapa en intake-session + proposals så befintlig granska/commit-väg kan fylla brand-profilen.
    let intakeSessionId: string | null = null;
    let proposalsCount = 0;
    const cleanProposals = (result.brand_proposals ?? []).filter((p) => {
      if (p.target === "brand_profile") return p.field && ALLOWED_BRAND_FIELDS.has(p.field);
      return ["customer_voice", "tone_rule", "post_idea"].includes(p.target);
    });

    if (cleanProposals.length > 0) {
      const { data: intakeRow } = await sb
        .from("intake_sessions")
        .insert({
          client_id: clientId,
          source_type: "ikigai",
          source_label: `Ikigai — ${personLabel}`,
          transcript,
          transcript_excerpt: transcript.slice(0, 800),
          status: "reviewing",
          model_used: "gemini-2.5-pro",
        })
        .select("id")
        .single();
      intakeSessionId = intakeRow?.id ?? null;

      if (intakeSessionId) {
        const inserts = cleanProposals.slice(0, 12).map((p, i) => ({
          session_id: intakeSessionId,
          client_id: clientId,
          target: p.target,
          action: p.action ?? "update",
          field: p.target === "brand_profile" ? p.field : (p.target === "customer_voice" ? (p.field ?? "pain") : null),
          proposed_value: p.proposed_value,
          evidence: p.evidence ?? null,
          confidence: p.confidence ?? "medium",
          reasoning: p.reasoning ?? null,
          decision: "pending" as const,
          sort_order: i,
        }));
        const { data: savedProps } = await sb.from("intake_proposals").insert(inserts).select("id");
        proposalsCount = savedProps?.length ?? 0;

        if (ikigaiRow?.id) {
          await sb.from("ikigai_sessions").update({ intake_session_id: intakeSessionId }).eq("id", ikigaiRow.id);
        }
      }
    }

    // Ikigai är ett coaching/personligt verktyg och loggas medvetet INTE i klientens
    // affärs-aktivitetsflöde (annars syns t.ex. "Ikigai för Håkan Grip" på en bilhandlares
    // översikt om man råkar köra det med fel klient aktiv). Resultatet finns i ikigai_sessions.

    return NextResponse.json({
      ikigai_session_id: ikigaiRow?.id ?? null,
      intake_session_id: intakeSessionId,
      brand_proposals_count: proposalsCount,
      markdown,
      diagram,
    });
  } catch (e) {
    await sb.from("ikigai_sessions").insert({
      client_id: clientId,
      person_name: inputs.person_name?.trim() || null,
      inputs,
      source: "admin",
      status: "failed",
      error_message: (e as Error).message,
    }).then(() => {}, () => {});
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
