// KVALITET-3 punkt 6a — bevis för loggvalet i RENDER-vägen.
//
// Frågan: väljer render/export/publicering mörk variant eller platta för exakt de
// bildtyper Håkan visade — kräftskive-bilden (ljus fönsterfasad + träd bakom mörk
// interiör) och menyskärms-bilden (blandad toppzon)?
//
// Metoden mäter INTE om — den anropar `computeLogoHint` ur lib/studio/logo-contrast.ts,
// exakt den funktion render-routen använder, med samma zon och samma trösklar. Sedan
// jämförs beslutet med den GAMLA regeln (medelvärde mot tröskel, före BILD-6b) så
// före/efter blir en riktig jämförelse och inte en efterhandskonstruktion.
//
// Bilderna serveras från en lokal http-server eftersom computeLogoHint hämtar dem
// över nätet, precis som i drift.
//
// Körning:
//   npx tsx --tsconfig scripts/text1/tsconfig.json scripts/studio/loggval-bevis.mts
//
// Utdata: docs/studio/kvalitet3-logga/matning.json + README-tabellen skrivs för hand.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const KALLA = path.join(ROOT, "docs/studio/bild7-exempel");
const UT = path.join(ROOT, "docs/studio/kvalitet3-logga");

// De två bildtyperna ur verifieringsrundan.
const FALL = [
  {
    id: "kraftskiva-trad-fasad",
    fil: "fore-4-annas-blommor.png",
    beskrivning: "Kräftskive-bilden: blomsteraffär med stort fönster — träd och ljus fasad utanför, mörkare interiör och svarta griffeltavlor i samma toppzon.",
  },
  {
    id: "menyskarm-skyltfonster",
    fil: "efter-2-displayteknik.png",
    beskrivning: "Menyskärms-bilden: lunchrestaurang med skärmen i fönstret — ljust trätak och solbelyst fönsterparti mot mörka takskenor.",
  },
  {
    id: "menyskarm-kvall",
    fil: "fore-1-displayteknik.png",
    beskrivning: "Kontrollfall, entydigt mörk toppzon: skyltfönster i kvällsljus.",
  },
];

// Loggor: en mörk original (för ljus bakgrund) och en vit variant (för mörk bakgrund).
// Rena SVG:er → deterministisk luminans, inga externa beroenden i beviset.
const LOGGA_MORK = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="none"/><text x="0" y="72" font-family="sans-serif" font-size="72" font-weight="800" fill="#14281f">MÄRKET</text></svg>`;
const LOGGA_VIT = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="none"/><text x="0" y="72" font-family="sans-serif" font-size="72" font-weight="800" fill="#ffffff">MÄRKET</text></svg>`;

async function main() {
  const { computeLogoHint } = await import("@/lib/studio/logo-contrast");
  const { normalizePayload } = await import("@/lib/studio/payload");
  const { NEUTRAL_SIGNATURE } = await import("@/lib/studio/signature");

  // Lokal server: bilderna + de två loggorna.
  const server = createServer((req, res) => {
    const namn = decodeURIComponent((req.url || "").replace(/^\//, "").split("?")[0]);
    if (namn === "logga-mork.svg" || namn === "logga-vit.svg") {
      res.writeHead(200, { "content-type": "image/svg+xml" });
      res.end(namn === "logga-mork.svg" ? LOGGA_MORK : LOGGA_VIT);
      return;
    }
    const fil = path.join(KALLA, namn);
    if (!existsSync(fil)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": "image/png" });
    res.end(readFileSync(fil));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const bas = `http://127.0.0.1:${port}`;

  // Brand: bara det computeLogoHint faktiskt läser (assets + colors + content.overlayStyle).
  const brand = {
    clientId: "bevis",
    name: "Märket",
    colors: { primary: "#1A6B3C", primaryDeep: "#0F4F2A", primaryLight: "#5AAF32", accent: "#F2B01E", support: "#7ECECA", ink: "#14281F", paper: "#FFFFFF" },
    colorsCmyk: {},
    forbiddenColors: [],
    screenFormats: [],
    fonts: { headline: "Inter", body: "Inter", logo: "Inter" },
    elements: { brush: { enabled: false, color: "accent" as const }, shapes: { enabled: false, style: "rounded" as const }, lines: { enabled: false, weight: "thin" as const }, badge: { enabled: false, shape: "circle" as const }, underline: { enabled: false } },
    imageStyle: { mode: "photo" as const, prompt: "", negative: "", people: true, colorGrade: "neutral" as const },
    content: { clientType: "retail", textWeight: "balanced" as const, overlayStyle: "scrim-bottom" as const, formats: [] },
    signature: NEUTRAL_SIGNATURE,
    footer: { show: false, tagline: "", address: "", ctaLabel: "", ctaUrl: "", qrUrl: "" },
    donts: [],
    assets: { logo: `${bas}/logga-mork.svg`, logoOnDark: `${bas}/logga-vit.svg` },
  };

  // Den GAMLA regeln (före BILD-6b): bara medelvärdet mot fototröskeln, ingen varians,
  // och plattbeslutet mot medelvärdet i stället för zonens värsta parti.
  const { zoneStats, OVERLAY_TOP_ZONE, IMAGE_LIGHT_BG, PLATE_CONTRAST } = await import("@/lib/studio/logo-contrast");
  const zonStatsForBevis = (url: string) => zoneStats(url, OVERLAY_TOP_ZONE);
  const GAMLA_FOTO_TROSKEL = IMAGE_LIGHT_BG;
  const PLATE_CONTRAST_FOR_BEVIS = PLATE_CONTRAST;

  const rader: Record<string, unknown>[] = [];
  for (const f of FALL) {
    const url = `${bas}/${f.fil}`;
    const payload = normalizePayload({ clientId: "bevis", templateId: "ark-overlay", format: "1080x1080", imageUrl: url });
    const zon = await zonStatsForBevis(url);
    const efter = await computeLogoHint("ark-overlay", payload, brand, 0);

    // Gamla regeln, återskapad på samma uppmätta zon.
    const gammalLjus = (zon?.mean ?? 0) >= GAMLA_FOTO_TROSKEL;
    const gammalUrl = gammalLjus ? brand.assets.logo : brand.assets.logoOnDark;
    const gammalLogoLum = gammalLjus ? 0.12 : 1; // mörk original vs vit variant
    const gammalPlatta = zon && Math.abs(gammalLogoLum - zon.mean) < PLATE_CONTRAST_FOR_BEVIS ? (gammalLjus ? "light" : "dark") : null;

    const namn = (u: string | undefined) => (u?.includes("logga-vit") ? "vit variant" : u ? "mörk original" : "ingen");
    rader.push({
      fall: f.id,
      bild: f.fil,
      beskrivning: f.beskrivning,
      zon: zon ? { mean: +zon.mean.toFixed(3), p05: +zon.p05.toFixed(3), p95: +zon.p95.toFixed(3), spann: +(zon.p95 - zon.p05).toFixed(3) } : null,
      fore_medelvarderegel: { variant: namn(gammalUrl), platta: gammalPlatta },
      efter_bild6b: { variant: namn(efter?.url), platta: efter?.plate ?? null },
      andrades: namn(gammalUrl) !== namn(efter?.url) || gammalPlatta !== (efter?.plate ?? null),
    });
    console.log(`${f.id}: zon mean=${zon?.mean.toFixed(3)} p05=${zon?.p05.toFixed(3)} p95=${zon?.p95.toFixed(3)} | före: ${namn(gammalUrl)}/${gammalPlatta ?? "ingen platta"} → efter: ${namn(efter?.url)}/${efter?.plate ?? "ingen platta"}`);
  }

  // Manuellt val (6b): samma bild, användaren väljer själv → autovalet ska ge vika.
  const bild = `${bas}/${FALL[0].fil}`;
  const manuella: Record<string, unknown>[] = [];
  for (const val of ["", "ljus", "mork", "platta"] as const) {
    const p = normalizePayload({ clientId: "bevis", templateId: "ark-overlay", format: "1080x1080", imageUrl: bild, overrides: { logoVariant: val } as never });
    const h = await computeLogoHint("ark-overlay", p, brand, 0);
    manuella.push({ val: val || "auto", variant: h?.url.includes("logga-vit") ? "vit variant" : "mörk original", platta: h?.plate ?? null });
    console.log(`manuellt "${val || "auto"}": ${h?.url.includes("logga-vit") ? "vit variant" : "mörk original"} / ${h?.plate ?? "ingen platta"}`);
  }

  mkdirSync(UT, { recursive: true });
  writeFileSync(path.join(UT, "matning.json"), JSON.stringify({ kord: new Date().toISOString(), autoval: rader, manuellt_val: manuella }, null, 2), "utf8");

  // ── Före/efter-bilder: samma mall-komponent som render-routen använder ──
  // ArkOverlay renderas till HTML med respektive loggbeslut och fotograferas med
  // Playwright. Ingen omritning av layouten här — komponenten är källan.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = await import("react");
  const ArkOverlay = (await import("@/components/studio/archetypes/ArkOverlay")).default;
  const { chromium } = await import("playwright");
  const webblasare = await chromium.launch();
  try {
    for (const r of rader) {
      const url = `${bas}/${r.bild as string}`;
      const payload = normalizePayload({ clientId: "bevis", templateId: "ark-overlay", format: "1080x1080", imageUrl: url, headline1: "SÅ SYNS DU", body: "Skylten som fungerar även när solen står på." });
      for (const lage of ["fore", "efter"] as const) {
        const beslut = lage === "fore" ? (r.fore_medelvarderegel as { variant: string; platta: "dark" | "light" | null }) : (r.efter_bild6b as { variant: string; platta: "dark" | "light" | null });
        const hint = { url: beslut.variant === "vit variant" ? brand.assets.logoOnDark : brand.assets.logo, plate: beslut.platta };
        const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">${renderToStaticMarkup(
          React.createElement(ArkOverlay, { payload, brand, logoHint: hint }),
        )}</body>`;
        const sida = await webblasare.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
        await sida.setContent(html, { waitUntil: "load" });
        await sida.waitForTimeout(400);
        await sida.screenshot({ path: path.join(UT, `${lage}-${r.fall as string}.png`) });
        await sida.close();
      }
      console.log(`bilder: fore-${r.fall} + efter-${r.fall}`);
    }
  } finally {
    await webblasare.close();
  }

  server.close();
  console.log(`\nSkrev ${UT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
