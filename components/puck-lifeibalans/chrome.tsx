"use client";

// Life i Balans — statisk chrome (header + footer) för den publika routen.
// Örtagård-stil via lib-klasser (StyleHost injicerar tema).

import React from "react";
import { StyleHost, withBase } from "./theme";

const NAV = [
  { href: "/programmen", label: "Programmen" },
  { href: "/nervsystemstestet", label: "Nervsystemstestet" },
  { href: "/om-linda", label: "Om Linda" },
  { href: "/kontakt", label: "Kontakt" },
];

const LEGAL =
  "Life i Balans erbjuder utbildning och coaching. Innehållet ersätter inte hälso- och sjukvård. Vid misstanke om sjukdom, kontakta vården. Vid akut fara: ring 112.";

const CHROME_CSS = `
.lib-hdr{position:sticky;top:0;z-index:50;background:rgba(246,242,234,.93);-webkit-backdrop-filter:saturate(1.2) blur(10px);backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--line);}
.lib-hdr__in{height:112px;display:flex;align-items:center;justify-content:space-between;gap:1.5rem;}
.lib-logo{max-width:min(62vw,260px);object-fit:contain;mix-blend-mode:multiply;}
.lib-brand{display:inline-flex;align-items:center;gap:.55rem;text-decoration:none;color:var(--ink);}
.lib-brand__word{font-family:'Spectral',Georgia,serif;font-weight:500;font-size:1.28rem;letter-spacing:-.01em;line-height:1;}
.lib-nav{display:none;align-items:center;gap:1.75rem;}
.lib-nav a{font-size:.95rem;font-weight:600;color:var(--ink);text-decoration:none;}
.lib-nav a:hover{color:var(--clay-deep);}
.lib-hdr .lib-btn{padding:.65rem 1.15rem;font-size:.9rem;}
@media(min-width:860px){.lib-nav{display:flex;}}
.lib-ftr{background:linear-gradient(180deg,var(--forest-deep) 0%,#263120 100%);color:var(--cream-text);padding-block:clamp(3rem,5vw,4rem);}
.lib-ftr__cols{display:grid;grid-template-columns:1fr;gap:2rem;}
@media(min-width:700px){.lib-ftr__cols{grid-template-columns:1.5fr 1fr 1fr;gap:2.5rem;}}
.lib-ftr__tag{margin-top:1rem;max-width:34ch;color:var(--cream-mute);}
.lib-ftr__links{display:flex;flex-direction:column;gap:.65rem;}
.lib-ftr__links a{color:var(--cream-text);text-decoration:none;font-weight:600;font-size:.95rem;}
.lib-ftr__links a:hover{color:var(--gold-soft);}
.lib-ftr__rule{border:0;height:1px;background:rgba(216,193,130,.22);margin-block:clamp(2rem,4vw,2.5rem) 1.25rem;}
.lib-ftr__legal{color:var(--cream-mute);max-width:72ch;}
`;

// Riktiga loggan (trädkvinna + wordmark "Life [träd] Balans").
// Fil: hmmotor-next/public/lifeibalans/logo.png
function Logo({ height = 52 }: { height?: number }) {
  return (
    <img
      className="lib-logo"
      src="/lifeibalans/logo.png"
      alt="Life i Balans"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

export function LibHeader({ basePath }: { basePath?: string }) {
  return (
    <StyleHost>
      <style dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />
      <header className="lib-hdr">
        <div className="lib-container lib-hdr__in">
          <a href={withBase(basePath, "/")} className="lib-brand" aria-label="Life i Balans — startsida">
            <Logo height={84} />
          </a>
          <nav className="lib-nav" aria-label="Huvudmeny">
            {NAV.map((l) => <a key={l.href} href={withBase(basePath, l.href)}>{l.label}</a>)}
            <a href={withBase(basePath, "/nervsystemstestet")} className="lib-btn lib-btn-primary">Gör testet</a>
          </nav>
        </div>
      </header>
    </StyleHost>
  );
}

export function LibFooter({ basePath }: { basePath?: string }) {
  return (
    <StyleHost>
      <style dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />
      <footer className="lib-ftr">
        <div className="lib-container">
          <div className="lib-ftr__cols">
            <div>
              <a href={withBase(basePath, "/")} className="lib-brand"><Logo height={58} /></a>
              <p className="lib-small lib-ftr__tag">Utbildning och coaching om nervsystem, stress och klimakteriet — av Linda Fernquist, leg. sjuksköterska.</p>
            </div>
            <nav className="lib-ftr__links" aria-label="Sidfotsmeny">
              {NAV.map((l) => <a key={l.href} href={withBase(basePath, l.href)}>{l.label}</a>)}
            </nav>
            <div className="lib-ftr__links">
              <a href="mailto:linda@lifeibalans.se" className="lib-link">linda@lifeibalans.se</a>
              <a href="https://instagram.com/lifeibalans" target="_blank" rel="noopener noreferrer" className="lib-link">Instagram @lifeibalans</a>
            </div>
          </div>
          <hr className="lib-ftr__rule" />
          <p className="lib-small lib-ftr__legal">{LEGAL}</p>
        </div>
      </footer>
    </StyleHost>
  );
}
