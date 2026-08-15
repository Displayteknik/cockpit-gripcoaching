// ÄMNE-1 — Håkans skarpfynd 15/8: bildtextsteget bytte ämne mot ett kvarlämnat, ovidkommande
// Ämnesfält i stället för att hålla sig till inlägget som faktiskt skapades.
//
// Rotorsak, mätt mot Displaytekniks riktiga profil (scripts/amne1-repro*.mts): `topic`
// (Ämne, steg 1) och headline/body (Text på bilden, steg 4) är två skilda state-fält.
// `applySuggestion` sätter headline/body men rör aldrig `topic` — ett kvarlämnat Ämne kan
// därför peka på något helt annat än det inlägget blev. Tre repro-körningar visade stigande
// allvar: rent ämne (mild säsongsfärgning) → Förslag för dagen förifyllt (fortfarande på
// ämne) → kvarlämnat, motstridigt Ämne (alla tre varianter öppnade om det FEL ämnet).
import { describe, it, expect } from "vitest";
import { harledAmnesblock } from "@/lib/content/amneskalla";

describe("K1 · innehållet är ämneskälla, i prioritetsordning", () => {
  it("redan skriven caption vinner över allt annat (Skriv om)", () => {
    const r = harledAmnesblock({
      caption: "En skärm för din meny lockar in fler gäster.",
      headline: "Annan rubrik",
      body: "Annan text",
      topic: "Ett tredje, ovidkommande ämne",
    });
    expect(r.kalla).toBe("inlaggstext");
    expect(r.block).toContain("En skärm för din meny lockar in fler gäster.");
    expect(r.block).not.toContain("Ett tredje, ovidkommande ämne");
  });

  it("skapad bild (headline/body) vinner över Ämnesfältet", () => {
    // Håkans EXAKTA fall: menyskärmens rubrik/text mot ett kvarlämnat säsongsämne.
    const r = harledAmnesblock({
      headline: "Fler stannar när de vet vad du serverar",
      body: "En skärm för din meny, det lockar in din kund",
      topic: "Synlighet i sensommaren — skyltar som fortfarande syns i augustisolen",
    });
    expect(r.kalla).toBe("bild");
    expect(r.block).toContain("Fler stannar när de vet vad du serverar");
    expect(r.block).toContain("En skärm för din meny");
    // Det kvarlämnade ämnet får INTE finnas kvar i prompten alls — annars kan det
    // fortfarande vinna över den svagare bild-signalen, precis som i skarpt fall.
    expect(r.block).not.toContain("sensommar");
    expect(r.block).not.toContain("augustisol");
  });

  it("karusellens slides räknas som skapad bild, samma prioritet", () => {
    const r = harledAmnesblock({
      slides: [{ kind: "hook", headline: "Tre misstag", body: "vid val av skärm" }],
      topic: "Ett helt annat ämne",
    });
    expect(r.kalla).toBe("bild");
    expect(r.block).toContain("Tre misstag");
    expect(r.block).not.toContain("Ett helt annat ämne");
  });

  it("Ämnesfältet används ENDAST när caption och bild-innehåll är tomma", () => {
    const r = harledAmnesblock({ topic: "En fråga vi får ofta" });
    expect(r.kalla).toBe("amnesfalt");
    expect(r.block).toBe("Ämne: En fråga vi får ofta.");
  });

  it("DoD punkt 3 · helt tomt inlägg ger inget fel, inget påhittat ämne", () => {
    const r = harledAmnesblock({});
    expect(r.kalla).toBe("tomt");
    expect(r.block).toBe("");
    expect(r.amne).toBe("");
  });

  it("etiketten säger uttryckligen att det ÄR ämnet, inte bara en bildtext att beskriva", () => {
    // Den gamla lydelsen ("Rubrik på bilden:") lästes som en bildbeskrivning, inte som en
    // instruktion om vad HELA inlägget ska handla om.
    const r = harledAmnesblock({ headline: "X", body: "Y" });
    expect(r.block).toMatch(/^ÄMNET FÖR DETTA INLÄGG/);
  });

  it("tomma fält ger inga tomma rader i blocket", () => {
    const r = harledAmnesblock({ headline: "Bara rubrik" });
    expect(r.block.split("\n").every((rad) => rad.trim().length > 0)).toBe(true);
  });
});

describe("K3 · tre varianter delar samma underlag", () => {
  it("suggest-caption bygger EN gemensam bygg.user oavsett hur många varianter som begärs", async () => {
    // Alla tre A/B-varianter (Fråga/Påstående/Berättelse) delar samma `bygg.user` — bara
    // krok-vinkeln läggs på PER variant (route.ts:126-127). Håller `harledAmnesblock`
    // ämnet stabilt håller alltså K3 automatiskt, utan en egen mekanism per variant.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(process.cwd() + "/app/api/studio/suggest-caption/route.ts", "utf8"));
    expect(src).toMatch(/const amne = harledAmnesblock\(/);
    expect(src).toMatch(/amne\.block/);
    // Bygget sker EN gång, före variant-loopen — inte en gång per variant.
    const byggIndex = src.indexOf("const bygg = await byggTextPrompt");
    const variantLoopIndex = src.indexOf("valda.map(async (v, i)");
    expect(byggIndex).toBeGreaterThan(-1);
    expect(variantLoopIndex).toBeGreaterThan(byggIndex);
  });
});

describe("K4 · ämneskällan loggas per generering", () => {
  it("route.ts skickar amneKalla in i generering-metadatan", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(process.cwd() + "/app/api/studio/suggest-caption/route.ts", "utf8"));
    expect(src).toMatch(/amneKalla:\s*amne\.kalla/);
  });

  it("GenereringsMeta och Generering bär fältet ända till databasraden", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(process.cwd() + "/lib/generationslogg.ts", "utf8");
    expect(src).toMatch(/amneKalla\?:\s*string \| null/g);
    expect(src).toMatch(/amne_kalla:\s*g\.amneKalla \|\| null/);
  });

  it("migrationen lägger till kolumnen additivt", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync(process.cwd() + "/migrations/amne1_amnekalla.sql", "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS amne_kalla/);
  });
});

describe("Skriv om anchrar på befintlig text (K1, klientsidan)", () => {
  it("suggestCaption och suggestCaptionVariants skickar caption med i anropet", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(process.cwd() + "/components/StudioMaker.tsx", "utf8");
    // Två callers av /api/studio/suggest-caption — båda ska bära `caption` i bodyn.
    const anrop = [...src.matchAll(/fetch\("\/api\/studio\/suggest-caption",[\s\S]{0,260}?\}\);/g)];
    expect(anrop.length).toBeGreaterThanOrEqual(2);
    for (const m of anrop) expect(m[0]).toMatch(/caption\s*[,}]/);
  });
});

describe("Samma sårbarhet i adapt-channel (steg 6) — rättad för konsekvens", () => {
  it("fallback-vägen (utan grund-caption) använder samma ämneskälla-prioritet", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(process.cwd() + "/app/api/studio/adapt-channel/route.ts", "utf8");
    expect(src).toMatch(/harledAmnesblock\(/);
  });
});
