// ÄMNE-1, orsaksanalys steg 2: samma reproduktion, men med "Förslag för dagen"
// (Content Compass) förifyllt precis som profileForDate gör på en AKTIV dag
// (t.ex. tisdag: four_a=analytical, funnel=tofu, disc=[D]). Testar om 4A-strukturmallens
// ofyllda "[område]"-platshållare är den mekanism som får ALLA tre varianter att byta ämne,
// inte bara låta säsongen färga tonen (som i första reproduktionen).
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: dt } = await sb.from("clients").select("id, name").eq("slug", "displayteknik").maybeSingle();
const clientId = (dt as any).id as string;

const { byggTextPrompt, saneraText } = await import("../lib/prompt-core");
const { generateWithUsage } = await import("../lib/gemini");
const { ctaVagForVariant, perspektivForVariant, vinkelMedVag } = await import("../lib/cta-vagar");
const { tonForVariant, tonInstruktion } = await import("../lib/ton-varianter");
const { contentCompassBlock } = await import("../lib/content-compass/prompt");

const HEADLINE = "Fler stannar när de vet vad du serverar";
const BODY = "En skärm för din meny, det lockar in din kund";

// Tisdagens riktiga schema hos Displayteknik — "Förslag för dagen" på en AKTIV dag.
const compass = { funnel: "tofu" as const, four_a: "analytical" as const, disc: ["D"] as const };

const uppdrag = [
  `Du skriver bildtexten (captionen) till ett inlägg med bild (Instagram/Facebook) för ${(dt as any).name}.`,
  "Detta är texten man LÄSER under/bredvid inlägget — inte text på bilden. Skriv som en människa, varmt och konkret.",
  "\n=== KANAL & LÄNGD ===",
  "- 1–2 korta stycken som ger konkret värde/berättelse. Radbryt för luft.",
  "- 3–5 relevanta hashtags på egen rad sist.",
  "\n=== SPRÅK ===",
  "- Svenska tecken å/ä/ö korrekt. FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
  "- Returnera ENDAST själva captionen, ingen förklaring.",
].join("\n");

const contentBlock = [`Rubrik på bilden: ${HEADLINE}.`, `Text på bilden: ${BODY}.`].join("\n");

// A/B-läget: 4A/funnel delas (gemensamt för alla varianter), bara DISC lyfts ur.
const compassForPrompt = { ...compass, disc: [] };

console.log("=== Content Compass-blocket som injiceras i systemprompten ===\n");
console.log(contentCompassBlock(compassForPrompt));
console.log("");

const bygg = await byggTextPrompt({
  clientId,
  syfte: "caption",
  kanal: "instagram",
  uppdrag,
  underlag: [contentBlock, "\nSkriv captionen nu — strukturerad enligt reglerna."].join("\n"),
  compass: compassForPrompt,
});

const ANGLAR = [
  { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag." },
  { angle: "Påstående", instruktion: "Öppna med ett djärvt, konkret PÅSTÅENDE (en sanning eller en vanlig myt du motbevisar)." },
  { angle: "Berättelse", instruktion: "Öppna med en kort BERÄTTELSE/scen ur igenkänning, utan uppfunnen huvudperson." },
];

console.log("=== TRE VARIANTER, MED FÖRSLAG FÖR DAGEN (tisdag: analytical/tofu/D) FÖRIFYLLT ===\n");
for (let i = 0; i < 3; i++) {
  const vag = ctaVagForVariant(i, bygg.meta.funnel);
  const ton = tonForVariant(i, ["D"] as any);
  const vinkel = vinkelMedVag(ANGLAR[i].instruktion, vag, perspektivForVariant(i), tonInstruktion(ton));
  const prompt = `${bygg.user}\n\n=== KROK-VINKEL ===\n${vinkel}`;
  const svar = await generateWithUsage({
    model: "gemini-2.5-flash", systemInstruction: bygg.system, prompt,
    temperature: 0.9, maxOutputTokens: 500, skrivregler: false,
  });
  const text = await saneraText(svar.text.trim(), clientId);
  console.log(`── ${ANGLAR[i].angle} (${vag.namn}/${ton}) ──`);
  console.log(text);
  console.log("");
}
