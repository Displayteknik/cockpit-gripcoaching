import type { StudioPayload } from "@/lib/studio/payload";
import { effectiveDims } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { dragPos } from "@/lib/studio/overrides";
import { valjLogga, logoPlateStyle, type LogoHint } from "@/lib/studio/logo-style";

// Mall: opticur-skarm-split (referens: "REDO INFÖR HÖSTEN" facit-annonsen, Ingelas egen bild).
// Opticur-exklusiv, fri storlek (OPTICUR-1 uppföljning 19/8). Delad yta: vitt textfält vänster,
// fullt foto höger med mjuk vit tonvärdesövergång mot skarven. Allt proportionellt mot
// canvasmåttet (effectiveDims) — samma princip som ArkSkarm, fungerar i valfri storlek/riktning.

export default function OpticurSkarmSplit({ payload, brand, logoHint }: { payload: StudioPayload; brand: StudioBrand; logoHint?: LogoHint | null }) {
  const { w, h } = effectiveDims(payload);
  const c = brand.colors;
  const textW = Math.round(w * 0.44);
  const pad = Math.round(w * 0.045);

  const logga = valjLogga({
    val: payload.overrides?.logoVariant,
    hint: logoHint,
    ljusBakgrundLogga: brand.assets.logo || "",
    morkBakgrundLogga: brand.assets.logoOnDark || "",
    // Loggan sitter alltid på det VITA textfältet i den här mallen, aldrig på fotot —
    // originalet (mörk logga för ljus bakgrund) är alltså rätt fallback, inte servermätningen
    // mot fotozonen (den mäter fel yta här).
    fallback: brand.assets.logo || brand.assets.logoOnDark || "",
  });
  const logoH = Math.round(h * 0.09);

  const h1Size = Math.round(h * 0.115);
  const h2Size = Math.round(h * 0.045);

  return (
    <div id="studio-canvas" style={{ overflowWrap: "break-word", width: w, height: h, position: "relative", overflow: "hidden", background: c.paper, fontFamily: "Inter, sans-serif" }}>
      {/* Foto höger, fullt kant-till-kant */}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: w - textW }}>
        {payload.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-edit-image src={payload.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${payload.imageFocusY}%`, display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${c.primary}, ${c.primaryDeep})` }} />
        )}
        {/* Mjuk vit tonvärdesövergång mot textfältet — annars ser skarven avklippt ut. */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${c.paper} 0%, ${c.paper}00 ${Math.round((w * 0.16) / (w - textW) * 100)}%)` }} />
      </div>

      {/* Textfält vänster */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: textW, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${pad}px` }}>
        <div data-drag="h1" style={{ ...dragPos(payload, "h1"), fontFamily: "Playfair Display, serif", fontWeight: 900, color: c.primary, fontSize: h1Size, lineHeight: 0.98, letterSpacing: -0.5 }}>
          <span data-edit="headline1">{payload.headline1}</span>
        </div>

        {/* Dekorlinje + sol — samma detalj som facit-annonsen. */}
        <div style={{ display: "flex", alignItems: "center", gap: h * 0.012, margin: `${Math.round(h * 0.02)}px 0` }}>
          <div style={{ flex: 1, height: 2, background: c.primary }} />
          <SolIkon color={c.primary} size={Math.round(h * 0.03)} />
          <div style={{ flex: 1, height: 2, background: c.primary }} />
        </div>

        {payload.headline2 ? (
          <div data-drag="h2" style={{ ...dragPos(payload, "h2"), fontFamily: "Inter, sans-serif", fontWeight: 800, color: c.ink, fontSize: h2Size, lineHeight: 1.2 }}>
            <span data-edit="headline2">{payload.headline2}</span>
          </div>
        ) : null}

        {payload.body ? (
          <div data-drag="body" style={{ ...dragPos(payload, "body"), fontFamily: "Inter, sans-serif", fontWeight: 500, color: c.ink, fontSize: Math.round(h * 0.028), lineHeight: 1.35, marginTop: h * 0.015 }}>
            <span data-edit="body">{payload.body}</span>
          </div>
        ) : null}

        {/* Riktig loggfil — aldrig genererad text/ikon. */}
        {logga.url ? (
          <div style={{ marginTop: Math.round(h * 0.04) }}>
            <div style={logoPlateStyle(logga.plate)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logga.url} alt="" style={{ height: logoH, width: "auto", maxWidth: textW - pad * 2, objectFit: "contain", display: "block" }} />
            </div>
            {brand.footer.tagline ? (
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, color: c.primaryDeep, fontSize: Math.round(h * 0.024), marginTop: Math.round(h * 0.008) }}>
                {brand.footer.tagline}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Fotplatta — mörkgrön, vit text. Samma färgroll (primary) som ArkSkarm, aldrig ljus. */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(h * 0.11), background: c.primary, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${pad}px` }}>
        <div style={{ color: c.paper, fontSize: Math.round(h * 0.032), fontWeight: 800, fontFamily: "Inter, sans-serif", textAlign: "center" }}>
          {brand.footer.address}
        </div>
      </div>
    </div>
  );
}

function SolIkon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line key={deg} x1="12" y1="1.5" x2="12" y2="3.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  );
}
