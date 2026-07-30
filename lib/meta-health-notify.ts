// ANSLUT-3 — mail när en tokenhälsa slår om till Varning eller Död. Best-effort: sväljer
// sina egna fel så en misslyckad avisering aldrig fäller hälsokontrollen. Mönster speglar
// lib/lead-notify.ts (report_recipients + Resend).

import { supabaseService } from "./supabase-admin";
import { sendEmail, emailConfigured } from "./email";
import { parseMottagare } from "./lead-notify";

export interface HealthNotis {
  clientId: string | null; // null = ägar-token
  clientName: string;
  scope: "owner" | "page";
  status: "warning" | "dead";
  reason: string;
}

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function healthHtml(n: HealthNotis & { url: string }): string {
  const rubrik = n.status === "dead" ? "Instagram-kopplingen har slutat fungera" : "Instagram-kopplingen behöver ses över";
  const farg = n.status === "dead" ? "#dc2626" : "#d97706";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px">
  <p style="color:#6b7280;font-size:13px;margin:0 0 6px">${esc(n.clientName)}</p>
  <h1 style="font-size:20px;line-height:1.3;color:${farg};margin:0 0 8px">${esc(rubrik)}</h1>
  <p style="color:#374151;font-size:14px;margin:0 0 6px">Orsak: ${esc(n.reason)}</p>
  <p style="color:#6b7280;font-size:14px;margin:0 0 18px">${n.scope === "owner"
    ? "Det gäller ägar-anslutningen till Meta. Nya IG-konton kan inte kopplas förrän den är åtgärdad."
    : "Publicering och analys för den här klienten pausas tills kopplingen åtgärdas."}</p>
  <a href="${esc(n.url)}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">Åtgärda kopplingen</a>
</div>`;
}

function healthText(n: HealthNotis & { url: string }): string {
  return [
    n.status === "dead" ? "Instagram-kopplingen har slutat fungera" : "Instagram-kopplingen behöver ses över",
    `Kund: ${n.clientName}`,
    `Orsak: ${n.reason}`,
    `\nÅtgärda: ${n.url}`,
  ].join("\n");
}

export async function notifyTokenHealth(n: HealthNotis): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!emailConfigured()) return { sent: false, reason: "no_key" };

    const sb = supabaseService();
    const bas = (process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/$/, "");
    const url = n.scope === "owner" ? `${bas}/dashboard/installningar/meta` : `${bas}/dashboard/installningar`;

    // Mottagare: ägar-token → alla report_recipients samlade; page → den tenantens.
    let recipients: string[] = [];
    if (n.scope === "page" && n.clientId) {
      const { data } = await sb.from("clients").select("report_recipients").eq("id", n.clientId).maybeSingle();
      recipients = parseMottagare(data?.report_recipients);
    } else {
      const { data } = await sb.from("clients").select("report_recipients");
      const set = new Set<string>();
      for (const row of data || []) parseMottagare(row.report_recipients).forEach((e) => set.add(e));
      recipients = [...set];
    }
    if (!recipients.length) return { sent: false, reason: "inga_mottagare" };

    const full = { ...n, url };
    const res = await sendEmail({
      to: recipients,
      subject: `${n.status === "dead" ? "Åtgärd krävs" : "Varning"}: Instagram — ${n.clientName}`,
      html: healthHtml(full),
      text: healthText(full),
    });
    return { sent: res.sent, reason: res.reason };
  } catch (e) {
    console.error("[meta-health-notify]", (e as Error).message);
    return { sent: false, reason: "fel" };
  }
}
