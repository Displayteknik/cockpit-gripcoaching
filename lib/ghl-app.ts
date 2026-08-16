// MARKETPLACE-1 — den privata GHL-Marketplace-appen: OAuth, tokenlagring, tokenväxling.
//
// ⚠ LÄS DETTA INNAN DU "ENHETLIGGÖR" MOT lib/ghl-agency.ts.
//
// Den här filen och `lib/ghl-agency.ts` talar med SAMMA värd men med olika API-versioner:
//
//   lib/ghl-agency.ts   Version: v3            (POST /locations/, GET /snapshots/)
//   den här filen       Version: 2021-07-28    (allt under /oauth/)
//
// Det är inte slarv. OAuth-endpointsen svarar 4xx på `v3`, och v3-endpointsen svarar 4xx
// på `2021-07-28`. Slå inte ihop dem till en gemensam anropare med en gemensam version.
//
// ── VARFÖR DEN HÄR FILEN FINNS ──────────────────────────────────────────────────────
//
// Private Integrations har ett plattformstak: `oauth.write` finns inte bland deras 24
// scopes, så ett byråtoken kan skapa ett underkonto men aldrig skriva i det. Därför
// krävdes en handskapad nyckel per kund, och `GHL_KUND_TOKEN` räckte bara till EN kund.
// En privat Marketplace-app har en annan scope-lista där `oauth.write` finns, och det är
// det som gör `POST /oauth/locationToken` möjlig. Se [[lesson_ghl_pit_scope_tak]].
//
// ── TVÅ TOKENNIVÅER, OCH DE FÖRNYAS OLIKA ───────────────────────────────────────────
//
//   Byråtoken (userType Company)   — kommer ur installationen, förnyas med refresh_token
//   Location-token (userType Location) — mintas ur byråtokenet, förnyas genom att mintas om
//
// Location-tokens har egna refresh_tokens i svaret, men vi använder dem inte: att minta om
// från byråtokenet är ett anrop och kan inte hamna i otakt. En refresh_token som förbrukas
// utan att den nya sparas bryter kedjan permanent, och den risken tas en gång (byrån), inte
// en gång per kund.
//
// ★ HEMLIGHETER LOGGAS ALDRIG. Felmeddelanden bär statuskod och GHL:s egen text, aldrig
//   token, client_secret eller refresh_token.

import { GhlFel } from "@/lib/ghl-agency";
import { supabaseService } from "@/lib/supabase-admin";

const BAS = "https://services.leadconnectorhq.com";
const VERSION_OAUTH = "2021-07-28";

/** Marginal före utgång då vi förnyar i förväg. GHL:s tokens lever 24 h. */
const FORNYA_INOM_MS = 10 * 60 * 1000;

export interface AppKonfig {
  clientId: string;
  clientSecret: string;
  companyId: string;
}

export function ghlAppKonfig(): AppKonfig | null {
  const clientId = (process.env.GHL_APP_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GHL_APP_CLIENT_SECRET || "").trim();
  const companyId = (process.env.GHL_COMPANY_ID || "").trim();
  if (!clientId || !clientSecret || !companyId) return null;
  return { clientId, clientSecret, companyId };
}

export const APP_SAKNAS_TEXT =
  "Marketplace-appens nycklar saknas i env (GHL_APP_CLIENT_ID, GHL_APP_CLIENT_SECRET, GHL_COMPANY_ID). " +
  "De skapas i developer.gohighlevel.com under Manage → Secrets → Client Keys.";

// ── Lågnivåanrop mot /oauth/ ────────────────────────────────────────────────────────

interface OauthSvar {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  expires_in?: number;
  expiresIn?: number;
  scope?: string;
  userType?: string;
  companyId?: string;
  locationId?: string;
}

/**
 * Normaliserar GHL:s svar. Fälten läses i BÅDA stavningarna med flit.
 *
 * ★ VARFÖR: dokumentationen anger `access_token`, medan den tidigare koden i
 *   `lib/ghl-agency.ts` läste `accessToken` — och båda kan inte ha varit rätt. Vilken
 *   som faktiskt kommer tillbaka avgörs av mätningen i `scripts/mp1-bevisa.mts`, som
 *   skriver ut vilken stavning som bar värdet. Tills den mätningen är gjord är ett
 *   tyst `undefined` värre än en liten dubbelläsning.
 */
function normalisera(s: OauthSvar): { token: string; refresh: string | null; utgar: Date; scopes: string | null } {
  const token = s.access_token ?? s.accessToken;
  if (!token) throw new GhlFel("GHL svarade utan access_token.", 200, "");
  const sekunder = s.expires_in ?? s.expiresIn ?? 86400;
  return {
    token,
    refresh: s.refresh_token ?? s.refreshToken ?? null,
    utgar: new Date(Date.now() + sekunder * 1000),
    scopes: s.scope ?? null,
  };
}

async function oauthAnrop(vag: string, form: Record<string, string>, bearer?: string): Promise<OauthSvar> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Version: VERSION_OAUTH,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let svar: Response;
  try {
    svar = await fetch(`${BAS}${vag}`, {
      method: "POST",
      headers,
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    const namn = (e as { name?: string })?.name;
    throw new GhlFel(
      namn === "TimeoutError" || namn === "AbortError"
        ? `GHL svarade inte i tid (${vag}).`
        : `GHL gick inte att nå (${vag}): ${e instanceof Error ? e.message : String(e)}`,
      null,
      "",
    );
  }

  const rå = await svar.text();
  if (!svar.ok) {
    throw new GhlFel(`GHL svarade HTTP ${svar.status} på ${vag}: ${rå.slice(0, 400)}`, svar.status, rå);
  }
  try {
    return (rå ? JSON.parse(rå) : {}) as OauthSvar;
  } catch {
    throw new GhlFel(`GHL svarade med något som inte är JSON på ${vag}: ${rå.slice(0, 200)}`, svar.status, rå);
  }
}

// ── Lagring ─────────────────────────────────────────────────────────────────────────

interface SparadToken {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string | null;
}

async function sparaToken(rad: {
  id: string;
  userType: "Company" | "Location";
  companyId: string;
  locationId?: string | null;
  token: string;
  refresh: string | null;
  utgar: Date;
  scopes: string | null;
}): Promise<void> {
  const sb = supabaseService();
  const { error } = await sb.from("ghl_app_tokens").upsert(
    {
      id: rad.id,
      user_type: rad.userType,
      company_id: rad.companyId,
      location_id: rad.locationId ?? null,
      access_token: rad.token,
      refresh_token: rad.refresh,
      expires_at: rad.utgar.toISOString(),
      scopes: rad.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Kunde inte spara GHL-token: ${error.message}`);
}

async function lasToken(id: string): Promise<SparadToken | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("ghl_app_tokens")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("id", id)
    .maybeSingle();
  return (data as SparadToken | null) ?? null;
}

function harUtgatt(expires_at: string, marginalMs = FORNYA_INOM_MS): boolean {
  return new Date(expires_at).getTime() - Date.now() < marginalMs;
}

// ── Installation ────────────────────────────────────────────────────────────────────

/**
 * Adressen kunden (här: Håkan själv) skickas till för att installera appen.
 *
 * ⚠ OVERIFIERAD FORM. Den privata appens egen "Install link" i utvecklarportalen är den
 * bevisade vägen och ska användas i första hand — den bär rätt scopes automatiskt.
 * Den här funktionen finns för att kunna bygga länken i gränssnittet senare, och ska
 * bevisas innan den används skarpt.
 */
export function installationsUrl(redirectUri: string, scopes: string[]): string {
  const k = ghlAppKonfig();
  if (!k) throw new Error(APP_SAKNAS_TEXT);
  const p = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    client_id: k.clientId,
    scope: scopes.join(" "),
  });
  return `https://marketplace.gohighlevel.com/oauth/chooselocation?${p.toString()}`;
}

/** Callbackens adress. En enda plats, så portalen och koden inte kan glida isär. */
export function redirectUri(origin: string): string {
  return `${origin}/api/crm/oauth/callback`;
}

/**
 * Växlar authorization-koden mot ett byråtoken och sparar det.
 *
 * Returnerar de scopes GHL faktiskt gav appen — det är den mätning MP-0 inte kunde göra
 * från rullgardinen, och den enda som räknas.
 */
export async function vaxlaKod(code: string, redirect: string): Promise<{ companyId: string; scopes: string | null }> {
  const k = ghlAppKonfig();
  if (!k) throw new Error(APP_SAKNAS_TEXT);

  const svar = await oauthAnrop("/oauth/token", {
    client_id: k.clientId,
    client_secret: k.clientSecret,
    grant_type: "authorization_code",
    code,
    user_type: "Company",
    redirect_uri: redirect,
  });
  const n = normalisera(svar);

  // companyId kommer ur svaret när det finns; annars är env-värdet det vi installerade mot.
  const companyId = svar.companyId || k.companyId;

  // ★ SPÄRREN LIGGER HÄR, INTE I ROUTEN. Callbacken är en öppen adress: vem som helst kan
  //   anropa den med en egen giltig kod och därmed skriva över byråtokenet med en FRÄMMANDE
  //   byrås token. Då skulle provisioneringen skapa konton i någon annans GHL. Kontrollen
  //   måste sitta på den delade vägen, annars gäller den bara den anropare som råkar minnas
  //   den. Se [[lesson_varning_i_kommentar_ar_inte_delad_kod]].
  if (companyId !== k.companyId) {
    throw new Error("Installationen kom från en annan byrå än den konfigurerade. Inget sparades.");
  }

  await sparaToken({
    id: `company:${companyId}`,
    userType: "Company",
    companyId,
    token: n.token,
    refresh: n.refresh,
    utgar: n.utgar,
    scopes: n.scopes,
  });

  return { companyId, scopes: n.scopes };
}

// ── Byråtoken med förnyelse ─────────────────────────────────────────────────────────

/**
 * Giltigt byråtoken. Förnyar tio minuter före utgång.
 *
 * ★ REFRESH-TOKEN ÄR ENGÅNGS. Varje förnyelse returnerar en ny som MÅSTE sparas —
 *   sparas den inte är kedjan bruten permanent och appen måste installeras om för hand.
 *   Därför sparas den nya raden innan tokenet returneras, aldrig efteråt.
 */
export async function byraToken(): Promise<string> {
  const k = ghlAppKonfig();
  if (!k) throw new Error(APP_SAKNAS_TEXT);

  const sparad = await lasToken(`company:${k.companyId}`);
  if (!sparad) {
    throw new Error(
      "Appen är inte installerad än — inget byråtoken finns sparat. Installera den privata " +
        "Marketplace-appen på byrån och låt callbacken ta emot koden.",
    );
  }
  if (!harUtgatt(sparad.expires_at)) return sparad.access_token;

  if (!sparad.refresh_token) {
    throw new Error("Byråtokenet har gått ut och saknar refresh_token. Appen måste installeras om.");
  }

  const svar = await oauthAnrop("/oauth/token", {
    client_id: k.clientId,
    client_secret: k.clientSecret,
    grant_type: "refresh_token",
    refresh_token: sparad.refresh_token,
    user_type: "Company",
  });
  const n = normalisera(svar);

  await sparaToken({
    id: `company:${k.companyId}`,
    userType: "Company",
    companyId: k.companyId,
    token: n.token,
    refresh: n.refresh,
    utgar: n.utgar,
    scopes: n.scopes ?? sparad.scopes,
  });

  return n.token;
}

// ── Location-token ──────────────────────────────────────────────────────────────────

/**
 * Underkonton som Cockpit får hämta en nyckel till.
 *
 * ★ REGELN ÄR HÅKANS, DATUM 2026-08-16: appen ska bara röra de kunder han faktiskt
 *   arbetar med i Cockpit. Byrån har 316 underkonton; Cockpit hanterar en handfull.
 *
 * ★ VARFÖR SPÄRREN LIGGER I KODEN OCH INTE BARA I INSTALLATIONEN: GHL:s installation
 *   avgör vad som är MÖJLIGT, men ett fel location-id någonstans i kedjan skulle annars
 *   tyst hämta en nyckel till ett främmande konto — och en location-token returnerar sitt
 *   eget kontos data oavsett vilket id som skickas med, så felet syns inte som ett fel.
 *   Det är precis så widgets en gång visade fel kunds data. Se
 *   [[solution_multi_tenant_ghl_token_leakage]].
 */
async function faronsHamtaNyckel(locationId: string): Promise<boolean> {
  // Mallkontot är inte en kund men är källan alla kundkonton skapas ur.
  if (locationId && locationId === (process.env.GHL_MALL_LOCATION_ID || "").trim()) return true;

  const sb = supabaseService();
  const { data } = await sb
    .from("coach_users")
    .select("id")
    .eq("ghl_location_id", locationId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export interface LocationTokenOpts {
  /** Hoppar över sparad token och mintar en ny. Används av mätskript. */
  tvinga?: boolean;
  /**
   * Kontot skapades av oss i den här körningen och har ännu ingen rad i `coach_users`.
   *
   * ⚠ Provisioneringen skriver custom values INNAN klientraden finns — utan det här
   * undantaget skulle spärren ovan blockera själva provisioneringen den ska skydda.
   * Sätts bara av den kod som just fått location-id:t ur `POST /locations/`.
   */
  nyskapad?: boolean;
}

/**
 * POST /oauth/locationToken — växlar byråtokenet mot en token för ETT underkonto.
 *
 * ★ STAVNINGEN ÄR MÄTT, INTE GISSAD. `lib/ghl-agency.ts` anropade `/oauth/location-token`
 *   med bindestreck och läste `accessToken`. Mätningen 2026-08-16 visar `/oauth/locationToken`
 *   och `access_token` — den gamla vägen hann aldrig bevisas eftersom Private Integrations
 *   nekades redan på scopet.
 */
export async function locationToken(locationId: string, opts: LocationTokenOpts = {}): Promise<string> {
  const k = ghlAppKonfig();
  if (!k) throw new Error(APP_SAKNAS_TEXT);

  if (!opts.nyskapad && !(await faronsHamtaNyckel(locationId))) {
    throw new Error(
      `Underkontot ${locationId} är ingen kund i Cockpit. Ingen nyckel hämtades. ` +
        "Appen ska bara röra konton som finns i kundregistret.",
    );
  }

  if (!opts.tvinga) {
    const sparad = await lasToken(`location:${locationId}`);
    if (sparad && !harUtgatt(sparad.expires_at)) return sparad.access_token;
  }

  const byra = await byraToken();
  const svar = await oauthAnrop(
    "/oauth/locationToken",
    { companyId: k.companyId, locationId },
    byra,
  );
  const n = normalisera(svar);

  await sparaToken({
    id: `location:${locationId}`,
    userType: "Location",
    companyId: k.companyId,
    locationId,
    token: n.token,
    refresh: n.refresh,
    utgar: n.utgar,
    scopes: n.scopes,
  });

  return n.token;
}

export interface InstalleratKonto {
  _id: string;
  name?: string;
  isInstalled: boolean;
  installedAt?: string;
}

/**
 * GET /oauth/installedLocations — byråns underkonton och om appen sitter på dem.
 *
 * Kräver `oauth.readonly`. Den här skiljer "installationen saknas" från "växlingen är
 * trasig", och utan den skillnaden går ett 401 inte att felsöka.
 *
 * ★ TVÅ FÄLLOR, BÅDA MÄTTA 2026-08-16 — namnet ljuger:
 *
 *   1. Endpointen returnerar ALLA underkonton, inte bara de installerade. Sanningen står
 *      i `isInstalled` per rad. Vid mätningen kom 316 konton tillbaka medan appen satt på
 *      tre. Den som litar på listans längd tror att appen är installerad överallt.
 *   2. `limit` taks till 100 oavsett vad man ber om. 500 gav 100 rader och `count: 316`.
 *      Utan sidhämtning nedan tappas 216 konton tyst.
 *
 * @param inkluderaEjInstallerade tar med konton där appen INTE sitter (för översiktsvyer).
 */
export async function installeradeLocations(
  appId: string,
  inkluderaEjInstallerade = false,
): Promise<{ konton: InstalleratKonto[]; totalt: number; installerasPaNyaKonton: boolean }> {
  const k = ghlAppKonfig();
  if (!k) throw new Error(APP_SAKNAS_TEXT);
  const byra = await byraToken();

  const alla: InstalleratKonto[] = [];
  let totalt = 0;
  let framtida = false;
  for (let skip = 0; skip < 5000; skip += 100) {
    const p = new URLSearchParams({ companyId: k.companyId, appId, limit: "100", skip: String(skip) });
    const svar = await fetch(`${BAS}/oauth/installedLocations?${p.toString()}`, {
      headers: { Authorization: `Bearer ${byra}`, Version: VERSION_OAUTH, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    const rå = await svar.text();
    if (!svar.ok) {
      throw new GhlFel(`GHL svarade HTTP ${svar.status} på /oauth/installedLocations: ${rå.slice(0, 400)}`, svar.status, rå);
    }
    const d = JSON.parse(rå || "{}") as {
      locations?: InstalleratKonto[];
      count?: number;
      installToFutureLocations?: boolean;
    };
    if (skip === 0) {
      totalt = d.count ?? 0;
      framtida = d.installToFutureLocations === true;
    }
    const bunt = d.locations ?? [];
    alla.push(...bunt);
    if (bunt.length < 100 || alla.length >= totalt) break;
  }

  return {
    konton: inkluderaEjInstallerade ? alla : alla.filter((x) => x.isInstalled),
    totalt,
    installerasPaNyaKonton: framtida,
  };
}
