// DRIV-1 — sammansätter kortet för EN affär: läget + tidslinjen ur GHL-konversationer,
// Gmail, kalender och offerter. Läser alltid färskt när ett kort öppnas (1D) och speglar
// resultatet i driv_kort_cache åt framtida listvyer (DRIV-4).
//
// Fail-open per källa: en källa som fallerar (Gmail nere, GHL-kvot) tar inte ner hela
// kortet — den källan visas med ett svenskt felmeddelande i stället, resten av kortet
// visas ändå. Samma princip som hq_kalender_cache/hq_kontakt_status redan använder.

import { supabaseService } from "@/lib/supabase-admin";
import { hamtaHqGhl, type HqGhl } from "@/lib/hq/pipeline";
import { hamtaKoppling, kopplingsScope, agarToken } from "@/lib/hq/kalender";
import { hamtaKonversationer, hamtaMeddelanden, hamtaKontakt, hamtaUppgifterForKontakt, hamtaStegInfo, type GhlKontakt, type StegInfo } from "@/lib/driv/ghl";
import { hamtaTradMetadata, sokMeddelandenMedBilaga } from "@/lib/driv/gmail";
import { foreslaLank, lasLankar, kalenderKandidat, type LankRad } from "@/lib/driv/matchning";
import { hamtaPrislista, type Prisrad } from "@/lib/driv/pris";

export type TidslinjeKalla = "ghl_konversation" | "gmail" | "kalender" | "offert" | "uppgift";

/** DRIV-2: vad "Svara"-knappen behöver för att skicka i RÄTT tråd/kanal. */
export type SvarsData =
  | { kanal: "gmail"; tradId: string; messageIdHeader: string; motpart: string; amne: string }
  | { kanal: "ghl"; konversationTyp: string; motpart: string };

export interface TidslinjePost {
  kalla: TidslinjeKalla;
  id: string;
  tidpunkt: string;
  riktning: "in" | "ut" | null;
  titel: string;
  snippet: string | null;
  kanalIkon: string; // kort etikett för UI:t (sms/mejl/instagram/möte/offert/uppgift)
  osaker?: boolean; // true för kalenderträffar som väntar på bekräftelse
  lankId?: string; // driv_lankar.id när posten är en föreslagen kalenderträff
  svar?: SvarsData; // DRIV-2: satt på inkommande poster som går att svara på
  varning?: string; // DRIV-3: t.ex. "Offert äldre än 3 dagar utan svar"
  /** DRIV-3: mejlet har en bilaga (Håkans fynd — riktiga offerter skickas som mejlbilaga,
   *  inte via Offertmotorn). Bilagelistan hämtas separat, live, på klick. */
  harBilaga?: boolean;
}

export interface KortLage {
  ghlOpportunityId: string;
  ghlContactId: string | null;
  namn: string | null;
  foretag: string | null;
  epost: string | null;
  telefon: string | null;
  taggar: string[];
  stegNamn: string | null;
  stegId: string | null;
  stegInfo: StegInfo | null;
  varde: number;
  dagarISteget: number | null;
  nastaSteg: { titel: string; datum: string } | null;
  saknarNastaSteg: boolean;
  locationId: string;
}

export interface SenasteKontakt {
  text: string;
  bollenHos: "kund" | "oss" | "okant";
}

export interface DrivKort {
  lage: KortLage;
  senasteKontakt: SenasteKontakt;
  tidslinje: TidslinjePost[];
  foreslagnaLankar: LankRad[];
  prislista: Prisrad[]; // DRIV-3, ur säljlagret (v_sl_publik)
  /** DRIV-3: en skickad offert utan uppföljning → förslag, ALDRIG automatiskt satt. */
  offertForslag: { offertId: string; titel: string; datum: string } | null;
  fel: string[]; // svenska felmeddelanden per källa som fallerade, kortet visas ändå
  hamtadTidsstampel: string;
}

// Bara ÄKTA meddelandekanaler — GHL:s /messages-endpoint blandar in egna aktivitetsloggrader
// (TYPE_ACTIVITY_OPPORTUNITY: "Opportunity updated" osv, TYPE_INTERNAL_COMMENT) som INTE är
// kommunikation med kunden. Mätt live på Sofia Boudons kort 2026-08-15: två sådana rader
// låg i tidslinjen och såg ut som riktiga meddelanden. Allt som inte finns i listan filtreras
// bort i byggKort — se KANNDA_MEDDELANDETYPER nedan.
const KANAL_IKON: Record<string, string> = {
  TYPE_SMS: "SMS", TYPE_EMAIL: "Mejl (MySales)", TYPE_CALL: "Samtal", TYPE_WEBCHAT: "Webbchatt",
  TYPE_FACEBOOK: "Facebook", TYPE_INSTAGRAM: "Instagram", TYPE_WHATSAPP: "WhatsApp",
  TYPE_GMB: "Google", TYPE_LIVE_CHAT: "Livechatt", TYPE_REVIEW: "Recension",
  TYPE_CUSTOM_SMS: "SMS", TYPE_CUSTOM_EMAIL: "Mejl (MySales)", TYPE_CUSTOM_CALL: "Samtal",
};
const KANNDA_MEDDELANDETYPER = new Set(Object.keys(KANAL_IKON));

async function byggLage(sb: ReturnType<typeof supabaseService>, cfg: HqGhl, ghlOpportunityId: string): Promise<{ lage: KortLage; kontakt: GhlKontakt | null; fel: string[] }> {
  const fel: string[] = [];
  const { data: pipeRad } = await sb
    .from("hq_pipeline_cache")
    .select("ghl_opportunity_id, ghl_contact_id, namn, foretag, epost, steg_namn, steg_id, varde, steg_sedan, uppfoljning_datum, uppfoljning_titel, location_id")
    .eq("ghl_opportunity_id", ghlOpportunityId)
    .maybeSingle();

  if (!pipeRad) {
    throw new Error("Affären hittades inte i pipelinespegeln. Tryck Uppdatera nu på Fokus idag och försök igen.");
  }
  const p = pipeRad as {
    ghl_contact_id: string | null; namn: string | null; foretag: string | null; epost: string | null;
    steg_namn: string | null; steg_id: string | null; varde: number; steg_sedan: string | null; uppfoljning_datum: string | null;
    uppfoljning_titel: string | null; location_id: string;
  };

  let kontakt: GhlKontakt | null = null;
  if (p.ghl_contact_id) {
    try {
      kontakt = await hamtaKontakt(cfg, p.ghl_contact_id);
    } catch {
      fel.push("Kunde inte hämta kontaktens telefonnummer och taggar från MySales just nu.");
    }
  }

  let stegInfo: StegInfo | null = null;
  try {
    stegInfo = await hamtaStegInfo(cfg, p.steg_id);
  } catch {
    fel.push("Kunde inte hämta pipelinens steg från MySales just nu.");
  }

  const dagarISteget = p.steg_sedan ? Math.floor((Date.now() - new Date(p.steg_sedan).getTime()) / 86400000) : null;
  const nastaSteg = p.uppfoljning_datum ? { titel: p.uppfoljning_titel || "Uppgift", datum: p.uppfoljning_datum } : null;

  return {
    kontakt,
    fel,
    lage: {
      ghlOpportunityId,
      ghlContactId: p.ghl_contact_id,
      namn: p.namn,
      foretag: p.foretag,
      epost: p.epost,
      telefon: kontakt?.phone || null,
      taggar: kontakt?.tags || [],
      stegNamn: p.steg_namn,
      stegId: p.steg_id,
      stegInfo,
      varde: Number(p.varde) || 0,
      dagarISteget,
      nastaSteg,
      saknarNastaSteg: !nastaSteg,
      locationId: p.location_id,
    },
  };
}

/** Sammansätter och cachar kortet. `tvinga` styr ingenting i dag — öppning är ALLTID färsk (1D). */
export async function byggKort(ghlOpportunityId: string, beslutadAv = "owner"): Promise<DrivKort> {
  const sb = supabaseService();
  const fel: string[] = [];

  const cfg = await hamtaHqGhl();
  if (!cfg) throw new Error("Ingen koppling till MySales är inlagd för Displayteknik.");

  const { lage, kontakt, fel: lageFel } = await byggLage(sb, cfg, ghlOpportunityId);
  fel.push(...lageFel);

  const tidslinje: TidslinjePost[] = [];

  // 1. GHL-konversationer (SMS, socialt, samtalslogg, ev. GHL-mejl).
  if (lage.ghlContactId) {
    try {
      const konvos = await hamtaKonversationer(cfg, lage.ghlContactId);
      for (const k of konvos) {
        try {
          const meddelanden = await hamtaMeddelanden(cfg, k.id);
          for (const m of meddelanden) {
            if (!KANNDA_MEDDELANDETYPER.has(m.messageType)) continue; // aktivitetslogg, inte kommunikation
            const inkommande = m.direction === "inbound";
            tidslinje.push({
              kalla: "ghl_konversation",
              id: m.id,
              tidpunkt: m.dateAdded,
              riktning: inkommande ? "in" : m.direction === "outbound" ? "ut" : null,
              titel: KANAL_IKON[m.messageType],
              snippet: (m.body || "").slice(0, 200),
              kanalIkon: KANAL_IKON[m.messageType],
              // DRIV-2: kanalen är LÅST till konversationens egen typ — inget svar byter kanal.
              svar: inkommande ? { kanal: "ghl", konversationTyp: k.type, motpart: lage.namn || "kontakten" } : undefined,
            });
          }
        } catch {
          fel.push("Ett av MySales-meddelandena kunde inte läsas just nu.");
        }
      }
    } catch {
      fel.push("Kunde inte hämta konversationer från MySales just nu.");
    }

    // Uppgifter — samma /tasks-endpoint som HQ-pipelinen redan läser.
    try {
      const uppgifter = await hamtaUppgifterForKontakt(cfg, lage.ghlContactId);
      for (const u of uppgifter) {
        tidslinje.push({
          kalla: "uppgift", id: u.id, tidpunkt: u.dueDate, riktning: null,
          titel: u.title, snippet: u.completed ? "Klarmarkerad" : "Öppen uppgift", kanalIkon: "uppgift",
        });
      }
    } catch {
      fel.push("Kunde inte hämta uppgifter från MySales just nu.");
    }
  }

  // 2. Gmail — endast om ägarens koppling har gmail.readonly OCH affären har en e-post.
  const scope = await kopplingsScope();
  if (lage.epost && scope?.harGmail) {
    try {
      const koppling = await hamtaKoppling();
      const token = await agarToken();
      const [meddelanden, bilageIds] = await Promise.all([
        hamtaTradMetadata(token, lage.epost, koppling?.email || ""),
        sokMeddelandenMedBilaga(token, lage.epost),
      ]);
      for (const m of meddelanden) {
        if (m.autosvar) continue; // ett autosvar är inte ett tecken på liv, se KONTAKT-1
        const harBilaga = bilageIds.has(m.id);
        tidslinje.push({
          kalla: "gmail", id: m.id, tidpunkt: m.datum, riktning: m.riktning,
          titel: m.amne || "(inget ämne)",
          snippet: harBilaga ? `📎 Bilaga bifogad — ${m.snippet}` : m.snippet,
          kanalIkon: "mejl",
          harBilaga,
          svar: m.riktning === "in"
            ? { kanal: "gmail", tradId: m.threadId, messageIdHeader: m.messageIdHeader, motpart: m.fran, amne: m.amne }
            : undefined,
        });
      }
    } catch {
      fel.push("Kunde inte läsa Gmail just nu — försök igen om en liten stund.");
    }
  } else if (lage.epost && scope && !scope.harGmail) {
    fel.push("Google-kopplingen saknar behörighet till Gmail. Koppla om Google så följer den med.");
  }

  // 3. Kalender — svag textmatchning på namn/företag (aldrig en säker koppling, se lib/driv/matchning.ts).
  const sokord = [lage.namn, lage.foretag].filter(Boolean) as string[];
  if (sokord.length && lage.ghlContactId) {
    try {
      const nu = new Date();
      const fran = new Date(nu.getTime() - 120 * 86400000).toISOString();
      const till = new Date(nu.getTime() + 30 * 86400000).toISOString();
      const { data: handelser } = await sb
        .from("hq_kalender_cache")
        .select("google_event_id, titel, beskrivning, start_tid, start_datum")
        .gte("start_tid", fran).lt("start_tid", till);
      for (const h of (handelser as Array<{ google_event_id: string; titel: string | null; beskrivning: string | null; start_tid: string | null; start_datum: string | null }> | null) || []) {
        const traff = sokord.some((s) => kalenderKandidat(s, h.titel, h.beskrivning));
        if (!traff) continue;
        await foreslaLank({
          tenantId: cfg.locationId ? await hamtaTenantId() : "", ghlContactId: lage.ghlContactId, ghlOpportunityId,
          refTyp: "kalenderhandelse", refId: h.google_event_id, kalla: "manuell",
          belagg: `Namnet/företaget förekommer i mötet "${h.titel}"`,
        });
        tidslinje.push({
          kalla: "kalender", id: h.google_event_id, tidpunkt: h.start_tid || h.start_datum || nu.toISOString(),
          riktning: null, titel: h.titel || "Möte", snippet: "Föreslagen koppling — bekräfta eller avvisa nedan",
          kanalIkon: "möte", osaker: true,
        });
      }
    } catch {
      fel.push("Kunde inte matcha mot kalendern just nu.");
    }
  }

  // 4. Offerter (DRIV-3: flaggar gamla obesvarade + föreslår dag 3-uppföljning).
  let offertForslag: DrivKort["offertForslag"] = null;
  if (lage.ghlContactId || lage.ghlOpportunityId) {
    try {
      const { data: offerter } = await sb
        .from("offert_quotes")
        .select("id, quote_number, status, sent_at, total, created_at")
        .or(`ghl_contact_id.eq.${lage.ghlContactId || "-"},ghl_opportunity_id.eq.${ghlOpportunityId}`);
      for (const o of (offerter as Array<{ id: string; quote_number: string | null; status: string; sent_at: string | null; total: number | null; created_at: string }> | null) || []) {
        const dagarSedanSkickad = o.sent_at ? Math.floor((Date.now() - new Date(o.sent_at).getTime()) / 86400000) : null;
        // "Utan svar" mäts grovt mot GHL-pipelinens steg: så länge affären inte är
        // vunnen/förlorad (lage kommer från ett öppet steg om kortet visas alls) och
        // offerten fortfarande står som 'sent' räknas den som obesvarad.
        const obesvarad = o.status === "sent" && dagarSedanSkickad !== null && dagarSedanSkickad >= 3;
        tidslinje.push({
          kalla: "offert", id: o.id, tidpunkt: o.sent_at || o.created_at, riktning: "ut",
          titel: `Offert ${o.quote_number || o.id.slice(0, 8)}`,
          snippet: `Status: ${o.status}${o.total ? ` · ${Math.round(o.total).toLocaleString("sv-SE")} kr` : ""}`,
          kanalIkon: "offert",
          varning: obesvarad ? `Skickad för ${dagarSedanSkickad} dagar sedan, inget svar än` : undefined,
        });
        // Förslaget gäller bara den SENAST skickade offerten, och bara om ingen redan
        // föreslagit/satt en uppföljning för just den (grovt: bara första träffen vinner).
        if (o.status === "sent" && o.sent_at && !offertForslag) {
          const dag3 = new Date(new Date(o.sent_at).getTime() + 3 * 86400000);
          if (dag3.getTime() > Date.now() - 86400000) { // inte meningsfullt att föreslå ett datum långt bakåt
            offertForslag = { offertId: o.id, titel: `Följ upp offerten ${o.quote_number || ""}`.trim(), datum: dag3.toISOString() };
          }
        }
      }
    } catch {
      fel.push("Kunde inte hämta offerter just nu.");
    }
  }

  // 5. Prislistan (DRIV-3) — säljlagrets publika vy, aldrig kalkylunderlag.
  let prislista: Prisrad[] = [];
  try {
    prislista = await hamtaPrislista();
  } catch {
    fel.push("Kunde inte hämta prislistan just nu.");
  }

  tidslinje.sort((a, b) => new Date(b.tidpunkt).getTime() - new Date(a.tidpunkt).getTime());

  const senasteKontakt = harledSenasteKontakt(tidslinje);
  const foreslagnaLankar = lage.ghlContactId ? (await lasLankar(lage.ghlContactId)).filter((l) => l.status === "foreslagen") : [];

  const kort: DrivKort = { lage, senasteKontakt, tidslinje, foreslagnaLankar, prislista, offertForslag, fel, hamtadTidsstampel: new Date().toISOString() };

  // Cache åt framtida listvyer — kortet självt visar alltid det just hämtade.
  try {
    const tenantId = await hamtaTenantId();
    if (tenantId) {
      await sb.from("driv_kort_cache").upsert(
        { ghl_opportunity_id: ghlOpportunityId, tenant_id: tenantId, payload: kort, hamtad_tidsstampel: kort.hamtadTidsstampel },
        { onConflict: "ghl_opportunity_id" },
      );
    }
  } catch {
    /* cachen är en bekvämlighet för framtida listvyer, inte en förutsättning för kortet */
  }

  return kort;
}

const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
async function hamtaTenantId(): Promise<string> {
  return DT_CLIENT_ID; // enda tenant i piloten (spec: bara DT seedas)
}

/**
 * Vem som har bollen, räknat över BÅDA kanalerna (GHL-konversationer + Gmail), inte bara
 * Gmail som KONTAKT-1 gör i dag. Senaste posten med en riktning avgör.
 */
function harledSenasteKontakt(tidslinje: TidslinjePost[]): SenasteKontakt {
  const medRiktning = tidslinje.find((t) => t.riktning !== null);
  if (!medRiktning) return { text: "Ingen mät kontakthistorik hittad.", bollenHos: "okant" };
  const dagar = Math.floor((Date.now() - new Date(medRiktning.tidpunkt).getTime()) / 86400000);
  const dagText = dagar === 0 ? "idag" : dagar === 1 ? "igår" : `${dagar} dagar sedan`;
  if (medRiktning.riktning === "in") {
    return { text: `Senaste kontakt: kunden hörde av sig ${dagText} — väntar på svar.`, bollenHos: "oss" };
  }
  return { text: `Senaste kontakt: du hörde av dig ${dagText}.`, bollenHos: "kund" };
}
