// DM-4 — DM-pipelinen speglar grundplanens sju steg. Håkans fynd 2026-08-11.
//
// "DM pipeline sitter inte ihop på samma sätt som pipeline i grundplanen, det fattas 2 steg."
// Skärmbilden från MySales (AluCon, Kund pipeline) visar sju fack i den här ordningen:
//
//   Ny · Bekräftad · Dialog · Erbjudande · Bokad · Vilande · Förlorad
//
// DM-tavlan hade FYRA kolumner. Bokad och Förlorad låg i en lista under tavlan, och VILANDE
// fanns inte alls — varken som kolumn, som val i formulären eller som tillåtet värde i
// databasen (CHECK-villkoret på `cockpit_dm_contacts.stage`).
//
// ⚠ Vilande är dessutom hela poängen med FIX-1 B2: facket i MySales hette förut
// "Förlorad / Paus (nurture)" och slog ihop parkerat med förlorat, vilket räknade varje
// parkerad kund som en förlorad affär. Skärmbilden visar att facket nu är delat.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dm = readFileSync(new URL("../app/dashboard/(inlagg)/dm/page.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/dm_vilande.sql", import.meta.url), "utf8");

/** Facken i den ordning de står i STAGES. */
function stegIOrdning(): { id: string; label: string }[] {
  const block = dm.slice(dm.indexOf("const STAGES:"), dm.indexOf("/** De fack en kontakt"));
  return [...block.matchAll(/id: "([a-z]+)", label: "([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));
}

describe("DM-4 · samma sju fack som grundplanen, i samma ordning", () => {
  it("tavlan har exakt sju fack", () => {
    expect(stegIOrdning()).toHaveLength(7);
  });

  it("ordningen är grundplanens", () => {
    expect(stegIOrdning().map((s) => s.label)).toEqual([
      "Ny", "Bekräftad", "Dialog", "Erbjudande", "Bokad", "Vilande", "Förlorad",
    ]);
  });

  it("typen tillåter det sjunde läget", () => {
    expect(dm).toContain('| "vilande" |');
  });

  it("varje fack har en färgbricka — annars kraschar tavlan på det nya", () => {
    // STAGE_STYLES är Record<Stage, ...>: saknas en nyckel är det ett typfel, men värdet
    // kan ändå vara fel färg. Här kontrolleras att raden finns.
    expect(dm).toContain("vilande: { tile:");
  });
});

describe("DM-4 · vilande är varken pågående eller avslutat", () => {
  it("räkningen 'i pipeline' bygger på de AKTIVA facken", () => {
    // Förut: contacts.length - won - lost, vilket hade räknat en parkerad kontakt som
    // pågående arbete. Det är samma sammanblandning som FIX-1 B2 handlar om, fast åt
    // andra hållet.
    expect(dm).toContain("const AKTIVA_STEG: Stage[] = [\"new\", \"acknowledge\", \"connect\", \"offer\"]");
    expect(dm).toContain("AKTIVA_STEG.includes(c.stage)");
    expect(dm).not.toContain("contacts.length - won - lost");
  });

  it("vilande räknas och visas för sig", () => {
    expect(dm).toContain('c.stage === "vilande"');
    expect(dm).toContain("</span> vilande");
  });

  it("kortet kan parkeras direkt, inte bara via dragning", () => {
    expect(dm).toContain('onMoveTo("vilande")');
    expect(dm).toContain("Parkera som vilande");
  });
});

describe("DM-4 · en lista, inte tre kopior", () => {
  it("formulärens stegval kommer ur samma lista som tavlan", () => {
    // Tre handskrivna kopior fanns: STAGES (4), LAGEN (4+2) och STEG_VAL (6). Ingen av dem
    // hade Vilande, och en <select> som saknar ett fack gör facket oanvändbart.
    expect(dm).toContain("const LAGEN: { id: Stage; label: string }[] = STAGES.map");
    expect(dm).toContain("const STEG_VAL: { id: Stage; label: string }[] = LAGEN;");
  });

  it("den gamla listan 'Bokade & förlorade' är borta", () => {
    // Den fanns för att en avslutad kontakt annars försvann spårlöst. Nu har facken egna
    // kolumner, och en andra lista är en plats där siffrorna kan glida isär.
    expect(dm).not.toContain("Bokade &amp; förlorade");
    expect(dm).not.toContain('c.stage === "won" || c.stage === "lost"');
  });

  it("röstfördelningen erbjuder alla sju lägena", () => {
    expect(dm).toContain("alternativ: LAGEN.map((l) => String(l.id))");
  });
});

describe("DM-4 · databasen tillåter det nya läget", () => {
  it("CHECK-villkoret räknar upp alla sju", () => {
    for (const v of ["new", "acknowledge", "connect", "offer", "won", "vilande", "lost"]) {
      expect(migration, v).toContain(`'${v}'`);
    }
  });

  it("det gamla villkoret släpps via katalogen, inte med ett gissat namn", () => {
    // Tabellen skapades utanför repot: vi vet inte vad villkoret heter. Ett gissat namn som
    // inte träffar hade lämnat den gamla listan kvar, och första kontakten som sattes till
    // vilande hade fallit på ett fel ingen letat efter.
    expect(migration).toContain("from pg_constraint");
    expect(migration).toContain("drop constraint %I");
  });

  it("kolumnen dokumenterar kopplingen till MySales-facken", () => {
    expect(migration).toContain("comment on column");
    expect(migration).toContain("vilande=Vilande");
  });
});

describe("DM-4b · sju fack ska gå att LÄSA", () => {
  // Håkans fynd 11/8, efter att facken kommit på plats: "det går ju inte att läsa kortens
  // rubriker, duger inte". Sju kolumner i ett rutnät delade bredden på sju — 130 px per fack
  // gav "Bekr…", "Erbju…", "Vilan…", "Förlo…" och avhuggna namn i korten.
  //
  // Ett rutnät är fel verktyg för en pipeline: det krymper kolumnerna när facken blir fler.
  // En kanban har FASTA kolumner och rullar i sidled, precis som MySales egen tavla.
  it("tavlan är inte ett rutnät som delar bredden", () => {
    expect(dm).not.toContain("xl:grid-cols-7");
    expect(dm).not.toContain("lg:grid-cols-4 xl:grid-cols-7");
  });

  it("högst fyra fack per rad — då blir varje kolumn läsbar", () => {
    // 7 fack i 4 kolumner bryter till 4 + 3. Kapet uppstod när alla sju delade EN rad.
    expect(dm).toContain("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4");
  });

  it("ingen sidledsrullning — Håkans besked 11/8", () => {
    // Mellanlösningen var fasta kolumner + overflow-x. Läsbar, men "vi kan inte ha så man
    // behöver skrolla i sidled". Två rader löser båda kraven samtidigt.
    const tavla = dm.slice(dm.indexOf("DM-4c"), dm.indexOf("STAGES.map((stage)"));
    expect(tavla).not.toContain("overflow-x-auto");
    expect(dm).not.toContain("flex gap-4 w-max min-w-full");
    expect(dm).not.toContain("w-[272px] flex-shrink-0");
  });

  it("facknamnet huggs aldrig av — det ÄR rubriken", () => {
    // Ordagrant på spanen: ett bredare fönster fångade en truncate på en annan rad, vilket
    // hade gjort testet till en gissning om var klassen låg.
    expect(dm).toContain('<span className="font-display font-bold text-sm text-gray-900">{stage.label}</span>');
  });

  it("kontaktens namn får radbrytas i stället för att kapas", () => {
    expect(dm).toContain("leading-snug break-words");
    expect(dm).not.toContain('<div className="font-semibold text-sm text-gray-900 truncate">');
  });

  it("knappraden bryter i stället för att klippa texten", () => {
    // "Kundregister" visade bara ett K i den smala kolumnen.
    expect(dm).toContain("flex flex-wrap items-center justify-between gap-1.5");
  });
});
