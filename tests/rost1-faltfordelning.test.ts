// ROST-1 — inspelad text hamnar i RÄTT fält. Håkans fynd 2026-08-11.
//
// Han klickade mikrofonen i "Lägg till kontakt", sa "Elisabeth Andersson", och namnet landade i
// ANTECKNINGAR medan namnrutan stod tom. Hans krav: "verktyget måste ju i alla platser där det
// spelas in ljud vara smartare o förstå situationsanpassat vart respektive data ska in."
//
// Skärmdumpsvägen kunde det redan (`/api/dm/extract-lead` fyller varje fält). Rösten lade allt
// där knappen råkade sitta.
//
// Det farliga med den här sortens funktion är TYST FELPLACERING: ett värde i fel ruta som ingen
// ser, eller en diktering som försvinner. Därför är tolkningen hård och fail-open:
// okända nycklar, ogiltiga val och gissade datum kastas — men texten de bar följer med till
// `oplacerat` i stället för att tappas.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  faltschemaText,
  fordelningsPrompt,
  fordelningsSammanfattning,
  tolkaFordelning,
  type FaltSpec,
} from "@/lib/ai/faltfordelning";

const FALT: FaltSpec[] = [
  { nyckel: "namn", etikett: "Namn", typ: "text" },
  { nyckel: "kanal", etikett: "Kanal", typ: "val", alternativ: ["instagram", "messenger", "linkedin"] },
  { nyckel: "motestid", etikett: "Bokad tid", typ: "datumtid" },
  { nyckel: "nastaSteg", etikett: "Nästa steg", typ: "text" },
];

const svar = (o: unknown) => JSON.stringify(o);

describe("ROST-1 · fältet får bara det som hör dit", () => {
  it("Håkans fall: namnet hamnar i namnrutan", () => {
    const f = tolkaFordelning(svar({ varden: { namn: "Elisabeth Andersson" }, oplacerat: "" }), FALT);
    expect(f.varden.namn).toBe("Elisabeth Andersson");
    expect(f.oplacerat).toBe("");
  });

  it("okända nycklar kastas — men texten de bar följer med", () => {
    // En tappad diktering är värre än en felplacerad: den syns inte.
    const f = tolkaFordelning(svar({ varden: { epost: "hej@exempel.se", namn: "Anna" }, oplacerat: "" }), FALT);
    expect(f.varden).toEqual({ namn: "Anna" });
    expect(f.oplacerat).toContain("hej@exempel.se");
  });

  it("ett val utanför listan kastas, med etiketten kvar i texten", () => {
    const f = tolkaFordelning(svar({ varden: { kanal: "snapchat" }, oplacerat: "" }), FALT);
    expect(f.varden.kanal).toBeUndefined();
    expect(f.oplacerat).toContain("Kanal: snapchat");
  });

  it("val matchas oavsett versaler, men sparas som listans värde", () => {
    const f = tolkaFordelning(svar({ varden: { kanal: "Instagram" } }), FALT);
    expect(f.varden.kanal).toBe("instagram");
  });

  it("ett datum som inte har fältets form är en gissning och kastas", () => {
    for (const d of ["tisdag", "2026-08-14", "14/8 kl 10", "2026-08-14 10:00"]) {
      const f = tolkaFordelning(svar({ varden: { motestid: d } }), FALT);
      expect(f.varden.motestid, d).toBeUndefined();
      expect(f.oplacerat, d).toContain(d);
    }
  });

  it("rätt datumform släpps igenom", () => {
    const f = tolkaFordelning(svar({ varden: { motestid: "2026-08-14T10:00" } }), FALT);
    expect(f.varden.motestid).toBe("2026-08-14T10:00");
  });

  it("tomma värden räknas inte som ifyllda", () => {
    const f = tolkaFordelning(svar({ varden: { namn: "   ", nastaSteg: "" } }), FALT);
    expect(f.varden).toEqual({});
  });

  it("trasigt svar ger tom fördelning i stället för att kasta", () => {
    for (const raw of ["", "inte json", "{halv"]) {
      expect(tolkaFordelning(raw, FALT)).toEqual({ varden: {}, oplacerat: "" });
    }
  });
});

describe("ROST-1 · prompten sätter gränserna, inte modellens goda vilja", () => {
  const p = fordelningsPrompt(FALT, "2026-08-11 09:00");

  it("bara nycklarna i schemat, aldrig nya", () => {
    expect(p).toContain("Använd bara nycklarna ovan");
    expect(p).toContain('"namn"');
    expect(p).toContain('"motestid"');
  });

  it("ett tomt fält är rätt svar när uppgiften saknas", () => {
    expect(p).toContain("Ett tomt fält är rätt svar");
    expect(p).toContain("Gissa aldrig");
  });

  it("alternativen räknas upp så modellen inte kan hitta på ett värde", () => {
    expect(faltschemaText(FALT)).toContain("instagram | messenger | linkedin");
  });

  it("relativ tid räknas från dagens datum, som skickas in", () => {
    expect(p).toContain("2026-08-11 09:00");
    expect(p).toContain("Europe/Stockholm");
  });

  it("ingenting får kastas bort tyst", () => {
    expect(p).toContain("Kasta ingenting");
  });
});

describe("ROST-1 · användaren ser vart texten tog vägen", () => {
  it("sammanfattningen räknar upp fälten i klarspråk", () => {
    const rad = fordelningsSammanfattning(
      { varden: { namn: "Elisabeth Andersson", kanal: "instagram" }, oplacerat: "" },
      FALT,
    );
    expect(rad).toContain("Namn: Elisabeth Andersson");
    expect(rad).toContain("Kanal: instagram");
    expect(rad).not.toMatch(/namn:|nyckel/);
  });

  it("säger till när resten lades i anteckningarna", () => {
    const rad = fordelningsSammanfattning({ varden: { namn: "Anna" }, oplacerat: "hon var glad" }, FALT);
    expect(rad).toContain("Resten i anteckningarna");
  });

  it("och när ingenting kunde placeras", () => {
    expect(fordelningsSammanfattning({ varden: {}, oplacerat: "nåt löst" }, FALT)).toBe("Allt lades i anteckningarna.");
  });

  it("tom fördelning ger ingen rad alls — ingen brusar i onödan", () => {
    expect(fordelningsSammanfattning({ varden: {}, oplacerat: "" }, FALT)).toBe("");
  });
});

describe("ROST-1 · fail-open i varje led", () => {
  const route = readFileSync(new URL("../app/api/ai/rost-till-falt/route.ts", import.meta.url), "utf8");
  const komp = readFileSync(new URL("../components/SmartTextarea.tsx", import.meta.url), "utf8");

  it("utan nyckel, utan schema eller vid fel returnerar routen texten som oplacerad", () => {
    expect(route.match(/oplacerat: text/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("komponenten lägger hela texten i fältet om fördelningen failar", () => {
    // Tre vägar: inget schema, trasigt svar, kastat anrop.
    expect(komp.match(/append\(text\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("utan schema beter komponenten sig exakt som förut", () => {
    expect(komp).toContain("if (!faltschema?.length || !onFalt) { append(text); return; }");
  });

  it("schemat från klienten behandlas som data — tak på antal fält", () => {
    expect(route).toContain(".slice(0, 20)");
  });
});

describe("ROST-1 · ytorna som fått schemat", () => {
  const dm = readFileSync(new URL("../app/dashboard/(inlagg)/dm/page.tsx", import.meta.url), "utf8");

  it("Lägg till kontakt sorterar dikteringen i alla sina fält", () => {
    // Listan flyttades till modulnivå i DM-3 så bägge ytorna beskriver kortet likadant.
    expect(dm).toContain("const KONTAKT_ROSTFALT: FaltSpec[]");
    for (const nyckel of ["namn", "anvandarnamn", "kanal", "kalla", "lage", "motestid", "paminnelse", "nastaSteg"]) {
      expect(dm, nyckel).toContain(`nyckel: "${nyckel}"`);
    }
  });

  it("alternativen kommer ur SAMMA listor som rutorna renderar", () => {
    // Annars kan modellen svara ett värde som inte finns i <select> och fältet blir tomt.
    expect(dm).toContain("alternativ: KANALER.map((k) => k.id)");
    expect(dm).toContain("alternativ: LAGEN.map((l) => String(l.id))");
    expect(dm).toContain("...STAGES.map((st) => ({ id: st.id, label: st.label }))");
  });

  it("redigeringsytan sorterar talet i sina egna fält", () => {
    expect(dm).toContain("if (varden.nastaSteg) setNext(varden.nastaSteg);");
    expect(dm).toContain("if (varden.namn) setNamn(varden.namn);");
  });
});

describe("DM-3 · redigera ändrar HELA kortet", () => {
  // Håkans krav 11/8: "när man klickar på redigera så vill man ju kunna ändra ALLT på kortet,
  // om jag säger så, inte bara en inforuta". Ytan hade två fält: anteckningar och nästa steg.
  // Allt annat — namn, kanal, användarnamn, läge, tider, källa — gick bara att ändra genom att
  // dra kortet eller via dess knappar.
  const dm = readFileSync(new URL("../app/dashboard/(inlagg)/dm/page.tsx", import.meta.url), "utf8");
  const redigera = dm.slice(dm.indexOf("function RedigeraKort"), dm.indexOf("function ContactCard"));

  it("varje fält på kortet finns i redigeringsytan", () => {
    for (const state of ["namn", "anvandarnamn", "kanal", "kalla", "lage", "motesTid", "paminnelse", "next", "notes"]) {
      expect(redigera, state).toContain(`const [${state},`);
    }
  });

  it("och skickas med i sparningen", () => {
    // `notes` och `next_action` skickas som kortform (notes,) — därför matchas namnet, inte kolonet.
    for (const kolumn of ["display_name:", "ig_username:", "channel:", "source:", "stage:", "notes,", "next_action:", "next_action_at:", "reminder_at:"]) {
      expect(redigera, kolumn).toContain(kolumn);
    }
  });

  it("läget går att sätta tillbaka till Bokad eller Förlorad", () => {
    // Kortet har knappar för det, men den som öppnat redigeringen ska inte behöva stänga
    // den för att flytta kortet.
    expect(dm).toContain('{ id: "won" as Stage, label: "Bokad" }');
    expect(dm).toContain('{ id: "lost" as Stage, label: "Förlorad" }');
  });

  it("ett misslyckat sparande syns — det får aldrig se ut som att det gick igenom", () => {
    expect(redigera).toContain("Kunde inte spara ändringen");
    expect(redigera).toMatch(/if \(!r\.ok\)/);
  });

  it("kortet håller inget eget formulärstate längre", () => {
    // Två kopior av samma värden glider isär: kortet visade gammalt medan ytan sparat nytt.
    const kort = dm.slice(dm.indexOf("function ContactCard"));
    expect(kort).not.toContain('const [notes, setNotes] = useState(contact.notes');
    expect(kort).not.toContain('body: JSON.stringify({ notes, next_action: next })');
  });

  it("rösten fördelas över hela kortet, inte bara anteckningarna", () => {
    expect(redigera).toContain("faltschema={KONTAKT_ROSTFALT}");
    expect(redigera).toContain("onFalt={fyllFranRost}");
  });

  it("båda ytorna delar EN fältlista", () => {
    // Lägg till kontakt och Redigera ska aldrig kunna beskriva kortet olika.
    expect(dm).toContain("const KONTAKT_ROSTFALT: FaltSpec[]");
    expect(dm).toContain("const rostFalt = KONTAKT_ROSTFALT;");
  });
});
