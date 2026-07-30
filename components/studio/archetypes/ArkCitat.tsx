import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS, isPortraitFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, font, textPlate, lh, dragPos } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 3: Citat/kundröst. Lugn stödfärgs-yta, stort citattecken, citat + avsändare.
// payload.body = citatet, payload.headline2 = avsändare/roll, payload.headline1 = liten etikett (valfri).
export default function ArkCitat({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = isPortraitFormat(payload.format);
  const c = brand.colors;
  const bg = `${c.support}33`;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums", background: bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 84px", position: "relative" }}>
        {/* Stort citattecken */}
        <div style={{ fontFamily: "Georgia, serif", fontSize: fs(260, payload), lineHeight: 0.7, color: c.accent, height: 130, overflow: "hidden" }}>&ldquo;</div>
        {payload.headline1 ? (
          <div data-drag="h1" style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: c.primary, fontSize: fs(22, payload, "h1"), marginBottom: 10, ...dragPos(payload, "h1") }}><span data-edit="headline1" style={textPlate(payload)}>{payload.headline1}</span></div>
        ) : null}
        <div data-drag="body" style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 700, color: bodyColor(c.ink, payload), fontSize: fs(52, payload, "body"), lineHeight: lh(1.28, payload), ...dragPos(payload, "body") }}><span data-edit="body" style={textPlate(payload)}>{payload.body}</span></div>
        {payload.headline2 ? (
          <div data-drag="h2" style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30, ...dragPos(payload, "h2") }}>
            <div style={{ width: 46, height: 4, background: c.primary, borderRadius: 2 }} />
            <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, color: c.primaryDeep, fontSize: fs(28, payload, "h2") }}><span data-edit="headline2" style={textPlate(payload)}>{payload.headline2}</span></div>
          </div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
