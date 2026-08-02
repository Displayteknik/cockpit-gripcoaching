// BILD-8 DoD, felsökning: hur stabil är den teckenvisa avläsningen?
//
// Skarpt fall a8: affischen SÄGER "HÖSTENS NYHIETER". Grindens andra avläsning läste rätt
// ("NYHIETER" → fälldes), den tredje autokorrigerade till "NYHETER" och släppte igenom
// bilden. Provet svarar på två frågor innan något ändras:
//   1. Hjälper det att läsa om? (NEJ — framlänges autokorrigerar 4/4 på samma bild.)
//   2. Håller en BAKLÄNGES-avläsning? (JA — 4/4 gav NYHIETER. Språkpriorn kan inte städa
//      ett ord den inte känner igen som ord.)
// Steg 2 kontrollerar att baklängesläsningen inte SKAPAR fel på korrekta skyltar.
//
// Körning: npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/bild8-transkriptionsprov.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const KEY = process.env.GEMINI_API_KEY!;

const BILDER = (process.env.BILD8_PROV_BILDER || "a2-displayteknik,a4-displayteknik,a7-annas-blommor,a8-annas-blommor").split(",");

const FRAMLANGES =
  "Transkribera ALL text som syns i bilden (skyltar, skärmar, tavlor, affischer, etiketter) TECKEN FÖR TECKEN. " +
  "Separera varje tecken med mellanslag, varje ORD med | och varje radbrytning med /. " +
  "Autokorrigera INTE och gissa INTE — återge exakt de glyfer som syns, även om ordet blir felstavat eller obegripligt. " +
  "Svara ENDAST med sekvensen, eller INGEN om ingen text alls syns.";

const BAKLANGES =
  "Läs av all text i bilden (skyltar, skärmar, tavlor, affischer, etiketter). " +
  "Skriv ut varje ord BAKLÄNGES, sista bokstaven först, ett tecken i taget separerat med mellanslag. " +
  "Separera varje ORD med | och varje radbrytning med /. " +
  "Läs av de glyfer som FAKTISKT står där, en i taget — rätta inte stavningen och fyll inte i vad du tror att det borde stå. " +
  "Svara ENDAST med sekvensen, eller INGEN om ingen text alls syns.";

async function fraga(inline: { mimeType: string; data: string }, text: string): Promise<string> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: inline }, { text }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!r.ok) return `HTTP ${r.status}`;
  const d = await r.json();
  return (d?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text || "").trim().replace(/\s+/g, " ");
}

const vand = (s: string) => Array.from(s).reverse().join("");

for (const namn of BILDER) {
  const fil = path.join(ROOT, "docs/studio/bild8-exempel", `${namn}.png`);
  let data: string;
  try {
    data = readFileSync(fil).toString("base64");
  } catch {
    console.log(`\n## ${namn}: SAKNAS`);
    continue;
  }
  const inline = { mimeType: "image/png", data };
  console.log(`\n## ${namn}`);
  for (let i = 1; i <= 2; i++) console.log(`  framlänges ${i}: ${await fraga(inline, FRAMLANGES)}`);
  for (let i = 1; i <= 2; i++) {
    const svar = await fraga(inline, BAKLANGES);
    const vandTillbaka = svar
      .split(/[|/]/)
      .map((s) => vand(s.split(/\s+/).filter(Boolean).join("")))
      .filter(Boolean)
      .join(" ");
    console.log(`  baklänges ${i}: ${svar}`);
    console.log(`     → vänt tillbaka: ${vandTillbaka}`);
  }
}
