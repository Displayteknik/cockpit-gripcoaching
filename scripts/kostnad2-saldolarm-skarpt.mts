// KOSTNAD-2 (HELG-1 DEL 8) — SKARP körning, på Håkans uttryckliga OK ("kör skarpt nu").
// Samma logik som app/api/kostnader/saldolarm-cron/route.ts, körd direkt som script
// (routen är inte deployad än — ingen push har gjorts den här sessionen). Skickar ett
// RIKTIGT mejl och (för akuta konton) ett RIKTIGT sms.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
import { sendEmail } from "../lib/email";
import { sendSms, smsTestPhone, smsConfigured } from "../lib/sms/elks";
import { byggInkop, fraschaApiSaldon } from "../lib/inkop";
import {
  SALDOLARM_PROVIDERS, SALDO_TROSKLAR_STANDARD, saldolarmniva, skaLarma, byggSaldolarmAtgard,
  type Saldolarmniva, type SaldolarmProvider,
} from "../lib/inkop/saldolarm";

const sb = supabaseService();
const ETIKETT: Record<SaldolarmProvider, string> = { fal: "Fal.ai", elks46: "46elks" };
const ekonomiLank = "https://cockpit.gripcoaching.se/dashboard/ekonomi";
const mottagareEpost = process.env.OWNER_ALERT_EMAIL || "hakan@displayteknik.se";
const mottagareTelefon = smsTestPhone();

console.log("Mottagare e-post:", mottagareEpost, "| SMS-nummer:", mottagareTelefon || "(SMS_TEST_PHONE ej satt)");

await fraschaApiSaldon();
const [{ data: konfig }, { data: skickade }, inkop] = await Promise.all([
  sb.from("inkop_konfig").select("saldo_varning_sek, saldo_akut_sek").eq("id", 1).maybeSingle(),
  sb.from("saldolarm_skickade").select("provider, niva"),
  byggInkop(),
]);
const trosklar = konfig
  ? { varningSek: Number((konfig as any).saldo_varning_sek) || SALDO_TROSKLAR_STANDARD.varningSek, akutSek: Number((konfig as any).saldo_akut_sek) || SALDO_TROSKLAR_STANDARD.akutSek }
  : SALDO_TROSKLAR_STANDARD;
const senastPerProvider = new Map(((skickade as Array<{ provider: string; niva: Saldolarmniva }> | null) || []).map((s) => [s.provider, s.niva]));

const konton = inkop.rader.filter((r) => (SALDOLARM_PROVIDERS as readonly string[]).includes(r.provider)) as Array<(typeof inkop.rader)[number] & { provider: SaldolarmProvider }>;

for (const konto of konton) {
  if (!konto.aktiv) continue;
  const saldoSek = konto.saldo_kalla === "api" ? konto.saldoSek : null;
  const niva = saldolarmniva(saldoSek, trosklar);
  const senast = senastPerProvider.get(konto.provider) ?? null;
  const skicka = skaLarma(niva, senast);

  console.log(`\n${konto.etikett}: saldo ${saldoSek?.toFixed(1)} kr, nivå ${niva}, senast skickad ${senast ?? "aldrig"}, skickar nu: ${skicka}`);

  if (niva === "gron" && senast !== null) {
    await sb.from("saldolarm_skickade").delete().eq("provider", konto.provider);
    console.log("  Återhämtat, nollställde minnet.");
  }
  if (!skicka || saldoSek === null) continue;

  const atgard = byggSaldolarmAtgard(konto.provider, ETIKETT[konto.provider] || konto.etikett, saldoSek, niva, ekonomiLank);

  const mejlSvar = await sendEmail({
    to: mottagareEpost,
    subject: atgard.rubrik,
    html: `<!doctype html><html><body style="font-family:sans-serif;padding:20px">
<h2>${atgard.rubrik}</h2>
<p>${atgard.atgardstext}</p>
<p><a href="${atgard.paffyllningslank}">Fyll på hos ${atgard.etikett} →</a></p>
<p><a href="${atgard.ekonomiLank}">Se hela saldoläget i Cockpit →</a></p>
</body></html>`,
    text: `${atgard.rubrik}\n\n${atgard.atgardstext}\n\nFyll på: ${atgard.paffyllningslank}\nSe hela läget: ${atgard.ekonomiLank}`,
  });
  console.log("  Mejl:", mejlSvar.sent ? "SKICKAT" : `MISSLYCKADES (${mejlSvar.reason})`, mejlSvar.id || "");

  let smsSvar: { ok: boolean; error?: string } | null = null;
  if (niva === "akut" && mottagareTelefon && smsConfigured()) {
    const r = await sendSms(mottagareTelefon, `${atgard.rubrik}. ${atgard.atgardstext} ${atgard.paffyllningslank}`, { dryrun: false });
    smsSvar = { ok: r.ok, error: r.error };
    console.log("  SMS:", r.ok ? `SKICKAT (${r.status}, ${r.costKr} kr)` : `MISSLYCKADES (${r.error})`);
  } else if (niva === "akut") {
    console.log("  SMS: hoppat över —", !mottagareTelefon ? "SMS_TEST_PHONE ej satt" : "46elks ej konfigurerat");
  }

  await sb.from("saldolarm_skickade").upsert({ provider: konto.provider, niva, skickad_at: new Date().toISOString() });
}

console.log("\nKlart.");
