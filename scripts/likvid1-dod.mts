// LIKVID-1 DoD — mot den RIKTIGA databasen, den RIKTIGA routen och det RIKTIGA MySales-API:t.
//
// Det enhetstesterna inte kan visa: att de nya tabellerna är server-only, VARFÖR GHL:s
// anpassade fält valdes bort, att sannolikheterna seedas ur pipelinen, att de tre
// pipelinekorten summerar rätt när en affär är delbetald, och att larmraden verkligen
// hamnar i morgonlistan när tröskeln sänks.
//
// All testdata skapas på en riktig affär, mäts, och raderas sist. Inget skrivs till GHL.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/likvid1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));

const { NextRequest } = await import("next/server");
const { supabaseService } = await import("@/lib/supabase-admin");
const hq = await import("@/lib/hq/pipeline");
const route = await import("@/app/api/hq/route");
const sb = supabaseService();

let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};
const nara = (a: number, b: number) => Math.abs(a - b) < 0.5;

interface HqSvar {
  idag: string;
  morgonlistan: { larm: Array<{ id: string; text: string; niva: string }> };
  dt: {
    iSpelOfakturerat: number; antalISpel: number;
    fakturreratObetalt: number; antalFakturerade: number;
    aldstaForfallodatum: string | null; antalForfallna: number;
    betalt: number;
  };
  pipeline: Array<{
    ghl_opportunity_id: string; varde: number; harledd_status: string; steg_id: string | null;
    sannolikhet: number;
    finans: { fakturerat: number; betalt: number; forvantat_betaldatum: string | null; forfallodatum: string | null };
  }>;
  likviditet: Array<{
    bolag: string; trafikljus: string; klartext: string; saknarSaldo: boolean;
    lagsta: { belopp: number; veckonummer: number };
    ejDaterade: { summa: number; antal: number };
    veckor: Array<{ veckonummer: number; in: number; ut: number; utgaende: number }>;
    konfig: { usd_kurs: number; buffertmal: number; gul_grans_veckor: number };
    fastaSek: number;
  }>;
  cash: Array<{ id: string; titel: string }>;
}

const hamta = async (): Promise<HqSvar> => {
  const r = await route.GET(new NextRequest("http://localhost:3000/api/hq"));
  return (await r.json()) as HqSvar;
};

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Städlistor, fylls under körningen och töms i finally.
const saldoIds: string[] = [];
const cashIds: string[] = [];
let finansOid = "";

try {
  console.log("\n== 1. De nya tabellerna är server-only ==");
  for (const t of ["hq_deal_finance", "hq_bank_saldo", "hq_cash_items", "hq_likvid_konfig", "hq_steg_sannolikhet"]) {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const rader = r.ok ? await r.json() : [];
    kolla(`${t}: anon-nyckeln ser noll rader`, Array.isArray(rader) && rader.length === 0, `status ${r.status}`);
  }

  console.log("\n== 2. Varför betalstatusen INTE ligger i GHL:s anpassade fält ==");
  const cfg = await hq.hamtaHqGhl();
  kolla("koppling till MySales hittad", !!cfg, cfg ? `location ${cfg.locationId}` : "saknas");
  const H = { Authorization: `Bearer ${cfg!.pit}`, Version: "2021-07-28", Accept: "application/json" };
  const cfSvar = await fetch(
    `https://services.leadconnectorhq.com/locations/${cfg!.locationId}/customFields?model=opportunity`,
    { headers: H },
  );
  kolla("PIT:en får läsa anpassade fält på affärer", cfSvar.status === 200, `HTTP ${cfSvar.status}`);
  const cfLista: Array<{ id: string; name: string }> = (await cfSvar.json()).customFields || [];
  kolla(
    "locationen har inga anpassade fält på affärer, alltså finns ingen betalstatus att läsa ur MySales",
    cfLista.length === 0,
    cfLista.map((f) => f.name).join(", ") || "noll fält",
  );

  // Upplysning, ingen kontroll. Provkörningen 2/8 visade att ett värde som skrivits på
  // en affär INTE går att radera: customFields: [], field_value null, tom sträng och 0
  // svarar alla 200 och lämnar värdet orört, och det överlever att fältet tas bort.
  // Ett felskrivet fakturabelopp hade alltså aldrig gått att ta bort, bara skriva över.
  // Det, plus att HQ aldrig skriver till MySales, avgjorde valet av hq_deal_finance.
  const sok = await fetch(
    `https://services.leadconnectorhq.com/opportunities/search?location_id=${cfg!.locationId}&limit=100`,
    { headers: H },
  );
  const affarer: Array<{ id: string; customFields?: unknown[] }> = (await sok.json()).opportunities || [];
  const foraldralosa = affarer.filter((o) => Array.isArray(o.customFields) && o.customFields.length > 0);
  console.log(
    `     upplysning: ${affarer.length} affärer i MySales, ${foraldralosa.length} bär kvar ett värde som pekar på ett borttaget fält`,
  );

  console.log("\n== 3. Sannolikheterna seedas ur pipelinen ==");
  await hq.synkaPipeline(true);
  const { data: sannData } = await sb.from("hq_steg_sannolikhet").select("*");
  const sann = (sannData as Array<{ steg_id: string; steg_namn: string; procent: number; agarsatt: boolean; pipeline_id: string }> | null) || [];
  kolla("stegen har fått en sannolikhet", sann.length > 0, `${sann.length} steg`);
  const vinst = sann.find((s) => s.steg_id === "98ae3cff-18a0-4f01-93cc-cc6965a195ce");
  const forlust = sann.find((s) => s.steg_id === "a6023573-4e6a-4ab4-ae91-f15bace0c36f");
  kolla("vinststeget står på 100 procent", vinst?.procent === 100, String(vinst?.procent));
  kolla("förluststeget står på 0 procent", forlust?.procent === 0, String(forlust?.procent));
  const dtStegen = sann
    .filter((s) => s.pipeline_id === "2UpfDncGleH6fe9cLSpq" && s.procent > 0 && s.procent < 100)
    .map((s) => s.procent)
    .sort((a, b) => a - b);
  kolla("stegen i spel stiger jämnt genom pipelinen", JSON.stringify(dtStegen) === JSON.stringify([13, 25, 38, 50, 63, 75, 88]), dtStegen.join(", "));

  console.log("\n== 4. De tre pipelinekorten mot en DELBETALD affär ==");
  const fore = await hamta();
  const kandidat = fore.pipeline.find((p) => p.harledd_status === "open" && p.varde >= 100000);
  kolla("en riktig affär i spel att testa på", !!kandidat, kandidat ? `${kandidat.ghl_opportunity_id}, ${kandidat.varde} kr` : "ingen");
  finansOid = kandidat!.ghl_opportunity_id;
  const vikt = kandidat!.sannolikhet / 100;

  // Delbetald: 60 000 fakturerat varav 25 000 betalt. Förfallodatum i går, alltså passerat.
  const igar = new Date(Date.parse(`${fore.idag}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  await sb.from("hq_deal_finance").upsert({
    opportunity_id: finansOid,
    fakturerat: 60000,
    betalt: 25000,
    forfallodatum: igar,
    forvantat_betaldatum: null,
  });
  const efter = await hamta();

  const vantatISpel = fore.dt.iSpelOfakturerat - 60000 * vikt;
  kolla(
    "i spel sjunker med exakt det fakturerade, viktat på steget",
    nara(efter.dt.iSpelOfakturerat, vantatISpel),
    `${Math.round(fore.dt.iSpelOfakturerat)} → ${Math.round(efter.dt.iSpelOfakturerat)}, väntat ${Math.round(vantatISpel)} (vikt ${vikt})`,
  );
  kolla(
    "fakturerat obetalt stiger med 35 000, oviktat",
    nara(efter.dt.fakturreratObetalt, fore.dt.fakturreratObetalt + 35000),
    `${Math.round(fore.dt.fakturreratObetalt)} → ${Math.round(efter.dt.fakturreratObetalt)}`,
  );
  kolla(
    "betalt stiger med 25 000",
    nara(efter.dt.betalt, fore.dt.betalt + 25000),
    `${Math.round(fore.dt.betalt)} → ${Math.round(efter.dt.betalt)}`,
  );
  kolla("äldsta förfallodatum syns", efter.dt.aldstaForfallodatum === igar, String(efter.dt.aldstaForfallodatum));
  kolla("passerat förfallodatum räknas", efter.dt.antalForfallna >= 1, `${efter.dt.antalForfallna} st`);
  kolla(
    "affären utan förväntat betaldatum står som ej daterad",
    efter.likviditet.find((l) => l.bolag === "dt")!.ejDaterade.antal >= 1,
    `${Math.round(efter.likviditet.find((l) => l.bolag === "dt")!.ejDaterade.summa)} kr`,
  );

  console.log("\n== 5. Prognosen, trafikljuset och larmraden ==");
  const utanSaldo = efter.likviditet.find((l) => l.bolag === "dt")!;
  kolla("utan banksaldo räknas ingen prognos", utanSaldo.saknarSaldo === true, utanSaldo.klartext);
  kolla("och då går inget larm", efter.morgonlistan.larm.length === 0, `${efter.morgonlistan.larm.length} larm`);

  const { data: saldoRad } = await sb
    .from("hq_bank_saldo")
    .insert({ bolag: "dt", saldo: 400000, datum: fore.idag, notering: "LIKVID1 DoD" })
    .select("id")
    .single();
  saldoIds.push((saldoRad as { id: string }).id);

  await sb.from("hq_likvid_konfig").update({ buffertmal: 0, gul_grans_veckor: 4, usd_kurs: 11 }).eq("bolag", "dt");
  const gront = await hamta();
  const g = gront.likviditet.find((l) => l.bolag === "dt")!;
  kolla("med saldo och buffertmål noll är läget grönt", g.trafikljus === "gron", g.klartext);
  kolla("tolv veckor räknas", g.veckor.length === 12, `${g.veckor.length} veckor`);
  kolla("dollarkursen syns i vyn", g.konfig.usd_kurs === 11, `${g.konfig.usd_kurs} kr per dollar`);
  kolla("fasta kostnader räknas om till kronor", g.fastaSek > 0, `${Math.round(g.fastaSek)} kr per månad`);

  // USD-omräkningen: GripCoachings fasta kostnader ligger i både kronor och dollar.
  // Summan ska vara kronorna plus dollarposterna gånger kursen, aldrig dollarbeloppen råa.
  const { data: fastaGrip } = await sb.from("hq_fasta_kostnader").select("belopp_per_man, valuta").eq("bolag", "grip");
  const rader = (fastaGrip as Array<{ belopp_per_man: number | string; valuta: string }> | null) || [];
  const sek = rader.filter((r) => r.valuta === "SEK").reduce((s, r) => s + Number(r.belopp_per_man), 0);
  const usd = rader.filter((r) => r.valuta === "USD").reduce((s, r) => s + Number(r.belopp_per_man), 0);
  const gripKonfig = gront.likviditet.find((l) => l.bolag === "grip")!;
  kolla(
    "USD räknas om med kursen ur konfigen, inte som kronor",
    nara(gripKonfig.fastaSek, sek + usd * gripKonfig.konfig.usd_kurs) && usd > 0,
    `${sek} kr plus ${usd} USD gånger ${gripKonfig.konfig.usd_kurs} blir ${Math.round(gripKonfig.fastaSek)} kr`,
  );

  // Sänkt tröskel: buffertmålet höjs över lägsta punkten → gult läge och larm i morgonlistan.
  const overLagsta = Math.round(g.lagsta.belopp) + 50000;
  await sb.from("hq_likvid_konfig").update({ buffertmal: overLagsta }).eq("bolag", "dt");
  const gult = await hamta();
  const gu = gult.likviditet.find((l) => l.bolag === "dt")!;
  kolla("höjd tröskel ger gult läge", gu.trafikljus === "gul", gu.klartext);
  const larmGult = gult.morgonlistan.larm.find((l) => l.id === "likvid-dt");
  kolla("larmraden ligger i morgonlistan", !!larmGult, larmGult?.text || "saknas");
  kolla("larmet namnger vecka och lägsta belopp", /gult läge vecka \d+, lägsta/.test(larmGult?.text || ""), larmGult?.text || "");
  kolla("inga tankstreck i larmtexten", !/[—–]/.test(larmGult?.text || ""));

  // Rött: en stor utbetalning tar saldot under noll.
  const { data: cashRad } = await sb
    .from("hq_cash_items")
    .insert({
      bolag: "dt",
      titel: "LIKVID1 DoD, momsinbetalning",
      belopp: -900000,
      datum: new Date(Date.parse(`${fore.idag}T12:00:00Z`) + 21 * 86400000).toISOString().slice(0, 10),
      typ: "moms",
      status: "planerad",
    })
    .select("id")
    .single();
  cashIds.push((cashRad as { id: string }).id);
  await sb.from("hq_likvid_konfig").update({ buffertmal: 0 }).eq("bolag", "dt");
  const rott = await hamta();
  const ro = rott.likviditet.find((l) => l.bolag === "dt")!;
  kolla("en utbetalning som tar saldot under noll ger rött", ro.trafikljus === "rod", ro.klartext);
  kolla("lägsta punkten är negativ", ro.lagsta.belopp < 0, `${Math.round(ro.lagsta.belopp)} kr vecka ${ro.lagsta.veckonummer}`);
  kolla("rött läge larmar också", rott.morgonlistan.larm.some((l) => l.id === "likvid-dt" && l.niva === "rod"));
  const veckaMedUt = ro.veckor.find((v) => v.ut >= 900000);
  kolla("posten hamnade på sin egen vecka", !!veckaMedUt, veckaMedUt ? `vecka ${veckaMedUt.veckonummer}` : "hittades inte");
  kolla("posten syns i listan över kända betalningar", rott.cash.some((c) => c.titel.startsWith("LIKVID1 DoD")));
} finally {
  console.log("\n== 6. Städning ==");
  if (finansOid) await sb.from("hq_deal_finance").delete().eq("opportunity_id", finansOid);
  for (const id of saldoIds) await sb.from("hq_bank_saldo").delete().eq("id", id);
  for (const id of cashIds) await sb.from("hq_cash_items").delete().eq("id", id);
  await sb.from("hq_likvid_konfig").update({ buffertmal: 0, gul_grans_veckor: 4, usd_kurs: 11 }).eq("bolag", "dt");

  const { data: kvarFinans } = await sb.from("hq_deal_finance").select("opportunity_id");
  const { data: kvarSaldo } = await sb.from("hq_bank_saldo").select("id").eq("notering", "LIKVID1 DoD");
  const { data: kvarCash } = await sb.from("hq_cash_items").select("id").ilike("titel", "LIKVID1 DoD%");
  kolla("betalstatusraden borta", (kvarFinans || []).length === 0, `${(kvarFinans || []).length} rader kvar`);
  kolla("banksaldoraden borta", (kvarSaldo || []).length === 0);
  kolla("betalningsposten borta", (kvarCash || []).length === 0);

  const efterStad = await hamta();
  const l = efterStad.likviditet.find((x) => x.bolag === "dt")!;
  kolla("prognosen är tillbaka i utgångsläget", l.saknarSaldo === true, l.klartext);
  kolla("inga larm kvar i morgonlistan", efterStad.morgonlistan.larm.length === 0);

  console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
  process.exit(fel === 0 ? 0 : 1);
}
