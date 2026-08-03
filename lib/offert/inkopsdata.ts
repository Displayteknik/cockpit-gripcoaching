// OFFERT-2 / O-1b — uppslag mot inköpsdatabasen. Server-only (service-role).
//
// ★ EN KÄLLA. Både katalogvyn och offertbyggaren går genom `slaUpp()`. Skulle de två räkna
// landad kostnad var för sig kan de gå isär, och då är siffran i offerten inte längre den man
// tittade på i katalogen. Samma princip som lib/inkop/index.ts har i K3.
//
// Vad funktionerna här ALDRIG gör:
//   • fyller tomma fraktpriser med uppskattningar (saknas = saknas)
//   • räknar om till ett antal leverantören inte offererat
//   • räknar om till SEK eller lägger på marginal (det är O-2, och kräver kurs + påslagsregel)
//   • slår upp på modellnummer (TOPWK-0043 finns på tre olika produkter)

import { supabaseService } from "../supabase-admin";
import { FRAKTSATT, FRAKTSATT_ETIKETT, type Fraktsatt, type TolkatResultat } from "./xlsx-import";

export { FRAKTSATT, FRAKTSATT_ETIKETT };
export type { Fraktsatt };

/** Prislistorna anger 15 dagars giltighet — men saknar tryckt datum (avvikelse 6). */
export const GILTIGHET_DAGAR = 15;

export type Flagganiva = "blockerande" | "varning" | "info";

export interface Flagga {
  kod: string;
  niva: Flagganiva;
  text: string;
}

export interface Prisbok {
  id: string;
  kallfil: string;
  kallfil_sha256: string;
  importerad_at: string;
  radantal: Record<string, number> | null;
}

export interface Produkt {
  produktnyckel: string;
  leverantor: string;
  modellnr: string | null;
  produktnamn: string;
  produkttyp: string | null;
  storlek: string | null;
  ljusstyrka: string | null;
  miljo: string | null;
  ledtid: string | null;
  moq: number | null;
  garanti: string | null;
  prisandring: string | null;
  kallfil: string | null;
  kalla_rad: number;
}

export interface Fraktalternativ {
  fraktsatt: Fraktsatt;
  etikett: string;
  frakt_styck: number;
  landat_styck: number;
  landat_order: number;
  kalla: string;
}

export interface Uppslag {
  typ: "uppslag";
  produkt: Produkt | null;
  produktnyckel: string;
  antal: number;
  trappa_id: string;
  exw_styck: number;
  exw_order: number;
  valuta: string;
  incoterm: string;
  ledtid: string | null;
  alternativ: Fraktalternativ[];
  saknade: { fraktsatt: Fraktsatt; etikett: string }[];
  billigast: Fraktalternativ | null;
  trappor: number[];
  kalla: string;
  flaggor: Flagga[];
}

export interface TrappaSaknas {
  typ: "trappa_saknas";
  produktnyckel: string;
  begart_antal: number;
  trappor: number[];
  text: string;
}

export interface ProduktSaknas {
  typ: "produkt_saknas";
  produktnyckel: string;
  text: string;
}

export type UppslagSvar = Uppslag | TrappaSaknas | ProduktSaknas;

// ── läsning ──────────────────────────────────────────────────────────────────

export async function hamtaAktivPrisbok(clientId: string): Promise<Prisbok | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("offert_inkop_prisbok")
    .select("id, kallfil, kallfil_sha256, importerad_at, radantal")
    .eq("client_id", clientId)
    .eq("aktiv", true)
    .maybeSingle();
  return (data as Prisbok | null) ?? null;
}

export async function listaPrisbocker(clientId: string) {
  const sb = supabaseService();
  const { data } = await sb
    .from("offert_inkop_prisbok")
    .select("id, kallfil, kallfil_sha256, importerad_at, aktiv, radantal, notering")
    .eq("client_id", clientId)
    .order("importerad_at", { ascending: false })
    .limit(50);
  return data || [];
}

const PRODUKTFALT =
  "produktnyckel, leverantor, modellnr, produktnamn, produkttyp, storlek, ljusstyrka, miljo, ledtid, moq, garanti, prisandring, kallfil, kalla_rad";

/**
 * Söker i den aktiva prisboken. Fritexten matchas mot namn, nyckel, storlek, ljusstyrka och
 * miljö — alltså precis de fält man matchar kundens behov mot. Modellnr är sökbart men aldrig
 * en identifierare.
 */
export async function sokProdukter(
  clientId: string,
  opt: { q?: string; miljo?: string; storlek?: string; limit?: number } = {},
): Promise<{ prisbok: Prisbok | null; produkter: Produkt[] }> {
  const prisbok = await hamtaAktivPrisbok(clientId);
  if (!prisbok) return { prisbok: null, produkter: [] };
  const sb = supabaseService();
  let fraga = sb
    .from("offert_inkop_produkt")
    .select(PRODUKTFALT)
    .eq("client_id", clientId)
    .eq("prisbok_id", prisbok.id)
    .order("produktnyckel")
    .limit(opt.limit ?? 200);
  if (opt.miljo) fraga = fraga.ilike("miljo", `%${opt.miljo}%`);
  if (opt.storlek) fraga = fraga.ilike("storlek", `%${opt.storlek}%`);
  const { data } = await fraga;
  let produkter = (data as Produkt[] | null) || [];
  const q = (opt.q || "").trim().toLowerCase();
  if (q) {
    const ord = q.split(/\s+/);
    produkter = produkter.filter((p) => {
      const hö = [p.produktnamn, p.produktnyckel, p.modellnr, p.storlek, p.ljusstyrka, p.miljo, p.produkttyp]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return ord.every((o) => hö.includes(o));
    });
  }
  return { prisbok, produkter };
}

interface TrappRad {
  id: string;
  produktnyckel: string;
  antal: number;
  exw_styck: number | string;
  valuta: string;
  incoterm: string;
  ledtid: string | null;
  notering: string | null;
  kalla_rad: number;
}

/**
 * Slår upp landad kostnad för en produkt vid ett antal.
 * Finns inte antalet som offererad trappa returneras `trappa_saknas` med de trappor som finns —
 * aldrig en omräkning. Både produktpris och frakt per styck ändras med volymen på ett sätt bara
 * leverantören kan bekräfta.
 */
export async function slaUpp(clientId: string, produktnyckel: string, antal: number): Promise<UppslagSvar> {
  const prisbok = await hamtaAktivPrisbok(clientId);
  if (!prisbok) return { typ: "produkt_saknas", produktnyckel, text: "Ingen inköpsdatabas är importerad än." };
  const sb = supabaseService();

  const [{ data: trappRader }, { data: produktRad }] = await Promise.all([
    sb
      .from("offert_inkop_trappa")
      .select("id, produktnyckel, antal, exw_styck, valuta, incoterm, ledtid, notering, kalla_rad")
      .eq("client_id", clientId)
      .eq("prisbok_id", prisbok.id)
      .eq("produktnyckel", produktnyckel)
      .order("antal"),
    sb
      .from("offert_inkop_produkt")
      .select(PRODUKTFALT)
      .eq("client_id", clientId)
      .eq("prisbok_id", prisbok.id)
      .eq("produktnyckel", produktnyckel)
      .maybeSingle(),
  ]);

  const trappor = ((trappRader as TrappRad[] | null) || []).map((t) => ({ ...t, exw_styck: Number(t.exw_styck) }));
  if (!trappor.length) {
    return {
      typ: "produkt_saknas",
      produktnyckel,
      text: `"${produktnyckel}" finns inte i den aktiva prisboken (${prisbok.kallfil}).`,
    };
  }

  const trappa = trappor.find((t) => t.antal === antal);
  if (!trappa) {
    const lista = trappor.map((t) => t.antal);
    return {
      typ: "trappa_saknas",
      produktnyckel,
      begart_antal: antal,
      trappor: lista,
      text:
        `Leverantören har offererat ${lista.join(" eller ")} st, inte ${antal} st. ` +
        "Priset räknas inte om — både produktpris och frakt per styck ändras med volymen. " +
        "Välj en offererad trappa eller begär ny offert från leverantören.",
    };
  }

  const { data: fraktRader } = await sb
    .from("offert_inkop_frakt")
    .select("fraktsatt, frakt_styck, kalla_kolumn")
    .eq("trappa_id", trappa.id);

  const alternativ: Fraktalternativ[] = ((fraktRader as { fraktsatt: Fraktsatt; frakt_styck: number | string; kalla_kolumn: string }[] | null) || [])
    .map((f) => {
      const frakt = Number(f.frakt_styck);
      const landat = trappa.exw_styck + frakt;
      return {
        fraktsatt: f.fraktsatt,
        etikett: FRAKTSATT_ETIKETT[f.fraktsatt],
        frakt_styck: frakt,
        landat_styck: landat,
        landat_order: landat * trappa.antal,
        kalla: `Fraktkalkyl!${f.kalla_kolumn}${trappa.kalla_rad}`,
      };
    })
    .sort((a, b) => a.landat_styck - b.landat_styck || FRAKTSATT.indexOf(a.fraktsatt) - FRAKTSATT.indexOf(b.fraktsatt));

  const har = new Set(alternativ.map((a) => a.fraktsatt));
  const saknade = FRAKTSATT.filter((f) => !har.has(f)).map((f) => ({ fraktsatt: f, etikett: FRAKTSATT_ETIKETT[f] }));

  const produkt = (produktRad as Produkt | null) ?? null;

  return {
    typ: "uppslag",
    produkt,
    produktnyckel,
    antal: trappa.antal,
    trappa_id: trappa.id,
    exw_styck: trappa.exw_styck,
    exw_order: trappa.exw_styck * trappa.antal,
    valuta: trappa.valuta,
    incoterm: trappa.incoterm,
    ledtid: trappa.ledtid,
    alternativ,
    saknade,
    billigast: alternativ[0] ?? null,
    trappor: trappor.map((t) => t.antal),
    kalla: `Fraktkalkyl rad ${trappa.kalla_rad} (EXW i E${trappa.kalla_rad})`,
    flaggor: byggFlaggor({ trappa, produkt, alternativ, saknade, prisbok }),
  };
}

// ── flaggor ──────────────────────────────────────────────────────────────────

/**
 * Avvikelserna står redan i filen — i notkolumnen per rad, i ljusstyrketexten, i att
 * fraktceller är tomma. Därför härleds de här i stället för att hårdkodas. Uppdateras filen
 * följer flaggorna med av sig själva.
 */
export function byggFlaggor(
  inn: {
    trappa: { antal: number; notering: string | null; kalla_rad: number };
    produkt: Produkt | null;
    alternativ: Fraktalternativ[];
    saknade: { fraktsatt: Fraktsatt; etikett: string }[];
    prisbok: { kallfil: string; importerad_at: string };
  },
  nu: Date = new Date(),
): Flagga[] {
  const f: Flagga[] = [];

  if (!inn.alternativ.length) {
    f.push({
      kod: "frakt_saknas_helt",
      niva: "blockerande",
      text:
        "Leverantören har inte offererat något fraktsätt för den här produkten och det här antalet. " +
        "Kostnaden går inte att räkna fram — begär offert. (För 65 och 86 tum utomhus finns bara en gemensam fraktsumma för båda skärmarna, se fliken Prislistedata.)",
    });
  } else if (inn.saknade.length) {
    f.push({
      kod: "frakt_saknas_delvis",
      niva: "info",
      text: `Fraktpris saknas för ${inn.saknade.map((s) => s.etikett).join(", ")}. De går inte att välja — begär offert om något av dem behövs.`,
    });
  }

  if (inn.trappa.notering) {
    f.push({
      kod: "leverantorsnot",
      niva: "varning",
      text: `Not i prislistan (Fraktkalkyl rad ${inn.trappa.kalla_rad}): ${inn.trappa.notering}`,
    });
  }

  const ljus = inn.produkt?.ljusstyrka;
  if (ljus && !/^\d+$/.test(ljus.trim())) {
    f.push({
      kod: "ljusstyrka_tvetydig",
      niva: "varning",
      text: `Ljusstyrkan står som "${ljus}" i underlaget. Klarlägg med leverantören innan siffran används mot kund.`,
    });
  }

  if (inn.produkt?.prisandring) {
    f.push({ kod: "prisandring", niva: "info", text: `Priset har ändrats: ${inn.produkt.prisandring}` });
  }

  // Prislistorna anger 15 dagars giltighet men saknar tryckt datum. Vi varnar utifrån när
  // underlaget importerades — det enda datum vi faktiskt vet — och säger att vi gör så.
  const dagar = Math.floor((nu.getTime() - new Date(inn.prisbok.importerad_at).getTime()) / 86_400_000);
  if (Number.isFinite(dagar) && dagar > GILTIGHET_DAGAR) {
    f.push({
      kod: "underlagets_alder",
      niva: "varning",
      text:
        `Underlaget (${inn.prisbok.kallfil}) importerades för ${dagar} dagar sedan. Prislistorna anger ${GILTIGHET_DAGAR} dagars giltighet ` +
        "men saknar tryckt datum — begär bekräftelse från leverantören före bindande offert.",
    });
  }

  return f;
}

/** Modellnummer som delas av flera produktnycklar i prisboken. Bekräftar att uppslag på modellnr vore fel. */
export async function delademodellnr(clientId: string): Promise<Record<string, string[]>> {
  const prisbok = await hamtaAktivPrisbok(clientId);
  if (!prisbok) return {};
  const sb = supabaseService();
  const { data } = await sb
    .from("offert_inkop_produkt")
    .select("produktnyckel, modellnr")
    .eq("client_id", clientId)
    .eq("prisbok_id", prisbok.id);
  const per: Record<string, string[]> = {};
  for (const r of (data as { produktnyckel: string; modellnr: string | null }[] | null) || []) {
    if (!r.modellnr) continue;
    (per[r.modellnr] ||= []).push(r.produktnyckel);
  }
  return Object.fromEntries(Object.entries(per).filter(([, v]) => v.length > 1));
}

// ── skrivning (bara importen) ────────────────────────────────────────────────

/**
 * Skriver en tolkad fil som en NY prisbok och gör den aktiv. Den gamla ligger kvar — sparade
 * offerter pekar på den prisbok de prissattes ur.
 *
 * Ordningen är medveten: allt innehåll skrivs klart innan aktiv-flaggan flyttas, så ett uppslag
 * kan aldrig träffa en halvskriven prisbok. Det partiella unika indexet tillåter bara en aktiv
 * per klient, därför nollställs den gamla först.
 */
export async function sparaPrisbok(
  clientId: string,
  tolkat: TolkatResultat,
  kallfil: string,
  storagePath: string | null,
): Promise<{ prisbokId: string }> {
  const sb = supabaseService();

  const { data: prisbok, error: pErr } = await sb
    .from("offert_inkop_prisbok")
    .insert({
      client_id: clientId,
      kallfil,
      kallfil_sha256: tolkat.sha256,
      storage_path: storagePath,
      aktiv: false,
      radantal: tolkat.radantal,
    })
    .select("id")
    .single();
  if (pErr || !prisbok) throw new Error("Kunde inte skapa prisboken: " + (pErr?.message || "okänt fel"));
  const prisbokId = prisbok.id as string;

  const stad = async (msg: string): Promise<never> => {
    await sb.from("offert_inkop_prisbok").delete().eq("id", prisbokId); // barnen faller med cascade
    throw new Error(msg);
  };

  const { error: prodErr } = await sb.from("offert_inkop_produkt").insert(
    tolkat.produkter.map((p) => ({ ...p, prisbok_id: prisbokId, client_id: clientId })),
  );
  if (prodErr) return stad("Kunde inte spara produkterna: " + prodErr.message);

  const { data: trappRader, error: tErr } = await sb
    .from("offert_inkop_trappa")
    .insert(
      tolkat.trappor.map((t) => ({
        prisbok_id: prisbokId,
        client_id: clientId,
        produktnyckel: t.produktnyckel,
        modellnr: t.modellnr,
        produkt: t.produkt,
        antal: t.antal,
        exw_styck: t.exw_styck,
        ledtid: t.ledtid,
        prislista_datum: t.prislista_datum,
        kallfil: t.kallfil,
        notering: t.notering,
        kalla_rad: t.kalla_rad,
      })),
    )
    .select("id, produktnyckel, antal");
  if (tErr || !trappRader) return stad("Kunde inte spara kvantitetstrapporna: " + (tErr?.message || "okänt fel"));

  const idFor = new Map(trappRader.map((t) => [`${t.produktnyckel}|${t.antal}`, t.id as string]));
  const fraktRader = tolkat.trappor.flatMap((t) => {
    const id = idFor.get(`${t.produktnyckel}|${t.antal}`);
    if (!id) return [];
    return t.frakt.map((f) => ({ trappa_id: id, client_id: clientId, fraktsatt: f.fraktsatt, frakt_styck: f.frakt_styck, kalla_kolumn: f.kalla_kolumn }));
  });
  if (fraktRader.length) {
    const { error: fErr } = await sb.from("offert_inkop_frakt").insert(fraktRader);
    if (fErr) return stad("Kunde inte spara fraktpriserna: " + fErr.message);
  }

  if (tolkat.prislistedata.length) {
    const { error: plErr } = await sb.from("offert_inkop_prislistedata").insert(
      tolkat.prislistedata.map((p) => ({ ...p, prisbok_id: prisbokId, client_id: clientId })),
    );
    if (plErr) return stad("Kunde inte spara revisionsspåret: " + plErr.message);
  }

  await sb.from("offert_inkop_prisbok").update({ aktiv: false }).eq("client_id", clientId).eq("aktiv", true);
  const { error: aErr } = await sb.from("offert_inkop_prisbok").update({ aktiv: true }).eq("id", prisbokId);
  if (aErr) throw new Error("Prisboken sparades men kunde inte aktiveras: " + aErr.message);

  return { prisbokId };
}
