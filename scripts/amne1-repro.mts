// ÄMNE-1, orsaksanalys: reproducera Håkans skarpfynd EXAKT, innan någon fix byggs.
//
// Flödet han beskriver: Cockpits förslag om menyskärm ("Fler stannar när de vet vad du
// serverar. En skärm för din meny, det lockar in din kund.") togs emot av applySuggestion
// (StudioMaker.tsx:802) — den sätter headline1/headline2/body men RÖR ALDRIG `topic`.
// Ämnesfältet (steg 1) står alltså tomt hela vägen till steg 5, precis som i skarp
// användning om han inte skrev något eget ämne. Detta skript bygger EXAKT samma anrop som
// /api/studio/suggest-caption gör, med topic="" och headline/body ur hans citat, mot
// Displaytekniks riktiga profil, och kör alla tre A/B-varianter.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: dt } = await sb.from("clients").select("id, name").eq("slug", "displayteknik").maybeSingle();
if (!dt) throw new Error("hittade inte Displayteknik");
const clientId = (dt as any).id as string;

const { byggTextPrompt, saneraText } = await import("../lib/prompt-core");
const { generateWithUsage } = await import("../lib/gemini");
const { ctaVagForVariant, perspektivForVariant, vinkelMedVag } = await import("../lib/cta-vagar");
const { tonForVariant, tonInstruktion } = await import("../lib/ton-varianter");

const HEADLINE = "Fler stannar när de vet vad du serverar";
const BODY = "En skärm för din meny, det lockar in din kund";
const TOPIC = ""; // ämnesfältet — orört av applySuggestion, precis som i skarp drift

const uppdrag = [
  `Du skriver bildtexten (captionen) till ett inlägg med bild (Instagram/Facebook) för ${(dt as any).name}.`,
  "Detta är texten man LÄSER under/bredvid inlägget — inte text på bilden. Skriv som en människa, varmt och konkret.",
  "\n=== KANAL & LÄNGD ===",
  "- 1–2 korta stycken som ger konkret värde/berättelse. Radbryt för luft.",
  "- 3–5 relevanta hashtags på egen rad sist.",
  "\n=== SPRÅK ===",
  "- Svenska tecken å/ä/ö korrekt. Naturligt, mänskligt språk. Emoji sparsamt (0–2), bara om det passar rösten.",
  "- FÖRBJUDNA ord: kraftfull, banbrytande, game-changer, handlar om, nästa nivå, holistisk, skalbar.",
  "- Inga telefonnummer/URL:er. Returnera ENDAST själva captionen (med radbrytningar), ingen förklaring.",
].join("\n");

const contentBlock = [`Rubrik på bilden: ${HEADLINE}.`, `Text på bilden: ${BODY}.`].join("\n");

const bygg = await byggTextPrompt({
  clientId,
  syfte: "caption",
  kanal: "instagram",
  uppdrag,
  underlag: [TOPIC ? `Ämne: ${TOPIC}.` : "", contentBlock, "\nSkriv captionen nu — strukturerad enligt reglerna."].filter(Boolean).join("\n"),
  anvandarText: TOPIC,
});

console.log("═══ SYSTEMPROMPTENS FÖRSTA 700 TECKEN (visar var säsongsraden ligger) ═══\n");
console.log(bygg.system.slice(0, 700));
console.log("\n═══ HELA USER-MEDDELANDET (det enda stället menyskärmen nämns) ═══\n");
console.log(bygg.user);
console.log(`\nsystem: ${bygg.system.length} tecken   user: ${bygg.user.length} tecken   (kvot ${(bygg.system.length / bygg.user.length).toFixed(0)}:1)\n`);

writeFileSync(path.join(ROOT, "scripts", "_amne1-system.txt"), bygg.system, "utf8");
writeFileSync(path.join(ROOT, "scripts", "_amne1-user.txt"), bygg.user, "utf8");

const ANGLAR = [
  { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag." },
  { angle: "Påstående", instruktion: "Öppna med ett djärvt, konkret PÅSTÅENDE (en sanning eller en vanlig myt du motbevisar)." },
  { angle: "Berättelse", instruktion: "Öppna med en kort BERÄTTELSE/scen hämtad ENBART ur varumärkesprofilens story-bank, alltså händelser som faktiskt inträffat. Saknas story-bank: öppna med en generell igenkänningsscen utan huvudperson." },
];

console.log("═══ TRE VARIANTER, EXAKT SOM SUGGEST-CAPTION GENERERAR DEM ═══\n");
for (let i = 0; i < 3; i++) {
  const vag = ctaVagForVariant(i, bygg.meta.funnel);
  const ton = tonForVariant(i, []);
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
