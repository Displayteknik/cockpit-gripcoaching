import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId, logActivity } from "@/lib/client-context";
import { generate } from "@/lib/gemini";
import { getKnowledge } from "@/lib/knowledge";
import { sendEmail, weeklyReportEmailHtml, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 180;

function fmt(d: Date) { return d.toISOString().slice(0, 10); }

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("weekly_reports").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(20);
  return NextResponse.json(data || []);
}

interface GenerateBody { send?: boolean; recipients?: string[] }

// POST: generera + (valfritt) skicka veckorapport NU
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = (await req.json().catch(() => ({}))) as GenerateBody;
  const sb = supabaseServer();

  const end = new Date();
  const start = new Date(Date.now() - 7 * 86400000);

  const [visits7, visitsPrev, leads7, blogs7, social7, gscRows, ga4row] = await Promise.all([
    sb.from("hm_visits").select("path, ts, referrer").eq("client_id", clientId).gte("ts", start.toISOString()),
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", clientId).gte("ts", new Date(Date.now() - 14 * 86400000).toISOString()).lt("ts", start.toISOString()),
    sb.from("hm_leads").select("*").eq("client_id", clientId).gte("created_at", start.toISOString()),
    sb.from("hm_blog").select("title, slug, published, published_at").eq("client_id", clientId).gte("published_at", start.toISOString()),
    sb.from("hm_social_posts").select("platform, format, status, hook, hashtags, created_at").eq("client_id", clientId).gte("created_at", start.toISOString()),
    sb.from("gsc_queries").select("query, clicks, impressions, position").eq("client_id", clientId).order("clicks", { ascending: false }).limit(30),
    sb.from("google_connections").select("ga_property_id").eq("client_id", clientId).maybeSingle(),
  ]);

  // GA4 om kopplat
  let ga4: { sessions?: number; conversions?: number; channels?: { channel: string; sessions: number }[] } | null = null;
  if (ga4row.data?.ga_property_id) {
    try {
      const r = await fetch(`${req.nextUrl.origin}/api/google/ga4/report?days=7`, { headers: { cookie: req.headers.get("cookie") || "" } });
      if (r.ok) {
        const data = await r.json();
        ga4 = { sessions: data.overview?.sessions, conversions: data.overview?.conversions, channels: data.channels?.slice(0, 5) };
      }
    } catch { /* tyst */ }
  }

  const visitCount = visits7.data?.length || 0;
  const visitPrevCount = visitsPrev.count || 0;
  const visitDelta = visitPrevCount > 0 ? Math.round((visitCount - visitPrevCount) / visitPrevCount * 100) : null;

  const topPaths = (() => {
    const m = new Map<string, number>();
    for (const v of visits7.data || []) m.set(v.path, (m.get(v.path) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  })();

  const dataBlock = `
PERIOD: ${fmt(start)} → ${fmt(end)}
KLIENT: ${client?.name}

TRAFIK (intern tracker):
- Besök denna vecka: ${visitCount}
- Föregående vecka: ${visitPrevCount}
- Förändring: ${visitDelta != null ? `${visitDelta > 0 ? "+" : ""}${visitDelta}%` : "ingen jämförelse"}
- Top sidor: ${topPaths.map(([p, n]) => `${p} (${n})`).join(", ") || "—"}

${ga4 ? `GA4 (7d): sessions=${ga4.sessions}, conversions=${ga4.conversions}
Top kanaler: ${ga4.channels?.map((c) => `${c.channel} (${c.sessions})`).join(", ") || "—"}` : "GA4: ej kopplat"}

LEADS (7d): ${leads7.data?.length || 0} st
${(leads7.data || []).map((l) => `- ${l.name || "Anonym"} (score ${l.score ?? "?"}/10) — ${l.interest?.slice(0, 80)}`).join("\n") || "(inga)"}

BLOGGARTIKLAR PUBLICERADE: ${blogs7.data?.filter((b) => b.published).length || 0}
${(blogs7.data || []).filter((b) => b.published).map((b) => `- ${b.title}`).join("\n") || "(inga)"}

SOCIAL (utkast/godkända denna vecka): ${social7.data?.length || 0}
${(social7.data || []).slice(0, 5).map((s) => `- ${s.platform} ${s.format}: ${s.hook?.slice(0, 60)}`).join("\n") || "(inga)"}

TOP SÖKORD (Search Console totalt):
${(gscRows.data || []).slice(0, 10).map((g) => `- ${g.query}: ${g.clicks} klick, position ${g.position?.toFixed(1)}`).join("\n") || "(GSC ej synkat)"}
`;

  const knowledge = await getKnowledge();
  const summary = await generate({
    model: "gemini-2.5-pro",
    systemInstruction: `Du skriver en kort, ärlig veckorapport för ett företag. Format:

1) STATUS — 2–3 meningar om var vi står just nu
2) VECKANS HÖJDPUNKTER — punktlista med 3–5 konkreta vinster
3) BEKYMMER — saker som behöver fixas (inkl. heta leads som inte ringts)
4) NÄSTA VECKA — 3–5 konkreta åtgärder, prioriterade

Svenska. Ingen AI-jargong. Skriv som en konsult som vet vad hen pratar om.

${knowledge}`,
    prompt: dataBlock,
    temperature: 0.5,
    maxOutputTokens: 2500,
  });

  const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#111">
<h1 style="font-size:20px">Veckorapport — ${client?.name}</h1>
<p style="color:#6b7280;font-size:13px">${fmt(start)} → ${fmt(end)}</p>
<div style="white-space:pre-wrap;line-height:1.6">${summary.replace(/\n/g, "<br>")}</div>
<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
<p style="font-size:12px;color:#9ca3af">Genererad ${new Date().toLocaleString("sv-SE")}</p>
</body></html>`;

  const { data: report } = await sb.from("weekly_reports").insert({
    client_id: clientId,
    period_start: fmt(start),
    period_end: fmt(end),
    summary,
    html,
  }).select().single();

  // Skicka email om begärt
  let email_status: { sent: boolean; to: string[]; reason?: string } = { sent: false, to: [] };
  if (body.send) {
    const recipients = body.recipients?.length ? body.recipients : (client?.report_recipients ? client.report_recipients.split(/[,\s]+/).filter(Boolean) : []);
    if (recipients.length === 0) {
      email_status = { sent: false, to: [], reason: "Inga mottagare. Sätt report_recipients på klienten eller skicka recipients i body." };
    } else if (!emailConfigured()) {
      email_status = { sent: false, to: recipients, reason: "RESEND_API_KEY saknas" };
    } else {
      const result = await sendEmail({
        to: recipients,
        subject: `Veckorapport: ${client?.name} (${fmt(start)} → ${fmt(end)})`,
        html: weeklyReportEmailHtml({ client_name: client?.name || "", summary }),
      });
      email_status = { sent: result.sent, to: recipients, reason: result.reason };
      if (result.sent) {
        await sb.from("weekly_reports").update({ sent_to: recipients.join(", "), sent_at: new Date().toISOString() }).eq("id", report?.id);
      }
    }
  }

  await logActivity(clientId, "weekly_report", `Veckorapport genererad${email_status.sent ? ` + mejlad till ${email_status.to.length} mottagare` : ""}`, "/dashboard/rapport");
  return NextResponse.json({ report, email_status });
}
