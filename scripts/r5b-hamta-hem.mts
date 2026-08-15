// R-5b DoD: hämtar hem den omkörda Makzy-rapporten när batchen är klar och mäter
// resultatet mot beställningen — noll strukturtal i lucklistan, ren beslutstabell.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ASSET = process.argv[2] || "c668c538-eadc-4d13-bab4-2f2c8b1a679d";

const { finalizePendingAudits } = await import("../lib/deep-audit-finalize");
const antal = await finalizePendingAudits();
console.log(`finalizePendingAudits: ${antal} rapport(er) klara\n`);

const { data } = await sb.from("client_assets").select("status, body, metadata").eq("id", ASSET).maybeSingle();
const rad = data as any;
if (!rad) throw new Error("hittade inte rapporten");
const m = rad.metadata ?? {};
console.log(`status=${rad.status}  tecken=${String(rad.body ?? "").length}  batch=${m.batch_id}`);
if (rad.status === "processing") {
  console.log("Batchen är inte klar än. Kör om skriptet senare.");
  process.exit(0);
}

const beslut = (m.grind_sifferbeslut ?? []) as Array<{ tal: string; klass: string; utfall: string; kalla: string; mening: string; sektion: string }>;
const luckor = (m.grind_luckor ?? []) as string[];
console.log(`\nBESLUT: ${beslut.length}   LUCKOR: ${luckor.length}\n`);
for (const b of beslut) {
  console.log(`${String(b.tal).padEnd(10)} ${b.klass}  ${b.utfall.padEnd(10)} ${String(b.kalla).padEnd(46)} [${b.sektion}]`);
  console.log(`    "${b.mening.slice(0, 110)}"`);
}
console.log("\nLUCKLISTAN:");
for (const l of luckor) console.log(`  ${l}`);

writeFileSync(path.join(ROOT, "scripts", "_r5b-makzy-omkord.md"), String(rad.body ?? ""), "utf8");
console.log("\nSparat: scripts/_r5b-makzy-omkord.md");
