// R-5b DoD — de tre kalibreringsfelen, mätta på den SKARPA Makzy-rapporten.
//
// Två mätningar, båda mot riktig text och inte mot ett hittepå-exempel:
//
//   A. BESLUT FÖR BESLUT. Varje tal i den sparade beslutstabellen (38 st, asset 45bf59c4)
//      körs genom den NYA klassningen med exakt den mening det stod i. Före/efter per tal.
//   B. HELA RAPPORTEN. Den sparade rapporttexten körs genom hela siffergrinden en gång
//      till. Strukturtalen finns kvar i texten (de maskades aldrig), så påståendet
//      "noll strukturtal i lucklistan och ren beslutstabell" går att mäta direkt.
//
// ⚠ ÄRLIG GRÄNS: rapportens RÅTEXT sparas inte — bara den grindade. De sex tal som redan
//   maskats står som [DIN SIFFRA] i texten och kan därför inte mätas om i mätning B. Det
//   är just vad mätning A finns till för: där bedöms de sex på sina egna meningar.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { grindaSiffror, arStrukturtal, radRunt, type Sifferbeslut } from "../lib/deep-audit-siffror";

const body = readFileSync(path.join(ROOT, "scripts", "_r5b-makzy-body.md"), "utf8");
const meta = JSON.parse(readFileSync(path.join(ROOT, "scripts", "_r5b-makzy-meta.json"), "utf8"));
const fore = (meta.grind_sifferbeslut ?? []) as Sifferbeslut[];

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

// ── A. Beslut för beslut, med den mening talet faktiskt stod i ────────────────
console.log("A. VARJE TAL UR DEN SKARPA RAPPORTEN, FÖRE → EFTER\n");
const indata = {
  belagda: new Set<string>(meta.tillatna_tal ?? []),
  kunskapsfalt: (meta.kunskapsfalt ?? null) as string | null,
  gscTal: new Set<string>(meta.gsc_tal ?? []),
};

const andrade: string[] = [];
for (const b of fore) {
  // Meningen körs som en egen liten text: samma tal, samma sammanhang, ny kod.
  const r = grindaSiffror(b.mening, indata);
  const nytt = r.beslut.find((x) => x.tal.replace(/[\s.,]/g, "") === b.tal.replace(/[\s.,]/g, ""));
  const nyttUtfall = nytt ? `${nytt.klass}/${nytt.utfall}` : "STRUKTURTAL (inget beslut)";
  const gamalt = `${b.klass}/${b.utfall}`;
  if (nyttUtfall !== gamalt) {
    andrade.push(b.tal);
    console.log(`  ${String(b.tal).padEnd(8)} ${gamalt.padEnd(14)} → ${nyttUtfall.padEnd(28)} "${b.mening.slice(0, 84)}"`);
  }
}
console.log(`\n  ${andrade.length} av ${fore.length} beslut ändrades.\n`);

// De sex luckorna, en och en. Alla sex var kalibreringsfel — ingen av dem var en uppgift
// Makzy skulle fylla i.
console.log("A2. DE SEX LUCKORNA I FÖRE-LÄGET\n");
const luckorFore = fore.filter((b) => b.utfall === "lucka");
kontroll(luckorFore.length === 6, `före-läget hade 6 luckor (mätt: ${luckorFore.length})`);
for (const b of luckorFore) {
  const { rad, iRaden } = radRunt(b.mening, b.mening.indexOf(b.tal));
  const strukturellt = arStrukturtal(rad, iRaden, b.tal);
  const r = grindaSiffror(b.mening, indata);
  const nytt = r.beslut.find((x) => x.tal.replace(/[\s.,]/g, "") === b.tal.replace(/[\s.,]/g, ""));
  const utfall = strukturellt || !nytt ? "strukturtal, inget beslut" : `${nytt.klass}/${nytt.utfall} — ${nytt.kalla}`;
  // ⚠ Den sparade meningen för 4 är bara "4." — meningsklippet stannar vid punkten, så
  //   raden bär inget sammanhang alls. Det går alltså inte att avgöra HÄR, och det är
  //   samtidigt själva felet i miniatyr: grinden dömde talet utan att se raden det stod
  //   på. Fallet prövas i A3 på sina riktiga rader i stället.
  if (b.mening.trim().length <= 3) {
    console.log(`  (A3) ${String(b.tal).padEnd(5)} → meningen i metadatan är bara "${b.mening.trim()}", utan sammanhang. Prövas i A3.`);
    continue;
  }
  kontroll(!nytt || nytt.utfall !== "lucka", `${String(b.tal).padEnd(5)} → ${utfall}`);
  console.log(`         "${b.mening.slice(0, 96)}"`);
}

// ── A3. Listnumreringen, återställd på raden den stod på ─────────────────────
//
// Talet 4 sparades med meningen "4." — meningsklippet stannar vid punkten, så den raden
// bär inget sammanhang alls. Raden i rapporten går ändå att fastställa: rad 51-55 är en
// numrerad lista 1,2,3,[DIN SIFFRA],5, och luckan står där fyran ska stå. Den återställs
// här och prövas i sin rätta form.
console.log("\nA3. LISTNUMRERINGEN PÅ SIN EGEN RAD\n");
for (const rad of [
  "  4. Kontrollera att bara EN H1 finns kvar per sida (den som står högst upp i huvudinnehållet)",
  "## 4. Inga kundcitat eller konkreta siffror, Ger leads",
  "**Fråga 4:** Syr ni bara gardiner, eller även kuddar och dukar?",
]) {
  const r = grindaSiffror(rad, indata);
  kontroll(r.text === rad && r.beslut.length === 0, `orörd, inget beslut: "${rad.trim().slice(0, 62)}"`);
}
// Samma fyra i ett PÅSTÅENDE ska fortfarande bli en lucka — undantaget gäller platsen,
// inte talet.
const pastaende = grindaSiffror("Leveranstiden är vanligtvis 4 veckor från godkänd offert.", indata);
kontroll(pastaende.luckor.length === 1, `"leveranstiden är vanligtvis 4 veckor" blir fortfarande en lucka (mätt: ${pastaende.luckor.length})`);

// ── B. Hela rapporten genom grinden en gång till ─────────────────────────────
//
// Grindens EGEN bilaga (lucklistan och beslutstabellen) klipps bort först. Den skrevs av
// grinden efteråt och ingår inte i det en riktig körning läser — låter man den ligga kvar
// mäter man sin egen utdata en gång till.
console.log("\nB. HELA RAPPORTTEXTEN GENOM GRINDEN\n");
const helaFore = fore.length;
const utanBilaga = body.split(/### Siffror du behöver fylla i|### Så här bedömdes varje siffra/)[0];
const hela = grindaSiffror(utanBilaga, indata);
console.log(`  beslut: ${helaFore} (före, ur metadata) → ${hela.beslut.length} (efter, på den sparade texten)`);
console.log(`  luckor: ${luckorFore.length} (före) → ${hela.luckor.length} (efter)`);

// Strukturtal ska inte finnas kvar i beslutstabellen. Ett tal räknas som strukturtal bara
// om VARJE förekomst i rapporten är numrering — står samma tal också i ett påstående
// någonstans är beslutet hämtat därifrån, och hör hemma i tabellen.
const alltStrukturellt = (tal: string): boolean => {
  const re = new RegExp(String.raw`(?<![\p{L}\d])${tal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\p{L}\d])`, "gu");
  let traffar = 0;
  for (const m of utanBilaga.matchAll(re)) {
    if (m.index == null) continue;
    traffar++;
    const { rad, iRaden } = radRunt(utanBilaga, m.index);
    if (!arStrukturtal(rad, iRaden, tal)) return false;
  }
  return traffar > 0;
};
const strukturIBeslut = hela.beslut.filter((b) => alltStrukturellt(b.tal));
kontroll(strukturIBeslut.length === 0, `noll rena strukturtal i beslutstabellen (hittade: ${strukturIBeslut.map((b) => b.tal).join(", ") || "inga"})`);
kontroll(hela.luckor.length === 0, `noll luckor kvar i den sparade texten (hittade: ${hela.luckor.map((l) => l.tal).join(", ") || "inga"})`);

// Numreringen ska stå kvar ORÖRD i texten. (Raderna 4, 7 och 9 är redan maskade i den
// sparade texten av den GAMLA grinden — de går inte att mäta här, och prövas i A3.)
for (const rad of [
  "1. **Lägg till",
  "| 1 | Sitemap är tom",
  "**Datum:** 2026-08-14",
  "| 2 | Hissgardin eller längdgardin",
  "## 5. 51 bilder saknar alt-text",
]) {
  kontroll(hela.text.includes(rad), `orörd i texten: "${rad}"`);
}
// Grinden får inte lägga till en enda ny lucka i en text den redan grindat.
const luckorFore_text = (utanBilaga.match(/\[DIN SIFFRA\]/g) || []).length;
const luckorEfter_text = (hela.text.match(/\[DIN SIFFRA\]/g) || []).length;
kontroll(luckorEfter_text === luckorFore_text, `inga NYA [DIN SIFFRA] i texten (${luckorFore_text} → ${luckorEfter_text})`);

// Datumet får inte längre ge rader i tabellen.
kontroll(!hela.beslut.some((b) => b.mening.startsWith("**Datum:**")), "datumraden ger inga beslut");

// Klass C i den sparade texten: 0 förväntat, eftersom 58 redan maskats av den gamla
// grinden och alltså inte finns kvar att klassa om. Klassen bevisas i A2.
const klassC = hela.beslut.filter((b) => b.klass === "C");
console.log(`\n  klass C i den sparade texten: ${klassC.length} tal (58 är redan maskad av gamla grinden — se A2)`);

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);

