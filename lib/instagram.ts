// Instagram Graph API — publish + insights + profile-info.
// Kräver: ig_account_id + ig_access_token per klient (sparas i clients-tabellen).
// Tokens får man via Facebook Developer Portal → Instagram Graph API → Long-lived token.

const BASE = "https://graph.facebook.com/v21.0";

export interface IgClient { id: string; ig_account_id: string | null; ig_access_token: string | null; }

export async function getIgConnection(clientId: string): Promise<IgClient | null> {
  const { supabaseServer } = await import("./supabase-admin");
  const sb = supabaseServer();
  const { data } = await sb.from("clients").select("id, ig_account_id, ig_access_token").eq("id", clientId).maybeSingle();
  if (!data?.ig_account_id || !data?.ig_access_token) return null;
  return data as IgClient;
}

export async function igGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`IG GET ${path}: ${await r.text()}`);
  return r.json();
}

export async function igPost(path: string, token: string, body: Record<string, string>) {
  const params = new URLSearchParams({ ...body, access_token: token });
  const r = await fetch(`${BASE}${path}`, { method: "POST", body: params });
  if (!r.ok) throw new Error(`IG POST ${path}: ${await r.text()}`);
  return r.json();
}

// SINGLE IMAGE
export async function publishSingle(igAccountId: string, token: string, imageUrl: string, caption: string): Promise<{ id: string }> {
  const container = await igPost(`/${igAccountId}/media`, token, { image_url: imageUrl, caption });
  // Poll status
  await waitContainerReady(container.id, token);
  const published = await igPost(`/${igAccountId}/media_publish`, token, { creation_id: container.id });
  return { id: published.id };
}

// REEL (video)
export async function publishReel(igAccountId: string, token: string, videoUrl: string, caption: string, coverUrl?: string): Promise<{ id: string }> {
  const body: Record<string, string> = { media_type: "REELS", video_url: videoUrl, caption };
  if (coverUrl) body.cover_url = coverUrl;
  const container = await igPost(`/${igAccountId}/media`, token, body);
  await waitContainerReady(container.id, token, 60); // reels tar längre
  const published = await igPost(`/${igAccountId}/media_publish`, token, { creation_id: container.id });
  return { id: published.id };
}

// CAROUSEL: skapa item-containers, sen carousel-container, publicera
export async function publishCarousel(igAccountId: string, token: string, imageUrls: string[], caption: string): Promise<{ id: string }> {
  if (imageUrls.length < 2 || imageUrls.length > 10) throw new Error("Carousel kräver 2–10 bilder");
  const childrenIds: string[] = [];
  for (const url of imageUrls) {
    const c = await igPost(`/${igAccountId}/media`, token, { image_url: url, is_carousel_item: "true" });
    childrenIds.push(c.id);
  }
  const carousel = await igPost(`/${igAccountId}/media`, token, {
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
  });
  await waitContainerReady(carousel.id, token);
  const published = await igPost(`/${igAccountId}/media_publish`, token, { creation_id: carousel.id });
  return { id: published.id };
}

// STORY (image)
export async function publishStory(igAccountId: string, token: string, imageUrl: string): Promise<{ id: string }> {
  const c = await igPost(`/${igAccountId}/media`, token, { media_type: "STORIES", image_url: imageUrl });
  const published = await igPost(`/${igAccountId}/media_publish`, token, { creation_id: c.id });
  return { id: published.id };
}

async function waitContainerReady(containerId: string, token: string, maxSec = 30): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxSec * 1000) {
    const status = await igGet(`/${containerId}`, token, { fields: "status_code" });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error("Container failed: " + status.status_code);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Container timeout — försök igen");
}

// Profile info
export async function getProfile(igAccountId: string, token: string) {
  return igGet(`/${igAccountId}`, token, {
    fields: "username,name,profile_picture_url,followers_count,follows_count,media_count,biography",
  });
}

// Recent media + insights
export async function getRecentMedia(igAccountId: string, token: string, limit = 25) {
  return igGet(`/${igAccountId}/media`, token, {
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    limit: String(limit),
  });
}

export async function getMediaInsights(mediaId: string, token: string, mediaType: string) {
  // Reels har andra metrics än images
  const metrics = mediaType === "VIDEO" || mediaType === "REELS"
    ? "plays,reach,likes,comments,saved,shares,total_interactions"
    : "reach,likes,comments,saved,shares,total_interactions";
  try {
    return await igGet(`/${mediaId}/insights`, token, { metric: metrics });
  } catch {
    return { data: [] };
  }
}

// Public profile-scrape (för konkurrenter — ingen auth, begränsad data)
// Använder Instagram's web-profile-info-endpoint som inte officiellt är öppen
// men funkar för publika profiler. Best-effort, kan brytas.
export async function publicProfileSnapshot(handle: string): Promise<{ followers?: number; following?: number; posts?: number; bio?: string; full_name?: string; verified?: boolean; error?: string }> {
  const username = handle.replace(/^@/, "").trim();
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Cockpit/1.0)",
        "X-IG-App-ID": "936619743392459",
        "Accept": "application/json",
      },
    });
    if (!r.ok) return { error: `Instagram svarade ${r.status}` };
    const data = await r.json();
    const u = data?.data?.user;
    if (!u) return { error: "Profil hittades inte eller är privat" };
    return {
      followers: u.edge_followed_by?.count,
      following: u.edge_follow?.count,
      posts: u.edge_owner_to_timeline_media?.count,
      bio: u.biography,
      full_name: u.full_name,
      verified: u.is_verified,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
