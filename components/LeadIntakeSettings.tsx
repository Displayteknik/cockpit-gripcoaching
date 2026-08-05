"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Save, Workflow } from "lucide-react";

// Inställningar för hur inkommande leads tas emot, per klient.
//
// Ersätter Displaytekniks miljövariabler på Netlify (GHL_PIPELINE_ID, GHL_STAGE_ID), som
// bara kunde sättas av den som äger Netlify-sajten. Här väljer varje kund själv, och
// pipelines hämtas ur deras egen MySales — inga id:n att klistra in.

interface Steg { id: string; namn: string }
interface Pipeline { id: string; namn: string; steg: Steg[] }

export default function LeadIntakeSettings() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [linked, setLinked] = useState(true);
  const [fel, setFel] = useState<string | null>(null);
  const [laddar, setLaddar] = useState(true);

  const [skapaAffar, setSkapaAffar] = useState(false);
  const [pipelineId, setPipelineId] = useState("");
  const [stegId, setStegId] = useState("");

  const [sparar, setSparar] = useState(false);
  const [sparadAt, setSparadAt] = useState<Date | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/lead-intake/pipelines").then((r) => r.json()).catch(() => ({ pipelines: [] })),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([p, s]) => {
        setPipelines(Array.isArray(p.pipelines) ? p.pipelines : []);
        setLinked(p.linked !== false);
        if (p.fel) setFel(p.fel);
        setSkapaAffar((s?.lead_skapa_affar || "").toLowerCase() === "ja");
        setPipelineId(s?.lead_ghl_pipeline_id || "");
        setStegId(s?.lead_ghl_stage_id || "");
      })
      .finally(() => setLaddar(false));
  }, []);

  const vald = pipelines.find((p) => p.id === pipelineId);

  // Byter man pipeline hör det gamla steget till en annan pipeline. Att låta det ligga
  // kvar skulle spara ett steg-id som inte finns i den valda pipelinen.
  const valjPipeline = (id: string) => {
    setPipelineId(id);
    setStegId("");
    setSparadAt(null);
  };

  const spara = async () => {
    setSparar(true);
    setFel(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_skapa_affar: skapaAffar ? "ja" : "nej",
          lead_ghl_pipeline_id: pipelineId,
          lead_ghl_stage_id: stegId,
        }),
      });
      if (!r.ok) throw new Error("Kunde inte spara");
      setSparadAt(new Date());
    } catch (e) {
      setFel((e as Error).message);
    } finally {
      setSparar(false);
    }
  };

  // Påslaget utan val = leadet får inget hem. Säg det i förväg i stället för att låta
  // det tysta misslyckas när nästa lead kommer in.
  const ofullstandig = skapaAffar && (!pipelineId || !stegId);

  if (laddar) {
    return <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Hämtar dina pipelines…</div>;
  }

  if (!linked) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Den här kunden är inte kopplad till MySales än. Koppla först, sedan går det att välja pipeline.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={skapaAffar}
          onChange={(e) => { setSkapaAffar(e.target.checked); setSparadAt(null); }}
          className="mt-0.5 w-4 h-4 rounded border-gray-300"
        />
        <span>
          <span className="text-sm font-medium text-gray-900">Skapa affär i MySales direkt när ett lead kommer in</span>
          <span className="block text-sm text-gray-500 mt-0.5">
            Av: leadet hamnar i Nya leads, och du skickar det vidare till MySales när det är dags.
            På: affären skapas med en gång — samma sak som webbformuläret gör.
          </span>
        </span>
      </label>

      {skapaAffar && (
        <div className="grid gap-3 sm:grid-cols-2 pl-7">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Pipeline</label>
            <select
              value={pipelineId}
              onChange={(e) => valjPipeline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">Välj pipeline…</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.namn}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Steg för nya leads</label>
            <select
              value={stegId}
              onChange={(e) => { setStegId(e.target.value); setSparadAt(null); }}
              disabled={!vald}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="">{vald ? "Välj steg…" : "Välj pipeline först"}</option>
              {(vald?.steg || []).map((s) => <option key={s.id} value={s.id}>{s.namn}</option>)}
            </select>
          </div>
        </div>
      )}

      {ofullstandig && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          Välj både pipeline och steg — annars skapas ingen affär, även om rutan är ikryssad.
        </div>
      )}
      {fel && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{fel}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={spara}
          disabled={sparar}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-50"
        >
          {sparar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Spara
        </button>
        {sparadAt && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="w-4 h-4" /> Sparat {sparadAt.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {!pipelines.length && !fel && (
          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
            <Workflow className="w-4 h-4" /> Inga pipelines hittades i MySales.
          </span>
        )}
      </div>
    </div>
  );
}
