// ÄMNE-1 — bevis i ANNAN tenant än DT (For Balance), enligt tillägget "GILTIGHET ALLA
// TENANTS": kontraktet ligger i kedjan/prompt-core, inte per tenant. DT var testfallet,
// inte målet.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: fb } = await sb.from("clients").select("id, name").eq("slug", "forbalance").maybeSingle();
const clientId = (fb as any).id as string;

const { byggTextPrompt, saneraText } = await import("../lib/prompt-core");
const { generateWithUsage } = await import("../lib/gemini");
const { ctaVagForVariant, perspektivForVariant, vinkelMedVag } = await import("../lib/cta-vagar");
const { tonForVariant, tonInstruktion } = await import("../lib/ton-varianter");
const { harledAmnesblock } = await import("../lib/content/amneskalla");

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

// Riktigt innehåll in — ett eget inlägg om stresshantering/balans i vardagen.
const HEADLINE = "Andas ut";
const BODY = "Fem minuter om dagen kan sänka din stressnivå mätbart";
// Helt osläkt kvarlämnat ämne (sommarrea-tema), inget med stresshantering att göra.
const STALE_TOPIC = "Stor sommarrea denna vecka — passa på att fynda innan lagret tar slut";

const uppdrag = [
  `Du skriver bildtexten (captionen) till ett inlägg med bild (Instagram/Facebook) för ${(fb as any).name}.`,
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

console.log(`ÄMNESKONTRAKTET I ANNAN TENANT: ${(fb as any).name}\n`);
const amne = harledAmnesblock({ headline: HEADLINE, body: BODY, topic: STALE_TOPIC });
kontroll(amne.kalla === "bild", `ämneskälla = bild (steg 4-fälten), inte ämnesfält (fick: ${amne.kalla})`);
kontroll(!amne.block.toLowerCase().includes("rea") && !amne.block.toLowerCase().includes("fynda"),
  "det kvarlämnade (osläkta) ämnet finns inte kvar i prompten");

const varianter = await korTreVarianter([amne.block], STALE_TOPIC);
for (let i = 0; i < 3; i++) {
  console.log(`── ${ANGLAR[i].angle} ──\n${varianter[i]}\n`);
  const paStress = /stress|andas|lugn|ro\b|minuter/i.test(varianter[i]);
  const leckerRea = /\brea\b|fynda|lagret/i.test(varianter[i]);
  kontroll(paStress, `${ANGLAR[i].angle}: nämner stresshantering/andning-ämnet`);
  kontroll(!leckerRea, `${ANGLAR[i].angle}: inget läckage av det osläkta rea-ämnet`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
