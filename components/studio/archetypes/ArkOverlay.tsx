import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, imgPosition, imgScale } from "@/lib/studio/overrides";

// Arketyp 6: Foto + text-overlay. Text ligger PÅ bilden med scrim för läsbarhet.
// Stil ur brand.content.overlayStyle. För coaching/tjänst där bilden bär känslan
// och texten är budskapet (motsats till affisch-rutan).
export default function ArkOverlay({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const c = brand.colors;
  const style = brand.content.overlayStyle;

  // Scrim per stil.
  const scrim =
    style === "scrim-full"
      ? "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)"
      : style === "band"
        ? "none"
        : "linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(0,0,0,0.78) 100%)";

  const centered = style === "scrim-full";

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", fontFamily: `${brand.fonts.body}, sans-serif`, background: c.primaryDeep }}>
      {/* Foto */}
      {payload.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img data-edit-image src={payload.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition(payload), transform: `scale(${imgScale(payload)})` }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${c.primary}, ${c.primaryDeep})` }} />
      )}
      {scrim !== "none" ? <div style={{ position: "absolute", inset: 0, background: scrim }} /> : null}

      {/* Logga/namn diskret uppe */}
      <div style={{ position: "absolute", top: 44, left: 52, right: 52, display: "flex", alignItems: "center" }}>
        {brand.assets.logoOnDark || brand.assets.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.assets.logoOnDark || brand.assets.logo} alt="" style={{ maxHeight: 56, maxWidth: 300, objectFit: "contain" }} />
        ) : (
          <div style={{ fontFamily: `${brand.fonts.logo || brand.fonts.headline}, serif`, fontWeight: 800, fontSize: 34, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{brand.name}</div>
        )}
      </div>

      {/* Textblock */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: centered ? 0 : "auto", display: "flex", flexDirection: "column", justifyContent: centered ? "center" : "flex-end", padding: "0 56px 64px" }}>
        {style === "band" ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", background: `linear-gradient(180deg, transparent, ${c.primaryDeep} 40%)` }} />
        ) : null}
        <div style={{ position: "relative" }}>
          {payload.headline2 ? (
            <div style={{ display: "inline-block", background: c.accent, color: (brand.colors.paper), padding: "6px 16px", borderRadius: 6, fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, fontSize: 24, marginBottom: 18, textTransform: "uppercase", letterSpacing: 1 }}>
              <span data-edit="headline2">{payload.headline2}</span>
            </div>
          ) : null}
          <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: hlColor("#fff", payload), fontSize: fs(74, payload), lineHeight: 1.02, letterSpacing: -1, textShadow: "0 2px 14px rgba(0,0,0,0.35)" }}>
            <span data-edit="headline1">{payload.headline1}</span>
          </div>
          {payload.body ? (
            <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: bodyColor("#fff", payload), opacity: 0.94, fontSize: fs(32, payload), lineHeight: 1.35, marginTop: 22, maxWidth: 820, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              <span data-edit="body">{payload.body}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
