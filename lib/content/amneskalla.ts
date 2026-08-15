// ÄMNE-1 (Håkans skarpfynd 15/8) — EN källa för vad ett inlägg ska handla om, delad av
// alla efterföljande genereringar på samma inlägg: bildtext, "Ge mig 3 att välja på",
// "Skriv om" och kanalanpassningen (hashtags ingår i captionen, egen körning saknas).
//
// ★ ROTORSAKEN, MÄTT MOT DISPLAYTEKNIKS RIKTIGA PROFIL (scripts/amne1-repro*.mts):
//   `topic` (Ämne, steg 1) och headline/body (Text på bilden, steg 4) är TVÅ SKILDA
//   state-fält i StudioMaker.tsx. `applySuggestion` (StudioMaker.tsx:802) sätter
//   headline1/headline2/body när en idé väljs — men rör ALDRIG `topic`. Ämnesfältet kan
//   alltså bära en KVARLÄMNAD text från en tidigare idé, ett tidigare inlägg eller bara
//   ett ombytt sig, medan headline/body pekar på det inlägget FAKTISKT blev.
//
//   `/api/studio/suggest-caption` byggde underlaget med "Ämne: X." FÖRST — före
//   "Rubrik på bilden:"/"Text på bilden:" — både positionellt och språkligt den mer
//   auktoritativa raden. Tre repro-körningar mot en riktig profil (Displayteknik,
//   headline/body om en menyskärm) visade stigande allvar:
//     1. Tomt Ämne, bara headline/body → på ämne, mild säsongsfärgning ("kvällssolen").
//     2. Förslag för dagen (Content Compass) förifyllt → fortfarande på ämne.
//     3. Ett KVARLÄMNAT Ämne som pekar på något annat ("Synlighet i sensommaren —
//        skyltar som fortfarande syns i augustisolen") → alla tre varianter öppnade om
//        sensommar/augustisol, menyskärmen degraderad till en bisats. Det matchar
//        Håkans fynd i klartext.
//
// LÖSNINGEN ÄR EN PRIORITETSORDNING, inte en ny synk-mekanism på klienten. Ett fält som
// "glöms" att synkas kommer alltid att finnas en väg till (steg 4 skrivs för hand, ett
// utkast öppnas, karusellen byggs om) — därför avgörs ämneskällan HÄR, en gång, på
// SERVERN, av vad som FAKTISKT finns att skriva om just nu:
//
//   1. Redan skriven text (captionen själv, vid "Skriv om")       — starkast
//   2. Skapad bild/mall-text (rubrik, underrubrik, text på bilden, karusellens slides)
//   3. Ämnesfältet (steg 1) — ENDAST när 1 och 2 är tomma
//   4. Inget alls — "Förslag för dagen" (Content Compass) får styra ton och struktur;
//      ämnet lämnas till varumärkesrösten. Inget fel, inget krav på ett ämne.
//
// Så fort en äkta källa finns (1 eller 2) UTESLUTS Ämnesfältet helt ur prompten — ett
// kvarlämnat, motstridigt ämne kan då aldrig vinna över det som faktiskt skapats.

export interface AmnesUnderlag {
  /** Redan skriven bildtext — finns vid "Skriv om". Starkast källa. */
  caption?: string;
  headline?: string;
  headline2?: string;
  body?: string;
  slides?: { kind?: string; headline?: string; body?: string }[];
  /** Ämnesfältet, steg 1. Används bara när inget av ovanstående finns. */
  topic?: string;
}

export type AmneKalla = "inlaggstext" | "bild" | "amnesfalt" | "tomt";

export interface HarlettAmne {
  /** Blocket som ska in i `underlag`, färdigt att lägga till "Skriv captionen nu…". */
  block: string;
  /** K4: källan, för generationsloggen. */
  kalla: AmneKalla;
  /** Den text som faktiskt styrde — bara för test/observabilitet. */
  amne: string;
}

/**
 * K1/K2/K3 i en funktion: bestäm VAD det här inlägget ska handla om, en gång, innan
 * prompten byggs. Anropas av suggest-caption och adapt-channel — samma regel, samma rad.
 */
export function harledAmnesblock(u: AmnesUnderlag): HarlettAmne {
  const caption = (u.caption ?? "").trim();
  if (caption) {
    return {
      kalla: "inlaggstext",
      amne: caption,
      block: `GRUND-CAPTION (redan skriven text — vinkla/anpassa den, byt ALDRIG ämne mot något annat):\n${caption}`,
    };
  }

  const slides = u.slides ?? [];
  const harBildinnehall = !!(u.headline?.trim() || u.headline2?.trim() || u.body?.trim() || slides.length);
  if (harBildinnehall) {
    const rader = slides.length
      ? ["Karusellens slides:", ...slides.map((s, i) => `${i + 1}. [${s.kind || "slide"}] ${s.headline || ""}${s.body ? ` — ${s.body}` : ""}`)]
      : [
          u.headline?.trim() ? `Rubrik på bilden: ${u.headline.trim()}.` : "",
          u.headline2?.trim() ? `Underrubrik: ${u.headline2.trim()}.` : "",
          u.body?.trim() ? `Text på bilden: ${u.body.trim()}.` : "",
        ].filter(Boolean);
    const amne = rader.join(" ");
    return {
      kalla: "bild",
      amne,
      // ★ ETIKETTEN ÄR MEDVETET STARK ("ÄMNET FÖR DETTA INLÄGG"): den gamla ordningen lät
      //   "Rubrik på bilden:"/"Text på bilden:" läsa som bildtexter att beskriva, inte som
      //   det inlägget HANDLAR OM. Modellen behöver sägas rakt ut att det HÄR är ämnet.
      block: `ÄMNET FÖR DETTA INLÄGG (håll dig till exakt detta i alla varianter):\n${rader.join("\n")}`,
    };
  }

  const topic = (u.topic ?? "").trim();
  if (topic) {
    return { kalla: "amnesfalt", amne: topic, block: `Ämne: ${topic}.` };
  }

  // K2/DoD punkt 3: inget ämne alls. Inget fel — "Förslag för dagen" (Content Compass,
  // redan i systemprompten) och varumärkesrösten får bära genereringen ensamma.
  return { kalla: "tomt", amne: "", block: "" };
}
