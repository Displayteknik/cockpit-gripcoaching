import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { DT_CLIENT_ID } from "@/lib/dt-client";
import {
  arVilande,
  hamtaHqGhl,
  hamtaStegFacit,
  hamtaValdaPipelines,
  lasPipeline,
  senastSynkad,
  synkaPipeline,
  type PipelineRad,
} from "@/lib/hq/pipeline";

export const runtime = "nodejs";

// PÅ G — överblicken. Alla affärer i spel, sorterade på NÄSTA ÅTGÄRDSDATUM i stället för
// på steg eller belopp. Svarar på en enda fråga: vad ska jag göra, och i vilken ordning?
//
// Läser spegeln (hq_pipeline_cache), aldrig GHL direkt. Samma data som Founder HQ och
// Dagens drag — ingen tredje sanning.
//
// ⚠ VILANDE HANTERAS I VYN, INTE I STATUSFÄLTET. `harledd_status` är fortfarande
// trevägs ('open'/'won'/'lost') i databasen, och "Vilande" räknas där som open. Att göra
// om det till ett fjärde värde kräver en migration (`migrations/hq.sql:76`) OCH ändrar
// likviditetsprognosens vikter (`lib/hq/likviditet.ts::vikt`) — alltså Håkans pengar.
// Den här vyn använder i stället `arVilande`, som fanns färdig men aldrig hade en
// anropare. Nettot är detsamma där det syns: parkerade affärer ligger i eget fack.

const TZ = "Europe/Stockholm";
const dagIStockholm = (d: Date): string => d.toLocaleDateString("sv-SE", { timeZone: TZ });

export interface PagRad {
  id: string;
  namn: string;
  foretag: string | null;
  kontakt: string | null;
  stegNamn: string | null;
  varde: number;
  nastaSteg: string | null;
  nastaDatum: string | null; // ÅÅÅÅ-MM-DD i svensk tid
  dagarTill: number | null; // negativt = försenat
  dagarISteget: number | null;
  ghlContactId: string | null;
}

export interface PagSvar {
  idag: string;
  senastSynkad: string | null;
  synkFel: string | null;
  fack: {
    forsenat: PagRad[];
    idag: PagRad[];
    kommande: PagRad[];
    utanPlan: PagRad[];
    vilande: PagRad[];
  };
  summa: { iSpel: number; antalISpel: number; utanPlan: number; vilande: number };
}

function tillRad(p: PipelineRad, idag: string): PagRad {
  const datum = p.uppfoljning_datum ? dagIStockholm(new Date(p.uppfoljning_datum)) : null;
  const dagarTill = datum
    ? Math.round((new Date(`${datum}T12:00:00Z`).getTime() - new Date(`${idag}T12:00:00Z`).getTime()) / 864e5)
    : null;
  const dagarISteget = p.steg_sedan
    ? Math.floor((Date.now() - new Date(p.steg_sedan).getTime()) / 864e5)
    : null;
  return {
    id: p.ghl_opportunity_id,
    namn: p.namn || p.kontakt || "Namnlös affär",
    foretag: p.foretag,
    kontakt: p.kontakt,
    stegNamn: p.steg_namn,
    varde: p.varde,
    nastaSteg: p.uppfoljning_titel,
    nastaDatum: datum,
    dagarTill,
    dagarISteget,
    ghlContactId: p.ghl_contact_id,
  };
}

// Äldst i steget överst bland dem utan plan: de har väntat längst på ett beslut.
const efterDatum = (a: PagRad, b: PagRad) => (a.nastaDatum || "").localeCompare(b.nastaDatum || "");
const efterAlder = (a: PagRad, b: PagRad) => (b.dagarISteget ?? 0) - (a.dagarISteget ?? 0);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  // Läckage-fix 19/8: samma hq_pipeline_cache-spegel som Founder HQ och Dagens drag
  // (se filkommentaren ovan) — samma DT-spärr.
  if ((await getActiveClientId()) !== DT_CLIENT_ID) {
    return NextResponse.json({ error: "På G visas bara när Displayteknik är aktiv klient." }, { status: 403 });
  }

  const tvinga = req.nextUrl.searchParams.get("synk") === "1";
  const synk = await synkaPipeline(tvinga);

  const cfg = await hamtaHqGhl();
  const [facit, valda, rader] = await Promise.all([
    cfg ? hamtaStegFacit(cfg.locationId) : Promise.resolve({ vilande: new Set<string>() }),
    cfg ? hamtaValdaPipelines(cfg.locationId) : Promise.resolve(new Set<string>()),
    lasPipeline(),
  ]);

  const idag = dagIStockholm(new Date());
  const fack: PagSvar["fack"] = { forsenat: [], idag: [], kommande: [], utanPlan: [], vilande: [] };

  for (const p of rader) {
    // Tom mängd valda pipelines = visa allt (samma regel som HQ) — hellre för mycket än
    // att tyst dölja hela pipelinen för att en inställning saknas.
    if (valda.size && p.pipeline_id && !valda.has(p.pipeline_id)) continue;

    if (arVilande(p.steg_id, p.steg_namn, facit.vilande)) {
      fack.vilande.push(tillRad(p, idag));
      continue;
    }
    if (p.harledd_status !== "open") continue; // vunnet och förlorat hör inte hemma i "På G"

    const rad = tillRad(p, idag);
    if (!rad.nastaDatum) fack.utanPlan.push(rad);
    else if (rad.nastaDatum < idag) fack.forsenat.push(rad);
    else if (rad.nastaDatum === idag) fack.idag.push(rad);
    else fack.kommande.push(rad);
  }

  fack.forsenat.sort(efterDatum);
  fack.idag.sort(efterDatum);
  fack.kommande.sort(efterDatum);
  fack.utanPlan.sort(efterAlder);
  fack.vilande.sort(efterDatum);

  const iSpelRader = [...fack.forsenat, ...fack.idag, ...fack.kommande, ...fack.utanPlan];
  const svar: PagSvar = {
    idag,
    senastSynkad: await senastSynkad(),
    synkFel: synk.ok ? null : synk.fel || "Kunde inte synka spegeln.",
    fack,
    summa: {
      iSpel: iSpelRader.reduce((s, r) => s + r.varde, 0),
      antalISpel: iSpelRader.length,
      utanPlan: fack.utanPlan.length,
      vilande: fack.vilande.length,
    },
  };
  return NextResponse.json(svar);
}
