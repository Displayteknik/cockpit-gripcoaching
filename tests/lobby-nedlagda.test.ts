import { describe, it, expect } from "vitest";
import { byggPipelineIndex, normNamn, type PipelineOpp } from "@/lib/lobby/pipeline";

// Displayteknik-locationen (cZzTvCeFRDLinf5Ha3je), verifierat 2026-08-03.
const VUNNET = "98ae3cff-18a0-4f01-93cc-cc6965a195ce"; // "Vunnen (order)"
const FORLORAT = "a6023573-4e6a-4ab4-ae91-f15bace0c36f"; // "Förlorad / Paus (nurture)"
const OFFERT = "c1c1c1c1-0000-4000-8000-000000000001"; // ett steg i spel

const vinnare = new Set([VUNNET]);
const forlorare = new Set([FORLORAT]);
const tomt = new Set<string>();

function opp(o: Partial<PipelineOpp>): PipelineOpp {
  return { kontakt: null, ghl_contact_id: null, steg_id: null, steg_namn: null, ...o };
}

describe("byggPipelineIndex — vad som göms ur Nya leads", () => {
  it("nedlagd affär göms inte: leadet kommer tillbaka", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Anna Berg", ghl_contact_id: "c1", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" })],
      vinnare,
      forlorare,
    );
    expect(i.perId.has("c1")).toBe(false);
    expect(i.perNamn.has("anna berg")).toBe(false);
  });

  it("affär i spel göms", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Bo Ek", ghl_contact_id: "c2", steg_id: OFFERT, steg_namn: "Offert skickad" })],
      vinnare,
      forlorare,
    );
    expect(i.perId.get("c2")).toBe("Offert skickad");
  });

  it("vunnen affär göms — en kund är inget nytt lead", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Cia Dahl", ghl_contact_id: "c3", steg_id: VUNNET, steg_namn: "Vunnen (order)" })],
      vinnare,
      forlorare,
    );
    expect(i.perId.get("c3")).toBe("Vunnen (order)");
  });

  // Buggen: GHL svarar status="open" för ALLA DT-affärer, även de nedlagda. Ett filter
  // på status gömde därför leadet för alltid. Spegeln bär råvärdet — logiken rör det inte.
  it("GHL:s status='open' på en nedlagd affär ändrar ingenting", () => {
    const rader = [
      { ...opp({ kontakt: "Dan Falk", ghl_contact_id: "c4", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" }), status: "open" },
      { ...opp({ kontakt: "Eva Gran", ghl_contact_id: "c5", steg_id: VUNNET, steg_namn: "Vunnen (order)" }), status: "open" },
    ];
    const i = byggPipelineIndex(rader, vinnare, forlorare);
    expect(i.perId.has("c4")).toBe(false);
    expect(i.perId.has("c5")).toBe(true);
  });

  it("utan inställt facit räcker stegnamnet", () => {
    const i = byggPipelineIndex(
      [
        opp({ kontakt: "Fia Holm", ghl_contact_id: "c6", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" }),
        opp({ kontakt: "Gun Isak", ghl_contact_id: "c7", steg_id: VUNNET, steg_namn: "Vunnen (order)" }),
        opp({ kontakt: "Hal Juhl", ghl_contact_id: "c8", steg_id: OFFERT, steg_namn: "Offert skickad" }),
      ],
      tomt,
      tomt,
    );
    expect(i.perId.has("c6")).toBe(false);
    expect(i.perId.has("c7")).toBe(true);
    expect(i.perId.has("c8")).toBe(true);
  });

  it("affär utan steg räknas som i spel — ett okänt steg får aldrig tappa ett kort", () => {
    const i = byggPipelineIndex([opp({ kontakt: "Kim Mo", ghl_contact_id: "c10" })], vinnare, forlorare);
    expect(i.perId.has("c10")).toBe(true);
    expect(i.nedlagdaPerId.has("c10")).toBe(false);
  });

  it("en kontakt med både nedlagd och levande affär göms — den levande vinner", () => {
    const i = byggPipelineIndex(
      [
        opp({ kontakt: "Ida Kvist", ghl_contact_id: "c9", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" }),
        opp({ kontakt: "Ida Kvist", ghl_contact_id: "c9", steg_id: OFFERT, steg_namn: "Offert skickad" }),
      ],
      vinnare,
      forlorare,
    );
    expect(i.perId.get("c9")).toBe("Offert skickad");
    expect(i.perNamn.get("ida kvist")).toBe("Offert skickad");
  });

  it("namnmatchningen tål mellanslag och versaler, men tomma namn matchar aldrig", () => {
    expect(normNamn("  Jan   Lund ")).toBe("jan lund");
    const i = byggPipelineIndex(
      [
        opp({ kontakt: "  Jan   Lund ", steg_id: OFFERT, steg_namn: "Offert skickad" }),
        opp({ kontakt: "   ", steg_id: OFFERT, steg_namn: "Offert skickad" }),
      ],
      vinnare,
      forlorare,
    );
    expect(i.perNamn.get(normNamn("Jan Lund"))).toBe("Offert skickad");
    expect(i.perNamn.has("")).toBe(false);
  });

});

// Flaggan som gör fixen synlig: lead-status "passed" sätts när kontakten skickas till
// MySales och nollställs aldrig. Utan `nedlagdaPerId` skulle leadet fortsätta gömmas av
// den spärren i stället, och hela härledningen vore verkningslös i UI:t.
describe("byggPipelineIndex — nedlagda som slår lead-status 'passed'", () => {
  it("nedlagd affär flaggas på ghl_contact_id", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Lo Nord", ghl_contact_id: "c11", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" })],
      vinnare,
      forlorare,
    );
    expect(i.nedlagdaPerId.get("c11")).toBe("Förlorad / Paus (nurture)");
  });

  it("har kontakten en levande affär kvar flaggas inget — ordningen i listan spelar ingen roll", () => {
    const nedlagdForst = byggPipelineIndex(
      [
        opp({ kontakt: "Mio Palm", ghl_contact_id: "c12", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" }),
        opp({ kontakt: "Mio Palm", ghl_contact_id: "c12", steg_id: OFFERT, steg_namn: "Offert skickad" }),
      ],
      vinnare,
      forlorare,
    );
    const levandeForst = byggPipelineIndex(
      [
        opp({ kontakt: "Mio Palm", ghl_contact_id: "c12", steg_id: OFFERT, steg_namn: "Offert skickad" }),
        opp({ kontakt: "Mio Palm", ghl_contact_id: "c12", steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" }),
      ],
      vinnare,
      forlorare,
    );
    for (const i of [nedlagdForst, levandeForst]) {
      expect(i.nedlagdaPerId.has("c12")).toBe(false);
      expect(i.perId.get("c12")).toBe("Offert skickad");
    }
  });

  it("vunnen affär flaggas aldrig som nedlagd", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Nea Roos", ghl_contact_id: "c13", steg_id: VUNNET, steg_namn: "Vunnen (order)" })],
      vinnare,
      forlorare,
    );
    expect(i.nedlagdaPerId.has("c13")).toBe(false);
  });

  it("bara SÄKER match flaggar — en namne med nedlagd affär bevisar ingenting", () => {
    const i = byggPipelineIndex(
      [opp({ kontakt: "Ola Sund", ghl_contact_id: null, steg_id: FORLORAT, steg_namn: "Förlorad / Paus (nurture)" })],
      vinnare,
      forlorare,
    );
    expect(i.nedlagdaPerId.size).toBe(0);
    expect(i.perNamn.has("ola sund")).toBe(false);
  });
});
