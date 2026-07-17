/**
 * Studio — lokal PNG-export (Fas 1, alternativ A i docs/studio/PLAN.md §5).
 *
 * Kör:  npx tsx scripts/studio-export.ts <payload.json>
 * Env:  STUDIO_BASE_URL (default http://localhost:3481)
 *
 * Öppnar render-routen i Playwright med viewport = exakt målstorlek (deviceScaleFactor 1),
 * väntar på document.fonts.ready + bildladdning, screenshottar #studio-canvas till
 * exports/{clientId}/{datum}-{slug}-{format}.png.
 *
 * Playwright/Chromium körs INTE i Vercel serverless — därför lokal CLI i v1.
 */
import { chromium } from "playwright";
import { readFile, mkdir } from "fs/promises";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { normalizePayload, encodePayload, FORMAT_DIMENSIONS } from "../lib/studio/payload";

const BASE = process.env.STUDIO_BASE_URL || "http://localhost:3481";

async function ping(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await ping(url)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev-servern svarade inte på ${url} inom ${timeoutMs} ms`);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "inlagg";
}

async function main() {
  const payloadFile = process.argv[2];
  if (!payloadFile) {
    console.error("Användning: npx tsx scripts/studio-export.ts <payload.json>");
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(payloadFile, "utf8"));
  const payload = normalizePayload(raw);
  const { w, h } = FORMAT_DIMENSIONS[payload.format];

  // Säkerställ att dev-servern kör (starta den annars, riv ner efteråt).
  let child: ChildProcess | undefined;
  if (!(await ping(BASE))) {
    console.log("Dev-server nere — startar 'npm run dev' …");
    child = spawn("npm", ["run", "dev"], { stdio: "ignore", shell: true, detached: false });
    await waitForServer(BASE, 90000);
  }

  const b64 = encodePayload(payload);
  // Karusell → N PNG (en per slide). Övriga → en enda.
  const slideCount = payload.slides.length > 1 ? payload.slides.length : 0;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const outDir = path.join(process.cwd(), "exports", payload.clientId);
    await mkdir(outDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const stem = slugify(payload.headline1 || payload.slides[0]?.headline || payload.templateId);

    const renderOne = async (slide: number | null): Promise<string> => {
      const url = `${BASE}/studio/render/${payload.templateId}?p=${encodeURIComponent(b64)}${slide !== null ? `&slide=${slide}` : ""}`;
      // OBS: inte "networkidle" — dev-serverns HMR-websocket håller anslutningen öppen
      // så networkidle löser aldrig ut. Vänta på load + fonter + bilder explicit istället.
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      // Dölj Next.js dev-indikatorn (annars fastnar "N"-märket i element-screenshoten).
      await page.addStyleTag({ content: "nextjs-portal{display:none !important}" });
      await page.evaluate(async () => {
        const doc = document as unknown as { fonts: { ready: Promise<unknown> } };
        await doc.fonts.ready;
        await Promise.all(
          [...document.images].map((img) =>
            img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = r; })
          )
        );
      });
      const canvas = page.locator("#studio-canvas");
      await canvas.waitFor({ state: "visible", timeout: 15000 });
      const suffix = slide !== null ? `-slide-${String(slide + 1).padStart(2, "0")}` : "";
      const out = path.join(outDir, `${date}-${stem}${suffix}-${payload.format}.png`);
      await canvas.screenshot({ path: out });
      return out;
    };

    if (slideCount) {
      for (let s = 0; s < slideCount; s++) {
        const out = await renderOne(s);
        console.log("✔ Slide", s + 1, "/", slideCount, "→", out, `(${w}×${h})`);
      }
    } else {
      const out = await renderOne(null);
      console.log("✔ Exporterad:", out, `(${w}×${h})`);
    }
  } finally {
    await browser.close();
    if (child) child.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
