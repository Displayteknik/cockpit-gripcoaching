// KUNDENS EGNA BILDREGLER — skarp DoD mot Displayteknik.
//
// Sätter "aldrig människor" + en egen motivregel via SAMMA API-väg kunden använder
// (PUT /api/brand-kit skrivs inte här, men samma tabellrad som routen skriver), bygger en
// bild och verifierar att (a) ingen person syns och (b) motivregeln vann över K1:s
// branschdefault. Städar efter sig.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const UT = path.join(ROOT, "scripts", "_bild11");
mkdirSync(UT, { recursive: true });
let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const { data: dt } = await sb.from("clients").select("id, name, industry").eq("slug", "displayteknik").maybeSingle();
if (!dt) throw new Error("hittade inte Displayteknik");
const clientId = (dt as any).id as string;
const niche = ((dt as any).industry || (dt as any).name) as string;

// Sparar undan det befintliga kitet, sätter testregler, städar efteråt.
const { data: fore } = await sb.from("studio_brand_kits").select("kit").eq("client_id", clientId).maybeSingle();
const foreKit = (fore as any)?.kit ?? null;

await sb.from("studio_brand_kits").upsert({
  client_id: clientId,
  kit: {
    ...(foreKit ?? {}),
    imageStyle: {
      ...((foreKit as any)?.imageStyle ?? {}),
      people: "aldrig",
      motiv: "Alltid ett foto av en riktig LED-skärm i drift, aldrig en tavla eller affisch",
    },
  },
  source: "manual",
  updated_at: new Date().toISOString(),
}, { onConflict: "client_id" });
console.log("Skrev testregler: människor = aldrig, egen motivregel om LED-skärm i drift.\n");

try {
  const { byggBildPrompt } = await import("../lib/bild/promptbyggare");
  const { generateImagen, visualScene, DEPICTED_CONTENT_EN } = await import("../lib/images");
  const { seasonPromptLineEn } = await import("../lib/content/sasong");
  const { getKitDirectives, imageDirectiveSuffix } = await import("../lib/studio/kit");

  const kit = await getKitDirectives(clientId);
  kontroll(kit.personer === "aldrig", `getKitDirectives läser people=aldrig (fick: ${kit.personer})`);
  kontroll(kit.imageMotiv.includes("no people at all"), "imageMotiv bär no-people-regeln");
  kontroll(kit.imageMotiv.includes("LED-skärm i drift"), "imageMotiv bär kundens egen fritext");

  const RUBRIK = "Fem saker att tänka på innan du köper en LED-skärm";
  const BRODTEXT = "En genomgång av vad som faktiskt spelar roll för resultatet.";
  const scen = await visualScene(RUBRIK, niche);
  const byggd = await byggBildPrompt({ clientId, niche, syfte: "singel", rubrik: RUBRIK, brodtext: BRODTEXT, scen });
  kontroll(byggd.personkategori.startsWith("no people"), `personkategori = no-people (fick: ${byggd.personkategori.slice(0, 40)})`);
  kontroll(byggd.prompt.includes("CUSTOMER'S OWN IMAGE RULES"), "kundens regler står i den skickade prompten");

  const REALISM_BAS = " Documentary-style photograph, believable everyday Swedish setting, natural light, candid realism with slight imperfections — not a sterile architectural render.";
  const prompt = `${byggd.prompt}${REALISM_BAS} ${DEPICTED_CONTENT_EN} ${seasonPromptLineEn()}${imageDirectiveSuffix(kit)}`;
  writeFileSync(path.join(UT, "bildregler-dt.prompt.txt"), prompt, "utf8");
  const gen = await generateImagen(prompt, "4:3");
  const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
  if (m) {
    writeFileSync(path.join(UT, "bildregler-dt.png"), Buffer.from(m[2], "base64"));
    console.log("Bild: scripts/_bild11/bildregler-dt.png");

    const fraga = async (text: string) => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: m![1] === "jpeg" ? "image/jpeg" : "image/png", data: m![2] } }, { text }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 } },
        }),
      });
      const j = await r.json().catch(() => null) as any;
      return (j?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "").trim();
    };
    const ingaPersoner = await fraga("Syns det NÅGON människa i bilden, hel eller delvis (även en hand, en skugga av en person, eller någon i bakgrunden)? Svara bara JA eller NEJ.");
    const visarSkarm = await fraga("Visar bilden en verklig digital skärm eller LED-skärm, monterad och i drift — inte en tavla, affisch eller poster? Svara bara JA eller NEJ.");
    console.log(`  vision, någon person: ${ingaPersoner}`);
    console.log(`  vision, verklig skärm i drift: ${visarSkarm}`);
    kontroll(/^nej/i.test(ingaPersoner), "ingen person syns i bilden");
    kontroll(/^ja/i.test(visarSkarm), "bilden visar en verklig skärm, inte en tavla");
  } else {
    kontroll(false, `bilden kunde inte genereras: ${gen.error}`);
  }
} finally {
  // Städ: den ursprungliga kit-raden tillbaka, eller radera raden om det inte fanns någon.
  if (foreKit) {
    await sb.from("studio_brand_kits").upsert({ client_id: clientId, kit: foreKit, source: "manual", updated_at: new Date().toISOString() }, { onConflict: "client_id" });
  } else {
    await sb.from("studio_brand_kits").delete().eq("client_id", clientId);
  }
  console.log("\nStädat: Displaytekniks brand-kit återställt till läget före testet.");
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
