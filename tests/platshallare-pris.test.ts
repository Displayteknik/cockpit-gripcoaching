// Platshållare får inte lära ut det reglerna förbjuder.
//
// Håkans fynd 10/8: rutan "Berätta kort vad det handlar om" hade platshållaren
// t.ex. "sommarens buketter" eller "20% på tisdagar" — hos AluCon, som säljer
// profilsystem i aluminium.
//
// Två fel, och det andra är det dyra:
//   1. En blomsterbutik som exempel hos alla andra branscher. Samma familj som
//      veckoplanens platshållare (FIX-1 C3b): skriven för EN kund, läst som en
//      instruktion av resten.
//   2. "20% på tisdagar" lärde ut att skriva en RABATT. Prisregeln förbjuder priser i
//      inlägg — och användarens EGEN text är den enda väg som öppnar undantaget
//      (anvandarText i prompt-core). Rutan bjöd alltså in precis det som annars är
//      spärrat, och gjorde det med systemets egen röst.
//
// Det här är en GRIND, inte en åsikt: den läser källkoden, så ett nytt prisexempel i en
// platshållare fäller testet i stället för att nå en kund.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** Filer där användaren beskriver vad ett INLÄGG ska handla om. */
const FILER = [
  "components/StudioMaker.tsx",
  "components/OffertSkapa.tsx",
];

/** Plockar ut alla placeholder-strängar ur en fil. */
function platshallare(kod: string): string[] {
  const ut: string[] = [];
  for (const m of kod.matchAll(/placeholder=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const v = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (v) ut.push(v);
  }
  return ut;
}

// Rabatt, procentsats eller kronbelopp som EXEMPEL på ett ämne.
const PRISMONSTER = /\d+\s*%|\d[\d\s]*\s*(kr|kronor|sek)\b|\brabatt|\bhalva priset|\bkampanjpris/i;

describe("platshållare lär aldrig ut ett pris", () => {
  for (const fil of FILER) {
    it(`${fil} har inga prisexempel i sina platshållare`, () => {
      let kod: string;
      try {
        kod = readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");
      } catch {
        return; // filen kan ha bytt namn — det fångas av bygget, inte här
      }
      const traffar = platshallare(kod).filter((p) => PRISMONSTER.test(p));
      expect(traffar, `Platshållare med pris/rabatt som exempel: ${traffar.join(" | ")}`).toEqual([]);
    });
  }
});

describe("Studios ämnesruta pekar inte ut en enskild bransch", () => {
  // ⚠ Grinden läser PLATSHÅLLARNA, inte hela filen. Första versionen sökte i källkoden
  // rakt av och fälldes av kommentaren som dokumenterar fyndet — den citerar med flit
  // den gamla texten. Det som ska bevakas är vad användaren ser, inte vad utvecklaren
  // skrivit om det.
  const varden = () =>
    platshallare(readFileSync(new URL("../components/StudioMaker.tsx", import.meta.url), "utf8"));

  it("blomsterexemplet når inte längre användaren", () => {
    expect(varden().filter((p) => p.includes("buketter"))).toEqual([]);
    expect(varden().filter((p) => p.includes("tisdagar"))).toEqual([]);
  });

  it("exemplet lär ut formatet i stället: ett kort ämne", () => {
    expect(varden().some((p) => p.includes("en fråga vi får ofta"))).toBe(true);
  });
});
