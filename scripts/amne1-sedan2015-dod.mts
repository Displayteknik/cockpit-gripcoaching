// ÄMNE-1, Fall 2 (16/8) — "Sedan 2015"-inlägget, det andra bekräftade fallet från 15/8
// som INTE täcktes av amne1-dod.mts (den körde bara menyskärms-fallet).
//
// Rekonstruerat kvarlämnat ämne: dagens exakta sträng från 15/8 är inte sparad, så detta
// är EN trolig kandidat som skulle ge samma symptom (sommarsol/uppmärksamhet-i-sekunder/
// vet-inte-var-man-ska-börja) om felet fortfarande fanns — inte ett påstående om att det
// är exakt samma sträng. Det som faktiskt bevisas är att BODY/HEADLINE (den riktiga texten,
// ordagrant citerad i dagens beställning) vinner över ett osläkt kvarlämnat ämne.
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

// Håkans exakta ordalydelse ur dagens beställning.
const HEADLINE = "Sedan 2015";
const BODY = "Vi levererar fortfarande digitala skärmar som syns i solljus och fungerar år efter år";
// Rekonstruerad kandidat för det kvarlämnade ämnet (se kommentaren ovan) — ett ämne om
// snabb uppmärksamhet i sommarsol, inte alls om erfarenhet/hållbarhet.
const STALE_TOPIC = "Fånga uppmärksamheten på sekunder i sommarsolen — så vet kunden var den ska börja";

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
  { angle: "Fråga", instruktion: "Öppna med en rak, nyfiken FRÅGA som träffar målgruppens vardag, i stil med 'hur många skyltar har du bytt sedan 2015?'." },
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

console.log("FALL 2: \"SEDAN 2015\" — KVARLÄMNAT ÄMNE OM SOMMARSOL/SNABB UPPMÄRKSAMHET\n");
const amne = harledAmnesblock({ headline: HEADLINE, body: BODY, topic: STALE_TOPIC });
kontroll(amne.kalla === "bild", `ämneskälla = bild (steg 4-fälten), inte ämnesfält (fick: ${amne.kalla})`);
kontroll(!amne.block.toLowerCase().includes("sommarsolen") && !amne.block.toLowerCase().includes("sekunder"),
  "det kvarlämnade ämnet finns inte kvar i prompten");

const varianter = await korTreVarianter([amne.block], STALE_TOPIC);
for (let i = 0; i < 3; i++) {
  console.log(`── ${ANGLAR[i].angle} ──\n${varianter[i]}\n`);
  const paErfarenhetHallbarhet = /2015|år efter år|hållbar|håller|erfarenhet|sol(ljus)?/i.test(varianter[i]);
  const oppnarMedStaleTopic = /^(fånga|sekunder|sommarsol)/i.test(varianter[i].trim());
  kontroll(paErfarenhetHallbarhet, `${ANGLAR[i].angle}: nämner erfarenhet/hållbarhet/2015-vinkeln`);
  kontroll(!oppnarMedStaleTopic, `${ANGLAR[i].angle}: öppnar inte med det kvarlämnade ämnet`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
