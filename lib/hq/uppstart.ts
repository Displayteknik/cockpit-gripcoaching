// START-1 — kontrollerna som mäter verkligheten bakom uppstartsstegen.
//
// Principen: ett steg får inte bockas av på känsla där systemet kan mäta. Kontrollen
// läser riktig data och svarar med en siffra i klartext. Modulen MÄTER bara, den skriver
// aldrig till MySales eller något annat system.
//
// ⚠ En kontroll som inte kan mätas ska säga det, inte gissa "uppfyllt". Ett falskt
// grönt är värre än ett ärligt "går inte att mäta än".

import { supabaseService } from "@/lib/supabase-admin";

export const KONTROLL_INTERVALL_MS = 10 * 60 * 1000;

/** Hur länge en affär i spel får stå stilla innan den räknas som kandidat att flytta. */
const STILLA_DAGAR = 60;

export type Kontrolltyp =
  | "pipeline_uppfoljningsdatum"
  | "pipeline_vunnet_steg"
  | "kunder_pipeline_finns"
  | "kostnad_belopp_saknas"
  | "abonnemangspris_saknas"
  | "banksaldo_saknas";

export interface KontrollSvar {
  kontrolltyp: Kontrolltyp;
  uppfyllt: boolean;
  text: string;
  matbar: boolean;   // false = systemet kan inte avgöra, då bockas steget av manuellt
}

const ental = (n: number, en: string, flera: string) => `${n} ${n === 1 ? en : flera}`;

/** Affärer i spel i den pipeline ägaren jobbar i. Samma urval som Founder HQ använder. */
async function affarerISpel() {
  const sb = supabaseService();
  const { data } = await sb
    .from("hq_pipeline_cache")
    .select("ghl_opportunity_id, harledd_status, uppfoljning_datum, steg_sedan, pipeline_id, location_id");
  const alla = (data as Array<{
    ghl_opportunity_id: string; harledd_status: string; uppfoljning_datum: string | null;
    steg_sedan: string | null; pipeline_id: string | null; location_id: string;
  }> | null) || [];
  if (!alla.length) return { alla: [], oppna: [], valda: new Set<string>() };

  // Samma pipelineurval som HQ: ägarens inställda pipeline, annars allt.
  const { hamtaValdaPipelines } = await import("@/lib/hq/pipeline");
  const valda = await hamtaValdaPipelines(alla[0].location_id);
  const iUrval = valda.size ? alla.filter((r) => r.pipeline_id && valda.has(r.pipeline_id)) : alla;
  return { alla: iUrval, oppna: iUrval.filter((r) => r.harledd_status === "open"), valda };
}

async function uppfoljningsdatum(): Promise<KontrollSvar> {
  const { oppna } = await affarerISpel();
  if (!oppna.length) {
    return {
      kontrolltyp: "pipeline_uppfoljningsdatum", matbar: true, uppfyllt: false,
      text: "Ingen pipeline hämtad än. Öppna Founder HQ och tryck Uppdatera nu.",
    };
  }
  const utan = oppna.filter((r) => !r.uppfoljning_datum).length;
  return {
    kontrolltyp: "pipeline_uppfoljningsdatum",
    matbar: true,
    uppfyllt: utan === 0,
    text: utan === 0
      ? `Alla ${ental(oppna.length, "affär", "affärer")} i spel har uppföljningsdatum.`
      : `${utan} av ${oppna.length} affärer saknar uppföljningsdatum.`,
  };
}

/**
 * ⚠ Systemet kan INTE veta vilken affär som är vunnen, bara vilken som står stilla.
 * Därför mäts kandidaterna: affärer i spel som inte rört sig på länge är de som
 * sannolikt redan är avgjorda men aldrig flyttades. Kontrollen påstår aldrig mer än så.
 */
async function vunnetSteg(): Promise<KontrollSvar> {
  const { alla, oppna } = await affarerISpel();
  if (!alla.length) {
    return { kontrolltyp: "pipeline_vunnet_steg", matbar: true, uppfyllt: false, text: "Ingen pipeline hämtad än." };
  }
  const grans = Date.now() - STILLA_DAGAR * 864e5;
  const stilla = oppna.filter((r) => r.steg_sedan && new Date(r.steg_sedan).getTime() < grans).length;
  const vunna = alla.filter((r) => r.harledd_status === "won").length;
  return {
    kontrolltyp: "pipeline_vunnet_steg",
    matbar: true,
    uppfyllt: stilla === 0,
    text: stilla === 0
      ? `${ental(vunna, "affär står", "affärer står")} i vinststeget och inget i spel har stått stilla i ${STILLA_DAGAR} dagar.`
      : `${stilla} av ${oppna.length} affärer i spel har inte rört sig på ${STILLA_DAGAR} dagar. De är kandidater att flytta till vunnet eller förlorat.`,
  };
}

/** Kräver att Grip-locationen är kopplad. Är den inte det går det inte att mäta. */
async function kunderPipeline(): Promise<KontrollSvar> {
  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("id, name, ghl_location_id, ghl_pit")
    .ilike("name", "GripCoaching")
    .maybeSingle();
  const rad = data as { ghl_location_id: string | null; ghl_pit: string | null } | null;
  if (!rad?.ghl_location_id || !rad?.ghl_pit) {
    return {
      kontrolltyp: "kunder_pipeline_finns", matbar: false, uppfyllt: false,
      text: "Grip-locationen är inte kopplad i plattformen än, så pipelinen går inte att kontrollera härifrån.",
    };
  }
  try {
    const r = await fetch(`https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${rad.ghl_location_id}`, {
      headers: { Authorization: `Bearer ${rad.ghl_pit}`, Version: "2021-07-28", Accept: "application/json" },
    });
    if (!r.ok) {
      return { kontrolltyp: "kunder_pipeline_finns", matbar: false, uppfyllt: false, text: `MySales svarade ${r.status}, kunde inte läsa pipelinerna.` };
    }
    const d = (await r.json()) as { pipelines?: Array<{ name?: string; stages?: unknown[] }> };
    const kunder = (d.pipelines || []).find((p) => (p.name || "").trim().toLowerCase() === "kunder");
    return {
      kontrolltyp: "kunder_pipeline_finns",
      matbar: true,
      uppfyllt: !!kunder,
      text: kunder
        ? `Pipelinen Kunder finns med ${ental((kunder.stages || []).length, "steg", "steg")}.`
        : "Pipelinen Kunder finns inte i Grip-locationen än.",
    };
  } catch (e) {
    return { kontrolltyp: "kunder_pipeline_finns", matbar: false, uppfyllt: false, text: `Kunde inte nå MySales: ${(e as Error).message}` };
  }
}

async function kostnadBelopp(): Promise<KontrollSvar> {
  const { data } = await supabaseService().from("hq_fasta_kostnader").select("tjanst, belopp_per_man");
  const rader = (data as Array<{ tjanst: string; belopp_per_man: number | string }> | null) || [];
  const utan = rader.filter((r) => Number(r.belopp_per_man) === 0);
  return {
    kontrolltyp: "kostnad_belopp_saknas",
    matbar: true,
    uppfyllt: utan.length === 0,
    text: utan.length === 0
      ? `Alla ${ental(rader.length, "kostnadspost har", "kostnadsposter har")} belopp.`
      : `${utan.length} av ${rader.length} kostnadsposter saknar belopp: ${utan.map((r) => r.tjanst).join(", ")}.`,
  };
}

async function banksaldo(): Promise<KontrollSvar> {
  const { data } = await supabaseService().from("hq_bank_saldo").select("bolag");
  const bolag = new Set(((data as Array<{ bolag: string }> | null) || []).map((r) => r.bolag));
  const saknas = ["grip", "dt"].filter((b) => !bolag.has(b));
  const namn: Record<string, string> = { grip: "GripCoaching", dt: "Displayteknik" };
  return {
    kontrolltyp: "banksaldo_saknas",
    matbar: true,
    uppfyllt: saknas.length === 0,
    text: saknas.length === 0
      ? "Banksaldo finns för båda bolagen."
      : `Banksaldo saknas för ${saknas.map((b) => namn[b]).join(" och ")}. Utan det räknas ingen prognos.`,
  };
}

/**
 * Ett abonnemangspris saknas när en klient som faktiskt förbrukar AI inte har någon
 * aktiv intäktsrad. Just då går marginalen inte att räkna, och det är hela poängen
 * med steget. Klienter utan förbrukning räknas inte, de behöver inget pris än.
 */
async function abonnemangspris(): Promise<KontrollSvar> {
  const sb = supabaseService();
  const nu = new Date();
  const manadStart = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1)).toISOString();
  const [{ data: klientData }, { data: mrrData }, { data: handelseData }] = await Promise.all([
    sb.from("clients").select("id, name"),
    sb.from("hq_mrr_entries").select("kund, client_id, status"),
    sb.from("ai_usage_events").select("tenant_id").gte("created_at", manadStart).limit(20000),
  ]);
  const klienter = ((klientData as Array<{ id: string; name: string }> | null) || []);
  const aktiva = ((mrrData as Array<{ kund: string; client_id: string | null; status: string }> | null) || [])
    .filter((r) => r.status === "aktiv");

  // Samma koppling som marginalvyn: kopplad rad först, exakt namnmatchning som reserv.
  const medPris = new Set<string>();
  for (const r of aktiva) {
    const id = r.client_id || klienter.find((c) => c.name.trim().toLowerCase() === r.kund.trim().toLowerCase())?.id;
    if (id) medPris.add(id);
  }
  const forbrukar = new Set(
    ((handelseData as Array<{ tenant_id: string | null }> | null) || []).map((h) => h.tenant_id).filter((v): v is string => !!v),
  );
  const utan = [...forbrukar].filter((id) => !medPris.has(id));
  return {
    kontrolltyp: "abonnemangspris_saknas",
    matbar: true,
    uppfyllt: utan.length === 0,
    text: utan.length === 0
      ? forbrukar.size === 0
        ? "Ingen klient har förbrukat något den här månaden än."
        : `Alla ${ental(forbrukar.size, "klient som förbrukar har", "klienter som förbrukar har")} ett pris.`
      : `${utan.length} av ${forbrukar.size} klienter som förbrukar saknar abonnemangspris: ${utan.map((id) => klienter.find((c) => c.id === id)?.name || "okänd").join(", ")}.`,
  };
}

const KORARE: Record<Kontrolltyp, () => Promise<KontrollSvar>> = {
  pipeline_uppfoljningsdatum: uppfoljningsdatum,
  pipeline_vunnet_steg: vunnetSteg,
  kunder_pipeline_finns: kunderPipeline,
  kostnad_belopp_saknas: kostnadBelopp,
  abonnemangspris_saknas: abonnemangspris,
  banksaldo_saknas: banksaldo,
};

/**
 * Kör alla kontroller och sparar resultaten. Högst var tionde minut, samma mönster som
 * pipeline-synken. En kontroll som kastar tar aldrig med sig de andra.
 */
export async function koraKontroller(tvinga = false): Promise<void> {
  const sb = supabaseService();
  const { data } = await sb.from("hq_uppstart_kontroll").select("id, steg_id, kontrolltyp, senast_kord");
  const rader = (data as Array<{ id: string; steg_id: string; kontrolltyp: Kontrolltyp; senast_kord: string | null }> | null) || [];
  const nu = Date.now();

  await Promise.all(rader.map(async (rad) => {
    if (!tvinga && rad.senast_kord && nu - new Date(rad.senast_kord).getTime() < KONTROLL_INTERVALL_MS) return;
    const korare = KORARE[rad.kontrolltyp];
    if (!korare) return;
    let svar: KontrollSvar;
    try {
      svar = await korare();
    } catch (e) {
      svar = { kontrolltyp: rad.kontrolltyp, matbar: false, uppfyllt: false, text: `Kontrollen kunde inte köras: ${(e as Error).message}` };
    }
    await sb.from("hq_uppstart_kontroll")
      .update({ senast_kord: new Date().toISOString(), resultat_text: svar.text, uppfyllt: svar.uppfyllt })
      .eq("id", rad.id);
  }));
}
