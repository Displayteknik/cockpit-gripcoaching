import type { StudioPayload, StudioSlide } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs } from "@/lib/studio/overrides";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 9: Karusell. En slide per render (slideIndex från render-routens ?slide=n).
// Exporten loopar över payload.slides och ger N PNG. slide.kind styr layouten:
//   hook  = omslag/krok (färgstark helyta, stor rubrik, "svep"-hint)
//   point = innehållspunkt (ljus yta, numrerad, rubrik + text)
//   cta   = avslut (mörk yta, uppmaning + logga)
export default function ArkKarusell({ payload, brand, slideIndex = 0 }: { payload: StudioPayload; brand: StudioBrand; slideIndex?: number }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const c = brand.colors;
  const slides = payload.slides.length ? payload.slides : [{ kind: "hook", headline: payload.headline1 || "Karusell", body: payload.body, imageUrl: payload.imageUrl } as StudioSlide];
  const total = slides.length;
  const i = Math.min(Math.max(0, slideIndex), total - 1);
  const slide = slides[i];

  // Numret bland point-slides (för den numrerade punktrundeln).
  const pointNo = slides.slice(0, i + 1).filter((s) => s.kind === "point").length;

  const onPrimary = isLightColor(c.primary) ? c.ink : c.paper;
  const onDeep = isLightColor(c.primaryDeep) ? c.ink : c.paper;

  // Bakgrund + textfärg per kind.
  const isHook = slide.kind === "hook";
  const isCta = slide.kind === "cta";
  const bg = isHook ? c.primary : isCta ? c.primaryDeep : c.paper;
  const ink = isHook ? onPrimary : isCta ? onDeep : c.ink;
  const dim = isHook || isCta ? 0.9 : 0.82;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, background: bg }}>
      {/* Valfri bild på hook/cta som fullbleed-bakgrund med scrim */}
      {slide.imageUrl && (isHook || isCta) ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${bg}cc 0%, ${bg}dd 100%)` }} />
        </>
      ) : null}

      {/* Progress-prickar */}
      <div style={{ position: "absolute", top: 52, left: 60, right: 60, display: "flex", gap: 10, zIndex: 2 }}>
        {slides.map((_, n) => (
          <div key={n} style={{ flex: 1, height: 6, borderRadius: 4, background: n === i ? c.accent : `${ink}44` }} />
        ))}
      </div>

      {/* Point-nummer */}
      {slide.kind === "point" ? (
        <div style={{ position: "absolute", top: 120, left: 80, fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 900, fontSize: 120, lineHeight: 1, color: c.accent, zIndex: 2 }}>
          {String(pointNo).padStart(2, "0")}
        </div>
      ) : null}

      {/* Textblock — centrerat (hook/cta) eller nedre tredjedel (point) */}
      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: slide.kind === "point" ? "flex-end" : "center", padding: slide.kind === "point" ? "0 80px 150px" : "0 80px" }}>
        {slide.headline ? (
          <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: ink, fontSize: fs(isHook ? 84 : 58, payload), lineHeight: 1.04, letterSpacing: -1 }}>
            <span data-edit="slide-headline">{slide.headline}</span>
          </div>
        ) : null}
        {slide.body ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: ink, opacity: dim, fontSize: fs(isHook ? 34 : 32, payload), lineHeight: 1.4, marginTop: 24, maxWidth: 860 }}>
            <span data-edit="slide-body">{slide.body}</span>
          </div>
        ) : null}

        {/* Svep-hint på hook, CTA-knappform på cta */}
        {isHook ? (
          <div style={{ marginTop: 40, display: "inline-flex", alignItems: "center", gap: 12, fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, fontSize: 26, color: ink, opacity: 0.85, textTransform: "uppercase", letterSpacing: 2 }}>
            Svep <span style={{ fontSize: 32 }}>→</span>
          </div>
        ) : null}
        {isCta && brand.footer.ctaLabel ? (
          <div style={{ marginTop: 40, alignSelf: "flex-start", background: c.accent, color: isLightColor(c.accent) ? c.ink : c.paper, padding: "18px 34px", borderRadius: 10, fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, fontSize: 30 }}>
            {brand.footer.ctaLabel}
          </div>
        ) : null}
      </div>

      {/* Diskret varumärke nere — föredra alltid loggan (rätt version per faktisk bakgrundsljushet) före text */}
      {(() => {
        const bgLight = isLightColor(bg);
        const chosenLogo = bgLight ? brand.assets.logo || brand.assets.logoOnDark : brand.assets.logoOnDark || brand.assets.logo;
        return (
          <div style={{ position: "absolute", bottom: 56, left: 80, right: 80, display: "flex", alignItems: "center", zIndex: 2 }}>
            {chosenLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chosenLogo} alt="" style={{ maxHeight: 48, maxWidth: 280, objectFit: "contain" }} />
            ) : (
              <div style={{ fontFamily: `${brand.fonts.logo || brand.fonts.headline}, serif`, fontWeight: 800, fontSize: 30, color: slide.kind === "point" ? c.primary : ink }}>{brand.name}</div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
