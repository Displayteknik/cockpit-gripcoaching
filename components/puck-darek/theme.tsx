"use client";

// Darek-stilade Puck-komponenter — luxury minimal (Cormorant/Manrope, svart/guld)
// Inspirerad av template.html på darekuhrberg.se

import React from "react";

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Manrope:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">`;

const STYLES = `
  .dk-root { font-family: 'Manrope', system-ui, -apple-system, sans-serif; color: #f5efe6; --gold: #c9a96e; --gold-light: #dfc08a; --bg: #080808; --near-black: #0f0f0f; --bg-alt: #0d0d0d; --muted: #8a8a8a; --line: #2a2a2a; }
  .dk-display { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; line-height: 1.05; letter-spacing: -0.01em; }
  .dk-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: var(--gold); font-weight: 500; }
  .dk-italic { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
  .dk-container { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .dk-btn { display: inline-block; padding: 16px 36px; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; text-decoration: none; transition: all 0.3s ease; cursor: pointer; }
  .dk-btn-outline { border: 1px solid var(--gold); color: var(--gold); background: transparent; }
  .dk-btn-outline:hover { background: var(--gold); color: #0a0a0a; }
  .dk-btn-solid { background: var(--gold); color: #0a0a0a; border: 1px solid var(--gold); }
  .dk-btn-ghost { color: var(--gold); border: 1px solid transparent; }
  /* btn-primary slide-in hover (matchar darekuhrberg.se) — endast om innehåll finns */
  .dk-btn-outline:not(:empty) { position: relative; overflow: hidden; transition: color 0.3s; }
  .dk-btn-outline:not(:empty)::before { content: ''; position: absolute; inset: 0; background: var(--gold); transform: translateX(-100%); transition: transform 0.4s ease; z-index: 0; }
  .dk-btn-outline:not(:empty):hover { color: #0a0a0a !important; }
  .dk-btn-outline:not(:empty):hover::before { transform: translateX(0); }
  .dk-btn-outline:not(:empty) > * { position: relative; z-index: 1; }
  .dk-btn-outline:empty { display: none !important; }
  /* Portfolio hover-scale */
  .dk-portfolio-item img { transition: transform 0.6s ease; }
  .dk-portfolio-item:hover img { transform: scale(1.06); }
  /* About DARE bakgrundselement */
  .dk-about-bg { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: clamp(180px, 25vw, 360px); color: transparent; -webkit-text-stroke: 1px rgba(201,169,110,0.06); text-stroke: 1px rgba(201,169,110,0.06); pointer-events: none; user-select: none; line-height: 1; letter-spacing: -0.05em; z-index: 0; }
  /* NuPagar pulse */
  @keyframes dk-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
  .dk-pulse-dot { animation: dk-pulse 2s ease-in-out infinite; }
  /* Hero slowZoom + frame + gradient overlay + slideshow */
  @keyframes dk-slow-zoom { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  .dk-hero-img-wrap { position: relative; overflow: hidden; border: 1px solid rgba(201,169,110,0.18); }
  .dk-hero-img-wrap::before { content: ''; position: absolute; inset: 16px; border: 1px solid rgba(201,169,110,0.12); pointer-events: none; z-index: 2; }
  .dk-hero-img-wrap::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to right, transparent 55%, rgba(10,10,10,0.65)); pointer-events: none; z-index: 1; }
  .dk-hero-slide { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 1.2s ease-in-out; animation: dk-slow-zoom 12s ease-in-out infinite alternate; }
  .dk-hero-slide.active { opacity: 1; }
  /* Scroll-hint */
  @keyframes dk-scroll-line { 0% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } 50.01% { transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }
  .dk-scroll-hint { position: absolute; bottom: 48px; left: 80px; z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .dk-scroll-line { width: 1px; height: 60px; background: rgba(201,169,110,0.5); transform-origin: top; animation: dk-scroll-line 2.4s ease-in-out infinite; }
  .dk-scroll-text { font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245,239,230,0.5); font-family: 'Manrope', sans-serif; writing-mode: vertical-rl; transform: rotate(180deg); }
  /* Cinzel for exhibitions */
  .dk-cinzel { font-family: 'Cinzel', serif; letter-spacing: 0.4em; }
  /* Scroll-trigger reveal — alltid synligt som default. JS taggar med dk-prep för att gömma tillfälligt och fade-in. */
  .dk-reveal { transition: opacity 0.9s ease-out, transform 0.9s ease-out; }
  .dk-reveal.dk-prep { opacity: 0; transform: translateY(24px); }
  .dk-reveal.dk-visible { opacity: 1; transform: translateY(0); }
  /* Contact form corners */
  .dk-corner { position: absolute; width: 24px; height: 24px; border-color: var(--gold); border-style: solid; pointer-events: none; }
  .dk-corner-tr { top: -1px; right: -1px; border-width: 1px 1px 0 0; }
  .dk-corner-bl { bottom: -1px; left: -1px; border-width: 0 0 1px 1px; }
`;

let injected = false;
function ensureStyles() {
  if (typeof document === "undefined" || injected) return;
  injected = true;
  document.head.insertAdjacentHTML("beforeend", FONTS);
  const s = document.createElement("style");
  s.textContent = STYLES;
  document.head.appendChild(s);
}

export function StyleHost({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") ensureStyles();
  return (
    <div className="dk-root">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION — container med bg, padding, max-width
// ════════════════════════════════════════════════════════════
export interface SectionProps {
  background: "dark" | "darker" | "transparent" | "image";
  backgroundImage?: string;
  paddingY: "sm" | "md" | "lg" | "xl";
  align: "left" | "center";
  maxWidth: "narrow" | "medium" | "wide" | "full";
  children?: React.ReactNode;
  puck?: { renderDropZone?: (opts: { zone: string }) => React.ReactNode };
}
export function Section({ background, backgroundImage, paddingY, align, maxWidth, puck }: SectionProps) {
  const bgMap = { dark: "#0a0a0a", darker: "#0d0d0d", transparent: "transparent", image: "#0a0a0a" };
  const padMap = { sm: "40px", md: "80px", lg: "120px", xl: "160px" };
  const widthMap = { narrow: 640, medium: 880, wide: 1180, full: undefined } as const;
  const w = widthMap[maxWidth];
  return (
    <StyleHost>
      <section style={{
        background: bgMap[background],
        backgroundImage: background === "image" && backgroundImage ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${backgroundImage})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        padding: `${padMap[paddingY]} 24px`,
        textAlign: align as React.CSSProperties["textAlign"],
      }}>
        <div style={{ maxWidth: w ? `${w}px` : "100%", margin: "0 auto" }}>
          {puck?.renderDropZone?.({ zone: "content" })}
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// HEADING — h1-h6 med Cormorant
// ════════════════════════════════════════════════════════════
export interface HeadingProps {
  text: string;
  level: "h1" | "h2" | "h3" | "h4" | "h5";
  size: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  align: "left" | "center" | "right";
  italic: boolean;
  color: "cream" | "gold" | "muted";
}
export function Heading({ text, level = "h2", size = "lg", align = "left", italic, color = "cream" }: HeadingProps) {
  const Tag = level as keyof React.JSX.IntrinsicElements;
  const sizeMap = { sm: "1.4rem", md: "2rem", lg: "2.8rem", xl: "3.6rem", "2xl": "4.8rem", "3xl": "clamp(56px, 8vw, 110px)" };
  const colorMap = { cream: "#f5efe6", gold: "#c9a96e", muted: "#8a8a8a" };
  return (
    <StyleHost>
      <Tag style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontWeight: 300,
        fontStyle: italic ? "italic" : "normal",
        fontSize: sizeMap[size],
        lineHeight: 1.05,
        letterSpacing: "-0.01em",
        color: colorMap[color],
        textAlign: align as React.CSSProperties["textAlign"],
        margin: "0 0 24px",
      }}>
        {text}
      </Tag>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// LABEL — liten gold-etikett ovanför rubrik
// ════════════════════════════════════════════════════════════
export interface LabelProps { text: string; align: "left" | "center" | "right" }
export function Label({ text, align = "left" }: LabelProps) {
  return (
    <StyleHost>
      <p style={{
        fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em",
        color: "#c9a96e", fontWeight: 500, fontFamily: "'Manrope', sans-serif",
        margin: "0 0 16px", textAlign: align as React.CSSProperties["textAlign"],
      }}>{text}</p>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// TEXT — paragraf
// ════════════════════════════════════════════════════════════
export interface TextProps {
  text: string;
  size: "sm" | "md" | "lg";
  italic: boolean;
  align: "left" | "center" | "right";
  color: "cream" | "muted" | "gold";
}
export function Text({ text, size = "md", italic, align = "left", color = "cream" }: TextProps) {
  const sizeMap = { sm: 14, md: 16, lg: 20 };
  const colorMap = { cream: "#c8c0b3", muted: "#8a8a8a", gold: "#c9a96e" };
  return (
    <StyleHost>
      <p style={{
        fontFamily: italic ? "'Cormorant Garamond', Georgia, serif" : "'Manrope', sans-serif",
        fontStyle: italic ? "italic" : "normal",
        fontSize: sizeMap[size],
        lineHeight: 1.7,
        color: colorMap[color],
        textAlign: align as React.CSSProperties["textAlign"],
        margin: "0 0 20px",
        whiteSpace: "pre-line",
      }}>{text}</p>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// BUTTON — länk med luxury styling
// ════════════════════════════════════════════════════════════
export interface ButtonProps {
  text: string;
  href: string;
  variant: "outline" | "solid" | "ghost";
  align: "left" | "center" | "right";
}
export function Button({ text, href, variant = "outline", align = "left" }: ButtonProps) {
  const cls = variant === "outline" ? "dk-btn dk-btn-outline" : variant === "solid" ? "dk-btn dk-btn-solid" : "dk-btn dk-btn-ghost";
  return (
    <StyleHost>
      <div style={{ textAlign: align as React.CSSProperties["textAlign"], margin: "16px 0" }}>
        <a href={href || "#"} className={cls}>{text}</a>
      </div>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// IMAGE — bild med valfri caption
// ════════════════════════════════════════════════════════════
export interface ImageProps {
  src: string;
  alt: string;
  caption: string;
  ratio: "square" | "landscape" | "portrait" | "auto";
  rounded: boolean;
}
export function Image({ src, alt, caption, ratio = "auto", rounded }: ImageProps) {
  const ratioMap = { square: "1/1", landscape: "16/9", portrait: "3/4", auto: "auto" };
  return (
    <StyleHost>
      <figure style={{ margin: "16px 0" }}>
        {src ? (
          <img src={src} alt={alt} style={{
            width: "100%",
            aspectRatio: ratioMap[ratio],
            objectFit: "cover",
            borderRadius: rounded ? 8 : 0,
            display: "block",
          }} />
        ) : (
          <div style={{ width: "100%", aspectRatio: ratioMap[ratio] !== "auto" ? ratioMap[ratio] : "16/9", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: 12 }}>
            (Ingen bild)
          </div>
        )}
        {caption && <figcaption style={{ marginTop: 12, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#888", fontFamily: "'Manrope', sans-serif" }}>{caption}</figcaption>}
      </figure>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// SPACER — vertikal höjd
// ════════════════════════════════════════════════════════════
export interface SpacerProps { height: number }
export function Spacer({ height = 40 }: SpacerProps) {
  return <div style={{ height: `${height}px` }} />;
}

// ════════════════════════════════════════════════════════════
// TWO COLUMN — bild + text side-by-side
// ════════════════════════════════════════════════════════════
export interface TwoColumnProps {
  image: string;
  imageAlt: string;
  imagePosition: "left" | "right";
  label: string;
  heading: string;
  headingItalic: boolean;
  body: string;
  ctaText: string;
  ctaHref: string;
}
export function TwoColumn({ image, imageAlt, imagePosition = "left", label, heading, headingItalic, body, ctaText, ctaHref }: TwoColumnProps) {
  const imgEl = (
    <div style={{ position: "relative", aspectRatio: "3/4" }}>
      <div style={{ position: "absolute", top: -16, right: -16, bottom: 16, left: 16, border: "1px solid rgba(201,169,110,0.25)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", border: "1px solid #2a2a2a", zIndex: 1 }}>
        {image ? <img src={image} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ background: "#1a1a1a", height: "100%" }} />}
      </div>
    </div>
  );
  const textEl = (
    <div>
      {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 24, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
      {heading && <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontStyle: headingItalic ? "italic" : "normal", fontSize: "clamp(36px, 4vw, 56px)", color: "#f5efe6", margin: "0 0 32px", lineHeight: 1.05 }}>{heading}</h2>}
      {body && <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, lineHeight: 1.7, color: "#c8c0b3", whiteSpace: "pre-line", margin: "0 0 24px" }}>{body}</p>}
      {String(ctaText || "").trim() && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline"><span>{ctaText}</span></a>}
    </div>
  );
  return (
    <StyleHost>
      <section style={{ background: "#000", padding: "120px 24px", position: "relative", overflow: "hidden" }}>
        <div className="dk-about-bg">DARE</div>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 96, alignItems: "center", position: "relative", zIndex: 1 }}>
          {imagePosition === "left" ? <>{imgEl}{textEl}</> : <>{textEl}{imgEl}</>}
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// STATS — siffror + etiketter (3-4 kolumner)
// ════════════════════════════════════════════════════════════
export interface StatsProps {
  items: { number: string; label: string }[];
  align: "left" | "center";
}
export function Stats({ items, align = "left" }: StatsProps) {
  return (
    <StyleHost>
      <div style={{ display: "flex", gap: 48, justifyContent: align === "center" ? "center" : "flex-start", margin: "32px 0", paddingTop: 32, borderTop: "1px solid #2a2a2a" }}>
        {(items || []).map((s, i) => (
          <div key={i}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, color: "#c9a96e", lineHeight: 1, fontWeight: 300 }}>{s.number}</div>
            <div style={{ fontSize: 11, color: "#888", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 8, fontFamily: "'Manrope', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// NAV — toppmeny (DAREK UHRBERG-logo + 5 länkar)
// ════════════════════════════════════════════════════════════
export interface NavProps {
  logoText: string;
  links: { label: string; href: string }[];
}
export function Nav({ logoText, links }: NavProps) {
  return (
    <StyleHost>
      <nav style={{ background: "#0a0a0a", padding: "24px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1a1a1a", fontFamily: "'Manrope', sans-serif" }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 18, letterSpacing: "0.3em", color: "#f5efe6", textDecoration: "none" }}>{logoText}</a>
        <div style={{ display: "flex", gap: 40, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#a8a8a8" }}>
          {(links || []).map((l, i) => <a key={i} href={l.href} style={{ color: "inherit", textDecoration: "none", transition: "color 0.3s" }}>{l.label}</a>)}
        </div>
      </nav>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// NU PÅGÅR — banner med pågående utställning
// ════════════════════════════════════════════════════════════
export interface NuPagarProps {
  enabled: boolean;
  label: string;
  title: string;
  ctaText: string;
  ctaHref: string;
  meta: { key: string; val: string }[];
}
export function NuPagar({ enabled, label, title, ctaText, ctaHref, meta }: NuPagarProps) {
  if (!enabled) return <div style={{ padding: 16, textAlign: "center", fontSize: 11, color: "#666", background: "#0a0a0a", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif" }}>(Nu pågår-banner avstängd — visas inte på sajten)</div>;
  return (
    <StyleHost>
      <div style={{ background: "linear-gradient(135deg, #1a1a1a, #0a0a0a)", borderTop: "1px solid rgba(201,169,110,0.2)", borderBottom: "1px solid rgba(201,169,110,0.2)", padding: "28px clamp(24px, 6vw, 80px)", display: "flex", alignItems: "center", gap: 48, fontFamily: "'Manrope', sans-serif", color: "#f5efe6", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="dk-pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a96e", flexShrink: 0 }}></span>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", fontWeight: 500 }}>{label}</span>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, marginBottom: 8, color: "#f5efe6" }}>{title}</div>
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: "#8a8a8a", flexWrap: "wrap" }}>
            {(meta || []).map((m, i) => <span key={i}><strong style={{ color: "#c9a96e", marginRight: 6 }}>{m.key}:</strong>{m.val}</span>)}
          </div>
        </div>
        {ctaText && <a href={ctaHref || "#"} style={{ color: "#c9a96e", textDecoration: "none", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif" }}>{ctaText} →</a>}
      </div>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// CONTACT — kontaktformulär luxury minimal
// ════════════════════════════════════════════════════════════
export interface ContactProps {
  heading: string;
  headingItalic: string;
  subheading: string;
  email: string;
  phone: string;
  address: string;
  showForm: boolean;
  formSubjects: { value: string; label: string }[];
  social: { label: string; href: string }[];
}
export function Contact({ heading, headingItalic, subheading, email, phone, address, showForm = true, formSubjects, social }: ContactProps) {
  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,169,110,0.15)", color: "#f5efe6",
    padding: "14px 16px", fontSize: 14, fontFamily: "'Manrope', sans-serif", outline: "none", marginTop: 8,
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9a96e", fontFamily: "'Manrope', sans-serif" };
  return (
    <StyleHost>
      <section style={{ background: "#0a0a0a", padding: "120px 24px", textAlign: "center", color: "#f5efe6", position: "relative" }}>
        <div className="dk-reveal" style={{ width: 12, height: 12, borderRadius: "50%", border: "1px solid #c9a96e", margin: "0 auto 32px", display: "block" }}></div>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 className="dk-reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(48px, 6vw, 72px)", lineHeight: 1.05, color: "#f5efe6", margin: 0 }}>
            {heading}{headingItalic && <><br/><em style={{ fontStyle: "italic", color: "#dfc08a", fontWeight: 300 }}>{headingItalic}</em></>}
          </h2>
          {subheading && <p className="dk-reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, color: "#a8a8a8", marginTop: 32 }}>{subheading}</p>}
          {email && <a className="dk-reveal" href={`mailto:${email}`} style={{ display: "inline-block", fontSize: 18, color: "#c9a96e", marginTop: 48, textDecoration: "none", borderBottom: "1px solid rgba(201,169,110,0.4)", paddingBottom: 6, fontFamily: "'Cinzel', serif", letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 400 }}>{email}</a>}
          {phone && <p className="dk-reveal" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24 }}>{phone}</p>}
          {address && <p className="dk-reveal" style={{ fontSize: 11, color: "#888", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 12, fontFamily: "'Manrope', sans-serif" }}>{address}</p>}

          {showForm && (
            <form className="dk-reveal" name="kontakt" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/tack.html" style={{ position: "relative", marginTop: 64, padding: 40, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(201,169,110,0.12)", textAlign: "left" }}>
              <span className="dk-corner dk-corner-tr"></span>
              <span className="dk-corner dk-corner-bl"></span>
              <input type="hidden" name="form-name" value="kontakt" />
              <input type="hidden" name="bot-field" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle} htmlFor="cf-name">Namn</label>
                  <input id="cf-name" name="name" type="text" placeholder="Ditt namn" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="cf-email">E-post</label>
                  <input id="cf-email" name="email" type="email" placeholder="din@mail.se" required style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="cf-subject">Ämne</label>
                <select id="cf-subject" name="subject" style={inputStyle}>
                  <option value="">Välj ämne...</option>
                  {(formSubjects || []).map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle} htmlFor="cf-message">Meddelande</label>
                <textarea id="cf-message" name="message" placeholder="Skriv ditt meddelande..." required rows={5} style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} />
              </div>
              <button type="submit" className="dk-btn dk-btn-outline" style={{ width: "100%", padding: "16px", justifyContent: "center", background: "transparent", color: "#c9a96e", border: "1px solid #c9a96e", fontFamily: "'Manrope', sans-serif", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 11, cursor: "pointer" }}><span>Skicka meddelande</span></button>
            </form>
          )}

          {social && social.length > 0 && (
            <div className="dk-reveal" style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 48 }}>
              {social.map((s, i) => <a key={i} href={s.href} target="_blank" rel="noreferrer" style={{ color: "#888", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", fontFamily: "'Manrope', sans-serif", transition: "color 0.3s" }}>{s.label}</a>)}
            </div>
          )}
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// FOOTER — copyright + logo + plats
// ════════════════════════════════════════════════════════════
export interface FooterProps { copyright: string; logo: string; location: string; }
export function Footer({ copyright, logo, location }: FooterProps) {
  return (
    <StyleHost>
      <footer style={{ background: "#0f0f0f", padding: "32px clamp(24px, 6vw, 80px)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif", flexWrap: "wrap", gap: 20 }}>
        <span>{copyright}</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "#c9a96e", letterSpacing: "0.2em" }}>{logo}</span>
        <span>{location}</span>
      </footer>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// GALLERY SECTION — Konst till salu (label + heading + intro + filter-knappar)
// Verken auto-renderas på publika sajten från art_works
// ════════════════════════════════════════════════════════════
export interface GallerySectionProps {
  label: string;
  heading: string;
  introQuote: string;
  introSub: string;
  filters: { value: string }[];
}
export function GallerySection({ label, heading, introQuote, introSub, filters }: GallerySectionProps) {
  return (
    <StyleHost>
      <section style={{ background: "#0a0a0a", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <span style={{ width: 48, height: 1, background: "#c9a96e" }}></span>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", fontFamily: "'Manrope', sans-serif", margin: 0 }}>{label}</p>
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.05, color: "#f5efe6", margin: "0 0 32px" }}>{heading}</h2>
          {introQuote && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#f5efe6", margin: "0 0 12px", maxWidth: 720, lineHeight: 1.4 }}>{introQuote}</p>}
          {introSub && <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, color: "#888", margin: "0 0 48px", maxWidth: 640, lineHeight: 1.6 }}>{introSub}</p>}
          {filters && filters.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
              {filters.map((f, i) => (
                <button key={i} style={{ background: i === 0 ? "rgba(201,169,110,0.08)" : "transparent", border: i === 0 ? "1px solid rgba(201,169,110,0.5)" : "1px solid #2a2a2a", color: i === 0 ? "#c9a96e" : "#888", padding: "12px 24px", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif", cursor: "pointer", transition: "all 0.3s" }}>{f.value}</button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 24, padding: 32, border: "1px dashed #2a2a2a", color: "#666", textAlign: "center", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif" }}>
            ↓ Verken hämtas automatiskt från Verk-fliken på publicerad sajt
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// EXHIBITIONS SECTION — CV-rubrik med år-grupper (data auto från art_exhibitions)
// ════════════════════════════════════════════════════════════
export interface ExhibitionsSectionProps {
  label: string;
  heading: string;
  previewYears: { year: string; sample: string }[];
}
export function ExhibitionsSection({ label, heading, previewYears }: ExhibitionsSectionProps) {
  return (
    <StyleHost>
      <section style={{ background: "#0a0a0a", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <span style={{ width: 48, height: 1, background: "#c9a96e" }}></span>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", fontFamily: "'Manrope', sans-serif", margin: 0 }}>{label}</p>
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.05, color: "#f5efe6", margin: "0 0 64px" }}>{heading}</h2>
          {(previewYears || []).map((y, i) => (
            <div key={i} style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32, paddingBottom: 16, borderBottom: "1px solid #2a2a2a" }}>
                <span className="dk-cinzel" style={{ fontSize: 18, color: "#dfc08a", fontWeight: 500 }}>{y.year}</span>
                <span style={{ flex: 1, height: 1, background: "rgba(201,169,110,0.15)" }}></span>
              </div>
              {y.sample && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 18, color: "#888", margin: 0 }}>{y.sample}</p>}
            </div>
          ))}
          <div style={{ marginTop: 24, padding: 32, border: "1px dashed #2a2a2a", color: "#666", textAlign: "center", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif" }}>
            ↓ Utställningarna hämtas automatiskt från Utställningar-fliken på publicerad sajt
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// PORTFOLIO — utvalda verk i 3 rader (luxury minimal)
// ════════════════════════════════════════════════════════════
export interface PortfolioItem { image: string; alt: string; title: string; caption: string; category: string }
export interface PortfolioRow { layout: "big-2small" | "3equal" | "small-big-small"; items: PortfolioItem[] }
export interface PortfolioProps {
  label: string;
  heading: string;
  headingItalic: string;
  filters: { value: string }[];
  rows: PortfolioRow[];
}
export function Portfolio({ label, heading, headingItalic, filters, rows }: PortfolioProps) {
  const layoutMap = { "big-2small": "2fr 1fr 1fr", "3equal": "1fr 1fr 1fr", "small-big-small": "1fr 2fr 1fr" } as const;
  return (
    <StyleHost>
      <section style={{ background: "#0a0a0a", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div className="dk-reveal" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 60, gap: 40, flexWrap: "wrap" }}>
            <div>
              {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 16, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.05, color: "#f5efe6", margin: 0 }}>
                {heading}{headingItalic && <><br/><em style={{ color: "#c9a96e", fontStyle: "italic" }}>{headingItalic}</em></>}
              </h2>
            </div>
            {filters && filters.length > 0 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {filters.map((f, i) => (
                  <button key={i} style={{ background: i === 0 ? "rgba(201,169,110,0.08)" : "transparent", border: i === 0 ? "1px solid rgba(201,169,110,0.5)" : "1px solid #2a2a2a", color: i === 0 ? "#c9a96e" : "#888", padding: "12px 24px", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif", cursor: "pointer", transition: "all 0.3s" }}>{f.value}</button>
                ))}
              </div>
            )}
          </div>
          {(rows || []).map((row, i) => (
            <div key={i} className="dk-reveal" style={{ display: "grid", gap: 24, marginBottom: 24, gridTemplateColumns: layoutMap[row.layout || "3equal"] }}>
              {(row.items || []).map((it, j) => (
                <div key={j} className="dk-portfolio-item" style={{ position: "relative", overflow: "hidden", aspectRatio: row.layout === "big-2small" && j === 0 ? "16/10" : "1", background: "#1a1a1a", cursor: "pointer" }}>
                  {it.image && <img src={it.image} alt={it.alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 55%, rgba(10,10,10,0.92))", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 24 }}>
                    <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 400, fontSize: 22, color: "#f5efe6", margin: 0, lineHeight: 1.2 }}>{it.title}</h3>
                    {it.caption && <p style={{ fontSize: 11, color: "#c9a96e", margin: "6px 0 0", letterSpacing: "0.1em", fontFamily: "'Manrope', sans-serif" }}>{it.caption}</p>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </StyleHost>
  );
}

// ════════════════════════════════════════════════════════════
// HERO — full-bredd hero med titel, tagline, CTA, hero-bild
// ════════════════════════════════════════════════════════════
export interface HeroProps {
  label: string;
  titleLine1: string;
  titleLine2: string;
  tagline: string;
  ctaText: string;
  ctaHref: string;
  heroImage: string;
  heroAlt: string;
  slideshow: { image: string }[];
  layout: "split" | "fullbleed";
}

const SLIDESHOW_SCRIPT = `
(function(){
  var wraps = document.querySelectorAll('.dk-hero-img-wrap[data-slideshow="1"]');
  wraps.forEach(function(w){
    var slides = w.querySelectorAll('.dk-hero-slide');
    if (slides.length < 2) return;
    var i = 0;
    setInterval(function(){
      slides[i].classList.remove('active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('active');
    }, 5000);
  });
})();
`;

export function Hero({ label, titleLine1, titleLine2, tagline, ctaText, ctaHref, heroImage, heroAlt, slideshow, layout = "split" }: HeroProps) {
  const slides = (slideshow && slideshow.length > 0 ? slideshow.map(s => s.image).filter(Boolean) : (heroImage ? [heroImage] : []));
  const renderSlides = () => slides.map((src, i) => (
    <img key={i} className={`dk-hero-slide ${i === 0 ? "active" : ""}`} src={src} alt={i === 0 ? heroAlt : ""} />
  ));
  if (layout === "fullbleed") {
    return (
      <StyleHost>
        <section className="dk-hero-img-wrap" data-slideshow={slides.length > 1 ? "1" : "0"} style={{ position: "relative", minHeight: "70vh", display: "flex", alignItems: "center", color: "#f5efe6", background: "#0a0a0a" }}>
          {renderSlides()}
          <div style={{ position: "relative", zIndex: 3, maxWidth: 1180, margin: "0 auto", padding: "80px 24px", width: "100%" }}>
            {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 28, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(56px, 8vw, 110px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "#f5efe6", margin: 0 }}>
              {titleLine1}{titleLine2 && <><br/><em style={{ color: "#c9a96e" }}>{titleLine2}</em></>}
            </h1>
            {tagline && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24, marginBottom: 40, maxWidth: 480 }}>{tagline}</p>}
            {String(ctaText || "").trim() && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline"><span>{ctaText}</span></a>}
          </div>
{/* slideshow drivs av klient-script i window-listener nedan */}
        </section>
      </StyleHost>
    );
  }
  return (
    <StyleHost>
      <section style={{ minHeight: "85vh", background: "#0a0a0a", color: "#f5efe6", display: "grid", gridTemplateColumns: "1.05fr 1fr", alignItems: "center", position: "relative" }}>
        <div className="dk-hero-img-wrap" data-slideshow={slides.length > 1 ? "1" : "0"} style={{ minHeight: "85vh", background: "#1a1a1a", position: "relative" }}>
          {renderSlides()}
{/* slideshow rotation drivs av klient-script i window-listener nedan */}
        </div>
        <div style={{ padding: "60px 80px" }}>
          {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 28, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(56px, 8vw, 110px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "#f5efe6", margin: 0 }}>
            {titleLine1}{titleLine2 && <><br/><em style={{ color: "#dfc08a", fontStyle: "italic" }}>{titleLine2}</em></>}
          </h1>
          {tagline && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24, marginBottom: 40, maxWidth: 380 }}>{tagline}</p>}
          {String(ctaText || "").trim() && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline"><span>{ctaText}</span></a>}
        </div>
        <div className="dk-scroll-hint" style={{ left: "50%", right: "auto", transform: "translateX(-50%)" }}>
          <span className="dk-scroll-line"></span>
          <span className="dk-scroll-text">Scrolla</span>
        </div>
      </section>
    </StyleHost>
  );
}

// Klient-side: slideshow-rotation + scroll-reveal-observer
if (typeof window !== "undefined") {
  const setupSlideshow = () => {
    document.querySelectorAll('.dk-hero-img-wrap[data-slideshow="1"]').forEach((wrap) => {
      const slides = wrap.querySelectorAll('.dk-hero-slide');
      if (slides.length < 2) return;
      const w = wrap as HTMLElement;
      if ((w as any).__dkInit) return;
      (w as any).__dkInit = true;
      let i = 0;
      setInterval(() => {
        slides[i].classList.remove("active");
        i = (i + 1) % slides.length;
        slides[i].classList.add("active");
      }, 5000);
    });
  };

  const setupReveal = (doc: Document) => {
    if (!("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("dk-visible"); });
    }, { threshold: 0.12, rootMargin: "0px 0px -50px 0px" });
    doc.querySelectorAll(".dk-reveal:not(.dk-prep):not(.dk-visible)").forEach((el) => {
      // Bara aktivera reveal-animation på publik sajt (inte i Puck-editor-iframe)
      const isInPuckEditor = !!doc.querySelector("[data-puck-component]");
      if (isInPuckEditor) { el.classList.add("dk-visible"); return; }
      el.classList.add("dk-prep");
      obs.observe(el);
    });
  };

  const tick = () => {
    setupSlideshow();
    setupReveal(document);
    document.querySelectorAll("iframe").forEach((f) => {
      try { if (f.contentDocument) setupReveal(f.contentDocument); } catch { /* cross-origin */ }
    });
  };
  setInterval(tick, 1500);
}
