// KANAL-2 — kanalanatomier som DATA (HELG-1 DEL 5, 2026-08-21).
//
// Samma mönster som lib/format-anatomi.ts (G-2): en dramaturgi/regeluppsättning som legat
// hårdkodad och utspridd (app/api/studio/adapt-channel/route.ts hade CHANNEL_KEYS/
// CHANNEL_LABEL/CHANNEL_GUIDE som en egen, hårdkodad 3-lista) flyttas hit som EN källa —
// prompt-core-vägen (adapt-channel), kanalväljaren (StudioMaker) och förhandsvisningen
// (ChannelPreview) läser alla härifrån i stället för att var och en gissa sin egen lista.
//
// Klientsäker: ingen DB, inga hemligheter, inga server-importer — precis som format-anatomi.
//
// ⚠ EJ VERIFIERAT FÖR FEM AV NIO KANALER. `ghlPlatform` för ig/fb/li/google är MÄTT mot
// skarpa GHL-konton (se docs/STATUS.md, KANAL-2-utredningen): "instagram", "facebook",
// "linkedin", "google". För tiktok/pinterest/youtube/threads/bluesky finns i skrivande
// stund INGEN tenant med kopplingen påslagen, och GHL:s egen API-dokumentation ger bara
// exemplet "google" — inte de andra fem. Strängarna nedan är GHL:s egna produktnamn i
// gemener, alltså den mest sannolika gissningen, men de är INTE mätta. Går de fel gör det
// ingen skada: kanalen matchar då bara inte mot ghlAccounts och visas aldrig som kopplad
// (fail-closed, samma princip som resten av kodbasen) — rätta strängen i EN rad här den
// dagen någon tenant faktiskt kopplar in en av dem.
export const KANAL_NYCKLAR = ["ig", "fb", "li", "google", "tiktok", "pinterest", "youtube", "threads", "bluesky"] as const;
export type KanalKey = (typeof KANAL_NYCKLAR)[number];

export interface KanalAnatomi {
  key: KanalKey;
  namn: string;
  /** GHL:s platform-sträng i /social-media-posting/{loc}/accounts. */
  ghlPlatform: string;
  /** Mätt mot ett skarpt konto, eller bästa gissning (se filhuvudet). */
  verifieradPlattformstrang: boolean;
  /** Mjukt tak, tecken. Modellen får det som riktvärde. */
  maxLangd: number;
  /** Går rakt in i kanalguiden (adapt-channel) — längd, ton, hashtagbruk, CTA-form. */
  ton: string;
  hashtagbruk: string;
  ctaForm: string;
  /** "bild" = stillbild/karusell krävs, "video" = video krävs, "vilken" = båda funkar. */
  kravInnehallstyp: "bild" | "video" | "vilken";
}

export const KANAL_ANATOMI: Record<KanalKey, KanalAnatomi> = {
  ig: {
    key: "ig", namn: "Instagram", ghlPlatform: "instagram", verifieradPlattformstrang: true,
    maxLangd: 2200,
    ton: "Varmt och konkret, radbryt för luft. Emoji sparsamt (0–2).",
    hashtagbruk: "3–5 relevanta hashtags på sista raden.",
    ctaForm: "EN uppmaning, direkt och konkret.",
    kravInnehallstyp: "vilken",
  },
  fb: {
    key: "fb", namn: "Facebook", ghlPlatform: "facebook", verifieradPlattformstrang: true,
    maxLangd: 63000,
    ton: "Samtalston, gärna en fråga som bjuder in till kommentar. Kortare stycken.",
    hashtagbruk: "Nästan inga (0–1). Ingen hashtag-vägg.",
    ctaForm: "Uppmaningen i klartext, länkvänlig ton.",
    kravInnehallstyp: "vilken",
  },
  li: {
    key: "li", namn: "LinkedIn", ghlPlatform: "linkedin", verifieradPlattformstrang: true,
    maxLangd: 3000,
    ton: "Professionell och insiktsdriven, aldrig säljig. De första ~140 tecknen bär hela kroken (det som syns före \"…se mer\").",
    hashtagbruk: "2–3 branschhashtags.",
    ctaForm: "Konkret nästa steg, aldrig \"hör av dig\" i klartext.",
    kravInnehallstyp: "vilken",
  },
  google: {
    // Google Business Profile. STATUS.md (KANAL-2-utredningen): "GBP kommer redan med i
    // API-svaret som platform: google" — bekräftat mot DT:s riktiga koppling.
    key: "google", namn: "Google Business Profile", ghlPlatform: "google", verifieradPlattformstrang: true,
    maxLangd: 1500,
    ton: "Sakligt och lokalt förankrat — det här är sökresultatet, inte ett flöde. Ingen storytelling, gå rakt på vad kunden hittar/får.",
    hashtagbruk: "Inga hashtags — GBP-inlägg använder dem inte.",
    ctaForm: "En knapp med mål-URL (Boka/Beställ/Läs mer/Kontakta) — texten ska peka mot exakt DEN handlingen, inte en generisk uppmaning i brödtexten.",
    kravInnehallstyp: "bild",
  },
  tiktok: {
    key: "tiktok", namn: "TikTok", ghlPlatform: "tiktok", verifieradPlattformstrang: false,
    maxLangd: 2200,
    ton: "Rakt på sak, informell, byggd för att sägas högt i videon — texten är en bildtext till klippet, inte bäraren av budskapet.",
    hashtagbruk: "3–5, blanda breda och nischade.",
    ctaForm: "Kort uppmaning, ofta \"följ för mer\" eller en direkt handling.",
    kravInnehallstyp: "video",
  },
  pinterest: {
    key: "pinterest", namn: "Pinterest", ghlPlatform: "pinterest", verifieradPlattformstrang: false,
    maxLangd: 500,
    ton: "Beskrivande och sökbart — folk hittar pinnen via sökord, inte via flödet. Skriv som en produktbeskrivning med känsla.",
    hashtagbruk: "2–4, sökordsartade snarare än trendiga.",
    ctaForm: "Vad man gör när man klickar sig vidare (läs/handla/spara idén).",
    kravInnehallstyp: "bild",
  },
  youtube: {
    key: "youtube", namn: "YouTube", ghlPlatform: "youtube", verifieradPlattformstrang: false,
    maxLangd: 5000,
    ton: "Beskrivningstext till videon — första två raderna syns utan att klicka \"visa mer\", de måste bära hela löftet.",
    hashtagbruk: "Max 3, GHL/YouTube visar bara de tre första ovanför titeln.",
    ctaForm: "Prenumerera/nästa video/länk i beskrivningen — aldrig i själva videotexten.",
    kravInnehallstyp: "video",
  },
  threads: {
    key: "threads", namn: "Threads", ghlPlatform: "threads", verifieradPlattformstrang: false,
    maxLangd: 500,
    ton: "Kort, personligt, samtalsstartande — som en tanke, inte ett färdigt inlägg.",
    hashtagbruk: "Inga — Threads hashtaggar knappt används.",
    ctaForm: "En fråga eller ett ställningstagande som bjuder in svar, sällan en säljande uppmaning.",
    kravInnehallstyp: "vilken",
  },
  bluesky: {
    key: "bluesky", namn: "Bluesky", ghlPlatform: "bluesky", verifieradPlattformstrang: false,
    maxLangd: 300,
    ton: "Kort och rakt, som gamla Twitter — en tanke per inlägg, inget utfyllnadsspråk.",
    hashtagbruk: "0–2, sparsamt.",
    ctaForm: "Kort och direkt, plats är dyrbar.",
    kravInnehallstyp: "vilken",
  },
};

/** Fritextguiden per kanal, för prompten (adapt-channel). Byggd ur samma data som resten. */
export function kanalGuideText(k: KanalKey): string {
  const a = KANAL_ANATOMI[k];
  return `${a.namn}: ${a.ton} Hashtags: ${a.hashtagbruk} Uppmaning: ${a.ctaForm} (max ~${a.maxLangd} tecken).`;
}

/** GHL platform-sträng → vår KanalKey. null om okänd (visas aldrig, fail-closed). */
export function kanalForGhlPlatform(platform: string): KanalKey | null {
  const p = (platform || "").toLowerCase().trim();
  const funnen = KANAL_NYCKLAR.find((k) => KANAL_ANATOMI[k].ghlPlatform === p);
  return funnen ?? null;
}

// ── Kanalstatus ur GHL-kontona — DEL 5, ren logik, testbar utan att rendera komponenten ──

export interface GhlKonto { platform: string; isExpired?: boolean }

/** Alla GHL-konton som matchar en given kanal, oavsett status. */
export function kontonFor(k: KanalKey, ghlAccounts: GhlKonto[]): GhlKonto[] {
  return ghlAccounts.filter((a) => kanalForGhlPlatform(a.platform) === k);
}

/** Kanalen är publicerbar: minst ett icke-utgånget konto. */
export function arAnsluten(k: KanalKey, ghlAccounts: GhlKonto[]): boolean {
  return kontonFor(k, ghlAccounts).some((a) => !a.isExpired);
}

/** Kopplingen FANNS men samtliga konton för kanalen har gått ut — "behöver förnyas",
 * skild från "aldrig kopplad" (DEL 5 punkt 4). */
export function arUtgangen(k: KanalKey, ghlAccounts: GhlKonto[]): boolean {
  const konton = kontonFor(k, ghlAccounts);
  return konton.length > 0 && konton.every((a) => a.isExpired);
}

/**
 * Vilka av de nio kanalerna kanalväljaren ska visa. `alltidSynliga` (ig/fb/li) visas
 * oavsett koppling (oförändrat beteende, IG har en egen native-väg utöver GHL); övriga
 * bara vid en matchande GHL-koppling, aktiv ELLER utgången (en utgången ska SYNAS, inte
 * försvinna). `arVideo` filtrerar på innehållstyp (DEL 5 punkt 3): video-kanaler visas
 * bara för videoinnehåll, bild-kanaler bara för icke-video.
 */
export function synligaKanaler(
  ghlAccounts: GhlKonto[],
  arVideo: boolean,
  alltidSynliga: readonly KanalKey[] = ["ig", "fb", "li"],
): KanalKey[] {
  return KANAL_NYCKLAR.filter((k) => {
    if (alltidSynliga.includes(k)) return true;
    if (!arAnsluten(k, ghlAccounts) && !arUtgangen(k, ghlAccounts)) return false;
    const krav = KANAL_ANATOMI[k].kravInnehallstyp;
    if (krav === "video") return arVideo;
    if (krav === "bild") return !arVideo;
    return true;
  });
}
