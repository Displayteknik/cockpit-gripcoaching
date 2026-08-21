// KALIBRERING-2 — beslutsunderlag för trappstegsfunktionen (INTE byggd, väntar Håkans
// beslut efter helgen). Read-only: läser riktiga sparade Sid-analyser ur hm_seo_audits
// och räknar hur många som ligger nära en tröskel — dvs skulle RÖRA SIG om skalan
// blev gradvis i stället för binär.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/_kalibrering2-trappsteg-underlag.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const rad of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = rad.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { supabaseServer } = await import("../lib/supabase-admin");
const sb = supabaseServer();

const { data, error } = await sb
  .from("hm_seo_audits")
  .select("client_id, url, title, meta_description, word_count, seo_score, aeo_score, audited_at")
  .order("audited_at", { ascending: false })
  .limit(500);

if (error) { console.error("Kunde inte läsa hm_seo_audits:", error.message); process.exit(1); }
if (!data || data.length === 0) { console.log("Inga rader i hm_seo_audits — inget underlag att räkna på."); process.exit(0); }

console.log(`Läste ${data.length} sparade Sid-analyser (senaste per rad, inte deduplicerat på url).\n`);

function band(varde: number | null, troskel: number, marginal: number): "nara_under" | "nara_over" | "langt_ifran" | "okant" {
  if (varde == null) return "okant";
  const avstand = varde - troskel;
  if (Math.abs(avstand) <= marginal) return avstand < 0 ? "nara_under" : "nara_over";
  return "langt_ifran";
}

let titelNaraGransen = 0, metaNaraGransen = 0, innehallNaraGransen300 = 0, innehallNaraGransen600 = 0;
const exempel: string[] = [];

for (const r of data) {
  const titleLen = r.title ? r.title.length : null;
  const metaLen = r.meta_description ? r.meta_description.length : null;
  const wc = r.word_count;

  const tBand = band(titleLen, 65, 8); // ±8 tecken från 65-gränsen
  const mBand = band(metaLen, 170, 15); // ±15 tecken från 170-gränsen
  const w300Band = band(wc, 300, 40);
  const w600Band = band(wc, 600, 60);

  if (tBand !== "langt_ifran" && tBand !== "okant") { titelNaraGransen++; exempel.push(`${r.url}: titel ${titleLen} tecken (gräns 65, ${tBand})`); }
  if (mBand !== "langt_ifran" && mBand !== "okant") metaNaraGransen++;
  if (w300Band !== "langt_ifran" && w300Band !== "okant") innehallNaraGransen300++;
  if (w600Band !== "langt_ifran" && w600Band !== "okant") innehallNaraGransen600++;
}

console.log(`Titel inom ±8 tecken från 65-gränsen: ${titelNaraGransen} av ${data.length} rader (${Math.round(100 * titelNaraGransen / data.length)}%)`);
console.log(`Meta description inom ±15 tecken från 170-gränsen: ${metaNaraGransen} av ${data.length} rader`);
console.log(`Ordantal inom ±40 ord från 300-gränsen (SEO-innehåll): ${innehallNaraGransen300} av ${data.length} rader`);
console.log(`Ordantal inom ±60 ord från 600-gränsen (AEO-djup): ${innehallNaraGransen600} av ${data.length} rader`);
console.log(`\nExempel (titel nära 65-gränsen):`);
exempel.slice(0, 10).forEach((e) => console.log(`  - ${e}`));

// Unika tenants representerade
const tenants = new Set(data.map((r) => r.client_id));
console.log(`\nRaderna kommer från ${tenants.size} unika tenants (client_id).`);

const { data: klienter } = await sb.from("clients").select("id, name").in("id", Array.from(tenants));
console.log("\nTenants i urvalet:");
(klienter || []).forEach((k) => console.log(`  - ${k.name} (${k.id})`));
