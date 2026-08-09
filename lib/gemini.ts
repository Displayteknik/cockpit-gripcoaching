// Gemini API wrapper — server-side only. Uses GEMINI_API_KEY env var.
// Models: gemini-2.5-flash (snabb, idégenerering), gemini-2.5-pro (coach, content, djup)

import { WRITING_RULES_BLOCK } from "@/lib/content/writing-rules";
import { anropaProvider } from "@/lib/ai-usage";
import type { GenereringsMeta } from "@/lib/generationslogg";

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
  /**
   * Globala skrivregler (lib/content/writing-rules) vävs in i systemInstruction.
   * DEFAULT PÅ för allt som har en systemInstruction — så varje textgenerator, även
   * framtida, får reglerna utan att någon behöver komma ihåg det. Sätt false för
   * strukturerade anrop som inte producerar kundtext (extraktion, klassning, vision).
   */
  skrivregler?: boolean;
  /** KOSTNAD-1: flödesnamn i kostnadsloggen. Utelämnad härleds den ur requestens sökväg. */
  flow?: string;
  /** KOSTNAD-1: tenant i kostnadsloggen. Utelämnad härleds den ur sessionen. */
  tenantId?: string | null;
  /**
   * G-1: metadata om genereringen (syfte, format, promptversion). Skickas vidare till
   * lib/ai-usage, som skriver raden i generation_log och binder den till kostnaden.
   * Utelämnad loggas ingen generering — luckan syns i vyn i stället för att gissas.
   */
  generering?: GenereringsMeta;
}

/**
 * Väver in de globala skrivreglerna sist i systemInstruction (sist = väger tyngst).
 * Idempotent: en route som redan lagt in blocket själv får det inte två gånger.
 * Detta är kärnpunkten som gör språkkvaliteten systemsäkrad i stället för att bero på
 * att varje enskild generator kommer ihåg reglerna.
 */
function medSkrivregler(opts: GenerateOptions): string {
  const sys = opts.systemInstruction || "";
  if (opts.skrivregler === false) return sys;
  if (sys.includes("GLOBALA SKRIVREGLER")) return sys;
  return `${sys}\n\n${WRITING_RULES_BLOCK}`;
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
    body.systemInstruction = { parts: [{ text: medSkrivregler(opts) }] };
  }

  // KOSTNAD-1: all providertrafik går genom lib/ai-usage. Wrappern läser alltid
  // svarskroppen, klassar felet och loggar raden — även när anropet misslyckas.
  const svar = await anropaProvider<GeminiSvar>({
    provider: "gemini",
    model,
    flow: opts.flow,
    tenantId: opts.tenantId,
    generering: opts.generering,
    url: `${API_BASE}/${model}:generateContent?key=${apiKey}`,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  if (svar.budgetstopp) throw new Error(svar.fel);
  if (!svar.ok) throw new Error(`Gemini ${svar.status}: ${svar.raw}`);

  const out = svar.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Gemini: tomt svar");
  return out;
}

interface GeminiSvar {
  candidates?: { content?: { parts?: { text?: string }[] }; groundingMetadata?: { groundingChunks?: { web?: { title?: string; uri?: string } }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

export interface GenerateUsage { input: number; output: number; total: number }
export interface GenerateWithUsageResult {
  text: string;
  usage: GenerateUsage;
  /** G-1: raden i generation_log, när `generering` skickades med. Behövs för att binda
   *  genereringen till inlägget den blev (`kopplaTillInlagg`). */
  generationId?: string | null;
}

// Som generate(), men returnerar även faktisk token-användning (usageMetadata) för
// kostnadsloggning. Delad kropp med generate() vore snyggare, men detta håller
// generate()-signaturen orörd (många anropare) — medveten liten duplicering.
export async function generateWithUsage(opts: GenerateOptions): Promise<GenerateWithUsageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas i env");

  const model = opts.model ?? "gemini-2.5-flash";
  const contents: GeminiMessage[] = opts.messages ?? [{ role: "user", parts: [{ text: opts.prompt ?? "" }] }];
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
  if (opts.systemInstruction) body.systemInstruction = { parts: [{ text: medSkrivregler(opts) }] };

  const svar = await anropaProvider<GeminiSvar>({
    provider: "gemini",
    model,
    flow: opts.flow,
    tenantId: opts.tenantId,
    generering: opts.generering,
    url: `${API_BASE}/${model}:generateContent?key=${apiKey}`,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  });
  if (svar.budgetstopp) throw new Error(svar.fel);
  if (!svar.ok) throw new Error(`Gemini ${svar.status}: ${svar.raw}`);

  const data = svar.data;
  const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Gemini: tomt svar");
  const u = data?.usageMetadata || {};
  return {
    text: out,
    usage: {
      input: Number(u.promptTokenCount) || 0,
      output: Number(u.candidatesTokenCount) || 0,
      total: Number(u.totalTokenCount) || 0,
    },
    generationId: svar.generationId ?? null,
  };
}

export interface GroundedResult {
  text: string;
  sources: { title: string; uri: string }[];
}

// Gemini med Google Search-grounding = LIVE webb-svar + källor. Används för AI-synlighetstest
// (kollar om en klient nämns i AI-svar idag), inte träningsminne.
export async function groundedGenerate(
  prompt: string,
  opts?: { model?: GeminiModel; temperature?: number; maxOutputTokens?: number; flow?: string; tenantId?: string | null }
): Promise<GroundedResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY saknas i env");
  const model = opts?.model ?? "gemini-2.5-flash";
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: opts?.temperature ?? 0.3,
      maxOutputTokens: opts?.maxOutputTokens ?? 1500,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const svar = await anropaProvider<GeminiSvar>({
    provider: "gemini",
    model,
    flow: opts?.flow,
    tenantId: opts?.tenantId,
    url: `${API_BASE}/${model}:generateContent?key=${apiKey}`,
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) },
  });
  if (svar.budgetstopp) throw new Error(svar.fel);
  if (!svar.ok) throw new Error(`Gemini grounded ${svar.status}: ${svar.raw}`);
  const cand = svar.data?.candidates?.[0] ?? {};
  const text = ((cand.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
  const chunks = (cand.groundingMetadata?.groundingChunks ?? []) as { web?: { title?: string; uri?: string } }[];
  const seen = new Set<string>();
  const sources = chunks
    .map((c) => ({ title: c.web?.title ?? "", uri: c.web?.uri ?? "" }))
    .filter((s) => s.uri && s.title && !seen.has(s.title) && seen.add(s.title));
  return { text, sources };
}

/**
 * Som generateJSON(), men lämnar tillbaka generations-id:t (G-1c) så flödet kan binda
 * genereringen till det som sparas. Parsningen är identisk — den ligger i en delad
 * hjälpare så de två vägarna aldrig kan börja tolka svaret olika.
 */
export async function generateJSONWithUsage<T = unknown>(
  opts: GenerateOptions,
): Promise<{ data: T; generationId: string | null }> {
  const r = await generateWithUsage({ ...opts, jsonMode: true });
  return { data: tolkaJsonSvar<T>(r.text), generationId: r.generationId ?? null };
}

/** Parsar Geminis JSON-svar. Faller tillbaka på första JSON-blocket i texten. */
function tolkaJsonSvar<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Gemini: kunde inte parsa JSON: " + raw.slice(0, 200));
  }
}

export async function generateJSON<T = unknown>(opts: GenerateOptions): Promise<T> {
  // TEXT-1: samma skrivregler-default som generate() — JSON-läget är ett FORMAT, inte
  // ett undantag från innehållsreglerna. Kundtext i JSON (LinkedIn, nyhetsbrev, social)
  // ska ha reglerna; rena klassnings-/extraktionsanrop sätter skrivregler: false EXPLICIT.
  return tolkaJsonSvar<T>(await generate({ ...opts, jsonMode: true }));
}
