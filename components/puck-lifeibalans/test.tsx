"use client";

// Nervsystemstestet — interaktiv självskattning (multi-steg, knappval).
// Bygger på tre-lägen-ramen från Lindas instegskurs. Klient-scoring → profil.
// UTKAST-frågor/profiler i Lindas röst — hon kan finjustera i /admin senare.

import React from "react";
import { StyleHost, Leaf, ArrowIcon, withBase } from "./theme";

const OPTIONS = ["Sällan eller aldrig", "Ibland", "Ofta", "Nästan alltid"];

type Tag = "up" | "down" | "gen";
const QUESTIONS: { q: string; tag: Tag }[] = [
  { q: "Jag vaknar på natten med hjärtat bultande, utan tydlig anledning.", tag: "up" },
  { q: "Jag är trött men ändå för uppvarvad för att slappna av.", tag: "up" },
  { q: "Tankarna snurrar och jag har svårt att stänga av.", tag: "up" },
  { q: "Jag är mer irriterad eller har kortare stubin än förr.", tag: "up" },
  { q: "Jag har svårt att sitta still eller varva ner, även när jag har tid.", tag: "up" },
  { q: "Jag känner mig tom och orkeslös, som att energin är slut.", tag: "down" },
  { q: "Jag drar mig undan och orkar inte umgås som förr.", tag: "down" },
  { q: "Saker som brukade ge glädje känns grå eller likgiltiga.", tag: "down" },
  { q: "Jag känner mig avstängd eller långt borta, som bakom en glasruta.", tag: "down" },
  { q: "Jag har svårt att komma igång med vardagliga saker.", tag: "down" },
  { q: "Jag har hjärndimma — tappar ord eller glömmer varför jag gick in i ett rum.", tag: "gen" },
  { q: "Min sömn är sämre än den brukade vara.", tag: "gen" },
  { q: "Jag känner igen mig i: alla prover ser bra ut, men jag mår ändå inte bra.", tag: "gen" },
  { q: "Stress som jag förr klarade av känns nu övermäktig.", tag: "gen" },
  { q: "Jag skäller på mig själv för att jag inte ”bara skärper mig”.", tag: "gen" },
];

type ProfileKey = "reglerat" | "uppvarvad" | "nedstangd" | "pendlar";
const PROFILES: Record<ProfileKey, { title: string; body: string; steps: string[] }> = {
  reglerat: {
    title: "Ditt nervsystem hittar hem ganska ofta.",
    body: "Du känner igen en del av det här, men bilden är inte alarmerande — ditt system verkar fortfarande kunna växla ner och återhämta sig. Det är en bra plats att vårda, särskilt nu när klimakteriet gör skyddet tunnare. Lite förebyggande kunskap går långt.",
    steps: [
      "Lägg märke till dina lägen några gånger om dagen — bara notera, inte ändra.",
      "Skydda sömnen: samma tid, mörkt och svalt, skärmen bort en stund innan.",
      "Bygg in korta pauser där du medvetet varvar ner — några djupa utandningar räcker för att börja.",
    ],
  },
  uppvarvad: {
    title: "Ditt nervsystem står mycket i gasläge.",
    body: "Mycket pekar mot ett uppvarvat system — kamp och flykt, foten på gasen. Trött men på helspänn, svårt att stänga av, hjärtat som slår till på natten. Det är inte ett personlighetsfel; det är en gaspedal som fastnat, ofta förvärrad av att östrogenets stötdämpare tunnas ut. Det går att lossa.",
    steps: [
      "Lär kroppen bromsen: långsam utandning, längre än inandningen, några minuter om dagen.",
      "Sänk tempot medvetet på en sak om dagen — kroppen lär sig av upprepning, inte av mer prestation.",
      "Var snäll mot sömnen och koffeinet — ett uppvarvat system behöver mindre bränsle, inte mer.",
    ],
  },
  nedstangd: {
    title: "Ditt nervsystem har dragit i nödbromsen.",
    body: "Bilden lutar mot nedstängning — tomhet, orkeslöshet, en känsla av att vara långt borta. Det är inte lathet; det är nervsystemets sista skyddsåtgärd när det pågått för länge. Det viktigaste nu är varsamhet och små, trygga steg tillbaka — och att inte kräva prestation av en kropp som redan sagt ifrån.",
    steps: [
      "Börja pyttelitet: en kort promenad, lite dagsljus, en sak i taget.",
      "Sök mild rörelse och kontakt — nedstängning lättar oftast i trygg samvaro, inte i ensamhet.",
      "Var uppmärksam på tunga tankar — om de skrämmer dig, hör av dig till vården. Det är styrka, inte svaghet.",
    ],
  },
  pendlar: {
    title: "Du pendlar mellan uppvarvad och nedstängd.",
    body: "Du känner igen både gasen och nödbromsen — uppvarvad på dagen, tömd på kvällen, ibland flera gånger om dagen. Det är vanligare än du tror i den här livsfasen, och det som saknas är läget däremellan: tryggt och lugnt. Det går att hitta tillbaka dit oftare, och snabbare, med rätt verktyg.",
    steps: [
      "Lär dig känna igen vilket läge du är i just nu — första steget till att kunna påverka.",
      "Öva regleringen dagligen i korta stunder, i trygghet — det är upprepningen som räknas.",
      "Skydda återhämtningen: sömn, pauser och gränser är inte lyx, de är medicin för ett pendlande system.",
    ],
  },
};

function computeProfile(answers: number[]) {
  const val = (i: number) => Math.max(0, answers[i]);
  let up = 0, down = 0, gen = 0;
  QUESTIONS.forEach((q, i) => {
    if (q.tag === "up") up += val(i);
    else if (q.tag === "down") down += val(i);
    else gen += val(i);
  });
  const total = up + down + gen;
  let key: ProfileKey;
  if (total <= 12) key = "reglerat";
  else {
    const d = up / 15 - down / 15;
    key = d >= 0.2 ? "uppvarvad" : d <= -0.2 ? "nedstangd" : "pendlar";
  }
  return { key, total, ...PROFILES[key] };
}

export interface NervTestProps {
  eyebrow: string; heading: string; intro: string;
  puck?: { metadata?: { basePath?: string } };
}

export function NervTest(props: NervTestProps) {
  const base = props?.puck?.metadata?.basePath;
  const [phase, setPhase] = React.useState<"intro" | "quiz" | "contact" | "result">("intro");
  const [qi, setQi] = React.useState(0);
  const [answers, setAnswers] = React.useState<number[]>(() => Array(QUESTIONS.length).fill(-1));
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [profile, setProfile] = React.useState<ReturnType<typeof computeProfile> | null>(null);

  function pick(v: number) {
    const a = [...answers]; a[qi] = v; setAnswers(a);
    window.setTimeout(() => { if (qi < QUESTIONS.length - 1) setQi(qi + 1); else setPhase("contact"); }, 160);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = computeProfile(answers);
    setProfile(p); setSending(true);
    try {
      await fetch("/api/lifeibalans/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, profileKey: p.key, profileTitle: p.title, profileBody: p.body, total: p.total, company: "" }),
      });
    } catch { /* profilen visas ändå på skärmen */ }
    setSending(false); setPhase("result");
  }

  const progress = Math.round(((qi + (phase === "contact" || phase === "result" ? 1 : 0)) / QUESTIONS.length) * 100);

  return (
    <StyleHost>
      <section className="lib-section">
        <div className="lib-container lib-test">
          <div className="lib-test__card">
            {phase === "intro" && (
              <div className="lib-test__intro">
                <p className="lib-eyebrow">{props.eyebrow}</p>
                <h3>{props.heading}</h3>
                <p className="lib-prose" style={{ marginTop: ".6rem" }}>{props.intro}</p>
                <div style={{ marginTop: "1.4rem" }}>
                  <button type="button" className="lib-btn lib-btn-primary" onClick={() => setPhase("quiz")}>Starta testet</button>
                </div>
              </div>
            )}

            {phase === "quiz" && (
              <div>
                <div className="lib-test__progress"><div className="lib-test__bar" style={{ width: `${Math.round((qi / QUESTIONS.length) * 100)}%` }} /></div>
                <p className="lib-test__count">Fråga {qi + 1} av {QUESTIONS.length}</p>
                <p className="lib-test__q">{QUESTIONS[qi].q}</p>
                <div className="lib-test__opts">
                  {OPTIONS.map((opt, v) => (
                    <button type="button" key={v} className={`lib-test__opt${answers[qi] === v ? " is-sel" : ""}`} onClick={() => pick(v)}>{opt}</button>
                  ))}
                </div>
                <div className="lib-test__nav">
                  <button type="button" className="lib-test__back" onClick={() => setQi(Math.max(0, qi - 1))} disabled={qi === 0} style={{ opacity: qi === 0 ? 0.4 : 1 }}>← Tillbaka</button>
                  <span className="lib-small">Välj det som stämmer bäst</span>
                </div>
              </div>
            )}

            {phase === "contact" && (
              <form onSubmit={submit}>
                <div className="lib-test__progress"><div className="lib-test__bar" style={{ width: "100%" }} /></div>
                <p className="lib-test__count">Sista steget</p>
                <h3 style={{ fontFamily: "'Spectral',Georgia,serif", fontWeight: 400, fontSize: "clamp(1.4rem,1.2rem+.8vw,1.85rem)", margin: "0 0 1.2rem", color: "var(--ink)" }}>Var ska jag skicka din profil?</h3>
                <div className="lib-field"><label htmlFor="nt-name">Namn</label><input id="nt-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="lib-field"><label htmlFor="nt-email">E-post</label><input id="nt-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="lib-test__nav">
                  <button type="button" className="lib-test__back" onClick={() => setPhase("quiz")}>← Tillbaka</button>
                  <button type="submit" className="lib-btn lib-btn-primary" disabled={sending}>{sending ? "Räknar ut…" : "Visa min profil"}</button>
                </div>
                <p className="lib-small" style={{ marginTop: "1rem" }}>Du får din profil på skärmen direkt — och en kopia i inkorgen.</p>
              </form>
            )}

            {phase === "result" && profile && (
              <div className="lib-test__result">
                <p className="lib-eyebrow">Din profil</p>
                <h3>{profile.title}</h3>
                <p className="lib-prose" style={{ marginTop: ".5rem" }}>{profile.body}</p>
                <p className="lib-eyebrow" style={{ marginTop: "1.6rem" }}>Tre första steg</p>
                <ul className="lib-test__steps">
                  {profile.steps.map((s, i) => (<li key={i}><Leaf size={15} /><span>{s}</span></li>))}
                </ul>
                <p className="lib-small" style={{ marginTop: "1.4rem" }}>Det här är en självskattning, inte en diagnos — den hjälper dig förstå var du är. Vill du gå vidare?</p>
                <div className="lib-hero__cta" style={{ marginTop: "1rem" }}>
                  <a href={withBase(base, "/programmen")} className="lib-btn lib-btn-primary">Se programmen</a>
                  <a href={withBase(base, "/kontakt")} className="lib-link-arrow">Hör av dig till Linda<ArrowIcon /></a>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </StyleHost>
  );
}
