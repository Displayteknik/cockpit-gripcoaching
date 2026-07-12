"use client";

// Life i Balans — Puck-sektioner (Örtagård). Varje block wrappas i StyleHost.
// Rena render-komponenter; fält definieras i lib/puck-config-lifeibalans.ts.

import React from "react";
import { StyleHost, Leaf, ArrowIcon, withBase } from "./theme";

// Puck skickar `puck.metadata` till varje render — där ligger sajtens bas-path.
function baseOf(p: unknown): string | undefined {
  return (p as { puck?: { metadata?: { basePath?: string } } })?.puck?.metadata?.basePath;
}

/** Byt ut första förekomsten av `word` i `text` mot kursiv. */
function withEmphasis(text: string, word?: string): React.ReactNode {
  if (!word) return text;
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <em className="lib-em">{text.slice(i, i + word.length)}</em>
      {text.slice(i + word.length)}
    </>
  );
}

function Figure({ src, alt, caption, wide }: { src?: string; alt?: string; caption?: string; wide?: boolean }) {
  return (
    <figure style={{ margin: 0 }}>
      <div className={`lib-frame${wide ? " lib-frame--wide" : ""}`}>
        {src ? <img src={src} alt={alt || ""} /> : null}
      </div>
      {caption ? <figcaption className="lib-figcap">{caption}</figcaption> : null}
    </figure>
  );
}

// ── HERO ──────────────────────────────────────────────────────
export interface HeroProps {
  eyebrow: string; title: string; emphasisWord?: string; lead: string;
  ctaText: string; ctaUrl: string; linkText: string; linkUrl: string;
  image?: string; imageAlt?: string; caption?: string;
}
export function Hero(p: HeroProps) {
  return (
    <StyleHost>
      <section className="lib-hero">
        <div className="lib-hero__text">
          <p className="lib-eyebrow lib-reveal">{p.eyebrow}</p>
          <h1 className="lib-display lib-reveal">{withEmphasis(p.title, p.emphasisWord)}</h1>
          <p className="lib-lead lib-reveal">{p.lead}</p>
          <div className="lib-hero__cta lib-reveal">
            {p.ctaText ? <a href={withBase(baseOf(p), p.ctaUrl)} className="lib-btn lib-btn-primary">{p.ctaText}</a> : null}
            {p.linkText ? <a href={withBase(baseOf(p), p.linkUrl)} className="lib-link-arrow">{p.linkText}<ArrowIcon /></a> : null}
          </div>
        </div>
        <div className="lib-hero__media lib-breathe">
          <Figure src={p.image} alt={p.imageAlt} caption={p.caption} />
        </div>
      </section>
    </StyleHost>
  );
}

// ── IGENKÄNNING ───────────────────────────────────────────────
export interface RecognitionProps {
  title: string;
  blocks: { text: string }[];
  tint?: boolean;
}
export function Recognition(p: RecognitionProps) {
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-container">
          <h2 className="lib-h2 lib-recog__title lib-reveal">{p.title}</h2>
          <div className="lib-recog__grid">
            {(p.blocks || []).map((b, i) => (
              <div className="lib-recog__block lib-reveal" key={i}><p>{b.text}</p></div>
            ))}
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ── STATEMENT (wow) ───────────────────────────────────────────
export interface StatementProps { title: string; emphasisWord?: string; body: string; }
export function Statement(p: StatementProps) {
  return (
    <StyleHost>
      <section className="lib-statement">
        <div className="lib-statement__aura" aria-hidden="true" />
        <div className="lib-container lib-statement__inner">
          <span className="lib-reveal"><Leaf size={26} /></span>
          <h2 className="lib-statement__title lib-reveal">{withEmphasis(p.title, p.emphasisWord)}</h2>
          <p className="lib-statement__body lib-reveal">{p.body}</p>
        </div>
      </section>
    </StyleHost>
  );
}

// ── STÖTDÄMPAREN (illustration + citat) ───────────────────────
function ShockIllustration() {
  const Bolt = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
    <path d={`M${x} ${y} l${-9 * s} ${16 * s} l${8 * s} 0 l${-7 * s} ${18 * s}`} fill="none" stroke="var(--clay)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  );
  const Figure = ({ by }: { by: number }) => (
    <g stroke="var(--forest)" strokeWidth={2} fill="none" strokeLinecap="round">
      <circle cx={62} cy={by - 46} r={15} />
      <path d={`M36 ${by} Q36 ${by - 40} 62 ${by - 40} Q88 ${by - 40} 88 ${by}`} />
    </g>
  );
  return (
    <svg viewBox="0 0 420 520" className="lib-shock-illu" role="img" aria-label="Tjock stötdämpare före 45, tunn efter 45.">
      <text x={20} y={30} className="lib-shock-illu__label">FÖRE 45</text>
      <Figure by={150} />
      <rect x={140} y={72} width={62} height={150} rx={31} fill="var(--sage)" />
      <rect x={152} y={86} width={20} height={122} rx={10} fill="var(--sage-soft)" />
      <Bolt x={262} y={86} s={1.15} /><Bolt x={312} y={100} s={1} /><Bolt x={352} y={84} s={0.85} />
      <line x1={20} y1={262} x2={400} y2={262} stroke="var(--line)" strokeWidth={1} />
      <text x={20} y={306} className="lib-shock-illu__label">EFTER 45</text>
      <Figure by={430} />
      <rect x={140} y={352} width={20} height={150} rx={10} fill="var(--sage)" />
      <Bolt x={196} y={366} s={1.15} /><Bolt x={236} y={382} s={1} /><Bolt x={286} y={360} s={1.1} /><Bolt x={330} y={380} s={0.9} />
    </svg>
  );
}
export interface ShockProps { eyebrow: string; title: string; emphasisWord?: string; body: string; quote: string; }
export function ShockAbsorber(p: ShockProps) {
  return (
    <StyleHost>
      <section className="lib-section lib-split lib-bleed-left">
        <div className="lib-split__media"><div className="lib-reveal"><div className="lib-shock-panel"><ShockIllustration /></div></div></div>
        <div className="lib-split__text">
          <p className="lib-eyebrow lib-reveal">{p.eyebrow}</p>
          <h2 className="lib-h2 lib-reveal">{withEmphasis(p.title, p.emphasisWord)}</h2>
          <div className="lib-prose lib-reveal"><p>{p.body}</p></div>
          <blockquote className="lib-quote lib-reveal">{p.quote}</blockquote>
        </div>
      </section>
    </StyleHost>
  );
}

// ── UPPSLAG (spegelbart) ──────────────────────────────────────
export interface OfferingProps {
  eyebrow: string; title: string; body: string;
  ctaText: string; ctaUrl: string;
  image?: string; imageAlt?: string; caption?: string;
  mediaSide: "left" | "right"; wide?: boolean; tint?: boolean;
}
export function Offering(p: OfferingProps) {
  const bleed = p.mediaSide === "left" ? "lib-bleed-left" : "lib-bleed-right";
  return (
    <StyleHost>
      <section className={`lib-section lib-split ${bleed}${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-split__text">
          <p className="lib-eyebrow lib-reveal">{p.eyebrow}</p>
          <h3 className="lib-h3 lib-reveal">{p.title}</h3>
          <div className="lib-prose lib-reveal"><p>{p.body}</p></div>
          {p.ctaText ? <span className="lib-reveal"><a href={withBase(baseOf(p), p.ctaUrl)} className="lib-link-arrow">{p.ctaText}<ArrowIcon /></a></span> : null}
        </div>
        <div className="lib-split__media"><div className="lib-reveal"><Figure src={p.image} alt={p.imageAlt} caption={p.caption} wide={p.wide} /></div></div>
      </section>
    </StyleHost>
  );
}

// ── OM LINDA ──────────────────────────────────────────────────
export interface AboutProps {
  eyebrow: string; title: string; body: string;
  trust: { text: string }[];
  linkText: string; linkUrl: string;
  image?: string; imageAlt?: string; caption?: string;
}
export function AboutLinda(p: AboutProps) {
  return (
    <StyleHost>
      <section className="lib-section lib-split lib-bleed-left">
        <div className="lib-split__media"><div className="lib-reveal"><Figure src={p.image} alt={p.imageAlt} caption={p.caption} /></div></div>
        <div className="lib-split__text">
          <p className="lib-eyebrow lib-reveal">{p.eyebrow}</p>
          <h2 className="lib-h2 lib-reveal">{p.title}</h2>
          <div className="lib-prose lib-reveal"><p>{p.body}</p></div>
          <ul className="lib-trust lib-reveal">
            {(p.trust || []).map((t, i) => (
              <li key={i}>{i > 0 ? <Leaf size={14} /> : null}<span>{t.text}</span></li>
            ))}
          </ul>
          {p.linkText ? <span className="lib-reveal"><a href={withBase(baseOf(p), p.linkUrl)} className="lib-link-arrow">{p.linkText}<ArrowIcon /></a></span> : null}
        </div>
      </section>
    </StyleHost>
  );
}

// ── FAQ ───────────────────────────────────────────────────────
export interface FaqProps { title: string; items: { question: string; answer: string }[]; }
export function Faq(p: FaqProps) {
  return (
    <StyleHost>
      <section className="lib-section">
        <div className="lib-container lib-faq">
          <h2 className="lib-h2 lib-faq__title lib-reveal">{p.title}</h2>
          <div className="lib-faq__list">
            {(p.items || []).map((it, i) => (
              <div className="lib-reveal" key={i}>
                <details className="lib-faq__item">
                  <summary className="lib-faq__q">
                    <span>{it.question}</span>
                    <span className="lib-faq__icon" aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                    </span>
                  </summary>
                  <div className="lib-faq__a"><p>{it.answer}</p></div>
                </details>
              </div>
            ))}
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ── AVSLUT (mörk skog) ────────────────────────────────────────
export interface ClosingProps {
  title: string; body: string; ctaText: string; ctaUrl: string;
  noteText?: string; noteLinkText?: string; noteLinkUrl?: string;
}
export function Closing(p: ClosingProps) {
  return (
    <StyleHost>
      <section className="lib-section lib-forest">
        <div className="lib-statement__aura" aria-hidden="true" />
        <div className="lib-container lib-closing">
          <span className="lib-reveal"><Leaf size={26} /></span>
          <h2 className="lib-closing__title lib-reveal">{p.title}</h2>
          <p className="lib-lead lib-closing__text lib-reveal">{p.body}</p>
          {p.ctaText ? <span className="lib-reveal"><a href={withBase(baseOf(p), p.ctaUrl)} className="lib-btn lib-btn-primary">{p.ctaText}</a></span> : null}
          {p.noteText ? (
            <p className="lib-small lib-closing__note lib-reveal">
              {p.noteText}{" "}
              {p.noteLinkText ? <a href={withBase(baseOf(p), p.noteLinkUrl)} className="lib-link">{p.noteLinkText}</a> : null}
            </p>
          ) : null}
        </div>
      </section>
    </StyleHost>
  );
}

// ── RUBRIK (sidhuvud för undersidor) ──────────────────────────
export interface RubrikProps { eyebrow: string; title: string; emphasisWord?: string; lead?: string; tint?: boolean; }
export function Rubrik(p: RubrikProps) {
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`} style={{ paddingBottom: "clamp(2rem,4vw,3rem)" }}>
        <div className="lib-container">
          <div className="lib-pagehead">
            <p className="lib-eyebrow">{p.eyebrow}</p>
            <h1 className="lib-display">{withEmphasis(p.title, p.emphasisWord)}</h1>
            {p.lead ? <p className="lib-lead" style={{ maxWidth: "44rem" }}>{p.lead}</p> : null}
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ── PUNKTER (löv-lista med rubrik) ────────────────────────────
export interface PunkterProps { eyebrow: string; title: string; intro?: string; points: { text: string }[]; tint?: boolean; }
export function Punkter(p: PunkterProps) {
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-container lib-punkter">
          <div className="lib-punkter__head">
            <p className="lib-eyebrow">{p.eyebrow}</p>
            <h2 className="lib-h2">{p.title}</h2>
            {p.intro ? <p className="lib-lead" style={{ maxWidth: "44rem" }}>{p.intro}</p> : null}
          </div>
          <ul className="lib-leaf-list">
            {(p.points || []).map((pt, i) => (<li key={i}><Leaf size={16} /><span>{pt.text}</span></li>))}
          </ul>
        </div>
      </section>
    </StyleHost>
  );
}

// ── TEXT / VÅRD-RUTA ──────────────────────────────────────────
export interface TextBlockProps { eyebrow: string; title: string; body: string; care?: boolean; tint?: boolean; }
export function TextBlock(p: TextBlockProps) {
  const inner = (
    <>
      <p className="lib-eyebrow">{p.eyebrow}</p>
      <h2 className="lib-h3" style={{ marginTop: ".5rem" }}>{p.title}</h2>
      <div className="lib-prose" style={{ marginTop: ".9rem" }}>
        {p.body.split("\n").filter(Boolean).map((para, i) => (<p key={i}>{para}</p>))}
      </div>
    </>
  );
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-container">
          {p.care ? <div className="lib-care">{inner}</div> : <div className="lib-textblock">{inner}</div>}
        </div>
      </section>
    </StyleHost>
  );
}

// ── VÄGEN IN (tre steg, inga bilder) ──────────────────────────
export interface VagenProps {
  eyebrow: string; title: string; tint?: boolean;
  steps: { label: string; title: string; desc: string; ctaText: string; ctaUrl: string }[];
}
export function Vagen(p: VagenProps) {
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-container lib-vagen">
          <div className="lib-vagen__head">
            <p className="lib-eyebrow">{p.eyebrow}</p>
            <h2 className="lib-h2">{p.title}</h2>
          </div>
          <div className="lib-vagen__list">
            {(p.steps || []).map((s, i) => (
              <div className="lib-vagen__row" key={i}>
                <div className="lib-vagen__meta"><Leaf size={16} /><span className="lib-vagen__label">{s.label}</span></div>
                <div className="lib-vagen__main">
                  <h3 className="lib-vagen__h">{s.title}</h3>
                  <p className="lib-vagen__desc">{s.desc}</p>
                </div>
                {s.ctaText ? <a href={withBase(baseOf(p), s.ctaUrl)} className="lib-link-arrow lib-vagen__cta">{s.ctaText}<ArrowIcon /></a> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </StyleHost>
  );
}

// ── KONTAKTFORMULÄR (native → /api/lifeibalans/lead → Resend) ──
export function LibContactForm() {
  const [status, setStatus] = React.useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = React.useState("");
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending"); setErr("");
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const r = await fetch("/api/lifeibalans/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setStatus("done"); form.reset(); }
      else { setStatus("error"); setErr(j.error || "Något gick fel. Försök igen."); }
    } catch { setStatus("error"); setErr("Kunde inte skicka — försök igen eller mejla direkt."); }
  }
  if (status === "done") {
    return <div className="lib-form__done"><h3>Tack — jag hör av mig.</h3><p className="lib-small">Ditt meddelande är skickat. Jag svarar själv, så snart jag kan.</p></div>;
  }
  return (
    <form className="lib-form" onSubmit={onSubmit} noValidate>
      <div className="lib-form__hp" aria-hidden="true"><label>Lämna tomt<input name="company" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="lib-field"><label htmlFor="lf-name">Namn</label><input id="lf-name" name="name" required autoComplete="name" /></div>
      <div className="lib-field"><label htmlFor="lf-email">E-post</label><input id="lf-email" name="email" type="email" required autoComplete="email" /></div>
      <div className="lib-field"><label htmlFor="lf-phone">Telefon (valfritt)</label><input id="lf-phone" name="phone" type="tel" autoComplete="tel" /></div>
      <div className="lib-field"><label htmlFor="lf-msg">Meddelande</label><textarea id="lf-msg" name="message" placeholder="Vad undrar du över?" /></div>
      <button type="submit" className="lib-btn lib-btn-primary" disabled={status === "sending"}>{status === "sending" ? "Skickar…" : "Skicka meddelande"}</button>
      {status === "error" ? <p className="lib-form__msg lib-form__msg--err">{err}</p> : null}
    </form>
  );
}

export interface KontaktProps { eyebrow: string; title: string; intro?: string; email?: string; tint?: boolean; }
export function Kontaktformular(p: KontaktProps) {
  return (
    <StyleHost>
      <section className={`lib-section${p.tint ? " lib-section--tint" : ""}`}>
        <div className="lib-container lib-cols">
          <div className="lib-split__text">
            <p className="lib-eyebrow">{p.eyebrow}</p>
            <h2 className="lib-h2">{p.title}</h2>
            {p.intro ? <p className="lib-lead">{p.intro}</p> : null}
            {p.email ? <p className="lib-small">Hellre mejl? <a href={`mailto:${p.email}`} className="lib-link">{p.email}</a></p> : null}
          </div>
          <LibContactForm />
        </div>
      </section>
    </StyleHost>
  );
}

// ── GHL-EMBED ─────────────────────────────────────────────────
export interface GhlProps { embedId: string; title: string; minHeight: number; }
export function GhlEmbed(p: GhlProps) {
  return (
    <StyleHost>
      <section className="lib-section">
        <div className="lib-container" style={{ maxWidth: 720 }}>
          <div className="lib-ghl" style={{ minHeight: p.minHeight || 520 }}>
            {/* GHL: klistra in iframe för {{embedId}} här */}
            <div>
              <p className="lib-eyebrow">Formulär</p>
              <p className="lib-ghl__title">{p.title}</p>
              <p className="lib-small">GHL-embed <code>{`{{${p.embedId}}}`}</code> klistras in här.</p>
            </div>
          </div>
        </div>
      </section>
    </StyleHost>
  );
}
