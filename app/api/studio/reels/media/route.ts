import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { generateFlux, searchStockPhotos } from "@/lib/images";
import { genereraMedExaktText } from "@/lib/studio/text-in-image";
import { getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";
import { adoptReelMedia, listReelMedia } from "@/lib/studio/reel-media";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

async function grind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

// GET — klientens reels-material (studio_media). Faller tillbaka på den råa
// bucket-listningen så att bilder som skapades före R2 fortfarande går att välja.
export async function GET() {
  const denied = await grind();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const rows = await listReelMedia(clientId);
    if (rows.length > 0) return NextResponse.json({ items: rows });

    const sb = supabaseService();
    const { data } = await sb.storage
      .from("studio-images")
      .list(clientId, { limit: 60, sortBy: { column: "created_at", order: "desc" } });
    const items = (data || [])
      .filter((o) => o.id && /\.(png|jpe?g|webp)$/i.test(o.name))
      .map((o) => ({
        id: "",
        url: sb.storage.from("studio-images").getPublicUrl(`${clientId}/${o.name}`).data.publicUrl,
        source: "uploaded" as const,
        source_detail: "Äldre bild ur Mina bilder",
        width: null,
        height: null,
        created_at: o.created_at || null,
      }));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — hämta kandidater ELLER anta en vald bild som scenmaterial.
//   { action: "ai",    prompt }            → genererar, beskär, sparar. Klar att använda.
//   { action: "stock", prompt }            → Pexels-kandidater i STÅENDE format. Ej sparade än.
//   { action: "adopt", url, source, detail } → normaliserar till 1080x1920 och sparar.
export async function POST(req: NextRequest) {
  const denied = await grind();
  if (denied) return denied;

  let body: { action?: string; prompt?: string; url?: string; source?: string; detail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  try {
    const clientId = await getActiveClientId();
    const client = await getActiveClient();
    const niche = client?.industry || "";
    const prompt = String(body.prompt || "").slice(0, 400);

    if (body.action === "stock") {
      if (!prompt) return NextResponse.json({ error: "Ingen bildbeskrivning" }, { status: 400 });
      // portrait: utan den här parametern hittade sökningen bara kvadratiska foton.
      const res = await searchStockPhotos(prompt, niche, 9, "portrait");
      if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });
      return NextResponse.json({
        candidates: res.photos.map((p) => ({ url: p.src, thumb: p.srcMedium, credit: p.photographer })),
        query: res.query,
      });
    }

    if (body.action === "ai") {
      if (!prompt) return NextResponse.json({ error: "Ingen bildbeskrivning" }, { status: 400 });
      const directives = await getKitDirectives(clientId);

      // B3: scenen ska innehålla exakt text i själva bilden → samma verifieringsslinga
      // som Bildhjälpen (vision-koll, max 3 försök, programmatisk fallback). Ordinarie
      // vägen förbjuder läsbar text — den regeln gäller inte här.
      const exactText = String((body as { exactText?: string }).exactText || "").slice(0, 120).trim();
      if (exactText) {
        const res = await genereraMedExaktText({
          scen: `${prompt} Vertical 9:16 composition. Photographic and real.`,
          text: exactText,
          aspekt: "9:16",
          stil: "lapp",
          stilSuffix: imageDirectiveSuffix(directives),
        });
        if (res.error || !res.image) {
          return NextResponse.json({ error: res.error || "Kunde inte skapa scenbilden med texten." }, { status: 500 });
        }
        const stored = await adoptReelMedia({
          clientId,
          dataUrl: res.image.startsWith("data:") ? res.image : undefined,
          url: res.image.startsWith("data:") ? undefined : res.image,
          source: "ai",
          sourceDetail: `${prompt} [text: ${exactText}]`,
          kravKvalitet: true,
        });
        return NextResponse.json({
          media: stored,
          textInfo: { metod: res.metod, forsok: res.forsok, verifierad: res.verifierad, avlastText: res.avlastText },
        });
      }
      // INGEN visualScene här. Den översätter PROSA till ett motiv och behövs i
      // Bildhjälpen, där indata är en bildtext. Reels-manuset levererar redan en färdig
      // engelsk motivbeskrivning, och att köra den genom översättningen en gång till
      // skriver om den och driver iväg motivet: "uninviting retail storefront during a
      // grey daytime" blev en mörk bakgårdsdörr. Använd beskrivningen som den är.
      const scene = prompt;
      // FLUX först: den tar image_size och ger ett FAKTISKT stående original.
      // generateImagen skickar bara formatet i prompttexten och svarade 1024x1024 i test,
      // vilket betyder att nära halva motivet beskärs bort i sidled. generateFlux faller
      // själv tillbaka på generateImagen om FAL_KEY saknas eller anropet fallerar.
      // Motivet FÖRST, stilen sist. "natural light" stod tidigare här och krockade rakt
      // av med signaturens ljusinstruktion: två motstridiga ljuskrav i samma prompt.
      // Ljussättningen ägs numera enbart av signaturen, motivet enbart av scenen.
      // Bildmodeller hittar på läsbar text på skyltar och affischer även när prompten
      // säger no text. Förbudet upprepas därför i Avoid-form, som väger tyngre.
      const gen = await generateFlux(
        `${scene} Vertical 9:16 composition, calm space in the middle for text. Photographic and real.${imageDirectiveSuffix(directives)} Avoid: readable words, lettering on signs or posters, watermarks, logos.`,
        "portrait",
      );
      if (gen.error || !gen.image) {
        return NextResponse.json(
          { error: "Kunde inte skapa en bild för den här scenen. Prova Sök foto, eller skriv om bildbeskrivningen." },
          { status: 500 },
        );
      }
      // FLUX svarar med en http-URL, Gemini med en data-URL. adoptReelMedia tar båda.
      const arDataUrl = gen.image.startsWith("data:");
      try {
        const stored = await adoptReelMedia({
          clientId,
          dataUrl: arDataUrl ? gen.image : undefined,
          url: arDataUrl ? undefined : gen.image,
          source: "ai",
          sourceDetail: prompt,
          kravKvalitet: true,
        });
        return NextResponse.json({ media: stored });
      } catch (genFel) {
        // Modellen kan svara med en nästan helt svart bild utan att signalera fel.
        // Hellre ett riktigt foto än en svart scen: fall tillbaka på fotosök.
        const st = await searchStockPhotos(prompt, niche, 1, "portrait");
        if (!st.photos?.length) {
          return NextResponse.json({ error: (genFel as Error).message }, { status: 500 });
        }
        const stored = await adoptReelMedia({
          clientId,
          url: st.photos[0].src,
          source: "stock",
          sourceDetail: st.photos[0].photographer,
        });
        return NextResponse.json({ media: stored, notis: "AI-bilden blev oanvändbar, valde ett foto i stället." });
      }
    }

    if (body.action === "adopt") {
      const url = String(body.url || "");
      if (!url) return NextResponse.json({ error: "Ingen bild vald" }, { status: 400 });
      const source = ["uploaded", "email", "ai", "stock"].includes(String(body.source))
        ? (body.source as "uploaded" | "email" | "ai" | "stock")
        : "uploaded";
      const stored = await adoptReelMedia({ clientId, url, source, sourceDetail: body.detail || undefined });
      return NextResponse.json({ media: stored });
    }

    return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
