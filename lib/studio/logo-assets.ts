// §00 (världsklass): en logga ska alltid finnas i BÅDE ljus- och mörk-version, självhostad.
// Laddar ner käll-loggan, skapar en vit variant (sharp negate → funkar på mörk bakgrund),
// laddar upp båda till Supabase brand-assets och returnerar publika URL:er.
// Används av brand-agenten (förslag) så ingen klient hamnar med enbart namntext.

import sharp from "sharp";
import { supabaseService } from "@/lib/supabase-admin";

const BUCKET = "brand-assets";

export interface ProcessedLogo {
  primaryUrl: string; // original (för ljus bakgrund)
  onDarkUrl: string; // vit variant (för mörk bakgrund)
}

async function ensureBucket(sb: ReturnType<typeof supabaseService>) {
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
}

// Är loggan färgglad? Då får den ALDRIG inverteras (negate förstör en färg-emblem).
// Bara monokroma wordmarks (svart/vit på transparent) inverteras till en vit mörk-variant.
async function isColorful(input: Buffer): Promise<boolean> {
  try {
    const { data, info } = await sharp(input).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;
    let colorful = 0, opaque = 0;
    for (let i = 0; i < data.length; i += ch) {
      const a = ch === 4 ? data[i + 3] : 255;
      if (a < 40) continue;
      opaque++;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
      const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
      if (s > 0.3) colorful++;
    }
    // Tröskel 0.18 (uppmätt): monokroma wordmarks med små färg-accenter (HM Motor 0.13,
    // DT 0.08, Engens 0.0) → inverteras; äkta färg-emblem (Hay Days 0.23) → orört.
    return opaque > 0 && colorful / opaque > 0.18;
  } catch {
    return true; // osäker → behandla som färgglad (invertera inte)
  }
}

// Returnerar {primaryUrl, onDarkUrl}. Vid fel: {primaryUrl: sourceUrl} (aldrig krasch — förslag ändå).
export async function processLogo(clientId: string, sourceUrl: string): Promise<ProcessedLogo> {
  try {
    const res = await fetch(sourceUrl, { redirect: "follow" });
    if (!res.ok) return { primaryUrl: sourceUrl, onDarkUrl: sourceUrl };
    const input = Buffer.from(await res.arrayBuffer());

    // Normalisera till PNG (behåll transparens).
    const light = await sharp(input).png().toBuffer();
    // Mörk-variant ENDAST för monokroma loggor (negate förstör en färg-emblem).
    const colorful = await isColorful(input);
    const dark = colorful ? light : await sharp(input).negate({ alpha: false }).png().toBuffer();

    const sb = supabaseService();
    await ensureBucket(sb);
    const base = `${clientId}`;
    const upLight = await sb.storage.from(BUCKET).upload(`${base}/logo-light.png`, light, { contentType: "image/png", upsert: true });
    const upDark = await sb.storage.from(BUCKET).upload(`${base}/logo-dark.png`, dark, { contentType: "image/png", upsert: true });
    if (upLight.error || upDark.error) return { primaryUrl: sourceUrl, onDarkUrl: sourceUrl };

    // Färgglad logga → samma URL för mörk (ingen äkta mörk-variant finns).
    return {
      primaryUrl: sb.storage.from(BUCKET).getPublicUrl(`${base}/logo-light.png`).data.publicUrl,
      onDarkUrl: sb.storage.from(BUCKET).getPublicUrl(`${base}/logo-${colorful ? "light" : "dark"}.png`).data.publicUrl,
    };
  } catch {
    return { primaryUrl: sourceUrl, onDarkUrl: sourceUrl };
  }
}
