import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import ClientFooterOpticur from "@/components/studio/ClientFooterOpticur";
import { SunOutline, StarBadge, BrushBox, isLightColor } from "@/components/studio/StudioBits";

// Mall: opticur-foto-gul-ruta  (referens: "SOMMARLOV = MER SKÄRMTID")
// Vit bakgrund · två rubrikrader (grön + nästan-svart) · inramat foto ·
// gul penseldrags-ruta med kontur-sol + brödtext · stjärn-badge nere höger · fot (1350).

export default function OpticurFotoGulRuta({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;

  // Penselfärg: vald färg, annars mallens standard (Opticur-gul). Auto-kontrast så
  // text + sol-ikon förblir läsbara på valfri färg (svart på ljus, vitt på mörk).
  const brushColor = payload.brushColor || c.yellow;
  const light = isLightColor(brushColor);
  const inkColor = light ? c.black : c.white;
  const iconColor = light ? c.greenDeep : c.white;

  return (
    <div
      id="studio-canvas"
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        background: c.white,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Rubrikblock (centrerat — rad 2 hamnar centrerad under rubriken) */}
      <div style={{ padding: "40px 50px 0", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            textTransform: "uppercase",
            color: c.greenDark,
            fontSize: 62,
            lineHeight: 1.0,
            letterSpacing: -0.5,
          }}
        >
          {payload.headline1}
        </div>
        {payload.headline2 ? (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 800,
              color: c.black,
              fontSize: 50,
              lineHeight: 1.05,
              marginTop: 6,
            }}
          >
            {payload.headline2}
          </div>
        ) : null}
      </div>

      {/* Fotozon — foto ut i kanterna (ingen ram), overlays får sticka ut */}
      <div style={{ position: "relative", flex: 1, margin: "16px 0 0" }}>
        {/* Fullbredds-foto (ingen rundning) */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          {payload.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={payload.imageUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `center ${payload.imageFocusY}%`,
                display: "block",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#dfe3e0" }} />
          )}
        </div>

        {/* Penseldrags-ruta (färgbar vektor) — överlappar fotots underkant */}
        {payload.body ? (
          <div
            style={{
              position: "absolute",
              left: 36,
              right: payload.badge.enabled ? 230 : 36,
              bottom: -18,
              minHeight: 168,
            }}
          >
            <BrushBox color={brushColor} />
            <div
              style={{
                position: "relative",
                minHeight: 168,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "36px 64px 40px 44px",
              }}
            >
              <SunOutline color={iconColor} size={60} />
              <div
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  color: inkColor,
                  fontSize: 30,
                  lineHeight: 1.25,
                }}
              >
                {payload.body}
              </div>
            </div>
          </div>
        ) : null}

        {/* Stjärn-badge nere höger */}
        {payload.badge.enabled ? (
          <div style={{ position: "absolute", right: 16, bottom: -46 }}>
            <StarBadge
              line1={payload.badge.line1}
              line2={payload.badge.line2}
              fill={c.yellow}
              textColor={c.black}
              strokeColor={c.yellow}
              size={224}
            />
          </div>
        ) : null}
      </div>

      {/* Fast fot — endast porträtt */}
      {portrait ? <ClientFooterOpticur brand={brand} /> : <div style={{ height: 44 }} />}
    </div>
  );
}
