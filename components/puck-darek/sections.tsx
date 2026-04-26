"use client";

// Darek Puck-komponenter — visuellt nära template.html
// Varje komponent renderar med Dareks luxury-minimal stil (svart/guld, Cormorant + Manrope)

const dareKStyles = `
  .dk-section { font-family: 'Manrope', system-ui, sans-serif; color: #f5efe6; background: #0a0a0a; padding: 80px 24px; }
  .dk-container { max-width: 1180px; margin: 0 auto; }
  .dk-display { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; line-height: 1.05; letter-spacing: -0.01em; }
  .dk-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #c9a96e; }
  .dk-muted { color: #8a8a8a; }
  .dk-gold { color: #c9a96e; }
`;

function Style() { return <style dangerouslySetInnerHTML={{ __html: dareKStyles }} />; }

// ────────────────────────────────────────────────────────────────────
// HERO
// ────────────────────────────────────────────────────────────────────
export interface HeroProps {
  year: string; titleLine1: string; titleLine2: string; tagline: string;
  ctaLabel: string; ctaHref: string; heroImage: string; heroAlt: string; scrollHint: string;
}
export function Hero({ year, titleLine1, titleLine2, tagline, ctaLabel, ctaHref, heroImage, heroAlt, scrollHint }: HeroProps) {
  return (
    <>
      <Style />
      <section className="dk-section" style={{ padding: 0, minHeight: "85vh", position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", overflow: "hidden" }}>
        <div style={{ padding: "60px 80px" }}>
          <p className="dk-label" style={{ marginBottom: 28 }}>{year}</p>
          <h1 className="dk-display" style={{ fontSize: "clamp(56px, 8vw, 110px)", margin: 0, color: "#f5efe6" }}>
            {titleLine1}<br/><em style={{ fontStyle: "italic", color: "#c9a96e" }}>{titleLine2}</em>
          </h1>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24, marginBottom: 40, maxWidth: 380 }}>{tagline}</p>
          <a href={ctaHref || "#"} style={{ display: "inline-block", padding: "16px 36px", border: "1px solid #c9a96e", color: "#c9a96e", textDecoration: "none", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>{ctaLabel}</a>
        </div>
        <div style={{ height: "85vh", overflow: "hidden", background: "#1a1a1a" }}>
          {heroImage && <img src={heroImage} alt={heroAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        {scrollHint && <div style={{ position: "absolute", bottom: 24, left: 80, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "#666" }}>↓ {scrollHint}</div>}
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// NU PÅGÅR
// ────────────────────────────────────────────────────────────────────
export interface NuPagarProps { enabled: boolean; label: string; title: string; ctaLabel: string; ctaHref: string; meta: { key: string; val: string }[] }
export function NuPagar({ enabled, label, title, ctaLabel, ctaHref, meta }: NuPagarProps) {
  if (!enabled) return <div style={{ background: "#111", color: "#666", padding: 16, textAlign: "center", fontSize: 12 }}>(Nu pågår-banner avstängd — visas inte på sajten)</div>;
  return (
    <>
      <Style />
      <div style={{ background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)", borderTop: "1px solid #c9a96e33", borderBottom: "1px solid #c9a96e33", padding: "28px 80px", display: "flex", alignItems: "center", gap: 48, fontFamily: "'Manrope', sans-serif", color: "#f5efe6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a96e", animation: "pulse 2s infinite" }}></span>
          <span className="dk-label">{label}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, marginBottom: 6 }}>{title}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: "#8a8a8a" }}>
            {(meta || []).map((m, i) => <span key={i}><strong style={{ color: "#c9a96e", marginRight: 6 }}>{m.key}:</strong>{m.val}</span>)}
          </div>
        </div>
        <a href={ctaHref || "#"} style={{ color: "#c9a96e", textDecoration: "none", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>{ctaLabel} →</a>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// PORTFOLIO
// ────────────────────────────────────────────────────────────────────
export interface PortfolioProps {
  filters: string[];
  rows: { class: string; items: { image: string; alt: string; category: string; title: string; caption: string }[] }[];
}
export function Portfolio({ filters, rows }: PortfolioProps) {
  return (
    <>
      <Style />
      <section className="dk-section">
        <div className="dk-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 60 }}>
            <div>
              <p className="dk-label" style={{ marginBottom: 16 }}>Portfolio</p>
              <h2 className="dk-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0 }}>Utvalda<br/><em>Verk</em></h2>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              {(filters || []).map((f, i) => <button key={i} style={{ background: "none", border: "1px solid #333", color: i === 0 ? "#c9a96e" : "#888", padding: "8px 16px", cursor: "pointer" }}>{f}</button>)}
            </div>
          </div>
          {(rows || []).map((row, i) => (
            <div key={i} style={{ display: "grid", gap: 24, marginBottom: 24, gridTemplateColumns: row.class === "gallery-row-1" ? "2fr 1fr 1fr" : row.class === "gallery-row-3" ? "1fr 2fr 1fr" : "1fr 1fr 1fr" }}>
              {row.items.map((it, j) => (
                <div key={j} style={{ position: "relative", overflow: "hidden", aspectRatio: row.class === "gallery-row-1" && j === 0 ? "16/10" : "1" }}>
                  {it.image ? <img src={it.image} alt={it.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ background: "#222", height: "100%" }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 60%, rgba(0,0,0,0.85))", display: "flex", flexDirection: "column", justifyContent: "end", padding: 24 }}>
                    <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: "#f5efe6", margin: 0 }}>{it.title}</h3>
                    <p style={{ fontSize: 11, color: "#c9a96e", margin: "4px 0 0", letterSpacing: "0.1em" }}>{it.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// ABOUT
// ────────────────────────────────────────────────────────────────────
export interface AboutProps {
  sectionLabel: string; titleHtml: string; portrait: string; portraitAlt: string; portraitLabel: string;
  paragraphs: string[]; stats: { number: string; label: string }[];
}
export function About({ sectionLabel, titleHtml, portrait, portraitAlt, portraitLabel, paragraphs, stats }: AboutProps) {
  return (
    <>
      <Style />
      <section className="dk-section" style={{ background: "#0d0d0d" }}>
        <div className="dk-container" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 80, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", border: "1px solid #c9a96e33" }}>
              {portrait ? <img src={portrait} alt={portraitAlt} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} /> : <div style={{ background: "#222", height: "100%" }} />}
            </div>
            {portraitLabel && <p style={{ marginTop: 16, fontSize: 11, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase" }}>{portraitLabel}</p>}
          </div>
          <div>
            <p className="dk-label" style={{ marginBottom: 24 }}>{sectionLabel}</p>
            <h2 className="dk-display" style={{ fontSize: "clamp(36px, 4vw, 56px)", margin: "0 0 32px" }} dangerouslySetInnerHTML={{ __html: titleHtml }} />
            {(paragraphs || []).map((p, i) => <p key={i} style={{ fontSize: 16, lineHeight: 1.7, color: "#c8c0b3", marginBottom: 20 }}>{p}</p>)}
            <div style={{ display: "flex", gap: 48, marginTop: 40, paddingTop: 32, borderTop: "1px solid #2a2a2a" }}>
              {(stats || []).map((s, i) => (
                <div key={i}>
                  <div className="dk-display" style={{ fontSize: 48, color: "#c9a96e" }}>{s.number}</div>
                  <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// GALLERY HEADING (verken kommer från art_works på sajten)
// ────────────────────────────────────────────────────────────────────
export interface GalleryHeadingProps { sectionLabel: string; heading: string; introQuote: string; introSub: string; }
export function GalleryHeading({ sectionLabel, heading, introQuote, introSub }: GalleryHeadingProps) {
  return (
    <>
      <Style />
      <section className="dk-section">
        <div className="dk-container">
          <p className="dk-label" style={{ marginBottom: 16 }}>{sectionLabel}</p>
          <h2 className="dk-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0 }}>{heading}</h2>
          {introQuote && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 32, maxWidth: 720 }}>{introQuote}</p>}
          {introSub && <p style={{ fontSize: 14, color: "#888", marginTop: 12, maxWidth: 640 }}>{introSub}</p>}
          <div style={{ marginTop: 40, padding: 24, border: "1px dashed #333", color: "#666", textAlign: "center", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ↓ Verken hämtas automatiskt från Verk-fliken (32 verk just nu)
          </div>
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// EXHIBITIONS HEADING (utställningarna kommer från art_exhibitions)
// ────────────────────────────────────────────────────────────────────
export interface ExhibitionsHeadingProps { sectionLabel: string; heading: string; }
export function ExhibitionsHeading({ sectionLabel, heading }: ExhibitionsHeadingProps) {
  return (
    <>
      <Style />
      <section className="dk-section" style={{ background: "#0d0d0d" }}>
        <div className="dk-container">
          <p className="dk-label" style={{ marginBottom: 16 }}>{sectionLabel}</p>
          <h2 className="dk-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0 }}>{heading}</h2>
          <div style={{ marginTop: 40, padding: 24, border: "1px dashed #333", color: "#666", textAlign: "center", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ↓ Utställningarna hämtas automatiskt från Utställningar-fliken (16 just nu)
          </div>
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// CONTACT
// ────────────────────────────────────────────────────────────────────
export interface ContactProps {
  heading: string; subheading: string; email: string; phone: string; address: string;
  social: { href: string; label: string }[];
}
export function Contact({ heading, subheading, email, phone, address, social }: ContactProps) {
  return (
    <>
      <Style />
      <section className="dk-section" style={{ textAlign: "center" }}>
        <div className="dk-container" style={{ maxWidth: 720 }}>
          <h2 className="dk-display" style={{ fontSize: "clamp(40px, 5vw, 64px)", margin: 0 }} dangerouslySetInnerHTML={{ __html: heading }} />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, color: "#a8a8a8", marginTop: 24 }}>{subheading}</p>
          <a href={`mailto:${email}`} style={{ display: "block", fontSize: 22, color: "#c9a96e", marginTop: 40, textDecoration: "none", fontFamily: "'Cormorant Garamond', serif" }}>{email}</a>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 18, color: "#888", marginTop: 14 }}>{phone}</p>
          <p style={{ fontSize: 11, color: "#666", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8 }}>{address}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 48 }}>
            {(social || []).map((s, i) => <a key={i} href={s.href} style={{ color: "#888", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none" }}>{s.label}</a>)}
          </div>
        </div>
      </section>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// FOOTER
// ────────────────────────────────────────────────────────────────────
export interface FooterProps { copyright: string; logo: string; location: string; }
export function Footer({ copyright, logo, location }: FooterProps) {
  return (
    <>
      <Style />
      <footer style={{ background: "#000", padding: "32px 80px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif" }}>
        <span>{copyright}</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "#c9a96e", letterSpacing: "0.2em" }}>{logo}</span>
        <span>{location}</span>
      </footer>
    </>
  );
}
