import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import KitFooter from "@/components/studio/KitFooter";
import { BrushBox, StarBadge, isLightColor } from "@/components/studio/StudioBits";

// Arketyp 1: Foto + textruta. Fullbleed-foto, rubrik topp, färg-/penselruta med brödtext.
export default function ArkFotoRuta({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;
  const useBrush = brand.elements.brush.enabled;
  const boxColor = payload.brushColor || c[brand.elements.brush.color] || c.accent;
  const light = isLightColor(boxColor);
  const ink = light ? c.ink : c.paper;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", background: c.paper, display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif` }}>
      <div style={{ padding: "40px 50px 0", textAlign: "center" }}>
        <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, textTransform: "uppercase", color: c.primary, fontSize: 62, lineHeight: 1.0, letterSpacing: -0.5 }}>{payload.headline1}</div>
        {payload.headline2 ? <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: c.ink, fontSize: 50, lineHeight: 1.05, marginTop: 6 }}>{payload.headline2}</div> : null}
      </div>

      <div style={{ position: "relative", flex: 1, margin: "16px 0 0" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {payload.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${payload.imageFocusY}%`, display: "block" }} />
          ) : <div style={{ width: "100%", height: "100%", background: `${c.support}44` }} />}
        </div>

        {payload.body ? (
          <div style={{ position: "absolute", left: 36, right: payload.badge.enabled ? 230 : 36, bottom: -18, minHeight: 150 }}>
            {useBrush ? <BrushBox color={boxColor} /> : <div style={{ position: "absolute", inset: 0, background: boxColor, borderRadius: brand.elements.shapes.style === "sharp" ? 0 : 20 }} />}
            <div style={{ position: "relative", minHeight: 150, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "34px 56px" }}>
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, color: ink, fontSize: 30, lineHeight: 1.25 }}>{payload.body}</div>
            </div>
          </div>
        ) : null}

        {payload.badge.enabled ? (
          <div style={{ position: "absolute", right: 16, bottom: -46 }}>
            <StarBadge line1={payload.badge.line1} line2={payload.badge.line2} fill={c.accent} textColor={isLightColor(c.accent) ? c.ink : c.paper} strokeColor={c.accent} size={224} />
          </div>
        ) : null}
      </div>

      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 44 }} />}
    </div>
  );
}
