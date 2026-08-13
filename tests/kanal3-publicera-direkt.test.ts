// KANAL-3 — utkast ELLER publicera direkt. Håkans beställning 13/8:
// "på DT står det skapa utkast på fb exempelvis, jag vill kunna välja på det eller
// publicera direkt".
//
// ⚠ Statusvärdet är VERIFIERAT mot live-API:t, inte gissat. Ett avsiktligt ogiltigt värde
// gav 422 med hela listan tillbaka:
//   in_progress, draft, failed, published, scheduled, in_review, notification_sent,
//   pending, deleted
// Ingenting publicerades av den kontrollen — valideringen faller före något skapas.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const GHL = las("lib/studio/ghl.ts");
const PUBLISH = las("lib/publish/index.ts");
const ROUTE = las("app/api/studio/publish/route.ts");
const VY = las("components/StudioMaker.tsx");

describe("KANAL-3 · de tre lägena hålls isär", () => {
  it("status väljs i ordningen schemalagt → publicerat → utkast", () => {
    // En vald tidpunkt är ett starkare besked än "publicera nu". Utkast är grundläget.
    expect(GHL).toContain('status: scheduled ? "scheduled" : publicerad ? "published" : "draft"');
  });

  it("schemalagt vinner över publicera", () => {
    expect(GHL).toContain("const publicerad = !scheduled && opts.publicera === true");
  });

  it("utkast är kvar som grundläge — publicera kräver ett aktivt val", () => {
    // opts.publicera === true, inte truthy: ett oavsiktligt "1" eller "ja" ska inte
    // publicera åt någon.
    expect(GHL).toContain("opts.publicera === true");
    expect(VY).toContain("useState(false)");
  });
});

describe("KANAL-3 · karusellen publiceras ALDRIG direkt", () => {
  // Skälet är dokumenterat sedan AKUT-KARUSELL: multi-media mot GHL är inte verifierat
  // mot ett skarpt konto. Ett utkast som blev fel går att rätta i MySales innan någon
  // ser det; ett publicerat inlägg som blev fel har redan mött kundens följare.
  it("spärren finns i publiceringsmodulen, inte bara i gränssnittet", () => {
    expect(PUBLISH).toContain("const flerBilder = mediaUrls.length >= 2");
    expect(PUBLISH).toContain("const villPublicera = req.publicera === true && !flerBilder");
  });

  it("användaren får veta VARFÖR det blev ett utkast ändå", () => {
    // Tyst nedgradering är samma familj som en tyst nolla: rätt beteende, obegripligt
    // för den som bad om något annat.
    expect(PUBLISH).toContain("Karusellen skapades som utkast");
    expect(ROUTE).toContain("notis: result.notis");
  });

  it("knappen låser valet för karusell i stället för att lova något den inte gör", () => {
    expect(VY).toContain("const sparrad = v === true && isCarousel && slideCount >= 2");
  });
});

describe("KANAL-3 · hela vägen är kopplad", () => {
  it("valet når API-routen", () => {
    expect(VY).toContain("publicera: publiceraDirekt");
  });

  it("routen skickar det vidare till publiceringsmodulen", () => {
    expect(ROUTE).toContain("publicera: body.publicera === true");
  });

  it("modulen skickar det vidare till GHL", () => {
    expect(PUBLISH).toContain("publicera: villPublicera");
  });

  it("valet syns i knappens text, så ingen trycker fel", () => {
    expect(VY).toContain("Publicera nu på ${label}");
    expect(VY).toContain("Skapa utkast på ${label}");
  });

  it("valet döljs när en tid är vald — två besked som säger olika saker förvirrar", () => {
    expect(VY).toContain("{!scheduleDate && (");
  });
});

describe("KANAL-3 · Instagram-direktvägen är orörd", () => {
  it("IG publicerar fortfarande direkt utan att gå via valet", () => {
    // Den vägen har aldrig haft utkast och ska inte få det nu.
    expect(PUBLISH).toContain('return { status: "published", id, channel: "ig-graph" }');
  });
});

describe("KANAL-3b · 'nyckel saknas' är inte samma sak som 'ej kopplad'", () => {
  // Håkans fynd 13/8: Gittes Instagram var kopplad i MySales (Connected, 59 dagar), men
  // Cockpit saknade `clients.ghl_pit` för henne. Utan nyckeln kan Cockpit inte fråga alls,
  // så ALLA tre kanalerna stod som "ej kopplad" — och felsökningen gick åt fel håll: hon
  // letade efter sin Instagram-koppling när det var en nyckel som fattades hos oss.
  it("bricken skiljer på de två lägena", () => {
    expect(VY).toContain('ghlConnected === false ? "nyckel saknas" : "ej kopplad"');
  });

  it("förklaringen står i hovertexten, inte bara i en färg", () => {
    expect(VY).toContain("Cockpit saknar nyckeln till kundens MySales-konto");
  });

  it("läget får en egen färg — gult är 'åtgärda', grått är 'inte vald'", () => {
    expect(VY).toContain('{ background: "#fef3c7", color: "#92400e" }');
  });
});
