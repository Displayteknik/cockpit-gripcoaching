// Reels Creator — manusmotorn (R1). Idé + mall → storyboard + caption. SERVER ONLY.
// Datamodellen och mallarna ligger i lib/studio/reels.ts (klientsäker).
//
// KÄRNPRINCIP (samma som resten av Studio): AI skriver TEXT och bildbeskrivningar,
// aldrig layout eller tajming. Scenernas antal, ordning, längd och övergångar kommer
// från mallen — modellen får bara fylla i orden. Då kan en slarvig generering aldrig
// ge en reel som är 47 sekunder lång eller har sju scener.
//
// Promptlagren vävs in EXPLICIT här: röst → hook-playbook → contentCompassBlock
// (anatomi, funnel, 4A, DISC och de globala skrivreglerna sist) → mallens scenkrav.
// Se lib/iterate.ts:21 för motsatsen: där deklarerades fältet contentCompass men
// sattes aldrig av någon anropare, så Compass-lagren nådde aldrig prompten.

import { generate } from "@/lib/gemini";
import { getKnowledge, getProfileAsMarkdown } from "@/lib/knowledge";
import { getKitDirectives, dontsRule } from "@/lib/studio/kit";
import { contentCompassBlock } from "@/lib/content-compass/prompt";
import { sanitizeGenerated, skrivreglerPa } from "@/lib/content/writing-rules";
import {
  MAX_REEL_MS,
  MAX_WORDS_PER_LINE,
  REEL_TEMPLATES,
  defaultKenBurns,
  kapaOrd,
  ordCount,
  reelDurationMs,
  type ReelGenOpts,
  type ReelScene,
  type ReelStoryboard,
} from "@/lib/studio/reels";

interface RawScene { line1: string; line2: string; imagePrompt: string }

export async function generateReelStoryboard(opts: ReelGenOpts): Promise<ReelStoryboard> {
  const mall = REEL_TEMPLATES[opts.templateKey];
  if (!mall) throw new Error(`Okänd mall: ${opts.templateKey}`);

  const ide = String(opts.ide || "").trim();
  if (!ide) throw new Error("Skriv en idé först");

  const [playbook, profile, directives] = await Promise.all([
    getKnowledge("hook-playbook").catch(() => ""),
    // Explicit klient: manusmotorn VET vilken kund den skriver för. Utan argument
    // hade ett anrop utan sessionskontext tyst fått standardklientens röst.
    getProfileAsMarkdown(opts.clientId).catch(() => ""),
    getKitDirectives(opts.clientId).catch(() => ({ imageExtra: "", imageNegative: "", donts: [] as string[], colors: {}, formats: [] as string[] })),
  ]);

  // Lager 2 till 6: anatomi, funnel, 4A, DISC och de globala skrivreglerna sist.
  const compass = contentCompassBlock({ funnel: mall.funnel, four_a: mall.fourA, disc: opts.disc || [] });

  const scenSpec = mall.scenes
    .map((s, i) => `${i + 1}. ${s.kind} (${(s.durationMs / 1000).toFixed(1)} sek): ${s.roll}`)
    .join("\n");

  const system = [
    "Du skriver manus till korta vertikala videor (reels) på svenska för sociala medier.",
    "Du skriver ORD och BILDBESKRIVNINGAR. Du bestämmer aldrig antal scener, scenlängder eller övergångar.",
    playbook ? `\n=== HOOK-PLAYBOOK (använd för scen 1) ===\n${playbook.slice(0, 2500)}` : "",
    profile ? `\n=== VARUMÄRKESPROFIL — grunda röst, målgrupp, tjänster och ord HÅRT på denna ===\n${profile.slice(0, 6500)}` : "",
    compass ? `\n${compass}` : "",
    `\n=== SCENSTRUKTUR FÖR MALLEN "${mall.name}" (LÅST: exakt ${mall.scenes.length} scener, i denna ordning) ===`,
    scenSpec,
    "\n=== OVERLAY-TEXT (orden som bränns in i videon) ===",
    "- line1 = scenens huvudbudskap. line2 = kort stödrad, eller tom sträng om den inte behövs.",
    `- MAX ${MAX_WORDS_PER_LINE} ord per rad. Kortare är bättre: en tittare hinner läsa fyra till sex ord.`,
    "- Inga hashtags, inga emoji, inga citattecken och inga tankstreck i overlay-text.",
    "- Skriv som en människa talar, inte rubriksvenska. Svenska tecken å, ä och ö korrekt.",
    "- Varje scen ska föra berättelsen framåt. Upprepa aldrig samma budskap i två scener.",
    "\n=== BILDBESKRIVNING (imagePrompt, en per scen) ===",
    "- Skriv på ENGELSKA. Den används både för AI-bildgenerering och för fotosök.",
    "- Beskriv ett STÅENDE motiv i 9:16, vertical composition, med lugnt utrymme i mitten där texten ska ligga.",
    "- Fotografiskt och verkligt. Inga texter, inga logotyper och inga skyltar med ord i bilden.",
    directives.imageExtra ? `- Kundens bildstil: ${directives.imageExtra}` : "",
    directives.imageNegative ? `- Undvik i bilden: ${directives.imageNegative}` : "",
    "\n=== CAPTION (texten under inlägget, inte i videon) ===",
    "- Tre till sex korta rader. Krok först, exakt EN uppmaning sist.",
    "- Max fem relevanta hashtags, på egen rad sist.",
    "\n=== ÄRLIGHET ===",
    "- Hitta ALDRIG på priser, siffror, kundnamn eller resultat. Saknas uppgiften: skriv en platshållare inom hakparenteser.",
    dontsRule(directives.donts),
    "\n=== SVAR: ENDAST strikt JSON, inga kodstaket ===",
    `{"title":"kort intern titel","caption":"...","scenes":[${mall.scenes.map(() => '{"line1":"...","line2":"...","imagePrompt":"..."}').join(",")}]}`,
  ]
    .filter(Boolean)
    .join("\n");

  let feedback = "";
  let raw: RawScene[] = [];
  let title = "";
  let caption = "";
  const varningar: string[] = [];

  // Upp till tre försök. Modellen kan slarva med ordgränsen; loopen ger den chansen
  // att rätta sig innan vi kapar deterministiskt. Samma mönster som suggest-caption.
  for (let forsok = 1; forsok <= 3; forsok++) {
    const prompt = [
      `Idé från ägaren: ${ide}`,
      `Skriv manuset för mallen "${mall.name}" nu. Exakt ${mall.scenes.length} scener.`,
      feedback,
    ]
      .filter(Boolean)
      .join("\n\n");

    const svar = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: system,
      prompt,
      temperature: 0.85,
      maxOutputTokens: 3000,
      jsonMode: true,
    });

    const obj = tolkaJson<{ title?: unknown; caption?: unknown; scenes?: unknown }>(svar);
    const scenes = Array.isArray(obj?.scenes) ? (obj.scenes as Record<string, unknown>[]) : [];

    if (scenes.length !== mall.scenes.length) {
      if (forsok === 3) throw new Error(`Modellen gav ${scenes.length} scener, mallen kräver ${mall.scenes.length}`);
      feedback = `Förra svaret hade ${scenes.length} scener. Mallen kräver exakt ${mall.scenes.length}. Gör om.`;
      continue;
    }

    raw = scenes.map((s) => ({ line1: str(s.line1), line2: str(s.line2), imagePrompt: str(s.imagePrompt) }));
    title = str(obj?.title) || ide.slice(0, 60);
    caption = str(obj?.caption);

    const forLanga = raw.flatMap((s, i) =>
      [
        ordCount(s.line1) > MAX_WORDS_PER_LINE ? `scen ${i + 1} rad 1 (${ordCount(s.line1)} ord)` : "",
        ordCount(s.line2) > MAX_WORDS_PER_LINE ? `scen ${i + 1} rad 2 (${ordCount(s.line2)} ord)` : "",
      ].filter(Boolean),
    );

    if (forLanga.length === 0) break;

    if (forsok === 3) {
      varningar.push(`Kapade text som var för lång efter tre försök: ${forLanga.join(", ")}.`);
      raw = raw.map((s) => ({ ...s, line1: kapaOrd(s.line1), line2: kapaOrd(s.line2) }));
      break;
    }
    feedback = `Förra svaret bröt mot ordgränsen: ${forLanga.join(", ")}. Skriv om de raderna med max ${MAX_WORDS_PER_LINE} ord.`;
  }

  // Saneringslagret: deterministiskt skyddsnät ovanpå promptreglerna.
  const pa = await skrivreglerPa(opts.clientId);
  const stada = (t: string, hashtags: boolean) => (pa ? sanitizeGenerated(t, { kanal: "instagram", hashtags }) : t);

  const scenes: ReelScene[] = mall.scenes.map((spec, i) => ({
    kind: spec.kind,
    overlay: {
      line1: stada(raw[i]?.line1 || "", false).trim(),
      line2: stada(raw[i]?.line2 || "", false).trim(),
    },
    mediaUrl: "",
    mediaKind: "image",
    source: "",
    imagePrompt: raw[i]?.imagePrompt || "",
    durationMs: spec.durationMs,
    transition: spec.transition,
    kenBurns: defaultKenBurns(i),
    trimStartMs: 0,
  }));

  const durationMs = reelDurationMs(mall);
  if (durationMs > MAX_REEL_MS) varningar.push(`Mallen är ${(durationMs / 1000).toFixed(1)} sek, taket är ${MAX_REEL_MS / 1000} sek.`);

  return {
    templateKey: mall.key,
    templateName: mall.name,
    title,
    scenes,
    caption: stada(caption, true).trim(),
    durationMs,
    aiBekraftelseKravs: mall.kraverAktBekraftelse,
    varningar,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Tolerant JSON-tolkning. jsonMode är oftast rent, men modellen kan lägga på kodstaket
// eller ett släpande komma. Samma reparationsmönster som veckogenereringen.
function tolkaJson<T>(raw: string): T {
  const rensad = String(raw || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const kandidat = rensad.startsWith("{") ? rensad : (rensad.match(/\{[\s\S]*\}/)?.[0] ?? rensad);
  try {
    return JSON.parse(kandidat) as T;
  } catch {
    const fixad = kandidat.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(fixad) as T;
  }
}
