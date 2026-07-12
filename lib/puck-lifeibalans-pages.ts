import type { Data } from "@puckeditor/core";

// Standardinnehåll för Life i Balans undersidor. Faller tillbaka i [slug]-routen
// när ingen publicerad hm_pages-rad finns → sidorna funkar direkt och kan
// redigeras/publiceras i /admin.

const CARE_BODY =
  "Life i Balans är utbildning och coaching — inte vård. Det mesta du bär på går att förstå och påverka med kunskap och verktyg. Men ibland är det vården du behöver, och då vill jag att du söker den.\nHör av dig till din vårdcentral om du mår sämre över tid, om kroppen larmar på ett sätt du inte känner igen, eller om du bär på tankar som skrämmer dig. En del av innehållet handlar just om att veta när och hur du gör det. Vid akut fara: ring 112.";

const FAQ_ITEMS = [
  { question: "Är det här vård eller behandling?", answer: "Nej. Life i Balans erbjuder utbildning och coaching. Innehållet ersätter inte hälso- och sjukvård — och en del handlar just om när och hur du ska söka vård." },
  { question: "Passar det mig som inte är i klimakteriet än?", answer: "Ja. Det handlar om nervsystemet och stressen i grunden. Är du 40+ får du dessutom förståelse för det som kommer — i god tid." },
  { question: "Hur mycket tid tar det?", answer: "Signaturprogrammet är cirka två timmar i veckan: en liveträff på 75 minuter plus korta lektioner och en enkel veckoövning. Instegskursen ser du helt i din egen takt." },
  { question: "Vad händer om jag missar en liveträff?", answer: "Alla träffar spelas in och finns i kursportalen. Du kan komma ikapp i din takt." },
  { question: "Kan jag gå programmet om jag är sjukskriven?", answer: "Ja, många är det. Det ersätter inte din vårdkontakt men fungerar väl vid sidan av. Är du i ett akut skede — hör av dig, så pratar vi om det är rätt tidpunkt." },
];

export const LIB_PAGES: Record<string, Data> = {
  programmen: {
    root: { props: { title: "Programmen — Life i Balans" } },
    content: [
      { type: "Rubrik", props: { id: "h", eyebrow: "Programmen", title: "Två vägar — samma mål: ett reglerat nervsystem.", emphasisWord: "reglerat", lead: "Börja där du är. Instegskursen i din egen takt, eller signaturprogrammet med liveträffar och en liten grupp — båda bygger på samma kunskap och samma verktyg.", tint: false } },
      { type: "Punkter", props: { id: "insteg", eyebrow: "Instegskurs · i egen takt", title: "Förstå ditt nervsystem i klimakteriet", intro: "Den mjuka vägen in — fyra korta moduler du ser precis när det passar dig.", tint: false, points: [
        { text: "Fyra moduler, tolv inspelade lektioner — helt i din egen takt." },
        { text: "Förstå ditt nervsystem: gas och broms, dina tre lägen, och varför viljestyrka inte räcker." },
        { text: "Se kopplingen stress–hormoner: vad som händer 40+ och varför det träffar hårdare nu." },
        { text: "Arbetsblad, symtomkarta, ljudövningar och verktygskort du använder direkt i vardagen." },
      ] } },
      { type: "Punkter", props: { id: "signatur", eyebrow: "8 veckor · liten grupp · live varje vecka", title: "Åtta veckor till ett reglerat nervsystem", intro: "Signaturprogrammet — det fullständiga. Du går från att kämpa mot din kropp till att förstå och kunna påverka den. Cirka två timmar i veckan, byggt för en vardag som redan är full.", tint: true, points: [
        { text: "Förstå vad som händer i kroppen — och få verktyg som håller i en vanlig vardag." },
        { text: "Tre inspelade lektioner i veckan (12–20 min), i egen takt före liveträffen." },
        { text: "En liveträff på 75 minuter varje vecka (Zoom, fast veckodag). Alla träffar spelas in." },
        { text: "En kort veckoövning, 5–15 min om dagen — det är upprepningen som förändrar nervsystemet." },
        { text: "Arbetsbok, ljudövningar och en liten grupp (max 12–20) som förstår exakt var du är." },
      ] } },
      { type: "Statement", props: { id: "s", title: "Du har inte blivit svagare.", emphasisWord: "svagare", body: "Din stötdämpare har blivit tunnare — samtidigt som livet ofta är som mest krävande. Det är inte samma sak som att vara trasig. Det är att förstå sin biologi." } },
      { type: "TextBlock", props: { id: "vard", eyebrow: "Ärligt om vad det här är", title: "När du ska söka vård i stället", body: CARE_BODY, care: true, tint: false } },
      { type: "FAQ", props: { id: "faq", title: "Det du undrar.", items: FAQ_ITEMS } },
      { type: "Avslut", props: { id: "cta", title: "Osäker på var du ska börja?", body: "Börja med Nervsystemstestet — tre minuter, och du får en bild av var ditt nervsystem faktiskt är. Sen väljer vi väg tillsammans.", ctaText: "Gör Nervsystemstestet", ctaUrl: "/nervsystemstestet", noteText: "Eller hör av dig direkt — jag svarar själv.", noteLinkText: "Kontakta Linda", noteLinkUrl: "/kontakt" } },
    ],
  },

  nervsystemstestet: {
    root: { props: { title: "Nervsystemstestet — var är ditt nervsystem just nu?" } },
    content: [
      { type: "Rubrik", props: { id: "h", eyebrow: "Kostnadsfritt · Tre minuter", title: "Var är ditt nervsystem just nu?", emphasisWord: "just nu", lead: "Femton frågor. Du får en personlig profil, en förklaring av vad den betyder — och konkreta första steg. Direkt i din inkorg.", tint: false } },
      { type: "Punkter", props: { id: "p", eyebrow: "Det här får du", title: "Ett ärligt läge — utan att någon säger att det sitter i huvudet.", intro: "", tint: true, points: [
        { text: "En personlig profil av var ditt nervsystem är just nu." },
        { text: "En förklaring i klartext av vad profilen betyder." },
        { text: "Tre konkreta första steg du kan börja med i veckan." },
      ] } },
      { type: "NervTest", props: { id: "test", eyebrow: "Kostnadsfritt · Tre minuter", heading: "Femton frågor. En ärlig bild av var du är.", intro: "Svara så som det känns just nu — det finns inga rätt eller fel. Du får en personlig profil direkt, med konkreta första steg." } },
      { type: "TextBlock", props: { id: "note", eyebrow: "Bra att veta", title: "Det här är en självskattning — inte en diagnos.", body: "Testet hjälper dig förstå var du är, så att du vet vad du kan börja med. Det är inget medicinskt test.", care: false, tint: false } },
    ],
  },

  "om-linda": {
    root: { props: { title: "Om Linda Fernquist" } },
    content: [
      { type: "Rubrik", props: { id: "h", eyebrow: "Om Linda", title: "Sjuksköterskan som själv har stått där du står.", emphasisWord: "själv", lead: "Jag vet hur det känns när kroppen slutar lyssna — och hur det känns när ingen lyssnar på dig.", tint: false } },
      { type: "OmLinda", props: { id: "story", eyebrow: "Kunskapen kommer från vården", title: "Förståelsen kommer från mig själv.", body: "Jag är legitimerad sjuksköterska med tio år som lärare inom vården, specialiserad inom psykiatri, stressrelaterade tillstånd, nervsystemsreglering och klimakteriet. Jag har också egen erfarenhet av långvarig stress och en tung klimakterieperiod — så jag vet hur det känns när kroppen slutar lyssna, och hur det känns när ingen lyssnar på dig.", trust: [ { text: "Leg. sjuksköterska" }, { text: "10 år som vårdlärare" }, { text: "Psykiatri & kvinnohälsa" } ], linkText: "Läs om programmet", linkUrl: "/programmen", image: "/lifeibalans/linda/om-linda.jpg", imageAlt: "Linda Fernquist", caption: "Linda Fernquist · leg. sjuksköterska" } },
      { type: "Avslut", props: { id: "cta", title: "Vill du veta var du är just nu?", body: "Börja med Nervsystemstestet — tre minuter, och du får en bild av var ditt nervsystem faktiskt är.", ctaText: "Gör Nervsystemstestet", ctaUrl: "/nervsystemstestet", noteText: "Eller hör av dig direkt.", noteLinkText: "Kontakta Linda", noteLinkUrl: "/kontakt" } },
    ],
  },

  kontakt: {
    root: { props: { title: "Kontakt — Life i Balans" } },
    content: [
      { type: "Rubrik", props: { id: "h", eyebrow: "Kontakt", title: "Hör av dig — jag svarar själv.", emphasisWord: "själv", lead: "Undrar du om något är rätt för dig, eller vill du bara ställa en fråga? Skriv några rader, så återkommer jag.", tint: false } },
      { type: "Kontaktformular", props: { id: "form", eyebrow: "Skriv till mig", title: "Det finns inget dumt att höra av sig om.", intro: "Skriv några rader, så återkommer jag — jag svarar själv. Är du i ett akut skede, hör av dig så pratar vi om det är rätt tidpunkt. Vid akut fara, ring alltid 112.", email: "linda@lifeibalans.se", tint: false } },
    ],
  },
};
