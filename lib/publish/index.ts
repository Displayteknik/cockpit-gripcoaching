// Etapp J — EN publiceringsmodul. Alla motorer (Studio, blogg, framtida Skapa inlägg)
// anropar publishContent() istället för egna publiceringsknappar med olika beteende.
// Routar till rätt backend och returnerar EN gemensam statusmodell.
//
// Kanaler:
//   ghl-social   → GHL Social Planner (utkast/schemalagt) — bild/story/reel
//   ghl-blog     → GHL Blogs (utkast)
//   cockpit-blog → intern sajt (hm_blog)
//   ig-graph     → Instagram Graph (hanteras ännu i Skapa inlägg-motorn — migreras hit)

import { getGhlConfig, ghlFirstUserId, ghlCreateDraft, ghlCreateBlogDraft } from "@/lib/studio/ghl";
import { supabaseService } from "@/lib/supabase-admin";

export type PublishChannel = "ghl-social" | "ghl-blog" | "cockpit-blog" | "ig-graph";
export type PublishStatus = "draft" | "scheduled" | "published" | "failed";

export interface PublishRequest {
  clientId: string;
  channel: PublishChannel;
  // sociala fält
  accountIds?: string[];
  postType?: "post" | "story" | "reel";
  caption?: string;
  mediaUrl?: string;
  scheduleDate?: string; // ISO → schemalägg
  // blogg-fält
  blog?: {
    blogId?: string; title: string; html: string; description?: string; urlSlug?: string;
    author?: string; categories?: string[]; imageUrl?: string;
  };
}

export interface PublishResult {
  status: PublishStatus;
  id?: string; // backend-postens id
  error?: string;
  channel: PublishChannel;
}

function fail(channel: PublishChannel, error: string): PublishResult {
  return { status: "failed", error, channel };
}

export async function publishContent(req: PublishRequest): Promise<PublishResult> {
  switch (req.channel) {
    case "ghl-social":
      return publishGhlSocial(req);
    case "ghl-blog":
      return publishGhlBlog(req);
    case "cockpit-blog":
      return publishCockpitBlog(req);
    case "ig-graph":
      return fail("ig-graph", "Instagram Graph-publicering hanteras i Skapa inlägg-motorn (migreras till denna modul).");
    default:
      return fail(req.channel, "Okänd kanal");
  }
}

// ── GHL Social Planner (bild/story/reel, utkast eller schemalagt) ──
async function publishGhlSocial(req: PublishRequest): Promise<PublishResult> {
  const accountIds = (req.accountIds || []).filter(Boolean);
  if (!accountIds.length) return fail("ghl-social", "Välj minst ett konto att publicera till.");
  const cfg = await getGhlConfig(req.clientId);
  if (!cfg) return fail("ghl-social", "GHL är inte kopplat för den här klienten.");
  const userId = await ghlFirstUserId(cfg);
  if (!userId) return fail("ghl-social", "Kunde inte hämta GHL-användare för location.");

  const { postId, error, scheduled } = await ghlCreateDraft(cfg, {
    accountIds, summary: req.caption || "", mediaUrl: req.mediaUrl, userId,
    postType: req.postType, scheduleDate: req.scheduleDate,
  });
  if (error || !postId) return fail("ghl-social", error || "GHL skapade inget inlägg.");
  return { status: scheduled ? "scheduled" : "draft", id: postId, channel: "ghl-social" };
}

// ── GHL Blogs (utkast) ──
async function publishGhlBlog(req: PublishRequest): Promise<PublishResult> {
  if (!req.blog?.title || !req.blog.blogId) return fail("ghl-blog", "Blogg-titel och blogId krävs.");
  const cfg = await getGhlConfig(req.clientId);
  if (!cfg) return fail("ghl-blog", "GHL är inte kopplat för den här klienten.");
  const { postId, error } = await ghlCreateBlogDraft(cfg, {
    blogId: req.blog.blogId, title: req.blog.title, html: req.blog.html,
    description: req.blog.description, urlSlug: req.blog.urlSlug,
    author: req.blog.author, categories: req.blog.categories, imageUrl: req.blog.imageUrl,
  });
  if (error || !postId) return fail("ghl-blog", error || "GHL skapade ingen bloggpost.");
  return { status: "draft", id: postId, channel: "ghl-blog" };
}

// ── Cockpit-native blogg (hm_blog, opublicerat utkast) ──
function slugify(s: string): string {
  return s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "artikel";
}
async function publishCockpitBlog(req: PublishRequest): Promise<PublishResult> {
  if (!req.blog?.title) return fail("cockpit-blog", "Blogg-titel krävs.");
  try {
    const sb = supabaseService();
    const { data: clientRow } = await sb.from("clients").select("name").eq("id", req.clientId).maybeSingle();
    const { data, error } = await sb.from("hm_blog").insert({
      client_id: req.clientId, title: req.blog.title, content: req.blog.html,
      excerpt: (req.blog.description || "").slice(0, 300), slug: req.blog.urlSlug || slugify(req.blog.title),
      image_url: req.blog.imageUrl || null, author: clientRow?.name || "Redaktionen",
      published: false, published_at: new Date().toISOString(),
    }).select("id").single();
    if (error) return fail("cockpit-blog", error.message);
    return { status: "draft", id: String(data.id), channel: "cockpit-blog" };
  } catch (e) {
    return fail("cockpit-blog", (e as Error).message);
  }
}
