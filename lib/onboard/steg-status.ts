// ONBOARD-7 — serversidan för stegverktyget.
//
// Ansvarar för tre saker:
//   1. Härleda vilka steg som ÄR klara ur verkligheten, inte ur en bock någon satt.
//   2. Slå ihop kodens stegtexter med eventuella överskrivningar i databasen.
//   3. Verifiera kundnyckeln och köra kontrollerna ur processdokumentets del 2.
//
// ★ HÄRLEDD STATUS SLÅR SPARAD STATUS. Ett steg som faktiskt är gjort ska visas som gjort
//   även om ingen tryckt på något — annars ljuger listan för den som litar på den. Bocken
//   i `steg_status` används bara för de steg som INTE går att observera (åtkomster,
//   kundlänk skickad, kundens material).

import { supabaseService } from "@/lib/supabase-admin";
import { STEG, stegLage, type StegDef, type StegStatusVarde } from "./steg";

export interface StegVy extends StegDef {
  status: StegStatusVarde;
  blockeratVarfor: string | null;
  notering: string | null;
}

export interface OnboardingVy {
  id: string;
  doman: string;
  url: string;
  foretag: string | null;
  clientId: string | null;
  locationId: string | null;
  /**
   * Kundens inloggningslänk — hela vägen, inte bara token.
   *
   * ★ DEN BYGGS ALDRIG AV KLIENT-ID. `/k/<token>` slås upp mot `clients.customer_token`
   *   eller `platform_users.login_token` (se lib/customer-context.ts). Ett klient-id
   *   matchar ingen av dem: länken blir 36 tecken lång, ser fullt rimlig ut, och kastar
   *   ut kunden till inloggningen. Null här betyder "ingen länk finns än" och ska visas
   *   som just det — hellre tomt än en länk som inte bär.
   */
  kundlank: string | null;
  skapad: string;
  steg: StegVy[];
  klaraAntal: number;
  nastaHandling: { nr: number; titel: string; agare: string } | null;
}

/** Databasens texter vinner över kodens — processen ska gå att ändra utan deploy. */
async function textOverskrivningar(): Promise<Map<string, Partial<StegDef>>> {
  const sb = supabaseService();
  const { data } = await sb.from("onboarding_stegtext").select("nyckel, titel, beskrivning, instruktion");
  const m = new Map<string, Partial<StegDef>>();
  for (const r of (data ?? []) as { nyckel: string; titel?: string; beskrivning?: string; instruktion?: string }[]) {
    const o: Partial<StegDef> = {};
    if (r.titel) o.titel = r.titel;
    if (r.beskrivning) o.beskrivning = r.beskrivning;
    if (r.instruktion) o.instruktion = r.instruktion;
    if (Object.keys(o).length) m.set(r.nyckel, o);
  }
  return m;
}

interface Korning {
  id: string;
  doman: string;
  url: string;
  status: string;
  analys: { forslag?: { foretagsnamn?: { varde?: string } } } | null;
  forslag: { foretagsnamn?: { varde?: string } } | null;
  client_id: string | null;
  ghl_location_id: string | null;
  steg_status: Record<string, { status?: StegStatusVarde; notering?: string }> | null;
  created_at: string;
}

/**
 * Läser ut vad som FAKTISKT är gjort, genom att titta på verkligheten.
 *
 * Varje kontroll är billig (en rad, ett fält) — de dyra kontrollerna ligger i
 * `korVerifiering` bakom en knapp.
 */
async function harleddaKlara(k: Korning): Promise<Set<string>> {
  const sb = supabaseService();
  const klara = new Set<string>();

  if (k.analys) klara.add("analys");
  if (["godkand", "kor", "klar"].includes(k.status)) klara.add("granskning");
  if (k.ghl_location_id) klara.add("ghl_konto");
  if (k.client_id) klara.add("tenant");

  // Steget är klart när kontot går att SKRIVA I — oavsett vilken av de två vägarna som bär.
  //
  //   1. Marketplace-appen har hämtat en nyckel till kontot (raden i ghl_app_tokens finns
  //      bara om växlingen faktiskt lyckats — den är ett kvitto, inte en avsikt).
  //   2. Den handskapade kundnyckeln ligger på coach_users, som förr.
  //
  // ★ VARFÖR INTE ETT NÄTANROP HIT: den här funktionen kör i listvyn, en gång per kund.
  //   Ett anrop mot GHL per rad gör vyn långsam i takt med att kunderna blir fler.
  //   Uppslaget mot ghl_app_tokens är lika sant och kostar ingenting.
  if (k.ghl_location_id) {
    const { data: app } = await sb
      .from("ghl_app_tokens")
      .select("id")
      .eq("id", `location:${k.ghl_location_id}`)
      .maybeSingle();
    if (app) klara.add("kundnyckel");
    else {
      const { data } = await sb
        .from("coach_users")
        .select("ghl_api_token")
        .eq("ghl_location_id", k.ghl_location_id)
        .maybeSingle();
      if ((data as { ghl_api_token?: string } | null)?.ghl_api_token) klara.add("kundnyckel");
    }
  }

  if (k.client_id) {
    const { data } = await sb
      .from("hm_brand_profile")
      .select("client_id")
      .eq("client_id", k.client_id)
      .maybeSingle();
    if (data) klara.add("brand_profil");
  }

  return klara;
}

export async function hamtaOnboarding(id: string): Promise<OnboardingVy | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("onboarding_korningar")
    .select("id, doman, url, status, analys, forslag, client_id, ghl_location_id, steg_status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return byggVy(data as unknown as Korning, await textOverskrivningar());
}

export async function listaOnboardingar(): Promise<OnboardingVy[]> {
  const sb = supabaseService();
  const { data } = await sb
    .from("onboarding_korningar")
    .select("id, doman, url, status, analys, forslag, client_id, ghl_location_id, steg_status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const texter = await textOverskrivningar();
  const ut: OnboardingVy[] = [];
  for (const r of (data ?? []) as unknown as Korning[]) ut.push(await byggVy(r, texter));
  return ut;
}

/**
 * Kundens riktiga inloggningslänk, eller null.
 *
 * Två vägar in i /k/, i den ordning provisioneringen skapar dem: den per-användar-token
 * som steg 7 lägger på `platform_users`, annars klientens delade `customer_token`.
 * Bas-URL:en är produktionen med flit — länken skickas till kunden, inte till oss.
 */
async function kundlankFor(clientId: string | null): Promise<string | null> {
  if (!clientId) return null;
  const sb = supabaseService();
  const bas = (process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/+$/, "");

  const { data: u } = await sb
    .from("platform_users")
    .select("login_token")
    .eq("client_id", clientId)
    .not("login_token", "is", null)
    .order("invited_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const token = (u as { login_token?: string } | null)?.login_token;
  if (token) return `${bas}/k/${token}`;

  const { data: c } = await sb.from("clients").select("customer_token").eq("id", clientId).maybeSingle();
  const delad = (c as { customer_token?: string } | null)?.customer_token;
  return delad ? `${bas}/k/${delad}` : null;
}

async function byggVy(k: Korning, texter: Map<string, Partial<StegDef>>): Promise<OnboardingVy> {
  const harledda = await harleddaKlara(k);
  const sparade = k.steg_status ?? {};

  // Manuellt bockade steg räknas som klara — de går inte att observera.
  const klara = new Set(harledda);
  for (const [nyckel, v] of Object.entries(sparade)) if (v?.status === "klart") klara.add(nyckel);

  const steg: StegVy[] = STEG.map((def) => {
    const med = { ...def, ...(texter.get(def.nyckel) ?? {}) };
    const { status, blockeratVarfor } = stegLage(med, klara, sparade[def.nyckel]?.status);
    return { ...med, status, blockeratVarfor, notering: sparade[def.nyckel]?.notering ?? null };
  });

  const nasta = steg.find((s) => s.status === "vantar" || s.status === "pagar");
  const foretag =
    k.forslag?.foretagsnamn?.varde ?? k.analys?.forslag?.foretagsnamn?.varde ?? null;

  return {
    id: k.id,
    doman: k.doman,
    url: k.url,
    foretag,
    clientId: k.client_id,
    locationId: k.ghl_location_id,
    kundlank: await kundlankFor(k.client_id),
    skapad: k.created_at,
    steg,
    klaraAntal: steg.filter((s) => s.status === "klart").length,
    nastaHandling: nasta ? { nr: nasta.nr, titel: nasta.titel, agare: nasta.agare } : null,
  };
}

export async function sattStegStatus(
  id: string,
  nyckel: string,
  status: StegStatusVarde,
  notering?: string | null,
): Promise<{ ok: boolean; fel?: string }> {
  const sb = supabaseService();
  const { data } = await sb.from("onboarding_korningar").select("steg_status").eq("id", id).maybeSingle();
  const nu = ((data as { steg_status?: Record<string, unknown> } | null)?.steg_status ?? {}) as Record<string, unknown>;
  nu[nyckel] = { status, notering: notering ?? null, uppdaterad: new Date().toISOString() };
  const { error } = await sb
    .from("onboarding_korningar")
    .update({ steg_status: nu, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, fel: error.message } : { ok: true };
}

// ── Kundnyckeln ──────────────────────────────────────────────────────────────

const GHL = "https://services.leadconnectorhq.com";

/**
 * Verifierar en inklistrad kundnyckel och sparar den om den håller.
 *
 * ⚠ TVÅ FÄLLOR FRÅN VERKLIGHETEN, båda kostade timmar:
 *   1. Klistras beskrivningstexten med av kommer nyckeln in med mellanslag och GHL svarar
 *      "Invalid Private Integration token" — vilket ser ut som fel behörighet. Vi klipper
 *      därför vid första mellanslaget innan vi testar.
 *   2. Skrivrätt utan läsrätt ger 401 först när koden försöker läsa. Vi testar därför en
 *      LÄSNING mot varje resurs vi kommer att behöva, inte bara att nyckeln existerar.
 */
export async function verifieraKundnyckel(
  locationId: string,
  raNyckel: string,
): Promise<{ ok: boolean; fel?: string; saknadeScopes?: string[] }> {
  const nyckel = (raNyckel || "").trim().split(/\s+/)[0];
  if (!nyckel) return { ok: false, fel: "Ingen nyckel angavs." };
  if (!nyckel.startsWith("pit-")) {
    return { ok: false, fel: "Det ser inte ut som en Private Integration-nyckel — den ska börja med pit-." };
  }

  const las = async (vag: string) => {
    const r = await fetch(`${GHL}${vag}`, {
      headers: { Authorization: `Bearer ${nyckel}`, Version: "2021-07-28", Accept: "application/json" },
    });
    return r.status;
  };

  const prov: [string, string][] = [
    ["locations/customValues.readonly", `/locations/${locationId}/customValues`],
    ["locations/customFields.readonly", `/locations/${locationId}/customFields`],
    ["locations/tags.readonly", `/locations/${locationId}/tags`],
    ["opportunities.readonly", `/opportunities/pipelines?locationId=${locationId}`],
    ["workflows.readonly", `/workflows/?locationId=${locationId}`],
  ];

  const saknade: string[] = [];
  for (const [scope, vag] of prov) {
    const status = await las(vag);
    if (status === 200) continue;
    if (status === 401) { saknade.push(scope); continue; }
    return { ok: false, fel: `Oväntat svar från GHL (HTTP ${status}) på ${vag}.` };
  }

  if (saknade.length === prov.length) {
    return { ok: false, fel: "Nyckeln känns inte igen alls. Skapade du den inne i KUNDENS konto, och kopierade du hela värdet utan mellanslag?" };
  }
  if (saknade.length) return { ok: false, fel: "Nyckeln fungerar men saknar behörighet.", saknadeScopes: saknade };

  // ★ TOMHETSKONTROLL — laddades snapshotet verkligen?
  //
  //   Ett konto som skapas UTAN FEL men UTAN INNEHÅLL är värre än ett fel: det upptäcks
  //   först när kunden loggar in och möts av en tom pipeline. POST /locations/ svarar 201
  //   även om snapshot-laddningen sedan misslyckas — den sker asynkront efteråt.
  //
  //   Kontrollen kan inte göras vid skapandet: byrå-nyckeln får inte läsa underkontots
  //   resurser (401, verifierat 2026-08-07). Det här är alltså den TIDIGASTE punkt där
  //   någon nyckel över huvud taget kan se in i kontot — och den ligger före allt kunden
  //   ser, vilket är det som räknas.
  const pl = await fetch(`${GHL}/opportunities/pipelines?locationId=${locationId}`, {
    headers: { Authorization: `Bearer ${nyckel}`, Version: "2021-07-28", Accept: "application/json" },
  });
  const data = (await pl.json().catch(() => null)) as { pipelines?: { name: string; stages?: unknown[] }[] } | null;
  const pipelines = data?.pipelines ?? [];
  const kund = pipelines.find((p) => /kund pipeline/i.test(p.name)) ?? pipelines[0];
  const antalSteg = kund?.stages?.length ?? 0;

  if (!pipelines.length) {
    return {
      ok: false,
      fel:
        "Nyckeln fungerar, men kontot är TOMT — ingen pipeline alls. Snapshotet laddades inte. " +
        "Ladda det för hand (byrånivå → Sub-Accounts → kontot → Load Snapshot) innan du går vidare, annars möts kunden av ett tomt konto.",
    };
  }
  if (antalSteg !== 7) {
    return {
      ok: false,
      fel:
        `Nyckeln fungerar, men pipelinen "${kund?.name ?? "okänd"}" har ${antalSteg} steg i stället för 7. ` +
        "Snapshotet laddades ofullständigt. Kontrollera kontot innan du går vidare.",
    };
  }

  const sb = supabaseService();
  const { data: rad } = await sb.from("coach_users").select("id").eq("ghl_location_id", locationId).maybeSingle();
  if (!rad) return { ok: false, fel: "MySales-kopplingen saknas — kör steg 6 först." };
  const { error } = await sb
    .from("coach_users")
    .update({ ghl_api_token: nyckel, updated_at: new Date().toISOString() })
    .eq("id", (rad as { id: string }).id);
  return error ? { ok: false, fel: error.message } : { ok: true };
}
