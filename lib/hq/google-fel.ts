// Översätter Googles felsvar till klarspråk med en väg framåt.
//
// Varför: REV-0 hittade att 193 av 264 felytor visade rå API-text. Ett fel som säger
// `403: { "error": { "code": 403, "message": "Google Calendar API has not been used in
// project 773740289261 before or it is disabled..." }}` är obegripligt och, värre,
// klipps av mitt i länken som faktiskt löser problemet.
//
// Ren funktion, inga anrop. Testbar mot riktiga felsvar.

export interface GoogleFel {
  text: string;
  lank?: string;
  lankText?: string;
}

/** Vilken Google-tjänst felet gäller, för rätt länk i konsolen. */
export type Tjanst = "kalender" | "gmail";

const API_NAMN: Record<Tjanst, { api: string; visning: string }> = {
  kalender: { api: "calendar-json.googleapis.com", visning: "Google Calendar API" },
  gmail: { api: "gmail.googleapis.com", visning: "Gmail API" },
};

export function tolkaGoogleFel(status: number, kropp: string, tjanst: Tjanst): GoogleFel {
  const { api, visning } = API_NAMN[tjanst];
  const text = kropp || "";

  // Vanligaste felet vid uppstart: kopplingen är gjord, men API:t är aldrig påslaget i
  // Google Cloud-projektet. Projektnumret står i svaret och behövs i länken.
  const projekt = text.match(/project (\d+)/)?.[1];
  if (status === 403 && /has not been used in project|it is disabled/i.test(text)) {
    return {
      text: `${visning} är inte påslaget i ditt Google Cloud-projekt${projekt ? ` (${projekt})` : ""}. Kopplingen fungerar, det är bara tjänsten som behöver slås på. Det tar ett klick och behöver bara göras en gång.`,
      lank: `https://console.cloud.google.com/apis/library/${api}${projekt ? `?project=${projekt}` : ""}`,
      lankText: `Slå på ${visning}`,
    };
  }

  // Behörigheten räcker inte: kopplingen gjordes innan scopet lades till.
  if (status === 403 && /insufficient|scope|permission/i.test(text)) {
    return {
      text: `Kopplingen saknar behörighet till ${tjanst === "gmail" ? "din e-post" : "din kalender"}. Koppla om Google så följer den med.`,
    };
  }

  // Token utgången eller återkallad.
  if (status === 401 || /invalid_grant|invalid credentials/i.test(text)) {
    return { text: "Kopplingen till Google har gått ut. Koppla om så hämtas en ny nyckel." };
  }

  if (status === 429 || /rate limit|quota/i.test(text)) {
    return { text: `${visning} har nått sin gräns för stunden. Försök igen om en liten stund.` };
  }

  // Okänt fel: säg vad som hände utan att kasta hela JSON-svaret i ansiktet, men behåll
  // Googles egen mening när den finns, annars går felet inte att felsöka alls.
  const meddelande = (() => {
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      return j.error?.message || "";
    } catch {
      return "";
    }
  })();
  return {
    text: `${visning} svarade ${status}.${meddelande ? ` ${meddelande.slice(0, 200)}` : ""}`,
  };
}
