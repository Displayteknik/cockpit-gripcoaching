import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const LIB_FROM = "Life i Balans <noreply@mysales.se>";

function esc(s: string): string {
  return String(s || "").replace(/[<>&]/g, (c) => (({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as Record<string, string>)[c]));
}

// Nervsystemstestet — leadnotis till Linda + profil-mejl till deltagaren.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    if (body.company) return NextResponse.json({ ok: true }); // honeypot

    const name = String(body.name || "").trim().slice(0, 200);
    const email = String(body.email || "").trim().slice(0, 200);
    const profileTitle = String(body.profileTitle || "").trim().slice(0, 300);
    const profileBody = String(body.profileBody || "").trim().slice(0, 3000);
    const total = Number(body.total) || 0;
    if (!name || !email) return NextResponse.json({ ok: false, error: "Namn och e-post krävs." }, { status: 400 });

    const sb = supabaseServer();
    const { data: client } = await sb.from("clients").select("id, report_recipients").eq("slug", "lifeibalans").single();
    const recipients = String(client?.report_recipients || "hakan@displayteknik.se").split(/[,;\s]+/).filter(Boolean);

    const wrap = (inner: string) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,'Segoe UI',sans-serif;background:#f6f2ea;padding:24px;margin:0"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2dbcb"><div style="background:#38472f;height:6px"></div><div style="padding:24px">${inner}</div></div></body></html>`;

    // 1) Notis till Linda
    const adminHtml = wrap(`<h1 style="margin:0 0 12px;font-size:20px;color:#23241e">Nytt nervsystemstest</h1>
      <table style="width:100%;font-size:14px;color:#374151"><tr><td style="color:#6b7280;width:90px;padding:5px 0">Namn</td><td style="font-weight:600">${esc(name)}</td></tr><tr><td style="color:#6b7280;padding:5px 0">E-post</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr><tr><td style="color:#6b7280;padding:5px 0">Profil</td><td style="font-weight:600">${esc(profileTitle)}</td></tr><tr><td style="color:#6b7280;padding:5px 0">Poäng</td><td>${total} / 45</td></tr></table>
      <div style="background:#f6f2ea;border-left:3px solid #b0623c;padding:12px 16px;border-radius:6px;color:#374151;font-size:14px;margin-top:14px">${esc(profileBody)}</div>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Svara direkt på detta mejl för att nå ${esc(name)}.</p>`);
    const adminText = `Nytt nervsystemstest\n\nNamn: ${name}\nE-post: ${email}\nProfil: ${profileTitle}\nPoäng: ${total}/45\n\n${profileBody}\n\nSvara direkt på detta mejl för att nå ${name}.`;
    const adminMail = await sendEmail({ to: recipients, from: LIB_FROM, subject: `Nytt nervsystemstest — ${name} (${profileTitle})`, html: adminHtml, text: adminText, reply_to: email });
    if (!adminMail.sent) console.error("[lifeibalans/test] admin-mejl:", adminMail.reason);

    // 2) Profil till deltagaren
    const userHtml = wrap(`<p style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7a6430;margin:0 0 8px">Din profil</p>
      <h1 style="margin:0 0 10px;font-size:22px;color:#23241e;font-family:Georgia,serif">${esc(profileTitle)}</h1>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0">${esc(profileBody)}</p>
      <p style="margin:22px 0 0"><a href="https://lifeibalans.se/programmen" style="display:inline-block;background:#b0623c;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:4px">Se programmen</a></p>
      <p style="color:#9ca3af;font-size:12px;margin-top:20px">Det här är en självskattning, inte en diagnos. Vid akut fara, ring 112. — Linda, Life i Balans</p>`);
    const userText = `Din profil: ${profileTitle}\n\n${profileBody}\n\nSe programmen: https://lifeibalans.se/programmen\n\nDet här är en självskattning, inte en diagnos. Vid akut fara, ring 112.\n— Linda, Life i Balans`;
    await sendEmail({ to: [email], from: LIB_FROM, subject: "Din nervsystems-profil — Life i Balans", html: userHtml, text: userText });

    try {
      if (client?.id) {
        await sb.from("hm_leads").insert({ client_id: client.id, name, email, interest: "nervsystemstest", source: "nervsystemstestet", status: "new", notes: `${profileTitle} (${total}/45)\n\n${profileBody}` });
        await sb.from("client_activity").insert({ client_id: client.id, type: "lead", title: `Nervsystemstest: ${name}`, meta: { email, profileTitle, total } });
      }
    } catch { /* best effort */ }

    return NextResponse.json({ ok: true, emailed: adminMail.sent });
  } catch {
    return NextResponse.json({ ok: false, error: "Serverfel." }, { status: 500 });
  }
}
