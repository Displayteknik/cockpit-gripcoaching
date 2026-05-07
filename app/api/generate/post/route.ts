import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";
import { getWinningPatterns, patternsToPromptBlock } from "@/lib/insights";
import {
  WEEK_ROLES,
  DISC_GUIDE,
  FOURA_GUIDE,
  FUNNEL_GUIDE,
  KANE_HOOK_RULES,
  FORMAT_LABELS,
  type FourA,
  type Disc,
  type Funnel,
  type Format,
} from "@/lib/content-framework";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PostInput {
  // Vad inlägget handlar om
  topic: string;
  // Valfri vinkel
  angle?: string;
  // 4A × DISC × Funnel — om dayIndex anges plockas från WEEK_ROLES
  dayIndex?: number;
  fourA?: FourA;
  disc?: Disc;
  funnel?: Funnel;
  // Format
  format: Format;
  // Plattform
  platform?: "instagram" | "facebook";
}

interface Variant {
  tier: "gold" | "silver" | "bronze";
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  hook_format: string; // t.ex. "question", "statistic"
  notes: string; // varför det här fungerar
}

interface GenerateResponse {
  variants: Variant[];
  context: {
    fourA: FourA;
    disc: Disc;
    funnel: Funnel;
    format: Format;
    voice_source_count: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const input = (await req.json()) as PostInput;

    if (!input.topic || input.topic.trim().length < 5) {
      return NextResponse.json({ error: "Ämne krävs (minst 5 tecken)" }, { status: 400 });
    }
    if (!input.format) {
      return NextResponse.json({ error: "Format krävs" }, { status: 400 });
    }

    // Bestäm 4A/DISC/Funnel
    let fourA: FourA, disc: Disc, funnel: Funnel, intent: string;
    if (typeof input.dayIndex === "number") {
      const role = WEEK_ROLES[((input.dayIndex % 7) + 7) % 7];
      fourA = role.fourA;
      disc = role.disc;
      funnel = role.funnel;
      intent = role.intent;
    } else {
      fourA = input.fourA || "actionable";
      disc = input.disc || "I";
      funnel = input.funnel || "TOFU";
      intent = "Anpassa till mål, ICP och funnel-läge.";
    }

    // Hämta brand-profil
    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Brand-profil saknas — fyll i den först" }, { status: 400 });
    }

    // Hämta voice fingerprint + vinnar-mönster
    const fp = await getVoiceFingerprint(clientId);
    const winning = await getWinningPatterns(clientId).catch(() => null);

    const platform = input.platform || "instagram";
    const formatLabel = FORMAT_LABELS[input.format];

    // Bygg system-prompt
    const system = buildSystemPrompt({
      profile,
      fp,
      winning,
      fourA,
      disc,
      funnel,
      intent,
      format: input.format,
      formatLabel,
      platform,
    });

    const userPrompt = `Ämne/vinkel: ${input.topic}
${input.angle ? `Specifik vinkel: ${input.angle}\n` : ""}
Producera EXAKT 3 varianter i JSON-formatet specificerat. Inget annat.`;

    let raw = "";
    try {
      raw = await generate({
        model: "gemini-2.5-pro",
        systemInstruction: system,
        prompt: userPrompt,
        temperature: 0.9,
        maxOutputTokens: 4500,
        jsonMode: true,
      });
    } catch (e) {
      return NextResponse.json({ error: `AI-fel: ${(e as Error).message}` }, { status: 500 });
    }

    let parsed: { variants?: Variant[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed.variants || parsed.variants.length === 0) {
      return NextResponse.json({ error: "AI returnerade inga varianter" }, { status: 500 });
    }

    // Säkerställ exakt 3 + tier-taggar + normalisera body till string
    const tiers: ("gold" | "silver" | "bronze")[] = ["gold", "silver", "bronze"];
    const toStr = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.map(toStr).join("\n\n");
      if (v && typeof v === "object") return JSON.stringify(v);
      return v == null ? "" : String(v);
    };
    /**
     * Saneringsfilter:
     * - Strippar etiketter ("Hook:", "Body:", "CTA:", "Format note:", "Hashtags:")
     * - Strippar emoji-prefix ("🎣 Trött på..." → "Trött på...")
     * - Strippar hashtag-block i slutet av body
     */
    const stripLabels = (s: string): string => {
      let t = s.trim();
      // Ta bort prefix-etikett om hela fältet börjar med det
      t = t.replace(/^\s*(?:HOOK|Hook|hook|BODY|Body|body|CAPTION|Caption|caption|CTA|Cta|cta|HASHTAGS?|Hashtags?|hashtags?|FORMAT[\s_]?NOTE?|Format[\s_]?Note?|format[\s_]?note?|NOTES?|Notes?|notes?|VARIANT|Variant|variant)\s*[:\-–—]\s*/i, "");
      // Ta bort etiketter på egen rad mitt i texten
      t = t.replace(/^\s*(?:HOOK|BODY|CAPTION|CTA|HASHTAGS|FORMAT[\s_]NOTE|NOTES)\s*[:\-–—].*$/gim, "");
      // Ta bort emoji-prefix i början av hooken (🎣, 🚨, 💡 etc) — Ingela skriver inte så
      t = t.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, "");
      // Komprimera flera blank-rader till max 2
      t = t.replace(/\n{3,}/g, "\n\n").trim();
      return t;
    };
    /**
     * Strippar bort hashtag-block från body. AI:n stoppar ibland in
     * hashtags på sista raden av body — UI:t lägger till dem separat
     * från hashtags-arrayen, vilket dubblerar dem.
     */
    const stripHashtagBlock = (s: string): string => {
      let t = s.trim();
      // Ta bort sista raden om den bara innehåller hashtags
      t = t.replace(/\n+\s*(?:#\S+\s*){2,}\s*$/g, "");
      // Och eventuellt en rad innan med samma mönster
      t = t.replace(/\n+\s*(?:#\S+\s*){2,}\s*$/g, "");
      return t.trim();
    };
    /**
     * Hård regex-fångare av "handla om"-förbjudna fraser. Om de smiter
     * förbi promptens varning så ersätts de mekaniskt med en neutral
     * formulering. Bättre torrt än "handlar om".
     */
    const HANDLA_OM_PATTERNS: { re: RegExp; replace: string }[] = [
      { re: /\bdet handlar om\b/gi, replace: "det här är" },
      { re: /\bdet handlade om\b/gi, replace: "det var" },
      { re: /\bdet handlat om\b/gi, replace: "det varit" },
      { re: /\bhandlar om\b/gi, replace: "är" },
      { re: /\bhandlade om\b/gi, replace: "var" },
      { re: /\bhandlat om\b/gi, replace: "varit" },
    ];
    const stripForbidden = (s: string): string => {
      let t = s;
      for (const p of HANDLA_OM_PATTERNS) t = t.replace(p.re, p.replace);
      return t;
    };
    const variants: Variant[] = parsed.variants.slice(0, 3).map((v, i) => ({
      tier: tiers[i] || "bronze",
      hook: stripForbidden(stripLabels(toStr(v.hook))),
      body: stripForbidden(stripHashtagBlock(stripLabels(toStr(v.body)))),
      cta: stripForbidden(stripLabels(toStr(v.cta))),
      hashtags: Array.isArray(v.hashtags) ? v.hashtags.map((h) => String(h).replace(/^#/, "")) : [],
      hook_format: toStr(v.hook_format),
      notes: toStr(v.notes),
    }));

    const response: GenerateResponse = {
      variants,
      context: {
        fourA,
        disc,
        funnel,
        format: input.format,
        voice_source_count: fp.source_asset_count,
      },
    };

    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function buildSystemPrompt(args: {
  profile: Record<string, unknown>;
  fp: Awaited<ReturnType<typeof getVoiceFingerprint>>;
  winning: Awaited<ReturnType<typeof getWinningPatterns>> | null;
  fourA: FourA;
  disc: Disc;
  funnel: Funnel;
  intent: string;
  format: Format;
  formatLabel: string;
  platform: string;
}): string {
  const p = args.profile;
  const voiceBlock = fingerprintToPromptBlock(args.fp);
  const winningBlock = args.winning ? patternsToPromptBlock(args.winning) : "";

  return `Du är världsklass copywriter för svenska solo-företagare. Du skriver innehåll som STOPPAR scrollen och konverterar — utan att låta som en mall eller som AI.

═══ KUND ═══
Företag: ${p.company_name || "(saknas)"}
Plats: ${p.location || "(saknas)"}
Grundare: ${p.founder_name || "(saknas)"}
Brand story: ${p.brand_story || "(saknas)"}
USP: ${p.usp || "(saknas)"}
Differentiatorer: ${p.differentiators || "(saknas)"}
ICP primär: ${p.icp_primary || "(saknas)"}
Smärtpunkter: ${p.pain_points || "(saknas)"}
Tjänster: ${p.services || "(saknas)"}
Bokningslänk: ${p.booking_url || "(saknas)"}

═══ VECKO-ROLL ═══
4A: ${args.fourA.toUpperCase()} — ${FOURA_GUIDE[args.fourA]}
DISC: ${args.disc} — ${DISC_GUIDE[args.disc]}
Funnel-läge: ${args.funnel} — ${FUNNEL_GUIDE[args.funnel]}
Intent: ${args.intent}

═══ FORMAT ═══
${args.formatLabel} (${args.platform})

═══ HOOK-REGLER (Brendan Kane) ═══
${KANE_HOOK_RULES}

${voiceBlock}

${winningBlock}

═══ KVALITETSKRAV ═══
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "nästa nivå", "skalbar", "holistisk"
- ALDRIG någon form av "handla om" — varken "handlar om", "handlade om", "handlat om", "det handlar om", "det handlade om". INGA TEMPUS. Skriv om till konkret formulering: istället för "Det handlade om hennes samsyn" skriv "Det var hennes samsyn som var problemet" eller "Hennes samsyn var nyckeln" eller "Det visade sig vara samsynen".
- Skriv som personen själv hade skrivit. Korta meningar. Talspråk OK om personens röst är talspråklig.
- Hooken är ALLT — om hooken är generisk är inlägget värdelöst.
- CTA ska vara EN sak att göra, ingen "boka, mejla, eller följ".
- Hashtags: 5-12 relevanta, blanda nischade och bredare. Inga dussinhashtags.

═══ KRITISKT: TEXT-FORMAT ═══
- Skriv ALDRIG strukturella etiketter inuti fält-värdena. Skriv ALDRIG "Hook:", "Body:", "Caption:", "CTA:", "Hashtags:", "Format note:" eller liknande prefix.
- "hook"-fältet ska vara ENBART hook-texten — som den ska postas. Ingen rubrik, ingen förklaring. INGEN emoji-prefix (🎣, 🚨, 💡 etc) — varken i början eller slutet av hooken.
- "body"-fältet ska vara ENBART brödtexten som den ska klistras in på Instagram. Ingen rubrik före, ingen meta-info. INGA hashtags i body — hashtags hör hemma i hashtags-arrayen.
- "cta"-fältet ska vara ENBART en CTA-mening. Ingen prefix.
- "hashtags"-arrayen är ENBART hashtags utan #-tecken (vi lägger till # själva).
- Allt ska vara copy-paste-färdigt direkt utan att användaren behöver redigera bort etiketter.

═══ OUTPUT-SCHEMA (JSON, exakt struktur) ═══
{
  "variants": [
    {
      "hook": "Hook variant 1 — Gold (säkrast, mest beprövad)",
      "body": "Brödtexten — ${args.format === "carousel" ? "5-7 stycken där varje kan vara en slide" : args.format === "reel" ? "videoscript med scen-anvisningar i [hakparentes]" : "kort caption på 100-200 ord"}",
      "cta": "EN tydlig nästa-handling",
      "hashtags": ["hashtag1", "hashtag2"],
      "hook_format": "question|contrast|statistic|story|bold_claim|curiosity|before_after",
      "notes": "Varför denna variant fungerar för ${args.disc}-personlighet i ${args.funnel}-läge"
    },
    { ... Silver — djärvare, högre risk högre reward ... },
    { ... Bronze — mest experimentell, kontrast till de andra två ... }
  ]
}

VIKTIGT: De tre varianterna ska skilja sig STORT från varandra — olika hook-format, olika känsla, olika vinkel på samma ämne. Det är A/B-testning, inte tre versioner av samma idé.`;
}
