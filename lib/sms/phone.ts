// Normalisering av svenska mobilnummer till E.164 (+46) + validering och dedup.
// Ogiltiga nummer och dubbletter flaggas så att de kan exkluderas från utskick.

export interface RawContact {
  id?: string;
  name?: string;
  phone?: string;
}

export interface Recipient {
  id?: string;
  name: string;
  firstName: string;
  rawPhone: string;
  e164: string;        // "" om numret inte kunde tolkas
  valid: boolean;
  reason?: string;     // varför exkluderad (ogiltigt eller dubblett)
  duplicate?: boolean;
}

// Plockar första ordet ur ett namn som förnamn.
export function firstNameOf(name?: string): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

// Försöker tolka ett godtyckligt inmatat nummer som svenskt mobilnummer i E.164.
// Returnerar { e164, valid, reason }. Antar svensk landskod (SE) för nationella
// nummer som börjar med 0. Redan internationella +NN-nummer behålls.
export function normalizePhone(input?: string): { e164: string; valid: boolean; reason?: string } {
  const raw = (input || "").trim();
  if (!raw) return { e164: "", valid: false, reason: "saknar nummer" };

  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return { e164: "", valid: false, reason: "kan ej tolkas" };

  let intl: string; // siffror inklusive landskod, utan +
  if (hasPlus) {
    intl = digits;
  } else if (digits.startsWith("00")) {
    intl = digits.slice(2);
  } else if (digits.startsWith("0")) {
    intl = "46" + digits.slice(1); // svenskt nationellt nummer
  } else if (digits.startsWith("46")) {
    intl = digits;
  } else {
    return { e164: "", valid: false, reason: "okänt format (ingen landskod)" };
  }

  const e164 = "+" + intl;

  // Svenskt mobilnummer: +46 7X XXXXXXX = +46 följt av 9 siffror, första = 7.
  if (intl.startsWith("46")) {
    const national = intl.slice(2);
    if (national.length !== 9) return { e164, valid: false, reason: "fel längd för svenskt nummer" };
    if (!national.startsWith("7")) return { e164, valid: false, reason: "ej mobilnummer (07x)" };
    return { e164, valid: true };
  }

  // Utländskt E.164: acceptera 8–15 siffror.
  if (/^[1-9]\d{7,14}$/.test(intl)) return { e164, valid: true };
  return { e164, valid: false, reason: "kan ej tolkas" };
}

// Bygger mottagarlistan från råa kontakter: normaliserar, flaggar ogiltiga och
// dubbletter (samma E.164). Första förekomsten av ett nummer behålls som giltig.
export function buildRecipients(contacts: RawContact[]): Recipient[] {
  const seen = new Set<string>();
  return contacts.map((c) => {
    const name = (c.name || "").trim();
    const { e164, valid, reason } = normalizePhone(c.phone);
    const base: Recipient = {
      id: c.id,
      name: name || "(namn saknas)",
      firstName: firstNameOf(name),
      rawPhone: (c.phone || "").trim(),
      e164,
      valid,
      reason,
    };
    if (!valid) return base;
    if (seen.has(e164)) return { ...base, valid: false, duplicate: true, reason: "dubblett" };
    seen.add(e164);
    return base;
  });
}
