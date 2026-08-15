// DRIV-4 punkt 3 — mötesförberedelsekort. Tre föreslagna frågor, byggda ENDAST på det
// kortets egen tidslinje faktiskt visar (samma sanningskrav som resten av plattformen,
// se SANNINGSKRAV i lib/prompt-core.ts — "dm-svar" bär det redan, ingen ny regel behövs).

import { byggTextPrompt, saneraText } from "@/lib/prompt-core";
import { generateJSON } from "@/lib/gemini";
import type { DrivKort } from "@/lib/driv/kort";

const DT_CLIENT_ID = "a6a33547-5ca7-475f-9a62-43ff2c74d000";

export interface MoteForberedelse {
  lagesText: string;
  senasteHandelser: string[];
  frageforslag: string[];
}

export async function byggMoteForberedelse(kort: DrivKort): Promise<MoteForberedelse> {
  const senaste = kort.tidslinje.slice(0, 3).map((t) => `${t.titel}${t.snippet ? ": " + t.snippet : ""} (${new Date(t.tidpunkt).toLocaleDateString("sv-SE")})`);

  if (!senaste.length) {
    return { lagesText: kort.senasteKontakt.text, senasteHandelser: [], frageforslag: [] };
  }

  const uppdrag = [
    "Du föreslår tre korta frågor klienten kan ställa på ett säljmöte, byggda ENDAST på tidslinjen nedan.",
    "Hitta ALDRIG på något om kunden som inte står i tidslinjen — ingen gissad smärtpunkt, inget påhittat behov.",
    "Frågorna ska föra samtalet framåt utifrån vad som faktiskt hänt, inte generiska säljfrågor.",
  ].join("\n");
  const underlag = `AFFÄR: ${kort.lage.namn || "okänd"}${kort.lage.foretag ? ", " + kort.lage.foretag : ""}\n\nTIDSLINJE (senaste händelserna, äldst sist):\n${senaste.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  const bygg = await byggTextPrompt({
    clientId: DT_CLIENT_ID,
    syfte: "dm-svar",
    uppdrag,
    underlag,
    jsonSchema: `{ "fragor": ["fråga 1", "fråga 2", "fråga 3"] }`,
  });

  try {
    const data = await generateJSON<{ fragor?: string[] }>({
      model: "gemini-2.5-pro",
      systemInstruction: bygg.system,
      prompt: bygg.user,
      maxOutputTokens: 600,
      temperature: 0.5,
      skrivregler: false,
      generering: { syfte: "dm-svar", promptVersion: bygg.meta.promptVersion, funnel: bygg.meta.funnel, lager: bygg.meta.lager },
    });
    const fragor = await Promise.all((data.fragor || []).slice(0, 3).map((f) => saneraText(f, DT_CLIENT_ID)));
    return { lagesText: kort.senasteKontakt.text, senasteHandelser: senaste, frageforslag: fragor };
  } catch {
    return { lagesText: kort.senasteKontakt.text, senasteHandelser: senaste, frageforslag: [] };
  }
}
