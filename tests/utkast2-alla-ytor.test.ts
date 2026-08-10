// UTKAST-2 — klientbytet tömmer ALLA skapar-ytor, inte bara Studio.
//
// Håkans fynd 10/8, i skarp drift: han stod på AluCon men såg tre textförslag om skyltar
// och solljus — Displaytekniks innehåll. Orsak: `useUtkast` läste den nya klientens utkast
// och returnerade direkt när det saknades, utan att tömma ytan. Förra klientens texter stod
// kvar under den nya klientens namn. Ingen data läcker mellan konton (allt är byråvyn), men
// nästa klick kunde ha publicerat fel kunds text i rätt kunds kanal.
//
// Studio fick `nollstall` samma kväll. Nyhetsbrev, reels, veckoplan och blogg hade kvar
// samma brist — det är den luckan detta testet stänger.
//
// Det här är en GRIND, inte en åsikt: den läser källkoden och HITTAR ytorna själv. En ny
// skapar-yta som glömmer tömningen fäller testet i stället för att nå en kund.
//
// ⚠ Grinden bevisar INKOPPLINGEN. Att tömningen fungerar bevisas av
// `tests/utkast-livscykel.test.ts`, som kör hooken skarpt: byte → ytan töms,
// första laddningen → aldrig.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";

const ROT = new URL("../", import.meta.url);
const MAPPAR = ["app", "components", "lib"];

/** Alla .ts/.tsx-filer under mapparna ovan. */
function allaKallfiler(): string[] {
  const ut: string[] = [];
  const ga = (rel: string) => {
    for (const post of readdirSync(new URL(rel, ROT))) {
      if (post === "node_modules" || post.startsWith(".")) continue;
      const barn = `${rel}/${post}`;
      if (statSync(new URL(barn, ROT)).isDirectory()) ga(barn);
      else if (/\.tsx?$/.test(post)) ut.push(barn);
    }
  };
  for (const m of MAPPAR) ga(m);
  return ut;
}

/**
 * Plockar ut argumentobjektet i varje `useUtkast<...>({ ... })`, med parentesmatchning —
 * en regex hade brutits av det första objektet inuti (payload, channelCaptions …).
 */
function utkastAnrop(kod: string): string[] {
  const ut: string[] = [];
  for (let i = kod.indexOf("useUtkast<"); i !== -1; i = kod.indexOf("useUtkast<", i + 1)) {
    const start = kod.indexOf("(", i);
    if (start === -1) continue;
    let djup = 0;
    for (let j = start; j < kod.length; j++) {
      if (kod[j] === "(") djup++;
      else if (kod[j] === ")") {
        djup--;
        if (djup === 0) { ut.push(kod.slice(start, j + 1)); break; }
      }
    }
  }
  return ut;
}

/**
 * Fälten i ytans `utkast`-objekt: `() => ({ theme, response, startDate, scheduleAll })`.
 * Läses ur samma memo som skickas till hooken, så listan kan aldrig bli inaktuell.
 */
function utkastFalt(kod: string, anrop: string): string[] {
  const variabel = /data:\s*([A-Za-z0-9_]+)/.exec(anrop)?.[1];
  if (!variabel) return [];
  const memo = new RegExp(`const ${variabel} = useMemo\\(\\s*\\(\\) => \\(\\{([^}]*)\\}`).exec(kod)?.[1];
  if (!memo) return [];
  return memo
    .split(",")
    .map((d) => d.split(":")[0].trim())
    .filter((d) => /^[A-Za-z0-9_]+$/.test(d));
}

/**
 * Fält som med FLIT står kvar vid ett klientbyte, med skälet utskrivet. Ett undantag utan
 * skäl är en tyst lucka — därför bär listan text, inte bara namn.
 */
const UNDANTAG: Record<string, Record<string, string>> = {
  nyhetsbrev: { pasteMode: "Val av arbetssätt (klistra in text vs välj blogginlägg), inte kundens innehåll" },
  reels: { templateKey: "Vald mall är ett arbetsläge; den bär ingen text från förra klienten" },
  veckoplan: {
    startDate: "Startdatum för schemaläggningen — en inställning, samma vecka gäller nästa kund",
    scheduleAll: "Reglaget schemalägg/spara direkt är ett arbetssätt, inte innehåll",
  },
  blogg: { wordCount: "Önskad artikellängd är en inställning, inte kundens text" },
};

const YTOR = allaKallfiler()
  .filter((f) => f !== "lib/studio/useUtkast.ts")
  .map((fil) => ({ fil, kod: readFileSync(new URL(fil, ROT), "utf8") }))
  .flatMap(({ fil, kod }) => utkastAnrop(kod).map((anrop) => ({ fil, kod, anrop })));

describe("UTKAST-2 · varje skapar-yta töms vid klientbyte", () => {
  it("alla fem kända ytor hittas — annars mäter grinden ingenting", () => {
    // Studio, nyhetsbrev, reels, veckoplan, blogg. Fler är bra; färre betyder att
    // filsökningen slutat träffa och att resten av testerna nedan är tomma löften.
    expect(YTOR.length).toBeGreaterThanOrEqual(5);
  });

  it("varje yta namnger sin egen ruta (yta: \"…\") — nyckeln får aldrig delas", () => {
    const namn = YTOR.map((y) => /yta:\s*"([^"]+)"/.exec(y.anrop)?.[1]).filter(Boolean);
    expect(namn.length).toBe(YTOR.length);
    expect(new Set(namn).size, `Två ytor delar samma utkastnamn: ${namn.join(", ")}`).toBe(namn.length);
  });

  for (const { fil, kod, anrop } of YTOR) {
    const yta = /yta:\s*"([^"]+)"/.exec(anrop)?.[1] ?? fil;

    it(`${yta} (${fil}) skickar en tömningsfunktion till hooken`, () => {
      expect(anrop, `${fil} saknar nollstall — förra klientens texter står kvar vid byte`).toMatch(/nollstall\s*:/);
    });

    it(`${yta} (${fil}) tömmer ytan via SAMMA funktion som "Börja om"`, () => {
      // Två listor som ska hålla samma sak isär glider isär. En källa, två anropare.
      const namn = /nollstall\s*:\s*([A-Za-z0-9_]+)/.exec(anrop)?.[1];
      expect(namn, `${fil}: nollstall ska peka på en namngiven funktion, inte en inline-callback`).toBeTruthy();
      const borjaOm = /const borjaOm = useCallback\(\(\) => \{([\s\S]*?)\}, \[/.exec(kod)?.[1];
      expect(borjaOm, `${fil}: hittade ingen borjaOm att jämföra med`).toBeTruthy();
      expect(borjaOm, `${fil}: "Börja om" tömmer inte ytan via ${namn}()`).toContain(`${namn}()`);
    });

    it(`${yta} (${fil}) — fältlistan går att läsa ur källan`, () => {
      // Utan den här raden kunde nästa test bli grönt av att listan var TOM: en trasig
      // läsning hade sett ut som "inget fält glömdes". Samma ihåliga grönt som G-5:s
      // första DoD, och det får inte hända igen.
      expect(utkastFalt(kod, anrop).length, `${fil}: hittade inga utkastfält att kontrollera`).toBeGreaterThanOrEqual(4);
    });

    it(`${yta} (${fil}) tömmer VARJE fält som utkastet bär`, () => {
      // Nästa lucka är inte en glömd inkoppling — den är ett fält som tömningen missar.
      // Bär utkastet fältet är det förra klientens innehåll, och då måste det bort.
      const namn = /nollstall\s*:\s*([A-Za-z0-9_]+)/.exec(anrop)![1];
      const kropp = new RegExp(`const ${namn} = useCallback\\(\\(\\) => \\{([\\s\\S]*?)\\}, \\[`).exec(kod)?.[1];
      expect(kropp, `${fil}: hittade ingen kropp för ${namn}`).toBeTruthy();

      const glomda = utkastFalt(kod, anrop).filter((falt) => {
        if (UNDANTAG[yta]?.[falt]) return false; // medvetet kvar, med skäl
        const setter = `set${falt[0].toUpperCase()}${falt.slice(1)}`;
        // Inget eget state → fältet är härlett (Studios `payload`) och töms via sina delar.
        if (!new RegExp(`\\[\\s*${falt}\\s*,\\s*${setter}\\s*\\]`).test(kod)) return false;
        return !kropp!.includes(`${setter}(`);
      });
      expect(glomda, `${fil}: ${namn} lämnar kvar ${glomda.join(", ")} från förra klienten`).toEqual([]);
    });
  }
});
