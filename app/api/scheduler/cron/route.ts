import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// Vercel Cron körs var 5:e minut. Hämtar alla schemalagda som ska publiceras nu.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = supabaseServer();
  const now = new Date().toISOString();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .limit(20);

  if (!due?.length) return NextResponse.json({ ok: true, processed: 0 });

  const results: { id: string; ok: boolean; error?: string; ig_media_id?: string }[] = [];
  for (const job of due) {
    try {
      // Markera som "processing" först
      await sb.from("scheduled_posts").update({ status: "processing" }).eq("id", job.id);

      const origin = req.nextUrl.origin;
      const r = await fetch(`${origin}/api/instagram/publish-internal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET || "" },
        body: JSON.stringify({ post_id: job.social_post_id, client_id: job.client_id }),
      });
      const data = await r.json();
      if (r.ok) {
        await sb.from("scheduled_posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          ig_media_id: data.ig_media_id,
        }).eq("id", job.id);
        results.push({ id: job.id, ok: true, ig_media_id: data.ig_media_id });
      } else {
        await sb.from("scheduled_posts").update({ status: "failed", error: data.error }).eq("id", job.id);
        results.push({ id: job.id, ok: false, error: data.error });
      }
    } catch (e) {
      await sb.from("scheduled_posts").update({ status: "failed", error: (e as Error).message }).eq("id", job.id);
      results.push({ id: job.id, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
