// ONBOARD-1 — komplettering från Google Business Profile.
//
// Kravet: "Komplettera med Google Business Profile för samma företag OM DET GÅR."
// Därför är hela den här filen fail-open: allt som går fel returneras som
// `tillganglig: false` med en läsbar förklaring. Ingenting här får fälla onboardingen.
//
// ★ NYCKELN ÄR INTE `GEMINI_API_KEY`, OCH DET ÄR INTE ETT MISSTAG.
//
// Konventionen i projektet är att återanvända `GEMINI_API_KEY` för alla Google-API:er.
// Den går inte att följa här, och det är verifierat 2026-08-06, inte antaget:
//
//   places.googleapis.com  → 401 CREDENTIALS_MISSING
//                            "API keys are not supported by this API."
//   maps.googleapis.com    → REQUEST_DENIED "The provided API key is invalid."
//
// Orsaken är att den kanoniska Google-nyckeln är en AI Studio-nyckel (nytt `AQ.`-format).
// AI Studio-nycklar är dedikerade för Generative Language API och är inte Cloud-nycklar —
// de kan därför inte auktorisera Maps/Places, oavsett vilka API:er som aktiveras.
//
// Places kräver alltså en RIKTIG Cloud-API-nyckel med "Places API (New)" aktiverat.
// Tills en sådan finns i env svarar steget ärligt att det inte är aktiverat, i stället
// för att låtsas att företaget saknar Google-profil.

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

/** Egen nyckel krävs — se filhuvudet. `GOOGLE_API_KEY` accepteras som alias. */
const nyckel = (): string => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || "";

export interface GbpResultat {
  /** False = vi kunde inte fråga Google alls. Då säger tomma fält ingenting om företaget. */
  tillganglig: boolean;
  fel: string | null;
  kategori: string | null;
  adress: string | null;
  ort: string | null;
  betyg: number | null;
  antalRecensioner: number | null;
  oppettider: { dag: string; tider: string }[];
  /** Länk till Google-profilen, för granskningsvyns källhänvisning. */
  kallUrl: string | null;
}

const tomtSvar = (fel: string): GbpResultat => ({
  tillganglig: false,
  fel,
  kategori: null,
  adress: null,
  ort: null,
  betyg: null,
  antalRecensioner: null,
  oppettider: [],
  kallUrl: null,
});

interface PlacesSvar {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    primaryTypeDisplayName?: { text?: string };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    websiteUri?: string;
    googleMapsUri?: string;
  }[];
  error?: { message?: string; status?: string };
}

/** Samma värd utan www — så att "displayteknik.se" och "www.displayteknik.se" matchar. */
const bareHost = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
};

/**
 * Slår upp företaget i Google Places och plockar kategori, adress, öppettider och betyg.
 *
 * ★ Träffen accepteras BARA när Googles `websiteUri` pekar på samma domän som vi
 *   onboardar. Utan den kontrollen hade "Quality Dental" i Göteborg kunnat matcha en
 *   helt annan klinik med liknande namn, och vi hade skrivit fel adress och fel
 *   öppettider i kundens konto. Ett tomt fält är bättre än en förväxling.
 */
export async function hamtaGbp(sok: {
  namn: string | null;
  ort: string | null;
  hemsida: string;
}): Promise<GbpResultat> {
  const key = nyckel();
  if (!key) {
    return tomtSvar(
      "GOOGLE_PLACES_API_KEY saknas i env. Google-profilen hämtades inte (den kanoniska GEMINI_API_KEY är en AI Studio-nyckel och fungerar inte mot Places).",
    );
  }
  if (!sok.namn) {
    return tomtSvar("Företagsnamnet gick inte att läsa av sajten, så Google-profilen kunde inte slås upp.");
  }

  const fraga = [sok.namn, sok.ort].filter(Boolean).join(" ");

  try {
    const r = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.rating",
          "places.userRatingCount",
          "places.primaryTypeDisplayName",
          "places.regularOpeningHours",
          "places.websiteUri",
          "places.googleMapsUri",
        ].join(","),
      },
      body: JSON.stringify({ textQuery: fraga, languageCode: "sv", regionCode: "SE", maxResultCount: 5 }),
      signal: AbortSignal.timeout(12000),
    });

    const data = (await r.json()) as PlacesSvar;

    if (!r.ok) {
      // Nyckeln loggas aldrig — bara Googles felmeddelande.
      return tomtSvar(`Google Places svarade HTTP ${r.status}: ${data?.error?.message || "okänt fel"}`);
    }

    const traffar = data.places ?? [];
    if (!traffar.length) return tomtSvar(`Google hittade ingen profil för "${fraga}".`);

    const vardHemsida = bareHost(sok.hemsida);
    const traff = traffar.find((p) => p.websiteUri && bareHost(p.websiteUri) === vardHemsida);

    if (!traff) {
      return tomtSvar(
        `Google hittade ${traffar.length} företag som heter något liknande, men ingen med webbadressen ${vardHemsida} — ingen matchning godtogs.`,
      );
    }

    const oppettider = (traff.regularOpeningHours?.weekdayDescriptions ?? [])
      .map((rad) => {
        const i = rad.indexOf(":");
        if (i < 0) return null;
        return { dag: rad.slice(0, i).trim(), tider: rad.slice(i + 1).trim() };
      })
      .filter((x): x is { dag: string; tider: string } => x !== null);

    // Adressen kommer som "Gatan 1, 123 45 Stad, Sverige". Orten är näst sista delen.
    const delar = (traff.formattedAddress ?? "").split(",").map((d) => d.trim());
    const ortDel = delar.length >= 2 ? delar[delar.length - 2] : null;
    const ort = ortDel ? ortDel.replace(/^\d{3}\s?\d{2}\s*/, "").trim() || null : null;

    return {
      tillganglig: true,
      fel: null,
      kategori: traff.primaryTypeDisplayName?.text ?? null,
      adress: traff.formattedAddress ?? null,
      ort,
      betyg: typeof traff.rating === "number" ? traff.rating : null,
      antalRecensioner: typeof traff.userRatingCount === "number" ? traff.userRatingCount : null,
      oppettider,
      kallUrl: traff.googleMapsUri ?? null,
    };
  } catch (e) {
    const namn = (e as { name?: string })?.name;
    if (namn === "TimeoutError" || namn === "AbortError") return tomtSvar("Google Places svarade inte i tid.");
    return tomtSvar(`Google Places gick inte att nå: ${e instanceof Error ? e.message : String(e)}`);
  }
}
