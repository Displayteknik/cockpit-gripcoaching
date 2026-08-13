import { supabaseService } from "@/lib/supabase-admin";
import { loggaHandelse } from "@/lib/ai-usage";
import { granskaRapport } from "@/lib/deep-audit-granska";
import { beslutstabell } from "@/lib/deep-audit-siffror";

const MODEL = "claude-sonnet-4-5";

// Finaliserar pågående djupgransknings-batchar: kollar Anthropic-batchens status och
// sparar den färdiga rapporten (status active) eller markerar failed. Delas av:
//  - GET /api/analytics/deep-audit (finaliserar aktuell klients jobb vid varje poll)
//  - /api/scheduler/cron (finaliserar ALLA klienters jobb var 5:e minut → pålitligt även
//    om användaren stängt fönstret innan batchen var klar).
// Idempotent: gör inget om inget är klart. Säkert att köra ofta.
export async function finalizePendingAudits(clientId?: string): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 0;
  const sb = supabaseService();

  let q = sb
    .from("client_assets")
    .select("id, metadata")
    .eq("category", "deep_audit_report")
    .eq("status", "processing")
    .limit(20);
  if (clientId) q = q.eq("client_id", clientId);
  const { data: pending } = await q;

  let finalized = 0;
  for (const row of (pending ?? []) as Array<{
    id: string;
    metadata: {
      batch_id?: string; tillatna_tal?: string[]; crawlade_urler?: string[];
      gsc_tal?: string[]; kunskapsfalt?: string | null;
      citatkallor?: string[]; tackningstext?: string | null;
    } | null;
  }>) {
    const batchId = row.metadata?.batch_id;
    if (!batchId) continue;
    try {
      const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!statusRes.ok) continue;
      const batch = (await statusRes.json()) as { processing_status: string; results_url: string | null };
      if (batch.processing_status !== "ended" || !batch.results_url) continue;

      const resultsRes = await fetch(batch.results_url, {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      const jsonl = await resultsRes.text();
      const firstLine = jsonl.split("\n").find((l) => l.trim());
      let text = "";
      let failed = !firstLine;
      if (firstLine) {
        const parsed = JSON.parse(firstLine) as {
          result: {
            type: string;
            message?: { content: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
          };
        };
        if (parsed.result.type === "succeeded" && parsed.result.message) {
          // KOSTNAD-1: HÄR bokförs kostnaden för djupgranskningen. Batch-API:t tar betalt
          // för det som faktiskt genererades, och token-siffrorna finns först i resultatet.
          await loggaHandelse({
            provider: "anthropic",
            model: MODEL,
            flow: "djupgranskning",
            tenantId: clientId ?? null,
            tokensIn: parsed.result.message.usage?.input_tokens ?? 0,
            tokensUt: parsed.result.message.usage?.output_tokens ?? 0,
            status: "ok",
            latencyMs: 0,
          });
          text = parsed.result.message.content
            .map((b) => (b.type === "text" ? b.text ?? "" : ""))
            .join("")
            .trim();
        } else {
          failed = true;
        }
      }
      // ★ SANNINGSGRINDEN (RAPPORT-1, R-2). Prompten är första försvaret; det här är
      //   spärren. Deterministisk och körs på ALLT som kommer tillbaka, oavsett hur
      //   välskriven texten ser ut.
      let avvikelser: { typ: string; detalj: string }[] = [];
      let luckor: string[] = [];
      let sifferbeslut: unknown[] = [];
      if (text) {
        const granskad = granskaRapport(text, {
          tillatnaTal: row.metadata?.tillatna_tal ?? [],
          crawladeUrler: row.metadata?.crawlade_urler ?? [],
          gscTal: row.metadata?.gsc_tal ?? [],
          kunskapsfalt: row.metadata?.kunskapsfalt ?? null,
          citatkallor: row.metadata?.citatkallor ?? [],
          tackningstext: row.metadata?.tackningstext ?? null,
        });
        text = granskad.text;
        avvikelser = granskad.avvikelser;
        luckor = granskad.luckor;
        sifferbeslut = granskad.sifferbeslut;
        // R-5/punkt 2: beslutstabellen bifogas rapporten sa varje tal gar att stickprova
        // mot klass och kalla, utan att behova leta i loggar.
        if (granskad.sifferbeslut.length) {
          // R-5/punkt 2: beslutstabellen bifogas rapporten så varje tal går att stickprova
          // mot klass och källa, utan att någon behöver leta i loggar.
          text += [
            "", "---", "",
            "### Så här bedömdes varje siffra",
            "",
            "T = din egen uppgift, B = branschfakta, G = Googles data.",
            "",
            beslutstabell(granskad.sifferbeslut),
            "",
          ].join("\n");
        }
        if (avvikelser.length) {
          console.warn(`[djupgranskning] grinden rättade ${avvikelser.length} avvikelser i ${row.id}: ` +
            avvikelser.map((a) => a.typ).join(", "));
        }
      }

      await sb
        .from("client_assets")
        .update({
          body: text,
          status: failed || !text ? "failed" : "active",
          metadata: {
            ...(row.metadata ?? {}),
            generated_at: new Date().toISOString(),
            // Bevis på vad grinden gjorde. Utan detta går en rättad rapport inte att skilja
            // från en som var korrekt från början, och då kan felkällan aldrig mätas.
            grind_avvikelser: avvikelser,
            grind_luckor: luckor,
            grind_sifferbeslut: sifferbeslut,
          },
        })
        .eq("id", row.id);
      if (!failed && text) finalized++;
    } catch {
      /* försök igen vid nästa poll/cron */
    }
  }
  return finalized;
}
