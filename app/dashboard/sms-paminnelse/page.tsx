"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Upload, Send, ShieldCheck, AlertTriangle, Users, Layers, Coins, TestTube2, X, CheckCircle2, XCircle, Trash2, Save } from "lucide-react";
import { DashHero, LivePill, HeroChip, StatTile } from "@/components/ui/dash";
import { parseContacts } from "@/lib/sms/parse";
import { buildRecipients, firstNameOf, type Recipient } from "@/lib/sms/phone";
import { countSms } from "@/lib/sms/gsm";
import { renderMessage } from "@/lib/sms/message";

const DEFAULT_MSG =
  "Hej [förnamn]! Om 30 min kör vi SalesChallenge kväll 1. Häng med från start 18.30: [LÄNK] Vi ses! /Håkan";

// Utkastet sparas i webbläsaren så listan överlever en omladdning.
const DRAFT_KEY = "sms_paminnelse_draft_v1";

interface SmsConfig {
  configured: boolean;
  dryrun: boolean;
  sender: string;
  testPhone: string;
  costPerPart: number;
}

interface SendResultRow { to: string; name?: string; ok: boolean; status?: string; error?: string; costKr?: number }

export default function SmsReminderPage() {
  const [cfg, setCfg] = useState<SmsConfig | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [source, setSource] = useState<"paste" | "csv" | "manual">("paste");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [sender, setSender] = useState("");
  const [testDone, setTestDone] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [testInfo, setTestInfo] = useState<string | null>(null);
  const [result, setResult] = useState<{ mode: string; dryrun: boolean; sender: string; total: number; ok: number; fail: number; results: SendResultRow[] } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/sms/config")
      .then((r) => r.json())
      .then((c: SmsConfig & { error?: string }) => {
        if (c.error) { setToast({ kind: "err", text: c.error }); return; }
        setCfg(c);
        // Behåll ev. sparad avsändare från utkastet; annars default från config.
        setSender((prev) => prev || c.sender || "");
      })
      .catch(() => setToast({ kind: "err", text: "Kunde inte läsa inställningar" }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Återställ sparat utkast vid inladdning (mottagare, namn, ur-bockningar, text).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.recipients)) setRecipients(d.recipients);
        if (Array.isArray(d.excluded)) setExcluded(new Set<number>(d.excluded));
        if (typeof d.rawInput === "string") setRawInput(d.rawInput);
        if (typeof d.message === "string") setMessage(d.message);
        if (typeof d.sender === "string" && d.sender) setSender(d.sender);
        if (typeof d.source === "string") setSource(d.source);
        if (typeof d.savedAt === "string") setSavedAt(d.savedAt);
      }
    } catch { /* trasigt utkast ignoreras */ }
    setHydrated(true);
  }, []);

  // Spara löpande — men först efter att ev. sparat utkast lästs in (undviker att
  // skriva över det med tomma defaults vid första renderingen).
  useEffect(() => {
    if (!hydrated) return;
    try {
      const ts = new Date().toISOString();
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ recipients, excluded: [...excluded], rawInput, message, sender, source, savedAt: ts })
      );
      setSavedAt(ts);
    } catch { /* full/blockerad storage ignoreras */ }
  }, [hydrated, recipients, excluded, rawInput, message, sender, source]);

  function clearList() {
    setRecipients([]);
    setExcluded(new Set());
    setRawInput("");
    setSkipped(0);
    setTestDone(false);
    setResult(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
    setSavedAt(null);
  }

  function doParse(text: string, src: "paste" | "csv" | "manual") {
    const { contacts, skipped } = parseContacts(text);
    setRecipients(buildRecipients(contacts));
    setSkipped(skipped);
    setExcluded(new Set());
    setSource(src);
    setTestDone(false);
    setResult(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setRawInput(text);
      doParse(text, "csv");
    };
    reader.readAsText(f, "utf-8");
  }

  // Index-medvetna listor: giltiga (inkluderade) vs flaggade (ogiltiga/dubbletter).
  const rows = useMemo(() => recipients.map((r, i) => ({ r, i })), [recipients]);
  const included = useMemo(() => rows.filter((x) => x.r.valid && !excluded.has(x.i)), [rows, excluded]);
  const flagged = useMemo(() => rows.filter((x) => !x.r.valid), [rows]);
  const manuallyOff = useMemo(() => rows.filter((x) => x.r.valid && excluded.has(x.i)), [rows, excluded]);

  const sanitizedSender = useMemo(() => (sender.replace(/[^A-Za-z0-9]/g, "").slice(0, 11) || "MySales"), [sender]);
  const senderTrimmed = sender.replace(/[^A-Za-z0-9]/g, "").length > 11;

  const msgCount = useMemo(() => countSms(message), [message]);

  const totals = useMemo(() => {
    let parts = 0;
    for (const { r } of included) parts += countSms(renderMessage(message, r.firstName)).parts;
    const cost = parts * (cfg?.costPerPart ?? 0.35);
    return { count: included.length, parts, cost };
  }, [included, message, cfg]);

  const missingName = included.filter((x) => !x.r.firstName).length;
  const preview = included.slice(0, 3);

  function toggleExclude(i: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  // Manuell namnredigering i tabellen — uppdaterar även förnamn för [förnamn].
  function updateName(i: number, value: string) {
    setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, name: value, firstName: firstNameOf(value) } : r)));
  }

  async function sendTest() {
    if (!cfg?.configured) return;
    setTestBusy(true);
    setTestInfo(null);
    try {
      const r = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "test", message, sender: sanitizedSender, source, testName: preview[0]?.r.firstName || "Håkan" }),
      });
      const d = await r.json();
      if (!r.ok) { setToast({ kind: "err", text: d.error || "Testskicket misslyckades" }); return; }
      if (d.result?.ok) {
        setTestDone(true);
        setTestInfo(d.sample || "");
        setToast({ kind: "ok", text: d.dryrun ? "Testskick validerat (DRYRUN, inget skickat)" : "Testskick skickat till ditt nummer" });
      } else {
        setToast({ kind: "err", text: d.result?.error || "46elks nekade testskicket" });
      }
    } catch {
      setToast({ kind: "err", text: "Nätverksfel vid testskick" });
    } finally {
      setTestBusy(false);
    }
  }

  async function sendLive() {
    setConfirmOpen(false);
    if (!cfg?.configured || !included.length) return;
    setSendBusy(true);
    try {
      const r = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "live",
          message,
          sender: sanitizedSender,
          source,
          recipients: included.map((x) => ({ name: x.r.name, firstName: x.r.firstName, e164: x.r.e164 })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { setToast({ kind: "err", text: d.error || "Utskicket misslyckades" }); return; }
      setResult(d);
      setToast({ kind: "ok", text: `${d.ok} skickade, ${d.fail} misslyckade${d.dryrun ? " (DRYRUN)" : ""}` });
    } catch {
      setToast({ kind: "err", text: "Nätverksfel vid utskick" });
    } finally {
      setSendBusy(false);
    }
  }

  const canSend = cfg?.configured && testDone && included.length > 0 && message.trim().length > 0 && !sendBusy;

  return (
    <div className="space-y-6">
      <DashHero
        title="SMS-påminnelse"
        subtitle="Snabbverktyg för att påminna eventdeltagare via SMS. Läs in mottagare, granska, testa, skicka."
        icon={MessageSquare}
        accent="#6366f1"
        eyebrow={<LivePill label={cfg ? (cfg.dryrun ? "Testläge (dryrun)" : "Skarpt läge") : "Laddar"} />}
        chips={
          <>
            <HeroChip icon={Users} label={`${totals.count} mottagare`} />
            <HeroChip icon={Layers} label={`${totals.parts} SMS-delar`} />
            <HeroChip icon={Coins} label={`ca ${totals.cost.toFixed(2)} kr`} />
          </>
        }
      />

      {/* Lägesbanner */}
      {cfg && !cfg.configured && (
        <Banner kind="err" icon={AlertTriangle}>
          46elks-nycklar saknas. Sätt ELKS_API_USERNAME och ELKS_API_PASSWORD i miljövariablerna, annars kan inget skickas.
        </Banner>
      )}
      {cfg?.configured && cfg.dryrun && (
        <Banner kind="warn" icon={ShieldCheck}>
          Testläge (DRYRUN) är på. Varje nummer valideras hos 46elks och kostnaden räknas, men inget SMS skickas. För skarpt utskick: sätt SMS_DRYRUN=false och ladda om.
        </Banner>
      )}
      {cfg?.configured && !cfg.dryrun && (
        <Banner kind="live" icon={Send}>
          Skarpt läge. Ett tryck på Skicka nu skickar riktiga SMS till mottagarna.
        </Banner>
      )}

      {/* Steg 1: mottagare */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-gray-900">1. Mottagare</h2>
        <p className="mt-1 text-sm text-gray-500">
          Klistra in namn och mobilnummer (en per rad, t.ex. <span className="font-mono text-gray-700">Anna Svensson, 070-123 45 67</span>), eller ladda upp en CSV.
          Rena nummer utan namn funkar också. Ogiltiga nummer och dubbletter plockas bort automatiskt.
        </p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          rows={6}
          placeholder={"Anna Svensson, 070-123 45 67\nErik Karlsson; +46 73 987 65 43\n0765-000000"}
          className="mt-4 w-full rounded-xl border border-gray-200 p-3 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => doParse(rawInput, source === "csv" ? "csv" : "paste")}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Läs in mottagare
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" /> Ladda upp CSV
          </button>
          {recipients.length > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {included.length} giltiga, {flagged.length} borttagna{skipped > 0 ? `, ${skipped} rader utan nummer` : ""}
              </span>
              <button
                onClick={clearList}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" /> Rensa lista
              </button>
            </>
          )}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <Save className="h-3.5 w-3.5" />
          {savedAt ? "Sparas automatiskt i denna webbläsare. Listan finns kvar efter omladdning." : "Listan sparas automatiskt i denna webbläsare när du läser in mottagare."}
        </p>
      </section>

      {recipients.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Mottagare" value={totals.count} icon={Users} tone="blue" i={0} />
            <StatTile label="Borttagna" value={flagged.length + manuallyOff.length} icon={AlertTriangle} tone="amber" i={1} />
            <StatTile label="SMS-delar totalt" value={totals.parts} icon={Layers} tone="violet" i={2} sub={`${msgCount.encoding}`} />
            <StatTile label="Est. kostnad (kr)" value={Number(totals.cost.toFixed(2))} icon={Coins} tone="emerald" i={3} sub={`${cfg?.costPerPart ?? 0.35} kr/del`} />
          </div>

          {/* Mottagartabell */}
          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="font-display text-lg font-bold text-gray-900">Mottagarlista</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                    <th className="w-10 px-3 py-2 font-medium">Med</th>
                    <th className="px-3 py-2 font-medium">Namn</th>
                    <th className="px-3 py-2 font-medium">Inmatat</th>
                    <th className="px-3 py-2 font-medium">Nummer (E.164)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((x) => x.r.valid).map(({ r, i }) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={!excluded.has(i)} onChange={() => toggleExclude(i)} className="h-4 w-4 accent-indigo-600" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={r.name}
                          onChange={(e) => updateName(i, e.target.value)}
                          placeholder="Skriv namn"
                          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-gray-900 hover:border-gray-200 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-400">{r.rawPhone}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{r.e164}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {flagged.length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-amber-700">Borttagna ({flagged.length})</h3>
                <p className="text-xs text-gray-400">Dessa exkluderas automatiskt och tar inte emot något SMS.</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {flagged.map(({ r, i }) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-1.5 text-gray-700">{r.name || "(namn saknas)"}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-400">{r.rawPhone || "(tomt)"}</td>
                          <td className="px-3 py-1.5">
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{r.reason}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Steg 2: meddelande */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-gray-900">2. Meddelande</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr]">
          <div>
            <label className="text-sm font-medium text-gray-700">Avsändare</label>
            <input
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              maxLength={20}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-xs text-gray-400">
              Visas som: <span className="font-mono text-gray-600">{sanitizedSender}</span>
            </p>
            {senderTrimmed && (
              <p className="mt-1 text-xs text-amber-600">Max 11 bokstäver/siffror. Namnet kortas.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Text</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>Variabel: <span className="font-mono text-gray-700">[förnamn]</span></span>
              <span className="tabular-nums">{msgCount.chars} tecken</span>
              <span className="tabular-nums">{msgCount.parts} SMS-del{msgCount.parts > 1 ? "ar" : ""}</span>
              <span className={msgCount.hasUnicode ? "font-medium text-amber-600" : ""}>{msgCount.encoding}</span>
              {msgCount.parts > 1 && <span className="font-medium text-amber-600">Flera delar (dyrare per mottagare)</span>}
              {msgCount.hasUnicode && <span className="text-amber-600">Specialtecken/emoji tvingar UCS-2 (70 tecken/del): {msgCount.offending.join(" ")}</span>}
            </div>
            {missingName > 0 && (
              <p className="mt-1 text-xs text-amber-600">{missingName} mottagare saknar förnamn. Där tas [förnamn] bort.</p>
            )}
          </div>
        </div>
      </section>

      {/* Steg 3: förhandsgranskning */}
      {included.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-gray-900">3. Förhandsgranskning</h2>
          <p className="mt-1 text-sm text-gray-500">Så här ser meddelandet ut för de 3 första mottagarna.</p>
          <div className="mt-4 space-y-3">
            {preview.map(({ r, i }) => (
              <div key={i} className="rounded-xl bg-gray-50 p-4">
                <div className="mb-1 text-xs font-medium text-gray-500">{r.name || "(namn saknas)"} · {r.e164}</div>
                <div className="text-sm text-gray-900">{renderMessage(message, r.firstName)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-900">
            Totalt: <strong>{totals.count}</strong> mottagare, <strong>{totals.parts}</strong> SMS-delar, uppskattad kostnad <strong>{totals.cost.toFixed(2)} kr</strong>
            <span className="text-indigo-500"> (uppskattning, {cfg?.costPerPart ?? 0.35} kr/del)</span>.
          </div>
        </section>
      )}

      {/* Steg 4: skicka */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-gray-900">4. Testa och skicka</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={sendTest}
            disabled={!cfg?.configured || testBusy || !message.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <TestTube2 className="h-4 w-4" /> {testBusy ? "Skickar test..." : "Skicka test till mig"}
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sendBusy ? "Skickar..." : "Skicka nu"}
          </button>
          {!testDone && (
            <span className="text-xs text-gray-400">Skicka nu låses upp efter ett testskick.</span>
          )}
          {testDone && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Testskick gjort</span>}
        </div>
        {testInfo && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <span className="text-xs font-medium text-gray-400">Testmeddelande till {cfg?.testPhone}:</span>
            <div className="mt-1">{testInfo}</div>
          </div>
        )}
      </section>

      {/* Resultatvy */}
      {result && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-gray-900">Resultat {result.dryrun && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">DRYRUN</span>}</h2>
          <p className="mt-1 text-sm text-gray-600">
            <span className="font-semibold text-emerald-600">{result.ok} lyckade</span>, <span className="font-semibold text-rose-600">{result.fail} misslyckade</span> av {result.total}. Avsändare: {result.sender}.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">Mottagare</th>
                  <th className="px-3 py-2 font-medium">Nummer</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 text-gray-800">{r.name || "-"}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{r.to}</td>
                    <td className="px-3 py-1.5">
                      {r.ok ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> {r.status || "ok"}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600"><XCircle className="h-3.5 w-3.5" /> {r.error || "fel"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Bekräftelsedialog */}
      {confirmOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg font-bold text-gray-900">Bekräfta utskick</h3>
                <button onClick={() => setConfirmOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Du skickar till <strong>{totals.count}</strong> mottagare ({totals.parts} SMS-delar, ca {totals.cost.toFixed(2)} kr) som <strong>{sanitizedSender}</strong>.
              </p>
              {cfg?.dryrun ? (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Testläge (DRYRUN): inget skickas skarpt, allt loggas.</p>
              ) : (
                <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">Skarpt läge: riktiga SMS skickas nu.</p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setConfirmOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Avbryt</button>
                <button onClick={sendLive} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Skicka {totals.count} SMS</button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {toast && (
        <Portal>
          <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.kind === "ok" ? "bg-emerald-600" : "bg-rose-600"}`}>
            {toast.text}
          </div>
        </Portal>
      )}
    </div>
  );
}

function Banner({ kind, icon: Icon, children }: { kind: "err" | "warn" | "live"; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  const styles =
    kind === "err" ? "border-rose-200 bg-rose-50 text-rose-800"
      : kind === "warn" ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Portal({ children }: { children: React.ReactNode }) {
  // SSR-säkert: på servern finns inget document. Overlays visas ändå bara efter
  // interaktion (klient), så inget renderas vid första serverpasset.
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
