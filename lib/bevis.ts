// G-4 — bevis-motorn.
//
// BAKGRUND (G0-RAPPORT 0.3c): "Bevismekanik — nej, och den är aktivt bortmotad."
// Vinnande exempel gick in som "matcha denna kvalitet" — en STILREFERENS, inte ett
// bevis. Kundcitat fick bara användas om personen står i story-banken, sanningskravet
// förbjöd påhittade siffror, och INGEN position i någon anatomi krävde ett bevis.
// Nettot: modellen såg bevismaterial men hade ingen anledning att använda det.
//
// SKILLNADEN MOT SANNINGSKRAVET: sanningskravet är en SPÄRR ("hitta inte på"). Den här
// modulen är en INBJUDAN ("här ÄR materialet, använd det"). En spärr utan inbjudan ger
// texter som är sanna men tomma — och det var precis utfallet.
//
// ── HÅKANS BESLUT, STÅR FAST (31/7 + 9/8) ───────────────────────────────────
// Källorna är TRE, och priser är inte en av dem:
//   1. Verifierade siffror — profilens `verified_numbers` (eget fält sedan G-4) plus
//      tal som redan står i profilens ÖVRIGA fält. ALDRIG `pricing_notes`.
//   2. Kundcitat ur story-banken — som CITAT, aldrig omskrivet till eget minne.
//   3. Vinnande exempel — men fortsatt som stilreferens, se nedan.
//
// ⚠ `pricing_notes` ÄR SPÄRRAD OCH FÖRBLIR SPÄRRAD. Priserna är sanningsunderlag: de
// finns i prompten för att modellen ska VETA vad saker kostar (så att "prisvärt" är
// sant och uppmaningen pekar rätt), aldrig för att citeras. Att känna till priset och
// att skriva ut priset är två olika saker. Mätt 9/8: 20 av 51 tal som profilmätaren
// räknade som användbara fanns bara i pricing_notes — mätaren lovade alltså bevis som
// motorn har förbud att leverera. Den räkningen är rättad i lib/profil/kvalitet.
//
// ⚠ VINNANDE EXEMPEL FÖRBLIR STILREFERENS. De ligger kvar i sitt eget lager
// ("matcha denna kvalitet") och räknas INTE som citerbart bevis här. Skälet är att ett
// vinnande exempel är en FÄRDIG TEXT, inte en kontrollerad uppgift: siffror inuti den
// kan vara omskrivna, avrundade eller hämtade ur en kampanj som inte gäller längre.
// Att låta modellen citera ur den hade återinfört exakt den fabricering G-4 finns för
// att stoppa. De räknas som bevis-TÄCKNING (tenanten har material) men aldrig som
// bevis-KÄLLA.

import { siffrorMedEnhet } from "@/lib/profil/kvalitet";

/** Profilfält som får bidra med citerbara tal. pricing_notes står MED FLIT inte här. */
const SIFFERFALT = [
  "verified_numbers",
  "brand_story",
  "usp",
  "differentiators",
  "services",
  "icp_primary",
  "pain_points",
  "customer_journey",
  "competitors",
] as const;

export interface BevisMaterial {
  /** Citerbara tal, mest specifika först. Tomt = tenanten har inga. */
  siffror: string[];
  /** Kundcitat ur story-banken, ordagrant. Tomt = inga. */
  citat: string[];
  /** Har tenanten vinnande exempel? Räknas som täckning, aldrig som citatkälla. */
  harVinnande: boolean;
}

export interface BevisLage extends BevisMaterial {
  /**
   * Får en position KRÄVA ett bevis i den här körningen? Falskt när tenanten saknar
   * material — och då ska positionen skrivas om, inte fyllas med ett påhitt.
   */
  kanKravaBevis: boolean;
}

/** Tomt läge. Används när profilen saknas eller läsningen faller. */
export const INGET_BEVIS: BevisLage = { siffror: [], citat: [], harVinnande: false, kanKravaBevis: false };

/**
 * Plockar citerbara tal ur ett profilfält.
 *
 * Talet lämnas tillbaka med sin MENING, inte som ett naket tal: "sedan 1998" säger
 * något, "1998" gör det inte. Modellen får alltså en påstående-rad den kan använda,
 * inte ett tal den måste hitta på en inramning till — det senare är fabricering med
 * extra steg.
 */
export function taBevisRader(text: string): string[] {
  const t = String(text || "").replace(/\r/g, "");
  if (!t.trim()) return [];
  const ut: string[] = [];
  // Meningar OCH radbrytningar: profilfält skrivs ofta som punktlistor utan punkt.
  for (const bit of t.split(/(?<=[.!?])\s+|\n+/)) {
    const rad = bit.replace(/^[-•*\s]+/, "").replace(/\s+/g, " ").trim();
    if (!rad || rad.length < 4) continue;
    if (siffrorMedEnhet(rad).length === 0) continue;
    ut.push(rad.length > 180 ? `${rad.slice(0, 177)}…` : rad);
  }
  return Array.from(new Set(ut));
}

/**
 * Bevisläget för en tenant. Fail-open: en trasig läsning ger INGET_BEVIS, vilket
 * betyder "kräv inget bevis" — aldrig "hitta på ett".
 */
export async function hamtaBevis(clientId: string | null | undefined): Promise<BevisLage> {
  if (!clientId) return INGET_BEVIS;
  try {
    const { supabaseService } = await import("@/lib/supabase-admin");
    const sb = supabaseService();

    const { data: profil } = await sb
      .from("hm_brand_profile")
      .select(SIFFERFALT.join(", "))
      .eq("client_id", clientId)
      .maybeSingle();

    const siffror: string[] = [];
    if (profil) {
      // Det egna fältet först: det är kundens egen utpekning av vad som får citeras,
      // och väger tyngre än ett tal som råkar stå i en säljtext.
      for (const falt of SIFFERFALT) {
        for (const rad of taBevisRader(String((profil as unknown as Record<string, unknown>)[falt] ?? ""))) {
          if (!siffror.includes(rad)) siffror.push(rad);
        }
      }
    }

    // Story-banken: samma källa som sanningskravet redan pekar ut som enda tillåtna
    // för kundcase (prompt-core SANNINGSKRAV). Citatet ska tillbaka ORDAGRANT.
    const { data: stories } = await sb
      .from("linkedin_posts")
      .select("hook, idea_seed")
      .eq("client_id", clientId)
      .eq("source_module", "intake")
      .in("status", ["idea", "draft", "approved", "posted"])
      .order("created_at", { ascending: false })
      .limit(12);

    const citat: string[] = [];
    for (const s of stories ?? []) {
      const rad = [s.hook, s.idea_seed].map((v) => String(v ?? "").trim()).filter(Boolean).join(" — ");
      if (rad.length >= 20 && !citat.includes(rad)) citat.push(rad.length > 220 ? `${rad.slice(0, 217)}…` : rad);
    }

    const { count } = await sb
      .from("client_assets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("category", "winning_example")
      .eq("status", "active");

    const material: BevisMaterial = {
      siffror: siffror.slice(0, 12),
      citat: citat.slice(0, 6),
      harVinnande: (count ?? 0) > 0,
    };
    return { ...material, kanKravaBevis: material.siffror.length > 0 || material.citat.length > 0 };
  } catch (e) {
    console.error("[bevis] kunde inte läsas:", e);
    return INGET_BEVIS;
  }
}

/**
 * Promptlagret. Två helt olika texter, och det är hela poängen:
 *
 * MED material → en INBJUDAN med materialet uppräknat och ett krav på att använda det.
 * UTAN material → ett uttryckligt FÖRBUD mot att låtsas ha bevis, plus anvisning om
 * vad man skriver i stället. Ett tomt lager hade lämnat modellen med anatomins krav på
 * ett bevis och ingen källa — den kombinationen ÄR beställningen att fabricera.
 */
export function bevisBlock(lage: BevisLage): string {
  if (!lage.kanKravaBevis) {
    return [
      "=== BEVIS: KLIENTEN HAR INGET VERIFIERAT MATERIAL ===",
      "Profilen saknar verifierade siffror och story-bank-material. Du har alltså INGET att belägga påståenden med i den här texten.",
      "Skriv därför HELT utan sifferpåståenden, utan kundcitat och utan kundcase. Beskriv i stället vad klienten gör och vad det betyder, generellt och sant.",
      "Skriv ALDRIG en mening som LÅTER belagd utan att vara det ('många kunder vittnar om...', 'gång på gång ser vi...', 'de flesta upplever...'). En antydd mätning utan mätning är samma fel som en påhittad siffra.",
    ].join("\n");
  }

  const delar = ["=== BEVIS (verifierat material — ANVÄND det, hitta aldrig på mer) ==="];
  if (lage.siffror.length) {
    delar.push(
      "VERIFIERADE SIFFROR ur klientens profil. Dessa FÅR skrivas ut, ordagrant eller lätt omformulerat med samma innebörd:",
      ...lage.siffror.map((s) => `- ${s}`),
    );
  }
  if (lage.citat.length) {
    delar.push(
      "STORY-BANKEN (verkliga händelser och kundröster). Återges som CITAT eller i TREDJE PERSON — aldrig omskrivet till ett eget minne i jag-form:",
      ...lage.citat.map((c) => `- ${c}`),
    );
  }
  delar.push(
    "HÅRD REGEL: bygger texten ett påstående på en siffra eller ett kundcase ska det komma HÄRIFRÅN. Behöver du ett tal som inte står ovan: skriv meningen utan tal.",
    "PRISER ÄR INTE BEVIS. Klientens prisuppgifter står med i profilen som sanningsunderlag och får ALDRIG skrivas ut, hur väl de än skulle passa som konkretion här.",
  );
  return delar.join("\n");
}
