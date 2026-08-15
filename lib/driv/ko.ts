// DRIV-4 — morgonkön "Dagens drag". Se migrations/driv4_dagens_drag.sql för varför
// beräkningen är ON-DEMAND (en gång per dag, idempotent) i stället för enbart cron-driven.
//
// Rankning ÅTERANVÄNDER Fokusmotorns formel rakt av (lib/fokus/priority.ts::vardepoang
// + bradska, lib/fokus/config.ts::regelForSteg) — samma "värme, värde, tid" spec:en ber
// om, inte en ny parallell formel. Berikar den sedan med DRIV:s egna, bredare signaler
// (obesvarat över GHL+Gmail via hq_kontakt_status, offert-uppföljning, kalendermöten)
// som Fokusmotorn själv inte känner till.
//
// En affär kan träffas av flera skäl (uppgift förfallen OCH obesvarad OCH gammal i
// steget). Precis som hq_kontakt.ts:s regelrader gör: den STRÄNGASTE vinner, en rad per
// affär — annars ropar kön varg och Håkan slutar lita på den.

import { supabaseService } from "@/lib/supabase-admin";
import { regelForSteg } from "@/lib/fokus/config";
import { vardepoang, bradska } from "@/lib/fokus/priority";
import { hamtaHqGhl } from "@/lib/hq/pipeline";
import { sattNastaSteg, markeraTidigasteUppgiftKlar } from "@/lib/driv/ghl";
import { kalenderKandidat } from "@/lib/driv/matchning";
import { byggKort } from "@/lib/driv/kort";
import { byggMoteForberedelse, type MoteForberedelse } from "@/lib/driv/mote-forberedelse";

const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

export type KoTyp = "uppgift_forfallen" | "obesvarat" | "offert_uppfoljning" | "mote_forberedelse" | "steg_aldrat";

export interface KoRad {
  id: string;
  ghlOpportunityId: string | null;
  ghlContactId: string | null;
  namn: string | null;
  typ: KoTyp;
  varforNu: string;
  foreslagetDrag: string;
  prioritet: number;
  status: "oppen" | "klar" | "senare_idag" | "vecka";
  moteForberedelse?: MoteForberedelse;
}

function idagStockholm(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }); // YYYY-MM-DD
}

async function hamtaTroskelTimmar(sb: ReturnType<typeof supabaseService>): Promise<number> {
  const { data } = await sb.from("driv_ko_installningar").select("troskel_obesvarat_timmar").eq("tenant_id", DT_CLIENT_ID).maybeSingle();
  return (data as { troskel_obesvarat_timmar: number } | null)?.troskel_obesvarat_timmar ?? 24;
}

interface Signal { typ: KoTyp; varforNu: string; foreslagetDrag: string; prioritet: number }

/** Beräknar kön (dyrt) — Supabase-rader + GHL/kalender-läsningar. */
async function berakna(): Promise<Omit<KoRad, "id" | "status">[]> {
  const sb = supabaseService();
  const troskelTimmar = await hamtaTroskelTimmar(sb);
  const nu = Date.now();
  const slutPaDagen = new Date(); slutPaDagen.setHours(23, 59, 59, 999);

  const [{ data: pipeline }, { data: kontaktStatus }, { data: offerter }] = await Promise.all([
    sb.from("hq_pipeline_cache").select("ghl_opportunity_id, ghl_contact_id, namn, foretag, epost, steg_namn, steg_sedan, varde, uppfoljning_datum, uppfoljning_titel").eq("harledd_status", "open"),
    sb.from("hq_kontakt_status").select("opportunity_id, bollen_hos, senaste_in_datum, senaste_in_amne"),
    sb.from("offert_quotes").select("ghl_opportunity_id, quote_number, status, sent_at"),
  ]);

  const kontaktMap = new Map(((kontaktStatus as Array<{ opportunity_id: string; bollen_hos: string; senaste_in_datum: string | null; senaste_in_amne: string | null }> | null) || []).map((k) => [k.opportunity_id, k]));
  const offerterMap = new Map<string, Array<{ quote_number: string | null; status: string; sent_at: string | null }>>();
  for (const o of (offerter as Array<{ ghl_opportunity_id: string | null; quote_number: string | null; status: string; sent_at: string | null }> | null) || []) {
    if (!o.ghl_opportunity_id) continue;
    const lista = offerterMap.get(o.ghl_opportunity_id) || [];
    lista.push(o);
    offerterMap.set(o.ghl_opportunity_id, lista);
  }

  const rader: Omit<KoRad, "id" | "status">[] = [];

  for (const p of (pipeline as Array<{ ghl_opportunity_id: string; ghl_contact_id: string | null; namn: string | null; foretag: string | null; epost: string | null; steg_namn: string | null; steg_sedan: string | null; varde: number; uppfoljning_datum: string | null; uppfoljning_titel: string | null }> | null) || []) {
    const regel = regelForSteg(p.steg_namn || "");
    const dagarISteget = p.steg_sedan ? Math.floor((nu - new Date(p.steg_sedan).getTime()) / 86400000) : 0;
    const harSla = regel.sla !== null;
    const dagarOverSla = harSla ? dagarISteget - (regel.sla as number) : 0;
    const vp = vardepoang(Number(p.varde) || 0);
    const { poang: bp } = bradska(dagarOverSla, harSla);
    const bas = Math.round(vp * bp * regel.vikt * 10) / 10;

    const signaler: Signal[] = [];

    if (p.uppfoljning_datum && new Date(p.uppfoljning_datum) <= slutPaDagen) {
      const forfallen = new Date(p.uppfoljning_datum) < new Date();
      signaler.push({
        typ: "uppgift_forfallen",
        varforNu: `Uppgift "${p.uppfoljning_titel || "Uppgift"}" ${forfallen ? "har förfallit" : "ska göras idag"}.`,
        foreslagetDrag: p.uppfoljning_titel || "Gör uppgiften",
        prioritet: bas * 2.0,
      });
    }

    const ks = kontaktMap.get(p.ghl_opportunity_id);
    if (ks?.bollen_hos === "oss" && ks.senaste_in_datum) {
      const timmarSedan = (nu - new Date(ks.senaste_in_datum).getTime()) / 3600000;
      if (timmarSedan >= troskelTimmar) {
        const dagar = Math.floor(timmarSedan / 24);
        signaler.push({
          typ: "obesvarat",
          varforNu: `${p.namn || "Affären"} väntar på svar${ks.senaste_in_amne ? ` om "${ks.senaste_in_amne}"` : ""} sedan ${dagar >= 1 ? `${dagar} dag${dagar === 1 ? "" : "ar"}` : `${Math.floor(timmarSedan)} timmar`}.`,
          foreslagetDrag: "Svara",
          prioritet: bas * 2.5,
        });
      }
    }

    for (const o of offerterMap.get(p.ghl_opportunity_id) || []) {
      if (o.status !== "sent" || !o.sent_at) continue;
      const dagarSedanSkickad = Math.floor((nu - new Date(o.sent_at).getTime()) / 86400000);
      if (dagarSedanSkickad >= 3) {
        signaler.push({
          typ: "offert_uppfoljning",
          varforNu: `Offert ${o.quote_number || ""} skickad för ${dagarSedanSkickad} dagar sedan, inget svar, värde ${Math.round(p.varde || 0).toLocaleString("sv-SE")} kr.`,
          foreslagetDrag: "Följ upp offerten",
          prioritet: bas * 2.2,
        });
      }
    }

    // ⚠ Mätt live 2026-08-15: utan `!p.uppfoljning_datum`-villkoret flaggar den här
    // regeln EN AFFÄR VARJE DAG framåt, även efter att städningen (DRIV-1) satt ett
    // planerat nästa steg långt fram i tiden — kön hade tjatat om exakt det den
    // städningen redan löst. Bara affärer UTAN någon plan alls räknas som åldrade.
    if (dagarOverSla > 0 && !p.uppfoljning_datum && !signaler.length) {
      signaler.push({
        typ: "steg_aldrat",
        varforNu: `${dagarISteget} dagar i steget "${p.steg_namn}", ${dagarOverSla} dagar mer än normalt, inget nästa steg satt.`,
        foreslagetDrag: "Ta kontakt och stäm av läget",
        prioritet: bas,
      });
    }

    if (!signaler.length) continue;
    signaler.sort((a, b) => b.prioritet - a.prioritet);
    const val = signaler[0];
    rader.push({ ghlOpportunityId: p.ghl_opportunity_id, ghlContactId: p.ghl_contact_id, namn: p.namn, ...val });
  }

  // Mötesförberedelse — dagens kalenderhändelser, svagt matchade mot en affär (namn/företag).
  try {
    const idag0 = new Date(); idag0.setHours(0, 0, 0, 0);
    const idag24 = new Date(); idag24.setHours(23, 59, 59, 999);
    const { data: handelser } = await sb.from("hq_kalender_cache").select("titel, beskrivning, start_tid").gte("start_tid", idag0.toISOString()).lt("start_tid", idag24.toISOString());
    const pipelineRader = (pipeline as Array<{ ghl_opportunity_id: string; ghl_contact_id: string | null; namn: string | null; foretag: string | null }> | null) || [];
    for (const h of (handelser as Array<{ titel: string | null; beskrivning: string | null; start_tid: string | null }> | null) || []) {
      const traff = pipelineRader.find((p) => [p.namn, p.foretag].filter(Boolean).some((s) => kalenderKandidat(s as string, h.titel, h.beskrivning)));
      if (!traff) continue;
      let kort;
      try { kort = await byggKort(traff.ghl_opportunity_id); } catch { continue; }
      const forberedelse = await byggMoteForberedelse(kort).catch(() => undefined);
      rader.push({
        ghlOpportunityId: traff.ghl_opportunity_id, ghlContactId: traff.ghl_contact_id, namn: traff.namn,
        typ: "mote_forberedelse",
        varforNu: `Möte idag: "${h.titel}" kl ${new Date(h.start_tid!).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })}.`,
        foreslagetDrag: "Förbered dig — se läget och föreslagna frågor",
        prioritet: 9999, // möten idag ligger alltid överst
        moteForberedelse: forberedelse,
      });
    }
  } catch {
    /* mötesförberedelse är ett tillägg, får aldrig stoppa resten av kön */
  }

  return rader.sort((a, b) => b.prioritet - a.prioritet);
}

/** Bygger (om den inte redan finns för idag) och returnerar dagens kö. */
export async function hamtaKo(tvinga = false): Promise<{ rader: KoRad[]; redanBeraknad: boolean }> {
  const sb = supabaseService();
  const dag = idagStockholm();

  if (!tvinga) {
    const { data: befintlig } = await sb.from("driv_ko").select("*").eq("tenant_id", DT_CLIENT_ID).eq("dag", dag).order("prioritet", { ascending: false });
    if (befintlig?.length) return { rader: mappaRader(befintlig), redanBeraknad: true };
  }

  const berakning = await berakna();
  const rader = berakning.map((r) => ({
    tenant_id: DT_CLIENT_ID, dag, ghl_opportunity_id: r.ghlOpportunityId, typ: r.typ,
    varfor_nu: r.varforNu, foreslaget_drag: r.foreslagetDrag, prioritet: r.prioritet, status: "oppen" as const,
    forberett_utkast: r.moteForberedelse ? { moteForberedelse: r.moteForberedelse } : null,
  }));

  await sb.from("driv_ko").delete().eq("tenant_id", DT_CLIENT_ID).eq("dag", dag);
  if (rader.length) await sb.from("driv_ko").insert(rader);

  const { data: sparade } = await sb.from("driv_ko").select("*").eq("tenant_id", DT_CLIENT_ID).eq("dag", dag).order("prioritet", { ascending: false });
  return { rader: mappaRader(sparade || [], berakning), redanBeraknad: false };
}

function mappaRader(
  db: Array<{ id: string; ghl_opportunity_id: string | null; typ: string; varfor_nu: string; foreslaget_drag: string; prioritet: number; status: string; forberett_utkast: unknown }>,
  berikning?: Omit<KoRad, "id" | "status">[],
): KoRad[] {
  const namnPerOpp = new Map((berikning || []).map((r) => [r.ghlOpportunityId, r]));
  return db.map((r) => {
    const b = namnPerOpp.get(r.ghl_opportunity_id);
    const utkast = r.forberett_utkast as { moteForberedelse?: MoteForberedelse } | null;
    return {
      id: r.id, ghlOpportunityId: r.ghl_opportunity_id, ghlContactId: b?.ghlContactId ?? null, namn: b?.namn ?? null,
      typ: r.typ as KoTyp, varforNu: r.varfor_nu, foreslagetDrag: r.foreslaget_drag, prioritet: Number(r.prioritet),
      status: r.status as KoRad["status"], moteForberedelse: utkast?.moteForberedelse,
    };
  });
}

/** Klart / Senare idag / Vecka. Rör GHL bara för uppgift_forfallen (då finns en riktig uppgift att flytta/klarmarkera). */
export async function agerraKoRad(id: string, beslut: "klar" | "senare_idag" | "vecka"): Promise<{ ok: boolean; fel?: string }> {
  const sb = supabaseService();
  const { data: rad } = await sb.from("driv_ko").select("*").eq("id", id).maybeSingle();
  if (!rad) return { ok: false, fel: "Raden finns inte längre." };
  const r = rad as { ghl_contact_id: string | null; typ: string; foreslaget_drag: string };

  if (r.typ === "uppgift_forfallen" && r.ghl_contact_id) {
    const cfg = await hamtaHqGhl();
    if (!cfg) return { ok: false, fel: "Ingen koppling till MySales." };
    if (beslut === "klar") {
      const svar = await markeraTidigasteUppgiftKlar(cfg, r.ghl_contact_id);
      if (!svar.ok) return { ok: false, fel: svar.fel || "Kunde inte klarmarkera uppgiften i MySales." };
    } else {
      const nyttDatum = beslut === "senare_idag" ? new Date(Date.now() + 3 * 3600000) : new Date(Date.now() + 7 * 86400000);
      const svar = await sattNastaSteg(cfg, r.ghl_contact_id, r.foreslaget_drag, nyttDatum.toISOString());
      if (!svar.ok) return { ok: false, fel: svar.fel };
    }
  }

  const { error } = await sb.from("driv_ko").update({ status: beslut, uppdaterad_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, fel: error.message };
  return { ok: true };
}
