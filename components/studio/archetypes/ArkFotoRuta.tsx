import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS, isPortraitFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, imgPosition, imgScale, showBrush, showBadge, font, textPlate, lh } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";
import { BrushBox, StarBadge, isLightColor } from "@/components/studio/StudioBits";

// Arketyp 1: Foto + textruta. Fullbleed-foto, rubrik topp, färg-/penselruta med brödtext.
export default function ArkFotoRuta({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = isPortraitFormat(payload.format);
  const c = brand.colors;
  const useBrush = brand.elements.brush.enabled;
  const boxColor = payload.brushColor || c[brand.elements.brush.color] || c.accent;
  const light = isLightColor(boxColor);
  const ink = light ? c.ink : c.paper;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", background: c.paper, display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums" }}>
      <div style={{ padding: "40px 50px 0", textAlign: "center" }}>
        <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, textTransform: "uppercase", color: hlColor(c.primary, payload), fontSize: fs(62, payload, "h1"), lineHeight: lh(1.06, payload), letterSpacing: -0.5 }}><span data-edit="headline1" style={textPlate(payload)}>{payload.headline1}</span></div>
        {payload.headline2 ? <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: c.ink, fontSize: fs(50, payload, "h2"), lineHeight: lh(1.1, payload), marginTop: 6 }}><span data-edit="headline2" style={textPlate(payload)}>{payload.headline2}</span></div> : null}
      </div>

      <div style={{ position: "relative", flex: 1, margin: "16px 0 0" }}>
        <div data-edit-image style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {payload.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition(payload), transform: `scale(${imgScale(payload)})`, display: "block" }} />
          ) : <div style={{ width: "100%", height: "100%", background: `${c.support}44` }} />}
        </div>

        {payload.body ? (
          <div style={{ position: "absolute", left: 36, right: payload.badge.enabled ? 230 : 36, bottom: -18, minHeight: 150 }}>
            {useBrush && showBrush(payload) ? <BrushBox color={boxColor} /> : <div style={{ position: "absolute", inset: 0, background: boxColor, borderRadius: brand.elements.shapes.style === "sharp" ? 0 : 20 }} />}
            <div style={{ position: "relative", minHeight: 150, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "34px 56px" }}>
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, color: bodyColor(ink, payload), fontSize: fs(30, payload, "body"), lineHeight: lh(1.3, payload) }}><span data-edit="body" style={textPlate(payload)}>{payload.body}</span></div>
            </div>
          </div>
        ) : null}

        {showBadge(payload) ? (
          <div style={{ position: "absolute", right: 16, bottom: -46 }}>
            <StarBadge line1={payload.badge.line1} line2={payload.badge.line2} fill={c.accent} textColor={isLightColor(c.accent) ? c.ink : c.paper} strokeColor={c.accent} size={224} />
          </div>
        ) : null}
      </div>

      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 44 }} />}
    </div>
  );
}
