// R-5b, steg 1: FÖRE-läget mätt på den skarpa Makzy-rapporten (14/8 06:18).
// Skriver ut varje sifferbeslut med klass, utfall, källa och meningen talet stod i, samt
// lucklistan. Underlag för de tre kalibreringsfelen Håkan pekade ut.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ID = process.argv[2] || "45bf59c4-53f1-4518-9088-c883a26bbaf0";
const { data, error } = await sb.from("client_assets").select("body, metadata").eq("id", ID).maybeSingle();
if (error || !data) throw error ?? new Error("hittade inte rapporten");
const m = (data as any).metadata ?? {};
const beslut = (m.grind_sifferbeslut ?? []) as Array<{ tal: string; klass: string; utfall: string; kalla: string; mening: string; sektion: string }>;

console.log(`Rapport ${ID}\n  url=${m.url}  tecken=${String((data as any).body ?? "").length}  beslut=${beslut.length}  luckor=${(m.grind_luckor ?? []).length}`);
console.log(`  avvikelser: ${(m.grind_avvikelser ?? []).map((a: any) => `${a.typ}(${a.detalj})`).join(" · ")}\n`);

console.log("── BESLUTSTABELLEN, RAD FÖR RAD ─────────────────────────────────────");
for (const b of beslut) {
  console.log(`${String(b.tal).padEnd(10)} ${b.klass}  ${b.utfall.padEnd(10)} ${String(b.kalla).padEnd(42)} [${b.sektion}]`);
  console.log(`    "${b.mening}"`);
}
console.log("\n── LUCKLISTAN ───────────────────────────────────────────────────────");
for (const l of (m.grind_luckor ?? [])) console.log(`  ${l}`);

writeFileSync(path.join(ROOT, "scripts", "_r5b-makzy-body.md"), String((data as any).body ?? ""), "utf8");
writeFileSync(path.join(ROOT, "scripts", "_r5b-makzy-meta.json"), JSON.stringify(m, null, 2), "utf8");
console.log("\nSparat: scripts/_r5b-makzy-body.md + _r5b-makzy-meta.json");
