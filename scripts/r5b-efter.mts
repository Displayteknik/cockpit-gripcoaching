// R-5b: de sex luckorna i den OMKÖRDA Makzy-rapporten (asset c668c538), en och en,
// mot koden som den ser ut nu. Visar vilka som var äkta och vilka som var kalibrering.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
import { grindaSiffror } from "../lib/deep-audit-siffror";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data } = await sb.from("client_assets").select("metadata").eq("id", process.argv[2] || "c668c538-eadc-4d13-bab4-2f2c8b1a679d").maybeSingle();
const m = (data as any).metadata ?? {};
const indata = {
  belagda: new Set<string>(m.tillatna_tal ?? []),
  kunskapsfalt: (m.kunskapsfalt ?? null) as string | null,
  gscTal: new Set<string>(m.gsc_tal ?? []),
};
const luckor = (m.grind_sifferbeslut ?? []).filter((b: any) => b.utfall === "lucka");
console.log(`Den omkörda rapportens luckor: ${luckor.length}\n`);
for (const b of luckor) {
  const r = grindaSiffror(b.mening, indata);
  const nytt = r.beslut.find((x) => x.tal.replace(/[\s.,]/g, "") === b.tal.replace(/[\s.,]/g, ""));
  const utfall = !nytt ? "STRUKTURTAL (inget beslut)" : `${nytt.klass}/${nytt.utfall} — ${nytt.kalla}`;
  console.log(`${String(b.tal).padEnd(6)} lucka → ${utfall}`);
  console.log(`       "${b.mening.slice(0, 110)}"`);
}
