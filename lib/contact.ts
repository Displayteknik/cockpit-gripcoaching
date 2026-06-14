// Enda källa till HM Motors kontaktuppgifter.
// Importera HÄRIFRÅN i alla komponenter — hårdkoda ALDRIG telefon/mejl någon annanstans.
export const CONTACT = {
  company: "HM Motor",
  phoneDisplay: "070-321 82 32",
  phoneHref: "tel:+46703218232",
  emailDisplay: "info@hmmotor.se",
  emailHref: "mailto:info@hmmotor.se",
  address1: "Krokomsporten 13",
  address2: "835 95 Krokom",
  addressFull: "Krokomsporten 13, 835 95 Krokom",
  hoursShort: "Mån–Fre 08–17",
} as const;

// Vart lead-notiser skickas. hakan@gripcoaching.se = kopia i början (lätt att ta bort).
export const LEAD_RECIPIENTS: string[] = ["info@hmmotor.se", "hakan@gripcoaching.se"];
