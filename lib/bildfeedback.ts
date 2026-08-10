// G-6 — bildfeedbacken som ett lager, inte som en tabell någon råkar läsa.
//
// BAKGRUND: tummen i ImagePicker lovar "Bra bild — AI lär sig". Löftet höll inte:
// feedbacken lästes bara av legacy-vägen (/api/social/generate-image), medan Studios
// Bildhjälpen — den väg kunderna faktiskt använder — aldrig läste den. Mätt 10/8: alla
// tre sparade rader saknade dessutom client_id, så inte ens legacy-vägen hittade dem.
//
// Modulen gör tre saker och inget mer:
//   1. läser tenantens egen feedback (fail-open),
//   2. renderar den som ett promptblock som SKILJER på beröm och kritik,
//   3. håller kritiken i klartext så motivet går att undvika nästa gång.
//
// ⚠ SKILLNADEN MOT ROTATIONEN (G-3d): rotationen säger "variera" — undvik det senaste
// oavsett om det var bra. Feedbacken säger "det HÄR var fel". De två lagren får inte
// slås ihop: en bild kunden gillade ska kunna komma tillbaka i en annan variant, medan
// en bild hen underkände ska undvikas även om den är gammal.

import { supabaseService } from "@/lib/supabase-admin";

export interface BildOmdome {
  rating: number;
  prompt: string | null;
  kommentar: string | null;
  bildStil: string | null;
}

export interface BildfeedbackLage {
  gillade: BildOmdome[];
  ogillade: BildOmdome[];
  /** Har tenanten någon feedback alls? Styr om lagret läggs på. */
  finns: boolean;
}

export const INGEN_BILDFEEDBACK: BildfeedbackLage = { gillade: [], ogillade: [], finns: false };

const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * Tenantens senaste bildomdömen. Kastar ALDRIG: en trasig läsning ska kosta lärande,
 * aldrig en bild. Samma fail-open-beslut som rotationen och bevis-motorn.
 */
export async function hamtaBildfeedback(clientId: string | null | undefined, antal = 12): Promise<BildfeedbackLage> {
  if (!clientId) return INGEN_BILDFEEDBACK;
  try {
    const { data } = await supabaseService()
      .from("image_feedback")
      .select("rating, prompt, kommentar, image_style")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(1, antal), 40));

    const gillade: BildOmdome[] = [];
    const ogillade: BildOmdome[] = [];
    for (const rad of (data ?? []) as Record<string, unknown>[]) {
      const o: BildOmdome = {
        rating: Number(rad.rating ?? 0),
        prompt: str(rad.prompt).slice(0, 200) || null,
        kommentar: str(rad.kommentar).slice(0, 200) || null,
        bildStil: str(rad.image_style) || null,
      };
      // En rad utan både prompt och kommentar bär ingen information — bara ett tal.
      if (!o.prompt && !o.kommentar) continue;
      if (o.rating > 0) gillade.push(o);
      else if (o.rating < 0) ogillade.push(o);
    }
    return { gillade: gillade.slice(0, 6), ogillade: ogillade.slice(0, 6), finns: gillade.length + ogillade.length > 0 };
  } catch (e) {
    console.error("[bildfeedback] kunde inte läsas:", e);
    return INGEN_BILDFEEDBACK;
  }
}

/**
 * Promptblocket, på engelska eftersom bildprompten är det.
 *
 * Kritiken väger tyngre än berömmet och läggs SIST: det kunden sagt nej till är det
 * som absolut inte får komma tillbaka, medan berömmet bara är en riktning.
 */
export function bildfeedbackBlock(lage: BildfeedbackLage): string {
  if (!lage.finns) return "";
  const rader: string[] = [];

  if (lage.gillade.length) {
    rader.push("CLIENT-APPROVED IMAGERY (this direction worked — lean towards it, do not copy it literally):");
    for (const o of lage.gillade) {
      rader.push(`- ${[o.prompt, o.kommentar && `client said: "${o.kommentar}"`].filter(Boolean).join(" — ")}`);
    }
  }

  if (lage.ogillade.length) {
    rader.push("CLIENT-REJECTED IMAGERY (the client explicitly turned these down — do NOT produce anything like them):");
    for (const o of lage.ogillade) {
      rader.push(`- ${[o.prompt, o.kommentar && `client said: "${o.kommentar}"`].filter(Boolean).join(" — ")}`);
    }
    rader.push("If your idea resembles a rejected item above, choose a different subject entirely.");
  }

  return rader.join("\n");
}
