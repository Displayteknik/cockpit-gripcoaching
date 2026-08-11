// KALENDER-1 + VECKA-1 — Håkans två krav 11/8, under hans egen testning.
//
//   1. "jag vill inte tvinga 7 inlägg i veckan, det måste vara flexibelt att klicka i 3 dagar"
//      Kalendervägen (CC-4) hade dagval sedan tidigare. Veckoplanssidan räknade ALLTID sju:
//      `WEEK_ROLES.map(...)` i routen, och sidan skickade inget val. Nu delar båda vägarna
//      samma regel — rollen (4A × DISC × funnel) hör till VECKODAGEN, så väljer man tisdag
//      och torsdag får man de dagarnas roller, inte de två första i listan.
//
//   2. "man borde kunna dra inläggen dit man vill i kalendern"
//      Brickorna var länkar utan flytt. Nu är de dragbara, och flytten skriver i rätt
//      datumkolumn per källa — varje verkstad har sin egen.
//
// Grinden läser källkoden: den låser reglerna som INTE syns i en klickrunda.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const las = (fil: string) => readFileSync(new URL(`../${fil}`, import.meta.url), "utf8");
const route = las("app/api/generate/week/route.ts");
const sida = las("app/dashboard/(inlagg)/veckoplan/page.tsx");
const item = las("app/api/content/item/route.ts");
const kalender = las("components/content-compass/ContentCalendar.tsx");
const kalenderSida = las("app/dashboard/studio/kalender/page.tsx");

describe("VECKA-1 · antalet dagar är kundens val", () => {
  it("routen läser valda dagar ur bodyn", () => {
    expect(route).toContain("bodyDagar");
    expect(route).toContain("valdaRoller");
  });

  it("utan val är beteendet exakt som förut — alla sju", () => {
    // Bakåtkompatibiliteten är hela poängen: kalendervägen och nattloopen skickar inget val.
    expect(route).toMatch(/bodyDagar\?\.length \? WEEK_ROLES\.filter/);
    expect(route).toContain(": WEEK_ROLES;");
  });

  it("ett tomt eller obegripligt val ger hela veckan, inte noll inlägg", () => {
    expect(route).toContain("valda.length ? valda : WEEK_ROLES");
  });

  it("prompten säger rätt antal och rätt dagar — inte hårdkodat 7", () => {
    expect(route).toContain("${antalDagar} inlägg");
    expect(route).not.toContain("Du genererar 7 inlägg");
    expect(route).not.toContain("... 7 dagar totalt");
    // Schemat måste börja på den FÖRSTA valda dagen, annars ber vi om måndag när
    // användaren valt tisdag.
    expect(route).toContain('"day": "${valdaRoller[0].day}"');
  });

  it("svaret byggs ur de valda rollerna", () => {
    expect(route).toContain("const days: DayPlan[] = valdaRoller.map");
  });

  it("sidan skickar valet och spärrar på noll dagar", () => {
    expect(sida).toContain("dagar: valdaDagar");
    expect(sida).toContain("Välj minst en dag");
    expect(sida).toMatch(/valdaDagar\.length === 0/);
  });

  it("sidan lovar inte längre sju inlägg i texten", () => {
    expect(sida).not.toContain("Sju inlägg på en gång");
  });

  it("dagvalet töms vid klientbyte — kadensen är kundens, inte vår", () => {
    // UTKAST-2:s grind fällde just det här när fältet var nytt: det låg i utkastet men
    // tömdes inte, så nästa kund hade ärvt förra kundens veckorytm.
    expect(sida).toContain("setValdaDagar(ALLA_DAGAR);");
  });
});

describe("KALENDER-1 · flytta genom att dra", () => {
  it("varje källa skriver i SIN egen datumkolumn", () => {
    expect(item).toContain('studio: "scheduled_at"');
    expect(item).toContain('social: "scheduled_for"');
    expect(item).toContain('linkedin: "scheduled_for"');
  });

  it("bloggen går INTE att flytta — dess datum är publiceringstiden på sajten", () => {
    const i = item.indexOf("const DATUMKOLUMN");
    const block = item.slice(i, i + 260);
    expect(block).not.toContain("blog:");
    expect(item).toContain("går inte att flytta i kalendern");
  });

  it("publicerat flyttas aldrig", () => {
    expect(item).toContain("redan publicerat och kan inte flyttas");
    // Statusen läses per källa: kolumnerna heter olika i varje verkstad.
    expect(item).toMatch(/ghl_status|published_at|posted_at/);
  });

  it("bakåt i tiden avvisas, med samma gräns som schemaläggningen", () => {
    expect(item).toContain("Date.now() - 60_000");
    expect(item).toContain("har redan passerat");
  });

  it("flytten är tenant-låst i BÅDA leden — läsningen och skrivningen", () => {
    const i = item.indexOf("export async function PATCH");
    const patch = item.slice(i);
    expect(patch.match(/\.eq\("client_id", clientId\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("kalendern drar bara det som får dras", () => {
    expect(kalender).toContain('it.status !== "published"');
    expect(kalender).toContain('it.source !== "blog"');
    // Utan en flyttfunktion beter kalendern sig precis som förut (kundvyn, navet).
    expect(kalender).toContain("Boolean(onMove)");
  });

  it("klockslaget följer med när dagen byts", () => {
    // Ett rent datumbyte hade lagt allt på midnatt. En post tisdag 20:00 ska ligga 20:00.
    expect(kalender).toContain("Behåll klockslaget");
    expect(kalender).toMatch(/gammal.*getHours\(\)/);
  });

  it("sidan lägger tillbaka det gamla datumet om skrivningen failar", () => {
    expect(kalenderSida).toContain("const forra = it.when");
    expect(kalenderSida).toContain("Kunde inte flytta inlägget");
    // Felet SYNS: en bricka på fel dag utan felmeddelande är en tystare lögn än ett fel.
    expect(kalenderSida).toContain("flyttFel");
  });
});
