import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS, isPortraitFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, font, textPlate, lh } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";
import { isLightColor } from "@/components/studio/StudioBits";

// Arketyp 4: Lista/tips. Rubrik + numrerade punkter (body delas på radbrytning/·/;).
export default function ArkLista({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = isPortraitFormat(payload.format);
  const c = brand.colors;
  const numInk = isLightColor(c.accent) ? c.ink : c.paper;
  const items = payload.body.split(/\n|·|;|•/).map((s) => s.trim()).filter(Boolean).slice(0, 4);

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums", background: c.paper }}>
      <div style={{ padding: "56px 64px 20px" }}>
        <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: hlColor(c.primary, payload), fontSize: fs(68, payload, "h1"), lineHeight: lh(1.08, payload), textTransform: "uppercase", letterSpacing: -0.5 }}><span data-edit="headline1" style={textPlate(payload)}>{payload.headline1}</span></div>
        {payload.headline2 ? <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: c.ink, fontSize: fs(34, payload, "h2"), lineHeight: lh(1.25, payload), marginTop: 18 }}><span data-edit="headline2" style={textPlate(payload)}>{payload.headline2}</span></div> : null}
      </div>
      <div style={{ flex: 1, padding: "10px 64px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "20px 0" }}>
              <div style={{ width: 68, height: 68, borderRadius: brand.elements.shapes.style === "sharp" ? 8 : 999, background: c.accent, color: numInk, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, fontSize: fs(34, payload), flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: bodyColor(c.ink, payload), fontSize: fs(36, payload, "body"), lineHeight: lh(1.3, payload) }}><span data-edit={`list-${i}`}>{item}</span></div>
            </div>
            {brand.elements.lines.enabled && i < items.length - 1 ? <div style={{ height: brand.elements.lines.weight === "bold" ? 3 : 1, background: `${c.support}88` }} /> : null}
          </div>
        ))}
      </div>
      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
