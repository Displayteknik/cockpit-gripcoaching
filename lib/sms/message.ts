// Meddelandemall: ersätter [förnamn] med mottagarens förnamn. [LÄNK] och annan
// text lämnas orörd (skrivs in manuellt i fältet). Övriga hakparentes-variabler
// stöds inte i v1 — bara [förnamn].

const NAME_TOKEN = /\[förnamn\]/gi;

// Renderar meddelandet för en mottagare. Saknas förnamn tas platshållaren bort
// och dubbla mellanslag samt "Hej !" städas till något som läser rent.
export function renderMessage(template: string, firstName: string): string {
  const name = (firstName || "").trim();
  let out = template.replace(NAME_TOKEN, name);
  if (!name) {
    out = out
      .replace(/\bHej\s+!/g, "Hej!")
      .replace(/\bHej\s+,/g, "Hej,")
      .replace(/ {2,}/g, " ");
  }
  return out;
}

// True om mallen innehåller [förnamn]-variabeln.
export function usesFirstName(template: string): boolean {
  return NAME_TOKEN.test(template);
}
