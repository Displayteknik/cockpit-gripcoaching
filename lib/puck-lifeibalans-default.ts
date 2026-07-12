import type { Data } from "@puckeditor/core";

// Startinnehåll för Life i Balans-hemsidan (Örtagård). Används som fallback i
// den publika routen OCH seedas till hm_pages så editorn öppnar en färdig sida.
export const LIB_HOME_DATA: Data = {
  root: { props: { title: "Life i Balans — nervsystem, stress och klimakteriet" } },
  content: [
    {
      type: "Hero",
      props: {
        id: "hero",
        eyebrow: "Leg. sjuksköterska · Nervsystem & klimakteriet",
        title: "Trött på ett sätt som sömn inte fixar.",
        emphasisWord: "sömn",
        lead: "Uppvarvad och tom på samma gång. Vaken klockan tre. Hjärndimma mitt i meningen. Och alla prover ser bra ut. Jag heter Linda, jag är sjuksköterska — och jag kan förklara vad som faktiskt händer i din kropp.",
        ctaText: "Gör Nervsystemstestet — gratis",
        ctaUrl: "/nervsystemstestet",
        linkText: "Läs om 8-veckorsprogrammet",
        linkUrl: "/programmet",
        image: "/lifeibalans/linda/hero.jpg",
        imageAlt: "Linda Fernquist, leg. sjuksköterska",
        caption: "Linda Fernquist · leg. sjuksköterska",
      },
    },
    {
      type: "Igenkanning",
      props: {
        id: "igenkanning",
        title: "Känner du igen dig?",
        tint: true,
        blocks: [
          { text: "Du vaknar klockan tre med hjärtat bultande — och hjärnan på högvarv." },
          { text: "Du har fungerat i tjugo år. Nu räcker inte gamla knep längre." },
          { text: "Hjärndimma, kort stubin, orkeslöshet. Och ingen tar dig riktigt på allvar." },
          { text: "Du undrar i tysthet: är jag på väg in i väggen, eller är det klimakteriet?" },
        ],
      },
    },
    {
      type: "Statement",
      props: {
        id: "statement",
        title: "Det är inte du som är trasig.",
        emphasisWord: "trasig",
        body: "Det är ditt nervsystem som skriker efter reglering — i en livsfas där hormonförändringarna sänker din stresströskel ytterligare. Det går att förstå. Och det går att påverka.",
      },
    },
    {
      type: "Stotdampare",
      props: {
        id: "stotdampare",
        eyebrow: "Därför träffar det hårdare nu",
        title: "Östrogen har varit din stötdämpare mot stressen. I trettio år.",
        emphasisWord: "stötdämpare",
        body: "Östrogen är inte bara ett menshormon. Det dämpar stressvaret, stöttar kroppens lugnande signalsubstanser och hjälper systemet att återhämta sig. Någonstans runt 45 börjar det svänga och sjunka — och stötdämparen tunnas ut. Samma jobb. Samma familj. Samma inkorg. Men det träffar dig hårdare, för skyddet är tunnare.",
        quote: "Du har inte blivit svagare. Du har blivit oskyddad. Det är en helt annan sak.",
      },
    },
    {
      type: "Uppslag",
      props: {
        id: "uppslag-test",
        eyebrow: "Kostnadsfritt · Tre minuter",
        title: "Var är ditt nervsystem just nu?",
        body: "Femton frågor. Du får en personlig profil, en förklaring av vad den betyder — och konkreta första steg. Direkt i din inkorg.",
        ctaText: "Gör testet",
        ctaUrl: "/nervsystemstestet",
        image: "/lifeibalans/nervsystemstestet.jpg",
        imageAlt: "Nervsystemstestet",
        caption: "Nervsystemstestet · tre minuter",
        mediaSide: "right",
        wide: true,
        tint: false,
      },
    },
    {
      type: "Uppslag",
      props: {
        id: "uppslag-program",
        eyebrow: "8 veckor · Liten grupp · Live varje vecka",
        title: "Åtta veckor till ett reglerat nervsystem",
        body: "Ett program för dig som vill förstå vad som händer i din kropp — och få verktyg som håller i en full vardag. Vi ses live varje vecka, du får inspelade lektioner, en arbetsbok och en liten grupp som förstår exakt var du är.",
        ctaText: "Läs om programmet",
        ctaUrl: "/programmet",
        image: "/lifeibalans/programmet.jpg",
        imageAlt: "Programmet",
        caption: "8 veckor · liten grupp · live",
        mediaSide: "left",
        wide: false,
        tint: true,
      },
    },
    {
      type: "OmLinda",
      props: {
        id: "om-linda",
        eyebrow: "Om Linda",
        title: "Sjuksköterskan som själv har stått där du står.",
        body: "Jag är legitimerad sjuksköterska med tio år som lärare inom vården, specialiserad inom psykiatri, stressrelaterade tillstånd, nervsystemsreglering och klimakteriet. Jag har också egen erfarenhet av långvarig stress och en tung klimakterieperiod — så jag vet hur det känns när kroppen slutar lyssna, och hur det känns när ingen lyssnar på dig.",
        trust: [
          { text: "Leg. sjuksköterska" },
          { text: "10 år som vårdlärare" },
          { text: "Psykiatri & kvinnohälsa" },
        ],
        linkText: "Läs hela historien",
        linkUrl: "/om-linda",
        image: "/lifeibalans/linda/om-linda.jpg",
        imageAlt: "Linda Fernquist",
        caption: "Linda Fernquist · i sitt arbete",
      },
    },
    {
      type: "FAQ",
      props: {
        id: "faq",
        title: "Det du undrar.",
        items: [
          { question: "Är det här vård eller behandling?", answer: "Nej. Life i Balans erbjuder utbildning och coaching. Innehållet ersätter inte hälso- och sjukvård — och en del av programmet handlar just om när och hur du ska söka vård." },
          { question: "Passar det mig som inte är i klimakteriet än?", answer: "Ja. Programmet handlar om nervsystemet och stressen i grunden. Är du 40+ får du dessutom förståelse för det som kommer — i god tid." },
          { question: "Hur mycket tid tar programmet?", answer: "Cirka två timmar i veckan: en liveträff på 75 minuter plus korta lektioner och en enkel veckoövning. Allt är byggt för en full vardag." },
          { question: "Vad händer om jag missar en liveträff?", answer: "Alla träffar spelas in och finns i kursportalen. Du kan komma ikapp i din takt." },
          { question: "Kan jag gå programmet om jag är sjukskriven?", answer: "Ja, många är det. Programmet ersätter inte din vårdkontakt, men fungerar väl vid sidan av. Är du i ett akut skede — hör av dig, så pratar vi om det är rätt tidpunkt." },
        ],
      },
    },
    {
      type: "Avslut",
      props: {
        id: "avslut",
        title: "Du behöver inte göra något stort i dag.",
        body: "Börja med testet. Det tar tre minuter, och du får veta var ditt nervsystem faktiskt är just nu.",
        ctaText: "Gör Nervsystemstestet",
        ctaUrl: "/nervsystemstestet",
        noteText: "Eller hör av dig till mig direkt — jag svarar själv.",
        noteLinkText: "Kontakta Linda",
        noteLinkUrl: "/kontakt",
      },
    },
  ],
};
