// AKUT-DM — svarsförslagen i Lobbyn ska ha FULLT skydd men INGET CTA-golv.
//
// Bakgrund (G-0, 2026-08-09): /api/lobby/suggest-reply byggde sin egen prompt med bara
// ett röstblock. Sanningskravet, prisregeln, perspektivregeln och klientens förbjudna ord
// fanns inte där — och det här är den text i hela plattformen som går rakast till en
// riktig människa: en betalande kunds lead, i en inkorg. Ett påhittat pris eller ett
// uppfunnet kundminne kostar mer här än i ett inlägg.
//
// Håkans beslut: full lagertäckning, ingen CTA-tvingning (fel kontext för golvet — ett
// svar i en inkorg som slutar med "Boka via länken" läser som en annons).
// All DB mockas; testerna kör utan nycklar och utan nät.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/knowledge", () => ({
  getProfileAsMarkdown: vi.fn(async () => [
    "# ═══ brand-profile ═══",
    "## Företagsnamn\nTestbolaget",
    "## Tonregler\nRakt och vänligt.",
    "## Erbjudande: priser (verifierade siffror)\nStartpaket 21 000 kr.",
  ].join("\n")),
  getStaticKnowledge: vi.fn(async () => ""),
}));

vi.mock("@/lib/voice-fingerprint", () => ({
  getVoiceFingerprint: vi.fn(async (clientId: string) => ({
    client_id: clientId,
    signature_phrases: ["kör vi"],
    forbidden_words: ["kraftfull"],
    tone_summary: "Kort och rak.",
    rhythm_notes: "",
    pain_words: [],
    joy_words: [],
    source_asset_count: 3,
    raw_samples: [],
    built_at: "2026-08-09T00:00:00Z",
  })),
  fingerprintToPromptBlock: vi.fn(() => "=== KUNDENS RÖST (måste imiteras) ===\nTON: Kort och rak."),
}));

const fetchWinningExamplesMock = vi.fn(async () => ["Ett vinnande INLÄGG med hook och avslutande uppmaning."]);
vi.mock("@/lib/voice-score", () => ({ fetchWinningExamples: (...a: unknown[]) => fetchWinningExamplesMock(...(a as [])) }));

vi.mock("@/lib/studio/kit", () => ({
  getKitDirectives: vi.fn(async () => ({ donts: [], imageExtra: "", imageNegative: "", colors: {}, formats: [], signature: {} })),
  dontsRule: () => "",
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
  supabaseServer: () => ({}),
}));

import { anatomiBlock, byggTextPrompt } from "@/lib/prompt-core";

const FAST_DATUM = new Date(2026, 7, 9);
const DM = {
  clientId: "klient-1",
  syfte: "dm-svar" as const,
  uppdrag: "=== UPPDRAG ===\nSkriv tre svarsförslag.",
  underlag: "KONTAKT:\n- Namn: Anna\n- Senaste meddelande från kontakten: Hej, vad kostar en skylt?",
  datum: FAST_DATUM,
};

describe("AKUT-DM — dialoganatomin ersätter CTA-golvet", () => {
  it("dm-svar får dialoganatomin, inte inläggsanatomin", async () => {
    const b = await byggTextPrompt(DM);
    expect(b.system).toContain("=== SVARETS ANATOMI");
    expect(b.system).not.toContain("=== INLÄGGSANATOMI");
  });

  it("CTA-golvet läggs ALDRIG på ett dm-svar", async () => {
    const b = await byggTextPrompt(DM);
    expect(b.system).not.toContain("CTA-golv");
    expect(b.system).toContain("INGEN CTA-REGEL GÄLLER HÄR");
  });

  // ★ Fyndet som testet gjorde: de GLOBALA skrivreglernas regel 4 sa "exakt EN uppmaning
  // per inlägg, alltid sist" samtidigt som dialoganatomin förbjöd uppmaningen. Två regler
  // om samma sak i samma instruktion — exakt felet FIX-1 grupp A stängde. Modellen följer
  // tillståndet, inte förbudet, och utfallet blir slumpmässigt.
  it("skrivreglernas CTA-regel når inte heller ett dm-svar", async () => {
    const b = await byggTextPrompt(DM);
    expect(b.system).not.toContain("exakt EN uppmaning");
    expect(b.system).toContain("INGA HASHTAGS");
    // Regel 1 är språk, inte format, och gäller överallt.
    expect(b.system).toContain("TANKSTRECK");
  });

  it("ett inlägg har kvar hela skrivregelblocket", async () => {
    const b = await byggTextPrompt({ ...DM, syfte: "caption" });
    expect(b.system).toContain("exakt EN uppmaning per inlägg");
    expect(b.system).toContain("3. HASHTAGS");
  });

  it("anatomiBlock('dialog') är oberoende av compass — funnel kan inte smyga in ett golv", () => {
    const block = anatomiBlock("dialog", { funnel: "bofu", four_a: "actionable", disc: ["D"] });
    expect(block).toContain("=== SVARETS ANATOMI");
    expect(block).not.toContain("BOFU-CTA-MALL");
    expect(block).not.toContain("CTA-golv");
  });

  it("ett inlägg har kvar sitt CTA-golv — etappen får inte läcka till andra syften", async () => {
    const b = await byggTextPrompt({ ...DM, syfte: "caption" });
    expect(b.system).toContain("CTA-golv");
  });
});

describe("AKUT-DM — allt skydd gäller", () => {
  it("sanningskrav, perspektiv, prisregel och röst finns i prompten", async () => {
    const b = await byggTextPrompt(DM);
    for (const markor of [
      "=== SANNINGSKRAV",
      "=== PERSPEKTIV",
      "=== PRISREGEL",
      "=== KUNDENS RÖST",
      "=== KLIENTENS VARUMÄRKESPROFIL ===",
    ]) {
      expect(b.system, markor).toContain(markor);
    }
    expect(b.meta.lager.sanningskrav).toBe(true);
    expect(b.meta.lager.perspektiv).toBe(true);
    expect(b.meta.lager.prisregel).toBe(true);
    expect(b.meta.lager.rost).toBe(true);
  });

  it("klientens förbjudna ord ligger med som hårt block", async () => {
    const b = await byggTextPrompt(DM);
    expect(b.system).toContain("FÖRBJUDNA ORD FÖR DEN HÄR KLIENTEN");
    expect(b.system).toContain("kraftfull");
  });

  it("profilens priser öppnar ALDRIG prisundantaget", async () => {
    // Profilen ovan innehåller "21 000 kr". Undantaget får bara öppnas av det kontakten
    // eller användaren själv skrev — annars vore prisregeln meningslös.
    const b = await byggTextPrompt(DM);
    expect(b.meta.lager.prisUndantag).toBeUndefined();
    expect(b.system).not.toContain("UNDANTAG (gäller i den här körningen)");
  });

  it("skrev kontakten själv ett pris öppnas undantaget för just den uppgiften", async () => {
    const b = await byggTextPrompt({ ...DM, anvandarText: "Ni sa 21 000 kr, gäller det fortfarande?" });
    expect(b.meta.lager.prisUndantag).toBe(true);
  });
});

describe("AKUT-DM — vinnande exempel hålls utanför", () => {
  it("inläggsexempel matas inte in som förebild för ett svar", async () => {
    fetchWinningExamplesMock.mockClear();
    const b = await byggTextPrompt(DM);
    // Lagret säger "matcha denna kvalitet" och exemplen ÄR inlägg — de drar svaret mot
    // rubrik, hook och avslutande uppmaning, precis det dialoganatomin förbjuder.
    expect(fetchWinningExamplesMock).not.toHaveBeenCalled();
    expect(b.system).not.toContain("=== VINNANDE EXEMPEL");
    expect(b.winning).toEqual([]);
  });

  it("men ett vanligt inlägg får dem fortfarande", async () => {
    fetchWinningExamplesMock.mockClear();
    const b = await byggTextPrompt({ ...DM, syfte: "caption" });
    expect(fetchWinningExamplesMock).toHaveBeenCalled();
    expect(b.system).toContain("=== VINNANDE EXEMPEL");
  });
});
