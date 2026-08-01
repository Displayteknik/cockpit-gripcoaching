// PROFIL-1/F1 — verifiering (READ ONLY, inga skrivningar, ingen AI).
// Bygger lager 3 exakt som prompt-core gör (getProfileAsMarkdown medVoice:false +
// klippProfil vid taket) för de fyra skarpa profilerna och svarar på:
//   1. Kommer differentiators/services/pricing_notes/booking_url med i profiltexten?
//   2. Överlever DT:s riktiga priser klipptaket (dvs. står de INTE i profilKlippt)?
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/profil1/f1-verifiera.mts

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

const { getProfileAsMarkdown } = await import("@/lib/knowledge");
const { klippProfil } = await import("@/lib/prompt-core");
const { supabaseService } = await import("@/lib/supabase-admin");
const sb = supabaseService();

const PROFILER = [
  { namn: "Displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" },
  { namn: "Engens Träd & Trädgård", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001" },
  { namn: "HM Motor Krokom", id: "00000000-0000-0000-0000-000000000001" },
  { namn: "Annas Blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e" },
];

const NYA = [
  "## Differentiering",
  "## Erbjudande: tjänster och produkter",
  "## Erbjudande: priser (verifierade siffror)",
  "## Erbjudande: CTA-väg (bokningslänk)",
];

function siffrorMedEnhet(text: string): string[] {
  const m = text.match(/\d[\d\s.,]*\s*(kr|kronor|%|år|st|mm|cm|m²|m2|nits|tim|min|dagar|veckor|månader)\b/gi);
  return Array.from(new Set((m || []).map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())));
}

let allaOk = true;

for (const p of PROFILER) {
  const { data: rad } = await sb
    .from("hm_brand_profile")
    .select("differentiators, services, pricing_notes, booking_url")
    .eq("client_id", p.id)
    .maybeSingle();

  const raa = await getProfileAsMarkdown(p.id, { medVoice: false });
  const klipp = klippProfil(raa, 11000);

  console.log(`\n=== ${p.namn} ===`);
  console.log(`profil: ${raa.length} tecken → efter klipp ${klipp.text.length} (tak 11000)`);
  console.log(`klippta sektioner: ${klipp.klippta.length ? klipp.klippta.join(" → ") : "inga"}`);

  for (const rubrik of NYA) {
    const falt = { "## Differentiering": "differentiators", "## Erbjudande: tjänster och produkter": "services", "## Erbjudande: priser (verifierade siffror)": "pricing_notes", "## Erbjudande: CTA-väg (bokningslänk)": "booking_url" }[rubrik] as keyof typeof rad;
    const harData = !!(rad?.[falt] && String(rad[falt]).trim());
    const iRaa = raa.includes(rubrik);
    const iKlippt = klipp.text.includes(rubrik);
    if (!harData) {
      console.log(`  ${rubrik}: (tomt fält i DB — hoppas)`);
      continue;
    }
    const status = iRaa && iKlippt ? "OK" : iRaa ? "KLIPPT BORT" : "SAKNAS I LAGER 3";
    if (status !== "OK") allaOk = false;
    console.log(`  ${rubrik}: ${status}`);
  }

  // Prisverifiering: varje siffra med enhet ur pricing_notes ska finnas i den klippta texten.
  const priser = rad?.pricing_notes ? siffrorMedEnhet(String(rad.pricing_notes)) : [];
  if (priser.length) {
    const kvar = priser.filter((s) => klipp.text.toLowerCase().includes(s));
    const ok = kvar.length === priser.length;
    if (!ok) allaOk = false;
    console.log(`  priser med enhet i pricing_notes: ${priser.length} — kvar efter klipp: ${kvar.length} ${ok ? "OK" : "FEL"}`);
    console.log(`  exempel: ${priser.slice(0, 6).join(" | ")}`);
  }
}

console.log(`\nSAMLAT: ${allaOk ? "OK — alla ifyllda fält når lager 3 och överlever klipptaket" : "FEL — se raderna ovan"}`);
process.exit(allaOk ? 0 : 1);
