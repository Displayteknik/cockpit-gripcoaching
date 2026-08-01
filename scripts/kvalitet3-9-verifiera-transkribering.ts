/**
 * KVALITET-3 punkt 9 — end-to-end-bevis mot RIKTIGA Gemini-anrop.
 *
 * Kör exakt samma anrop som app/api/ai/transcribe/route.ts och kör svaret genom
 * det riktiga skyddsnätet (lib/ai/transkription.ts). Bevisar två saker:
 *   (a) riktigt tal → transkription i fältet
 *   (b) tal saknas / promptekot → felmeddelandet, ALDRIG intern prompttext
 *
 * Kör:  npx tsx scripts/kvalitet3-9-verifiera-transkribering.ts <mapp-med-wav>
 */
import fs from "node:fs";
import path from "node:path";
import {
  TRANSKRIBERINGS_PROMPT,
  ROST_FELMEDDELANDE,
  rensaTranskription,
} from "../lib/ai/transkription";

const dir = process.argv[2];
if (!dir) throw new Error("ange mapp med tal.wav / tyst.wav / kort.wav");

const envRaw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const key = envRaw
  .split(/\r?\n/)
  .find((l) => l.startsWith("GEMINI_API_KEY="))
  ?.slice("GEMINI_API_KEY=".length)
  .trim();
if (!key) throw new Error("GEMINI_API_KEY saknas i .env.local");

async function kor(fil: string) {
  const buf = fs.readFileSync(`${dir}/${fil}`);
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: buf.toString("base64") } },
          { text: TRANSKRIBERINGS_PROMPT },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await res.json();
  const ratt = (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  const efterGrind = rensaTranskription(ratt);
  console.log(`--- ${fil}`);
  console.log(`    Gemini svarade : ${JSON.stringify(ratt.slice(0, 120))}`);
  console.log(`    Till fältet    : ${efterGrind ? JSON.stringify(efterGrind.slice(0, 120)) : `(inget) → "${ROST_FELMEDDELANDE}"`}`);
  const lackage = (efterGrind || "").toLowerCase().includes("transkribera detta");
  console.log(`    Promptläckage  : ${lackage ? "JA — TESTET UNDERKÄNT" : "nej"}`);
  if (lackage) process.exitCode = 1;
}

async function main() {
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".wav"))) await kor(f);
}
main();
