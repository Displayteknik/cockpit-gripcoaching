// PROFIL-1/F2 — verifiering (READ ONLY, inga skrivningar, ingen AI).
// Frågan: når klienternas winning_example-rader faktiskt lager 5 nu?
// Kör fetchWinningExamples för varje syfte som prompt-core sätter kategori för,
// samt byggTextPrompt för Engens (14 exempel, alla utan subcategory) och kollar
// att blocket "=== VINNANDE EXEMPEL" finns i systemprompten.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/profil1/f2-verifiera.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as { __setBatchCookie: (n: string, v: string) => void };
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));

const { fetchWinningExamples } = await import("@/lib/voice-score");
const { byggTextPrompt } = await import("@/lib/prompt-core");
const { supabaseService } = await import("@/lib/supabase-admin");
const sb = supabaseService();

const PROFILER = [
  { namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" },
  { namn: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001" },
  { namn: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001" },
  { namn: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e" },
];

const KATEGORIER = ["studio_copy", "caption", "carousel", "linkedin", "blog", "newsletter", "post", "reel"];

let engensOk = false;

for (const p of PROFILER) {
  const { data: rader } = await sb
    .from("client_assets")
    .select("subcategory, body")
    .eq("client_id", p.id)
    .eq("status", "active")
    .eq("category", "winning_example");

  const antal = (rader || []).length;
  const utanSub = (rader || []).filter((r) => !r.subcategory).length;
  console.log(`\n=== ${p.namn} ===`);
  console.log(`winning_example i DB: ${antal} (varav utan subcategory: ${utanSub})`);

  if (antal === 0) {
    console.log("  (inga exempel — inget att nå prompten med)");
    continue;
  }

  for (const kat of KATEGORIER) {
    const ex = await fetchWinningExamples(p.id, kat);
    console.log(`  ${kat.padEnd(11)} → ${ex.length} exempel når prompten`);
  }

  // Skarp promptbyggnad: syftet "linkedin" sätter kategori "linkedin".
  const b = await byggTextPrompt({ clientId: p.id, syfte: "linkedin", uppdrag: "UPPDRAG", underlag: "u" });
  const iPrompt = b.system.includes("=== VINNANDE EXEMPEL");
  console.log(`  byggTextPrompt(linkedin): lager 5 ${iPrompt ? "PÅ" : "AV"} (${b.winning.length} exempel)`);
  if (p.namn.startsWith("Engens")) engensOk = iPrompt && b.winning.length > 0;
}

console.log(`\nSAMLAT: Engens exempel når prompten: ${engensOk ? "JA" : "NEJ"}`);
process.exit(engensOk ? 0 : 1);
