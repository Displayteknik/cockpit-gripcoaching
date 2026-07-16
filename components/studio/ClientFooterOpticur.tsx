import type { StudioBrand } from "@/lib/studio/brand";

// Fast fot för alla Opticur-mallar (endast 1080×1350). Speglar kundens VARIANT 2:
// centrerad OPTICUR-wordmark · "Leg. optiker" + glasögon · avdelarlinje · adress ·
// ZEISS nere vänster · QR nere höger · grön balk "Boka online via bokadirekt.se".
//
// 100%-läge: om public/clients/opticur/footer.png finns (en exakt fot-crop ur kundens
// egen bild) renderas den rakt av istället för den kod-byggda foten.

export default function ClientFooterOpticur({ brand }: { brand: StudioBrand }) {
  const { colors, footer, assets } = brand;

  // Exakt fot-bild (om kunden droppat en crop) → 100% trogen.
  if (assets.footer) {
    return (
      <div style={{ width: "100%", marginTop: "auto" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets.footer} alt="Opticur" style={{ width: "100%", display: "block" }} />
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: 340, background: colors.paper, marginTop: "auto" }}>
      {/* OPTICUR — riktig wordmark (logo.png, innehåller glasögon) */}
      <div style={{ position: "absolute", top: 30, left: 0, right: 0, textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assets.logo} alt="Opticur" style={{ height: 84, width: "auto", display: "inline-block" }} />
      </div>

      {/* Leg. optiker + glasögon */}
      <div
        style={{
          position: "absolute",
          top: 134,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 28, color: colors.primaryDeep }}>
          {footer.tagline}
        </span>
        <GlassesLogo color={colors.primary} />
      </div>

      {/* Avdelarlinje */}
      <div style={{ position: "absolute", top: 188, left: 300, right: 300, height: 2, background: "#C9CFC9" }} />

      {/* Adress */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 23,
          color: colors.ink,
        }}
      >
        {footer.address}
      </div>

      {/* ZEISS nere vänster */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assets.zeiss}
        alt="ZEISS"
        style={{ position: "absolute", left: 44, bottom: 78, height: 104, width: "auto", display: "block" }}
      />
      {/* QR nere höger */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assets.qr}
        alt="QR-kod bokning"
        style={{ position: "absolute", right: 44, bottom: 78, height: 104, width: 104, display: "block" }}
      />

      {/* Grön CTA-balk */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 60,
          background: colors.primary,
          color: colors.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, sans-serif",
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: 1,
        }}
      >
        {footer.ctaLabel}
      </div>
    </div>
  );
}

// Glasögon-lockup (två rundade rutor + brygga) — matchar kundens "Leg. optiker"-glasögon.
function GlassesLogo({ color }: { color: string }) {
  return (
    <svg width="72" height="22" viewBox="0 0 72 22" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="2" width="28" height="18" rx="9" stroke={color} strokeWidth="2.5" />
      <rect x="42.5" y="2" width="28" height="18" rx="9" stroke={color} strokeWidth="2.5" />
      <rect x="30" y="9.5" width="12" height="2.5" fill={color} />
    </svg>
  );
}
