// Plattformens FINGERAVTRYCK är inte plattformens NAMN — RAPPORT-1, R-2 (Håkan 13/8).
//
// 13/8-rapporten skrev "BaseKit" om forbalance.se. Fingeravtrycket är korrekt: BaseKit är
// tekniken under huven. Men Gitte loggar in i något som heter Hemsida24, och en instruktion
// som säger "gå in i BaseKit" är obegriplig för henne. Samma sak gäller våra egna kunder:
// tekniken är GoHighLevel, men de loggar in i MySales.
//
// Regeln: skriv alltid namnet kunden ser när hon loggar in. Känner vi inte igen tekniken
// skriver vi "din webbplattform" i stället för att gissa.

const KARTA: { monster: RegExp; namn: string }[] = [
  { monster: /basekit/i, namn: "Hemsida24" },
  { monster: /gohighlevel|highlevel|leadconnector/i, namn: "MySales" },
  { monster: /wordpress|wp-/i, namn: "WordPress" },
  { monster: /wix/i, namn: "Wix" },
  { monster: /squarespace/i, namn: "Squarespace" },
  { monster: /shopify/i, namn: "Shopify" },
  { monster: /webflow/i, namn: "Webflow" },
  { monster: /joomla/i, namn: "Joomla" },
  { monster: /drupal/i, namn: "Drupal" },
  { monster: /one\.com|onecom/i, namn: "one.com" },
  { monster: /loopia/i, namn: "Loopia" },
  { monster: /sitevision/i, namn: "SiteVision" },
];

/** Namnet kunden känner igen. Null när vi inte vet, aldrig en gissning. */
export function plattformKundnamn(fingeravtryck: string | null | undefined): string | null {
  if (!fingeravtryck) return null;
  for (const k of KARTA) if (k.monster.test(fingeravtryck)) return k.namn;
  if (/^okänd/i.test(fingeravtryck)) return null;
  // Ett generator-metavärde som "Hemsida24 1.2" är redan kundens namn. Ta första ordet.
  const rent = fingeravtryck.split(/[\d/(]/)[0].trim();
  return rent.length >= 3 ? rent : null;
}

/** Texten som får stå i rapporten. Alltid begriplig, aldrig ett tekniknamn kunden saknar. */
export function plattformIText(fingeravtryck: string | null | undefined): string {
  return plattformKundnamn(fingeravtryck) ?? "din webbplattform";
}

/**
 * Byter ut tekniknamn mot kundnamn i färdig text. Sista nätet: prompten får redan bara
 * kundnamnet, men en modell som känner igen fingeravtrycket kan skriva ut det ändå.
 */
export function oversattPlattformIText(text: string): { text: string; bytta: string[] } {
  let ut = text;
  const bytta: string[] = [];
  for (const k of KARTA) {
    const tekniknamn = k.monster.source.split("|")[0].replace(/[\\^$.*+?()[\]{}|]/g, "");
    if (!tekniknamn || tekniknamn.length < 4) continue;
    if (tekniknamn.toLowerCase() === k.namn.toLowerCase()) continue;
    const re = new RegExp(`\\b${tekniknamn}\\b`, "gi");
    if (re.test(ut)) {
      ut = ut.replace(re, k.namn);
      bytta.push(`${tekniknamn} → ${k.namn}`);
    }
  }
  return { text: ut, bytta };
}
