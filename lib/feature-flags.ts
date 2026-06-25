// Per-klient påslag för funktioner som rullas ut en kund i taget (innan bred lansering).
// Lägg till fler client_id för att aktivera, eller ta bort grinden för att slå på för alla.

// "Sökords-förslag" på kundens SEO-sida (Vad ska du ranka på?).
const KEYWORD_IDEAS_CLIENT_IDS = new Set<string>([
  "440e6cf2-ae93-4ab8-9515-2f738861ef31", // Ledarskapskultur (Carl-Fredrik Zetterman)
]);

export function hasKeywordIdeas(clientId: string | null | undefined): boolean {
  return !!clientId && KEYWORD_IDEAS_CLIENT_IDS.has(clientId);
}
