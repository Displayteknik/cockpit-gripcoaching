// BILD-11 TILLÄGG, punkt 4 och 5 (Håkans skarpfynd 15/8, singelinlägg hos DT).
//
// Fyndet: inlägget "Skärmen som säljer när du sover" — om ett skyltfönster som jobbar
// dygnet runt — fick en bild med DAGTID, butiksinteriör och personal INNE i butiken. Och
// skärmen i bilden visade "FRESH-BAKED" och "KANELBULLE" i läsbar text, på engelska.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  harledPlats, harledTid, harledBevismening, fogaSamman, branschRekvisita, personKategoriFor,
} from "@/lib/bild/promptbyggare";
import { lasbaraOrd, engelskaOrd, kontrolleraAvbildadText, stavningsgrind, ORDFRITT_MOTIV_EN } from "@/lib/bildtext";

const DT_RUBRIK = "Skärmen som säljer när du sover";
const DT_TEXT = "Ett skyltfönster som jobbar dygnet runt, även när butiken är stängd.";

describe("BILD-11 punkt 4 · bevismeningen fångar VAR och NÄR", () => {
  it("skyltfönster ger kameraläget utanför, på gatan", () => {
    const p = harledPlats(DT_RUBRIK, DT_TEXT);
    expect(p).toMatch(/OUTSIDE on the street/);
    expect(p).toMatch(/never inside the shop/);
  });

  it('"när du sover" ger natt — och solnedgången är utpekad vid namn', () => {
    // ⚠ Mätt 15/8: "no daylight" räckte inte. Modellen levererade gyllene timme med ljus
    //   himmel och kallade det kväll. En modell väljer det vackraste som inte uttryckligen
    //   är förbjudet — samma lärdom som isberget i BILD-12.
    const t = harledTid(DT_RUBRIK, DT_TEXT);
    expect(t).toMatch(/AFTER DARK/);
    expect(t).toMatch(/NOT golden hour/);
    expect(t).toMatch(/NOT a sunset/);
    // ⚠ Håkans fynd på bilden: "personen framför skärmen tittar inte på skärmen."
    //   Ordet "passer-by" var en inbjudan till någon som går förbi och tittar bort —
    //   BILD-8b:s blickregel gällde men konkurrerade med min egen formulering.
    expect(t).toMatch(/STOPPED and are looking straight at the subject/);
    expect(t).not.toMatch(/a passer-by, or someone stopping/);
  });

  it("de tre frågorna står i prompten, i ordning", () => {
    const prompt = fogaSamman({
      scen: "A photograph for a digital signage business.",
      bevismening: harledBevismening(DT_RUBRIK, DT_TEXT),
      plats: harledPlats(DT_RUBRIK, DT_TEXT),
      tid: harledTid(DT_RUBRIK, DT_TEXT),
      rekvisita: branschRekvisita("digital signage"),
      personkategori: "no people at all",
      kitSuffix: "",
    });
    expect(prompt.indexOf("WHAT THE PICTURE MUST PROVE")).toBeGreaterThan(-1);
    expect(prompt.indexOf("WHERE IT TAKES PLACE")).toBeGreaterThan(prompt.indexOf("WHAT THE PICTURE MUST PROVE"));
    expect(prompt.indexOf("WHEN IT TAKES PLACE")).toBeGreaterThan(prompt.indexOf("WHERE IT TAKES PLACE"));
  });

  it("ljusraden motsäger inte tiden", () => {
    // Två rader som säger olika saker om ljuset är just den motsägelse som får modellen
    // att välja fritt (samma familj som TON-1 och BILD-12).
    const kvall = fogaSamman({
      scen: "s", bevismening: "b", plats: null, tid: "AFTER DARK: evening or night.",
      rekvisita: "r", personkategori: "p", kitSuffix: "",
    });
    expect(kvall).not.toMatch(/natural light/);
    expect(kvall).toMatch(/lit exactly as described above/);
  });

  it("utan plats och tid i innehållet läggs inga rader till", () => {
    expect(harledPlats("Tre saker att tänka på vid val av skärm", "")).toBeNull();
    expect(harledTid("Tre saker att tänka på vid val av skärm", "")).toBeNull();
    const prompt = fogaSamman({
      scen: "s", bevismening: "b", plats: null, tid: null, rekvisita: "r", personkategori: "p", kitSuffix: "",
    });
    expect(prompt).not.toMatch(/WHERE IT TAKES PLACE/);
    expect(prompt).not.toMatch(/WHEN IT TAKES PLACE/);
    expect(prompt).toMatch(/natural light/);
  });

  it("ÅRSTID härleds aldrig här — säsongsraden äger den frågan", () => {
    // En vinterrubrik i augusti hade annars gett två motstridiga instruktioner.
    expect(harledTid("Vinterkampanj på skyltar", "Snön kommer snart.")).toBeNull();
    expect(harledTid("Sommarens erbjudande", "")).toBeNull();
  });

  it("efter stängning byts personal i ARBETE ut — men människor är inte förbjudna", () => {
    // Mätt i DoD:n: rätt plats och rätt tid, men en bagare stod och jobbade inne i
    // lokalen i ett inlägg om att skärmen säljer NÄR INGEN ÄR DÄR.
    // Håkans rättning: varken aldrig eller alltid människor — det är arbetspasset som
    // inte kan pågå i en stängd lokal.
    const stangt = [0, 1, 2, 3, 4].map((i) => personKategoriFor("digital signage", i, { efterStangning: true }));
    expect(stangt.some((k) => /work clothing|installing or servicing/i.test(k))).toBe(false);
    expect(stangt.some((k) => /customer|woman|passer/i.test(k))).toBe(true); // människor finns kvar
    expect(new Set(stangt).size).toBeGreaterThanOrEqual(3);                  // rotationen lever
    // Öppet läge är orört: den arbetande kategorin finns kvar i rotationen.
    const oppet = [0, 1, 2, 3, 4].map((i) => personKategoriFor("digital signage", i));
    expect(oppet.some((k) => /work clothing/i.test(k))).toBe(true);
  });

  it('"efter stängning"-raden säger var en person får stå, inte att den är förbjuden', () => {
    const t = harledTid(DT_RUBRIK, DT_TEXT)!;
    expect(t).toMatch(/public side/);
    expect(t).toMatch(/never staff at work/);
    expect(t).not.toMatch(/nobody at all/);
  });

  it("nyckelorden matchar ORD, inte substrängar", () => {
    // ⚠ MÄTT 15/8 mot fyra tenants: "väg" i listan matchade inuti "på VÄG hem" och gav en
    //   fasadbild av en bukett, och "kö" matchade inuti "KÖpa" — alltså hade varje inlägg
    //   om att köpa något klassats som rusningstid. Felet drabbade alla kunder, inte den
    //   bransch jag råkade testa. Håkans rättning: "se det systemmässigt."
    expect(harledPlats("Buketten du hinner hämta på väg hem från jobbet", "")).toBeNull();
    expect(harledTid("Vad kostar det att köpa en skylt?", "")).toBeNull();
    expect(harledPlats("Vi målar om väggen i receptionen", "")).toMatch(/entrance|reception/);
    expect(harledTid("Köket blir klart i tid", "")).toBeNull();
    // Och de riktiga träffarna finns kvar.
    expect(harledTid("Så slipper du kön på lördagar", "")).toMatch(/BUSIEST HOUR|WEEKEND/);
    expect(harledPlats("Skyltfönstret som säljer", "")).toMatch(/OUTSIDE on the street/);
  });

  it("modellens svar formuleras av KODEN, inte av modellen", async () => {
    // Håkans rättning: systemet ska tänka rätt oavsett vad som skrivs in. Modellen tolkar
    // alltså texten, men instruktionen som når bildmodellen är kodens egen — annars hade
    // härdningen mot gyllene timme försvunnit vid nästa körning.
    const { platsText, tidText } = await import("@/lib/bild/promptbyggare");
    expect(platsText("gatan-utifran")).toBe(harledPlats(DT_RUBRIK, DT_TEXT));
    expect(tidText("efter-morkret")).toBe(harledTid(DT_RUBRIK, DT_TEXT));
    expect(platsText("finns-inte")).toBeNull();
  });

  it("modellens fritext saneras: årstid, tomt och för långt kastas", async () => {
    const { saneraFritext } = await import("@/lib/bild/promptbyggare");
    expect(saneraFritext("on the roof terrace above the restaurant, city rooftops behind")).toBeTruthy();
    expect(saneraFritext("in deep winter snow outside the shop")).toBeNull(); // säsongsraden äger årstiden
    expect(saneraFritext("null")).toBeNull();
    expect(saneraFritext("kort")).toBeNull();
    expect(saneraFritext("x".repeat(300))).toBeNull();
  });

  it("plats och tid följer med ut ur byggaren, för loggen", async () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/studio/suggest-image/route.ts"), "utf8");
    expect(src).toMatch(/plats:\$\{byggd\.plats/);
    expect(src).toMatch(/tid:\$\{byggd\.tid/);
  });
});

describe("BILD-11 punkt 5 · läsbara och engelska ord", () => {
  it("de två orden Håkan såg klassas rätt", () => {
    const ord = ["FRESH-BAKED", "KANELBULLE"];
    expect(lasbaraOrd(ord)).toHaveLength(2);
    expect(engelskaOrd(ord)).toEqual(["FRESH-BAKED"]);
  });

  it("svenska skyltord är inte engelska", () => {
    expect(engelskaOrd(["ÖPPET", "ERBJUDANDE", "VECKANS", "KANELBULLE", "SERVICE", "SPECIAL"])).toHaveLength(0);
  });

  it("siffror och enstaka bokstäver räknas inte som läsbara ord", () => {
    expect(lasbaraOrd(["25", "199", "kr", "A", "%"])).toHaveLength(0);
  });

  it("engelska ord fälls även när flödet äger sin egen text", async () => {
    const utfall = await kontrolleraAvbildadText("data:image/png;base64,x", {
      // Vår egen rad är godkänd av B3; bakgrundens engelska ord är det som fälls.
      ignorera: "VÄLKOMMEN IN",
      lasHuvudskylt: async () => ["FRESH", "BAKED"],
      lasOrd: async () => ({ raw: "", ord: ["VÄLKOMMEN", "IN", "FRESH", "BAKED"], ordBak: [] }),
    });
    expect(utfall.ok).toBe(false);
    expect(utfall.orsak).toBe("engelska");
    expect(utfall.engelska).toEqual(expect.arrayContaining(["FRESH", "BAKED"]));
  });

  it("läsbara SVENSKA ord fälls bara i ordfria flöden", async () => {
    const args = {
      lasHuvudskylt: async () => ["KANELBULLE"],
      lasOrd: async () => ({ raw: "", ord: ["KANELBULLE"], ordBak: [] }),
    };
    const ordfri = await kontrolleraAvbildadText("data:image/png;base64,x", { ...args, ordfri: true });
    expect(ordfri.ok).toBe(false);
    expect(ordfri.orsak).toBe("lasbar-text");

    const egenText = await kontrolleraAvbildadText("data:image/png;base64,x", { ...args, ordfri: false });
    expect(egenText.ok).toBe(true);
  });

  it("bakgrundsord på en annan skylt än huvudmotivets jagas inte", async () => {
    const utfall = await kontrolleraAvbildadText("data:image/png;base64,x", {
      ordfri: true,
      lasHuvudskylt: async () => [], // ingen tydlig huvudskylt → allt är bakgrund
      lasOrd: async () => ({ raw: "", ord: ["BRYGGERI", "APOTEK"], ordBak: [] }),
    });
    expect(utfall.ok).toBe(true);
  });

  it("omtaget ber om att ORDEN tas bort, inte om bättre stavning", async () => {
    // Fel medicin är värre än ingen: stavningsskärpningen ber uttryckligen om "två till
    // fem korta svenska ord" — alltså precis det som ska bort.
    const skarpningar: string[] = [];
    let varv = 0;
    await stavningsgrind({
      bild: "b0",
      maxOmtag: 1,
      tillatBlank: false,
      ordfri: true,
      kontrollera: async () => ({
        ok: varv++ > 1, text: "FRESH", ord: ["FRESH"], fel: ["FRESH"], orsak: "engelska" as const,
      }),
      generera: async ({ skarpning }) => { skarpningar.push(skarpning); return { image: "b1" }; },
    });
    expect(skarpningar[0]).toBe(ORDFRITT_MOTIV_EN);
    expect(skarpningar[0]).not.toMatch(/två till fem korta/);
  });

  it("friprompt-vägen kör grinden ordfritt", () => {
    const src = readFileSync(path.join(process.cwd(), "app/api/studio/suggest-image/route.ts"), "utf8");
    expect(src).toMatch(/ordfri: true/);
    expect(src).toMatch(/engelsk text på en skylt/);
  });
});
