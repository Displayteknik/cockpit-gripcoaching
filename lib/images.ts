// Bildgenerering — Imagen 4.0 Fast (Google) primärt, FLUX (fal.ai) om FAL_KEY finns,
// Pexels för stockfoton. Portad och anpassad från instagram-pro.

import { supabaseServer } from "./supabase-admin";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const FAL_KEY = process.env.FAL_KEY || "";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

export const IMAGE_STYLES = [
  { id: "cinematic", label: "Cinematic mörk", desc: "Filmisk, dramatisk belysning", prompt: "Cinematic commercial photography. Dramatic directional lighting with deep shadows. Film-grade color grading. Dark navy and warm accent tones. Shot on full-frame camera with 35mm lens." },
  { id: "editorial", label: "Editorial reportage", desc: "Tidskriftskänsla, autentiskt", prompt: "High-end editorial photography. Real environments, authentic moments. Magazine-quality composition. Natural but refined lighting. Storytelling through visual detail." },
  { id: "product", label: "Produkt / showroom", desc: "Premium produktfoto", prompt: "Premium product photography in professional environment. Three-point lighting setup. Reflective dark surface. Hero shot composition emphasizing form and quality." },
  { id: "nordic", label: "Nordiskt natur", desc: "Skog, snö, jämtlandskt", prompt: "Authentic Nordic wilderness photography. Pine forests, mountain backdrops, soft overcast light. Earthy palette. Documentary feel, no posed people." },
  { id: "urban", label: "Urban / gata", desc: "Stadsmiljö, neon", prompt: "Urban street photography. Neon reflections on wet surfaces. Moody city atmosphere. Shallow depth of field, 85mm lens feel." },
  { id: "minimal", label: "Minimalistisk", desc: "Ren, mycket luft", prompt: "Ultra minimal photography. Single subject on clean dark surface. Generous negative space. Soft directional light. Elegant simplicity." },
  { id: "tech", label: "Tech / digital", desc: "Futuristisk innovation", prompt: "Technology and innovation photography. Real devices, screens. Cyan and purple accent lighting. Futuristic but grounded — not abstract CGI." },
  { id: "lifestyle", label: "Livsstil", desc: "Vardag, autentiskt", prompt: "Lifestyle photography. Real moments, natural light. Warm tones. Genuine emotion. Documentary-style composition." },
] as const;

export type ImageStyleId = typeof IMAGE_STYLES[number]["id"];

async function craftImagePromptWithAI(contentText: string, niche: string, stylePrompt: string, mode: "overlay" | "standalone"): Promise<string> {
  if (!GEMINI_KEY) return contentText;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an elite visual content strategist. Write ONE image generation prompt (in English) for this post.

POST CONTENT: "${contentText}"
BRAND/INDUSTRY: ${niche || "business"}
VISUAL STYLE: ${stylePrompt}
IMAGE MODE: ${mode === "standalone" ? "Hero image — must be visually striking and self-explanatory" : "Background for text overlay — needs dark/muted areas for white text"}

THE #1 RULE: Show the ACTUAL SUBJECT the post talks about. ONE clear hero subject, close/medium shot, dramatic angle.

BANNED: Wide crowd shots, generic businessman portraits, abstract imagery, anonymous people, empty environments.

For "${niche || "business"}" — think about objects/setups/environments unique to this industry.

${mode === "overlay" ? "COLORS: Dark moody palette, large dark areas for white text overlay." : "COLORS: Rich vivid commercial photography quality."}
NO text, words, letters, numbers in image.

Write ONLY the prompt, 2-3 sentences, hyper-specific.` }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.6, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await r.json();
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (txt && txt.length > 20) return txt;
  } catch (e) {
    console.error("[images] craft prompt failed:", e);
  }
  return `Professional commercial photograph of ${niche || "a business setup"} related to: ${contentText.slice(0, 100)}. ${stylePrompt}. Photorealistic, high detail, no text in image.`;
}

export async function generateImagen(prompt: string, aspectRatio: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" = "1:1"): Promise<{ success?: boolean; image?: string; error?: string }> {
  if (!GEMINI_KEY) return { error: "GEMINI_API_KEY saknas" };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio } }),
    });
    const data = await r.json();
    if (data.error) return { error: data.error.message || "Bildgenerering misslyckades" };
    if (data.predictions?.[0]?.bytesBase64Encoded) {
      return { success: true, image: `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` };
    }
    return { error: "Ingen bild genererades" };
  } catch (e) {
    return { error: "Nätverksfel: " + (e as Error).message };
  }
}

export async function generateFlux(prompt: string, aspect: "square" | "portrait" | "landscape" = "square"): Promise<{ success?: boolean; image?: string; error?: string }> {
  if (!FAL_KEY) return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  try {
    const size = aspect === "square" ? "square" : aspect === "portrait" ? "portrait_16_9" : "landscape_16_9";
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: size, num_images: 1 }),
    });
    const data = await r.json();
    if (data.images?.[0]?.url) return { success: true, image: data.images[0].url };
    return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  } catch {
    return generateImagen(prompt, aspect === "square" ? "1:1" : aspect === "portrait" ? "9:16" : "16:9");
  }
}

export async function generateImageForPost(opts: {
  contentText: string;
  niche?: string;
  styleId?: ImageStyleId;
  mode?: "overlay" | "standalone";
  aspect?: "square" | "portrait" | "landscape";
}): Promise<{ success?: boolean; image?: string; error?: string; engine?: string; prompt?: string }> {
  const styleObj = IMAGE_STYLES.find((s) => s.id === opts.styleId) || IMAGE_STYLES[0];
  const mode = opts.mode || "standalone";
  const niche = opts.niche || "business";

  const aiScene = await craftImagePromptWithAI(opts.contentText, niche, styleObj.prompt, mode);
  const fullPrompt = `${aiScene}
Style: ${styleObj.prompt}
CRITICAL: Absolutely NO text, NO words, NO letters, NO numbers in the image.
Photorealistic. Cinematic lighting. 4K resolution feel.
${mode === "overlay" ? "Dark tones suitable for white text overlay." : "Beautiful composition, sharp focus."}`;

  const result = FAL_KEY ? await generateFlux(fullPrompt, opts.aspect || "square") : await generateImagen(fullPrompt, opts.aspect === "portrait" ? "9:16" : opts.aspect === "landscape" ? "16:9" : "1:1");
  return { ...result, engine: FAL_KEY ? "FLUX" : "Imagen", prompt: fullPrompt };
}

export async function ensurePublicImageUrl(imageData: string): Promise<{ url?: string; error?: string }> {
  if (!imageData) return { error: "Ingen bild" };
  if (imageData.includes("supabase.co/storage/")) return { url: imageData };
  const sb = supabaseServer();

  if (imageData.startsWith("http://") || imageData.startsWith("https://")) {
    try {
      const response = await fetch(imageData);
      if (!response.ok) return { error: "Kunde inte ladda ner bild" };
      const ct = response.headers.get("content-type") || "image/png";
      const ext = ct.includes("jpeg") ? "jpg" : ct.includes("webp") ? "webp" : "png";
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("images").upload(fileName, buffer, { contentType: ct, upsert: false });
      if (error) return { error: error.message };
      const { data } = sb.storage.from("images").getPublicUrl(fileName);
      return { url: data.publicUrl };
    } catch (e) {
      return { error: "Nätverksfel: " + (e as Error).message };
    }
  }

  if (imageData.startsWith("data:image/")) {
    try {
      const m = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) return { error: "Ogiltigt bildformat" };
      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const buffer = Buffer.from(m[2], "base64");
      const fileName = `social/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from("images").upload(fileName, buffer, { contentType: `image/${ext}`, upsert: false });
      if (error) {
        if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
          return { error: 'Supabase Storage bucket "images" saknas. Skapa den i Supabase Dashboard → Storage.' };
        }
        return { error: error.message };
      }
      const { data } = sb.storage.from("images").getPublicUrl(fileName);
      return { url: data.publicUrl };
    } catch (e) {
      return { error: "Fel vid bilduppladdning: " + (e as Error).message };
    }
  }
  return { error: "Okänt bildformat" };
}

// Pexels stock photos
export interface StockPhoto { id: number; url: string; src: string; srcMedium: string; photographer: string; alt: string }

export async function searchStockPhotos(topic: string, niche?: string, count = 12): Promise<{ photos: StockPhoto[]; query: string; error?: string }> {
  if (!PEXELS_KEY) return { photos: [], query: "", error: "PEXELS_API_KEY saknas" };

  let q = topic;
  if (GEMINI_KEY) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate ONE short English search query (2-4 words) for finding visual stock photos on Pexels.\n\nTopic: "${topic}"\n${niche ? `Niche: ${niche}` : ""}\n\nReply with ONLY the query.` }] }],
          generationConfig: { maxOutputTokens: 50, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      if (r.ok) {
        const data = await r.json();
        const out = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (out && out.length > 0 && out.length < 60) q = out;
      }
    } catch (e) { console.error("[images] pexels query craft:", e); }
  }

  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${count}&orientation=square`, { headers: { Authorization: PEXELS_KEY } });
    if (!r.ok) return { photos: [], query: q, error: `Pexels-fel: ${r.status}` };
    const data = await r.json();
    const photos: StockPhoto[] = (data.photos || []).map((p: { id: number; url: string; src: { large2x?: string; large?: string; original?: string; medium?: string }; photographer: string; alt: string }) => ({
      id: p.id,
      url: p.url,
      src: p.src.large2x || p.src.large || p.src.original || "",
      srcMedium: p.src.medium || p.src.large || "",
      photographer: p.photographer || "Okänd",
      alt: p.alt || q,
    }));
    return { photos, query: q };
  } catch (e) {
    return { photos: [], query: q, error: "Pexels-nätverksfel: " + (e as Error).message };
  }
}
