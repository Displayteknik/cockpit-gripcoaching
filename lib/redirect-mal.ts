// Vart användaren skickas EFTER inloggning. Målet kommer utifrån: proxy:n sätter
// ?from=<sökväg+query> när en skyddad adress nås utloggad, men adressfältet går att
// skriva för hand och länken kan komma ur ett mejl.
//
// Enda giltiga målet är en sökväg på vår egen domän. Fällan är att "börjar med /" inte
// räcker: webbläsaren tolkar "//annan.se" (och "/\annan.se") som en FULL adress, så en
// naiv kontroll hade skickat den som precis loggat in vidare till någon annans sajt med
// en färsk session i bagaget.

export const STANDARD_MAL = "/dashboard";

export function sakertRedirectMal(raw: string | null | undefined): string {
  const s = String(raw || "");
  if (!s.startsWith("/")) return STANDARD_MAL;      // absolut adress eller tomt
  if (s.startsWith("//") || s.startsWith("/\\")) return STANDARD_MAL; // protokoll-relativ
  return s;
}
