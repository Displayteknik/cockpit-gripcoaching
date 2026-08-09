// Frågeform + hooklöfte — två språkregler som ska gälla ALL text i verktyget.
//
// Skarpt fall 2026-08-09 (Håkans karusell för Displayteknik):
//   hook:  "Sommaren dödar skärmar?"      ← påstående med påklistrat frågetecken
//   brödtext: "Många tror kylan är värst, men värmen ställer högst krav..."
//                                          ← infriar inte hookens dramatik
//
// Båda reglerna ligger i lager 8 (globala skrivregler) i prompt-core, alltså i den enda
// vägen alla textflöden går genom. Frågeformen har dessutom en deterministisk grind:
// prompten är första försvaret, grinden är spärren — samma mönster som CTA-golvet och
// siffergrinden, som båda visade att prompten ensam inte räcker för hårda regler.

import { describe, expect, it } from "vitest";
import {
  FRAGEFORM_REGEL,
  HOOKLOFTE_REGEL,
  WRITING_RULES_BLOCK,
  WRITING_RULES_DIALOG,
  skenfragor,
} from "@/lib/content/writing-rules";

describe("skenfrågor — påstående med frågetecken", () => {
  it("fäller det skarpa fallet", () => {
    expect(skenfragor("Sommaren dödar skärmar?")).toEqual(["Sommaren dödar skärmar?"]);
  });

  it("fäller rak ordföljd även när verbet kommer längre in", () => {
    expect(skenfragor("Din nya skylt syns bättre?")).toHaveLength(1);
    expect(skenfragor("Många tror att kylan är värst?")).toHaveLength(1);
  });

  it("släpper igenom en RIKTIG fråga med omvänd ordföljd", () => {
    expect(skenfragor("Dödar sommaren skärmar?")).toEqual([]);
    expect(skenfragor("Syns din skylt i solljus?")).toEqual([]);
    expect(skenfragor("Kostar det mer än du tror?")).toEqual([]);
  });

  it("släpper igenom frågeord först", () => {
    for (const f of [
      "Vad kostar en skylt som syns i solen?",
      "Hur vet du att skärmen klarar sommaren?",
      "Varför blir skylten svart i motljus?",
      "Vilken ljusstyrka behöver ett skyltfönster?",
    ]) {
      expect(skenfragor(f), f).toEqual([]);
    }
  });

  it("släpper igenom elliptiska frågor utan verb — de är korrekt svenska", () => {
    for (const f of ["Redo för sommaren?", "Eller hur?", "Nyfiken?", "Ett bättre skyltfönster?"]) {
      expect(skenfragor(f), f).toEqual([]);
    }
  });

  it("rör inte påståenden med punkt", () => {
    expect(skenfragor("Sommaren dödar skärmar. Vi har lösningen.")).toEqual([]);
  });

  it("hittar flera skenfrågor i samma text och lämnar de korrekta ifred", () => {
    const text = "Sommaren dödar skärmar? Syns din skylt ändå? Värmen sliter hårdare?";
    const fallda = skenfragor(text);
    expect(fallda).toHaveLength(2);
    expect(fallda[0]).toContain("Sommaren dödar");
    expect(fallda.join(" ")).not.toContain("Syns din skylt");
  });

  it("hashtags förvirrar inte grinden", () => {
    expect(skenfragor("Dödar sommaren skärmar?\n\n#skyltfönster #digitalsignage")).toEqual([]);
  });

  it("tom eller trasig indata ger inget brott (fail-open)", () => {
    expect(skenfragor("")).toEqual([]);
    expect(skenfragor("???")).toEqual([]);
  });
});

describe("reglerna når ALLA flöden via lager 8", () => {
  it("frågeform och hooklöfte ligger i det globala skrivregelblocket", () => {
    expect(WRITING_RULES_BLOCK).toContain(FRAGEFORM_REGEL);
    expect(WRITING_RULES_BLOCK).toContain(HOOKLOFTE_REGEL);
  });

  it("regeln visar både felet och rättelsen — en regel utan exempel följs sämre", () => {
    expect(FRAGEFORM_REGEL).toContain("Sommaren dödar skärmar?");
    expect(FRAGEFORM_REGEL).toContain("Dödar sommaren skärmar?");
  });

  // Frågeform är SPRÅK och gäller i en inkorg lika mycket som i ett inlägg.
  // Hooklöftet är INLÄGGSFORMAT — ett svar har ingen krok att infria, och att kräva det
  // av ett DM vore samma sorts dold formatregel som CTA-golvet var (se AKUT-DM).
  it("dialogvarianten bär frågeformen men inte hooklöftet", () => {
    expect(WRITING_RULES_DIALOG).toContain("FRÅGEFORM");
    expect(WRITING_RULES_DIALOG).not.toContain("HOOKEN MÅSTE INFRIAS");
  });
});
