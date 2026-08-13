// AEO-teknikkontroll: släpper robots.txt in AI-sökmotorernas robotar?
//
// ★ HÅKANS FYND 13/8 (RAPPORT-1, beslut 3), och det är ett större kvalitetsfel än
//   tankstrecken: djupgranskningen av forbalance.se skrev ett helt AEO-avsnitt om att
//   synas i ChatGPT och Perplexity — medan sajtens egen robots.txt spärrar ut just de
//   robotarna med `Disallow: /`. Rapporten rekommenderade alltså något sajten aktivt
//   omöjliggör, och ingen kod fanns som kunde upptäcka det.
//
//   Mätt på forbalance.se: ~46 AI-crawlers i en gemensam grupp med `Disallow: /`, och
//   sist `User-agent: *` → `Allow: /`. Vanliga sökmotorer kommer alltså in, AI-motorerna
//   gör det inte. Det är nästan alltid webbplattformens standardinställning, inte ett
//   medvetet val av kunden — därför säger fyndet det, i stället för att skälla.
//
// Kontrollen är billig (robots.txt är redan hämtad) och deterministisk. Ingen modell
// tillfrågas: det här är regelmatchning, och regelmatchning ska inte gissas.

/** Robotarna som avgör om innehållet kan citeras av en AI-sökmotor. */
export const AI_ROBOTAR: { namn: string; agare: string; roll: string }[] = [
  { namn: "GPTBot", agare: "OpenAI", roll: "Tränar och indexerar för ChatGPT" },
  { namn: "OAI-SearchBot", agare: "OpenAI", roll: "Bygger ChatGPT:s sökindex" },
  { namn: "ChatGPT-User", agare: "OpenAI", roll: "Hämtar sidan när någon frågar ChatGPT om dig" },
  { namn: "ClaudeBot", agare: "Anthropic", roll: "Indexerar för Claude" },
  { namn: "anthropic-ai", agare: "Anthropic", roll: "Äldre namn på samma robot" },
  { namn: "Claude-Web", agare: "Anthropic", roll: "Hämtar sidan vid en fråga i Claude" },
  { namn: "PerplexityBot", agare: "Perplexity", roll: "Perplexity citerar källor direkt i svaret" },
  { namn: "Google-Extended", agare: "Google", roll: "Styr om Gemini och AI Overviews får använda innehållet" },
  { namn: "CCBot", agare: "Common Crawl", roll: "Öppen datamängd som många AI-modeller läser" },
  { namn: "Bytespider", agare: "ByteDance", roll: "TikToks AI-robot" },
  { namn: "Amazonbot", agare: "Amazon", roll: "Alexa och Amazons AI-svar" },
  { namn: "Applebot-Extended", agare: "Apple", roll: "Apple Intelligence och Siri" },
];

export interface AiRobotDom {
  namn: string;
  agare: string;
  roll: string;
  /** true = spärrad från hela eller delar av sajten. */
  blockerad: boolean;
  /** Regeln som fällde avgörandet, ordagrant ur robots.txt. */
  regel: string | null;
}

export interface AiRobotsDom {
  /** null = robots.txt kunde inte läsas. Då uttalar vi oss inte. */
  matt: boolean;
  robotar: AiRobotDom[];
  blockerade: string[];
  /** Gäller `User-agent: *` en spärr för alla? Då är det inte AI-specifikt. */
  allaBlockerade: boolean;
  /** Färdig rad till nulägestabellen, på svenska. */
  sammanfattning: string;
}

interface Grupp {
  agenter: string[];
  regler: { typ: "allow" | "disallow"; vag: string }[];
}

/**
 * Delar upp robots.txt i grupper. Flera `User-agent`-rader i följd delar samma regler,
 * vilket är exakt formen forbalance.se använder (46 agenter, ett `Disallow: /`).
 */
export function parsaGrupper(robotsTxt: string): Grupp[] {
  const grupper: Grupp[] = [];
  let aktuell: Grupp | null = null;
  let sisteVarAgent = false;

  for (const rad of robotsTxt.split(/\r?\n/)) {
    const ren = rad.replace(/#.*$/, "").trim();
    if (!ren) continue;
    const m = ren.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const nyckel = m[1].toLowerCase();
    const varde = m[2].trim();

    if (nyckel === "user-agent") {
      if (!aktuell || !sisteVarAgent) {
        aktuell = { agenter: [], regler: [] };
        grupper.push(aktuell);
      }
      aktuell.agenter.push(varde);
      sisteVarAgent = true;
      continue;
    }
    if (nyckel === "allow" || nyckel === "disallow") {
      if (!aktuell) continue; // regel utan grupp, ignoreras precis som robotarna gör
      aktuell.regler.push({ typ: nyckel, vag: varde });
      sisteVarAgent = false;
    }
  }
  return grupper;
}

/** Spärrar gruppens regler hela sajten? `Disallow: /` utan motsvarande `Allow: /`. */
function spärrarAllt(g: Grupp): boolean {
  const harDisallowRot = g.regler.some((r) => r.typ === "disallow" && r.vag === "/");
  const harAllowRot = g.regler.some((r) => r.typ === "allow" && r.vag === "/");
  return harDisallowRot && !harAllowRot;
}

/**
 * Klassar var och en av de kända AI-robotarna mot robots.txt.
 *
 * `null` in betyder att filen inte kunde läsas — då säger vi det, i stället för att
 * påstå att allt är tillåtet. Samma regel som resten av produkten: data som saknas är
 * inte data som säger nej.
 */
export function analyseraAiRobots(robotsTxt: string | null): AiRobotsDom {
  if (robotsTxt == null) {
    return {
      matt: false,
      robotar: [],
      blockerade: [],
      allaBlockerade: false,
      sammanfattning: "robots.txt kunde inte läsas, så vi vet inte om AI-robotarna släpps in.",
    };
  }

  const grupper = parsaGrupper(robotsTxt);
  const stjarna = grupper.find((g) => g.agenter.some((a) => a === "*"));
  const allaBlockerade = !!stjarna && spärrarAllt(stjarna);

  const robotar: AiRobotDom[] = AI_ROBOTAR.map((r) => {
    // Robotens egen grupp vinner över `*` — så fungerar robots.txt.
    const egen = grupper.find((g) => g.agenter.some((a) => a.toLowerCase() === r.namn.toLowerCase()));
    const grupp = egen ?? stjarna;
    if (!grupp) return { ...r, blockerad: false, regel: null };
    const blockerad = spärrarAllt(grupp);
    const regel = blockerad
      ? `User-agent: ${egen ? r.namn : "*"} → Disallow: /`
      : null;
    return { ...r, blockerad, regel };
  });

  const blockerade = robotar.filter((r) => r.blockerad).map((r) => r.namn);

  let sammanfattning: string;
  if (!blockerade.length) {
    sammanfattning = "AI-sökmotorernas robotar släpps in. Innehållet kan citeras av ChatGPT, Perplexity och Gemini.";
  } else if (allaBlockerade && blockerade.length === AI_ROBOTAR.length) {
    sammanfattning = `robots.txt spärrar ALLA robotar (Disallow: / för *). Då stängs även Google ute, inte bara AI-motorerna.`;
  } else {
    sammanfattning =
      `${blockerade.length} av ${AI_ROBOTAR.length} AI-robotar är spärrade i robots.txt: ${blockerade.join(", ")}. ` +
      `Innehållet kan alltså inte citeras av de tjänsterna, oavsett hur bra det är skrivet.`;
  }

  return { matt: true, robotar, blockerade, allaBlockerade, sammanfattning };
}

/**
 * Färdigt textblock till rapporten när robotar är spärrade. Deterministiskt: ingen modell
 * får formulera om ett tekniskt faktum, och en färdig rad kan klistras in som den är.
 */
export function aiRobotsAtgard(dom: AiRobotsDom): string | null {
  if (!dom.matt || !dom.blockerade.length) return null;
  const rader = dom.blockerade.map((n) => `User-agent: ${n}`).join("\n");
  return [
    `Ta bort spärren för dessa robotar i robots.txt, eller byt deras regel till Allow.`,
    ``,
    `Raderna som spärrar i dag:`,
    "```",
    rader,
    `Disallow: /`,
    "```",
    ``,
    `Så här ska det se ut i stället:`,
    "```",
    dom.blockerade.map((n) => `User-agent: ${n}`).join("\n"),
    `Allow: /`,
    "```",
    ``,
    `Spärren är oftast webbplattformens standardval och inte något du satt själv. Går den ` +
      `inte att redigera i din plattform är det ett supportärende hos leverantören, inte ` +
      `något du ska ändra i en fil.`,
  ].join("\n");
}
