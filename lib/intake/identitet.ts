// PROFIL-1/F-intake — skyddet för identitetsfälten.
//
// Rotorsaken bakom HM Motor-felet: /api/intake/commit skrev över usp, icp_primary
// och services rakt av. En Ikigai-körning mot standardtenanten gjorde därmed
// bilhandlaren i Krokom till en coachingverksamhet, och ingen mätning i systemet
// kunde upptäcka det efteråt (kvalitetsmätaren sa bara "tunn profil").
//
// Regeln: en skrivning som ERSÄTTER ett ifyllt identitetsfält kräver ett uttryckligt
// beslut. Tomt → ifyllt skrivs direkt (ingen förlust). Tillägg rör aldrig befintlig
// text. Ren funktion, ingen DB — så den kan testas.

/** Fält som definierar VEM klienten är. Överskrivning här kan byta bransch. */
export const IDENTITETSFALT: Record<string, string> = {
  usp: "Det som skiljer er (USP)",
  icp_primary: "Primär målgrupp",
  icp_secondary: "Sekundär målgrupp",
  services: "Tjänster och produkter",
  differentiators: "Differentiering",
  brand_story: "Brand story",
  tagline: "Tagline",
};

export interface IdentitetsDiff {
  field: string;
  label: string;
  current: string;
  proposed: string;
}

const KLIPP = 600;

function forhandsvisa(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length > KLIPP ? `${s.slice(0, KLIPP)}…` : s;
}

function likaVarden(a: unknown, b: unknown): boolean {
  return String(a ?? "").replace(/\s+/g, " ").trim() === String(b ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Vilka identitetsfält skulle ERSÄTTAS med ett annat värde?
 * @param profil       nuvarande hm_brand_profile-rad (null = ingen profil ännu)
 * @param uppdateringar de fält som är på väg att skrivas
 * @param overskrivna   fälten där skrivningen ersätter i stället för att lägga till
 */
export function berakraIdentitetsDiff(
  profil: Record<string, unknown> | null | undefined,
  uppdateringar: Record<string, string>,
  overskrivna: Set<string>,
): IdentitetsDiff[] {
  const diff: IdentitetsDiff[] = [];
  for (const field of Object.keys(uppdateringar)) {
    if (!IDENTITETSFALT[field] || !overskrivna.has(field)) continue;
    const nuvarande = String(profil?.[field] ?? "").trim();
    if (!nuvarande) continue; // tomt → ifyllt: ingen förlust
    if (likaVarden(nuvarande, uppdateringar[field])) continue; // ingen faktisk ändring
    diff.push({
      field,
      label: IDENTITETSFALT[field],
      current: forhandsvisa(nuvarande),
      proposed: forhandsvisa(uppdateringar[field]),
    });
  }
  return diff;
}
