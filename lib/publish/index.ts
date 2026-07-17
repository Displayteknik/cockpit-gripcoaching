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
import { getIgConnection, publishSingle, publishCarousel, publishStory, publishReel } from "@/lib/instagram";
import { ensureJpegUrl } from "@/lib/images";
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
  mediaUrl?: string;       // enkel bild (IG kräver JPEG, publik URL)
  slideUrls?: string[];    // karusell (2–10 JPEG)
  videoUrl?: string;       // reel
  coverUrl?: string;       // reel-omslag
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
      return publishIgGraph(req);
    default:
      return fail(req.channel, "Okänd kanal");
  }
}

// ── Instagram Graph (skarp direktpublicering) ──
// All Graph-logik lever i lib/instagram.ts (verifierad mot Metas aktuella docs:
// container → status FINISHED → media_publish). Denna funktion är EN vägen in —
// gamla /api/instagram/publish-routerna delegerar hit.
// Meta-krav (verifierat juli 2026): bild = JPEG, publik URL. Studio/Gemini renderar
// PNG → vi KONVERTERAR till JPEG (sharp) och hostar om vid publicering, i stället
// för att stoppa. ensureJpegUrl returnerar en JPEG-URL (eller genskjuter om redan JPEG).
async function publishIgGraph(req: PublishRequest): Promise<PublishResult> {
  const conn = await getIgConnection(req.clientId);
  if (!conn?.ig_account_id || !conn.ig_access_token) {
    return fail("ig-graph", "Instagram är inte kopplat för den här klienten.");
  }
  const accId = conn.ig_account_id;
  const token = conn.ig_access_token;
  const caption = req.caption || "";
  try {
    // Karusell (2–10 bilder) — varje bild säkras till JPEG.
    if (req.slideUrls && req.slideUrls.length >= 2) {
      const jpegs: string[] = [];
      for (const s of req.slideUrls) {
        const j = await ensureJpegUrl(s);
        if (!j.url) return fail("ig-graph", `Karusellbild kunde inte förberedas: ${j.error}`);
        jpegs.push(j.url);
      }
      const { id } = await publishCarousel(accId, token, jpegs, caption);
      return { status: "published", id, channel: "ig-graph" };
    }
    // Reel (video + ev. omslag)
    if (req.postType === "reel" || req.videoUrl) {
      if (!req.videoUrl) return fail("ig-graph", "Reel kräver en video-URL.");
      const { id } = await publishReel(accId, token, req.videoUrl, caption, req.coverUrl);
      return { status: "published", id, channel: "ig-graph" };
    }
    // Story (bild → JPEG)
    if (req.postType === "story") {
      if (!req.mediaUrl) return fail("ig-graph", "Story kräver en bild-URL.");
      const j = await ensureJpegUrl(req.mediaUrl);
      if (!j.url) return fail("ig-graph", `Story-bild kunde inte förberedas: ${j.error}`);
      const { id } = await publishStory(accId, token, j.url);
      return { status: "published", id, channel: "ig-graph" };
    }
    // Enkel bild → JPEG
    if (!req.mediaUrl) return fail("ig-graph", "Inlägget kräver en bild-URL.");
    const j = await ensureJpegUrl(req.mediaUrl);
    if (!j.url) return fail("ig-graph", `Bilden kunde inte förberedas: ${j.error}`);
    const { id } = await publishSingle(accId, token, j.url, caption);
    return { status: "published", id, channel: "ig-graph" };
  } catch (e) {
    return fail("ig-graph", (e as Error).message);
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
