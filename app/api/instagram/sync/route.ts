import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { getIgConnection, getProfile, getRecentMedia, getMediaInsights } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 120;

// Synkar profil + media + insights från Instagram
export async function POST() {
  const clientId = await getActiveClientId();
  const conn = await getIgConnection(clientId);
  if (!conn) return NextResponse.json({ error: "Instagram inte anslutet" }, { status: 400 });

  const sb = supabaseServer();
  try {
    const profile = await getProfile(conn.ig_account_id!, conn.ig_access_token!);
    await sb.from("follower_snapshots").insert({
      client_id: clientId,
      platform: "instagram",
      followers: profile.followers_count,
      following: profile.follows_count,
      posts_count: profile.media_count,
    });

    const media = await getRecentMedia(conn.ig_account_id!, conn.ig_access_token!, 25);
    let insightsCount = 0;
    for (const m of media.data || []) {
      try {
        const ins = await getMediaInsights(m.id, conn.ig_access_token!, m.media_type);
        const metrics: Record<string, number> = {};
        for (const i of ins.data || []) metrics[i.name] = i.values?.[0]?.value || 0;
        await sb.from("post_metrics").upsert({
          client_id: clientId,
          ig_media_id: m.id,
          likes: m.like_count || metrics.likes || 0,
          comments: m.comments_count || metrics.comments || 0,
          saves: metrics.saved || 0,
          shares: metrics.shares || 0,
          reach: metrics.reach || 0,
          impressions: metrics.impressions || metrics.plays || 0,
          captured_at: new Date().toISOString(),
        }, { onConflict: "ig_media_id" });
        insightsCount++;
      } catch { /* enskild post-fel ska inte stoppa */ }
    }

    await logActivity(clientId, "ig_synced", `Instagram synkat: ${profile.followers_count} följare, ${insightsCount} inläggs-metrics`, "/dashboard/analytics");
    return NextResponse.json({ ok: true, profile, media_count: media.data?.length || 0, insights_count: insightsCount });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
