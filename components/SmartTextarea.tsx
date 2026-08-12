"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Image as ImageIcon, Loader2 } from "lucide-react";
import { arPromptEko, ROST_FELMEDDELANDE, ROST_FOR_KORT } from "@/lib/ai/transkription";
import { fordelningsSammanfattning, type FaltSpec, type Fordelning } from "@/lib/ai/faltfordelning";

// Drop-in-ersättning för <textarea> med röstinmatning + bildanalys.
// Byt bara ut taggen: <textarea .../> → <SmartTextarea .../>. Samma props (value/onChange/
// className/placeholder/rows/...). Verktygen läggs i en liten rad under fältet och lägger
// transkriberad text / bildsammanfattning till fältets värde. Sätt tools={false} för att stänga av.
// Återanvänder /api/ai/transcribe + /api/ai/vision (grindade, Gemini inline).
type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  tools?: boolean;
  hint?: boolean;
  /**
   * KVALITET-3/10: låter en yta ta hand om bilden själv i stället för den fria
   * sammanfattningen i /api/ai/vision. DM-flödet skickar skärmdumpen till den
   * strukturerade avläsningen (lib/dm/skarmdump), där bubblornas placering avgör
   * vem som sagt vad — den fria texten kastade om talarna. Returnera true när
   * bilden är omhändertagen; false/utelämnad faller tillbaka på vision-vägen.
   */
  onBild?: (file: File | Blob) => boolean | Promise<boolean>;
  /**
   * ROST-1 (Håkans fynd 11/8): mikrofonen lade allt i fältet den stod under. Sa han
   * "Elisabeth Andersson" i "Lägg till kontakt" hamnade namnet i ANTECKNINGAR.
   *
   * Skickar en yta sitt FÄLTSCHEMA här sorteras dikteringen i stället: namnet till namnrutan,
   * tiden till tidsfältet, resten hit. Utan schema är beteendet exakt som förut — det här
   * fältet är ett tillägg, inte ett byte.
   */
  faltschema?: FaltSpec[];
  /** Anropas med de fält som gick att placera. Anroparen sätter sina egna states. */
  onFalt?: (varden: Record<string, string>) => void;
};

export default function SmartTextarea({
  tools = true,
  hint = true,
  className,
  value,
  onChange,
  onPaste,
  onBild,
  faltschema,
  onFalt,
  ...rest
}: Props) {
  const [recording, setRecording] = useState(false);
  const [sekunder, setSekunder] = useState(0);
  const [jobbar, setJobbar] = useState<null | "röst" | "bild">(null);
  const [fel, setFel] = useState<string | null>(null);
  // ROST-1: klarspråksrad om vad som hamnade var. En tyst fördelning går inte att lita på.
  const [placerat, setPlacerat] = useState("");
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const fireChange = (next: string) => {
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
  };
  const append = (snippet: string) => {
    const s = (snippet || "").trim();
    if (!s) return;
    const cur = typeof value === "string" ? value : "";
    fireChange(cur ? `${cur.trim()} ${s}` : s);
  };

  /**
   * ROST-1: sorterar dikteringen i formulärets fält när ytan skickat ett schema, annars lägger
   * den texten i det egna fältet som förut.
   *
   * Fail-open i varje led: failar fördelningen hamnar HELA texten i fältet. En diktering som
   * försvinner är värre än en som ligger på fel rad — den felplacerade ser man, den tappade
   * märker man först när man undrar var den blev av.
   */
  const placera = async (text: string) => {
    if (!faltschema?.length || !onFalt) { append(text); return; }
    try {
      const r = await fetch("/api/ai/rost-till-falt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, falt: faltschema }),
      });
      const d = (await r.json()) as Fordelning & { error?: string };
      if (!r.ok || !d || typeof d !== "object") { append(text); return; }
      const varden = d.varden && typeof d.varden === "object" ? d.varden : {};
      if (Object.keys(varden).length) onFalt(varden);
      if (d.oplacerat) append(d.oplacerat);
      // Placerades ingenting alls hamnar allt här — annars hade texten kunnat försvinna.
      if (!Object.keys(varden).length && !d.oplacerat) { append(text); return; }
      setPlacerat(fordelningsSammanfattning({ varden, oplacerat: d.oplacerat || "" }, faltschema));
    } catch {
      append(text);
    }
  };

  const stadaMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => stadaMic(), []);

  const pickMime = () => {
    if (typeof MediaRecorder === "undefined") return "";
    for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"])
      if (MediaRecorder.isTypeSupported(t)) return t;
    return "";
  };

  const startaRost = async () => {
    setFel(null);
    setPlacerat("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setFel("Webbläsaren stödjer inte röstinspelning");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        stadaMic();
        setRecording(false);
        // Tyst retur gav "ingenting händer". Säg vad som gick fel i stället.
        if (blob.size < 1200) { setFel(ROST_FOR_KORT); return; }
        // ROST-2: längden följer med i felet. Var klippet 0,8 sekunder är det svaret på
        // "varför hörde den inget" — inte något användaren ska gissa sig till.
        const sekLangd = sekunder;
        setJobbar("röst");
        try {
          const fd = new FormData();
          const ext = (mr.mimeType || "webm").includes("mp4") ? "m4a" : "webm";
          fd.append("audio", blob, `rost.${ext}`);
          const r = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
          const d = await r.json();
          // Andra skyddsnätet: systeminstruktionen får aldrig hamna i fältet.
          if (d.text && !arPromptEko(d.text)) await placera(d.text);
          else {
            const bas = typeof d.error === "string" && d.error ? d.error : ROST_FELMEDDELANDE;
            // Bara vid tystnad är längden relevant — vid internt fel är den brus.
            const kort = d.orsak === "tystnad" && sekLangd > 0 && sekLangd < 3;
            setFel(kort ? `${bas} (inspelningen var ${sekLangd} sekund${sekLangd === 1 ? "" : "er"})` : bas);
          }
        } catch {
          setFel(ROST_FELMEDDELANDE);
        } finally {
          setJobbar(null);
        }
      };
      mr.start();
      setRecording(true);
      setSekunder(0);
      timerRef.current = setInterval(() => setSekunder((s) => s + 1), 1000);
    } catch (e) {
      setFel((e as Error).message || "Kunde inte starta mic");
    }
  };

  const stoppaRost = () => {
    if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
  };

  const analyseraBild = async (file: File | Blob) => {
    setFel(null);
    if (file.size > 8 * 1024 * 1024) {
      setFel("Bilden är för stor (max 8 MB)");
      return;
    }
    // Ytans egen hantering först (DM: strukturerad skärmdumpsavläsning).
    if (onBild) {
      setJobbar("bild");
      try {
        if (await onBild(file)) return;
      } catch {
        // faller igenom till den generella bildanalysen nedan
      } finally {
        setJobbar(null);
      }
    }
    setJobbar("bild");
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error("läsfel"));
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/ai/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const d = await r.json();
      if (d.text) append(d.text);
      else setFel(d.error || "Kunde inte analysera bilden");
    } catch {
      setFel("Kunde inte analysera bilden");
    } finally {
      setJobbar(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) {
      const f = item.getAsFile();
      if (f) {
        e.preventDefault();
        analyseraBild(f);
        return;
      }
    }
    onPaste?.(e);
  };

  const upptagen = jobbar !== null;

  if (!tools) {
    return <textarea className={className} value={value} onChange={onChange} onPaste={onPaste} {...rest} />;
  }

  return (
    <div className="space-y-1.5">
      <textarea className={className} value={value} onChange={onChange} onPaste={handlePaste} {...rest} />
      <div className="flex items-center gap-2 flex-wrap">
        {recording ? (
          <button
            type="button"
            onClick={stoppaRost}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200"
          >
            <Square className="w-3 h-3 fill-current" /> Stoppa
            <span className="tabular-nums">
              {Math.floor(sekunder / 60)}:{String(sekunder % 60).padStart(2, "0")}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startaRost}
            disabled={upptagen}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {jobbar === "röst" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />}
            {jobbar === "röst" ? "Skriver…" : "Prata in"}
          </button>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upptagen || recording}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          {jobbar === "bild" ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
          {jobbar === "bild" ? "Analyserar…" : "Bild"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyseraBild(f);
            e.target.value = "";
          }}
        />
        {hint && <span className="text-sm text-gray-500">eller klistra in en skärmbild (Ctrl+V)</span>}
        {fel && <span className="text-sm text-red-600">{fel}</span>}
        {/* ROST-1: säg vart dikteringen tog vägen. En fördelning man inte ser går inte att
            lita på — och den som inte litar på den skriver om allt för hand. */}
        {!fel && placerat && <span className="text-sm text-emerald-700">{placerat}</span>}
      </div>
    </div>
  );
}
