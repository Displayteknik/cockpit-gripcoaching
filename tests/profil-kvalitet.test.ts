// PROFIL-1/F-mätare — kriterierna K1–K8, vikterna och nivåerna.
// Facit: PROFIL-RAPPORT.md (skräpsimuleringen i 0.2, de fyra skarpa profilerna i 0.5).
// Allt är deterministiskt: ingen AI, ingen DB, inget nät.

import { describe, expect, it } from "vitest";
import {
  arGeneriskMening,
  arGeneriskText,
  beraknaKvalitet,
  distinktaPoster,
  racker,
  siffrorMedEnhet,
  type KvalitetsIndata,
} from "@/lib/profil/kvalitet";

function indata(over: Partial<KvalitetsIndata> = {}): KvalitetsIndata {
  return {
    profil: null,
    assets: [],
    kundroster: [],
    berattelser: [],
    fingerprint: null,
    klient: null,
    ...over,
  };
}

// ── Skräpsimuleringen ur rapporten 0.2 — 593 tecken tomfraser ────────────────
const SKRAP_PROFIL = {
  company_name: "Företaget AB",
  location: "Sverige",
  tone_rules: "Vi skriver proffsigt och trevligt.",
  dos: "vara trevlig",
  donts: "vara tråkig",
  icp_primary: "Kunder som vill ha bra kvalitet och bra service hos oss.",
  icp_secondary: "Andra kunder som också vill ha bra.",
  pain_points: "De vill ha bra kvalitet men vet inte var man ska välja.",
  customer_quotes: "Bra jobbat! Mycket nöjd. Rekommenderas varmt. Toppenservice. Kommer gärna tillbaka snart.",
  usp: "Vi är bäst i branschen på det vi gör här.",
  brand_story: "Vi startade för att vi ville göra något bra. Sedan dess har vi gjort bra saker för våra kunder varje dag.",
  differentiators: "Vi är bäst. Vi är snabbast. Vi bryr oss.",
  customer_journey: "Först hör de av sig. Sedan pratar vi. Sedan bokar de. Sedan levererar vi. Sedan är de nöjda.",
  services: "Vi gör det vi är bäst på för dig.",
  booking_url: "https://example.com",
};

const SAMMA_INLAGG = "Vi vill bara säga att vi är väldigt glada över att få jobba med bra kunder varje dag. Det är roligt att göra bra saker för människor som vill ha bra kvalitet och bra service av oss.".padEnd(220, " x");

// ── En riktig profil (Displayteknik-liknande: siffror, årtal, egennamn) ──────
const DT_PROFIL = {
  company_name: "Displayteknik",
  location: "Stockholm",
  tone_rules: "Skriv rakt och tekniskt. Använd nits, tum och garantitid när du beskriver en skärm. Undvik säljsnack.",
  dos: "Förklara ljusstyrka i nits\nSkriv ut garantitiden\nNämn 24/7-drift när det gäller skyltfönster",
  donts:
    "Skriv aldrig att en vanlig TV duger i skyltfönster\nAnvänd aldrig ordet billigast, vi konkurrerar inte på pris\nLova aldrig leverans under 3 veckor\nSkriv aldrig hemelektronik om proffsskärmar\nAnvänd aldrig utropstecken i rubriker",
  usp: "Vi levererar skyltfönsterskärmar med 2 500 nits och 5 års garanti, monterade av egen personal sedan 2011.",
  brand_story:
    "Displayteknik startade 2011 i Stockholm när Anders såg att butiker köpte vanliga TV-apparater till skyltfönster och blev besvikna efter ett halvår. Första året monterade vi 14 skärmar åt lokala butiker i Söderort. Idag har vi över 400 installationer i drift, från Malmö i söder till Luleå i norr, och en egen serviceorganisation som rycker ut inom 48 timmar. Vi bygger fortfarande varje installation som om den var vår egen: rätt ljusstyrka för platsen, kablage som inte syns och ett serviceavtal som gäller dygnet runt. Det är därför våra kunder stannar i genomsnitt 7 år.".padEnd(
      260,
      " ",
    ),
  differentiators: "Egen serviceorganisation sedan 2011. 400 installationer i drift. Utryckning inom 48 timmar.",
  icp_primary: "Butikschefer och fastighetsägare i Stockholm som vill synas i skyltfönstret även i direkt solljus.",
  pain_points: "Skärmen syns inte i solljus. Ingen tar ansvar när den slutar fungera.",
  customer_quotes:
    '"Vi köpte först en vanlig TV och den var svart efter ett halvår" · "Ni var de enda som frågade hur mycket sol fönstret får" · "Servicen kom samma dag, det hade jag aldrig väntat mig"',
  customer_journey:
    "Kunden hör av sig efter att ha testat en konsument-TV som slocknat. Vi mäter ljuset på plats, oftast inom 5 arbetsdagar. Offert med tre alternativ, monteringen tar en dag och sedan följer vi upp efter 30 dagar. Serviceavtalet startar direkt och första året ingår två kontroller. Efter tre år erbjuder vi uppgradering av mediaspelaren.".padEnd(
      240,
      " ",
    ),
  services: "Skyltfönsterskärmar, utomhusskärmar, LED-väggar, installation och serviceavtal.",
  pricing_notes: "Skyltfönsterpaket 55 tum från 21 000 kr. Servicebesök 1 850 kr. LED-vägg från 36 900 kr.",
  booking_url: "https://displayteknik.se/boka",
};

const ANNAS_PROFIL = {
  company_name: "Annas Blommor",
  location: "Göteborg",
  usp: "Vi binder buketter med känsla för säsong.",
  brand_story: "Anna öppnade butiken för att hon älskar blommor.",
  icp_primary: "Brudpar och företag i Göteborg.",
  services: "Bröllopsbinderi, begravningsbinderi och abonnemang till kontor.",
  booking_url: "https://annasblommor.se/boka",
  dos: "Var varm",
  donts: "Var inte stel",
};

describe("generisk-detektorn (K7)", () => {
  it("fångar tomfraserna ur skräpsimuleringen", () => {
    for (const m of [
      "Vi är bäst i branschen på det vi gör",
      "Kunder som vill ha bra kvalitet och bra service",
      "Hög kvalitet i allt vi gör",
      "Lång erfarenhet och nöjda kunder",
      "Vi bryr oss.",
      "Vi gör det vi är bäst på för dig.",
      "Vi levererar alltid i tid",
      "Många företag glömmer detta",
    ]) {
      expect(arGeneriskMening(m), m).toBe(true);
    }
  });

  it("släpper igenom meningar med belägg (siffra, egennamn, årtal) och fackord", () => {
    for (const m of [
      "Vi levererar skyltfönsterskärmar med 2 500 nits ljusstyrka.",
      "Anders monterade de första 14 skärmarna i Söderort 2011.",
      "En trädfällning nära hus kräver sektionsfällning.",
    ]) {
      expect(arGeneriskMening(m), m).toBe(false);
    }
  });

  it("ett fält diskvalificeras när minst hälften av meningarna är tomfraser", () => {
    expect(arGeneriskText(SKRAP_PROFIL.brand_story)).toBe(true);
    expect(arGeneriskText(DT_PROFIL.brand_story)).toBe(false);
  });

  it("dubbletter inom samma fält räknas som tomfraser", () => {
    expect(arGeneriskText("Vi monterar 400 skärmar i Stockholm. Vi monterar 400 skärmar i Stockholm.")).toBe(true);
  });
});

describe("siffror och dubbletter (K4, K8)", () => {
  it("siffror med enhet plockas distinkt, årtal räknas", () => {
    const s = siffrorMedEnhet("Från 21 000 kr. Åter 21 000 kr. 5 års garanti sedan 2011.");
    expect(s).toContain("21 000 kr");
    expect(s.filter((x) => x === "21 000 kr")).toHaveLength(1);
    expect(s).toContain("2011");
  });

  it("fem identiska inlägg räknas som ETT (rapportens K8)", () => {
    expect(distinktaPoster(Array(5).fill(SAMMA_INLAGG))).toHaveLength(1);
  });

  it("korta poster räknas inte alls", () => {
    expect(distinktaPoster(["Kort inlägg.", null, ""])).toHaveLength(0);
  });
});

describe("nivåerna", () => {
  it("skräpprofilen når INTE toppnivå — inte ens med sex uppladdningar", () => {
    const r = beraknaKvalitet(
      indata({
        profil: SKRAP_PROFIL,
        assets: [
          ...Array(5).fill({ asset_type: "post", body: SAMMA_INLAGG }),
          ...Array(3).fill({ asset_type: "photo", body: null }),
          ...Array(3).fill({ asset_type: "testimonial", body: "Toppen!" }),
          { asset_type: "video", body: null },
        ],
      }),
    );
    expect(r.niva).toBeLessThanOrEqual(3);
    expect(racker(r)).toBe(false);
    // Det var precis den här profilen som fick 100 % och "Klar att producera".
    expect(r.poang).toBeLessThan(35);
  });

  it("Displaytekniks riktiga profil ligger högre än Annas tunna", () => {
    const dt = beraknaKvalitet(
      indata({
        profil: DT_PROFIL,
        klient: { name: "Displayteknik", industry: "Digital signage" },
        assets: [{ asset_type: "testimonial", body: "Bra jobbat" }],
        fingerprint: { source_asset_count: 3, signature_phrases: ["rätt skärm för platsen"] },
      }),
    );
    const annas = beraknaKvalitet(
      indata({ profil: ANNAS_PROFIL, klient: { name: "Annas Blommor", industry: "Florist" } }),
    );
    expect(dt.poang).toBeGreaterThan(annas.poang);
    expect(dt.niva).toBeGreaterThan(annas.niva);
    expect(annas.niva).toBeLessThanOrEqual(2);
  });

  it("TUNGVIKTARREGELN: alla lättviktsfält ifyllda men noll berättelser ger aldrig hög nivå", () => {
    const r = beraknaKvalitet(
      indata({
        profil: {
          ...DT_PROFIL,
          brand_story: "", // inga berättelser
          customer_journey: "",
        },
        klient: { name: "Displayteknik", industry: "Digital signage" },
        kundroster: [
          { phrase: "Vi köpte först en vanlig TV och den slocknade", category: "pain", context: "mejl" },
          { phrase: "Ni var de enda som frågade om solen", category: "desire", context: "samtal" },
          { phrase: "Servicen kom samma dag", category: "transformation", context: "recension" },
          { phrase: "Är det inte dyrt med proffsskärm?", category: "objection", context: "mejl" },
          { phrase: "Rätt skärm för platsen", category: "catchphrase", context: "möte" },
          { phrase: "Det bara funkar", category: "catchphrase", context: "möte" },
        ],
        assets: [
          ...Array(6)
            .fill(0)
            .map((_, i) => ({
              asset_type: "post",
              body: `Inlägg ${i}: ${["ljusstyrka", "montering", "serviceavtal", "utomhusskärm", "mediaspelare", "garantitid"][i]} i Stockholm ${2011 + i}. `.padEnd(200, "abcdefgh ".repeat(3)),
            })),
          ...Array(3)
            .fill(0)
            .map((_, i) => ({
              asset_type: "post",
              category: "winning_example",
              body: `Vinnande exempel ${i} om skyltfönsterskärmar med 2 500 nits i Stockholm. `.padEnd(230, `variation${i} `),
            })),
        ],
        fingerprint: { source_asset_count: 9, signature_phrases: ["rätt skärm för platsen"] },
      }),
    );
    expect(r.poang).toBeGreaterThanOrEqual(60); // allt annat är fullt
    expect(r.niva).toBe(3); // …men nivån kapas ändå
    expect(r.takOrsak).toContain("berättelser");
    expect(racker(r)).toBe(false);
  });

  it("HM Motor-fallet: fel bransch kapar nivån och varnar", () => {
    const r = beraknaKvalitet(
      indata({
        profil: {
          company_name: "HM Motor Krokom",
          usp: "Till skillnad från rena teknikkonsulter som bara bygger system kombinerar vi implementation och coaching för soloföretagare.",
          icp_primary: "Etablerade soloföretagare, konsulter och coacher, som saknar ett förutsägbart kundflöde varje månad.",
          services: "Kundflöde & Klarhet, ett 6-veckors program med implementation och coaching.",
        },
        klient: { name: "HM Motor Krokom", industry: "Bilhandel" },
        kundroster: [{ phrase: "Jag saknar ett system", category: "pain", context: "[Vad världen behöver]" }],
      }),
    );
    expect(r.forankringsflagga).toBe(true);
    expect(r.niva).toBeLessThanOrEqual(2);
    expect(r.forankringsVarning).toBeTruthy();
  });

  it("förankringsflaggan slår INTE fel när klienten beskriver sin bransch med egna ord", () => {
    // Displaytekniks USP säger "skyltfönsterskärmar", branschetiketten säger
    // "Digital signage". Ankaret (GÖR/GÖR INTE, plats, namn) binder ihop dem.
    const r = beraknaKvalitet(indata({ profil: DT_PROFIL, klient: { name: "Displayteknik", industry: "Digital signage" } }));
    expect(r.forankringsflagga).toBe(false);
    expect(r.forankringsVarning).toBeNull();
  });

  it("wizardetiketter i context räknas aldrig som kundröster", () => {
    const r = beraknaKvalitet(
      indata({
        profil: DT_PROFIL,
        klient: { name: "Displayteknik", industry: "Digital signage" },
        kundroster: Array(6).fill({ phrase: "Jag saknar ett system för kundflöde", category: "pain", context: "[Vad världen behöver]" }),
      }),
    );
    const kundrost = r.kriterier.find((k) => k.key === "kundrost")!;
    // Bara customer_quotes-citaten ur profilen räknas, inte wizardraderna.
    expect(kundrost.antal).toBeLessThan(6);
    expect(r.forankringsflagga).toBe(true);
  });

  it("tom profil ger nivå 1 och inga krascher", () => {
    const r = beraknaKvalitet(indata());
    expect(r.niva).toBe(1);
    expect(r.nivaNamn).toBe("Tom");
    expect(r.atgarder).toHaveLength(3);
  });
});

describe("vägledningen", () => {
  it("ger högst tre åtgärder, tyngst viktförlust först, i imperativ", () => {
    const r = beraknaKvalitet(indata({ profil: ANNAS_PROFIL, klient: { name: "Annas Blommor", industry: "Florist" } }));
    expect(r.atgarder).toHaveLength(3);
    expect(r.atgarder[0]).toMatch(/^(Lägg|Klistra|Skriv|Markera|Fyll)/);
    // Berättelser (25) väger tyngst av det som saknas → ska ligga först.
    expect(r.atgarder[0].toLowerCase()).toContain("kundberättelse");
  });

  it("uppfyllda kriterier ger ingen åtgärd", () => {
    const r = beraknaKvalitet(indata({ profil: DT_PROFIL, klient: { name: "Displayteknik", industry: "Digital signage" } }));
    const siffror = r.kriterier.find((k) => k.key === "siffror")!;
    expect(siffror.andel).toBe(1);
    expect(siffror.atgard).toBe("");
    expect(r.atgarder).not.toContain(siffror.atgard);
  });

  it("nivån bär konsekvensen, inte ett procenttal", () => {
    const r = beraknaKvalitet(indata({ profil: ANNAS_PROFIL }));
    expect(r.nivaKonsekvens).toMatch(/text/i);
    expect(r.nivaNamn).not.toMatch(/\d/);
  });
});
