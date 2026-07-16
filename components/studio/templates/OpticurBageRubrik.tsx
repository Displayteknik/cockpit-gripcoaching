import type { StudioPayload } from "@/lib/studio/payload";
import { FORMAT_DIMENSIONS } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import ClientFooterOpticur from "@/components/studio/ClientFooterOpticur";
import { StarBadge } from "@/components/studio/StudioBits";

// Mall: opticur-bage-rubrik  (referens: "BARNGLASÖGON")
// Foto överst med bågform i underkant (grön kantlinje) · gul jätterubrik med grön kontur (centrerad) ·
// gula streck-accenter · centrerad grön underrubrik · fylld sol · fot (1350).

export default function OpticurBageRubrik({ payload, brand }: { payload: StudioPayload; brand: StudioBrand }) {
  const { w, h } = FORMAT_DIMENSIONS[payload.format];
  const portrait = payload.format === "1080x1350";
  const c = brand.colors;
  const photoH = portrait ? 560 : 500;

  return (
    <div
      id="studio-canvas"
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        background: c.paper,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Foto med bågform i underkant */}
      <div style={{ position: "relative", width: "100%", height: photoH, flexShrink: 0 }}>
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

        {payload.badge.enabled ? (
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <StarBadge
              line1={payload.badge.line1}
              line2={payload.badge.line2}
              fill={c.accent}
              textColor={c.ink}
              strokeColor={c.accent}
              size={200}
            />
          </div>
        ) : null}

        {/* Vit bågmask + grön kantlinje (konvex — fotot buktar ned i mitten) */}
        <svg
          width="100%"
          height="150"
          viewBox="0 0 1080 150"
          preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, bottom: -1, display: "block" }}
        >
          <path d="M0,150 L0,44 Q540,110 1080,44 L1080,150 Z" fill={c.paper} />
          <path d="M0,44 Q540,110 1080,44" fill="none" stroke={c.primary} strokeWidth="5" />
        </svg>
      </div>

      {/* Textzon (centrerad) */}
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "6px 56px 40px",
        }}
      >
        {/* Gula streck-accenter */}
        <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
          <span style={{ width: 44, height: 8, background: c.accent, borderRadius: 5, transform: "rotate(-18deg)" }} />
          <span style={{ width: 26, height: 8, background: c.accent, borderRadius: 5, transform: "rotate(-6deg)" }} />
        </div>

        {/* Gul jätterubrik med grön kontur */}
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            textTransform: "uppercase",
            color: c.accent,
            WebkitTextStroke: `4px ${c.primary}`,
            paintOrder: "stroke fill",
            fontSize: 104,
            lineHeight: 0.98,
            letterSpacing: -1,
          }}
        >
          {payload.headline1}
        </div>

        {/* Underrubrik (centrerad, ingen sol) */}
        {payload.headline2 ? (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              color: c.primary,
              fontSize: 42,
              lineHeight: 1.14,
              marginTop: 26,
            }}
          >
            {payload.headline2}
          </div>
        ) : null}

        {/* Brödtext (valfri) */}
        {payload.body ? (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              color: c.ink,
              fontSize: 26,
              lineHeight: 1.24,
              marginTop: 22,
              maxWidth: 760,
            }}
          >
            {payload.body}
          </div>
        ) : null}
      </div>

      {portrait ? <ClientFooterOpticur brand={brand} /> : <div style={{ height: 44 }} />}
    </div>
  );
}
