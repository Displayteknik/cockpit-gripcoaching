import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { sendSms, smsTestPhone, smsConfigured } from "@/lib/sms/elks";
import { byggInkop } from "@/lib/inkop";
import {
  SALDOLARM_PROVIDERS, SALDO_TROSKLAR_STANDARD, saldolarmniva, skaLarma, byggSaldolarmAtgard,
  type Saldolarmniva, type SaldolarmProvider,
} from "@/lib/inkop/saldolarm";
import { basadress as bas } from "@/lib/billing/adress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// KOSTNAD-2 (HELG-1 DEL 8) — dagligt saldolarm för fal.ai och 46elks.
//
// Bygger PÅ K3-INKÖP:s provider_accounts (samma saldo som redan hämtas där, samma
// leverantörer). Detta läggar bara PUSH ovanpå: mail vid varning ELLER akut, sms ENDAST
// vid akut, max ett mail per nivå (lib/inkop/saldolarm.ts::skaLarma).
//
// Grindas på CRON_SECRET, samma mönster som app/api/billing/cron.

function auktoriserad(req: Request): boolean {
  const hemlighet = process.env.CRON_SECRET;
  if (!hemlighet) return false; // fail-closed
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${hemlighet}`;
}

const ETIKETT: Record<SaldolarmProvider, string> = { fal: "Fal.ai", elks46: "46elks" };

export async function GET(req: Request) {
  if (!auktoriserad(req)) {
    return NextResponse.json({ error: "ej behörig" }, { status: 401 });
  }

  const sb = supabaseService();
  const resultat: { provider: string; niva: string; skickat: boolean; skal: string }[] = [];

  try {
    // byggInkop() räknar redan om varje konto till kronor med SAMMA kurs som resten av
    // K3-INKÖP visar (Inkopsrad.saldoSek) — fal.ai:s saldo står i USD, och en egen
    // "bara SEK"-koll här hade tyst hoppat över just den kanalen. En källa till kurs,
    // ingen andra som kan glida isär.
    const [{ data: konfig }, { data: skickade }, inkop] = await Promise.all([
      sb.from("inkop_konfig").select("saldo_varning_sek, saldo_akut_sek").eq("id", 1).maybeSingle(),
      sb.from("saldolarm_skickade").select("provider, niva"),
      byggInkop(),
    ]);
    const arSaldolarmProvider = (p: string): p is SaldolarmProvider => (SALDOLARM_PROVIDERS as readonly string[]).includes(p);
    const konton = inkop.rader.filter((r) => arSaldolarmProvider(r.provider)) as Array<(typeof inkop.rader)[number] & { provider: SaldolarmProvider }>;

    const trosklar = konfig
      ? { varningSek: Number((konfig as { saldo_varning_sek: number }).saldo_varning_sek) || SALDO_TROSKLAR_STANDARD.varningSek, akutSek: Number((konfig as { saldo_akut_sek: number }).saldo_akut_sek) || SALDO_TROSKLAR_STANDARD.akutSek }
      : SALDO_TROSKLAR_STANDARD;

    const senastPerProvider = new Map(
      ((skickade as Array<{ provider: string; niva: Saldolarmniva }> | null) || []).map((s) => [s.provider, s.niva]),
    );

    const ekonomiLank = `${bas()}/dashboard/ekonomi`;
    const mottagareEpost = process.env.OWNER_ALERT_EMAIL || "hakan@displayteknik.se";
    const mottagareTelefon = smsTestPhone();

    for (const konto of konton) {
      if (!konto.aktiv) continue;
      // saldoSek kommer redan omräknat (kurs) ur byggInkop() — fal.ai:s saldo är USD i
      // grunden, men Inkopsrad.saldoSek är alltid i kronor, samma tal K3-INKÖP visar.
      // Ett manuellt inlagt saldo (saldo_kalla "manuellt") prövas INTE här — den absoluta
      // kronorgränsen gäller bara konton med ett API-läsbart, färskt saldo.
      const saldoSek = konto.saldo_kalla === "api" ? konto.saldoSek : null;
      const niva = saldolarmniva(saldoSek, trosklar);
      const senast = senastPerProvider.get(konto.provider) ?? null;
      const skicka = skaLarma(niva, senast);

      if (niva === "gron" && senast !== null) {
        // Återhämtat — nollställ minnet så nästa dropp under tröskeln larmar igen.
        await sb.from("saldolarm_skickade").delete().eq("provider", konto.provider);
      }

      if (!skicka) {
        resultat.push({ provider: konto.provider, niva, skickat: false, skal: senast ? "redan skickat på den här nivån" : "grönt, inget att larma" });
        continue;
      }
      if (saldoSek === null) continue; // hör inte hemma här, saldolarmniva gav redan "gron"

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

      let smsSvar: { ok: boolean } | null = null;
      if (niva === "akut" && mottagareTelefon && smsConfigured()) {
        const r = await sendSms(mottagareTelefon, `${atgard.rubrik}. ${atgard.atgardstext} ${atgard.paffyllningslank}`, { dryrun: false });
        smsSvar = { ok: r.ok };
      }

      await sb.from("saldolarm_skickade").upsert({ provider: konto.provider, niva, skickad_at: new Date().toISOString() });
      resultat.push({
        provider: konto.provider, niva, skickat: true,
        skal: `mejl ${mejlSvar.sent ? "skickat" : `misslyckades (${mejlSvar.reason})`}${niva === "akut" ? `, sms ${smsSvar?.ok ? "skickat" : mottagareTelefon ? "misslyckades" : "inget nummer inställt"}` : ""}`,
      });
    }

    return NextResponse.json({ ok: true, rader: resultat });
  } catch (e) {
    console.error("[saldolarm-cron] misslyckades:", (e as Error).message);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
