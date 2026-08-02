import { NextRequest, NextResponse } from "next/server";

const PIXABAY_KEY = process.env.PIXABAY_API_KEY || "";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const page = req.nextUrl.searchParams.get("page") || "1";

  if (!PIXABAY_KEY) {
    return NextResponse.json({ hits: [], totalHits: 0, error: "No API key configured" });
  }

  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(q)}&image_type=photo&per_page=20&page=${page}&safesearch=true`;

  try {
    // KOSTNAD-1b: går genom lib/ai-usage så tjänsten syns i kostnadsöverblicken, även när
    // den är gratis i dag. En gratis tjänst med kvot är en kostnad som väntar på att bli en.
    const { anropaProvider } = await import("@/lib/ai-usage");
    const svar = await anropaProvider<{ hits?: Record<string, unknown>[]; totalHits?: number }>({
      provider: "pixabay",
      model: "search",
      url,
      init: {},
    });
    const data = svar.data || {};
    return NextResponse.json({
      hits: (data.hits || []).map((h: Record<string, unknown>) => ({
        id: h.id,
        preview: h.previewURL,
        web: h.webformatURL,
        large: h.largeImageURL,
        tags: h.tags,
        user: h.user,
      })),
      totalHits: data.totalHits || 0,
    });
  } catch {
    return NextResponse.json({ hits: [], totalHits: 0, error: "Search failed" });
  }
}
