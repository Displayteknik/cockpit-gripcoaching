// NYCKEL-1 — en nyckel per kund, inmatad i Inställningar. Håkans två invändningar 13/8:
//   "varför ska jag behöva lägga det på hennes inläggssida"
//   "en kod från private integration ska väl räcka?"
//
// Båda befogade. Kopplingen låg begravd i Skapa inlägg och dök bara upp när man råkade
// välja Facebook eller LinkedIn, och samma sorts nyckel lagrades på TVÅ ställen:
//   · `clients.ghl_pit`            → Studio, publicering, kanalvalet
//   · `coach_users.ghl_api_token`  → Fokus, kundregistret
// Gitte hade den andra men inte den första. Därför stod alla tre kanalerna som
// "ej kopplad" trots att hennes Instagram var korrekt kopplad i MySales.
//
// ⚠ MÄTT 13/8 innan bygget: For Balance, AluCon och Makzy hade alla en nyckel i
// `coach_users` som gav 401 på ALLT — sociala konton, användare OCH kontakter. En fallback
// till den nyckeln hade alltså inte hjälpt någon; de behöver nya nycklar oavsett.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const las = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const ROUTE = las("app/api/studio/ghl-config/route.ts");
const VY = las("components/MySalesConnect.tsx");
const INSTALLNINGAR = las("app/dashboard/installningar/page.tsx");

describe("NYCKEL-1 · en nyckel räcker", () => {
  it("nyckeln skrivs till BÅDA ställena den behövdes på", () => {
    expect(ROUTE).toContain('.from("clients").update({ ghl_location_id: locationId, ghl_pit: pit })');
    expect(ROUTE).toContain('.from("coach_users")');
    expect(ROUTE).toContain("ghl_api_token: pit");
  });

  it("speglingen matchas på location, inte på klient", () => {
    // En location kan delas av flera coach_users (Displayteknik har två). Matchar man på
    // klient får bara den ena raden nyckeln, och den andra fortsätter vara död.
    expect(ROUTE).toContain('.eq("ghl_location_id", locationId)');
  });

  it("misslyckad spegling fäller aldrig sparningen", () => {
    // Studio fungerar redan när clients-raden är skriven. Att fälla hela kopplingen för
    // att en bonusrad inte gick att uppdatera vore att göra saken sämre.
    expect(ROUTE).toContain("[ghl-config] kunde inte spegla nyckeln till coach_users");
  });

  it("frånkoppling rör INTE coach_users", () => {
    // Fokus kan ha en egen giltig nyckel sedan tidigare. Att radera den vore att slå av
    // en funktion användaren inte bad om.
    const del = ROUTE.slice(ROUTE.indexOf("export async function DELETE"));
    expect(del).not.toContain("coach_users");
  });
});

describe("NYCKEL-1 · en nyckel som inte fungerar sparas aldrig", () => {
  it("kopplingen valideras mot MySales före sparning", () => {
    expect(ROUTE).toContain("const check = await ghlListAccounts({ locationId, pit })");
    expect(ROUTE).toContain("Nyckeln fungerar inte mot MySales");
  });

  it("varje behörighet provas för sig", () => {
    // Mätningen visade att en nyckel kan finnas och ändå ge 401 på allt. "Sparad" är
    // därför inte samma sak som "fungerar", och vyn ska visa vilket som gäller.
    for (const del of ["Sociala konton", "Användare", "Kontakter"]) {
      expect(ROUTE).toContain(del);
    }
    expect(ROUTE).toContain("provaBehorigheter");
  });

  it("varje behörighet säger vad som slutar fungera utan den", () => {
    expect(ROUTE).toContain("betyder:");
    expect(ROUTE).toContain("Kundlistan");
  });

  it("vyn visar utfallet per behörighet, inte bara ett grönt kvitto", () => {
    expect(VY).toContain("Vad nyckeln faktiskt får göra");
    expect(VY).toContain("— nekas (");
  });

  it("vyn säger uttryckligen att inget sparades vid fel", () => {
    expect(VY).toContain("Nyckeln sparades inte.");
  });
});

describe("NYCKEL-1 · den bor i Inställningar", () => {
  it("rutan finns bland integrationerna", () => {
    expect(INSTALLNINGAR).toContain('id: "mysales"');
    expect(INSTALLNINGAR).toContain('category: "integrations"');
    expect(INSTALLNINGAR).toContain("<MySalesConnect />");
  });

  it("hjälptexten säger vilka kryss som behövs i MySales", () => {
    // Utan den gissar man, och en nyckel utan Contacts ser ut att fungera tills kundlistan
    // är tom.
    expect(VY).toContain("Social Planner");
    expect(VY).toContain("Contacts");
  });

  it("nyckeln ligger inte kvar i fältet efter sparning", () => {
    expect(VY).toContain('setPit("")');
  });

  it("nyckeln returneras aldrig av GET", () => {
    const get = ROUTE.slice(ROUTE.indexOf("export async function GET"), ROUTE.indexOf("export async function POST"));
    expect(get).toContain("connected:");
    expect(get).not.toMatch(/pit:\s*data/);
  });
});

describe("NYCKEL-1b · en smalare nyckel får ALDRIG skriva över en bredare", () => {
  // ⚠ Detta är en rättelse av mitt eget bygge samma dag. Första versionen speglade rakt av.
  // Håkan påpekade att affärsbehörigheten låg i en separat integration som lades in vid
  // ONBOARDINGEN, i samma fält (`coach_users.ghl_api_token`). En ny nyckel med bara
  // socialplanner + contacts slog därför tyst ut Fokus idag och DM-tavlan.
  //
  // Mätt efteråt på For Balance: pipelines svarade 401 direkt efter speglingen.
  // En tyst försämring är värre än ett fel som syns.
  it("affärsbehörigheten provas, inte bara de tre första", () => {
    expect(ROUTE).toContain('namn: "Affärer"');
    expect(ROUTE).toContain("opportunities/pipelines");
  });

  it("speglingen sker bara när den nya nyckeln klarar affärerna", () => {
    expect(ROUTE).toContain('const klararAffarer = behorigheter.find((b) => b.namn === "Affärer")?.ok === true');
    expect(ROUTE).toContain('if (!klararAffarer) throw new Error("hoppar över spegling")');
  });

  it("den gamla nyckeln lämnas orörd, och användaren får veta varför", () => {
    expect(ROUTE).toContain("varning:");
    expect(ROUTE).toContain("använder fortfarande den nyckel som lades in vid onboardingen");
  });

  it("svaret säger om speglingen skedde eller inte", () => {
    // Utan det fältet ser en halv koppling ut som en hel.
    expect(ROUTE).toContain("speglad: klararAffarer");
  });
});
