// PROFIL-2 DoD — går materialet in, och RÖR DET MÄTAREN?
//
// Enhetstesterna bevisar att koden skriver rätt fält. De bevisar inte att kundens
// inmatning faktiskt får kvalitetsnivån att stiga — och det är hela löftet: åtgärden
// säger "Lägg till 3 kundberättelser", alltså måste tre berättelser räknas.
//
// Kör:  node scripts/profil2-dod.mjs      (kräver dev-servern igång)
// Städar sina egna rader efteråt.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";

const BASE = process.env.G1_BASE || "http://localhost:3480";
const PROJEKT = "liunepzrmygiaaibsbni";

function readVar(fil, namn) {
  try {
    const t = readFileSync(resolve(process.cwd(), fil), "utf8");
    return (t.match(new RegExp(`^\\s*${namn}\\s*=\\s*(.+)\\s*$`, "m"))?.[1] || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}
const b64url = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const SECRET = readVar(".env.local", "ADMIN_SESSION_SECRET");
const PAT = process.env.SUPABASE_ACCESS_TOKEN || readVar("../.shared-keys.env", "SUPABASE_ACCESS_TOKEN");
if (!SECRET || !PAT) { console.error("Saknar nycklar"); process.exit(1); }
const exp = Math.floor(Date.now() / 1000) + 3600;
const COOKIE = `admin_session=${exp}.${b64url(crypto.createHmac("sha256", SECRET).update(String(exp)).digest())}`;

async function fraga(sql, forsok = 3) {
  for (let i = 1; i <= forsok; i++) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const t = await r.text();
    if (r.ok) return JSON.parse(t);
    if (i === forsok || (r.status < 500 && r.status !== 429)) throw new Error(`Management API ${r.status}: ${t.slice(0, 200)}`);
    await new Promise((k) => setTimeout(k, 2000 * i));
  }
}
const anrop = async (vag, init = {}) => {
  const r = await fetch(`${BASE}${vag}`, { ...init, headers: { "Content-Type": "application/json", cookie: COOKIE, ...(init.headers || {}) } });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
};

let fel = 0;
const kolla = (ok, t) => { console.log(`${ok ? "OK  " : "FEL "} ${t}`); if (!ok) fel++; };
const MARK = `PROFIL2-DOD-${exp}`;
const skapade = { berattelse: [], kundord: [] };

console.log(`# PROFIL-2 DoD — ${BASE}\n`);

const fore = await anrop("/api/profile/quality");
kolla(fore.ok, `Kvalitetsmätaren svarar: nivå ${fore.data?.niva} (${fore.data?.niva_namn})`);
const foreBerattelser = (await anrop("/api/profile/material")).data?.berattelser?.length ?? 0;
console.log(`     Berättelser före: ${foreBerattelser}`);

// ── Tre berättelser, precis vad åtgärden ber om ──
for (let i = 1; i <= 3; i++) {
  const r = await anrop("/api/profile/material", {
    method: "POST",
    body: JSON.stringify({
      typ: "berattelse",
      rubrik: `${MARK} berättelse ${i}`,
      text: `En kund hörde av sig i mars och hade väntat i tre år på att göra något åt det. Vi löste det på en vecka. (${MARK})`,
      resultat: "Kunden kom tillbaka med ett andra uppdrag",
    }),
  });
  if (r.data?.id) skapade.berattelse.push(r.data.id);
  kolla(r.ok && !!r.data?.id, `Berättelse ${i} sparad`);
}

// ── Ett kundcitat ──
{
  const r = await anrop("/api/profile/material", {
    method: "POST",
    body: JSON.stringify({ typ: "kundord", fras: `${MARK} jag trodde det skulle vara krångligare`, kategori: "objection", sammanhang: "efter första mötet" }),
  });
  if (r.data?.id) skapade.kundord.push(r.data.id);
  kolla(r.ok && !!r.data?.id, "Kundcitat sparat");
}

// ── Grinden: tomt innehåll ska nekas, inte räknas ──
{
  const r = await anrop("/api/profile/material", { method: "POST", body: JSON.stringify({ typ: "berattelse", rubrik: "x", text: "kort" }) });
  kolla(r.status === 400, `För kort berättelse nekas (HTTP ${r.status}) — tomhet får inte räknas som material`);
}

// ── Läser mätaren det som lagts in? ──
const efterMaterial = await anrop("/api/profile/material");
const nyaBerattelser = (efterMaterial.data?.berattelser?.length ?? 0) - foreBerattelser;
kolla(nyaBerattelser === 3, `Ytan visar de tre nya berättelserna (${nyaBerattelser})`);

const efter = await anrop("/api/profile/quality");
const kritEfter = (efter.data?.kriterier || []).find((k) => k.key === "berattelser");
const kritFore = (fore.data?.kriterier || []).find((k) => k.key === "berattelser");
console.log(`     Kriteriet "${kritEfter?.label}": ${kritFore?.antal} → ${kritEfter?.antal}`);
// KÄRNAN i hela etappen: mätaren måste ha rört sig, annars är löftet fortfarande tomt.
kolla((kritEfter?.antal ?? 0) >= (kritFore?.antal ?? 0) + 3, "Mätaren räknade de manuellt inskrivna berättelserna");

// ── Städning ──
for (const id of skapade.berattelse) await anrop(`/api/profile/material?typ=berattelse&id=${id}`, { method: "DELETE" });
for (const id of skapade.kundord) await fraga(`delete from public.customer_voice where id = '${id}';`);
const kvar = (await anrop("/api/profile/material")).data?.berattelser?.length ?? 0;
kolla(kvar === foreBerattelser, `Städat — tillbaka på ${kvar} berättelser (var ${foreBerattelser})`);

console.log(fel === 0 ? "\nPROFIL-2 DoD GRÖN" : `\nPROFIL-2 DoD RÖD — ${fel} kontroll(er) föll.`);
process.exit(fel === 0 ? 0 : 1);
