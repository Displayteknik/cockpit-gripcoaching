import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 300;

interface AgentProposal {
  target:
    | "brand_profile"
    | "pillar"
    | "customer_voice"
    | "signature_phrase"
    | "forbidden_word"
    | "pain_word"
    | "joy_word"
    | "tone_rule"
    | "post_idea"
    | "differentiator"
    | "service"
    | "icp_primary"
    | "icp_secondary"
    | "catchphrase"
    | "framework"
    | "objection"
    | "transformation_case";
  action: "confirm" | "add" | "update" | "contradict" | "ignore";
  field?: string;
  current_value?: string;
  proposed_value: string;
  evidence: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

interface AgentClarification {
  question: string;
  options?: string[];
}

interface AgentResult {
  summary: string;
  confidence: number;
  proposals: AgentProposal[];
  clarifications: AgentClarification[];
}

export async function POST(req: NextRequest) {
  try {
    const { session_id }: { session_id: string } = await req.json();
    if (!session_id) return NextResponse.json({ error: "session_id krävs" }, { status: 400 });

    const sb = supabaseServer();
    const clientId = await getActiveClientId();
    const client = await getActiveClient();

    const { data: session, error: sErr } = await sb
      .from("intake_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("client_id", clientId)
      .single();
    if (sErr || !session) return NextResponse.json({ error: "Session saknas" }, { status: 404 });

    const [{ data: profile }, { data: pillars }, { data: voice }, { data: existingVoice }, { data: recentDecisions }] =
      await Promise.all([
        sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle(),
        sb.from("linkedin_pillars").select("name, description").eq("client_id", clientId).eq("archived", false),
        sb.from("client_voice_profile").select("*").eq("client_id", clientId).maybeSingle(),
        sb.from("customer_voice").select("phrase, category").eq("client_id", clientId).eq("archived", false),
        sb
          .from("intake_proposals")
          .select("target, proposed_value, decision")
          .eq("client_id", clientId)
          .in("decision", ["skipped", "edited"])
          .order("decided_at", { ascending: false })
          .limit(40),
      ]);

    const existingBlock = `
## BEFINTLIG BRAND-PROFIL (källa: hm_brand_profile)
${profile ? Object.entries(profile).filter(([k, v]) => v && !["id", "client_id", "updated_at"].includes(k)).map(([k, v]) => `- ${k}: ${String(v).slice(0, 300)}`).join("\n") : "(tom)"}

## BEFINTLIGA PELARE (LinkedIn)
${(pillars ?? []).map((p) => `- ${p.name}: ${p.description ?? ""}`).join("\n") || "(inga)"}

## BEFINTLIG VOICE-PROFIL
${voice ? `Tone: ${voice.tone_summary ?? ""}\nSignature: ${(voice.signature_phrases ?? []).join(", ")}\nForbidden: ${(voice.forbidden_words ?? []).join(", ")}\nPain: ${(voice.pain_words ?? []).join(", ")}\nJoy: ${(voice.joy_words ?? []).join(", ")}` : "(tom)"}

## BEFINTLIG CUSTOMER VOICE
${(existingVoice ?? []).map((v) => `- (${v.category}) ${v.phrase}`).join("\n") || "(tom)"}

## TIDIGARE FÖRSLAG SOM ANVÄNDAREN AVVISAT/JUSTERAT (lär av detta — föreslå inte samma igen)
${(recentDecisions ?? []).map((d) => `- ${d.target}: "${d.proposed_value?.slice(0, 100)}" → ${d.decision}`).join("\n") || "(inga)"}
`;

    const system = `Du är en världsklass brand-strateg som agerar som intake-agent för ${client?.name || "klienten"}.

Du läser ett transkript från ett samtal/intervju och jämför det noggrant mot ALL befintlig brand-data nedan. Du hittar:

1. **Bekräftelser** (action="confirm") — sådant som stärker befintliga fält
2. **Tillägg** (action="add") — nya teman/pelare/fraser som saknas
3. **Uppdateringar** (action="update") — befintliga fält som behöver justeras med starkare formulering
4. **Motsägelser** (action="contradict") — där transkriptet säger något annat än brand-profilen. Skapa en CLARIFICATION istället.
5. **Ignorera** — off-topic, brus

REGLER:
- Citera ALLTID exakt fras från transkriptet i evidence-fältet (max 200 tecken)
- Confidence "high" bara om citatet är otvetydigt
- Föreslå INTE saker användaren tidigare avvisat (se decision-historiken)
- Customer Voice-fraser ska vara EXAKTA citat från kunden/intervjuofret, INTE klientens egna ord
- Pelarsuggestioner: max 2 nya per session. Om temat liknar befintlig pelare → action="update" med bättre beskrivning, inte ny.
- Föreslå MAX 30 proposals totalt per session. Prioritera kvalitet över kvantitet.
- Post-idéer: bara om transkriptet innehåller en KONKRET story/scen som direkt blir en LinkedIn-post (inkl konkreta namn, siffror, vändpunkt).
- Klargöranden: bara vid genuin motsägelse eller hög osäkerhet. Max 5 frågor. Inga "hur tycker du?".

TARGETS du kan föreslå:
- brand_profile (med field="usp"|"icp_primary"|"icp_secondary"|"pain_points"|"differentiators"|"services"|"brand_story"|"tone_rules"|"customer_journey"|"customer_quotes")
- pillar (proposed_value = "Pelarens namn|Beskrivning")
- customer_voice (proposed_value = exakt fras, field = pain|desire|objection|transformation|vocabulary|catchphrase)
- signature_phrase, forbidden_word, pain_word, joy_word (klientens röst)
- tone_rule (en mening om HUR klienten pratar)
- post_idea (proposed_value = hook | vinkel)
- catchphrase, framework, objection, transformation_case

${existingBlock}

RETURNERA STRIKT JSON:
{
  "summary": "2-3 meningar om vad transkriptet handlar om och hur det förhåller sig till befintlig brand-data",
  "confidence": 0.85,
  "proposals": [
    {
      "target": "pillar",
      "action": "add",
      "field": null,
      "current_value": null,
      "proposed_value": "Tystnadens kraft|Hur en handledare använder pauser och tystnad som verktyg",
      "evidence": "[exakt citat ur transkriptet]",
      "confidence": "high",
      "reasoning": "Återkommer 4 gånger i transkriptet, kopplas till konkret upplevelse, finns inte i befintliga pelare"
    }
  ],
  "clarifications": [
    {
      "question": "Du säger '...' i transkriptet men brand-profilen säger '...'. Vilket gäller nu?",
      "options": ["Alternativ A", "Alternativ B", "Båda — det är två segment"]
    }
  ]
}`;

    const userPrompt = `## TRANSKRIPT (källa: ${session.source_type}, ${session.transcript?.length ?? 0} tecken)

${(session.transcript ?? "").slice(0, 30000)}

Analysera nu enligt instruktionerna ovan. Returnera bara JSON.`;

    const result = await generateJSON<AgentResult>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: userPrompt,
      temperature: 0.5,
      maxOutputTokens: 16000,
    });

    const proposalsToInsert = (result.proposals ?? []).slice(0, 40).map((p, i) => ({
      session_id,
      client_id: clientId,
      target: p.target,
      action: p.action,
      field: p.field ?? null,
      current_value: p.current_value ?? null,
      proposed_value: p.proposed_value,
      evidence: p.evidence ?? null,
      confidence: p.confidence ?? "medium",
      reasoning: p.reasoning ?? null,
      decision: "pending" as const,
      sort_order: i,
    }));
    if (proposalsToInsert.length) await sb.from("intake_proposals").insert(proposalsToInsert);

    const clarifsToInsert = (result.clarifications ?? []).slice(0, 5).map((c, i) => ({
      session_id,
      question: c.question,
      options: c.options ?? null,
      sort_order: i,
    }));
    if (clarifsToInsert.length) await sb.from("intake_clarifications").insert(clarifsToInsert);

    await sb
      .from("intake_sessions")
      .update({
        status: clarifsToInsert.length > 0 ? "clarifying" : "reviewing",
        confidence: result.confidence ?? null,
        model_used: "gemini-2.5-pro",
        raw_analysis: { summary: result.summary, proposals_count: proposalsToInsert.length, clarifications_count: clarifsToInsert.length },
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    await logActivity(clientId, "intake_analyzed", `Intake-agent: ${proposalsToInsert.length} förslag, ${clarifsToInsert.length} frågor`, "/dashboard/profil");
    return NextResponse.json({
      session_id,
      summary: result.summary,
      confidence: result.confidence,
      proposals_count: proposalsToInsert.length,
      clarifications_count: clarifsToInsert.length,
    });
  } catch (e) {
    const sb = supabaseServer();
    const body = await req.text().catch(() => "");
    const match = body.match(/"session_id"\s*:\s*"([^"]+)"/);
    if (match) {
      await sb.from("intake_sessions").update({ status: "failed", error_message: (e as Error).message }).eq("id", match[1]);
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
