"use client";

import { useState, useMemo } from "react";
import { Search, Copy, ExternalLink, Check, Home, Briefcase, Users, Target, Terminal, TrendingUp } from "lucide-react";

const HAKAN_COACH_ID = "8c99b995-90c2-41fb-b12e-3f3d2469df77";
const COACH_BASE = "https://mysales-coach.netlify.app";
const COACH_LINK = (path: string) => `${COACH_BASE}${path}?coach=${HAKAN_COACH_ID}`;

type Tag = "live" | "dev" | "legacy" | "client" | "mine";

interface Row {
  name: string;
  detail: string;
  copy?: string;
  href?: string;
  hrefLabel?: string;
}

interface Card {
  title: string;
  tag?: { label: string; kind: Tag };
  col: 4 | 6 | 12;
  search: string;
  rows: Row[];
}

const TAG_STYLES: Record<Tag, string> = {
  live: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  dev: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  legacy: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  client: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  mine: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
};

const COL_CLASS: Record<number, string> = {
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  12: "lg:col-span-12",
};

// ──────────────── DATA (utan känslig info — kan visas publikt) ─────────────────

const APPS: Card[] = [
  {
    title: "MySales Coach",
    tag: { label: "Coach", kind: "mine" },
    col: 6,
    search: "mysales coach pionjär offert prospekt lobby",
    rows: [
      { name: "Coach (live)", detail: "Djup-vyn — lobby, offerter, prospekt", href: COACH_LINK("/"), hrefLabel: "Öppna" },
      { name: "Lobby", detail: "DM-uppföljning, hot leads", href: COACH_LINK("/lobby"), hrefLabel: "Öppna" },
      { name: "Offerter", detail: "Skapa & spåra offerter", href: COACH_LINK("/quotes"), hrefLabel: "Öppna" },
      { name: "Prospekt", detail: "Kalla leads, segment", href: COACH_LINK("/prospects"), hrefLabel: "Öppna" },
    ],
  },
  {
    title: "Cockpit (du är här)",
    tag: { label: "Brand", kind: "mine" },
    col: 6,
    search: "cockpit gripcoaching klient multi-tenant linkedin seo mejl",
    rows: [
      { name: "LinkedIn-motor", detail: "Pelare → idé → post", href: "/dashboard/linkedin", hrefLabel: "Öppna" },
      { name: "SEO & AEO", detail: "Audit, GEO, schema", href: "/dashboard/seo", hrefLabel: "Öppna" },
      { name: "Mejl-motor", detail: "Kampanjer, sekvenser", href: "/dashboard/mejl", hrefLabel: "Öppna" },
      { name: "Brand-profil", detail: "Voice fingerprint, story", href: "/dashboard/profil", hrefLabel: "Öppna" },
    ],
  },
  {
    title: "Säljmaskinen (widgets)",
    tag: { label: "Embed", kind: "mine" },
    col: 6,
    search: "säljmaskinen widget embed offerter uppfoljning lobby prospekt",
    rows: [
      { name: "Sajt", detail: "16 widgets för GHL-dashboard", href: "https://saljmaskinen.netlify.app", hrefLabel: "Öppna" },
      { name: "Lobby (widget)", detail: "Mini-vy för MySales-dashboard", href: "https://saljmaskinen.netlify.app/embed/lobby", hrefLabel: "Öppna" },
      { name: "Offerter (widget)", detail: "Mini-vy", href: "https://saljmaskinen.netlify.app/embed/offerter", hrefLabel: "Öppna" },
      { name: "Uppföljning (widget)", detail: "Mini-vy", href: "https://saljmaskinen.netlify.app/embed/uppfoljning", hrefLabel: "Öppna" },
    ],
  },
  {
    title: "Supplier Quotes",
    tag: { label: "Inkommande", kind: "mine" },
    col: 6,
    search: "supplier quote leverantör led skärm offert priser whatsapp",
    rows: [
      { name: "Sajt", detail: "WhatsApp-AI parser för leverantörsoffert", href: "https://supplier-quotes-displayteknik.netlify.app", hrefLabel: "Öppna" },
      { name: "Funktion", detail: "Strukturerar inköpsprocessen från 10+ leverantörer" },
    ],
  },
  {
    title: "MySales publika sajten",
    tag: { label: "Ej deployad", kind: "dev" },
    col: 6,
    search: "mysales publik sajt blogg kurser onboarding",
    rows: [
      { name: "Gammal sajt", detail: "mysales.se (ClientClub)", href: "https://mysales.se", hrefLabel: "Öppna" },
      { name: "Ny version (lokal)", detail: "Next.js 16, blogg + kurser + onboarding" },
    ],
  },
  {
    title: "GripCoaching marknadssajt",
    tag: { label: "Live", kind: "live" },
    col: 6,
    search: "gripcoaching marknadssajt mysales saleschallenge",
    rows: [
      { name: "Sajt", detail: "Säljer SalesChallenge + MySales + Säljmaskinen", href: "https://gripcoaching-site-9hkhmdvak-hakan-3413s-projects.vercel.app", hrefLabel: "Öppna" },
      { name: "Produkter", detail: "SalesChallenge gratis · MySales 700 · Säljmaskinen 1 990/2 490" },
    ],
  },
];

const CLIENTS: Card[] = [
  {
    title: "Darek Uhrberg",
    tag: { label: "Klient", kind: "client" },
    col: 6,
    search: "darek uhrberg konstnär",
    rows: [
      { name: "Sajt (live)", detail: "darekuhrberg.se", href: "https://darekuhrberg.se", hrefLabel: "Öppna" },
      { name: "Status", detail: "Live som Cockpit-klient · art_works + art_exhibitions" },
    ],
  },
  {
    title: "Engens Träd & Trädgård",
    tag: { label: "Klient", kind: "client" },
    col: 6,
    search: "engens träd trädfällning rickard",
    rows: [
      { name: "Sajt", detail: "engenstrad.se (Loopia, rörs ej)", href: "https://engenstrad.se", hrefLabel: "Öppna" },
      { name: "Status", detail: "Onboardad · 10 winning examples · Roslagen" },
    ],
  },
  {
    title: "Opticur",
    tag: { label: "Klient", kind: "client" },
    col: 6,
    search: "opticur ingela ögonläkare",
    rows: [
      { name: "Status", detail: "Fullt laddad — 12 brand + 5 pelare + 12 signaturer + 16 voice" },
      { name: "Lokal sajt", detail: "Opticur BVD (lokal demo)" },
    ],
  },
  {
    title: "Ledarskapskultur",
    tag: { label: "Klient", kind: "client" },
    col: 6,
    search: "ledarskapskultur zetterman carl-fredrik ugl",
    rows: [
      { name: "Sajt", detail: "ledarskapskultur.se (rörs ej)", href: "https://ledarskapskultur.se", hrefLabel: "Öppna" },
      { name: "Kontakt", detail: "Carl-Fredrik Zetterman · UGL-material" },
    ],
  },
  {
    title: "HM Motor Krokom",
    tag: { label: "Default", kind: "client" },
    col: 6,
    search: "hm motor krokom default cockpit",
    rows: [
      { name: "Roll", detail: "Default-klient i Cockpit (template)" },
    ],
  },
  {
    title: "Scandinavian Hay Days",
    tag: { label: "Klient", kind: "client" },
    col: 6,
    search: "scandinavian haydays söderhamn nils norberg",
    rows: [
      { name: "Sajt", detail: "Folkfest 31/7–2/8 2026 Söderhamn", href: "https://scandinavian-haydays.netlify.app", hrefLabel: "Öppna" },
      { name: "Kontakt", detail: "Nils Norberg" },
    ],
  },
];

const COMMANDS: Card[] = [
  {
    title: "Starta lokalt",
    col: 6,
    search: "dev lokal start npm port",
    rows: [
      { name: "Cockpit", detail: "port 3000", copy: "cd Antigravity/hmmotor-next && npm run dev" },
      { name: "Coach", detail: "port 3465", copy: "cd Antigravity/mysales-coach-pionjar && npm run dev" },
      { name: "Säljmaskinen", detail: "Next.js", copy: "cd Antigravity/saljmaskinen && npm run dev" },
      { name: "MySales publika sajt", detail: "port 3490", copy: "cd Antigravity/mysales-site && npm run dev" },
      { name: "GripCoaching-site", detail: "port 3494", copy: "cd Antigravity/gripcoaching-site && npm run dev" },
    ],
  },
  {
    title: "Deploy",
    col: 6,
    search: "deploy netlify build kommando",
    rows: [
      { name: "Cockpit", detail: "git push (auto-deploy)", copy: "cd Antigravity/hmmotor-next && git push" },
      { name: "Säljmaskinen", detail: "git push (auto)", copy: "cd Antigravity/saljmaskinen && git push" },
      { name: "Coach", detail: "Netlify CLI (manuell)" },
    ],
  },
];

// ──────────────── AFFÄRSPLAN ─────────────────

interface Brand {
  name: string;
  url: string;
  fokus: string;
  målgrupp: string;
  produkter: { namn: string; pris: string; vad: string }[];
}

const BRANDS: Brand[] = [
  {
    name: "GripCoaching",
    url: "gripcoaching.se",
    fokus: "Säljmotor — system + coachning",
    målgrupp: "Svenska småföretagare som vill sälja mer",
    produkter: [
      { namn: "SalesChallenge", pris: "Gratis", vad: "Hook · introducerar dem till din värld" },
      { namn: "MySales", pris: "700 kr/mån", vad: "White-label GHL · CRM, kalender, mejl, automation" },
      { namn: "Säljmaskinen pionjär", pris: "1 990–2 490 kr/mån", vad: "MySales + 16 widgets + Coach + community" },
      { namn: "Säljmotorn (nästa)", pris: "TBD — 5–10 000 kr/mån?", vad: "Säljmaskinen + Cockpit content/SEO/LinkedIn + 1:1 coaching" },
    ],
  },
  {
    name: "MySales",
    url: "mysales.se",
    fokus: "Verktyget (white-label GHL)",
    målgrupp: "Småföretagare som behöver ETT system istället för 5",
    produkter: [
      { namn: "MySales", pris: "700 kr/mån", vad: "Hemsida + kursplattform + mejl + bokning + automation" },
      { namn: "Onboarding-paket", pris: "Engångs", vad: "Setup, mallar, första kampanjen" },
    ],
  },
  {
    name: "Displayteknik",
    url: "displayteknik.se",
    fokus: "LED-skärmar & digital skyltning",
    målgrupp: "Butik · event · byrå · fastighet · logistik",
    produkter: [
      { namn: "LED-skärmar inomhus/utomhus", pris: "Per projekt", vad: "Sälj + installation + service" },
      { namn: "Digital skyltning", pris: "Per projekt", vad: "Helhetslösning" },
    ],
  },
];

// ──────────────── COMPONENTS ─────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        } catch {}
      }}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition"
    >
      {ok ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {ok ? "Kopierad" : "Copy"}
    </button>
  );
}

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {cards.map((card) => (
        <div key={card.title} className={`${COL_CLASS[card.col]} bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{card.title}</h3>
            {card.tag && (
              <span className={`text-[10px] px-2 py-0.5 rounded ring-1 font-semibold uppercase tracking-wider ${TAG_STYLES[card.tag.kind]}`}>
                {card.tag.label}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-800">
            {card.rows.map((row, i) => (
              <div key={i} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-100 truncate">{row.name}</div>
                  <div className="text-xs text-slate-500 truncate">{row.detail}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {row.copy && <CopyBtn text={row.copy} />}
                  {row.href && (
                    <a href={row.href} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30 hover:bg-teal-500/25">
                      <ExternalLink className="w-3 h-3" />
                      {row.hrefLabel || "Öppna"}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────── PAGE ─────────────────

const TABS = [
  { id: "idag", label: "Idag", icon: Home },
  { id: "appar", label: "Mina appar", icon: Briefcase },
  { id: "klienter", label: "Klienter", icon: Users },
  { id: "affarsplan", label: "Affärsplan", icon: TrendingUp },
  { id: "kommandon", label: "Kommandon", icon: Terminal },
] as const;
type TabId = typeof TABS[number]["id"];

export default function HQPage() {
  const [tab, setTab] = useState<TabId>("idag");
  const [query, setQuery] = useState("");

  const filter = (cards: Card[]) => {
    const term = query.toLowerCase().trim();
    if (!term) return cards;
    return cards.filter((c) => {
      const hay = (c.search + " " + c.title + " " + c.rows.map((r) => `${r.name} ${r.detail}`).join(" ")).toLowerCase();
      return hay.includes(term);
    });
  };

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-6 min-h-screen bg-slate-950 text-slate-100 px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-500 to-yellow-700 grid place-items-center text-yellow-950 font-bold text-lg shadow-lg shadow-yellow-500/20">
              HG
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">HQ — Håkan Grip</h1>
              <p className="text-xs text-slate-500">Allt på ett ställe · 2026-05-21</p>
            </div>
          </div>
          {tab !== "affarsplan" && tab !== "idag" && (
            <div className="relative flex-1 max-w-md min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sök..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-5 border-b border-slate-800 pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 -mb-px text-sm font-medium rounded-t-md border-b-2 inline-flex items-center gap-2 transition ${
                  active
                    ? "border-yellow-500 text-yellow-400 bg-slate-900/50"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* IDAG */}
        {tab === "idag" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-yellow-950/30 p-5">
              <h3 className="text-base font-semibold mb-1">🎯 Displayteknik — dagens genväg</h3>
              <p className="text-xs text-slate-400 mb-3">Hela ditt sälj-flöde, en klick bort</p>
              <div className="flex flex-wrap gap-2">
                <a href={COACH_LINK("/")} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-yellow-500 text-yellow-950 text-xs font-semibold hover:bg-yellow-400">Coach Dashboard</a>
                <a href={COACH_LINK("/lobby")} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-teal-500 text-teal-950 text-xs font-semibold hover:bg-teal-400">Lobby (DM)</a>
                <a href={COACH_LINK("/quotes")} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700">Offerter</a>
                <a href={COACH_LINK("/prospects")} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700">Prospekt</a>
                <a href={COACH_LINK("/customers")} target="_blank" rel="noopener" className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700">Kunder</a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="https://saljmaskinen.netlify.app" target="_blank" rel="noopener" className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-4 transition">
                <div className="text-xs text-slate-500 mb-1">Widgets</div>
                <div className="text-base font-semibold mb-1">Säljmaskinen</div>
                <div className="text-xs text-slate-400">16 widgets för GHL-dashboarden</div>
              </a>
              <a href="https://supplier-quotes-displayteknik.netlify.app" target="_blank" rel="noopener" className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-4 transition">
                <div className="text-xs text-slate-500 mb-1">Inköp</div>
                <div className="text-base font-semibold mb-1">Supplier Quotes</div>
                <div className="text-xs text-slate-400">Strukturera offerter från leverantörer</div>
              </a>
              <a href="https://app.gohighlevel.com" target="_blank" rel="noopener" className="bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl p-4 transition">
                <div className="text-xs text-slate-500 mb-1">CRM-bas</div>
                <div className="text-base font-semibold mb-1">MySales / GHL</div>
                <div className="text-xs text-slate-400">Kontakter, kalender, mejl, automation</div>
              </a>
            </div>
          </div>
        )}

        {/* APPAR */}
        {tab === "appar" && <CardGrid cards={filter(APPS)} />}

        {/* KLIENTER */}
        {tab === "klienter" && <CardGrid cards={filter(CLIENTS)} />}

        {/* KOMMANDON */}
        {tab === "kommandon" && <CardGrid cards={filter(COMMANDS)} />}

        {/* AFFÄRSPLAN */}
        {tab === "affarsplan" && (
          <div className="space-y-6">
            {/* Vision */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-2">Vision</div>
              <h2 className="text-lg font-bold mb-2">Hjälpa svenska småföretagare sälja mer — med system + coachning, inte bara verktyg.</h2>
              <p className="text-sm text-slate-400">Tre varumärken som spelar olika roller. En kund kan börja på SalesChallenge gratis och växa hela vägen till Säljmotorn.</p>
            </div>

            {/* Trappan */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-3">Värdetrappan (kundens resa)</div>
              <div className="space-y-2.5">
                {[
                  { steg: "1", namn: "SalesChallenge", pris: "Gratis", roll: "Hook — visa värde, bygg lista", color: "bg-slate-500/10 text-slate-300 ring-slate-500/30" },
                  { steg: "2", namn: "MySales", pris: "700 kr/mån", roll: "Bas-systemet — CRM, mejl, kalender, automation", color: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" },
                  { steg: "3", namn: "Säljmaskinen pionjär", pris: "1 990–2 490 kr/mån", roll: "MySales + 16 widgets + Coach + community", color: "bg-teal-500/10 text-teal-300 ring-teal-500/30" },
                  { steg: "4", namn: "Säljmotorn (nästa)", pris: "5 000–10 000 kr/mån", roll: "Säljmaskinen + Cockpit content/SEO/LinkedIn + 1:1 coachning", color: "bg-yellow-500/10 text-yellow-300 ring-yellow-500/30" },
                ].map((row) => (
                  <div key={row.steg} className="flex items-center gap-4 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className={`w-9 h-9 rounded-lg ring-1 grid place-items-center text-sm font-bold shrink-0 ${row.color}`}>
                      {row.steg}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-base">{row.namn}</span>
                        <span className="text-xs text-slate-500">{row.pris}</span>
                      </div>
                      <div className="text-xs text-slate-400">{row.roll}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tre varumärken */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-3">Tre varumärken — separata roller</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {BRANDS.map((b) => (
                  <div key={b.name} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-base font-bold">{b.name}</h3>
                      <a href={`https://${b.url}`} target="_blank" rel="noopener" className="text-[11px] text-teal-400 hover:text-teal-300">{b.url}</a>
                    </div>
                    <div className="text-xs text-slate-500 mb-1">{b.fokus}</div>
                    <div className="text-xs text-slate-400 mb-3">Målgrupp: {b.målgrupp}</div>
                    <div className="space-y-2 mt-auto">
                      {b.produkter.map((p, i) => (
                        <div key={i} className="text-xs border-t border-slate-800 pt-2">
                          <div className="flex justify-between font-medium text-slate-200">
                            <span>{p.namn}</span>
                            <span className="text-slate-500">{p.pris}</span>
                          </div>
                          <div className="text-slate-500 mt-0.5">{p.vad}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fokus nästa */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-yellow-950/20 border border-yellow-500/20 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-3">Fokus framåt</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="font-semibold text-yellow-300 mb-1">🎯 Bygg "Säljmotorn" (steg 4)</div>
                  <p className="text-slate-400 text-xs">Säljmaskinen + Cockpit-modul som kopplar GHL-kontakter ↔ Supplier Quotes-priser ↔ DM-utkast i din röst ↔ automatiska follow-ups. Premium-tier 5–10 000 kr/mån.</p>
                </div>
                <div>
                  <div className="font-semibold text-yellow-300 mb-1">🔗 EN URL = en upplevelse</div>
                  <p className="text-slate-400 text-xs">Idag är Coach + Säljmaskinen + Supplier Quotes på tre olika domäner. Samla under cockpit.gripcoaching.se eller mysales.se så friktionen försvinner.</p>
                </div>
                <div>
                  <div className="font-semibold text-yellow-300 mb-1">📊 Lös prospect-data</div>
                  <p className="text-slate-400 text-xs">Säljmaskinen Listor är manuell beställning. Integrera Apollo/Lusha-API eller bygg Sverige-dataset (BolagsKollen + LinkedIn) för att matcha Leedflow-nivå.</p>
                </div>
                <div>
                  <div className="font-semibold text-yellow-300 mb-1">💼 DNS-byte gripcoaching.se</div>
                  <p className="text-slate-400 text-xs">Sajten ligger fortfarande på ClientClub. Flytta DNS till Vercel så nya gripcoaching-site blir live på huvuddomänen.</p>
                </div>
              </div>
            </div>

            {/* Beslutsregler */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-500 mb-3">Beslutsregler (luta dig mot detta)</div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex gap-2"><span className="text-yellow-500">→</span><span><strong className="text-slate-100">MVP först.</strong> Lansera v1 som funkar, iterera. Vänta inte på perfekt.</span></li>
                <li className="flex gap-2"><span className="text-yellow-500">→</span><span><strong className="text-slate-100">Standardisera.</strong> För varje lösning — kan det bli mall/SOP/produkt för flera kunder?</span></li>
                <li className="flex gap-2"><span className="text-yellow-500">→</span><span><strong className="text-slate-100">Blanda inte varumärken.</strong> mysales / gripcoaching / displayteknik = tre separata roller.</span></li>
                <li className="flex gap-2"><span className="text-yellow-500">→</span><span><strong className="text-slate-100">Coach + system, inte bara verktyg.</strong> Det är skillnaden mot Leedflow et al.</span></li>
                <li className="flex gap-2"><span className="text-yellow-500">→</span><span><strong className="text-slate-100">Höj priset eller smalna scopet.</strong> Säljmaskinen 2 490 kr/mån måste matcha produkt-polish — annars förlorar du på jämförelse.</span></li>
              </ul>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-600 pt-8 mt-8 border-t border-slate-800">
          HQ · modul i Cockpit · uppdatera via <code className="text-slate-500">app/dashboard/hq/page.tsx</code>
        </div>
      </div>
    </div>
  );
}
