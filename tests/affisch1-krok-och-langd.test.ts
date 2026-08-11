// AFFISCH-1 — texten PÅ bilden. Håkans fynd 2026-08-11, ur hans egen testning.
//
// Han fick den här affischen ur ett planerat inlägg:
//
//   badge:    SOM INTE SYNS I SOLLJUS
//   rubrik:   En LED-skärm på fasaden
//   brödtext: Två månader senare står skärmen fortfarande där, i skuggan, osynlig för gatan,
//             medan konkurrenten över gatan lyser upp hela trottoaren.
//
// Hans dom: "textens innehåll inte var speciellt bra för ett inlägg". Fyra mätbara fel, och
// alla fyra gick igenom grindarna:
//
//   1. ÖPPEN LOOP. Krokens uppgift i lib/hook-typer.ts är att "öppna en loop som läsaren vill
//      veta slutet på" — en CAPTION-instruktion. På en affisch finns inget senare: tre korta
//      fält, sen slut. "Två månader senare" förutsätter en början läsaren aldrig ser.
//   2. LÄNGDEN. Prompten ber om max ~90 tecken. Grinden släppte 150. Hans brödtext: 135.
//   3. KOMMASTAPLING. Staplingsgrinden räknade bara . ! ? : ; — texten var staplad med
//      kommatecken: fyra tankar, en "sats" enligt den gamla räkningen.
//   4. UPPREPNING. Badgen sa samma sak som brödtexten ("inte syns i solljus" / "osynlig för
//      gatan"). Två av tre textrader bar ett budskap.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { arOppenLoop, upprepar } from "@/lib/studio/copy";

const copy = readFileSync(new URL("../lib/studio/copy.ts", import.meta.url), "utf8");

const HAKANS_BRODTEXT =
  "Två månader senare står skärmen fortfarande där, i skuggan, osynlig för gatan, medan konkurrenten över gatan lyser upp hela trottoaren.";

describe("AFFISCH-1 · den öppna loopen fälls", () => {
  it("fäller Håkans text ordagrant", () => {
    expect(arOppenLoop(HAKANS_BRODTEXT)).toBe(true);
  });

  it("fäller andra tidssprång som förutsätter en osynlig början", () => {
    for (const t of [
      "Tre veckor senare ringde han tillbaka.",
      "Efter ett halvår stod skylten kvar.",
      "Efter två månader hade ingenting hänt.",
      "Sedan dess har ingen frågat om priset.",
      "Till slut bytte de leverantör.",
      "Två somrar senare syns den fortfarande inte.",
    ]) {
      expect(arOppenLoop(t), t).toBe(true);
    }
  });

  it("släpper igenom en sluten tanke — även när den nämner tid", () => {
    for (const t of [
      "Din skylt syns inte när solen står som högst.",
      "Två månader är lång tid att stå osynlig.", // tid, men ingen loop
      "Efter regnet syns skärmen lika bra.", // "efter" utan tal + tidsenhet
      "Solen är din värsta konkurrent.",
      "Vi möter ofta fastighetsägare som valt fel ljusstyrka.",
    ]) {
      expect(arOppenLoop(t), t).toBe(false);
    }
  });

  it("tom eller obefintlig text kraschar inte grinden", () => {
    for (const t of ["", "   "]) expect(arOppenLoop(t)).toBe(false);
    expect(arOppenLoop(undefined as unknown as string)).toBe(false);
  });

  it("regeln står också i prompten — grinden är sista nätet, inte enda", () => {
    expect(copy).toContain("AFFISCHEN HAR INGET SENARE");
    expect(copy).toContain("FÖRBJUDNA ÖPPNINGAR");
    expect(copy).toContain("LANDA NÅGONSTANS");
  });
});

describe("AFFISCH-1 · upprepningen mellan badge och brödtext fälls", () => {
  it("fäller Håkans par", () => {
    expect(upprepar("Som inte syns i solljus.", HAKANS_BRODTEXT)).toBe(false);
    // ⚠ Ordagrann överlappning saknas i just det paret ("solljus" vs "osynlig för gatan") —
    // den fälls i stället av den öppna loopen och av längden. Grinden här tar de fall där
    // samma ord återanvänds, vilket är den vanliga formen av upprepning.
    expect(upprepar("Skylten syns inte i solljus.", "Skylten syns inte i solljus när det är sommar.")).toBe(true);
  });

  it("fäller när underrubriken är brödtexten i kortform", () => {
    expect(upprepar("Fel ljusstyrka kostar kunder.", "Fel ljusstyrka kostar dig kunder varje solig dag.")).toBe(true);
  });

  it("släpper igenom fält som säger OLIKA saker", () => {
    expect(upprepar("Syns i fullt solljus.", "Vi tar ansvar för hela kedjan, från val till drift.")).toBe(false);
    expect(upprepar("Dyrt är inte alltid bäst.", "Tre misstag gör skärmen till en kostnad.")).toBe(false);
  });

  it("en underrubrik på ett bärande ord fälls aldrig", () => {
    // "Solljus" kan legitimt eka brödtexten — ett ord är ingen upprepning.
    expect(upprepar("Solljus", "Skylten syns även i solljus.")).toBe(false);
  });
});

describe("AFFISCH-1 · längden och kommastaplingen", () => {
  it("taket ligger nära det prompten ber om, inte 60 tecken över", () => {
    expect(copy).toContain("s.body.length > 105");
    expect(copy).not.toContain("s.body.length > 150");
  });

  it("staplingsgrinden räknar kommadelar också", () => {
    expect(copy).toContain("[.!?:;,]+");
    expect(copy).toContain("delar.length >= 4");
  });

  it("Håkans brödtext är över det nya taket — den hade fällts på längden ensam", () => {
    expect(HAKANS_BRODTEXT.length).toBeGreaterThan(105);
  });
});
