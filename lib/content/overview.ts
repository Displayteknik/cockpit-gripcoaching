// Innehålls-navet (Etapp I): EN enhetlig vy över allt innehåll för en klient,
// aggregerat ur alla verkstäder (Studio, Skapa inlägg, LinkedIn, Blogg).
// Normaliserar olika tabellers status till EN modell → hub + kalender läser detta.

import { supabaseService } from "@/lib/supabase-admin";

export type ContentStatus = "idea" | "draft" | "scheduled" | "published" | "failed";
export type ContentSource = "studio" | "social" | "linkedin" | "blog";

export interface ContentItem {
  id: string;
  source: ContentSource;
  title: string;
  channel: string; // instagram | facebook | linkedin | social | blogg
  status: ContentStatus;
  when: string | null; // ISO: schemalagt → publicerat → skapat
  imageUrl: string | null;
  excerpt: string | null; // kort textutdrag, så en post kan visas utan att öppna verkstaden
  error?: string | null;  // felmeddelande när en publicering misslyckats (syns i kalendern)
  editHref: string; // länk till verkstaden
  /**
   * VECKA-2 (Håkans fynd 11/8): vad som SAKNAS innan inlägget kan publiceras.
   * Veckoplaneringen skriver bara bildtexten — texten PÅ bilden och bilden lämnas till
   * Studio med flit (captionens anatomi passar inte på en affisch, se lib/studio/pa-bild.ts).
   * Han läste "3 utkast skapade" som tre färdiga inlägg. Kalendern säger nu vad som fattas
   * i stället för att brickan ser färdig ut.
   * Tom lista = inget känt saknas. Bara studio-källan mäts; övriga verkstäder har inte
   * begreppet "text på bilden".
   */
  saknar?: ("text-pa-bild" | "bild")[];
  // Content Compass-profil (null = oklassat). Tillagt CC-1, additivt.
  funnel_level: string | null;
  four_a: string | null;
  disc: string[] | null;
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

/**
 * Vad fattas i ett studio-inlägg? Läser payloaden: rubrik/brödtext/slides = texten PÅ bilden,
 * `image_url` eller payloadens bild = bilden. Publicerade inlägg mäts inte — där är frågan
 * inte längre vad som saknas.
 *
 * Fail-open: går payloaden inte att läsa returneras tom lista. En felaktig "saknar bild" på
 * ett färdigt inlägg är värre än ingen markering alls.
 */
export function saknasIStudioInlagg(payload: unknown, imageUrl: string | null | undefined): ("text-pa-bild" | "bild")[] {
  const p = (payload || {}) as Record<string, unknown>;
  const ut: ("text-pa-bild" | "bild")[] = [];
  const slides = Array.isArray(p.slides) ? (p.slides as Record<string, unknown>[]) : [];
  const harPabild = Boolean(
    String(p.headline1 ?? "").trim() ||
    String(p.headline2 ?? "").trim() ||
    String(p.body ?? "").trim() ||
    slides.some((sl) => String(sl?.headline ?? "").trim() || String(sl?.body ?? "").trim()),
  );
  const harBild = Boolean(
    (imageUrl || "").trim() ||
    String(p.imageUrl ?? "").trim() ||
    String(p.videoUrl ?? "").trim() ||
    slides.some((sl) => String(sl?.imageUrl ?? "").trim()),
  );
  if (!harPabild) ut.push("text-pa-bild");
  if (!harBild) ut.push("bild");
  return ut;
}

function firstLine(s: string | null | undefined, fallback: string): string {
  const t = (s || "").trim();
  if (!t) return fallback;
  const line = t.split("\n")[0];
  return line.length > 80 ? line.slice(0, 77) + "…" : line;
}

// Kort, läsbart utdrag (HTML bortstädat) för detaljvyn i kalendern.
function utdrag(t: string | null | undefined): string | null {
  const rent = String(t || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!rent) return null;
  return rent.length > 400 ? rent.slice(0, 397) + "…" : rent;
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

  const [studio, social, linkedin, blog, kon] = await Promise.all([
    sb.from("studio_posts").select("id, title, caption, image_url, format, ghl_status, scheduled_at, created_at, funnel_level, four_a, disc, payload").eq("client_id", clientId).order("updated_at", { ascending: false }).limit(100),
    sb.from("hm_social_posts").select("id, platform, hook, caption, image_url, status, scheduled_for, published_at, created_at, funnel_level, four_a, disc").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    sb.from("linkedin_posts").select("id, hook, body, status, scheduled_for, posted_at, created_at, funnel_level, four_a, disc").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    sb.from("hm_blog").select("id, title, image_url, published, published_at, created_at, funnel_level, four_a, disc").eq("client_id", clientId).order("created_at", { ascending: false }).limit(100),
    // Schemakön: misslyckade publiceringar MÅSTE synas i kalendern, inte bara i kö-panelen.
    sb.from("studio_scheduled").select("id, title, caption, media_url, channel, status, scheduled_at, error").eq("client_id", clientId).eq("status", "failed").order("scheduled_at", { ascending: false }).limit(50),
  ]);

  const items: ContentItem[] = [];

  for (const p of studio.data || []) {
    const status = normStatus({ scheduled: p.ghl_status === "scheduled", published: p.ghl_status === "published", raw: p.ghl_status });
    items.push({
      id: String(p.id), source: "studio", title: firstLine(p.title || p.caption, "Studio-inlägg"),
      channel: "social", status, when: p.scheduled_at || p.created_at, imageUrl: p.image_url, excerpt: utdrag(p.caption), editHref: `${WORKSHOP.studio}?post=${p.id}`,
      saknar: saknasIStudioInlagg(p.payload, p.image_url),
      funnel_level: p.funnel_level ?? null, four_a: p.four_a ?? null, disc: p.disc ?? null,
    });
  }
  for (const p of social.data || []) {
    const status = normStatus({ published: !!p.published_at, scheduled: !!p.scheduled_for, raw: p.status });
    items.push({
      id: String(p.id), source: "social", title: firstLine(p.hook || p.caption, "Inlägg"),
      channel: (p.platform || "social").toLowerCase(), status, when: p.scheduled_for || p.published_at || p.created_at, imageUrl: p.image_url, excerpt: utdrag(p.caption), editHref: WORKSHOP.social,
      funnel_level: p.funnel_level ?? null, four_a: p.four_a ?? null, disc: p.disc ?? null,
    });
  }
  for (const p of linkedin.data || []) {
    const status = normStatus({ published: !!p.posted_at, scheduled: !!p.scheduled_for, raw: p.status });
    items.push({
      id: String(p.id), source: "linkedin", title: firstLine(p.hook || p.body, "LinkedIn-inlägg"),
      channel: "linkedin", status, when: p.scheduled_for || p.posted_at || p.created_at, imageUrl: null, excerpt: utdrag(p.body), editHref: WORKSHOP.linkedin,
      funnel_level: p.funnel_level ?? null, four_a: p.four_a ?? null, disc: p.disc ?? null,
    });
  }
  for (const p of blog.data || []) {
    // Schemalagd blogg = opublicerad med framtida published_at (native blogg-schema).
    const scheduledBlog = !p.published && !!p.published_at && new Date(p.published_at).getTime() > Date.now();
    const status = normStatus({ published: !!p.published, scheduled: scheduledBlog });
    items.push({
      id: String(p.id), source: "blog", title: firstLine(p.title, "Bloggartikel"),
      channel: "blogg", status, when: p.published_at || p.created_at, imageUrl: p.image_url, excerpt: null, editHref: WORKSHOP.blog,
      funnel_level: p.funnel_level ?? null, four_a: p.four_a ?? null, disc: p.disc ?? null,
    });
  }

  // Misslyckade schemalagda publiceringar → egna poster med felet synligt.
  for (const j of kon.data || []) {
    items.push({
      id: String(j.id), source: "studio", title: firstLine(j.title || j.caption, "Schemalagt inlägg"),
      channel: String(j.channel || "").includes("blog") ? "blogg" : "social",
      status: "failed", when: j.scheduled_at, imageUrl: j.media_url, excerpt: utdrag(j.caption),
      error: j.error || "Publiceringen misslyckades", editHref: WORKSHOP.studio,
      funnel_level: null, four_a: null, disc: null,
    });
  }

  // Sortera: schemalagt/kommande först (närmast i tiden), sedan senaste.
  items.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  const counts: Record<ContentStatus, number> = { idea: 0, draft: 0, scheduled: 0, published: 0, failed: 0 };
  for (const it of items) counts[it.status]++;

  return { items, counts };
}
