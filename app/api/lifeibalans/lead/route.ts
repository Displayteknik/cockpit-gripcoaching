import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { LEAD_FROM } from "@/lib/contact";

export const runtime = "nodejs";

function esc(s: string): string {
  return String(s || "").replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as Record<string, string>)[c]));
}

// Publik kontakt-/lead-endpoint för Life i Balans. Mejl = primär leverans.
// Mottagare = klientens report_recipients (annars fallback). Loggas till lead-tabellen.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (body.company) return NextResponse.json({ ok: true }); // honeypot

    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 200);
    const phone = String(body.phone || "").trim().slice(0, 60);
    const message = String(body.message || "").trim().slice(0, 4000);
    const source = String(body.source || "lifeibalans.se").trim().slice(0, 60);

    if (!name || !email) {
      return NextResponse.json({ ok: false, error: "Fyll i namn och e-post." }, { status: 400 });
    }

    const sb = supabaseServer();
    const { data: client } = await sb
      .from("clients")
      .select("id, report_recipients")
      .eq("slug", "lifeibalans")
      .single();

    const recipients = String(client?.report_recipients || "hakan@displayteknik.se")
      .split(/[,;\s]+/)
      .filter(Boolean);

    const subject = `Ny förfrågan från Life i Balans — ${name}`;

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#f6f2ea;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2dbcb">
  <div style="background:#38472f;height:6px"></div>
  <div style="padding:24px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#23241e">Ny förfrågan via Life i Balans</h1>
    <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;width:110px">Namn</td><td style="padding:6px 0;font-weight:600">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">E-post</td><td style="padding:6px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
      ${phone ? `<tr><td style="padding:6px 0;color:#6b7280">Telefon</td><td style="padding:6px 0"><a href="tel:${esc(phone)}">${esc(phone)}</a></td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#6b7280">Källa</td><td style="padding:6px 0">${esc(source)}</td></tr>
    </table>
    ${message ? `<div style="background:#f6f2ea;border-left:3px solid #b0623c;padding:12px 16px;border-radius:6px;color:#374151;font-size:14px;margin-top:16px;white-space:pre-line">${esc(message)}</div>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Svara direkt på detta mejl för att nå ${esc(name)}.</p>
  </div>
</div></body></html>`;

    const text = [
      "Ny förfrågan via Life i Balans", "",
      `Namn: ${name}`, `E-post: ${email}`, phone ? `Telefon: ${phone}` : "", `Källa: ${source}`,
      message ? `\nMeddelande:\n${message}` : "", "",
      `Svara direkt på detta mejl för att nå ${name}.`,
    ].filter((l) => l !== "").join("\n");

    const mail = await sendEmail({ to: recipients, from: LEAD_FROM, subject, html, text, reply_to: email });
    if (!mail.sent) console.error("[lifeibalans/lead] Mejl gick INTE iväg:", mail.reason);

    // Best effort — loggning får aldrig fälla requesten.
    try {
      if (client?.id) {
        await sb.from("hm_leads").insert({
          client_id: client.id, name, email, phone: phone || null,
          interest: "kontakt", source, status: "new", notes: message || null,
        });
        await sb.from("client_activity").insert({
          client_id: client.id, type: "lead", title: `Förfrågan från ${name}`, meta: { email, phone, source },
        });
      }
    } catch { /* tabell/kolumn saknas — mejlet har redan gått */ }

    return NextResponse.json({ ok: true, emailed: mail.sent });
  } catch {
    return NextResponse.json({ ok: false, error: "Serverfel — försök igen eller mejla direkt." }, { status: 500 });
  }
}
