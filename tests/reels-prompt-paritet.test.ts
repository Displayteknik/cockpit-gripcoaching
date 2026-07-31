// Paritetstest för reels-manusmotorn (TEXT-1 T-3, FACIT-flöde — får inte bli sämre).
// Bygger nya systemprompten via byggReelPrompt (prompt-core) och verifierar att VARJE
// innehållsblock ur den gamla handbyggda prompten finns kvar — plus att inget lager
// dubblerats och att JSON-schemat ligger allra sist. DB mockas; kör utan nycklar/nät.

import { describe, expect, it, vi } from "vitest";

// ── Mockar (samma mönster som tests/prompt-core.test.ts) ─────────────────────
vi.mock("@/lib/knowledge", () => ({
  getProfileAsMarkdown: vi.fn(async (_id?: string, opts?: { medVoice?: boolean }) => {
    if (opts?.medVoice !== false) throw new Error("prompt-core ska hämta profilen med medVoice:false");
    return "# ═══ brand-profile (live från dashboard) ═══\n\n## Företagsnamn\nTestbolaget\n## USP (det som skiljer oss)\nSnabbast i test\n## Tonregler\nRakt och vänligt.";
  }),
  getStaticKnowledge: vi.fn(async (...names: string[]) => names.map((n) => `# ═══ ${n} ═══\n\nStatisk kunskap om hooks.`).join("\n\n")),
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
  NEUTRAL_DIRECTIVES: { imageExtra: "", imageNegative: "", donts: [], colors: {}, formats: [], signature: {} },
  getKitDirectives: vi.fn(async () => ({
    donts: ["neonfärger", "utropstecken"],
    imageNegative: "neon signs, cluttered backgrounds",
    imageExtra: "",
    colors: {},
    formats: [],
    signature: {},
  })),
  dontsRule: (donts: string[]) => (donts.length ? `\nKUNDENS VILL-INTE-HA (följ strikt): ${donts.join("; ")}.` : ""),
}));

vi.mock("@/lib/content/writing-rules", async (importOriginal) => {
  const riktig = await importOriginal<typeof import("@/lib/content/writing-rules")>();
  return { ...riktig, skrivreglerPa: vi.fn(async () => true) };
});

import { byggReelPrompt } from "@/lib/studio/reels-generate";
import { POST_ANATOMY } from "@/lib/content-compass/prompt";
import { REEL_TEMPLATES } from "@/lib/studio/reels";

const OPTS = { clientId: "klient-1", ide: "Sommarkampanj på skyltar", templateKey: "fore-efter" as const, disc: ["D" as const] };

describe("reels-prompt paritet (facit: gamla promptens block finns kvar)", () => {
  it("varje innehållsblock ur gamla prompten finns i nya systemprompten", async () => {
    const { system, mall } = await byggReelPrompt(OPTS);

    // Rollrad + låst manusprincip
    expect(system).toContain("Du skriver manus till korta vertikala videor");
    expect(system).toContain("Du bestämmer aldrig antal scener, scenlängder eller övergångar");
    // Hook-playbook (statisk kunskap, med scen 1-koppling i uppdraget)
    expect(system).toContain("═══ hook-playbook ═══");
    expect(system).toContain("Hook-playbooken nedan använder du för scen 1");
    // Varumärkesprofil
    expect(system).toContain("=== KLIENTENS VARUMÄRKESPROFIL ===");
    expect(system).toContain("Testbolaget");
    // Röst + winning (låg förr i profilen via getProfileAsMarkdown — nu lager 4–5)
    expect(system).toContain("=== KUNDENS RÖST");
    expect(system).toContain("=== VINNANDE EXEMPEL");
    // Anatomi 1–4 (contentCompassBlock)
    expect(system).toContain(POST_ANATOMY.hook);
    expect(system).toContain(POST_ANATOMY.story);
    expect(system).toContain(POST_ANATOMY.nytta);
    expect(system).toContain(POST_ANATOMY.cta);
    // Funnel/4A/DISC för en mall med värden (fore-efter: mofu + aspirational, disc D)
    expect(mall.funnel).toBe("mofu");
    expect(system).toContain("FUNNEL (MOFU)");
    expect(system).toContain("4A (aspirational)");
    expect(system).toContain("DISC-TON: D (");
    // Scenstruktur (låst antal scener)
    expect(system).toContain(`=== SCENSTRUKTUR FÖR MALLEN "${mall.name}" (LÅST: exakt ${mall.scenes.length} scener`);
    for (const s of mall.scenes) expect(system).toContain(s.roll);
    // Overlay-regler
    expect(system).toContain("=== OVERLAY-TEXT (orden som bränns in i videon) ===");
    expect(system).toContain("Inga hashtags, inga emoji, inga citattecken och inga tankstreck i overlay-text");
    // Bildbeskrivning inkl. imageNegative-texten
    expect(system).toContain("=== BILDBESKRIVNING (imagePrompt, en per scen) ===");
    expect(system).toContain("MOTIVET MÅSTE STÄMMA MED SCENENS TEXT");
    expect(system).toContain("Undvik i motivet: neon signs, cluttered backgrounds");
    // Caption-regler
    expect(system).toContain("=== CAPTION (texten under inlägget, inte i videon) ===");
    expect(system).toContain("exakt EN uppmaning sist");
    // Ärlighet
    expect(system).toContain("=== ÄRLIGHET ===");
    expect(system).toContain("Hitta ALDRIG på priser, siffror, kundnamn eller resultat");
    // Donts (kärnans lager 7 — reel är bildnära)
    expect(system).toContain("KUNDENS VILL-INTE-HA");
    // Skrivregler
    expect(system).toContain("=== GLOBALA SKRIVREGLER");
  });

  it("JSON-schemat ligger ALLRA sist och matchar mallens scenantal", async () => {
    const { system, mall } = await byggReelPrompt(OPTS);
    const format = system.indexOf("=== SVARSFORMAT");
    expect(format).toBeGreaterThan(-1);
    // Inga andra blockrubriker efter formatkravet.
    expect(system.slice(format + 1)).not.toMatch(/\n=== [A-ZÅÄÖ]/);
    // Schemat kräver exakt mallens antal scener.
    const schema = system.slice(format);
    expect((schema.match(/"imagePrompt"/g) || []).length).toBe(mall.scenes.length);
    expect(schema).toContain('"title"');
    expect(schema).toContain('"caption"');
  });

  it("ingen dubblett av skrivregler, profil eller röst", async () => {
    const { system } = await byggReelPrompt(OPTS);
    for (const m of ["=== GLOBALA SKRIVREGLER", "=== KLIENTENS VARUMÄRKESPROFIL ===", "=== KUNDENS RÖST", "=== VINNANDE EXEMPEL", "KUNDENS VILL-INTE-HA"]) {
      expect(system.split(m).length - 1, m).toBe(1);
    }
    // Anatomin exakt en gång (Compass-blocket) — ingen extra bar anatomi ovanpå.
    expect(system.split("INLÄGGSANATOMI").length - 1).toBe(1);
  });

  it("okänd mall kastar begripligt fel", async () => {
    await expect(byggReelPrompt({ ...OPTS, templateKey: "finns-inte" as keyof typeof REEL_TEMPLATES })).rejects.toThrow("Okänd mall");
  });
});
