// Delad sidmatchning — används av page-text-routen (auto-läs rätt sida) OCH dashboarden
// (hitta sökord som rankar på FEL sida = kannibalisering). En källa så logiken inte driver isär.

export const urlHost = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
};

// Normalisera för slug-matchning: gemener, å/ä→a, ö→o, bara bokstäver/siffror.
const norm = (s: string) => s.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]/g, "");

// Jämför två URL:ers sökväg (utan www/trailing slash) — true om de pekar på samma sida.
export const samePagePath = (a: string, b: string) => {
  const p = (u: string) => { try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return u; } };
  return p(a).toLowerCase() === p(b).toLowerCase();
};

// Hämtar sidlistan från klientens sitemap (med timeout, tål fel → tom lista).
export async function fetchSitemapPages(clientHost: string): Promise<string[]> {
  if (!clientHost) return [];
  try {
    const res = await fetch(`https://${clientHost}/sitemap.xml`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi))
      .map((m) => m[1].trim())
      .filter((l) => urlHost(l) === clientHost);
  } catch { return []; }
}

// Väljer den sida vars adress bäst matchar sökordet (flest delade tokens). Annars fallback.
export function bestPageForKeyword(locs: string[], keyword: string, fallback: string): string {
  const tokens = keyword.split(/[^A-Za-zÀ-ÿ0-9]+/).map(norm).filter((t) => t.length >= 3);
  if (tokens.length === 0 || locs.length === 0) return fallback;
  let best = fallback, bestScore = 0;
  for (const loc of locs) {
    let slug = "";
    try { slug = norm(new URL(loc).pathname); } catch { continue; }
    if (!slug) continue; // startsidan har ingen slug
    const score = tokens.reduce((s, t) => s + (slug.includes(t) ? t.length : 0), 0);
    if (score > bestScore) { bestScore = score; best = loc; }
  }
  return bestScore > 0 ? best : fallback;
}
