// ETAPP K2-3 DoD — ägaråtgärderna mot den RIKTIGA databasen.
//
// Det enhetstesterna inte kan visa: att kvotändring, prisändring och manuell insättning
// faktiskt skriver rätt rader, att noteringen är obligatorisk, och att ett nytt creditpris
// slår igenom DIREKT (cachen töms) i stället för att gälla först om fem minuter.
//
// Ingen skarp klient rörs: kast-tenant-id som städas bort sist. Creditpriset återställs.
//
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/k2-3-dod.mts

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const { supabaseService } = await import("@/lib/supabase-admin");
const credits = await import("@/lib/credits");
const sb = supabaseService();

const TENANT = "00000000-0000-0000-0000-00000000d0d3";
let fel = 0;
const kolla = (namn: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FEL "} ${namn}${extra ? ` — ${extra}` : ""}`);
  if (!ok) fel++;
};

const ursprungsprisRad = await sb.from("credit_pricing").select("credits").eq("action", "social-bild").maybeSingle();
const ursprungspris = Number((ursprungsprisRad.data as { credits: number } | null)?.credits) || 3;

try {
  await credits.sakerstallKonto(TENANT);

  // 1. Kvoten går att ändra per klient och slår igenom i saldot.
  await sb.from("credit_accounts").update({ monthly_quota: 500 }).eq("tenant_id", TENANT);
  const efterKvot = await credits.hamtaSaldo(TENANT);
  kolla("kvoten går att ändra per klient", efterKvot?.kvot === 500, String(efterKvot?.kvot));
  kolla("saldot följer den nya kvoten", efterKvot?.saldo === 500, String(efterKvot?.saldo));

  // 2. Manuell insättning KRÄVER en notering.
  const utanNotering = await credits.laggTillCredits({ tenantId: TENANT, credits: 50, typ: "manual_grant", note: "  " });
  kolla("insättning utan notering avvisas", utanNotering === false);

  const medNotering = await credits.laggTillCredits({
    tenantId: TENANT, credits: 50, typ: "manual_grant",
    note: "Kompensation för avbruten körning 2/8", createdBy: "owner",
  });
  kolla("insättning med notering går igenom", medNotering === true);

  const { data: tx } = await sb
    .from("credit_transactions")
    .select("delta, note, created_by")
    .eq("tenant_id", TENANT)
    .eq("type", "manual_grant")
    .maybeSingle();
  const t = tx as { delta: number; note: string; created_by: string } | null;
  kolla("insättningen är spårbar med skäl och avsändare", t?.delta === 50 && !!t?.note && t?.created_by === "owner", t?.note || "");

  const efterInsattning = await credits.hamtaSaldo(TENANT);
  kolla("saldot ökade med insättningen", efterInsattning?.saldo === 550, String(efterInsattning?.saldo));

  // 3. Nytt creditpris ska gälla DIREKT, inte när cachen råkar löpa ut.
  const foreAndring = await credits.creditPris("social-bild");
  await sb.from("credit_pricing").update({ credits: 7 }).eq("action", "social-bild");
  const utanTomning = await credits.creditPris("social-bild");
  kolla("priset cachas (annars mäter vi inget)", utanTomning === foreAndring, `${utanTomning}`);

  credits.nollstallCreditPrisCache();
  const efterTomning = await credits.creditPris("social-bild");
  kolla("efter tömd cache gäller det nya priset direkt", efterTomning === 7, String(efterTomning));

  // 4. Larmet om felprissatta credits, med de siffror det gäller.
  kolla("larm när kronorna tar slut men credits finns kvar", credits.arFelprissatt(200, 200, 120) === true);
  kolla("inget larm när credits tar slut först", credits.arFelprissatt(90, 200, 0) === false);
} finally {
  await sb.from("credit_pricing").update({ credits: ursprungspris }).eq("action", "social-bild");
  credits.nollstallCreditPrisCache();
  await sb.from("credit_transactions").delete().eq("tenant_id", TENANT);
  await sb.from("credit_accounts").delete().eq("tenant_id", TENANT);
  console.log(`\nStädat: kast-tenanten borttagen, creditpriset återställt till ${ursprungspris}.`);
}

console.log(fel === 0 ? "\nDoD K2-3: ALLA KONTROLLER GRÖNA." : `\nDoD K2-3: ${fel} kontroll(er) misslyckades.`);
process.exit(fel === 0 ? 0 : 1);
