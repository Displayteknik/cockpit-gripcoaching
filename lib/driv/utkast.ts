// DRIV-2/DRIV-4 — utkastgenerering, utbruten ur app/api/driv/utkast/route.ts så att
// DRIV-4:s morgonkö kan förbereda ett utkast VID KÖBYGGET, inte först när Håkan klickar.
// Samma "dm-svar"-återanvändning, samma regler, se route-filen för den fulla motiveringen.

import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";
import { byggTextPrompt, saneraText } from "@/lib/prompt-core";

const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

export async function genereraUtkast(params: {
  oppId: string;
  kanal: "gmail" | "ghl";
  motpart: string;
  amne?: string;
  senasteText: string;
}): Promise<{ text: string | null; fel?: string }> {
  const sb = supabaseService();
  const { data: rad } = await sb
    .from("hq_pipeline_cache")
    .select("namn, foretag, steg_namn")
    .eq("ghl_opportunity_id", params.oppId)
    .maybeSingle();

  const uppdrag = [
    "Du skriver ETT svarsförslag åt klienten i varumärkesprofilen nedan, till en person i klientens säljpipeline som just hört av sig.",
    "Ett svar, inte tre varianter. Möt det personen skrev, ge en konkret sak, avsluta med en naturlig fråga eller ett förslag på nästa steg.",
    params.kanal === "gmail" ? "Kanalen är MEJL: hälsning + korta stycken + tydlig avslutning." : "Kanalen är SMS/socialt via MySales: kort, direkt, inga stycken.",
    "Svaret ska kunna skickas som det är. Inga platshållare i hakparenteser, ingen instruktion till läsaren.",
    "Uppgifterna nedan är allt du vet om personen och affären. Påstå aldrig något utöver det.",
  ].join("\n");

  const underlag = [
    `KONTAKT: ${params.motpart}${rad?.namn ? ` (affär: ${rad.namn}${rad.foretag ? ", " + rad.foretag : ""})` : ""}`,
    rad?.steg_namn ? `Pipelinesteg: ${rad.steg_namn}` : "",
    `Senaste meddelandet från kontakten:\n${params.senasteText || "(inget sparat — skriv en öppnare som för dialogen framåt)"}`,
  ].filter(Boolean).join("\n");

  const bygg = await byggTextPrompt({
    clientId: DT_CLIENT_ID,
    syfte: "dm-svar",
    kanal: params.kanal === "gmail" ? "mejl" : undefined,
    uppdrag,
    underlag,
    anvandarText: params.senasteText,
    jsonSchema: `{ "text": "svaret, en enda text" }`,
  });

  try {
    const data = await generateJSON<{ text?: string }>({
      model: "gemini-2.5-pro",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      maxOutputTokens: 1200,
      temperature: 0.6,
      skrivregler: false,
      generering: { syfte: "dm-svar", promptVersion: bygg.meta.promptVersion, funnel: bygg.meta.funnel, lager: bygg.meta.lager },
    });
    if (!data.text) return { text: null, fel: "Inget utkast kunde skapas" };
    return { text: await saneraText(data.text, DT_CLIENT_ID) };
  } catch (e) {
    return { text: null, fel: `Utkastet gick inte att skapa: ${String(e).slice(0, 200)}` };
  }
}
