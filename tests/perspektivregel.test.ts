// KVALITET-3 / punkt 4 — perspektivregeln.
//
// Verifierat fel i skarp drift: en studio-text löd "Tills vi satte upp skärmen skrev vi
// menyn för hand... nu hinner vi laga mat istället". Texten talade SOM restaurangen,
// alltså som tenantens KUND, i stället för som tenanten som säljer skärmen.
//
// Regeln är en plattformsregel: den ska nå VARJE flöde och varje bransch. Testet kör
// därför ett scenario-ämne som frestar till perspektivbyte (kundens vardag före/efter)
// och kontrollerar att regeln finns i prompten, exakt en gång, sent nog att väga tyngst.
// All DB mockas; testerna kör utan nycklar och utan nät.

import { describe, expect, it, vi } from "vitest";

const PROFIL_MD = [
  "# ═══ brand-profile (live från dashboard) ═══",
  "",
  "## Företagsnamn\nDisplayteknik",
  "## USP (det som skiljer oss)\nEgen montage och service",
  "## Tonregler\nRakt och vänligt.",
  "## Primär ICP\nRestauranger och butiker",
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

import { byggTextPrompt, PERSPEKTIVREGEL } from "@/lib/prompt-core";

const FAST_DATUM = new Date(2026, 7, 1);

// Scenario-ämnet som frestar till perspektivbyte: hela ämnet är formulerat ur
// KUNDENS vardag, vilket är exakt det som fick modellen att byta avsändare skarpt.
const FRESTANDE_AMNE =
  "Ämne: Innan skärmen sattes upp skrevs dagens lunch för hand på en tavla varje morgon. Så ser vardagen ut efteråt.";

const BAS = {
  clientId: "klient-1",
  uppdrag: "=== UPPDRAG ===\nSkriv texten.",
  underlag: FRESTANDE_AMNE,
  datum: FAST_DATUM,
};

describe("punkt 4 — perspektivregeln når prompten", () => {
  it("scenario-ämnet som frestar till perspektivbyte får regeln, exakt en gång", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "studio-text" });
    expect(b.system).toContain("=== PERSPEKTIV (hård regel — vem som talar) ===");
    expect(b.system.split("=== PERSPEKTIV").length - 1).toBe(1);
    expect(b.meta.lager.perspektiv).toBe(true);
    // Ämnet ligger kvar i underlaget — regeln ska alltså gälla TROTS frestelsen.
    expect(b.user).toBe(FRESTANDE_AMNE);
  });

  it("regeln finns i ALLA syften och även utan clientId (plattformsregel)", async () => {
    for (const syfte of ["caption", "studio-text", "karusell", "linkedin", "blogg", "nyhetsbrev", "veckoplan", "enskilt", "social", "specialist", "reel", "kanal-anpassning"] as const) {
      const b = await byggTextPrompt({ ...BAS, syfte });
      expect(b.system, syfte).toContain("=== PERSPEKTIV (hård regel");
    }
    const anon = await byggTextPrompt({ clientId: null, syfte: "social", uppdrag: "U", datum: FAST_DATUM });
    expect(anon.system).toContain("=== PERSPEKTIV (hård regel");
    expect(anon.meta.lager.perspektiv).toBe(true);
  });

  it("regeln namnger både avsändaren, det verifierade felet och kontrollfrågan", () => {
    expect(PERSPEKTIVREGEL).toContain("SOM klienten");
    expect(PERSPEKTIVREGEL).toContain("TILL klientens kund");
    // Det skarpa felet, ordagrant, så modellen känner igen mönstret.
    expect(PERSPEKTIVREGEL).toContain("Tills vi satte upp skärmen");
    expect(PERSPEKTIVREGEL).toContain("TREDJE PERSON");
    expect(PERSPEKTIVREGEL).toContain("restaurangägare berättar att");
    expect(PERSPEKTIVREGEL).toContain("KONTROLLFRÅGA");
    // Citat kräver täckning — griper i sanningskravet.
    expect(PERSPEKTIVREGEL).toContain("story-banken");
  });

  it("ligger sent: efter sanningskravet, före formatkravet", async () => {
    const b = await byggTextPrompt({ ...BAS, syfte: "caption", jsonSchema: '{ "caption": "..." }' });
    const i = b.system.indexOf("=== PERSPEKTIV");
    expect(i).toBeGreaterThan(b.system.indexOf("=== SANNINGSKRAV"));
    expect(i).toBeLessThan(b.system.indexOf("=== SVARSFORMAT"));
  });

  it("regeln gäller lika för blomsteraffär, bilhandlare och coach (ingen tenant-hårdkodning)", () => {
    // Ingen branschterm får vara ett VILLKOR i regeln — restaurangexemplet är just
    // ett exempel, och regeltexten ska stå på egna ben utan det.
    const utanExempel = PERSPEKTIVREGEL.split("\n").filter((r) => !r.includes("Tills vi satte upp") && !r.includes("restaurangägare"));
    expect(utanExempel.join("\n")).toContain("ALLTID SOM klienten");
    expect(utanExempel.join("\n")).toContain("KONTROLLFRÅGA");
  });
});
