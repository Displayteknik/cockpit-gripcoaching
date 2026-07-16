import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";

// Arketyp 7: Text-först-kort. Lugnt, editoriellt — texten är huvudsaken, bilden stödet.
// För coach/konsult/LinkedIn där budskapet bär.
// headline1 = liten etikett, headline2 = rubrik, body = huvudtext (längre).
export default function ArkTextkort({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, background: c.paper }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}>
        {/* Accent-detalj */}
        <div style={{ width: 70, height: 8, background: c.accent, borderRadius: 6, marginBottom: 34 }} />

        {payload.headline1 ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2.5, color: c.primary, fontSize: fs(24, payload), marginBottom: 18 }}>{payload.headline1}</div>
        ) : null}
        {payload.headline2 ? (
          <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: c.ink, fontSize: fs(58, payload), lineHeight: 1.08, letterSpacing: -0.5, marginBottom: 26 }}>{payload.headline2}</div>
        ) : null}
        {payload.body ? (
          <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: c.ink, opacity: 0.86, fontSize: fs(36, payload), lineHeight: 1.45, maxWidth: 820 }}>{payload.body}</div>
        ) : null}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
