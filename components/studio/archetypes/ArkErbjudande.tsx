import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { fs, hlColor, bodyColor, imgPosition, imgScale } from "@/lib/studio/overrides";
import KitFooter from "@/components/studio/KitFooter";
import { StarBadge, isLightColor } from "@/components/studio/StudioBits";

// Arketyp 5: Erbjudande/CTA. Rubrik + foto/färgyta + stor badge med pris/erbjudande.
export default function ArkErbjudande({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;
  const badgeInk = isLightColor(c.accent) ? c.ink : c.paper;
  const onPrimary = isLightColor(c.primary) ? c.ink : c.paper;
  const shape = brand.elements.badge.shape;

  return (
    <div id="studio-canvas" style={{ width: w, height: h, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: `${brand.fonts.body}, sans-serif`, background: c.paper }}>
      <div style={{ padding: "44px 56px 0", textAlign: "center" }}>
        <div style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: hlColor(c.primary, payload), fontSize: fs(60, payload), lineHeight: 1.0, textTransform: "uppercase", letterSpacing: -0.5 }}>{payload.headline1}</div>
        {payload.headline2 ? <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: c.ink, fontSize: fs(36, payload), marginTop: 16 }}>{payload.headline2}</div> : null}
      </div>

      <div style={{ position: "relative", flex: 1, margin: "22px 0 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {payload.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payload.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition(payload), transform: `scale(${imgScale(payload)})` }} />
          ) : <div style={{ width: "100%", height: "100%", background: c.primary }} />}
        </div>

        {/* Stor pris-/erbjudande-badge (centrerad) */}
        {payload.badge.enabled ? (
          shape === "starburst" ? (
            <div style={{ position: "relative" }}><StarBadge line1={payload.badge.line1} line2={payload.badge.line2} fill={c.accent} textColor={badgeInk} strokeColor={c.accent} size={360} /></div>
          ) : (
            <div style={{ position: "relative", width: 340, height: 340, borderRadius: shape === "tag" ? 28 : 999, background: c.accent, color: badgeInk, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 50px rgba(0,0,0,0.18)" }}>
              <span style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, fontSize: fs(34, payload), textTransform: "uppercase", letterSpacing: 1 }}>{payload.badge.line1}</span>
              <span style={{ fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, fontSize: fs(88, payload), lineHeight: 0.95 }}>{payload.badge.line2}</span>
            </div>
          )
        ) : payload.body ? (
          <div style={{ position: "relative", maxWidth: 780, textAlign: "center", fontFamily: `${brand.fonts.headline}, sans-serif`, fontWeight: 800, color: bodyColor(onPrimary, payload), fontSize: fs(64, payload), lineHeight: 1.05, padding: "0 40px" }}>{payload.body}</div>
        ) : null}
      </div>

      {portrait ? <KitFooter brand={brand} /> : <div style={{ height: 40 }} />}
    </div>
  );
}
