import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import KitFooter from "@/components/studio/KitFooter";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 3: Citat/kundröst. Lugn stödfärgs-yta, stort citattecken, citat + avsändare.
// payload.body = citatet, payload.headline2 = avsändare/roll, payload.headline1 = liten etikett (valfri).
export default function ArkCitat({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;
  const bg = `${c.support}33`;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, background: bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 84px", position: "relative" }}>
        {/* Stort citattecken */}
        <div style={{ fontFamily: "Georgia, serif", fontSize: 260, lineHeight: 0.7, color: c.accent, height: 130, overflow: "hidden" }}>&ldquo;</div>
        {payload.headline1 ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: c.primary, fontSize: 22, marginBottom: 10 }}>{payload.headline1}</div>
        ) : null}
        <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 700, color: c.ink, fontSize: 52, lineHeight: 1.22 }}>{payload.body}</div>
        {payload.headline2 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30 }}>
            <div style={{ width: 46, height: 4, background: c.primary, borderRadius: 2 }} />
            <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, color: c.primaryDeep, fontSize: 28 }}>{payload.headline2}</div>
          </div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
