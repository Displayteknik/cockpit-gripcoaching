// ÄMNE-1, fortsättningen — Håkans direkta fråga 15/8: "är bilderna som skapas relaterade
// till texterna?" Svaret var nej, inte överallt. suggest-caption fick rätt prioritet
// (caption > text på bilden > Ämnesfält > tomt), men suggest-image hade SAMMA fel, fast
// utan ens en prioritetsordning: `topic || headline1 || caption` lät Ämnesfältet vinna
// OVILLKORLIGT så fort det var ifyllt. Och `brödtext` nådde aldrig bilden alls — allt
// klistrades ihop till en enda `topic`-sträng, så BILD-11:s bevismening/plats/tid (K2/K2b)
// bara någonsin såg rubriken.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { harledBildamne } from "@/lib/content/amneskalla";

describe("harledBildamne · samma prioritet som bildtexten, i bildform", () => {
  it("Håkans exakta fall: skapad text vinner över ett kvarlämnat Ämnesfält", () => {
    const r = harledBildamne({
      headline: "Fler stannar när de vet vad du serverar",
      body: "En skärm för din meny, det lockar in din kund",
      topic: "Synlighet i sensommaren — skyltar som fortfarande syns i augustisolen",
    });
    expect(r.kalla).toBe("bild");
    expect(r.rubrik).toBe("Fler stannar när de vet vad du serverar");
    expect(r.brodtext).toContain("En skärm för din meny");
    expect(r.brodtext).not.toContain("sensommar");
    expect(r.brodtext).not.toContain("augustisol");
  });

  it("brödtexten följer med — inte bara rubriken", () => {
    // Den gamla klientkoden skickade ALDRIG brödtext till bilden. K2 (bevismening) och
    // K2b (plats/tid) i lib/bild/promptbyggare.ts läser båda `rubrik` OCH `brodtext`.
    const r = harledBildamne({ headline: "Kort rubrik", body: "Den viktiga detaljen står här." });
    expect(r.brodtext).toContain("Den viktiga detaljen står här.");
  });

  it("redan skriven caption vinner över allt, som text-varianten", () => {
    const r = harledBildamne({
      caption: "Vår nya meny är på plats, kom och känn doften.",
      headline: "Gammal rubrik",
      topic: "Ett ovidkommande ämne",
    });
    expect(r.kalla).toBe("inlaggstext");
    expect(r.brodtext).toContain("Vår nya meny är på plats");
    expect(r.brodtext).not.toContain("ovidkommande");
  });

  it("Ämnesfältet används bara när caption OCH bild-text är tomma", () => {
    const r = harledBildamne({ topic: "En fråga vi får ofta" });
    expect(r.kalla).toBe("amnesfalt");
    expect(r.rubrik).toBe("En fråga vi får ofta");
  });

  it("DoD-motsvarighet: helt tomt ger inget fel, inget påhittat ämne", () => {
    const r = harledBildamne({});
    expect(r.kalla).toBe("tomt");
    expect(r.rubrik).toBe("");
    expect(r.brodtext).toBe("");
  });
});

describe("suggest-image/route.ts · kopplat in, karusellen orörd", () => {
  const src = readFileSync(process.cwd() + "/app/api/studio/suggest-image/route.ts", "utf8");

  it("route.ts använder harledBildamne för singelvägen", () => {
    expect(src).toMatch(/import \{ harledBildamne \} from "@\/lib\/content\/amneskalla"/);
    expect(src).toMatch(/harledBildamne\(\{ caption: body\.caption/);
  });

  it("ett explicit rubrik/brodtext-fält (karusellens sätt att anropa) kringgår regeln", () => {
    // generateSlideImages skickar ALLTID rubrik+brodtext (även tomma strängar) per slide —
    // den vägen ska inte köras om via harledBildamne, den har redan rätt innehåll per bild.
    expect(src).toMatch(/harEgenRubrikBrodtext = typeof body\.rubrik === "string" \|\| typeof body\.brodtext === "string"/);
  });

  it("byggBildPrompt tar emot den härledda rubriken/brödtexten, inte den gamla body.rubrik-kedjan", () => {
    expect(src).toMatch(/rubrik: amne\.rubrik \|\| topic/);
    expect(src).toMatch(/brodtext: amne\.brodtext/);
    expect(src).not.toMatch(/rubrik: String\(body\.rubrik \|\| ""\)\.slice\(0, 200\) \|\| topic/);
  });

  it("K4: ämneskällan loggas även för bilden", () => {
    expect(src).toMatch(/amneKalla:\s*amne\.kalla/);
  });
});

describe("StudioMaker.tsx · klienten skickar delade fält, kollapsar inte längre", () => {
  const src = readFileSync(process.cwd() + "/components/StudioMaker.tsx", "utf8");

  it("suggestImage skickar headline/headline2/body/topic/caption var för sig", () => {
    expect(src).not.toMatch(/topic: topic \|\| headline1 \|\| caption\.slice\(0, 200\)/);
    expect(src).toMatch(/mode, headline: headline1, headline2, body, topic, caption/);
  });

  it("generateOnBrandImage skickar samma fält utan override, och bara textOverride med", () => {
    expect(src).not.toMatch(/\[headline1, topic, body\]\.filter\(Boolean\)\.join\(". "\)\)\.slice\(0, 220\) \|\| topic/);
    expect(src).toMatch(/mode: "ai", headline: headline1, headline2, body, topic, caption,/);
  });
});
