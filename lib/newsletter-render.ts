// Ren rendering av nyhetsbrev (INGA server-beroenden → säker i klientkomponenter).
// AI skriver text; layouten byggs deterministiskt här. Klienten kan re-rendera vid redigering.

export interface NewsletterContent {
  subjects: string[]; // ämnesrads-varianter (välj en)
  preheader: string; // förhandstext (visas efter ämnesraden i inkorgen)
  greeting: string; // "Hej!" e.d.
  intro: string; // krok-stycke
  sections: { heading: string; body: string }[]; // kondenserar bloggen
  cta_text: string; // knapptext (URL sätts deterministiskt)
  signoff: string; // avslutning
  /**
   * G-1c: genereringen som skrev nyhetsbrevet. Ligger i innehållsobjektet därför att
   * DET är vad som sparas (`content: b.content`) — id:t reser med utan att någon
   * klientkomponent behöver ändras. Renderarna läser namngivna fält och rör den inte.
   */
  generationId?: string | null;
}

export interface RenderOpts {
  brandName: string;
  primaryColor?: string;
  ctaUrl?: string; // sätts av anroparen (blogg-URL / bokningslänk). Utelämnas → ingen knapp.
}

function esc(t: string): string {
  return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function paras(t: string): string {
  return esc(t)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;color:#374151;line-height:1.65;font-size:15px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Email-säker HTML (inline styles). Brandad topplist + CTA-knapp.
export function renderNewsletterHtml(c: NewsletterContent, o: RenderOpts): string {
  const primary = o.primaryColor || "#1A6B3C";
  const sections = c.sections
    .map((s) => `${s.heading ? `<h2 style="margin:22px 0 8px;font-size:17px;color:#111827">${esc(s.heading)}</h2>` : ""}${paras(s.body)}`)
    .join("");
  const cta = o.ctaUrl
    ? `<div style="margin:24px 0"><a href="${esc(o.ctaUrl)}" style="display:inline-block;background:${primary};color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600;font-size:15px">${esc(c.cta_text)}</a></div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.preheader)}</span>
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:${primary};height:8px"></div>
    <div style="padding:28px">
      <div style="font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${primary};margin-bottom:14px">${esc(o.brandName)}</div>
      <p style="margin:0 0 14px;color:#111827;font-size:16px;font-weight:600">${esc(c.greeting)}</p>
      ${paras(c.intro)}
      ${sections}
      ${cta}
      ${c.signoff ? paras(c.signoff) : ""}
    </div>
  </div>
  <p style="text-align:center;color:#9ca3af;font-size:12px;margin:16px 0 0">Du får det här mejlet för att du är kund eller prenumerant hos ${esc(o.brandName)}.</p>
</div></body></html>`;
}

// Plain-text-version (sänker spam-poäng, obligatorisk multipart-del).
export function renderNewsletterText(c: NewsletterContent, o: { brandName: string; ctaUrl?: string }): string {
  const parts: string[] = [o.brandName.toUpperCase(), "", c.greeting, "", c.intro];
  for (const s of c.sections) { parts.push("", s.heading ? `— ${s.heading} —` : "", s.body); }
  if (o.ctaUrl) parts.push("", `${c.cta_text}: ${o.ctaUrl}`);
  if (c.signoff) parts.push("", c.signoff);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
