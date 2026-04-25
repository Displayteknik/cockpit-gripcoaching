import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

let cache: Map<string, string> | null = null;

async function loadAll(): Promise<Map<string, string>> {
  if (cache) return cache;
  const map = new Map<string, string>();
  try {
    const files = await readdir(KNOWLEDGE_DIR);
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const content = await readFile(path.join(KNOWLEDGE_DIR, f), "utf8");
      map.set(f.replace(/\.md$/, ""), content);
    }
  } catch (e) {
    console.error("knowledge load error", e);
  }
  cache = map;
  return map;
}

export async function getKnowledge(...names: string[]): Promise<string> {
  const all = await loadAll();
  const staticPart = names
    .map((n) => {
      const c = all.get(n);
      return c ? `# ═══ ${n} ═══\n\n${c}` : "";
    })
    .filter(Boolean)
    .join("\n\n");

  const profile = await getProfileAsMarkdown();
  return profile ? `${profile}\n\n${staticPart}` : staticPart;
}

export async function getProfileAsMarkdown(): Promise<string> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { getActiveClientId } = await import("./client-context");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const clientId = await getActiveClientId();
    const { data } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();
    if (!data) return "";

    const sections: [string, string | null][] = [
      ["Företagsnamn", data.company_name],
      ["Tagline", data.tagline],
      ["Plats", data.location],
      ["Grundare", data.founder_name],
      ["Kontakt", [data.founder_phone, data.founder_email].filter(Boolean).join(" · ")],
      ["Brand story", data.brand_story],
      ["USP (det som skiljer oss)", data.usp],
      ["Tonregler", data.tone_rules],
      ["Primär ICP", data.icp_primary],
      ["Sekundär ICP", data.icp_secondary],
      ["Smärtpunkter kunden har", data.pain_points],
      ["Voice of Customer (kundord)", data.customer_quotes],
      ["Konkurrenter", data.competitors],
      ["Kundresa", data.customer_journey],
      ["GÖR", data.dos],
      ["GÖR INTE", data.donts],
      ["Hashtag-bas", data.hashtags_base],
    ];

    const body = sections
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `## ${k}\n${v}`)
      .join("\n\n");

    return body ? `# ═══ brand-profile (live från dashboard) ═══\n\n${body}` : "";
  } catch {
    return "";
  }
}

export async function getAllKnowledge(): Promise<string> {
  const all = await loadAll();
  return Array.from(all.entries())
    .map(([name, content]) => `# ═══ ${name} ═══\n\n${content}`)
    .join("\n\n");
}
