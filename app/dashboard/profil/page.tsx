"use client";

import { useEffect, useState } from "react";
import { Save, Sparkles, Wand2, Loader2, Check, Building2, User, Target, MessageSquare, AlertCircle } from "lucide-react";

interface Profile {
  company_name: string;
  tagline: string;
  location: string;
  founder_name: string;
  founder_phone: string;
  founder_email: string;
  brand_story: string;
  usp: string;
  tone_rules: string;
  icp_primary: string;
  icp_secondary: string;
  pain_points: string;
  dos: string;
  donts: string;
  hashtags_base: string;
  updated_at?: string;
}

const EMPTY: Profile = {
  company_name: "", tagline: "", location: "",
  founder_name: "", founder_phone: "", founder_email: "",
  brand_story: "", usp: "", tone_rules: "",
  icp_primary: "", icp_secondary: "", pain_points: "",
  dos: "", donts: "", hashtags_base: "",
};

export default function ProfilPage() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [assisting, setAssisting] = useState<string | null>(null);
  const [showIcpWizard, setShowIcpWizard] = useState(false);
  const [showToneWizard, setShowToneWizard] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (d && !d.error) setProfile({ ...EMPTY, ...d });
    });
  }, []);

  const update = (field: keyof Profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  async function save() {
    setSaving(true);
    const r = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    if (r.ok) setSavedAt(new Date());
    else alert("Kunde inte spara.");
  }

  async function assistField(field: keyof Profile) {
    setAssisting(field);
    try {
      const r = await fetch("/api/profile/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "section",
          field,
          current: profile[field],
          context: {
            company_name: profile.company_name,
            location: profile.location,
            tagline: profile.tagline,
            usp: profile.usp,
            icp_primary: profile.icp_primary,
          },
        }),
      });
      const d = await r.json();
      if (d.text) update(field, d.text);
      else alert("Fel: " + (d.error || "okänt"));
    } finally {
      setAssisting(null);
    }
  }

  const completion = calcCompletion(profile);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Brand-profil</h1>
          <p className="text-gray-500 text-sm mt-1">
            Grunden för all AI-output. Generatorer och coach läser detta automatiskt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-gray-400">Komplett</div>
            <div className="text-lg font-bold text-gray-900">{completion}%</div>
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
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setShowIcpWizard(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Wand2 className="w-4 h-4" />
          ICP-wizard
        </button>
        <button
          onClick={() => setShowToneWizard(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
        >
          <MessageSquare className="w-4 h-4" />
          Ton-wizard
        </button>
      </div>

      <Section title="Grundinfo" icon={Building2}>
        <Row>
          <Field label="Företagsnamn" value={profile.company_name} onChange={(v) => update("company_name", v)} />
          <Field label="Tagline" value={profile.tagline} onChange={(v) => update("tagline", v)} />
        </Row>
        <Row>
          <Field label="Plats" value={profile.location} onChange={(v) => update("location", v)} placeholder="Krokom, Jämtland" />
          <Field label="Grundare" value={profile.founder_name} onChange={(v) => update("founder_name", v)} />
        </Row>
        <Row>
          <Field label="Telefon" value={profile.founder_phone} onChange={(v) => update("founder_phone", v)} />
          <Field label="E-post" value={profile.founder_email} onChange={(v) => update("founder_email", v)} />
        </Row>
      </Section>

      <Section title="Berättelsen" icon={User}>
        <TextArea
          label="Brand story"
          hint="2–4 stycken — varför företaget finns, hur det började, vad som gör det speciellt."
          value={profile.brand_story}
          onChange={(v) => update("brand_story", v)}
          onAssist={() => assistField("brand_story")}
          assisting={assisting === "brand_story"}
          rows={6}
        />
        <TextArea
          label="USP — det som skiljer er"
          hint="Vad konkurrenterna INTE har / gör."
          value={profile.usp}
          onChange={(v) => update("usp", v)}
          onAssist={() => assistField("usp")}
          assisting={assisting === "usp"}
          rows={4}
        />
      </Section>

      <Section title="Målgrupp" icon={Target}>
        <TextArea
          label="Primär ICP"
          hint="Ditt bästa segment — demografi, geografi, smärtpunkter, köpbeteende, triggers."
          value={profile.icp_primary}
          onChange={(v) => update("icp_primary", v)}
          onAssist={() => assistField("icp_primary")}
          assisting={assisting === "icp_primary"}
          rows={6}
        />
        <TextArea
          label="Sekundär ICP"
          hint="Mindre men viktig målgrupp."
          value={profile.icp_secondary}
          onChange={(v) => update("icp_secondary", v)}
          onAssist={() => assistField("icp_secondary")}
          assisting={assisting === "icp_secondary"}
          rows={4}
        />
        <TextArea
          label="Smärtpunkter"
          hint="Vad kunden oroar sig för — formulerat som de själva skulle säga det."
          value={profile.pain_points}
          onChange={(v) => update("pain_points", v)}
          onAssist={() => assistField("pain_points")}
          assisting={assisting === "pain_points"}
          rows={5}
        />
      </Section>

      <Section title="Ton & språk" icon={MessageSquare}>
        <TextArea
          label="Tonregler"
          hint="Hur ni låter när ni är som bäst. Konkreta regler med GÖR / GÖR INTE."
          value={profile.tone_rules}
          onChange={(v) => update("tone_rules", v)}
          onAssist={() => assistField("tone_rules")}
          assisting={assisting === "tone_rules"}
          rows={6}
        />
        <Row>
          <TextArea
            label="GÖR"
            value={profile.dos}
            onChange={(v) => update("dos", v)}
            onAssist={() => assistField("dos")}
            assisting={assisting === "dos"}
            rows={4}
          />
          <TextArea
            label="GÖR INTE"
            value={profile.donts}
            onChange={(v) => update("donts", v)}
            onAssist={() => assistField("donts")}
            assisting={assisting === "donts"}
            rows={4}
          />
        </Row>
        <TextArea
          label="Hashtag-bas"
          hint="10–15 relevanta hashtags separerade med mellanslag."
          value={profile.hashtags_base}
          onChange={(v) => update("hashtags_base", v)}
          rows={2}
        />
      </Section>

      {profile.updated_at && (
        <div className="text-xs text-gray-400">
          Senast uppdaterad: {new Date(profile.updated_at).toLocaleString("sv-SE")}
        </div>
      )}

      {showIcpWizard && (
        <IcpWizard
          seed={profile}
          onDone={(result) => {
            setProfile((p) => ({
              ...p,
              icp_primary: result.primary,
              icp_secondary: result.secondary,
              pain_points: result.pain_points,
              hashtags_base: result.hashtags_base,
            }));
            setShowIcpWizard(false);
          }}
          onClose={() => setShowIcpWizard(false)}
        />
      )}

      {showToneWizard && (
        <ToneWizard
          seed={profile}
          onDone={(tone_rules) => {
            update("tone_rules", tone_rules);
            setShowToneWizard(false);
          }}
          onClose={() => setShowToneWizard(false)}
        />
      )}
    </div>
  );
}

function calcCompletion(p: Profile): number {
  const fields: (keyof Profile)[] = [
    "company_name", "tagline", "location", "founder_name",
    "brand_story", "usp", "tone_rules", "icp_primary",
    "icp_secondary", "pain_points", "dos", "donts", "hashtags_base",
  ];
  const filled = fields.filter((f) => (p[f] || "").toString().trim().length > 10).length;
  return Math.round((filled / fields.length) * 100);
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="font-display font-bold text-gray-900 flex items-center gap-2">
        <Icon className="w-5 h-5 text-brand-blue" />
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none"
      />
    </div>
  );
}

function TextArea({ label, hint, value, onChange, onAssist, assisting, rows = 4 }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  onAssist?: () => void; assisting?: boolean; rows?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {onAssist && (
          <button
            onClick={onAssist}
            disabled={assisting}
            className="flex items-center gap-1 text-xs text-purple-600 hover:bg-purple-50 px-2 py-1 rounded disabled:opacity-50 font-medium"
          >
            {assisting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI-fyll
          </button>
        )}
      </div>
      {hint && <div className="text-xs text-gray-400 mb-1">{hint}</div>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none font-body leading-relaxed"
      />
    </div>
  );
}

function IcpWizard({ seed, onDone, onClose }: { seed: Profile; onDone: (r: { primary: string; secondary: string; pain_points: string; hashtags_base: string }) => void; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    company_name: seed.company_name,
    location: seed.location,
    industry: "",
    offer: "",
    current_buyers: "",
    dream_buyers: "",
    price_range: "",
    extra: "",
  });

  const questions = [
    { key: "industry", label: "Bransch?", placeholder: "t.ex. bilhandel, coaching, frisör" },
    { key: "offer", label: "Vad säljer ni — kort?", placeholder: "t.ex. begagnade bilar, ATV, släp" },
    { key: "current_buyers", label: "Vem köper mest idag?", placeholder: "ålder, kön, plats, yrke" },
    { key: "dream_buyers", label: "Vem skulle ni gärna sälja MER till?", placeholder: "dröm-kunden" },
    { key: "price_range", label: "Prisklass?", placeholder: "t.ex. 50–300 tkr" },
    { key: "extra", label: "Något annat viktigt? (valfritt)", placeholder: "säsong, lokal kontext..." },
  ] as const;

  async function run() {
    setLoading(true);
    const r = await fetch("/api/profile/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "icp", inputs }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.primary) {
      const toStr = (v: unknown): string => typeof v === "string" ? v : Array.isArray(v) ? v.map(toStr).join("\n\n") : v && typeof v === "object" ? Object.entries(v).map(([k,vv]) => `${k}: ${toStr(vv)}`).join("\n") : String(v || "");
      onDone({
        primary: toStr(d.primary),
        secondary: toStr(d.secondary),
        pain_points: toStr(d.pain_points),
        hashtags_base: toStr(d.hashtags_base),
      });
    } else alert("Fel: " + (d.error || "okänt"));
  }

  const q = questions[step];
  const isLast = step === questions.length - 1;

  return (
    <Modal onClose={onClose} title="ICP-wizard">
      <div className="mb-4 flex items-center gap-2">
        {questions.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded ${i <= step ? "bg-purple-600" : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="text-xs text-gray-400 mb-1">Fråga {step + 1} av {questions.length}</div>
      <div className="text-lg font-display font-bold text-gray-900 mb-3">{q.label}</div>
      <textarea
        value={inputs[q.key]}
        onChange={(e) => setInputs({ ...inputs, [q.key]: e.target.value })}
        placeholder={q.placeholder}
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
      />
      <div className="flex justify-between mt-4">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-30"
        >
          ← Tillbaka
        </button>
        {isLast ? (
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Bygg ICP
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
          >
            Nästa →
          </button>
        )}
      </div>
    </Modal>
  );
}

function ToneWizard({ seed, onDone, onClose }: { seed: Profile; onDone: (r: string) => void; onClose: () => void }) {
  const [examples, setExamples] = useState("");
  const [avoid, setAvoid] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const r = await fetch("/api/profile/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "tone",
        inputs: { company_name: seed.company_name, examples, avoid },
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.tone_rules) onDone(d.tone_rules);
    else alert("Fel: " + (d.error || "okänt"));
  }

  return (
    <Modal onClose={onClose} title="Ton-wizard">
      <div className="text-sm text-gray-600 mb-3">
        Klistra in 2–5 exempelmeningar som låter exakt som företaget ska låta.
      </div>
      <textarea
        value={examples}
        onChange={(e) => setExamples(e.target.value)}
        rows={6}
        placeholder='t.ex. "Tjena. Vi har hjälpt kunder i Krokom sedan 1990. Kom förbi så fixar vi det."'
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none mb-3"
      />
      <div className="text-sm text-gray-600 mb-2">Ord/uttryck ni undviker?</div>
      <textarea
        value={avoid}
        onChange={(e) => setAvoid(e.target.value)}
        rows={2}
        placeholder="t.ex. 'kraftfull', 'banbrytande', storstadsslang"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
      />
      <div className="flex justify-end mt-4">
        <button
          onClick={run}
          disabled={loading || !examples.trim()}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Bygg tonregler
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <AlertCircle className="w-5 h-5 rotate-45" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
