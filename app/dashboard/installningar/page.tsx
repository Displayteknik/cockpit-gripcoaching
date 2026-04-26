"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Check, Globe, Search, Zap, BarChart3, Lock, Copy, Info, ExternalLink, Mail, Plug, Image as ImageIcon } from "lucide-react";
import GoogleConnect from "@/components/GoogleConnect";
import InstagramConnect from "@/components/InstagramConnect";

type Settings = Record<string, string>;

interface FieldDef {
  key: string;
  label: string;
  hint: string;
  placeholder?: string;
  type?: "text" | "password";
  link?: { url: string; label: string };
  generate?: () => string;
}

interface SectionDef {
  id: string;
  category: "integrations" | "seo" | "analytics" | "system";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  fields?: FieldDef[];
  customComponent?: "google" | "instagram";
}

const SECTIONS: SectionDef[] = [
  // INTEGRATIONS
  {
    id: "instagram",
    category: "integrations",
    title: "Instagram Graph API",
    icon: Plug,
    description: "Direct publish, schemaläggning, analytics. Kräver IG Business + Facebook Page.",
    customComponent: "instagram",
  },
  {
    id: "google",
    category: "integrations",
    title: "Google Search Console & Analytics",
    icon: Plug,
    description: "OAuth-anslutning per klient. Riktiga sökord, klick, visningar — direkt från Google.",
    customComponent: "google",
  },
  {
    id: "email",
    category: "integrations",
    title: "Email (Resend)",
    icon: Mail,
    description: "Mejlar godkännande-länkar och veckorapporter. RESEND_API_KEY sätts i Vercel env-vars.",
    fields: [
      { key: "report_recipients_info", label: "Mottagare per klient", hint: "Sätts på själva klienten (clients.report_recipients).", placeholder: "(lagras på klient-nivå)" },
    ],
  },
  // SEO
  {
    id: "domain",
    category: "seo",
    title: "Domän & sajt",
    icon: Globe,
    description: "Grunden — alla SEO-funktioner använder detta.",
    fields: [
      { key: "site_url", label: "Publik URL", hint: "Full URL till sajten", placeholder: "https://klient.se" },
      { key: "site_name", label: "Sajtnamn", hint: "Visas i sökresultat", placeholder: "Klient AB" },
    ],
  },
  {
    id: "gsc-verify",
    category: "seo",
    title: "Google Search Console verifiering",
    icon: Search,
    description: "Verifierings-meta-tagg om du inte vill koppla via OAuth. Annars använd integrationen ovan.",
    fields: [
      { key: "gsc_verification", label: "Verifierings-tagg", hint: "Värdet från content=\"...\" i meta-taggen.", placeholder: "abc123xyz...", link: { url: "https://search.google.com/search-console", label: "Öppna GSC" } },
    ],
  },
  {
    id: "bing",
    category: "seo",
    title: "Bing Webmaster Tools",
    icon: Search,
    description: "Komplettera Google. Stöder IndexNow för instant indexering.",
    fields: [
      { key: "bing_verification", label: "Bing verifierings-tagg", hint: "Från Bing WMT → Add Site → HTML Meta Tag.", placeholder: "msvalidate.01-värde", link: { url: "https://www.bing.com/webmasters", label: "Öppna Bing WMT" } },
    ],
  },
  {
    id: "indexnow",
    category: "seo",
    title: "IndexNow",
    icon: Zap,
    description: "Pinga Bing/Yandex direkt vid nytt innehåll. 32+ tecken nyckel.",
    fields: [
      { key: "indexnow_key", label: "IndexNow-nyckel", hint: "Klicka 'Generera' för slumpad nyckel.", placeholder: "8a3b...", generate: () => Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("") },
    ],
  },
  // ANALYTICS
  {
    id: "clarity",
    category: "analytics",
    title: "Microsoft Clarity",
    icon: BarChart3,
    description: "Heatmaps + session replays — gratis. Du SER vad besökare gör.",
    fields: [
      { key: "clarity_id", label: "Clarity Project ID", hint: "10-tecken ID från clarity.microsoft.com.", placeholder: "abc123xyz0", link: { url: "https://clarity.microsoft.com/", label: "Öppna Clarity" } },
    ],
  },
  {
    id: "analytics-other",
    category: "analytics",
    title: "Plausible (valfritt)",
    icon: BarChart3,
    description: "Inbyggd tracker körs redan. Plausible self-hosted är gratis om du vill ha mer.",
    fields: [
      { key: "plausible_domain", label: "Plausible-domän", hint: "Tom = avstängd.", placeholder: "klient.se" },
    ],
  },
  // SYSTEM
  {
    id: "cron",
    category: "system",
    title: "Cron-jobb",
    icon: Lock,
    description: "Vercel Cron schemalägger automatiserade jobb. CRON_SECRET sätts i Vercel env.",
    fields: [
      { key: "cron_status", label: "Status", hint: "Blogg-maskin: mån/ons/fre 07:00. Schemaläggare: dagligen 07:00 (Hobby-plan).", placeholder: "(info-only)" },
    ],
  },
];

const CATEGORIES = [
  { id: "integrations" as const, label: "Integrationer", icon: Plug, desc: "Anslutningar till externa tjänster" },
  { id: "seo" as const, label: "SEO & sajt", icon: Search, desc: "Domän, sökmotorer, indexering" },
  { id: "analytics" as const, label: "Analytics", icon: BarChart3, desc: "Mätning och insikter" },
  { id: "system" as const, label: "System", icon: Lock, desc: "Cron, säkerhet, status" },
];

export default function InstallningarPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeCat, setActiveCat] = useState<typeof CATEGORIES[number]["id"]>("integrations");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d && !d.error) setSettings(d);
    });
  }, []);

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
    setSavedAt(null);
  }

  async function save() {
    setSaving(true);
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (r.ok) setSavedAt(new Date());
    else alert("Kunde inte spara.");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const filtered = SECTIONS.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.fields?.some((f) => f.label.toLowerCase().includes(q));
    }
    return s.category === activeCat;
  });

  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c.id] = SECTIONS.filter((s) => s.category === c.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-6 h-6 text-gray-700" />
            Inställningar
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Per-klient konfiguration. Alla värden sparas i klientens settings-tabell.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-blue-dark disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAt ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Sparar..." : savedAt ? "Sparat" : "Spara"}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök inställning... (t.ex. 'pixabay', 'analytics', 'domän')"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Side-tabs */}
        <div className={search ? "hidden" : "block"}>
          <div className="space-y-1 sticky top-20">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeCat === c.id
                    ? "bg-brand-blue/10 text-brand-blue font-semibold"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <c.icon className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1">
                    <div>{c.label}</div>
                    <div className={`text-[10px] ${activeCat === c.id ? "text-brand-blue/70" : "text-gray-400"}`}>{c.desc}</div>
                  </div>
                  <span className={`text-[10px] tabular-nums ${activeCat === c.id ? "text-brand-blue/70" : "text-gray-400"}`}>{counts[c.id]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 min-w-0">
          {filtered.length === 0 && (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
              Inget matchade sökningen.
            </div>
          )}
          {filtered.map((section) => (
            <div key={section.id} id={section.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-gray-900">{section.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                </div>
              </div>
              <div className="ml-12">
                {section.customComponent === "instagram" && <InstagramConnect />}
                {section.customComponent === "google" && <GoogleConnect />}
                {section.fields && (
                  <div className="space-y-4">
                    {section.fields.map((f) => (
                      <div key={f.key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-gray-700">{f.label}</label>
                          <div className="flex items-center gap-2">
                            {f.link && (
                              <a href={f.link.url} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                {f.link.label}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {f.generate && (
                              <button
                                onClick={() => update(f.key, f.generate!())}
                                className="text-xs text-purple-600 hover:bg-purple-50 px-2 py-0.5 rounded font-medium"
                              >
                                Generera
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400 mb-1">{f.hint}</div>
                        <div className="flex gap-2">
                          <input
                            type={f.type || "text"}
                            value={settings[f.key] || ""}
                            onChange={(e) => update(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            disabled={f.placeholder === "(info-only)"}
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                          />
                          {settings[f.key] && (
                            <button onClick={() => copy(settings[f.key])} className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Kopiera">
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {!search && activeCat === "system" && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-5">
              <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-purple-600" />
                Aktiva endpoints
              </h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/sitemap.xml</code> — auto-genereras från Supabase</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/robots.txt</code> — auto-genereras</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/track</code> — lättviktig analytics</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/indexnow</code> — pinga Bing/Yandex</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/seo/audit</code> — strukturell + PageSpeed</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/seo/content-audit</code> — Gemini AI-content-bedömning</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/scheduler/cron</code> — autopublicerar schemalagda inlägg</li>
                <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/blog/cron</code> — auto-skapar bloggartiklar</li>
              </ul>
            </div>
          )}

          {!search && activeCat === "integrations" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm">
              <div className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Bildgenerering
              </div>
              <div className="text-amber-900 space-y-1">
                <div><strong>Imagen 4.0 Fast</strong> (Google) — fungerar med <code className="bg-white px-1 rounded">GEMINI_API_KEY</code> som redan är satt.</div>
                <div><strong>FLUX 1.1</strong> (fal.ai) — sätt <code className="bg-white px-1 rounded">FAL_KEY</code> i Vercel env för bättre kvalitet.</div>
                <div><strong>Pexels stockfoton</strong> — sätt <code className="bg-white px-1 rounded">PEXELS_API_KEY</code> i Vercel env (gratis).</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
