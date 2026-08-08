// ONBOARD-1 — från godkänt förslag till färdigt konto.
//
// Sju steg, och varje steg är IDEMPOTENT var för sig. Det är inte samma sak som att hela
// körningen är idempotent — och skillnaden är hela poängen. En provisionering kan falla
// mitt i (GHL svarar 500, snapshotet hänger, mejlet studsar). Kan den inte köras om utan
// att skapa dubbletter måste man städa för hand i två system. Därför frågar varje steg
// först "finns det redan?" innan det skapar något.
//
//   1. Lås domänen              (unikt index i onboarding_korningar)
//   2. Hitta eller skapa GHL sub-account från snapshotet
//   3. Vänta in snapshot-laddningen           ⚠ före steg 4, annars skrivs värdena över
//   4. Sätt custom values
//   5. Hitta eller skapa Cockpit-tenanten + brand-profilen
//   6. Spara mappningen tenant ↔ location-id
//   7. Skapa inloggning och skicka välkomstmejl
//
// ★ TORRKÖRNING ÄR STANDARD. `torrkorning: true` går igenom hela kedjan, läser allt,
//   men skapar ingenting. Att skapa ett sub-account hos en betald byråplan är inte
//   ogjort igen, så den som vill det ska behöva säga det uttryckligen.

import { supabaseService } from "@/lib/supabase-admin";
import { sendEmail, welcomeEmailHtml, welcomeEmailText, emailConfigured } from "@/lib/email";
import { getEffectiveModules } from "@/lib/entitlements";
import {
  ghlAgencyKonfig, GHL_SAKNAS_TEXT, hittaLocationForSajt,
  skapaLocation, vantaPaSnapshot, sattCustomValues, SNAPSHOT_EJ_LASBAR,
} from "@/lib/ghl-agency";
import { sattStegStatus } from "./steg-status";
import { harVarde, type Falt, type Forslag, type Tjanst, type Oppettid } from "./typer";

/** Snapshotet varje ny MySales Pro-kund byggs från. Namnet, inte id:t — se hittaSnapshot. */
export const SNAPSHOT_NAMN = process.env.GHL_SNAPSHOT_NAMN || "MySales Pro v1.0";

/**
 * Id:t för "MySales Pro v1.0", taget ur MALL MySales Pro (C7hspI68eIy5elGHfFVj).
 *
 * Ligger i koden för att byrå-nyckeln inte får LISTA snapshots — se kommentaren vid
 * uppslaget nedan. `GHL_SNAPSHOT_ID` i env vinner alltid över den här konstanten.
 */
export const SNAPSHOT_ID_STANDARD = "GCqvltlAAz7l0028oo0w";

/**
 * ★ VÄLKOMSTMEJLET ÄR AVSTÄNGT SOM STANDARD, OCH DET ÄR ETT BESLUT — INTE ETT FEL.
 *
 *   Håkan lämnar alltid kundlänken personligen. Att provisioneringen mejlade av sig själv
 *   var ofarligt lokalt, där `RESEND_API_KEY` saknas — men nyckeln ÄR satt i produktionen,
 *   så en omkörning därifrån hade skickat ett välkomstmejl till kundens info-adress utan
 *   att någon bett om det. En kund som får oväntad post från ett system hon aldrig hört
 *   talas om är svårare att laga än ett uteblivet mejl.
 *
 *   Länken skrivs alltid ut i stegrapporten, så inget går förlorat av att mejlet uteblir.
 */
const SKICKA_VALKOMSTMEJL = (process.env.ONBOARDING_SKICKA_VALKOMSTMEJL || "").toLowerCase() === "ja";

export type StegStatus = "klar" | "hoppade" | "fel" | "torr";

export interface Steg {
  namn: string;
  status: StegStatus;
  detalj: string;
}

export interface ProvisioneringsResultat {
  ok: boolean;
  torrkorning: boolean;
  steg: Steg[];
  clientId: string | null;
  ghlLocationId: string | null;
  inloggningsUrl: string | null;
  fel: string | null;
}

const v = (f: Falt<unknown> | undefined): string | null => {
  if (!harVarde(f)) return null;
  const x = f!.varde;
  return typeof x === "string" ? x.trim() : String(x);
};

/** Värdnamn utan www — idempotensnyckeln. Måste ge samma svar som migrationens kommentar. */
export function domanAv(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Slug ur företagsnamnet, med svenska tecken översatta så URL:en blir läsbar. */
export function sluggify(namn: string): string {
  return namn
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "kund";
}

/** Delar upp ett personnamn. GHL vill ha för- och efternamn var för sig. */
function delaNamn(helt: string | null): { fornamn: string | null; efternamn: string | null } {
  if (!helt) return { fornamn: null, efternamn: null };
  const d = helt.trim().split(/\s+/);
  if (d.length === 1) return { fornamn: d[0], efternamn: null };
  return { fornamn: d.slice(0, -1).join(" "), efternamn: d[d.length - 1] };
}

/**
 * Custom values som sätts i kundens GHL-konto. Namnen måste matcha platshållarna i
 * snapshotet "MySales Pro v1.0" — ändras de i snapshotet ska de ändras här.
 * Tomma värden filtreras bort i sattCustomValues; en platshållare är bättre än en tom sträng.
 */
export function byggCustomValues(f: Forslag): Record<string, string> {
  const ut: Record<string, string> = {};
  const satt = (nyckel: string, varde: string | null) => {
    if (varde && varde.trim()) ut[nyckel] = varde.trim();
  };

  // ★ MALL-1: NYCKELNAMNEN ÄR ETT KONTRAKT MOT MALLKONTOT — ÄNDRA ALDRIG PÅ FRI HAND.
  //
  // Två regler bakom listan nedan, båda dyrköpta:
  //
  // 1. GHL custom values bär BARA det som ska kunna klistras in i en DM, ett mejl eller
  //    ett SMS. Allt Cockpit använder för att GENERERA text och design — bransch, målgrupp,
  //    smärtpunkter, tonläge, USP, tjänster, priser, kundcitat, färger — bor i Supabase
  //    (`hm_brand_profile`) och ska inte dubbleras hit. Två sanningar om samma sak glider
  //    isär, och den som glider är alltid den ingen tittar på.
  //
  // 2. NAMNEN MÅSTE VARA ASCII. GHL härleder merge-taggen ur namnet VID SKAPANDET och
  //    slänger svenska tecken: "Öppettider" gav `{{ custom_values.ppettider }}`. Taggen går
  //    INTE att räkna om i efterhand — ett namnbyte via PUT lämnar den stympad. Skriver vi
  //    "Öppettider" här skapas alltså en ANDRA custom value med trasig tagg bredvid den
  //    riktiga, utan felmeddelande, och mallarna slutar fyllas i tyst.
  //
  // Motsvarande måltillstånd i mallkontot byggs av scratchpad/mall1b-ombyggnad.ts.
  satt("Foretagsnamn", v(f.foretagsnamn));
  satt("Kontaktperson", v(f.kontaktperson));
  satt("Epost", v(f.epost));
  satt("Telefon", v(f.telefon));
  satt("Adress", v(f.adress));
  satt("Postnummer", v(f.postnummer));
  satt("Ort", v(f.ort));
  satt("Hemsida", v(f.hemsida));

  if (harVarde(f.oppettider)) {
    satt("Oppettider", (f.oppettider.varde as Oppettid[]).map((o) => `${o.dag}: ${o.tider}`).join(", "));
  }
  if (harVarde(f.socialaLankar)) {
    const s = f.socialaLankar.varde as Record<string, string>;
    satt("Facebook", s.facebook ?? null);
    satt("Instagram", s.instagram ?? null);
    satt("LinkedIn", s.linkedin ?? null);
  }

  // "Bokningslank" finns som tom platshållare i mallen men fylls inte här — motorn har
  // ingen bokningslänk förrän ONBOARD-3 lärt sig läsa bokningsplattformar.
  //
  // ⚠ LOGOTYPEN SKRIVS INTE LÄNGRE NÅGONSTANS. Den togs bort härifrån enligt principen
  //   ovan, men `hm_brand_profile` saknar logotyp-kolumn och `clients` har bara
  //   `primary_color`. Tills en kolumn finns går `f.logotyp` förlorad vid provisionering
  //   trots att analysen hittar den. Se rapporten för MALL-1b.
  return ut;
}

export interface ProvisioneraOpts {
  korningId: string;
  forslag: Forslag;
  /** Adress som välkomstmejlet skickas till. Faller tillbaka på förslagets e-post. */
  inloggningsEpost?: string | null;
  torrkorning?: boolean;
  /** Bas-URL för inloggningslänken. Default NEXT_PUBLIC_SITE_URL. */
  basUrl?: string;
}

export async function provisionera(opts: ProvisioneraOpts): Promise<ProvisioneringsResultat> {
  const torr = opts.torrkorning !== false; // ★ standard = torrkörning
  const steg: Steg[] = [];
  const sb = supabaseService();
  const f = opts.forslag;

  const foretag = v(f.foretagsnamn);
  const hemsida = v(f.hemsida);
  const epost = (opts.inloggningsEpost || v(f.epost) || "").trim().toLowerCase() || null;

  const svar = (ok: boolean, clientId: string | null, locId: string | null, url: string | null, fel: string | null): ProvisioneringsResultat =>
    ({ ok, torrkorning: torr, steg, clientId, ghlLocationId: locId, inloggningsUrl: url, fel });

  if (!foretag) return svar(false, null, null, null, "Företagsnamn saknas — kontot kan inte skapas utan namn.");
  if (!hemsida) return svar(false, null, null, null, "Webbadress saknas i förslaget.");

  const doman = domanAv(hemsida);

  // ── Steg 1: lås domänen ────────────────────────────────────────────────────
  const { data: korning, error: korFel } = await sb
    .from("onboarding_korningar")
    .select("id, status, client_id, ghl_location_id")
    .eq("id", opts.korningId)
    .maybeSingle();

  if (korFel) {
    return svar(false, null, null, null,
      `Kunde inte läsa onboarding-körningen: ${korFel.message}. Har migrations/onboarding_provisionering.sql körts?`);
  }
  if (!korning) return svar(false, null, null, null, "Onboarding-körningen finns inte.");

  // ★ EN 'KLAR' KÖRNING FÅR INTE STOPPA OMKÖRNINGEN — DÅ BLIR STEG 5 OMÖJLIGT.
  //
  //   Här låg tidigare ett return som svarade "redan provisionerad, inget skapades om".
  //   Men kedjan är byggd för att köras om: custom values KAN inte skrivas i första
  //   körningen, eftersom kundnyckeln skapas för hand efter att kontot finns. Första
  //   körningen märkte alltså körningen som 'klar', och andra körningen — den som äntligen
  //   hade nyckeln — vände i dörren. Kunden blev stående med snapshotets platshållare,
  //   och knappen svarade med ett lugnt besked om att allt var gjort.
  //
  //   Skyddet mot dubbletter ligger inte här utan i varje steg för sig: alla frågar
  //   "finns det redan?" innan de skapar något. Se filens inledning.
  if (korning.status === "kor" && !torr) {
    return svar(false, null, null, null, "En provisionering för den här sajten pågår redan.");
  }

  const omkorning = korning.status === "klar";
  if (!torr) {
    await sb.from("onboarding_korningar").update({ status: "kor", updated_at: new Date().toISOString() }).eq("id", opts.korningId);
  }
  steg.push({
    namn: "Idempotens",
    status: torr ? "torr" : "klar",
    detalj: omkorning
      ? `${doman} är redan provisionerad — körs om. Befintligt konto och klient återanvänds, bara det som saknas fylls i.`
      : `Domänen ${doman} låst för den här körningen.`,
  });

  const konfig = ghlAgencyKonfig();
  let locationId: string | null = korning.ghl_location_id ?? null;
  let snapshotId: string | null = null;

  // ── Steg 2: GHL sub-account ────────────────────────────────────────────────
  if (!konfig) {
    steg.push({ namn: "GHL sub-account", status: "fel", detalj: GHL_SAKNAS_TEXT });
  } else {
    try {
      // ★ SNAPSHOTET SLÅS UPP PÅ ID, INTE PÅ NAMN.
      //
      //   Uppslaget på namn krävde `GET /snapshots/`, som byrå-nyckeln inte får läsa —
      //   401 på alla sökvägar och båda API-versionerna, verifierat 2026-08-07.
      //   `snapshots.readonly` går inte att få genomslag för på en Private Integration.
      //   Gittes konto fick därför skapas för hand med id:t i ett curl-anrop.
      //
      //   Att ANGE ett id man redan har är en annan sak än att få bläddra bland dem:
      //   POST /locations/ med snapshotId fungerar med samma nyckel. Därför id:t direkt.
      //
      //   Källan skrivs ut i stegrapporten. Tas ett nytt snapshot (v2) och env-variabeln
      //   inte uppdateras klonas fortfarande v1 — och då ska det synas att id:t kom från
      //   koden och inte från konfigurationen.
      const franEnv = (process.env.GHL_SNAPSHOT_ID || "").trim();
      snapshotId = franEnv || SNAPSHOT_ID_STANDARD;
      steg.push({
        namn: "Snapshot",
        status: "klar",
        detalj: franEnv
          ? `Använder snapshot-id ur GHL_SNAPSHOT_ID (${snapshotId}).`
          : `GHL_SNAPSHOT_ID saknas i env — använder det dokumenterade id:t för "${SNAPSHOT_NAMN}" (${snapshotId}). Sätt variabeln när du tar ett nytt snapshot.`,
      });

      if (!locationId) {
        const befintlig = await hittaLocationForSajt(konfig, hemsida, epost);
        if (befintlig) {
          locationId = befintlig.id;
          steg.push({
            namn: "GHL sub-account",
            status: "hoppade",
            detalj: `Det finns redan ett konto för ${doman} (${befintlig.name ?? befintlig.id}). Återanvänds — inget nytt skapades.`,
          });
        } else if (torr) {
          steg.push({
            namn: "GHL sub-account",
            status: "torr",
            detalj: `Skulle skapa nytt sub-account "${foretag}" (land SE, tidszon Europe/Stockholm${snapshotId ? `, snapshot ${snapshotId}` : ""}).`,
          });
        } else {
          const namnDelar = delaNamn(v(f.kontaktperson));
          const skapad = await skapaLocation(konfig, {
            namn: foretag,
            epost,
            telefon: v(f.telefon),
            adress: v(f.adress),
            ort: v(f.ort),
            postnummer: v(f.postnummer),
            hemsida,
            land: v(f.land) || "SE",
            tidszon: v(f.tidszon) || "Europe/Stockholm",
            snapshotId,
            kontaktFornamn: namnDelar.fornamn,
            kontaktEfternamn: namnDelar.efternamn,
          });
          locationId = skapad.id;
          steg.push({ namn: "GHL sub-account", status: "klar", detalj: `Skapat med location-id ${skapad.id}.` });
        }
      } else {
        steg.push({ namn: "GHL sub-account", status: "hoppade", detalj: `Kopplad sedan tidigare (${locationId}).` });
      }
    } catch (e) {
      steg.push({ namn: "GHL sub-account", status: "fel", detalj: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Steg 3: vänta in snapshotet ────────────────────────────────────────────
  if (konfig && locationId && snapshotId && !torr) {
    const s = await vantaPaSnapshot(konfig, snapshotId, locationId);
    // ★ TRE UTFALL, INTE TVÅ. "Vi får inte läsa statusen" är inte samma sak som "laddningen
    //   gick fel", och skillnaden avgör om hela körningen märks som trasig. Byrå-nyckeln
    //   nekas snapshot-status (401), så det tredje utfallet är det normala i dag — och det
    //   satte varje kund till status 'fel' trots att kontot skapats korrekt.
    const ejLasbar = s.status === SNAPSHOT_EJ_LASBAR;
    steg.push({
      namn: "Snapshot-laddning",
      status: s.klar ? "klar" : ejLasbar ? "hoppade" : "fel",
      detalj: s.klar
        ? "Snapshotet färdigladdat — custom values kan skrivas utan att skrivas över."
        : ejLasbar
          ? "Går inte att kontrollera härifrån: byrå-nyckeln får inte läsa snapshot-status (401), " +
            "och scopet går inte att lägga till på en Private Integration. Kontot är skapat med " +
            "snapshotet angivet. Att det verkligen laddades bevisas i steg 4, där kundnyckeln " +
            "kontrollerar att pipelinen har sju steg."
          : `Snapshotet var fortfarande "${s.status}" efter väntetiden. Custom values sätts ändå, men kontrollera dem i GHL efteråt.`,
    });
  } else if (locationId && snapshotId) {
    steg.push({ namn: "Snapshot-laddning", status: "torr", detalj: "Skulle vänta in snapshotet innan custom values sätts." });
  }

  // ── Steg 4: custom values ──────────────────────────────────────────────────
  const varden = byggCustomValues(f);
  if (konfig && locationId && !torr) {
    try {
      // Kundnyckeln är den enda som får skriva i underkontot — se sattCustomValues.
      // Den skapas för hand i steg 4 och bor på coach_users, samma rad som Fokus läser.
      const { data: cu } = await sb
        .from("coach_users")
        .select("ghl_api_token")
        .eq("ghl_location_id", locationId)
        .maybeSingle();
      const kundToken = (cu as { ghl_api_token?: string } | null)?.ghl_api_token ?? null;

      if (!kundToken) {
        // Hellre ett tydligt stopp än 13 tysta 401:or. Steget kan köras om när nyckeln finns.
        steg.push({
          namn: "Custom values",
          status: "hoppade",
          detalj:
            `Kundnyckeln saknas — värdena kan inte skrivas än. Skapa Private Integration i kundens konto (steg 4), ` +
            `klistra in den i stegvyn, och kör provisioneringen igen. ${Object.keys(varden).length} värden ligger redo.`,
        });
      } else {
        const r = await sattCustomValues(konfig, locationId, varden, kundToken);
        steg.push({
          namn: "Custom values",
          status: r.fel.length ? "fel" : "klar",
          detalj: `${r.satta} av ${Object.keys(varden).length} värden satta via ${r.via}.` + (r.fel.length ? ` Fel: ${r.fel.slice(0, 3).join("; ")}` : ""),
        });

        // ★ KVITTOT MÅSTE SPARAS, ANNARS BLIR STEG 5 ALDRIG GRÖNT.
        //
        //   Stegvyn härleder status ur verkligheten — men det finns ingen billig härledning
        //   för custom values: de bor i GHL och kräver ett nätanrop med kundnyckeln per kund,
        //   vilket listvyn inte får kosta. Utan kvitto stod steget kvar som ogjort trots att
        //   värdena bevisligen skrivits, och enda vägen vidare var att bocka av för hand —
        //   alltså exakt den lögn bockarna finns för att undvika.
        //
        //   Detta är inte en gissning: raden skrivs bara när anropet svarat utan fel.
        if (!r.fel.length) await sattStegStatus(opts.korningId, "custom_values", "klart");
      }
    } catch (e) {
      steg.push({ namn: "Custom values", status: "fel", detalj: e instanceof Error ? e.message : String(e) });
    }
  } else {
    steg.push({
      namn: "Custom values",
      status: locationId || torr ? "torr" : "hoppade",
      detalj: `${Object.keys(varden).length} värden förberedda: ${Object.keys(varden).join(", ")}.`,
    });
  }

  // ── Steg 5: Cockpit-tenant + brand-profil ──────────────────────────────────
  let clientId: string | null = korning.client_id ?? null;

  if (!clientId) {
    const { data: fanns } = await sb
      .from("clients")
      .select("id, name, public_url")
      .or(`public_url.ilike.%${doman}%,ghl_location_id.eq.${locationId ?? "___ingen___"}`)
      .limit(5);

    const träff = (fanns ?? []).find(
      (c: { public_url: string | null }) => c.public_url && domanAv(c.public_url) === doman,
    );
    if (träff) {
      clientId = (träff as { id: string }).id;
      steg.push({
        namn: "Cockpit-tenant",
        status: "hoppade",
        detalj: `Klienten finns redan (${(träff as { name: string }).name}). Återanvänds — ingen dubblett skapades.`,
      });
    }
  } else {
    steg.push({ namn: "Cockpit-tenant", status: "hoppade", detalj: "Kopplad sedan tidigare." });
  }

  if (!clientId) {
    if (torr) {
      steg.push({
        namn: "Cockpit-tenant",
        status: "torr",
        detalj: `Skulle skapa klienten "${foretag}" (slug ${sluggify(foretag)}) med brand-profil.`,
      });
    } else {
      try {
        const { data: ny, error } = await sb
          .from("clients")
          .insert({
            slug: await ledigSlug(sluggify(foretag)),
            name: foretag,
            industry: v(f.bransch),
            public_url: hemsida,
            // ONBOARD-2: ingen standardfärg. Gick märkesfärgen inte att belägga lämnas
            // kolumnen orörd — Cockpit har sin egen standard i UI:t, och en påhittad
            // primärfärg i klientraden ser ut som ett aktivt val som ingen gjort.
            ...(forstaFarg(f) ? { primary_color: forstaFarg(f) } : {}),
            resource_module: "general",
            plan: "pro",
            ghl_location_id: locationId,
            // ★ KUNDÅTKOMSTEN MÅSTE SÄTTAS HÄR (inventeringen 2026-08-07).
            //
            //   Ingenting i koden slog på den. För Gitte gjordes det med ett curl-anrop
            //   mot databasen, alltså "i chatten". Utan flaggan svarar /k/<token> med en
            //   redirect till inloggningen — kunden klickar på länken hon fått och kastas ut.
            //
            //   Att den står på från början är ofarligt: token är oåtkomlig tills Håkan
            //   skickar länken i steg 11, och länken ÄR inloggningen. Det finns ingen väg
            //   in utan den.
            customer_access_enabled: true,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        clientId = (ny as { id: string }).id;
        steg.push({ namn: "Cockpit-tenant", status: "klar", detalj: `Klient skapad (${clientId}).` });

        await skrivBrandProfil(clientId, f);
        steg.push({ namn: "Brand-profil", status: "klar", detalj: "Profilen ifylld från sajtanalysen." });
      } catch (e) {
        steg.push({ namn: "Cockpit-tenant", status: "fel", detalj: e instanceof Error ? e.message : String(e) });
      }
    }
  } else if (!torr) {
    await skrivBrandProfil(clientId, f);
    steg.push({ namn: "Brand-profil", status: "klar", detalj: "Profilen uppdaterad — bara tomma fält fylldes i." });
  } else {
    steg.push({ namn: "Brand-profil", status: "torr", detalj: "Skulle fylla i profilens tomma fält." });
  }

  // ── Steg 6: mappningen tenant ↔ location ───────────────────────────────────
  //
  // ★ TVÅ KOPPLINGAR, INTE EN. Att bara sätta `clients.ghl_location_id` RÄCKER INTE.
  //
  //   Fokus idag läser via lib/coach-bridge.ts, som slår upp `coach_users` på delad
  //   `ghl_location_id`. Saknas den raden svarar Fokus "Klienten är inte kopplad till
  //   MySales" trots att location-id:t står rätt på klienten — och kunden möts av en tom
  //   vy utan att någon förstår varför. Det hände Gitte, och hade hänt varje kund efter.
  //
  //   Raden går inte att ersätta med klient-id: `fokus_opportunities.tenant_id` har en
  //   främmande nyckel mot `coach_users`, så databasen avvisar allt annat. coach_users är
  //   i praktiken "MySales-kontot", och en kund som provisionerats här har aldrig använt
  //   pionjär-appen som annars skapar raden.
  if (clientId && locationId && !torr) {
    const { error } = await sb.from("clients").update({ ghl_location_id: locationId }).eq("id", clientId);

    // Id:t sätts till klientens eget (kolumnen är TEXT) — spårbart åt båda hållen och
    // idempotent: en andra körning hittar raden i stället för att skapa en till.
    const { data: fanns } = await sb
      .from("coach_users")
      .select("id")
      .eq("ghl_location_id", locationId)
      .maybeSingle();

    let koppelFel: string | null = null;
    if (!fanns) {
      const { error: e2 } = await sb
        .from("coach_users")
        .insert({ id: clientId, ghl_location_id: locationId, ghl_api_token: "" });
      koppelFel = e2?.message ?? null;
    }

    steg.push({
      namn: "Mappning tenant ↔ location",
      status: error || koppelFel ? "fel" : "klar",
      detalj:
        error || koppelFel
          ? [error?.message, koppelFel].filter(Boolean).join(" · ")
          : `clients.ghl_location_id = ${locationId}${fanns ? " · MySales-koppling fanns redan" : " · MySales-koppling skapad"}`,
    });

    // Nyckeln kan inte hämtas automatiskt: byråtoken får inte växlas till underkonto-token
    // (oauth.write saknas i Private Integrations). Utan den kopplar Fokus men hämtar inget,
    // och det ska stå i klartext i stegrapporten i stället för att upptäckas av kunden.
    //
    // ★ MEN INSTRUKTIONEN SKA BARA VISAS NÄR DEN GÄLLER. Raden skrevs ovillkorligt och bad
    //   om en nyckel som redan låg i coach_users — i samma rapport som just skrivit tolv
    //   custom values med den. En uppmaning att göra om ett gjort arbete läses som att
    //   något gått fel.
    const { data: nyckelRad } = await sb
      .from("coach_users")
      .select("ghl_api_token")
      .eq("ghl_location_id", locationId)
      .maybeSingle();
    const harNyckel = !!(nyckelRad as { ghl_api_token?: string } | null)?.ghl_api_token;

    steg.push({
      namn: "MySales-nyckel",
      status: harNyckel ? "klar" : "hoppade",
      detalj: harNyckel
        ? "Kundnyckeln finns sparad — Fokus idag kan spegla pipelinen."
        : `Skapa en Private Integration inne i det nya kontot (${locationId}) med de nio kundscopen ` +
          `och klistra in den i steg 4. Tills dess visar Fokus idag "Ingen MySales-nyckel finns sparad" ` +
          `i stället för att spegla pipelinen.`,
    });
  } else {
    steg.push({
      namn: "Mappning tenant ↔ location",
      status: "torr",
      detalj: `Skulle spara clients.ghl_location_id = ${locationId ?? "(location saknas)"}`,
    });
  }

  // ── Steg 7: inloggning + välkomstmejl ──────────────────────────────────────
  let inloggningsUrl: string | null = null;
  const bas = (opts.basUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/+$/, "");

  if (!epost) {
    steg.push({ namn: "Välkomstmejl", status: "hoppade", detalj: "Ingen e-postadress kunde läsas av sajten — inget mejl skickades." });
  } else if (!clientId) {
    steg.push({ namn: "Välkomstmejl", status: torr ? "torr" : "hoppade", detalj: "Ingen tenant att koppla inloggningen till." });
  } else if (torr) {
    steg.push({ namn: "Välkomstmejl", status: "torr", detalj: `Skulle skapa inloggning för ${epost} och skicka välkomstmejl.` });
  } else {
    try {
      const { data: fanns } = await sb
        .from("platform_users")
        .select("id, login_token")
        .eq("client_id", clientId)
        .ilike("email", epost)
        .maybeSingle();

      let token = (fanns as { login_token: string } | null)?.login_token ?? null;
      if (!token) {
        token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
        const { error } = await sb.from("platform_users").insert({
          email: epost,
          client_id: clientId,
          role: "customer",
          login_token: token,
          invited_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }
      inloggningsUrl = `${bas}/k/${token}`;

      // Kundportalen kräver att kund-access är påslagen, annars går länken till en vägg.
      await sb.from("clients").update({ customer_access_enabled: true }).eq("id", clientId);

      if (!SKICKA_VALKOMSTMEJL) {
        steg.push({
          namn: "Välkomstmejl",
          status: "hoppade",
          detalj:
            `Avstängt med flit — Håkan skickar kundlänken personligen. Länk: ${inloggningsUrl} ` +
            `(sätt ONBOARDING_SKICKA_VALKOMSTMEJL=ja i env om mejlet ska gå automatiskt).`,
        });
      } else if (!emailConfigured()) {
        steg.push({ namn: "Välkomstmejl", status: "hoppade", detalj: `RESEND_API_KEY saknas. Inloggningslänk: ${inloggningsUrl}` });
      } else {
        const moduler = await modulNamn(clientId);
        const r = await sendEmail({
          to: epost,
          subject: `Välkommen till MySales, ${foretag}`,
          html: welcomeEmailHtml({ recipient_name: v(f.kontaktperson) ?? undefined, client_name: foretag, login_url: inloggningsUrl, moduler }),
          text: welcomeEmailText({ client_name: foretag, login_url: inloggningsUrl }),
        });
        steg.push({
          namn: "Välkomstmejl",
          status: r.sent ? "klar" : "fel",
          detalj: r.sent ? `Skickat till ${epost}.` : `Kunde inte skickas (${r.reason}). Inloggningslänk: ${inloggningsUrl}`,
        });
      }
    } catch (e) {
      steg.push({ namn: "Välkomstmejl", status: "fel", detalj: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Slutstatus ─────────────────────────────────────────────────────────────
  const misslyckade = steg.filter((s) => s.status === "fel");
  const ok = misslyckade.length === 0;

  if (!torr) {
    await sb
      .from("onboarding_korningar")
      .update({
        status: ok ? "klar" : "fel",
        client_id: clientId,
        ghl_location_id: locationId,
        ghl_snapshot_id: snapshotId,
        steg,
        fel: ok ? null : misslyckade.map((s) => `${s.namn}: ${s.detalj}`).join(" | "),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.korningId);
  }

  return svar(ok, clientId, locationId, inloggningsUrl, ok ? null : misslyckade.map((s) => `${s.namn}: ${s.detalj}`).join(" | "));
}

// ── Hjälpare ─────────────────────────────────────────────────────────────────

function forstaFarg(f: Forslag): string | null {
  if (!harVarde(f.fargpalett)) return null;
  const p = f.fargpalett.varde as string[];
  return p[0] ?? null;
}

/** Slug:en är unik i clients. Lägger till -2, -3 … tills den är ledig. */
async function ledigSlug(bas: string): Promise<string> {
  const sb = supabaseService();
  for (let i = 1; i < 50; i++) {
    const kandidat = i === 1 ? bas : `${bas}-${i}`;
    const { data } = await sb.from("clients").select("id").eq("slug", kandidat).maybeSingle();
    if (!data) return kandidat;
  }
  return `${bas}-${Date.now().toString(36)}`;
}

/**
 * Skriver brand-profilen.
 *
 * ⚠ TVÅ FÄLLOR SOM BÅDA ÄR BELAGDA I KODBASEN:
 *
 * 1. `hm_brand_profile.id` har INGEN default-sekvens. Ett insert utan id kraschar.
 *    `app/api/intake/commit/route.ts` löser det med max(id)+1 — samma sak här.
 * 2. Vi skriver ALDRIG över ett ifyllt fält. Identitetsgrinden i lib/intake/identitet.ts
 *    finns för att en Ikigai-körning en gång gjorde bilhandlaren HM Motor till en
 *    coachingverksamhet. En omkörning av onboardingen får inte kunna göra om det.
 */
async function skrivBrandProfil(clientId: string, f: Forslag): Promise<void> {
  const sb = supabaseService();

  const falt: Record<string, string | null> = {
    company_name: v(f.foretagsnamn),
    tagline: v(f.tagline),
    location: v(f.ort),
    founder_name: v(f.kontaktperson),
    founder_phone: v(f.telefon),
    founder_email: v(f.epost),
    icp_primary: v(f.malgruppPrimar),
    icp_secondary: v(f.malgruppSekundar),
    tone_rules: v(f.tonlage),
    usp: v(f.usp),
    pain_points: harVarde(f.smartpunkter) ? (f.smartpunkter.varde as string[]).join("\n") : null,
    customer_quotes: harVarde(f.kundcitat) ? (f.kundcitat.varde as string[]).join("\n\n") : null,
    services: harVarde(f.erbjudanden)
      ? (f.erbjudanden.varde as Tjanst[]).map((t) => (t.pris ? `${t.namn} — ${t.pris}` : t.namn)).join("\n")
      : null,
    pricing_notes: harVarde(f.erbjudanden)
      ? (f.erbjudanden.varde as Tjanst[]).filter((t) => t.pris).map((t) => `${t.namn}: ${t.pris}`).join("\n") || null
      : null,
    // Logotypen flyttades hit från GHL: den används för att GENERERA bild, inte för att
    // klistras in i ett meddelande. Bildmotorn väljer mellan ljus och mörk variant efter
    // bakgrundens ljushet (BILD-5/6b) — men sajtanalysen kan bara belägga EN variant.
    // `logo_url_mork` fylls därför aldrig härifrån, den är manuell. Att gissa fram en
    // mörk variant ur den ljusa vore precis den sortens rimliga påhitt som regeln förbjuder.
    logo_url: v(f.logotyp),
  };

  const { data: rad } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();

  if (rad) {
    const uppdatering: Record<string, string> = {};
    for (const [k, varde] of Object.entries(falt)) {
      if (!varde) continue;
      const nuvarande = (rad as Record<string, unknown>)[k];
      // Bara tomma fält fylls i. Ett ifyllt fält är någons beslut.
      if (nuvarande == null || String(nuvarande).trim() === "") uppdatering[k] = varde;
    }
    if (Object.keys(uppdatering).length) {
      await sb.from("hm_brand_profile").update({ ...uppdatering, updated_at: new Date().toISOString() }).eq("client_id", clientId);
    }
    return;
  }

  // Ingen rad än — id måste sättas för hand (se fälla 1 ovan).
  const { data: max } = await sb.from("hm_brand_profile").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  const nastaId = ((max as { id: number } | null)?.id ?? 0) + 1;

  const rent = Object.fromEntries(Object.entries(falt).filter(([, x]) => x != null));
  await sb.from("hm_brand_profile").insert({ id: nastaId, client_id: clientId, ...rent });
}

/** Läsbara modulnamn till välkomstmejlet. Fail-open: tom lista hellre än trasigt mejl. */
async function modulNamn(clientId: string): Promise<string[]> {
  try {
    const moduler = await getEffectiveModules(clientId);
    return moduler.map((m) => (m as { label?: string; id: string }).label || (m as { id: string }).id).slice(0, 10);
  } catch {
    return [];
  }
}
