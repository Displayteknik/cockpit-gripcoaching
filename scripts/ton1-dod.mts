// TON-1 DoD — tonlägena, skarpt.
//
// Enhetstesterna bevisar att koden DELAR UT fyra olika tonlägen och att förbehållet om
// sanning följer med. De bevisar INTE det som Håkan faktiskt klagade på: att de tre
// förslagen LÅTER olika. Det syns bara i riktig text.
//
// Mätningen: ett riktigt anrop till captionvägen med variants=3, mot två tenants i olika
// branscher. Kontrollerna är avsiktligt mekaniska — jag ska inte kunna tycka att texterna
// blev olika, det ska gå att räkna.
//
// ⚠ Skriptet SPARAR ingenting i kundkonton (G-3d-läxan). Det genererar och läser.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/ton1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

import { DISC_ORDNING, tonForVariant } from "../lib/ton-varianter";
import { DISC_LABEL_SV } from "../lib/content-compass/labels";

const BASE = process.env.G1_BASE || "http://localhost:3480";
const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const SECRET = process.env.ADMIN_SESSION_SECRET || "";
if (!SECRET) { console.error("Saknar ADMIN_SESSION_SECRET"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const ADMIN = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

// Två tenants i olika branscher — en regel som bara funkar på en bransch är ingen regel.
const TENANTS = [
  { namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", topic: "Skyltfönstret blir svart när solen ligger på" },
  { namn: "For Balance", id: "d07d7288-2651-47df-b5f3-a010c1a1a97f", topic: "Att våga be om hjälp när orken tar slut" },
];

let gron = 0, rod = 0;
const kolla = (ok: boolean, text: string, extra = "") => {
  if (ok) { gron++; console.log(`  GRÖN  ${text}`); }
  else { rod++; console.log(`  RÖD   ${text}${extra ? ` — ${extra}` : ""}`); }
};

// Öppningsfrasen: de första fyra orden. Två varianter som börjar likadant är inte två val.
const oppning = (t: string) => t.trim().split(/\s+/).slice(0, 4).join(" ").toLowerCase();

async function kor(tenant: typeof TENANTS[number], compassDisc: string[]) {
  const r = await fetch(`${BASE}/api/studio/suggest-caption`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `${ADMIN}; active_client_id=${tenant.id}` },
    body: JSON.stringify({
      topic: tenant.topic,
      headline: tenant.topic,
      postType: "post",
      variants: 3,
      compass: { funnel: "mofu", four_a: "aspirational", disc: compassDisc },
    }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t) as { variants: { angle: string; ctaVag?: string; ton?: string; caption: string }[] };
}

console.log("TON-1 DoD — tonlägena, skarpt\n");

// Kontroll 1-2: utdelningen, innan ett enda anrop. Ren räkning.
console.log("Utdelningen (deterministisk, inga anrop):");
kolla(new Set([0, 1, 2].map((i) => tonForVariant(i))).size === 3, "tre varianter ger tre olika tonlägen");
kolla(tonForVariant(0, ["I"]) === "I", "innehållsprofilens val blir variant 0, det körs inte över");

for (const tenant of TENANTS) {
  // Dagens profil satt till I — samma läge som på Håkans skärm.
  console.log(`\n=== ${tenant.namn} — "${tenant.topic}" (innehållsprofil: I) ===`);
  const d = await kor(tenant, ["I"]);
  const v = d.variants || [];

  kolla(v.length === 3, `tre varianter kom tillbaka`, `fick ${v.length}`);
  if (v.length < 2) { console.log("  (för få varianter för att mäta skillnad)"); continue; }

  for (const x of v) {
    console.log(`\n  [${x.angle} · ${x.ton} ${x.ton ? DISC_LABEL_SV[x.ton as "D"] : "?"} · ${x.ctaVag}]`);
    console.log(`  ${x.caption.replace(/\n+/g, "\n  ").slice(0, 400)}`);
  }

  const toner = v.map((x) => x.ton).filter(Boolean);
  console.log("");
  kolla(toner.length === v.length, "varje variant bär sitt tonläge i svaret", `${toner.length}/${v.length}`);
  kolla(new Set(toner).size === toner.length, `tonlägena är olika: ${toner.join(", ")}`);
  kolla(toner[0] === "I", "första varianten fick dagens ton (I)", `fick ${toner[0]}`);
  kolla(toner.every((t) => DISC_ORDNING.includes(t as "D")), "alla tonlägen är giltiga DISC-bokstäver");

  const oppningar = v.map((x) => oppning(x.caption));
  kolla(new Set(oppningar).size === oppningar.length, "de tre texterna öppnar olika", oppningar.join(" | "));

  const vagar = v.map((x) => x.ctaVag);
  kolla(new Set(vagar).size === vagar.length, `vägarna framåt är fortfarande olika: ${vagar.join(", ")}`);

  const kroker = v.map((x) => x.angle);
  kolla(new Set(kroker).size === kroker.length, `krokarna är fortfarande olika: ${kroker.join(", ")}`);
}

console.log(`\n${"=".repeat(60)}`);
console.log(`GRÖNA: ${gron}   RÖDA: ${rod}`);
process.exit(rod ? 1 : 0);
