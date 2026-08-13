// SANNINGSGRINDEN PÅ FÄRDIG RAPPORTTEXT — RAPPORT-1, R-2 (Håkan 2026-08-13).
//
// Rapporten skrivs av en modell i ett batch-jobb, och kommer tillbaka timmar senare. En
// regel i prompten är därför bara första försvaret. Det här är spärren, och den är
// deterministisk: samma text in ger samma text ut, varje gång.
//
// ★ FYRA FEL I 13/8-RAPPORTEN SOM DEN HÄR MODULEN FÅNGAR.
//
//   1. "en serie om tio tillfällen, varannan vecka" upprepades i FAQ, siffertext och på
//      hypnoterapisidan. Ingen täckning någonstans. Texterna var märkta "färdiga att
//      klistra in", vilket gör en påhittad siffra värre än vanligt: den är gjord för att
//      publiceras utan granskning.
//   2. "max åtta deltagare" mot Bokadirekts nio.
//   3. "Ofta känner de förändring redan under första sessionen" som fakta.
//   4. Tankstreck genom hela dokumentet, eftersom rapportgeneratorn aldrig gick genom
//      skrivreglerna.
//
// Kravet är hårdare här än i inläggsflödena, just för att texterna är märkta färdiga:
// varje siffra måste ha källa i crawlad sajttext, profilens verifierade siffror eller
// inhämtad strukturerad data. Saknas källa blir siffran en [DIN SIFFRA]-lucka, och luckan
// listas sist så inget publiceras av misstag.

import { obackadeSiffror, taBortTankstreck, talTokens } from "@/lib/content/writing-rules";
import { grindaSiffror, lucklista, beslutstabell, type Sifferbeslut } from "@/lib/deep-audit-siffror";
import { grindaCitat, type CitatDom } from "@/lib/deep-audit-citat";
import { oversattPlattformIText } from "@/lib/plattform-namn";
import { hittaInkonsistens } from "@/lib/deep-audit-tackning";

export interface GranskningsIndata {
  /** Tal som har källa: crawlad sajttext, verifierade siffror, GSC, strukturerad data. */
  tillatnaTal: string[];
  /** URL:erna crawlen faktiskt läste. Underlag för konsistenskontrollen. */
  crawladeUrler: string[];
  /** R-5: tal ur Googles data. Maskas aldrig. */
  gscTal?: string[];
  /** R-5: tenantens kunskapsfält, källa för branschfakta. */
  kunskapsfalt?: string | null;
  /** R-4: crawlad sajttext och profilens kundcitat. Enda tillåtna citatkällor. */
  citatkallor?: string[];
  /** R-4: verifierade siffror och story-bank, täckning för auktoritetsanspråk. */
  tackningstext?: string | null;
  /** R-4: profilens kundcitat var för sig. Avgör VAD som räknas som ett kundcitat. */
  profilcitat?: string[];
}

export interface Avvikelse {
  typ:
    | "tankstreck" | "obackad-siffra" | "inkonsistens" | "plattformsnamn" | "platshallare"
    | "citat-utokat" | "citat-okant" | "ansprak" | "riktvarde" | "skrivfel";
  detalj: string;
}

export interface GranskadRapport {
  text: string;
  avvikelser: Avvikelse[];
  /** Siffror som byttes mot [DIN SIFFRA]. Listas även i rapportens slut. */
  luckor: string[];
  /** R-5: ett beslut per tal, med klass och källa. Går att stickprova. */
  sifferbeslut: Sifferbeslut[];
  /** R-4: varje citats utfall mot sin källa. */
  citatdomar: CitatDom[];
}

/** Rubriken som markerar var de färdiga texterna börjar. Grinden är hårdast där. */
const KLISTRA_IN_RUBRIK = /^#{1,3}\s*Färdiga texter att klistra in/im;

/**
 * Delar rapporten i "analysdel" och "klistra in-del".
 *
 * Skälet till uppdelningen: i analysdelen är en siffra ur GSC eller en mätning legitim och
 * omgiven av sitt sammanhang. I klistra in-delen är siffran på väg rakt ut på kundens sajt.
 */
export function delaVidKlistraIn(md: string): { fore: string; efter: string | null } {
  const m = md.match(KLISTRA_IN_RUBRIK);
  if (!m || m.index == null) return { fore: md, efter: null };
  return { fore: md.slice(0, m.index), efter: md.slice(m.index) };
}

/** Kodblock ska aldrig röras: schema-JSON och robots.txt-rader är exakta. */
function delaIKodOchText(md: string): { kod: boolean; del: string }[] {
  const ut: { kod: boolean; del: string }[] = [];
  const bitar = md.split(/(```[\s\S]*?```)/g);
  for (const b of bitar) {
    if (!b) continue;
    ut.push({ kod: b.startsWith("```"), del: b });
  }
  return ut;
}

/**
 * Tar bort tankstreck ur löptext men lämnar kodblock och tabellernas skiljerader i fred.
 *
 * ⚠ Markdowns tabellrad `|---|---|` består av BINDESTRECK, inte tankstreck, och rörs
 *   därför inte av `taBortTankstreck`. Kodblocken måste däremot skyddas manuellt: ett
 *   tankstreck inuti ett schema-värde är kundens egen text och ska stå kvar ordagrant.
 */
export function saneraTankstreck(md: string): { text: string; antal: number } {
  let antal = 0;
  const text = delaIKodOchText(md)
    .map(({ kod, del }) => {
      if (kod) return del;
      antal += (del.match(/[–—]/g) || []).length;
      let ut = taBortTankstreck(del);
      // ★ MÄTT PÅ DEN SKARPA DT-RAPPORTEN 13/8: `taBortTankstreck` tog 145 tankstreck men
      //   lämnade 82. Två sorter överlevde, båda med flit i den delade funktionen:
      //     1. INTERVALL ("2500–3500 nits", "P4–P10", "10–20 år") — typografiskt korrekta,
      //        men Håkans krav på rapporten är NOLL tankstreck. Bindestreck läser lika bra.
      //     2. Tankstreck inuti punkt- och nummerlistor, som funktionen hoppar över för att
      //        inte råka äta upp listans egen inledande streckmarkör.
      //   Rapporten är kundsynlig prosa och tar därför det hårdare kravet. Den delade
      //   regeln lämnas orörd: i en caption ÄR ett intervallstreck rätt.
      ut = ut.replace(/(\w)\s*[–—]\s*(\w)/g, "$1-$2");
      ut = ut.replace(/\s+[–—]\s+/g, ", ");
      ut = ut.replace(/[–—]/g, "-");
      return ut;
    })
    .join("");
  return { text, antal };
}

/**
 * Byter obackade tal mot [DIN SIFFRA] i klistra in-delen.
 *
 * Bara hela tal och decimaltal byts. Årtal, procent och tid får samma behandling: kravet
 * gäller VARJE siffra, det var därför "en serie om tio tillfällen" slank igenom (talet var
 * dessutom skrivet med bokstäver, se `SKRIVNA_TAL`).
 */
const SKRIVNA_TAL: Record<string, string> = {
  två: "2", tre: "3", fyra: "4", fem: "5", sex: "6", sju: "7", åtta: "8",
  nio: "9", tio: "10", elva: "11", tolv: "12", femton: "15", tjugo: "20",
};

export function luckorForObackadeSiffror(
  del: string,
  tillatna: Set<string>,
): { text: string; luckor: string[] } {
  const luckor: string[] = [];
  const ut = delaIKodOchText(del)
    .map(({ kod, del: bit }) => {
      if (kod) return bit;
      let rad = bit;

      // 1. Skrivna tal ("tio tillfällen") — samma krav som siffror.
      for (const [ord, siffra] of Object.entries(SKRIVNA_TAL)) {
        if (tillatna.has(siffra)) continue;
        const re = new RegExp(`\\b${ord}\\b(?=\\s+(tillfäll|gånger|veckor|månader|deltagare|sessioner|pass|steg|dagar|timmar))`, "gi");
        rad = rad.replace(re, (traff) => {
          luckor.push(`${traff.trim()} (skrivet tal utan källa)`);
          return "[DIN SIFFRA]";
        });
      }

      // 2. Siffror utan täckning.
      const obackade = obackadeSiffror(rad, tillatna);
      for (const tal of obackade) {
        const re = new RegExp(`(?<![\\w[])${tal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w\\]])`, "g");
        let bytt = false;
        rad = rad.replace(re, () => { bytt = true; return "[DIN SIFFRA]"; });
        if (bytt) luckor.push(tal);
      }
      return rad;
    })
    .join("");
  return { text: ut, luckor: Array.from(new Set(luckor)) };
}

/**
 * Exempelcitat ska aldrig kunna publiceras som om de vore riktiga kundröster.
 *
 * 13/8-rapporten hade "Anna, 42" i en färdig text. En påhittad kund i ett block märkt
 * "klistra in" är en publicerad lögn så fort någon följer instruktionen.
 */
const CITAT_MONSTER = /["”][^"”\n]{15,240}["”]\s*(?:\n|\s)*[-–—]?\s*([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+)?),?\s*(\d{2})\b/g;

export function markeraPlatshallarcitat(md: string): { text: string; funna: string[] } {
  const funna: string[] = [];
  const text = md.replace(CITAT_MONSTER, (traff, namn: string, alder: string) => {
    funna.push(`${namn}, ${alder}`);
    return `${traff}\n\n> ⚠ PLATSHÅLLARE: "${namn}, ${alder}" är ett påhittat exempel. Byt mot ett riktigt kundcitat med tillstånd, eller ta bort hela stycket innan du publicerar.`;
  });
  return { text, funna };
}

/**
 * Tal ur en KÄLLTEXT, för mängden av vad som är belagt.
 *
 * ⚠ MÄTT 13/8 och det höll på att sänka hela grinden: `talTokens` matchar `\d[\d\s.,]*\d`,
 * alltså greedy TVÄRS mellanslag. I en kort caption spelar det ingen roll, men i 49 505
 * tecken sajttext klistras varje tal ihop med sin granne: "24 2011 160" blir ett enda
 * token "242011160". Displaytekniks elva sidor gav därför 61 tillåtna tal i stället för
 * flera hundra, och grinden bytte ut sajtens EGNA siffror mot [DIN SIFFRA].
 *
 * Källsidan tokeniseras därför på båda sätten: hela svepet (så "3 500" blir "3500") OCH
 * varje del för sig (så "3 500 nits 250 tum" ger 3500, 3, 500 och 250). Att vara generös
 * på KÄLLSIDAN är rätt: allt som står tryckt på kundens sajt är belagt per definition.
 * Grinden mot rapporttexten är oförändrat sträng.
 */
export function talTokenForKalla(text: string): Set<string> {
  const ut = new Set<string>();
  for (const t of talTokens(text)) ut.add(t);
  for (const m of String(text || "").matchAll(/\d+(?:[.,]\d+)?/g)) {
    ut.add(m[0].replace(/[.,]/g, ""));
    ut.add(m[0]);
  }
  return ut;
}

/** Bygger mängden tal som räknas som belagda. */
export function tillatnaTalFranKallor(...kallor: (string | null | undefined)[]): string[] {
  const ut = new Set<string>();
  for (const k of kallor) {
    if (!k) continue;
    for (const t of talTokenForKalla(String(k))) ut.add(t);
  }
  return Array.from(ut);
}

/**
 * Kända skrivfel ur skarpa rapporter.
 *
 * ⚠ DET HÄR ÄR INGEN STAVNINGSKONTROLL, och ska inte låtsas vara det. Det är en lista över
 * fel Håkan hittat i levererad text, rättade en gång för alla. En generell svensk
 * stavningskontroll på markdown skulle fälla facktermer, produktnamn och engelska block.
 * Nya fel läggs till här när de upptäcks.
 */
const SKRIVFEL: [RegExp, string][] = [
  [/\bVat det är\b/g, "Vad det är"],
  [/\bvat det är\b/g, "vad det är"],
  [/\bpusselsbitar\b/gi, "pusselbitar"],
  [/\bdet största ranksignalen\b/gi, "den största ranksignalen"],
  [/\bdet viktigaste ranksignalen\b/gi, "den viktigaste ranksignalen"],
];

export function rattaSkrivfel(md: string): { text: string; rattade: string[] } {
  let text = md;
  const rattade: string[] = [];
  for (const [re, ratt] of SKRIVFEL) {
    if (re.test(text)) {
      rattade.push(ratt);
      text = text.replace(re, ratt);
    }
  }
  return { text, rattade };
}

/**
 * Kör hela grinden på en färdig rapport. Ordningen är medveten: språk först, sedan
 * siffror (så [DIN SIFFRA] inte råkar saneras), sedan markeringar och kontroller.
 */
export function granskaRapport(md: string, indata: GranskningsIndata): GranskadRapport {
  const avvikelser: Avvikelse[] = [];
  const tillatna = new Set(indata.tillatnaTal);

  const tank = saneraTankstreck(md);
  if (tank.antal) avvikelser.push({ typ: "tankstreck", detalj: `${tank.antal} tankstreck togs bort` });
  let text = tank.text;

  const skrivfel = rattaSkrivfel(text);
  if (skrivfel.rattade.length) {
    avvikelser.push({ typ: "skrivfel", detalj: skrivfel.rattade.join(", ") });
    text = skrivfel.text;
  }

  const plattform = oversattPlattformIText(text);
  if (plattform.bytta.length) {
    avvikelser.push({ typ: "plattformsnamn", detalj: plattform.bytta.join(", ") });
    text = plattform.text;
  }

  // ★ ORDNINGEN ÄR MÄTT FRAM, inte vald på känsla. Körs siffergrinden först blir "Anna, 42"
  //   till "Anna, [DIN SIFFRA]" — åldern är ju obackad — och då matchar citatmönstret inte
  //   längre, så platshållaren slipper undan markeringen. Citaten plockas därför UT först,
  //   maskeras medan sifferngrinden går, och läggs tillbaka efteråt.
  const platshallare = markeraPlatshallarcitat(text);
  const maskerade: string[] = [];
  if (platshallare.funna.length) {
    avvikelser.push({ typ: "platshallare", detalj: `exempelcitat markerade: ${platshallare.funna.join("; ")}` });
    text = platshallare.text.replace(/> ⚠ PLATSHÅLLARE:[^\n]*/g, (m) => {
      maskerade.push(m);
      return `[[PLATSHALLARE_${maskerade.length - 1}]]`;
    });
  }

  // ★ R-4: citaten först, INNAN siffergrinden. Ett utökat citat byts mot källans egen
  //   formulering, och den bytta texten ska sedan grindas som allt annat.
  const citat = grindaCitat(text, {
    kallor: indata.citatkallor ?? [],
    profilcitat: indata.profilcitat ?? [],
    tackningstext: indata.tackningstext ?? null,
  });
  text = citat.text;
  const utokade = citat.domar.filter((d) => d.utfall === "utokat");
  const okanda = citat.domar.filter((d) => d.utfall === "okant");
  if (utokade.length) avvikelser.push({ typ: "citat-utokat", detalj: `${utokade.length} citat kortades till kundens egna ord` });
  if (okanda.length) avvikelser.push({ typ: "citat-okant", detalj: `${okanda.length} citat kunde inte hittas i någon källa` });
  const otackta = citat.ansprak.filter((a) => !a.tackt);
  if (otackta.length) {
    avvikelser.push({ typ: "ansprak", detalj: otackta.map((a) => a.ansprak.fras).join("; ") });
  }

  // ★ R-5: siffergrinden körs på HELA rapporten med ETT beslut per tal, i tre källklasser.
  //   Den gamla vägen grindade bara klistra-in-delen, vilket gjorde att samma tal kunde
  //   vara omaskat i "Så här gör du" och maskat i den färdiga texten.
  const siffror = grindaSiffror(text, {
    belagda: tillatna,
    kunskapsfalt: indata.kunskapsfalt ?? null,
    gscTal: new Set(indata.gscTal ?? []),
  });
  text = siffror.text;
  const luckor = siffror.luckor.map((l) => l.tal);
  if (luckor.length) {
    avvikelser.push({ typ: "obackad-siffra", detalj: `${luckor.length} tenant-tal utan täckning blev [DIN SIFFRA]` });
    text += `\n\n${lucklista(siffror.luckor)}`;
  }
  const riktvarden = siffror.beslut.filter((b) => b.utfall === "riktvarde");
  if (riktvarden.length) {
    avvikelser.push({ typ: "riktvarde", detalj: `${riktvarden.length} branschfakta märktes som riktvärde i stället för att maskas` });
  }

  // Maskeringen tillbaka. Markeringen ska stå ORÖRD i den färdiga texten.
  text = text.replace(/\[\[PLATSHALLARE_(\d+)\]\]/g, (_, i: string) => maskerade[Number(i)] ?? "");

  // ⚠ MÄTT: efter citat- och siffergrinden steg tankstrecken från 0 till 562, eftersom
  //   BÅDA klistrar in ny text (källcitat, lucklista, riktvärdesmärkning) som aldrig gått
  //   genom språksaneringen. Den körs därför en gång till, sist, på allt som står kvar.
  const tankSist = saneraTankstreck(text);
  if (tankSist.antal) {
    avvikelser.push({ typ: "tankstreck", detalj: `${tankSist.antal} tankstreck i inklistrad text togs bort` });
    text = tankSist.text;
  }

  for (const i of hittaInkonsistens(text, indata.crawladeUrler)) {
    avvikelser.push({ typ: "inkonsistens", detalj: `${i.fras}: "${i.rad}"` });
  }

  return { text, avvikelser, luckor, sifferbeslut: siffror.beslut, citatdomar: citat.domar };
}
