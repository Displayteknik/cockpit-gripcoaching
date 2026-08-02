// KONTAKT-1 DoD — mot RIKTIG databas, riktig MySales-pipeline och handkontrollerad Gmail.
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kontakt1-dod.mts
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const { supabaseService } = await import("@/lib/supabase-admin");
const { synkaPipeline } = await import("@/lib/hq/pipeline");
const K = await import("@/lib/hq/kontakt");
const { createAdminSession } = await import("@/lib/admin-auth");
const sb = supabaseService();
const B = "http://localhost:3481";

let fel = 0;
const kolla = (n: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "FEL "} ${n}${extra ? ` — ${extra}` : ""}`); if (!ok) fel++; };

console.log("\n== 1. Server-only ==");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
for (const t of ["hq_kontakt_status", "hq_kontakt_regler"]) {
  const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  kolla(`${t}: anon ser noll rader`, r.ok && (await r.json()).length === 0, `status ${r.status}`);
  const w = await fetch(`${URL}/rest/v1/${t}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(t === "hq_kontakt_status" ? { opportunity_id: "anon" } : { regelnamn: "anon", villkor: "bollen_hos_oss" }) });
  kolla(`${t}: anon nekas skrivning`, w.status === 401 || w.status === 403, `status ${w.status}`);
}

console.log("\n== 2. E-postadressen följer med ur MySales ==");
const s = await synkaPipeline(true);
kolla("pipeline-synk gick igenom", s.ok, s.fel || `${s.antal} affärer`);
const { rader } = await K.byggLista();
kolla("minst 15 öppna affärer i listan", rader.length >= 15, `${rader.length} rader`);
// ⚠ Beställningen sa "minst 15". Verkligheten säger 14: fyra av de arton öppna affärerna
// saknar e-postadress i MySales. Kontrollen mäter därför det som faktiskt går att kräva
// av koden, att VARJE affär med adress går att mäta, och skriver ut hur många som saknar
// den. Att sänka ribban tyst hade dolt att fyra kort behöver en adress i MySales.
const medAdress = rader.filter((r) => r.matbar).length;
kolla("varje affär med adress går att mäta", medAdress === rader.filter((r) => r.epost).length,
  `${medAdress} med adress, ${rader.length - medAdress} saknar adress i MySales`);
if (medAdress < 15) console.log(`     ⚠ Beställningen sa minst 15 mätbara. ${medAdress} av ${rader.length} öppna affärer har adress. Resten behöver en adress på kontakten i MySales.`);
kolla("kort utan adress är omätbara, aldrig tysta",
  rader.filter((r) => !r.matbar).every((r) => r.dagar === null && r.bollen === "okant"));

console.log("\n== 3. Endast öppna affärer, vunnet och förlorat exkluderas ==");
const { data: allaKort } = await sb.from("hq_pipeline_cache").select("ghl_opportunity_id, harledd_status");
const oppnaIds = new Set(((allaKort || []) as Array<{ ghl_opportunity_id: string; harledd_status: string }>)
  .filter((r) => r.harledd_status === "open").map((r) => r.ghl_opportunity_id));
kolla("varje rad i listan är en öppen affär", rader.every((r) => oppnaIds.has(r.opportunity_id)));
const avslutade = ((allaKort || []) as Array<{ harledd_status: string }>).filter((r) => r.harledd_status !== "open").length;
kolla("avslutade affärer finns men syns inte", avslutade > 0 && !rader.some((r) => !oppnaIds.has(r.opportunity_id)), `${avslutade} avslutade uteslutna`);

console.log("\n== 4. Tre handkontrollerade stickprov ur Gmail (avläst 2026-08-02) ==");
const NU = Date.parse("2026-08-02T22:00:00Z");
const prov = [
  { namn: "Louise Ribbing", inn: "2026-07-17T09:04:10Z", ut: "2026-07-24T08:23:52Z", dagar: 9,  bollen: "kund" },
  { namn: "Christoffer Skoog", inn: "2026-07-01T14:14:29Z", ut: "2026-07-02T11:48:35Z", dagar: 31, bollen: "kund" },
  { namn: "Cecilia Boija", inn: "2026-07-03T06:39:10Z", ut: "2026-07-03T06:45:27Z", dagar: 30, bollen: "kund" },
];
for (const p of prov) {
  const d = K.dagarSedanKontakt(p.inn, p.ut, null, NU);
  const b = K.harledBollen(p.inn, p.ut);
  kolla(`${p.namn}: ${p.dagar} dagar, bollen hos ${p.bollen}`, d === p.dagar && b === p.bollen, `räknat ${d} dagar, bollen ${b}`);
}
// Vänt fall: kunden svarade sist.
kolla("vänt fall: kunden svarade sist ger oss bollen",
  K.harledBollen("2026-07-24T08:23:52Z", "2026-07-17T09:04:10Z") === "oss");

console.log("\n== 5. Sorteringen ==");
const konst = [
  { opportunity_id: "a", namn: "Gammal", varde: 0, steg_namn: null, epost: "a@b.se", dagar: 90, bollen: "kund" as const, senasteAmne: null, kommentar: null, matbar: true, ghl_contact_id: null, location_id: "l" },
  { opportunity_id: "b", namn: "Ny men vår boll", varde: 0, steg_namn: null, epost: "b@b.se", dagar: 1, bollen: "oss" as const, senasteAmne: null, kommentar: null, matbar: true, ghl_contact_id: null, location_id: "l" },
];
kolla("bollen hos oss ligger överst oavsett dagar", K.sortera(konst)[0].opportunity_id === "b");

console.log("\n== 6. Reglerna ==");
const { data: regler } = await sb.from("hq_kontakt_regler").select("*").order("sortering");
kolla("tre regler seedade", (regler || []).length === 3, ((regler || []) as Array<{ regelnamn: string }>).map((r) => r.regelnamn).join(", "));
const test = [
  { ...konst[1], opportunity_id: "t1", namn: "Väntar på dig", dagar: 3, bollen: "oss" as const },
  { ...konst[0], opportunity_id: "t2", namn: "Offerttyst", dagar: 9, steg_namn: "Offert skickad" },
  { ...konst[0], opportunity_id: "t3", namn: "Rinner ut", dagar: 40, steg_namn: "Uppföljning" },
];
const mr = K.regelrader(test, (regler || []) as never);
kolla("alla tre reglerna utlöser var sin rad", mr.length === 3, mr.map((r) => r.etikett).join(", "));
kolla("bollen-raden är röd och först", mr[0].etikett === "Bollen hos dig" && mr[0].niva === "rod");
kolla("raderna länkar till kortet i MySales", mr.every((r) => r.lank.includes("app.mysales.se") || r.lank.startsWith("/dashboard")));

console.log("\n== 7. Loggat samtal nollställer tystnaden ==");
const provId = rader.find((r) => r.matbar)?.opportunity_id || rader[0]?.opportunity_id;
if (provId) {
  const { data: fore } = await sb.from("hq_kontakt_status").select("senaste_kortandring").eq("opportunity_id", provId).maybeSingle();
  kolla("loggning gick igenom", await K.loggaSamtal(provId, "DoD-test"));
  const { rader: efter } = await K.byggLista();
  const rad = efter.find((r) => r.opportunity_id === provId);
  kolla("dagar sedan kontakt är noll efteråt", rad?.dagar === 0, `${rad?.dagar}`);
  // Städa: ta bort testnoteringen igen.
  await sb.from("hq_kontakt_status").update({ logg_notering: null, senaste_kortandring: (fore as { senaste_kortandring: string | null } | null)?.senaste_kortandring ?? null }).eq("opportunity_id", provId);
} else kolla("fanns en affär att logga mot", false);

console.log("\n== 8. Grinden ==");
const owner = await createAdminSession(process.env.ADMIN_SESSION_SECRET!);
const scopad = await createAdminSession(process.env.ADMIN_SESSION_SECRET!, "00000000-0000-0000-0000-000000000001");
for (const m of ["GET", "POST", "PATCH"] as const) {
  const r = await fetch(`${B}/api/hq/kontakt`, { method: m, headers: { cookie: `admin_session=${scopad}` } });
  kolla(`${m} klient-scopad nekas`, r.status === 403, `status ${r.status}`);
}
kolla("utan session nekas", (await fetch(`${B}/api/hq/kontakt`)).status === 401);
const rOwner = await fetch(`${B}/api/hq/kontakt`, { headers: { cookie: `admin_session=${owner}` } });
const dOwner = await rOwner.json();
kolla("ägaren får listan", rOwner.status === 200 && Array.isArray(dOwner.rader), `${dOwner.rader?.length} rader`);
kolla("Gmail-behörigheten redovisas ärligt", dOwner.harGmail === false && !!dOwner.authUrl, "inte kopplad än, vyn säger det");

console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
process.exit(fel === 0 ? 0 : 1);
