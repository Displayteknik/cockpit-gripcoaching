// DRIV-1 — Gmail för kortets tidslinje. Samma ägarkoppling som KONTAKT-1 (hq_google_koppling,
// lib/hq/kalender.ts::agarToken). Samma scope-skäl gäller (gmail.readonly, inte gmail.metadata,
// för att q-sökning ska funka — se lib/hq/kalender.ts).
//
// 1C: metadata hämtas alltid med format=metadata + uttrycklig rubriklista i listläget.
// Full kropp hämtas ENDAST i hamtaFullMeddelande, anropad direkt av UI:t på klick, och
// skrivs ALDRIG till databasen — funktionen returnerar den till anroparen, punkt.

import { adressUr, arAutosvar } from "@/lib/hq/kontakt";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMeta {
  id: string;
  threadId: string;
  /** RFC822 Message-ID-headern (skild från Gmails interna id) — krävs för In-Reply-To/References vid svar. */
  messageIdHeader: string;
  datum: string;
  amne: string;
  fran: string;
  till: string;
  riktning: "in" | "ut";
  snippet: string;
  autosvar: boolean;
}

async function metaFor(token: string, id: string, egnaAdress: string): Promise<GmailMeta | null> {
  const r = await fetch(
    `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Auto-Submitted&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) return null;
  const d = (await r.json()) as {
    threadId?: string;
    internalDate?: string;
    snippet?: string;
    payload?: { headers?: Array<{ name: string; value: string }> };
  };
  const h = (namn: string) => d.payload?.headers?.find((x) => x.name.toLowerCase() === namn)?.value || "";
  const ms = Number(d.internalDate || 0);
  if (!ms) return null;
  const fran = adressUr(h("from"));
  const amne = h("subject").slice(0, 300);
  return {
    id,
    threadId: d.threadId || id,
    messageIdHeader: h("message-id"),
    datum: new Date(ms).toISOString(),
    amne,
    fran,
    till: adressUr(h("to")),
    riktning: fran === egnaAdress.toLowerCase() ? "ut" : "in",
    snippet: (d.snippet || "").slice(0, 200),
    autosvar: arAutosvar(amne, h("auto-submitted")),
  };
}

/**
 * Upp till `max` senaste meddelanden till/från en adress, nyast först. Metadata bara —
 * exakt disciplinen KONTAKT-1 redan bevisat hållbar, utökad från "senaste ett" till en
 * riktig tidslinje.
 */
export async function hamtaTradMetadata(
  token: string,
  adress: string,
  egnaAdress: string,
  max = 15,
): Promise<GmailMeta[]> {
  const r = await fetch(
    `${GMAIL}/messages?maxResults=${max}&q=${encodeURIComponent(`from:${adress} OR to:${adress}`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Gmail svarade ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = (await r.json()) as { messages?: Array<{ id: string }> };
  const ids = (d.messages || []).map((m) => m.id);
  const rader = await Promise.all(ids.map((id) => metaFor(token, id, egnaAdress)));
  return rader.filter((m): m is GmailMeta => !!m);
}

export interface GmailFullMeddelande extends GmailMeta {
  kropp: string; // ALDRIG lagrad — returneras bara till klienten som bad om den
}

/** Full kropp, live, på klick. Anroparen visar och slänger — sparas aldrig. */
export async function hamtaFullMeddelande(token: string, id: string, egnaAdress: string): Promise<GmailFullMeddelande | null> {
  const r = await fetch(`${GMAIL}/messages/${id}?format=full`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const d = (await r.json()) as {
    threadId?: string;
    internalDate?: string;
    snippet?: string;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: Array<{ mimeType?: string; body?: { data?: string } }> }>;
    };
  };
  const h = (namn: string) => d.payload?.headers?.find((x) => x.name.toLowerCase() === namn)?.value || "";
  const ms = Number(d.internalDate || 0);
  if (!ms) return null;

  const kropp = extraheraTextkropp(d.payload) || d.snippet || "";
  const fran = adressUr(h("from"));
  const amne = h("subject").slice(0, 300);
  return {
    id,
    threadId: d.threadId || id,
    messageIdHeader: h("message-id"),
    datum: new Date(ms).toISOString(),
    amne,
    fran,
    till: adressUr(h("to")),
    riktning: fran === egnaAdress.toLowerCase() ? "ut" : "in",
    snippet: (d.snippet || "").slice(0, 200),
    autosvar: arAutosvar(amne, h("auto-submitted")),
    kropp,
  };
}

/**
 * DRIV-2 — skickar ett svar i RÄTT tråd. Bygger ett rått RFC822-meddelande med
 * In-Reply-To/References satta till originalets Message-ID (adressen tråden hålls ihop
 * med), base64url-kodar det och postar med `threadId` så Gmail lägger det i samma tråd.
 *
 * Kräver scopet `gmail.send` — läggs till i lib/hq/kalender.ts:s SCOPES och kräver att
 * ägaren kopplar om Google en gång (samma prompt=consent-mönster som redan finns).
 */
export async function skickaSvar(
  token: string,
  fran: string,
  till: string,
  amne: string,
  text: string,
  svarPa: { threadId: string; messageIdHeader: string },
): Promise<{ ok: boolean; fel?: string }> {
  const ren = (s: string) => s.replace(/[\r\n]/g, " ").trim();
  const radInReplyTo = svarPa.messageIdHeader ? `In-Reply-To: ${svarPa.messageIdHeader}\r\nReferences: ${svarPa.messageIdHeader}\r\n` : "";
  const amneMedRe = /^re:/i.test(amne) ? amne : `Re: ${amne}`;
  const mime =
    `From: ${ren(fran)}\r\n` +
    `To: ${ren(till)}\r\n` +
    `Subject: ${ren(amneMedRe)}\r\n` +
    radInReplyTo +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `MIME-Version: 1.0\r\n\r\n` +
    text;
  const raw = Buffer.from(mime, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const r = await fetch(`${GMAIL}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: svarPa.threadId }),
  });
  if (!r.ok) return { ok: false, fel: `Gmail svarade ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true };
}

function b64urlTillText(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

interface GmailPayloadDel {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayloadDel[];
}

/** Hittar första text/plain-delen (rekursivt genom multipart). Bäst-effort, kraschar aldrig. */
function extraheraTextkropp(payload: GmailPayloadDel | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64urlTillText(payload.body.data);
  if (!payload.parts && payload.body?.data) return b64urlTillText(payload.body.data);
  for (const del of payload.parts || []) {
    const funnen = extraheraTextkropp(del);
    if (funnen) return funnen;
  }
  return "";
}
