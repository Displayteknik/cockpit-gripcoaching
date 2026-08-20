import type { StudioPayload } from "@/lib/studio/payload";
import { effectiveDims } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { hlColor, bodyColor, imgPosition, imgScale, imgFit, font, lh, showBadge } from "@/lib/studio/overrides";
import { logoPlateStyle, valjLogga, type LogoHint } from "@/lib/studio/logo-style";

// Arketyp: fri storlek / skärmformat (OPTICUR-1 Etapp B). Måttoberoende — bygger på
// effectiveDims(payload) (payload.customSize), inte ett fast StudioFormat. Typografi,
// zoner och säkerhetsmarginaler skalar mot canvashöjden, inte fasta pixelvärden, så
// samma mall fungerar från en avlång remsa (1920x360) till en hög skärm (1080x1920).
//
// Enradigt läge (B2): när ytan är mycket bred och kort (w/h ≥ ENRAD_GRANS) staplas
// inte zonerna längre (rubrik ovanpå foto ovanpå fot) — det hade kollapsat till
// oläsbara smala remsor. I stället läggs logga, rubrik och fot-info i EN rad sida vid
// sida. Verifierat mot tre ytterlighetsfall: 4:3 (1200x900), 16:9 (1920x1080) och
// 1920x360 (enradigt).
const ENRAD_GRANS = 2.4;

export default function ArkSkarm({ payload, brand, logoHint }: { payload: StudioPayload; brand: StudioBrand; logoHint?: LogoHint | null }) {
  const { w, h } = effectiveDims(payload);
  const c = brand.colors;
  const enrad = w / h >= ENRAD_GRANS;

  // Säkerhetsmarginal: 4 % av kortaste sidan, aldrig snålare än 16 px — så en liten
  // skärm (200x200 i extremfallet) inte får en marginal på 0.
  const margin = Math.max(16, Math.round(Math.min(w, h) * 0.04));

  const logga = valjLogga({
    val: payload.overrides?.logoVariant,
    hint: logoHint,
    ljusBakgrundLogga: brand.assets.logo || "",
    morkBakgrundLogga: brand.assets.logoOnDark || "",
    fallback: brand.assets.logoOnDark || brand.assets.logo || "",
  });
  // Loggans höjd skalar mot canvashöjden, inte ett fast StudioFormat-uppslag
  // (LOGO_MIN_HEIGHT är kalibrerad för 1080-breda canvasar och passar inte här).
  const logoH = Math.max(20, Math.round(h * (enrad ? 0.16 : 0.07)));

  // Typografi: allt en andel av canvashöjden — samma princip oavsett mått.
  const h1Size = Math.round(h * (enrad ? 0.14 : 0.1) * (payload.overrides?.fontScale || 1) * (payload.overrides?.h1Scale || 1));
  const h2Size = Math.round(h * (enrad ? 0.055 : 0.045) * (payload.overrides?.fontScale || 1) * (payload.overrides?.h2Scale || 1));
  const bodySize = Math.round(h * 0.032 * (payload.overrides?.fontScale || 1) * (payload.overrides?.bodyScale || 1));

  // Footer-plattan: språkregeln (B4) — all text sätts HÄR av mallen, aldrig genererad
  // i fotot. Höjden skalar mot canvashöjden, aldrig lägre än vad texten faktiskt behöver.
  const footerH = Math.round(h * (enrad ? 1 : 0.16));
  const footerText = [brand.footer.tagline, brand.footer.address].filter(Boolean).join(" · ");

  const LoggaNod = logga.url ? (
    <div style={logoPlateStyle(logga.plate)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logga.url} alt="" style={{ height: logoH, width: "auto", maxWidth: w * 0.4, objectFit: "contain", display: "block", filter: payload.imageUrl ? "drop-shadow(0 2px 8px rgba(0,0,0,0.35))" : undefined }} />
    </div>
  ) : (
    <div style={{ fontFamily: `${brand.fonts.logo || brand.fonts.headline}, serif`, fontWeight: 800, fontSize: logoH * 0.7, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>{brand.name}</div>
  );

  return (
    <div id="studio-canvas" style={{ overflowWrap: "break-word", width: w, height: h, position: "relative", overflow: "hidden", fontFamily: `${brand.fonts.body}, sans-serif`, fontVariantNumeric: "lining-nums", background: c.primaryDeep }}>
      {/* Foto — object-fit: cover är upplösningsoberoende per konstruktion, exakt samma
          mekanism som övriga arketyper (BESKÄR-1-principen: en delad, inte en egen väg). */}
      {payload.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img data-edit-image src={payload.imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: imgFit(payload), objectPosition: imgPosition(payload), transform: `scale(${imgScale(payload)})` }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${c.primary}, ${c.primaryDeep})` }} />
      )}
      <div style={{ position: "absolute", inset: 0, background: enrad ? "rgba(0,0,0,0.4)" : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.72) 100%)" }} />

      {enrad ? (
        // ── Enradigt läge: logga · rubrik/underrubrik · fot-info, allt i EN rad ──
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: `0 ${margin}px`, gap: margin }}>
          <div style={{ flexShrink: 0 }}>{LoggaNod}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: hlColor("#fff", payload), fontSize: h1Size, lineHeight: lh(1.05, payload), letterSpacing: -0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {payload.headline1}
            </div>
            {payload.headline2 ? (
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 600, color: bodyColor("#fff", payload), opacity: 0.92, fontSize: h2Size, marginTop: h * 0.02, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {payload.headline2}
              </div>
            ) : null}
          </div>
          {footerText ? (
            <div style={{ flexShrink: 0, textAlign: "right", background: c.primary, color: c.paper, padding: `${margin * 0.5}px ${margin}px`, borderRadius: 8, fontSize: bodySize, fontWeight: 600, whiteSpace: "nowrap" }}>
              {footerText}
            </div>
          ) : null}
        </div>
      ) : (
        // ── Normalläge: logga uppe, rubrik/text i mitten-nedre delen, fot-platta längst ner ──
        <>
          <div style={{ position: "absolute", top: margin, left: margin, right: margin, display: "flex", alignItems: "center" }}>
            {LoggaNod}
          </div>

          <div style={{ position: "absolute", left: margin, right: margin, bottom: footerH + margin, display: "flex", flexDirection: "column" }}>
            {payload.headline2 ? (
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 700, color: c.accent, fontSize: h2Size, lineHeight: lh(1.2, payload), textTransform: "uppercase", letterSpacing: 1, marginBottom: h * 0.015 }}>
                {payload.headline2}
              </div>
            ) : null}
            <div style={{ fontFamily: font(brand.fonts.headline, payload), fontWeight: 800, color: hlColor("#fff", payload), fontSize: h1Size, lineHeight: lh(1.08, payload), letterSpacing: -1, textShadow: "0 2px 14px rgba(0,0,0,0.35)" }}>
              {payload.headline1}
            </div>
            {payload.body ? (
              <div style={{ fontFamily: `${brand.fonts.body}, sans-serif`, fontWeight: 400, color: bodyColor("#fff", payload), opacity: 0.94, fontSize: bodySize, lineHeight: lh(1.4, payload), marginTop: h * 0.015, textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
                {payload.body}
              </div>
            ) : null}
          </div>

          {/* Fot-platta (B4): varumärkesfärg, riktig kontaktinfo — aldrig genererad text. */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: footerH, background: c.primary, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${margin}px` }}>
            <div style={{ color: c.paper, fontSize: bodySize, fontWeight: 600, fontFamily: `${brand.fonts.body}, sans-serif` }}>
              {footerText}
            </div>
            {showBadge(payload) ? (
              <div style={{ color: c.paper, fontSize: bodySize, fontWeight: 700, fontFamily: `${brand.fonts.body}, sans-serif`, background: "rgba(255,255,255,0.16)", padding: `${bodySize * 0.3}px ${bodySize * 0.6}px`, borderRadius: 999 }}>
                {payload.badge.line1} {payload.badge.line2}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
