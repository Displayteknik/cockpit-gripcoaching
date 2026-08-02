// PLAN-1 — ägarens Google Kalender. Läser händelser och skriver tillbaka fyra saker:
// flytta, ändra längd, skapa och ta bort. Ingenting annat.
//
// ★ SPÅRVALET: EGEN ägarkoppling, inte den klientdelade google_connections.
// `lib/google.ts` har en gemensam SCOPES-lista som gäller VARJE klient som kopplar
// Search Console. Läggs kalender där skulle varje klient få frågan om kalenderåtkomst
// vid anslutning. Ägarens kalender är ägarens ensak, alltså egen rad i
// `hq_google_koppling`, eget scope och egen livscykel.
//
// Återanvänder `exchangeCode`/`refreshAccessToken` ur lib/google.ts — de är
// scope-oberoende. Återanvänder också callback-adressen `/api/google/callback` via ett
// eget `state`-värde, så ingen NY redirect-URI behöver registreras hos Google.
//
// Kontrakt: Google Calendar API v3.
//   GET    /calendars/{kal}/events?timeMin=&timeMax=&singleEvents=true&orderBy=startTime
//   PATCH  /calendars/{kal}/events/{id}?sendUpdates=none
//   POST   /calendars/{kal}/events?sendUpdates=none
//   DELETE /calendars/{kal}/events/{id}?sendUpdates=none
//
// ⚠ `singleEvents=true` veckla ut serier till instanser. Instansens id
// (`bhs88i50…_20260803T060000Z`) pekar på EN gång. PATCH på det id:t flyttar bara den
// dagen och lämnar serien orörd — precis Håkans val 2026-08-02. Hela serien nås via
// `recurringEventId`, och den rör vi aldrig i v1.
//
// ⚠ `sendUpdates=none` på varje skrivning. Specen är tydlig: inga inbjudningar skickas.

import { supabaseService } from "@/lib/supabase-admin";
import { exchangeCode, refreshAccessToken } from "@/lib/google";

const API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";

// Smalast möjliga: bara händelser, inte kalenderadministration.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

/** `state`-värdet som skiljer ägarens kalenderflöde från klienternas (som skickar sitt klient-id). */
export const KALENDER_STATE = "hq-kalender";

export const SYNK_INTERVALL_MS = 5 * 60 * 1000;
export const TZ = "Europe/Stockholm";

export interface Handelse {
  google_event_id: string;
  kalender_id: string;
  titel: string | null;
  beskrivning: string | null;
  plats: string | null;
  start_tid: string | null;
  slut_tid: string | null;
  start_datum: string | null;
  slut_datum: string | null;
  heldag: boolean;
  status: string | null;
  event_type: string | null;
  serie_id: string | null;
  html_lank: string | null;
  uppdaterad_google: string | null;
  senast_synkad: string;
}

/**
 * Händelser vi aldrig försöker ändra. FROM_GMAIL skapas av Google ur ett mejl och kan
 * varken skapas eller flyttas via API:t. Att låta UI:t erbjuda det vore att lova något
 * som alltid misslyckas.
 */
export function arLast(h: Pick<Handelse, "event_type" | "heldag">): boolean {
  return h.event_type === "FROM_GMAIL" || h.heldag;
}

export function kalenderAuthUrl(origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/callback`,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: KALENDER_STATE,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function sparaKoppling(code: string, origin: string): Promise<{ ok: boolean; email?: string; fel?: string }> {
  try {
    const tokens = await exchangeCode(code, origin);
    if (!tokens.refresh_token) {
      return { ok: false, fel: "Google skickade ingen långlivad nyckel. Ta bort åtkomsten i ditt Google-konto och koppla om." };
    }
    let email = "";
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (r.ok) email = ((await r.json()) as { email?: string }).email || "";
    } catch { /* e-posten är trevlig att visa, inte nödvändig */ }

    await supabaseService().from("hq_google_koppling").upsert({
      id: 1,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope,
      ansluten: new Date().toISOString(),
      uppdaterad: new Date().toISOString(),
    }, { onConflict: "id" });
    return { ok: true, email };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

export interface Koppling { email: string | null; kalenderId: string; ansluten: string | null }

export async function hamtaKoppling(): Promise<Koppling | null> {
  const { data } = await supabaseService()
    .from("hq_google_koppling")
    .select("email, kalender_id, ansluten, refresh_token")
    .eq("id", 1)
    .maybeSingle();
  const rad = data as { email: string | null; kalender_id: string; ansluten: string | null; refresh_token: string | null } | null;
  if (!rad?.refresh_token) return null;
  return { email: rad.email, kalenderId: rad.kalender_id || "primary", ansluten: rad.ansluten };
}

/** Giltig access-token, förnyad vid behov. Kastar när kopplingen saknas eller nekas. */
async function accessToken(): Promise<{ token: string; kalenderId: string }> {
  const sb = supabaseService();
  const { data } = await sb.from("hq_google_koppling").select("*").eq("id", 1).maybeSingle();
  const rad = data as { access_token: string | null; refresh_token: string | null; expires_at: string | null; kalender_id: string } | null;
  if (!rad?.refresh_token) throw new Error("Google Kalender är inte kopplad än.");
  const kalenderId = rad.kalender_id || "primary";
  const gilltigTill = rad.expires_at ? new Date(rad.expires_at).getTime() : 0;
  if (rad.access_token && gilltigTill > Date.now() + 60_000) return { token: rad.access_token, kalenderId };

  const fresh = await refreshAccessToken(rad.refresh_token);
  await sb.from("hq_google_koppling").update({
    access_token: fresh.access_token,
    expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
    uppdaterad: new Date().toISOString(),
  }).eq("id", 1);
  return { token: fresh.access_token, kalenderId };
}

interface RaHandelse {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  eventType?: string;
  recurringEventId?: string;
  htmlLink?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

function tillRad(h: RaHandelse, kalenderId: string, nu: string): Handelse {
  const heldag = !!h.start?.date && !h.start?.dateTime;
  return {
    google_event_id: h.id,
    kalender_id: kalenderId,
    titel: h.summary || null,
    beskrivning: h.description || null,
    plats: h.location || null,
    start_tid: heldag ? null : h.start?.dateTime || null,
    slut_tid: heldag ? null : h.end?.dateTime || null,
    start_datum: heldag ? h.start?.date?.slice(0, 10) || null : null,
    slut_datum: heldag ? h.end?.date?.slice(0, 10) || null : null,
    heldag,
    status: h.status || null,
    event_type: h.eventType || null,
    serie_id: h.recurringEventId || null,
    html_lank: h.htmlLink || null,
    uppdaterad_google: h.updated || null,
    senast_synkad: nu,
  };
}

/** Rå läsning ur Google för ett tidsspann. Sidbryter tills allt är hämtat. */
async function lasFranGoogle(fran: Date, till: Date): Promise<Handelse[]> {
  const { token, kalenderId } = await accessToken();
  const nu = new Date().toISOString();
  const ut: Handelse[] = [];
  let sidToken = "";
  for (let varv = 0; varv < 20; varv++) {
    const p = new URLSearchParams({
      timeMin: fran.toISOString(),
      timeMax: till.toISOString(),
      singleEvents: "true",       // vecklar ut serier till instanser
      orderBy: "startTime",
      maxResults: "250",
      timeZone: TZ,
    });
    if (sidToken) p.set("pageToken", sidToken);
    const r = await fetch(`${API}/calendars/${encodeURIComponent(kalenderId)}/events?${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`Kalendern svarade ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const d = (await r.json()) as { items?: RaHandelse[]; nextPageToken?: string };
    for (const h of d.items || []) {
      if (h.status === "cancelled") continue; // avbokad instans i en serie
      ut.push(tillRad(h, kalenderId, nu));
    }
    if (!d.nextPageToken) break;
    sidToken = d.nextPageToken;
  }
  return ut;
}

export interface SynkResultat { ok: boolean; antal?: number; hoppadeOver?: boolean; fel?: string }

/** Tidsstämpeln på spegeln. null = aldrig synkad. */
export async function senastSynkad(): Promise<string | null> {
  const { data } = await supabaseService()
    .from("hq_kalender_cache")
    .select("senast_synkad")
    .order("senast_synkad", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { senast_synkad: string } | null)?.senast_synkad || null;
}

/**
 * Synkar spegeln för ett spann. Högst var femte minut om inte `tvinga` är satt
 * (Uppdatera nu, och direkt efter varje egen skrivning). Misslyckas anropet lämnas
 * spegeln orörd och felet returneras — vyn visar då gammal data med tidsstämpel.
 */
export async function synkaKalender(fran: Date, till: Date, tvinga = false): Promise<SynkResultat> {
  try {
    if (!(await hamtaKoppling())) return { ok: false, fel: "Google Kalender är inte kopplad än." };
    if (!tvinga) {
      const senast = await senastSynkad();
      if (senast && Date.now() - new Date(senast).getTime() < SYNK_INTERVALL_MS) return { ok: true, hoppadeOver: true };
    }

    const rader = await lasFranGoogle(fran, till);
    const sb = supabaseService();
    if (rader.length) {
      const { error } = await sb.from("hq_kalender_cache").upsert(rader, { onConflict: "google_event_id" });
      if (error) return { ok: false, fel: `Kunde inte spara kalendern: ${error.message}` };
    }

    // Städa spannet: en händelse som tagits bort i Google ska inte ligga kvar och räknas.
    // Bara INOM spannet, annars raderas veckor vi inte hämtat.
    const kvar = rader.map((r) => r.google_event_id);
    for (const kolumn of ["start_tid", "start_datum"] as const) {
      let bort = sb.from("hq_kalender_cache").delete()
        .gte(kolumn, kolumn === "start_tid" ? fran.toISOString() : fran.toISOString().slice(0, 10))
        .lt(kolumn, kolumn === "start_tid" ? till.toISOString() : till.toISOString().slice(0, 10));
      if (kvar.length) bort = bort.not("google_event_id", "in", `(${kvar.map((id) => `"${id}"`).join(",")})`);
      await bort;
    }
    return { ok: true, antal: rader.length };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

/** Läser spegeln för ett spann. Rör aldrig Google. */
export async function lasCache(fran: Date, till: Date): Promise<Handelse[]> {
  const sb = supabaseService();
  const franIso = fran.toISOString();
  const tillIso = till.toISOString();
  const [{ data: tidsatta }, { data: heldagar }] = await Promise.all([
    sb.from("hq_kalender_cache").select("*").gte("start_tid", franIso).lt("start_tid", tillIso),
    sb.from("hq_kalender_cache").select("*").eq("heldag", true)
      .gte("start_datum", franIso.slice(0, 10)).lt("start_datum", tillIso.slice(0, 10)),
  ]);
  return [...((tidsatta as Handelse[] | null) || []), ...((heldagar as Handelse[] | null) || [])];
}

// ── Skrivningar. Fyra tillåtna, inga andra. Varje anrop kommer från ett klick. ──

async function skrivning(vag: string, metod: string, kropp?: unknown): Promise<{ ok: boolean; id?: string; fel?: string }> {
  try {
    const { token, kalenderId } = await accessToken();
    const url = `${API}/calendars/${encodeURIComponent(kalenderId)}/events${vag}${vag.includes("?") ? "&" : "?"}sendUpdates=none`;
    const r = await fetch(url, {
      method: metod,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(kropp ? { body: JSON.stringify(kropp) } : {}),
    });
    if (!r.ok) return { ok: false, fel: `Kalendern svarade ${r.status}: ${(await r.text()).slice(0, 200)}` };
    if (metod === "DELETE") return { ok: true };
    const d = (await r.json()) as { id?: string };
    return { ok: true, id: d.id };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

/**
 * Flytta eller ändra längd. Samma anrop: båda ändrar bara start och slut.
 * ⚠ `id` ska vara INSTANSENS id (det vi fick med singleEvents), aldrig seriens.
 * Då ändras bara den enskilda gången.
 */
export function flyttaHandelse(id: string, start: Date, slut: Date) {
  return skrivning(`/${encodeURIComponent(id)}`, "PATCH", {
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: slut.toISOString(), timeZone: TZ },
  });
}

export function skapaHandelse(titel: string, start: Date, slut: Date, beskrivning?: string) {
  return skrivning("", "POST", {
    summary: titel,
    ...(beskrivning ? { description: beskrivning } : {}),
    start: { dateTime: start.toISOString(), timeZone: TZ },
    end: { dateTime: slut.toISOString(), timeZone: TZ },
  });
}

export function taBortHandelse(id: string) {
  return skrivning(`/${encodeURIComponent(id)}`, "DELETE");
}

/** Tar bort raden ur spegeln direkt efter en lyckad borttagning i Google. */
export async function glomHandelse(id: string): Promise<void> {
  await supabaseService().from("hq_kalender_cache").delete().eq("google_event_id", id);
}
