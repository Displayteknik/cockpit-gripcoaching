import type { StudioPayload } from "@/lib/studio/payload";
import { effectiveDims } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import { dragPos, fs, lh, hlColor, bodyColor, font, imgPosition, imgScale } from "@/lib/studio/overrides";
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

  // Versalt (facit) breddar texten märkbart mer än gemener — samma h1Size som innan gav
  // "HÖSTEN?" en fjärde rad som sköt hela rubriken utanför ytan (Håkans fynd 19/8, canvasen
  // centreras vertikalt så överskott trycker både uppåt och nedåt). Mindre storlek + tightare
  // kerning ger plats för tre rader igen, som i facit.
  // Basstorlekar (andel av canvashöjden — samma princip som ArkSkarm), sen genom fs() så
  // Textstorlek-reglagen (Rubrik/Underrubrik/Brödtext %) fungerar precis som i andra mallar.
  const h1Size = fs(h * 0.092, payload, "h1");
  // Facit har underrubriken på EN rad. 0.045 var för stort för textfältets bredd — bröt till
  // två rader (Håkans fynd 19/8). Mindre storlek, mätt empiriskt mot exporten, inte gissat.
  const h2Size = fs(h * 0.028, payload, "h2");
  const bodySize = fs(h * 0.028, payload, "body");

  // Fotplattan (facit): bara stad + telefon, inte hela adressen. Härlett ur den riktiga
  // adressdatan ("Storgatan 44 · Högsby · Tel 0491-200 62") i stället för hårdkodat — mallen
  // ska aldrig känna till att kunden sitter i Högsby, bara veta hur adressfältet är byggt.
  const addrDelar = brand.footer.address.split("·").map((s) => s.trim()).filter(Boolean);
  const stad = (addrDelar[1] || addrDelar[0] || "").toUpperCase();
  const telefon = (addrDelar[2] || "").replace(/^tel\.?\s*/i, "");

  return (
    <div id="studio-canvas" style={{ overflowWrap: "break-word", width: w, height: h, position: "relative", overflow: "hidden", background: c.paper, fontFamily: "Inter, sans-serif" }}>
      {/* Foto höger, fullt kant-till-kant */}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: w - textW }}>
        {payload.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-edit-image src={payload.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: imgPosition(payload), transform: `scale(${imgScale(payload)})`, display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `linear-gradient(160deg, ${c.primary}, ${c.primaryDeep})` }} />
        )}
        {/* Mjuk vit tonvärdesövergång mot textfältet — annars ser skarven avklippt ut. */}
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${c.paper} 0%, ${c.paper}00 ${Math.round((w * 0.16) / (w - textW) * 100)}%)` }} />
      </div>

      {/* Textfält vänster */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: textW, display: "flex", flexDirection: "column", justifyContent: "center", padding: `0 ${pad}px` }}>
        <div data-drag="h1" style={{ ...dragPos(payload, "h1"), fontFamily: font("Playfair Display", payload), fontWeight: 900, color: hlColor(c.primary, payload), fontSize: h1Size, lineHeight: lh(0.94, payload), letterSpacing: -1.5, textTransform: "uppercase" }}>
          <span data-edit="headline1">{payload.headline1}</span>
        </div>

        {/* Dekorlinje + sol — samma detalj som facit-annonsen. */}
        <div style={{ display: "flex", alignItems: "center", gap: h * 0.012, margin: `${Math.round(h * 0.02)}px 0` }}>
          <div style={{ flex: 1, height: 2, background: c.primary }} />
          <SolIkon color={c.primary} size={Math.round(h * 0.03)} />
          <div style={{ flex: 1, height: 2, background: c.primary }} />
        </div>

        {payload.headline2 ? (
          <div data-drag="h2" style={{ ...dragPos(payload, "h2"), fontFamily: "Inter, sans-serif", fontWeight: 800, color: bodyColor(c.ink, payload), fontSize: h2Size, lineHeight: lh(1.2, payload) }}>
            <span data-edit="headline2">{payload.headline2}</span>
          </div>
        ) : null}

        {payload.body ? (
          <div data-drag="body" style={{ ...dragPos(payload, "body"), fontFamily: "Inter, sans-serif", fontWeight: 500, color: bodyColor(c.ink, payload), fontSize: bodySize, lineHeight: lh(1.35, payload), marginTop: h * 0.015 }}>
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

      {/* Fotplatta — Håkans besked 19/8: ljusgrön (primaryLight), inte mörkgrön. Texten större. */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(h * 0.11), background: c.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", gap: Math.round(h * 0.02), padding: `0 ${pad}px` }}>
        <span style={{ color: c.paper, fontSize: Math.round(h * 0.042), fontWeight: 800, fontFamily: "Inter, sans-serif" }}>{stad}</span>
        {telefon ? (
          <>
            <span style={{ width: 2, height: Math.round(h * 0.032), background: "rgba(255,255,255,0.6)" }} />
            <TelefonIkon color={c.paper} size={Math.round(h * 0.036)} />
            <span style={{ color: c.paper, fontSize: Math.round(h * 0.042), fontWeight: 800, fontFamily: "Inter, sans-serif" }}>{telefon}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function TelefonIkon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4.6c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
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
