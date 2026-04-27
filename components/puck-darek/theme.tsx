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
      <section style={{ background: "#0d0d0d", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 80, alignItems: "center" }}>
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
  layout: "split" | "fullbleed";
}
export function Hero({ label, titleLine1, titleLine2, tagline, ctaText, ctaHref, heroImage, heroAlt, layout = "split" }: HeroProps) {
  if (layout === "fullbleed") {
    return (
      <StyleHost>
        <section style={{ position: "relative", minHeight: "70vh", display: "flex", alignItems: "center", color: "#f5efe6", backgroundImage: heroImage ? `linear-gradient(rgba(10,10,10,0.45), rgba(10,10,10,0.65)), url(${heroImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center", background: heroImage ? undefined : "#0a0a0a" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px", width: "100%" }}>
            {label && <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.25em", color: "#c9a96e", marginBottom: 28, fontFamily: "'Manrope', sans-serif" }}>{label}</p>}
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(56px, 8vw, 110px)", lineHeight: 1.05, letterSpacing: "-0.01em", color: "#f5efe6", margin: 0 }}>
              {titleLine1}{titleLine2 && <><br/><em style={{ color: "#c9a96e" }}>{titleLine2}</em></>}
            </h1>
            {tagline && <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, color: "#a8a8a8", marginTop: 24, marginBottom: 40, maxWidth: 480 }}>{tagline}</p>}
            {ctaText && <a href={ctaHref || "#"} className="dk-btn dk-btn-outline">{ctaText}</a>}
          </div>
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
        <div style={{ minHeight: "85vh", overflow: "hidden", background: "#1a1a1a" }}>
          {heroImage && <img src={heroImage} alt={heroAlt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
      </section>
    </StyleHost>
  );
}
