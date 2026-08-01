// KVALITET-3 / punkt 5 — prisregeln.
//
// Beslut (Håkan): inga priser eller prisuppgifter för tenantens EGNA produkter och
// tjänster i genererade inlägg, captions eller bildtexter. Värdet beskrivs i texten,
// priset tas i samtalet eller offerten dit CTA:n leder.
//
// Verifierat brott: en caption innehöll "kostar från 21 000 kr" och "43-tums".
//
// ⚠ Kontext: PROFIL-1/F1 kopplade in pricing_notes i lager 3, så modellen SER nu
// riktiga priser i profilen och den befintliga siffergrinden (som backar tal mot
// profilen) släpper dem igenom. Regeln behövs alltså mer än förut, och den måste
// skilja SANNINGSUNDERLAG från CITATMATERIAL.
//
// Avgränsning som testas: BILD-7:s regel om avbildad demo-skyltning ("DAGENS LUNCH
// 129 KR" på en skärm i motivet) ligger i bildprompten (lib/images.ts) och får inte
// dras in i textprompten.
//
// All DB mockas; testerna kör utan nycklar och utan nät.

import { describe, expect, it, vi } from "vitest";

const PROFIL_MD = [
  "# ═══ brand-profile (live från dashboard) ═══",
  "",
  "## Företagsnamn\nDisplayteknik",
  "## Tonregler\nRakt och vänligt.",
  "## Erbjudande: priser (verifierade siffror)\nStartpaket 21 000 kr. Servicebesök 1 850 kr.",
  "## Erbjudande: CTA-väg (bokningslänk)\nhttps://exempel.se/boka",
].join("\n");

vi.mock("@/lib/knowledge", () => ({
  getProfileAsMarkdown: vi.fn(async (_id?: string, opts?: { medVoice?: boolean }) => {
    if (opts?.medVoice !== false) throw new Error("prompt-core ska hämta profilen med medVoice:false");
    return PROFIL_MD;
  }),
  getStaticKnowledge: vi.fn(async (...names: string[]) => names.map((n) => `# ═══ ${n} ═══\n\nStatisk kunskap.`).join("\n\n")),
}));

vi.mock("@/lib/voice-fingerprint", () => ({
  getVoiceFingerprint: vi.fn(async (clientId: string) => ({
    client_id: clientId,
    signature_phrases: [],
    forbidden_words: [],
    tone_summary: "Kort och rak.",
    rhythm_notes: "",
    pain_words: [],
    joy_words: [],
    source_asset_count: 1,
    raw_samples: [],
    built_at: "2026-08-01T00:00:00Z",
  })),
  fingerprintToPromptBlock: vi.fn(() => "=== KUNDENS RÖST (måste imiteras) ===\nTON: Kort och rak."),
}));

vi.mock("@/lib/voice-score", () => ({ fetchWinningExamples: vi.fn(async () => []) }));
vi.mock("@/lib/studio/kit", () => ({
  getKitDirectives: vi.fn(async () => ({ donts: [], imageExtra: "", imageNegative: "", colors: {}, formats: [], signature: {} })),
  dontsRule: () => "",
}));
vi.mock("@/lib/content/writing-rules", async (importOriginal) => {
  const riktig = await importOriginal<typeof import("@/lib/content/writing-rules")>();
  return { ...riktig, skrivreglerPa: async () => true };
});

import { byggTextPrompt, PRISREGEL, prisregelBlock } from "@/lib/prompt-core";

const FAST_DATUM = new Date(2026, 7, 1);
const BAS = { clientId: "klient-1", uppdrag: "=== UPPDRAG ===\nSkriv texten.", datum: FAST_DATUM };

describe("punkt 5 — prisregeln är en plattformsregel", () => {
  it("finns i ALLA syften och även utan clientId", async () => {
    for (const syfte of ["caption", "studio-text", "karusell", "linkedin", "blogg", "nyhetsbrev", "veckoplan", "enskilt", "social", "specialist", "reel", "kanal-anpassning"] as const) {
      const b = await byggTextPrompt({ ...BAS, syfte, underlag: "Ämne: nya skyltar" });
      expect(b.system, syfte).toContain("=== PRISREGEL (hård regel");
      expect(b.meta.lager.prisregel, syfte).toBe(true);
    }
    const anon = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", datum: FAST_DATUM });
    expect(anon.system).toContain("=== PRISREGEL (hård regel");
  });

  it("finns exakt en gång och ligger sent (efter perspektivregeln, före formatkravet)", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", underlag: "Ämne: x", jsonSchema: "{}" });
    expect(b.system.split("=== PRISREGEL").length - 1).toBe(1);
    const i = b.system.indexOf("=== PRISREGEL");
    expect(i).toBeGreaterThan(b.system.indexOf("=== PERSPEKTIV"));
    expect(i).toBeLessThan(b.system.indexOf("=== SVARSFORMAT"));
  });

  it("skiljer sanningsunderlag från citatmaterial (F1-kontexten)", () => {
    expect(PRISREGEL).toContain("SANNINGSUNDERLAG, INTE CITATMATERIAL");
    expect(PRISREGEL).toContain("prisvärt");
    expect(PRISREGEL).toContain("Att känna till priset och att skriva ut priset är två olika saker");
  });

  it("samma grind för specifikationer: tal bara om de står ordagrant i profilen", () => {
    expect(PRISREGEL).toContain("SPECIFIKATIONER");
    expect(PRISREGEL).toContain("ORDAGRANT");
    expect(PRISREGEL.toLowerCase()).toContain("tumtal");
  });
});

describe("punkt 5 — undantaget öppnas bara av användaren", () => {
  it("profilens egna priser öppnar INTE undantaget", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", underlag: "Ämne: varför skyltfönstret säljer" });
    expect(b.system).toContain("=== PRISREGEL");
    expect(b.system).not.toContain("UNDANTAG (gäller i den här körningen)");
    expect(b.meta.lager.prisUndantag).toBeUndefined();
    // …men priserna finns kvar i profillagret: de är sanningsunderlag, inte bortstädade.
    expect(b.system).toContain("21 000 kr");
  });

  it("pris i användarens ämne öppnar undantaget", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", underlag: "Ämne: kampanjen där paketet går på 14 900 kr" });
    expect(b.system).toContain("UNDANTAG (gäller i den här körningen)");
    expect(b.meta.lager.prisUndantag).toBe(true);
  });

  it("anvandarText vinner över underlaget: genererad text i underlaget öppnar inget", async () => {
    const b = await byggTextPrompt({
      ...BAS,
      syfte: "caption",
      // underlaget bär en GENERERAD rubrik med läckt pris …
      underlag: "Rubrik på bilden: Skärmen från 21 000 kr.",
      // … men användaren skrev bara ett ämne utan pris.
      anvandarText: "Ämne: höstens skyltkampanj",
    });
    expect(b.system).not.toContain("UNDANTAG (gäller i den här körningen)");
  });

  it("prisTillatet från flödet öppnar undantaget (reel-mallen Pris rakt ut)", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "reel", underlag: "Idé: visa paketet", prisTillatet: true });
    expect(b.system).toContain("UNDANTAG (gäller i den här körningen)");
    expect(b.meta.lager.prisUndantag).toBe(true);
  });

  it("undantaget öppnar bara för användarens uppgift, aldrig för egna påhitt", () => {
    const med = prisregelBlock(true);
    expect(med).toContain("ordagrant som användaren angav den");
    expect(med).toContain("Lägg aldrig till egna priser");
    expect(prisregelBlock(false)).not.toContain("UNDANTAG (gäller i den här körningen)");
  });
});

describe("punkt 5 — avgränsning mot BILD-7 (avbildad demo-skyltning)", () => {
  it("textprompten innehåller inte BILD-7:s budskapsregel", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "studio-text", underlag: "Ämne: lunchskylten" });
    expect(b.system).not.toContain("AVBILDAD SKYLTNING");
    expect(b.system).not.toContain("DAGENS LUNCH 129 KR");
  });

  it("BILD-7:s regel lever kvar oförändrad i bildprompten", async () => {
    // Regeln är intern i lib/images.ts (ingen export) — verifiera mot filens innehåll
    // i stället för att tvinga fram en API-ändring i en fil punkt 5 inte äger.
    const { readFileSync } = await import("node:fs");
    const kalla = readFileSync("lib/images.ts", "utf8");
    expect(kalla).toContain("DAGENS LUNCH 129 KR");
    expect(kalla).toContain("AVBILDAD SKYLTNING SKA BÄRA ETT BUDSKAP");
  });
});

describe("punkt 5 — regeln fungerar lika för varje bransch", () => {
  it("ingen branschterm är villkor: regeln nämner klientens egna produkter generellt", () => {
    expect(PRISREGEL).toContain("klientens egna produkter och tjänster");
    // Inga tenant-namn i regeltexten.
    for (const namn of ["Displayteknik", "HM Motor", "Engens", "Annas Blommor", "Opticur"]) {
      expect(PRISREGEL, namn).not.toContain(namn);
    }
  });
});
