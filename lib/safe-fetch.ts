// Säker fetch för klient-sidor. Tunga jobb (AI, audits) kan timeouta och då svarar
// servern med TEXT istället för data — gör man då `await res.json()` rakt av kastar det
// ett ohanterat fel och sidan FRYSER (snurran stannar aldrig). fetchJson fångar det och
// ger ett begripligt felmeddelande som sidan kan visa istället.
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Kunde inte nå servern. Kolla nätet och försök igen.");
  }

  const raw = await res.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // Inte giltig data → oftast timeout vid ett tungt jobb.
    throw new Error("Det tog för lång tid eller avbröts. Försök igen om en stund.");
  }

  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Något gick fel (${res.status}). Försök igen.`);
  }
  return data as T;
}
