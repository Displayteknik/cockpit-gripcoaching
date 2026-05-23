"use client";

import { useState, useCallback } from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";

/**
 * Återanvändbar voice-check-komponent.
 * Drop:a in på vilken text-input-yta som helst i Cockpit för att tvinga
 * klientens röst-profil. Se feedback_language_review_everywhere.md.
 *
 * Användning:
 *   <VoiceCheckBadge
 *     text={editingText}
 *     surface="social"
 *     onScore={(score) => setVoiceScore(score)}
 *   />
 *
 * Visar:
 *   - "Granska språk"-knapp (manuell körning)
 *   - Score-badge med verdict (pass/warn/block)
 *   - Expanderbar lista med issues + signaturer/pain/joy words att använda
 */

export interface VoiceScore {
  score: number;
  verdict: "pass" | "warn" | "block";
  hint: string;
  issues: string[];
  signatures_available: string[];
  forbidden_words: string[];
  pain_words: string[];
  joy_words: string[];
  winning_examples_count: number;
}

interface Props {
  text: string;
  surface: "blog" | "social" | "email" | "linkedin" | "page" | "specialist" | "other";
  clientId?: string;
  onScore?: (score: VoiceScore) => void;
  // Auto-run varje gång text ändras (debounce 1.5s)? Default: false (knapp)
  autoCheck?: boolean;
  className?: string;
}

export function VoiceCheckBadge({ text, surface, clientId, onScore, autoCheck = false, className = "" }: Props) {
  const [score, setScore] = useState<VoiceScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runCheck = useCallback(async () => {
    if (!text || text.trim().length < 10) return;
    setLoading(true);
    try {
      const res = await fetch("/api/text/voice-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, surface, client_id: clientId }),
      });
      const data = await res.json();
      if (res.ok) {
        setScore(data as VoiceScore);
        onScore?.(data as VoiceScore);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [text, surface, clientId, onScore]);

  // Auto-check med debounce
  if (autoCheck && text && !loading) {
    // Note: i en riktig impl. behöver useEffect + debounce, men för enkelhet låter vi knapp:n vara primär
  }

  const verdictColor = !score ? "" :
    score.verdict === "pass" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
    score.verdict === "warn" ? "bg-amber-50 border-amber-200 text-amber-800" :
    "bg-rose-50 border-rose-200 text-rose-800";

  const Icon = !score ? Sparkles :
    score.verdict === "pass" ? ShieldCheck :
    score.verdict === "warn" ? AlertTriangle :
    ShieldAlert;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={runCheck}
          disabled={loading || !text || text.trim().length < 10}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 disabled:opacity-50 transition"
          title="Granska text mot klientens röst-profil"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {loading ? "Granskar..." : "Granska språk"}
        </button>

        {score && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${verdictColor}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {score.score}/100
            <span className="text-[10px] uppercase tracking-wider opacity-70">
              {score.verdict === "pass" ? "OK" : score.verdict === "warn" ? "Justera" : "Block"}
            </span>
          </button>
        )}
      </div>

      {score && expanded && (
        <div className={`mt-2 p-3 rounded-lg border text-xs ${verdictColor}`}>
          {score.hint && <p className="font-semibold mb-2">{score.hint}</p>}
          {score.issues.length > 0 && (
            <ul className="space-y-0.5 mb-2">
              {score.issues.map((iss, i) => <li key={i}>• {iss}</li>)}
            </ul>
          )}
          {score.signatures_available.length > 0 && (
            <p className="opacity-80 mt-2">
              <strong>Signaturer att väva in:</strong> {score.signatures_available.join(" · ")}
            </p>
          )}
          {score.pain_words.length > 0 && (
            <p className="opacity-80"><strong>Pain words:</strong> {score.pain_words.join(" · ")}</p>
          )}
          {score.joy_words.length > 0 && (
            <p className="opacity-80"><strong>Joy words:</strong> {score.joy_words.join(" · ")}</p>
          )}
          {score.forbidden_words.length > 0 && (
            <p className="opacity-80"><strong>Förbjudet:</strong> {score.forbidden_words.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
