// ROST-2 — röstfelet säger VAD som gick fel. Håkans fynd 2026-08-11.
//
// Han sa "Eva Andersson via LinkedIn" i Lägg till kontakt, fick "Kunde inte uppfatta rösten,
// försök igen", och frågade: "är det slut på tokens etc?"
//
// Det var INTE tokens. Kvot, betalning och kostnadstak har egna texter sedan 2026-08-01
// (ROST_TJANSTEFEL respektive spärrtexten från lib/ai-usage). Det han såg var raden för
// "inget användbart transkript" — och den slog ihop tre helt olika lägen:
//
//   tystnad → modellen svarade [INGET_TAL]: för kort klipp, för låg nivå, fel mikrofon.
//             Det HÄR kan användaren göra något åt.
//   eko     → modellen upprepade instruktionen. Internt fel.
//   tomt    → modellen svarade ingenting. Internt fel.
//
// Att säga "försök igen" när felet ligger hos oss får användaren att prata tydligare i
// onödan — och att undra över tokens. Frågan var alltså ett symptom på texten, inte på kvoten.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ROST_ORSAKSTEXT,
  ROST_TJANSTEFEL,
  TYSTNADS_MARKOR,
  rostOrsak,
  rensaTranskription,
} from "@/lib/ai/transkription";

const route = readFileSync(new URL("../app/api/ai/transcribe/route.ts", import.meta.url), "utf8");
const komp = readFileSync(new URL("../components/SmartTextarea.tsx", import.meta.url), "utf8");
const dm = readFileSync(new URL("../app/dashboard/(inlagg)/dm/page.tsx", import.meta.url), "utf8");

describe("ROST-2 · de tre lägena hålls isär", () => {
  it("tystnadsmarkören är tystnad", () => {
    expect(rostOrsak(TYSTNADS_MARKOR)).toBe("tystnad");
    expect(rostOrsak(`"${TYSTNADS_MARKOR}."`)).toBe("tystnad");
  });

  it("ett eko av instruktionen är eko, inte tystnad", () => {
    expect(rostOrsak("Transkribera detta tal på svenska, ordagrant men med korrekt interpunktion.")).toBe("eko");
  });

  it("tomt svar är tomt", () => {
    for (const t of ["", "   ", null, undefined, 42]) {
      expect(rostOrsak(t as unknown as string), String(t)).toBe("tomt");
    }
  });

  it("alla tre har en egen text, och bara tystnad ber användaren göra något", () => {
    expect(ROST_ORSAKSTEXT.tystnad).toContain("Håll knappen intryckt");
    expect(ROST_ORSAKSTEXT.tystnad).toContain("mikrofon");
    for (const orsak of ["eko", "tomt"] as const) {
      expect(ROST_ORSAKSTEXT[orsak], orsak).toContain("inget du har gjort");
    }
  });

  it("och ingen av dem antyder att kvoten tagit slut", () => {
    // Tjänstefelet är en EGEN text, och den ska inte blandas in i röstfelen.
    for (const t of Object.values(ROST_ORSAKSTEXT)) {
      expect(t, t).not.toBe(ROST_TJANSTEFEL);
      expect(t.toLowerCase(), t).not.toContain("kvot");
    }
  });
});

describe("ROST-2 · routen skickar orsaken vidare, och loggar råsvaret", () => {
  it("svaret bär orsaken", () => {
    expect(route).toContain("ROST_ORSAKSTEXT[orsak], orsak");
  });

  it("loggen innehåller orsak, längd OCH det modellen faktiskt svarade", () => {
    // Utan råsvaret i loggen går ett "underkänt transkript" inte att felsöka i efterhand.
    expect(route).toContain("orsak=${orsak}");
    expect(route).toContain("bytes=${buf.length}");
    expect(route).toContain('rått="${raa.slice(0, 120)}"');
  });

  it("kostnadsstoppet har fortfarande sin egen väg — 429, inte ett röstfel", () => {
    expect(route).toContain("if (svar.budgetstopp) return NextResponse.json({ error: svar.fel }, { status: 429 })");
  });

  it("betalning, nyckel och kvot ger tjänstefelet, inte 'försök igen'", () => {
    expect(route).toContain('svar.felklass === "billing"');
    expect(route).toContain("ROST_TJANSTEFEL");
  });
});

describe("ROST-2 · användaren ser hur lång inspelningen var", () => {
  it("längden läggs till när ljudet var kort OCH orsaken är tystnad", () => {
    expect(komp).toContain('d.orsak === "tystnad"');
    expect(komp).toContain("inspelningen var ${sekLangd} sekund");
  });

  it("men aldrig vid internt fel — där är längden brus", () => {
    expect(komp).toContain("sekLangd > 0 && sekLangd < 3");
  });

  it("längden läses av INNAN transkriberingen hinner nolla räknaren", () => {
    const i = komp.indexOf("const sekLangd = sekunder;");
    const j = komp.indexOf('fetch("/api/ai/transcribe"');
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(j);
  });
});

describe("ROST-2 · den släckta knappen säger varför", () => {
  it("skälet står som text, inte bara i en hover-titel", () => {
    // "Det går inte att lägga till" — knappen var släckt för att både namn och användarnamn
    // var tomma efter att dikteringen failat, och skälet syntes bara vid hovring.
    expect(dm).toContain("Fyll i namn eller användarnamn först");
    expect(dm).toContain("{!kanFortsatta && (");
  });

  it("regeln är oförändrad: namn ELLER användarnamn räcker", () => {
    expect(dm).toContain("const kanFortsatta = !!(namn.trim() || username.trim());");
  });
});

describe("ROST-2 · grinden mot påhitt och eko är orörd", () => {
  it("tystnadsmarkören släpps aldrig igenom som text", () => {
    expect(rensaTranskription(TYSTNADS_MARKOR)).toBeNull();
  });

  it("ett äkta kort transkript passerar — kortheten är inget fel i sig", () => {
    // Håkans mening är 26 tecken. Ingen minimilängd får fälla den.
    expect(rensaTranskription("Eva Andersson via LinkedIn")).toBe("Eva Andersson via LinkedIn");
  });
});
