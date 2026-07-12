import { ImageResponse } from "next/og";

export const alt = "Life i Balans — nervsystem, stress och klimakteriet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Egen OG-bild (Örtagård) — överskrider HM Motors root-OG för /sites/lifeibalans.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(1000px 600px at 78% 12%, #3f5233 0%, transparent 60%), linear-gradient(150deg, #2f3e27 0%, #1f2a1a 100%)",
          color: "#ece4d4",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", width: "40px", height: "40px", borderRadius: "50%", background: "#bf9f55" }} />
          <div style={{ fontSize: "26px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#d8c182" }}>
            Leg. sjuksköterska
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              fontSize: "78px",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "900px",
            }}
          >
            <span>Trött på ett sätt som&nbsp;</span>
            <span style={{ fontStyle: "italic", color: "#d8c182" }}>sömn</span>
            <span>&nbsp;inte fixar.</span>
          </div>
          <div style={{ fontSize: "30px", color: "#aab199", maxWidth: "760px" }}>
            Nervsystem, stress och klimakteriet — utbildning och coaching av Linda Fernquist.
          </div>
        </div>

        <div style={{ fontSize: "30px", fontStyle: "italic", color: "#f6f2ea" }}>Life i Balans</div>
      </div>
    ),
    size
  );
}
