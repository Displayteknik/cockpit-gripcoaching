// HELG-1 DEL 6: omvänt test — DT:s tolkning av "regression" (och DT:s egna ordlista) ska
// vara helt opåverkad av Gittes ordlista/profil. Bevisar tenant-isolering, inte bara i teorin
// (koden är byggd client_id-scopad, se lib/ordlista.ts) utan mätt mot skarp data.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
import { hamtaOrdlista, amnesordIProfilen } from "../lib/ordlista";

const sb = supabaseService();
let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const { data: dt } = await sb.from("clients").select("id").eq("slug", "displayteknik").maybeSingle();
const { data: fb } = await sb.from("clients").select("id").eq("slug", "forbalance").maybeSingle();
const dtId = (dt as any).id as string;
const fbId = (fb as any).id as string;

console.log("1) DT:s explicita ordlista-fält innehåller INTE Gittes 'regression'-definition\n");
const dtOrdlista = await hamtaOrdlista(dtId);
kontroll(!dtOrdlista.some((o) => o.ord.toLowerCase() === "regression"), `DT:s ordlista har ${dtOrdlista.length} poster, ingen är "regression"`);

const fbOrdlista = await hamtaOrdlista(fbId);
console.log(`   (For Balance har ${fbOrdlista.length} poster i sin ordlista, för jämförelse: ${fbOrdlista.map((o) => o.ord).join(", ") || "inga explicita — den bygger på profiltext, se KUNSKAP-1:s huvudmekanism"})`);

console.log("\n2) amnesordIProfilen('regression', DT:s EGEN profiltext) — hittar bara DT:s egna rader, aldrig Gittes\n");
const dtProfilText = await (async () => {
  // getProfileAsMarkdown läser aktiv klient ur en cookie-baserad kontext i produktion;
  // här körs den utanför Next-request-kontext, så vi läser samma tabell direkt (samma
  // data getProfileAsMarkdown själv bygger av, mätt tenant-scopat).
  const { data } = await sb.from("hm_brand_profile").select("*").eq("client_id", dtId).maybeSingle();
  return JSON.stringify(data ?? {});
})();
const dtTraffar = amnesordIProfilen("regression", dtProfilText);
kontroll(!dtTraffar.some((t) => t.rader.some((r) => r.toLowerCase().includes("tidigare liv"))), "DT:s träffar (om några) innehåller aldrig Gittes 'resa till ett tidigare liv'-rad");
console.log(`   DT-träffar för "regression": ${dtTraffar.length ? JSON.stringify(dtTraffar) : "(inga — DT:s profil nämner inte ordet alls, vilket är korrekt och förväntat)"}`);

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
