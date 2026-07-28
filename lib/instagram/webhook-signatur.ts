// Signaturkontroll för Metas webhook. Ligger i lib och inte i route-filen, eftersom
// Next bara tillåter vissa exporter från en route (GET, POST, runtime, dynamic ...).
// Att lägga hjälpfunktioner där bryter bygget.

import crypto from "node:crypto";

/** Tidskonstant jämförelse: en vanlig === läcker information via svarstiden. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verifierar X-Hub-Signature-256 mot den RÅA bodyn.
 * Rå body är ett krav: minsta omformatering (t.ex. JSON.parse följt av stringify)
 * ändrar hashen och allt slutar fungera.
 */
export function verifieraSignatur(rawBody: string, header: string | null, secret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const vantad = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqual(header.slice(7), vantad);
}
