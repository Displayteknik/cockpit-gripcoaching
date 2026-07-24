import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS, isPortraitFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, font, textPlate, lh } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";

// Arketyp 7: Text-först-kort. Lugnt, editoriellt — texten är huvudsaken, bilden stödet.
// För coach/konsult/LinkedIn där budskapet bär.
// headline1 = liten etikett, headline2 = rubrik, body = huvudtext (längre).
export default function ArkTextkort({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = isPortraitFormat(payload.format);
  const c = brand.colors;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums", background: c.paper }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
        {/* Accent-detalj */}
        <div style={{ width: 70, height: 8, background: c.accent, borderRadius: 6, marginBottom: 34 }} />

        {payload.headline1 ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: c.primary, fontSize: fs(24, payload, "h1"), marginBottom: 18 }}><span data-edit="headline1" style={textPlate(payload)}>{payload.headline1}</span></div>
        ) : null}
        {payload.headline2 ? (
          <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: hlColor(c.ink, payload), fontSize: fs(58, payload, "h2"), lineHeight: lh(1.12, payload), letterSpacing: -0.5, marginBottom: 26 }}><span data-edit="headline2" style={textPlate(payload)}>{payload.headline2}</span></div>
        ) : null}
        {payload.body ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: bodyColor(c.ink, payload), opacity: 0.86, fontSize: fs(36, payload, "body"), lineHeight: lh(1.45, payload), maxWidth: 820 }}><span data-edit="body" style={textPlate(payload)}>{payload.body}</span></div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
