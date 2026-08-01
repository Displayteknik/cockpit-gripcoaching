// KVALITET-3 punkt 10 — DM-lead ur skärmdump.
// Regressionen som låses: talarattributionen (placeringen avgör), datumomräkningen
// och fas-härledningen. Skarpt fel som föranledde testerna: sammanfattningen
// tillskrev kontakten det tenanten hade sagt, och Messenger-kontakter blockerades.
import { describe, it, expect } from "vitest";
import {
  tolka,
  talareForSida,
  normaliseraBubblor,
  harledFas,
  raknaUtTidpunkt,
  paminnelseFor,
  normaliseraKanal,
  kanalEtikett,
  lasbarTid,
  skarmdumpPrompt,
  type RaExtraktion,
} from "@/lib/dm/skarmdump";

// Håkans skarpa Messenger-skärmdump, bubbla för bubbla. Kontakten till vänster
// (grå, med avatar), tenanten till höger (lila/blå).
const ANNA: RaExtraktion = {
  namn: "Anna Dahlgren",
  kanal: "messenger",
  kanal_indikationer: "Aa-fält, GIF-knapp, lila bubblor",
  anvandarnamn: "",
  bubblor: [
    { sida: "hoger", talare: "tenant", text: "Ska kolla igenom min planering" },
    { sida: "hoger", talare: "tenant", text: "Blir måndag kl 10 bra för dig?" },
    { sida: "hoger", talare: "tenant", text: "ha en trevlig helg" },
    { sida: "vanster", talare: "kontakt", text: "Det blir toppen 😊" },
  ],
  motestid_text: "måndag kl 10",
  motestid_foreslogs_av: "tenant",
  motestid_bekraftad_av: "kontakt",
};

// Fredag 31 juli 2026 kl 12:28 svensk tid (tidsstämpeln i skärmdumpen).
const FREDAG = new Date("2026-07-31T10:28:00.000Z");

describe("talarattribution — placeringen avgör, aldrig innehållet", () => {
  it("höger = tenanten, vänster = kontakten", () => {
    expect(talareForSida("hoger")).toBe("tenant");
    expect(talareForSida("vanster")).toBe("kontakt");
  });

  it("skriver över bildläsningens gissning när den motsäger placeringen", () => {
    // Precis felet i skarptestet: modellen kastade om talarna.
    const b = normaliseraBubblor([
      { sida: "hoger", talare: "kontakt", text: "Blir måndag kl 10 bra för dig?" },
      { sida: "vanster", talare: "tenant", text: "Det blir toppen" },
    ]);
    expect(b[0].talare).toBe("tenant");
    expect(b[1].talare).toBe("kontakt");
  });

  it("Anna-fallet: TENANTEN föreslog tiden, KONTAKTEN bekräftade", () => {
    const t = tolka(ANNA, FREDAG);
    expect(t.foreslogAv).toBe("tenant");
    expect(t.bekraftadAv).toBe("kontakt");
    expect(t.varme).toBe("varm"); // du föreslog + hon sa ja
  });

  it("kontakten föreslår tiden → varmare läge (het)", () => {
    const vand: RaExtraktion = {
      ...ANNA,
      bubblor: [
        { sida: "vanster", text: "Blir måndag kl 10 bra för dig?" },
        { sida: "hoger", text: "Det blir toppen" },
      ],
    };
    const t = tolka(vand, FREDAG);
    expect(t.foreslogAv).toBe("kontakt");
    expect(t.bekraftadAv).toBe("tenant");
    expect(t.varme).toBe("het");
  });

  it("sammanfattningen tillskriver rätt person — aldrig omkastad", () => {
    const t = tolka(ANNA, FREDAG);
    expect(t.sammanfattning).toContain("Du föreslog måndag kl 10");
    expect(t.sammanfattning).toContain("Anna Dahlgren bekräftade");
    expect(t.sammanfattning).not.toContain("Anna Dahlgren föreslog");
  });

  it("är kanaloberoende — samma regel i LinkedIn", () => {
    const li: RaExtraktion = {
      namn: "Erik Ek",
      kanal: "linkedin",
      bubblor: [
        { sida: "hoger", text: "Passar torsdag kl 14?" },
        { sida: "vanster", text: "Perfekt, ses då" },
      ],
      motestid_text: "torsdag kl 14",
    };
    const t = tolka(li, FREDAG);
    expect(t.kanal).toBe("linkedin");
    expect(t.foreslogAv).toBe("tenant");
    expect(t.bekraftadAv).toBe("kontakt");
  });
});

describe("relativ tid → konkret datum", () => {
  it("'måndag kl 10' från fredag 31 juli 2026 → måndag 3 augusti kl 10:00", () => {
    const iso = raknaUtTidpunkt("måndag kl 10", FREDAG);
    expect(iso).not.toBeNull();
    expect(lasbarTid(iso)).toBe("måndag 3 augusti kl 10:00");
    expect(iso!.slice(0, 10)).toBe("2026-08-03"); // 10:00 svensk sommartid = 08:00 UTC
    expect(iso).toBe("2026-08-03T08:00:00.000Z");
  });

  it("samma veckodag: tiden kvar idag → idag, annars nästa vecka", () => {
    // Fredag 12:28 svensk tid.
    expect(raknaUtTidpunkt("fredag kl 15", FREDAG)).toBe("2026-07-31T13:00:00.000Z");
    expect(raknaUtTidpunkt("fredag kl 09", FREDAG)).toBe("2026-08-07T07:00:00.000Z");
  });

  it("hanterar imorgon, minuter och explicit datum", () => {
    expect(lasbarTid(raknaUtTidpunkt("imorgon kl 09:30", FREDAG))).toBe("lördag 1 augusti kl 09:30");
    expect(lasbarTid(raknaUtTidpunkt("tisdag 14.15", FREDAG))).toBe("tisdag 4 augusti kl 14:15");
    expect(lasbarTid(raknaUtTidpunkt("3 augusti kl 10", FREDAG))).toBe("måndag 3 augusti kl 10:00");
  });

  it("vintertid ger rätt klockslag (ingen UTC-glidning)", () => {
    const januari = new Date("2026-01-05T09:00:00.000Z"); // måndag 5 jan, 10:00 svensk tid
    expect(lasbarTid(raknaUtTidpunkt("onsdag kl 10", januari))).toBe("onsdag 7 januari kl 10:00");
    expect(raknaUtTidpunkt("onsdag kl 10", januari)).toBe("2026-01-07T09:00:00.000Z");
  });

  it("gissar aldrig när dagen saknas", () => {
    expect(raknaUtTidpunkt("kl 10", FREDAG)).toBeNull();
    expect(raknaUtTidpunkt("", FREDAG)).toBeNull();
    expect(raknaUtTidpunkt("hör av mig sen", FREDAG)).toBeNull();
  });

  it("påminnelsen läggs sista vardagen före mötet kl 16:00", () => {
    const mote = raknaUtTidpunkt("måndag kl 10", FREDAG); // mån 3 aug
    // Torsdag 30 juli: fredagen 31 juli kl 16 ligger kvar i framtiden.
    const torsdag = new Date("2026-07-30T08:00:00.000Z");
    expect(lasbarTid(paminnelseFor(mote, torsdag))).toBe("fredag 31 juli kl 16:00");
    // Onsdagsmöte → påminnelse tisdag (ingen helg inblandad).
    const onsdagsmote = raknaUtTidpunkt("onsdag kl 09", FREDAG);
    expect(lasbarTid(paminnelseFor(onsdagsmote, FREDAG))).toBe("tisdag 4 augusti kl 16:00");
  });

  it("har vardagen passerat används dagen före mötet, sist av allt nu", () => {
    const mote = raknaUtTidpunkt("måndag kl 10", FREDAG); // mån 3 aug
    // Fredag 12:28: fredag 16:00 ligger kvar.
    expect(paminnelseFor(mote, FREDAG)).toBe("2026-07-31T14:00:00.000Z");
    // Lördag: fredagen är förbi → söndag 2 aug kl 16, fortfarande inför måndagen.
    const lordag = new Date("2026-08-01T10:00:00.000Z");
    expect(lasbarTid(paminnelseFor(mote, lordag))).toBe("söndag 2 augusti kl 16:00");
    // Söndag kväll: allt före mötet är förbi → akut, alltså nu.
    const sondagKvall = new Date("2026-08-02T19:00:00.000Z");
    expect(paminnelseFor(mote, sondagKvall)).toBe(sondagKvall.toISOString());
  });
});

describe("fas ur innehållet", () => {
  const bubblor = normaliseraBubblor(ANNA.bubblor);

  it("bokad: tid föreslagen av en part, bekräftad av den andra", () => {
    expect(harledFas({ bubblor, motestidText: "måndag kl 10", foreslogAv: "tenant", bekraftadAv: "kontakt" }))
      .toMatchObject({ fas: "bokning", utfall: "bokad", steg: "won" });
  });

  it("tid föreslagen men obekräftad → bokning som väntar, inte bokad", () => {
    expect(harledFas({ bubblor, motestidText: "måndag kl 10", foreslogAv: "tenant", bekraftadAv: null }))
      .toMatchObject({ fas: "bokning", utfall: "vantar", steg: "offer" });
  });

  it("pris/erbjudande utan tid → erbjudande", () => {
    const b = normaliseraBubblor([
      { sida: "hoger", text: "Paketet kostar 4 900 kr" },
      { sida: "vanster", text: "Jag funderar" },
    ]);
    expect(harledFas({ bubblor: b, motestidText: "", foreslogAv: null, bekraftadAv: null }))
      .toMatchObject({ fas: "erbjudande", steg: "offer" });
  });

  it("fram och tillbaka utan tid → dialog", () => {
    const b = normaliseraBubblor([
      { sida: "vanster", text: "Hej, hur funkar det?" },
      { sida: "hoger", text: "Hej, berätta gärna mer om läget" },
      { sida: "vanster", text: "Vi är fyra personer" },
    ]);
    expect(harledFas({ bubblor: b, motestidText: "", foreslogAv: null, bekraftadAv: null }))
      .toMatchObject({ fas: "dialog", steg: "connect" });
  });

  it("bara kontaktens första meddelande → ny, obesvarad", () => {
    const b = normaliseraBubblor([{ sida: "vanster", text: "Hej!" }]);
    expect(harledFas({ bubblor: b, motestidText: "", foreslogAv: null, bekraftadAv: null }))
      .toMatchObject({ fas: "hej", steg: "new" });
  });

  it("Anna-fallet ger BOKNING/BOKAD — aldrig HEJ", () => {
    const t = tolka(ANNA, FREDAG);
    expect(t.fas).toBe("bokning");
    expect(t.utfall).toBe("bokad");
    expect(t.steg).toBe("won");
  });
});

describe("kanal — Facebook blockeras aldrig", () => {
  it("normaliserar det bildläsningen råkar skriva", () => {
    expect(normaliseraKanal("Messenger")).toBe("messenger");
    expect(normaliseraKanal("fb")).toBe("messenger");
    expect(normaliseraKanal("IG")).toBe("instagram");
    expect(normaliseraKanal("LinkedIn")).toBe("linkedin");
    expect(normaliseraKanal("")).toBe("annat");
  });

  it("etiketten faller tillbaka på Instagram när bara handle finns (gamla kontakter)", () => {
    expect(kanalEtikett(null, "annasblommor")).toBe("Instagram");
    expect(kanalEtikett(null, null)).toBe("Annat");
    expect(kanalEtikett("messenger", null)).toBe("Messenger (Facebook)");
  });

  it("Anna har inget användarnamn — och det gör inget", () => {
    const t = tolka(ANNA, FREDAG);
    expect(t.kanal).toBe("messenger");
    expect(t.anvandarnamn).toBe("");
    expect(t.namn).toBe("Anna Dahlgren");
  });
});

describe("förifyllnad — allt som lästs ut når formuläret", () => {
  it("hela Anna-tolkningen", () => {
    const t = tolka(ANNA, FREDAG);
    expect(t.namn).toBe("Anna Dahlgren");
    expect(t.kanal).toBe("messenger");
    expect(t.steg).toBe("won");
    expect(t.motestidLasbar).toBe("måndag 3 augusti kl 10:00");
    expect(t.paminnelseLasbar).toBe("fredag 31 juli");
    expect(t.nastaSteg).toBe("Förbered mötet med Anna Dahlgren – måndag 3 augusti kl 10:00.");
    expect(t.sammanfattning).toContain("Messenger (Facebook)");
  });

  it("tål en tom bildläsning utan att krascha", () => {
    const t = tolka({}, FREDAG);
    expect(t.steg).toBe("new");
    expect(t.motestidISO).toBeNull();
    expect(t.paminnelseISO).toBeNull();
    expect(t.nastaSteg).toContain("Svara");
  });
});

describe("prompten bär reglerna", () => {
  it("talarattributionen och kanalgissningen står i prompten", () => {
    const p = skarmdumpPrompt("2026-07-31");
    expect(p).toContain("2026-07-31");
    expect(p).toMatch(/HÖGER/);
    expect(p).toMatch(/VÄNSTER/);
    expect(p).toMatch(/Messenger/);
    expect(p).toMatch(/LinkedIn/);
    expect(p).toMatch(/Instagram/);
    expect(p).toContain("motestid_text");
    // Den relativa tiden får inte räknas om av modellen — det gör vår kod.
    expect(p).toMatch(/Räkna inte om till datum/);
  });
});
