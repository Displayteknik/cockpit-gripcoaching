// ROST-1 — inspelad text hamnar i RÄTT fält, inte i fältet mikrofonen står under.
//
// Håkans fynd 2026-08-11: i "Lägg till kontakt" klickade han mikrofonen, sa "Elisabeth
// Andersson", och namnet landade i ANTECKNINGAR. Namnrutan stod tom. Hans slutsats: "verktyget
// måste ju i alla platser där det spelas in ljud vara smartare och förstå situationsanpassat
// vart respektive data ska in."
//
// Skärmdumpsvägen kunde det redan: `/api/dm/extract-lead` läser bilden och fyller varje fält.
// Rösten hade aldrig fått samma behandling — den lade allt där knappen råkade sitta.
//
// Regler som gör fördelningen ärlig, inte gissande:
//   1. Modellen får BARA använda nycklar ur schemat den fick. Allt annat kastas.
//   2. Ingenting hittas på. Står det inget om kanal i talet sätts ingen kanal.
//   3. Ett fält med fasta alternativ får bara ett av dem, annars inget.
//   4. Det som inte hör i ett fält går till `oplacerat` — och anroparen lägger det i
//      anteckningarna. Ingen mening får försvinna: en tappad diktering är värre än ett
//      felplacerat ord, för den syns inte.
//   5. Fail-open. Går fördelningen inte att göra får anroparen tillbaka allt som `oplacerat`
//      och beter sig som förut.

export type FaltTyp = "text" | "lang-text" | "val" | "datumtid";

export interface FaltSpec {
  /** Nyckeln anroparen känner igen, t.ex. "namn". */
  nyckel: string;
  /** Etiketten användaren ser i formuläret — modellen behöver den för att förstå fältet. */
  etikett: string;
  typ: FaltTyp;
  /** För typ "val": de enda tillåtna värdena. */
  alternativ?: string[];
  /** Extra ledtråd när etiketten inte räcker ("utan @", "vad som ska hända härnäst"). */
  hjalp?: string;
}

export interface Fordelning {
  varden: Record<string, string>;
  /** Text som inte hörde i något fält. Anroparen lägger den i sitt fritextfält. */
  oplacerat: string;
}

/** Fältschemat som text till modellen. Typen och alternativen står med, så gränserna är tydliga. */
export function faltschemaText(falt: FaltSpec[]): string {
  return falt
    .map((f) => {
      const typ =
        f.typ === "val"
          ? `ETT av exakt dessa värden: ${(f.alternativ || []).join(" | ")}`
          : f.typ === "datumtid"
            ? "datum och tid i formatet ÅÅÅÅ-MM-DDTHH:MM"
            : f.typ === "lang-text"
              ? "fri text, flera meningar"
              : "kort text";
      return `- "${f.nyckel}" (${f.etikett}${f.hjalp ? `, ${f.hjalp}` : ""}): ${typ}`;
    })
    .join("\n");
}

export function fordelningsPrompt(falt: FaltSpec[], idag: string): string {
  return [
    "Du sorterar en inspelad mening i ett formulär. Du fyller INTE i något som inte sägs.",
    "",
    "=== FÄLT ===",
    faltschemaText(falt),
    "",
    "=== REGLER ===",
    "1. Använd bara nycklarna ovan. Hitta aldrig på nya.",
    "2. Utelämna varje fält som talet inte säger något om. Ett tomt fält är rätt svar när uppgiften saknas.",
    "3. Gissa aldrig. Sägs inget om kanal, källa eller läge: hoppa över dem.",
    "4. Fält med fasta värden får bara ett av de uppräknade. Passar inget: hoppa över fältet.",
    `5. Relativa tider räknas från ${idag} (Europe/Stockholm). Går tiden inte att räkna ut säkert: hoppa över fältet och låt frasen ligga i "oplacerat".`,
    "6. Ett namn är ett namn — skriv det med versal begynnelsebokstav, men ändra inte stavningen.",
    "7. Allt i talet som inte hör i ett fält läggs ORDAGRANT i \"oplacerat\". Kasta ingenting.",
    "",
    'Svara ENDAST med strikt JSON: {"varden":{"nyckel":"värde"},"oplacerat":"..."}',
  ].join("\n");
}

/**
 * Tolkar modellens svar och SKÄR bort allt som inte får finnas: okända nycklar, värden utanför
 * ett vals alternativ, och datum som inte har rätt form. Det som skärs bort läggs till i
 * `oplacerat` — annars försvinner det användaren sagt, tyst.
 */
export function tolkaFordelning(raw: string, falt: FaltSpec[]): Fordelning {
  const tom: Fordelning = { varden: {}, oplacerat: "" };
  let obj: { varden?: Record<string, unknown>; oplacerat?: unknown };
  try {
    obj = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch {
    return tom;
  }
  const perNyckel = new Map(falt.map((f) => [f.nyckel, f]));
  const varden: Record<string, string> = {};
  const bortkastat: string[] = [];

  for (const [nyckel, ravarde] of Object.entries(obj.varden || {})) {
    const spec = perNyckel.get(nyckel);
    const varde = typeof ravarde === "string" ? ravarde.trim() : "";
    if (!varde) continue;
    if (!spec) { bortkastat.push(varde); continue; } // okänd nyckel: behåll texten, inte platsen
    if (spec.typ === "val") {
      const traff = (spec.alternativ || []).find((a) => a.toLowerCase() === varde.toLowerCase());
      if (!traff) { bortkastat.push(`${spec.etikett}: ${varde}`); continue; }
      varden[nyckel] = traff;
      continue;
    }
    if (spec.typ === "datumtid") {
      // Bara den form ett datetime-local-fält kan ta emot. Allt annat är en gissning.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(varde)) { bortkastat.push(`${spec.etikett}: ${varde}`); continue; }
      varden[nyckel] = varde;
      continue;
    }
    varden[nyckel] = varde;
  }

  const oplacerat = [typeof obj.oplacerat === "string" ? obj.oplacerat.trim() : "", ...bortkastat]
    .filter(Boolean)
    .join(" ");
  return { varden, oplacerat };
}

/** Klarspråksrad om vad som hamnade var. Visas för användaren — en tyst fördelning går inte att lita på. */
export function fordelningsSammanfattning(f: Fordelning, falt: FaltSpec[]): string {
  const perNyckel = new Map(falt.map((s) => [s.nyckel, s]));
  const delar = Object.entries(f.varden).map(([n, v]) => {
    const etikett = perNyckel.get(n)?.etikett || n;
    const kort = v.length > 40 ? `${v.slice(0, 40)}…` : v;
    return `${etikett}: ${kort}`;
  });
  if (!delar.length) return f.oplacerat ? "Allt lades i anteckningarna." : "";
  const rad = `Ifyllt — ${delar.join(" · ")}`;
  return f.oplacerat ? `${rad}. Resten i anteckningarna.` : rad;
}
