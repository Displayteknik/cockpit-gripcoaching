// BILD-3 — Graph API-fel → mänsklig klartext med åtgärd. Spec: docs/studio/BILD-PAKET-SPEC.md.
// Kärnpunkt: används av igGet/igPost så ALLA IG-anrop (publicering, insights, hälsovakt)
// ger användbara fel i stället för rå Graph-JSON i en alert-ruta. Råfelet loggas server-side.

const REGLER: { monster: RegExp; text: string }[] = [
  {
    monster: /Tried accessing nonexisting field/i,
    text: "Fel typ av id för det här anropet. Det här ser ut som ett Facebook-sid-id — fältet vill ha Instagram-kontots id, som börjar med 17841. Kontrollera kopplingen under Anslut Instagram.",
  },
  {
    monster: /Object with ID .* does not exist|cannot be loaded due to missing permissions|Unsupported get request/i,
    text: "Kontot med det id:t hittas inte, eller så saknar åtkomsttokenen behörighet till det. Kontrollera att Instagram-id:t börjar med 17841 och att tokenen hör till samma Facebook-sida.",
  },
  {
    monster: /Session has expired|Error validating access token|The access token could not be decrypted|has been invalidated/i,
    text: "Åtkomsttokenen har gått ut eller ogiltigförklarats. Koppla om kontot under Anslut Instagram så hämtas en ny.",
  },
  {
    monster: /image format|Bilden kunde inte hämtas|Media type is not supported|The submitted image is invalid/i,
    text: "Instagram kunde inte läsa bilden (format eller storlek). Ladda upp som JPEG och försök igen.",
  },
  {
    monster: /\(#9\)|application request limit|media_publish.*limit|has reached its content publishing limit/i,
    text: "Publiceringsgränsen är nådd (Instagram tillåter max 25 API-publiceringar per dygn och konto). Vänta och försök igen senare, eller schemalägg.",
  },
  {
    monster: /\(#10\)|Application does not have permission|requires (the )?extended permission/i,
    text: "Appen saknar behörighet för det här anropet. Kontrollera att kopplingen gjordes med rätt behörigheter (instagram_content_publish) under Anslut Instagram.",
  },
  {
    monster: /\(#4\)|User request limit reached/i,
    text: "För många anrop på kort tid — Instagram bromsar tillfälligt. Vänta någon minut och försök igen.",
  },
];

/**
 * Översätt ett rått Graph-fel (ofta "IG POST /xxx: {json}") till klartext med åtgärd.
 * Okänt fel → Graph:s egna "message" (utan teknisk inramning) + uppmaning, aldrig rå JSON.
 */
export function oversattGraphFel(ratt: string): string {
  for (const r of REGLER) {
    if (r.monster.test(ratt)) return r.text;
  }
  // Plocka ut Graphs "message" ur inbäddad JSON om den finns.
  const m = ratt.match(/"message"\s*:\s*"([^"]{5,300})"/);
  if (m) return `Instagram svarade: ${m[1]}. Försök igen — kvarstår felet, kontrollera kopplingen under Anslut Instagram.`;
  return "Publiceringen misslyckades hos Instagram. Försök igen — kvarstår felet, kontrollera kopplingen under Anslut Instagram.";
}

// BILD-3: id-validering FÖRE Meta-anrop — fångar förväxlade id-fält i formulären.
export const IG_ID_MONSTER = /^17841\d{6,}$/;
export function valideraIgId(id: string): string | null {
  const t = id.trim();
  if (!t) return "Fyll i Instagram-kontots id.";
  if (!/^\d+$/.test(t)) return "Id:t ska bara innehålla siffror.";
  if (!IG_ID_MONSTER.test(t)) return "Det här ser inte ut som ett Instagram-konto-id — det ska börja med 17841. Ett kortare numeriskt id är oftast Facebook-sidans id.";
  return null;
}
export function valideraPageId(id: string): string | null {
  const t = id.trim();
  if (!t) return "Fyll i sid-id.";
  if (!/^\d+$/.test(t)) return "Sid-id:t ska bara innehålla siffror.";
  if (IG_ID_MONSTER.test(t)) return "Det här ser ut som ett Instagram-konto-id (17841…) — fältet vill ha Facebook-sidans id.";
  return null;
}
export function valideraMetaToken(token: string): string | null {
  const t = token.trim();
  if (!t) return "Fyll i åtkomsttoken.";
  if (!t.startsWith("EAA")) return "Tokenen ser inte ut som en Meta-token — den ska börja med EAA.";
  if (t.length < 60) return "Tokenen är för kort — kopiera hela värdet.";
  return null;
}
