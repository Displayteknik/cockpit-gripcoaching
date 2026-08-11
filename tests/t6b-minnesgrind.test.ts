// T-6b-GRIND — uppfunna minnen om en enskild kund fälls programmatiskt.
//
// Håkans fynd 10/8, kontrollerat i profilen samma kväll: alla tre captionvarianter för
// For Balance öppnade med "Jag minns en kvinna som kom till mig med panikångest, flera
// attacker om dagen." Kvinnan finns INTE under Kundberättelser. Det som finns är en
// ordagrann Bokadirekt-recension under Kundernas egna ord, från en verklig identifierbar
// person, med profilens egen anmärkning att den bara får användas avidentifierat.
//
// Modellen gjorde en SCEN av ett CITAT. Instruktionen förbjöd det redan i klartext — och
// höll inte. Det är skillnaden mellan en regel i prompten och en grind i koden.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BERATTELSE_UTAN_STORYBANK,
  MINNE_SKARPNING,
  harStorybank,
  hittaUppfunnetMinne,
} from "@/lib/minnesgrind";

const las = (fil: string) => readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");

describe("T-6b · grinden fäller det Håkan faktiskt såg", () => {
  it("fäller den skarpa texten, ordagrant", () => {
    const skarp =
      "Jag minns en kvinna som kom till mig med panikångest, flera attacker om dagen. " +
      "Hon hade levt så länge med den ständiga känslan av katastrof att hon inte visste hur det var att känna något annat.";
    expect(hittaUppfunnetMinne(skarp).length).toBeGreaterThan(0);
  });

  it("fäller de andra två varianternas formuleringar också", () => {
    for (const t of [
      "Tänk om din ångest inte var din att bära? Jag minns en kvinna som kom till mig med panikångest.",
      "Visst är det synd när sommarvärmen tar över. En kvinna som kom till mig i våras hade samma sak.",
      "En av mina klienter berättade att hon gått i vården i åratal.",
      "Hon ringde till mig en tisdagsmorgon och sa att hon inte orkade mer.",
      "För ett par månader sedan kom en man hit med exakt den frågan.",
    ]) {
      expect(hittaUppfunnetMinne(t), t.slice(0, 45)).not.toEqual([]);
    }
  });
});

describe("T-6b · grinden fäller INTE det som är tillåtet", () => {
  it("generella igenkänningsscener passerar — de är vad vinkeln ska falla tillbaka på", () => {
    for (const t of [
      "Många som hör av sig till oss har levt länge med en ständig känsla av katastrof.",
      "Det vi möter oftast är människor som provat allt annat först.",
      "En vanlig situation är att kroppen säger stopp innan huvudet gör det.",
      "Vi möter ofta människor som inte fått någon förklaring i vården.",
    ]) {
      expect(hittaUppfunnetMinne(t), t.slice(0, 45)).toEqual([]);
    }
  });

  it("ett ordagrant citat är en referens, inte en scen", () => {
    // Kundens egna ord får återges. Det som är förbjudet är att GÖRA EN SCEN av dem.
    const citat =
      "En kund skrev själv: ”Jag har gått från att ha mellan 15-30 panikångestattack per dag, till att inte minnas när jag senast hade en.” Så kan det se ut.";
    expect(hittaUppfunnetMinne(citat)).toEqual([]);
  });

  it("tom eller kort text kraschar inte grinden", () => {
    for (const t of ["", "   ", "Hej."]) expect(hittaUppfunnetMinne(t)).toEqual([]);
  });
});

describe("T-6b · story-banken avgör om en scen ens får begäras", () => {
  // Strukturell orsak: KLIPPORDNING i prompt-core klipper "Story-bank" FÖRST när profilen
  // är för lång. Vinkeln bad om en händelse ur en sektion som lyfts ur samma prompt.
  it("saknad sektion = ingen story-bank", () => {
    expect(harStorybank("Tonregler: varm och personlig. USP: trygghet.")).toBe(false);
    expect(harStorybank("")).toBe(false);
  });

  it("rubrik utan innehåll räknas inte som story-bank", () => {
    expect(harStorybank("Story-bank:")).toBe(false);
    expect(harStorybank("Story-bank: —")).toBe(false);
  });

  it("rubrik MED innehåll räknas", () => {
    expect(harStorybank("Story-bank: Kvinna, 42, tre år av utbrändhet. Efter åtta samtal tillbaka i arbete på halvtid.")).toBe(true);
  });

  it("prompt-core klipper story-banken först — därför behövs kontrollen", () => {
    const kod = las("lib/prompt-core.ts");
    const i = kod.indexOf("const KLIPPORDNING");
    expect(i).toBeGreaterThan(0);
    // Första posten i klippordningen ÄR story-banken. Ändras det ska testet läsas om.
    expect(kod.slice(i, i + 120)).toContain("Story-bank");
  });
});

describe("T-6b · alternativet är utskrivet, inte bara förbudet", () => {
  it("skärpningen säger vad som ska stå i stället", () => {
    expect(MINNE_SKARPNING).toContain("Många som hör av sig");
    expect(MINNE_SKARPNING).toContain("SPRÅK");
    // Kärnan i fyndet: att citatet är äkta gör inte scenen sann.
    expect(MINNE_SKARPNING).toContain("Att en recension är äkta gör inte scenen sann");
  });

  it("och den nämner integriteten, inte bara sanningen", () => {
    expect(MINNE_SKARPNING).toMatch(/identifierbar|tredje person/);
  });

  it("berättelse-vinkeln utan story-bank ber aldrig om en person", () => {
    expect(BERATTELSE_UTAN_STORYBANK).toContain("ingen huvudperson");
    expect(BERATTELSE_UTAN_STORYBANK).toContain("ALDRIG");
    expect(hittaUppfunnetMinne(BERATTELSE_UTAN_STORYBANK.replace(/ALDRIG/g, ""))).toBeTruthy();
  });
});

describe("T-6b · captionvägen använder grinden", () => {
  const route = las("app/api/studio/suggest-caption/route.ts");

  it("byter berättelse-vinkeln när story-banken saknas i den FÄRDIGA prompten", () => {
    expect(route).toContain("harStorybank(bygg.profilText)");
    expect(route).toContain("BERATTELSE_UTAN_STORYBANK");
  });

  it("mäter den färdiga texten och gör exakt ett omtag", () => {
    expect(route).toContain("hittaUppfunnetMinne(text)");
    expect(route).toContain("MINNE_SKARPNING");
  });

  it("kasserar varianten i stället för att släppa igenom minnet", () => {
    // Fail-open är fel väg här: en påhittad scen om en verklig människas hälsa är värre
    // än en variant mindre.
    expect(route).toContain("KASSERAD");
    expect(route).toMatch(/return \{ caption: "",/);
  });

  it("blir alla kasserade får användaren veta VAR berättelser fylls i", () => {
    expect(route).toContain("Brand-profil → Kundberättelser");
    expect(route).toContain("jag hittar inte på en person");
  });
});
