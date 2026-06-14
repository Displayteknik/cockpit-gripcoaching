// Enda källa till HM Motors kontaktuppgifter.
// Importera HÄRIFRÅN i alla komponenter — hårdkoda ALDRIG telefon/mejl/adress någon annanstans.
export const CONTACT = {
  company: "HM Motor",
  phoneDisplay: "0640-62758",
  phoneHref: "tel:+4664062758",
  emailDisplay: "info@hmmotor.se",
  emailHref: "mailto:info@hmmotor.se",
  address1: "Rydells väg 9d",
  address2: "835 32 Krokom",
  addressFull: "Rydells väg 9d, 835 32 Krokom",
  hoursShort: "Mån–Tor 08–17 · Fre 08–16",
  hoursLines: [
    "Måndag–Torsdag: 08:00–17:00",
    "Fredag: 08:00–16:00",
    "Lördag: Efter avtal",
    "Söndag: Stängt",
  ],
} as const;

// Vart lead-notiser skickas. hakan@gripcoaching.se = kopia i början (lätt att ta bort).
export const LEAD_RECIPIENTS: string[] = ["info@hmmotor.se", "hakan@gripcoaching.se"];

// Avsändare för lead-mejl. MÅSTE vara verifierad domän hos Resend (mysales.se),
// annars vägrar Resend skicka till andra än kontots egen adress. (onboarding@resend.dev funkar EJ.)
export const LEAD_FROM = "HM Motor <noreply@mysales.se>";
