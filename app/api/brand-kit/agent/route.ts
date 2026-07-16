import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { analyzeSite } from "@/lib/studio/brand-agent";
import { generate } from "@/lib/gemini";
import { getProfileAsMarkdown } from "@/lib/knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/brand-kit/agent — analyserar klientens webbplats + profil → FÖRSLAG till kit.
// Sparar inte. UI visar förslaget i förslags-läge för godkännande.
export async function POST() {
  try {
    const client = await getActiveClient();
    if (!client?.public_url) {
      return NextResponse.json({ error: "Klienten saknar webbadress (public_url) att analysera." }, { status: 400 });
    }

    const analysis = await analyzeSite(client.public_url, client.primary_color || undefined);

    // Bildstil + donts ur varumärkesprofilen (textförslag, inget påhittat).
    const profile = await getProfileAsMarkdown().catch(() => "");
    let imageStyle: Record<string, unknown> = {};
    let donts: string[] = [];
    let contentProfile: Record<string, unknown> = {};
    if (profile) {
      try {
        const raw = await generate({
          model: "gemini-2.5-flash",
          systemInstruction: [
            `Utifrån varumärkesprofilen för ${client.name}, föreslå bildstil, vill-inte-ha OCH innehållsprofil för deras sociala grafik.`,
            profile.slice(0, 4000),
            "Vägledning innehållsprofil: retail/butik → affisch/erbjudande/lista. coach/personlig utveckling → foto+overlay, citat, textkort (mer text). konsult/tjänst → textkort, citat, statement. b2b/teknik → statement, lista, foto+overlay. Välj de 3–5 format som passar bäst.",
            'Format-nycklar: overlay, text-only, quote, poster, statement, list, offer, carousel.',
            'SVAR: strikt JSON {"imageStyle":{"mode":"photo|illustration|mixed","prompt":"kort svensk stilbeskrivning","negative":"undvik-lista","colorGrade":"warm|cool|neutral","people":true},"donts":["kort regel"],"contentProfile":{"clientType":"retail|coach|consultant|b2b-tech|automotive","textWeight":"poster|balanced|text-first","overlayStyle":"scrim-bottom|scrim-full|band","formats":["overlay","text-only"]}}',
            "Föreslå bara det profilen stödjer. Max 4 donts.",
          ].join("\n"),
          prompt: "Föreslå bildstil, donts och innehållsprofil nu.",
          temperature: 0.6,
          maxOutputTokens: 800,
          jsonMode: true,
        });
        const obj = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
        imageStyle = obj.imageStyle || {};
        donts = Array.isArray(obj.donts) ? obj.donts.slice(0, 4) : [];
        contentProfile = obj.contentProfile && typeof obj.contentProfile === "object" ? obj.contentProfile : {};
      } catch { /* hoppa över */ }
    }

    // Bygg förslags-kit (bara ifyllt där vi hittade något).
    const proposed: Record<string, unknown> = {};
    if (Object.keys(analysis.colors).length) proposed.colors = analysis.colors;
    if (analysis.fonts.headline) proposed.fonts = analysis.fonts;
    if (analysis.logo?.primaryUrl) proposed.logo = analysis.logo;
    if (Object.keys(imageStyle).length) proposed.imageStyle = imageStyle;
    if (donts.length) proposed.donts = donts;
    if (Object.keys(contentProfile).length) proposed.contentProfile = contentProfile;

    return NextResponse.json({ proposed, analysis: analysis.found });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
