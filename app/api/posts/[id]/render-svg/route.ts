import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/posts/[id]/render-svg
// { style: 'bigtext' | 'quote' | 'stat', accent?: hex }
// Genererar en SVG → PNG-konvertering (server-side via base64 → uppladdas till storage)
// Returnerar { image_url }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const style = body.style || "bigtext";

    const sb = supabaseService();
    const { data: post } = await sb
      .from("hm_social_posts")
      .select("hook, caption, cta")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();
    if (!post) return NextResponse.json({ error: "Post hittades inte" }, { status: 404 });

    const { data: client } = await sb
      .from("clients")
      .select("name, primary_color")
      .eq("id", clientId)
      .single();

    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("location, founder_name, booking_url")
      .eq("client_id", clientId)
      .maybeSingle();

    const accent = body.accent || client?.primary_color || "#1A6B3C";
    const accent2 = lighten(accent, 0.15);
    const text = (post.hook || "").trim().slice(0, 200);
    const subtitle = profile?.founder_name
      ? `— ${profile.founder_name}${profile.location ? `, ${profile.location}` : ""}`
      : profile?.location
      ? profile.location
      : client?.name || "";

    const svg = renderSvg({ style, text, subtitle, cta: post.cta || "", accent, accent2 });

    // Konvertera SVG till PNG via en datauri eftersom storage tar PNG/JPG bättre
    // För nu: spara SVG direkt — Instagram tar inte SVG men det kan visas i UI
    const filename = `${clientId}/post-images/${id}-${Date.now()}.svg`;
    const upload = await sb.storage
      .from("client-assets")
      .upload(filename, Buffer.from(svg, "utf-8"), {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const { data: signed } = await sb.storage
      .from("client-assets")
      .createSignedUrl(filename, 60 * 60 * 24 * 365);

    const url = signed?.signedUrl;

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

function lighten(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const n = parseInt(c, 16);
  const r = Math.min(255, Math.round((n >> 16) + 255 * amount));
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) + 255 * amount));
  const b = Math.min(255, Math.round((n & 0xff) + 255 * amount));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

interface RenderArgs {
  style: string;
  text: string;
  subtitle: string;
  cta: string;
  accent: string;
  accent2: string;
}

function renderSvg(a: RenderArgs): string {
  const W = 1080;
  const H = 1080;
  // Wrap text — uppskattning: ~22 tecken per rad vid stor font
  const lines = wrapText(a.text, 22);
  const fontSize = lines.length <= 3 ? 88 : lines.length <= 5 ? 72 : 56;
  const lineHeight = fontSize * 1.15;
  const totalH = lines.length * lineHeight;
  const startY = H / 2 - totalH / 2 + fontSize / 2;

  const tspans = lines
    .map((line, i) => `<tspan x="${W / 2}" dy="${i === 0 ? 0 : lineHeight}">${escape(line)}</tspan>`)
    .join("");

  if (a.style === "quote") {
    // Stort citat på solid bakgrund
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a.accent}"/>
      <stop offset="100%" stop-color="${a.accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${W / 2}" y="180" font-family="Georgia, serif" font-size="200" fill="rgba(255,255,255,0.2)" text-anchor="middle">"</text>
  <text x="${W / 2}" y="${startY}" font-family="Georgia, serif" font-size="${fontSize}" fill="white" text-anchor="middle" font-style="italic">
    ${tspans}
  </text>
  <text x="${W / 2}" y="${H - 100}" font-family="system-ui, -apple-system" font-size="32" fill="rgba(255,255,255,0.85)" text-anchor="middle">${escape(a.subtitle)}</text>
</svg>`;
  }

  // Default: bigtext — gradient bakgrund + stor sans-serif text
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a.accent}"/>
      <stop offset="100%" stop-color="${a.accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" rx="20"/>
  <text x="${W / 2}" y="${startY}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="800" fill="white" text-anchor="middle">
    ${tspans}
  </text>
  ${a.cta ? `<text x="${W / 2}" y="${H - 160}" font-family="system-ui" font-size="34" font-weight="600" fill="rgba(255,255,255,0.95)" text-anchor="middle">${escape(a.cta.slice(0, 80))}</text>` : ""}
  <text x="${W / 2}" y="${H - 80}" font-family="system-ui" font-size="26" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escape(a.subtitle)}</text>
</svg>`;
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
  return lines.slice(0, 8);
}
