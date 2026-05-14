import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Suggestion {
  topic: string;
  angle: string;
  why: string;
}

const DAY_THEMES: Record<number, { fourA: string; disc: string; funnel: string; theme: string }> = {
  0: { fourA: "Analytical", disc: "C", funnel: "TOFU", theme: "Utbildande / fakta / tecken på risk / hälsotips" },
  1: { fourA: "Analytical", disc: "D", funnel: "MOFU", theme: "Så går arbetet till / metod / planering / process" },
  2: { fourA: "Aspirational", disc: "I", funnel: "TOFU", theme: "Före/efter / transformation / visuell glädje" },
  3: { fourA: "Aspirational", disc: "S", funnel: "TOFU", theme: "Trygghet / kundens känsla / lugn process / story + CTA" },
  4: { fourA: "Actionable", disc: "D", funnel: "BOFU", theme: "Skicka bild / boka / offert / RUT / handling" },
  5: { fourA: "Actionable", disc: "C", funnel: "TOFU", theme: "Checklista / 'kolla detta i helgen' / steg-för-steg" },
  6: { fourA: "Authentic", disc: "S/I", funnel: "TOFU", theme: "Personligt från grundaren / veckans jobb / reflektion" },
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const dayIndex = typeof body.dayIndex === "number" ? body.dayIndex : new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  const clientId = await getActiveClientId();
  const client = await getActiveClient();
  const sb = supabaseServer();

  const [
    { data: profile },
    { data: voice },
    { data: existingPosts },
    { data: strategyDocs },
  ] = await Promise.all([
    sb.from("hm_brand_profile")
      .select("company_name, tagline, usp, icp_primary, pain_points, services, customer_quotes, tone_rules, differentiators")
      .eq("client_id", clientId).maybeSingle(),
    sb.from("client_voice_profile").select("signature_phrases, tone_summary").eq("client_id", clientId).maybeSingle(),
    sb.from("hm_social_posts").select("topic").eq("client_id", clientId).order("created_at", { ascending: false }).limit(30),
    sb.from("client_assets").select("body").eq("client_id", clientId).eq("category", "strategy_doc").limit(1),
  ]);

  type Profile = {
    company_name: string | null; tagline: string | null; usp: string | null;
    icp_primary: string | null; services: string | null; pain_points: string | null;
    customer_quotes: string | null; tone_rules: string | null; differentiators: string | null;
  };
  type Voice = { signature_phrases: string[] | null; tone_summary: string | null };
  const p = profile as Profile | null;
  const v = voice as Voice | null;

  const day = DAY_THEMES[dayIndex] ?? DAY_THEMES[0];
  const recentTopics = (existingPosts ?? []).map((x) => x.topic).filter(Boolean).join("\n");
  const strategyExcerpt = strategyDocs?.[0]?.body?.slice(0, 3000) ?? "";

  const brandBlock = p ? `
Företag: ${p.company_name ?? client?.name ?? "okänd"}
Tagline: ${p.tagline ?? "(saknas)"}
USP: ${p.usp ?? "(saknas)"}
ICP: ${p.icp_primary ?? "(saknas)"}
Tjänster: ${p.services ?? "(saknas)"}
Smärtor: ${p.pain_points ?? "(saknas)"}
Differentiering: ${p.differentiators ?? "(saknas)"}
Ton: ${p.tone_rules ?? v?.tone_summary ?? "(saknas)"}
` : `Klient: ${client?.name ?? "okänd"} — brand-profil saknas, gör generella förslag.`;

  const voiceBlock = v?.signature_phrases && v.signature_phrases.length > 0
    ? `Klientens signaturfraser (vävs gärna in):\n${v.signature_phrases.slice(0, 12).map((s) => `- "${s}"`).join("\n")}`
    : "";

  const system = `Du föreslår ÄMNEN för ett Instagram/Facebook-inlägg åt ${p?.company_name ?? client?.name ?? "klienten"}.

# Klient-profil
${brandBlock}

${voiceBlock}

${strategyExcerpt ? `# Strategisk kontext (utdrag)\n${strategyExcerpt}\n` : ""}

# Dag: ${["Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag","Söndag"][dayIndex]}
4A-typ: ${day.fourA} · DISC: ${day.disc} · Funnel: ${day.funnel}
Tema: ${day.theme}

# Regler
- Förslagen MÅSTE matcha klientens bransch, ton och ICP. Inga generiska coaching-floskler.
- Inga AI-floskler ("kraftfull", "banbrytande", "holistisk", "handlar om", "nästa nivå").
- Topic = vad inlägget HANDLAR om (kort, konkret). Angle = vinkeln/inkörsporten (en mening).
- Variera mellan kundens pain points, services, og typiska situationer.
- Undvik dessa nyligen-gjorda ämnen:\n${recentTopics || "(inga än)"}

# Output
RETURNERA exakt 5 förslag som JSON-array:
[{ "topic": "kort ämne", "angle": "specifik vinkel/inkörsport, en mening", "why": "en mening om varför detta passar dagens tema + klienten" }]`;

  const suggestions = await generateJSON<Suggestion[]>({
    model: "gemini-2.5-flash",
    systemInstruction: system,
    prompt: `Ge 5 konkreta ämnen för ${day.fourA}/${day.disc}/${day.funnel} idag. Specifika och bransch-relevanta — inga generaliteter.`,
    temperature: 0.95,
    maxOutputTokens: 2000,
  });

  return NextResponse.json({ suggestions, day });
}
