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
