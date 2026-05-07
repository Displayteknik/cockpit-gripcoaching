import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PillarSuggestion {
  name: string;
  description: string;
}

interface SeedResult {
  pillars: PillarSuggestion[];
}

export async function POST(_req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const sb = supabaseServer();

    const { count: existingCount } = await sb
      .from("linkedin_pillars")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("archived", false);

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({ error: "Pelare finns redan. Arkivera först om du vill seeda om.", existing: existingCount });
    }

    const { data: profile } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();

    const profileBlock = profile
      ? `BRAND-PROFIL:
- Bolag: ${profile.company_name ?? client?.name ?? "—"}
- USP: ${profile.usp ?? "—"}
- ICP: ${profile.icp_primary ?? "—"} / ${profile.icp_secondary ?? "—"}
- Pain points: ${profile.pain_points ?? "—"}
- Differentiators: ${profile.differentiators ?? "—"}
- Tjänster: ${profile.services ?? "—"}
- Brand story: ${profile.brand_story ?? "—"}`
      : `KLIENT: ${client?.name}\n(Ingen brand-profil ännu — gissa baserat på klientens namn)`;

    const system = `Du är en LinkedIn-strateg. Generera 4-6 content-pelare för denna klient enligt Hakan Grips kursmetodik.

${profileBlock}

REGLER:
- Pelarna ska vara teman som klienten kan publicera om i 6-12 månader
- De ska sammantaget täcka KNOW + LIKE + TRUST + TRY (trust-portarna)
- Konkreta nog att direkt kunna generera idéer från
- Varje pelare har ett namn (2-4 ord) + en kort beskrivning (1-2 meningar) som förklarar vad pelaren rymmer

RETURNERA JSON:
{
  "pillars": [
    { "name": "Pelarens namn", "description": "Kort beskrivning av vad denna pelare täcker, vilka inläggstyper, och varför den hör hemma här." }
  ]
}`;

    const result = await generateJSON<SeedResult>({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt: "Generera 4-6 pelare för denna klient nu. Returnera bara JSON.",
      temperature: 0.85,
      maxOutputTokens: 2000,
    });

    const inserts = (result.pillars ?? []).map((p, i) => ({
      client_id: clientId,
      name: p.name,
      description: p.description,
      sort_order: i,
    }));

    if (!inserts.length) return NextResponse.json({ error: "Inga pelare genererades" }, { status: 500 });

    const { data, error } = await sb.from("linkedin_pillars").insert(inserts).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ pillars: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
