// Nya leads — nedlagda affärer ska tillbaka. Före/efter mot den RIKTIGA databasen.
//
// Det enhetstestet inte kan visa: hur många av Displaytekniks lobby_contacts som göms i
// dag av det gamla status-filtret, hur många som göms efter fixen, och exakt VILKA leads
// som kommer tillbaka i listan.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/lobby-nedlagda-dod.mts

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Worktrees saknar egen .env.local — leta uppåt tills den hittas.
let dir = process.cwd();
let envFil = "";
for (let i = 0; i < 8 && !envFil; i++) {
  const kandidat = path.join(dir, ".env.local");
  if (existsSync(kandidat)) envFil = kandidat;
  else dir = path.dirname(dir);
}
if (!envFil) throw new Error("Hittade ingen .env.local uppåt från " + process.cwd());
for (const line of readFileSync(envFil, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
console.log(`env: ${envFil}`);

const { supabaseService } = await import("@/lib/supabase-admin");
const { resolveCoachContext } = await import("@/lib/coach-bridge");
const { hamtaStegFacit } = await import("@/lib/hq/pipeline");
const { byggPipelineIndex, normNamn } = await import("@/lib/lobby/pipeline");

const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
const DT_VUNNET = "98ae3cff-18a0-4f01-93cc-cc6965a195ce";
const DT_FORLORAT = "a6023573-4e6a-4ab4-ae91-f15bace0c36f";

let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

const sb = supabaseService();
const ctx = await resolveCoachContext(DT_CLIENT_ID);
console.log(`\n== 0. Displayteknik ==\nlocation ${ctx.locationId}, ${ctx.ids.length} coach_users`);
if (!ctx.ids.length) {
  console.log("FEL — ingen Coach-koppling, inget att mäta");
  process.exit(1);
}

const facit = await hamtaStegFacit(ctx.locationId);
console.log("\n== 1. Steg-facit ur coach_users.personal_os ==");
kolla("vinststeget är inställt", facit.vinnare.has(DT_VUNNET), [...facit.vinnare].join(", "));
kolla("förluststeget är inställt", facit.forlorare.has(DT_FORLORAT), [...facit.forlorare].join(", "));

type Opp = {
  kontakt: string | null;
  ghl_contact_id: string | null;
  steg_id: string | null;
  steg_namn: string | null;
  status: string | null;
};
const { data: oppData } = await sb
  .from("fokus_opportunities")
  .select("kontakt, ghl_contact_id, steg_id, steg_namn, status")
  .in("tenant_id", ctx.ids);
const opps = (oppData as Opp[] | null) || [];
const unika = new Set(opps.map((o) => `${o.ghl_contact_id}|${o.kontakt}|${o.steg_id}`));

console.log("\n== 2. Spegeln (fokus_opportunities) ==");
console.log(`${opps.length} rader, ${unika.size} unika affärer (DT delar location över ${ctx.ids.length} tenants)`);
const perSteg = new Map<string, number>();
for (const o of opps) perSteg.set(o.steg_namn || "(utan steg)", (perSteg.get(o.steg_namn || "(utan steg)") || 0) + 1);
for (const [namn, antal] of [...perSteg].sort((a, b) => b[1] - a[1])) console.log(`   ${antal.toString().padStart(3)}  ${namn}`);
// Kärnan i buggen: status duger inte som facit. Vunna affärer svarar "open" rakt av, och
// bland de nedlagda gör de allra flesta det också — bara enstaka bär "abandoned".
const iVunnet = opps.filter((o) => o.steg_id === DT_VUNNET);
const iForlorat = opps.filter((o) => o.steg_id === DT_FORLORAT);
kolla(
  "vunna affärer svarar status='open'",
  iVunnet.length > 0 && iVunnet.every((o) => o.status === "open"),
  `${iVunnet.length} rader`,
);
kolla(
  "nedlagda affärer svarar också status='open'",
  iForlorat.some((o) => o.status === "open"),
  `${iForlorat.filter((o) => o.status === "open").length} av ${iForlorat.length} rader — resten: ` +
    [...new Set(iForlorat.filter((o) => o.status !== "open").map((o) => o.status))].join(", "),
);

type Kontakt = { id: string; name: string | null; ghl_contact_id: string | null; status: string | null };
const { data: lobbyData } = await sb
  .from("lobby_contacts")
  .select("id, name, ghl_contact_id, status")
  .in("user_id", ctx.ids);
const kontakter = (lobbyData as Kontakt[] | null) || [];

// FÖRE: det gamla filtret — bara GHL:s status, aldrig steget.
const foreId = new Map<string, string>();
const foreNamn = new Map<string, string>();
for (const o of opps) {
  if (o.status && o.status !== "open") continue;
  if (o.ghl_contact_id && !foreId.has(o.ghl_contact_id)) foreId.set(o.ghl_contact_id, o.steg_namn || "");
  if (o.kontakt && !foreNamn.has(normNamn(o.kontakt))) foreNamn.set(normNamn(o.kontakt), o.steg_namn || "");
}
// EFTER: steget avgör. Nedlagt = tillbaka i Nya leads.
const efter = byggPipelineIndex(opps, facit.vinnare, facit.forlorare);

const gomdFore = kontakter.filter((c) => c.ghl_contact_id && foreId.has(c.ghl_contact_id));
const gomdEfter = kontakter.filter((c) => c.ghl_contact_id && efter.perId.has(c.ghl_contact_id));
const tillbaka = gomdFore.filter((c) => !gomdEfter.some((d) => d.id === c.id));

console.log("\n== 3. Nya leads — före/efter ==");
console.log(`${kontakter.length} lobby_contacts totalt (${kontakter.filter((c) => c.status === "passed").length} redan manuellt "passed")`);
console.log(`göms av pipeline-matchning FÖRE fixen:  ${gomdFore.length}`);
console.log(`göms av pipeline-matchning EFTER fixen: ${gomdEfter.length}`);
console.log(`kommer tillbaka i Nya leads:            ${tillbaka.length}`);
for (const c of tillbaka) {
  const steg = foreId.get(c.ghl_contact_id!) || "";
  console.log(`   ← ${c.name || "(utan namn)"}  [lead-status ${c.status}]  nedlagd affär i steget "${steg}"`);
}
kolla("inget lead försvinner av fixen", gomdEfter.every((c) => gomdFore.some((d) => d.id === c.id)));
kolla(
  "allt som kommer tillbaka står i ett förluststeg",
  tillbaka.every((c) => {
    const o = opps.find((x) => x.ghl_contact_id === c.ghl_contact_id);
    return o?.steg_id === DT_FORLORAT || /förlorad|forlorad|lost|paus/i.test(o?.steg_namn || "");
  }),
);

// Vad ANVÄNDAREN ser. Route-fixen räcker inte i sig: lead-status "passed" sätts av
// /api/lobby/sync när kontakten skickas till MySales och nollställs aldrig, och vyn
// gömmer allt som är "passed". Därför slår `nedlagd_stage` även den spärren.
const synligFore = (c: Kontakt) => c.status !== "passed" && !(c.ghl_contact_id && foreId.has(c.ghl_contact_id));
const nedlagdFor = (c: Kontakt) => !!(c.ghl_contact_id && efter.nedlagdaPerId.has(c.ghl_contact_id));
const synligEfter = (c: Kontakt) =>
  nedlagdFor(c) || (c.status !== "passed" && !(c.ghl_contact_id && efter.perId.has(c.ghl_contact_id)));

const nyaSynliga = kontakter.filter((c) => !synligFore(c) && synligEfter(c));
console.log("\n== 4. Vad som faktiskt syns i Nya leads ==");
console.log(`synliga FÖRE:  ${kontakter.filter(synligFore).length}`);
console.log(`synliga EFTER: ${kontakter.filter(synligEfter).length}`);
console.log(`nya i vyn:     ${nyaSynliga.length}`);
for (const c of nyaSynliga) console.log(`   ← ${c.name || "(utan namn)"}  [lead-status ${c.status}]`);
// Fler kan tillkomma än de som gömdes av pipeline-matchningen: en affär som råkar bära
// GHL:s "abandoned" slapp redan det gamla filtret, men leadet göms ändå av "passed".
// Först nu syns den. Alla ska ändå vara nedlagda, inget annat får smyga in.
kolla("allt som frigjordes av härledningen syns nu i vyn", tillbaka.every((c) => nyaSynliga.some((d) => d.id === c.id)));
kolla("inget som var synligt försvinner", kontakter.filter(synligFore).every(synligEfter));
kolla(
  "bara nedlagda tillkommer — passed utan affär i pipelinen ligger kvar dolt",
  nyaSynliga.every(nedlagdFor),
  `${kontakter.filter((c) => c.status === "passed" && !nedlagdFor(c)).length} passed-leads förblir dolda`,
);

// Namn-badgen (osäker match) ska följa samma regel: en nedlagd affär flaggar ingenting.
const badgeFore = kontakter.filter((c) => !(c.ghl_contact_id && foreId.has(c.ghl_contact_id)) && foreNamn.has(normNamn(c.name)));
const badgeEfter = kontakter.filter((c) => !(c.ghl_contact_id && efter.perId.has(c.ghl_contact_id)) && efter.perNamn.has(normNamn(c.name)));
console.log(`\n== 5. Namn-badge "kan redan vara i pipelinen" ==\nföre: ${badgeFore.length}, efter: ${badgeEfter.length}`);

console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
process.exit(fel === 0 ? 0 : 1);
