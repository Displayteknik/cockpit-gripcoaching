import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, HM_MOTOR_ID } from "@/lib/client-context";

export const runtime = "nodejs";

// Föreslår interna länkar för en artikel-text. Enkel keyword-matching.
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  if (clientId !== HM_MOTOR_ID) return NextResponse.json([]);
  const body = await req.json();
  const text: string = (body.text || "").toLowerCase();
  const currentSlug: string | undefined = body.current_slug;

  const sb = supabaseServer();
  const { data: posts } = await sb.from("hm_blog").select("title, slug, excerpt").eq("published", true);
  const { data: vehicles } = await sb.from("hm_vehicles").select("title, slug, brand, model, category").eq("is_sold", false);

  type Suggestion = { type: "blog" | "vehicle"; title: string; href: string; matches: string[]; score: number };
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

  suggestions.sort((a, b) => b.score - a.score);
  return NextResponse.json(suggestions.slice(0, 10));
}
