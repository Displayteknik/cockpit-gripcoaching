"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench, Send, Loader2, CheckCircle2, AlertTriangle, Bot, User, Wand2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; tools?: Array<{ name: string; input: unknown; result?: { ok: boolean; summary: string } }> };

const QUICK_ACTIONS = [
  { label: "Vad ska jag fixa idag?", prompt: "Lista alla mina klienter och berätta för var och en vad som saknas i onboardingen. Kort." },
  { label: "Hälsokoll Opticur", prompt: "Kör check_client_health för Opticur och visa vad som saknas." },
  { label: "Hälsokoll Darek", prompt: "Kör check_client_health för Darek Uhrberg och visa vad som saknas." },
  { label: "Hälsokoll alla klienter", prompt: "Lista alla klienter och kör check_client_health för var och en. Sammanfatta i tabell." },
  { label: "Generera trafik-pixel", prompt: "Visa mig alla klienter så jag kan välja vilken jag vill ha trafik-pixel för." },
  { label: "Vilka assets har Opticur?", prompt: "Lista de senaste 20 client_assets för Opticur så jag kan välja winning examples." },
];

export default function SetupAgentPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null);
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setBusy(true);

    // Init tomt assistent-meddelande som streamas in i
    let assistantText = "";
    const tools: Array<{ name: string; input: unknown; result?: { ok: boolean; summary: string } }> = [];
    setMessages([...newMessages, { role: "assistant", content: "", tools: [] }]);

    try {
      const res = await fetch("/api/setup/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const ev of events) {
          if (!ev.trim()) continue;
          const lines = ev.split("\n");
          let event = "";
          let data = "";
          for (const ln of lines) {
            if (ln.startsWith("event: ")) event = ln.slice(7);
            else if (ln.startsWith("data: ")) data = ln.slice(6);
          }
          if (!event || !data) continue;
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(data); } catch { continue; }

          if (event === "text") {
            assistantText += (parsed.text as string) ?? "";
            setMessages([...newMessages, { role: "assistant", content: assistantText, tools: [...tools] }]);
          } else if (event === "tool_use") {
            tools.push({ name: parsed.name as string, input: parsed.input });
            setMessages([...newMessages, { role: "assistant", content: assistantText, tools: [...tools] }]);
          } else if (event === "tool_result") {
            const idx = tools.findIndex((t) => t.name === (parsed.name as string) && !t.result);
            if (idx >= 0) {
              tools[idx].result = parsed.result as { ok: boolean; summary: string };
              setMessages([...newMessages, { role: "assistant", content: assistantText, tools: [...tools] }]);
            }
          } else if (event === "error") {
            setError((parsed.message as string) ?? "Okant fel");
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] pb-4">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            Setup-agent
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-purple-600" />
          Setup-agent
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Frågar, diagnostiserar och fixar. Kan kolla klient-hälsa, bygga om voice-fingerprints, generera trafik-pixlar, markera winning examples, köra natt-loopen.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 mb-4">
          <div className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-600" />
            Snabb-actions
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => send(a.prompt)}
                disabled={busy}
                className="text-left bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-purple-400 hover:shadow-sm transition text-sm font-medium text-gray-800 disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-gray-200" : "bg-purple-100"}`}>
              {m.role === "user" ? <User className="w-4 h-4 text-gray-700" /> : <Bot className="w-4 h-4 text-purple-700" />}
            </div>
            <div className={`flex-1 max-w-3xl ${m.role === "user" ? "text-right" : ""}`}>
              {m.tools && m.tools.length > 0 && (
                <div className="space-y-1 mb-2">
                  {m.tools.map((t, ti) => (
                    <div key={ti} className="inline-flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded px-2.5 py-1 mr-2">
                      {!t.result ? <Loader2 className="w-3 h-3 animate-spin text-gray-500" /> :
                       t.result.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> :
                       <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      <span className="font-mono text-gray-700">{t.name}</span>
                      {t.result?.summary && <span className="text-gray-500">— {t.result.summary}</span>}
                    </div>
                  ))}
                </div>
              )}
              {m.content && (
                <div className={`inline-block px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                  {m.content}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100">
              <Bot className="w-4 h-4 text-purple-700" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Tänker...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-2">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Fråga setup-agenten — t.ex. 'Vad saknas för Opticur?'"
          disabled={busy}
          className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-3 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Skicka
        </button>
      </form>
    </div>
  );
}
