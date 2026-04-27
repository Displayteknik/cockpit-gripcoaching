"use client";

// Darek-stilade Puck-komponenter — luxury minimal (Cormorant/Manrope, svart/guld)
// Inspirerad av template.html på darekuhrberg.se

import React from "react";

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=Manrope:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet">`;

const STYLES = `
  .dk-root { font-family: 'Manrope', system-ui, -apple-system, sans-serif; color: #f5efe6; --gold: #c9a96e; --gold-light: #d4ba80; --bg: #0a0a0a; --bg-alt: #0d0d0d; --muted: #8a8a8a; --line: #2a2a2a; }
  .dk-display { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 300; line-height: 1.05; letter-spacing: -0.01em; }
  .dk-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: var(--gold); font-weight: 500; }
  .dk-italic { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; }
  .dk-container { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  .dk-btn { display: inline-block; padding: 16px 36px; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; text-decoration: none; transition: all 0.3s ease; cursor: pointer; }
  .dk-btn-outline { border: 1px solid var(--gold); color: var(--gold); background: transparent; }
  .dk-btn-outline:hover { background: var(--gold); color: #0a0a0a; }
  .dk-btn-solid { background: var(--gold); color: #0a0a0a; border: 1px solid var(--gold); }
  .dk-btn-ghost { color: var(--gold); border: 1px solid transparent; }
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
  .dk-hero-slide { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 1.2s ease-in-out; animation: dk-slow-zoom 24s ease-in-out infinite; }
  .dk-hero-slide.active { opacity: 1; }
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
    <div style={{ aspectRatio: "3/4", overflow: "hidden", border: "1px solid #2a2a2a" }}>
      {image ? <img src={image} alt={imageAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ background: "#1a1a1a", height: "100%" }} />}
    </div>
  );
  const textEl = (
    <div>
      {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 24, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
      {heading && <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontStyle: headingItalic ? "italic" : "normal", fontSize: "clamp(36px, 4vw, 56px)", color: "#f5efe6", margin: "0 0 32px", lineHeight: 1.05 }}>{heading}</h2>}
      {body && <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 16, lineHeight: 1.7, color: "#c8c0b3", whiteSpace: "pre-line", margin: "0 0 24px" }}>{body}</p>}
      {ctaText && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline">{ctaText}</a>}
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
  social: { label: string; href: string }[];
}
export function Contact({ heading, headingItalic, subheading, email, phone, address, social }: ContactProps) {
  return (
    <StyleHost>
      <section style={{ background: "#0a0a0a", padding: "120px 24px", textAlign: "center", color: "#f5efe6" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.1, color: "#f5efe6", margin: 0 }}>
            {heading}{headingItalic && <><br/><em style={{ fontStyle: "italic", color: "#c9a96e" }}>{headingItalic}</em></>}
          </h2>
          {subheading && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 20, color: "#a8a8a8", marginTop: 24 }}>{subheading}</p>}
          {email && <a href={`mailto:${email}`} style={{ display: "block", fontSize: 22, color: "#c9a96e", marginTop: 40, textDecoration: "none", fontFamily: "'Cormorant Garamond', serif" }}>{email}</a>}
          {phone && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 18, color: "#888", marginTop: 14 }}>{phone}</p>}
          {address && <p style={{ fontSize: 11, color: "#666", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8, fontFamily: "'Manrope', sans-serif" }}>{address}</p>}
          {social && social.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 48 }}>
              {social.map((s, i) => <a key={i} href={s.href} style={{ color: "#888", fontSize: 12, letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none", fontFamily: "'Manrope', sans-serif" }}>{s.label}</a>)}
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
      <footer style={{ background: "#000", padding: "32px clamp(24px, 6vw, 80px)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif", flexWrap: "wrap", gap: 20 }}>
        <span>{copyright}</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "#c9a96e", letterSpacing: "0.2em" }}>{logo}</span>
        <span>{location}</span>
      </footer>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 60, gap: 40, flexWrap: "wrap" }}>
            <div>
              {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 16, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 1.05, color: "#f5efe6", margin: 0 }}>
                {heading}{headingItalic && <><br/><em style={{ color: "#c9a96e", fontStyle: "italic" }}>{headingItalic}</em></>}
              </h2>
            </div>
            {filters && filters.length > 0 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {filters.map((f, i) => (
                  <button key={i} style={{ background: "transparent", border: "1px solid #2a2a2a", color: i === 0 ? "#c9a96e" : "#888", padding: "10px 20px", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Manrope', sans-serif", cursor: "pointer" }}>{f.value}</button>
                ))}
              </div>
            )}
          </div>
          {(rows || []).map((row, i) => (
            <div key={i} style={{ display: "grid", gap: 24, marginBottom: 24, gridTemplateColumns: layoutMap[row.layout || "3equal"] }}>
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
            {ctaText && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline">{ctaText}</a>}
          </div>
          <script dangerouslySetInnerHTML={{ __html: SLIDESHOW_SCRIPT }} />
        </section>
      </StyleHost>
    );
  }
  return (
    <StyleHost>
      <section style={{ minHeight: "85vh", background: "#0a0a0a", color: "#f5efe6", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center" }}>
        <div style={{ padding: "60px 80px" }}>
          {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 28, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(56px, 8vw, 110px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "#f5efe6", margin: 0 }}>
            {titleLine1}{titleLine2 && <><br/><em style={{ color: "#c9a96e", fontStyle: "italic" }}>{titleLine2}</em></>}
          </h1>
          {tagline && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24, marginBottom: 40, maxWidth: 380 }}>{tagline}</p>}
          {ctaText && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline">{ctaText}</a>}
        </div>
        <div className="dk-hero-img-wrap" data-slideshow={slides.length > 1 ? "1" : "0"} style={{ minHeight: "85vh", background: "#1a1a1a", position: "relative" }}>
          {renderSlides()}
          {slides.length > 1 && <script dangerouslySetInnerHTML={{ __html: SLIDESHOW_SCRIPT }} />}
        </div>
      </section>
    </StyleHost>
  );
}
