// Internal endpoint — används av cron och kan ange client_id direkt
// (eftersom cron inte har user-cookie för aktiv klient)
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";
import { getIgConnection, publishSingle, publishCarousel, publishStory } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { post_id, client_id } = await req.json();
  if (!post_id || !client_id) return NextResponse.json({ error: "post_id + client_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const conn = await getIgConnection(client_id);
  if (!conn) return NextResponse.json({ error: "IG ej anslutet" }, { status: 400 });

  const { data: post } = await sb.from("hm_social_posts").select("*").eq("id", post_id).single();
  if (!post) return NextResponse.json({ error: "Inlägg saknas" }, { status: 404 });

  const fullCaption = `${post.caption}\n\n${post.hashtags || ""}`.trim();

  try {
    let result: { id: string };
    if (post.format === "carousel") {
      const urls: string[] = (post.slides || []).map((s: { image_url?: string }) => s.image_url).filter(Boolean);
      result = await publishCarousel(conn.ig_account_id!, conn.ig_access_token!, urls, fullCaption);
    } else if (post.format === "story") {
      result = await publishStory(conn.ig_account_id!, conn.ig_access_token!, post.image_url);
    } else {
      result = await publishSingle(conn.ig_account_id!, conn.ig_access_token!, post.image_url, fullCaption);
    }
    await sb.from("hm_social_posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", post_id);
    await logActivity(client_id, "ig_auto_published", `Auto-publicerat: ${post.format}`, undefined, { ig_media_id: result.id });
    return NextResponse.json({ ok: true, ig_media_id: result.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
