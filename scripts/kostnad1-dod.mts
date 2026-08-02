// KOSTNAD-1 DoD — skarpt bevis för de två sakerna som inte går att verifiera statiskt:
//
//   Del 1: ett mockat 402 med betalningskropp ger felklass "billing" och gör tjänsten
//          RÖD i provider-hälsan, med HELA svarskroppen sparad.
//   Del 2: ett riktigt Gemini-anrop genom lib/gemini landar som en rad i ai_usage_events
//          med tokens och en kostnad större än noll.
//
// Del 1 kör mot en lokal HTTP-server, inte mot en provider — hela poängen är att kunna
// framkalla ett betalningsfel utan att spärra ett riktigt konto.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kostnad1-dod.mts
//
// Bieffekt som städas: raderna skrivs med flow "dod-kostnad1" och raderas sist.

import { readFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { anropaProvider } = await import("@/lib/ai-usage");
const { generate } = await import("@/lib/gemini");
const { supabaseService } = await import("@/lib/supabase-admin");
const sb = supabaseService();

const FLOW = "dod-kostnad1";
let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

// ── Del 1: mockat betalningsfel ────────────────────────────────────────────
const DUNNING = JSON.stringify({
  error: { code: 402, message: "Lightning dunning decision is deny for project: projects/773740289261", status: "PERMISSION_DENIED" },
});

const server = http.createServer((_req, res) => {
  res.writeHead(402, { "Content-Type": "application/json" });
  res.end(DUNNING);
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;

const t0 = Date.now();
const svar = await anropaProvider({
  provider: "gemini",
  model: "gemini-2.5-flash",
  flow: FLOW,
  tenantId: null,
  url: `http://127.0.0.1:${port}/v1beta/models/gemini-2.5-flash:generateContent`,
  init: { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
});
server.close();

kolla("402 klassas som billing", svar.felklass === "billing", `felklass=${svar.felklass}`);
kolla("anroparen får klartext, inte rå JSON", !!svar.fel && svar.fel.includes("betalningsfel"), svar.fel || "");

const { data: felrad } = await sb
  .from("ai_usage_events")
  .select("provider, status, error_class, http_status, error_body, flow")
  .eq("flow", FLOW)
  .eq("status", "error")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

kolla("felet finns i ledgern", !!felrad);
kolla("HELA svarskroppen är sparad", (felrad?.error_body || "") === DUNNING, `${(felrad?.error_body || "").length} tecken`);
kolla("http_status är sparad", felrad?.http_status === 402, String(felrad?.http_status));

const { data: halsa } = await sb.from("ai_provider_health").select("*").eq("provider", "gemini").maybeSingle();
const h = halsa as { senaste_ok: string | null; senaste_fel: string | null; senaste_felklass: string | null } | null;
const felNyare = !!h?.senaste_fel && (!h.senaste_ok || new Date(h.senaste_fel) > new Date(h.senaste_ok));
kolla("provider-hälsan visar felet som det senaste", felNyare, `ok=${h?.senaste_ok} fel=${h?.senaste_fel}`);
kolla("provider-hälsan bär felklassen (RÖD i adminvyn)", h?.senaste_felklass === "billing", String(h?.senaste_felklass));
kolla("larmet syns inom en minut", Date.now() - t0 < 60_000, `${Date.now() - t0} ms`);

// ── Del 2: riktigt Gemini-anrop → kostnad i ledgern ────────────────────────
let text = "";
try {
  text = await generate({
    model: "gemini-2.5-flash",
    prompt: "Svara med exakt ordet: kvitto",
    maxOutputTokens: 20,
    skrivregler: false,
    flow: FLOW,
    tenantId: null,
  });
} catch (e) {
  console.log("    (Gemini svarade inte: " + (e as Error).message.slice(0, 200) + ")");
}

const { data: okrad } = await sb
  .from("ai_usage_events")
  .select("tokens_in, tokens_out, estimated_cost_sek, model, latency_ms")
  .eq("flow", FLOW)
  .eq("status", "ok")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const o = okrad as { tokens_in: number; tokens_out: number; estimated_cost_sek: number; latency_ms: number } | null;
kolla("riktigt anrop loggades", !!o, text ? `svar: "${text.trim().slice(0, 40)}"` : "");
kolla("tokens plockades ur svaret", (o?.tokens_in || 0) > 0 && (o?.tokens_out || 0) > 0, `in=${o?.tokens_in} ut=${o?.tokens_out}`);
kolla("kostnaden är större än noll", Number(o?.estimated_cost_sek) > 0, `${o?.estimated_cost_sek} kr`);
kolla("svarstiden mättes", (o?.latency_ms || 0) > 0, `${o?.latency_ms} ms`);

// ── Städning ───────────────────────────────────────────────────────────────
const { count } = await sb.from("ai_usage_events").delete({ count: "exact" }).eq("flow", FLOW);
console.log(`\nStädat: ${count ?? 0} DoD-rader borttagna ur ai_usage_events.`);
console.log(fel === 0 ? "\nDoD: ALLA KONTROLLER GRÖNA." : `\nDoD: ${fel} kontroll(er) misslyckades.`);
process.exit(fel === 0 ? 0 : 1);
