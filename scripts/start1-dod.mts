// START-1 DoD — kontrollerna mot RIKTIG data, spärren och morgonlistan.
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/start1-dod.mts
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const { supabaseService } = await import("@/lib/supabase-admin");
const { koraKontroller } = await import("@/lib/hq/uppstart");
const { createAdminSession } = await import("@/lib/admin-auth");
const sb = supabaseService();
const B = "http://localhost:3481";
const owner = await createAdminSession(process.env.ADMIN_SESSION_SECRET!);
const H = { cookie: `admin_session=${owner}`, "Content-Type": "application/json" };

let fel = 0;
const kolla = (n: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "FEL "} ${n}${extra ? ` — ${extra}` : ""}`); if (!ok) fel++; };

console.log("\n== 1. Server-only ==");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
for (const t of ["hq_uppstart_steg", "hq_uppstart_kontroll"]) {
  const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const rader = r.ok ? await r.json() : [];
  kolla(`${t}: anon ser noll rader`, Array.isArray(rader) && rader.length === 0, `status ${r.status}`);
  const w = await fetch(`${URL}/rest/v1/${t}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(t === "hq_uppstart_steg" ? { id: "anon", titel: "x", varfor: "x", kategori: "drift" } : { steg_id: "ms-pit", kontrolltyp: "banksaldo_saknas" }) });
  kolla(`${t}: anon nekas skrivning`, w.status === 401 || w.status === 403, `status ${w.status}`);
}

console.log("\n== 2. Nitton steg seedade ==");
const { data: steg } = await sb.from("hq_uppstart_steg").select("id, kategori, status, egen");
kolla("19 steg", (steg || []).length === 19, `${(steg || []).length} st`);
for (const [kat, n] of [["mysales", 6], ["ekonomi", 5], ["drift", 3], ["cockpit", 3], ["kalender", 2]] as const) {
  kolla(`${kat}: ${n} steg`, (steg || []).filter((s: { kategori: string }) => s.kategori === kat).length === n);
}

console.log("\n== 3. Kontrollerna mot riktig data ==");
await koraKontroller(true);
const { data: k } = await sb.from("hq_uppstart_kontroll").select("steg_id, kontrolltyp, resultat_text, uppfyllt, senast_kord");
for (const rad of (k || []) as Array<{ steg_id: string; kontrolltyp: string; resultat_text: string | null; uppfyllt: boolean; senast_kord: string | null }>) {
  kolla(`${rad.kontrolltyp}`, !!rad.senast_kord && !!rad.resultat_text, `${rad.uppfyllt ? "uppfyllt" : "ej uppfyllt"}: ${rad.resultat_text}`);
}
kolla("sex kontroller körda", (k || []).length === 6);

console.log("\n== 4. Spärren: kan inte bockas av medan mätningen säger nej ==");
const ejUppfyllt = ((k || []) as Array<{ steg_id: string; uppfyllt: boolean }>).find((x) => !x.uppfyllt);
if (ejUppfyllt) {
  const r = await fetch(`${B}/api/hq/uppstart`, { method: "PATCH", headers: H, body: JSON.stringify({ id: ejUppfyllt.steg_id, status: "klar" }) });
  const j = await r.json();
  kolla("avbockning nekas med klartext", r.status === 409 && !!j.error, j.error?.slice(0, 90));
  const { data: efter } = await sb.from("hq_uppstart_steg").select("status").eq("id", ejUppfyllt.steg_id).maybeSingle();
  kolla("steget står kvar som ogjort", (efter as { status: string }).status !== "klar");
} else {
  kolla("fanns en ej uppfylld kontroll att prova mot", false, "alla var uppfyllda");
}

console.log("\n== 5. Steg utan kontroll bockas av manuellt ==");
const r5 = await fetch(`${B}/api/hq/uppstart`, { method: "PATCH", headers: H, body: JSON.stringify({ id: "dr-replit", status: "klar" }) });
kolla("dr-replit kunde bockas av", r5.status === 200);
await fetch(`${B}/api/hq/uppstart`, { method: "PATCH", headers: H, body: JSON.stringify({ id: "dr-replit", status: "att_gora" }) });

console.log("\n== 6. Skjut upp bevarar steget ==");
await fetch(`${B}/api/hq/uppstart`, { method: "PATCH", headers: H, body: JSON.stringify({ id: "ck-blindtest", status: "skjutet", anteckning: "DoD-test" }) });
const { data: skjutet } = await sb.from("hq_uppstart_steg").select("status, anteckning").eq("id", "ck-blindtest").maybeSingle();
kolla("skjutet steg finns kvar med anteckning", (skjutet as { status: string; anteckning: string }).status === "skjutet" && (skjutet as { anteckning: string }).anteckning === "DoD-test");
await fetch(`${B}/api/hq/uppstart`, { method: "PATCH", headers: H, body: JSON.stringify({ id: "ck-blindtest", status: "att_gora", anteckning: "" }) });

console.log("\n== 7. Egna steg ==");
const r7 = await fetch(`${B}/api/hq/uppstart`, { method: "POST", headers: H, body: JSON.stringify({ titel: "DoD eget steg", varfor: "test", kategori: "drift", uppskattad_tid_min: 5, sortering: 999 }) });
const j7 = await r7.json();
kolla("eget steg skapades", r7.status === 200 && !!j7.id);
const rDel = await fetch(`${B}/api/hq/uppstart?id=${j7.id}`, { method: "DELETE", headers: H });
kolla("eget steg gick att ta bort", rDel.status === 200);
const rSeed = await fetch(`${B}/api/hq/uppstart?id=ms-pit`, { method: "DELETE", headers: H });
kolla("seedat steg går INTE att ta bort", rSeed.status === 400, (await rSeed.json()).error);

console.log("\n== 8. Morgonlistan ==");
const hq = await fetch(`${B}/api/hq`, { headers: H });
const d = await hq.json();
const rad = (d.morgonlistan?.larm || []).find((l: { id: string }) => l.id === "uppstart");
kolla("uppstartsraden ligger överst", d.morgonlistan?.larm?.[0]?.id === "uppstart", rad?.text);
const kvarRiktigt = ((steg || []) as Array<{ status: string }>).filter((s) => s.status !== "klar" && s.status !== "skjutet").length;
kolla("antalet stämmer med databasen", (rad?.text || "").includes(`${kvarRiktigt} steg kvar`), `${kvarRiktigt} kvar`);
kolla("uppstartssteg dubbleras inte som uppgifter", !(d.morgonlistan?.uppgifter || []).some((u: { titel: string }) => (steg || []).some((s: { id: string }) => false) || /uppföljningsdatum på alla affärer/i.test(u.titel)));

console.log("\n== 9. Grinden ==");
const scopad = await createAdminSession(process.env.ADMIN_SESSION_SECRET!, "00000000-0000-0000-0000-000000000001");
for (const [n, m] of [["GET", "GET"], ["PATCH", "PATCH"], ["POST", "POST"], ["DELETE", "DELETE"]] as const) {
  const r = await fetch(`${B}/api/hq/uppstart?id=x`, { method: m, headers: { cookie: `admin_session=${scopad}` } });
  kolla(`${n} klient-scopad nekas`, r.status === 403, `status ${r.status}`);
}
const rUtan = await fetch(`${B}/api/hq/uppstart`);
kolla("utan session nekas", rUtan.status === 401);

console.log(`\n${fel === 0 ? "ALLT GRÖNT" : `${fel} KONTROLLER FALLERADE`}`);
process.exit(fel === 0 ? 0 : 1);
