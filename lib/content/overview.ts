// Innehålls-navet (Etapp I): EN enhetlig vy över allt innehåll för en klient,
// aggregerat ur alla verkstäder (Studio, Skapa inlägg, LinkedIn, Blogg).
// Normaliserar olika tabellers status till EN modell → hub + kalender läser detta.

import { supabaseService } from "@/lib/supabase-admin";

export type ContentStatus = "idea" | "draft" | "scheduled" | "published";
export type ContentSource = "studio" | "social" | "linkedin" | "blog";

export interface ContentItem {
  id: string;
  source: ContentSource;
  title: string;
  channel: string; // instagram | facebook | linkedin | social | blogg
  status: ContentStatus;
  when: string | null; // ISO: schemalagt → publicerat → skapat
  imageUrl: string | null;
  editHref: string; // länk till verkstaden
}

export interface ContentOverview {
  items: ContentItem[];
  counts: Record<ContentStatus, number>;
}

const WORKSHOP: Record<ContentSource, string> = {
  studio: "/dashboard/studio",
  social: "/dashboard/skapa",
  linkedin: "/dashboard/linkedin",
  blog: "/dashboard/studio/blogg",
};

function firstLine(s: string | null | undefined, fallback: string): string {
  const t = (s || "").trim();
  if (!t) return fallback;
  const line = t.split("\n")[0];
  return line.length > 80 ? line.slice(0, 77) + "…" : line;
}

function normStatus(opts: { published?: boolean; scheduled?: boolean; raw?: string | null }): ContentStatus {
  const r = (opts.raw || "").toLowerCase();
  if (opts.published || r === "published" || r === "posted") return "published";
  if (opts.scheduled || r === "scheduled") return "scheduled";
  if (r === "idea") return "idea";
  return "draft";
}

export async function getContentOverview(clientId: string): Promise<ContentOverview> {
  const sb = supabaseService();

  const [studio, social, linkedin, blog] = await Promise.all([
    sb.from("studio_posts").select("id, title, caption, image_url, format, ghl_status, scheduled_at, created_at").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100),
    sb.from("hm_social_posts").select("id, platform, hook, caption, image_url, status, scheduled_for, published_at, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    sb.from("linkedin_posts").select("id, hook, body, status, scheduled_for, posted_at, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    sb.from("hm_blog").select("id, title, image_url, published, published_at, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
  ]);

  const items: ContentItem[] = [];

  for (const p of studio.data || []) {
    const status = normStatus({ scheduled: p.ghl_status === "scheduled", published: p.ghl_status === "published", raw: p.ghl_status });
    items.push({
      id: String(p.id), source: "studio", title: firstLine(p.title || p.caption, "Studio-inlägg"),
      channel: "social", status, when: p.scheduled_at || p.created_at, imageUrl: p.image_url, editHref: WORKSHOP.studio,
    });
  }
  for (const p of social.data || []) {
    const status = normStatus({ published: !!p.published_at, scheduled: !!p.scheduled_for, raw: p.status });
    items.push({
      id: String(p.id), source: "social", title: firstLine(p.hook || p.caption, "Inlägg"),
      channel: (p.platform || "social").toLowerCase(), status, when: p.scheduled_for || p.published_at || p.created_at, imageUrl: p.image_url, editHref: WORKSHOP.social,
    });
  }
  for (const p of linkedin.data || []) {
    const status = normStatus({ published: !!p.posted_at, scheduled: !!p.scheduled_for, raw: p.status });
    items.push({
      id: String(p.id), source: "linkedin", title: firstLine(p.hook || p.body, "LinkedIn-inlägg"),
      channel: "linkedin", status, when: p.scheduled_for || p.posted_at || p.created_at, imageUrl: null, editHref: WORKSHOP.linkedin,
    });
  }
  for (const p of blog.data || []) {
    const status = normStatus({ published: !!p.published, raw: p.published ? "published" : "draft" });
    items.push({
      id: String(p.id), source: "blog", title: firstLine(p.title, "Bloggartikel"),
      channel: "blogg", status, when: p.published_at || p.created_at, imageUrl: p.image_url, editHref: WORKSHOP.blog,
    });
  }

  // Sortera: schemalagt/kommande först (närmast i tiden), sedan senaste.
  items.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  const counts: Record<ContentStatus, number> = { idea: 0, draft: 0, scheduled: 0, published: 0 };
  for (const it of items) counts[it.status]++;

  return { items, counts };
}
