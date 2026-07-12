/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config } from "@puckeditor/core";
import {
  Hero, Recognition, Statement, ShockAbsorber, Offering, AboutLinda, Faq, Closing, GhlEmbed, Vagen,
  Rubrik, Punkter, TextBlock,
} from "@/components/puck-lifeibalans/sections";

const boolField = { type: "radio" as const, options: [ { label: "Ja", value: true }, { label: "Nej", value: false } ] };

// Life i Balans — Puck-config (Örtagård). Fält + defaults = riktig hemsidecopy,
// så varje block ser färdigt ut direkt i editorn.
export const puckConfigLifeibalans: Config = {
  categories: {
    sektioner: { title: "Sektioner", components: ["Hero", "Rubrik", "Igenkanning", "Statement", "Stotdampare", "Vagen", "Uppslag", "Punkter", "TextBlock", "OmLinda", "FAQ", "Avslut"] },
    integration: { title: "Integration", components: ["GhlEmbed"] },
  },
  components: {
    Hero: {
      label: "Hero",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        emphasisWord: { type: "text", label: "Kursivt ord (i rubriken)" },
        lead: { type: "textarea", label: "Ingress" },
        ctaText: { type: "text", label: "Knapp text" },
        ctaUrl: { type: "text", label: "Knapp länk" },
        linkText: { type: "text", label: "Textlänk" },
        linkUrl: { type: "text", label: "Textlänk länk" },
        image: { type: "text", label: "Bild-URL" },
        imageAlt: { type: "text", label: "Bild alt-text" },
        caption: { type: "text", label: "Bildtext" },
      },
      defaultProps: {
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
      render: Hero as any,
    },

    Igenkanning: {
      label: "Igenkänning (2×2)",
      fields: {
        title: { type: "text", label: "Rubrik" },
        tint: { ...boolField, label: "Tonad bakgrund" },
        blocks: { type: "array", label: "Block", arrayFields: { text: { type: "textarea", label: "Text" } }, getItemSummary: (i: any) => i.text?.slice(0, 40) || "Block" },
      },
      defaultProps: {
        title: "Känner du igen dig?",
        tint: true,
        blocks: [
          { text: "Du vaknar klockan tre med hjärtat bultande — och hjärnan på högvarv." },
          { text: "Du har fungerat i tjugo år. Nu räcker inte gamla knep längre." },
          { text: "Hjärndimma, kort stubin, orkeslöshet. Och ingen tar dig riktigt på allvar." },
          { text: "Du undrar i tysthet: är jag på väg in i väggen, eller är det klimakteriet?" },
        ],
      },
      render: Recognition as any,
    },

    Statement: {
      label: "Statement (mörk)",
      fields: {
        title: { type: "text", label: "Rubrik" },
        emphasisWord: { type: "text", label: "Kursivt ord" },
        body: { type: "textarea", label: "Brödtext" },
      },
      defaultProps: {
        title: "Det är inte du som är trasig.",
        emphasisWord: "trasig",
        body: "Det är ditt nervsystem som skriker efter reglering — i en livsfas där hormonförändringarna sänker din stresströskel ytterligare. Det går att förstå. Och det går att påverka.",
      },
      render: Statement as any,
    },

    Stotdampare: {
      label: "Stötdämparen",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        emphasisWord: { type: "text", label: "Kursivt ord" },
        body: { type: "textarea", label: "Brödtext" },
        quote: { type: "textarea", label: "Citat" },
      },
      defaultProps: {
        eyebrow: "Därför träffar det hårdare nu",
        title: "Östrogen har varit din stötdämpare mot stressen. I trettio år.",
        emphasisWord: "stötdämpare",
        body: "Östrogen är inte bara ett menshormon. Det dämpar stressvaret, stöttar kroppens lugnande signalsubstanser och hjälper systemet att återhämta sig. Någonstans runt 45 börjar det svänga och sjunka — och stötdämparen tunnas ut. Samma jobb. Samma familj. Samma inkorg. Men det träffar dig hårdare, för skyddet är tunnare.",
        quote: "Du har inte blivit svagare. Du har blivit oskyddad. Det är en helt annan sak.",
      },
      render: ShockAbsorber as any,
    },

    Vagen: {
      label: "Vägen in (3 steg)",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        tint: { ...boolField, label: "Tonad bakgrund" },
        steps: {
          type: "array", label: "Steg",
          arrayFields: {
            label: { type: "text", label: "Etikett" },
            title: { type: "text", label: "Rubrik" },
            desc: { type: "textarea", label: "Text" },
            ctaText: { type: "text", label: "Länktext" },
            ctaUrl: { type: "text", label: "Länk" },
          },
          getItemSummary: (i: any) => i.title || "Steg",
        },
      },
      defaultProps: {
        eyebrow: "Vägen in",
        title: "Var du än är finns ett nästa steg.",
        tint: true,
        steps: [
          { label: "Gratis · 3 min", title: "Nervsystemstestet", desc: "Femton frågor. Du får en personlig profil av var ditt nervsystem är just nu — och konkreta första steg, direkt i din inkorg.", ctaText: "Gör testet", ctaUrl: "/nervsystemstestet" },
          { label: "Instegskurs · i egen takt", title: "Förstå ditt nervsystem i klimakteriet", desc: "Fyra korta moduler där du förstår vad som faktiskt händer när stress möter klimakteriet — inspelade lektioner, arbetsblad och ljudövningar, i din egen takt. Den mjuka vägen in.", ctaText: "Läs om instegskursen", ctaUrl: "/instegskursen" },
          { label: "8 veckor · liten grupp · live", title: "Åtta veckor till ett reglerat nervsystem", desc: "Signaturprogrammet: åtta veckor med inspelade lektioner, en liveträff i veckan, arbetsbok och en liten grupp. Du går från att kämpa mot din kropp till att förstå och kunna påverka den.", ctaText: "Läs om programmet", ctaUrl: "/programmet" },
        ],
      },
      render: Vagen as any,
    },

    Uppslag: {
      label: "Uppslag (bild + text)",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        body: { type: "textarea", label: "Brödtext" },
        ctaText: { type: "text", label: "Textlänk" },
        ctaUrl: { type: "text", label: "Textlänk länk" },
        image: { type: "text", label: "Bild-URL" },
        imageAlt: { type: "text", label: "Bild alt-text" },
        caption: { type: "text", label: "Bildtext" },
        mediaSide: { type: "radio", label: "Bild sida", options: [ { label: "Vänster", value: "left" }, { label: "Höger", value: "right" } ] },
        wide: { ...boolField, label: "Liggande bild" },
        tint: { ...boolField, label: "Tonad bakgrund" },
      },
      defaultProps: {
        eyebrow: "Kostnadsfritt · Tre minuter",
        title: "Var är ditt nervsystem just nu?",
        body: "Femton frågor. Du får en personlig profil, en förklaring av vad den betyder — och konkreta första steg. Direkt i din inkorg.",
        ctaText: "Gör testet", ctaUrl: "/nervsystemstestet",
        image: "/lifeibalans/nervsystemstestet.jpg", imageAlt: "Nervsystemstestet", caption: "Nervsystemstestet · tre minuter",
        mediaSide: "right", wide: true, tint: false,
      },
      render: Offering as any,
    },

    OmLinda: {
      label: "Om Linda",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        body: { type: "textarea", label: "Brödtext" },
        trust: { type: "array", label: "Trust-markörer", arrayFields: { text: { type: "text", label: "Text" } }, getItemSummary: (i: any) => i.text || "Markör" },
        linkText: { type: "text", label: "Textlänk" },
        linkUrl: { type: "text", label: "Textlänk länk" },
        image: { type: "text", label: "Bild-URL" },
        imageAlt: { type: "text", label: "Bild alt-text" },
        caption: { type: "text", label: "Bildtext" },
      },
      defaultProps: {
        eyebrow: "Om Linda",
        title: "Sjuksköterskan som själv har stått där du står.",
        body: "Jag är legitimerad sjuksköterska med tio år som lärare inom vården, specialiserad inom psykiatri, stressrelaterade tillstånd, nervsystemsreglering och klimakteriet. Jag har också egen erfarenhet av långvarig stress och en tung klimakterieperiod — så jag vet hur det känns när kroppen slutar lyssna, och hur det känns när ingen lyssnar på dig.",
        trust: [ { text: "Leg. sjuksköterska" }, { text: "10 år som vårdlärare" }, { text: "Psykiatri & kvinnohälsa" } ],
        linkText: "Läs hela historien", linkUrl: "/om-linda",
        image: "/lifeibalans/linda/om-linda.jpg", imageAlt: "Linda Fernquist", caption: "Linda Fernquist · i sitt arbete",
      },
      render: AboutLinda as any,
    },

    FAQ: {
      label: "FAQ",
      fields: {
        title: { type: "text", label: "Rubrik" },
        items: { type: "array", label: "Frågor", arrayFields: { question: { type: "text", label: "Fråga" }, answer: { type: "textarea", label: "Svar" } }, getItemSummary: (i: any) => i.question?.slice(0, 40) || "Fråga" },
      },
      defaultProps: {
        title: "Det du undrar.",
        items: [
          { question: "Är det här vård eller behandling?", answer: "Nej. Life i Balans erbjuder utbildning och coaching. Innehållet ersätter inte hälso- och sjukvård — och en del av programmet handlar just om när och hur du ska söka vård." },
          { question: "Passar det mig som inte är i klimakteriet än?", answer: "Ja. Programmet handlar om nervsystemet och stressen i grunden. Är du 40+ får du dessutom förståelse för det som kommer — i god tid." },
          { question: "Hur mycket tid tar programmet?", answer: "Cirka två timmar i veckan: en liveträff på 75 minuter plus korta lektioner och en enkel veckoövning. Allt är byggt för en full vardag." },
          { question: "Vad händer om jag missar en liveträff?", answer: "Alla träffar spelas in och finns i kursportalen. Du kan komma ikapp i din takt." },
          { question: "Kan jag gå programmet om jag är sjukskriven?", answer: "Ja, många är det. Programmet ersätter inte din vårdkontakt, men fungerar väl vid sidan av. Är du i ett akut skede — hör av dig, så pratar vi om det är rätt tidpunkt." },
        ],
      },
      render: Faq as any,
    },

    Avslut: {
      label: "Avslut (mörk CTA)",
      fields: {
        title: { type: "text", label: "Rubrik" },
        body: { type: "textarea", label: "Brödtext" },
        ctaText: { type: "text", label: "Knapp text" },
        ctaUrl: { type: "text", label: "Knapp länk" },
        noteText: { type: "text", label: "Not-text" },
        noteLinkText: { type: "text", label: "Not-länk text" },
        noteLinkUrl: { type: "text", label: "Not-länk länk" },
      },
      defaultProps: {
        title: "Du behöver inte göra något stort i dag.",
        body: "Börja med testet. Det tar tre minuter, och du får veta var ditt nervsystem faktiskt är just nu.",
        ctaText: "Gör Nervsystemstestet", ctaUrl: "/nervsystemstestet",
        noteText: "Eller hör av dig till mig direkt — jag svarar själv.",
        noteLinkText: "Kontakta Linda", noteLinkUrl: "/kontakt",
      },
      render: Closing as any,
    },

    GhlEmbed: {
      label: "GHL-formulär",
      fields: {
        embedId: { type: "text", label: "Embed-id" },
        title: { type: "text", label: "Rubrik" },
        minHeight: { type: "number", label: "Min-höjd (px)" },
      },
      defaultProps: { embedId: "GHL_CONTACT_FORM", title: "Skicka ett meddelande", minHeight: 520 },
      render: GhlEmbed as any,
    },

    Rubrik: {
      label: "Rubrik (sidhuvud)",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        emphasisWord: { type: "text", label: "Kursivt ord" },
        lead: { type: "textarea", label: "Ingress" },
        tint: { ...boolField, label: "Tonad bakgrund" },
      },
      defaultProps: { eyebrow: "Eyebrow", title: "Sidrubrik", emphasisWord: "", lead: "Kort ingress.", tint: false },
      render: Rubrik as any,
    },

    Punkter: {
      label: "Punkter (löv-lista)",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        intro: { type: "textarea", label: "Ingress" },
        tint: { ...boolField, label: "Tonad bakgrund" },
        points: { type: "array", label: "Punkter", arrayFields: { text: { type: "textarea", label: "Text" } }, getItemSummary: (i: any) => i.text?.slice(0, 40) || "Punkt" },
      },
      defaultProps: { eyebrow: "Det här får du", title: "Rubrik", intro: "", tint: false, points: [ { text: "Punkt ett." }, { text: "Punkt två." }, { text: "Punkt tre." } ] },
      render: Punkter as any,
    },

    TextBlock: {
      label: "Text / vård-ruta",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "text", label: "Rubrik" },
        body: { type: "textarea", label: "Brödtext (dela stycken med radbryt)" },
        care: { ...boolField, label: "Vård-ruta (salvia-ram)" },
        tint: { ...boolField, label: "Tonad bakgrund" },
      },
      defaultProps: { eyebrow: "Ärligt", title: "Rubrik", body: "Text.", care: false, tint: false },
      render: TextBlock as any,
    },
  },
};
