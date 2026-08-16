import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GRANSKNINGSVY av säljlagret (PRIS-1, tabellerna sl_*) som byggdes i MySales Coach.
//
// LÄSER BARA. Ingen rad skrivs, ingen kalkyl körs om här. Kalkylmotorn och agenten
// bor i MySales Coach; Cockpit visar resultatet så att Håkan kan granska läget och
// se vad som saknas innan något går skarpt.
//
// Tenant-nyckeln är MySales Coachs `coach_users.id`, INTE Cockpits `client_id`.
// De två id-rymderna är olika och får aldrig blandas ihop.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";
const PRIS_URL = process.env.SALJLAGER_PRISSIDA || "https://displayteknik.se/pris";
const MARKNAD_GILTIG_DAGAR = 30;

type Lucka = { allvar: "hog" | "medel" | "info"; omrade: string; text: string };

/** Hämtar publika belopp ur en sida, inklusive JSON-LD. Samma regel som kontrollscriptet. */
function beloppPaSidan(html: string): Map<number, number> {
  const schema = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .join(" ");
  const text = (
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ") +
    " " +
    schema
  )
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const funna = new Map<number, number>();
  for (const m of text.matchAll(/(\d{1,3}(?:[\s  ]\d{3})+|\d{3,7})\s*(?:kr|SEK)/gi)) {
    const tal = Number(String(m[1]).replace(/[^\d]/g, ""));
    if (tal >= 100) funna.set(tal, (funna.get(tal) || 0) + 1);
  }
  return funna;
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = supabaseService();
  const kollaSajten = new URL(req.url).searchParams.get("sajt") !== "0";

  const [priser, volym, texter, kopplingar, golv, flaggor, konkurrenter, marknad, artiklar, alKopplingar, datablad, artikelTillval] = await Promise.all([
    sb.from("sl_prices").select("*").eq("user_id", TENANT).eq("gallande", true).order("kategori").order("artikelnr"),
    sb.from("sl_volym").select("*").eq("user_id", TENANT).eq("gallande", true).order("min_antal"),
    sb.from("sl_texter").select("*").eq("user_id", TENANT).eq("gallande", true).order("typ").order("sortering"),
    sb.from("sl_inkop_koppling").select("*").eq("user_id", TENANT),
    sb.from("sl_golv").select("kategori, golv_pct").eq("user_id", TENANT),
    sb.from("sl_flaggor").select("artikelnr, typ, allvar, text, skapad_at").eq("user_id", TENANT).is("atgardad_at", null),
    sb.from("sl_konkurrenter").select("namn, webb, typ, aktiv").eq("user_id", TENANT).order("namn"),
    sb
      .from("om_market_prices")
      .select("category, competitor, price_sek, source_url, fetched_at, notering")
      .eq("user_id", TENANT)
      .gte("fetched_at", new Date(Date.now() - MARKNAD_GILTIG_DAGAR * 864e5).toISOString()),
    // PRIS2-1: artikellagret (al_*). Nytt lager mellan säljlagret och inköpslistan,
    // byggt 15/8. Läses här ihop med det gamla för att granskningsvyn ska se allt.
    sb.from("al_artiklar").select("*").eq("user_id", TENANT).order("artikelnummer"),
    sb.from("al_leverantorskoppling").select("artikel_id, produktnyckel, bekraftad, notering").eq("user_id", TENANT),
    sb.from("al_datablad").select("artikel_id, titel, file_path, sprak").eq("user_id", TENANT),
    sb.from("al_artikel_tillval").select("artikel_id, sl_artikelnr").eq("user_id", TENANT),
  ]);

  // Säljlagret finns inte i den här databasen om migrationerna inte körts.
  if (priser.error) {
    return NextResponse.json(
      { fel: `Kunde inte läsa säljlagret: ${priser.error.message}`, byggt: false },
      { status: 200 },
    );
  }

  const rader = priser.data || [];
  const luckor: Lucka[] = [];

  // 1. Sidan mot säljlagret.
  let sajt: { url: string; status: number | null; saknasPaSidan: string[]; utanTackning: number[] } | null = null;
  if (kollaSajten) {
    try {
      const styr = AbortSignal.timeout(8000);
      const svar = await fetch(PRIS_URL, { signal: styr, headers: { "user-agent": "Cockpit-priskontroll/1.0" } });
      const html = svar.ok ? await svar.text() : "";
      const funna = beloppPaSidan(html);
      const publika = rader.filter((p) => p.synlighet === "publik" && p.pris != null);
      const saknasPaSidan = publika.filter((p) => !funna.has(Number(p.pris))).map((p) => p.artikelnr);
      const kanda = new Set(publika.map((p) => Number(p.pris)));
      const utanTackning = [...funna.keys()].filter((t) => !kanda.has(t) && t >= 1000).sort((a, b) => a - b);
      sajt = { url: PRIS_URL, status: svar.status, saknasPaSidan, utanTackning };

      for (const a of saknasPaSidan) {
        const p = rader.find((r) => r.artikelnr === a)!;
        luckor.push({
          allvar: "hog",
          omrade: "Prissidan",
          text: `${p.benamning} kostar ${Number(p.pris).toLocaleString("sv-SE")} ${p.enhet} i säljlagret, men det beloppet står inte på prissidan.`,
        });
      }
      // Ett volympris som bara får lämnas i offert är allvarligare än ett okänt belopp.
      // Det ska namnges för sig, annars drunknar det i listan.
      const hemliga = (volym.data || []).filter((v) => v.synlighet === "offert_endast");
      const lackta = new Set<number>();
      for (const v of hemliga) {
        if (funna.has(Number(v.pris))) {
          lackta.add(Number(v.pris));
          luckor.push({
            allvar: "hog",
            omrade: "Prissidan",
            text: `Prissidan visar ${Number(v.pris).toLocaleString("sv-SE")} kr. Det är volympriset för ${v.artikelnr} och får enligt prislistan bara lämnas i offert.`,
          });
        }
      }
      for (const t of utanTackning) {
        if (lackta.has(t)) continue;
        luckor.push({
          allvar: "hog",
          omrade: "Prissidan",
          text: `Prissidan visar ${t.toLocaleString("sv-SE")} kr, ett belopp som inte finns som publikt pris i säljlagret.`,
        });
      }
    } catch {
      sajt = { url: PRIS_URL, status: null, saknasPaSidan: [], utanTackning: [] };
      luckor.push({ allvar: "info", omrade: "Prissidan", text: "Prissidan gick inte att läsa just nu, jämförelsen hoppades över." });
    }
  }

  // 2. Kopplingar, kalkyl och marginal per artikel. Två källor för koppling till inköp:
  // den gamla sl_inkop_koppling (P-2, pekar på om_prices.sku) och den nya al_leverantorskoppling
  // (PRIS2-1, pekar på al_artiklar via katalog_kod → om_prices.produktnyckel). Slås ihop här så
  // en artikel som bara finns i den nya vägen inte felaktigt visas som "ingen inköpsdata".
  const artikelByNummer = new Map((artiklar.data || []).map((a) => [a.artikelnummer, a]));
  const alKoppFor = (katalogKod: string | null) =>
    !katalogKod ? [] : (alKopplingar.data || [])
      .filter((k) => artikelByNummer.get(katalogKod)?.id === k.artikel_id)
      .map((k) => ({ kalla: "al_leverantorskoppling", nyckel: k.produktnyckel, bekraftad: k.bekraftad, notering: k.notering }));
  const koppFor = (a: string, katalogKod: string | null) => [
    ...(kopplingar.data || []).filter((k) => k.artikelnr === a),
    ...alKoppFor(katalogKod),
  ];
  const marknadFor = (a: string) => (marknad.data || []).filter((m) => m.category === a);

  for (const p of rader) {
    const kopp = koppFor(p.artikelnr, p.katalog_kod);
    if (!kopp.length) {
      luckor.push({
        allvar: "hog",
        omrade: "Inköpsdata",
        text: `${p.benamning} har ingen koppling till inköpslagret. Kalkylen kan inte köras och marginalen är okänd.`,
      });
    } else if (kopp.every((k) => !k.bekraftad)) {
      luckor.push({
        allvar: "medel",
        omrade: "Inköpsdata",
        text: `Kopplingen för ${p.benamning} är obekräftad (${kopp.map((k) => k.nyckel).join(", ")}). Kalkylen kan gälla fel skärm.`,
      });
    }
    if (p.tb_pct == null && kopp.length) {
      luckor.push({
        allvar: "info",
        omrade: "Beslut",
        text: `${p.benamning} har aldrig godkänts mot en kalkyl. Priset kommer ur standardprislistan, inte ur ett räknat beslut.`,
      });
    }
    const mark = marknadFor(p.artikelnr);
    if (!mark.length) {
      luckor.push({ allvar: "medel", omrade: "Marknad", text: `Ingen marknadsbild finns för ${p.benamning} de senaste ${MARKNAD_GILTIG_DAGAR} dagarna.` });
    } else if (!mark.some((m) => m.price_sek != null)) {
      luckor.push({
        allvar: "info",
        omrade: "Marknad",
        text: `Marknadsbilden för ${p.benamning} är körd men ingen konkurrent publicerar ett jämförbart pris.`,
      });
    }
    // Publika rader som inte skrivs till assistentens kunskapsbas.
    if (p.synlighet === "publik" && !["skyltfonster", "tillval"].includes(p.kategori)) {
      luckor.push({
        allvar: "medel",
        omrade: "Kunskapsbas",
        text: `${p.benamning} är publik men skrivs inte till assistentens prisfil. Generatorn täcker bara skyltfönster och tillval.`,
      });
    }
  }

  // 3. Vaktens öppna flaggor.
  for (const f of flaggor.data || []) {
    luckor.push({ allvar: f.allvar === "stopp" ? "hog" : f.allvar === "info" ? "info" : "medel", omrade: "Marginalvakten", text: f.text });
  }

  const ordning = { hog: 0, medel: 1, info: 2 } as const;
  luckor.sort((a, b) => ordning[a.allvar] - ordning[b.allvar]);

  return NextResponse.json({
    byggt: true,
    tenant: TENANT,
    hamtad: new Date().toISOString(),
    priser: rader.map((p) => ({
      artikelnr: p.artikelnr,
      benamning: p.benamning,
      kategori: p.kategori,
      prismodell: p.prismodell,
      pris: p.pris != null ? Number(p.pris) : null,
      enhet: p.enhet,
      fran_pris: p.fran_pris,
      synlighet: p.synlighet,
      version: p.version,
      giltig_fran: p.giltig_fran,
      motivering: p.motivering,
      noteringar: p.noteringar,
      tb_pct: p.tb_pct != null ? Number(p.tb_pct) : null,
      kalla: p.kalla,
      beslut_av: p.beslut_av,
      volymtrappa: (volym.data || []).filter((v) => v.artikelnr === p.artikelnr),
      kopplingar: koppFor(p.artikelnr, p.katalog_kod),
      marknad: marknadFor(p.artikelnr),
      flaggor: (flaggor.data || []).filter((f) => f.artikelnr === p.artikelnr),
      artikellager: p.katalog_kod ? artikelByNummer.get(p.katalog_kod) || null : null,
    })),
    texter: texter.data || [],
    golv: golv.data || [],
    konkurrenter: konkurrenter.data || [],
    sajt,
    luckor,
    // PRIS2-1: hela artikellagret, inte bara de som redan är kopplade till ett säljpris.
    // Här ser Håkan ALLA 16 skärmar, även de utan koppling till säljlagret än.
    artiklar: (artiklar.data || []).map((a) => ({
      id: a.id,
      artikelnummer: a.artikelnummer,
      namn: a.namn,
      kategori: a.kategori,
      tum: a.tum,
      ljusstyrka_nits: a.ljusstyrka_nits,
      ip_klass: a.ip_klass,
      miljo: a.miljo,
      montering: a.montering,
      status: a.status,
      kopplatSaljpris: rader.find((p) => p.katalog_kod === a.artikelnummer)?.artikelnr || null,
      leverantorskopplingar: (alKopplingar.data || []).filter((k) => k.artikel_id === a.id),
      datablad: (datablad.data || []).filter((d) => d.artikel_id === a.id),
      tillval: (artikelTillval.data || []).filter((t) => t.artikel_id === a.id).map((t) => t.sl_artikelnr),
    })),
  });
}
