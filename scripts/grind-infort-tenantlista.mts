// GRIND_INFORD flyttad 2026-08-21 (HELG-1 DEL 0-fynd, AKUT-punkt 1).
//
// Bevisar per tenant: vilka djupgranskningsrapporter var synliga för kund FÖRE flytten
// (gamla gränsen, underlagsgrinden 11/8) och vilka är synliga EFTER (nya gränsen, R-5b
// 15/8 — den senast landade av underlagsgrinden/R-4/R-5b). Läser samma tabell och samma
// filter som app/api/seo/deep-audit/route.ts GET, men läsning över ALLA tenants.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";

const GAMLA_GRANSEN = Date.parse("2026-08-11T15:14:01Z"); // commit 5151297, underlagsgrinden
const NYA_GRANSEN = Date.parse("2026-08-15T12:06:03Z"); // commit aea5f5c, R-5b (senast av de tre)

const sb = supabaseService();

const { data: clients } = await sb.from("clients").select("id, name, slug");
const namnPerId = new Map<string, string>((clients ?? []).map((c: any) => [c.id, c.name || c.slug || c.id]));

const { data: rows, error } = await sb
  .from("client_assets")
  .select("id, client_id, status, created_at")
  .eq("category", "deep_audit_report")
  .in("status", ["active", "processing"])
  .order("created_at", { ascending: true });

if (error) {
  console.error("FEL vid läsning:", error.message);
  process.exit(1);
}

type Rad = { id: string; client_id: string; status: string; created_at: string };
const alla = (rows ?? []) as Rad[];

console.log(`Totalt ${alla.length} rapporter (status active/processing) i client_assets.\n`);
console.log(`Gamla gränsen (underlagsgrinden): ${new Date(GAMLA_GRANSEN).toISOString()}`);
console.log(`Nya gränsen (R-5b, senast landade): ${new Date(NYA_GRANSEN).toISOString()}\n`);

const perTenant = new Map<string, Rad[]>();
for (const r of alla) {
  const namn = namnPerId.get(r.client_id) ?? r.client_id;
  if (!perTenant.has(namn)) perTenant.set(namn, []);
  perTenant.get(namn)!.push(r);
}

let totalVarSynligForut = 0;
let totalSynligNu = 0;
let regression = 0; // var dold förut, är synlig nu — ska ALDRIG hända, det vore en försämring

for (const [namn, list] of [...perTenant.entries()].sort((a, b) => a[0].localeCompare(b[0], "sv"))) {
  console.log(`## ${namn} (${list.length} rapporter)`);
  for (const r of list) {
    const t = Date.parse(r.created_at);
    const synligForut = t >= GAMLA_GRANSEN;
    const synligNu = t >= NYA_GRANSEN;
    if (synligForut) totalVarSynligForut++;
    if (synligNu) totalSynligNu++;
    if (!synligForut && synligNu) regression++;
    const pil = synligForut && !synligNu ? "SYNLIG → DOLD (fixad)" : synligNu ? "SYNLIG (efter R-5b, korrekt)" : "DOLD (var redan dold)";
    console.log(`  ${r.created_at}  id=${r.id.slice(0, 8)}  status=${r.status}  ${pil}`);
  }
  console.log("");
}

console.log("── SAMMANFATTNING ──");
console.log(`Synliga för kund FÖRE flytten (gamla gränsen): ${totalVarSynligForut}`);
console.log(`Synliga för kund EFTER flytten (nya gränsen):  ${totalSynligNu}`);
console.log(`Rapporter som gick från dold till synlig (regression, ska vara 0): ${regression}`);
console.log(
  regression === 0
    ? "OK: gränsen flyttades bara framåt, ingen tidigare dold rapport blev synlig."
    : "FEL: en tidigare dold rapport blev synlig av flytten — undersök innan detta godkänns."
);
