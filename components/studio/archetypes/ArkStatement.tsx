import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS, isPortraitFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, font, textPlate, lh, dragPos } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 2: Statement. Färgstark helyta, stor typografi, valfri accent-understrykning.
export default function ArkStatement({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = isPortraitFormat(payload.format);
  const c = brand.colors;
  const onPrimary = isLightColor(c.primary) ? c.ink : c.paper;

  return (
    <div id="studio-canvas" style={{ overflowWrap: "break-word", width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums", background: c.primary }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 90px" }}>
        <div data-drag="h1" style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: hlColor(onPrimary, payload), fontSize: fs(96, payload, "h1"), lineHeight: lh(1.06, payload), letterSpacing: -1.5, textTransform: "uppercase", ...dragPos(payload, "h1") }}>
          <span data-edit="headline1" style={textPlate(payload)}>{payload.headline1}</span>
        </div>
        {brand.elements.underline.enabled ? (
          <div style={{ width: 180, height: 12, background: c.accent, borderRadius: 8, margin: "28px 0 8px" }} />
        ) : <div style={{ height: 24 }} />}
        {payload.headline2 ? (
          <div data-drag="h2" style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: onPrimary, opacity: 0.92, fontSize: fs(42, payload, "h2"), lineHeight: lh(1.2, payload), ...dragPos(payload, "h2") }}><span data-edit="headline2" style={textPlate(payload)}>{payload.headline2}</span></div>
        ) : null}
        {payload.body ? (
          <div data-drag="body" style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: bodyColor(onPrimary, payload), opacity: 0.85, fontSize: fs(30, payload, "body"), lineHeight: lh(1.4, payload), marginTop: 22, maxWidth: 760, ...dragPos(payload, "body") }}><span data-edit="body" style={textPlate(payload)}>{payload.body}</span></div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} format={payload.format} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
