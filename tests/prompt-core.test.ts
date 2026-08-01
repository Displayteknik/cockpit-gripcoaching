// Enhetstester för lib/prompt-core (TEXT-1, T-1 DoD).
// Verifierar per syfte att varje lager finns i utgående prompt, i rätt ordning,
// exakt en gång — samt klipprioritet, compass-defaults och flaggstyrd sanering.
// All DB mockas; testerna kör utan nycklar och utan nät.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mockar (prompt-core hämtar dessa dynamiskt) ──────────────────────────────
const PROFIL_MD = [
  "# ═══ brand-profile (live från dashboard) ═══",
  "",
  "## Företagsnamn\nTestbolaget",
  "## Tagline\nVi testar allt",
  "## USP (det som skiljer oss)\nSnabbast i test",
  "## Differentiering\nCertifierad sedan 2009. Egen verkstad i Krokom.",
  "## Tonregler\nRakt och vänligt. Inga floskler.",
  "## Primär ICP\nSmåföretagare",
  "## Sekundär ICP\nCoacher",
  "## Smärtpunkter kunden har\nTidsbrist",
  "## Kundresa\nLång text om kundresan. ".repeat(20).trim(),
  "## Konkurrenter\nKonkurrent AB. ".repeat(20).trim(),
  "## Erbjudande: tjänster och produkter\nMontage, service, support. ".repeat(10).trim(),
  "## Erbjudande: priser (verifierade siffror)\nStartpaket 21 000 kr. Servicebesök 1 850 kr.",
  "## Erbjudande: CTA-väg (bokningslänk)\nhttps://exempel.se/boka",
  "## GÖR\nDu-tilltal",
  "## GÖR INTE\nUtropstecken i rad",
  "## Hashtag-bas\n#test #bolag",
  "",
  "# ═══ Customer Voice (exakta kundord — använd dem ordagrant där de passar) ═══",
  "",
  '- "det bara funkar"'.repeat(1),
  "",
  "# ═══ Story-bank (konkreta berättelser från Zoom/intervjuer — bryggor till alla format) ═══",
  "",
  "- **En berättelse** hook. ".repeat(30).trim(),
].join("\n");

const skrivreglerPaMock = vi.fn(async () => true);

vi.mock("@/lib/knowledge", () => ({
  getProfileAsMarkdown: vi.fn(async (_id?: string, opts?: { medVoice?: boolean }) => {
    // prompt-core MÅSTE be om medVoice:false — annars dubbleras röstlagret.
    if (opts?.medVoice !== false) throw new Error("prompt-core ska hämta profilen med medVoice:false");
    return PROFIL_MD;
  }),
  getStaticKnowledge: vi.fn(async (...names: string[]) => names.map((n) => `# ═══ ${n} ═══\n\nStatisk kunskap.`).join("\n\n")),
}));

vi.mock("@/lib/voice-fingerprint", () => ({
  getVoiceFingerprint: vi.fn(async (clientId: string) => ({
    client_id: clientId,
    signature_phrases: ["kör vi"],
    forbidden_words: ["kraftfull"],
    tone_summary: "Kort och rak.",
    rhythm_notes: "Korta meningar.",
    pain_words: ["strul"],
    joy_words: ["flyt"],
    source_asset_count: 3,
    raw_samples: ["Ett riktigt inlägg."],
    built_at: "2026-07-31T00:00:00Z",
  })),
  fingerprintToPromptBlock: vi.fn(() => "=== KUNDENS RÖST (måste imiteras) ===\nTON: Kort och rak."),
}));

vi.mock("@/lib/voice-score", () => ({
  fetchWinningExamples: vi.fn(async () => ["Vinnande exempeltext."]),
}));

vi.mock("@/lib/studio/kit", () => ({
  getKitDirectives: vi.fn(async () => ({ donts: ["neonfärger", "utropstecken"], imageExtra: "", imageNegative: "", colors: {}, formats: [], signature: {} })),
  dontsRule: (donts: string[]) => (donts.length ? `\nKUNDENS VILL-INTE-HA (följ strikt): ${donts.join("; ")}.` : ""),
}));

vi.mock("@/lib/content/writing-rules", async (importOriginal) => {
  const riktig = await importOriginal<typeof import("@/lib/content/writing-rules")>();
  return { ...riktig, skrivreglerPa: (...args: unknown[]) => skrivreglerPaMock(...(args as [])) };
});

import { anatomiBlock, byggTextPrompt, klippProfil, saneraText, SANNINGSKRAV, VARIANTREGEL } from "@/lib/prompt-core";
import { POST_ANATOMY } from "@/lib/content-compass/prompt";

// Fast datum (BILD-5b): säsongsraden får ALDRIG göra testerna tidsberoende.
const FAST_DATUM_JULI = new Date(2026, 6, 15);
const BAS = { clientId: "klient-1", uppdrag: "=== UPPDRAG ===\nSkriv en caption.", underlag: "Ämne: vårkampanj", datum: FAST_DATUM_JULI };

beforeEach(() => {
  skrivreglerPaMock.mockReset();
  skrivreglerPaMock.mockResolvedValue(true);
});

describe("byggTextPrompt — lager och ordning", () => {
  it("caption får samtliga lager i rätt ordning, med formatkrav sist", async () => {
    const b = await byggTextPrompt({
      ...BAS,
      syfte: "caption",
      knowledge: ["hook-playbook"],
      jsonSchema: '{ "caption": "..." }',
    });
    const markorer = [
      "=== UPPDRAG ===",
      "═══ hook-playbook ═══",
      "=== KLIENTENS VARUMÄRKESPROFIL ===",
      "=== KUNDENS RÖST",
      "=== VINNANDE EXEMPEL",
      "=== INLÄGGSANATOMI",
      "KUNDENS VILL-INTE-HA",
      "=== GLOBALA SKRIVREGLER",
      "=== SVARSFORMAT",
    ];
    let senast = -1;
    for (const m of markorer) {
      const i = b.system.indexOf(m);
      expect(i, `saknar/fel ordning: ${m}`).toBeGreaterThan(senast);
      senast = i;
    }
    expect(b.user).toBe("Ämne: vårkampanj");
    expect(b.meta.lager).toMatchObject({ uppdrag: true, kunskap: true, brandProfil: true, rost: true, vinnande: true, anatomi: true, grafisk: true, skrivregler: true, format: true });
  });

  it("varje lager finns EXAKT en gång (dubblettvakten)", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", jsonSchema: "{}" });
    for (const m of ["=== GLOBALA SKRIVREGLER", "=== KUNDENS RÖST", "=== KLIENTENS VARUMÄRKESPROFIL ===", "=== VINNANDE EXEMPEL", "=== INLÄGGSANATOMI"]) {
      expect(b.system.split(m).length - 1, m).toBe(1);
    }
  });

  it("utan clientId: anatomi + skrivregler finns ändå, röst/profil hoppas", async () => {
    const b = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", underlag: "x" });
    expect(b.system).toContain("=== INLÄGGSANATOMI");
    expect(b.system).toContain("=== GLOBALA SKRIVREGLER");
    expect(b.system).not.toContain("KUNDENS RÖST");
    expect(b.meta.lager.rost).toBeUndefined();
    expect(b.fingerprint).toBeNull();
  });

  it("icke-bildnära syfte (linkedin) får inte kit-donts", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "linkedin" });
    expect(b.system).not.toContain("KUNDENS VILL-INTE-HA");
  });
});

describe("säsongsraden (BILD-5b) — datum injiceras, aldrig tidsberoende", () => {
  it("juli: säsongsraden finns, sommar, INGEN semla-markör", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", datum: new Date(2026, 6, 15) });
    expect(b.system).toContain("AKTUELL TID: 15 juli 2026, sommar");
    expect(b.system).toContain("föreslå ALDRIG produkter/motiv ur fel säsong");
    expect(b.system).not.toContain("seml");
    expect(b.meta.lager.sasong).toBe(true);
  });

  it("februari: semla-markören (fettisdagen) finns", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", datum: new Date(2026, 1, 5) });
    expect(b.system).toContain("AKTUELL TID: 5 februari 2026, vinter");
    expect(b.system).toContain("fettisdagen (semmeldags)");
  });

  it("säsongsraden ligger tidigt: efter uppdraget, före profilen", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    const i = b.system.indexOf("AKTUELL TID:");
    expect(i).toBeGreaterThan(b.system.indexOf("=== UPPDRAG ==="));
    expect(i).toBeLessThan(b.system.indexOf("=== KLIENTENS VARUMÄRKESPROFIL ==="));
  });
});

describe("anatomin", () => {
  it("studio-text får pa-bild-varianten: ingen CTA, captionen bär uppmaningen", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "studio-text" });
    expect(b.system).toContain("INGEN CTA i texten på bilden");
    expect(b.system).not.toContain(POST_ANATOMY.cta);
  });

  it("specialist utan compass och utan default får bar anatomi, ingen funnel", () => {
    const block = anatomiBlock("full", undefined, undefined);
    expect(block).toContain("=== INLÄGGSANATOMI (följ i ordning) ===");
    expect(block).not.toContain("FUNNEL (");
  });
});

describe("CTA-golvet (T-5) — hård regel oavsett compass-läge", () => {
  it("caption (mjuk funnel-default) bär CTA-golvet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    expect(b.system).toContain("CTA-golv");
  });

  it("karusell med uttrycklig compass bär CTA-golvet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "karusell", compass: { funnel: "bofu", four_a: null, disc: [] } });
    expect(b.system).toContain("CTA-golv");
  });

  it("linkedin utan compass bär CTA-golvet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "linkedin" });
    expect(b.system).toContain("CTA-golv");
  });

  it("bar anatomi (ingen compass, ingen default) bär CTA-golvet", () => {
    expect(anatomiBlock("full", undefined, undefined)).toContain("CTA-golv");
  });

  it("pa-bild-varianten (studio-text) har INTE CTA-golvet — captionen bär uppmaningen", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "studio-text" });
    expect(b.system).not.toContain("CTA-golv");
    expect(b.system).toContain("INGEN CTA i texten på bilden");
  });
});

describe("T-6a — CTA-golvet är uppmaning i imperativ med väg", () => {
  it("golvet kräver imperativ + väg, ger mjuk-och-imperativ-exemplet och föredrar profilens CTA-formuleringar", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    expect(b.system).toContain("UPPMANING I IMPERATIV MED VÄG");
    expect(b.system).toContain("Boka en digital fika, ingen säljpitch");
    expect(b.system).toContain("FÖREDRA dem framför nyskrivna");
    expect(b.system).toContain("är INTE en CTA");
  });

  it("skärpningen följer med i ALLA full-anatomilägen (compass, mjuk default, bar)", () => {
    const lagen = [
      anatomiBlock("full", { funnel: "bofu", four_a: null, disc: [] }),
      anatomiBlock("full", undefined, "tofu"),
      anatomiBlock("full", undefined, undefined),
    ];
    for (const block of lagen) {
      expect(block).toContain("CTA-golv");
      expect(block).toContain("IMPERATIV MED VÄG");
      expect(block).toContain("aldrig om den finns eller att den är imperativ");
    }
  });

  it("pa-bild-varianten har fortfarande inget CTA-golv", () => {
    expect(anatomiBlock("pa-bild")).not.toContain("CTA-golv");
  });
});

describe("T-6b — sanningskravet: inga fabricerade berättelser/minnen/citat/siffror", () => {
  it("finns i alla syften — även pa-bild (studio-text) och utan clientId", async () => {
    const caption = await byggTextPrompt({ ...BAS, syfte: "caption" });
    const studio = await byggTextPrompt({ ...BAS, syfte: "studio-text" });
    const anon = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", datum: FAST_DATUM_JULI });
    for (const b of [caption, studio, anon]) {
      expect(b.system).toContain("=== SANNINGSKRAV");
      expect(b.meta.lager.sanningskrav).toBe(true);
    }
  });

  it("regeln skiljer tillåtet (generell observation) från förbjudet (påhittat minne) med källkrav", () => {
    expect(SANNINGSKRAV).toContain("Vi möter ofta fastighetsägare");
    expect(SANNINGSKRAV).toContain("Jag minns en fastighetsägare");
    expect(SANNINGSKRAV).toContain("story-bank");
    expect(SANNINGSKRAV).toContain("Hitta ALDRIG på ett specifikt minne");
  });

  it("A2-skärpningen: ämnesformuleringen är inget mandat att fabricera", () => {
    // Läckan i T-6-delbatchen: ämnet "En kund tvekade länge..." fick modellen att
    // uppfinna minnet ("Jag minns en kund som tvekade länge..."). Regeln måste säga
    // uttryckligen att uppdraget/ämnet aldrig upphäver sanningskravet.
    expect(SANNINGSKRAV).toContain("ÄMNET ÄR INGET MANDAT ATT FABRICERA");
    expect(SANNINGSKRAV).toContain("upphäver ALDRIG sanningskravet");
    // …och anvisa vägen ut: skriv om ämnet som generell observation.
    expect(SANNINGSKRAV).toContain("SKRIV OM ÄMNET som en generell observation");
    expect(SANNINGSKRAV).toContain("Vi möter ofta kunder som tvekar länge");
    // Minnesmarkörerna som avslöjar fabrikatet ska nämnas vid namn.
    for (const markor of ["jag minns", "en av våra kunder", "häromdagen"]) {
      expect(SANNINGSKRAV.toLowerCase(), markor).toContain(markor);
    }
  });

  it("A2-skärpningen följer med i varje syfte (plattformsregel, inte flödesregel)", async () => {
    for (const syfte of ["caption", "studio-text", "linkedin", "blogg", "veckoplan"] as const) {
      const b = await byggTextPrompt({ ...BAS, syfte });
      expect(b.system, syfte).toContain("ÄMNET ÄR INGET MANDAT ATT FABRICERA");
    }
    const anon = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", datum: FAST_DATUM_JULI });
    expect(anon.system).toContain("ÄMNET ÄR INGET MANDAT ATT FABRICERA");
  });

  it("ligger sent (väger tyngst): efter klientens förbjudna ord, före formatkravet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", jsonSchema: "{}" });
    const i = b.system.indexOf("=== SANNINGSKRAV");
    expect(i).toBeGreaterThan(b.system.indexOf("=== FÖRBJUDNA ORD FÖR DEN HÄR KLIENTEN"));
    expect(i).toBeLessThan(b.system.indexOf("=== SVARSFORMAT"));
    expect(b.system.split("=== SANNINGSKRAV").length - 1).toBe(1); // exakt en gång
  });
});

describe("T-6c — variation: variantregeln, rotationsregeln och NYLIGEN ANVÄNT", () => {
  it("VARIANTREGEL listar retoriska ingångar och förbjuder delad tankefigur/öppningsfras", () => {
    const low = VARIANTREGEL.toLowerCase();
    for (const ingang of ["mytkrossning", "kundscenario", "konkret siffra", "målgruppsvinkel", "hantverksstolthet", "före/efter"]) {
      expect(low, ingang).toContain(ingang);
    }
    expect(VARIANTREGEL).toContain("öppningsfras");
    expect(VARIANTREGEL).toContain("tankefigur");
  });

  it("rotationsregeln följer med profillagret (rotera mellan tenantens sanningar)", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    expect(b.system).toContain("ROTATION: bygg inte varje text på samma profilfakta");
    expect(b.meta.lager.rotation).toBe(true);
    // Ligger ihop med profilen — före rösten.
    expect(b.system.indexOf("ROTATION:")).toBeGreaterThan(b.system.indexOf("=== KLIENTENS VARUMÄRKESPROFIL ==="));
    expect(b.system.indexOf("ROTATION:")).toBeLessThan(b.system.indexOf("=== KUNDENS RÖST"));
  });

  it("utan clientId: ingen rotationsregel (ingen profil att rotera i)", async () => {
    const b = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", datum: FAST_DATUM_JULI });
    expect(b.system).not.toContain("ROTATION:");
    expect(b.meta.lager.rotation).toBeUndefined();
  });

  it("nyligen renderas som NYLIGEN ANVÄNT — trimmat, tak 20, långa hookar klipps", async () => {
    const manga = Array.from({ length: 30 }, (_, i) => `  Hook nummer ${i}${i === 3 ? " x".repeat(200) : ""}  `);
    const b = await byggTextPrompt({ ...BAS, syfte: "veckoplan", nyligen: manga });
    expect(b.system).toContain("=== NYLIGEN ANVÄNT — undvik dessa ingångar/öppningar ===");
    expect(b.system).toContain("- Hook nummer 0");
    expect(b.system).toContain("- Hook nummer 19");
    expect(b.system).not.toContain("Hook nummer 20");
    expect(b.meta.lager.nyligen).toBe(true);
    // 160-teckenstaket per hook
    for (const rad of b.system.split("\n")) {
      if (rad.startsWith("- Hook nummer 3")) expect(rad.length).toBeLessThanOrEqual(162);
    }
  });

  it("tom eller utebliven nyligen ger inget block", async () => {
    const b1 = await byggTextPrompt({ ...BAS, syfte: "veckoplan" });
    const b2 = await byggTextPrompt({ ...BAS, syfte: "veckoplan", nyligen: ["", "   "] });
    expect(b1.system).not.toContain("NYLIGEN ANVÄNT");
    expect(b2.system).not.toContain("NYLIGEN ANVÄNT");
    expect(b2.meta.lager.nyligen).toBeUndefined();
  });

  it("nyligen-blocket är kontext: före anatomin", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "veckoplan", nyligen: ["En gammal hook"] });
    expect(b.system.indexOf("NYLIGEN ANVÄNT")).toBeLessThan(b.system.indexOf("=== INLÄGGSANATOMI"));
  });
});

describe("compass-defaults", () => {
  it("linkedin utan compass defaultar mjukt till MOFU", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "linkedin" });
    expect(b.system).toContain("FUNNEL (MOFU)");
    expect(b.system).toContain("förvald");
  });

  it("veckoplan utan compass får ingen funnel-default", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "veckoplan" });
    expect(b.system).not.toContain("FUNNEL (");
    expect(b.system).toContain("=== INLÄGGSANATOMI (följ i ordning) ===");
  });

  it("uttryckliga compass-parametrar vinner över defaulten", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", compass: { funnel: "bofu", four_a: null, disc: [] } });
    expect(b.system).toContain("FUNNEL (BOFU)");
    expect(b.system).not.toContain("förvald");
  });
});

describe("klientens förbjudna ord — hårt block sist (T-5)", () => {
  it("förbjudna ord ligger som eget block EFTER skrivreglerna, FÖRE formatkravet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", jsonSchema: "{}" });
    const forbjudna = b.system.indexOf("=== FÖRBJUDNA ORD FÖR DEN HÄR KLIENTEN");
    expect(forbjudna).toBeGreaterThan(b.system.indexOf("=== GLOBALA SKRIVREGLER"));
    expect(forbjudna).toBeLessThan(b.system.indexOf("=== SVARSFORMAT"));
    expect(b.system).toContain("Använd ALDRIG: kraftfull");
    expect(b.meta.lager.forbjudnaOrd).toBe(true);
  });

  it("hittaForbjudnaOrd träffar på ordgräns, inte delsträng", async () => {
    const { hittaForbjudnaOrd } = await import("@/lib/content/writing-rules");
    expect(hittaForbjudnaOrd("En riktigt billig skärm.", ["billig", "deal"])).toEqual(["billig"]);
    expect(hittaForbjudnaOrd("En idealisk lösning.", ["deal"])).toEqual([]);
    expect(hittaForbjudnaOrd("", ["deal"])).toEqual([]);
  });
});

describe("skrivregler-flaggan styr båda lagren", () => {
  it("flagga av: inget regelblock i prompten, men floskelgolvet består i saneringen", async () => {
    skrivreglerPaMock.mockResolvedValue(false);
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    expect(b.system).not.toContain("GLOBALA SKRIVREGLER");
    const ut = await saneraText("En kraftfull lösning – för alla.", "klient-1");
    expect(ut).toContain("stark");
    expect(ut).toContain("–"); // tankstrecksregeln hoppar när flaggan är av
  });

  it("flagga på: full sanering (tankstreck, floskler, hashtag-tak)", async () => {
    const ut = await saneraText("Grym – riktigt kraftfull!\n#a #b #c #d #e #f #g", "klient-1", "linkedin");
    expect(ut).not.toMatch(/\s–\s/);
    expect(ut).toContain("stark");
    expect((ut.match(/#\w+/g) || []).length).toBe(3); // LinkedIn-taket
  });
});

describe("klippProfil — fast prioritet", () => {
  it("Tonregler, GÖR/GÖR INTE och USP överlever; Story-bank klipps först; meta listar klippen", () => {
    // 1400 (var 900): fixturen växte med F1-sektionerna, så "måttligt klipp" ligger
    // på en högre siffra nu. Avsikten är oförändrad — Customer Voice ska överleva.
    const { text, klippta } = klippProfil(PROFIL_MD, 1400);
    expect(text).toContain("## Tonregler");
    expect(text).toContain("## GÖR\n");
    expect(text).toContain("## GÖR INTE");
    expect(text).toContain("## USP");
    expect(klippta[0]).toBe("Story-bank");
    expect(text).not.toContain("Story-bank");
    expect(klippta.length).toBeGreaterThan(1);
    // Justeringsrundan v2: Customer Voice bär klientens ordförråd och överlever
    // ett måttligt klipp (klipps först efter Sekundär ICP).
    expect(text).toContain("det bara funkar");
  });

  it("Customer Voice klipps EFTER Sekundär ICP (röstviktad ordning, v2)", () => {
    const { klippta } = klippProfil(PROFIL_MD, 300);
    expect(klippta[0]).toBe("Story-bank");
    expect(klippta).toContain("Sekundär ICP");
    expect(klippta).toContain("Customer Voice");
    expect(klippta.indexOf("Customer Voice")).toBeGreaterThan(klippta.indexOf("Sekundär ICP"));
  });

  it("profil under taket klipps inte alls", () => {
    const { text, klippta } = klippProfil(PROFIL_MD, 100000);
    expect(text).toBe(PROFIL_MD);
    expect(klippta).toEqual([]);
  });

  // PROFIL-1/F1: de nykopplade fälten är konkreta och klientunika. Priser och
  // CTA-väg står inte i KLIPPORDNING alls (överlever alltid), tjänster/
  // differentiering klipps sent — efter allt allmänt material.
  it("F1: verifierade priser och CTA-vägen överlever även ett hårt klipp", () => {
    const { text } = klippProfil(PROFIL_MD, 700);
    expect(text).toContain("## Erbjudande: priser (verifierade siffror)");
    expect(text).toContain("21 000 kr");
    expect(text).toContain("## Erbjudande: CTA-väg (bokningslänk)");
  });

  it("F1: allmänt material klipps före tjänster och differentiering", () => {
    const { klippta } = klippProfil(PROFIL_MD, 1200);
    for (const tidigt of ["Story-bank", "Kundresa", "Konkurrenter"]) {
      expect(klippta, tidigt).toContain(tidigt);
    }
    const sent = ["Erbjudande: tjänster och produkter", "Differentiering"];
    for (const namn of sent) {
      if (klippta.includes(namn)) {
        expect(klippta.indexOf(namn)).toBeGreaterThan(klippta.indexOf("Konkurrenter"));
      }
    }
    // Priser/CTA-väg får ALDRIG hamna i klipplistan.
    expect(klippta).not.toContain("Erbjudande: priser (verifierade siffror)");
    expect(klippta).not.toContain("Erbjudande: CTA-väg (bokningslänk)");
  });

  it("F1: profiler under det nya taket (11000) klipps inte alls", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption" });
    expect(b.meta.profilKlippt).toEqual([]);
    expect(b.system).toContain("## Erbjudande: priser (verifierade siffror)");
  });

  it("byggTextPrompt exponerar klippen i meta.profilKlippt", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", maxProfilTecken: 900 });
    expect(b.meta.profilKlippt[0]).toBe("Story-bank");
  });
});
