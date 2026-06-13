// Delad Ikigai-genereringslogik — används av både admin-routen (/api/ikigai/generate)
// och den publika leadmagnet-routen (/api/ikigai/public) så prompten aldrig glider isär.
import { generateJSON } from "@/lib/gemini";

export interface IkigaiInputs {
  love?: string;
  skill?: string;
  need?: string;
  pay?: string;
  background?: string;
  goal?: string;
  audience?: string;
  time_per_week?: string;
  person_name?: string;
  person_email?: string;
}

// Speglar intake-agentens proposal-form så /api/intake/commit kan applicera dem oförändrad.
export interface BrandProposal {
  target: "brand_profile" | "customer_voice" | "tone_rule" | "post_idea";
  action: "update" | "add" | "confirm";
  field?: string;
  proposed_value: string;
  evidence?: string;
  confidence?: "low" | "medium" | "high";
  reasoning?: string;
}

// Korta etiketter (2-5 ord) till Ikigai-Venn-diagrammet.
export interface IkigaiDiagram {
  love: string; skill: string; need: string; pay: string;
  passion: string; mission: string; profession: string; vocation: string;
  ikigai: string;
}

export interface GenResult {
  markdown: string;
  diagram: IkigaiDiagram;
  brand_proposals: BrandProposal[];
}

// Bara fält som /api/intake/commit faktiskt skriver (BRAND_FIELDS där).
export const ALLOWED_BRAND_FIELDS = new Set([
  "usp", "icp_primary", "icp_secondary", "pain_points", "differentiators",
  "services", "brand_story", "tone_rules", "customer_journey", "customer_quotes", "tagline",
]);

export function buildInputBlock(inputs: IkigaiInputs): string {
  const field = (label: string, v?: string) => (v && v.trim() ? `### ${label}\n${v.trim()}` : `### ${label}\n(tomt — flagga som lucka)`);
  return [
    field("Vad du älskar (passion)", inputs.love),
    field("Vad du är bra på (skicklighet)", inputs.skill),
    field("Vad världen behöver (marknadsbehov)", inputs.need),
    field("Vad du kan få betalt för (betalning)", inputs.pay),
    inputs.background?.trim() ? field("Bakgrund", inputs.background) : "",
    inputs.goal?.trim() ? field("Mål", inputs.goal) : "",
    inputs.audience?.trim() ? field("Nätverk / befintlig publik", inputs.audience) : "",
    inputs.time_per_week?.trim() ? field("Tid per vecka", inputs.time_per_week) : "",
  ].filter(Boolean).join("\n\n");
}

/**
 * Kör Gemini och returnerar coaching-leveransen (markdown), diagram-etiketterna
 * och brand-förslag. `knowledge` = ikigai-metodiken (+ ev. klientens röst för ton).
 */
export async function generateIkigai(inputs: IkigaiInputs, knowledge: string): Promise<GenResult> {
  const inputBlock = buildInputBlock(inputs);
  const personLabel = inputs.person_name?.trim() || "du";

  const system = `Du är en erfaren coach som använder Ikigai-metodiken nedan för att ta ${personLabel} från idé till en konkret, betald nisch med ett första erbjudande och en 14-dagars plan.

${knowledge}

UPPGIFT: Läs personens fyra Ikigai-fält + kontext och leverera TVÅ saker:

A) **markdown** — hela coaching-leveransen i ren Markdown, i exakt denna ordning (använd # för rubriker):
# Din Ikigai — ${personLabel}
## Så hänger det ihop
(De fyra korsningarna i klartext + själva kärnan. Om ett fält är tunt: säg det ärligt och föreslå hur luckan fylls.)
## Tre möjliga nischer
(3 st, var och en: namn, vem den tjänar, varför just du, kort om hur du sticker ut. Olika bredd och risk.)
## Den jag rekommenderar
(Vilken + varför. Säg vilket antagande som mest skulle ändra rådet om det visade sig fel.)
## Ditt första erbjudande
(Vad / För vem / Vad det får kosta / Hur du levererar. Något du kan sälja redan nästa vecka.)
## Testa billigt först
(3 konkreta, billiga sätt att testa nischen innan du bygger något.)
## Din plan — 14 dagar
(Konkreta steg per dag eller intervall — faktiska saker att göra och bocka av, inte "fundera på".)
## Tre inlägg att börja med
(3 förslag som fångar uppmärksamhet och gör dig trovärdig i nischen.)

B) **diagram** — korta etiketter (2-5 ord var, inga meningar) till ett Ikigai-Venn-diagram:
- love/skill/need/pay = kärnan i personens fyra svar, komprimerat
- passion = skärningen älskar×bra på, mission = älskar×behövs, profession = bra på×betalt, vocation = behövs×betalt
- ikigai = nischen i ~3 ord (mitten)

C) **brand_proposals** — strukturerade förslag som fyller personens brand-profil utifrån resultatet. Dessa appliceras i ett separat granska-steg. Regler:
- target="brand_profile" med field = ett av: tagline, icp_primary, brand_story, usp, differentiators, services, pain_points, tone_rules, customer_journey, customer_quotes
- target="customer_voice" för målgruppens egna smärt-ord (field="pain" eller "desire")
- target="post_idea" för inläggsidéer (proposed_value = "hook | kort vinkel")
- action="update" för identitetsfälten (tagline/icp_primary/brand_story/usp/services/pain_points/tone_rules), "add" för listartade (customer_voice, post_idea, differentiators)
- proposed_value ska vara FÄRDIG text som kan klistras rakt in i fältet (ingen meta-text)
- evidence = vilket Ikigai-svar förslaget bygger på. confidence + en kort reasoning-mening.
- Max 12 förslag. Hoppa över fält där underlaget är för tunt.

SPRÅK: vanlig svenska som en människa pratar. INGA förkortningar (skriv aldrig MVP, ICP, USP, CTA, ROI, B2B o.dyl.) och inga engelska facktermer (roadmap, hook, pipeline, framework). Förklara allt på svenska. Inga floskler. Förbjudna ord: kraftfull, banbrytande, game-changer, "handlar om", nästa nivå, holistisk, skalbar. Svenska tecken (å/ä/ö) korrekta.

RETURNERA STRIKT JSON:
{
  "markdown": "# Din Ikigai — ...\\n\\n## Så hänger det ihop\\n...",
  "diagram": { "love": "...", "skill": "...", "need": "...", "pay": "...", "passion": "...", "mission": "...", "profession": "...", "vocation": "...", "ikigai": "..." },
  "brand_proposals": [
    { "target": "brand_profile", "action": "update", "field": "tagline", "proposed_value": "...", "evidence": "[ur passion-svaret]", "confidence": "high", "reasoning": "..." }
  ]
}`;

  const result = await generateJSON<GenResult>({
    model: "gemini-2.5-pro",
    systemInstruction: system,
    prompt: `## Personens Ikigai-underlag\n\n${inputBlock}\n\nLeverera nu enligt instruktionerna. Returnera bara JSON.`,
    temperature: 0.8,
    maxOutputTokens: 16000,
  });

  return {
    markdown: (result.markdown ?? "").trim(),
    diagram: result.diagram,
    brand_proposals: result.brand_proposals ?? [],
  };
}
