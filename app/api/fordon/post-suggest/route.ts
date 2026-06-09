import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generate } from "@/lib/gemini";
import { getVoiceFingerprint, fingerprintToPromptBlock } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

// Förbjudna "handla om"-fraser → neutral formulering (samma regel som generate/post).
const HANDLA_OM: { re: RegExp; replace: string }[] = [
  { re: /\bdet handlar om\b/gi, replace: "det här är" },
  { re: /\bhandlar om\b/gi, replace: "är" },
  { re: /\bhandlade om\b/gi, replace: "var" },
  { re: /\bhandlat om\b/gi, replace: "varit" },
];
function clean(s: string): string {
  let t = String(s || "").trim();
  t = t.replace(/^\s*(?:HOOK|Hook|BODY|Body|CAPTION|Caption|CTA|Cta|HASHTAGS?|Hashtags?)\s*[:\-–—]\s*/i, "");
  for (const p of HANDLA_OM) t = t.replace(p.re, p.replace);
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

// POST /api/fordon/post-suggest  { vehicle_id, platform? }
// Returnerar ett brand-voice-förslag (hook/body/cta/hashtags) + bilens riktiga foto.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const { vehicle_id, platform } = await req.json();
    if (!vehicle_id) return NextResponse.json({ error: "vehicle_id krävs" }, { status: 400 });

    const sb = supabaseService();
    const { data: v } = await sb
      .from("hm_vehicles")
      .select("*")
      .eq("id", vehicle_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!v) return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });

    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    const fp = await getVoiceFingerprint(clientId);
    const voiceBlock = fingerprintToPromptBlock(fp);

    const specs =
      v.specs && typeof v.specs === "object"
        ? Object.entries(v.specs as Record<string, string>).map(([k, val]) => `${k}: ${val}`).join("\n")
        : "";
    const priceText = v.price > 0 ? `${Number(v.price).toLocaleString("sv-SE")} kr` : v.price_label || "Kontakta oss";

    const system = `Du är en vass svensk copywriter för en lokal bil- och fordonshandlare. Du skriver ett ${platform === "facebook" ? "Facebook" : "Instagram"}-inlägg som säljer EN specifik begagnad bil/fordon — personligt, konkret och förtroendeingivande. Aldrig malligt, aldrig AI-språk.

═══ HANDLARE ═══
Företag: ${profile?.company_name || "HM Motor"}
Plats: ${profile?.location || "Krokom"}
USP: ${profile?.usp || "Lokal handlare, genomgångna fordon, personlig service"}
Bokningslänk: ${profile?.booking_url || "(ingen)"}

${voiceBlock}

═══ KVALITETSKRAV ═══
- Svenska tecken å/ä/ö korrekt.
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "nästa nivå", "skalbar", "holistisk".
- ALDRIG någon form av "handla om".
- Använd bilens RIKTIGA fakta nedan. Hitta ALDRIG på data (hästkrafter, utrustning, skick) som inte står.
- Hooken stoppar scrollen.
- BRÖDTEXTEN SKA VARA LUFTIG OCH SCANNBAR — aldrig en textklump. Struktur:
  1) 2-3 korta säljande rader (radbryt mellan meningar, en tanke per rad).
  2) Blankrad, sedan en kort SPEC-LISTA — en rad per fakta, varje rad inleds med passande emoji:
     📅 Årsmodell · 🛣️ Miltal · ⛽ Bränsle · ⚙️ Växellåda · 🎨 Färg · 💰 Pris. Ta bara med de fakta som finns nedan.
  3) Blankrad, sedan EN kort avslutande rad.
- Använd riktiga radbrytningar (\\n) rikligt. Korta rader. Luftigt. Sparsamt med emoji — bara i spec-listan, inte i löptext.
- CTA = EN sak (t.ex. "Boka provkörning" eller "Hör av dig"). Inte flera.
- Hashtags: 6-10, blanda bilnischat + lokalt (Krokom/Jämtland/Östersund) + märke. Utan #-tecken.

═══ OUTPUT (JSON, exakt) ═══
{ "hook": "kort hook utan emoji-prefix", "body": "Luftig caption med radbrytningar:\\nKort intro-rad.\\nEn rad till.\\n\\n📅 Årsmodell: 2019\\n🛣️ Miltal: 9 000 mil\\n⛽ Bränsle: Bensin\\n💰 Pris: 119 900 kr\\n\\nAvslutande rad.", "cta": "en mening", "hashtags": ["bil", "krokom"] }`;

    const userPrompt = `FORDON ATT SÄLJA:
Rubrik: ${v.title}
Märke/modell: ${v.brand || ""} ${v.model || ""}
Pris: ${priceText}
${specs}
${v.description ? `\nAnnonsbeskrivning (referens, korta ner):\n${String(v.description).slice(0, 700)}` : ""}

Skriv ETT inlägg i JSON-formatet. Inget annat.`;

    let raw = "";
    try {
      raw = await generate({
        model: "gemini-2.5-pro",
        systemInstruction: system,
        prompt: userPrompt,
        temperature: 0.85,
        maxOutputTokens: 2000,
        jsonMode: true,
      });
    } catch (e) {
      return NextResponse.json({ error: `AI-fel: ${(e as Error).message}` }, { status: 500 });
    }

    let parsed: { hook?: string; body?: string; cta?: string; hashtags?: string[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const hook = clean(parsed.hook || "");
    const body = clean(parsed.body || "");
    const cta = clean(parsed.cta || "");
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h) => String(h).replace(/^#/, "")).filter(Boolean)
      : [];
    if (!hook && !body) return NextResponse.json({ error: "AI returnerade ingen text — försök igen" }, { status: 500 });

    const gallery = Array.isArray(v.gallery) ? (v.gallery as string[]) : [];
    return NextResponse.json({
      hook,
      body,
      cta,
      hashtags,
      image_url: v.image_url || gallery[0] || null,
      gallery,
      vehicle: { id: v.id, title: v.title, price: v.price, brand: v.brand, model: v.model },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
