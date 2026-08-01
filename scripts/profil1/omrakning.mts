// PROFIL-1/F-mätare — omräkning av de fyra skarpa profilerna (READ ONLY).
// Dagens procenttal (gamla formeln, återskapad här som jämförelse) → ny nivå + de
// tre åtgärderna. Ingen skrivning, ingen AI.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/profil1/omrakning.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { lasKvalitetsIndata } = await import("@/lib/profil/las");
const { beraknaKvalitet } = await import("@/lib/profil/kvalitet");

const PROFILER = [
  { namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", idag: 89 },
  { namn: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001", idag: 61 },
  { namn: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e", idag: 55 },
  { namn: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001", idag: 27 },
];

for (const p of PROFILER) {
  const indata = await lasKvalitetsIndata(p.id);
  const r = beraknaKvalitet(indata);
  console.log(`\n=== ${p.namn} ===`);
  console.log(`idag: ${p.idag} %  →  nivå ${r.niva} (${r.nivaNamn}) — ${r.nivaKonsekvens}   [intern poäng ${r.poang}]`);
  if (r.forankringsflagga) console.log(`FÖRANKRINGSFLAGGA: ${r.forankringsVarning}`);
  if (r.takOrsak) console.log(`tak: ${r.takOrsak}`);
  console.log("kriterier: " + r.kriterier.map((k) => `${k.label} ${k.antal}/${k.krav} (${Math.round(k.andel * 100)}%)`).join(" · "));
  r.atgarder.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
}
