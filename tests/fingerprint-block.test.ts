// Enhetstester för fingerprintToPromptBlock (T-5 punkt 3).
// Förbjudna ord ska kunna lyftas UR röstblocket (prompt-core lägger dem som hårt
// block sist), och röst-exempel som innehåller klientens förbjudna ord ska
// filtreras bort ur urvalet. Ren funktion — inga nycklar, inget nät.

import { describe, expect, it } from "vitest";
import { fingerprintToPromptBlock, type VoiceFingerprint } from "@/lib/voice-fingerprint";

const FP: VoiceFingerprint = {
  client_id: "klient-1",
  signature_phrases: ["kör vi"],
  forbidden_words: ["billig", "deal"],
  tone_summary: "Kort och rak.",
  rhythm_notes: "Korta meningar.",
  pain_words: ["strul"],
  joy_words: ["flyt"],
  source_asset_count: 3,
  raw_samples: [
    "Ett rent inlägg utan konstigheter.",
    "Här får du en billig lösning direkt.",
    "Ett till rent inlägg om vardagen.",
  ],
  built_at: "2026-07-31T00:00:00Z",
};

describe("fingerprintToPromptBlock — förbjudna ord (T-5)", () => {
  it("default: ANVÄND ALDRIG-raden finns kvar (omigrerade anropare)", () => {
    const block = fingerprintToPromptBlock(FP);
    expect(block).toContain("ANVÄND ALDRIG: billig, deal");
  });

  it("medForbjudna:false: raden utelämnas (prompt-core äger förbudet)", () => {
    const block = fingerprintToPromptBlock(FP, { medForbjudna: false });
    expect(block).not.toContain("ANVÄND ALDRIG");
    expect(block).toContain("TON: Kort och rak.");
  });

  it("röst-exempel med förbjudna ord filtreras bort ur urvalet", () => {
    const block = fingerprintToPromptBlock(FP, { medForbjudna: false });
    expect(block).toContain("Ett rent inlägg utan konstigheter.");
    expect(block).toContain("Ett till rent inlägg om vardagen.");
    expect(block).not.toContain("billig lösning direkt");
  });

  it("ordgräns i filtret: 'deal' träffar inte 'idealisk'", () => {
    const fp = { ...FP, raw_samples: ["En idealisk vardag för alla."] };
    const block = fingerprintToPromptBlock(fp, { medForbjudna: false });
    expect(block).toContain("En idealisk vardag för alla.");
  });

  it("alla exempel smutsiga → exempelsektionen utelämnas helt", () => {
    const fp = { ...FP, raw_samples: ["Så billig!", "Vilken deal du får."] };
    const block = fingerprintToPromptBlock(fp, { medForbjudna: false });
    expect(block).not.toContain("VERKLIGA INLÄGG");
  });
});
