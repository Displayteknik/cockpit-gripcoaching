// G-3 — hooktypologin som ETT lager.
//
// G-0 hittade tre osammanhängande listor. Det viktigaste testet här är därför inte att
// den nya listan fungerar, utan att SAMMANSLAGNINGEN inte ändrade beteendet: materialet
// grindas exakt som förut, och förbehållen följer med.

import { describe, expect, it } from "vitest";
import { HOOK_TYPER, hookTyp, tillatnaHookTyper, variantregelText } from "@/lib/hook-typer";

describe("G-3 · materialkravet bor hos typen", () => {
  it("statistik kräver verifierade siffror, berättelse kräver story-bank", () => {
    expect(HOOK_TYPER.find((h) => h.namn === "statistik")?.kraver).toBe("siffror");
    expect(HOOK_TYPER.find((h) => h.namn === "berättelse")?.kraver).toBe("berattelser");
  });

  it("de tre fria typerna föreslås alltid", () => {
    const utan = tillatnaHookTyper({ harSiffror: false, harBerattelser: false }).map((h) => h.namn);
    expect(utan).toEqual(["fråga", "konträr", "påstående"]);
  });

  it("en typ vars krav inte är uppfyllt föreslås ALDRIG", () => {
    // Att be om en siffra man inte har är att be om en påhittad siffra. Sanningskravet
    // i prompten säger nej — men typen ska inte ens frestas fram.
    const bara = tillatnaHookTyper({ harSiffror: true, harBerattelser: false }).map((h) => h.namn);
    expect(bara).toContain("statistik");
    expect(bara).not.toContain("berättelse");
  });

  it("full täckning ger alla fem", () => {
    expect(tillatnaHookTyper({ harSiffror: true, harBerattelser: true })).toHaveLength(5);
  });
});

describe("G-3 · variantregeln bär förbehållen", () => {
  it("siffran är alltid märkt som verifierad", () => {
    // Regressionen som ett test fångade under bygget: den genererade texten tappade
    // parentesen, och utan den är raden en uppmaning att hitta på ett tal.
    expect(variantregelText()).toContain("konkret siffra (endast verifierad ur profilen)");
  });

  it("berättelsen är alltid märkt som verklig", () => {
    expect(variantregelText()).toContain("berättelseöppning (endast verklig händelse ur profilen)");
  });

  it("en tenant utan material får inte de två ingångarna alls", () => {
    const text = variantregelText(tillatnaHookTyper({ harSiffror: false, harBerattelser: false }));
    expect(text).not.toContain("konkret siffra");
    expect(text).not.toContain("berättelseöppning");
    expect(text).toContain("rak fråga");
  });

  it("kravet på olika tankefigur står kvar ordagrant", () => {
    expect(variantregelText()).toContain("Två varianter får ALDRIG dela tankefigur eller öppningsfras.");
  });
});

describe("G-3 · uppslaget tål det flödena faktiskt skriver", () => {
  it("hittar typen på namnet ur flödets JSON", () => {
    expect(hookTyp("statistik")?.id).toBe("siffra");
    expect(hookTyp("Berättelse")?.id).toBe("berattelse");
  });

  it("okänt namn ger null — aldrig en gissad typ", () => {
    expect(hookTyp("clickbait")).toBeNull();
    expect(hookTyp("")).toBeNull();
    expect(hookTyp(null)).toBeNull();
  });
});

describe("G-3 · sammanslagningen ändrade inte beteendet", () => {
  // copy.ts grindade förut materialet med egen kod. Efter G-3c ställer den samma fråga
  // till lib/hook-typer. Utfallet måste vara identiskt — annars är det inte en
  // uppstädning utan en tyst regeländring.
  const gammalRegel = (bas: string[], harSiffror: boolean, harBerattelser: boolean) => {
    const ut = harBerattelser ? [...bas, "berättelse"] : bas;
    return harSiffror ? [...ut, "statistik"] : ut;
  };
  const nyRegel = (bas: string[], harSiffror: boolean, harBerattelser: boolean) => {
    const tillatet = new Set(tillatnaHookTyper({ harSiffror, harBerattelser }).map((h) => h.namn));
    return [...bas, "berättelse", "statistik"].filter((n) => tillatet.has(n));
  };

  it("ger samma lista för varje bildroll och varje täckning", () => {
    const roller = [["fråga", "konträr"], ["påstående", "konträr"], ["fråga", "konträr", "påstående"]];
    for (const bas of roller) {
      for (const s of [true, false]) {
        for (const b of [true, false]) {
          expect(nyRegel(bas, s, b).sort()).toEqual(gammalRegel(bas, s, b).sort());
        }
      }
    }
  });
});
