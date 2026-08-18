// Saknad kontaktuppgift → systemet letar själv, i stället för att be Håkan fylla i.
//
// BAKGRUND (18/8): tre kontakter skapades utan e-post med motiveringen "jag hittar inte på
// adresser". Adresserna fanns hela tiden i Håkans egen Gmail — jag hade bara mätt ETT
// ställe (GHL) och uttalat mig om alla. Hans invändning var systemisk och rätt: ett fält
// han måste fylla i är sällan lösningen.
//
// DESIGNVAL: förslaget SPARAS INTE. Det räknas ut när kortet öppnas, och bara när fältet
// är tomt — så fort adressen är sparad i MySales försvinner rutan av sig själv. Ingen
// tabell, ingen livscykel, inget att städa. Ett avvisat förslag kostar ett ögonkast nästa
// gång, vilket är billigare än en migration och en status att hålla i synk.
//
// SANNINGSKRAV: bara adresser som FAKTISKT förekommer i korrespondens med namnet/företaget.
// Ingen gissning ur domännamn, inga konstruerade fornamn.efternamn@foretag.se.

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Egna adresser ska aldrig föreslås som kundens. */
const EGNA_DOMANER = ["displayteknik.se", "gripcoaching.se", "mysales.se"];

/** Avsändare som aldrig är en kund: nyhetsbrev, notiser, system. */
const SKRAP = /noreply|no-reply|notifications?@|mailer|newsletter|@e\.|@mail\.|linkedin\.com|beehiiv|system@/i;

export interface Kontaktforslag {
  epost: string;
  /** Antal mejl adressen förekommer i — fler träffar = starkare belägg. */
  traffar: number;
  /** Det senaste ämnet adressen syntes i. Belägget ska ALLTID gå att läsa i UI:t. */
  senasteAmne: string;
  senasteDatum: string; // ÅÅÅÅ-MM-DD
}

function adresserUr(varde: string): string[] {
  return (varde.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).map((a) => a.toLowerCase());
}

function egen(adress: string): boolean {
  return EGNA_DOMANER.some((d) => adress.endsWith(`@${d}`));
}

/**
 * Söker Håkans Gmail på kontaktens namn (och företag) och plockar ut motpartens
 * adress ur träffarna. Fail-open: kan inte Gmail nås returneras tom lista — ett kort
 * ska aldrig fallera för att en bonusfunktion inte svarar.
 */
export async function hittaKontaktuppgifter(
  token: string,
  namn: string | null,
  foretag: string | null,
  max = 10,
): Promise<Kontaktforslag[]> {
  const fragor = [namn, foretag].map((f) => (f || "").trim()).filter((f) => f.length >= 3);
  if (!fragor.length) return [];

  const rakning = new Map<string, Kontaktforslag>();

  for (const q of fragor) {
    let ids: string[] = [];
    try {
      const r = await fetch(`${GMAIL}/messages?maxResults=${max}&q=${encodeURIComponent(`"${q}"`)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) continue;
      const d = (await r.json()) as { messages?: Array<{ id: string }> };
      ids = (d.messages || []).map((m) => m.id);
    } catch {
      continue; // fail-open
    }

    for (const id of ids) {
      try {
        const m = await fetch(`${GMAIL}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!m.ok) continue;
        const d = (await m.json()) as {
          internalDate?: string;
          payload?: { headers?: Array<{ name: string; value: string }> };
        };
        const h = d.payload?.headers || [];
        const hv = (n: string) => h.find((x) => x.name.toLowerCase() === n)?.value || "";
        const amne = hv("subject") || "(utan ämne)";
        const datum = d.internalDate ? new Date(Number(d.internalDate)).toISOString().slice(0, 10) : "";

        // Både avsändare och mottagare räknas: kunden kan lika gärna vara den Håkan
        // skrivit TILL som den som skrivit till honom.
        for (const adress of [...adresserUr(hv("from")), ...adresserUr(hv("to"))]) {
          if (egen(adress) || SKRAP.test(adress)) continue;
          const fanns = rakning.get(adress);
          if (fanns) {
            fanns.traffar += 1;
            if (datum > fanns.senasteDatum) {
              fanns.senasteDatum = datum;
              fanns.senasteAmne = amne;
            }
          } else {
            rakning.set(adress, { epost: adress, traffar: 1, senasteAmne: amne, senasteDatum: datum });
          }
        }
      } catch {
        /* hoppa över meddelandet, inte hela sökningen */
      }
    }
  }

  // Flest träffar först, senaste korrespondens som skiljedomare.
  return [...rakning.values()]
    .sort((a, b) => b.traffar - a.traffar || b.senasteDatum.localeCompare(a.senasteDatum))
    .slice(0, 3);
}
