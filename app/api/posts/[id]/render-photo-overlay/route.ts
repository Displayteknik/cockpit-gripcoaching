import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/posts/[id]/render-photo-overlay
// { asset_id, accent? } — använder ett foto från client_assets, lägger text-overlay
// Returnerar { image_url } — SVG som referenserar fotots signed URL via foreignObject
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "asset_id krävs" }, { status: 400 });

    const sb = supabaseService();
    const { data: post } = await sb
      .from("hm_social_posts")
      .select("hook, cta")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();
    if (!post) return NextResponse.json({ error: "Post hittades inte" }, { status: 404 });

    const { data: asset } = await sb
      .from("client_assets")
      .select("storage_path, asset_type")
      .eq("id", assetId)
      .eq("client_id", clientId)
      .single();
    if (!asset || asset.asset_type !== "photo" || !asset.storage_path) {
      return NextResponse.json({ error: "Ogiltig foto-asset" }, { status: 400 });
    }

    const { data: signed } = await sb.storage
      .from("client-assets")
      .createSignedUrl(asset.storage_path, 60 * 60 * 24 * 365);
    if (!signed?.signedUrl) {
      return NextResponse.json({ error: "Kunde inte skapa signed URL för foto" }, { status: 500 });
    }

    const { data: client } = await sb
      .from("clients")
      .select("primary_color")
      .eq("id", clientId)
      .single();
    const accent = body.accent || client?.primary_color || "#1A6B3C";

    const text = (post.hook || "").trim().slice(0, 180);
    const lines = wrapText(text, 24);
    const fontSize = lines.length <= 3 ? 64 : 52;
    const lineHeight = fontSize * 1.15;
    const totalH = lines.length * lineHeight;

    const W = 1080;
    const H = 1080;
    const blockY = H - totalH - 200;

    const tspans = lines
      .map((line, i) => `<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${escape(line)}</tspan>`)
      .join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="darkfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="40%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>
    </linearGradient>
  </defs>
  <image href="${escape(signed.signedUrl)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${W}" height="${H}" fill="url(#darkfade)"/>
  <rect x="60" y="${blockY - 40}" width="8" height="${totalH + 80}" fill="${accent}" rx="4"/>
  <text x="80" y="${blockY + fontSize}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="800" fill="white">
    ${tspans}
  </text>
  ${post.cta ? `<text x="80" y="${H - 60}" font-family="system-ui" font-size="28" fill="rgba(255,255,255,0.85)">${escape(String(post.cta).slice(0, 80))}</text>` : ""}
</svg>`;

    const filename = `${clientId}/post-images/${id}-overlay-${Date.now()}.svg`;
    const upload = await sb.storage
      .from("client-assets")
      .upload(filename, Buffer.from(svg, "utf-8"), {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });

    const { data: signedOut } = await sb.storage
      .from("client-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 365);

    const url = signedOut?.signedUrl;
    await sb.from("hm_social_posts").update({ image_url: url }).eq("id", id).eq("client_id", clientId);

    return NextResponse.json({ image_url: url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}
