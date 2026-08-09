// AKUT-KARUSELL — N slides ska bli N bilder hela vägen genom publiceringen.
//
// Bakgrund (G-0, 2026-08-09): Studio kunde bygga upp till tio slides och gränssnittet
// lovade "{n} slides · exporteras som {n} bilder", men fångsten läste EN dold nod — den
// slide användaren råkade titta på. En sjuslides-karusell blev alltså en enda bild i både
// export, bibliotek och publicering. `publishCarousel` och `PublishRequest.slideUrls`
// fanns redan färdiga i koden; det var anroparen som saknades.
//
// Testet mäter kontraktet där det går att mäta deterministiskt: att publishContent
// skickar ALLA bilder som karusell-children när de är två eller fler, att en ensam bild
// fortfarande går den gamla enkelvägen, och att GHL-utkastet bär hela media-arrayen.
// All nätverkstrafik mockas — inget riktigt konto rörs.

import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Alla anrop som lämnar processen fångas här i stället för att gå ut.
const igPostAnrop: { path: string; body: Record<string, string> }[] = [];
const ghlUtkast: { media: { url: string }[]; postType?: string }[] = [];

vi.mock("@/lib/instagram", () => ({
  getIgConnection: async () => ({ id: "k1", ig_account_id: "IG123", ig_access_token: "t" }),
  publishSingle: async (_a: string, _t: string, imageUrl: string) => {
    igPostAnrop.push({ path: "single", body: { imageUrl } });
    return { id: "media_single" };
  },
  publishCarousel: async (_a: string, _t: string, imageUrls: string[]) => {
    igPostAnrop.push({ path: "carousel", body: { antal: String(imageUrls.length), urls: imageUrls.join(",") } });
    return { id: "media_carousel" };
  },
  publishStory: async () => ({ id: "media_story" }),
  publishReel: async () => ({ id: "media_reel" }),
}));

// ensureJpegUrl: Meta kräver JPEG. Här räcker det att den släpper igenom URL:en.
vi.mock("@/lib/images", () => ({
  ensureJpegUrl: async (url: string) => ({ url: url.replace(/\.png$/, ".jpg") }),
}));

vi.mock("@/lib/studio/ghl", () => ({
  getGhlConfig: async () => ({ locationId: "loc", pit: "pit" }),
  ghlFirstUserId: async () => "user1",
  ghlCreateBlogDraft: async () => ({ postId: "b1" }),
  // Speglar den riktiga funktionens media-uppbyggnad (lib/studio/ghl.ts) så testet
  // fångar om anroparen slutar skicka mediaUrls.
  ghlCreateDraft: async (
    _cfg: unknown,
    opts: { mediaUrl?: string; mediaUrls?: string[]; postType?: string },
  ) => {
    const media = (opts.mediaUrls?.length ? opts.mediaUrls : opts.mediaUrl ? [opts.mediaUrl] : []).map((url) => ({ url }));
    ghlUtkast.push({ media, postType: opts.postType });
    return { postId: "ghl1", scheduled: false };
  },
}));

// Skrivreglerna läser klienten; av i testet så captionen lämnas orörd.
vi.mock("@/lib/content/writing-rules", () => ({
  skrivreglerPa: async () => false,
  sanitizeGenerated: (s: string) => s,
}));

vi.mock("@/lib/supabase-admin", () => ({
  supabaseService: () => ({ from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: { id: "x" } }) }) }) }) }),
  supabaseServer: () => ({}),
}));

import { publishContent } from "@/lib/publish";
import { fangaAllaSlides, slideFelText, slideFilnamn } from "@/lib/studio/export-slides";
import { punktNummer } from "@/lib/studio/payload";

const SJU = Array.from({ length: 7 }, (_, i) => `https://cdn.test/slide-${i + 1}.png`);

beforeEach(() => {
  igPostAnrop.length = 0;
  ghlUtkast.length = 0;
});

describe("AKUT-KARUSELL — Instagram direkt", () => {
  it("sju slides publiceras som EN karusell med sju bilder, i ordning", async () => {
    const r = await publishContent({
      clientId: "k1", channel: "ig-graph", postType: "post",
      caption: "Sju sätt att synas i skyltfönstret", mediaUrl: SJU[0], slideUrls: SJU,
    });

    expect(r.status).toBe("published");
    expect(igPostAnrop).toHaveLength(1);
    expect(igPostAnrop[0].path).toBe("carousel");
    expect(igPostAnrop[0].body.antal).toBe("7");
    // Ordningen ÄR karusellen: slide 3 får aldrig hamna före slide 2.
    expect(igPostAnrop[0].body.urls).toBe(SJU.map((u) => u.replace(".png", ".jpg")).join(","));
  });

  it("EN bild går kvar på enkelvägen — en ensam slide är ingen karusell", async () => {
    await publishContent({
      clientId: "k1", channel: "ig-graph", postType: "post",
      caption: "Ett inlägg", mediaUrl: SJU[0], slideUrls: [SJU[0]],
    });
    expect(igPostAnrop[0].path).toBe("single");
  });

  it("utan slideUrls är beteendet exakt som före etappen", async () => {
    await publishContent({
      clientId: "k1", channel: "ig-graph", postType: "post",
      caption: "Ett inlägg", mediaUrl: SJU[0],
    });
    expect(igPostAnrop[0].path).toBe("single");
  });

  it("varje karusellbild JPEG-säkras — Meta avvisar PNG", async () => {
    await publishContent({
      clientId: "k1", channel: "ig-graph", postType: "post",
      caption: "Text", mediaUrl: SJU[0], slideUrls: SJU,
    });
    expect(igPostAnrop[0].body.urls).not.toContain(".png");
  });

  it("en karusell utan bildtext stoppas, precis som en enkel bild", async () => {
    const r = await publishContent({
      clientId: "k1", channel: "ig-graph", postType: "post",
      caption: "   ", mediaUrl: SJU[0], slideUrls: SJU,
    });
    expect(r.status).toBe("failed");
    expect(igPostAnrop).toHaveLength(0);
  });
});

describe("AKUT-KARUSELL — exporten (fångstloopen)", () => {
  // Blob finns inte i node-miljön; en stubbe räcker — testet mäter ANTAL och ORDNING,
  // inte pixlar. Pixlarna är html-to-image:s jobb och prövas i webbläsaren.
  const blobbar = (i: number) => ({ nr: i } as unknown as Blob);

  it("sju slides ger sju bilder, i rätt ordning", async () => {
    const noder = Array.from({ length: 7 }, (_, i) => `nod${i}`);
    const ut = await fangaAllaSlides(7, (i) => noder[i], async (n) => blobbar(noder.indexOf(n as string)));
    expect(ut).toHaveLength(7);
    expect(ut.map((b) => (b as unknown as { nr: number }).nr)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("en slide som inte gick att rita STOPPAR exporten och namnger sliden", async () => {
    const fanga = async (n: unknown) => (n === "nod3" ? null : blobbar(0));
    await expect(fangaAllaSlides(7, (i) => `nod${i}`, fanga)).rejects.toThrow("Slide 4 av 7");
  });

  it("hellre stopp än en karusell som tyst tappar en slide", async () => {
    // Kärnan i hela etappen: det får ALDRIG gå att få ut sex bilder av sju utan besked.
    const fanga = async (n: unknown) => (n === "nod5" ? null : blobbar(0));
    let ut: Blob[] | null = null;
    try { ut = await fangaAllaSlides(7, (i) => `nod${i}`, fanga); } catch { /* förväntat */ }
    expect(ut).toBeNull();
  });

  it("felmeddelandet är på svenska och pekar ut sliden", () => {
    expect(slideFelText(0, 7)).toBe("Slide 1 av 7 kunde inte skapas. Prova igen om en stund.");
  });

  it("filnamnen bär ordningen; en ensam bild får inget nummer", () => {
    expect(slideFilnamn("dt-ark-1080x1350", 0, 7)).toBe("dt-ark-1080x1350-1av7.png");
    expect(slideFilnamn("dt-ark-1080x1350", 6, 7)).toBe("dt-ark-1080x1350-7av7.png");
    expect(slideFilnamn("dt-ark-1080x1350", 0, 1)).toBe("dt-ark-1080x1350.png");
  });
});

describe("Grafiken — text får aldrig skrivas utanför ytan", () => {
  // Mätt i den riktiga renderingen 2026-08-09: ett svenskt sammansatt ord på 34 tecken
  // ("Skyltfonsterlosningsleverantorerna") gick till x=1534 på en 1080 px kanvas — 454 px
  // UTANFÖR — och klipptes tyst av overflow:hidden. Med overflowWrap: 956 px, alltså
  // 124 px innanför, brutet på två rader. Regeln sitter på #studio-canvas och ÄRVS till
  // all text i mallen.
  //
  // Testet läser källan i stället för att rita: en ny mall som glömmer raden ska falla
  // här, inte hos en kund. En regel i globals.css nådde INTE render-ytan (computed värde
  // blev "normal"), därför är den inline — se ArkKarusell.
  const rotFiler = [
    ...fs.readdirSync("components/studio/archetypes").map((f) => `components/studio/archetypes/${f}`),
    ...fs.readdirSync("components/studio/templates").map((f) => `components/studio/templates/${f}`),
  ].filter((f) => f.endsWith(".tsx"));

  it("hittar alla grafikrötter (skyddsnätet mäter något)", () => {
    const medKanvas = rotFiler.filter((f) => fs.readFileSync(f, "utf8").includes('id="studio-canvas"'));
    expect(medKanvas.length).toBeGreaterThanOrEqual(10);
  });

  it("VARJE mall med en kanvas bär skyddet mot ord som spränger ytan", () => {
    const utan = rotFiler
      .filter((f) => fs.readFileSync(f, "utf8").includes('id="studio-canvas"'))
      .filter((f) => !fs.readFileSync(f, "utf8").includes('overflowWrap: "break-word"'));
    expect(utan, `Mallar utan overflowWrap: ${utan.join(", ")}`).toEqual([]);
  });
});

describe("AKUT-KARUSELL — punktnumret", () => {
  // Numret på punkt-sliden räknar BARA punkter, så slide 6 kan visa "04". Det är rätt för
  // läsaren (01, 02, 03 som en lista) men lästes i editorn som slidens plats. Uträkningen
  // bor nu i lib/studio/payload så mallen och etiketterna aldrig kan räkna olika.
  const kar = (kinds: ("hook" | "point" | "cta")[]) =>
    kinds.map((kind) => ({ kind, headline: "", body: "", imageUrl: "" }));

  it("krok och avslut hoppas över — slide 6 är punkt 04", () => {
    // Håkans karusell 2026-08-09: Krok, P, P, P, Avslut, P, P, Avslut.
    const s = kar(["hook", "point", "point", "point", "cta", "point", "point", "cta"]);
    expect(punktNummer(s, 1)).toBe(1);
    expect(punktNummer(s, 3)).toBe(3);
    expect(punktNummer(s, 5)).toBe(4); // slide 6 → "04"
    expect(punktNummer(s, 6)).toBe(5);
  });

  it("krok och avslut har inget punktnummer", () => {
    const s = kar(["hook", "point", "cta"]);
    expect(punktNummer(s, 0)).toBeNull();
    expect(punktNummer(s, 2)).toBeNull();
  });

  it("en karusell utan avslut numreras rakt igenom", () => {
    const s = kar(["hook", "point", "point", "point"]);
    expect(s.map((_, i) => punktNummer(s, i))).toEqual([null, 1, 2, 3]);
  });
});

describe("AKUT-KARUSELL — GHL-utkastet", () => {
  it("alla sju bilderna följer med i media-arrayen", async () => {
    await publishContent({
      clientId: "k1", channel: "ghl-social", accountIds: ["a1"], postType: "post",
      caption: "Text", mediaUrl: SJU[0], slideUrls: SJU,
    });
    expect(ghlUtkast).toHaveLength(1);
    expect(ghlUtkast[0].media.map((m) => m.url)).toEqual(SJU);
  });

  it("enkel bild ger fortfarande exakt ett media-objekt", async () => {
    await publishContent({
      clientId: "k1", channel: "ghl-social", accountIds: ["a1"], postType: "post",
      caption: "Text", mediaUrl: SJU[0],
    });
    expect(ghlUtkast[0].media).toEqual([{ url: SJU[0] }]);
  });
});
