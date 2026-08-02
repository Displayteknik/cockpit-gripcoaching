// K3-INKÖP DoD — mot den RIKTIGA databasen, de RIKTIGA routerna och leverantörernas
// RIKTIGA saldo-API:er.
//
// Det enhetstesterna inte kan visa: att de nya tabellerna är server-only, att saldona
// verkligen går att läsa med befintliga nycklar, att prognosen räknas ur riktiga
// ai_usage_events, att larmet når BÅDE kostnadsmodulen och Founder HQ:s morgonlista
// från samma källa, och att marginalen blir rätt krona för Displayteknik.
//
// All testdata skapas, mäts och raderas sist. Inga köp görs, ingenting skrivs till
// någon leverantör.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/k3-inkop-dod.mts

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
const kostnader = await import("@/app/api/kostnader/route");
const hqRoute = await import("@/app/api/hq/route");
const sb = supabaseService();

let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

interface Inkopsrad {
  id: string; provider: string; etikett: string; typ: string;
  saldo_belopp: number | null; saldo_valuta: string; saldo_kalla: string;
  saldo_uppdaterad: string | null; saldo_fel: string | null;
  saldoSek: number | null; kurs: number;
  takt7: { snittPerDag: number; summa: number; namnare: number; tunt: boolean };
  takt30: { snittPerDag: number; summa: number; namnare: number; tunt: boolean };
  dagarKvar: number | null; prognosSek: number; larmniva: string; larmorsak: string;
  rekommendation: { belopp: number; valuta: string; senast: string | null; klartext: string } | null;
  forra_fakturan_sek: number | null; harApi: boolean;
}
interface KostnadSvar {
  inkop: { idag: string; trosklar: { gulDagar: number; rodDagar: number; gulPrognosProcent: number }; rader: Inkopsrad[]; larm: Array<{ id: string; text: string; niva: string; etikett: string; lank: string }> };
  marginal: {
    rader: Array<{ tenantId: string; namn: string; abonnemangSek: number | null; topupSek: number; aiKostnadSek: number; marginalSek: number | null; marginalProcent: number | null; prisSaknas: boolean }>;
    summa: { intaktSek: number; aiKostnadSek: number; marginalSek: number; utanPris: number };
    mrrVal: Array<{ id: string; kund: string; client_id: string | null }>;
  };
  creditPriser: Array<{ action: string; credits: number; active: boolean }>;
}
interface HqSvar {
  morgonlistan: { larm: Array<{ id: string; text: string; niva: string; etikett?: string; lank?: string }> };
}

const hamtaKostnader = async (): Promise<KostnadSvar> => (await (await kostnader.GET()).json()) as KostnadSvar;
const hamtaHq = async (): Promise<HqSvar> =>
  (await (await hqRoute.GET(new NextRequest("http://localhost:3000/api/hq"))).json()) as HqSvar;

const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const DT = "a6a33547-5ca7-475f-9a62-43ff2c74d000"; // Displayteknik, piloten
const TESTMARK = "K3 DoD";

// Städlistor
const handelseIds: string[] = [];
let dtMrrId = "";

try {
  console.log("\n== 1. De nya tabellerna är server-only ==");
  for (const t of ["provider_accounts", "inkop_konfig"]) {
    const r = await fetch(`${URL_SB}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    const rader = r.ok ? await r.json() : [];
    kolla(`${t}: anon-nyckeln ser noll rader`, Array.isArray(rader) && rader.length === 0, `status ${r.status}`);
  }
  // ⚠ Statuskoden ensam duger INTE som bevis här: med RLS på och noll policies matchar
  // en UPDATE noll rader, och PostgREST svarar 204 precis som på en lyckad skrivning.
  // Beviset är att VÄRDET står kvar när man läser tillbaka med service-role.
  const { data: foreSkriv } = await sb.from("inkop_konfig").select("gul_dagar").eq("id", 1).maybeSingle();
  const skriv = await fetch(`${URL_SB}/rest/v1/inkop_konfig?id=eq.1`, {
    method: "PATCH",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ gul_dagar: 999 }),
  });
  const { data: efterSkriv } = await sb.from("inkop_konfig").select("gul_dagar").eq("id", 1).maybeSingle();
  kolla(
    "anon-skrivningen ändrade ingenting i inkop_konfig",
    (efterSkriv as { gul_dagar: number } | null)?.gul_dagar === (foreSkriv as { gul_dagar: number } | null)?.gul_dagar,
    `svar ${skriv.status}, värdet kvar på ${(efterSkriv as { gul_dagar: number } | null)?.gul_dagar}`,
  );

  const anonInsert = await fetch(`${URL_SB}/rest/v1/provider_accounts`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "ovrig", etikett: `${TESTMARK} anon`, typ: "forbetalt" }),
  });
  kolla("anon får inte lägga till ett konto", anonInsert.status === 401 || anonInsert.status === 403, `status ${anonInsert.status}`);

  console.log("\n== 2. Saldona läses med BEFINTLIGA nycklar ==");
  const forsta = await hamtaKostnader();
  const fal = forsta.inkop.rader.find((r) => r.provider === "fal")!;
  const elks = forsta.inkop.rader.find((r) => r.provider === "elks46")!;
  kolla("Fal.ai finns som rad", !!fal);
  kolla("46elks finns som rad", !!elks);
  kolla("Google Cloud finns som rad", forsta.inkop.rader.some((r) => r.provider === "google_cloud"));
  kolla("Fal.ai-saldot hämtades automatiskt", fal.saldo_kalla === "api" && fal.saldo_belopp !== null && !fal.saldo_fel,
    `${fal.saldo_belopp} ${fal.saldo_valuta}`);
  kolla("46elks-saldot hämtades automatiskt", elks.saldo_kalla === "api" && elks.saldo_belopp !== null && !elks.saldo_fel,
    `${elks.saldo_belopp} ${elks.saldo_valuta}`);
  kolla("Fal.ai-saldot räknas om till kronor med prislistans kurs", fal.saldoSek !== null && Math.abs(fal.saldoSek - (fal.saldo_belopp || 0) * fal.kurs) < 0.01,
    `kurs ${fal.kurs}`);
  kolla("46elks räknas i SEK utan omräkning", elks.kurs === 1);
  kolla("Google Cloud saknar saldo-API och står som manuellt",
    forsta.inkop.rader.find((r) => r.provider === "google_cloud")!.harApi === false);

  console.log("\n== 3. Saldot hämtas högst en gång i timmen ==");
  const forsteTid = fal.saldo_uppdaterad;
  const igen = await hamtaKostnader();
  const falIgen = igen.inkop.rader.find((r) => r.provider === "fal")!;
  kolla("andra sidladdningen använde cachen", falIgen.saldo_uppdaterad === forsteTid, `stämpel ${forsteTid}`);

  console.log("\n== 4. Prognosen räknas ur RIKTIGA ai_usage_events ==");
  const { data: riktiga } = await sb
    .from("ai_usage_events")
    .select("id, provider, estimated_cost_sek, created_at")
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  const geminiSumma = ((riktiga as Array<{ provider: string; estimated_cost_sek: number }> | null) || [])
    .filter((r) => r.provider === "gemini" || r.provider === "google")
    .reduce((s, r) => s + Number(r.estimated_cost_sek), 0);
  const google = igen.inkop.rader.find((r) => r.provider === "google_cloud")!;
  kolla("Google Clouds trettiodagarssumma matchar ledgern på öret",
    Math.abs(google.takt30.summa - geminiSumma) < 0.000001,
    `vy ${google.takt30.summa.toFixed(6)} mot ledger ${geminiSumma.toFixed(6)}`);
  kolla("snittet är summan delad på den faktiska mätperioden",
    Math.abs(google.takt30.snittPerDag - google.takt30.summa / google.takt30.namnare) < 1e-9,
    `nämnare ${google.takt30.namnare}`);
  kolla("prognosen är trettiodagarssnittet gånger 30",
    Math.abs(google.prognosSek - google.takt30.snittPerDag * 30) < 1e-9, `${google.prognosSek.toFixed(4)} kr`);
  kolla("inga larm i utgångsläget", igen.inkop.larm.length === 0, igen.inkop.larm.map((l) => l.text).join(" | "));

  console.log("\n== 5. Larmkedjan: efterskott, tröskeln sänkt tillfälligt ==");
  // Förra fakturan sätts lågt, så prognosen överstiger 150 procent av den.
  const lagFaktura = Math.max(0.01, google.prognosSek / 3);
  await sb.from("provider_accounts").update({ forra_fakturan_sek: lagFaktura }).eq("provider", "google_cloud");
  const gult = await hamtaKostnader();
  const googleGult = gult.inkop.rader.find((r) => r.provider === "google_cloud")!;
  kolla("Google Cloud blir gult när prognosen är tre gånger förra fakturan", googleGult.larmniva === "gul", googleGult.larmorsak);
  kolla("larmet finns i kostnadsmodulens banner", gult.inkop.larm.some((l) => l.id === "inkop-google_cloud" && l.niva === "gul"));
  const hqGult = await hamtaHq();
  kolla("SAMMA larm finns i Founder HQ:s morgonlista",
    hqGult.morgonlistan.larm.some((l) => l.id === "inkop-google_cloud" && l.niva === "gul"));
  const hqRad = hqGult.morgonlistan.larm.find((l) => l.id === "inkop-google_cloud")!;
  const vyRad = gult.inkop.larm.find((l) => l.id === "inkop-google_cloud")!;
  kolla("texten är ordagrant densamma i båda vyerna (en källa)", hqRad.text === vyRad.text, hqRad.text);
  kolla("morgonlistans rad bär etikett och länk", hqRad.etikett === "Inköp" && hqRad.lank === "/dashboard/kostnader#inkop");
  kolla("inga tankstreck i larmtexten", !/[–—]/.test(hqRad.text));

  console.log("\n== 6. Larmkedjan: förbetalt, mot en riktig förbrukning ==");
  // En uppmätt förbrukning på Fal.ai så dagar kvar går att räkna. Raden raderas sedan.
  const { data: handelse } = await sb
    .from("ai_usage_events")
    .insert({
      tenant_id: DT, provider: "fal", model: `${TESTMARK} flux`, flow: "k3-dod",
      tokens_in: 0, tokens_out: 0, media_units: 1, estimated_cost_sek: 20,
      status: "ok", latency_ms: 1,
    })
    .select("id")
    .single();
  handelseIds.push((handelse as { id: string }).id);

  const medFal = await hamtaKostnader();
  const fal2 = medFal.inkop.rader.find((r) => r.provider === "fal")!;
  kolla("Fal.ai har nu en uppmätt takt", fal2.takt7.snittPerDag > 0, `${fal2.takt7.snittPerDag.toFixed(2)} kr per dag`);
  kolla("dagar kvar går att räkna", fal2.dagarKvar !== null,
    fal2.dagarKvar === null ? "null" : `${Math.floor(fal2.dagarKvar)} dagar på ${fal2.saldoSek?.toFixed(2)} kr`);
  kolla("dagar kvar är saldot delat på sjudagarssnittet",
    fal2.dagarKvar !== null && Math.abs(fal2.dagarKvar - (fal2.saldoSek || 0) / fal2.takt7.snittPerDag) < 1e-9);

  // Tröskeln sänks (höjs) tillfälligt så att larmet MÅSTE slå. Återställs i städningen.
  const hogTroskel = Math.ceil((fal2.dagarKvar || 0) + 10);
  await sb.from("inkop_konfig").update({ gul_dagar: hogTroskel }).eq("id", 1);
  const falGult = await hamtaKostnader();
  const fal3 = falGult.inkop.rader.find((r) => r.provider === "fal")!;
  kolla(`Fal.ai blir gult när gulgränsen sätts till ${hogTroskel} dagar`, fal3.larmniva === "gul", fal3.larmorsak);
  kolla("köprekommendationen räknas på 45 dagars förbrukning",
    !!fal3.rekommendation && fal3.rekommendation.valuta === "USD",
    fal3.rekommendation?.klartext || "saknas");
  kolla("rekommendationen är minst 45 dagars förbrukning omräknad till USD",
    !!fal3.rekommendation && fal3.rekommendation.belopp >= (fal3.takt30.snittPerDag * 45) / fal3.kurs,
    `${fal3.rekommendation?.belopp} USD mot ${(fal3.takt30.snittPerDag * 45 / fal3.kurs).toFixed(2)} obeskuret`);
  kolla("rekommendationen bär ett sista datum", !!fal3.rekommendation?.senast, fal3.rekommendation?.senast || "saknas");
  kolla("Fal.ai-larmet syns i kostnadsmodulen", falGult.inkop.larm.some((l) => l.id === "inkop-fal"));
  const hqFal = await hamtaHq();
  kolla("Fal.ai-larmet syns också i morgonlistan", hqFal.morgonlistan.larm.some((l) => l.id === "inkop-fal"));

  // Rött vid billing-fel senaste dygnet, oavsett saldo.
  const { data: felrad } = await sb
    .from("ai_usage_events")
    .insert({
      tenant_id: DT, provider: "fal", model: `${TESTMARK} flux`, flow: "k3-dod",
      tokens_in: 0, tokens_out: 0, media_units: 0, estimated_cost_sek: 0,
      status: "error", error_class: "billing", http_status: 402,
      error_body: `${TESTMARK}: payment required`, latency_ms: 1,
    })
    .select("id")
    .single();
  handelseIds.push((felrad as { id: string }).id);
  await sb.from("inkop_konfig").update({ gul_dagar: 14 }).eq("id", 1);
  const rott = await hamtaKostnader();
  const fal4 = rott.inkop.rader.find((r) => r.provider === "fal")!;
  kolla("ett betalningsfel senaste dygnet ger RÖTT oavsett saldo", fal4.larmniva === "rod", fal4.larmorsak);
  const hqRott = await hamtaHq();
  kolla("det röda larmet når morgonlistan", hqRott.morgonlistan.larm.some((l) => l.id === "inkop-fal" && l.niva === "rod"));

  console.log("\n== 7. Marginal per kund, Displayteknik som pilot ==");
  const utgang = await hamtaKostnader();
  const dtUtgang = utgang.marginal.rader.find((r) => r.tenantId === DT)!;
  kolla("Displayteknik finns i marginaltabellen", !!dtUtgang);
  kolla("utan ifyllt abonnemangspris flaggas kunden i stället för att visa en falsk nolla",
    dtUtgang.prisSaknas === true && dtUtgang.marginalSek === null, `marginal ${dtUtgang.marginalSek}`);

  // En intäktsrad läggs in och kopplas till DT. Raderas i städningen.
  const { data: mrr } = await sb
    .from("hq_mrr_entries")
    .insert({ bolag: "dt", kund: `${TESTMARK} Displayteknik`, niva: "ovrigt", belopp_ex_moms: 2000, status: "aktiv", client_id: DT, notering: TESTMARK })
    .select("id")
    .single();
  dtMrrId = (mrr as { id: string }).id;

  const medPris = await hamtaKostnader();
  const dtRad = medPris.marginal.rader.find((r) => r.tenantId === DT)!;
  const forvantadMarginal = 2000 + dtRad.topupSek - dtRad.aiKostnadSek;
  kolla("abonnemangspriset når marginalraden", dtRad.abonnemangSek === 2000, `${dtRad.abonnemangSek}`);
  kolla("bruttomarginalen är intäkt minus faktisk AI-kostnad, på öret",
    dtRad.marginalSek !== null && Math.abs(dtRad.marginalSek - forvantadMarginal) < 1e-9,
    `${dtRad.marginalSek?.toFixed(4)} kr mot handräknat ${forvantadMarginal.toFixed(4)} kr (AI-kostnad ${dtRad.aiKostnadSek.toFixed(4)})`);
  kolla("procenten stämmer mot kronorna",
    dtRad.marginalProcent !== null && Math.abs(dtRad.marginalProcent - (dtRad.marginalSek! / (2000 + dtRad.topupSek)) * 100) < 1e-9,
    `${dtRad.marginalProcent?.toFixed(2)} procent`);
  kolla("Displayteknik räknas inte längre som pris saknas", dtRad.prisSaknas === false);
  kolla("kunder utan pris räknas separat och drar inte ner totalen",
    medPris.marginal.summa.utanPris > 0, `${medPris.marginal.summa.utanPris} kunder utan pris`);
  kolla("kopplingen syns som valbar rad i vyn",
    medPris.marginal.mrrVal.some((v) => v.id === dtMrrId && v.client_id === DT));

  console.log("\n== 8. credit_pricing: de två inaktiva lead-raderna ==");
  const priser = medPris.creditPriser;
  for (const action of ["lead_niva_a", "lead_niva_b"]) {
    const p = priser.find((x) => x.action === action);
    kolla(`${action} finns med noll credits och avstängd`, !!p && p.credits === 0 && p.active === false,
      p ? `credits ${p.credits}, aktiv ${p.active}` : "saknas");
  }
  const { data: noteRader } = await sb.from("credit_pricing").select("action, note").in("action", ["lead_niva_a", "lead_niva_b"]);
  kolla("båda bär kommentaren om att priset sätts när ICP-motorns kostnadskarta finns",
    ((noteRader as Array<{ note: string | null }> | null) || []).every((r) => (r.note || "").includes("ICP")));

  const { forbrukningKlartext } = await import("@/lib/credits");
  const klartext = forbrukningKlartext({ lead_niva_a: 3, lead_niva_b: 1 });
  kolla("förbrukningen i klartext använder etiketter, inte råa nycklar",
    !klartext.includes("lead_niva_a") && !klartext.includes("lead_niva_b"), klartext);
} finally {
  console.log("\n== 9. Städning ==");
  for (const id of handelseIds) await sb.from("ai_usage_events").delete().eq("id", id);
  if (dtMrrId) await sb.from("hq_mrr_entries").delete().eq("id", dtMrrId);
  await sb.from("inkop_konfig").update({ gul_dagar: 14, rod_dagar: 5, gul_prognos_procent: 150 }).eq("id", 1);
  await sb.from("provider_accounts").update({ forra_fakturan_sek: null }).eq("provider", "google_cloud");

  const { data: kvarHandelser } = await sb.from("ai_usage_events").select("id").ilike("model", `${TESTMARK}%`);
  const { data: kvarMrr } = await sb.from("hq_mrr_entries").select("id").eq("notering", TESTMARK);
  const { data: konfig } = await sb.from("inkop_konfig").select("gul_dagar, rod_dagar, gul_prognos_procent").eq("id", 1).maybeSingle();
  const { data: gc } = await sb.from("provider_accounts").select("forra_fakturan_sek").eq("provider", "google_cloud").maybeSingle();

  kolla("testhändelserna borta", (kvarHandelser || []).length === 0, `${(kvarHandelser || []).length} kvar`);
  kolla("test-intäktsraden borta", (kvarMrr || []).length === 0, `${(kvarMrr || []).length} kvar`);
  kolla("trösklarna återställda till 14, 5 och 150",
    JSON.stringify(konfig) === JSON.stringify({ gul_dagar: 14, rod_dagar: 5, gul_prognos_procent: 150 }), JSON.stringify(konfig));
  kolla("Google Clouds fakturafält är tomt igen", (gc as { forra_fakturan_sek: number | null } | null)?.forra_fakturan_sek === null);

  const efter = await hamtaKostnader();
  kolla("inga larm kvar efter städningen", efter.inkop.larm.length === 0, efter.inkop.larm.map((l) => l.text).join(" | "));
  kolla("Displayteknik står som pris saknas igen",
    efter.marginal.rader.find((r) => r.tenantId === DT)?.prisSaknas === true);

  console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
  process.exit(fel === 0 ? 0 : 1);
}
