import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { LEAD_RECIPIENTS } from "@/lib/contact";
import { HM_MOTOR_CLIENT_ID } from "@/lib/supabase";

export const runtime = "nodejs";

function esc(s: string): string {
  return String(s || "").replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as Record<string, string>)[c]));
}

// Publik lead-endpoint. Mejl = primär leverans (alltid). DB-lagring = best effort (för dashboard).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    // Honeypot — tysta bottar utan att avslöja något
    if (body.company) return NextResponse.json({ ok: true });

    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 200);
    const phone = String(body.phone || "").trim().slice(0, 60);
    const message = String(body.message || "").trim().slice(0, 4000);
    const interest = String(body.interest || "").trim().slice(0, 100);
    const vehicleSlug = String(body.vehicle_slug || "").trim().slice(0, 200);
    const vehicleTitle = String(body.vehicle_title || "").trim().slice(0, 300);
    const source = String(body.source || "webb").trim().slice(0, 50);

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        { ok: false, error: "Fyll i namn och minst e-post eller telefon." },
        { status: 400 },
      );
    }

    const subject = vehicleTitle
      ? `Intresseanmälan: ${vehicleTitle}`
      : `Ny förfrågan från hmmotor.se${interest ? ` (${interest})` : ""}`;

    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#1d4ed8;height:6px"></div>
  <div style="padding:24px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827">${vehicleTitle ? "Intresseanmälan" : "Ny förfrågan"} via hmmotor.se</h1>
    <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">
      <tr><td style="padding:6px 0;color:#6b7280;width:120px">Namn</td><td style="padding:6px 0;font-weight:600">${esc(name)}</td></tr>
      ${email ? `<tr><td style="padding:6px 0;color:#6b7280">E-post</td><td style="padding:6px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>` : ""}
      ${phone ? `<tr><td style="padding:6px 0;color:#6b7280">Telefon</td><td style="padding:6px 0"><a href="tel:${esc(phone)}">${esc(phone)}</a></td></tr>` : ""}
      ${interest ? `<tr><td style="padding:6px 0;color:#6b7280">Intresse</td><td style="padding:6px 0">${esc(interest)}</td></tr>` : ""}
      ${vehicleTitle ? `<tr><td style="padding:6px 0;color:#6b7280">Fordon</td><td style="padding:6px 0">${esc(vehicleTitle)}${vehicleSlug ? ` — <a href="https://hmmotor.se/fordon/${esc(vehicleSlug)}">visa annons</a>` : ""}</td></tr>` : ""}
      <tr><td style="padding:6px 0;color:#6b7280">Källa</td><td style="padding:6px 0">${esc(source)}</td></tr>
    </table>
    ${message ? `<div style="background:#f9fafb;border-left:4px solid #1d4ed8;padding:12px 16px;border-radius:6px;color:#374151;font-size:14px;margin-top:16px;white-space:pre-line">${esc(message)}</div>` : ""}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Svara direkt på detta mejl för att nå kunden.</p>
  </div>
</div></body></html>`;

    // 1) Mejl = primär leverans (går alltid, även om DB-tabellen inte finns än)
    const mail = await sendEmail({
      to: LEAD_RECIPIENTS,
      subject,
      html,
      reply_to: email || undefined,
    });

    // 2) DB-lagring = best effort (för dashboard). Får ALDRIG fälla requesten.
    try {
      const sb = supabaseServer();
      await sb.from("hm_leads").insert({
        client_id: HM_MOTOR_CLIENT_ID,
        name,
        email: email || null,
        phone: phone || null,
        message: message || null,
        interest: interest || null,
        vehicle_slug: vehicleSlug || null,
        vehicle_title: vehicleTitle || null,
        source,
        status: "new",
        user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
      });
      await sb.from("client_activity").insert({
        client_id: HM_MOTOR_CLIENT_ID,
        type: "lead",
        title: vehicleTitle ? `Intresseanmälan: ${vehicleTitle}` : `Förfrågan från ${name}`,
        meta: { email, phone, source, interest },
      });
    } catch {
      /* tabell ännu ej skapad — mejlet har redan gått, ingen lead tappad */
    }

    return NextResponse.json({ ok: true, emailed: mail.sent });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Serverfel — försök igen eller ring oss direkt." },
      { status: 500 },
    );
  }
}
