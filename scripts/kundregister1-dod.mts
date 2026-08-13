// KUNDREGISTER-1 DoD — kundlistan, skarpt, mot två tenants.
//
// Beställningen: "DoD mot två tenants varav en med många kontakter."
//
// ⚠ MÄTT INNAN BYGGET: Displayteknik svarar 200 med 137 kontakter. For Balance och AluCon
// svarar 401 — "The token is not authorized for this scope." Deras kundnycklar saknar
// kontakt-behörigheten i MySales. Det är inte ett kodfel, och det är inte "trasigt": 401
// betyder inte behörig (lesson_okontrollerbart_ar_inte_trasigt).
//
// DoD:n mäter därför två saker som BÅDA måste hålla:
//   1. Tenanten med många kontakter fyller spegeln och listan går att söka och filtrera.
//   2. Tenanten utan behörighet ger ett FELMEDDELANDE, aldrig en tom lista. Det är den
//      halvan som avgör om vyn ljuger, och den är minst lika viktig som den första.
//
// ⚠ Skriptet skriver bara i Cockpits egen spegel. Det rör aldrig något i MySales.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kundregister1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const rad of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = rad.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { synkaKundregister, senastSynkadKundregister, byggKontaktrader, visningsnamn } =
  await import("../lib/kundregister/synk");
const { resolveCoachGhl } = await import("../lib/coach-bridge");
const { supabaseService } = await import("../lib/supabase-admin");
const { mysalesKontaktUrl } = await import("../lib/mysales");

const TENANTS = [
  { namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", vantarManga: true },
  { namn: "For Balance", id: "d07d7288-2651-47df-b5f3-a010c1a1a97f", vantarManga: false },
];

let gron = 0;
let rod = 0;
const kolla = (ok: boolean, text: string, extra = "") => {
  if (ok) { gron++; console.log(`  GRÖN  ${text}`); }
  else { rod++; console.log(`  RÖD   ${text}${extra ? ` — ${extra}` : ""}`); }
};

console.log("KUNDREGISTER-1 DoD — kundlistan mot två tenants\n");

// ── Rena enhetskontroller först, inga anrop ─────────────────────────────────
console.log("Namnbygget:");
kolla(visningsnamn({ id: "1", contactName: "Anna Ek", firstName: "Anna" }) === "Anna Ek",
  "MySales eget namn vinner — annars visar Cockpit och MySales olika namn");
kolla(visningsnamn({ id: "1", firstName: "Anna", lastName: "Ek" }) === "Anna Ek",
  "namnet byggs av delarna när det sammanslagna saknas");
kolla(visningsnamn({ id: "1" }) === "", "utan namn blir det tomt — vyn skriver ut det, hittar inte på");

const rader = byggKontaktrader(
  [{ id: "c1", contactName: "Anna", tags: ["Offert-Lead", "kund"], source: "webb", dateUpdated: "2026-08-01T10:00:00Z" }],
  ["t1", "t2"],
  "loc1",
  "2026-08-12T00:00:00Z",
);
kolla(rader.length === 2, "en rad per tenant — en delad location får inte tappa den ena");
kolla(rader[0].taggar.join(",") === "offert-lead,kund",
  "taggarna normaliseras till gemener, annars blir samma tagg två filter");

console.log("\nDjuplänken till MySales:");
kolla(
  mysalesKontaktUrl("loc1", "c1") === "https://app.mysales.se/location/loc1/customers/detail/c1",
  "länken pekar på MySales egen form",
);
kolla(mysalesKontaktUrl(null, "c1") === null, "halv länk blir ingen länk — knappen döljs hellre");

// ── Skarpt, per tenant ──────────────────────────────────────────────────────
const sb = supabaseService();
for (const t of TENANTS) {
  console.log(`\n=== ${t.namn} ===`);
  const ghl = await resolveCoachGhl(t.id);
  console.log(`  MySales-koppling: location ${ghl.locationId ? "ja" : "NEJ"}, nyckel ${ghl.token ? "ja" : "NEJ"}, tenants ${ghl.ids.length}`);

  const res = await synkaKundregister(t.id, true);
  console.log(`  synk: ok=${res.ok} antal=${res.antal ?? "-"} borttagna=${res.borttagna ?? "-"}`);
  if (res.fel) console.log(`  fel: ${res.fel}`);

  if (t.vantarManga) {
    kolla(res.ok, `${t.namn}: synken lyckas`, res.fel || "");
    kolla((res.antal ?? 0) > 50, `${t.namn}: många kontakter i spegeln (${res.antal ?? 0})`);

    const { data } = await sb
      .from("kundregister_kontakter")
      .select("namn, foretag, taggar, kalla, senast_aktivitet, location_id, ghl_contact_id")
      .in("tenant_id", res.ids)
      .limit(500);
    const speglade = (data as Array<Record<string, unknown>> | null) || [];
    kolla(speglade.length > 0, `${t.namn}: raderna går att läsa tillbaka`);
    kolla(
      speglade.some((r) => (r.taggar as string[] | null)?.length),
      `${t.namn}: taggar följde med — annars går filtret inte att använda`,
    );
    kolla(
      speglade.some((r) => r.senast_aktivitet),
      `${t.namn}: senaste aktivitet följde med — listan sorteras på den`,
    );
    kolla(
      speglade.every((r) => mysalesKontaktUrl(r.location_id as string, r.ghl_contact_id as string)),
      `${t.namn}: varje rad kan öppnas i MySales`,
    );

    const senast = await senastSynkadKundregister(res.ids);
    kolla(!!senast, `${t.namn}: åldersstämpeln finns — vyn kan skriva ut hur färsk listan är`);

    // Sökningen och taggfiltret, på riktig data.
    const q = "a";
    const traffar = speglade.filter((r) => String(r.namn || "").toLowerCase().includes(q));
    kolla(traffar.length > 0 && traffar.length < speglade.length,
      `${t.namn}: sökningen smalnar av (${traffar.length} av ${speglade.length} på "${q}")`);

    const taggar = new Set(speglade.flatMap((r) => (r.taggar as string[] | null) || []));
    console.log(`  taggar i registret: ${[...taggar].slice(0, 8).join(", ")}${taggar.size > 8 ? " …" : ""}`);
    kolla(taggar.size > 0, `${t.namn}: det finns taggar att filtrera på`);
  } else {
    // Den andra halvan av DoD:n, och den viktigaste: fellägen ska SYNAS.
    kolla(!res.ok, `${t.namn}: nyckeln saknar kontakt-behörighet, som mätt`, res.ok ? "synken gick oväntat igenom" : "");
    kolla(
      !!res.fel && /behörighet|kontakter|MySales/i.test(res.fel),
      `${t.namn}: felet är klartext som säger vad som ska göras`,
      res.fel || "(inget fel)",
    );
    const { count } = await sb
      .from("kundregister_kontakter")
      .select("ghl_contact_id", { count: "exact", head: true })
      .in("tenant_id", res.ids.length ? res.ids : ["00000000-0000-0000-0000-000000000000"]);
    kolla((count ?? 0) === 0, `${t.namn}: inget skrevs i spegeln vid fel`);
    console.log("  ★ Vyn visar felet ovan, ALDRIG en tom lista — en tom lista hade sagt");
    console.log("    'du har inga kunder', och det är inte sant.");
  }
}

console.log(`\n${"=".repeat(62)}`);
console.log(`GRÖNA: ${gron}   RÖDA: ${rod}`);
console.log(
  "\nKVAR HOS HÅKAN: ge kundnycklarna för For Balance och AluCon behörighet att läsa\n" +
    "kontakter i MySales. Då fylls deras listor vid nästa hämtning, utan kodändring.",
);
process.exit(rod ? 1 : 0);
