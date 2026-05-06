import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SlideContent {
  number: number;
  headline: string;
  body: string;
  cta?: boolean;
}

// POST /api/posts/[id]/render-carousel
// Genererar 5–8 slides och renderar dem som SVG i samma visuella språk.
// Sparas som post.slides (jsonb) och första bilden blir post.image_url.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const desiredCount = Math.min(Math.max(Number(body.count) || 6, 4), 8);

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

    const accent = client?.primary_color || "#1A6B3C";

    // Hämta voice för slide-skrivning
    const fp = await getVoiceFingerprint(clientId).catch(() => null);
    const voiceBlock = fp ? fingerprintToPromptBlock(fp) : "";

    // Generera slide-innehåll via Gemini
    const slidesPrompt = `Du delar upp ett socialt-medie-inlägg i ${desiredCount} slides för en Instagram-carousel.

ORIGINAL-INLÄGG:
Hook: ${post.hook}
Caption: ${post.caption}
CTA: ${post.cta || ""}

${voiceBlock}

REGLER:
- Slide 1 = HOOK + "swipe →"-anvisning
- Slide 2-${desiredCount - 1} = en konkret poäng/insikt per slide
- Sista slide = CTA med tydlig nästa-handling
- Varje headline max 8 ord
- Varje body max 25 ord
- Behåll kundens röst (svenska, talspråkligt om så är hennes stil)
- ALDRIG AI-språk

Returnera JSON:
{
  "slides": [
    { "number": 1, "headline": "...", "body": "..." },
    ...
    { "number": ${desiredCount}, "headline": "...", "body": "...", "cta": true }
  ]
}`;

    const slideData = await generateJSON<{ slides: SlideContent[] }>({
      model: "gemini-2.5-pro",
      prompt: slidesPrompt,
      temperature: 0.7,
      maxOutputTokens: 3000,
    });

    if (!slideData?.slides?.length) {
      return NextResponse.json({ error: "Kunde inte generera slides" }, { status: 500 });
    }

    // Rendera SVG per slide
    const slideUrls: string[] = [];
    const W = 1080;
    const H = 1080;

    for (let i = 0; i < slideData.slides.length; i++) {
      const s = slideData.slides[i];
      const isFirst = i === 0;
      const isLast = i === slideData.slides.length - 1;
      const isCta = s.cta || isLast;

      const headlineLines = wrapText(s.headline || "", 22);
      const bodyLines = wrapText(s.body || "", 32);

      const headlineSize = headlineLines.length <= 2 ? 84 : 64;
      const bodySize = 36;
      const headlineLineHeight = headlineSize * 1.15;
      const bodyLineHeight = bodySize * 1.4;

      const totalHeadlineH = headlineLines.length * headlineLineHeight;
      const totalBodyH = bodyLines.length * bodyLineHeight;
      const startY = (H - totalHeadlineH - totalBodyH - 60) / 2 + headlineSize / 2;

      const headlineSpans = headlineLines
        .map((ln, j) => `<tspan x="${W / 2}" dy="${j === 0 ? 0 : headlineLineHeight}">${escape(ln)}</tspan>`)
        .join("");
      const bodySpans = bodyLines
        .map((ln, j) => `<tspan x="${W / 2}" dy="${j === 0 ? 0 : bodyLineHeight}">${escape(ln)}</tspan>`)
        .join("");

      const bg = isCta
        ? `<rect width="${W}" height="${H}" fill="${accent}"/>`
        : `<rect width="${W}" height="${H}" fill="white"/>
           <rect x="0" y="0" width="${W}" height="12" fill="${accent}"/>`;

      const textColor = isCta ? "white" : "#111";
      const subColor = isCta ? "rgba(255,255,255,0.85)" : "#666";

      const slideNumberLabel = `${s.number || i + 1} / ${slideData.slides.length}`;
      const cornerLabel = isFirst
        ? "← swipe →"
        : isCta
        ? profile?.booking_url || profile?.founder_name || client?.name || ""
        : slideNumberLabel;

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${bg}
  <text x="${W / 2}" y="${startY}" font-family="system-ui, -apple-system, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${textColor}" text-anchor="middle">
    ${headlineSpans}
  </text>
  <text x="${W / 2}" y="${startY + totalHeadlineH + 60}" font-family="system-ui, sans-serif" font-size="${bodySize}" fill="${textColor}" text-anchor="middle" opacity="0.9">
    ${bodySpans}
  </text>
  <text x="60" y="${H - 60}" font-family="system-ui" font-size="22" fill="${subColor}">${escape(client?.name || "")}</text>
  <text x="${W - 60}" y="${H - 60}" font-family="system-ui" font-size="22" fill="${subColor}" text-anchor="end">${escape(cornerLabel)}</text>
</svg>`;

      const filename = `${clientId}/post-images/${id}-slide-${i + 1}-${Date.now()}.svg`;
      const upload = await sb.storage
        .from("client-assets")
        .upload(filename, Buffer.from(svg, "utf-8"), { contentType: "image/svg+xml", upsert: true });
      if (upload.error) continue;

      const { data: signed } = await sb.storage
        .from("client-assets")
        .createSignedUrl(filename, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) slideUrls.push(signed.signedUrl);
    }

    if (slideUrls.length === 0) {
      return NextResponse.json({ error: "Ingen slide kunde renderas" }, { status: 500 });
    }

    const slidesJson = slideData.slides.map((s, i) => ({
      number: s.number || i + 1,
      headline: s.headline,
      body: s.body,
      image_hint: "",
      image_url: slideUrls[i] || null,
    }));

    await sb
      .from("hm_social_posts")
      .update({
        slides: slidesJson,
        image_url: slideUrls[0],
        image_engine: "carousel-svg",
      })
      .eq("id", id)
      .eq("client_id", clientId);

    return NextResponse.json({ slides: slidesJson, count: slideUrls.length });
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
