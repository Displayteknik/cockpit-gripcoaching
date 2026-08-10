// BETAL-1 — vilken adress kunden ska skickas till och tillbaka från.
//
// ⚠ FALLGROPEN som gjorde den här filen nödvändig: `VERCEL_URL` sätts ALLTID på Vercel,
// och den pekar på den enskilda deployen (hmmotor-next-abc123.vercel.app), inte på
// cockpit.gripcoaching.se. Med den som fallback hade en kund som betalat i Stripe landat
// på en adress hon aldrig sett, och påminnelsemejlen hade länkat till samma ställe.
//
// Ordningen är därför: uttrycklig inställning → produktionsdomänen → deployens adress
// (bara i förhandsvisningar) → localhost.
//
// Sätt `NEXT_PUBLIC_SITE_URL` i Vercel så styr den allt. Utan den gissar vi rätt ändå.

const PRODUKTIONSDOMAN = "https://cockpit.gripcoaching.se";

export function basadress(): string {
  const uttrycklig = process.env.NEXT_PUBLIC_SITE_URL;
  if (uttrycklig) return uttrycklig.replace(/\/+$/, "");

  // Skarp deploy → alltid den riktiga domänen, aldrig deployens egen adress.
  if (process.env.VERCEL_ENV === "production") return PRODUKTIONSDOMAN;

  // Förhandsvisning på Vercel → deployens adress är rätt där.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3480";
}

/** Adressen Stripe ska skicka sina händelser till. Visas i adminvyn för kopiering. */
export function webhookAdress(): string {
  return `${basadress()}/api/stripe/webhook`;
}
