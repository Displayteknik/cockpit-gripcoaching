// Sammanslagning av en genererad karusell med den användaren redan har.
//
// ★ SLÅS IHOP PÅ ROLL, INTE PÅ POSITION.
//
// Skarpt fall (Håkan 2026-08-09, andra gången): en seedad karusell har fem slides
// (krok, punkt, punkt, punkt, avslut). Lägger man till en slide hamnar den nya punkten
// FÖRE avslutet, alltså på plats 5, och avslutet flyttas till plats 6. Trycker man sedan
// "Generera karusell" svarar motorn med fem slides där avslutet ligger på plats 5.
//
// Den gamla sammanslagningen parade plats mot plats: användarens tomma punkt på plats 5
// mötte AI:s avslut och ÖVERTOG dess roll, medan det gamla avslutet på plats 6 följde med
// orört. Resultat: två avslut, och en karusell som avslutar sig själv två gånger inför kund.
//
// Roll-sammanslagningen kan inte hamna där: hook, punkter och cta slås ihop var för sig och
// sätts sedan i rätt ordning. Utfallet har ALLTID högst en krok och högst ett avslut.

import type { StudioSlide } from "@/lib/studio/payload";

export interface SlideDiff {
  index: number;
  nuvarande: { headline: string; body: string };
  forslag: { headline: string; body: string };
  anvand: boolean;
}

const harText = (s?: StudioSlide): boolean => Boolean(s?.headline?.trim() || s?.body?.trim());

/**
 * Slår ihop EN slide: användarens text vinner alltid, användarens bild vinner alltid.
 * Returnerar även en diff när AI föreslår något annat än det användaren redan skrivit.
 */
function slaIhopEn(gammal: StudioSlide | undefined, ny: StudioSlide | undefined, index: number): { slide: StudioSlide; diff?: SlideDiff } {
  if (gammal && ny) {
    if (harText(gammal)) {
      // Egen text behålls. Bilden behålls. Skiljer sig förslaget → fråga, skriv aldrig över.
      const slide = { ...gammal, imageUrl: gammal.imageUrl || ny.imageUrl };
      const skiljerSig = (ny.headline && ny.headline !== gammal.headline) || (ny.body && ny.body !== gammal.body);
      return skiljerSig
        ? {
            slide,
            diff: {
              index,
              nuvarande: { headline: gammal.headline, body: gammal.body },
              forslag: { headline: ny.headline, body: ny.body },
              anvand: false,
            },
          }
        : { slide };
    }
    // Tom slide → ta AI:ns text, men behåll bilden användaren lagt dit.
    return { slide: { ...ny, kind: gammal.kind, imageUrl: gammal.imageUrl || ny.imageUrl } };
  }
  return { slide: (gammal ?? ny)! };
}

/**
 * Slår ihop två karuseller på roll. Ordningen i utfallet är alltid krok → punkter → avslut.
 * Diff-indexen pekar på positionen i det SAMMANSLAGNA resultatet, inte i någon av källorna.
 */
export function slaIhopSlides(
  gamla: StudioSlide[],
  nya: StudioSlide[],
): { merged: StudioSlide[]; diffs: SlideDiff[] } {
  const dela = (l: StudioSlide[]) => ({
    hook: l.find((s) => s.kind === "hook"),
    punkter: l.filter((s) => s.kind === "point"),
    // Bara EN cta överlever, även om källan råkar bära flera sedan tidigare.
    cta: l.find((s) => s.kind === "cta"),
  });
  const g = dela(gamla);
  const n = dela(nya);

  const merged: StudioSlide[] = [];
  const diffs: SlideDiff[] = [];
  const lagg = (gammal?: StudioSlide, ny?: StudioSlide) => {
    if (!gammal && !ny) return;
    const r = slaIhopEn(gammal, ny, merged.length);
    merged.push(r.slide);
    if (r.diff) diffs.push(r.diff);
  };

  lagg(g.hook, n.hook);
  // Punkterna paras i ordning. Har någon sida fler behålls överskottet — en punkt
  // användaren skrivit får aldrig försvinna för att motorn föreslog färre.
  const antalPunkter = Math.max(g.punkter.length, n.punkter.length);
  for (let i = 0; i < antalPunkter; i++) lagg(g.punkter[i], n.punkter[i]);
  lagg(g.cta, n.cta);

  return { merged, diffs };
}
