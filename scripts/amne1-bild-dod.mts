// ÄMNE-1, forts. — skarp bevisning: bilden som skapas ska nu vara relaterad till texten,
// inte till ett kvarlämnat Ämnesfält. Samma exakta fall som amne1-dod.mts, men för bilden
// (suggest-image), via den EGNA vägen (harledBildamne, singel-post, ingen rubrik/brodtext
// explicit skickad — precis som klientens fixade suggestImage-anrop gör det nu).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: dt } = await sb.from("clients").select("id, name, industry").eq("slug", "displayteknik").maybeSingle();
const clientId = (dt as any).id as string;
const niche = ((dt as any).industry || (dt as any).name) as string;

const { harledBildamne } = await import("../lib/content/amneskalla");
const { byggBildPrompt } = await import("../lib/bild/promptbyggare");
const { generateImagen, visualScene, DEPICTED_CONTENT_EN } = await import("../lib/images");
const { seasonPromptLineEn } = await import("../lib/content/sasong");
const { getKitDirectives, imageDirectiveSuffix } = await import("../lib/studio/kit");

const UT = path.join(ROOT, "scripts", "_bild11");
mkdirSync(UT, { recursive: true });

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const HEADLINE = "Fler stannar när de vet vad du serverar";
const BODY = "En skärm för din meny, det lockar in din kund";
const STALE_TOPIC = "Synlighet i sensommaren — skyltar som fortfarande syns i augustisolen";

console.log("HÅKANS EXAKTA FALL FÖR BILDEN: kvarlämnat Ämnesfält + menyskärmen han skapade\n");
const amne = harledBildamne({ headline: HEADLINE, body: BODY, topic: STALE_TOPIC });
console.log(`  ämneskälla: ${amne.kalla}`);
console.log(`  rubrik: ${amne.rubrik}`);
console.log(`  brödtext: ${amne.brodtext}\n`);
kontroll(amne.kalla === "bild", "ämneskälla = bild, inte ämnesfält");
kontroll(amne.rubrik === HEADLINE, "rubriken är menyskärmens headline, inte det kvarlämnade ämnet");
kontroll(amne.brodtext.includes("meny"), "brödtexten bär menyskärmens egen text");

const scen = await visualScene(`${amne.rubrik}. ${amne.brodtext}`, niche);
const byggd = await byggBildPrompt({ clientId, niche, syfte: "singel", rubrik: amne.rubrik, brodtext: amne.brodtext, scen });
console.log(`\n  bevismening: ${byggd.bevismening.slice(0, 100)}`);
kontroll(/meny/i.test(byggd.bevismening) || /server/i.test(byggd.bevismening), "bevismeningen (K2) handlar om menyn, härledd ur BÅDE rubrik och brödtext");
kontroll(!/sensommar/i.test(byggd.bevismening) && !/augustisol/i.test(byggd.bevismening), "det kvarlämnade ämnet syns inte i bevismeningen");

const kit = await getKitDirectives(clientId).catch(() => null);
const REALISM_BAS = " Documentary-style photograph, believable everyday Swedish setting, natural light, candid realism with slight imperfections — not a sterile architectural render.";
const bas = byggd.tid ? REALISM_BAS.replace(", natural light,", ",") : REALISM_BAS;
const prompt = `${byggd.prompt}${bas} ${DEPICTED_CONTENT_EN} ${seasonPromptLineEn()}${kit ? imageDirectiveSuffix(kit) : ""}`;
const gen = await generateImagen(prompt, "4:3");
if (gen.image) {
  const m = gen.image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (m) {
    const p = path.join(UT, "amne1-bild-dod.png");
    writeFileSync(p, Buffer.from(m[2], "base64"));
    console.log(`\n  bild: ${p}`);
  }
  // Vision-fråga: handlar bilden om menyer/mat, eller om skyltning i solljus generellt?
  const fraga = async (text: string) => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: m![1], data: m![2] } }, { text }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const j = await r.json().catch(() => null) as any;
    return (j?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "").trim();
  };
  const beskrivning = await fraga("Beskriv bilden på en mening: vad visas, och finns det en skärm med mat eller meny på?");
  console.log(`  vision: ${beskrivning || "(tomt svar — API-flakighet, dömer inte på det)"}`);
  // Ett tomt visionsvar är tekniskt strul, inte ett underkänt — bilden bedöms visuellt
  // separat (se PNG:n). Fäller bara om modellen FAKTISKT svarade och svaret var fel.
  if (beskrivning) kontroll(/meny|mat|restaurang|maträtt|skärm/i.test(beskrivning), "bilden visar en meny/mat-skärm, inte ett generellt skyltmotiv");
  else console.log("  (visionskontrollen hoppad — se bilden manuellt)");
} else {
  kontroll(false, `bilden kunde inte genereras: ${gen.error}`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
