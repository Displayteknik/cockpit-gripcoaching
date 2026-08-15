// DRIV-1 — engångsstädningen (1E). Deterministisk regeltabell i KOD, ingen AI. Kör en
// gång: för varje affär i spel utan nästa steg, föreslå ett datum + en text, Håkan
// granskar i klump, godkänner, uppgiften skapas i MySales.
//
// ⚠ GHL:s publika API saknar en affärs-scopad uppgiftsändpunkt (verifierat mot OpenAPI-
// specen 2026-08-15, se lib/driv/ghl.ts). Uppgiften skapas på KONTAKTEN — det enda API:t
// tillåter. En kontakt med flera öppna affärer får affärens namn i titeln, så det syns
// vilken affär uppgiften gäller även om GHL bara känner till kontakten.
//
// Idempotens: INGEN egen "redan körd"-tabell. Innan en uppgift skapas läses kontaktens
// öppna uppgifter live ur MySales (samma /tasks-endpoint HQ-pipelinen redan använder) —
// finns redan en öppen uppgift med EXAKT samma titel skapas ingen ny. Det håller
// idempotensen mot sanningen i MySales i stället för mot en egen bokföring som kan glida.

import { supabaseService } from "@/lib/supabase-admin";
import { hamtaHqGhl } from "@/lib/hq/pipeline";
import { hamtaUppgifterForKontakt, skapaUppgift } from "@/lib/driv/ghl";

interface Regel {
  namn: string;
  test: RegExp;
  troskelDagar: number;
  titel: string;
  datumOffsetDagar: number;
}

/**
 * Regeltabellen. Ordningen spelar roll — första träff vinner. Trösklarna är satta
 * konservativt (hellre missa en påminnelse än störa en affär som faktiskt rör sig).
 */
// ⚠ Ordningen är mätt, inte gissad: DT:s riktiga stegnamn "Förhandling / ändring (allt
// som "ändra i offert" hamnar här)" innehåller ordet "offert" i en parentes. Med
// offert-regeln FÖRST vann den regeln över Förhandling på det steget — fel förslag på
// riktig data. Förhandling (ett ord som aldrig dyker upp av misstag i andra stegnamn)
// måste därför testas FÖRE den bredare erbjudande/offert-regeln.
export const STADNINGSREGLER: Regel[] = [
  { namn: "Förhandling", test: /forhandl|förhandl/i, troskelDagar: 5, titel: "Stäm av var förhandlingen står", datumOffsetDagar: 1 },
  { namn: "Dialog", test: /^dialog$/i, troskelDagar: 14, titel: "Återuppta tråden", datumOffsetDagar: 2 },
  { namn: "Bekräftad", test: /bekraftad|bekräftad/i, troskelDagar: 10, titel: "Boka ett möte", datumOffsetDagar: 2 },
  { namn: "Uppföljning", test: /uppfoljning|uppföljning|follow/i, troskelDagar: 10, titel: "Hör av dig igen", datumOffsetDagar: 3 },
  { namn: "Erbjudande/offert", test: /erbjudande|offert/i, troskelDagar: 3, titel: "Ring och följ upp offerten", datumOffsetDagar: 1 },
];
const FALLBACK: Regel = { namn: "Övrigt", test: /.*/, troskelDagar: 14, titel: "Ta kontakt och stäm av läget", datumOffsetDagar: 1 };

function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function iso(dagarFramat: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dagarFramat);
  d.setUTCHours(8, 0, 0, 0); // 08:00 så det ligger överst på morgonlistan
  return d.toISOString();
}

export interface Forslag {
  ghlOpportunityId: string;
  ghlContactId: string;
  namn: string | null;
  stegNamn: string | null;
  dagarISteget: number | null;
  regel: string;
  titel: string;
  datum: string;
}

/** Bygger förslagslistan — läser bara, skriver ingenting. Grunden för granskningsvyn. */
export async function byggForslag(): Promise<Forslag[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("hq_pipeline_cache")
    .select("ghl_opportunity_id, ghl_contact_id, namn, steg_namn, steg_sedan, uppfoljning_datum, harledd_status");
  const rader = (data as Array<{
    ghl_opportunity_id: string; ghl_contact_id: string | null; namn: string | null;
    steg_namn: string | null; steg_sedan: string | null; uppfoljning_datum: string | null; harledd_status: string;
  }> | null) || [];

  const forslag: Forslag[] = [];
  for (const r of rader) {
    if (r.harledd_status !== "open") continue; // vunna/förlorade affärer behöver inget nästa steg
    if (r.uppfoljning_datum) continue;          // har redan nästa steg — spec: bara de som saknar
    if (!r.ghl_contact_id) continue;             // ingen kontakt att fästa uppgiften på

    const dagarISteget = r.steg_sedan ? Math.floor((Date.now() - new Date(r.steg_sedan).getTime()) / 86400000) : null;
    const n = norm(r.steg_namn || "");
    const regel = STADNINGSREGLER.find((reg) => reg.test.test(n)) || FALLBACK;
    if (dagarISteget === null || dagarISteget < regel.troskelDagar) continue;

    forslag.push({
      ghlOpportunityId: r.ghl_opportunity_id,
      ghlContactId: r.ghl_contact_id,
      namn: r.namn,
      stegNamn: r.steg_namn,
      dagarISteget,
      regel: regel.namn,
      titel: r.namn ? `${regel.titel} – ${r.namn}` : regel.titel,
      datum: iso(regel.datumOffsetDagar),
    });
  }
  return forslag;
}

export interface StadningsKvitto {
  ghlOpportunityId: string;
  namn: string | null;
  skapad: boolean;
  hoppadeOver?: string; // skäl, t.ex. "uppgift finns redan"
  fel?: string;
}

/**
 * Godkänner en lista (Håkan kan ha justerat titel/datum per rad i granskningsvyn) och
 * skapar uppgifterna i MySales. Kör en kontakt i taget — inga parallella skrivningar mot
 * samma kontakts uppgiftslista.
 */
export async function godkannStadning(rader: Array<{ ghlOpportunityId: string; ghlContactId: string; namn: string | null; titel: string; datum: string }>): Promise<StadningsKvitto[]> {
  const cfg = await hamtaHqGhl();
  if (!cfg) throw new Error("Ingen koppling till MySales är inlagd för Displayteknik.");

  const kvitton: StadningsKvitto[] = [];
  for (const r of rader) {
    try {
      const befintliga = await hamtaUppgifterForKontakt(cfg, r.ghlContactId);
      const finnsRedan = befintliga.some((u) => !u.completed && u.title.trim() === r.titel.trim());
      if (finnsRedan) {
        kvitton.push({ ghlOpportunityId: r.ghlOpportunityId, namn: r.namn, skapad: false, hoppadeOver: "En öppen uppgift med samma titel finns redan" });
        continue;
      }
      const svar = await skapaUppgift(cfg, r.ghlContactId, r.titel, r.datum);
      if (!svar.ok) {
        kvitton.push({ ghlOpportunityId: r.ghlOpportunityId, namn: r.namn, skapad: false, fel: svar.fel || "MySales avvisade uppgiften" });
        continue;
      }
      kvitton.push({ ghlOpportunityId: r.ghlOpportunityId, namn: r.namn, skapad: true });
    } catch (e) {
      kvitton.push({ ghlOpportunityId: r.ghlOpportunityId, namn: r.namn, skapad: false, fel: (e as Error).message });
    }
  }
  return kvitton;
}
