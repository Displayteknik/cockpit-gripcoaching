// DRIV-1 — identitetsmatchningen (1A).
//
// Grundregeln: kontaktens EGEN e-post i GHL (hq_pipeline_cache.epost) är redan sanning —
// GHL har själv sagt vem adressen tillhör, ingen mänsklig bekräftelse behövs för den.
// Det som ÄR osäkert, och som får en rad i driv_lankar med status 'foreslagen', är allt
// som INTE kommer direkt ur GHL:s egen kontaktpost:
//   - en kalenderhändelse som bara MATCHAR på namn/företag i titel/beskrivning (svag signal)
//   - (framtida) en delad e-postadress som visar sig höra till TVÅ olika ghl_contact_id
//
// Namn används ALDRIG som ENDA grund för en BEKRÄFTAD koppling (spec 1A) — bara som
// stödsignal i en föreslagen rad som människan själv godkänner.

import { supabaseService } from "@/lib/supabase-admin";

export interface LankRad {
  id: string;
  ghl_contact_id: string;
  ghl_opportunity_id: string | null;
  ref_typ: "gmail_trad" | "kalenderhandelse";
  ref_id: string;
  kalla: "email" | "telefon" | "manuell";
  belagg: string;
  status: "bekraftad" | "foreslagen" | "avvisad";
}

/** Sparar en föreslagen koppling — idempotent (samma unika nyckel skrivs inte om). */
export async function foreslaLank(rad: {
  tenantId: string;
  ghlContactId: string;
  ghlOpportunityId?: string | null;
  refTyp: "gmail_trad" | "kalenderhandelse";
  refId: string;
  kalla: "email" | "telefon" | "manuell";
  belagg: string;
}): Promise<void> {
  const sb = supabaseService();
  await sb.from("driv_lankar").upsert(
    {
      tenant_id: rad.tenantId,
      ghl_contact_id: rad.ghlContactId,
      ghl_opportunity_id: rad.ghlOpportunityId || null,
      ref_typ: rad.refTyp,
      ref_id: rad.refId,
      kalla: rad.kalla,
      belagg: rad.belagg,
      status: "foreslagen",
    },
    { onConflict: "tenant_id,ghl_contact_id,ref_typ,ref_id", ignoreDuplicates: true },
  );
}

/** Alla länkar (oavsett status) för en kontakt — kortet visar bekräftade i tidslinjen, föreslagna i en egen rad. */
export async function lasLankar(ghlContactId: string): Promise<LankRad[]> {
  const sb = supabaseService();
  const { data } = await sb.from("driv_lankar").select("*").eq("ghl_contact_id", ghlContactId);
  return (data as LankRad[] | null) || [];
}

/**
 * Håkans klick: bekräfta eller avvisa. Beslutet är permanent (spec 1A: "gäller för alltid")
 * — en avvisad koppling föreslås aldrig igen eftersom unique-indexet i driv_lankar gör
 * nästa försök till en no-op (`ignoreDuplicates`), inte en ny rad.
 */
export async function beslutaLank(id: string, beslut: "bekraftad" | "avvisad", beslutadAv: string): Promise<boolean> {
  const sb = supabaseService();
  const { error } = await sb
    .from("driv_lankar")
    .update({ status: beslut, beslutad_av: beslutadAv, beslutad_tid: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

/**
 * Svag textmatchning för kalenderhändelser: namn eller företag förekommer i titel eller
 * beskrivning. ALDRIG en bekräftad koppling — bara en kandidat människan får ta ställning
 * till. Kräver minst 4 tecken i sökordet, annars ger korta namn falska träffar i varenda
 * kalender.
 */
export function kalenderKandidat(
  sokord: string,
  titel: string | null,
  beskrivning: string | null,
): boolean {
  const s = sokord.trim().toLowerCase();
  if (s.length < 4) return false;
  const text = `${titel || ""} ${beskrivning || ""}`.toLowerCase();
  return text.includes(s);
}
