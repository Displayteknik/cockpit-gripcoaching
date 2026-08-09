// G-3d — rotationen över tid.
//
// BAKGRUND (G0-RAPPORT 0.3b): ROTATIONSREGELN och `nyligen`-lagret i lib/prompt-core har
// funnits sedan T-6c, men undvik-listan skickades bara från ett par anropsställen. Regeln
// var alltså nästan overksam: prompten sa "återanvänd inte samma ingång" utan att någonsin
// få veta vilka ingångar som faktiskt använts. Ett lager som är på men tomt är samma tysta
// lösa löfte som resten av granskningsserien handlat om — det SER inkopplat ut.
//
// PRINCIPEN (Håkans beställning): ingen ny datamodell. Varje flöde läser SIN EGEN tabell,
// den där dess egna resultat redan sparas. Generationsloggen (G-1) duger inte som källa —
// den bär metadata om genereringen (syfte, promptversion, hooktyp), aldrig texten. Att
// lägga texten där hade varit en ny datamodell, och en andra kopia av kundtext på ett
// ställe till.
//
// FAIL-OPEN, ALLTID. En trasig historikläsning får aldrig stoppa en generering. Faller
// läsningen blir listan tom och prompten kör utan rotationslagret — exakt som före G-3d.
// Därför try/catch runt varje källa och aldrig ett kastat fel ut ur hamtaNyligen.

import { supabaseService } from "@/lib/supabase-admin";

/**
 * Rotationskällor. En per FLÖDE, inte per syfte: `enskilt` och `social` skriver båda
 * till hm_social_posts och delar därför källa, medan `caption` och `studio-text` skriver
 * till samma TABELL men till olika fält — och det är fältet som bär öppningen.
 */
export type RotationsKalla =
  | "social"
  | "linkedin"
  | "caption"
  | "studio-text"
  | "karusell"
  | "reel"
  | "nyhetsbrev"
  | "blogg"
  | "veckoplan"
  | "idebank";

interface Kalla {
  tabell: string;
  /** Kolumner som behövs för att plocka fram öppningen. */
  valj: string;
  /** Kolumn att sortera nyast först på. Alla tabeller har inte created_at. */
  sortera: string;
  /** Extra likhetsfilter, t.ex. bara karuseller ur studio_posts. */
  filter?: Record<string, string>;
  /** Rad → den öppning som ska undvikas. Tom sträng = raden bidrar inte. */
  plocka: (rad: Record<string, unknown>) => string;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
/** Första icke-tomma raden — öppningen i en flerradig text. */
const forstaRaden = (v: unknown): string => str(str(v).split("\n").find((r) => r.trim()) ?? "");

/** payload är jsonb; supabase-js ger den som objekt, men aldrig garanterat. */
function payload(rad: Record<string, unknown>): Record<string, unknown> {
  const p = rad.payload;
  if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
  if (typeof p === "string") {
    try {
      const tolkad = JSON.parse(p);
      return tolkad && typeof tolkad === "object" ? (tolkad as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

const KALLOR: Record<RotationsKalla, Kalla> = {
  // Hook-fältet finns som egen kolumn — inget behov av att gräva i en text.
  social: { tabell: "hm_social_posts", valj: "hook", sortera: "created_at", plocka: (r) => str(r.hook) },
  linkedin: { tabell: "linkedin_posts", valj: "hook", sortera: "created_at", plocka: (r) => str(r.hook) },

  // Captionen är flerradig; det är FÖRSTA raden som är ingången läsaren möter.
  caption: { tabell: "studio_posts", valj: "caption", sortera: "created_at", plocka: (r) => forstaRaden(r.caption) },

  // Texten PÅ bilden. headline1 är affischens huvudrubrik — motsvarigheten till en hook.
  // `title` duger inte: den sätts av användaren vid sparning och är ofta "Namnlöst inlägg".
  "studio-text": { tabell: "studio_posts", valj: "payload", sortera: "created_at", plocka: (r) => str(payload(r).headline1) },

  // Karusellens ingång är krok-slidens rubrik, inte inläggets titel. Filtret på
  // template_id håller isär karuseller från statiska affischer i samma tabell.
  karusell: {
    tabell: "studio_posts",
    valj: "payload",
    sortera: "created_at",
    filter: { template_id: "ark-karusell" },
    plocka: (r) => {
      const slides = payload(r).slides;
      if (!Array.isArray(slides)) return "";
      const krok = slides.find((s) => s && typeof s === "object" && (s as { kind?: string }).kind === "hook");
      return str((krok as { headline?: string } | undefined)?.headline);
    },
  },

  // Reelns ingång är scen 1:s overlay-text — de 1,7 sekunder som avgör om någon stannar.
  reel: {
    tabell: "studio_reels",
    valj: "storyboard",
    sortera: "created_at",
    plocka: (r) => {
      const sb = r.storyboard;
      const scener = sb && typeof sb === "object" ? (sb as { scenes?: unknown }).scenes : null;
      if (!Array.isArray(scener) || !scener.length) return "";
      return str((scener[0] as { line1?: string })?.line1);
    },
  },

  // Nyhetsbrevets ingång är ämnesraden. Den är det enda mottagaren ser innan hen öppnar.
  nyhetsbrev: { tabell: "newsletters", valj: "subject", sortera: "created_at", plocka: (r) => str(r.subject) },

  // hm_blog har ingen created_at — published_at sätts vid skapandet (blog/generate).
  blogg: { tabell: "hm_blog", valj: "title", sortera: "published_at", plocka: (r) => str(r.title) },

  // Veckoplanen skriver title = firstLine(hook) i studio_posts (generate/week).
  // Filtret på compass_source är inte kosmetik: utan det hade listan fyllts av manuellt
  // sparade inlägg, vars `title` ofta är "Namnlöst inlägg" eller ett arbetsnamn — alltså
  // brus som trängt undan de riktiga hookarna ur en lista med plats för fem.
  veckoplan: {
    tabell: "studio_posts",
    valj: "title",
    sortera: "created_at",
    filter: { compass_source: "schedule" },
    plocka: (r) => str(r.title),
  },

  // Nattflödet kör varje natt mot samma profil. Utan rotation får kunden samma idé
  // om och om igen — det flöde där rotationen behövs mest, och saknades helt.
  idebank: { tabell: "ideas_bank", valj: "body", sortera: "created_at", plocka: (r) => forstaRaden(r.body) },
};

export interface NyligenOpts {
  /** Hur många öppningar som hämtas. Default 5. */
  antal?: number;
  /**
   * Öppningar som INTE ska hamna i undvik-listan. Används av flöden som bygger vidare
   * på en vald ingång (linkedin/draft får en seed-hook): den ska förstås inte undvikas.
   */
  uteslut?: string[];
  /** Extra likhetsfilter ovanpå källans egna, t.ex. `type` i idébanken. */
  filter?: Record<string, string>;
}

/**
 * Flödets senaste öppningar → prompt-cores `nyligen`-lager ("NYLIGEN ANVÄNT — undvik
 * dessa ingångar/öppningar").
 *
 * Kastar ALDRIG. Går läsningen fel returneras en tom lista och genereringen fortsätter
 * utan rotationslagret — en avstängd rotation är ett kvalitetstapp, ett kastat fel är
 * en trasig knapp för kunden.
 */
export async function hamtaNyligen(
  clientId: string | null | undefined,
  kalla: RotationsKalla,
  opts: NyligenOpts = {},
): Promise<string[]> {
  if (!clientId) return [];
  const def = KALLOR[kalla];
  if (!def) return [];

  const antal = Math.min(Math.max(1, opts.antal ?? 5), 20);
  const uteslut = new Set((opts.uteslut ?? []).map((v) => str(v).toLowerCase()).filter(Boolean));

  try {
    let q = supabaseService()
      .from(def.tabell)
      .select(def.valj)
      .eq("client_id", clientId)
      .order(def.sortera, { ascending: false })
      // Hämtar med marginal: rader kan sakna fältet (ett utkast utan rubrik) och
      // dubbletter faller bort nedan. Utan marginalen hade en tenant med tomma
      // utkast fått en tom lista trots att historik finns.
      .limit(antal * 4);

    for (const [k, v] of Object.entries({ ...(def.filter ?? {}), ...(opts.filter ?? {}) })) {
      q = q.eq(k, v);
    }

    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];

    const ut: string[] = [];
    const sedda = new Set<string>();
    for (const rad of data as unknown as Record<string, unknown>[]) {
      const oppning = def.plocka(rad).replace(/\s+/g, " ").trim();
      if (!oppning) continue;
      const nyckel = oppning.toLowerCase();
      // Samma öppning två gånger i undvik-listan gör inte regeln starkare, bara längre.
      if (sedda.has(nyckel) || uteslut.has(nyckel)) continue;
      sedda.add(nyckel);
      ut.push(oppning);
      if (ut.length >= antal) break;
    }
    return ut;
  } catch {
    return [];
  }
}
