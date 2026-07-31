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
  "## Tonregler\nRakt och vänligt. Inga floskler.",
  "## Primär ICP\nSmåföretagare",
  "## Sekundär ICP\nCoacher",
  "## Smärtpunkter kunden har\nTidsbrist",
  "## Kundresa\nLång text om kundresan. ".repeat(20).trim(),
  "## Konkurrenter\nKonkurrent AB. ".repeat(20).trim(),
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

import { anatomiBlock, byggTextPrompt, klippProfil, saneraText } from "@/lib/prompt-core";
import { POST_ANATOMY } from "@/lib/content-compass/prompt";

const BAS = { clientId: "klient-1", uppdrag: "=== UPPDRAG ===\nSkriv en caption.", underlag: "Ämne: vårkampanj" };

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
    const { text, klippta } = klippProfil(PROFIL_MD, 900);
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

  it("byggTextPrompt exponerar klippen i meta.profilKlippt", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", maxProfilTecken: 900 });
    expect(b.meta.profilKlippt[0]).toBe("Story-bank");
  });
});
