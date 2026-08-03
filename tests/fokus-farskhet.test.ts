import { describe, it, expect } from "vitest";
import { beskrivFarskhet, borSynkaOm, sedanText, GAMMAL_EFTER_MS, SYNK_INTERVALL_MS } from "@/lib/farskhet";
import { valjPipelineIds, byggSpegelrader, type GhlSteg, type RaOpp } from "@/lib/fokus/synk";

// Bakgrund (2026-08-03): Fokus visade Displaytekniks pipeline som den såg ut tre dygn
// tidigare, utan att någonstans säga det. En affär på 150 000 kr saknades helt och två
// affärer visade fel steg — en av dem som "Vunnen (order)" trots att den stod på
// "Möte genomfört". Testerna nedan låser de regler som gör att det inte kan upprepas
// tyst: åldern räknas alltid ut, och spegeln byggs ur GHL:s steg — aldrig ur status.

const NU = Date.parse("2026-08-03T12:00:00.000Z");
const minuterSedan = (m: number) => new Date(NU - m * 60000).toISOString();

describe("beskrivFarskhet", () => {
  it("säger åldern i klarspråk", () => {
    expect(beskrivFarskhet(minuterSedan(0), NU).text).toBe("Synkad just nu");
    expect(beskrivFarskhet(minuterSedan(1), NU).text).toBe("Synkad för 1 minut sedan");
    expect(beskrivFarskhet(minuterSedan(42), NU).text).toBe("Synkad för 42 minuter sedan");
    expect(beskrivFarskhet(minuterSedan(60), NU).text).toBe("Synkad för 1 timme sedan");
    expect(beskrivFarskhet(minuterSedan(60 * 5), NU).text).toBe("Synkad för 5 timmar sedan");
    expect(beskrivFarskhet(minuterSedan(60 * 24), NU).text).toBe("Synkad för 1 dag sedan");
  });

  // Det verkliga fallet: spegeln stod stilla från 31 juli till 3 augusti.
  it("flaggar den verkliga treårsdygnsluckan som gammal", () => {
    const f = beskrivFarskhet("2026-07-31T05:09:44.078Z", NU);
    expect(f.text).toBe("Synkad för 3 dagar sedan");
    expect(f.niva).toBe("gammal");
  });

  it("räknar färsk bara innanför tvåtimmarsgränsen", () => {
    expect(beskrivFarskhet(new Date(NU - GAMMAL_EFTER_MS + 1000).toISOString(), NU).niva).toBe("farsk");
    expect(beskrivFarskhet(new Date(NU - GAMMAL_EFTER_MS - 1000).toISOString(), NU).niva).toBe("gammal");
  });

  // Okänd ålder får ALDRIG passera som färsk — då är felet osynligt igen.
  it("behandlar saknad och trasig tidsstämpel som okänd, inte som färsk", () => {
    expect(beskrivFarskhet(null, NU).niva).toBe("okand");
    expect(beskrivFarskhet(undefined, NU).niva).toBe("okand");
    expect(beskrivFarskhet("inte-ett-datum", NU).niva).toBe("okand");
    expect(beskrivFarskhet(null, NU).minuter).toBeNull();
  });

  // Servrar går aldrig exakt lika. En stämpel från framtiden ska bli "just nu",
  // inte "för -3 minuter sedan".
  it("klarar en tidsstämpel från framtiden", () => {
    const f = beskrivFarskhet(new Date(NU + 90000).toISOString(), NU);
    expect(f.minuter).toBe(0);
    expect(f.text).toBe("Synkad just nu");
    expect(f.niva).toBe("farsk");
  });
});

describe("sedanText", () => {
  it("ger bara tidsuttrycket, för texter med eget verb", () => {
    expect(sedanText(minuterSedan(180), NU)).toBe("för 3 timmar sedan");
  });
  it("ger null när tidpunkten saknas — vyn får säga det med ord", () => {
    expect(sedanText(null, NU)).toBeNull();
    expect(sedanText("trasigt", NU)).toBeNull();
  });
});

describe("borSynkaOm", () => {
  it("hämtar på nytt först när tiominutersspärren löpt ut", () => {
    expect(borSynkaOm(new Date(NU - SYNK_INTERVALL_MS + 1000).toISOString(), NU)).toBe(false);
    expect(borSynkaOm(new Date(NU - SYNK_INTERVALL_MS - 1000).toISOString(), NU)).toBe(true);
  });
  it("hämtar när spegeln aldrig fyllts eller åldern inte går att läsa", () => {
    expect(borSynkaOm(null, NU)).toBe(true);
    expect(borSynkaOm("trasigt", NU)).toBe(true);
  });
});

describe("valjPipelineIds", () => {
  const alla = ["kund-dt", "linkedin", "sales", "promotion"];

  it("speglar bara den inställda pipelinen", () => {
    expect(valjPipelineIds(alla, new Set(["kund-dt"]))).toEqual(new Set(["kund-dt"]));
  });

  // Att gissa på "första pipelinen" skulle tyst dölja resten. Utan inställning
  // speglas allt — hellre en pipeline för mycket än en som försvinner utan förklaring.
  it("speglar allt när ingen pipeline är inställd", () => {
    expect(valjPipelineIds(alla, new Set())).toEqual(new Set(alla));
  });

  it("speglar allt när inställningen pekar på en pipeline som inte finns", () => {
    expect(valjPipelineIds(alla, new Set(["borttagen-pipeline"]))).toEqual(new Set(alla));
  });
});

describe("byggSpegelrader", () => {
  const steg = new Map<string, GhlSteg>([
    ["s-offert", { id: "s-offert", namn: "Offert skickad", pipelineId: "kund-dt", pipelineNamn: "Kund pipeline DT" }],
    ["s-vunnen", { id: "s-vunnen", namn: "Vunnen (order)", pipelineId: "kund-dt", pipelineNamn: "Kund pipeline DT" }],
    ["s-annan", { id: "s-annan", namn: "New Lead", pipelineId: "sales", pipelineNamn: "Sales Pipeline" }],
  ]);
  const valda = new Set(["kund-dt"]);
  const tenants = ["tenant-a", "tenant-b"];
  const nu = "2026-08-03T12:00:00.000Z";

  const sofia: RaOpp = {
    id: "opp-sofia",
    monetaryValue: 150000,
    pipelineId: "kund-dt",
    pipelineStageId: "s-offert",
    status: "open",
    lastStageChangeAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-02T09:00:00.000Z",
    contactId: "c-sofia",
    contact: { id: "c-sofia", name: "Sofia Boudon", companyName: "Boudon AB" },
  };

  it("speglar affären med steg, värde och kontakt", () => {
    const rader = byggSpegelrader([sofia], steg, valda, ["tenant-a"], nu);
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({
      tenant_id: "tenant-a",
      ghl_opportunity_id: "opp-sofia",
      ghl_contact_id: "c-sofia",
      kontakt: "Sofia Boudon",
      foretag: "Boudon AB",
      steg_namn: "Offert skickad",
      varde: 150000,
      steg_sedan: "2026-08-01T09:00:00.000Z",
      updated_at: nu,
    });
  });

  // Displayteknik delar en location över två coach_users. Skriver vi bara till den ena
  // ser den andra användaren en spegel som aldrig uppdateras.
  it("skriver en rad per tenant på locationen", () => {
    const rader = byggSpegelrader([sofia], steg, valda, tenants, nu);
    expect(rader.map((r) => r.tenant_id)).toEqual(["tenant-a", "tenant-b"]);
    expect(new Set(rader.map((r) => r.ghl_opportunity_id))).toEqual(new Set(["opp-sofia"]));
  });

  it("utelämnar affärer ur pipelines som inte ska speglas", () => {
    const annan: RaOpp = { id: "opp-annan", pipelineId: "sales", pipelineStageId: "s-annan" };
    const rader = byggSpegelrader([sofia, annan], steg, valda, ["tenant-a"], nu);
    expect(rader.map((r) => r.ghl_opportunity_id)).toEqual(["opp-sofia"]);
  });

  // Stegets pipeline är sanningen: affärens egna pipelineId kan släpa efter en flytt.
  it("följer stegets pipeline, inte affärens fält", () => {
    const flyttad: RaOpp = { id: "opp-flyttad", pipelineId: "kund-dt", pipelineStageId: "s-annan" };
    expect(byggSpegelrader([flyttad], steg, valda, ["tenant-a"], nu)).toHaveLength(0);
  });

  // ⚠ GHL svarar "open" även på vunna affärer. Råvärdet speglas som det är, men
  // stegnamnet är det som bär sanningen vidare till prioriteringsmotorn.
  it("speglar GHL:s status rått utan att låta den avgöra vunnet", () => {
    const vunnen: RaOpp = { id: "opp-vunnen", pipelineStageId: "s-vunnen", status: "open" };
    const rad = byggSpegelrader([vunnen], steg, valda, ["tenant-a"], nu)[0];
    expect(rad.status).toBe("open");
    expect(rad.steg_namn).toBe("Vunnen (order)");
  });

  it("hoppar över affärer utan id och tål saknade fält", () => {
    const trasig = { id: "", pipelineStageId: "s-offert" } as RaOpp;
    const tom: RaOpp = { id: "opp-tom", pipelineStageId: "s-offert" };
    const rader = byggSpegelrader([trasig, tom], steg, valda, ["tenant-a"], nu);
    expect(rader).toHaveLength(1);
    expect(rader[0]).toMatchObject({ kontakt: "", foretag: "", varde: 0, steg_sedan: null, status: "open" });
  });

  // Ett steg som saknas i pipelinekartan får inte tyst kastas bort — affären finns.
  it("behåller en affär vars steg saknas i kartan", () => {
    const okant: RaOpp = { id: "opp-okant", pipelineId: "kund-dt", pipelineStageId: "s-borta" };
    const rader = byggSpegelrader([okant], steg, valda, ["tenant-a"], nu);
    expect(rader).toHaveLength(1);
    expect(rader[0].steg_namn).toBe("");
  });
});
