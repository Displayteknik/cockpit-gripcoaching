// KUNDREGISTER-1 — läsande kundlista ur MySales.
//
// Beställningen: namn, taggar, källa, senaste aktivitet, koppling till DM-kortet, sök och
// taggfilter, synka-nu-mönstret och ÄRLIGA FELLÄGEN — aldrig tomt som ser trasigt ut.
//
// ⚠ Mätt mot skarpa konton innan bygget: Displayteknik 200 med 137 kontakter, For Balance
// och AluCon 401 "not authorized for this scope". Fellägena är alltså inte hypotetiska —
// två av tre tenants träffar dem i dag.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { byggKontaktrader, visningsnamn } from "@/lib/kundregister/synk";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("KUNDREGISTER-1 · namnet som visas", () => {
  it("MySales eget sammanslagna namn vinner", () => {
    // Annars visar Cockpit ett annat namn än MySales på samma person, och då litar
    // ingen på någondera vyn.
    expect(visningsnamn({ id: "1", contactName: "Anna Ek", firstName: "Annika" })).toBe("Anna Ek");
  });

  it("namnet byggs av delarna när det sammanslagna saknas", () => {
    expect(visningsnamn({ id: "1", firstName: "Anna", lastName: "Ek" })).toBe("Anna Ek");
  });

  it("utan namn blir det tomt — vyn skriver ut det i stället för att hitta på", () => {
    expect(visningsnamn({ id: "1" })).toBe("");
  });
});

describe("KUNDREGISTER-1 · spegelraderna", () => {
  const rader = byggKontaktrader(
    [{
      id: "c1",
      contactName: "Anna Ek",
      companyName: "Ek AB",
      email: "a@ek.se",
      phone: "070",
      tags: ["Offert-Lead", " kund ", ""],
      source: "webb",
      dateAdded: "2026-01-01T00:00:00Z",
      dateUpdated: "2026-08-01T10:00:00Z",
    }],
    ["t1", "t2"],
    "loc1",
    "2026-08-12T00:00:00Z",
  );

  it("en rad per tenant — en delad location får inte tappa den ena", () => {
    // Displayteknik delar en location över två coach_users. Skrivs bara den ena ser den
    // andra användaren en spegel som aldrig uppdateras (samma fynd som i Fokus-spegeln).
    expect(rader).toHaveLength(2);
    expect(rader.map((r) => r.tenant_id)).toEqual(["t1", "t2"]);
  });

  it("taggarna normaliseras — annars blir samma tagg två filter", () => {
    expect(rader[0].taggar).toEqual(["offert-lead", "kund"]);
  });

  it("alla fält beställningen bad om följer med", () => {
    const r = rader[0];
    expect(r.namn).toBe("Anna Ek");
    expect(r.foretag).toBe("Ek AB");
    expect(r.kalla).toBe("webb");
    expect(r.senast_aktivitet).toBe("2026-08-01T10:00:00Z");
  });

  it("kontakter utan id hoppas över i stället för att bli halva rader", () => {
    expect(byggKontaktrader([{ id: "" }], ["t1"], "loc1", "nu")).toEqual([]);
  });
});

describe("KUNDREGISTER-1 · läs-only mot MySales", () => {
  const synk = las("lib/kundregister/synk.ts");
  const route = las("app/api/kundregister/route.ts");

  it("synken skriver aldrig till MySales — bara GET mot kontakterna", () => {
    // Redigering sker i MySales. Två system som båda får ändra samma kontakt driver isär.
    expect(synk).not.toMatch(/method:\s*"(POST|PUT|PATCH|DELETE)"/);
  });

  it("routen har ingen skrivväg mot kontakterna", () => {
    // POST finns, men bara som "Synka nu" — den läser om, den ändrar inget.
    expect(route).not.toContain("upsert");
    expect(route).toContain('POST — "Synka nu"');
  });

  it("varje rad bär sin djuplänk till MySales", () => {
    expect(route).toContain("mysalesKontaktUrl(r.location_id, r.ghl_contact_id)");
  });
});

describe("KUNDREGISTER-1 · ärliga fellägen", () => {
  const synk = las("lib/kundregister/synk.ts");
  const route = las("app/api/kundregister/route.ts");
  const vy = las("components/Kundregister.tsx");

  it("401 blir klartext om vad som ska göras, inte en statuskod", () => {
    // Mätt: For Balance och AluCon svarar 401. Ett rått "MySales svarade 401" säger inte
    // vad kunden ska göra åt det.
    expect(synk).toMatch(/r\.status === 401 \|\| r\.status === 403/);
    expect(synk).toMatch(/Lägg till behörigheten för kontakter/);
  });

  it("ett databasfel ger 500 med kontakter: null — aldrig en tom lista", () => {
    expect(route).toContain("kontakter: null");
    expect(route).toMatch(/status: 500/);
  });

  it("åldern följer alltid med svaret", () => {
    // En vy som visar speglad data utan att säga när den hämtades är lika trovärdig som
    // en färsk — det var precis så Fokus visade tre dygn gammal pipeline obemärkt.
    expect(route).toContain("synkad: status.senastSynkad");
    expect(route).toContain("beskrivFarskhet(status.senastSynkad)");
  });

  it("vyn håller isär tomt, sökt-utan-träff och fel", () => {
    expect(vy).toContain("Inga kontakter i MySales än");
    expect(vy).toContain("Ingen kund matchar det du sökte på");
    expect(vy).toContain("se meddelandet ovan");
  });

  it("vyn skriver 'Aldrig hämtad' i stället för att se färsk ut", () => {
    expect(vy).toContain("Aldrig hämtad");
  });

  it("spegeln städas ALDRIG på ett tomt svar", () => {
    // Ett tillfälligt fel som ändå ger 200 med tom lista hade annars raderat hela
    // registret, och en tom lista ser ut som ett svar snarare än ett fel.
    expect(synk).toMatch(/if \(rader\.length\) \{[\s\S]*?delete\(\{ count: "exact" \}\)/);
  });
});

describe("KUNDREGISTER-1 · sök, filter och koppling", () => {
  const route = las("app/api/kundregister/route.ts");
  const vy = las("components/Kundregister.tsx");

  it("sökningen träffar namn, företag, e-post och telefon", () => {
    expect(route).toContain("[r.namn, r.foretag, r.epost, r.telefon]");
  });

  it("DEL 4-tillägget (21/8): tagg- och källfiltret är flerval (OR), körs i minnet på samma dataset sökningen redan hämtat", () => {
    // Ändrat med flit från ett DB-nivå .contains() för ETT värde till flerval. Ingen
    // ny kostnad: sökningen läste redan HELA tenantens mirror in i minnet (samma skäl
    // som förut — en OR-fråga över fyra textkolumner plus en array-kolumn med
    // användarens fritext är just den sortens sträng-hopfogning som blir ett
    // injektionshål), så tagg/källa-filtret kör på exakt samma redan hämtade data.
    expect(route).toContain("matcharTaggar((r.taggar || []).map((t) => t.toLowerCase()), valdaTaggar)");
    expect(route).toContain("matcharKalla(r.kalla || \"\", valdaKallor)");
  });

  it("taggarna räknas ur det tenanten faktiskt har", () => {
    // En handskriven lista hade erbjudit filter som inte ger några träffar.
    expect(route).toContain("taggRakning");
  });

  it("DM-kopplingen matchas på id, aldrig på namn", () => {
    // Namnmatchning slår ihop två personer som heter likadant — och det är riktiga
    // människors uppgifter.
    expect(route).toContain("dmPerKontakt.set(d.ghl_contact_id, d.id)");
    expect(vy).toContain("k.dmKortId &&");
  });

  it("avkortningen skrivs ut i stället för att tigas ihjäl", () => {
    expect(route).toContain("avkortad");
    expect(vy).toContain("visar de senast aktiva");
  });

  // Hittat på den färdiga sidan, inte i ett test: 137 kontakter blev "274 av 274 kunder"
  // och varje namn stod två gånger. Spegeln har en rad per tenant med flit (delad
  // location), men läsningen går över båda — utan hopslagning ser kunden allt dubbelt.
  // DoD:n missade det eftersom den räknade rader; synken rapporterade 137 unika id:n.
  it("en person visas EN gång, även när tenanten delar location över två coach-users", () => {
    expect(route).toContain("const perKontakt = new Map<string, SpegelRad>()");
    expect(route).toContain("if (!perKontakt.has(r.ghl_contact_id)) perKontakt.set(r.ghl_contact_id, r)");
    expect(route).toContain("const rader = [...perKontakt.values()]");
  });
});

describe("KUNDREGISTER-1 · sidorna finns och går att hitta", () => {
  const layout = las("app/dashboard/layout.tsx");

  it("kundvyn och byråvyn finns", () => {
    expect(las("app/k/kunder/page.tsx")).toContain("Kundregister");
    expect(las("app/dashboard/kunder/page.tsx")).toContain("Kundregister");
  });

  it("sidan står i menyn med sin kundmotsvarighet", () => {
    // En sida som inte finns i menyn finns inte (MENY-2).
    expect(layout).toContain('href: "/dashboard/kunder"');
    expect(layout).toContain('kundHref: "/k/kunder"');
  });

  it("DEL 4-tillägget (21/8): kundvyn har en EGEN entitlement, styrd pilot i stället för att åka på DM-modulen", () => {
    expect(las("app/k/kunder/page.tsx")).toContain('requireCustomerFeature("kundregister")');
    expect(las("app/k/kunder/page.tsx")).not.toContain('requireCustomerFeature("dm")');
  });
});
