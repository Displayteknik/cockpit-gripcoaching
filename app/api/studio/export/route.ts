import { NextRequest, NextResponse } from "next/server";
import { normalizePayload, encodePayload, FORMAT_DIMENSIONS } from "@/lib/studio/payload";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/export — payload → PNG (data-URL).
// Kör Playwright LOKALT (dev-servern är Node med chromium installerat). I produktion
// (Vercel, playwright = devDependency) faller den tillbaka med 501 → använd CLI/payload.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const payload = normalizePayload(raw);
    const { w, h } = FORMAT_DIMENSIONS[payload.format];

    const host = req.headers.get("host") || "localhost:3481";
    const isLocal = host.startsWith("localhost") || host.startsWith("127.");
    const url = `${isLocal ? "http" : "https"}://${host}/studio/render/${payload.templateId}?p=${encodeURIComponent(encodePayload(payload))}`;

    // Runtime-import så bundlern inte drar in devDependencyn i prod-bygget.
    const spec = "playwright";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chromium: any;
    try {
      chromium = (await import(/* webpackIgnore: true */ spec)).chromium;
    } catch {
      return NextResponse.json(
        { error: "En-klicks-export körs bara lokalt. Ladda ner payload och kör: npm run studio:export <fil.json>" },
        { status: 501 },
      );
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });
      await page.evaluate(async () => {
        const doc = document as unknown as { fonts: { ready: Promise<unknown> } };
        await doc.fonts.ready;
        await Promise.all(
          [...document.images].map((img) =>
            img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; }),
          ),
        );
      });
      const buf: Buffer = await page.locator("#studio-canvas").screenshot();
      return NextResponse.json({ dataUrl: `data:image/png;base64,${buf.toString("base64")}`, width: w, height: h });
    } finally {
      await browser.close();
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
