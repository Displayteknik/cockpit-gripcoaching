// KONTAKT-1 — tystnadsmätare och kontaktriktning per affär.
//
// Frågan modulen svarar på är inte "när hörde vi av oss sist" utan **vem som har bollen**.
// En kund som väntar på svar från oss går alltid före en uppföljning som råkar vara gammal.
//
// Modulen MÄTER och LYFTER. Den agerar aldrig mot kunden: inga utskick, inga påminnelser,
// ingen AI, ingen läsning av brödtext.
//
// ⚠ Endast metadata hämtas. Varje meddelande läses med `format=metadata` och en uttrycklig
// rubriklista, så brödtexten aldrig lämnar Google. Scope-valet är förklarat i lib/hq/kalender.ts.

import { supabaseService } from "@/lib/supabase-admin";
import { agarToken, kopplingsScope } from "@/lib/hq/kalender";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export const SYNK_INTERVALL_MS = 30 * 60 * 1000;

export type Bollen = "kund" | "oss" | "okant";

export interface KontaktStatus {
  opportunity_id: string;
  epost: string | null;
  senaste_in_datum: string | null;
  senaste_in_amne: string | null;
  senaste_ut_datum: string | null;
  senaste_ut_amne: string | null;
  senaste_kortandring: string | null;
  logg_notering: string | null;
  kommentar: string | null;
  dagar_sedan_kontakt: number | null;
  bollen_hos: Bollen;
  senast_synkad: string;
}

// ── Ren logik ──────────────────────────────────────────────────────────────

/**
 * Vem som har bollen.
 * - Senaste INKOMMANDE nyare än senaste utgående → "oss". Kunden väntar på svar.
 * - Senaste UTGÅENDE nyare → "kund". Vi väntar på svar.
 * - Ingen historik alls → "okant".
 *
 * ⚠ Kortändringar i MySales påverkar ALDRIG det här. En flyttad affär säger något om
 * vår aktivitet, ingenting om vem som är skyldig den andra ett svar.
 */
export function harledBollen(inDatum: string | null, utDatum: string | null): Bollen {
  if (!inDatum && !utDatum) return "okant";
  if (inDatum && !utDatum) return "oss";
  if (utDatum && !inDatum) return "kund";
  return new Date(inDatum!).getTime() > new Date(utDatum!).getTime() ? "oss" : "kund";
}

/**
 * Dagar sedan senaste tecken på liv. Här räknas kortändringen MED: ett samtal som
 * loggats i MySales är lika mycket kontakt som ett mejl, och utan den skulle varje
 * telefonaffär se ut att ha tystnat.
 * null = ingen mätpunkt alls, vilket är något annat än noll dagar.
 */
export function dagarSedanKontakt(
  inDatum: string | null,
  utDatum: string | null,
  kortandring: string | null,
  nu: number,
): number | null {
  const tider = [inDatum, utDatum, kortandring].filter((v): v is string => !!v).map((v) => new Date(v).getTime());
  if (!tider.length) return null;
  return Math.max(0, Math.floor((nu - Math.max(...tider)) / 86400000));
}

/** Färgtröskeln i vyn. Under 7 neutral, 7 till 20 gul, över 20 röd. */
export function tystnadsniva(dagar: number | null): "neutral" | "gul" | "rod" {
  if (dagar === null) return "neutral";
  if (dagar > 20) return "rod";
  if (dagar >= 7) return "gul";
  return "neutral";
}

export interface Regel {
  id: string; regelnamn: string; villkor: string; troskel_dagar: number;
  steg_namn: string | null; aktiv: boolean; sortering: number;
}

export interface Rad {
  opportunity_id: string;
  namn: string | null;
  varde: number;
  steg_namn: string | null;
  epost: string | null;
  dagar: number | null;
  bollen: Bollen;
  senasteAmne: string | null;
  kommentar: string | null;
  matbar: boolean;
  ghl_contact_id: string | null;
  location_id: string;
}

export interface MorgonRad { id: string; text: string; niva: "gul" | "rod"; etikett: string; lank: string }

/**
 * Reglerna som föder morgonlistan. Formuleringarna konstaterar, de tillrättavisar aldrig.
 * En rad som skäller läses en gång och stängs sedan av i huvudet.
 */
export function regelrader(rader: Rad[], regler: Regel[]): MorgonRad[] {
  const ut: MorgonRad[] = [];
  const lank = (r: Rad) =>
    r.ghl_contact_id ? `https://app.mysales.se/v2/location/${r.location_id}/contacts/detail/${r.ghl_contact_id}` : "/dashboard/hq/kontakt";

  for (const regel of [...regler].filter((r) => r.aktiv).sort((a, b) => a.sortering - b.sortering)) {
    if (regel.villkor === "bollen_hos_oss") {
      // Den viktigaste raden i hela modulen. En kund som väntar på svar går först.
      const traffar = rader.filter((r) => r.bollen === "oss" && (r.dagar ?? 0) >= regel.troskel_dagar);
      for (const r of traffar) {
        ut.push({
          id: `kontakt-oss-${r.opportunity_id}`,
          text: `${r.namn || "Affär"} väntar på svar från dig sedan ${dagText(r.dagar)}.`,
          niva: "rod",
          etikett: "Bollen hos dig",
          lank: lank(r),
        });
      }
    }
    if (regel.villkor === "steg_utan_kontakt") {
      const traffar = rader.filter(
        (r) => r.steg_namn === regel.steg_namn && r.matbar && (r.dagar ?? 0) >= regel.troskel_dagar && r.bollen !== "oss",
      );
      for (const r of traffar) {
        ut.push({
          id: `kontakt-steg-${r.opportunity_id}`,
          text: `${r.namn || "Affär"} står i ${regel.steg_namn} och har varit tyst i ${dagText(r.dagar)}.`,
          niva: "gul",
          etikett: "Offert",
          lank: lank(r),
        });
      }
    }
    if (regel.villkor === "oppen_utan_kontakt") {
      const traffar = rader.filter(
        (r) => r.matbar && (r.dagar ?? 0) >= regel.troskel_dagar && r.bollen !== "oss",
      );
      for (const r of traffar) {
        // En affär kan träffas av både offertregeln och den här. Den strängare vinner,
        // annars står samma affär två gånger i morgonlistan.
        const redan = ut.findIndex((x) => x.id === `kontakt-steg-${r.opportunity_id}`);
        if (redan >= 0) ut.splice(redan, 1);
        ut.push({
          id: `kontakt-tyst-${r.opportunity_id}`,
          text: `${r.namn || "Affär"} har varit tyst i ${dagText(r.dagar)} och riskerar att rinna ut.`,
          niva: "rod",
          etikett: "Tystnad",
          lank: lank(r),
        });
      }
    }
  }
  return ut;
}

const dagText = (d: number | null) => (d === null ? "okänd tid" : `${d} ${d === 1 ? "dag" : "dagar"}`);

/**
 * Sorteringen. Bollen hos oss ALLTID överst, oavsett antal dagar. Därefter fallande på
 * dagar sedan kontakt. Omätbara kort sist: de säger ingenting om tystnad.
 */
export function sortera(rader: Rad[]): Rad[] {
  return [...rader].sort((a, b) => {
    if ((a.bollen === "oss") !== (b.bollen === "oss")) return a.bollen === "oss" ? -1 : 1;
    if (a.matbar !== b.matbar) return a.matbar ? -1 : 1;
    return (b.dagar ?? -1) - (a.dagar ?? -1);
  });
}

// ── Gmail ──────────────────────────────────────────────────────────────────

/** "Namn <adress@x.se>" eller bara adressen. Returnerar adressen i gemener. */
export function adressUr(header: string): string {
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim().toLowerCase();
}

interface Meta { datum: string; amne: string; fran: string }

async function metaFor(token: string, id: string): Promise<Meta | null> {
  // format=metadata + uttrycklig rubriklista. Brödtexten begärs aldrig.
  const r = await fetch(
    `${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) return null;
  const d = (await r.json()) as { internalDate?: string; payload?: { headers?: Array<{ name: string; value: string }> } };
  const h = (namn: string) => d.payload?.headers?.find((x) => x.name.toLowerCase() === namn)?.value || "";
  const ms = Number(d.internalDate || 0);
  if (!ms) return null;
  return { datum: new Date(ms).toISOString(), amne: h("subject").slice(0, 300), fran: adressUr(h("from")) };
}

/** Nyaste meddelandet som matchar frågan. Gmail listar nyast först. */
async function nyaste(token: string, fraga: string): Promise<Meta | null> {
  const r = await fetch(`${GMAIL}/messages?maxResults=1&q=${encodeURIComponent(fraga)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Gmail svarade ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const d = (await r.json()) as { messages?: Array<{ id: string }> };
  const id = d.messages?.[0]?.id;
  return id ? metaFor(token, id) : null;
}

export interface SynkResultat { ok: boolean; antal?: number; hoppadeOver?: boolean; fel?: string }

export async function senastSynkad(): Promise<string | null> {
  const { data } = await supabaseService()
    .from("hq_kontakt_status").select("senast_synkad")
    .order("senast_synkad", { ascending: false }).limit(1).maybeSingle();
  return (data as { senast_synkad: string } | null)?.senast_synkad || null;
}

/**
 * Läser Gmail för varje öppen affär med adress och speglar metadata i hq_kontakt_status.
 * Högst var trettionde minut om inte `tvinga` är satt.
 *
 * ⚠ Riktningen avgörs av AVSÄNDAREN, aldrig av "sista meddelandet i tråden". I en
 * Re-tråd är sista meddelandet vårt eget svar, och den fällan har redan kostat en gång
 * i mejl-till-lead-flödet. Inkommande = avsändaren är kontaktens adress.
 */
export async function synkaKontakter(tvinga = false): Promise<SynkResultat> {
  try {
    const scope = await kopplingsScope();
    if (!scope) return { ok: false, fel: "Google är inte kopplat än." };
    if (!scope.harGmail) {
      return { ok: false, fel: "Kopplingen saknar behörighet till Gmail. Koppla om Google så följer den med." };
    }
    if (!tvinga) {
      const senast = await senastSynkad();
      if (senast && Date.now() - new Date(senast).getTime() < SYNK_INTERVALL_MS) return { ok: true, hoppadeOver: true };
    }

    const sb = supabaseService();
    const { data } = await sb
      .from("hq_pipeline_cache")
      .select("ghl_opportunity_id, epost, senast_uppdaterad, harledd_status")
      .eq("harledd_status", "open");
    const affarer = ((data as Array<{ ghl_opportunity_id: string; epost: string | null; senast_uppdaterad: string | null }> | null) || [])
      .filter((a) => a.epost);
    if (!affarer.length) return { ok: true, antal: 0 };

    // Behåll ett tidigare loggat samtal: det är ägarens egen uppgift och får aldrig
    // skrivas bort av en synk.
    const { data: gamla } = await sb.from("hq_kontakt_status").select("opportunity_id, senaste_kortandring, logg_notering, kommentar");
    const tidigare = new Map(
      ((gamla as Array<{ opportunity_id: string; senaste_kortandring: string | null; logg_notering: string | null; kommentar: string | null }> | null) || [])
        .map((r) => [r.opportunity_id, r]),
    );

    const token = await agarToken();
    const nu = Date.now();
    const rader: KontaktStatus[] = [];
    let felmeddelande = "";

    for (let i = 0; i < affarer.length; i += 6) {
      const grupp = affarer.slice(i, i + 6);
      await Promise.all(grupp.map(async (a) => {
        const adress = a.epost!.toLowerCase();
        let inn: Meta | null = null;
        let ut: Meta | null = null;
        try {
          [inn, ut] = await Promise.all([
            nyaste(token, `from:${adress}`),
            nyaste(token, `to:${adress} in:sent`),
          ]);
        } catch (e) {
          felmeddelande = (e as Error).message;
          return;
        }
        // Skyddsnät: ett svar där avsändaren INTE är kontakten är inte inkommande.
        if (inn && inn.fran !== adress) inn = null;

        const gammal = tidigare.get(a.ghl_opportunity_id);
        // Kortändringen är den senaste av MySales-uppdateringen och ett loggat samtal.
        const kortandring = [a.senast_uppdaterad, gammal?.senaste_kortandring]
          .filter((v): v is string => !!v)
          .sort()
          .pop() || null;

        rader.push({
          opportunity_id: a.ghl_opportunity_id,
          epost: adress,
          senaste_in_datum: inn?.datum || null,
          senaste_in_amne: inn?.amne || null,
          senaste_ut_datum: ut?.datum || null,
          senaste_ut_amne: ut?.amne || null,
          senaste_kortandring: kortandring,
          logg_notering: gammal?.logg_notering || null,
          // Kommentaren ar agarens egen text och far ALDRIG skrivas bort av en synk.
          kommentar: gammal?.kommentar || null,
          dagar_sedan_kontakt: dagarSedanKontakt(inn?.datum || null, ut?.datum || null, kortandring, nu),
          bollen_hos: harledBollen(inn?.datum || null, ut?.datum || null),
          senast_synkad: new Date().toISOString(),
        });
      }));
    }

    if (!rader.length) return { ok: false, fel: felmeddelande || "Ingen affär kunde läsas." };
    const { error } = await sb.from("hq_kontakt_status").upsert(rader, { onConflict: "opportunity_id" });
    if (error) return { ok: false, fel: `Kunde inte spara: ${error.message}` };
    return { ok: !felmeddelande, antal: rader.length, fel: felmeddelande || undefined };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

/**
 * Bygger tystnadslistan ur spegeln. Endast ÖPPNA affärer: vunnet och förlorat kan inte
 * tystna. Kort utan adress är omätbara, aldrig tysta.
 */
export async function byggLista(): Promise<{ rader: Rad[]; regler: Regel[] }> {
  const sb = supabaseService();
  const [{ data: cache }, { data: status }, { data: reglerData }] = await Promise.all([
    sb.from("hq_pipeline_cache")
      .select("ghl_opportunity_id, namn, varde, steg_namn, epost, ghl_contact_id, location_id, senast_uppdaterad, pipeline_id, harledd_status")
      .eq("harledd_status", "open"),
    sb.from("hq_kontakt_status").select("*"),
    sb.from("hq_kontakt_regler").select("*").order("sortering"),
  ]);

  const alla = (cache as Array<{
    ghl_opportunity_id: string; namn: string | null; varde: number | string; steg_namn: string | null;
    epost: string | null; ghl_contact_id: string | null; location_id: string; senast_uppdaterad: string | null;
    pipeline_id: string | null;
  }> | null) || [];
  if (!alla.length) return { rader: [], regler: (reglerData as Regel[] | null) || [] };

  // Samma pipelineurval som resten av HQ.
  const { hamtaValdaPipelines } = await import("@/lib/hq/pipeline");
  const valda = await hamtaValdaPipelines(alla[0].location_id);
  const iUrval = valda.size ? alla.filter((r) => r.pipeline_id && valda.has(r.pipeline_id)) : alla;

  const statusPer = new Map(((status as KontaktStatus[] | null) || []).map((s) => [s.opportunity_id, s]));
  const nu = Date.now();

  const rader: Rad[] = iUrval.map((a) => {
    const s = statusPer.get(a.ghl_opportunity_id) || null;
    const matbar = !!a.epost;
    // Utan adress finns ingen mätning. Då visas kortet som omätbart, aldrig som tyst,
    // och det får aldrig färga en dag rött på en gissning.
    const dagar = matbar && s
      ? dagarSedanKontakt(s.senaste_in_datum, s.senaste_ut_datum, s.senaste_kortandring || a.senast_uppdaterad, nu)
      : null;
    return {
      opportunity_id: a.ghl_opportunity_id,
      namn: a.namn,
      varde: Number(a.varde) || 0,
      steg_namn: a.steg_namn,
      epost: a.epost,
      dagar,
      bollen: matbar && s ? s.bollen_hos : "okant",
      senasteAmne: s ? (nyareAv(s) || null) : null,
      kommentar: s?.kommentar || null,
      matbar,
      ghl_contact_id: a.ghl_contact_id,
      location_id: a.location_id,
    };
  });

  return { rader: sortera(rader), regler: (reglerData as Regel[] | null) || [] };
}

/** Ämnesraden på det senaste meddelandet, oavsett riktning. */
function nyareAv(s: KontaktStatus): string | null {
  if (s.senaste_in_datum && s.senaste_ut_datum) {
    return new Date(s.senaste_in_datum) > new Date(s.senaste_ut_datum) ? s.senaste_in_amne : s.senaste_ut_amne;
  }
  return s.senaste_in_amne || s.senaste_ut_amne || null;
}

/**
 * Loggar ett samtal. Sätter kortändringen till nu, så ett telefonsamtal inte räknas som
 * tystnad. Skriver ENDAST lokalt: HQ:s princip är att MySales äger pipelinen och att
 * HQ aldrig skriver dit. Kräver alltid ägarens klick.
 */
export async function loggaSamtal(opportunityId: string, notering: string): Promise<boolean> {
  const sb = supabaseService();
  const { data } = await sb.from("hq_kontakt_status").select("opportunity_id").eq("opportunity_id", opportunityId).maybeSingle();
  const nu = new Date().toISOString();
  const text = notering.trim().slice(0, 300) || null;
  if (data) {
    const { error } = await sb.from("hq_kontakt_status")
      .update({ senaste_kortandring: nu, logg_notering: text, dagar_sedan_kontakt: 0, senast_synkad: nu })
      .eq("opportunity_id", opportunityId);
    return !error;
  }
  const { error } = await sb.from("hq_kontakt_status").insert({
    opportunity_id: opportunityId, senaste_kortandring: nu, logg_notering: text,
    dagar_sedan_kontakt: 0, bollen_hos: "okant", senast_synkad: nu,
  });
  return !error;
}

/**
 * Sparar ägarens kommentar på en affär. Till skillnad från ett loggat samtal rör den
 * ALDRIG tystnaden: en anteckning om vad som är på gång är inte samma sak som kontakt.
 * Texten kan skrivas, klistras in eller dikteras i vyn.
 */
export async function sparaKommentar(opportunityId: string, kommentar: string): Promise<boolean> {
  const sb = supabaseService();
  const text = kommentar.trim().slice(0, 2000) || null;
  const nu = new Date().toISOString();
  const { data } = await sb.from("hq_kontakt_status").select("opportunity_id").eq("opportunity_id", opportunityId).maybeSingle();
  if (data) {
    const { error } = await sb.from("hq_kontakt_status")
      .update({ kommentar: text, kommentar_uppdaterad: nu }).eq("opportunity_id", opportunityId);
    return !error;
  }
  const { error } = await sb.from("hq_kontakt_status").insert({
    opportunity_id: opportunityId, kommentar: text, kommentar_uppdaterad: nu,
    bollen_hos: "okant", senast_synkad: nu,
  });
  return !error;
}
