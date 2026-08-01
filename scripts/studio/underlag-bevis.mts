// KVALITET-3 punkt 3 — bevis för att kedjan är GENERERAD, inte kopierad.
//
// Kedjan: dagens underlag (vinkel) → caption (genererad) → text PÅ BILDEN (genererad ur
// captionen via generateStudioCopy). Skriptet anropar de riktiga routerna, så beviset
// speglar koden i repot. Ingen prompt dupliceras här.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/underlag-bevis.mts
//
// Utdata: docs/studio/kvalitet3-underlag/bevis.json + konsolens sida-vid-sida.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));

const DT = "a6a33547-5ca7-475f-9a62-43ff2c74d000"; // Displayteknik
headersShim.__setBatchCookie("active_client_id", DT);

const { dagensStudioPayload, arKopieradFranCaption } = await import("@/lib/studio/pa-bild");
const captionRoute = await import("@/app/api/studio/suggest-caption/route");
const textRoute = await import("@/app/api/studio/suggest-text/route");

const UT = path.join(ROOT, "docs/studio/kvalitet3-underlag");

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Dagens UNDERLAG — det veckoplanen ger: ett tema och en vinkel. Ingen färdig text.
const TEMA = "Skyltfönstret som säljer när butiken är stängd";
const VINKEL = "Digitala menyskärmar i skyltfönster syns även i dagsljus";

async function main() {
  // 1. Underlag → CAPTION (genererad via prompt-core).
  const cRes = await captionRoute.POST(req("/api/studio/suggest-caption", { topic: `${TEMA}. ${VINKEL}`, format: "1080x1350" }) as never);
  const cData = await cRes.json();
  const caption: string = cData.caption || "";
  if (!caption) throw new Error(`Ingen caption: ${JSON.stringify(cData).slice(0, 300)}`);

  // 2. Så här sparar veckoplanen dagen: underlag in, INGEN text på bilden.
  const payload = dagensStudioPayload({ theme: TEMA, hook: VINKEL, body: "", caption });

  // 3. Öppnas inlägget i Studio genereras texten PÅ BILDEN ur captionen — pa-bild-anatomin,
  //    röst, skrivregler, sanering, siffergrind. Exakt det anropet Studio gör.
  const tRes = await textRoute.POST(req("/api/studio/suggest-text", {
    templateId: "ark-textkort", format: "1080x1350", topic: payload.brief, caption,
  }) as never);
  const tData = await tRes.json();
  const forslag: { hookType: string; headline1: string; headline2: string; body: string }[] = tData.suggestions || [];
  if (!forslag.length) throw new Error(`Inga textförslag: ${JSON.stringify(tData).slice(0, 300)}`);

  const kopior = forslag.flatMap((s, i) =>
    [s.headline1, s.headline2, s.body]
      .filter((f) => arKopieradFranCaption(f, caption))
      .map((f) => ({ forslag: i + 1, falt: f })),
  );

  console.log("═══ UNDERLAG (dagens vinkel — får aldrig publiceras som text) ═══");
  console.log(payload.brief);
  console.log("\n═══ CAPTION (genererad) ═══");
  console.log(caption);
  console.log("\n═══ TEXT PÅ BILDEN (genererad ur captionen) ═══");
  for (const [i, s] of forslag.entries()) {
    console.log(`\n${i + 1}. [${s.hookType}]`);
    console.log(`   rubrik:       ${s.headline1}`);
    console.log(`   underrubrik:  ${s.headline2}`);
    console.log(`   kort text:    ${s.body}`);
  }
  console.log("\n═══ SPARAT PÅ INLÄGGET ═══");
  console.log(`payload.headline1 = ${JSON.stringify(payload.headline1)}  (tomt = inget kopierat)`);
  console.log(`payload.body      = ${JSON.stringify(payload.body)}`);
  console.log(`\nOrdagranna kopior ur captionen: ${kopior.length}`);

  mkdirSync(UT, { recursive: true });
  writeFileSync(
    path.join(UT, "bevis.json"),
    JSON.stringify({ kord: new Date().toISOString(), tenant: DT, tema: TEMA, vinkel: VINKEL, underlag: payload.brief, caption, sparat_pa_bilden: { headline1: payload.headline1, headline2: payload.headline2, body: payload.body }, genererad_bildtext: forslag, ordagranna_kopior: kopior }, null, 2),
    "utf8",
  );
  console.log(`\nSkrev ${path.join(UT, "bevis.json")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
