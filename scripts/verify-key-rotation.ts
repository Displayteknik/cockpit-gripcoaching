// ANSLUT-4 — verifiera nyckelrotation.
// Kör EFTER att du roterat Supabase-nycklarna. Tar den GAMLA nyckeln som argument och
// bekräftar att den är DÖD: REST-anrop mot 5 känsliga tabeller ska alla svara 401.
//
// Usage:  npx tsx scripts/verify-key-rotation.ts <GAMMAL_NYCKEL>
// Ev. URL via env NEXT_PUBLIC_SUPABASE_URL, annars projektets standard-ref.
//
// PASS = 401 (nyckeln avvisas). FAIL = allt annat (200/403 → nyckeln lever fortfarande,
// eller tabellen nås ändå). Exit-kod 1 om något FAIL.

const OLD_KEY = process.argv[2];
if (!OLD_KEY) {
  console.error("Ange den GAMLA nyckeln som argument:\n  npx tsx scripts/verify-key-rotation.ts <GAMMAL_NYCKEL>");
  process.exit(2);
}

const REF = "liunepzrmygiaaibsbni";
const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${REF}.supabase.co`).replace(/\/$/, "");

// Känsliga tabeller: tokens, PII och behörighet.
const TABLES = [
  "meta_owner_connection",
  "tenant_ig_connections",
  "clients",
  "platform_users",
  "token_health_checks",
];

async function probe(table: string): Promise<{ table: string; status: number; pass: boolean }> {
  const url = `${BASE}/rest/v1/${table}?select=*&limit=1`;
  try {
    const r = await fetch(url, {
      headers: { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` },
    });
    // Efter rotation ska den gamla nyckelns JWT-signatur avvisas → 401.
    return { table, status: r.status, pass: r.status === 401 };
  } catch (e) {
    // Nätverksfel räknas inte som bevis på att nyckeln är död.
    console.error(`  (nätverksfel mot ${table}: ${(e as Error).message})`);
    return { table, status: 0, pass: false };
  }
}

async function main() {
  console.log(`\nVerifierar att GAMMAL nyckel är död mot ${BASE}\n`);
  const results = await Promise.all(TABLES.map(probe));
  let allPass = true;
  for (const r of results) {
    const mark = r.pass ? "PASS" : "FAIL";
    if (!r.pass) allPass = false;
    console.log(`  [${mark}] ${r.table.padEnd(24)} HTTP ${r.status}${r.pass ? "" : "  ← nyckeln avvisades INTE (401 förväntat)"}`);
  }
  console.log("");
  if (allPass) {
    console.log("RESULTAT: PASS — den gamla nyckeln är död på samtliga tabeller.\n");
    process.exit(0);
  } else {
    console.log("RESULTAT: FAIL — den gamla nyckeln fungerar fortfarande. Rotationen är INTE klar.\n");
    process.exit(1);
  }
}

void main();
