// KVALITET-3 / punkt 2 — skarp verifiering av idé-flödet.
//
// Kör idé-genereringen ("Ge mig 3 idéer") TRE gånger på SAMMA ämne för två tenants
// och redovisar per körning: antal idéer, antal genereringsrundor, beskrivningarna
// ordagrant, samt automatiska kontroller för kolonfragment och påhittade siffror.
//
// Skriver INGET i produktionstabellerna. iterateGenerate loggar agent_experiments per
// körning — de raderas och verifieras borta i slutet, precis som text1-batchen gör.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kvalitet3/punkt2-verifiering.mts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// CRLF-fällan: split('\n') lämnar \r i värdet → API svarar 401 trots giltig nyckel.
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));

const { supabaseService } = await import("@/lib/supabase-admin");
const { generateStudioCopyResultat, ideerMeddelande } = await import("@/lib/studio/copy");
const { hittaPrisuppgifter } = await import("@/lib/content/writing-rules");
const sb = supabaseService();

const TENANTS = [
  { slug: "displayteknik", namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000", industry: "Digital skyltning" },
  { slug: "engens-trad", namn: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001", industry: "Trädfällning & trädgårdstjänster" },
];

// SAMMA ämne för alla körningar och båda tenants. Valt för att fresta till exakt de
// fel punkt 2 handlar om: "lönar sig" drar mot återbetalningslöften ("betalar sig på
// tre månader"), och "vänta" drar mot ett påhittat kundscenario.
const AMNE = "Varför det lönar sig att göra jobbet nu i stället för att vänta";
const KORNINGAR = 3;

// Kolonfragment: en beskrivning som limmats ihop ur två delar syns som ett avslutat
// påstående följt av kolon ("aktuell?:", "gäster.:") eller som ett släpande kolon.
const KOLONFRAGMENT = /[.?!]\s*:|:\s*$/;
// Ordformslöften — samma familj som den deterministiska grinden i lib/studio/copy.ts.
const ORDLOFTEN = /\b(dubbelt|dubbla|hälften|halva\s+(tiden|priset|kostnaden)|(en|ett|två|tre|fyra|fem)\s+(gånger|ggr)|betalar\s+sig|tjänar\s+in\s+sig)\b/i;

const RUN_START = new Date().toISOString();
const UT_DIR = path.join(ROOT, "docs", "kvalitet3");
mkdirSync(UT_DIR, { recursive: true });
const rapport: Record<string, unknown>[] = [];
let allaGodkanda = true;

for (const t of TENANTS) {
  console.log(`\n=== ${t.namn} — ämne: "${AMNE}" ===`);
  for (let k = 1; k <= KORNINGAR; k++) {
    const t0 = Date.now();
    try {
      const r = await generateStudioCopyResultat({
        clientId: t.id,
        templateId: "ark-textkort",
        format: "1080x1350",
        topic: AMNE,
        brandName: t.namn,
        industry: t.industry,
      });

      const kolon = r.suggestions.filter((s) => KOLONFRAGMENT.test(s.beskrivning));
      const oavslutad = r.suggestions.filter((s) => !/[.!?…]$/.test(s.beskrivning.trim()));
      const hookIBeskrivning = r.suggestions.filter((s) => s.beskrivning.includes(s.headline1));
      const siffror = r.suggestions.filter((s) => /\d/.test(`${s.headline1} ${s.headline2} ${s.body}`));
      const priser = r.suggestions.flatMap((s) => hittaPrisuppgifter(`${s.headline1} ${s.headline2} ${s.body}`));
      const ordlofte = r.suggestions.filter((s) => ORDLOFTEN.test(`${s.headline1} ${s.headline2} ${s.body}`));

      const ok =
        r.levererat === r.begart &&
        kolon.length === 0 &&
        oavslutad.length === 0 &&
        hookIBeskrivning.length === 0 &&
        priser.length === 0 &&
        ordlofte.length === 0;
      if (!ok) allaGodkanda = false;

      console.log(`\n  Körning ${k}: ${r.levererat}/${r.begart} idéer, ${r.forsok} runda(or), ${Date.now() - t0} ms ${ok ? "OK" : "AVVIKELSE"}`);
      if (r.levererat < r.begart) console.log(`    UI-rad: "${ideerMeddelande(r.levererat, r.begart)}"`);
      r.suggestions.forEach((s, i) => {
        console.log(`    ${i + 1}. [${s.hookType}] ${s.headline1}`);
        console.log(`       beskrivning: ${s.beskrivning}`);
      });
      if (kolon.length) console.log(`    ⚠ kolonfragment: ${kolon.map((s) => s.beskrivning).join(" | ")}`);
      if (oavslutad.length) console.log(`    ⚠ oavslutad mening: ${oavslutad.map((s) => s.beskrivning).join(" | ")}`);
      if (hookIBeskrivning.length) console.log(`    ⚠ hooken upprepas i beskrivningen`);
      if (siffror.length) console.log(`    · siffror i texten (backade mot profilen): ${siffror.map((s) => s.body).join(" | ")}`);
      if (priser.length) console.log(`    ⚠ prisuppgift: ${priser.join(", ")}`);
      if (ordlofte.length) console.log(`    ⚠ kvantifierat löfte i ordform: ${ordlofte.map((s) => s.body).join(" | ")}`);

      rapport.push({
        tenant: t.namn,
        korning: k,
        amne: AMNE,
        begart: r.begart,
        levererat: r.levererat,
        forsok: r.forsok,
        ms: Date.now() - t0,
        godkand: ok,
        idéer: r.suggestions,
        avvikelser: {
          kolonfragment: kolon.map((s) => s.beskrivning),
          oavslutad: oavslutad.map((s) => s.beskrivning),
          hook_upprepad: hookIBeskrivning.map((s) => s.beskrivning),
          priser,
          ordlofte: ordlofte.map((s) => s.body),
        },
      });
    } catch (e) {
      allaGodkanda = false;
      console.log(`  Körning ${k}: FEL ${(e as Error).message?.slice(0, 200)}`);
      rapport.push({ tenant: t.namn, korning: k, fel: (e as Error).message });
    }
  }
}

const fil = path.join(UT_DIR, "punkt2-verifiering.json");
writeFileSync(fil, JSON.stringify({ amne: AMNE, korningar: KORNINGAR, kord: RUN_START, godkand: allaGodkanda, rapport }, null, 2));
console.log(`\n→ ${fil}`);

// Städ: iterateGenerate loggar agent_experiments per körning — radera det som skapades nu.
const { data: exp } = await sb
  .from("agent_experiments")
  .delete()
  .in("client_id", TENANTS.map((t) => t.id))
  .gte("created_at", RUN_START)
  .select("id");
console.log(`Städat agent_experiments: ${exp?.length ?? 0} rader raderade.`);
const { data: kvar } = await sb
  .from("agent_experiments")
  .select("id")
  .in("client_id", TENANTS.map((t) => t.id))
  .gte("created_at", RUN_START);
console.log(`Verifiering: ${kvar?.length ?? 0} rader kvar (ska vara 0).`);
console.log(allaGodkanda ? "KLART — alla körningar godkända." : "KLART — avvikelser finns, se ovan.");
