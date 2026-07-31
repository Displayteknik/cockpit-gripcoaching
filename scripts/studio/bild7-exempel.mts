// BILD-7 DoD — före/efter-bevis för bildpromptens kärnregler.
//
// Fem testgenereringar med AVBILDAD SKYLTNING för TVÅ olika tenants (Displayteknik
// som skärmleverantör, Annas Blommor som blomsteraffär). Samma skript körs två
// gånger: en gång mot koden FÖRE BILD-7 (git stash) och en gång efter. Ingen prompt
// dupliceras i skriptet — det anropar Bildhjälpens riktiga route, så bevisen speglar
// exakt den kod som ligger i repot vid körningen.
//
// Körning:
//   BILD7_LAGE=fore  npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild7-exempel.mts
//   BILD7_LAGE=efter npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild7-exempel.mts
//
// Bieffekt som städas: routen laddar upp varje bild till bucketen studio-images/
// <clientId>/. Bilderna hämtas hem till docs/studio/bild7-exempel/ och objekten
// raderas sedan ur bucketen — kundens mediabibliotek ska inte fyllas av testkörningar
// (feedback_live_client_no_disruption).

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
const setActiveClient = (id: string) => headersShim.__setBatchCookie("active_client_id", id);

const { supabaseService } = await import("@/lib/supabase-admin");
const bildRoute = await import("@/app/api/studio/suggest-image/route");
const sb = supabaseService();

const LAGE = (process.env.BILD7_LAGE || "efter").toLowerCase() === "fore" ? "fore" : "efter";
const UT = path.join(ROOT, "docs/studio/bild7-exempel");
const BUCKET = "studio-images";

// Fem fall där skyltning/skärm ÄR motivet — annars mäter vi inte regeln.
const FALL = [
  { nr: 1, slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", topic: "Skyltfönstret som säljer när butiken är stängd" },
  { nr: 2, slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", topic: "Digital menytavla i lunchrestaurangen" },
  { nr: 3, slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", topic: "Skärmen i receptionen som visar dagens besökare och erbjudanden" },
  { nr: 4, slug: "annas-blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e", topic: "Skyltfönstret inför helgen" },
  { nr: 5, slug: "annas-blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e", topic: "Veckans buketterbjudande på skylten utanför butiken" },
];

// BILD7_FALL=1,3 kör om enskilda fall (t.ex. efter en skärpning av regeln) utan att
// bränna en generering på de fall som redan är godkända.
const VALDA = (process.env.BILD7_FALL || "").split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
const KOR = VALDA.length ? FALL.filter((f) => VALDA.includes(f.nr)) : FALL;

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

mkdirSync(UT, { recursive: true });
const RUN_START = new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uppladdade: { clientId: string; url: string }[] = [];
const resultat: Record<string, unknown>[] = [];

console.log(`BILD-7-exempel, läge: ${LAGE.toUpperCase()}`);
for (const f of KOR) {
  setActiveClient(f.id);
  let url = "";
  let description = "";
  let fel = "";
  for (let forsok = 1; forsok <= 3 && !url; forsok++) {
    try {
      const res = await bildRoute.POST(req("/api/studio/suggest-image", {
        mode: "ai",
        topic: f.topic,
        aspect: "square",
      }) as never);
      const json = (await res.json()) as { photos?: { url: string }[]; description?: string; error?: string };
      if (res.status !== 200 || !json.photos?.[0]?.url) throw new Error(json.error || `HTTP ${res.status}`);
      url = json.photos[0].url;
      description = json.description || "";
    } catch (e) {
      fel = (e as Error).message?.slice(0, 200) || "okänt fel";
      console.log(`  [försök ${forsok}/3] fall ${f.nr} (${f.slug}): ${fel}`);
      if (forsok < 3) await sleep(forsok === 1 ? 4000 : 10000);
    }
  }

  const filnamn = `${LAGE}-${f.nr}-${f.slug}.png`;
  if (url) {
    uppladdade.push({ clientId: f.id, url });
    const bin = await fetch(url);
    writeFileSync(path.join(UT, filnamn), Buffer.from(await bin.arrayBuffer()));
    console.log(`  fall ${f.nr} (${f.slug}): OK → ${filnamn}`);
    console.log(`    scen: ${description.slice(0, 200)}`);
  } else {
    console.log(`  fall ${f.nr} (${f.slug}): FEL — ${fel}`);
  }
  resultat.push({ nr: f.nr, slug: f.slug, client_id: f.id, topic: f.topic, fil: url ? filnamn : null, scen: description, fel: url ? undefined : fel });
}

// Delkörning: slå ihop med den befintliga metafilen så bevisfilen alltid har alla fem.
const metaFil = path.join(UT, `${LAGE}.json`);
let tidigare: Record<string, unknown>[] = [];
try {
  tidigare = (JSON.parse(readFileSync(metaFil, "utf8")) as { fall: Record<string, unknown>[] }).fall || [];
} catch {}
const nr = new Set(resultat.map((r) => r.nr));
const samlade = [...tidigare.filter((t) => !nr.has(t.nr)), ...resultat].sort((a, b) => Number(a.nr) - Number(b.nr));
writeFileSync(metaFil, JSON.stringify({ lage: LAGE, kord: RUN_START, fall: samlade }, null, 2), "utf8");
console.log(`\n→ ${metaFil}`);

// ── Städ: ta bort testbilderna ur kundens mediabibliotek ────────────────────
let raderade = 0;
for (const u of uppladdade) {
  const nyckel = u.url.split(`/${BUCKET}/`)[1];
  if (!nyckel) continue;
  const { error } = await sb.storage.from(BUCKET).remove([decodeURIComponent(nyckel)]);
  if (!error) raderade++;
  else console.log(`  städfel ${nyckel}: ${error.message}`);
}
console.log(`Städat studio-images: ${raderade}/${uppladdade.length} objekt raderade.`);
console.log("KLART.");
