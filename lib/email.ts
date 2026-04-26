// Resend email-helper. Gratis 3000/månad. RESEND_API_KEY krävs.
// Om saknas → returnerar { sent: false, reason: "no_key" } men kraschar inte.

interface SendOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  reply_to?: string;
}

export async function sendEmail(opts: SendOptions): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "no_key" };
  const from = opts.from || process.env.RESEND_FROM || "Cockpit <onboarding@resend.dev>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.reply_to,
      }),
    });
    if (!r.ok) return { sent: false, reason: await r.text() };
    const d = await r.json();
    return { sent: true, id: d.id };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export function approvalEmailHtml({ recipient_name, client_name, share_url, resource_type, preview }: { recipient_name?: string; client_name: string; share_url: string; resource_type: string; preview: string }): string {
  const t = resource_type === "blog" ? "en bloggartikel" : "ett socialt inlägg";
  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);height:6px"></div>
  <div style="padding:24px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">Hej${recipient_name ? " " + recipient_name : ""},</h1>
    <p style="color:#374151;line-height:1.6;margin:0 0 16px">${client_name} har ett utkast till ${t} klart för dig att granska.</p>
    <div style="background:#f9fafb;border-left:4px solid #2563eb;padding:12px 16px;border-radius:6px;color:#374151;font-size:14px;margin:16px 0">${preview.slice(0, 240)}${preview.length > 240 ? "…" : ""}</div>
    <p style="color:#374151;margin:0 0 20px">Klicka för att godkänna, avvisa eller föreslå ändringar:</p>
    <a href="${share_url}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">Granska &amp; svara →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Detta är en säker engångslänk. Behöver inget konto för att svara.</p>
  </div>
</div></body></html>`;
}

export function weeklyReportEmailHtml({ recipient_name, client_name, summary, report_url }: { recipient_name?: string; client_name: string; summary: string; report_url?: string }): string {
  return `<!doctype html><html><body style="font-family:-apple-system,sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:640px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#10b981,#2563eb);height:6px"></div>
  <div style="padding:24px">
    <h1 style="margin:0 0 8px;font-size:20px;color:#111827">Veckorapport — ${client_name}</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px">Hej${recipient_name ? " " + recipient_name : ""}, här är veckans status.</p>
    <div style="color:#374151;line-height:1.7;font-size:14px">${summary.replace(/\n/g, "<br>")}</div>
    ${report_url ? `<a href="${report_url}" style="display:inline-block;margin-top:20px;background:#10b981;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px">Öppna full rapport →</a>` : ""}
  </div>
</div></body></html>`;
}
