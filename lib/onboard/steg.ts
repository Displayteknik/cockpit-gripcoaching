// ONBOARD-7 — onboardingen som stegverktyg.
//
// Processen fanns dokumenterad i Google Doc "Onboardingprocessen: ny MySales Pro-kund (v1)"
// men levde utanför verktyget. Håkans flaskhals är inte att stegen är svåra, utan att han
// måste minnas dem och var de görs.
//
// ★ BESKRIVNINGARNA HÄR ÄR FACIT, hämtade ur processdokumentet efter Gitte Östling 7/8 2026.
//   De manuella stegen bär HELA instruktionen — meningen är att dokumentet aldrig ska
//   behöva öppnas igen. Ändras processen ändras texten här (eller i `onboarding_stegtext`
//   i databasen, som vinner över den här filen utan att koden behöver röras).
//
// ⚠ ETT MANUELLT STEG FÅR ALDRIG SE AUTOMATISKT UT. `agare` styr färg och rubrik i vyn:
//   "Väntar på dig" ska skilja sig tydligt från "systemet arbetar". Ett steg som ser
//   automatiskt ut men väntar på en människa blir liggande.

export type StegAgare = "system" | "hakan" | "kund";
export type StegStatusVarde = "vantar" | "pagar" | "klart" | "blockerat" | "hoppat";

export interface StegDef {
  nr: number;
  nyckel: string;
  titel: string;
  agare: StegAgare;
  /** Kort beskrivning — visas alltid. */
  beskrivning: string;
  /** Hela instruktionen för manuella steg. Markdown. Visas hopfällbart. */
  instruktion?: string;
  /** Nyckeln på steg som måste vara klara först. Blockerat-läget visar VARFÖR. */
  kraver?: string[];
  /** Etikett på åtgärdsknappen när systemet kan agera. */
  atgard?: string;
}

export const STEG: StegDef[] = [
  {
    nr: 1,
    nyckel: "analys",
    titel: "Analys av kundens sajt",
    agare: "system",
    beskrivning:
      "Webbadressen läses och ett förslag byggs med källa och citat per fält. Tomma fält lämnas tomma och flaggas.",
    atgard: "Kör analys",
  },
  {
    nr: 2,
    nyckel: "granskning",
    titel: "Granska och godkänn förslaget",
    agare: "hakan",
    beskrivning:
      "Rätta det som blivit fel och fyll i det som saknas. Fälten är sorterade på klass: det som kräver ditt val ligger överst, belagda tolkningar därefter.",
    // ★ Texten var skriven runt EN kund (Gitte/Bokadirekt) och läste som en instruktion
    //   att leta efter en bokningssida — även för kunder som inte har någon. Makzy 9/8:
    //   ingen bokningsplattform alls, och då är tomma bokningsfält RÄTT, inte en lucka.
    //   Rådet gäller fortfarande, men som ett VILLKORAT tips, inte som ett antagande.
    instruktion:
      "Onboardingmotorn är inte tillräckligt bra än. I ett skarpt fall fick den 6 av 11 fält rätt och satte kundens salongs-id som postnummer. Läs igenom varje fält.\n\n" +
      "**Finns en bokningsplattform är den oftast rikare än hemsidan** (Bokadirekt, Boka.se, Timma och liknande): tjänster med priser, öppettider, betyg och kursdatum, där hemsidan ofta ger nästan ingenting. Titta där först om kunden har en.\n\n" +
      "**Har kunden ingen bokningssida är det inget fel.** Lämna bokningslänk och de fält som inte gäller tomma — tomt är bättre än påhittat, och ett tomt fält stoppar ingenting senare i kedjan.",
    kraver: ["analys"],
  },
  {
    nr: 3,
    nyckel: "ghl_konto",
    titel: "GHL-kontot skapas från snapshotet",
    agare: "system",
    beskrivning:
      "Kontot klonas ur snapshotet MySales Pro v1.0. Land SE och tidszon Europe/Stockholm sätts automatiskt.",
    instruktion:
      "Går även att göra för hand: byrånivå → Sub-Accounts → skapa nytt → välj från snapshot.\n\n" +
      "Snapshot-id: `GCqvltlAAz7l0028oo0w`, taget ur MALL MySales Pro (`C7hspI68eIy5elGHfFVj`).\n\n" +
      "**Fallgrop:** curl mangar svenska tecken — Åkarhagsgatan blir ett frågetecken. Verktyget använder fetch, men kontrollera adressen efteråt om du gör det för hand.",
    kraver: ["granskning"],
    atgard: "Skapa kontot",
  },
  {
    nr: 4,
    nyckel: "kundnyckel",
    titel: "Kundnyckel — du skapar den för hand",
    agare: "hakan",
    beskrivning:
      "En Private Integration inne i kundens eget konto. Klistra in nyckeln nedan, så verifierar systemet den med ett läsanrop och bockar av steget själv.",
    instruktion:
      "**Varför manuellt:** GHL:s Private Integrations har ett plattformstak på 24 scopes, och `oauth.write` finns inte bland dem. Byrå-nyckeln kan därför aldrig växlas till en underkonto-nyckel. En privat Marketplace-app är vägen bort från det, men tills den finns skapas nyckeln för hand.\n\n" +
      "**Så gör du:**\n\n" +
      "1. Växla till kundens konto i GHL\n" +
      "2. Settings → Private Integrations → Create new\n" +
      "3. Kryssa i **alla nio** scopes nedan\n" +
      "4. Kopiera nyckeln direkt — den visas en enda gång\n" +
      "5. Klistra in den här\n\n" +
      "**De nio scopen:**\n\n" +
      "```\nopportunities.write\nopportunities.readonly\nlocations/customFields.write\nlocations/customFields.readonly\nlocations/customValues.write\nlocations/customValues.readonly\nlocations/tags.write\nlocations/tags.readonly\nworkflows.readonly\n```\n\n" +
      "**Regeln bakom:** skrivrätt räcker aldrig, eftersom allt läser först och skriver sedan. Utan läsrätt kan koden bara skapa nya värden bredvid snapshotets platshållare — och då får kunden dubbletter, medan mallarna pekar på den tomma.\n\n" +
      "**Tre fallgropar som kostat timmar:**\n\n" +
      "- Skapa **alltid en ny** integration i stället för att lägga till scopes på en befintlig. Ändringar i efterhand får inget genomslag på ett redan utfärdat token.\n" +
      "- **Inga mellanslag och ingen beskrivningstext** i tokenvärdet. Det gav 401-fel som såg ut som saknade behörigheter.\n" +
      "- Nyckeln visas **en gång**. Kopierar du den inte direkt får du skapa om den.",
    kraver: ["ghl_konto"],
    atgard: "Verifiera nyckeln",
  },
  {
    nr: 5,
    nyckel: "custom_values",
    titel: "De tretton custom values fylls",
    agare: "system",
    beskrivning:
      "Snapshotets platshållare uppdateras — inga nya skapas. Nycklarna är ASCII utan svenska tecken, eftersom GHL slänger dem när merge-taggen byggs.",
    instruktion:
      "Fälten: `foretagsnamn`, `kontaktperson`, `telefon`, `epost`, `hemsida`, `oppettider`, `adress`, `postnummer`, `ort`, `bokningslank`, `facebook`, `instagram`, `linkedin`.\n\n" +
      "Lämna tomt det kunden inte har. Tomt är bättre än fel.",
    kraver: ["kundnyckel"],
    atgard: "Fyll värdena",
  },
  {
    nr: 6,
    nyckel: "tenant",
    titel: "Cockpit-tenant och koppling till MySales",
    agare: "system",
    beskrivning:
      "Tenanten skapas och kopplingen till MySales-kontot sätts. Verifieras genom att Fokus idag-synken svarar utan fel.",
    instruktion:
      "**Detta steg missades för Gitte och gav en trasig Fokus idag-vy.** Det räcker inte att sätta `clients.ghl_location_id` — Fokus läser via `coach_users`, och saknas raden där svarar vyn \"Klienten är inte kopplad till MySales\".\n\n" +
      "Steget är obligatoriskt i provisioneringen sedan 7/8, men verifieringen nedan kontrollerar att det faktiskt skett.",
    kraver: ["ghl_konto"],
    atgard: "Skapa och koppla",
  },
  {
    nr: 7,
    nyckel: "brand_profil",
    titel: "Brand-profilen",
    agare: "system",
    beskrivning:
      "Två vägar in. Den manuella är huvudvägen i dag — klistra in ett färdigt profildokument i Brand-profil → Fyll i från ett samtal. Den automatiska skriver analysens fält, men analysen är inte tillräckligt bra än.",
    instruktion:
      "**Det enskilt viktigaste steget för kvaliteten.** Utan profil skriver Cockpit generisk text.\n\n" +
      "**Väg 1 — manuell, och den som gäller tills vidare.** Bearbeta transkript och källor till ett färdigt profildokument först, klistra sedan in det under Brand-profil → *Fyll i från ett samtal*. Du får en diff mot befintlig profil och godkänner fält för fält. For Balance nådde nivå 5 den vägen.\n\n" +
      "**Väg 2 — automatisk.** Knappen nedan skriver analysens profilfält. Den rör aldrig ifyllda fält, ett ifyllt fält är någons beslut. Men analysen fick 6 av 11 rätt på Gittes sajt, så räkna med att komplettera manuellt ändå.\n\n" +
      "Vägarna krockar inte: den automatiska fyller bara tomma fält, den manuella diffar och frågar.\n\n" +
      "Prioritera i den här ordningen om tiden tryter:\n\n" +
      "1. Tonregler och GÖR INTE — det som hindrar pinsamma texter\n" +
      "2. Målgrupp och smärtpunkter\n" +
      "3. Kundens eget språk, hennes formuleringar ordagrant\n" +
      "4. Tjänster och erbjudanden\n" +
      "5. Siffror med täckning",
    kraver: ["tenant"],
    atgard: "Skriv profilen",
  },
  {
    nr: 8,
    nyckel: "kundens_material",
    titel: "Kundens eget material",
    agare: "kund",
    beskrivning:
      "Det bara kunden kan ge. Verktyget bygger frågelistan ur de tomma fälten, så hon får fem specifika frågor i stället för tjugo generella.",
    instruktion:
      "**Fem av hennes egna inlägg och tre hon är stolt över.** Den enda posten i brand-profilen som ingen annan kan fylla. Låt henne öppna Facebook i mobilen **under mötet** — skickas det som hemläxa kommer det inte.\n\n" +
      "**Före-orden.** Fråga: när någon ringer dig första gången, vad säger de, ordagrant?\n\n" +
      "Recensioner beskriver hur det känns efteråt. Det som saknas är orden folk använder om sitt problem *innan* de köper.",
    kraver: ["brand_profil"],
    // Ingen åtgärdsknapp än: frågelistan är ONBOARD-6 och byggs i etapp 4. En knapp som
    // inte gör något är värre än ingen knapp — den lär användaren att knappar ljuger.
  },
  {
    nr: 9,
    nyckel: "atkomster",
    titel: "Åtkomster",
    agare: "hakan",
    beskrivning: "Bocka av när kunden gett dig behörighet. Inget av det här går att automatisera.",
    instruktion:
      "**Google Business Profile** — business.google.com. Be om administratörsroll under Användare. Kontrollera kategori och öppettider, de är ofta fel och kostar bokningar direkt.\n\n" +
      "**Google Search Console** — search.google.com/search-console. Har kunden den redan lägger hon till dig under Inställningar → Användare och behörigheter → Fullständig. Har hon den inte måste egendomen verifieras först, och då behöver du hennes webbplatsinloggning eller DNS-åtkomst.\n\n" +
      "**Facebook och Instagram** — business.facebook.com. Kunden lägger till dig som administratör på Facebook-sidan. Först då kan du göra Meta-kopplingen åt henne.\n\n" +
      "Tre förutsättningar måste stämma innan Instagram går att koppla, och bara kunden kan fixa dem: kontot måste vara företags- eller skaparkonto, det måste vara länkat till Facebook-sidan, och du måste vara administratör på sidan.\n\n" +
      "**Gör inte Meta-kopplingen till mötets huvudnummer.** Den krånglar ofta och är ett dåligt sista intryck. Konstatera vad som saknas och boka tio minuter för att slutföra.",
    kraver: ["ghl_konto"],
  },
  {
    nr: 10,
    nyckel: "verifiering",
    titel: "Verifiera innan du bjuder in kunden",
    agare: "system",
    beskrivning:
      "Systemet kontrollerar pipeline, custom values, taggar, workflow och Fokus-kopplingen. Grönt eller rött per punkt.",
    instruktion:
      "**Snippets måste du kolla för hand.** `/locations/{id}/templates` kräver ett scope som inte finns bland de nio, så systemet kan inte läsa dem.\n\n" +
      "Gå till **Marketing → Snippets** i kundens konto och räkna: det ska vara **sju** stycken — fas 1 till 5 plus uppföljning dag 3 och dag 7.\n\n" +
      "Resten kontrolleras automatiskt när du trycker på knappen.\n\n" +
      "**Säg till kunden att uppföljningsflödet är publicerat från dag ett.** Så fort hon taggar någon med `fas 1 hej` börjar uppgifter dyka upp tre dagar senare. Annars blir hon förvånad.",
    kraver: ["custom_values", "tenant"],
    atgard: "Kör verifieringen",
  },
  {
    nr: 11,
    nyckel: "kundlank",
    titel: "Skicka kundlänken",
    agare: "hakan",
    beskrivning: "Länken är inloggningen. Inget lösenord, ingen inloggningssida.",
    instruktion:
      "Skicka den **bara personligen**, aldrig i ett gruppinlägg. Den som har länken kommer åt kundens vy.\n\n" +
      "Be kunden spara den som bokmärke — det finns ingen inloggningssida att hitta tillbaka till.\n\n" +
      "**Ge inte GHL-inloggning som standard.** Kunden ser då hela gränssnittet i stället för den avskalade vyn med det hon köpt, och det förvirrar mer än det hjälper. Gör kopplingarna åt henne i stället.",
    kraver: ["verifiering"],
  },
];

export const STEG_PER_NYCKEL = new Map(STEG.map((s) => [s.nyckel, s]));

export const AGARE_ETIKETT: Record<StegAgare, string> = {
  system: "Systemet gör det",
  hakan: "Väntar på dig",
  kund: "Väntar på kunden",
};

/**
 * Avgör ett stegs läge utifrån vad som är avklarat.
 *
 * Blockerade steg ska ALLTID kunna svara på varför — "kräver steg 4" och inte bara en
 * grå knapp. En spärr utan förklaring läses som ett fel i verktyget.
 */
export function stegLage(
  def: StegDef,
  klara: Set<string>,
  eget: StegStatusVarde | undefined,
): { status: StegStatusVarde; blockeratVarfor: string | null } {
  if (eget === "klart" || klara.has(def.nyckel)) return { status: "klart", blockeratVarfor: null };
  if (eget === "hoppat") return { status: "hoppat", blockeratVarfor: null };

  const saknas = (def.kraver ?? []).filter((k) => !klara.has(k));
  if (saknas.length) {
    const namn = saknas.map((k) => {
      const d = STEG_PER_NYCKEL.get(k);
      return d ? `steg ${d.nr} (${d.titel.toLowerCase()})` : k;
    });
    return { status: "blockerat", blockeratVarfor: `Kräver ${namn.join(" och ")}.` };
  }
  return { status: eget ?? "vantar", blockeratVarfor: null };
}
