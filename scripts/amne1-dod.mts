// ÄMNE-1, DoD — Håkans EXAKTA fall, mot koden EFTER fixen.
//
// 1. Kvarlämnat Ämne (sensommar/skyltning) + skapad bild om menyskärm → alla tre
//    varianter ska handla om menyskärmen.
// 2. "Skriv om" på samma inlägg → ämnet består (nu även när caption redan finns).
// 3. Tomt inlägg → inget fel.
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
const { harledAmnesblock } = await import("../lib/content/amneskalla");

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const HEADLINE = "Fler stannar när de vet vad du serverar";
const BODY = "En skärm för din meny, det lockar in din kund";
const STALE_TOPIC = "Synlighet i sensommaren — skyltar som fortfarande syns i augustisolen";

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

const ANGLAR = [
  { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag." },
  { angle: "Påstående", instruktion: "Öppna med ett djärvt, konkret PÅSTÅENDE (en sanning eller en vanlig myt du motbevisar)." },
  { angle: "Berättelse", instruktion: "Öppna med en kort BERÄTTELSE/scen ur igenkänning, utan uppfunnen huvudperson." },
];

async function korTreVarianter(underlagRader: string[], anvandarText: string) {
  const bygg = await byggTextPrompt({
    clientId, syfte: "caption", kanal: "instagram", uppdrag,
    underlag: [...underlagRader, "\nSkriv captionen nu — strukturerad enligt reglerna."].join("\n"),
    anvandarText,
  });
  const ut: string[] = [];
  for (let i = 0; i < 3; i++) {
    const vag = ctaVagForVariant(i, bygg.meta.funnel);
    const ton = tonForVariant(i, []);
    const vinkel = vinkelMedVag(ANGLAR[i].instruktion, vag, perspektivForVariant(i), tonInstruktion(ton));
    const prompt = `${bygg.user}\n\n=== KROK-VINKEL ===\n${vinkel}`;
    const svar = await generateWithUsage({
      model: "gemini-2.5-flash", systemInstruction: bygg.system, prompt,
      temperature: 0.9, maxOutputTokens: 500, skrivregler: false,
    });
    ut.push(await saneraText(svar.text.trim(), clientId));
  }
  return ut;
}

// ── 1. Håkans exakta fall: kvarlämnat ämne + menyskärmen han faktiskt skapade ──────
console.log("1. KVARLÄMNAT ÄMNE + SKAPAD BILD, EXAKT HÅKANS FALL\n");
const amne1 = harledAmnesblock({ headline: HEADLINE, body: BODY, topic: STALE_TOPIC });
kontroll(amne1.kalla === "bild", `ämneskälla = bild, inte ämnesfält (fick: ${amne1.kalla})`);
kontroll(!amne1.block.toLowerCase().includes("sensommar") && !amne1.block.toLowerCase().includes("augustisol"),
  "det kvarlämnade ämnet finns inte kvar i prompten");

const varianter1 = await korTreVarianter([amne1.block], STALE_TOPIC);
for (let i = 0; i < 3; i++) {
  console.log(`── ${ANGLAR[i].angle} ──\n${varianter1[i]}\n`);
  const paMeny = /meny|servera/i.test(varianter1[i]);
  const domineratAvSasong = varianter1[i].toLowerCase().indexOf("augustisol") === 0
    || varianter1[i].toLowerCase().indexOf("sensommar") === 0;
  kontroll(paMeny, `${ANGLAR[i].angle}: nämner menyskärmen`);
  kontroll(!domineratAvSasong, `${ANGLAR[i].angle}: öppnar inte med det kvarlämnade ämnet`);
}

// ── 2. "Skriv om" — ämnet består när caption redan finns ───────────────────────────
console.log("\n2. \"SKRIV OM\" PÅ SAMMA INLÄGG — ÄMNET SKA BESTÅ\n");
const forstaCaption = varianter1[0];
const amne2 = harledAmnesblock({ caption: forstaCaption, headline: HEADLINE, body: BODY, topic: STALE_TOPIC });
kontroll(amne2.kalla === "inlaggstext", `"Skriv om" använder den redan skrivna texten som källa (fick: ${amne2.kalla})`);
const [omskriven] = await korTreVarianter([amne2.block], STALE_TOPIC);
console.log(`Omskriven:\n${omskriven}\n`);
kontroll(/meny|servera/i.test(omskriven), "den omskrivna texten handlar fortfarande om menyskärmen");

// ── 3. Tomt inlägg — inget fel ──────────────────────────────────────────────────────
console.log("\n3. TOMT INLÄGG — INGET FEL\n");
const amne3 = harledAmnesblock({});
kontroll(amne3.kalla === "tomt" && amne3.block === "", "tomt inlägg ger tomt block, ingen krasch i sig");
try {
  const bygg = await byggTextPrompt({
    clientId, syfte: "caption", kanal: "instagram", uppdrag,
    underlag: ["\nSkriv captionen nu — strukturerad enligt reglerna."].join("\n"),
  });
  const svar = await generateWithUsage({
    model: "gemini-2.5-flash", systemInstruction: bygg.system, prompt: bygg.user,
    temperature: 0.9, maxOutputTokens: 400, skrivregler: false,
  });
  const text = await saneraText(svar.text.trim(), clientId);
  console.log(`Tomt inlägg, resultat:\n${text}\n`);
  kontroll(text.trim().length > 0, "genereringen gav en text, inget fel/krasch");
} catch (e) {
  kontroll(false, `tomt inlägg kastade fel: ${(e as Error).message}`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
