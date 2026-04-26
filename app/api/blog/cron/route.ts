import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300;

// Körs av Vercel Cron (se vercel.json). Tar nästa köade idé och genererar en artikel.
export async function GET(req: NextRequest) {
  // Vercel Cron skickar authorization header med CRON_SECRET
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseServer();
  const { data: next } = await sb
    .from("hm_blog_queue")
    .select("*")
    .eq("status", "queued")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!next) {
    return NextResponse.json({ ok: true, message: "Kön är tom" });
  }

  const origin = req.nextUrl.origin;
  const r = await fetch(`${origin}/api/blog/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `active_client_id=${next.client_id}` },
    body: JSON.stringify({
      topic: next.topic,
      angle: next.angle,
      keyword: next.keyword,
      queue_id: next.id,
    }),
  });
  const result = await r.json();
  return NextResponse.json({ ok: r.ok, queue_id: next.id, topic: next.topic, result });
}
