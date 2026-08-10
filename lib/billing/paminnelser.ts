// BETAL-1 — påminnelser och spärr (dunning).
//
// Trappan körs av cron en gång om dagen. Antal påminnelser och intervall styrs från
// ownervyn, default 3 stycken på dag 0, 7 och 14 efter första misslyckade debiteringen.
// Efter sista påminnelsen plus eventuella gracedagar sätts kunden i spärr.
//
// Två saker som INTE händer här:
//   · ingen data raderas, någonsin
//   · publicerade inlägg och GHL rörs inte
//
// Spärren är en paus, inte en uppsägning. Texterna ska låta som det.
//
// Server-only.

import { supabaseService } from "../supabase-admin";
import { sendEmail } from "../email";
import { hamtaInstallningar } from "./installningar";
import { registreraPaminnelse, sparra } from "./status";
import { basadress as bas } from "./adress";

const DAG_MS = 86400000;


// ── Mottagare ───────────────────────────────────────────────────────────────

/**
 * Vem påminnelsen går till, i fallande ordning:
 *   1. faktura_epost på affären (det Håkan själv fyllt i)
 *   2. aktiva kundanvändare för tenanten (platform_users)
 *   3. clients.report_recipients (mottagarna av veckorapporten)
 *
 * Tom lista är ett riktigt fel: en kund som inte kan nås ska aldrig spärras tyst.
 */
export async function hamtaMottagare(clientId: string): Promise<string[]> {
  const sb = supabaseService();
  const [avtal, anvandare, klient] = await Promise.all([
    sb.from("billing_avtal").select("faktura_epost").eq("client_id", clientId).maybeSingle(),
    sb.from("platform_users").select("email").eq("client_id", clientId).eq("active", true),
    sb.from("clients").select("report_recipients").eq("id", clientId).maybeSingle(),
  ]);

  const fran = (avtal.data as { faktura_epost: string | null } | null)?.faktura_epost;
  if (fran) return [fran];

  const users = ((anvandare.data || []) as Array<{ email: string }>).map((u) => u.email).filter(Boolean);
  if (users.length) return users;

  const rapport = (klient.data as { report_recipients: string[] | null } | null)?.report_recipients || [];
  return rapport.filter(Boolean);
}

// ── Mejlet ──────────────────────────────────────────────────────────────────

interface Mejlinput {
  klientnamn: string;
  omgang: number;        // 1, 2, 3 …
  sista: boolean;        // sista påminnelsen innan pausen
  belopp: number | null;
  avsandare: string | null;
}

export function paminnelseAmne({ omgang, sista }: Pick<Mejlinput, "omgang" | "sista">): string {
  if (sista) return "Sista påminnelsen innan ditt konto pausas";
  if (omgang === 1) return "Vi kunde inte dra din betalning";
  return "Påminnelse om din obetalda faktura";
}

export function paminnelseHtml(i: Mejlinput): string {
  const lank = `${bas()}/k/betalning`;
  const belopp = i.belopp ? `${i.belopp.toLocaleString("sv-SE")} kr` : "beloppet";

  const brodtext = i.sista
    ? `Det här är sista påminnelsen. Om betalningen på ${belopp} inte kommer in inom kort pausar vi ditt konto tills den är ordnad.
       Allt du har skapat finns kvar, och det du redan publicerat ligger kvar orört. Så fort betalningen kommer in öppnas allt igen automatiskt.`
    : i.omgang === 1
      ? `Vi försökte dra ${belopp} men betalningen gick inte igenom. Det brukar bero på att kortet gått ut eller att pengarna inte räckte just då.
         Du har full tillgång som vanligt. Uppdatera ditt kort så försöker vi igen.`
      : `Din faktura på ${belopp} ligger fortfarande obetald. Uppdatera ditt kort eller betala fakturan så är allt i ordning igen.
         Du har full tillgång så länge.`;

  return `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:${i.sista ? "#dc2626" : "#d97706"};height:6px"></div>
  <div style="padding:28px">
    <h1 style="margin:0 0 12px;font-size:20px;color:#111827">Hej ${i.klientnamn},</h1>
    <p style="color:#374151;line-height:1.65;margin:0 0 20px;font-size:15px">${brodtext}</p>
    <a href="${lank}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;font-size:15px">Gå till din betalsida</a>
    <p style="color:#6b7280;line-height:1.6;margin:22px 0 0;font-size:13px">
      På betalsidan ser du nästa betalning, dina kvitton och kan byta betalkort.
      Har något blivit fel, svara på det här mejlet så löser vi det.
    </p>
  </div>
  <div style="padding:14px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
    ${i.avsandare || "MySales Pro"}
  </div>
</div></body></html>`;
}

export function paminnelseText(i: Mejlinput): string {
  return [
    `Hej ${i.klientnamn},`,
    "",
    i.sista
      ? "Det här är sista påminnelsen. Kommer inte betalningen in inom kort pausar vi ditt konto tills den är ordnad. Ingenting raderas, och allt öppnas igen automatiskt när betalningen kommer in."
      : "Din betalning har inte gått igenom. Uppdatera ditt kort eller betala fakturan, så är allt i ordning igen. Du har full tillgang under tiden.",
    "",
    `Din betalsida: ${bas()}/k/betalning`,
  ].join("\n");
}

// ── Cron ────────────────────────────────────────────────────────────────────

export interface DunningResultat {
  aktiv: boolean;
  granskade: number;
  paminnelser_skickade: number;
  sparrade: number;
  utan_mottagare: string[];
  rader: string[];
}

/**
 * Kör hela trappan en gång. Idempotent per dag: en påminnelse som redan gått ut idag
 * skickas inte om, och en redan spärrad kund rörs inte.
 */
export async function korDunning(nu: Date = new Date()): Promise<DunningResultat> {
  const resultat: DunningResultat = {
    aktiv: false, granskade: 0, paminnelser_skickade: 0, sparrade: 0, utan_mottagare: [], rader: [],
  };

  const inst = await hamtaInstallningar();
  resultat.aktiv = inst.dunning_aktiv;
  if (!inst.dunning_aktiv) {
    resultat.rader.push("Automatiken är avstängd. Ingenting gjordes.");
    return resultat;
  }

  const sb = supabaseService();
  const { data } = await sb
    .from("billing_status")
    .select("client_id, status, forsta_misslyckande, paminnelser_skickade, senaste_paminnelse, owner_override")
    .in("status", ["forsenad", "paminnelser"]);

  const rader = (data || []) as Array<{
    client_id: string; status: string; forsta_misslyckande: string | null;
    paminnelser_skickade: number; senaste_paminnelse: string | null; owner_override: string | null;
  }>;

  const dagar = inst.paminnelse_dagar.slice(0, inst.antal_paminnelser);

  for (const r of rader) {
    resultat.granskade++;

    // Ownerns "lås upp" står över automatiken helt.
    if (r.owner_override === "las_upp") {
      resultat.rader.push(`${r.client_id}: överstyrd av dig, hoppas över.`);
      continue;
    }
    if (!r.forsta_misslyckande) continue;

    const dagarSedan = Math.floor((nu.getTime() - new Date(r.forsta_misslyckande).getTime()) / DAG_MS);
    const skickade = r.paminnelser_skickade || 0;

    // Redan påmind idag? Då är turen tagen. Skyddar mot dubbla cron-körningar.
    if (r.senaste_paminnelse && Math.floor((nu.getTime() - new Date(r.senaste_paminnelse).getTime()) / DAG_MS) < 1) {
      continue;
    }

    // Alla påminnelser skickade och gracetiden ute → spärra.
    if (skickade >= dagar.length) {
      const sistaDag = dagar[dagar.length - 1] ?? 0;
      if (dagarSedan >= sistaDag + inst.gracedagar) {
        await sparra(r.client_id);
        resultat.sparrade++;
        resultat.rader.push(`${await namn(r.client_id)}: pausad efter ${skickade} påminnelser.`);
      }
      continue;
    }

    // Är nästa påminnelse i tur?
    const nastaDag = dagar[skickade];
    if (dagarSedan < nastaDag) continue;

    const mottagare = await hamtaMottagare(r.client_id);
    if (!mottagare.length) {
      // ★ Spärra ALDRIG en kund vi inte kunnat nå. Den hamnar i listan i stället.
      resultat.utan_mottagare.push(await namn(r.client_id));
      resultat.rader.push(`${await namn(r.client_id)}: ingen e-postadress, ingen påminnelse skickad.`);
      continue;
    }

    const omgang = skickade + 1;
    const sista = omgang >= dagar.length;
    const klientnamn = await namn(r.client_id);
    const belopp = await senasteObetaldaBelopp(r.client_id);

    const mejl = { klientnamn, omgang, sista, belopp, avsandare: inst.foretagsnamn };
    const svar = await sendEmail({
      to: mottagare,
      subject: paminnelseAmne({ omgang, sista }),
      html: paminnelseHtml(mejl),
      text: paminnelseText(mejl),
      ...(inst.faktura_avsandare ? { from: `${inst.foretagsnamn || "MySales Pro"} <${inst.faktura_avsandare}>` } : {}),
    });

    if (svar.sent) {
      await registreraPaminnelse(r.client_id, omgang);
      resultat.paminnelser_skickade++;
      resultat.rader.push(`${klientnamn}: påminnelse ${omgang} av ${dagar.length} skickad.`);
    } else {
      resultat.rader.push(`${klientnamn}: mejlet gick inte fram (${svar.reason || "okänt fel"}).`);
    }
  }

  return resultat;
}

async function namn(clientId: string): Promise<string> {
  try {
    const { data } = await supabaseService().from("clients").select("name").eq("id", clientId).maybeSingle();
    return (data as { name: string } | null)?.name || clientId;
  } catch {
    return clientId;
  }
}

async function senasteObetaldaBelopp(clientId: string): Promise<number | null> {
  try {
    const { data } = await supabaseService()
      .from("billing_invoices")
      .select("belopp_sek")
      .eq("client_id", clientId)
      .in("status", ["open", "uncollectible"])
      .order("faktura_datum", { ascending: false })
      .limit(1)
      .maybeSingle();
    const b = Number((data as { belopp_sek: number } | null)?.belopp_sek);
    return Number.isFinite(b) && b > 0 ? b : null;
  } catch {
    return null;
  }
}
