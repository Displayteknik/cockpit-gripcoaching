import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { getIgConnection, publishSingle, publishCarousel, publishStory } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const { post_id } = await req.json();
  if (!post_id) return NextResponse.json({ error: "post_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const conn = await getIgConnection(clientId);
  if (!conn) return NextResponse.json({ error: "Instagram inte anslutet för denna klient" }, { status: 400 });

  const { data: post } = await sb.from("hm_social_posts").select("*").eq("id", post_id).eq("client_id", clientId).single();
  if (!post) return NextResponse.json({ error: "Inlägg hittades inte" }, { status: 404 });
  if (post.platform !== "instagram") return NextResponse.json({ error: "Endast Instagram-inlägg kan publiceras härifrån" }, { status: 400 });

  const fullCaption = `${post.caption}\n\n${post.hashtags || ""}`.trim();

  try {
    let result: { id: string };
    if (post.format === "carousel") {
      const slideUrls: string[] = (post.slides || []).map((s: { image_url?: string }) => s.image_url).filter(Boolean);
      if (slideUrls.length < 2) return NextResponse.json({ error: "Carousel kräver bilder på minst 2 slides" }, { status: 400 });
      result = await publishCarousel(conn.ig_account_id!, conn.ig_access_token!, slideUrls, fullCaption);
    } else if (post.format === "story") {
      if (!post.image_url) return NextResponse.json({ error: "Story kräver en bild" }, { status: 400 });
      result = await publishStory(conn.ig_account_id!, conn.ig_access_token!, post.image_url);
    } else {
      // single, reel etc — fallback till single image om bild finns
      if (!post.image_url) return NextResponse.json({ error: "Bild krävs för publicering" }, { status: 400 });
      result = await publishSingle(conn.ig_account_id!, conn.ig_access_token!, post.image_url, fullCaption);
    }

    await sb.from("hm_social_posts").update({
      status: "published",
      published_at: new Date().toISOString(),
    }).eq("id", post_id);

    await logActivity(clientId, "ig_published", `Publicerat på Instagram: ${post.format}`, undefined, { ig_media_id: result.id });
    return NextResponse.json({ ok: true, ig_media_id: result.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
