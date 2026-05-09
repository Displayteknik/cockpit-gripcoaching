import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { iterateGenerate } from "@/lib/iterate";

export const runtime = "nodejs";
export const maxDuration = 300;

// Natt-loop. Genererar 5 utkast per aktiv klient + typ via iterations-loopen.
// Sparar topp 3 till ideas_bank. Korar varje natt via Vercel Cron.
//
// Auth: CRON_SECRET via Authorization-header (Vercel Cron-standard).
// Manuell trigger: GET med Authorization: Bearer <CRON_SECRET>.

const TASKS = [
  {
    type: "linkedin_post",
    category: "content",
    variants: 5,
    keepTop: 3,
    targetLength: { min: 80, max: 220 },
    systemPrompt: `Du skriver LinkedIn-poster i kundens roest. Du har redan rosten via fingerprint + winning examples.
Skriv ETT inlagg som:
- oppnar med en konkret observation eller laerdom (1 mening)
- bygger ut med 2-3 stycken (varje 1-3 meningar)
- avslutar med en fraga eller ett pastatande som triggar svar
- ar 80-220 ord
Inga AI-floskler. Inga emojis i forsta meningen. Ingen #hashtag-spam.`,
    userPrompt: `Skriv ett LinkedIn-inlagg som later som klienten. Vinkel: nagonting fran senaste tiden (lardom, kundresultat, observation, fraga). Anvand winning examples som benchmark.`,
  },
  {
    type: "mejl_idea",
    category: "email",
    variants: 5,
    keepTop: 3,
    targetLength: { min: 60, max: 180 },
    systemPrompt: `Du skriver mejl-utkast i kundens roest. Mal: en konkret idé for veckans nyhetsbrev eller cold email.
Output:
- Amnesrad (under 50 tecken)
- Pre-header (50-90 tecken som kompletterar)
- Brodtext (60-180 ord)
- CTA (en fraga eller knapp)
- PS (det viktigaste, en mening)
Inga AI-floskler. Inga "Hoppas du mar bra".`,
    userPrompt: `Skriv ett mejl-utkast som later som klienten. Vinkel: en konkret observation/laerdom/kundresultat. Anvand winning examples som benchmark.`,
  },
];

interface IdeaRow {
  client_id: string;
  type: string;
  body: string;
  voice_score: number | null;
  variant_count: number;
  source: string;
  metadata: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  const sb = supabaseServer();

  // Hamta aktiva klienter med voice-fingerprint (har minst 5 source assets)
  const { data: profiles } = await sb
    .from("client_voice_profile")
    .select("client_id, source_asset_count")
    .gte("source_asset_count", 5);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "Inga klienter med tillracklig voice-fingerprint",
      duration_ms: Date.now() - t0,
    });
  }

  const results: Array<{ client_id: string; type: string; saved: number; top_score: number | null; error?: string }> = [];
  const ideasToInsert: IdeaRow[] = [];

  for (const profile of profiles) {
    const clientId = profile.client_id as string;

    for (const task of TASKS) {
      try {
        const result = await iterateGenerate({
          systemPrompt: task.systemPrompt,
          userPrompt: task.userPrompt,
          clientId,
          variants: task.variants,
          targetLength: task.targetLength,
          category: task.category,
          temperature: 0.85,
          maxTokens: 1500,
        });

        // Spara topp N varianter
        const topVariants = result.all_variants.slice(0, task.keepTop);
        for (const v of topVariants) {
          ideasToInsert.push({
            client_id: clientId,
            type: task.type,
            body: v.text,
            voice_score: v.score?.total ?? null,
            variant_count: result.variant_count,
            source: "night-iterate",
            metadata: {
              issues: v.score?.issues ?? [],
              breakdown: v.score?.breakdown ?? null,
              run_at: new Date().toISOString(),
            },
          });
        }

        results.push({
          client_id: clientId,
          type: task.type,
          saved: topVariants.length,
          top_score: topVariants[0]?.score?.total ?? null,
        });
      } catch (e) {
        results.push({
          client_id: clientId,
          type: task.type,
          saved: 0,
          top_score: null,
          error: (e as Error).message,
        });
      }
    }
  }

  if (ideasToInsert.length > 0) {
    const { error } = await sb.from("ideas_bank").insert(ideasToInsert);
    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        attempted: ideasToInsert.length,
        results,
        duration_ms: Date.now() - t0,
      }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    clients_processed: profiles.length,
    ideas_saved: ideasToInsert.length,
    results,
    duration_ms: Date.now() - t0,
  });
}
