"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STORAGE_KEY = "hm_coach_conversation";

export default function CoachWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      if (data.reply) {
        setMessages([...next, { role: "assistant", content: data.reply }]);
      } else {
        setMessages([...next, { role: "assistant", content: "Nåt gick snett. Prova igen eller ring direkt." }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Anslutningen strular. Ring oss om det brådskar." }]);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[70] w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          aria-label="Öppna HM-assistenten"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[70] w-[min(380px,calc(100vw-2rem))] h-[min(600px,calc(100vh-2rem))] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">HM-assistenten</div>
              <div className="text-xs opacity-90">Svarar direkt · ingen väntetid</div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  className="text-xs opacity-80 hover:opacity-100 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                >
                  Rensa
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Stäng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg rounded-tl-sm p-3 text-sm text-gray-800 shadow-sm">
                  Tjena. Letar du efter bil, ATV eller nåt annat? Fråga på.
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Jag vill byta bil",
                    "Visa ATV för skogsarbete",
                    "Vad är min gamla värd?",
                    "Har ni släpvagn?",
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); setTimeout(send, 50); }}
                      className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-200 text-gray-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "ml-auto bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-tl-sm"
                }`}
                dangerouslySetInnerHTML={
                  m.role === "assistant"
                    ? { __html: linkify(m.content) }
                    : undefined
                }
              >
                {m.role === "user" ? m.content : undefined}
              </div>
            ))}
            {loading && (
              <div className="bg-white rounded-lg rounded-tl-sm p-3 shadow-sm flex items-center gap-2 text-gray-500 text-sm max-w-[85%]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Tänker...
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-gray-200 p-3 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Skriv din fråga..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function linkify(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /(\/fordon\/[a-z0-9-]+|\/kontakt|\/om-oss|\/blogg\/[a-z0-9-]+)/gi,
    '<a href="$1" class="text-blue-600 underline font-medium">$1</a>'
  );
}
