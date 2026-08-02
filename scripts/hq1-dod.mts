// HQ-1 DoD — mot den RIKTIGA databasen och det RIKTIGA MySales-API:t.
//
// Det enhetstesterna inte kan visa: att tabellerna är server-only på riktigt, att
// GHL-läsningen svarar och landar i spegeln, att vunnet härleds ur steget (GHL:s
// status-fält säger "open" även om affären är vunnen) och att tio-minutersspärren
// verkligen hoppar över en andra synk.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/hq1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { supabaseService } = await import("@/lib/supabase-admin");
const hq = await import("@/lib/hq/pipeline");
const sb = supabaseService();

let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

console.log("\n== 1. Tabellerna är server-only ==");
for (const t of ["hq_mrr_entries", "hq_fasta_kostnader", "hq_tasks", "hq_pipeline_cache"]) {
  const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const rader = r.ok ? await r.json() : [];
  kolla(`${t}: anon-nyckeln ser noll rader`, Array.isArray(rader) && rader.length === 0, `status ${r.status}`);
}

console.log("\n== 2. Startdatan finns ==");
const { data: mrr } = await sb.from("hq_mrr_entries").select("kund, niva, belopp_ex_moms, status");
const pro = (mrr || []).filter((r: { niva: string }) => r.niva === "pro");
kolla("fyra pro-rader à 1990 kr", pro.length === 4 && pro.every((r: { belopp_ex_moms: number | string }) => Number(r.belopp_ex_moms) === 1990), `${pro.length} st`);
kolla("Orwix Studio som konsult 7500 kr",
  (mrr || []).some((r: { kund: string; niva: string; belopp_ex_moms: number | string }) => r.kund === "Orwix Studio" && r.niva === "konsult" && Number(r.belopp_ex_moms) === 7500));
const { data: fasta } = await sb.from("hq_fasta_kostnader").select("bolag, tjanst, belopp_per_man, valuta, notering");
kolla("tio fasta kostnader", (fasta || []).length === 10, `${(fasta || []).length} st`);
kolla("GoHighLevel konto 1 står i USD på 90.87",
  (fasta || []).some((f: { tjanst: string; valuta: string; belopp_per_man: number | string }) => f.tjanst === "GoHighLevel konto 1" && f.valuta === "USD" && Number(f.belopp_per_man) === 90.87));
kolla("de fyra okända beloppen står på noll med notering",
  (fasta || []).filter((f: { belopp_per_man: number | string; notering: string | null }) => Number(f.belopp_per_man) === 0 && f.notering === "belopp okänt, fyll i").length === 4);
kolla("svenska tecken överlevde migreringen",
  (fasta || []).some((f: { tjanst: string }) => f.tjanst === "hallon företag") &&
  (mrr || []).some((r: { kund: string }) => r.kund === "Pionjär 3"));

console.log("\n== 3. MySales-läsningen ==");
const cfg = await hq.hamtaHqGhl();
kolla("koppling till MySales hittad", !!cfg, cfg ? `källa: ${cfg.kalla}, location ${cfg.locationId}` : "saknas");
const synk = await hq.synkaPipeline(true);
kolla("synk mot GHL gick igenom", synk.ok, synk.fel || `${synk.antal} affärer`);
const rader = await hq.lasPipeline();
kolla("spegeln har affärer", rader.length > 0, `${rader.length} rader`);
kolla("varje rad bär steg och tidsstämpel",
  rader.every((r) => r.steg_namn && r.senast_synkad),
  `${rader.filter((r) => !r.steg_namn).length} utan steg`);

console.log("\n== 4. Vunnet härleds ur steget, inte ur status ==");
const vunna = rader.filter((r) => r.harledd_status === "won");
const forlorade = rader.filter((r) => r.harledd_status === "lost");
kolla("minst en affär räknas som vunnen", vunna.length > 0, `${vunna.length} vunna, ${forlorade.length} förlorade`);
kolla("GHL:s eget status-fält säger fortfarande open för de vunna",
  vunna.every((r) => r.status === "open"),
  "därför får status aldrig användas ensamt");
kolla("vinststeget heter något med vunnen", vunna.every((r) => /vunn|won|payment|sold|betald/i.test(r.steg_namn || "")),
  vunna.map((r) => r.steg_namn).slice(0, 2).join(", "));

console.log("\n== 5. Tio-minutersspärren ==");
const igen = await hq.synkaPipeline(false);
kolla("andra synken hoppas över", igen.ok && igen.hoppadeOver === true, JSON.stringify(igen));
const tvingad = await hq.synkaPipeline(true);
kolla("Uppdatera nu går förbi spärren", tvingad.ok && !tvingad.hoppadeOver, `${tvingad.antal} affärer`);

console.log("\n== 6. Uppföljningar ==");
const medUppf = rader.filter((r) => r.uppfoljning_datum);
kolla("uppgifter från MySales följde med", medUppf.length > 0, `${medUppf.length} kort har uppföljningsdatum`);
kolla("uppföljning bara på affärer som är i spel",
  medUppf.every((r) => r.harledd_status === "open"));

console.log("\n== 7. Pipelineurvalet (Håkans beslut 2026-08-02) ==");
const valda = await hq.hamtaValdaPipelines(cfg!.locationId);
kolla("inställd pipeline hittad i coach_users", valda.size > 0, [...valda].join(", "));
const iUrval = rader.filter((r) => r.pipeline_id && valda.has(r.pipeline_id));
kolla("spegeln lagrar ALLT, även det som inte räknas", rader.length > iUrval.length,
  `${rader.length} i spegeln, ${iUrval.length} i urvalet, ${rader.length - iUrval.length} utanför`);
kolla("urvalet innehåller bara en pipeline",
  new Set(iUrval.map((r) => r.pipeline_namn)).size === 1,
  [...new Set(iUrval.map((r) => r.pipeline_namn))].join(", "));

console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
process.exit(fel === 0 ? 0 : 1);
