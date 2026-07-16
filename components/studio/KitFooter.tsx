import type { StudioBrand } from "@/lib/studio/brand";
import { isLightColor } from "@/components/studio/StudioBits";

// Generisk fot för alla arketyper. Läser kitet — ingen kund-hårdkodning.
// Prioritet: exakt fot-crop (footer.png) → kod-byggd fot ur kit (logga/namn + adress + CTA + QR).
// Döljs helt om brand.footer.show === false.
export default function KitFooter({ brand }: { brand: StudioBrand }) {
  const c = brand.colors;

  // 100%-läge: kundens egna exakta fot-bild (t.ex. Opticur).
  if (brand.assets.footer) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={brand.assets.footer} alt="" style={{ width: "100%", display: "block", marginTop: "auto" }} />;
  }
  if (!brand.footer.show) return <div style={{ height: 40 }} />;

  const hasCta = Boolean(brand.footer.ctaLabel);
  const ctaInk = isLightColor(c.primary) ? c.ink : c.paper;

  return (
    <div style={{ marginTop: "auto", background: c.paper, borderTop: `1px solid ${c.support}55` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "26px 44px" }}>
        {/* Logga eller namn */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {brand.assets.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.assets.logo} alt="" style={{ maxHeight: 74, maxWidth: 360, objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ fontFamily: `${brand.fonts.logo || brand.fonts.headline}, serif`, fontWeight: 800, fontSize: 44, color: c.primary, lineHeight: 1 }}>
              {brand.name}
            </div>
          )}
          {brand.footer.tagline ? (
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 22, color: c.primaryDeep, marginTop: 6 }}>{brand.footer.tagline}</div>
          ) : null}
          {brand.footer.address ? (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 20, color: c.ink, marginTop: 8 }}>{brand.footer.address}</div>
          ) : null}
        </div>

        {/* QR (valfri) */}
        {brand.assets.qr || brand.footer.qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.assets.qr || brand.footer.qrUrl} alt="" style={{ width: 108, height: 108, objectFit: "contain", flexShrink: 0 }} />
        ) : null}
      </div>

      {/* CTA-remsa */}
      {hasCta ? (
        <div style={{ background: c.primary, color: ctaInk, textAlign: "center", padding: "18px 24px", fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 30 }}>
          {brand.footer.ctaLabel}
        </div>
      ) : null}
    </div>
  );
}
