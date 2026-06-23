import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const W = 1200, H = 630;
const FONT = "Arial, Helvetica, sans-serif";

// Overlay som speglar startsidans hero: vänsterställd text, mörk vänster-scrim,
// fordonet syns till höger.
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#070b11" stop-opacity="0.94"/>
      <stop offset="38%"  stop-color="#070b11" stop-opacity="0.78"/>
      <stop offset="68%"  stop-color="#070b11" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#070b11" stop-opacity="0.00"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="55%"  stop-color="#070b11" stop-opacity="0"/>
      <stop offset="100%" stop-color="#070b11" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#left)"/>
  <rect width="${W}" height="${H}" fill="url(#bottom)"/>

  <!-- Logo-lockup -->
  <text x="70" y="86" font-family="${FONT}" font-size="44" font-style="italic" font-weight="700" fill="#ffffff" letter-spacing="1">HM MOTOR</text>
  <text x="72" y="112" font-family="${FONT}" font-size="17" font-weight="600" fill="#c7d0db" letter-spacing="4">MIKAELSSONS BIL</text>

  <!-- Eyebrow -->
  <circle cx="78" cy="232" r="6" fill="#e8a838"/>
  <text x="96" y="239" font-family="${FONT}" font-size="19" font-weight="700" fill="#e8a838" letter-spacing="2.5">AUKTORISERAD CF MOTO-&#197;TERF&#214;RS&#196;LJARE</text>

  <!-- Rubrik -->
  <text x="68" y="312" font-family="${FONT}" font-size="60" font-weight="700" fill="#ffffff">R&#228;tt fordon f&#246;r</text>
  <text x="68" y="378" font-family="${FONT}" font-size="60" font-weight="700" fill="#ffffff">jobb och fritid i</text>
  <text x="68" y="444" font-family="${FONT}" font-size="60" font-weight="700" fill="#ffffff">J&#228;mtland</text>

  <!-- Underrubrik -->
  <text x="70" y="498" font-family="${FONT}" font-size="24" font-weight="400" fill="#dfe5ec">Personlig r&#229;dgivning, inga genv&#228;gar. Vi har hj&#228;lpt</text>
  <text x="70" y="530" font-family="${FONT}" font-size="24" font-weight="400" fill="#dfe5ec">kunder i Krokom med omnejd sedan 1990.</text>

  <!-- CTA-knappar -->
  <rect x="70"  y="560" width="232" height="56" rx="28" fill="#1d5ca8"/>
  <text x="186" y="595" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle">Se fyrhjulingar</text>
  <rect x="320" y="560" width="236" height="56" rx="28" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.35"/>
  <text x="438" y="595" font-family="${FONT}" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle">Begagnade bilar</text>
</svg>`);

const heroResized = await sharp(await readFile("public/img/og-hero.webp"))
  .resize(W, H, { fit: "cover", position: "right" })
  .toBuffer();

const out = await sharp(heroResized)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .png()
  .toBuffer();

await writeFile("app/opengraph-image.png", out);
console.log("wrote app/opengraph-image.png", out.length, "bytes");
