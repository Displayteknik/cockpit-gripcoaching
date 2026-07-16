import { NextRequest, NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { generateStudioCopy } from "@/lib/studio/copy";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/suggest-text — { templateId, format, topic? }
// Hook-driven textmotor (lib/studio/copy.ts): hook-playbook + brand-profil + voice-fingerprint
// + winning examples via iterateGenerate (Anthropic), 5 varianter → topp 3 (inga fragment/AI-språk).
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const body = await req.json().catch(() => ({}));

    const suggestions = await generateStudioCopy({
      clientId: client?.id || "",
      templateId: String(body.templateId || ""),
      format: String(body.format || "1080x1350"),
      topic: String(body.topic || ""),
      brandName: client?.name || "Opticur",
      industry: client?.industry || "optiker",
    });

    if (suggestions.length === 0) {
      return NextResponse.json({ error: "Kunde inte skapa förslag — försök igen." }, { status: 502 });
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
