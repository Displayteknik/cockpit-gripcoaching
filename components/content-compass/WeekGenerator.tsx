"use client";

// CC-4 "Skapa veckans innehåll": genererar hela veckan enligt tenantens Compass-schema
// (kadens + hårda regler), sparar som utkast i kalendern med föreslagen bästa-tid.
// Inget publiceras. Grindas på compass-modulen (renderas inte annars).
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Check, CalendarClock } from "lucide-react";
import { CompassBadges } from "@/components/content-compass/badges";

interface GenPost { id: string; title: string; when: string | null; funnel_level: string | null; four_a: string | null; disc: string[] | null }
interface GenResult { saved: number; notes: string[]; token_estimate: number; posts: GenPost[] }

function fmt(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toLocaleString("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

export default function WeekGenerator({ accent = "#7c3aed", onDone }: { accent?: string; onDone?: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [cadence, setCadence] = useState<string>("7");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<GenResult | null>(null);

  useEffect(() => {
    fetch("/api/content-compass")
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setCadence(d.cadence || "7"); })
      .catch(() => setEnabled(false));
  }, []);

  if (enabled === false) return null; // modul av → visa inget

  const generate = async () => {
    if (theme.trim().length < 5) { setErr("Skriv ett veckotema (minst 5 tecken)."); return; }
    setBusy(true); setErr(""); setResult(null);
    try {
      const r = await fetch("/api/generate/week", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme.trim(), compass: true }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Kunde inte skapa veckan."); return; }
      setResult(d);
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cadenceLabel = cadence === "7" ? "7 inlägg" : cadence === "4" ? "4 inlägg" : "2 till 3 inlägg";

  return (
    <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5" style={{ color: accent }} />
        <h2 className="font-display font-bold text-gray-900 text-base">Skapa veckans innehåll</h2>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{cadenceLabel}/vecka</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Hela veckan färdigprofilerad enligt din Content Compass, som utkast i kalendern med föreslagen bästa-tid. Inget publiceras, du granskar och godkänner varje inlägg.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) generate(); }}
          placeholder="Veckans tema, t.ex. Höststäda ditt CRM"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 outline-none"
        />
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          style={{ background: accent }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Skapar veckan." : "Skapa veckan"}
        </button>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Check className="w-4 h-4" /> {result.saved} utkast skapade i kalendern
          </div>
          {result.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
              {result.notes.map((n, i) => <li key={i}>· {n}</li>)}
            </ul>
          )}
          <div className="mt-3 divide-y divide-emerald-100">
            {result.posts.map((p) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-xs text-gray-500 w-28 shrink-0">{fmt(p.when)}</span>
                <span className="text-sm text-gray-800 truncate flex-1">{p.title}</span>
                <CompassBadges funnel={p.funnel_level} four_a={p.four_a} disc={p.disc} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Token-estimat denna körning: ca {result.token_estimate.toLocaleString("sv-SE")}. Öppna ett utkast i Studio för att lägga bild och publicera.</p>
        </div>
      )}
    </section>
  );
}
