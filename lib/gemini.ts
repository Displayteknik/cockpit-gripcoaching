// Gemini API wrapper — server-side only. Uses GEMINI_API_KEY env var.
// Models: gemini-2.5-flash (snabb, idégenerering), gemini-2.5-pro (coach, content, djup)

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiModel = "gemini-2.5-flash" | "gemini-2.5-pro";

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GenerateOptions {
  model?: GeminiModel;
  systemInstruction?: string;
  messages?: GeminiMessage[];
  prompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export async function generate(opts: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas i env");

  const model = opts.model ?? "gemini-2.5-flash";
  const contents: GeminiMessage[] =
    opts.messages ?? [{ role: "user", parts: [{ text: opts.prompt ?? "" }] }];

  const isPro = model === "gemini-2.5-pro";
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.8,
      maxOutputTokens: opts.maxOutputTokens ?? (isPro ? 8192 : 4096),
      thinkingConfig: isPro ? { thinkingBudget: 1024 } : { thinkingBudget: 0 },
      ...(opts.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text}`);
  }

  const data = await res.json();
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Gemini: tomt svar");
  return out;
}

export async function generateJSON<T = unknown>(opts: GenerateOptions): Promise<T> {
  const raw = await generate({ ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fallback: extrahera första JSON-blocket
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Gemini: kunde inte parsa JSON: " + raw.slice(0, 200));
  }
}
