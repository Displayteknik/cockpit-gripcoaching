import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { sendEmail, weeklyReportEmailHtml, emailConfigured } from "@/lib/email";

export const runtime = "nodejs";

interface Body { recipients?: string[] }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = await getActiveClientId();
  const body = (await req.json().catch(() => ({}))) as Body;

  const sb = supabaseServer();
  const client = await getActiveClient();
  const { data: report } = await sb.from("weekly_reports").select("*").eq("id", id).eq("client_id", clientId).maybeSingle();
  if (!report) return NextResponse.json({ error: "Rapport hittades inte" }, { status: 404 });

  const recipients = body.recipients?.length
    ? body.recipients
    : (client?.report_recipients ? client.report_recipients.split(/[,\s]+/).filter(Boolean) : []);

  if (recipients.length === 0) return NextResponse.json({ error: "Inga mottagare. Ange recipients eller sätt report_recipients på klienten." }, { status: 400 });
  if (!emailConfigured()) return NextResponse.json({ error: "RESEND_API_KEY saknas i env" }, { status: 400 });

  const result = await sendEmail({
    to: recipients,
    subject: `Veckorapport: ${client?.name} (${report.period_start} → ${report.period_end})`,
    html: weeklyReportEmailHtml({ client_name: client?.name || "", summary: report.summary }),
  });

  if (result.sent) {
    await sb.from("weekly_reports").update({ sent_to: recipients.join(", "), sent_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, to: recipients });
  }
  return NextResponse.json({ error: result.reason || "Email misslyckades" }, { status: 500 });
}
