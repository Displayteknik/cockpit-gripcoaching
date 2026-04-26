import { NextRequest, NextResponse } from "next/server";
import { ensurePublicImageUrl } from "@/lib/images";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  source: string; // URL eller data:image/...;base64
  post_id?: string;
  slide_index?: number;
  attribution?: string;
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = (await req.json()) as Body;
  if (!body.source) return NextResponse.json({ error: "source krävs" }, { status: 400 });

  const result = await ensurePublicImageUrl(body.source);
  if (result.error || !result.url) return NextResponse.json({ error: result.error || "Upload misslyckades" }, { status: 500 });

  // Persist på post
  if (body.post_id) {
    const sb = supabaseServer();
    if (typeof body.slide_index === "number") {
      const { data: post } = await sb.from("hm_social_posts").select("slides").eq("id", body.post_id).eq("client_id", clientId).maybeSingle();
      if (post?.slides) {
        const slides = [...post.slides];
        slides[body.slide_index] = { ...slides[body.slide_index], image_url: result.url };
        await sb.from("hm_social_posts").update({ slides, updated_at: new Date().toISOString() }).eq("id", body.post_id).eq("client_id", clientId);
      }
    } else {
      await sb.from("hm_social_posts").update({ image_url: result.url, updated_at: new Date().toISOString() }).eq("id", body.post_id).eq("client_id", clientId);
    }
  }

  return NextResponse.json({ url: result.url, attribution: body.attribution });
}
