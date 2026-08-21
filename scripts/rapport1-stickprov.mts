// HELG-1 DEL 2: eget stickprov på den färska DT-rapporten (454aef48) innan Håkans
// granskning mot kontrollprotokollet. Stickprovsregeln: minst ett av fem stickprov ska
// vara ett DT-pris som FINNS i pricing_notes (bevisar att grinden läser de riktiga
// priserna), och lucklistan (14 st) kontrolleras mot pricing_notes/knowledge/gsc för att
// se om någon av dem borde varit belagd.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
const sb = supabaseService();

const { data: dt } = await sb.from("clients").select("id").eq("slug", "displayteknik").maybeSingle();
const clientId = (dt as any).id as string;
const { data: profil } = await sb.from("hm_brand_profile").select("pricing_notes").eq("client_id", clientId).maybeSingle();
const pricingNotes = String((profil as any)?.pricing_notes || "");

const { data: rows } = await sb.from("client_assets").select("id, metadata").eq("id", "454aef48-b5ba-40e5-bff0-aadf86b245e0").maybeSingle();
const beslut = ((rows as any)?.metadata?.grind_sifferbeslut ?? []) as { tal: string; klass: string; utfall: string; kalla: string; mening: string; sektion: string }[];
const luckor = beslut.filter((b) => b.utfall === "lucka");
const belagda = beslut.filter((b) => b.utfall === "belagt");

console.log("=== PRICING_NOTES (DT:s riktiga prislista, för jämförelse) ===");
console.log(pricingNotes.slice(0, 2000));
console.log(`\n(${pricingNotes.length} tecken totalt)\n`);

console.log("=== STICKPROV: 5 belagda tal, varav minst ett ska finnas i pricing_notes ===");
// Prioritera tal av klass T (tenant/egen uppgift) — de är mest troliga att komma ur pricing_notes.
const tKlass = belagda.filter((b) => b.klass === "T");
const ovriga = belagda.filter((b) => b.klass !== "T");
const stickprov = [...tKlass.slice(0, 3), ...ovriga.slice(0, 2)].slice(0, 5);
let hittadeIPricing = 0;
for (const b of stickprov) {
  const rensat = b.tal.replace(/\s/g, "").replace(/ /g, "");
  const iPricing = pricingNotes.replace(/\s/g, "").includes(rensat);
  if (iPricing) hittadeIPricing++;
  console.log(`  ${iPricing ? "I PRICING_NOTES" : "annan källa     "} | ${b.tal} (klass ${b.klass}) — källa: "${b.kalla}" — sektion: ${b.sektion}`);
  console.log(`    mening: "${b.mening.slice(0, 140)}"`);
}
console.log(`\n${hittadeIPricing >= 1 ? "OK" : "FEL"}: ${hittadeIPricing} av 5 stickprov hittades ordagrant i pricing_notes (kravet är minst 1).`);

console.log("\n=== LUCKLISTAN (14 st) — kontroll: förekommer NÅGOT av dem i pricing_notes? ===");
let falskaLuckor = 0;
for (const l of luckor) {
  const rensat = l.tal.replace(/\s/g, "").replace(/ /g, "");
  const iPricing = pricingNotes.replace(/\s/g, "").includes(rensat);
  if (iPricing) falskaLuckor++;
  console.log(`  ${iPricing ? "‼ FINNS I PRICING_NOTES — FALSK LUCKA" : "OK, saknar täckning"} | ${l.tal} — sektion: ${l.sektion}`);
  console.log(`    mening: "${l.mening.slice(0, 140)}"`);
}
console.log(`\n${falskaLuckor === 0 ? "OK" : "FEL"}: ${falskaLuckor} av ${luckor.length} luckor hittades ändå i pricing_notes (ska vara 0).`);
