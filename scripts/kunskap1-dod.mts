// KUNSKAP-1 DoD — Gittes exempel, skarpt, i blogg-, inläggs- och captionvägen.
//
// Enhetstesterna bevisar att blocket säger rätt sak och att kärnan läser fältet. De bevisar
// INTE det som Håkan faktiskt rapporterade: att ett inlägg om "regression" hamnade i
// statistik i stället för terapi. Det syns bara i riktig text.
//
// Mätningen är mekanisk med flit. Jag ska inte kunna tycka att texten blev rätt — det ska
// gå att räkna: förekommer terapi-orden, och förekommer statistik-orden?
//
// ⚠ Skriptet SPARAR ingenting i kundkonton (G-3d-läxan). Det genererar och läser.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kunskap1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const rad of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = rad.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { byggTextPrompt } = await import("../lib/prompt-core");
const { hamtaOrdlista } = await import("../lib/ordlista");
const { generateWithUsage } = await import("../lib/gemini");

const FORBALANCE = "d07d7288-2651-47df-b5f3-a010c1a1a97f";
const AMNE = "regression";

// ⚠ Mätstickan är avsiktligt ENSIDIG, och det är en rättelse efter första körningen.
//
// Första versionen hade också en "rätt-lista" (regressionsterapi, tidigare liv, hypnos…)
// som PASS/FAIL. Den föll på texter som var helt korrekta i sak men använde andra ord —
// "gamla minnen, händelser vi inte orkat bearbeta" är terapibetydelsen, utan ett enda ord
// ur listan. Och utfallet varierade mellan körningar. En mätsticka som fäller rätt text
// beroende på vilka synonymer modellen råkar välja mäter ordval, inte betydelse.
//
// Det som GÅR att mäta mekaniskt är motsatsen: statistikvokabulären är smal, specifik och
// kan inte råka dyka upp i en terapitext. Den är därför grinden. Terapiorden räknas fortfarande
// och SKRIVS UT, men som en siffra att läsa — aldrig som ett betyg (samma regel som G-9:
// visa aldrig ett tal som ett omdöme när det inte är ett).
// ⚠ Andra rättelsen, av samma skäl: orden "statistik" och "matematik" fälldes först, men
// de dyker upp i texter som är HELT rätt — modellen skriver ibland en avgränsande mening
// ("det här handlar inte om statistisk regression utan om…"), och ordlistan uppmanar ju
// uttryckligen till den distinktionen. Att fälla den meningen vore att straffa rätt svar.
// Grinden är därför de ord som INTE kan stå i en avgränsande mening till en terapiläsare:
// de beskriver hur man GÖR statistik, inte att man låter bli.
const RATT = /regressionsterapi|tidigare liv|hypnos|terapi|behandling|session|klient|minnen|bearbeta|mönster/i;
const FEL = /dataanalys|variabel|korrelation|datapunkt|analysmodell|signifikan|regressionsanalys|beroende variabel|datamängd/i;

let gron = 0;
let rod = 0;
const kolla = (ok: boolean, text: string, extra = "") => {
  if (ok) { gron++; console.log(`  GRÖN  ${text}`); }
  else { rod++; console.log(`  RÖD   ${text}${extra ? ` — ${extra}` : ""}`); }
};

console.log("KUNSKAP-1 DoD — Gittes exempel i tre flöden\n");

// ── Steg 1: ordlistan finns och når prompten ────────────────────────────────
const poster = await hamtaOrdlista(FORBALANCE);
console.log("Ordlistan hos For Balance:");
for (const p of poster) console.log(`  "${p.ord}" → ${p.betydelse}`);
kolla(poster.length > 0, "ordlistan är ifylld");
kolla(poster.some((p) => p.ord.toLowerCase() === "regression"), "ordet regression finns i listan");

const FLODEN = [
  { namn: "blogg",       syfte: "blogg",       kanal: "webb",      knowledge: ["blog-playbook", "conversion"] },
  { namn: "inlägg",      syfte: "social",      kanal: "instagram", knowledge: ["viral-hooks", "conversion"] },
  { namn: "bildtext",    syfte: "caption",     kanal: "instagram", knowledge: undefined },
  { namn: "studio-text", syfte: "studio-text", kanal: "instagram", knowledge: ["hook-playbook"] },
];

console.log("\nNår blocket fram i varje väg?");
const byggda: Record<string, { system: string; user: string }> = {};
for (const f of FLODEN) {
  const b = await byggTextPrompt({
    clientId: FORBALANCE,
    syfte: f.syfte as never,
    kanal: f.kanal as never,
    uppdrag: `Skriv om ${AMNE} för For Balance.`,
    underlag: `Ämne: ${AMNE}.\n\nSkriv nu.`,
    anvandarText: AMNE,
    knowledge: f.knowledge,
  });
  byggda[f.namn] = { system: b.system, user: b.user };
  const harBlock = b.system.includes("KUNDENS EGNA ORD");
  const harBetydelse = /regressionsterapi/i.test(b.system);
  kolla(harBlock && harBetydelse, `${f.namn}: kundens egna ord finns i prompten`);
}

// ── Steg 2: skarp generering ────────────────────────────────────────────────
console.log("\nSkarp generering (ämne: \"regression\"):");
for (const f of FLODEN.slice(0, 3)) {
  const b = byggda[f.namn];
  const svar = await generateWithUsage({
    model: "gemini-2.5-flash",
    systemInstruction: b.system,
    prompt: b.user,
    maxOutputTokens: f.namn === "blogg" ? 1400 : 600,
    skrivregler: false,
    tenantId: FORBALANCE,
    flow: `kunskap1-dod-${f.namn}`,
  });
  const t = (svar.text || "").trim();
  const fel = FEL.test(t);
  console.log(`\n  [${f.namn}]`);
  console.log("  " + t.replace(/\n+/g, "\n  ").slice(0, 460));
  console.log("");
  // Grinden: statistikvokabulären får inte förekomma. Det är felet Håkan rapporterade.
  kolla(!fel, `${f.namn}: ingen statistikbetydelse`, fel ? `träff: ${t.match(FEL)?.[0]}` : "");
  // Läsvärdet: hur tydligt texten ligger i terapibetydelsen. Siffra, inte betyg.
  console.log(`  (terapiord i texten: ${RATT.test(t) ? `ja — "${t.match(RATT)?.[0]}"` : "inga av de sökta orden, läs texten ovan"})`);
}

// ── Steg 3: kontrollen ──────────────────────────────────────────────────────
// "Grönt efteråt" bevisar ingenting på egen hand — texten kunde ha blivit rätt ändå.
// Kontrollen kör SAMMA prompt med ordlisteblocket bortklippt. Blir den då fel är det
// blocket som gör jobbet; blir den rätt ändå var buggen aldrig det jag pekade ut, och
// det ska i så fall stå här och inte döljas av en grön rad ovanför.
console.log("\nKontroll — samma prompt UTAN kundens egna ord (ska bli sämre):");
const utan = byggda["inlägg"].system
  .split("\n\n")
  .filter((block) => !block.startsWith("=== KUNDENS EGNA ORD") && !block.startsWith("=== ORD UR ÄMNET"))
  .join("\n\n");
kolla(!utan.includes("KUNDENS EGNA ORD"), "kontrollprompten saknar verkligen blocket");

const kontroll = await generateWithUsage({
  model: "gemini-2.5-flash",
  systemInstruction: utan,
  prompt: byggda["inlägg"].user,
  maxOutputTokens: 600,
  skrivregler: false,
  tenantId: FORBALANCE,
  flow: "kunskap1-dod-kontroll",
});
const kt = (kontroll.text || "").trim();
console.log("  " + kt.replace(/\n+/g, "\n  ").slice(0, 420));
const kontrollFel = FEL.test(kt);
console.log("");
console.log(
  kontrollFel
    ? "  NOTERAT  utan blocket glider texten mot statistikbetydelsen — blocket gör jobbet"
    : "  NOTERAT  texten blev rätt även utan blocket i den här körningen. Profilraden " +
      '("Regression, resa till ett tidigare liv") räcker ibland på egen hand — det var ' +
      "just därför bloggen klarade sig och det korta inlägget inte gjorde det. Blocket " +
      "tar bort slumpen, det är inte enda källan till betydelsen.",
);

console.log(`\n${"=".repeat(60)}`);
console.log(`GRÖNA: ${gron}   RÖDA: ${rod}`);
process.exit(rod ? 1 : 0);
