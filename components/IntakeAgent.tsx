"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Upload, FileText, Mic, Video, FileType2, RefreshCw, Check, Edit3, SkipForward, ChevronRight, Quote, AlertTriangle, Plus, ArrowLeft, Trash2, History, MicOff, Square } from "lucide-react";

type Step = "list" | "input" | "transcribing" | "analyzing" | "clarifying" | "reviewing" | "done";
type ProposalDecision = "accepted" | "edited" | "skipped" | "pending";
type ProposalAction = "confirm" | "add" | "update" | "contradict" | "ignore";

interface IntakeSession {
  id: string;
  source_type: "transcript" | "audio" | "video" | "manual";
  source_label: string | null;
  status: string;
  confidence: number | null;
  transcript_excerpt: string | null;
  created_at: string;
  committed_at: string | null;
  raw_analysis?: { summary?: string; proposals_count?: number; clarifications_count?: number } | null;
}

interface Proposal {
  id: string;
  target: string;
  action: ProposalAction;
  field: string | null;
  current_value: string | null;
  proposed_value: string;
  evidence: string | null;
  confidence: "low" | "medium" | "high";
  reasoning: string | null;
  decision: ProposalDecision;
  edited_value: string | null;
}

interface Clarification {
  id: string;
  question: string;
  options: string[] | null;
  answer: string | null;
}

const TARGET_LABEL: Record<string, string> = {
  brand_profile: "Brand-profil",
  pillar: "Content-pelare",
  customer_voice: "Customer Voice",
  signature_phrase: "Signaturfras",
  forbidden_word: "Förbjudet ord",
  pain_word: "Smärt-ord",
  joy_word: "Glädje-ord",
  tone_rule: "Ton-regel",
  post_idea: "Post-idé",
  differentiator: "Differentiator",
  service: "Tjänst",
  icp_primary: "ICP primary",
  icp_secondary: "ICP secondary",
  catchphrase: "Catchphrase",
  framework: "Framework",
  objection: "Invändning",
  transformation_case: "Transformations-case",
};

const ACTION_BADGE: Record<ProposalAction, { label: string; cls: string }> = {
  confirm: { label: "Bekräftar", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  add: { label: "Tillägg", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  update: { label: "Uppdatering", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  contradict: { label: "Motsägelse", cls: "bg-red-100 text-red-800 border-red-200" },
  ignore: { label: "Ignorera", cls: "bg-gray-100 text-gray-600 border-gray-200" },
};

const CONF_BADGE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-50 text-gray-600",
};

export default function IntakeAgent({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<Step>("list");
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<IntakeSession | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<Record<string, number> | null>(null);

  const [transcript, setTranscript] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [personName, setPersonName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [editingProp, setEditingProp] = useState<{ id: string; value: string } | null>(null);

  // Mic-recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);

  function pickMimeType(): string {
    if (typeof MediaRecorder === "undefined") return "";
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return "";
  }

  async function startRecording() {
    setRecordError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordError("Webbläsaren stödjer inte mic-inspelning");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const mime = pickMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "audio/webm").includes("mp4") ? "m4a" : (mr.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `intake-inspelning-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.${ext}`, { type: blob.type });
        setUploadFile(file);
        // Stäng mic
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
        setRecording(false);
      };
      mr.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (e) {
      setRecordError((e as Error).message || "Kunde inte starta mic");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    recordChunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
    setUploadFile(null);
  }

  // Stadning vid unmount
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const refreshSessions = async () => {
    const r = await fetch("/api/intake/sessions");
    const j = await r.json();
    setSessions(j.sessions ?? []);
  };

  const loadSession = async (id: string) => {
    setBusy("loading");
    try {
      const r = await fetch(`/api/intake/sessions?id=${id}`);
      const j = await r.json();
      if (j.error) { setError(j.error); return; }
      setActiveSession(j.session);
      setActiveSessionId(id);
      setProposals(j.proposals ?? []);
      setClarifications(j.clarifications ?? []);
      const status = j.session?.status;
      if (status === "clarifying") setStep("clarifying");
      else if (status === "reviewing") setStep("reviewing");
      else if (status === "committed" || status === "dismissed") setStep("done");
      else if (status === "analyzing") setStep("analyzing");
      else setStep("reviewing");
    } finally { setBusy(null); }
  };

  useEffect(() => {
    if (open) {
      refreshSessions();
      if (step === "list") setStep("list");
    }
  }, [open]);

  const startNew = () => {
    setStep("input");
    setTranscript(""); setSourceLabel(""); setPersonName(""); setUploadFile(null); setUploadProgress(0);
    setActiveSession(null); setActiveSessionId(null); setProposals([]); setClarifications([]);
    setError(null); setResultSummary(null);
  };

  async function uploadToStorage(file: File): Promise<{ storage_path: string; mime_type: string; bucket: string }> {
    const r = await fetch("/api/intake/storage-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mime_type: file.type || "application/octet-stream" }),
    });
    const j = await r.json();
    if (j.error || !j.signed_url) throw new Error(j.error || "Kunde inte skapa upload-URL");

    return new Promise<{ storage_path: string; mime_type: string; bucket: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", j.signed_url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ storage_path: j.storage_path, mime_type: j.mime_type, bucket: j.bucket });
        } else {
          reject(new Error(`Storage-uppladdning misslyckades: ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
        }
      };
      xhr.onerror = () => reject(new Error("Nätverksfel under uppladdning"));
      xhr.send(file);
    });
  }

  const submitInput = async () => {
    setBusy("uploading"); setError(null); setUploadProgress(0);
    try {
      let res: Response;
      if (uploadFile) {
        setStep("transcribing");
        const { storage_path, mime_type, bucket } = await uploadToStorage(uploadFile);
        res = await fetch("/api/intake/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_type: "storage",
            storage_path,
            storage_bucket: bucket,
            mime_type: mime_type || uploadFile.type || "application/octet-stream",
            file_bytes: uploadFile.size,
            source_label: sourceLabel,
            person_name: personName,
            original_name: uploadFile.name,
          }),
        });
      } else {
        if (transcript.trim().length < 100) { setError("Klistra in minst 100 tecken transkript"); setBusy(null); return; }
        res = await fetch("/api/intake/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_type: "transcript", source_label: sourceLabel, transcript, person_name: personName }),
        });
      }
      const j = await res.json();
      if (j.error) { setError(j.error); setBusy(null); setStep("input"); return; }
      setActiveSessionId(j.session.id);
      setActiveSession(j.session);
      setStep("analyzing");
      // Trigger analyze
      const r2 = await fetch("/api/intake/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: j.session.id }) });
      const a = await r2.json();
      if (a.error) { setError(a.error); setBusy(null); setStep("input"); return; }
      await loadSession(j.session.id);
    } catch (e) { setError((e as Error).message); setBusy(null); setStep("input"); }
    finally { setBusy(null); }
  };

  const answerClarification = async (id: string, answer: string) => {
    await fetch("/api/intake/clarify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer }) });
    setClarifications((cs) => cs.map((c) => (c.id === id ? { ...c, answer } : c)));
    const remaining = clarifications.filter((c) => !c.answer && c.id !== id).length;
    if (remaining === 0) setStep("reviewing");
  };

  const decide = async (id: string, decision: ProposalDecision, edited_value?: string) => {
    await fetch("/api/intake/proposals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision, edited_value }) });
    setProposals((ps) => ps.map((p) => (p.id === id ? { ...p, decision, edited_value: edited_value ?? null } : p)));
  };

  const acceptAll = async () => {
    setBusy("accepting");
    for (const p of proposals.filter((p) => p.decision === "pending")) {
      await decide(p.id, "accepted");
    }
    setBusy(null);
  };

  const commit = async () => {
    setBusy("committing");
    setError(null);
    try {
      const r = await fetch("/api/intake/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: activeSessionId }) });
      const j = await r.json();
      if (j.error) setError(j.error);
      else {
        setResultSummary(j.summary);
        setStep("done");
        onChanged();
      }
    } finally { setBusy(null); }
  };

  const dismiss = async () => {
    if (!confirm("Avsluta utan att committa?")) return;
    if (activeSessionId) {
      await fetch(`/api/intake/sessions?id=${activeSessionId}`, { method: "DELETE" });
    }
    setStep("list"); refreshSessions();
  };

  if (!open) return null;

  const acceptedCount = proposals.filter((p) => p.decision === "accepted" || p.decision === "edited").length;
  const skippedCount = proposals.filter((p) => p.decision === "skipped").length;
  const pendingCount = proposals.filter((p) => p.decision === "pending").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 md:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden">
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== "list" && step !== "input" && (
              <button onClick={() => setStep(step === "done" ? "list" : "list")} className="text-gray-400 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-gray-900">Intake-agent</h2>
              <p className="text-xs text-gray-500">Mata in samtal/intervjuer — agenten jämför, frågar, föreslår</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </header>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-2 text-sm flex justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {step === "list" && (
            <div className="p-5">
              <div className="mb-5 grid md:grid-cols-2 gap-3">
                <button onClick={startNew} className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-xl p-5 text-left hover:opacity-95 transition shadow-sm">
                  <Plus className="w-6 h-6 mb-2" />
                  <div className="font-display font-bold text-lg mb-0.5">Mata in nytt material</div>
                  <div className="text-sm opacity-90">Klistra in transkript eller dra-och-släpp ljudfil</div>
                </button>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <Sparkles className="w-6 h-6 text-amber-700 mb-2" />
                  <div className="font-display font-bold text-amber-900 mb-1">Vad agenten gör</div>
                  <ul className="text-xs text-amber-900 space-y-1">
                    <li>• Läser materialet och jämför med befintlig brand-data</li>
                    <li>• Klassar förslag som bekräftar/tillägg/uppdatering/motsägelse</li>
                    <li>• Citerar exakt rad för varje förslag (audit trail)</li>
                    <li>• Ställer bara frågor när det finns genuin osäkerhet</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-gray-900 flex items-center gap-2"><History className="w-4 h-4" /> Tidigare intakes ({sessions.length})</h3>
                <button onClick={refreshSessions} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Uppdatera</button>
              </div>
              {sessions.length === 0 ? (
                <p className="text-sm text-gray-500">Inga tidigare intakes.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <div key={s.id} className="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:bg-purple-50/50 transition cursor-pointer" onClick={() => loadSession(s.id)}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            s.status === "committed" ? "bg-emerald-100 text-emerald-800" :
                            s.status === "reviewing" || s.status === "clarifying" ? "bg-blue-100 text-blue-800" :
                            s.status === "analyzing" ? "bg-amber-100 text-amber-800" :
                            s.status === "failed" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                          <span className="text-xs text-gray-700 font-medium">{s.source_label || `Intake ${new Date(s.created_at).toLocaleDateString("sv-SE")}`}</span>
                          <span className="text-xs text-gray-400">{s.source_type}</span>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{s.transcript_excerpt}</p>
                      {s.raw_analysis?.summary && <p className="text-xs text-purple-700 italic mt-1">{s.raw_analysis.summary}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "input" && (
            <div className="p-5 space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => { setUploadFile(null); }} className={`rounded-lg border p-4 text-left transition ${!uploadFile && !recording ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <FileText className="w-5 h-5 mb-1.5 text-purple-600" />
                  <div className="font-medium text-gray-900 text-sm">Klistra in transkript</div>
                  <div className="text-xs text-gray-500">Snabbast om du redan har text</div>
                </button>

                {recording ? (
                  <div className="rounded-lg border border-red-400 bg-red-50 p-4 flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2 text-red-700">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-medium text-sm">Spelar in...</span>
                      <span className="text-xs tabular-nums text-red-700/70">{Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}</span>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button onClick={stopRecording} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-lg flex items-center justify-center gap-1.5">
                        <Square className="w-3.5 h-3.5" /> Stopp & spara
                      </button>
                      <button onClick={cancelRecording} className="text-sm px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-100">
                        <MicOff className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={startRecording}
                    className={`rounded-lg border p-4 text-left transition ${uploadFile?.name?.includes("intake-inspelning") ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-purple-300"}`}
                  >
                    <Mic className="w-5 h-5 mb-1.5 text-purple-600" />
                    <div className="font-medium text-gray-900 text-sm">Spela in nu</div>
                    <div className="text-xs text-gray-500">
                      {uploadFile?.name?.includes("intake-inspelning") ? `Klar (${(uploadFile.size / 1024 / 1024).toFixed(1)} MB)` : "Prata direkt in i mic — agenten transkriberar"}
                    </div>
                  </button>
                )}

                <label className={`rounded-lg border p-4 text-left cursor-pointer transition ${uploadFile && !uploadFile.name.includes("intake-inspelning") ? "border-purple-500 bg-purple-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="flex gap-1.5 mb-1.5">
                    <Upload className="w-5 h-5 text-purple-600" />
                    <Video className="w-5 h-5 text-purple-600" />
                    <FileType2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="font-medium text-gray-900 text-sm">Ladda upp fil</div>
                  <div className="text-xs text-gray-500">
                    {uploadFile && !uploadFile.name.includes("intake-inspelning") ? `${uploadFile.name} (${(uploadFile.size / 1024 / 1024).toFixed(1)} MB)` : "PDF · Word · Ljud · Video · Zoom · VTT/SRT"}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.vtt,.srt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/vtt,audio/*,video/*"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {recordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{recordError}</div>
              )}

              {uploadFile && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2.5 text-xs text-purple-900">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span className="font-medium">{uploadFile.name}</span>
                    <span className="opacity-70">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB · {uploadFile.type || "okänd typ"}</span>
                  </div>
                  {uploadFile.size > 18 * 1024 * 1024 && (
                    <div className="mt-1 text-purple-700 text-[11px]">Stor fil — laddas via Gemini Files API. Kan ta 30-90 sek att processa.</div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Etikett (vad är det?)</label>
                <input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder='ex: "Intervju med Carl-Fredrik 2025-09-30" eller "Zoom med Ingela om kunder"' className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Motpart/person (valfritt)</label>
                <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="ex: Carl-Fredrik Zetterman, Ingela" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>

              {!uploadFile && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Transkript</label>
                  <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={12} placeholder="Klistra in transkriptet från Zoom, Otter, Whisper eller liknande här..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                  <p className="text-xs text-gray-500 mt-1">{transcript.length.toLocaleString("sv-SE")} tecken (minst 100 krävs)</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep("list")} className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700">Avbryt</button>
                <button onClick={submitInput} disabled={busy === "uploading" || (!uploadFile && transcript.trim().length < 100)} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white text-sm px-5 py-2 rounded-lg flex items-center gap-2">
                  {busy === "uploading" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Mata agenten
                </button>
              </div>
            </div>
          )}

          {(step === "transcribing" || step === "analyzing") && (
            <div className="p-12 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 items-center justify-center mb-4 animate-pulse">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-bold text-gray-900 text-lg mb-1">
                {step === "transcribing" ? (uploadProgress > 0 && uploadProgress < 100 ? `Laddar upp till Storage… ${uploadProgress}%` : "Transkriberar / extraherar text…") : "Agenten resonerar…"}
              </h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                {step === "transcribing"
                  ? (uploadProgress > 0 && uploadProgress < 100
                      ? "Filen laddas upp direkt till Supabase Storage."
                      : "Gemini läser ljud/video/PDF eller mammoth extraherar Word-text. Stora filer (>18 MB) går via Files API och tar 30-90 sek extra.")
                  : "Läser transkriptet, jämför med brand-profil, pelare och voice-data, klassar varje insikt och citerar källan. ~30-60 sek."}
              </p>
              {step === "transcribing" && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-4 max-w-sm mx-auto bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-purple-600 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </div>
          )}

          {step === "clarifying" && activeSession && (
            <div className="p-5 max-w-2xl">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-700 mb-2" />
                <h3 className="font-display font-bold text-gray-900 mb-1">Agenten behöver din hjälp ({clarifications.filter((c) => !c.answer).length} kvar)</h3>
                <p className="text-sm text-gray-700">Det finns {clarifications.filter((c) => !c.answer).length} punkt{clarifications.filter((c) => !c.answer).length === 1 ? "" : "er"} där agenten inte kan avgöra själv.</p>
              </div>
              <div className="space-y-3">
                {clarifications.map((c) => (
                  <div key={c.id} className={`border rounded-xl p-4 ${c.answer ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200"}`}>
                    <p className="font-medium text-gray-900 mb-3">{c.question}</p>
                    {c.answer ? (
                      <div className="text-sm text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" /> {c.answer}</div>
                    ) : (
                      <div className="space-y-1.5">
                        {(c.options ?? []).map((opt) => (
                          <button key={opt} onClick={() => answerClarification(c.id, opt)} className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-purple-50">
                            {opt}
                          </button>
                        ))}
                        <input
                          type="text"
                          placeholder="Eller skriv eget svar..."
                          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 mt-1.5"
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) { answerClarification(c.id, (e.target as HTMLInputElement).value.trim()); }}}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {clarifications.every((c) => !!c.answer) && (
                <button onClick={() => setStep("reviewing")} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg flex items-center gap-2">
                  Vidare till granskning <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {step === "reviewing" && (
            <div className="p-5">
              {activeSession?.raw_analysis?.summary && (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-gray-800 italic">{activeSession.raw_analysis.summary}</p>
                </div>
              )}
              <div className="flex items-center justify-between mb-3 sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">{acceptedCount} OK</span>
                  <span className="px-2 py-1 rounded bg-gray-50 text-gray-600">{skippedCount} skippad</span>
                  <span className="px-2 py-1 rounded bg-amber-50 text-amber-700">{pendingCount} ej beslutad</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={acceptAll} disabled={busy === "accepting" || pendingCount === 0} className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Acceptera alla återstående</button>
                  <button onClick={dismiss} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Avsluta utan commit</button>
                  <button onClick={commit} disabled={busy === "committing" || acceptedCount === 0} className="text-xs px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white flex items-center gap-1.5 font-medium">
                    {busy === "committing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Commit {acceptedCount} ändringar
                  </button>
                </div>
              </div>

              {proposals.length === 0 ? (
                <p className="text-gray-500 text-sm">Inga förslag.</p>
              ) : (
                <div className="space-y-2">
                  {proposals.map((p) => (
                    <ProposalRow key={p.id} p={p} editing={editingProp?.id === p.id} editValue={editingProp?.value ?? ""}
                      onEdit={() => setEditingProp({ id: p.id, value: p.proposed_value })}
                      onEditChange={(v) => setEditingProp({ id: p.id, value: v })}
                      onSaveEdit={() => { if (editingProp) decide(editingProp.id, "edited", editingProp.value); setEditingProp(null); }}
                      onCancelEdit={() => setEditingProp(null)}
                      onAccept={() => decide(p.id, "accepted")}
                      onSkip={() => decide(p.id, "skipped")}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "done" && resultSummary && (
            <div className="p-12 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 items-center justify-center mb-4">
                <Check className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-display font-bold text-gray-900 text-xl mb-1">Klart — agenten har uppdaterat brand-datan</h3>
              <div className="text-sm text-gray-600 mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
                {Object.entries(resultSummary).map(([k, v]) => (
                  <div key={k} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <div className="text-2xl font-bold text-emerald-700">{v}</div>
                    <div className="text-xs text-emerald-900 capitalize">{k.replace(/_/g, " ")}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setStep("list"); refreshSessions(); }} className="mt-6 bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg">Tillbaka till lista</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProposalRow({ p, editing, editValue, onEdit, onEditChange, onSaveEdit, onCancelEdit, onAccept, onSkip }: {
  p: Proposal;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const decided = p.decision !== "pending";
  return (
    <div className={`border rounded-xl p-3 ${
      p.decision === "accepted" || p.decision === "edited" ? "border-emerald-300 bg-emerald-50/40" :
      p.decision === "skipped" ? "border-gray-200 bg-gray-50/50 opacity-70" :
      "border-gray-200 hover:border-purple-300"
    }`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${ACTION_BADGE[p.action].cls}`}>{ACTION_BADGE[p.action].label}</span>
        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{TARGET_LABEL[p.target] ?? p.target}{p.field ? `: ${p.field}` : ""}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded ${CONF_BADGE[p.confidence]}`}>{p.confidence}</span>
        {p.decision === "edited" && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800">justerad</span>}
      </div>

      {editing ? (
        <textarea value={editValue} onChange={(e) => onEditChange(e.target.value)} rows={3} className="w-full border border-purple-300 rounded-lg px-2 py-1.5 text-sm" />
      ) : (
        <p className="text-sm text-gray-900 font-medium leading-snug">{p.decision === "edited" && p.edited_value ? p.edited_value : p.proposed_value}</p>
      )}

      {p.current_value && p.action === "update" && (
        <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Nuvarande:</span> <span className="line-through">{p.current_value.slice(0, 200)}</span></p>
      )}

      {p.evidence && (
        <div className="text-xs text-gray-600 italic mt-1.5 flex gap-1.5">
          <Quote className="w-3 h-3 flex-shrink-0 mt-0.5 text-purple-400" />
          <span>{p.evidence.slice(0, 250)}{p.evidence.length > 250 ? "..." : ""}</span>
        </div>
      )}
      {p.reasoning && <p className="text-[11px] text-purple-700 mt-1">→ {p.reasoning}</p>}

      <div className="flex gap-1 mt-2">
        {editing ? (
          <>
            <button onClick={onSaveEdit} className="text-xs px-3 py-1 rounded-lg bg-purple-600 text-white">Spara justering</button>
            <button onClick={onCancelEdit} className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-700">Avbryt</button>
          </>
        ) : decided ? (
          <button onClick={onAccept} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500">Ändra till acceptera</button>
        ) : (
          <>
            <button onClick={onAccept} className="text-xs px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"><Check className="w-3 h-3" /> OK</button>
            <button onClick={onEdit} className="text-xs px-3 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 flex items-center gap-1"><Edit3 className="w-3 h-3" /> Justera</button>
            <button onClick={onSkip} className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1"><SkipForward className="w-3 h-3" /> Skippa</button>
          </>
        )}
      </div>
    </div>
  );
}
