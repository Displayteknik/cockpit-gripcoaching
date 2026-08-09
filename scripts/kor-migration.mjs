// Kör en migration mot Supabase via Management API.
//
// Konventionen står i docs/studio/PLAN.md: migrationer körs via Management API med PAT:en
// i Antigravity/.shared-keys.env, följt av NOTIFY pgrst för schema-omladdning. Den har
// hittills körts som lösa engångskommandon — den här filen gör den till ett verktyg, så
// samma sak görs likadant varje gång och går att läsa i efterhand.
//
// Kör:  node scripts/kor-migration.mjs migrations/<fil>.sql
//
// Visar SQL:en och kräver --ja för att faktiskt köra. En migration är en ändring i den
// delade produktionsdatabasen; den ska inte kunna hända av misstag.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJEKT = "liunepzrmygiaaibsbni"; // delat Supabase-projekt (se projektminnet)
const fil = process.argv[2];
const kor = process.argv.includes("--ja");

if (!fil) {
  console.error("Användning: node scripts/kor-migration.mjs migrations/<fil>.sql [--ja]");
  process.exit(1);
}

function readVar(sokvag, namn) {
  try {
    const t = readFileSync(resolve(process.cwd(), sokvag), "utf8");
    return (t.match(new RegExp(`^\\s*${namn}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}

const pat = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!pat) {
  console.error("Saknar SUPABASE_ACCESS_TOKEN (env eller ../.shared-keys.env)");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), fil), "utf8");

if (!kor) {
  console.log(`── ${fil} (${sql.split("\n").length} rader) ──\n`);
  console.log(sql);
  console.log("\nTorrkörning. Lägg till --ja för att köra mot projektet.");
  process.exit(0);
}

const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${pat}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});
const kropp = await r.text();
console.log(`HTTP ${r.status}`);
console.log(kropp.slice(0, 2000));
process.exit(r.ok ? 0 : 1);
