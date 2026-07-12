"use client";

// Life i Balans — "Örtagård"-tema för Puck.
// Scoped under .lib-root (egna CSS-vars + lib-* klasser) så inget läcker till
// Cockpit-admin eller andra klienter. Fonter via Google Fonts (som Darek-temat).
// Rörelse: synligt som default, JS opt-in (funkar i editor-iframen).

import React from "react";

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">`;

export const LIB_STYLES = `
.lib-root{
  --paper:#f6f2ea; --paper-soft:#efe8dc; --oat:#e9e2ce;
  --ink:#23241e; --ink-soft:#5c5e4f;
  --forest:#38472f; --forest-deep:#2b3724; --sage:#8b9a7a; --sage-soft:#b7c0a4;
  --gold:#bf9f55; --gold-soft:#d8c182;
  --clay:#b0623c; --clay-deep:#8f4e2f;
  --cream-text:#ece4d4; --cream-mute:#aab199;
  --line:#e2dbcb; --line-strong:#d6cfbf; --gold-keyline:rgba(191,159,85,.55);
  --gutter:clamp(1.25rem,5vw,3rem); --container:1180px;
  --section-y:clamp(5rem,3rem + 8vw,7.5rem); --ease-soft:cubic-bezier(.16,1,.3,1);
  --r-btn:3px; --r-media:3px;
  font-family:'Hanken Grotesk',system-ui,sans-serif; color:var(--ink);
  background-color:var(--paper);
  background-image:radial-gradient(1100px 560px at 10% -8%,rgba(191,159,85,.11),transparent 62%),radial-gradient(920px 720px at 102% 3%,rgba(139,154,122,.12),transparent 60%),radial-gradient(1000px 820px at 50% 116%,rgba(56,71,47,.07),transparent 60%),linear-gradient(180deg,#f9f5ee 0%,var(--paper) 42%,#f1ebdf 100%);
  font-size:1.0625rem; line-height:1.7; -webkit-font-smoothing:antialiased;
  position:relative; overflow-x:clip;
}
.lib-root *,.lib-root *::before,.lib-root *::after{box-sizing:border-box;}
.lib-root img{max-width:100%;height:auto;}
.lib-root::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.045;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:150px 150px;}
@media(min-width:768px){.lib-root{font-size:1.125rem;}}
.lib-root ::selection{background:var(--sage-soft);color:var(--ink);}

.lib-display{font-family:'Spectral',Georgia,serif;font-weight:400;font-size:clamp(2.5rem,1.75rem + 3.4vw,4.15rem);line-height:1.07;letter-spacing:-.015em;margin:0;color:var(--ink);text-wrap:balance;}
.lib-h2{font-family:'Spectral',Georgia,serif;font-weight:400;font-size:clamp(2rem,1.55rem + 1.9vw,3rem);line-height:1.14;letter-spacing:-.012em;margin:0;color:var(--ink);text-wrap:balance;}
.lib-h3{font-family:'Spectral',Georgia,serif;font-weight:400;font-size:clamp(1.5rem,1.3rem + .9vw,2rem);line-height:1.2;letter-spacing:-.01em;margin:0;color:var(--ink);}
.lib-em{font-style:italic;font-weight:400;}
.lib-lead{font-size:clamp(1.15rem,1.05rem + .45vw,1.4rem);line-height:1.6;color:var(--ink-soft);margin:0;}
.lib-eyebrow{font-family:'Hanken Grotesk',sans-serif;font-size:.72rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--forest);margin:0;}
.lib-prose{max-width:62ch;}
.lib-prose p{margin:0 0 1.15em;}.lib-prose p:last-child{margin-bottom:0;}
.lib-small{font-size:.8125rem;line-height:1.6;color:var(--ink-soft);}

.lib-container{width:100%;max-width:var(--container);margin-inline:auto;padding-inline:var(--gutter);position:relative;z-index:1;}
.lib-section{padding-block:var(--section-y);position:relative;z-index:1;}
.lib-section--tint{background:linear-gradient(180deg,#f4efe4 0%,var(--paper-soft) 52%,#ece5d7 100%);}

.lib-btn{display:inline-flex;align-items:center;gap:.5rem;font-family:'Hanken Grotesk',sans-serif;font-size:1rem;font-weight:600;line-height:1;padding:.95rem 1.65rem;border-radius:var(--r-btn);border:1px solid transparent;cursor:pointer;text-decoration:none;transition:transform .3s var(--ease-soft),box-shadow .3s var(--ease-soft),background-color .3s var(--ease-soft),border-color .3s var(--ease-soft);}
.lib-btn-primary{background:linear-gradient(135deg,#b96a44 0%,var(--clay) 45%,var(--clay-deep) 100%);color:#fbf7f0;box-shadow:0 1px 2px rgba(51,44,36,.08);}
.lib-btn-primary:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(143,78,47,.24);}
.lib-link-arrow{display:inline-flex;align-items:center;gap:.4rem;font-weight:600;color:var(--clay-deep);text-decoration:none;transition:gap .3s var(--ease-soft),color .2s var(--ease-soft);}
.lib-link-arrow:hover{gap:.7rem;color:var(--clay);}
.lib-link-arrow svg{flex:none;}
.lib-link{color:var(--clay-deep);text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:3px;}
.lib-link:hover{text-decoration-color:var(--clay);}

.lib-quote{position:relative;overflow:hidden;background:linear-gradient(150deg,#f2efe0,#e7e6d2);border-left:2px solid var(--gold);padding:1.7rem 1.95rem;border-radius:0 var(--r-media) var(--r-media) 0;font-family:'Spectral',Georgia,serif;font-weight:400;font-style:italic;font-size:clamp(1.3rem,1.15rem + .7vw,1.65rem);line-height:1.35;color:var(--ink);box-shadow:0 1px 2px rgba(43,55,36,.04),0 18px 40px -30px rgba(43,55,36,.4);}
.lib-quote::before{content:"\\201D";position:absolute;top:.15em;right:.28em;font-family:'Spectral',Georgia,serif;font-style:normal;font-size:4.5rem;line-height:1;color:var(--gold);opacity:.32;pointer-events:none;}

/* Frames + keyline */
.lib-frame{position:relative;overflow:hidden;border-radius:var(--r-media);background:linear-gradient(155deg,var(--oat),var(--sage-soft));box-shadow:0 2px 6px rgba(43,55,36,.05),0 30px 64px -36px rgba(43,55,36,.48);}
.lib-frame::after{content:"";position:absolute;inset:12px;border:1px solid var(--gold-keyline);border-radius:2px;pointer-events:none;z-index:2;}
.lib-frame img{object-fit:cover;width:100%;height:100%;display:block;transition:transform .8s var(--ease-soft);}
.lib-frame:hover img{transform:scale(1.04);}
.lib-figcap{margin:.95rem 0 0;font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);display:flex;align-items:center;gap:.6rem;}
.lib-figcap::before{content:"";width:22px;height:1px;background:var(--gold);flex:none;}

/* Split */
.lib-split{padding-inline:var(--gutter);position:relative;z-index:1;}
.lib-split__text{display:flex;flex-direction:column;align-items:flex-start;gap:1.35rem;max-width:38rem;}
.lib-split__media{margin-top:2.5rem;}
.lib-split .lib-frame{aspect-ratio:4/5;}
.lib-split .lib-frame--wide{aspect-ratio:5/4;}
@media(min-width:900px){
  .lib-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:clamp(2rem,4vw,4.5rem);align-items:center;}
  .lib-split__media{margin-top:0;}
  .lib-split .lib-frame{aspect-ratio:auto;height:min(70vh,620px);}
  .lib-bleed-right{padding-left:max(var(--gutter),calc((100% - var(--container))/2 + var(--gutter)));padding-right:0;}
  .lib-bleed-right .lib-split__text{order:1;}.lib-bleed-right .lib-split__media{order:2;}
  .lib-bleed-left{padding-right:max(var(--gutter),calc((100% - var(--container))/2 + var(--gutter)));padding-left:0;}
  .lib-bleed-left .lib-split__text{order:2;}.lib-bleed-left .lib-split__media{order:1;}
}

/* Hero */
.lib-hero{padding-top:clamp(1.5rem,5vw,3.5rem);padding-bottom:clamp(3rem,7vw,5.5rem);padding-inline:var(--gutter);position:relative;z-index:1;}
.lib-hero__text{display:flex;flex-direction:column;align-items:flex-start;gap:1.5rem;max-width:34rem;}
.lib-hero__cta{display:flex;flex-wrap:wrap;align-items:center;gap:1.25rem 1.75rem;margin-top:.5rem;}
.lib-hero .lib-frame{aspect-ratio:4/5;}
@media(min-width:900px){
  .lib-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);column-gap:clamp(2rem,4vw,4.5rem);align-items:center;padding-left:max(var(--gutter),calc((100% - var(--container))/2 + var(--gutter)));padding-right:0;}
  .lib-hero .lib-frame{aspect-ratio:auto;height:min(78vh,720px);}
}
@keyframes lib-breathe{0%{transform:scale(1);}100%{transform:scale(1.045);}}
.lib-breathe img{animation:lib-breathe 22s ease-out infinite alternate;}

/* Igenkänning */
.lib-recog__title{text-align:center;margin-bottom:clamp(2rem,4vw,3rem);}
.lib-recog__grid{display:grid;grid-template-columns:1fr;gap:clamp(1.5rem,3vw,2.5rem);max-width:60rem;margin-inline:auto;}
@media(min-width:700px){.lib-recog__grid{grid-template-columns:1fr 1fr;column-gap:clamp(2rem,4vw,3.5rem);}}
.lib-recog__block{padding-top:1.25rem;}
.lib-recog__block::before{content:"";display:block;width:48px;height:2px;background:linear-gradient(90deg,var(--gold),var(--clay));margin-bottom:1.1rem;}
.lib-recog__block p{margin:0;}

/* Statement */
.lib-statement{position:relative;overflow:hidden;isolation:isolate;padding-block:clamp(5.5rem,11vw,9rem);background:radial-gradient(72% 90% at 50% 26%,#35462d 0%,transparent 72%),linear-gradient(165deg,#2f3e27 0%,#1f2a1a 100%);color:var(--cream-text);z-index:1;}
.lib-statement__aura{position:absolute;inset:-12% -6%;z-index:0;pointer-events:none;}
.lib-statement__aura::before,.lib-statement__aura::after{content:"";position:absolute;border-radius:50%;filter:blur(64px);opacity:.5;}
.lib-statement__aura::before{width:44vw;height:44vw;left:-8%;top:4%;background:radial-gradient(circle,rgba(139,154,122,.5),transparent 65%);animation:lib-drift-a 24s ease-in-out infinite alternate;}
.lib-statement__aura::after{width:40vw;height:40vw;right:-6%;bottom:-4%;background:radial-gradient(circle,rgba(191,159,85,.38),transparent 65%);animation:lib-drift-b 30s ease-in-out infinite alternate;}
@keyframes lib-drift-a{from{transform:translate(0,0);}to{transform:translate(6%,4%);}}
@keyframes lib-drift-b{from{transform:translate(0,0);}to{transform:translate(-5%,-4%);}}
.lib-statement__inner{position:relative;z-index:1;max-width:54rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.4rem;}
.lib-statement__title{font-family:'Spectral',Georgia,serif;font-weight:400;font-size:clamp(2.15rem,1.5rem + 3vw,3.6rem);line-height:1.1;letter-spacing:-.015em;color:var(--cream-text);margin:0;text-wrap:balance;text-shadow:0 2px 34px rgba(0,0,0,.28);}
.lib-statement__title .lib-em{color:var(--gold-soft);}
.lib-statement__body{max-width:42rem;color:var(--cream-mute);font-size:clamp(1.05rem,1rem + .3vw,1.25rem);line-height:1.6;margin:0;}

/* Stötdämparen */
.lib-shock-panel{position:relative;overflow:hidden;background:radial-gradient(440px 340px at 78% 10%,rgba(191,159,85,.12),transparent 60%),linear-gradient(160deg,#f4efe2 0%,#e7e6d0 100%);border-radius:var(--r-media);padding:clamp(2rem,4vw,3.25rem);box-shadow:inset 0 0 0 1px var(--line),0 2px 6px rgba(43,55,36,.05),0 30px 62px -36px rgba(43,55,36,.42);}
.lib-shock-panel::after{content:"";position:absolute;inset:12px;border:1px solid var(--gold-keyline);border-radius:2px;pointer-events:none;}
.lib-shock-illu{display:block;width:100%;height:auto;max-width:420px;margin-inline:auto;}
.lib-shock-illu__label{font-family:'Hanken Grotesk',sans-serif;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;fill:var(--forest);}

/* Löv-lista / trust */
.lib-leaf-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1.05rem;max-width:40rem;}
.lib-leaf-list li{display:flex;gap:.85rem;align-items:flex-start;}
.lib-leaf-list li>svg{margin-top:.3em;flex:none;}
.lib-trust{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .85rem;}
.lib-trust li{display:inline-flex;align-items:center;gap:.85rem;font-size:.95rem;font-weight:600;color:var(--ink-soft);}
.lib-trust li>svg{flex:none;}

/* FAQ */
.lib-faq{max-width:46rem;}
.lib-faq__title{margin-bottom:clamp(1.5rem,3vw,2.5rem);}
.lib-faq__list{border-top:1px solid var(--line);}
.lib-faq__item{border-bottom:1px solid var(--line);}
.lib-faq__q{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1.3rem 0;font-family:'Spectral',Georgia,serif;font-weight:500;font-size:clamp(1.15rem,1.05rem + .4vw,1.35rem);line-height:1.3;color:var(--ink);}
.lib-faq__q::-webkit-details-marker{display:none;}
.lib-faq__icon{flex:none;color:var(--clay);transition:transform .3s var(--ease-soft);}
.lib-faq__item[open] .lib-faq__icon{transform:rotate(45deg);}
.lib-faq__a{padding:0 0 1.4rem;max-width:62ch;color:var(--ink-soft);}
.lib-faq__a p{margin:0;}

/* Forest / closing */
.lib-forest{position:relative;overflow:hidden;background:linear-gradient(165deg,var(--forest) 0%,var(--forest-deep) 100%);color:var(--cream-text);}
.lib-forest .lib-eyebrow{color:var(--gold-soft);}
.lib-closing{position:relative;z-index:1;max-width:40rem;margin-inline:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.25rem;}
.lib-closing__title{font-family:'Spectral',Georgia,serif;font-weight:400;font-size:clamp(1.95rem,1.6rem + 1.4vw,2.35rem);line-height:1.16;letter-spacing:-.01em;color:var(--cream-text);margin:0;text-wrap:balance;}
.lib-forest .lib-closing__text{color:var(--cream-mute);}
.lib-forest .lib-closing__note{color:var(--cream-mute);margin-top:.5rem;}
.lib-forest .lib-link{color:var(--gold-soft);text-decoration-color:rgba(216,193,130,.5);}

/* GHL embed */
.lib-ghl{display:flex;align-items:center;justify-content:center;border:1px dashed var(--line-strong);border-radius:var(--r-media);background:linear-gradient(160deg,#f7f3ec,#efe8dc);box-shadow:inset 0 0 0 1px rgba(226,219,203,.6);padding:clamp(1.75rem,4vw,3rem);text-align:center;}
.lib-ghl__title{font-family:'Spectral',Georgia,serif;font-size:1.35rem;color:var(--ink);margin:.4rem 0;}
.lib-ghl code{font-family:ui-monospace,Menlo,monospace;font-size:.85em;background:rgba(56,71,47,.08);color:var(--forest);padding:.12em .45em;border-radius:3px;}

/* Reveal — synligt som default; JS taggar .lib-prep för att gömma + fade in */
.lib-reveal{transition:opacity .8s var(--ease-soft),transform .8s var(--ease-soft);}
.lib-reveal.lib-prep{opacity:0;transform:translateY(14px);}
.lib-reveal.lib-vis{opacity:1;transform:none;}

@media(prefers-reduced-motion:reduce){
  .lib-reveal,.lib-reveal.lib-prep,.lib-reveal.lib-vis{opacity:1!important;transform:none!important;transition:none!important;}
  .lib-breathe img,.lib-statement__aura::before,.lib-statement__aura::after{animation:none!important;}
}
`;

let injected = false;
function ensureStyles() {
  if (typeof document === "undefined" || injected) return;
  injected = true;
  document.head.insertAdjacentHTML("beforeend", FONTS);
  const s = document.createElement("style");
  s.textContent = LIB_STYLES;
  document.head.appendChild(s);
}

/** Wrapper: scoped tema + fonter + reveal-script. Varje Puck-block wrappas i denna. */
export function StyleHost({ children }: { children: React.ReactNode }) {
  if (typeof window !== "undefined") ensureStyles();
  return (
    <div className="lib-root">
      <style dangerouslySetInnerHTML={{ __html: LIB_STYLES }} />
      {children}
    </div>
  );
}

/** Litet guldlöv-ornament. */
export function Leaf({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C7 5.5 5 9 5 13c0 3.4 2.7 6.4 7 9 4.3-2.6 7-5.6 7-9 0-4-2-7.5-7-11Z" fill="var(--gold)" />
      <path d="M12 4.5v16" stroke="var(--paper)" strokeWidth="1.1" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

/** Pil för textlänkar. */
export function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
