// Torrkörning av Bytbil-synken mot VERKLIG feed + VERKLIG databas. Skriver ingenting.
// Kör: npx tsx scripts/bytbil-torrkorning.mts
//
// Visar exakt vilka fält som ändras när synken går skarpt, så att ändringen kan
// granskas innan deploy. Använder samma kod som synken (mapCarToVehicle + mergeSpecs).

import { readFileSync } from "node:fs";
import { fetchBytbilCars, mapCarToVehicle, mergeSpecs, BYTBIL_FEEDS } from "../lib/bytbil";

const HM = "00000000-0000-0000-0000-000000000001";

// .env.local — splitta på /\r?\n/, annars följer \r med in i värdet.
for (const rad of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = rad.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const NYCKEL = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const rad = (t = "") => process.stdout.write(t + "\n");

const svar = await fetch(
  `${URL_SB}/rest/v1/hm_vehicles?client_id=eq.${HM}&is_sold=eq.false&select=id,slug,title,price,specs&limit=1000`,
  { headers: { apikey: NYCKEL, Authorization: `Bearer ${NYCKEL}` } }
);
if (!svar.ok) { rad(`Supabase svarade ${svar.status}`); process.exit(1); }
const rader = (await svar.json()) as { id: string; slug: string; title: string; price: number; specs: Record<string, string> | null }[];

const idUr = (s: string) => s.match(/-(\d{7,})$/)?.[1] || null;
const perId = new Map(rader.map((r) => [idUr(r.slug), r] as const).filter(([k]) => k));

const bilar = await fetchBytbilCars(BYTBIL_FEEDS[HM]);
rad(`Feed: ${bilar.length} fordon · Databas: ${rader.length} synliga rader\n`);

let andrade = 0, orordaFordon = 0;
const perFalt: Record<string, number> = {};

for (const bil of bilar) {
  const befintlig = perId.get(String(bil.id));
  if (!befintlig) continue;
  const ny = mapCarToVehicle(bil, HM, new Date(0).toISOString());
  const nyaSpecs = mergeSpecs(befintlig.specs, ny.specs);
  const gamlaSpecs = befintlig.specs || {};

  const diffar: string[] = [];
  if (befintlig.price !== ny.price) diffar.push(`Pris: ${befintlig.price} → ${ny.price}`);
  for (const nyckel of new Set([...Object.keys(gamlaSpecs), ...Object.keys(nyaSpecs)])) {
    const fore = gamlaSpecs[nyckel] ?? "(saknas)";
    const efter = nyaSpecs[nyckel] ?? "(saknas)";
    if (fore === efter) continue;
    diffar.push(`${nyckel}: ${fore.slice(0, 60)}${fore.length > 60 ? "…" : ""} → ${efter.slice(0, 60)}${efter.length > 60 ? "…" : ""}`);
    perFalt[nyckel] = (perFalt[nyckel] || 0) + 1;
  }

  if (!diffar.length) { orordaFordon++; continue; }
  andrade++;
  rad(`${befintlig.title}`);
  rad(`  https://www.hmmotor.se/fordon/${befintlig.slug}`);
  for (const d of diffar) rad(`    ${d}`);
  rad();
}

rad("─".repeat(70));
rad(`${andrade} fordon uppdateras, ${orordaFordon} står redan rätt.`);
rad(`Ändringar per fält: ${JSON.stringify(perFalt)}`);
rad("Rubrik, beskrivning, bilder, badge, utvald och sortering rörs inte.");
