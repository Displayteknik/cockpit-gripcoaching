import { supabaseService } from "@/lib/supabase-admin";

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
  for (const row of (pending ?? []) as Array<{ id: string; metadata: { batch_id?: string } | null }>) {
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
          result: { type: string; message?: { content: Array<{ type: string; text?: string }> } };
        };
        if (parsed.result.type === "succeeded" && parsed.result.message) {
          text = parsed.result.message.content
            .map((b) => (b.type === "text" ? b.text ?? "" : ""))
            .join("")
            .trim();
        } else {
          failed = true;
        }
      }
      await sb
        .from("client_assets")
        .update({
          body: text,
          status: failed || !text ? "failed" : "active",
          metadata: { ...(row.metadata ?? {}), generated_at: new Date().toISOString() },
        })
        .eq("id", row.id);
      if (!failed && text) finalized++;
    } catch {
      /* försök igen vid nästa poll/cron */
    }
  }
  return finalized;
}
