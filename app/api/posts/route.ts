import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// POST /api/posts — spara genererad variant från Skapa till hm_social_posts
// Body: { hook, body, cta, hashtags[], format, platform?, status?, scheduled_for?, image_url?, slides?[] }
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();

    const sb = supabaseService();
    const captionParts = [body.body];
    if (body.cta) captionParts.push("", body.cta);
    if (Array.isArray(body.hashtags) && body.hashtags.length) {
      captionParts.push(
        "",
        body.hashtags.map((h: string) => `#${String(h).replace(/^#/, "")}`).join(" ")
      );
    }

    const insert = {
      client_id: clientId,
      platform: body.platform || "instagram",
      format: body.format || "single",
      hook: body.hook || "",
      caption: captionParts.filter(Boolean).join("\n"),
      hashtags: Array.isArray(body.hashtags)
        ? body.hashtags.map((h: string) => `#${String(h).replace(/^#/, "")}`).join(" ")
        : "",
      cta: body.cta || "",
      image_url: body.image_url || null,
      slides: body.slides || null,
      status: body.scheduled_for ? "scheduled" : body.status || "draft",
      scheduled_for: body.scheduled_for || null,
    };

    const { data, error } = await sb.from("hm_social_posts").insert(insert).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity(clientId, "post_saved", `Sparade ${insert.format}: ${insert.hook.slice(0, 60)}`, "/dashboard/social", {
      platform: insert.platform,
      status: insert.status,
    });

    return NextResponse.json({ post: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// GET /api/posts — lista alla inlägg för aktiv klient
export async function GET(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") || 50);

    const sb = supabaseService();
    let q = sb
      .from("hm_social_posts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
