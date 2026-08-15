// BILD-11 TILLÄGG, DoD för punkt 4 och 5 — skarp körning mot Displaytekniks tenant.
//
// Punkt 4: regenerera EXAKT det inlägg Håkan fastnade på ("Skärmen som säljer när du
//          sover") och verifiera att bilden visar skyltfönstret UTIFRÅN, i kvällsljus.
// Punkt 5: fem genereringar i singelflödet utan läsbara genererade ord, och inget
//          engelskt ord på en avbildad skärm.
//
// Skriptet kör samma kedja som routen: byggBildPrompt → generateImagen → motivPassar →
// stavningsgrind (ordfri). Bilderna sparas i scripts/_bild11/ så de går att titta på.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { byggBildPrompt } = await import("../lib/bild/promptbyggare");
const { generateImagen, visualScene, DEPICTED_CONTENT_EN } = await import("../lib/images");
const { stavningsgrind, lasbaraOrd, engelskaOrd, lasOrdTeckenvis, lasHuvudskyltOrd, tillhorHuvudtext } = await import("../lib/bildtext");
const { seasonPromptLineEn } = await import("../lib/content/sasong");
const { getKitDirectives, imageDirectiveSuffix } = await import("../lib/studio/kit");

const UT = path.join(ROOT, "scripts", "_bild11");
mkdirSync(UT, { recursive: true });

const { data: dt } = await sb.from("clients").select("id, name, industry").eq("slug", "displayteknik").maybeSingle();
if (!dt) throw new Error("hittade inte Displayteknik");
const clientId = (dt as any).id as string;
const niche = ((dt as any).industry || (dt as any).name) as string;
console.log(`Tenant: ${(dt as any).name} — bransch "${niche}"\n`);

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const REALISM_BAS = " Documentary-style photograph, believable everyday Swedish setting, natural light, candid realism with slight imperfections — not a sterile architectural render.";

/** En generering, hela vägen: prompt → bild → ordgrind. Samma steg som routen. */
async function kor(namn: string, rubrik: string, brodtext: string) {
  const scen = await visualScene(rubrik, niche);
  const byggd = await byggBildPrompt({ clientId, niche, syfte: "singel", rubrik, brodtext, scen });
  const kit = await getKitDirectives(clientId).catch(() => null);
  const bas = byggd.tid ? REALISM_BAS.replace(", natural light,", ",") : REALISM_BAS;
  const prompt = `${byggd.prompt}${bas} ${DEPICTED_CONTENT_EN} ${seasonPromptLineEn()}${kit ? imageDirectiveSuffix(kit) : ""}`;
  writeFileSync(path.join(UT, `${namn}.prompt.txt`), prompt, "utf8");

  const t0 = Date.now();
  let gen = await generateImagen(prompt, "4:3");
  if (!gen.image) return { byggd, prompt, fel: gen.error ?? "ingen bild", ord: [] as string[], engelska: [] as string[], bild: "" };

  const grind = await stavningsgrind({
    bild: gen.image,
    maxOmtag: 2,
    ordfri: true,
    tidsbudgetMs: 90000 - (Date.now() - t0),
    generera: ({ skarpning }) => generateImagen(`${prompt}${skarpning}`, "4:3"),
  });
  const bild = grind.image;
  const m = bild.match(/^data:image\/(\w+);base64,(.+)$/);
  if (m) writeFileSync(path.join(UT, `${namn}.${m[1] === "jpeg" ? "jpg" : "png"}`), Buffer.from(m[2], "base64"));

  // Mät SLUTbilden: vilka ord står på huvudskylten efter grindens omtag?
  const avlast = await lasOrdTeckenvis(bild);
  const huvud = await lasHuvudskyltOrd(bild);
  const alla = lasbaraOrd([...avlast.ord, ...avlast.ordBak]);
  const paSkylt = huvud === null ? alla : alla.filter((o) => tillhorHuvudtext(o, huvud));
  return {
    byggd, prompt, bild, fel: "",
    omtag: grind.omtag, utfall: grind.utfall.orsak,
    ord: Array.from(new Set(paSkylt)),
    engelska: Array.from(new Set(engelskaOrd(paSkylt))),
  };
}

/** Vision-fråga med ja/nej-svar om den färdiga bilden. */
async function fraga(bild: string, text: string): Promise<string> {
  const m = bild.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return "";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 60, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const j = await r.json().catch(() => null) as any;
  return (j?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "").trim();
}

// ── PUNKT 4: exakt Håkans inlägg ─────────────────────────────────────────────
console.log("PUNKT 4 — inlägget som fick fel bild: \"Skärmen som säljer när du sover\"\n");
const RUBRIK = "Skärmen som säljer när du sover";
const TEXT = "Ett skyltfönster som jobbar dygnet runt, även när butiken är stängd.";

const p4 = await kor("punkt4-skyltfonster", RUBRIK, TEXT);
console.log(`  bevis: ${p4.byggd.bevismening.slice(0, 90)}`);
console.log(`  plats: ${p4.byggd.plats?.slice(0, 90) ?? "(ingen)"}`);
console.log(`  tid:   ${p4.byggd.tid?.slice(0, 90) ?? "(ingen)"}\n`);
kontroll(!!p4.byggd.plats && /OUTSIDE on the street/.test(p4.byggd.plats), "platsen härledd: utifrån gatan");
kontroll(!!p4.byggd.tid && /AFTER DARK/.test(p4.byggd.tid), "tiden härledd: efter mörkrets inbrott");
kontroll(p4.prompt.includes("WHERE IT TAKES PLACE") && p4.prompt.includes("WHEN IT TAKES PLACE"), "båda raderna står i den skickade prompten");

if (p4.bild) {
  const utifran = await fraga(p4.bild, "Är kameran UTANFÖR byggnaden, på gatan, och tittar in genom ett fönster eller på en skylt utifrån? Svara bara JA eller NEJ.");
  const kvall = await fraga(p4.bild, "Är det kväll eller natt i bilden (mörkt ute, belysningen kommer från skyltar eller lampor)? Svara bara JA eller NEJ.");
  const beskrivning = await fraga(p4.bild, "Beskriv bilden på en mening: var står kameran, vilken tid på dygnet är det, och vad visas på skärmen?");
  console.log(`\n  vision, utifrån: ${utifran}`);
  console.log(`  vision, kväll/natt: ${kvall}`);
  console.log(`  vision, beskrivning: ${beskrivning}\n`);
  kontroll(/^ja/i.test(utifran), "bilden är tagen utifrån gatan");
  kontroll(/^ja/i.test(kvall), "bilden är tagen i kvälls- eller nattljus");
  kontroll(p4.engelska.length === 0, `inga engelska ord på skärmen (läste: ${p4.ord.join(", ") || "inga ord alls"})`);
} else {
  kontroll(false, `bilden kunde inte genereras: ${p4.fel}`);
}

// ── PUNKT 5: fem genereringar i singelflödet ─────────────────────────────────
// `npx tsx scripts/bild11-dod.mts p4` kör bara punkt 4 — en bild i stället för sex, när
// det bara är plats- och tidsregeln som ändrats.
if (process.argv[2] === "p4") {
  console.log(`\n(punkt 5 hoppades över)\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
  process.exit(fel === 0 ? 0 : 1);
}
console.log("\nPUNKT 5 — fem singelgenereringar, inga läsbara genererade ord\n");
const AMNEN: [string, string][] = [
  ["Skärmen som säljer när du sover", "Skyltfönstret jobbar dygnet runt."],
  ["Därför syns inte din skylt i solen", "Ljusstyrkan avgör om budskapet når fram utomhus."],
  ["Billig hårdvara som inte håller", "Panelen slutar fungera efter ett år."],
  ["Så mycket enklare blir vardagen med rätt system", "Personalen byter innehåll på en minut."],
  ["Vad kostar en skylt egentligen", "Investeringen räknas hem i ökad försäljning."],
];
const resultat: { namn: string; ord: string[]; engelska: string[]; omtag?: number; utfall?: string }[] = [];
for (let i = 0; i < AMNEN.length; i++) {
  const [rubrik, brodtext] = AMNEN[i];
  const r = await kor(`punkt5-${i + 1}`, rubrik, brodtext);
  resultat.push({ namn: `${i + 1}. ${rubrik}`, ord: r.ord, engelska: r.engelska, omtag: r.omtag, utfall: r.utfall });
  console.log(`  ${i + 1}. "${rubrik.slice(0, 44)}" — omtag ${r.omtag ?? "-"}, utfall ${r.utfall ?? r.fel}`);
  console.log(`     ord på huvudskylten: ${r.ord.join(", ") || "inga"}${r.engelska.length ? `  ⚠ ENGELSKA: ${r.engelska.join(", ")}` : ""}`);
}
const medOrd = resultat.filter((r) => r.ord.length);
const medEngelska = resultat.filter((r) => r.engelska.length);
console.log("");
kontroll(medEngelska.length === 0, `noll engelska ord i fem genereringar (hittade i ${medEngelska.length})`);
kontroll(medOrd.length === 0, `noll läsbara ord på huvudskylten i fem genereringar (hittade i ${medOrd.length})`);

writeFileSync(path.join(UT, "resultat.json"), JSON.stringify({ punkt4: { plats: p4.byggd.plats, tid: p4.byggd.tid, ord: p4.ord, engelska: p4.engelska }, punkt5: resultat }, null, 2), "utf8");
console.log(`\nBilder och prompter: scripts/_bild11/`);
console.log(`${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
