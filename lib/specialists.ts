import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export type SpecialistInput = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  options?: string[];
};

export type SpecialistMeta = {
  id: string;
  name: string;
  category: string;
  model: string;
  target_app: "cockpit" | "mysales-coach" | "both";
  version: number;
  inputs: SpecialistInput[];
  iterate?: boolean;          // generera N varianter, valj basta via voice-score
  variants?: number;          // antal varianter (default 3)
  target_length_min?: number; // ord
  target_length_max?: number; // ord
};

export type Specialist = SpecialistMeta & {
  systemPrompt: string;
};

const DIR = path.join(process.cwd(), "prompts", "specialists");
let cache: Specialist[] | null = null;

export async function loadSpecialists(): Promise<Specialist[]> {
  if (cache) return cache;
  const files = (await readdir(DIR)).filter((f) => f.endsWith(".md"));
  const list: Specialist[] = [];
  for (const f of files) {
    const raw = await readFile(path.join(DIR, f), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Partial<SpecialistMeta>;
    if (!data.id || !data.name) continue;
    list.push({
      id: data.id,
      name: data.name,
      category: data.category ?? "general",
      model: data.model ?? "claude-sonnet-4-5",
      target_app: (data.target_app as Specialist["target_app"]) ?? "both",
      version: data.version ?? 1,
      inputs: data.inputs ?? [],
      iterate: data.iterate ?? false,
      variants: data.variants ?? 3,
      target_length_min: data.target_length_min,
      target_length_max: data.target_length_max,
      systemPrompt: parsed.content.trim(),
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
  cache = list;
  return list;
}

export async function getSpecialist(id: string): Promise<Specialist | null> {
  const list = await loadSpecialists();
  return list.find((s) => s.id === id) ?? null;
}

export function buildUserPrompt(
  specialist: Specialist,
  inputs: Record<string, string>
): string {
  const lines: string[] = ["Inputs från användaren:", ""];
  for (const field of specialist.inputs) {
    const v = inputs[field.key]?.trim();
    if (!v) continue;
    lines.push(`### ${field.label}`);
    lines.push(v);
    lines.push("");
  }
  lines.push("---");
  lines.push("Leverera enligt instruktionerna ovan. Svenska om input är svensk.");
  return lines.join("\n");
}
