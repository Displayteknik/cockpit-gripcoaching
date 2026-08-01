// Reels Creator — manusmotorn (R1). Idé + mall → storyboard + caption. SERVER ONLY.
// Datamodellen och mallarna ligger i lib/studio/reels.ts (klientsäker).
//
// KÄRNPRINCIP (samma som resten av Studio): AI skriver TEXT och bildbeskrivningar,
// aldrig layout eller tajming. Scenernas antal, ordning, längd och övergångar kommer
// från mallen — modellen får bara fylla i orden. Då kan en slarvig generering aldrig
// ge en reel som är 47 sekunder lång eller har sju scener.
//
// Promptlagren byggs av lib/prompt-core (TEXT-1 T-3): uppdraget här är scen-/overlay-/
// bild-/caption-/ärlighetsreglerna, kärnan lägger hook-playbook, varumärkesprofil, röst,
// winning examples, anatomi + Compass (mallens funnel/4A + opts.disc), kit-donts,
// skrivregler och JSON-schemat SIST. Kit-direktiven hämtas lokalt enbart för BILDDELEN
// (imageNegative) — donts-raden ägs av kärnans lager 7.

import { generate } from "@/lib/gemini";
import { byggTextPrompt } from "@/lib/prompt-core";
import { getKitDirectives, NEUTRAL_DIRECTIVES } from "@/lib/studio/kit";
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
  type ReelTemplate,
} from "@/lib/studio/reels";

interface RawScene { line1: string; line2: string; imagePrompt: string }

// Bygger reel-systemprompten via prompt-core. Exporterad separat så paritetstestet
// (tests/reels-prompt-paritet.test.ts) kan verifiera att alla innehållsblock finns kvar
// utan att köra genereringsloopen.
export async function byggReelPrompt(opts: ReelGenOpts): Promise<{ system: string; mall: ReelTemplate }> {
  const mall = REEL_TEMPLATES[opts.templateKey];
  if (!mall) throw new Error(`Okänd mall: ${opts.templateKey}`);

  // Kit-direktiven behövs lokalt BARA för bilddelen (imageNegative styr motiven).
  // Donts-raden (text/ton) läggs av kärnans lager 7 — inte här, annars dubblett.
  const directives = await getKitDirectives(opts.clientId).catch(() => NEUTRAL_DIRECTIVES);

  const scenSpec = mall.scenes
    .map((s, i) => `${i + 1}. ${s.kind} (${(s.durationMs / 1000).toFixed(1)} sek): ${s.roll}`)
    .join("\n");

  const uppdrag = [
    "Du skriver manus till korta vertikala videor (reels) på svenska för sociala medier.",
    "Du skriver ORD och BILDBESKRIVNINGAR. Du bestämmer aldrig antal scener, scenlängder eller övergångar.",
    "Hook-playbooken nedan använder du för scen 1.",
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
    "- ★ MOTIVET MÅSTE STÄMMA MED SCENENS TEXT. Säger texten att butiken har öppet ska bilden",
    "  visa en öppen butik mitt på dagen, aldrig en stängd butik på natten. Säger texten att något",
    "  är tråkigt eller dött ska det synas i miljön, inte i mörkret. Läs din egen line1 och line2",
    "  och fråga: skulle en tittare förstå texten om den bara såg den här bilden?",
    "- ★ Beskriv ALDRIG ljussättning, färgton, kontrast eller filmisk stil. Kundens signaturstil",
    "  läggs på automatiskt efteråt och krockar med din beskrivning om du också gör det.",
    "  Skriv VAD som syns och vilken tid på dygnet budskapet kräver. Inte hur det ska se ut.",
    directives.imageNegative ? `- Undvik i motivet: ${directives.imageNegative}` : "",
    "\n=== CAPTION (texten under inlägget, inte i videon) ===",
    "- Tre till sex korta rader. Krok först, exakt EN uppmaning sist.",
    "- Max fem relevanta hashtags, på egen rad sist.",
    "\n=== ÄRLIGHET ===",
    "- Hitta ALDRIG på priser, siffror, kundnamn eller resultat. Saknas uppgiften: skriv en platshållare inom hakparenteser.",
  ]
    .filter(Boolean)
    .join("\n");

  const b = await byggTextPrompt({
    // Explicit klient: manusmotorn VET vilken kund den skriver för. Utan argument
    // hade ett anrop utan sessionskontext tyst fått standardklientens röst.
    clientId: opts.clientId,
    syfte: "reel",
    uppdrag,
    knowledge: ["hook-playbook"],
    // Mallens funnel/4A är flödesdata; DISC kommer från anroparen.
    compass: { funnel: mall.funnel, four_a: mall.fourA, disc: opts.disc || [] },
    // KVALITET-3/punkt 5: prisregeln gäller även reels. Två vägar till undantaget:
    // ägarens egen idétext (skrev hen in ett pris är det hens beslut) och mallen
    // "Pris rakt ut", som användaren väljer aktivt och vars fakta-scen ÄR priset.
    // Övriga mallar får inget undantag — värdet beskrivs, priset tas i samtalet.
    anvandarText: String(opts.ide || ""),
    prisTillatet: mall.key === "pris",
    jsonSchema: `{"title":"kort intern titel","caption":"...","scenes":[${mall.scenes.map(() => '{"line1":"...","line2":"...","imagePrompt":"..."}').join(",")}]}`,
  });

  return { system: b.system, mall };
}

export async function generateReelStoryboard(opts: ReelGenOpts): Promise<ReelStoryboard> {
  const ide = String(opts.ide || "").trim();
  if (!ide) throw new Error("Skriv en idé först");

  const { system, mall } = await byggReelPrompt(opts);

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
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
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
