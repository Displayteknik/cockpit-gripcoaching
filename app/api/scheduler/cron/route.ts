import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { finalizePendingAudits } from "@/lib/deep-audit-finalize";
import { publishContent } from "@/lib/publish";
import { logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 300;

// Native schemaläggare (utan GHL). Vercel Cron kör detta ofta (se vercel.json). Hämtar köade
// studio_scheduled-jobb vars tid passerat och publicerar dem:
//   ig-graph     → publishContent (Instagram Graph, den FÄRDIG-renderade bilden i media_url)
//   cockpit-blog → flippar hm_blog.published = true
// FB/LI schemaläggs av GHL Social Planner (inte här). Idempotent via status-övergångar.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Finalisera klara djupgransknings-batchar (får aldrig fälla cronet).
  const auditsFinalized = await finalizePendingAudits().catch(() => 0);

  const sb = supabaseServer();
  const now = new Date().toISOString();
  const { data: due } = await sb
    .from("studio_scheduled")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (!due?.length) return NextResponse.json({ ok: true, processed: 0, auditsFinalized });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const job of due) {
    // Ta jobbet (queued → processing) atomiskt så två cron-körningar inte dubbelpublicerar.
    const { data: claimed } = await sb
      .from("studio_scheduled")
      .update({ status: "processing" })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // någon annan tog den

    try {
      if (job.channel === "cockpit-blog" && job.blog_id) {
        const { error } = await sb.from("hm_blog")
          .update({ published: true, published_at: new Date().toISOString() })
          .eq("id", job.blog_id).eq("client_id", job.client_id);
        if (error) throw new Error(error.message);
        await sb.from("studio_scheduled").update({ status: "published", published_at: new Date().toISOString(), result_id: String(job.blog_id) }).eq("id", job.id);
        await logActivity(job.client_id, "blog_auto_published", `Bloggartikel publicerad (schema): ${job.title || ""}`.trim(), "/dashboard/studio/blogg");
        results.push({ id: job.id, ok: true });
      } else {
        // Sociala kanaler — publicera den färdiga bilden/videon.
        const result = await publishContent({
          clientId: job.client_id,
          channel: job.channel === "ghl-social" ? "ghl-social" : "ig-graph",
          caption: job.caption || "",
          mediaUrl: job.media_url || undefined,
          videoUrl: job.video_url || undefined,
          postType: (job.post_type as "post" | "story" | "reel") || "post",
        });
        if (result.status === "failed" || !result.id) throw new Error(result.error || "Publicering misslyckades");
        await sb.from("studio_scheduled").update({ status: "published", published_at: new Date().toISOString(), result_id: result.id }).eq("id", job.id);
        if (job.studio_post_id) {
          await sb.from("studio_posts").update({ ghl_status: "published", ghl_post_id: result.id }).eq("id", job.studio_post_id).eq("client_id", job.client_id);
        }
        await logActivity(job.client_id, "ig_auto_published", `Inlägg auto-publicerat (schema): ${job.post_type || "post"}`, undefined, { media_id: result.id });
        results.push({ id: job.id, ok: true });
      }
    } catch (e) {
      await sb.from("studio_scheduled").update({ status: "failed", error: (e as Error).message.slice(0, 400) }).eq("id", job.id);
      results.push({ id: job.id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results, auditsFinalized });
}
