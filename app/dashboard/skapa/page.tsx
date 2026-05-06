"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Wand2,
  ChevronRight,
  Award,
  Calendar,
  Mic,
  MicOff,
  AlertTriangle,
  X,
  Save,
  Send,
  Hash,
  Image as ImageIcon,
} from "lucide-react";
import KnowledgeText from "@/components/KnowledgeText";
import ImageStudio from "@/components/ImageStudio";

type FourA = "analytical" | "aspirational" | "actionable" | "authentic";
type Disc = "D" | "I" | "S" | "C";
type Funnel = "TOFU" | "MOFU" | "BOFU";
type Format =
  | "single"
  | "carousel"
  | "reel"
  | "story"
  | "big_quote"
  | "before_after"
  | "big_stat"
  | "photo_overlay"
  | "long_form";

interface Variant {
  tier: "gold" | "silver" | "bronze";
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  hook_format: string;
  notes: string;
}

interface GenerateResponse {
  variants: Variant[];
  context: {
    fourA: FourA;
    disc: Disc;
    funnel: Funnel;
    format: Format;
    voice_source_count: number;
  };
}

const FORMATS: { value: Format; label: string; emoji: string }[] = [
  { value: "single", label: "Enstaka bild", emoji: "🖼️" },
  { value: "carousel", label: "Carousel", emoji: "📚" },
  { value: "reel", label: "Reel", emoji: "🎬" },
  { value: "story", label: "Story", emoji: "📱" },
  { value: "big_quote", label: "Stort citat", emoji: "💬" },
  { value: "before_after", label: "Före/Efter", emoji: "🔀" },
  { value: "big_stat", label: "Stor siffra", emoji: "📊" },
  { value: "photo_overlay", label: "Foto+text", emoji: "🎨" },
  { value: "long_form", label: "Lång berättelse", emoji: "📜" },
];

const DAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

// Föreslagna format per dag (4A-rytm) — användaren kan ändra
const DAY_RECOMMENDED_FORMATS: Record<number, Format[]> = {
  0: ["big_stat", "carousel", "single"],            // Måndag: Analytical/C — fakta
  1: ["carousel", "single", "reel"],                // Tisdag: Analytical/D — snabba tips
  2: ["before_after", "photo_overlay", "reel"],     // Onsdag: Aspirational/I — transformation
  3: ["photo_overlay", "long_form", "carousel"],    // Torsdag: Aspirational/D — story+CTA
  4: ["carousel", "single", "big_quote"],           // Fredag: Actionable/S — checklistor
  5: ["carousel", "photo_overlay", "reel"],         // Lördag: Actionable/D — process
  6: ["photo_overlay", "big_quote", "long_form"],   // Söndag: Authentic/S — människan
};

const TIER_STYLES = {
  gold: { bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-500", label: "GOLD" },
  silver: { bg: "bg-slate-50", border: "border-slate-200", badge: "bg-slate-500", label: "SILVER" },
  bronze: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-600", label: "BRONZE" },
};

export default function SkapaPage() {
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [dayIndex, setDayIndex] = useState<number | null>(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [format, setFormat] = useState<Format>("carousel");
  const [formatTouched, setFormatTouched] = useState(false);

  // Auto-föreslå format baserat på dag — om användaren inte explicit valt
  useEffect(() => {
    if (formatTouched || dayIndex === null) return;
    const recs = DAY_RECOMMENDED_FORMATS[dayIndex];
    if (recs && recs[0]) setFormat(recs[0]);
  }, [dayIndex, formatTouched]);
  const [generating, setGenerating] = useState(false);
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceCount, setVoiceCount] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  useEffect(() => {
    fetch("/api/profile/quality")
      .then((r) => r.json())
      .then((d) => {
        if (d?.dimensions) {
          // Hämta source-count från voice-fingerprint genom att kalla rebuild dry — använd istället assets-räkning
          fetch("/api/assets")
            .then((r) => r.json())
            .then((a) => {
              const c =
                (a.assets || []).filter((x: { asset_type: string }) =>
                  ["post", "audio", "video"].includes(x.asset_type)
                ).length;
              setVoiceCount(c);
            });
        }
      });
  }, []);

  async function generate() {
    if (!topic.trim()) {
      setError("Skriv vad inlägget handlar om");
      return;
    }
    setError(null);
    setGenerating(true);
    setResponse(null);
    try {
      const r = await fetch("/api/generate/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          angle: angle.trim() || undefined,
          dayIndex: dayIndex !== null ? dayIndex : undefined,
          format,
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.error || "Generering misslyckades");
      } else {
        setResponse(d);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function rebuildVoice() {
    setRebuilding(true);
    try {
      const r = await fetch("/api/voice/rebuild", { method: "POST" });
      const d = await r.json();
      if (d.source_count !== undefined) setVoiceCount(d.source_count);
    } finally {
      setRebuilding(false);
    }
  }

  const [mode, setMode] = useState<"generate" | "review">("generate");

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Skapa inlägg</h1>
        <p className="text-gray-500 text-sm mt-1">
          Två sätt: låt AI generera tre varianter — eller skriv eget och låt AI granska och föreslå.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setMode("generate")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "generate" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          ✨ Låt AI generera
        </button>
        <button
          onClick={() => setMode("review")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "review" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          ✏️ Skriv eget — låt AI granska
        </button>
      </div>

      {mode === "review" && <OwnPostReview />}

      {mode === "generate" && <>
      <VoiceStatus
        count={voiceCount}
        onRebuild={rebuildVoice}
        rebuilding={rebuilding}
      />

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vad ska inlägget handla om?
          </label>
          <div className="relative">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="t.ex. Skärmtrötthet på jobbet, eller — En kund som äntligen sov en hel natt"
              className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
            />
            <SpeechToTextButton onResult={(t) => setTopic((p) => (p ? p + " " : "") + t)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Specifik vinkel (valfritt)
          </label>
          <input
            type="text"
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
            placeholder="t.ex. Personlig — börja med en fråga"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-purple-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Dag i veckan (4A-rytm)
          </label>
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDayIndex(dayIndex === i ? null : i)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  dayIndex === i
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {dayIndex !== null && <DayHint dayIndex={dayIndex} />}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Format</label>
            {dayIndex !== null && !formatTouched && (
              <span className="text-xs text-purple-600 italic">
                ✨ Förslag baserat på {DAYS[dayIndex]}
              </span>
            )}
            {formatTouched && (
              <button
                type="button"
                onClick={() => setFormatTouched(false)}
                className="text-xs text-gray-500 hover:text-purple-600 underline"
              >
                Använd dagens förslag igen
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {FORMATS.map((f) => {
              const isRecommended = dayIndex !== null && DAY_RECOMMENDED_FORMATS[dayIndex]?.includes(f.value);
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { setFormat(f.value); setFormatTouched(true); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors relative ${
                    format === f.value
                      ? "bg-purple-600 border-purple-600 text-white"
                      : isRecommended
                      ? "bg-purple-50 border-purple-200 text-purple-900 hover:border-purple-400"
                      : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {isRecommended && format !== f.value && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-purple-600 text-white rounded-full px-1.5 py-0.5">
                      tips
                    </span>
                  )}
                  <div className="text-base">{f.emoji}</div>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={generate}
          disabled={generating || !topic.trim()}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Skapar 3 varianter...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generera 3 varianter
            </>
          )}
        </button>
      </div>

      {response && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Award className="w-3 h-3" />
            {response.context.fourA.toUpperCase()} · DISC {response.context.disc} ·{" "}
            {response.context.funnel}
            {response.context.voice_source_count > 0 && (
              <>
                <span>·</span>
                <span className="text-emerald-600">
                  röst byggd från {response.context.voice_source_count} källor
                </span>
              </>
            )}
          </div>
          {response.variants.map((v, i) => (
            <VariantCard key={i} variant={v} format={response.context.format} />
          ))}
        </div>
      )}
      </>}

      <RecentSavedPosts />
    </div>
  );
}

function RecentSavedPosts() {
  const [posts, setPosts] = useState<{ id: string; hook: string; status: string; format: string; created_at: string; image_url: string | null; scheduled_for: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/posts?limit=8");
      const d = await r.json();
      setPosts(d.posts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    function onSaved() {
      load();
    }
    window.addEventListener("post-saved", onSaved);
    return () => window.removeEventListener("post-saved", onSaved);
  }, []);

  if (!loading && posts.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-semibold text-sm text-gray-900">Senast sparade inlägg</h3>
        <a href="/dashboard/social" className="text-xs text-purple-600 hover:text-purple-800 font-medium">
          Bild + publicering →
        </a>
      </div>
      {loading && posts.length === 0 ? (
        <div className="text-xs text-gray-400">Laddar...</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${
                  p.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : p.status === "scheduled"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {p.status === "scheduled"
                  ? `Schemalagd ${p.scheduled_for ? new Date(p.scheduled_for).toLocaleDateString("sv-SE") : ""}`
                  : p.status === "published"
                  ? "Publicerad"
                  : "Utkast"}
              </span>
              <span className="text-xs text-gray-500 uppercase font-medium">{p.format}</span>
              <span className="flex-1 text-sm text-gray-800 truncate">{p.hook || "(ingen hook)"}</span>
              {p.image_url ? (
                <span className="text-xs text-emerald-600">✓ bild</span>
              ) : (
                <span className="text-xs text-amber-600">behöver bild</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VoiceStatus({
  count,
  onRebuild,
  rebuilding,
}: {
  count: number | null;
  onRebuild: () => void;
  rebuilding: boolean;
}) {
  if (count === null) return null;

  if (count === 0) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
        <Mic className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-rose-900 text-sm">Voice fingerprint saknas</div>
          <div className="text-sm text-rose-700 mt-1">
            AI:n har inga exempel på kundens röst — innehåll blir generiskt. Lägg till minst 5
            egna inlägg eller en ljudinspelning på{" "}
            <a href="/dashboard/profil" className="font-medium underline">
              Brand-profil
            </a>
            .
          </div>
        </div>
      </div>
    );
  }

  if (count < 5) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Mic className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="font-semibold text-amber-900 text-sm">
            Tunn röst-data ({count} källor)
          </div>
          <div className="text-sm text-amber-700 mt-1">
            AI:n har bara {count} exempel att lära från. Lägg till fler på{" "}
            <a href="/dashboard/profil" className="font-medium underline">
              Brand-profil
            </a>{" "}
            för bättre kvalitet.
          </div>
        </div>
        <button
          onClick={onRebuild}
          disabled={rebuilding}
          className="text-xs text-amber-800 hover:bg-amber-100 px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1"
        >
          {rebuilding ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Uppdatera
        </button>
      </div>
    );
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
      <span className="text-sm text-emerald-800 flex-1">
        Voice fingerprint aktiv — {count} källor
      </span>
      <button
        onClick={onRebuild}
        disabled={rebuilding}
        className="text-xs text-emerald-800 hover:bg-emerald-100 px-2 py-1 rounded disabled:opacity-50 flex items-center gap-1"
      >
        {rebuilding ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        Bygg om
      </button>
    </div>
  );
}

function SpeechToTextButton({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function start() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "sv-SE";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (event) => {
      const t = event.results[0]?.[0]?.transcript;
      if (t) onResult(t.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    setListening(true);
    recognitionRef.current = { stop: () => r.stop() };
  }

  if (supported === false) return null;

  return (
    <button
      type="button"
      onClick={() => (listening ? recognitionRef.current?.stop() : start())}
      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
        listening
          ? "bg-rose-500 text-white animate-pulse"
          : "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
      }`}
      title={listening ? "Lyssnar... klicka för att stoppa" : "Diktera"}
    >
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
  start: () => void;
  stop: () => void;
}

function DayHint({ dayIndex }: { dayIndex: number }) {
  const HINTS = [
    "Måndag: Analytical/C — fakta, statistik, expertis. Bygg auktoritet.",
    "Tisdag: Analytical/D — '3 saker du kan göra direkt'. Snabba vinster.",
    "Onsdag: Aspirational/I — kundens transformation. Drömläge.",
    "Torsdag: Aspirational/D — story + tydlig CTA. Driv handling.",
    "Fredag: Actionable/S — checklistor och 'spara detta'.",
    "Lördag: Actionable/D — er metod/process bakom kulisserna.",
    "Söndag: Authentic/S — människan bakom företaget. Värderingar.",
  ];
  return <div className="text-xs text-gray-500 mt-2 italic">{HINTS[dayIndex]}</div>;
}

interface ReviewResult {
  scores: { hook_strength: number; voice_match: number; conversion_potential: number; overall: number };
  verdict: "publicera" | "behov_av_mindre_justering" | "skriv_om";
  strengths: string[];
  weaknesses: string[];
  rewrite_suggestion: string | null;
  reviewer_notes: string;
}

function VariantCard({ variant, format }: { variant: Variant; format: Format }) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [current, setCurrent] = useState(variant);
  const [showRegen, setShowRegen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [saving, setSaving] = useState<"draft" | "schedule" | null>(null);
  const [savedAs, setSavedAs] = useState<"draft" | "scheduled" | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [hashtagBusy, setHashtagBusy] = useState(false);
  const [showImageStudio, setShowImageStudio] = useState(false);
  const [savedPostId, setSavedPostId] = useState<string | null>(null);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [clientSlug, setClientSlug] = useState<string | undefined>();
  const style = TIER_STYLES[current.tier];

  useEffect(() => {
    fetch("/api/clients/active")
      .then((r) => r.json())
      .then((c) => setClientSlug(c?.slug))
      .catch(() => {});
  }, []);

  async function regenerateHashtags() {
    setHashtagBusy(true);
    try {
      const r = await fetch("/api/generate/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: current.body.slice(0, 200) || current.hook, hook: current.hook }),
      });
      const d = await r.json();
      if (d.all_combined?.length) {
        setCurrent({ ...current, hashtags: d.all_combined });
      } else if (d.error) {
        alert("Hashtags: " + d.error);
      }
    } finally {
      setHashtagBusy(false);
    }
  }

  async function save(asScheduled: boolean) {
    setSaving(asScheduled ? "schedule" : "draft");
    try {
      const payload: Record<string, unknown> = {
        hook: current.hook,
        body: current.body,
        cta: current.cta,
        hashtags: current.hashtags,
        format,
        platform: "instagram",
      };
      if (asScheduled && scheduleAt) {
        payload.scheduled_for = new Date(scheduleAt).toISOString();
      }
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.error) {
        alert("Kunde inte spara: " + d.error);
      } else {
        setSavedAs(asScheduled ? "scheduled" : "draft");
        setShowSchedule(false);
        if (d.post?.id) {
          setSavedPostId(d.post.id);
        }
        // Trigger refresh av senaste-listan direkt
        window.dispatchEvent(new CustomEvent("post-saved"));
        setTimeout(() => setSavedAs(null), 3000);
      }
    } finally {
      setSaving(null);
    }
  }

  async function runReview() {
    setReviewing(true);
    setReview(null);
    try {
      const r = await fetch("/api/review/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: current.hook,
          body: current.body,
          cta: current.cta,
          hashtags: current.hashtags,
        }),
      });
      const d = await r.json();
      if (d.scores) setReview(d);
      else alert("Granskning: " + (d.error || "okänt fel"));
    } finally {
      setReviewing(false);
    }
  }

  function applyRewrite() {
    if (!review?.rewrite_suggestion) return;
    // Försök parsa "HOOK:\n...\n\nBODY:\n...\n\nCTA:\n..."
    const text = review.rewrite_suggestion;
    const hookM = text.match(/(?:HOOK|Hook|hook)[:\s-]*([\s\S]*?)(?=\n\s*(?:BODY|Body|body)[:\s])/);
    const bodyM = text.match(/(?:BODY|Body|body)[:\s-]*([\s\S]*?)(?=\n\s*(?:CTA|Cta|cta)[:\s])/);
    const ctaM = text.match(/(?:CTA|Cta|cta)[:\s-]*([\s\S]*?)$/);
    if (hookM && bodyM) {
      setCurrent({
        ...current,
        hook: hookM[1].trim(),
        body: bodyM[1].trim(),
        cta: ctaM ? ctaM[1].trim() : current.cta,
      });
      setReview(null);
    } else {
      // Fallback — lägg hela förslaget i body
      setCurrent({ ...current, body: text });
      setReview(null);
    }
  }

  function fullText() {
    const parts = [current.hook, "", current.body];
    if (current.cta) parts.push("", current.cta);
    if (current.hashtags.length) parts.push("", current.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "));
    return parts.join("\n");
  }

  async function copy() {
    await navigator.clipboard.writeText(fullText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate(quick?: string) {
    const instr = quick || instruction;
    if (!instr.trim()) return;
    setRegenerating(true);
    try {
      const r = await fetch("/api/generate/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: current.hook,
          body: current.body,
          cta: current.cta,
          instruction: instr,
        }),
      });
      const d = await r.json();
      if (d.hook) {
        setCurrent({
          ...current,
          hook: d.hook,
          body: d.body,
          cta: d.cta,
          hashtags: d.hashtags?.length ? d.hashtags : current.hashtags,
        });
        setShowRegen(false);
        setInstruction("");
      }
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className={`${style.bg} ${style.border} border-2 rounded-xl overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200/60 bg-white/60">
        <div className="flex items-center gap-2">
          <span className={`${style.badge} text-white text-xs font-bold px-2 py-0.5 rounded select-none`}>
            {style.label}
          </span>
          {current.hook_format && (
            <span className="text-xs text-gray-600 select-none">{current.hook_format}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              if (!savedPostId) await save(false);
              setShowImageStudio(true);
            }}
            className="text-xs text-purple-700 hover:text-purple-900 px-2 py-1 rounded hover:bg-purple-50 flex items-center gap-1 font-medium"
            title="Skapa bild"
          >
            <ImageIcon className="w-3 h-3" />
            Bild
          </button>
          <PublishNowButton postId={savedPostId} hasImage={!!postImageUrl} onSave={() => save(false)} />
          <button
            onClick={() => save(false)}
            disabled={!!saving}
            className="text-xs text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded hover:bg-emerald-50 flex items-center gap-1 disabled:opacity-50 font-medium"
            title="Spara som utkast"
          >
            {saving === "draft" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : savedAs === "draft" ? (
              <Check className="w-3 h-3" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            {savedAs === "draft" ? "Sparad" : "Spara"}
          </button>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="text-xs text-blue-700 hover:text-blue-900 px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-1 font-medium"
            title="Schemalägg publicering"
          >
            {savedAs === "scheduled" ? (
              <Check className="w-3 h-3" />
            ) : (
              <Calendar className="w-3 h-3" />
            )}
            {savedAs === "scheduled" ? "Schemalagd" : "Schemalägg"}
          </button>
          <button
            onClick={runReview}
            disabled={reviewing}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-white/80 flex items-center gap-1 disabled:opacity-50"
            title="Specialist granskar inlägget"
          >
            {reviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
            Granska
          </button>
          <button
            onClick={() => setShowRegen(!showRegen)}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-white/80 flex items-center gap-1"
          >
            <Wand2 className="w-3 h-3" />
            Regenerera
          </button>
          <button
            onClick={copy}
            className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-white/80 flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Kopierat" : "Kopiera"}
          </button>
        </div>
      </div>

      {review && <ReviewPanel review={review} onClose={() => setReview(null)} onApply={applyRewrite} />}

      {showSchedule && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            className="flex-1 px-2 py-1 border border-blue-200 rounded text-sm outline-none focus:border-blue-500 bg-white"
          />
          <button
            onClick={() => save(true)}
            disabled={!scheduleAt || !!saving}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {saving === "schedule" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Schemalägg
          </button>
          <button onClick={() => setShowSchedule(false)} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showRegen && (
        <div className="px-4 py-3 bg-white/80 border-b border-gray-200/60 space-y-2">
          <div className="flex flex-wrap gap-1">
            {["djärvare", "varmare", "kortare", "mer humor", "mer personligt", "lägg till siffra"].map((q) => (
              <button
                key={q}
                onClick={() => regenerate(q)}
                disabled={regenerating}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Eller skriv egen instruktion..."
              className="flex-1 px-3 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-purple-500"
              onKeyDown={(e) => e.key === "Enter" && regenerate()}
            />
            <button
              onClick={() => regenerate()}
              disabled={regenerating || !instruction.trim()}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded font-medium disabled:opacity-50 flex items-center gap-1"
            >
              {regenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
              Kör
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-3 bg-white">
        <div>
          <div className="text-xs uppercase text-gray-400 font-semibold mb-1 select-none">Hook</div>
          <div className="text-base font-display font-bold text-gray-900 leading-snug">
            <KnowledgeText text={current.hook} />
          </div>
        </div>

        {current.body && (
          <div>
            <div className="text-xs uppercase text-gray-400 font-semibold mb-1 select-none">Body</div>
            <div className="text-sm text-gray-800 leading-relaxed">
              <KnowledgeText text={current.body} />
            </div>
          </div>
        )}

        {current.cta && (
          <div>
            <div className="text-xs uppercase text-gray-400 font-semibold mb-1 select-none">CTA</div>
            <div className="text-sm font-medium text-gray-900">{current.cta}</div>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          {current.hashtags.length > 0 ? (
            <div className="text-xs text-blue-700 font-mono flex-1">
              {current.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic flex-1">Inga hashtags än</div>
          )}
          <button
            onClick={regenerateHashtags}
            disabled={hashtagBusy}
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
            title="Generera nya hashtags via AI"
          >
            {hashtagBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
            Smart hashtags
          </button>
        </div>

        {postImageUrl && (
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs uppercase text-gray-400 font-semibold mb-1 select-none">Bild</div>
            <img
              src={postImageUrl}
              alt="Inläggsbild"
              className="rounded-lg border border-gray-200 max-w-xs"
            />
          </div>
        )}

        {current.notes && (
          <div className="text-xs text-purple-700 italic flex items-start gap-1 pt-2 border-t border-gray-100">
            <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <KnowledgeText text={current.notes} />
          </div>
        )}

        {showImageStudio && savedPostId && (
          <ImageStudio
            postId={savedPostId}
            hook={current.hook}
            cta={current.cta}
            clientSlug={clientSlug}
            format={format}
            onClose={() => setShowImageStudio(false)}
            onImageSet={(url) => {
              setPostImageUrl(url);
              window.dispatchEvent(new CustomEvent("post-saved"));
            }}
          />
        )}
      </div>
    </div>
  );
}

function ReviewPanel({
  review,
  onClose,
  onApply,
}: {
  review: ReviewResult;
  onClose: () => void;
  onApply: () => void;
}) {
  const verdictStyle =
    review.verdict === "publicera"
      ? { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", label: "Publicera" }
      : review.verdict === "behov_av_mindre_justering"
      ? { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", label: "Behov av mindre justering" }
      : { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-900", label: "Skriv om" };

  function ScoreBar({ label, value }: { label: string; value: number }) {
    const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-rose-500";
    return (
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="font-bold text-gray-900">{value}</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`px-4 py-4 ${verdictStyle.bg} ${verdictStyle.border} border-b-2 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className={`w-4 h-4 ${verdictStyle.text}`} />
          <span className={`font-display font-bold text-sm ${verdictStyle.text}`}>
            Specialist-granskning · {verdictStyle.label}
          </span>
          <span className="text-xs text-gray-500">({review.scores.overall} totalt)</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ScoreBar label="Hook" value={review.scores.hook_strength} />
        <ScoreBar label="Röst-match" value={review.scores.voice_match} />
        <ScoreBar label="Konvertering" value={review.scores.conversion_potential} />
      </div>

      {review.reviewer_notes && (
        <div className="text-sm text-gray-700 italic">{review.reviewer_notes}</div>
      )}

      {review.strengths?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-700 mb-1">Styrkor</div>
          <ul className="text-xs text-gray-700 space-y-0.5">
            {review.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.weaknesses?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-rose-700 mb-1">Svagheter</div>
          <ul className="text-xs text-gray-700 space-y-0.5">
            {review.weaknesses.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <X className="w-3 h-3 text-rose-600 mt-0.5 flex-shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.rewrite_suggestion && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-gray-700">Konkret förbättring</div>
          <div className="text-xs text-gray-700 whitespace-pre-wrap">
            {review.rewrite_suggestion}
          </div>
          <button
            onClick={onApply}
            className="text-xs bg-purple-600 text-white px-3 py-1 rounded font-medium hover:bg-purple-700 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Använd förbättringen
          </button>
        </div>
      )}
    </div>
  );
}

function OwnPostReview() {
  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState(false);

  async function runReview() {
    if (!hook.trim() && !body.trim()) {
      alert("Skriv hook eller body först");
      return;
    }
    setReviewing(true);
    setReview(null);
    try {
      const r = await fetch("/api/review/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook, body, cta }),
      });
      const d = await r.json();
      if (d.scores) setReview(d);
      else alert("Granskning misslyckades: " + (d.error || "okänt"));
    } finally {
      setReviewing(false);
    }
  }

  function applyRewrite() {
    if (!review?.rewrite_suggestion) return;
    const text = review.rewrite_suggestion;
    const hookM = text.match(/(?:HOOK|Hook|hook)[:\s-]*([\s\S]*?)(?=\n\s*(?:BODY|Body|body)[:\s])/);
    const bodyM = text.match(/(?:BODY|Body|body)[:\s-]*([\s\S]*?)(?=\n\s*(?:CTA|Cta|cta)[:\s])/);
    const ctaM = text.match(/(?:CTA|Cta|cta)[:\s-]*([\s\S]*?)$/);
    if (hookM && bodyM) {
      setHook(hookM[1].trim());
      setBody(bodyM[1].trim());
      if (ctaM) setCta(ctaM[1].trim());
      setReview(null);
    } else {
      setBody(text);
      setReview(null);
    }
  }

  async function save() {
    if (!hook.trim() && !body.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook, body, cta, format: "single", platform: "instagram" }),
      });
      const d = await r.json();
      if (!d.error) {
        setSavedAs(true);
        window.dispatchEvent(new CustomEvent("post-saved"));
        setTimeout(() => setSavedAs(false), 3000);
      } else {
        alert("Kunde inte spara: " + d.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-display font-bold text-lg text-gray-900">Skriv ditt eget inlägg</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI:n granskar mot din voice fingerprint, brand-profil och hook-reglerna — och föreslår en
          konkret omskrivning om något inte håller.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hook (första raderna)</label>
        <textarea
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          rows={2}
          placeholder="Den första meningen som ska stoppa scrollen"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-purple-500 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Resten av inlägget — story, värde, kontext..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-purple-500 outline-none font-body leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">CTA</label>
        <input
          type="text"
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="Vad ska läsaren göra?"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-purple-500 outline-none"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={runReview}
          disabled={reviewing || (!hook.trim() && !body.trim())}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
          {reviewing ? "Granskar..." : "Granska mitt inlägg"}
        </button>
        <button
          onClick={save}
          disabled={saving || (!hook.trim() && !body.trim())}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedAs ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedAs ? "Sparat" : "Spara"}
        </button>
      </div>

      {review && (
        <div className="border-t border-gray-200 pt-4">
          <ReviewPanel review={review} onClose={() => setReview(null)} onApply={applyRewrite} />
        </div>
      )}
    </div>
  );
}

function PublishNowButton({ postId, hasImage, onSave }: { postId: string | null; hasImage: boolean; onSave: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function publish() {
    let id = postId;
    if (!id) {
      await onSave();
      return; // efter save får knappen ett post_id, användaren klickar igen
    }
    if (!hasImage) {
      if (!confirm("Inlägget saknar bild. Vill du publicera ändå? (Instagram kan kräva bild)")) return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: id }),
      });
      const d = await r.json();
      if (d.ok) {
        setDone(true);
        window.dispatchEvent(new CustomEvent("post-saved"));
        setTimeout(() => setDone(false), 3000);
      } else {
        alert("Publicering misslyckades: " + (d.error || "okänt"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={publish}
      disabled={busy}
      className="text-xs text-white bg-pink-600 hover:bg-pink-700 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50 font-semibold"
      title="Publicera direkt på Instagram"
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : done ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
      {done ? "Publicerad" : "Publicera"}
    </button>
  );
}
