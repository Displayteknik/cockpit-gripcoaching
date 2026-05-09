import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { sendEmail, weeklyReportEmailHtml, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300;

// Vecko-rapport till klient. Cron varje måndag 07:00.
// Manuellt: curl -H "Authorization: Bearer $CRON_SECRET" /api/reports/weekly-cron
// Test for en specifik klient: ?client_id=<uuid>&dry_run=1

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  public_url: string | null;
  report_recipients: string | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ error: "RESEND_API_KEY saknas" }, { status: 500 });
  }

  const url = new URL(req.url);
  const onlyClient = url.searchParams.get("client_id");
  const dryRun = url.searchParams.get("dry_run") === "1";

  const sb = supabaseServer();
  let q = sb
    .from("clients")
    .select("id, name, slug, public_url, report_recipients")
    .eq("archived", false)
    .not("report_recipients", "is", null);
  if (onlyClient) q = q.eq("id", onlyClient);

  const { data: clients } = await q;
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, message: "Inga klienter med report_recipients", count: 0 });
  }

  const results: Array<{ client_id: string; name: string; sent: boolean; reason?: string; recipients?: string[] }> = [];

  for (const cRaw of clients) {
    const c = cRaw as ClientRow;
    try {
      const summary = await buildClientSummary(c.id);
      const recipients = (c.report_recipients ?? "")
        .split(/[;,\s]+/)
        .map((s) => s.trim())
        .filter((s) => /.+@.+\..+/.test(s));

      if (recipients.length === 0) {
        results.push({ client_id: c.id, name: c.name, sent: false, reason: "inga giltiga mottagare" });
        continue;
      }

      if (dryRun) {
        results.push({ client_id: c.id, name: c.name, sent: false, reason: "dry_run", recipients });
        continue;
      }

      const html = weeklyReportEmailHtml({
        client_name: c.name,
        summary,
        report_url: c.public_url || `https://cockpit.gripcoaching.se/dashboard/seo`,
      });

      const r = await sendEmail({
        to: recipients,
        subject: `Veckorapport — ${c.name}`,
        html,
      });

      results.push({
        client_id: c.id,
        name: c.name,
        sent: r.sent,
        reason: r.reason,
        recipients,
      });
    } catch (e) {
      results.push({ client_id: c.id, name: c.name, sent: false, reason: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent && r.reason !== "dry_run").length,
    skipped: results.filter((r) => r.reason === "dry_run").length,
    results,
  });
}

async function buildClientSummary(clientId: string): Promise<string> {
  const sb = supabaseServer();
  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [v7, v14, gscDaily, ideas, audits, approvals] = await Promise.all([
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", since7),
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", since14).lt("ts", since7),
    sb
      .from("gsc_queries_daily")
      .select("clicks, impressions, position")
      .eq("client_id", clientId)
      .is("query", null)
      .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
    sb
      .from("ideas_bank")
      .select("id, status, type, created_at")
      .eq("client_id", clientId)
      .gte("created_at", since7),
    sb
      .from("hm_seo_audits")
      .select("id, seo_score, aeo_score, audited_at")
      .eq("client_id", clientId)
      .gte("audited_at", since7)
      .order("audited_at", { ascending: false })
      .limit(5),
    sb
      .from("approvals")
      .select("id, status")
      .eq("client_id", clientId)
      .gte("created_at", since7),
  ]);

  type DailyRow = { clicks: number; impressions: number; position: number | string };
  const daily = (gscDaily.data ?? []) as DailyRow[];
  const clicks = daily.reduce((s, r) => s + (r.clicks ?? 0), 0);
  const impressions = daily.reduce((s, r) => s + (r.impressions ?? 0), 0);
  const avgPos = daily.length > 0
    ? daily.reduce((s, r) => s + (typeof r.position === "string" ? parseFloat(r.position) : r.position), 0) / daily.length
    : null;

  const v7c = v7.count ?? 0;
  const v14c = v14.count ?? 0;
  const trend = v14c > 0 ? Math.round(((v7c - v14c) / v14c) * 100) : null;

  const ideasArr = (ideas.data ?? []) as Array<{ status: string; type: string }>;
  const ideasNew = ideasArr.length;
  const ideasApproved = ideasArr.filter((i) => i.status === "approved").length;

  const auditsArr = (audits.data ?? []) as Array<{ seo_score: number | null }>;
  const lastAudit = auditsArr[0];
  const approvalsArr = (approvals.data ?? []) as Array<{ status: string }>;
  const pendingApprovals = approvalsArr.filter((a) => a.status === "pending").length;

  const lines: string[] = [];
  lines.push(`<strong>Trafik (7 d):</strong> ${v7c} besök${trend !== null ? ` (${trend >= 0 ? "+" : ""}${trend}% mot förra veckan)` : ""}`);
  if (impressions > 0) {
    lines.push(`<strong>Sök (Google):</strong> ${clicks} klick · ${impressions.toLocaleString("sv-SE")} visningar${avgPos !== null ? ` · snittposition ${avgPos.toFixed(1)}` : ""}`);
  }
  lines.push(`<strong>Idé-bank:</strong> ${ideasNew} nya utkast${ideasApproved > 0 ? ` · ${ideasApproved} godkända` : ""}`);
  if (pendingApprovals > 0) lines.push(`<strong>Väntar på dig:</strong> ${pendingApprovals} utkast att granska`);
  if (lastAudit?.seo_score !== null && lastAudit?.seo_score !== undefined) {
    lines.push(`<strong>Senaste SEO-audit:</strong> ${lastAudit.seo_score}/100`);
  }
  if (lines.length === 1) lines.push("Inget extra att rapportera den här veckan.");

  return lines.join("\n");
}
