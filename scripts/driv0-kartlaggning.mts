// DRIV-0 — engångs kartläggningsskript. READ-ONLY mot både Supabase och GHL.
// Skriver ingenting, rör ingenting. Körs en gång för rapporten till Håkan.
import { supabaseService } from "../lib/supabase-admin";
import { hamtaHqGhl } from "../lib/hq/pipeline";
import { kopplingsScope, hamtaKoppling, agarToken } from "../lib/hq/kalender";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

function h(pit: string) {
  return { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
}

console.log("\n=== 1. GHL — DT:s nuvarande nyckel(-lar) ===");
const sb = supabaseService();

const { data: dtClient } = await sb
  .from("clients")
  .select("id, name, ghl_location_id, ghl_pit")
  .or("id.eq.a6a33547-5ca7-475f-9a62-43ff2c74d000,name.ilike.Displayteknik");
console.log("clients-rader:", JSON.stringify(dtClient, null, 2)?.replace(/"ghl_pit":\s*"[^"]{0,12}[^"]*"/g, (m) => m.slice(0, m.indexOf(":") + 14) + "…\""));

const cfg = await hamtaHqGhl();
if (!cfg) {
  console.log("hamtaHqGhl(): INGEN koppling hittad.");
} else {
  console.log(`hamtaHqGhl(): locationId=${cfg.locationId} kalla=${cfg.kalla} pit-borjan=${cfg.pit.slice(0, 12)}…`);

  console.log("\n=== 2. Live-prov mot GHL — conversations + tasks (LÄSNING, ingen skrivning) ===");
  const prov: Array<{ scope: string; url: string }> = [
    { scope: "conversations.readonly (GET /conversations/search)", url: `${BASE}/conversations/search?locationId=${cfg.locationId}&limit=1` },
    { scope: "opportunities.readonly (redan känt, kontroll)", url: `${BASE}/opportunities/pipelines?locationId=${cfg.locationId}` },
    { scope: "contacts.readonly (GET /contacts)", url: `${BASE}/contacts/?locationId=${cfg.locationId}&limit=1` },
  ];
  let forstaKontaktId: string | null = null;
  let forstaConversationId: string | null = null;
  for (const p of prov) {
    try {
      const r = await fetch(p.url, { headers: h(cfg.pit) });
      const body = await r.text();
      console.log(`${r.ok ? "OK " : "FEL"} ${r.status}  ${p.scope}`);
      if (p.scope.startsWith("contacts.readonly")) {
        try { forstaKontaktId = JSON.parse(body)?.contacts?.[0]?.id || null; } catch {}
      }
      if (p.scope.startsWith("conversations.readonly")) {
        try { forstaConversationId = JSON.parse(body)?.conversations?.[0]?.id || null; } catch {}
        if (!r.ok) console.log("   svar:", body.slice(0, 300));
      }
    } catch (e) {
      console.log(`FEL (nätverk) ${p.scope}:`, (e as Error).message);
    }
  }
  if (forstaConversationId) {
    const r = await fetch(`${BASE}/conversations/${forstaConversationId}/messages`, { headers: h(cfg.pit) });
    console.log(`${r.ok ? "OK " : "FEL"} ${r.status}  conversations/message.readonly (GET /conversations/{id}/messages)`);
    if (!r.ok) console.log("   svar:", (await r.text()).slice(0, 300));
  } else {
    console.log("(ingen konversation hittades att testa message.readonly mot — troligen conversations.readonly som saknas, se ovan)");
  }
  if (forstaKontaktId) {
    const r = await fetch(`${BASE}/contacts/${forstaKontaktId}/tasks`, { headers: h(cfg.pit) });
    console.log(`${r.ok ? "OK " : "FEL"} ${r.status}  contacts.readonly → tasks (GET /contacts/{id}/tasks)`);
  }
}

console.log("\n=== 3. Google — ägarens koppling (hq_google_koppling) ===");
const koppling = await hamtaKoppling();
const scope = await kopplingsScope();
console.log("hamtaKoppling():", koppling);
console.log("kopplingsScope():", scope);

console.log("\n=== 4. google_connections — per-tenant (Search Console) ===");
const { data: gc } = await sb.from("google_connections").select("client_id, gsc_site, ga_property_id, updated_at");
console.log(JSON.stringify(gc, null, 2));

console.log("\n=== 5. Datainventering — hq_pipeline_cache (DT) ===");
const { data: pipe } = await sb.from("hq_pipeline_cache").select("ghl_opportunity_id, epost, harledd_status, ghl_contact_id");
const alla = pipe || [];
const medEpost = alla.filter((r: any) => r.epost);
console.log(`Totalt affärer i spegeln: ${alla.length}`);
console.log(`  — med e-post: ${medEpost.length}`);
console.log(`  — utan e-post: ${alla.length - medEpost.length}`);
const unikaEpost = new Set(medEpost.map((r: any) => r.epost));
console.log(`  — unika e-postadresser: ${unikaEpost.size}`);
// dubbletter: samma epost på fler än en affär
const perEpost = new Map<string, number>();
for (const r of medEpost as any[]) perEpost.set(r.epost, (perEpost.get(r.epost) || 0) + 1);
const delade = [...perEpost.entries()].filter(([, n]) => n > 1);
console.log(`  — e-postadresser som delas av flera affärer: ${delade.length}`, delade.slice(0, 10));

console.log("\n=== 6. hq_kontakt_status (redan levande Gmail-matchning via KONTAKT-1) ===");
const { data: ks } = await sb.from("hq_kontakt_status").select("opportunity_id, bollen_hos, senaste_in_datum, senaste_ut_datum");
const ksAlla = ks || [];
const bollenCount: Record<string, number> = {};
for (const r of ksAlla as any[]) bollenCount[r.bollen_hos] = (bollenCount[r.bollen_hos] || 0) + 1;
console.log(`Rader i hq_kontakt_status: ${ksAlla.length}`, bollenCount);

console.log("\n=== 7. Offertmotorn — offert_quotes (DT) ===");
const { data: quotes } = await sb.from("offert_quotes").select("id, ghl_contact_id, ghl_opportunity_id, status, customer_name, sent_at");
const qAlla = quotes || [];
console.log(`Totalt offerter: ${qAlla.length}`);
console.log(`  — med ghl_contact_id: ${qAlla.filter((q: any) => q.ghl_contact_id).length}`);
console.log(`  — med ghl_opportunity_id: ${qAlla.filter((q: any) => q.ghl_opportunity_id).length}`);
console.log(`  — utan någon GHL-koppling alls: ${qAlla.filter((q: any) => !q.ghl_contact_id && !q.ghl_opportunity_id).length}`);

console.log("\n=== 8. Gmail — riktig trådräkning senaste 12 mån (endast om Gmail är kopplat) ===");
if (scope?.harGmail) {
  const token = await agarToken();
  let totalMatchade = 0;
  let kontakterMedTrad = 0;
  const efter = Math.floor((Date.now() - 365 * 86400000) / 1000);
  for (const r of medEpost.slice(0, 30) as any[]) {
    try {
      const q = `(from:${r.epost} OR to:${r.epost}) after:${efter}`;
      const resp = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) { console.log(`  FEL ${resp.status} för ${r.epost}`); continue; }
      const d = (await resp.json()) as { resultSizeEstimate?: number };
      const est = d.resultSizeEstimate || 0;
      if (est > 0) { kontakterMedTrad++; totalMatchade += est; }
    } catch (e) { console.log(`  nätverksfel för ${r.epost}:`, (e as Error).message); }
  }
  console.log(`Testade ${Math.min(30, medEpost.length)} av ${medEpost.length} adresser (första 30, för att inte belasta Gmail-kvoten i onödan).`);
  console.log(`  — adresser med minst ett Gmail-meddelande senaste 12 mån: ${kontakterMedTrad}`);
  console.log(`  — ungefärligt antal meddelanden (resultSizeEstimate-summa): ${totalMatchade}`);
} else {
  console.log("Gmail INTE kopplat (harGmail=false) — kan inte mätas. Se avsnitt 3.");
}

console.log("\n=== KLART ===");
