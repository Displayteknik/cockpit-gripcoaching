// Etapp L1 — leadavisering. Ett nytt lead ska aldrig ligga oupptäckt i Cockpit.
// Mejlar tenantens report_recipients via den befintliga Resend-integrationen.
//
// PRINCIP: aviseringen får ALDRIG fälla den request som skapade leadet. Leadet är
// primärleveransen, mejlet är en bonus. Allt här är best-effort och sväljer sina fel.
//
// DUBBLETT-SKYDD: två flöden mejlar redan idag och ska INTE hookas här.
//   - app/api/lead/route.ts (HM Motors webbformulär) mejlar hårdkodade LEAD_RECIPIENTS
//   - app/api/lifeibalans/lead|test mejlar redan report_recipients
// Att lägga på den generella aviseringen där hade gett två mejl per lead.

import { supabaseService } from "./supabase-admin";
import { sendEmail, emailConfigured } from "./email";

export interface LeadNotis {
  clientId: string;
  namn: string;
  /** Var leadet kom ifrån: "Bild", "Röst", "Manuellt", "Coach-chatt", "Formulär", "GHL-synk". */
  kalla: string;
  epost?: string | null;
  telefon?: string | null;
  /** Kort sammanfattning: meddelandet, anteckningen eller intresset. */
  innehall?: string | null;
  /** Absolut eller relativ länk till leadkortet. */
  lank: string;
}

// report_recipients är en kommaseparerad sträng. Splitten följer weekly-cron-varianten
// (semikolon, komma ELLER mellanslag) plus e-postvalidering, som är den striktaste
// av de fem varianter som finns i repot.
export function parseMottagare(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(/[;,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /.+@.+\..+/.test(s));
}

/** Default PÅ. Ett DB-fel får aldrig tysta aviseringen. */
async function aviseringPa(clientId: string): Promise<boolean> {
  try {
    const { data } = await supabaseService()
      .from("clients")
      .select("lead_notify_enabled")
      .eq("id", clientId)
      .maybeSingle();
    return data?.lead_notify_enabled !== false;
  } catch {
    return true;
  }
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function leadEmailHtml(n: LeadNotis & { klientNamn: string; url: string }): string {
  const rad = (etikett: string, varde?: string | null) =>
    varde ? `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;font-size:14px;white-space:nowrap">${esc(etikett)}</td><td style="padding:6px 0;color:#111827;font-size:14px">${esc(varde)}</td></tr>` : "";

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px">
  <p style="color:#6b7280;font-size:13px;margin:0 0 6px">${esc(n.klientNamn)}</p>
  <h1 style="font-size:20px;line-height:1.3;color:#111827;margin:0 0 4px">Nytt lead: ${esc(n.namn)}</h1>
  <p style="color:#6b7280;font-size:14px;margin:0 0 18px">Kom in via ${esc(n.kalla)}.</p>
  <table style="border-collapse:collapse;margin-bottom:18px">
    ${rad("E-post", n.epost)}
    ${rad("Telefon", n.telefon)}
  </table>
  ${n.innehall ? `<div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:20px"><p style="margin:0;color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(n.innehall.slice(0, 900))}</p></div>` : ""}
  <a href="${esc(n.url)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">Öppna leadkortet</a>
  <p style="color:#9ca3af;font-size:12px;margin:22px 0 0">Du får det här mejlet för att du står som mottagare på ${esc(n.klientNamn)} i Cockpit.</p>
</div>`;
}

function leadEmailText(n: LeadNotis & { klientNamn: string; url: string }): string {
  return [
    `Nytt lead: ${n.namn}`,
    `Kund: ${n.klientNamn}`,
    `Källa: ${n.kalla}`,
    n.epost ? `E-post: ${n.epost}` : "",
    n.telefon ? `Telefon: ${n.telefon}` : "",
    n.innehall ? `\n${n.innehall.slice(0, 900)}` : "",
    `\nÖppna leadkortet: ${n.url}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Skickar aviseringen. Returnerar alltid ett resultat, kastar aldrig.
 * Anropas med `void notifyNewLead(...)` efter att leadet faktiskt sparats.
 */
export async function notifyNewLead(n: LeadNotis): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!emailConfigured()) return { sent: false, reason: "no_key" };
    if (!(await aviseringPa(n.clientId))) return { sent: false, reason: "avstangd" };

    const { data: klient } = await supabaseService()
      .from("clients")
      .select("name, report_recipients")
      .eq("id", n.clientId)
      .maybeSingle();

    const mottagare = parseMottagare(klient?.report_recipients);
    if (!mottagare.length) return { sent: false, reason: "inga_mottagare" };

    const bas = (process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/$/, "");
    const url = n.lank.startsWith("http") ? n.lank : `${bas}${n.lank}`;
    const full = { ...n, klientNamn: klient?.name || "Cockpit", url };

    const res = await sendEmail({
      to: mottagare,
      subject: `Nytt lead: ${n.namn}${n.kalla ? ` (${n.kalla})` : ""}`,
      html: leadEmailHtml(full),
      text: leadEmailText(full),
      // Svara-knappen ska gå till leadet när vi har adressen.
      reply_to: n.epost || undefined,
    });
    return { sent: res.sent, reason: res.reason };
  } catch (e) {
    console.error("[lead-notify]", (e as Error).message);
    return { sent: false, reason: "fel" };
  }
}
