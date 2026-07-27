// GLOBALA SKRIVREGLER — gäller alla tenants och alla innehållstyper
// (inlägg, captions, blogg, mejl, nyhetsbrev). EN källa för både promptlagret
// och saneringslagret, så reglerna aldrig kan driva isär.
//
// Lager 1 (prompt): WRITING_RULES_BLOCK vävs in i promptbygget, på samma nivå
//   som anatomilagret (röst → anatomi → funnel → 4A → DISC → skrivregler).
// Lager 2 (sanering): sanitizeGenerated() är ett deterministiskt skyddsnät som
//   körs på färdig text innan den visas och innan publicering. Modellen kan slarva,
//   saneringen kan inte.
//
// Per-tenant avstängning: clients.writing_rules_enabled (default true).

// ── Regel 1: tankstreck ───────────────────────────────────────────────────────
// Tankstreck (– en dash, — em dash) får inte användas som paus- eller inskottstecken.
// Bindestreck (-) i sammansatta ord (LED-vägg, före/efter-bilder) är korrekt svenska
// och rörs ALDRIG. Siffer-intervall utan mellanslag (10–12, 2020–2024) rörs inte heller.

// ── Regel 3: hashtags ─────────────────────────────────────────────────────────
export const MAX_HASHTAGS = { instagram: 5, facebook: 5, linkedin: 3, default: 5 } as const;
export type HashtagKanal = keyof typeof MAX_HASHTAGS;

/** Promptblocket. Läggs sist i hierarkin så det vinner över stilinstruktioner ovanför. */
export const WRITING_RULES_BLOCK = [
  "=== GLOBALA SKRIVREGLER (gäller alltid, väger tyngst) ===",
  "1. TANKSTRECK: använd ALDRIG tankstreck (– eller —) som paus eller inskott i löptext.",
  "   Skriv punkt, komma eller kolon, eller formulera om meningen.",
  "   Bindestreck i sammansatta ord är korrekt och ska användas som vanligt: LED-vägg, före/efter-bilder, e-post.",
  "2. HOOK: första raden ska vara en direkt fråga till läsaren eller ett konkret påstående.",
  "   Öppna ALDRIG med en generalisering som \"många företag...\", \"i dagens samhälle...\" eller \"det är viktigt att...\".",
  "   En generalisering får komma tidigast på rad 2, aldrig som hook.",
  "3. HASHTAGS: max 3 till 5 relevanta taggar som faktiskt används och söks på.",
  "   På LinkedIn max 3. Hitta aldrig på slogan-taggar utan sökvolym (t.ex. #vireddarvarlden).",
  "4. CTA: exakt EN uppmaning per inlägg, alltid sist. Aldrig två olika saker att göra.",
].join("\n");

// ── Saneringslagret ───────────────────────────────────────────────────────────

/** Är raden ett punktlisteobjekt? (\"– punkt\", \"— punkt\", \"- punkt\", \"* punkt\") */
function arListrad(rad: string): boolean {
  return /^\s*[-–—*•]\s+\S/.test(rad);
}

/**
 * Regel 1: ta bort tankstreck som skiljetecken, behåll bindestreck och intervall.
 * - " – " / " — " (omgivet av mellanslag) → ", "
 * - "ord—ord" (em dash utan mellanslag) → ", " (em dash är aldrig korrekt i svenska sammansättningar)
 * - "10–12" (en dash utan mellanslag) → orört, det är ett intervall
 * - "LED-vägg" → orört
 * - Punktlistor med streck → orörda (raden börjar med streck + mellanslag)
 */
export function taBortTankstreck(text: string): string {
  const rader = String(text || "").split("\n");
  // En ensam rad som börjar med tankstreck är ett inskott, flera i rad är en lista.
  const listrader = new Set<number>();
  rader.forEach((r, i) => {
    if (!arListrad(r)) return;
    const foreListrad = i > 0 && arListrad(rader[i - 1]);
    const efterListrad = i < rader.length - 1 && arListrad(rader[i + 1]);
    if (foreListrad || efterListrad) listrader.add(i);
  });

  return rader
    .map((rad, i) => {
      if (listrader.has(i)) return rad; // äkta punktlista, rör inte strecket
      let ut = rad;
      // Inledande tankstreck som inte är en lista: "– Så här gör du" → "Så här gör du"
      ut = ut.replace(/^(\s*)[–—]\s+/, "$1");
      // Tankstreck omgivet av mellanslag → komma (både – och —).
      ut = ut.replace(/\s+[–—]\s+/g, ", ");
      // Em dash utan mellanslag → komma + mellanslag. En dash lämnas (intervall).
      ut = ut.replace(/\s*—\s*/g, ", ");
      // Städa dubbla skiljetecken som kan uppstå: "text, , mer" och ", ." → ", "
      ut = ut.replace(/,\s*,/g, ",").replace(/,\s*([.!?:;])/g, "$1");
      return ut;
    })
    .join("\n");
}

/** AI-floskler som aldrig får nå kundtext (befintlig grind, nu global). */
export function taBortFloskler(text: string): string {
  return String(text || "")
    .replace(/\bhandlar\s+inte\s+om\b/gi, "gäller inte")
    .replace(/\bhandlar\s+om\b/gi, "gäller")
    .replace(/\bkraftfullt\b/gi, "starkt").replace(/\bkraftfulla\b/gi, "starka").replace(/\bkraftfull\b/gi, "stark")
    .replace(/\bbanbrytande\b/gi, "nyskapande")
    .replace(/\bgame[-\s]?changer\b/gi, "avgörande")
    .replace(/\bnästa\s+nivå\b/gi, "längre")
    .replace(/\bholistiskt?\b/gi, "helhet").replace(/\bholistiska\b/gi, "helhets")
    .replace(/\bskalbar[t]?\b/gi, "lätt att växa");
}

/**
 * Regel 3: begränsa antal hashtags. Behåller ordningen och de första N (modellen
 * lägger de mest relevanta först). Rör bara fristående taggar, inte text.
 */
export function begransaHashtags(text: string, kanal: HashtagKanal = "default"): string {
  const max = MAX_HASHTAGS[kanal] ?? MAX_HASHTAGS.default;
  const traffar = String(text || "").match(/#[\p{L}\p{N}_]+/gu);
  if (!traffar || traffar.length <= max) return text;
  let n = 0;
  return String(text)
    .replace(/#[\p{L}\p{N}_]+/gu, (m) => (++n <= max ? m : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Hela skyddsnätet i ett anrop. Körs på all genererad text innan den visas i
 * Studio och innan publicering (även schemalagda inlägg som redan ligger i kön).
 */
export function sanitizeGenerated(text: string, opts: { kanal?: HashtagKanal; hashtags?: boolean } = {}): string {
  if (!text) return text;
  let ut = taBortTankstreck(text);
  ut = taBortFloskler(ut);
  if (opts.hashtags !== false) ut = begransaHashtags(ut, opts.kanal || "default");
  return ut;
}

/**
 * Per-tenant avstängning. Default PÅ: en klient som inte sagt något ska följa reglerna.
 * Fel vid läsning → på, skyddsnätet ska aldrig försvinna av ett databasfel.
 */
export async function skrivreglerPa(clientId: string | null | undefined): Promise<boolean> {
  if (!clientId) return true;
  try {
    const { supabaseService } = await import("@/lib/supabase-admin");
    const { data } = await supabaseService()
      .from("clients")
      .select("writing_rules_enabled")
      .eq("id", clientId)
      .maybeSingle();
    return data?.writing_rules_enabled !== false;
  } catch {
    return true;
  }
}

/** Regel 2 (kontroll, inte fix): öppnar texten med en generalisering? */
export function harSvagHook(text: string): boolean {
  const forsta = String(text || "").split("\n").find((r) => r.trim())?.trim() || "";
  return /^(många|de flesta|alla|i dagens|i en värld|det är viktigt|numera|nuförtiden|allt fler)\b/i.test(forsta);
}

/** Regel 4 (kontroll): fler än en uppmaning? Grov heuristik för granskning. */
export function raknaCta(text: string): number {
  const m = String(text || "").match(/\b(svara|skriv|dm:?a|boka|ring|klicka|läs mer|anmäl dig|kommentera|dela|följ)\b/gi);
  return m ? m.length : 0;
}
