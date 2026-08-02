import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate, generateWithUsage } from "@/lib/gemini";
import { byggTextPrompt, saneraText, VARIANTREGEL } from "@/lib/prompt-core";
import { obackadeSiffror, SIFFER_SKARPNING, talTokens, utanHashtags } from "@/lib/content/writing-rules";
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
import { byggCompassVeckaPrompt } from "@/lib/content-compass/vecka-prompt";
import { dagensStudioPayload } from "@/lib/studio/pa-bild";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { hasModule } from "@/lib/entitlements";
import { CTA_SKARPNING, harCtaISlutet, skrivreglerPa } from "@/lib/content/writing-rules";

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
- Varje CTA är EN sak att göra — varierande över veckan

${VARIANTREGEL}
(Veckans 7 inlägg räknas som varianter: två dagar får aldrig dela retorisk ingång eller öppningsfras.)`;

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

    // KVALITET-3/11: CTA-golvet på den färdiga, sanerade texten. Rättade CTA:er
    // saneras på nytt så de går genom samma grind som allt annat.
    const golv = await fixaSaknadeCta(bygg.system, days.map((d) => d.cta), "veckoplan");
    if (golv.omgenererad) {
      await Promise.all(days.map(async (d, i) => {
        if (golv.ctas[i] !== d.cta) d.cta = await saneraText(golv.ctas[i], clientId);
      }));
    }

    // Siffergrinden på brödtexten (samma princip som CTA-golvet, en omgenerering).
    const tillatnaTal = new Set<string>([...talTokens(bygg.profilText), ...talTokens(String(theme ?? ""))]);
    const sif = await fixaObackadeSiffror(
      bygg.system,
      days.map((d) => ({ hook: d.hook, body: d.body })),
      tillatnaTal,
      "veckoplan",
    );
    if (sif.omgenererad) {
      await Promise.all(days.map(async (d, i) => {
        if (sif.texter[i].hook !== d.hook) d.hook = await saneraText(sif.texter[i].hook, clientId);
        if (sif.texter[i].body !== d.body) d.body = await saneraText(sif.texter[i].body, clientId);
      }));
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
  // Bara existenskontroll — kundfakta i prompten ägs numera av kärnans brand-profil-lager.
  const { data: profile } = await sb
    .from("hm_brand_profile")
    .select("client_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Brand-profil saknas" }, { status: 400 });

  const schedule = await getCompassSchedule(clientId);
  const { posts, notes } = planWeek(schedule);
  if (!posts.length) return NextResponse.json({ error: "Schemat har inga aktiva dagar" }, { status: 400 });

  // TEXT-1 T-3: prompten byggs av prompt-core via byggCompassVeckaPrompt — det gamla
  // KUND-blocket (råfält) och voiceBlock ersätts av kärnans lager; per-dag-Compass-blocken
  // (flödesdata) ligger i uppdraget. Paritetstest: tests/compass-vecka-paritet.test.ts.
  const bygg = await byggCompassVeckaPrompt(clientId, theme, posts);

  const { text: raw, usage } = await generateWithUsage({
    model: "gemini-2.5-pro",
    systemInstruction: bygg.system,
    prompt: bygg.user,
    temperature: 0.85,
    maxOutputTokens: 8000,
    jsonMode: true,
    skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
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
  // T-5 (2): fälten saneras VAR FÖR SIG innan de landar i payload — förr sanerades bara
  // den hopslagna captionen medan payload.headline1/body/caption bar rå text.
  const nowIso = new Date().toISOString();
  const falt = await Promise.all(posts.map(async (_p, i) => {
    const ai = parsed.days![i] || {};
    const [hook, bodyTxt, cta] = await Promise.all([
      saneraText(toStr(ai.hook), clientId),
      saneraText(toStr(ai.body), clientId),
      saneraText(toStr(ai.cta), clientId),
    ]);
    return { hook, bodyTxt, cta, hashtags: Array.isArray(ai.hashtags) ? ai.hashtags.map((h) => String(h).replace(/^#/, "")) : [] };
  }));

  // KVALITET-3/11: CTA-golvet innan captionen sätts ihop — en dag som slutar i ett
  // konstaterande skulle annars sparas i kalendern som "konstaterande + hashtags".
  const golv = await fixaSaknadeCta(bygg.system, falt.map((f) => f.cta), "compass-vecka");
  if (golv.omgenererad) {
    await Promise.all(falt.map(async (f, i) => {
      if (golv.ctas[i] !== f.cta) f.cta = await saneraText(golv.ctas[i], clientId);
    }));
  }

  const rows = posts.map((p, i) => {
    const { hook, bodyTxt, cta, hashtags } = falt[i];
    const caption = [hook, bodyTxt, cta, hashtags.slice(0, 5).map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n");
    return {
      client_id: clientId,
      template_id: "ark-textkort",
      format: "1080x1350",
      title: firstLine(hook || bodyTxt),
      caption,
      // KVALITET-3/3: dagens text är en CAPTION. Den får ALDRIG skrivas rakt in i
      // headline1/body — det är texten PÅ BILDEN, ett annat format med egen anatomi.
      // Dagen går in som underlag (brief + caption); affischtexten genereras i Studio.
      payload: {
        ...dagensStudioPayload({ theme, hook, body: bodyTxt, caption }),
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
  const tokenTotal = usage.total || Math.round((bygg.system.length + bygg.user.length + raw.length) / 4);
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
// ── KVALITET-3/punkt 11: CTA-golvets efterhandskontroll för veckoflödena ─────
// Veckans dagar blir en CAPTION i kalendern: hook + body + cta + hashtags (se
// veckoplan-sidan och generateCompassWeek nedan). Slutar `cta` i ett konstaterande blir
// captionen exakt det fel Håkan såg i skarp drift: "…konstaterande + hashtags".
//
// Kontrollen är deterministisk (harCtaISlutet, ingen AI). Saknas uppmaningen i en
// eller flera dagar görs EXAKT EN omgenerering — ett enda anrop som rättar alla fällda
// dagar samtidigt. Dagar som redan klarar golvet rörs aldrig. Fail-open i varje led:
// misslyckas omgenereringen behålls första försöket, användaren blir aldrig utan text.
async function fixaSaknadeCta(system: string, ctas: string[], etikett: string): Promise<{ ctas: string[]; omgenererad: boolean; kvar: number[] }> {
  const saknas = ctas.map((_, i) => i).filter((i) => !harCtaISlutet(ctas[i] || ""));
  if (!saknas.length) return { ctas, omgenererad: false, kvar: [] };
  console.warn(`[cta-golv] ${etikett}: inlägg ${saknas.map((i) => i + 1).join(", ")} saknar imperativ CTA — en omgenerering`);
  const ut = [...ctas];
  try {
    const raw = await generate({
      model: "gemini-2.5-flash",
      systemInstruction: `${system}\n\n${CTA_SKARPNING}`,
      prompt: [
        "Avsluten nedan saknar en uppmaning i imperativ. Skriv om VART OCH ETT till exakt EN uppmaning som börjar med ett verb i imperativform och säger hur eller var handlingen görs. Behåll budskapet, rösten och funnel-nivåns ton. Inga hashtags, en mening eller två per uppmaning.",
        "",
        ...saknas.map((i) => `${i}: ${ctas[i] || "(tomt)"}`),
        "",
        `Returnera ENDAST giltig JSON: {"ctas":{${saknas.map((i) => `"${i}":"..."`).join(",")}}}`,
      ].join("\n"),
      temperature: 0.7,
      maxOutputTokens: 900,
      jsonMode: true,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });
    const obj = tolkaJson<{ ctas?: Record<string, unknown> }>(raw);
    for (const i of saknas) {
      const v = String(obj?.ctas?.[String(i)] ?? "").trim();
      if (v) ut[i] = v;
    }
  } catch (e) {
    console.warn(`[cta-golv] ${etikett}: omgenereringen kastade (${(e as Error).message}) — behåller första försöket`);
  }
  const kvar = ut.map((_, i) => i).filter((i) => !harCtaISlutet(ut[i] || ""));
  if (kvar.length) console.warn(`[cta-golv] ${etikett}: inlägg ${kvar.map((i) => i + 1).join(", ")} saknar CTA även efter omgenerering — levererar bästa försöket`);
  return { ctas: ut, omgenererad: true, kvar };
}

// KVALITET-3/p11, Håkans beslut 1/8: siffergrinden gäller VARJE siffra, även
// jämförelser med omvärlden. Skarptestet gav "en standardskärm har cirka 400 nits" —
// ett tal om ANDRAS produkter, lika obackat som ett om klienten. Promptregeln ensam
// räckte inte (samma lärdom som CTA-golvet), så här är den deterministiska grinden:
// dagar med obackade tal skrivs om EN gång, generellt i stället för med siffra.
// Fail-open, och användarens egna tal räknas som täckta.
async function fixaObackadeSiffror(
  system: string,
  delar: { hook: string; body: string }[],
  tillatnaTal: Set<string>,
  etikett: string,
): Promise<{ texter: { hook: string; body: string }[]; omgenererad: boolean; kvar: number[] }> {
  // HELA inlägget grindas, inte bara brödtexten: DoD-körning 4 hade "en standardskärm
  // har cirka 400 nits" i HOOKEN, och en grind som bara läste body såg rakt förbi den.
  const helText = (d: { hook: string; body: string }) => `${d.hook || ""}

${d.body || ""}`;
  const fallda = delar
    .map((_, i) => i)
    .filter((i) => obackadeSiffror(utanHashtags(helText(delar[i])), tillatnaTal).length > 0);
  if (!fallda.length) return { texter: delar, omgenererad: false, kvar: [] };
  console.warn(`[siffergrind] ${etikett}: inlägg ${fallda.map((i) => i + 1).join(", ")} har obackade tal — en omgenerering`);
  const ut = delar.map((d) => ({ ...d }));
  try {
    const raw = await generate({
      model: "gemini-2.5-flash",
      systemInstruction: `${system}

${SIFFER_SKARPNING}`,
      prompt: [
        "Inläggen nedan innehåller tal som inte finns i varumärkesprofilen. Skriv om VART OCH ETT utan de talen — beskriv skillnaden generellt i stället. Behåll budskap, röst, längd och krokens funktion.",
        "",
        ...fallda.map((i) => `${i}: HOOK: ${delar[i].hook || "(tomt)"}\n   BRÖDTEXT: ${delar[i].body || "(tomt)"}`),
        "",
        `Returnera ENDAST giltig JSON: {"texter":{${fallda.map((i) => `"${i}":{"hook":"...","body":"..."}`).join(",")}}}`,
      ].join("\n"),
      temperature: 0.6,
      // Hook + brödtext för flera dagar i ETT JSON-svar: 1400 kapade svaret mitt i en
      // sträng ("Unterminated string at position 4461") och omgenereringen föll bort.
      maxOutputTokens: 4000,
      jsonMode: true,
      skrivregler: false, // prompt-core äger skrivregler-flaggan (TEXT-1)
    });
    const obj = tolkaJson<{ texter?: Record<string, { hook?: unknown; body?: unknown }> }>(raw);
    for (const i of fallda) {
      const v = obj?.texter?.[String(i)];
      const hook = String(v?.hook ?? "").trim();
      const body = String(v?.body ?? "").trim();
      if (hook) ut[i].hook = hook;
      if (body) ut[i].body = body;
    }
  } catch (e) {
    console.warn(`[siffergrind] ${etikett}: omgenereringen kastade (${(e as Error).message}) — behåller första försöket`);
  }
  const kvar = ut
    .map((_, i) => i)
    .filter((i) => obackadeSiffror(utanHashtags(helText(ut[i])), tillatnaTal).length > 0);
  if (kvar.length) console.warn(`[siffergrind] ${etikett}: inlägg ${kvar.map((i) => i + 1).join(", ")} har obackade tal även efter omgenerering — levererar bästa försöket`);
  return { texter: ut, omgenererad: true, kvar };
}

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
