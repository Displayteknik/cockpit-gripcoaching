// KVALITET-3/punkt 11 — CTA-golvets efterhandskontroll.
//
// CTA-golvet i lib/prompt-core kräver "imperativ med väg". Prompten är förstahands-
// försvaret men i skarp drift var den intermittent: en caption fick "Boka en digital
// fika, ingen säljpitch", nästa slutade i ett konstaterande plus hashtags. Testerna
// nedan låser den deterministiska kontrollen som fångar det:
//   - giltiga imperativ passerar, även de mjuka ("Hör av dig om du vill veta mer")
//   - konstateranden fälls ("vi ser till att du får...", "du är välkommen att...")
//   - hashtags efter CTA:n stör inte
//   - omgenereringen sker EXAKT en gång och är fail-open
// Ingen AI, inga nycklar, inget nät.

import { describe, expect, it, vi } from "vitest";
import {
  CTA_SKARPNING,
  harCtaISlutet,
  harImperativCta,
  hittaImperativCta,
  sakerstallCta,
  utanHashtags,
  obackadeSiffror,
  talTokens,
} from "@/lib/content/writing-rules";

// Verkliga captionavslut. Vänster = texten, höger = ska den räknas som CTA?
const GILTIGA: string[] = [
  "Boka en digital fika, ingen säljpitch.",
  "Hör av dig om du vill veta mer.",
  "Hör gärna av dig så tar vi det därifrån.",
  "Skicka en bild på platsen du vill skylta, få en offert inom 24 timmar.",
  "Ring oss på förmiddagen så hittar vi en tid.",
  "Mejla en rad så återkommer vi samma dag.",
  "Kommentera SKYLT så skickar vi guiden.",
  "Svara BLUEPRINT här i kommentarerna.",
  "Skriv OMPROGRAMMERING så bokar vi ett kostnadsfritt samtal.",
  "Kika in i butiken på Storgatan när du går förbi.",
  "Testa själv på hemsidan.",
  "Kontakta oss för en genomgång av lokalen.",
  "Besök vår hemsida och se hela sortimentet.",
  "Anmäl dig via länken i bion.",
  "Dela med dig i kommentarerna om du känner igen dig.",
  "Läs mer om hur vi jobbar på hemsidan.",
  "Ta kontakt så ritar vi upp ett förslag.",
  "Kom förbi verkstaden och titta på plats.",
  "Fyll i formuläret så hörs vi i veckan.",
  "Tveka inte att höra av dig om du vill bolla en idé.",
  "Klicka på länken i bion för hela guiden.",
  "Spara inlägget så har du det när det behövs.",
  "Slå oss en signal så bokar vi in ett besök.",
  "Häng med på torsdag när vi öppnar dörrarna.",
  "Passa på nu i augusti.",
  "Prata med oss innan du bestämmer dig.",
  "Låt oss titta på lokalen tillsammans.",
];

const KONSTATERANDEN: string[] = [
  "Vi hjälper dig gärna med hela vägen fram.",
  "Vi ser till att du får en skylt som syns även i solljus.",
  "Du är alltid välkommen att höra av dig.",
  "Det är bara att kontakta oss när du är redo.",
  "Länk i bion.",
  "Så blir det när man gör rätt från början.",
  "Vi finns här när du behöver oss.",
  "Många väntar för länge med att byta skylt.",
  "Det är sällan viljan det hänger på.",
  "Resultatet talar för sig självt.",
  "Vi kan hjälpa dig att boka en tid som passar.",
  "Att boka tid hos oss går snabbt.",
  "Kom ihåg att skylten är det första kunden ser.",
  "Fråga dig själv hur ofta du tittar upp.",
];

describe("hittaImperativCta — giltiga imperativ (inklusive mjuka)", () => {
  for (const t of GILTIGA) {
    it(`räknas som CTA: "${t}"`, () => {
      expect(harImperativCta(t)).toBe(true);
    });
  }
});

describe("hittaImperativCta — konstateranden fälls", () => {
  for (const t of KONSTATERANDEN) {
    it(`räknas INTE som CTA: "${t}"`, () => {
      expect(harImperativCta(t)).toBe(false);
    });
  }
});

describe("hashtags stör inte", () => {
  it("hashtagblock efter CTA:n på egen rad", () => {
    const caption = [
      "Skylten är det första kunden ser.",
      "",
      "Boka en kostnadsfri genomgång så tittar vi på ditt fönster.",
      "",
      "#digitalskyltning #butik #jämtland #skyltfönster",
    ].join("\n");
    expect(harImperativCta(caption)).toBe(true);
    expect(hittaImperativCta(caption)).toHaveLength(1);
  });

  it("hashtags räddar inte en caption utan CTA", () => {
    const caption = "Vi ser till att du får en skylt som syns.\n\n#skylt #led #butik";
    expect(harImperativCta(caption)).toBe(false);
  });

  it("hashtags mitt i löptext plockas bort utan att slå sönder satsen", () => {
    expect(utanHashtags("Vi jobbar med #skyltar varje dag.").trim()).toBe("Vi jobbar med   varje dag.".trim());
  });

  it("en hashtag inuti CTA-raden stoppar inte träffen", () => {
    expect(harImperativCta("Boka en tid via #länkenibion")).toBe(true);
  });
});

describe("hela captions", () => {
  it("caption med korrekt imperativ-CTA sist godkänns", () => {
    const caption = [
      "Hur ofta tittar du upp på din egen skylt?",
      "",
      "De flesta gör det aldrig. Kunden gör det varje gång hen går förbi, och en skylt som inte syns i eftermiddagssolen kostar besök.",
      "",
      "Skicka en bild på fönstret så säger vi vad som behövs.",
      "",
      "#skyltfönster #butik",
    ].join("\n");
    expect(harImperativCta(caption)).toBe(true);
  });

  it("caption som slutar i konstaterande plus hashtags fälls (det verifierade felet)", () => {
    const caption = [
      "Hur ofta tittar du upp på din egen skylt?",
      "",
      "De flesta gör det aldrig, och en skylt som inte syns i eftermiddagssolen kostar besök.",
      "",
      "Vi ser till att du får en skylt som syns, året om.",
      "",
      "#skyltfönster #butik",
    ].join("\n");
    expect(harImperativCta(caption)).toBe(false);
  });

  it("emoji och pilar före verbet stör inte", () => {
    expect(harImperativCta("👉 Boka en tid här.")).toBe(true);
    expect(harImperativCta("📩 Mejla oss så hörs vi.")).toBe(true);
  });

  it("inledande bindeord stör inte", () => {
    expect(harImperativCta("Så hör av dig när du är redo.")).toBe(true);
    expect(harImperativCta("PS: Kommentera GUIDE så skickar vi den.")).toBe(true);
  });

  it("tom eller tomrumstext ger ingen träff (och kastar inte)", () => {
    expect(harImperativCta("")).toBe(false);
    expect(harImperativCta("   \n  ")).toBe(false);
    expect(hittaImperativCta(undefined as unknown as string)).toEqual([]);
  });
});

describe("harCtaISlutet — uppmaningen ska stå sist", () => {
  it("CTA i slutstycket godkänns, hashtagraden efter räknas inte", () => {
    const caption = "Höststormen avslöjar de sjuka träden.\n\nSkicka en bild på trädet så tittar vi på det.\n\n#trädfällning";
    expect(harCtaISlutet(caption)).toBe(true);
  });

  // Håkans skärpning 1/8: golvet gäller BOKSTAVLIGT. En klarläggare i SAMMA mening är
  // fortfarande tillåten (meningen slutar då i uppmaningen), men en NY mening efter
  // uppmaningen underkänns — även en kort och vänlig sådan. "Vi hör av oss samma dag"
  // ska stå före uppmaningen, inte efter.
  it("klarläggare i samma mening tillåten, ny mening efter uppmaningen fälls", () => {
    expect(harCtaISlutet("Vi finns i Krokom.\n\nBoka en digital fika, ingen säljpitch.")).toBe(true);
    expect(harCtaISlutet("Vi finns i Krokom.\n\nKontakta oss för en bedömning. Vi hör av oss samma dag.")).toBe(false);
    expect(harCtaISlutet("Vi hör av oss samma dag.\n\nKontakta oss för en bedömning.")).toBe(true);
  });

  it("CTA mitt i texten följd av ett stycke konstateranden fälls", () => {
    const caption = [
      "Höststormen avslöjar de sjuka träden.",
      "",
      "Kontakta oss för en kostnadsfri bedömning.",
      "",
      "Vi hjälper er att trygga er fastighet, år efter år.",
    ].join("\n");
    expect(harImperativCta(caption)).toBe(true); // uppmaningen FINNS
    expect(harCtaISlutet(caption)).toBe(false); // men den står inte sist
  });

  it("caption utan stycken bedöms som en helhet", () => {
    expect(harCtaISlutet("Ring oss på förmiddagen så hittar vi en tid.")).toBe(true);
    expect(harCtaISlutet("Vi hjälper dig gärna hela vägen.")).toBe(false);
  });

  it("tom text fälls utan att kasta", () => {
    expect(harCtaISlutet("")).toBe(false);
    expect(harCtaISlutet("\n\n#skylt\n")).toBe(false);
  });
});

describe("sakerstallCta — exakt en omgenerering, aldrig en loop", () => {
  it("godkänd text genererar aldrig om", async () => {
    const om = vi.fn(async () => "SKA ALDRIG ANROPAS");
    const r = await sakerstallCta("Boka en tid via länken.", om);
    expect(om).not.toHaveBeenCalled();
    expect(r).toEqual({ text: "Boka en tid via länken.", omgenererad: false, godkand: true });
  });

  it("saknad CTA → EN omgenerering, skärpningen skickas med", async () => {
    const om = vi.fn(async (skarpning: string) => {
      expect(skarpning).toBe(CTA_SKARPNING);
      return "Vi gör jobbet.\n\nHör av dig så bokar vi in ett besök.";
    });
    const r = await sakerstallCta("Vi ser till att du får en skylt som syns.", om);
    expect(om).toHaveBeenCalledTimes(1);
    expect(r.omgenererad).toBe(true);
    expect(r.godkand).toBe(true);
    expect(r.text).toContain("Hör av dig");
  });

  it("omgenereringen misslyckas också → EN gång, bästa försöket levereras (fail-open)", async () => {
    const om = vi.fn(async () => "Vi finns här när du är redo.");
    const r = await sakerstallCta("Vi hjälper dig gärna.", om);
    expect(om).toHaveBeenCalledTimes(1);
    expect(r.omgenererad).toBe(true);
    expect(r.godkand).toBe(false);
    expect(r.text).toBe("Vi finns här när du är redo.");
  });

  it("omgenereringen kastar → första försöket levereras, inget kastas vidare", async () => {
    const om = vi.fn(async () => { throw new Error("AI-fel"); });
    const r = await sakerstallCta("Vi hjälper dig gärna.", om);
    expect(om).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ text: "Vi hjälper dig gärna.", omgenererad: true, godkand: false });
  });

  it("omgenereringen svarar tomt → första försöket levereras", async () => {
    const om = vi.fn(async () => "   ");
    const r = await sakerstallCta("Vi hjälper dig gärna.", om);
    expect(r.text).toBe("Vi hjälper dig gärna.");
    expect(r.godkand).toBe(false);
  });
});

// ── Håkans skärpningar 2026-08-01 ────────────────────────────────────────────
describe("CTA-golvet gäller bokstavligt: uppmaningen är SISTA meningen", () => {
  it("underkänner DoD-beviset caption 7 (platsrad efter CTA:n)", () => {
    const caption7 =
      "Har du ett träd du oroar dig för?\n\n" +
      "Många väntar tills höststormarna avslöjar ett svagt träd.\n\n" +
      "Skicka en bild på trädet och var det står, så återkommer vi. Vi finns i Roslagen och norra Stockholm.";
    expect(harImperativCta(caption7)).toBe(true); // uppmaningen FINNS
    expect(harCtaISlutet(caption7)).toBe(false); // men den står inte sist
  });

  it("godkänner samma text när platsraden flyttas före uppmaningen", () => {
    const ratt =
      "Har du ett träd du oroar dig för?\n\n" +
      "Vi finns i Roslagen och norra Stockholm.\n\n" +
      "Skicka en bild på trädet och var det står, så återkommer vi.";
    expect(harCtaISlutet(ratt)).toBe(true);
  });

  it("klarläggare i SAMMA mening är fortfarande tillåten", () => {
    expect(harCtaISlutet("Vi tar det lugnt.\n\nBoka en digital fika, ingen säljpitch.")).toBe(true);
  });

  it("hashtags efter uppmaningen stör inte", () => {
    expect(harCtaISlutet("Skicka en bild på skyltfönstret.\n\n#skyltning #butik")).toBe(true);
  });
});

describe("siffergrinden gäller varje siffra, även om omvärlden", () => {
  const profil = talTokens("Startpaket 21 000 kr. Skärmar på 3 500 nits.");

  it("fäller obackat tal om andras produkter (400 nits om vanliga TV)", () => {
    const t = "En vanlig TV klarar sällan mer än 400 nits.\n\nBoka en visning.";
    expect(obackadeSiffror(t, profil)).toContain("400");
  });

  it("släpper igenom tal som står i profilen", () => {
    expect(obackadeSiffror("Våra skärmar ger 3 500 nits.\n\nBoka en visning.", profil)).toEqual([]);
  });

  it("årtal räknas inte som sifferpåstående", () => {
    expect(obackadeSiffror("Vi har gjort det sedan 2009.\n\nRing oss.", profil)).toEqual([]);
  });

  it("användarens egna tal räknas som täckta (fail-safe)", () => {
    const medAnvandare = new Set([...profil, "129"]);
    expect(obackadeSiffror("Dagens lunch 129 kr.\n\nBoka bord.", medAnvandare)).toEqual([]);
  });
});
