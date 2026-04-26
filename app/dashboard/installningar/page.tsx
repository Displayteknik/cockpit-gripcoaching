"use client";

import { useEffect, useState } from "react";
import { Save, Loader2, Check, Globe, Search, Zap, BarChart3, Lock, Copy, Info, ExternalLink } from "lucide-react";
import GoogleConnect from "@/components/GoogleConnect";

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
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    title: "Domän & sajt",
    icon: Globe,
    description: "Grunden — alla SEO-funktioner använder detta.",
    fields: [
      { key: "site_url", label: "Publik URL", hint: "Full URL till sajten, t.ex. https://hmmotor.se", placeholder: "https://hmmotor.se" },
      { key: "site_name", label: "Sajtnamn", hint: "Visas i sökresultat", placeholder: "HM Motor Krokom" },
    ],
  },
  {
    title: "Google Search Console",
    icon: Search,
    description: "Lägg till verifierings-meta-tagg och verifiera sajten i GSC. Sen ser du vilka sökord som faktiskt drar trafik.",
    fields: [
      {
        key: "gsc_verification",
        label: "Verifierings-tagg (HTML-tag-metoden)",
        hint: "Klistra in värdet från content=\"...\" i meta-taggen GSC ger dig.",
        placeholder: "abc123xyz...",
        link: { url: "https://search.google.com/search-console", label: "Öppna GSC" },
      },
    ],
  },
  {
    title: "Bing Webmaster Tools",
    icon: Search,
    description: "Bing är gratis och stöder IndexNow för instant indexering. Liten trafik men hög konvertering.",
    fields: [
      {
        key: "bing_verification",
        label: "Bing verifierings-tagg",
        hint: "Från Bing Webmaster Tools → Add Site → HTML Meta Tag.",
        placeholder: "msvalidate.01-värde",
        link: { url: "https://www.bing.com/webmasters", label: "Öppna Bing WMT" },
      },
    ],
  },
  {
    title: "IndexNow",
    icon: Zap,
    description: "Pinga Bing/Yandex direkt när du publicerar nytt innehåll. Krävs en nyckel (slumpa fram en) och placera nyckel.txt på sajten.",
    fields: [
      {
        key: "indexnow_key",
        label: "IndexNow-nyckel",
        hint: "32+ tecken, alfanumerisk. Klicka 'Generera' om du saknar en.",
        placeholder: "8a3b...",
        generate: () => Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join(""),
      },
    ],
  },
  {
    title: "Microsoft Clarity",
    icon: BarChart3,
    description: "Gratis heatmaps + session replays. Du SER vad besökare gör. Skapa konto på clarity.microsoft.com → kopiera Project ID hit.",
    fields: [
      { key: "clarity_id", label: "Clarity Project ID", hint: "10-tecken ID från clarity.microsoft.com (Settings → Setup → 'Tracking code').", placeholder: "abc123xyz0", link: { url: "https://clarity.microsoft.com/", label: "Öppna Clarity" } },
    ],
  },
  {
    title: "Analytics (övrigt)",
    icon: BarChart3,
    description: "Inbyggd lättviktig tracker körs redan. GA4 kopplas via Google-OAuth ovan.",
    fields: [
      { key: "plausible_domain", label: "Plausible-domän (valfritt)", hint: "Om du kör Plausible i parallell.", placeholder: "hmmotor.se" },
    ],
  },
  {
    title: "Email & rapporter",
    icon: BarChart3,
    description: "Resend används för att mejla godkännande-länkar och veckorapporter (3000 mail/månad gratis).",
    fields: [
      { key: "report_recipients_info", label: "Standard-mottagare för rapporter", hint: "Sätts på själva klienten (clients.report_recipients) — kommaseparerade emails. Veckorapport-fliken låter dig skriva in mottagare per gång.", placeholder: "(lagras på klient-nivå)" },
    ],
  },
  {
    title: "Cron & säkerhet",
    icon: Lock,
    description: "CRON_SECRET sätts i Vercel env-vars (inte här) — här bara visat.",
    fields: [
      { key: "cron_status", label: "Cron-status (info)", hint: "Mån/Ons/Fre 07:00 körs blogg-maskinen. CRON_SECRET sätts i Vercel.", placeholder: "(info-only)" },
    ],
  },
];

export default function InstallningarPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

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

  const indexnowFile = settings.indexnow_key ? `${settings.indexnow_key}.txt — innehåller bara nyckeln` : null;

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Inställningar</h1>
          <p className="text-gray-500 text-sm mt-1">
            Strukturerade integrationer för synlighet. Allt gratis.
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

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-gray-900">Google Search Console &amp; Analytics</h2>
            <p className="text-xs text-gray-500 mt-0.5">OAuth-anslutning per klient. Riktiga sökord, klick, visningar — direkt från Google. Ingen CSV.</p>
          </div>
        </div>
        <div className="ml-12">
          <GoogleConnect />
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <section.icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-gray-900">{section.title}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
            </div>
          </div>
          <div className="space-y-4 ml-12">
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
        </div>
      ))}

      {/* Action area */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-5">
        <h3 className="font-display font-bold text-gray-900 flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-purple-600" />
          Aktiva endpoints
        </h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/sitemap.xml</code> — auto-genereras från Supabase (fordon + blogg + sidor)</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/robots.txt</code> — auto-genereras, blockerar /admin /dashboard /api</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/track</code> — lättviktig analytics (filtrerar bottar)</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/indexnow</code> — pinga Bing/Yandex om nya URL:er</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded text-xs">/api/seo/audit</code> — hämtar URL, analyserar, kör PageSpeed</li>
          {indexnowFile && (
            <li className="pt-2 border-t border-purple-200">
              <strong>OBS:</strong> Skapa <code className="bg-white px-1.5 py-0.5 rounded text-xs">/public/{settings.indexnow_key}.txt</code> med innehållet <code className="bg-white px-1.5 py-0.5 rounded text-xs">{settings.indexnow_key}</code> för IndexNow-verifiering.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
