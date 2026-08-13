// KANAL-4 — karusellen till Instagram i två steg (Håkans beställning 13/8).
//
// ★ MÄTT I DRIFT: en sjuslides-karusell från Displayteknik föll med "det tog för lång tid".
//   `/api/studio/publish` har 60 sekunders tak, och taket går INTE att höja på Vercels
//   Hobby-plan. En karusell hinner inte inom det: Meta hämtar VARJE bild själv, en
//   container per slide, sedan byggs karusellcontainern, och först när den är klar får
//   man publicera.
//
//   Samma lösning som djupgranskningens batch: dela arbetet så att inget enskilt anrop
//   behöver vänta på hela kedjan. Steg 1 bygger, steg 2 publicerar när Meta är klar.
//
// Modulen är ett tunt lager: kontot, JPEG-konverteringen och de två stegen. Själva
// Graph-anropen bor kvar i lib/instagram.

import { getIgConnection, forberedKarusell, publiceraContainer } from "@/lib/instagram";
import { ensureJpegUrl } from "@/lib/images";

export { forberedKarusell, publiceraContainer };

export interface IgKonto { ig_account_id: string; ig_access_token: string }

export async function igKonto(clientId: string): Promise<IgKonto | null> {
  const k = await getIgConnection(clientId);
  // Båda fälten är valfria i typen (en halvfärdig koppling finns i verkligheten), så
  // kontot räknas som kopplat först när BÅDA finns. Annars faller publiceringen längre
  // fram med ett obegripligt Graph-fel i stället för ett tydligt besked här.
  if (!k?.ig_account_id || !k?.ig_access_token) return null;
  return { ig_account_id: k.ig_account_id, ig_access_token: k.ig_access_token };
}

/**
 * Instagram tar bara emot JPEG. Studios render är PNG, så varje slide konverteras innan
 * containrarna byggs. Konverteringen görs HÄR och inte i steg 2: misslyckas den ska det
 * synas innan Meta börjat hämta något.
 */
export async function jpegUrler(urler: string[]): Promise<string[]> {
  const ut: string[] = [];
  for (const u of urler) {
    const j = await ensureJpegUrl(u);
    if (j.error || !j.url) throw new Error(`Kunde inte förbereda bild ${ut.length + 1}: ${j.error || "okänt fel"}`);
    ut.push(j.url);
  }
  return ut;
}
