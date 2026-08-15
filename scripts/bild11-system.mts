// BILD-11: TÄNKER SYSTEMET RÄTT OAVSETT BRANSCH OCH FORMULERING?
//
// Håkans rättning 15/8: "gör inte missarna bara för DT, se det systemmässigt — oavsett vad
// som skrivs in måste den tänka rätt."
//
// Testet är därför byggt för att MISSA nyckelordslistorna med flit. Ingen av rubrikerna
// nedan innehåller ett ord ur PLATS_MONSTER eller TID_MONSTER; kommer rätt plats och tid
// ändå fram är det modelltolkningen som gör jobbet, inte en lista jag råkat fylla på.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { byggBildPrompt, harledPlats, harledTid } = await import("../lib/bild/promptbyggare");
const { generateImagen, visualScene, DEPICTED_CONTENT_EN } = await import("../lib/images");
const { seasonPromptLineEn } = await import("../lib/content/sasong");
const { getKitDirectives, imageDirectiveSuffix } = await import("../lib/studio/kit");

const UT = path.join(ROOT, "scripts", "_bild11");
mkdirSync(UT, { recursive: true });

let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const FALL: { slug: string; rubrik: string; brodtext: string; vantadPlats: RegExp; vantadTid: RegExp | null; bild?: boolean }[] = [
  {
    slug: "displayteknik",
    rubrik: "Displayen som jobbar vidare när personalen gått hem",
    brodtext: "Butiken är låst, men budskapet står kvar mot trottoaren.",
    vantadPlats: /OUTSIDE on the street|facade|forecourt/i,
    vantadTid: /AFTER DARK/,
    bild: true,
  },
  {
    slug: "forbalance",
    rubrik: "Samtalet som ryms innan arbetsdagen börjar",
    brodtext: "Många bokar den första tiden på dagen och hinner till jobbet efteråt.",
    vantadPlats: /treatment room|entrance|reception/i,
    vantadTid: /EARLY MORNING/,
    bild: true,
  },
  {
    slug: "annas-blommor",
    // ⚠ Villkoret var först /inside the shop/ och gav grönt av fel skäl: kanontexten för
    //   gatan-utifrån innehåller frasen "NEVER inside the shop". Ett test som matchar på
    //   ett ord inuti en negation mäter ingenting.
    rubrik: "Buketten du hinner hämta på väg hem från jobbet",
    brodtext: "Vi binder den klar så du bara stannar till.",
    vantadPlats: /^(seen from OUTSIDE|inside the shop|in the entrance)/,
    vantadTid: null, // "på väg hem" är en tidpunkt först om modellen tycker det — inget krav
  },
  {
    slug: "engens-trad",
    rubrik: "Jobbet uppe i kronan, sett från marken",
    brodtext: "Vi tar ned de grenar som hänger över taket.",
    vantadPlats: /[\s\S]{20,}/, // vilken plats som helst, men den MÅSTE bli härledd
    vantadTid: null,
  },
];

for (const f of FALL) {
  const { data: k } = await sb.from("clients").select("id, name, industry").eq("slug", f.slug).maybeSingle();
  if (!k) { kontroll(false, `hittade inte tenant ${f.slug}`); continue; }
  const niche = ((k as any).industry || (k as any).name) as string;

  // 1. Bevisa att REGLERNA missar — annars mäter testet inte det det påstår.
  const regelPlats = harledPlats(f.rubrik, f.brodtext);
  const regelTid = harledTid(f.rubrik, f.brodtext);

  const byggd = await byggBildPrompt({ clientId: (k as any).id, niche, syfte: "singel", rubrik: f.rubrik, brodtext: f.brodtext });
  console.log(`\n${(k as any).name} — "${f.rubrik}"`);
  console.log(`  reglerna gav:  plats=${regelPlats ? "träff" : "INGEN"}  tid=${regelTid ? "träff" : "INGEN"}`);
  console.log(`  slutresultat:  plats=${byggd.plats?.slice(0, 80) ?? "(ingen)"}`);
  console.log(`                 tid=${byggd.tid?.slice(0, 80) ?? "(ingen)"}`);

  kontroll(!regelPlats || !regelTid, "formuleringen missar nyckelordslistorna (annars mäter testet fel sak)");
  kontroll(!!byggd.plats && f.vantadPlats.test(byggd.plats), `platsen härledd ändå: ${byggd.plats ? "ja" : "nej"}`);
  if (f.vantadTid) kontroll(!!byggd.tid && f.vantadTid.test(byggd.tid), `tiden härledd ändå: ${byggd.tid?.slice(0, 40) ?? "ingen"}`);
  // Årstidsspärren gäller även modellsvaren.
  for (const del of [byggd.plats, byggd.tid]) {
    if (del) kontroll(!/vinter|winter|sommar|summer|höst|autumn|snow|snö/i.test(del), "inget årstidsord i svaret");
  }
  // K5 ska ligga i varje prompt, oavsett bransch.
  kontroll(byggd.prompt.includes("EVERYTHING IS IN ITS FINISHED, NORMAL STATE"), "verklighetsvakten (K5) med i prompten");

  if (f.bild) {
    const scen = await visualScene(f.rubrik, niche);
    const kit = await getKitDirectives((k as any).id).catch(() => null);
    const REALISM_BAS = " Documentary-style photograph, believable everyday Swedish setting, natural light, candid realism with slight imperfections — not a sterile architectural render.";
    const bas = byggd.tid ? REALISM_BAS.replace(", natural light,", ",") : REALISM_BAS;
    const b2 = await byggBildPrompt({ clientId: (k as any).id, niche, syfte: "singel", rubrik: f.rubrik, brodtext: f.brodtext, scen });
    const prompt = `${b2.prompt}${bas} ${DEPICTED_CONTENT_EN} ${seasonPromptLineEn()}${kit ? imageDirectiveSuffix(kit) : ""}`;
    const gen = await generateImagen(prompt, "4:3");
    const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
    if (m) {
      writeFileSync(path.join(UT, `system-${f.slug}.png`), Buffer.from(m[2], "base64"));
      console.log(`  bild: scripts/_bild11/system-${f.slug}.png`);
    } else {
      kontroll(false, `bilden kunde inte genereras: ${gen.error}`);
    }
  }
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLLER RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
