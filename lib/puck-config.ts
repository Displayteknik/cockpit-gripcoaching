/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config } from "@puckeditor/core";
// Existing section components
import { Hero } from "@/components/puck/Hero";
import { PageHeader } from "@/components/puck/PageHeader";
import { VehicleGrid } from "@/components/puck/VehicleGrid";
import { FAQ } from "@/components/puck/FAQ";
import { CTASection } from "@/components/puck/CTASection";
import { WhySection } from "@/components/puck/WhySection";
import { JustNuCards } from "@/components/puck/JustNuCards";
import { QuickCategories } from "@/components/puck/QuickCategories";
import { Spotlight } from "@/components/puck/Spotlight";
import { PartnerLogos } from "@/components/puck/PartnerLogos";
import { BlogGrid } from "@/components/puck/BlogGrid";
import { Timeline } from "@/components/puck/Timeline";
import { ValuesGrid } from "@/components/puck/ValuesGrid";
import { ContactLayout } from "@/components/puck/ContactLayout";
import { TradeInStrip } from "@/components/puck/TradeInStrip";
import { Spacer } from "@/components/puck/Spacer";
import { RichText } from "@/components/puck/RichText";
import { ImageSection } from "@/components/puck/ImageSection";
// Granular drag-drop components
import { Heading } from "@/components/puck/Heading";
import { Text } from "@/components/puck/Text";
import { Button } from "@/components/puck/Button";
import { FAQItem } from "@/components/puck/FAQItem";
import { TimelineItem } from "@/components/puck/TimelineItem";
import { Card } from "@/components/puck/Card";
import { Section } from "@/components/puck/Section";
import { PromoCard } from "@/components/puck/PromoCard";

export const puckConfig: Config = {
  categories: {
    building: {
      title: "Byggblock",
      defaultExpanded: true,
      components: ["Section", "Heading", "Text", "Button", "Card", "FAQItem", "TimelineItem", "PromoCard", "ImageSection", "Spacer"],
    },
    sections: {
      title: "Färdiga sektioner",
      components: ["Hero", "PageHeader", "Spotlight", "FAQ", "CTASection", "WhySection", "JustNuCards", "QuickCategories", "PartnerLogos", "Timeline", "ValuesGrid", "ContactLayout", "TradeInStrip", "RichText"],
    },
    data: {
      title: "Dynamiskt innehåll",
      components: ["VehicleGrid", "BlogGrid"],
    },
  },
  components: {
    Hero: {
      label: "Hero-sektion",

      fields: {
        badge: { type: "text", label: "Badge-text", contentEditable: true },
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "textarea", label: "Underrubrik", contentEditable: true },
        cta1Text: { type: "text", label: "Knapp 1 text", contentEditable: true },
        cta1Url: { type: "text", label: "Knapp 1 länk" },
        cta2Text: { type: "text", label: "Knapp 2 text", contentEditable: true },
        cta2Url: { type: "text", label: "Knapp 2 länk" },
        backgroundImage: { type: "text", label: "Bakgrundsbild URL" },
        trustItems: {
          type: "array",
          label: "Trust-siffror",
          arrayFields: {
            bold: { type: "text", label: "Siffra" },
            text: { type: "text", label: "Text" },
          },
        },
      },
      defaultProps: {
        badge: "Auktoriserad CF Moto-återförsäljare",
        title: "Rätt fordon för jobb och fritid i Jämtland",
        subtitle:
          "Personlig rådgivning, inga genvägar. Vi har hjälpt kunder i Krokom med omnejd sedan 1990.",
        cta1Text: "Se fyrhjulingar",
        cta1Url: "/fordon?kategori=atv",
        cta2Text: "Begagnade bilar",
        cta2Url: "/fordon?kategori=car",
        backgroundImage: "",
        trustItems: [
          { bold: "35+", text: "års erfarenhet" },
          { bold: "500+", text: "nöjda kunder" },
          { bold: "CF Moto", text: "auktoriserad" },
        ],
      },
      render: Hero as any,
    },

    PageHeader: {
      label: "Sidrubrik",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "textarea", label: "Underrubrik", contentEditable: true },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Ljus", value: "light" },
            { label: "Mörk", value: "dark" },
          ],
        },
      },
      defaultProps: {
        title: "Sidtitel",
        subtitle: "",
        variant: "light",
      },
      render: PageHeader as any,
    },

    VehicleGrid: {
      label: "Fordonsrutnät",

      fields: {
        category: {
          type: "select",
          label: "Kategori",
          options: [
            { label: "Alla", value: "all" },
            { label: "Bilar", value: "car" },
            { label: "Fyrhjulingar", value: "atv" },
            { label: "UTV", value: "utv" },
            { label: "ATV + UTV", value: "atv,utv" },
            { label: "Mopeder", value: "moped" },
            { label: "Släpvagnar", value: "slapvagn" },
            { label: "Trädgård", value: "tradgard" },
          ],
        },
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "text", label: "Underrubrik", contentEditable: true },
        showSearch: { type: "radio", label: "Visa sökfält", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        showFilters: { type: "radio", label: "Visa filter", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        filterBrands: { type: "text", label: "Filtermärken (kommaseparerade)" },
        maxItems: { type: "number", label: "Max antal" },
        featuredOnly: { type: "radio", label: "Bara utvalda", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
      },
      defaultProps: {
        category: "all",
        title: "",
        subtitle: "",
        showSearch: true,
        showFilters: false,
        filterBrands: "",
        maxItems: 50,
        featuredOnly: false,
      },
      render: VehicleGrid as any,
    },

    FAQ: {
      label: "Vanliga frågor",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "text", label: "Underrubrik", contentEditable: true },
        items: {
          type: "array",
          label: "Frågor",
          arrayFields: {
            question: { type: "text", label: "Fråga" },
            answer: { type: "textarea", label: "Svar" },
          },
        },
      },
      defaultProps: {
        title: "Vanliga frågor",
        subtitle: "",
        items: [
          {
            question: "Vilka fyrhjulingar säljer ni?",
            answer:
              "Vi är auktoriserad CF Moto-återförsäljare och erbjuder ett brett utbud av fyrhjulingar och UTV.",
          },
        ],
      },
      render: FAQ as any,
    },

    CTASection: {
      label: "Call to Action",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "text", label: "Underrubrik", contentEditable: true },
        showPhone: { type: "radio", label: "Visa telefon", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        showEmail: { type: "radio", label: "Visa e-post", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Blå", value: "blue" },
            { label: "Mörk", value: "dark" },
            { label: "Ljus", value: "light" },
          ],
        },
      },
      defaultProps: {
        title: "Redo att hitta ditt nästa fordon?",
        subtitle: "Kontakta oss för personlig rådgivning",
        showPhone: true,
        showEmail: true,
        variant: "blue",
      },
      render: CTASection as any,
    },

    WhySection: {
      label: "Varför oss",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "text", label: "Underrubrik", contentEditable: true },
        points: {
          type: "array",
          label: "Punkter",
          arrayFields: {
            title: { type: "text", label: "Titel" },
            description: { type: "textarea", label: "Beskrivning" },
            icon: {
              type: "select",
              label: "Ikon",
              options: [
                { label: "Sköld", value: "shield" },
                { label: "Hjärta", value: "heart" },
                { label: "Verktyg", value: "wrench" },
              ],
            },
          },
        },
      },
      defaultProps: {
        title: "Mer än bara fordon",
        subtitle: "",
        points: [
          {
            title: "Personlig service",
            description: "Vi tar oss tid att förstå dina behov.",
            icon: "heart",
          },
          {
            title: "Kvalitetsgaranti",
            description: "Alla fordon genomgår noggrann kontroll.",
            icon: "shield",
          },
          {
            title: "Fullservice verkstad",
            description: "Service och reparation av alla märken.",
            icon: "wrench",
          },
        ],
      },
      render: WhySection as any,
    },

    JustNuCards: {
      label: "Just nu-kort",

      fields: {
        title: { type: "text", label: "Rubrik" },
        cards: {
          type: "array",
          label: "Kort",
          arrayFields: {
            label: { type: "text", label: "Etikett" },
            title: { type: "text", label: "Titel" },
            text: { type: "textarea", label: "Text" },
            linkUrl: { type: "text", label: "Länk URL" },
            linkText: { type: "text", label: "Länktext" },
          },
        },
      },
      defaultProps: {
        title: "Just nu",
        cards: [],
      },
      render: JustNuCards as any,
    },

    QuickCategories: {
      label: "Snabbkategorier",

      fields: {
        items: {
          type: "array",
          label: "Kategorier",
          arrayFields: {
            label: { type: "text", label: "Namn" },
            url: { type: "text", label: "Länk" },
            icon: {
              type: "select",
              label: "Ikon",
              options: [
                { label: "Bil", value: "car" },
                { label: "Cykel/Moped", value: "bike" },
                { label: "Traktor", value: "tractor" },
                { label: "Lastbil/Släp", value: "truck" },
                { label: "Trädgård", value: "trees" },
              ],
            },
            count: { type: "text", label: "Antal" },
          },
        },
      },
      defaultProps: {
        items: [
          { label: "Bilar", url: "/fordon?kategori=car", icon: "car", count: "" },
          { label: "Fyrhjulingar", url: "/fordon?kategori=atv", icon: "tractor", count: "" },
          { label: "Mopeder", url: "/fordon?kategori=moped", icon: "bike", count: "" },
          { label: "Släpvagnar", url: "/fordon?kategori=slapvagn", icon: "truck", count: "" },
          { label: "Trädgård", url: "/fordon?kategori=tradgard", icon: "trees", count: "" },
        ],
      },
      render: QuickCategories as any,
    },

    Spotlight: {
      label: "Spotlight-sektion",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        subtitle: { type: "textarea", label: "Underrubrik", contentEditable: true },
        ctaText: { type: "text", label: "Knapptext", contentEditable: true },
        ctaUrl: { type: "text", label: "Knapplänk" },
        backgroundImage: { type: "text", label: "Bakgrundsbild URL" },
        tags: { type: "text", label: "Taggar (kommaseparerade)" },
      },
      defaultProps: {
        title: "CF Moto — Kraft & tillförlitlighet",
        subtitle: "Utforska vårt sortiment av CF Moto fyrhjulingar och UTV.",
        ctaText: "Se sortiment",
        ctaUrl: "/fordon?kategori=atv",
        backgroundImage: "",
        tags: "CF Moto, ATV, UTV, Fyrhjulingar",
      },
      render: Spotlight as any,
    },

    PartnerLogos: {
      label: "Partnerlogotyper",

      fields: {
        title: { type: "text", label: "Rubrik", contentEditable: true },
        logos: {
          type: "array",
          label: "Logotyper",
          arrayFields: {
            name: { type: "text", label: "Namn" },
            imageUrl: { type: "text", label: "Bild-URL" },
            url: { type: "text", label: "Webbplats" },
          },
        },
      },
      defaultProps: {
        title: "Våra partners",
        logos: [],
      },
      render: PartnerLogos as any,
    },

    BlogGrid: {
      label: "Blogg-rutnät",

      fields: {
        title: { type: "text", label: "Rubrik" },
        subtitle: { type: "text", label: "Underrubrik" },
        maxItems: { type: "number", label: "Antal inlägg" },
      },
      defaultProps: {
        title: "Senaste nytt",
        subtitle: "",
        maxItems: 3,
      },
      render: BlogGrid as any,
    },

    Timeline: {
      label: "Tidslinje",

      fields: {
        title: { type: "text", label: "Rubrik" },
        items: {
          type: "array",
          label: "Händelser",
          arrayFields: {
            year: { type: "text", label: "År" },
            title: { type: "text", label: "Titel" },
            text: { type: "textarea", label: "Beskrivning" },
          },
        },
      },
      defaultProps: {
        title: "Vår historia",
        items: [
          { year: "1990", title: "Starten", text: "HM Motor grundas i Krokom." },
        ],
      },
      render: Timeline as any,
    },

    ValuesGrid: {
      label: "Värderutnät",

      fields: {
        items: {
          type: "array",
          label: "Värden",
          arrayFields: {
            title: { type: "text", label: "Titel" },
            text: { type: "textarea", label: "Beskrivning" },
            icon: {
              type: "select",
              label: "Ikon",
              options: [
                { label: "Hjärta", value: "heart" },
                { label: "Sköld", value: "shield" },
                { label: "Användare", value: "users" },
              ],
            },
          },
        },
      },
      defaultProps: {
        items: [],
      },
      render: ValuesGrid as any,
    },

    ContactLayout: {
      label: "Kontaktsektion",

      fields: {
        showMap: { type: "radio", label: "Visa karta", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        mapEmbedUrl: { type: "text", label: "Google Maps embed-URL" },
      },
      defaultProps: {
        showMap: true,
        mapEmbedUrl: "",
      },
      render: ContactLayout as any,
    },

    TradeInStrip: {
      label: "Inbytes-strip",

      fields: {
        text: { type: "text", label: "Text" },
        ctaText: { type: "text", label: "Länktext" },
        ctaUrl: { type: "text", label: "Länk URL" },
      },
      defaultProps: {
        text: "Vi tar emot ditt gamla fordon i inbyte!",
        ctaText: "Kontakta oss",
        ctaUrl: "/kontakt",
      },
      render: TradeInStrip as any,
    },

    Spacer: {
      label: "Mellanrum",

      fields: {
        height: { type: "number", label: "Höjd (px)" },
      },
      defaultProps: { height: 48 },
      render: Spacer as any,
    },

    RichText: {
      label: "Fritext",

      fields: {
        content: { type: "textarea", label: "HTML-innehåll" },
        maxWidth: {
          type: "select",
          label: "Maxbredd",
          options: [
            { label: "Smal (640px)", value: "narrow" },
            { label: "Medium (800px)", value: "medium" },
            { label: "Bred (1140px)", value: "wide" },
          ],
        },
        align: {
          type: "select",
          label: "Justering",
          options: [
            { label: "Vänster", value: "left" },
            { label: "Centrerat", value: "center" },
          ],
        },
      },
      defaultProps: {
        content: "<p>Skriv ditt innehåll här...</p>",
        maxWidth: "medium",
        align: "left",
      },
      render: RichText as any,
    },

    ImageSection: {
      label: "Bildsektion",

      fields: {
        imageUrl: { type: "text", label: "Bild-URL" },
        alt: { type: "text", label: "Alt-text" },
        caption: { type: "text", label: "Bildtext" },
        fullWidth: { type: "radio", label: "Fullbredd", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
      },
      defaultProps: {
        imageUrl: "",
        alt: "",
        caption: "",
        fullWidth: false,
      },
      render: ImageSection as any,
    },
    // ═══ GRANULAR COMPONENTS ═══

    Section: {
      label: "Sektion (container)",
      fields: {
        background: { type: "select", label: "Bakgrund", options: [
          { label: "Vit", value: "white" }, { label: "Ljus", value: "light" },
          { label: "Dämpad", value: "muted" }, { label: "Mörk", value: "dark" },
          { label: "Blå", value: "blue" },
        ]},
        padding: { type: "select", label: "Padding", options: [
          { label: "Liten", value: "sm" }, { label: "Medium", value: "md" },
          { label: "Stor", value: "lg" }, { label: "Extra stor", value: "xl" },
        ]},
        maxWidth: { type: "select", label: "Maxbredd", options: [
          { label: "Smal (640px)", value: "narrow" }, { label: "Medium (800px)", value: "medium" },
          { label: "Bred (1140px)", value: "wide" }, { label: "Full (1320px)", value: "full" },
        ]},
        layout: { type: "select", label: "Layout", options: [
          { label: "Stapel (vertikalt)", value: "stack" },
          { label: "2 kolumner", value: "two-col" },
          { label: "3 kolumner", value: "three-col" },
          { label: "4 kolumner", value: "four-col" },
        ]},
        gap: { type: "select", label: "Avstånd", options: [
          { label: "Litet", value: "sm" }, { label: "Medium", value: "md" }, { label: "Stort", value: "lg" },
        ]},
      },
      defaultProps: { background: "white", padding: "lg", maxWidth: "wide", layout: "stack", gap: "md" },
      render: Section as any,
    },

    Heading: {
      label: "Rubrik",
      inline: true,
      fields: {
        text: { type: "text", label: "Text", contentEditable: true },
        level: { type: "select", label: "Nivå", options: [
          { label: "H1", value: "h1" }, { label: "H2", value: "h2" },
          { label: "H3", value: "h3" }, { label: "H4", value: "h4" },
        ]},
        align: { type: "select", label: "Justering", options: [
          { label: "Vänster", value: "left" }, { label: "Center", value: "center" }, { label: "Höger", value: "right" },
        ]},
        color: { type: "text", label: "Färg (hex)" },
        size: { type: "select", label: "Storlek", options: [
          { label: "Liten", value: "sm" }, { label: "Medium", value: "md" },
          { label: "Stor", value: "lg" }, { label: "Extra stor", value: "xl" },
          { label: "Jättestor", value: "2xl" },
        ]},
      },
      defaultProps: { text: "Rubrik", level: "h2", align: "left", color: "", size: "lg" },
      render: Heading as any,
    },

    Text: {
      label: "Text",
      inline: true,
      fields: {
        text: { type: "textarea", label: "Text", contentEditable: true },
        align: { type: "select", label: "Justering", options: [
          { label: "Vänster", value: "left" }, { label: "Center", value: "center" }, { label: "Höger", value: "right" },
        ]},
        color: { type: "text", label: "Färg (hex)" },
        size: { type: "select", label: "Storlek", options: [
          { label: "Liten", value: "sm" }, { label: "Normal", value: "base" },
          { label: "Stor", value: "lg" }, { label: "Extra stor", value: "xl" },
        ]},
      },
      defaultProps: { text: "Skriv din text här...", align: "left", color: "", size: "base" },
      render: Text as any,
    },

    Button: {
      label: "Knapp",
      inline: true,
      fields: {
        text: { type: "text", label: "Text", contentEditable: true },
        url: { type: "text", label: "Länk" },
        variant: { type: "select", label: "Stil", options: [
          { label: "Blå (fylld)", value: "blue" }, { label: "Outline", value: "outline" },
          { label: "Vit", value: "white" }, { label: "Ghost", value: "ghost" },
        ]},
        size: { type: "select", label: "Storlek", options: [
          { label: "Liten", value: "sm" }, { label: "Medium", value: "md" }, { label: "Stor", value: "lg" },
        ]},
        icon: { type: "select", label: "Ikon", options: [
          { label: "Ingen", value: "none" }, { label: "Pil", value: "arrow" },
          { label: "Telefon", value: "phone" }, { label: "E-post", value: "mail" },
        ]},
        align: { type: "select", label: "Justering", options: [
          { label: "Vänster", value: "left" }, { label: "Center", value: "center" }, { label: "Höger", value: "right" },
        ]},
      },
      defaultProps: { text: "Klicka här", url: "#", variant: "blue", size: "md", icon: "none", align: "left" },
      render: Button as any,
    },

    Card: {
      label: "Kort",
      fields: {
        title: { type: "text", label: "Titel", contentEditable: true },
        text: { type: "textarea", label: "Text", contentEditable: true },
        icon: { type: "select", label: "Ikon", options: [
          { label: "Hjärta", value: "heart" }, { label: "Sköld", value: "shield" },
          { label: "Verktyg", value: "wrench" }, { label: "Användare", value: "users" },
          { label: "Stjärna", value: "star" }, { label: "Plats", value: "mappin" },
        ]},
        variant: { type: "select", label: "Layout", options: [
          { label: "Standard", value: "default" }, { label: "Centrerat", value: "centered" },
          { label: "Horisontellt", value: "horizontal" },
        ]},
      },
      defaultProps: { title: "Titel", text: "Beskrivning...", icon: "heart", variant: "default" },
      render: Card as any,
    },

    FAQItem: {
      label: "FAQ-fråga",
      fields: {
        question: { type: "text", label: "Fråga", contentEditable: true },
        answer: { type: "textarea", label: "Svar", contentEditable: true },
      },
      defaultProps: { question: "Fråga?", answer: "Svar..." },
      render: FAQItem as any,
    },

    TimelineItem: {
      label: "Tidslinje-punkt",
      fields: {
        year: { type: "text", label: "År", contentEditable: true },
        title: { type: "text", label: "Titel", contentEditable: true },
        text: { type: "textarea", label: "Text", contentEditable: true },
      },
      defaultProps: { year: "2024", title: "Händelse", text: "Beskrivning..." },
      render: TimelineItem as any,
    },

    PromoCard: {
      label: "Kampanjkort",
      fields: {
        label: { type: "text", label: "Etikett", contentEditable: true },
        title: { type: "text", label: "Titel", contentEditable: true },
        text: { type: "textarea", label: "Text", contentEditable: true },
        linkUrl: { type: "text", label: "Länk URL" },
        linkText: { type: "text", label: "Länktext", contentEditable: true },
      },
      defaultProps: { label: "Nyhet", title: "Titel", text: "Beskrivning...", linkUrl: "#", linkText: "Läs mer" },
      render: PromoCard as any,
    },
  },
};
