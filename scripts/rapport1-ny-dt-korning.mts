// HELG-1 DEL 2: ny skarp DT-rapport med dagens kod (R-4 citatregel + R-5b sifferkalibrering
// + R-5b fjärde kravet, kund/ägar-uppdelningen). Submittar batchen, pollar tills klar,
// finaliserar, och gör ett eget stickprov innan Håkans granskning mot kontrollprotokollet.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
import { runDeepAudit } from "../lib/deep-audit-generate";
import { finalizePendingAudits } from "../lib/deep-audit-finalize";

const sb = supabaseService();
const { data: dt } = await sb.from("clients").select("id, name, public_url").eq("slug", "displayteknik").maybeSingle();
if (!dt) { console.error("Hittar inte displayteknik-klienten"); process.exit(1); }
const clientId = (dt as any).id as string;
console.log("DT client_id:", clientId, "url:", (dt as any).public_url);

console.log("\n1) Submittar ny batch...");
const start = await runDeepAudit(clientId);
console.log(JSON.stringify(start, null, 2));
if (!start.ok) process.exit(1);

console.log("\n2) Pollar tills batchen är klar (var 15:e sekund, max 20 minuter)...");
let klar = false;
for (let i = 0; i < 80; i++) {
  await new Promise((r) => setTimeout(r, 15000));
  const antal = await finalizePendingAudits(clientId);
  const { data: pending } = await sb
    .from("client_assets").select("id, status")
    .eq("client_id", clientId).eq("category", "deep_audit_report").eq("status", "processing");
  console.log(`  [${i + 1}] finaliserade denna omgång: ${antal}, kvar i processing: ${(pending ?? []).length}`);
  if ((pending ?? []).length === 0) { klar = true; break; }
}
if (!klar) { console.error("Batchen blev inte klar inom tidsgränsen."); process.exit(1); }

console.log("\n3) Hämtar den färska rapporten...");
const { data: rows } = await sb
  .from("client_assets")
  .select("id, body, metadata, created_at, status")
  .eq("client_id", clientId).eq("category", "deep_audit_report")
  .order("created_at", { ascending: false }).limit(1);
const rapport = (rows ?? [])[0] as any;
if (!rapport || rapport.status !== "active") {
  console.error("Ingen aktiv rapport hittades efter finalisering. Status:", rapport?.status);
  process.exit(1);
}
console.log("Rapport-id:", rapport.id, "skapad:", rapport.created_at, "längd:", rapport.body?.length);
console.log("Antal sifferbeslut i metadata:", (rapport.metadata?.grind_sifferbeslut ?? []).length);
console.log("Antal luckor:", (rapport.metadata?.grind_luckor ?? []).length);
console.log("Luckor:", JSON.stringify(rapport.metadata?.grind_luckor ?? [], null, 1));

// Skriv ut till fil för granskning (både kundversion och ägarversion).
import { kundtext, beslutstabellBlock } from "../lib/deep-audit-siffror";
import { writeFileSync } from "node:fs";
const kund = kundtext(rapport.body);
const agare = kund + beslutstabellBlock(rapport.metadata?.grind_sifferbeslut ?? []);
writeFileSync(path.join(ROOT, "scripts", "_rapport1-dt-ny-kund.md"), kund, "utf8");
writeFileSync(path.join(ROOT, "scripts", "_rapport1-dt-ny-agare.md"), agare, "utf8");
console.log("\nSkrivna: scripts/_rapport1-dt-ny-kund.md och scripts/_rapport1-dt-ny-agare.md");
console.log("Har beslutstabell i KUNDversion (ska vara false):", kund.includes("Så här bedömdes varje siffra"));
console.log("Har beslutstabell i ÄGARversion (ska vara true):", agare.includes("Så här bedömdes varje siffra"));
