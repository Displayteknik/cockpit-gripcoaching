// Etapp L2b — kommentarsautomation. Spec: docs/plattform/LEAD-AUTOMATION.md
//
// DRYRUN ÄR PÅ SOM DEFAULT, samma princip som SMS-verktyget (lib/sms/elks.ts:12).
// Skarpt läge kräver uttryckligen IG_COMMENT_DRYRUN=false. Ett automatiskt publikt svar
// på en kunds Instagram går inte att ta tillbaka, så standardläget måste vara tyst.
//
// DM-CO-PILOT-PRINCIPEN: det här svaret är det ENDA automatiska utskicket i hela kedjan.
// Allt därefter formuleras som förslag och skickas av en människa.

import { supabaseService } from "@/lib/supabase-admin";
import { igPost } from "@/lib/instagram";

/** DRYRUN på som default. Endast ett uttryckligt "false" släpper igenom skarpa svar. */
export function kommentarDryrun(): boolean {
  const v = (process.env.IG_COMMENT_DRYRUN ?? "true").toLowerCase().trim();
  return v !== "false" && v !== "0";
}

// Hela ord, skiftlägesokänsligt. \p{L} gör att "BILDER" inte matchar "BILD" av misstag,
// och att svenska tecken hanteras rätt.
export const NYCKELORD = ["BILD", "PRIS"] as const;

export function hittaNyckelord(text: string): string | null {
  const t = String(text || "");
  for (const ord of NYCKELORD) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${ord}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(t)) return ord;
  }
  return null;
}

/**
 * Svarstexten. Kort, personlig, en enda uppmaning, ingen jargong. Följer kundresans
 * låga tröskel: "skicka en bild, offert inom 24 timmar".
 */
export function byggSvar(nyckelord: string, uppladdningsUrl: string, username?: string): string {
  const hej = username ? `Hej @${username}! ` : "Hej! ";
  return nyckelord === "PRIS"
    ? `${hej}Priset beror på fönstret. Ladda upp en bild här så får du ett förslag och ett pris inom 24 timmar: ${uppladdningsUrl}`
    : `${hej}Kul att du vill se hur det skulle se ut. Ladda upp en bild på platsen här så hör vi av oss inom 24 timmar: ${uppladdningsUrl}`;
}

export interface KommentarHandelse {
  clientId: string;
  kommentarId: string;
  mediaId?: string;
  text: string;
  username?: string;
  /** Kontots egen IG-username, så vi aldrig svarar oss själva. */
  egenUsername?: string;
  token: string;
  uppladdningsUrl: string;
  payload?: unknown;
}

export type KommentarResultat =
  | { atgard: "dubblett" }
  | { atgard: "egen" }
  | { atgard: "ignorerad" }
  | { atgard: "dryrun"; svar: string }
  | { atgard: "svarat"; svar: string; svarId?: string }
  | { atgard: "fel"; fel: string };

/**
 * Kör hela beslutskedjan för en inkommande kommentar och loggar utfallet i ig_events.
 * Kastar aldrig: en webhook som kastar får Meta att leverera om i all oändlighet.
 */
export async function hanteraKommentar(h: KommentarHandelse): Promise<KommentarResultat> {
  const sb = supabaseService();

  async function logga(atgard: string, extra: Record<string, unknown> = {}) {
    try {
      await sb.from("ig_events").insert({
        client_id: h.clientId,
        external_id: h.kommentarId,
        typ: "comment",
        ig_username: h.username || null,
        text_innehall: h.text?.slice(0, 2000) || null,
        media_id: h.mediaId || null,
        atgard,
        payload: (h.payload as Record<string, unknown>) || null,
        ...extra,
      });
    } catch {
      /* loggen får aldrig fälla hanteringen */
    }
  }

  // 1. Idempotens FÖRST. Meta levererar om vid timeout; utan den här kontrollen blir
  //    varje omleverans ett nytt publikt svar.
  const { data: fanns } = await sb.from("ig_events").select("id").eq("external_id", h.kommentarId).maybeSingle();
  if (fanns) return { atgard: "dubblett" };

  // 2. Aldrig svara på oss själva. Vårt eget svar triggar en ny webhook-händelse, och
  //    utan den här grinden svarar kontot sig självt i en oändlig loop.
  if (h.egenUsername && h.username && h.username.toLowerCase() === h.egenUsername.toLowerCase()) {
    await logga("egen");
    return { atgard: "egen" };
  }

  // 3. Nyckelord.
  const ord = hittaNyckelord(h.text);
  if (!ord) {
    await logga("ignorerad");
    return { atgard: "ignorerad" };
  }

  const svar = byggSvar(ord, h.uppladdningsUrl, h.username);

  // 4. DRYRUN: registrera vad vi SKULLE svarat, men skriv ingenting publikt.
  if (kommentarDryrun()) {
    await logga("dryrun", { svar_text: svar });
    return { atgard: "dryrun", svar };
  }

  // 5. Skarpt svar.
  try {
    const res = (await igPost(`${h.kommentarId}/replies`, h.token, { message: svar })) as { id?: string };
    await logga("svarat", { svar_text: svar, svar_id: res?.id || null });
    return { atgard: "svarat", svar, svarId: res?.id };
  } catch (e) {
    const fel = (e as Error).message?.slice(0, 400) || "okänt fel";
    await logga("fel", { svar_text: svar, fel });
    return { atgard: "fel", fel };
  }
}
