// Compass-veckans promptbygge (TEXT-1 T-3, FACIT-flöde). Utbrutet ur
// app/api/generate/week/route.ts så att paritetstestet kan bygga systemprompten utan
// route-/DB-kontext (Next tillåter inga extra exporter ur en route-fil).
//
// Kärnan (lib/prompt-core) äger kund-/röst-/skrivregellagren — det gamla handbyggda
// KUND-blocket (råfält) och voiceBlock är ersatta. Per-dag-blocken byggs fortfarande
// med contentCompassBlock: det är FLÖDESDATA (schemats profilering per planerad dag),
// därför ligger de i uppdraget och ingen compass-param sätts på toppnivå.

import { byggTextPrompt, type ByggdPrompt } from "@/lib/prompt-core";
import { contentCompassBlock } from "@/lib/content-compass/prompt";
import { KANE_HOOK_RULES } from "@/lib/content-framework";
import type { PlannedPost } from "@/lib/content-compass/rules";

export async function byggCompassVeckaPrompt(
  clientId: string,
  theme: string,
  posts: PlannedPost[],
): Promise<ByggdPrompt> {
  // Ett block per planerad dag: dagens Compass-profil styr ton, form och CTA.
  const dayBlocks = posts
    .map((p, i) => {
      const dateLabel = new Date(p.date).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short" });
      const compass = contentCompassBlock({ funnel: p.funnel, four_a: p.four_a, disc: p.disc });
      return `── INLÄGG ${i + 1} (${p.dayLabel}, ${dateLabel}) ──\n${compass}`;
    })
    .join("\n\n");

  const uppdrag = `Du är världsklass copywriter. Du skriver en hel veckas innehåll enligt kundens Content Compass. Varje inlägg har sin egen roll (funnel, 4A, DISC) och sin egen anatomi nedan. Följ anatomin för varje inlägg exakt.

═══ VECKANS INLÄGG (följ Compass-blocket för varje) ═══
${dayBlocks}

═══ HOOK-REGLER ═══
${KANE_HOOK_RULES}

═══ KVALITETSKRAV ═══
- Veckan ska ha progression och kännas som en serie, inte lösryckta inlägg.
- Varje inlägg: en tydlig hook, känsla och igenkänning, kundens resultat, exakt EN CTA som matchar funnel-nivån.
- ALDRIG AI-språk: "kraftfull", "banbrytande", "game-changer", "skalbar", "holistisk".
- Skriv på svenska som personen själv hade skrivit.`;

  const jsonSchema = `{
  "days": [
    { "hook": "...", "body": "...", "cta": "...", "hashtags": ["..."] }
  ]
}
Exakt ${posts.length} inlägg i "days", i samma ordning som INLÄGG 1..${posts.length} ovan.`;

  return byggTextPrompt({
    clientId,
    syfte: "veckoplan", // ingen compass-default — per-dag-blocken ovan bär Compass
    uppdrag,
    underlag: `Veckotema: ${theme}\n\nSkriv ${posts.length} inlägg som tillsammans tar målgruppen från medvetenhet till handling. Returnera enbart JSON.`,
    jsonSchema,
  });
}
