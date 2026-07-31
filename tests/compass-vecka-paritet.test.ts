// Paritetstest för Compass-veckan (TEXT-1 T-3, FACIT-flöde — får inte bli sämre).
// Bygger nya systemprompten via byggCompassVeckaPrompt (prompt-core) och verifierar att
// varje innehållsblock ur den gamla handbyggda prompten finns kvar: per-dag-Compass-block,
// hook-regler, kundfakta (nu via kärnans brand-profil-lager), röst, kvalitetskrav — samt
// exakt EN skrivregel-förekomst och JSON-schemat allra sist. DB mockas.

import { describe, expect, it, vi } from "vitest";

// ── Mockar (samma mönster som tests/prompt-core.test.ts) ─────────────────────
vi.mock("@/lib/knowledge", () => ({
  getProfileAsMarkdown: vi.fn(async (_id?: string, opts?: { medVoice?: boolean }) => {
    if (opts?.medVoice !== false) throw new Error("prompt-core ska hämta profilen med medVoice:false");
    return [
      "# ═══ brand-profile (live från dashboard) ═══",
      "",
      "## Företagsnamn\nTestbolaget",
      "## Plats\nÖrnsköldsvik",
      "## USP (det som skiljer oss)\nSnabbast i test",
      "## Primär ICP\nSmåföretagare",
      "## Smärtpunkter kunden har\nTidsbrist",
    ].join("\n");
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

vi.mock("@/lib/content/writing-rules", async (importOriginal) => {
  const riktig = await importOriginal<typeof import("@/lib/content/writing-rules")>();
  return { ...riktig, skrivreglerPa: vi.fn(async () => true) };
});

import { byggCompassVeckaPrompt } from "@/lib/content-compass/vecka-prompt";
import { POST_ANATOMY, BOFU_CTA_MALL } from "@/lib/content-compass/prompt";
import { KANE_HOOK_RULES } from "@/lib/content-framework";
import type { PlannedPost } from "@/lib/content-compass/rules";

const POSTS: PlannedPost[] = [
  { dayKey: "tue" as PlannedPost["dayKey"], dayLabel: "Tisdag", date: "2026-08-04T09:00:00.000Z", funnel: "mofu", four_a: "aspirational", disc: ["I"] },
  { dayKey: "thu" as PlannedPost["dayKey"], dayLabel: "Torsdag", date: "2026-08-06T09:00:00.000Z", funnel: "bofu", four_a: "actionable", disc: ["D"] },
];

describe("compass-veckan paritet (facit: gamla promptens block finns kvar)", () => {
  it("alla gamla innehållsblock finns i nya systemprompten", async () => {
    const b = await byggCompassVeckaPrompt("klient-1", "Sommartema", POSTS);

    // Rollraden
    expect(b.system).toContain("Du skriver en hel veckas innehåll enligt kundens Content Compass");
    // KUND-blocket ersatt av kärnans brand-profil-lager — kundfakta finns kvar
    expect(b.system).toContain("=== KLIENTENS VARUMÄRKESPROFIL ===");
    expect(b.system).toContain("Testbolaget");
    expect(b.system).toContain("Snabbast i test");
    // Per-dag-Compass-blocken (flödesdata) med anatomi + funnel/4A/DISC per dag
    expect(b.system).toContain("═══ VECKANS INLÄGG (följ Compass-blocket för varje) ═══");
    expect(b.system).toContain("── INLÄGG 1 (Tisdag");
    expect(b.system).toContain("── INLÄGG 2 (Torsdag");
    expect(b.system).toContain("FUNNEL (MOFU)");
    expect(b.system).toContain("FUNNEL (BOFU)");
    expect(b.system).toContain("4A (aspirational)");
    expect(b.system).toContain("4A (actionable)");
    expect(b.system).toContain("DISC-TON: I (");
    expect(b.system).toContain("DISC-TON: D (");
    expect(b.system).toContain(BOFU_CTA_MALL);
    expect(b.system).toContain(POST_ANATOMY.hook);
    expect(b.system).toContain(POST_ANATOMY.cta);
    // Hook-reglerna
    expect(b.system).toContain("═══ HOOK-REGLER ═══");
    expect(b.system).toContain(KANE_HOOK_RULES.trim().slice(0, 40));
    // Rösten (förr voiceBlock i handbygget, nu kärnans lager 4) + winning
    expect(b.system).toContain("=== KUNDENS RÖST");
    expect(b.system).toContain("=== VINNANDE EXEMPEL");
    // Kvalitetskraven
    expect(b.system).toContain("═══ KVALITETSKRAV ═══");
    expect(b.system).toContain("exakt EN CTA som matchar funnel-nivån");
    // Skrivreglerna
    expect(b.system).toContain("=== GLOBALA SKRIVREGLER");
    // User-delen
    expect(b.user).toContain("Veckotema: Sommartema");
    expect(b.user).toContain("Skriv 2 inlägg");
  });

  it("skrivreglerna förekommer EXAKT en gång (per-dag-blocken bär dem inte längre)", async () => {
    const b = await byggCompassVeckaPrompt("klient-1", "Sommartema", POSTS);
    expect(b.system.split("GLOBALA SKRIVREGLER").length - 1).toBe(1);
    // Profil och röst likaså — inga dubbletter från gamla handbygget.
    expect(b.system.split("=== KLIENTENS VARUMÄRKESPROFIL ===").length - 1).toBe(1);
    expect(b.system.split("=== KUNDENS RÖST").length - 1).toBe(1);
  });

  it("ingen funnel-default på toppnivå — veckans mix styrs av per-dag-blocken", async () => {
    const b = await byggCompassVeckaPrompt("klient-1", "Sommartema", POSTS);
    expect(b.system).not.toContain("förvald för den här innehållstypen");
    // Kärnans generella anatomi (utan funnel) finns en gång; resten är per dag.
    expect(b.system.split("=== INLÄGGSANATOMI (följ i ordning) ===").length - 1).toBe(1);
  });

  it("JSON-schemat ligger ALLRA sist med exakt antal inlägg", async () => {
    const b = await byggCompassVeckaPrompt("klient-1", "Sommartema", POSTS);
    const format = b.system.indexOf("=== SVARSFORMAT");
    expect(format).toBeGreaterThan(-1);
    expect(b.system.slice(format + 1)).not.toMatch(/\n(===|═══) [A-ZÅÄÖ]/);
    expect(b.system.slice(format)).toContain('Exakt 2 inlägg i "days"');
  });
});
