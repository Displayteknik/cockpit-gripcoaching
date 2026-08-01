// KVALITET-3 punkt 3 — en idé är UNDERLAG, aldrig publik text.
//
// Bakgrund: veckoplanen genererar en CAPTION per dag (lång anatomi: hook, story, nytta,
// en CTA). Den texten skrevs sedan ordagrant in i `payload.headline1` och `payload.body`
// — alltså texten som trycks PÅ BILDEN. Det är ett helt annat format: max ~26 tecken
// rubrik, max ~90 tecken brödtext, ingen CTA (mallens fot och captionen bär den).
// Resultatet blev pitch-språk på affischen ("Digitala menyskärmar med högt ljus syns
// även i…"), och det passerade aldrig affisch-anatomin i lib/studio/copy.ts.
//
// Regeln nu: dagens material går in som UNDERLAG (`brief`) + `caption`. Fälten på bilden
// lämnas TOMMA och genereras i Studio via generateStudioCopy (pa-bild-anatomin, röst,
// skrivregler, sanering) med captionen som grund.

/** Kortar ett underlag till en brief som ryms i payloaden (brief klipps ändå vid 600). */
export function briefFranDag(theme: string, hook: string, body: string): string {
  const delar = [
    theme.trim() ? `Veckotema: ${theme.trim()}` : "",
    hook.trim() ? `Dagens vinkel: ${hook.trim()}` : "",
    body.trim() ? body.trim() : "",
  ].filter(Boolean);
  return delar.join("\n").slice(0, 600);
}

export interface DagensStudioPayload {
  templateId: string;
  format: string;
  headline1: string;
  headline2: string;
  body: string;
  caption: string;
  brief: string;
  mode: "template";
}

/**
 * Bygger Studio-payloaden för en planerad dag.
 *
 * headline1/headline2/body är ALLTID tomma: texten på bilden ska genereras, aldrig ärvas
 * från captionen. Studio upptäcker att fälten är tomma och genererar dem ur captionen
 * (samma väg som "Ge mig 3 idéer") när inlägget öppnas.
 */
export function dagensStudioPayload(args: {
  theme: string;
  hook: string;
  body: string;
  caption: string;
  templateId?: string;
  format?: string;
}): DagensStudioPayload {
  return {
    templateId: args.templateId || "ark-textkort",
    // Veckoplanens `format` är ett INNEHÅLLSformat (t.ex. big_stat), inte ett bildmått.
    format: args.format || "1080x1350",
    headline1: "",
    headline2: "",
    body: "",
    caption: args.caption,
    brief: briefFranDag(args.theme, args.hook, args.body),
    mode: "template",
  };
}

/**
 * Vakt för tester och framtida kod: är fältet en ordagrann avskrift av captionen?
 * Jämför normaliserat (gemener, hopslagna blanksteg) och kräver minst 25 tecken så
 * korta, legitima sammanträffanden ("Öppet i dag") inte flaggas.
 */
export function arKopieradFranCaption(falt: string, caption: string): boolean {
  const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const f = norm(falt);
  const c = norm(caption);
  if (f.length < 25 || !c) return false;
  return c.includes(f);
}
