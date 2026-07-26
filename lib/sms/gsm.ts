// SMS-teckenräkning: avgör om ett meddelande ryms i GSM-7 (160 tecken/del, 153
// vid flera delar) eller tvingas till UCS-2 (70/67, t.ex. av emojis). Svenska
// å ä ö ingår i GSM-7 så vanlig svensk text blir 1 SMS upp till 160 tecken.

// GSM 03.38 grundalfabet (varje tecken = 1 septet).
const GSM_BASIC = new Set(
  (
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  ).split("")
);

// Escape-tecken i GSM 03.38 (varje = 2 septets).
const GSM_EXT = new Set(["\f", "^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

export interface SmsCount {
  chars: number;                 // teckenkostnad (septets för GSM-7, kodenheter för UCS-2)
  encoding: "GSM-7" | "UCS-2";
  parts: number;                 // antal fysiska SMS-delar
  singleMax: number;             // gräns för 1 del i denna encoding (160 / 70)
  hasUnicode: boolean;           // true om något tecken tvingar UCS-2
  offending: string[];           // unika tecken som tvingar UCS-2
}

export function countSms(text: string): SmsCount {
  let septets = 0;
  let gsm = true;
  const offending = new Set<string>();
  for (const ch of text) {                 // itererar kodpunkter
    if (GSM_BASIC.has(ch)) septets += 1;
    else if (GSM_EXT.has(ch)) septets += 2;
    else {
      gsm = false;
      offending.add(ch);
    }
  }

  if (gsm) {
    const parts = septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { chars: septets, encoding: "GSM-7", parts, singleMax: 160, hasUnicode: false, offending: [] };
  }

  // UCS-2: 46elks räknar UTF-16BE-kodenheter (emoji = 2). text.length = UTF-16-enheter.
  const units = text.length;
  const parts = units <= 70 ? 1 : Math.ceil(units / 67);
  return { chars: units, encoding: "UCS-2", parts, singleMax: 70, hasUnicode: true, offending: [...offending] };
}
