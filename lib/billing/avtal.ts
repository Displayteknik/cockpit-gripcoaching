// BETAL-1 — kundaffärerna. En rad per kund i billing_avtal.
//
// Den här filen är svaret på frågan "när kommer nästa betalning". Den fungerar för
// BÅDA sorters affärer:
//   · manuella (faktura utanför systemet) — datumet står i avtalet och räknas fram
//     automatiskt när det passerats
//   · Stripe — datumet läses ur abonnemanget, för där är Stripe sanningen
//
// Ett manuellt avtal är alltså inte ett provisorium som väntar på Stripe. Det är en
// giltig affärsform som ska synas i samma lista, med samma tydlighet.
//
// Server-only (service-role).

import { supabaseService } from "../supabase-admin";
// ★ Räknelogiken bor i datum.ts, utan databasimport, så adminvyn kan köra EXAKT samma
// funktioner i webbläsaren och visa nästa betalning medan Håkan skriver. Två uppsättningar
// datumfunktioner hade förr eller senare sagt olika saker.
import {
  iso, laggTill, rullaFram, dagarTill, nastaBetalningKlartext,
  periodbelopp, manadsvarde, medMoms,
  INTERVALL_TEXT, BETALSATT_TEXT,
  type Intervall, type Betalsatt, type AvtalStatus, type Kalla,
} from "./datum";

export {
  laggTill, rullaFram, dagarTill, nastaBetalningKlartext,
  periodbelopp, manadsvarde, medMoms, INTERVALL_TEXT, BETALSATT_TEXT,
};
export type { Intervall, Betalsatt, AvtalStatus, Kalla };

export interface AvtalRad {
  client_id: string;
  plan_id: string | null;
  belopp_sek: number | null;
  intervall: Intervall;
  betalsatt: Betalsatt;
  kalla: Kalla;
  startdatum: string | null;
  nasta_betalning: string | null;
  bindningstid_slut: string | null;
  status: AvtalStatus;
  faktura_epost: string | null;
  kontaktperson: string | null;
  anteckning: string | null;
}

// ── Läsning ─────────────────────────────────────────────────────────────────

export interface AvtalVy {
  client_id: string;
  klient: string;
  slug: string;
  primary_color: string;
  plan_id: string | null;
  plan_label: string | null;
  belopp_sek: number;
  belopp_inkl_moms: number;
  intervall: Intervall;
  intervall_text: string;
  betalsatt: Betalsatt;
  betalsatt_text: string;
  kalla: Kalla;
  startdatum: string | null;
  nasta_betalning: string | null;
  nasta_betalning_text: string;
  dagar_kvar: number | null;
  bindningstid_slut: string | null;
  status: AvtalStatus;
  betalstatus: string;          // aktiv | forsenad | paminnelser | sparrad
  faktura_epost: string | null;
  kontaktperson: string | null;
  anteckning: string | null;
  manadsvarde: number;
  har_stripe_kund: boolean;
  stripe_status: string | null;
  tokens: { anvant: number; tak: number } | null;
}

/**
 * Hela listan, ordnad efter hur nära nästa betalning ligger. Klienter UTAN avtal tas
 * med som tomma rader — annars blir en glömd kund osynlig, och det är precis den
 * kunden vyn ska hitta.
 */
export async function listaAvtal(): Promise<AvtalVy[]> {
  const sb = supabaseService();
  const [klienter, avtal, planer, prenumerationer, statusar, kunder, konton, inst] = await Promise.all([
    sb.from("clients").select("id, name, slug, primary_color, archived").order("name"),
    sb.from("billing_avtal").select("*"),
    sb.from("billing_plans").select("id, label, belopp_sek"),
    sb.from("billing_subscriptions").select("client_id, stripe_status, current_period_end, belopp_sek"),
    sb.from("billing_status").select("client_id, status"),
    sb.from("billing_customers").select("client_id"),
    sb.from("credit_accounts").select("tenant_id, monthly_quota, extra_credits, used_this_period"),
    import("./installningar").then((m) => m.hamtaInstallningar()),
  ]);

  const planKarta = new Map(
    ((planer.data || []) as Array<{ id: string; label: string; belopp_sek: number }>).map((p) => [p.id, p]),
  );
  const avtalKarta = new Map(((avtal.data || []) as AvtalRad[]).map((a) => [a.client_id, a]));
  const prenKarta = new Map(
    ((prenumerationer.data || []) as Array<{ client_id: string; stripe_status: string; current_period_end: string; belopp_sek: number }>)
      .map((s) => [s.client_id, s]),
  );
  const statusKarta = new Map(
    ((statusar.data || []) as Array<{ client_id: string; status: string }>).map((s) => [s.client_id, s.status]),
  );
  const kundSet = new Set(((kunder.data || []) as Array<{ client_id: string }>).map((k) => k.client_id));
  const kontoKarta = new Map(
    ((konton.data || []) as Array<{ tenant_id: string; monthly_quota: number; extra_credits: number; used_this_period: number }>)
      .map((k) => [k.tenant_id, k]),
  );

  const rader: AvtalVy[] = [];
  for (const k of (klienter.data || []) as Array<{ id: string; name: string; slug: string; primary_color: string; archived: boolean }>) {
    if (k.archived) continue;
    const a = avtalKarta.get(k.id);
    const plan = a?.plan_id ? planKarta.get(a.plan_id) || null : null;
    const pren = prenKarta.get(k.id);
    const intervall = (a?.intervall || "manad") as Intervall;

    const belopp = a ? periodbelopp(a, plan) : 0;

    // Stripe äger datumet när affären ligger där. Ett manuellt fält skulle bara kunna
    // vara inaktuellt i förhållande till vad kunden faktiskt debiteras.
    const nasta =
      a?.kalla === "stripe" && pren?.current_period_end
        ? pren.current_period_end.slice(0, 10)
        : a?.nasta_betalning || null;

    const konto = kontoKarta.get(k.id);

    rader.push({
      client_id: k.id,
      klient: k.name,
      slug: k.slug,
      primary_color: k.primary_color || "#1A6B3C",
      plan_id: a?.plan_id ?? null,
      plan_label: plan?.label ?? null,
      belopp_sek: belopp,
      belopp_inkl_moms: medMoms(belopp, inst.momssats),
      intervall,
      intervall_text: INTERVALL_TEXT[intervall],
      betalsatt: (a?.betalsatt || "faktura") as Betalsatt,
      betalsatt_text: BETALSATT_TEXT[(a?.betalsatt || "faktura") as Betalsatt],
      kalla: (a?.kalla || "manuell") as Kalla,
      startdatum: a?.startdatum ?? null,
      nasta_betalning: nasta,
      nasta_betalning_text: a ? nastaBetalningKlartext(nasta) : "Ingen affär registrerad",
      dagar_kvar: dagarTill(nasta),
      bindningstid_slut: a?.bindningstid_slut ?? null,
      status: (a?.status || "aktiv") as AvtalStatus,
      betalstatus: statusKarta.get(k.id) || "aktiv",
      faktura_epost: a?.faktura_epost ?? null,
      kontaktperson: a?.kontaktperson ?? null,
      anteckning: a?.anteckning ?? null,
      manadsvarde: a && a.status === "aktiv" ? manadsvarde(belopp, intervall) : 0,
      har_stripe_kund: kundSet.has(k.id),
      stripe_status: pren?.stripe_status ?? null,
      tokens: konto
        ? { anvant: konto.used_this_period, tak: konto.monthly_quota + konto.extra_credits }
        : null,
    });
  }

  // Registrerade affärer först, ordnade efter närmaste betalning. Kunder utan affär
  // hamnar sist — men de hamnar i listan, och det är poängen.
  rader.sort((a, b) => {
    const aHar = a.nasta_betalning ? 0 : 1;
    const bHar = b.nasta_betalning ? 0 : 1;
    if (aHar !== bHar) return aHar - bHar;
    if (a.nasta_betalning && b.nasta_betalning) return a.nasta_betalning.localeCompare(b.nasta_betalning);
    return a.klient.localeCompare(b.klient, "sv");
  });

  return rader;
}

export interface AvtalSammanfattning {
  mrr: number;
  arsvarde: number;
  antal_aktiva: number;
  antal_utan_affar: number;
  antal_forsenade: number;
  antal_sparrade: number;
  nasta_30_dagar: number;   // summa som förfaller inom 30 dagar
}

export function sammanfatta(rader: AvtalVy[]): AvtalSammanfattning {
  const aktiva = rader.filter((r) => r.status === "aktiv" && r.belopp_sek > 0);
  const mrr = aktiva.reduce((s, r) => s + r.manadsvarde, 0);
  return {
    mrr: Math.round(mrr),
    arsvarde: Math.round(mrr * 12),
    antal_aktiva: aktiva.length,
    antal_utan_affar: rader.filter((r) => !r.nasta_betalning && r.belopp_sek === 0).length,
    antal_forsenade: rader.filter((r) => r.betalstatus === "forsenad" || r.betalstatus === "paminnelser").length,
    antal_sparrade: rader.filter((r) => r.betalstatus === "sparrad").length,
    nasta_30_dagar: Math.round(
      aktiva
        .filter((r) => r.dagar_kvar !== null && r.dagar_kvar >= 0 && r.dagar_kvar <= 30)
        .reduce((s, r) => s + r.belopp_sek, 0),
    ),
  };
}

// ── Skrivning ───────────────────────────────────────────────────────────────

export interface SparaAvtalInput {
  client_id: string;
  plan_id?: string | null;
  belopp_sek?: number | null;
  intervall?: Intervall;
  betalsatt?: Betalsatt;
  startdatum?: string | null;
  nasta_betalning?: string | null;
  bindningstid_slut?: string | null;
  status?: AvtalStatus;
  faktura_epost?: string | null;
  kontaktperson?: string | null;
  anteckning?: string | null;
}

const INTERVALLER: Intervall[] = ["manad", "kvartal", "ar", "engang"];
const BETALSATT: Betalsatt[] = ["stripe", "faktura", "swish", "annat"];
const STATUSAR: AvtalStatus[] = ["aktiv", "pausad", "avslutad"];

export async function sparaAvtal(input: SparaAvtalInput): Promise<{ ok: boolean; fel?: string }> {
  if (!input.client_id) return { ok: false, fel: "Ingen kund vald." };

  const rad: Record<string, unknown> = { client_id: input.client_id };

  if (input.plan_id !== undefined) rad.plan_id = input.plan_id || null;
  if (input.belopp_sek !== undefined) {
    const b = Number(input.belopp_sek);
    rad.belopp_sek = Number.isFinite(b) && b > 0 ? b : null;
  }
  if (input.intervall && INTERVALLER.includes(input.intervall)) rad.intervall = input.intervall;
  if (input.betalsatt && BETALSATT.includes(input.betalsatt)) rad.betalsatt = input.betalsatt;
  if (input.status && STATUSAR.includes(input.status)) rad.status = input.status;

  for (const f of ["startdatum", "nasta_betalning", "bindningstid_slut"] as const) {
    if (input[f] !== undefined) rad[f] = input[f] || null;
  }
  for (const f of ["faktura_epost", "kontaktperson", "anteckning"] as const) {
    if (input[f] !== undefined) rad[f] = (input[f] || "").toString().trim() || null;
  }

  // Saknas nästa betalning men startdatum finns: räkna fram den. Håkan ska inte behöva
  // räkna månader i huvudet för att registrera en affär som redan rullat i ett halvår.
  if (!rad.nasta_betalning && input.startdatum) {
    const iv = (rad.intervall as Intervall) || "manad";
    rad.nasta_betalning = rullaFram(input.startdatum, iv);
  }

  try {
    const { error } = await supabaseService().from("billing_avtal").upsert(rad, { onConflict: "client_id" });
    if (error) return { ok: false, fel: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, fel: (e as Error).message };
  }
}

export async function raderaAvtal(clientId: string): Promise<boolean> {
  try {
    await supabaseService().from("billing_avtal").delete().eq("client_id", clientId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rullar fram passerade förfallodatum på manuella avtal. Körs av cron.
 *
 * Rör ALDRIG Stripe-avtal: där äger Stripe datumet, och att skriva över det här skulle
 * göra att vyn visar ett annat datum än det kunden faktiskt debiteras.
 */
export async function rullaFramForfallna(idag: string = iso(new Date())): Promise<number> {
  try {
    const sb = supabaseService();
    const { data } = await sb
      .from("billing_avtal")
      .select("client_id, nasta_betalning, intervall")
      .eq("kalla", "manuell")
      .eq("status", "aktiv")
      .neq("intervall", "engang")
      .lt("nasta_betalning", idag);

    const rader = (data || []) as Array<{ client_id: string; nasta_betalning: string; intervall: Intervall }>;
    for (const r of rader) {
      await sb
        .from("billing_avtal")
        .update({ nasta_betalning: rullaFram(r.nasta_betalning, r.intervall, idag) })
        .eq("client_id", r.client_id);
    }
    return rader.length;
  } catch (e) {
    console.error("[billing] kunde inte rulla fram förfallodatum:", (e as Error).message);
    return 0;
  }
}
