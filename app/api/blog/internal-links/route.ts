import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// Föreslår interna länkar för en artikel-text. Enkel keyword-matching.
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const body = await req.json();
  const text: string = (body.text || "").toLowerCase();
  const currentSlug: string | undefined = body.current_slug;

  const sb = supabaseServer();
  const { data: posts } = await sb.from("hm_blog").select("title, slug, excerpt").eq("client_id", clientId).eq("published", true);

  const isAutomotive = client?.resource_module === "automotive";
  const isArt = client?.resource_module === "art";

  const { data: vehicles } = isAutomotive
    ? await sb.from("hm_vehicles").select("title, slug, brand, model, category").eq("client_id", clientId).eq("is_sold", false)
    : { data: [] as { title: string; slug: string; brand: string; model: string; category: string }[] };

  const { data: works } = isArt
    ? await sb.from("art_works").select("title, slug, technique, tags").eq("client_id", clientId).neq("status", "archived")
    : { data: [] as { title: string; slug: string; technique: string; tags: string[] }[] };

  type Suggestion = { type: "blog" | "vehicle" | "art"; title: string; href: string; matches: string[]; score: number };
  const suggestions: Suggestion[] = [];

  for (const p of posts || []) {
    if (currentSlug && p.slug === currentSlug) continue;
    const tokens = (p.title + " " + (p.excerpt || "")).toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const matches = Array.from(new Set(tokens.filter((t) => text.includes(t))));
    if (matches.length >= 2) {
      suggestions.push({ type: "blog", title: p.title, href: `/blogg/${p.slug}`, matches: matches.slice(0, 5), score: matches.length });
    }
  }
  for (const v of vehicles || []) {
    const tokens = [v.title, v.brand, v.model, v.category].filter(Boolean).map((s) => (s as string).toLowerCase());
    const matches = tokens.filter((t) => text.includes(t));
    if (matches.length >= 2) {
      suggestions.push({ type: "vehicle", title: v.title, href: `/fordon/${v.slug}`, matches, score: matches.length });
    }
  }
  for (const w of works || []) {
    const tokens = [w.title, w.technique, ...(w.tags || [])].filter(Boolean).map((s) => String(s).toLowerCase());
    const matches = tokens.filter((t) => text.includes(t));
    if (matches.length >= 2) {
      suggestions.push({ type: "art", title: w.title, href: `/verk/${w.slug}`, matches, score: matches.length });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);
  return NextResponse.json(suggestions.slice(0, 10));
}
