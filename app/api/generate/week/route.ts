import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate, generateWithUsage } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";
import {
  WEEK_ROLES,
  DISC_GUIDE,
  FOURA_GUIDE,
  FUNNEL_GUIDE,
  KANE_HOOK_RULES,
  FORMAT_LABELS,
  type Format,
} from "@/lib/content-framework";
import { getCompassSchedule } from "@/lib/content-compass/schedule";
import { planWeek } from "@/lib/content-compass/rules";
import { contentCompassBlock } from "@/lib/content-compass/prompt";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hasModule } from "@/lib/entitlements";
import { sanitizeGenerated, skrivreglerPa } from "@/lib/content/writing-rules";

export const runtime = "nodejs";
export const maxDuration = 240;

interface DayPlan {
  day: string;
  fourA: string;
  disc: string;
  funnel: string;
  format: Format;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

// POST /api/generate/week
// { theme: string, week_starts?: ISO-date, formats?: { [day: string]: Format } }
export async function POST(req: NextRequest) {
  try {
    // Både admin-dashboarden (veckoplan) och kundportalen (/k/kalender) anropar denna.
    // Grinden sker här (proxy släpper igenom kund-betjänade rutter). Tenant-låst nedan.
    const denied = await requireAdminOrCustomer();
    if (denied) return denied;

    const clientId = await getActiveClientId();
    const body = await req.json();
    const theme = String(body.theme || "").trim();
    if (!theme || theme.length < 5) {
      return NextResponse.json({ error: "Veckotema krävs (minst 5 tecken)" }, { status: 400 });
    }

    // CC-4: "Skapa veckans innehåll" — profilerar hela veckan enligt tenantens
    // Content Compass-schema, sparar som utkast i kalendern med bästa-tid. Den
    // befintliga veckoplan-vägen (utan body.compass) är helt orörd nedan.
    // Grindas dessutom på compass-modulen (skydd även om UI:t skulle slinka förbi).
    if (body.compass) {
      if (!(await hasModule(clientId, "compass").catch(() => false))) {
        return NextResponse.json({ error: "Content Compass ingår inte i ditt paket" }, { status: 403 });
      }
      return await generateCompassWeek(clientId, theme);
    }

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("client_id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Brand-profil saknas" }, { status: 400 });
    }

    // Bygg en kombinerad prompt som genererar 7 inlägg i en JSON-call
    const dayLines = WEEK_ROLES.map((role, i) => {
      const overrideFormat = body.formats?.[role.day] as Format | undefined;
      const format = overrideFormat || role.recommended_formats[0];
      return `Dag ${i + 1} (${role.day}): 4A=${role.fourA}, DISC=${role.disc}, Funnel=${role.funnel}, Format=${FORMAT_LABELS[format]} (${format}). Intent: ${role.intent}`;
    }).join("\n");

    // TEXT-1 T-2: prompten byggs av prompt-core — KUND-blocket (råfält) är ersatt av
    // kärnans brand-profil-lager, rösten/winning/skrivreglerna ägs av kärnan. Uppdraget =
    // WEEK_ROLES + 4A/DISC/Funnel-guiderna + Kane-hookreglerna + kvalitetskraven.
    const uppdrag = `Du är världsklass copywriter. Du genererar 7 inlägg för en hel vecka — ETT inlägg per dag enligt veckorytmen. Varje dag har sin egen roll i 4A × DISC × Funnel.

═══ VECKO-ROLLER ═══
${dayLines}

4A-guide:
${Object.entries(FOURA_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

DISC-guide:
${Object.entries(DISC_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

Funnel-guide:
${Object.entries(FUNNEL_GUIDE).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

═══ HOOK-REGLER ═══
${KANE_HOOK_RULES}

═══ KVALITETSKRAV ═══
- Veckan ska ha PROGRESSION — söndag ska kännas annorlunda från måndag
- Variera HOOK-FORMAT över veckan: fråga, statistik, kontrast, story, påstående
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "skalbar"
- Skriv på svenska som personen själv hade skrivit
- Varje CTA är EN sak att göra — varierande över veckan`;

    const jsonSchema = `{
  "days": [
    {
      "day": "Måndag",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "hashtags": ["..."]
    },
    ... 7 dagar totalt, i ordning Måndag→Söndag
  ]
}`;

    const bygg = await byggTextPrompt({
      clientId,
      syfte: "veckoplan",
      uppdrag,
      underlag: `Veckotema: ${theme}

Producera 7 inlägg som tillsammans tar målgruppen från medvetenhet till handling över veckan. Varje inlägg står på egna ben men de ska kännas som en serie. Returnera enbart JSON.`,
      jsonSchema,
    });

    const raw = await generate({
      model: "gemini-2.5-pro",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      temperature: 0.85,
      maxOutputTokens: 8000,
      jsonMode: true,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });

    let parsed: { days?: { day: string; hook: string; body: unknown; cta: string; hashtags: string[] }[] } = {};
    try {
      parsed = tolkaJson(raw);
    } catch {
      return NextResponse.json({ error: "Kunde inte tolka veckans innehåll. Prova att generera igen." }, { status: 502 });
    }

    if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      return NextResponse.json({ error: "AI returnerade inga dagar" }, { status: 500 });
    }

    const toStr = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (Array.isArray(v)) return v.map(toStr).join("\n\n");
      if (v && typeof v === "object") return JSON.stringify(v);
      return v == null ? "" : String(v);
    };

    const days: DayPlan[] = WEEK_ROLES.map((role, i) => {
      const aiDay = parsed.days![i] || ({} as { hook?: string; body?: unknown; cta?: string; hashtags?: string[] });
      const overrideFormat = body.formats?.[role.day] as Format | undefined;
      const format = overrideFormat || role.recommended_formats[0];
      return {
        day: role.day,
        fourA: role.fourA,
        disc: role.disc,
        funnel: role.funnel,
        format,
        hook: toStr(aiDay.hook),
        body: toStr(aiDay.body),
        cta: toStr(aiDay.cta),
        hashtags: Array.isArray(aiDay.hashtags) ? aiDay.hashtags.map((h) => String(h).replace(/^#/, "")) : [],
      };
    });

    // TEXT-1: enhetlig sanering via saneraText (flaggan avgörs i prompt-core).
    // Hashtag-taket på arrayen gäller bara när skrivreglerna är på (samma som förut).
    await Promise.all(
      days.map(async (d) => {
        [d.hook, d.body, d.cta] = await Promise.all([
          saneraText(d.hook, clientId),
          saneraText(d.body, clientId),
          saneraText(d.cta, clientId),
        ]);
      }),
    );
    if (await skrivreglerPa(clientId)) {
      for (const d of days) d.hashtags = d.hashtags.slice(0, 5);
    }

    // Auto voice-score varje dag — användaren ser score per inlägg.
    let scoredDays = days;
    try {
      const { scoreText } = await import("@/lib/voice-enforce");
      scoredDays = await Promise.all(days.map(async (d) => {
        const full = [d.hook, d.body, d.cta].filter(Boolean).join("\n\n");
        try {
          const s = await scoreText(full, clientId, "social");
          return { ...d, voice_score: s.total, voice_verdict: (s.total >= 70 ? "pass" : s.total >= 55 ? "warn" : "block") };
        } catch { return d; }
      }));
    } catch {}

    return NextResponse.json({
      theme,
      voice_source_count: bygg.fingerprint?.source_asset_count ?? 0,
      days: scoredDays,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── CC-4: Skapa veckans innehåll ──────────────────────────────────────────────
// Läser tenantens Compass-schema, planerar en giltig vecka (kadens + hårda regler),
// genererar alla inlägg i EN token-effektiv call med Compass-blocket per dag, och
// sparar dem som utkast i kalendern med föreslagen bästa-tid. Inget publiceras.
async function generateCompassWeek(clientId: string, theme: string) {
  const sb = supabaseService();
  const { data: profile } = await sb
    .from("hm_brand_profile")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Brand-profil saknas" }, { status: 400 });

  const schedule = await getCompassSchedule(clientId);
  const { posts, notes } = planWeek(schedule);
  if (!posts.length) return NextResponse.json({ error: "Schemat har inga aktiva dagar" }, { status: 400 });

  const fp = await getVoiceFingerprint(clientId);
  const voiceBlock = fingerprintToPromptBlock(fp);

  // Ett block per planerad dag: dagens Compass-profil styr ton, form och CTA.
  const dayBlocks = posts
    .map((p, i) => {
      const dateLabel = new Date(p.date).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
      const compass = contentCompassBlock({ funnel: p.funnel, four_a: p.four_a, disc: p.disc });
      return `── INLÄGG ${i + 1} (${p.dayLabel}, ${dateLabel}) ──\n${compass}`;
    })
    .join("\n\n");

  const system = `Du är världsklass copywriter. Du skriver en hel veckas innehåll enligt kundens Content Compass. Varje inlägg har sin egen roll (funnel, 4A, DISC) och sin egen anatomi nedan. Följ anatomin för varje inlägg exakt.

═══ KUND ═══
Företag: ${profile.company_name || "(saknas)"}
Plats: ${profile.location || "(saknas)"}
USP: ${profile.usp || "(saknas)"}
Differentiatorer: ${profile.differentiators || "(saknas)"}
ICP primär: ${profile.icp_primary || "(saknas)"}
Smärtpunkter: ${profile.pain_points || "(saknas)"}
Tjänster: ${profile.services || "(saknas)"}
Bokningslänk: ${profile.booking_url || "(saknas)"}

═══ VECKANS INLÄGG (följ Compass-blocket för varje) ═══
${dayBlocks}

═══ HOOK-REGLER ═══
${KANE_HOOK_RULES}

${voiceBlock}

═══ KVALITETSKRAV ═══
- Veckan ska ha progression och kännas som en serie, inte lösryckta inlägg.
- Varje inlägg: en tydlig hook, känsla och igenkänning, kundens resultat, exakt EN CTA som matchar funnel-nivån.
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "skalbar", "holistisk".
- Skriv på svenska som personen själv hade skrivit.

═══ OUTPUT JSON ═══
{
  "days": [
    { "hook": "...", "body": "...", "cta": "...", "hashtags": ["..."] }
  ]
}
Exakt ${posts.length} inlägg i "days", i samma ordning som INLÄGG 1..${posts.length} ovan.`;

  const userPrompt = `Veckotema: ${theme}\n\nSkriv ${posts.length} inlägg som tillsammans tar målgruppen från medvetenhet till handling. Returnera enbart JSON.`;

  const { text: raw, usage } = await generateWithUsage({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt: userPrompt,
    temperature: 0.85,
    maxOutputTokens: 8000,
    jsonMode: true,
  });

  let parsed: { days?: { hook?: string; body?: unknown; cta?: string; hashtags?: unknown }[] } = {};
  try {
    parsed = tolkaJson(raw);
  } catch {
    return NextResponse.json({ error: "Kunde inte tolka veckans innehåll. Prova att generera igen." }, { status: 502 });
  }
  if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
    return NextResponse.json({ error: "AI returnerade inga inlägg" }, { status: 500 });
  }

  const toStr = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map(toStr).join("\n\n");
    if (v && typeof v === "object") return JSON.stringify(v);
    return v == null ? "" : String(v);
  };
  const firstLine = (s: string) => (s.split("\n")[0] || "").slice(0, 120).trim() || "Veckoinlägg";

  // Spara varje planerad dag som ett utkast (studio_posts) med Compass-metadata + bästa-tid.
  const nowIso = new Date().toISOString();
  const rows = posts.map((p, i) => {
    const ai = parsed.days![i] || {};
    const hook = toStr(ai.hook);
    const bodyTxt = toStr(ai.body);
    const cta = toStr(ai.cta);
    const hashtags = Array.isArray(ai.hashtags) ? ai.hashtags.map((h) => String(h).replace(/^#/, "")) : [];
    // Skyddsnät: skrivreglerna gäller även den färdigprofilerade veckan.
    const caption = sanitizeGenerated(
      [hook, bodyTxt, cta, hashtags.slice(0, 5).map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n"),
    );
    return {
      client_id: clientId,
      template_id: "ark-textkort",
      format: "1080x1350",
      title: firstLine(hook || bodyTxt),
      caption,
      payload: {
        templateId: "ark-textkort",
        format: "1080x1350",
        headline1: hook,
        body: bodyTxt,
        caption,
        compass: { funnel: p.funnel, four_a: p.four_a, disc: p.disc },
      },
      image_url: null,
      funnel_level: p.funnel,
      four_a: p.four_a,
      disc: p.disc,
      compass_source: "schedule",
      scheduled_at: p.date,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const { data: inserted, error } = await sb.from("studio_posts").insert(rows).select("id, title, scheduled_at, funnel_level, four_a, disc");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Faktisk token-användning per körning (förberett för credit-system). Fallback till
  // grovt estimat (tecken / 4) om API:t inte rapporterade usageMetadata.
  const tokenTotal = usage.total || Math.round((system.length + userPrompt.length + raw.length) / 4);
  console.log(`[compass-week] client=${clientId} inlägg=${rows.length} tokens_in=${usage.input} tokens_out=${usage.output} tokens_total=${tokenTotal}`);

  return NextResponse.json({
    saved: inserted?.length || 0,
    notes,
    token_estimate: tokenTotal,
    posts: (inserted || []).map((r) => ({
      id: r.id,
      title: r.title,
      when: r.scheduled_at,
      funnel_level: r.funnel_level,
      four_a: r.four_a,
      disc: r.disc,
    })),
  });
}

// Tolkar modellsvar som JSON och reparerar de vanligaste avvikelserna.
// Modellen skriver ibland hashtags som bara tecken i en array: ["#jul", #blommor]
// vilket inte är giltig JSON. Vi citerar sådana element och tar bort släpande komman.
// Rör bara array-positioner, aldrig text inuti strängar.
function tolkaJson<T>(raw: string): T {
  const rensad = String(raw || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const kandidat = rensad.startsWith("{") ? rensad : (rensad.match(/\{[\s\S]*\}/)?.[0] ?? rensad);
  try {
    return JSON.parse(kandidat) as T;
  } catch {
    let fixad = kandidat;
    // Citera obeklädda #taggar som står som egna element i en array.
    for (let i = 0; i < 40; i++) {
      const nasta = fixad.replace(/([[,]\s*)(#[^\s",\]}]+)(\s*[,\]])/g, '$1"$2"$3');
      if (nasta === fixad) break;
      fixad = nasta;
    }
    fixad = fixad.replace(/,(\s*[}\]])/g, "$1"); // släpande komma
    return JSON.parse(fixad) as T;
  }
}
