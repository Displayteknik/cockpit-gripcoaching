// Tolkar inklistrad text eller CSV till råa kontakter (namn + nummer). Klarar:
//  - CSV med rubriker (First Name / Last Name / Phone / Namn / Mobil ...)
//  - komma-, semikolon- eller tab-separerat
//  - rader med bara ett nummer (namn valfritt)
// Ren logik, körs i webbläsaren för direkt förhandsgranskning.
import type { RawContact } from "./phone";

const PHONE_HINTS = ["phone", "mobil", "telefon", "nummer", "number", "tel", "cell"];
const NAME_HINTS = ["name", "namn", "kontakt", "contact"];
const FIRST_HINTS = ["first name", "förnamn", "fornamn", "first"];
const LAST_HINTS = ["last name", "efternamn", "last", "surname"];

function splitLine(line: string): string[] {
  // Väljer avgränsare per rad: semikolon/tab prioriteras (svensk Excel), annars komma.
  const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ""));
}

const digitCount = (s: string): number => (s.match(/\d/g) || []).length;

// Full-giltigt nummer (minst 7 siffror). Används bara för rubrik-detektering.
function looksLikePhone(s: string): boolean {
  return digitCount(s) >= 7 && /^[+\d][\d\s().-]*$/.test(s.trim());
}

// Cell som troligen ÄR numret: den med flest siffror (minst 3). Kortare/trasiga
// nummer väljs också så att de flaggas nedströms istället för att tyst försvinna.
function pickPhoneCell(cells: string[]): { value: string; index: number } | null {
  let best = -1, bestCount = 0;
  cells.forEach((c, i) => {
    const d = digitCount(c);
    if (d > bestCount) { bestCount = d; best = i; }
  });
  return bestCount >= 3 && best >= 0 ? { value: cells[best], index: best } : null;
}

export interface ParseResult {
  contacts: RawContact[];
  skipped: number; // rader utan tolkbart nummer
}

export function parseContacts(raw: string): ParseResult {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { contacts: [], skipped: 0 };

  // Rubrikrad? (första raden saknar tolkbart nummer men har namn/telefon-ord)
  const firstCells = splitLine(lines[0]).map((c) => c.toLowerCase());
  const headerHasHint = firstCells.some(
    (c) => PHONE_HINTS.some((h) => c.includes(h)) || NAME_HINTS.some((h) => c.includes(h))
  );
  const firstHasPhone = splitLine(lines[0]).some(looksLikePhone);
  const hasHeader = headerHasHint && !firstHasPhone;

  let phoneCol = -1;
  let nameCol = -1;
  let firstCol = -1;
  let lastCol = -1;
  if (hasHeader) {
    firstCells.forEach((c, i) => {
      if (phoneCol < 0 && PHONE_HINTS.some((h) => c.includes(h))) phoneCol = i;
      if (firstCol < 0 && FIRST_HINTS.some((h) => c.includes(h))) firstCol = i;
      if (lastCol < 0 && LAST_HINTS.some((h) => c.includes(h))) lastCol = i;
      if (nameCol < 0 && NAME_HINTS.some((h) => c.includes(h))) nameCol = i;
    });
  }

  const body = hasHeader ? lines.slice(1) : lines;
  const contacts: RawContact[] = [];
  let skipped = 0;

  for (const line of body) {
    const cells = splitLine(line);

    // Telefoncell: explicit rubrik annars cellen med flest siffror (även trasiga).
    let phone = "";
    let phoneIdx = -1;
    if (phoneCol >= 0 && cells[phoneCol]) {
      phone = cells[phoneCol];
      phoneIdx = phoneCol;
    } else {
      const picked = pickPhoneCell(cells);
      if (!picked) { skipped++; continue; } // ingen sifferbärande cell → hoppa raden
      phone = picked.value;
      phoneIdx = picked.index;
    }

    // Namn: rubrik-baserat (för/efternamn eller namn), annars alla celler utom numret.
    let name = "";
    if (firstCol >= 0 || lastCol >= 0) {
      name = [cells[firstCol] || "", cells[lastCol] || ""].join(" ").trim();
    } else if (nameCol >= 0) {
      name = cells[nameCol] || "";
    } else {
      name = cells.filter((_, i) => i !== phoneIdx).join(" ").trim();
    }

    contacts.push({ name, phone });
  }

  return { contacts, skipped };
}
