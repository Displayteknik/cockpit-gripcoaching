import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import KitFooter from "@/components/studio/KitFooter";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 2: Statement. Färgstark helyta, stor typografi, valfri accent-understrykning.
export default function ArkStatement({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;
  const onPrimary = isLightColor(c.primary) ? c.ink : c.paper;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, background: c.primary }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px" }}>
        <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: onPrimary, fontSize: 96, lineHeight: 0.98, letterSpacing: -1.5, textTransform: "uppercase" }}>
          {payload.headline1}
        </div>
        {brand.elements.underline.enabled ? (
          <div style={{ width: 180, height: 12, background: c.accent, borderRadius: 8, margin: "28px 0 8px" }} />
        ) : <div style={{ height: 24 }} />}
        {payload.headline2 ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: onPrimary, opacity: 0.92, fontSize: 42, lineHeight: 1.15 }}>{payload.headline2}</div>
        ) : null}
        {payload.body ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: onPrimary, opacity: 0.85, fontSize: 30, lineHeight: 1.35, marginTop: 22, maxWidth: 760 }}>{payload.body}</div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
