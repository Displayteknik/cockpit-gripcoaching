// B3 — Stavningssäker text i genererade bilder. Server-only.
//
// Bildmodeller felstavar svensk text ("Öppet i sommar" → "Öpet i sommar"). Slingan:
// 1. Generera med förstärkt exakt-text-instruktion (max 3 försök)
// 2. Verifiera varje försök med vision (läs av texten, normaliserad jämförelse)
// 3. Programmatisk fallback: generera bilden UTAN text + rendera texten ovanpå via
//    Next inbyggda ImageResponse (satori+resvg, inga nya beroenden) — stavningssäker
//    per konstruktion. Handskrift (Caveat, OFL) för lappar/skyltar, profilfont för overlays.
//
// Används av Bildhjälpen (suggest-image) och Reels Creator (reels/media). Spec:
// docs/studio/B-PAKET-SPEC.md.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateImagen } from "@/lib/images";
// BILD-8a: vision-avläsningarna och normaliseringen bor numera i lib/bildtext.ts —
// samma primitiver används av stavningsgrinden. En källa, inga dubbletter.
import { lasTextIBild, lasTeckenForTecken, normaliseraText, normaliseraTecken } from "@/lib/bildtext";

export { lasTextIBild, lasTeckenForTecken, normaliseraText, normaliseraTecken };

export type TextAspekt = "1:1" | "3:4" | "9:16";
export type TextStil = "lapp" | "overlay";

export interface ExaktTextResultat {
  image?: string; // data-URL (png/jpeg)
  metod: "ai" | "programmatisk";
  forsok: number; // antal AI-försök som gjordes
  verifierad: boolean; // true = texten i bilden stämmer (vision-verifierad eller programmatisk)
  avlastText: string; // vad vision faktiskt läste (vid avvikelse visas den för användaren)
  error?: string;
}

const DIMS: Record<TextAspekt, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "3:4": { w: 1080, h: 1440 },
  "9:16": { w: 1080, h: 1920 },
};

// Ladda self-hostad TTF (samma filer som Studio-editorn använder). process.cwd() =
// projektroten — officiellt Next-mönster, filerna spåras in i serverless-bundlen.
async function laddaFont(fil: string): Promise<Buffer | null> {
  try {
    return await readFile(join(process.cwd(), "public", "fonts", fil));
  } catch {
    return null;
  }
}

// ⚠ Den här kartan är det femte stället ett typsnitt måste stå på för att fungera fullt ut
// (de andra: studio-fonts.css, ALLOWED_FONTS, brand-kit-sidans FONTS, STUDIO_FONTS). Saknas
// namnet HÄR ritas text-i-bild med reservtypsnittet — tyst, och bara i just det flödet.
// `tests/font3-typsnitt.test.ts` låser att listorna hålls ihop.
const PROFILFONT_FIL: Record<string, string> = {
  Inter: "inter-800.ttf",
  "Playfair Display": "playfair-900.ttf",
  Archivo: "archivo-800.ttf",
  Poppins: "poppins-700.ttf",
  Anton: "anton.ttf",
  Kalnia: "kalnia.ttf",
  Caveat: "caveat-700.ttf",
};

// Rendera text ovanpå en färdig bild — programmatiskt = alltid rättstavat.
// stil "lapp" = handskrift (Caveat) i mörkt bläck, lätt lutning — matchar lappar/skyltar.
// stil "overlay" = profiltypsnitt på diskret platta — matchar grafiska overlays.
// posY = textblockets mittpunkt i % av höjden (B2:s positionslogik), klampas ur nedre 20 %.
export async function komponeraTextPaBild(opts: {
  basBild: string; // data-URL eller http-URL
  text: string;
  aspekt: TextAspekt;
  stil?: TextStil;
  profilFont?: string; // t.ex. "Anton" — används vid stil "overlay"
  posY?: number; // 0–100, default 46
}): Promise<{ image?: string; error?: string }> {
  const { w, h } = DIMS[opts.aspekt];
  const stil: TextStil = opts.stil || "lapp";
  // IG:s gränssnitt täcker nedre 20 % — håll textcentrum ovanför (med marginal för blockhöjd).
  const posY = Math.max(10, Math.min(72, opts.posY ?? 46));

  // Basbild → data-URL (satori hämtar inte alltid externa URL:er pålitligt).
  let bas = opts.basBild;
  if (!bas.startsWith("data:")) {
    try {
      const r = await fetch(bas);
      if (!r.ok) return { error: "Kunde inte hämta basbilden" };
      const buf = Buffer.from(await r.arrayBuffer());
      bas = `data:${r.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}`;
    } catch (e) {
      return { error: "Nätverksfel vid basbild: " + (e as Error).message };
    }
  }

  const fontFil = stil === "lapp" ? "caveat-700.ttf" : (PROFILFONT_FIL[opts.profilFont || ""] || "anton.ttf");
  const fontNamn = stil === "lapp" ? "Caveat" : (opts.profilFont && PROFILFONT_FIL[opts.profilFont] ? opts.profilFont : "Anton");
  const fontData = await laddaFont(fontFil);
  if (!fontData) return { error: `Typsnittet ${fontFil} saknas` };

  const rader = opts.text.split(/\n/).map((r) => r.trim()).filter(Boolean);
  const langsta = Math.max(...rader.map((r) => r.length), 1);
  // Grovt men robust: skala ned långa texter så de ryms på bredden.
  const fontSize = stil === "lapp"
    ? Math.min(120, Math.max(54, Math.round((w * 1.35) / langsta)))
    : Math.min(96, Math.max(44, Math.round((w * 1.15) / langsta)));

  try {
    const res = new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bas} width={w} height={h} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          <div
            style={{
              position: "absolute",
              left: "6%",
              width: "88%",
              top: `${posY}%`,
              transform: stil === "lapp" ? "translateY(-50%) rotate(-2deg)" : "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              ...(stil === "overlay" ? { background: "rgba(10,14,20,0.45)", borderRadius: 18, padding: "28px 36px" } : {}),
            }}
          >
            {rader.map((rad, i) => (
              <div
                key={i}
                style={{
                  fontFamily: fontNamn,
                  fontSize,
                  lineHeight: 1.15,
                  color: stil === "lapp" ? "#1f2733" : "#ffffff",
                  fontWeight: stil === "lapp" ? 700 : 800,
                  ...(stil === "overlay" ? { textTransform: "uppercase" as const, letterSpacing: 1 } : {}),
                }}
              >
                {rad}
              </div>
            ))}
          </div>
        </div>
      ),
      { width: w, height: h, fonts: [{ name: fontNamn, data: fontData, weight: stil === "lapp" ? 700 : 800, style: "normal" }] },
    );
    const buf = Buffer.from(await res.arrayBuffer());
    return { image: `data:image/png;base64,${buf.toString("base64")}` };
  } catch (e) {
    return { error: "Kompositering misslyckades: " + (e as Error).message };
  }
}

/**
 * Hela slingan: AI-generering med exakt text → vision-verifiering (max 3 försök) →
 * programmatisk fallback. Returnerar ALLTID metod + försöksantal + vad som lästes av,
 * så UI:t kan visa godkänt resultat eller varna "Texten i bilden avviker: [avläst]".
 */
export async function genereraMedExaktText(opts: {
  scen: string; // motivbeskrivning (utan textinstruktion)
  text: string; // exakt text som ska synas
  aspekt: TextAspekt;
  stil?: TextStil;
  profilFont?: string;
  posY?: number;
  stilSuffix?: string; // t.ex. signaturstilens direktiv — läggs sist i prompten
  maxForsok?: number; // 0 = hoppa över AI-försöken, gå direkt på programmatisk väg (alltid rättstavat)
}): Promise<ExaktTextResultat> {
  const text = opts.text.trim();
  const mal = normaliseraText(text);
  const maxForsok = Math.max(0, Math.min(3, opts.maxForsok ?? 3));
  let basta: { image: string; avlast: string } | null = null;
  let forsok = 0;

  const textPrompt =
    `${opts.scen} The visible text on the sign/paper reads EXACTLY "${text}" — this is Swedish, ` +
    `spelled exactly as written, letter by letter, preserving å, ä and ö. ` +
    `Double letters must stay double. No other text, letters or words anywhere in the image.${opts.stilSuffix || ""}`;

  const malTecken = normaliseraTecken(text);
  for (let i = 0; i < maxForsok; i++) {
    forsok = i + 1;
    const gen = await generateImagen(textPrompt, opts.aspekt);
    if (gen.error || !gen.image) break; // generering nere → direkt till fallback
    // DUBBEL grind: holistisk läsning autokorrigerar felstavningar — teckenvis läsning
    // fångar dem. Båda måste stämma för godkänt.
    const [avlast, tecken] = await Promise.all([lasTextIBild(gen.image), lasTeckenForTecken(gen.image)]);
    const holistiskOk = normaliseraText(avlast) === mal;
    const teckenOk = normaliseraTecken(tecken) === malTecken;
    if (holistiskOk && teckenOk) {
      return { image: gen.image, metod: "ai", forsok, verifierad: true, avlastText: avlast };
    }
    // Visa det MEST avslöjande vid avvikelse: teckenvis läsning ("Öipet...") om det var den som fällde.
    basta = { image: gen.image, avlast: holistiskOk ? tecken.replace(/ /g, "").replace(/\//g, " ") : avlast };
  }

  // Programmatisk fallback: samma motiv, blank yta — texten renderas ovanpå (stavningssäker).
  const basPrompt = `${opts.scen} The sign/paper/surface is completely BLANK and empty — absolutely no text, no letters, no writing anywhere in the image.${opts.stilSuffix || ""}`;
  for (let i = 0; i < 2; i++) {
    const bas = await generateImagen(basPrompt, opts.aspekt);
    if (bas.error || !bas.image) break;
    // Om modellen ändå smugit in text på ytan kolliderar overlayn — kontrollera, ett omtag.
    const basText = await lasTextIBild(bas.image);
    if (basText && i === 0) continue;
    const komp = await komponeraTextPaBild({ basBild: bas.image, text, aspekt: opts.aspekt, stil: opts.stil, profilFont: opts.profilFont, posY: opts.posY });
    if (komp.image) {
      return { image: komp.image, metod: "programmatisk", forsok, verifierad: true, avlastText: text };
    }
    console.error("[text-i-bild] programmatisk fallback misslyckades:", komp.error);
  }

  // Sista utväg: bästa AI-försöket med tydlig varning.
  if (basta) {
    return { image: basta.image, metod: "ai", forsok, verifierad: false, avlastText: basta.avlast };
  }
  return { metod: "ai", forsok, verifierad: false, avlastText: "", error: "Kunde inte skapa bilden — försök igen eller prova utan text i bilden." };
}
