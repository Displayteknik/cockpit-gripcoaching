// ETAPP K2-1 DoD — creditledgern mot den RIKTIGA databasen.
//
// Enhetstesterna (tests/k2-credits.test.ts) kör mot en fejkad klient och bevisar logiken.
// Det här skriptet bevisar det som bara verklig SQL kan bevisa: att tabellerna, checkarna
// och främmande nyckeln till ai_usage_events faktiskt håller.
//
// Ingen skarp klient rörs: allt körs mot ett kast-tenant-id som städas bort sist.
// Entitlement-vägen (modulen på för en riktig kund) hör till K2-4 och testas inte här.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/k2-1-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { supabaseService } = await import("@/lib/supabase-admin");
const { loggaHandelse } = await import("@/lib/ai-usage");
const credits = await import("@/lib/credits");
const sb = supabaseService();

const TENANT = "00000000-0000-0000-0000-00000000d0d1"; // kast-id (giltig hex), finns inte som klient
const FLOW = "dod-k2-1";
let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

try {
  // 1. Nytt konto skapas med standardkvot och innevarande period.
  const konto = await credits.sakerstallKonto(TENANT);
  kolla("konto skapas med standardkvoten", konto?.monthly_quota === credits.STANDARDKVOT, String(konto?.monthly_quota));
  kolla("perioden är innevarande månad, svensk tid", konto?.period_start === credits.aktuellPeriod(), String(konto?.period_start));

  // 2. En mediahändelse i ledgern → en dragning som PEKAR på den raden.
  const handelseId = await loggaHandelse({
    provider: "gemini",
    model: "gemini-2.5-flash-image",
    flow: FLOW,
    tenantId: TENANT,
    mediaUnits: 1,
    tokensIn: 0,
    tokensUt: 0,
    status: "ok",
    latencyMs: 10,
  });
  kolla("ledgerraden skrevs och gav ett id", !!handelseId);

  const kostnad = await credits.dragCredits({ tenantId: TENANT, atgard: "social-bild", usageEventId: handelseId });
  kolla("dragningen kostade prislistans pris", kostnad === 3, `${kostnad} credits`);

  const { data: tx } = await sb
    .from("credit_transactions")
    .select("delta, type, usage_event_id")
    .eq("tenant_id", TENANT)
    .eq("type", "usage");
  const rader = (tx || []) as Array<{ delta: number; usage_event_id: string | null }>;
  kolla("exakt EN usage-transaktion", rader.length === 1, `${rader.length} st`);
  // ★ Kärnkravet i beställningen: credits får aldrig mäta något annat än ledgern.
  kolla("transaktionen pekar på ledgerraden", rader[0]?.usage_event_id === handelseId, String(rader[0]?.usage_event_id));

  const saldo = await credits.hamtaSaldo(TENANT);
  kolla("saldot minskade med dragningen", saldo?.saldo === credits.STANDARDKVOT - 3, String(saldo?.saldo));

  // 3. Främmande nyckeln håller: ett påhittat händelse-id ska inte gå att spara.
  const { error: fkFel } = await sb.from("credit_transactions").insert({
    tenant_id: TENANT,
    delta: -3,
    type: "usage",
    usage_event_id: "11111111-1111-1111-1111-111111111111",
  });
  kolla("okänt händelse-id avvisas av databasen", !!fkFel, fkFel?.message?.slice(0, 60) || "gick igenom (FEL)");

  // 4. Statuscheckarna håller.
  const { error: typFel } = await sb.from("credit_transactions").insert({ tenant_id: TENANT, delta: 1, type: "hittepa" });
  kolla("okänd transaktionstyp avvisas", !!typFel, typFel?.message?.slice(0, 60) || "gick igenom (FEL)");

  // 5. Månadsreset: sätt perioden bakåt och kör den lata vägen.
  await sb.from("credit_accounts").update({ period_start: "2026-07-01", used_this_period: 210 }).eq("tenant_id", TENANT);
  const efter = await credits.sakerstallKonto(TENANT);
  kolla("resetten nollställde förbrukningen", efter?.used_this_period === 0, String(efter?.used_this_period));
  kolla("resetten flyttade fram perioden", efter?.period_start === credits.aktuellPeriod(), String(efter?.period_start));
  const { data: resetTx } = await sb.from("credit_transactions").select("type").eq("tenant_id", TENANT).eq("type", "monthly_reset");
  kolla("resetten loggades", (resetTx || []).length === 1, `${(resetTx || []).length} st`);

  // 6. Påfyllningsflödet är spårbart.
  const order = await credits.skapaTopupOrder(TENANT);
  kolla("beställningen ger kundens besked", order.besked.includes("aktiveras inom kort"), order.besked);
  const { data: o } = await sb.from("topup_orders").select("id, status, credits, price_sek").eq("tenant_id", TENANT).maybeSingle();
  const orderRad = o as { id: string; status: string; credits: number; price_sek: number } | null;
  if (!orderRad) throw new Error("topup_orders-raden skrevs aldrig");
  kolla("beställningen ligger som pending, 100 credits för 149 kr", orderRad?.status === "pending" && orderRad?.credits === 100 && Number(orderRad?.price_sek) === 149);

  await credits.beslutaTopupOrder(orderRad.id, true, "dod");
  const saldoEfter = await credits.hamtaSaldo(TENANT);
  kolla("godkännandet satte in creditsen", saldoEfter?.extra === 100, String(saldoEfter?.extra));
} finally {
  // Städning — inga DoD-spår lämnas kvar.
  await sb.from("credit_transactions").delete().eq("tenant_id", TENANT);
  await sb.from("topup_orders").delete().eq("tenant_id", TENANT);
  await sb.from("credit_accounts").delete().eq("tenant_id", TENANT);
  const { count } = await sb.from("ai_usage_events").delete({ count: "exact" }).eq("flow", FLOW);
  console.log(`\nStädat: kast-tenanten borttagen, ${count ?? 0} ledgerrad(er) raderade.`);
}

console.log(fel === 0 ? "\nDoD K2-1: ALLA KONTROLLER GRÖNA." : `\nDoD K2-1: ${fel} kontroll(er) misslyckades.`);
process.exit(fel === 0 ? 0 : 1);
