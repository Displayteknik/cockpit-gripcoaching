// Verifierar DoD-kravet "ingen mejlkropp i databasen" mot skarpa driv_kort_cache-rader.
import { supabaseService } from "../lib/supabase-admin.ts";

const sb = supabaseService();
const { data: kort } = await sb.from("driv_kort_cache").select("ghl_opportunity_id, payload, hamtad_tidsstampel");
console.log(`driv_kort_cache: ${kort?.length || 0} rader`);
for (const k of kort || []) {
  const rå = JSON.stringify(k.payload);
  console.log(`\n${k.ghl_opportunity_id} (${k.hamtad_tidsstampel}) — ${rå.length} tecken payload`);
  // Sök efter tecken på en full mejlkropp: nyckeln "kropp" ska ALDRIG förekomma i cachen,
  // och ingen sträng i tidslinjen ska vara längre än snippet-taket (200 tecken + lite marginal).
  const harKroppNyckel = /"kropp"\s*:/.test(rå);
  console.log(`  innehåller "kropp"-nyckel: ${harKroppNyckel ? "JA — FEL!" : "nej"}`);
  const snippets: string[] = (k.payload?.tidslinje || []).map((t: { snippet: string | null }) => t.snippet || "");
  const langaste = Math.max(0, ...snippets.map((s) => s.length));
  console.log(`  längsta snippet: ${langaste} tecken (tak: 200)`);
}

const { data: lankar } = await sb.from("driv_lankar").select("id, ref_typ, kalla, belagg, status");
console.log(`\ndriv_lankar: ${lankar?.length || 0} rader`);
for (const l of lankar || []) console.log(` - ${l.ref_typ} kalla=${l.kalla} status=${l.status} belagg="${l.belagg}"`);
