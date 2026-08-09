// G-1 — generationsloggen. Enda vägen in i public.generation_log.
//
// Samma ansvarsfördelning som lib/ai-usage: ledgern äger pengarna, den här filen äger
// kvaliteten. En rad per GENERERING (inte per betalt anrop), med det som gör ett utfall
// jämförbart: promptversion, syfte, format, funnel — och vilket inlägg det blev.
//
// Två regler bär hela filen:
//  1. **Loggningen får aldrig fälla flödet.** En trasig mätning ska kosta mätdata, aldrig
//     en kunds text. Allt är try/catch, allt returnerar null vid fel. Samma beslut som
//     loggaHandelse i lib/ai-usage — och av samma skäl.
//  2. **Ingen rad påstår mer än den vet.** Saknas kostnadskopplingen skrivs null, inte en
//     gissning; vyn räknar dem separat. G-0:s tyngsta lärdom var nollor som såg ut som
//     mätvärden — den här tabellen får inte bli nästa.

import { supabaseService } from "@/lib/supabase-admin";
import type { TextSyfte } from "@/lib/prompt-core";

export type GenerationStatus = "ok" | "error" | "kasserad";
export type Funnel = "tofu" | "mofu" | "bofu";

export interface Generering {
  tenantId?: string | null;
  /** Raden i ai_usage_events som betalade för det här. null = anropet gick utanför ledgern. */
  aiUsageEventId?: string | null;
  syfte: TextSyfte | string;
  /** 1080x1350 | 1080x1080 | 1080x1920 | karusell. Utelämnas för ren text. */
  format?: string | null;
  /** `ByggdPrompt.meta.promptVersion`. Enda obligatoriska fältet utöver syftet. */
  promptVersion: string;
  hookTyp?: string | null;
  motivKategori?: string | null;
  funnel?: Funnel | null;
  lager?: Record<string, boolean> | null;
  status?: GenerationStatus;
  varianter?: number;
}

/** Var en generering hamnade. Tabellnamnet ingår — id ensamt säger inte vilken ID-rymd det är. */
export interface Anvandning {
  tabell: "studio_posts" | "studio_media" | "hm_social_posts" | "linkedin_posts" | "newsletter_posts" | string;
  id: string;
}

/**
 * Skriver en rad i generation_log och returnerar dess id (så anroparen kan koppla
 * genereringen till inlägget senare med `kopplaTillInlagg`). Kastar aldrig.
 */
export async function loggaGenerering(g: Generering): Promise<string | null> {
  try {
    if (!g.promptVersion || !g.syfte) return null; // en rad utan dessa två är inte mätbar
    const sb = supabaseService();
    const { data } = await sb
      .from("generation_log")
      .insert({
        tenant_id: g.tenantId || null,
        ai_usage_event_id: g.aiUsageEventId || null,
        syfte: g.syfte,
        format: g.format || null,
        prompt_version: g.promptVersion,
        hook_typ: g.hookTyp || null,
        motiv_kategori: g.motivKategori || null,
        funnel: g.funnel || null,
        lager: g.lager || null,
        status: g.status || "ok",
        varianter: g.varianter && g.varianter > 0 ? g.varianter : 1,
      })
      .select("id")
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch (e) {
    console.error("[generationslogg] kunde inte logga generering:", (e as Error).message);
    return null;
  }
}

/**
 * Binder en generering till inlägget den blev. Anropas när inlägget sparas — inte vid
 * genereringen, för då vet ingen ännu om texten används.
 *
 * Returnerar true bara när raden faktiskt uppdaterades. Ett tyst false är information:
 * det betyder att kopplingen saknas, och vyn räknar sådana rader.
 */
export async function kopplaTillInlagg(generationId: string | null, anvandning: Anvandning): Promise<boolean> {
  try {
    if (!generationId || !anvandning?.tabell || !anvandning?.id) return false;
    const sb = supabaseService();
    const { data } = await sb
      .from("generation_log")
      .update({ anvand_i_tabell: anvandning.tabell, anvand_i_id: String(anvandning.id) })
      .eq("id", generationId)
      .select("id")
      .maybeSingle();
    return !!data;
  } catch (e) {
    console.error("[generationslogg] kunde inte koppla generering till inlägg:", (e as Error).message);
    return false;
  }
}

/**
 * Markerar en generering som kasserad — genererad men förkastad (omgenerering, eller
 * användaren valde en annan variant).
 *
 * Varför det är ett eget läge och inte en raderad rad: en mätning som bara ser det som
 * blev publicerat läser bort exakt de fall där kvaliteten föll. Kasserade rader ÄR
 * kvalitetsdatan.
 */
export async function markeraKasserad(generationId: string | null): Promise<boolean> {
  try {
    if (!generationId) return false;
    const sb = supabaseService();
    const { data } = await sb
      .from("generation_log")
      .update({ status: "kasserad" })
      .eq("id", generationId)
      .select("id")
      .maybeSingle();
    return !!data;
  } catch (e) {
    console.error("[generationslogg] kunde inte markera kasserad:", (e as Error).message);
    return false;
  }
}

// ── Rena hjälpare (inga DB-anrop — därför testbara) ─────────────────────────

/**
 * Formatet som loggen ska bära. En karusell är INTE bildstorleken den råkar ha:
 * G-0 0.4 punkt 2 var att karusell och statisk bild blev samma rad eftersom `flow`
 * härleddes ur URL:en. Här är karusell ett eget format.
 */
export function loggFormat(opts: { format?: string | null; karusell?: boolean }): string | null {
  if (opts.karusell) return "karusell";
  return opts.format || null;
}

/** Funnel-värdet som får skrivas. Allt annat blir null hellre än ett påhittat läge. */
export function loggFunnel(v: unknown): Funnel | null {
  return v === "tofu" || v === "mofu" || v === "bofu" ? v : null;
}
