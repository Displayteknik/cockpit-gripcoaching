import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { generateStudioCopy } from "@/lib/studio/copy";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { sanitizeGenerated, skrivreglerPa } from "@/lib/content/writing-rules";
import { analyzeImageRole, classifyImageRoleFromText, type BildRoll } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/suggest-text — { templateId, format, topic? }
// Hook-driven textmotor (lib/studio/copy.ts): hook-playbook + brand-profil + voice-fingerprint
// + winning examples via iterateGenerate (Anthropic), 5 varianter → topp 3 (inga fragment/AI-språk).
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const body = await req.json().catch(() => ({}));

    // Grunda förslagen i (1) inläggets grundtext och (2) bildens innehåll, så texten
    // förstärker bildens roll i berättelsen istället för att krocka med den.
    const caption = String(body.caption || "").slice(0, 1500);
    const imageUrl = String(body.imageUrl || "").slice(0, 500);
    const imageDescription = String(body.imageDescription || "").slice(0, 500);
    let bildbeskrivning = imageDescription;
    let bildroll: BildRoll = "neutral";
    if (imageDescription) {
      // Bilden kom från Bildhjälpen → vi vet redan vad den föreställer. Bara rollen kvar.
      bildroll = await classifyImageRoleFromText(imageDescription, caption).catch(() => "neutral");
    } else if (imageUrl) {
      // Annars (uppladdad bild/stockfoto): snabb bildanalys av pixlarna.
      const a = await analyzeImageRole(imageUrl, caption).catch(() => ({ description: "", role: "neutral" as BildRoll }));
      bildbeskrivning = a.description;
      bildroll = a.role;
    }

    const suggestions = await generateStudioCopy({
      clientId: client?.id || "",
      templateId: String(body.templateId || ""),
      format: String(body.format || "1080x1350"),
      topic: String(body.topic || ""),
      // ALDRIG en annan klient som fallback (Opticur-läcka-familjen).
      brandName: client?.name || "kunden",
      industry: client?.industry || "",
      caption,
      imageDescription: bildbeskrivning,
      imageRole: bildroll,
    });

    if (suggestions.length === 0) {
      return NextResponse.json({ error: "Kunde inte skapa förslag — försök igen." }, { status: 502 });
    }

    // Skyddsnät: modellen kan slarva trots promptreglerna.
    if (await skrivreglerPa((await getActiveClient().catch(() => null))?.id)) {
      for (const s of suggestions) {
        s.headline1 = sanitizeGenerated(s.headline1, { hashtags: false });
        s.headline2 = sanitizeGenerated(s.headline2, { hashtags: false });
        s.body = sanitizeGenerated(s.body, { hashtags: false });
      }
    }
    const top = suggestions[0];
    // Bakåtkompatibelt: toppförslagets fält direkt + hela listan i suggestions.
    return NextResponse.json({
      headline1: top.headline1,
      headline2: top.headline2,
      body: top.body,
      suggestions,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
