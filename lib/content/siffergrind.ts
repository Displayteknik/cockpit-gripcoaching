// Deterministisk siffergrind för genererad text.
//
// ★ VARFÖR DEN LIGGER HÄR OCH INTE I EN ROUTE (FIX-1/A3, 2026-08-07)
//
// Grinden fanns, men som en LOKAL funktion inuti app/api/generate/week/route.ts. Därför
// hade veckoplanen skydd medan `generate/post` bara hade `saneraText` och
// `content/classify` ingenting alls. Skarptestet av For Balance gav idéförslaget
// "75 min för att äntligen bli hörd" med etiketten Statistik — profilen säger 45 minuter,
// och etiketten fick siffran att se verifierad ut.
//
// Ett skydd som bara finns på en av tre vägar är inget skydd, det är en slump. Modulen är
// därför fristående och importeras av alla vägar som producerar text med tal i.
//
// KVALITET-3/p11, Håkans beslut 2026-08-01: kravet gäller VARJE siffra, även jämförelser
// med omvärlden ("en vanlig TV klarar sällan mer än 400 nits"). Ett tal om andras
// produkter är lika obackat som ett om klienten.
//
// Fail-open: kastar omgenereringen levereras första försöket, med en varning i loggen.
// Användarens egna tal räknas alltid som täckta — skriver Håkan "45 min" i ämnet är 45
// ett belagt tal.

import { generate } from "@/lib/gemini";
import { obackadeSiffror, SIFFER_SKARPNING, talTokens, utanHashtags } from "@/lib/content/writing-rules";

export interface TextDel {
  hook: string;
  body: string;
}

export interface SiffergrindResultat {
  texter: TextDel[];
  omgenererad: boolean;
  /** Index på texter som BAR obackade tal även efter omgenereringen. */
  kvar: number[];
}

/** Bygger mängden tal som räknas som belagda: profilen plus det användaren själv skrev. */
export function tillatnaTalFran(...kallor: (string | null | undefined)[]): Set<string> {
  const ut = new Set<string>();
  for (const k of kallor) {
    if (!k) continue;
    for (const t of talTokens(String(k))) ut.add(t);
  }
  return ut;
}

function tolkaJson<T>(raw: string): T | null {
  const rensad = String(raw || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const kandidat = rensad.startsWith("{") ? rensad : (rensad.match(/\{[\s\S]*\}/)?.[0] ?? rensad);
  try {
    return JSON.parse(kandidat) as T;
  } catch {
    return null;
  }
}

/**
 * Skriver om texter som innehåller tal utan täckning — EN gång, generellt i stället för
 * med siffra.
 *
 * ⚠ HELA texten grindas, inte bara brödtexten. DoD-körningen för p11 hade "en standardskärm
 *   har cirka 400 nits" i HOOKEN, och en grind som bara läste body såg rakt förbi den.
 */
export async function fixaObackadeSiffror(
  system: string,
  delar: TextDel[],
  tillatnaTal: Set<string>,
  etikett: string,
): Promise<SiffergrindResultat> {
  const helText = (d: TextDel) => `${d.hook || ""}\n\n${d.body || ""}`;
  const fallda = delar
    .map((_, i) => i)
    .filter((i) => obackadeSiffror(utanHashtags(helText(delar[i])), tillatnaTal).length > 0);
  if (!fallda.length) return { texter: delar, omgenererad: false, kvar: [] };

  console.warn(`[siffergrind] ${etikett}: text ${fallda.map((i) => i + 1).join(", ")} har obackade tal — en omgenerering`);
  const ut = delar.map((d) => ({ ...d }));
  try {
    const raw = await generate({
      model: "gemini-2.5-flash",
      systemInstruction: `${system}\n\n${SIFFER_SKARPNING}`,
      prompt: [
        "Texterna nedan innehåller tal som inte finns i varumärkesprofilen. Skriv om VART OCH ETT utan de talen — beskriv skillnaden generellt i stället. Behåll budskap, röst, längd och krokens funktion.",
        "",
        ...fallda.map((i) => `${i}: HOOK: ${delar[i].hook || "(tomt)"}\n   BRÖDTEXT: ${delar[i].body || "(tomt)"}`),
        "",
        `Returnera ENDAST giltig JSON: {"texter":{${fallda.map((i) => `"${i}":{"hook":"...","body":"..."}`).join(",")}}}`,
      ].join("\n"),
      temperature: 0.6,
      // Flera texter i ETT JSON-svar: 1400 kapade svaret mitt i en sträng och
      // omgenereringen föll bort helt.
      maxOutputTokens: 4000,
      jsonMode: true,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });
    const obj = tolkaJson<{ texter?: Record<string, { hook?: unknown; body?: unknown }> }>(raw);
    for (const i of fallda) {
      const v = obj?.texter?.[String(i)];
      const hook = String(v?.hook ?? "").trim();
      const body = String(v?.body ?? "").trim();
      if (hook) ut[i].hook = hook;
      if (body) ut[i].body = body;
    }
  } catch (e) {
    console.warn(`[siffergrind] ${etikett}: omgenereringen kastade (${(e as Error).message}) — behåller första försöket`);
  }

  const kvar = ut
    .map((_, i) => i)
    .filter((i) => obackadeSiffror(utanHashtags(helText(ut[i])), tillatnaTal).length > 0);
  if (kvar.length) {
    console.warn(`[siffergrind] ${etikett}: text ${kvar.map((i) => i + 1).join(", ")} har obackade tal även efter omgenerering — levererar bästa försöket`);
  }
  return { texter: ut, omgenererad: true, kvar };
}
