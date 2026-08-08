// ONBOARD-1 — GoHighLevel på BYRÅNIVÅ (skapa sub-account, ladda snapshot, sätta custom values).
//
// ⚠ DETTA ÄR EN ANNAN API-VERSION ÄN RESTEN AV KODBASEN. LÄS INNAN DU "ENHETLIGGÖR".
//
// Allt befintligt GHL-anrop i projektet (lib/studio/ghl, lib/fokus/synk, lib/hq/pipeline,
// lib/lead-intake) skickar `Version: 2021-07-28`. Endpointsen HÄR kräver `Version: v3`.
// Det är inte ett slarv och inte något att städa bort — det är två skilda API-generationer
// hos GHL, och v3-endpointsen svarar 4xx på 2021-07-28. Verifierat mot GHL:s officiella
// OpenAPI-spec (GoHighLevel/highlevel-api-docs, apps/v3/locations-v3.json + snapshots-v3.json)
// 2026-08-06.
//
// ── TOKEN: TVÅ NIVÅER, OCH DE ÄR INTE UTBYTBARA ─────────────────────────────────────
//
//   Byråtoken (Agency / Company)      → POST /locations/, GET /snapshots/
//   Location-token (per sub-account)  → /locations/{id}/customValues
//
// `HQ_GHL_PIT` som redan finns i env DUGER INTE här. Den är scope:ad till Håkans egen
// Displayteknik-location, och en location-scoped PIT kan varken skapa sub-accounts eller
// läsa byråns snapshots — se [[solution_multi_tenant_ghl_token_leakage]], där just det
// missförståndet gjorde att widgets visade fel kunds data.
//
// Krävs i env:
//   GHL_AGENCY_PIT  — Private Integration Token skapad på BYRÅNIVÅ (Agency Settings →
//                     Private Integrations), med scopes: locations.write, locations.readonly,
//                     snapshots.readonly, oauth.write, locations/customValues.write
//   GHL_COMPANY_ID  — byråns companyId
//
// GHL kräver Agency Pro-planen för POST /locations/.
//
// ★ NYCKELN LOGGAS ALDRIG. Felmeddelanden bär statuskod och GHL:s egen text, aldrig token.

const BAS = "https://services.leadconnectorhq.com";
const VERSION_V3 = "v3";

export interface GhlKonfig {
  pit: string;
  companyId: string;
}

/**
 * Läser byråkonfigurationen. Null när den inte är satt — anroparen ska säga det tydligt.
 *
 * ★ TVÅ NAMN PÅ SAMMA NYCKEL. Byråtokenet döptes till `GHL_BYRA_TOKEN` när Gittes konto
 *   skapades för hand, medan den här filen skrevs mot `GHL_AGENCY_PIT`. Båda läses därför,
 *   annars ser en fullt fungerande nyckel ut som en saknad: torrkörningen svarade
 *   "GHL_AGENCY_PIT saknas i env" med rätt token på plats under ett annat namn.
 *   Nytt namn ska INTE hittas på — sätt något av de två.
 */
export function ghlAgencyKonfig(): GhlKonfig | null {
  const pit = (process.env.GHL_AGENCY_PIT || process.env.GHL_BYRA_TOKEN || "").trim();
  const companyId = (process.env.GHL_COMPANY_ID || "").trim();
  if (!pit || !companyId) return null;
  return { pit, companyId };
}

export const GHL_SAKNAS_TEXT =
  "Byråtoken saknas i env (GHL_AGENCY_PIT eller GHL_BYRA_TOKEN), eller GHL_COMPANY_ID. Skapa en Private " +
  "Integration på BYRÅNIVÅ i GoHighLevel (Agency Settings → Private Integrations) med scopes locations.write " +
  "och locations.readonly. Den befintliga HQ_GHL_PIT är låst till en enskild location och kan inte skapa " +
  "sub-accounts. Observera att byråtokenet aldrig kan SKRIVA i ett underkonto — det kräver kundens egen " +
  "nyckel i steg 4.";

export class GhlFel extends Error {
  readonly status: number | null;
  readonly kropp: string;
  constructor(meddelande: string, status: number | null, kropp: string) {
    super(meddelande);
    this.name = "GhlFel";
    this.status = status;
    this.kropp = kropp;
  }
}

interface AnropOpts {
  metod?: "GET" | "POST" | "PUT";
  token: string;
  body?: unknown;
  /** x-www-form-urlencoded i stället för JSON (oauth-endpointsen kräver det). */
  form?: Record<string, string>;
  timeoutMs?: number;
}

async function anropa<T>(vag: string, opts: AnropOpts): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    Version: VERSION_V3,
    Accept: "application/json",
  };
  let kropp: string | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    kropp = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    kropp = JSON.stringify(opts.body);
  }

  let svar: Response;
  try {
    svar = await fetch(`${BAS}${vag}`, {
      method: opts.metod ?? "GET",
      headers,
      body: kropp,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
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
    // GHL:s felkropp är läsbar och pekar oftast rakt på saknad scope eller fel plan.
    throw new GhlFel(`GHL svarade HTTP ${svar.status} på ${vag}: ${rå.slice(0, 400)}`, svar.status, rå);
  }
  try {
    return (rå ? JSON.parse(rå) : {}) as T;
  } catch {
    throw new GhlFel(`GHL svarade med något som inte är JSON på ${vag}: ${rå.slice(0, 200)}`, svar.status, rå);
  }
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export interface Snapshot {
  id: string;
  name: string;
  type: string;
}

/** GET /snapshots/ — byråns alla snapshots. Byråtoken. */
export async function listaSnapshots(k: GhlKonfig): Promise<Snapshot[]> {
  const r = await anropa<{ snapshots?: Snapshot[] }>(
    `/snapshots/?companyId=${encodeURIComponent(k.companyId)}`,
    { token: k.pit },
  );
  return r.snapshots ?? [];
}

/**
 * Slår upp ett snapshot på NAMN, eftersom det är namnet Håkan känner ("MySales Pro v1.0")
 * medan id:t är ett ogenomskinligt tecken-id som byts när snapshotet byggs om.
 * Exakt namnmatchning först, annars skiftlägesokänslig — aldrig delsträngsmatchning,
 * eftersom "MySales Pro v1.0" och "MySales Pro v1.0 TEST" annars vore samma sak.
 */
export async function hittaSnapshot(k: GhlKonfig, namn: string): Promise<Snapshot | null> {
  const alla = await listaSnapshots(k);
  return (
    alla.find((s) => s.name === namn) ??
    alla.find((s) => s.name.trim().toLowerCase() === namn.trim().toLowerCase()) ??
    null
  );
}

// ── Sub-accounts ─────────────────────────────────────────────────────────────

export interface GhlLocation {
  id: string;
  name?: string;
  email?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  companyId?: string;
}

/**
 * GET /locations/search — sidbläddrar igenom byråns sub-accounts.
 *
 * ⚠ v3:s search tar BARA companyId, skip, limit, order och email. Det finns ingen
 * fritextsökning och inget filter på website. Idempotens mot en webbadress kan alltså
 * inte lösas med ett API-anrop — vi måste bläddra och jämföra själva. Det är därför
 * `hittaLocationForSajt` finns och varför vår egen mappningstabell är förstahandskällan.
 */
export async function listaLocations(k: GhlKonfig, opts?: { max?: number }): Promise<GhlLocation[]> {
  const max = opts?.max ?? 500;
  const perSida = 100;
  const ut: GhlLocation[] = [];
  for (let skip = 0; skip < max; skip += perSida) {
    const r = await anropa<{ locations?: GhlLocation[] }>(
      `/locations/search?companyId=${encodeURIComponent(k.companyId)}&limit=${perSida}&skip=${skip}`,
      { token: k.pit },
    );
    const sida = r.locations ?? [];
    ut.push(...sida);
    if (sida.length < perSida) break;
  }
  return ut;
}

const bareHost = (u: string | undefined | null): string => {
  if (!u) return "";
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

/**
 * Letar upp ett befintligt sub-account för samma webbplats — idempotensgrinden mot GHL.
 * Matchar på domän (utan www) i första hand, e-post i andra.
 */
export async function hittaLocationForSajt(
  k: GhlKonfig,
  sajtUrl: string,
  epost?: string | null,
): Promise<GhlLocation | null> {
  const vard = bareHost(sajtUrl);
  const alla = await listaLocations(k);
  if (vard) {
    const träff = alla.find((l) => bareHost(l.website) === vard);
    if (träff) return träff;
  }
  if (epost) {
    const e = epost.trim().toLowerCase();
    const träff = alla.find((l) => (l.email || "").trim().toLowerCase() === e);
    if (träff) return träff;
  }
  return null;
}

export interface SkapaLocationIndata {
  namn: string;
  epost?: string | null;
  telefon?: string | null;
  adress?: string | null;
  ort?: string | null;
  postnummer?: string | null;
  hemsida?: string | null;
  /** 2-bokstavs landskod. Default SE. */
  land?: string;
  /** IANA-tidszon. Default Europe/Stockholm. */
  tidszon?: string;
  /** Snapshotets id, INTE dess namn. */
  snapshotId?: string | null;
  kontaktFornamn?: string | null;
  kontaktEfternamn?: string | null;
}

/**
 * POST /locations/ — skapar sub-account och laddar snapshotet.
 * Byråtoken + scope locations.write. Kräver Agency Pro hos GHL.
 */
export async function skapaLocation(k: GhlKonfig, d: SkapaLocationIndata): Promise<GhlLocation> {
  const body: Record<string, unknown> = {
    name: d.namn,
    companyId: k.companyId,
    country: d.land || "SE",
    timezone: d.tidszon || "Europe/Stockholm",
  };
  if (d.telefon) body.phone = d.telefon;
  if (d.adress) body.address = d.adress;
  if (d.ort) body.city = d.ort;
  if (d.postnummer) body.postalCode = d.postnummer;
  if (d.hemsida) body.website = d.hemsida;
  if (d.snapshotId) body.snapshotId = d.snapshotId;
  if (d.epost) {
    body.prospectInfo = {
      firstName: d.kontaktFornamn || d.namn,
      lastName: d.kontaktEfternamn || "",
      email: d.epost,
    };
  }
  const r = await anropa<GhlLocation & { location?: GhlLocation }>("/locations/", {
    metod: "POST",
    token: k.pit,
    body,
  });
  const loc = r.location ?? r;
  if (!loc?.id) throw new GhlFel("GHL skapade kontot men svarade utan location-id.", 200, JSON.stringify(r).slice(0, 300));
  return loc;
}

// ── Snapshot-status ──────────────────────────────────────────────────────────

export interface SnapshotStatus {
  status: string;
  klara: string[];
  vantar: string[];
}

/**
 * GET /snapshots/snapshot-status/{snapshotId}/location/{locationId}
 *
 * ★ VARFÖR DETTA MÅSTE POLLAS: snapshotet laddas ASYNKRONT efter att kontot skapats.
 * Skriver vi custom values innan laddningen är klar kan snapshotet skriva över dem —
 * och då står kundens konto med mallens platshållarvärden i stället för kundens egna,
 * utan att något felmeddelande någonsin visats.
 */
export async function snapshotStatus(k: GhlKonfig, snapshotId: string, locationId: string): Promise<SnapshotStatus> {
  const r = await anropa<{ data?: { status?: string; completed?: string[]; pending?: string[] } }>(
    `/snapshots/snapshot-status/${encodeURIComponent(snapshotId)}/location/${encodeURIComponent(locationId)}?companyId=${encodeURIComponent(k.companyId)}`,
    { token: k.pit },
  );
  return {
    status: r.data?.status ?? "okand",
    klara: r.data?.completed ?? [],
    vantar: r.data?.pending ?? [],
  };
}

/** Status när nyckeln inte får läsa snapshot-status alls. Skilj från "laddningen gick fel". */
export const SNAPSHOT_EJ_LASBAR = "ej_lasbar";

/**
 * Väntar tills snapshotet laddat klart. Returnerar sista kända status vid tidsgräns.
 *
 * ★ 401 ÄR INTE ETT MISSLYCKANDE — DET ÄR ATT VI INTE FÅR TITTA.
 *
 *   Verifierat mot API:t 2026-08-08: en byrå-Private-Integration svarar
 *   `401 "The token is not authorized for this scope"` på snapshot-status, precis som på
 *   `GET /snapshots/`, och `snapshots.readonly` går inte att få genomslag för. Väntan kunde
 *   alltså aldrig lyckas: den pollade 45 sekunder, svarade "okand", och provisioneringen
 *   satte hela körningen till status 'fel' — på en kund där kontot skapats helt korrekt.
 *
 *   Vid 401 avbryts därför pollningen direkt, och anroparen ska rapportera det som
 *   OKONTROLLERAT, inte trasigt. Den riktiga kontrollen finns redan och görs med kundens
 *   egen nyckel i steg 4: pipelinen ska ha sju steg, annars laddades snapshotet inte.
 */
export async function vantaPaSnapshot(
  k: GhlKonfig,
  snapshotId: string,
  locationId: string,
  opts?: { maxMs?: number; intervallMs?: number },
): Promise<{ klar: boolean; status: string }> {
  const maxMs = opts?.maxMs ?? 45000;
  const intervall = opts?.intervallMs ?? 4000;
  const slut = Date.now() + maxMs;
  let sist = "okand";
  while (Date.now() < slut) {
    try {
      const s = await snapshotStatus(k, snapshotId, locationId);
      sist = s.status;
      if (/complete|completed|success|finished/i.test(s.status) || (s.vantar.length === 0 && s.klara.length > 0)) {
        return { klar: true, status: s.status };
      }
    } catch (e) {
      // 401 = nyckeln får inte läsa resursen. Att fortsätta polla ger samma svar i 45 sekunder.
      if (e instanceof GhlFel && e.status === 401) return { klar: false, status: SNAPSHOT_EJ_LASBAR };
      // Status-endpointen svarar ibland 404 innan laddningen registrerats. Fortsätt.
    }
    await new Promise((r) => setTimeout(r, intervall));
  }
  return { klar: false, status: sist };
}

// ── Location-token ───────────────────────────────────────────────────────────

/**
 * POST /oauth/location-token — växlar byråtoken mot en location-scoped token.
 *
 * Custom values kan bara skrivas med en location-token; byråtoken har inte den
 * behörigheten. Endpointen är dokumenterad som "Agency-Access-Only: oauth.write".
 *
 * ⚠ Detta kan misslyckas om byråns Private Integration saknar oauth.write, eller om
 * GHL kräver en riktig Marketplace-app för just den här växlingen. Därför faller
 * `sattCustomValues` tillbaka på att prova byråtoken direkt, och rapporterar ärligt
 * vilken väg som fungerade — i stället för att tyst hoppa över custom values.
 */
export async function locationToken(k: GhlKonfig, locationId: string): Promise<string> {
  const r = await anropa<{ accessToken?: string }>("/oauth/location-token", {
    metod: "POST",
    token: k.pit,
    form: { companyId: k.companyId, locationId },
  });
  if (!r.accessToken) throw new GhlFel("GHL svarade utan accessToken för location-token.", 200, "");
  return r.accessToken;
}

// ── Custom values ────────────────────────────────────────────────────────────

export interface CustomValue {
  id: string;
  name: string;
  fieldKey?: string;
  value: string;
}

export async function listaCustomValues(locationId: string, token: string): Promise<CustomValue[]> {
  const r = await anropa<{ customValues?: CustomValue[] }>(
    `/locations/${encodeURIComponent(locationId)}/customValues`,
    { token },
  );
  return r.customValues ?? [];
}

/**
 * Sätter custom values IDEMPOTENT: finns namnet redan uppdateras det, annars skapas det.
 * Utan den kontrollen ger en andra körning dubbletter av varje värde i kundens konto.
 *
 * Returnerar vilken tokenväg som fungerade, så provisioneringen kan rapportera det.
 */
export async function sattCustomValues(
  k: GhlKonfig,
  locationId: string,
  varden: Record<string, string>,
  /**
   * ★ KUNDENS EGEN NYCKEL — den ENDA som faktiskt fungerar (inventeringen 2026-08-07).
   *
   *   Utan den här parametern provade funktionen location-token (kräver `oauth.write`,
   *   som inte finns bland Private Integrations 24 scopes) och föll sedan till byråtoken
   *   (som nekas med 401 på underkontots custom values, verifierat). Båda vägarna är alltså
   *   stängda, och det är därför Gittes värden fick fyllas med ett separat skript som bar
   *   hennes kundnyckel.
   *
   *   Provisioneringen slår upp nyckeln på `coach_users.ghl_api_token` och skickar den hit.
   *   Saknas den kan steget inte göras — och då ska det SÄGAS, inte tyst hoppas över.
   */
  kundToken?: string | null,
): Promise<{ satta: number; hoppade: number; via: "kundnyckel" | "location-token" | "byratoken"; fel: string[] }> {
  const poster = Object.entries(varden).filter(([, v]) => v != null && String(v).trim() !== "");
  if (!poster.length) return { satta: 0, hoppade: 0, via: "byratoken", fel: [] };

  let token = k.pit;
  let via: "kundnyckel" | "location-token" | "byratoken" = "byratoken";

  if (kundToken && kundToken.trim()) {
    token = kundToken.trim();
    via = "kundnyckel";
  } else {
    // Prova location-token — den dokumenterade vägen, stängd på den här byrån.
    try {
      token = await locationToken(k, locationId);
      via = "location-token";
    } catch {
      // Byråns integration saknar oauth.write eller GHL kräver Marketplace-app.
      // Prova byråtoken direkt; misslyckas även den rapporteras felet per värde nedan.
    }
  }

  let befintliga: CustomValue[] = [];
  try {
    befintliga = await listaCustomValues(locationId, token);
  } catch (e) {
    return { satta: 0, hoppade: poster.length, via, fel: [e instanceof Error ? e.message : String(e)] };
  }

  const karta = new Map(befintliga.map((c) => [c.name.trim().toLowerCase(), c]));
  const fel: string[] = [];
  let satta = 0;

  for (const [namn, varde] of poster) {
    const fanns = karta.get(namn.trim().toLowerCase());
    try {
      if (fanns) {
        await anropa(`/locations/${encodeURIComponent(locationId)}/customValues/${encodeURIComponent(fanns.id)}`, {
          metod: "PUT",
          token,
          body: { name: namn, value: String(varde) },
        });
      } else {
        await anropa(`/locations/${encodeURIComponent(locationId)}/customValues`, {
          metod: "POST",
          token,
          body: { name: namn, value: String(varde) },
        });
      }
      satta++;
    } catch (e) {
      fel.push(`${namn}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { satta, hoppade: poster.length - satta, via, fel };
}
