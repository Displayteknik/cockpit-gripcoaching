// Verifierar For Balance-profilen mot den skarpa kvalitetsmätaren (READ ONLY).
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/profil1/forbalance-verifiera.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { lasKvalitetsIndata } = await import("@/lib/profil/las");
const { beraknaKvalitet, racker, brandProfilKlar } = await import("@/lib/profil/kvalitet");

const ID = "d07d7288-2651-47df-b5f3-a010c1a1a97f";
const indata = await lasKvalitetsIndata(ID);
const r = beraknaKvalitet(indata);

console.log("=== For Balance (Gitte Östling) ===");
console.log(`nivå ${r.niva} (${r.nivaNamn}) — ${r.nivaKonsekvens}   [intern poäng ${r.poang}]`);
console.log(`racker() = ${racker(r)} · brandProfilKlar() = ${brandProfilKlar(r)}`);
if (r.forankringsflagga) console.log(`FÖRANKRINGSFLAGGA: ${r.forankringsVarning}`);
if (r.takOrsak) console.log(`tak: ${r.takOrsak}`);
console.log("\nkriterier:");
for (const k of r.kriterier) {
  console.log(`  ${k.label.padEnd(20)} ${String(k.antal).padStart(3)}/${k.krav}  ${String(Math.round(k.andel * 100)).padStart(3)}%  (vikt ${k.vikt})`);
}
console.log("\ntre viktigaste åtgärderna:");
r.atgarder.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
