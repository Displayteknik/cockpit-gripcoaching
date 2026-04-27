/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config } from "@puckeditor/core";
import { ImageField } from "@/components/puck/fields/ImageField";
import { puckConfig as hmConfig } from "@/lib/puck-config";
import {
  Section, type SectionProps,
  Heading, type HeadingProps,
  Label, type LabelProps,
  Text, type TextProps,
  Button, type ButtonProps,
  Image, type ImageProps,
  Spacer, type SpacerProps,
  TwoColumn, type TwoColumnProps,
  Stats, type StatsProps,
  Hero, type HeroProps,
  Portfolio, type PortfolioProps,
  NuPagar, type NuPagarProps,
  Contact, type ContactProps,
  Footer, type FooterProps,
  Nav, type NavProps,
} from "@/components/puck-darek/theme";

const ce = (label: string) => ({ type: "text" as const, label, contentEditable: true } as any);
const cea = (label: string) => ({ type: "textarea" as const, label, contentEditable: true } as any);
const text = (label: string) => ({ type: "text" as const, label });
const image = (label: string = "Bild") => ({
  type: "custom" as const,
  label,
  render: ({ value, onChange }: any) => ImageField({ value: value || "", onChange, bucket: "darek-images" }),
} as any);

export const puckConfigDarek: Config<{
  Hero: HeroProps;
  Section: SectionProps;
  Heading: HeadingProps;
  Label: LabelProps;
  Text: TextProps;
  Button: ButtonProps;
  Image: ImageProps;
  Spacer: SpacerProps;
  TwoColumn: TwoColumnProps;
  Stats: StatsProps;
  Portfolio: PortfolioProps;
  NuPagar: NuPagarProps;
  Contact: ContactProps;
  Footer: FooterProps;
  Nav: NavProps;
}> = {
  categories: {
    sektioner: { title: "Sektioner", components: ["Nav", "Hero", "NuPagar", "Portfolio", "TwoColumn", "Contact", "Footer", "Section"] },
    text: { title: "Text & rubriker", components: ["Heading", "Label", "Text", "Button"] },
    media: { title: "Media", components: ["Image", "Stats", "Spacer"] },
  },
  components: {
    Hero: {
      label: "Hero (förstaintryck)",
      fields: {
        label: ce("Övre etikett"),
        titleLine1: ce("Titel rad 1"),
        titleLine2: ce("Titel rad 2 (italic-accent)"),
        tagline: cea("Tagline"),
        ctaText: ce("Knapp-text"),
        ctaHref: text("Knapp-länk"),
        heroImage: image("Hero-bild (statisk om ingen slideshow)"),
        slideshow: {
          type: "array",
          label: "Slideshow-bilder (auto-rotation 5s)",
          arrayFields: { image: image("Bild") } as any,
          defaultItemProps: { image: "" },
        } as any,
        heroAlt: text("Bild alt-text"),
        layout: { type: "select", label: "Layout", options: [
          { label: "Split (text + bild)", value: "split" },
          { label: "Full-bleed (bild över allt)", value: "fullbleed" },
        ]},
      },
      defaultProps: { label: "Konstnär · Sandarne", titleLine1: "Darek", titleLine2: "Uhrberg", tagline: "Kreativ frihet utan begränsningar", ctaText: "Utforska verken", ctaHref: "#portfolio", heroImage: "", heroAlt: "", slideshow: [], layout: "split" },
      render: Hero,
    },
    Nav: {
      label: "Nav-meny (toppmeny)",
      fields: {
        logoText: ce("Logo-text"),
        links: {
          type: "array", label: "Länkar",
          arrayFields: { label: ce("Etikett"), href: text("Anchor / URL") },
          defaultItemProps: { label: "", href: "#" },
        } as any,
      },
      defaultProps: { logoText: "DAREK UHRBERG", links: [{ label: "Verk", href: "#portfolio" }, { label: "Om", href: "#about" }, { label: "Konst till salu", href: "#shop" }, { label: "Utställningar", href: "#exhibitions" }, { label: "Kontakt", href: "#contact" }] },
      render: Nav,
    },
    NuPagar: {
      label: "Nu pågår-banner",
      fields: {
        enabled: { type: "radio", label: "Visa banner", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        label: ce("Etikett"),
        title: ce("Titel"),
        ctaText: ce("CTA-text"),
        ctaHref: text("CTA-länk"),
        meta: { type: "array", label: "Detaljer", arrayFields: { key: ce("Etikett"), val: ce("Värde") }, defaultItemProps: { key: "", val: "" } } as any,
      },
      defaultProps: { enabled: true, label: "Nu pågår", title: "", ctaText: "Mer info", ctaHref: "#", meta: [] },
      render: NuPagar,
    },
    Contact: {
      label: "Kontakt",
      fields: {
        heading: ce("Rubrik rad 1"),
        headingItalic: ce("Italic rad 2 (valfri)"),
        subheading: ce("Underrubrik"),
        email: ce("E-post"),
        phone: ce("Telefon"),
        address: ce("Adress"),
        showForm: { type: "radio", label: "Visa formulär", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        formSubjects: {
          type: "array", label: "Formulär-ämnen",
          arrayFields: { value: ce("Värde"), label: ce("Etikett") },
          defaultItemProps: { value: "", label: "" },
        } as any,
        social: {
          type: "array", label: "Sociala länkar",
          arrayFields: { label: ce("Etikett"), href: text("URL") },
          defaultItemProps: { label: "Instagram", href: "https://instagram.com/" },
        } as any,
      },
      defaultProps: { heading: "Låt oss", headingItalic: "prata konst", subheading: "Förfrågningar om verk, utställningar & ateljéebesök", email: "", phone: "", address: "", showForm: true, formSubjects: [], social: [] },
      render: Contact,
    },
    Footer: {
      label: "Footer",
      fields: {
        copyright: ce("Copyright"),
        logo: ce("Logo (text)"),
        location: ce("Plats"),
      },
      defaultProps: { copyright: "© 2026 Darek Uhrberg. Alla rättigheter förbehållna.", logo: "DU", location: "Sandarne, Sverige" },
      render: Footer,
    },
    Portfolio: {
      label: "Portfolio (utvalda verk)",
      fields: {
        label: ce("Etikett"),
        heading: ce("Rubrik"),
        headingItalic: ce("Italic-accent (rad 2)"),
        filters: {
          type: "array",
          label: "Filter-knappar",
          arrayFields: { value: ce("Etikett") },
          defaultItemProps: { value: "Alla" },
        } as any,
        rows: {
          type: "array",
          label: "Rader",
          arrayFields: {
            layout: { type: "select", label: "Layout", options: [
              { label: "Stor + 2 små", value: "big-2small" },
              { label: "3 lika", value: "3equal" },
              { label: "Liten + stor + liten", value: "small-big-small" },
            ]},
            items: {
              type: "array",
              label: "Verk",
              arrayFields: {
                image: image("Verk-bild"),
                alt: ce("Alt-text"),
                title: ce("Titel"),
                caption: ce("Caption (teknik · mått)"),
                category: text("Kategori"),
              },
              defaultItemProps: { image: "", alt: "", title: "", caption: "", category: "" },
            },
          },
          defaultItemProps: { layout: "3equal", items: [] },
        } as any,
      },
      defaultProps: {
        label: "Portfolio",
        heading: "Utvalda",
        headingItalic: "Verk",
        filters: [{ value: "Alla" }, { value: "Akryl" }, { value: "Ink" }, { value: "Mixed Media" }],
        rows: [],
      },
      render: Portfolio,
    },
    TwoColumn: {
      label: "Bild + text",
      fields: {
        image: image("Bild"),
        imageAlt: ce("Alt-text"),
        imagePosition: { type: "radio", label: "Bildplacering", options: [{ label: "Vänster", value: "left" }, { label: "Höger", value: "right" }] },
        label: ce("Etikett"),
        heading: ce("Rubrik"),
        headingItalic: { type: "radio", label: "Italic-rubrik", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        body: cea("Brödtext"),
        ctaText: ce("Knapp-text"),
        ctaHref: text("Knapp-länk"),
      },
      defaultProps: { image: "", imageAlt: "", imagePosition: "left", label: "", heading: "Rubrik", headingItalic: false, body: "", ctaText: "", ctaHref: "" },
      render: TwoColumn,
    },
    Section: {
      label: "Sektion (container)",
      fields: {
        background: { type: "select", label: "Bakgrund", options: [
          { label: "Svart", value: "dark" },
          { label: "Mörkare", value: "darker" },
          { label: "Genomskinlig", value: "transparent" },
          { label: "Bild", value: "image" },
        ]},
        backgroundImage: image("Bakgrundsbild (om Bild)"),
        paddingY: { type: "select", label: "Vertikal padding", options: [
          { label: "Liten", value: "sm" }, { label: "Mellan", value: "md" }, { label: "Stor", value: "lg" }, { label: "Extra stor", value: "xl" }
        ]},
        align: { type: "radio", label: "Justera", options: [{ label: "Vänster", value: "left" }, { label: "Centrum", value: "center" }] },
        maxWidth: { type: "select", label: "Bredd", options: [
          { label: "Smal", value: "narrow" }, { label: "Mellan", value: "medium" }, { label: "Bred", value: "wide" }, { label: "Hela", value: "full" }
        ]},
      },
      defaultProps: { background: "dark", paddingY: "md", align: "left", maxWidth: "wide" },
      render: Section as any,
    },
    Heading: {
      label: "Rubrik",
      fields: {
        text: ce("Text"),
        level: { type: "select", label: "Nivå", options: [
          { label: "H1", value: "h1" }, { label: "H2", value: "h2" }, { label: "H3", value: "h3" }, { label: "H4", value: "h4" }
        ]},
        size: { type: "select", label: "Storlek", options: [
          { label: "S", value: "sm" }, { label: "M", value: "md" }, { label: "L", value: "lg" }, { label: "XL", value: "xl" }, { label: "2XL", value: "2xl" }, { label: "3XL (hero)", value: "3xl" }
        ]},
        align: { type: "radio", label: "Justera", options: [{ label: "V", value: "left" }, { label: "C", value: "center" }, { label: "H", value: "right" }] },
        italic: { type: "radio", label: "Italic", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        color: { type: "select", label: "Färg", options: [{ label: "Cream", value: "cream" }, { label: "Guld", value: "gold" }, { label: "Muted", value: "muted" }] },
      },
      defaultProps: { text: "Rubrik", level: "h2", size: "lg", align: "left", italic: false, color: "cream" },
      render: Heading,
    },
    Label: {
      label: "Etikett (gold uppercase)",
      fields: {
        text: ce("Text"),
        align: { type: "radio", label: "Justera", options: [{ label: "V", value: "left" }, { label: "C", value: "center" }, { label: "H", value: "right" }] },
      },
      defaultProps: { text: "Etikett", align: "left" },
      render: Label,
    },
    Text: {
      label: "Text",
      fields: {
        text: cea("Text"),
        size: { type: "select", label: "Storlek", options: [{ label: "S", value: "sm" }, { label: "M", value: "md" }, { label: "L", value: "lg" }] },
        italic: { type: "radio", label: "Italic (Cormorant)", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        align: { type: "radio", label: "Justera", options: [{ label: "V", value: "left" }, { label: "C", value: "center" }, { label: "H", value: "right" }] },
        color: { type: "select", label: "Färg", options: [{ label: "Cream", value: "cream" }, { label: "Muted", value: "muted" }, { label: "Guld", value: "gold" }] },
      },
      defaultProps: { text: "Text...", size: "md", italic: false, align: "left", color: "cream" },
      render: Text,
    },
    Button: {
      label: "Knapp",
      fields: {
        text: ce("Text"),
        href: text("Länk"),
        variant: { type: "select", label: "Stil", options: [
          { label: "Outline (gold border)", value: "outline" },
          { label: "Solid (gold bg)", value: "solid" },
          { label: "Ghost (text-only)", value: "ghost" },
        ]},
        align: { type: "radio", label: "Justera", options: [{ label: "V", value: "left" }, { label: "C", value: "center" }, { label: "H", value: "right" }] },
      },
      defaultProps: { text: "Klicka här", href: "#", variant: "outline", align: "left" },
      render: Button,
    },
    Image: {
      label: "Bild",
      fields: {
        src: image("Bild"),
        alt: text("Alt-text"),
        caption: ce("Bildtext"),
        ratio: { type: "select", label: "Format", options: [
          { label: "Auto", value: "auto" }, { label: "Kvadrat", value: "square" }, { label: "Liggande 16:9", value: "landscape" }, { label: "Stående 3:4", value: "portrait" }
        ]},
        rounded: { type: "radio", label: "Rundade hörn", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
      },
      defaultProps: { src: "", alt: "", caption: "", ratio: "landscape", rounded: false },
      render: Image,
    },
    Spacer: {
      label: "Mellanrum",
      fields: { height: { type: "number", label: "Höjd (px)" } },
      defaultProps: { height: 40 },
      render: Spacer,
    },
    Stats: {
      label: "Statistik",
      fields: {
        items: {
          type: "array",
          label: "Siffror",
          arrayFields: {
            number: ce("Siffra"),
            label: ce("Etikett"),
          },
          defaultItemProps: { number: "5+", label: "År aktiv" },
        },
        align: { type: "radio", label: "Justera", options: [{ label: "V", value: "left" }, { label: "C", value: "center" }] },
      },
      defaultProps: { items: [{ number: "5+", label: "År aktiv" }, { number: "20+", label: "Utställningar" }, { number: "3", label: "Tekniker" }], align: "left" },
      render: Stats,
    },
  },
  root: {
    fields: { title: { type: "text", label: "Sidans titel" } },
    defaultProps: { title: "Darek Uhrberg — Konstnär" },
  },
};

// MERGE: Lägg till HM Motors komponenter (granular + sektioner) som Darek också kan använda
// Darek-komponenter behåller prioritet vid namnkonflikt
const hmCategoriesArr = Object.entries(hmConfig.categories || {}).map(([key, cat]: [string, any]) => ({
  key,
  title: cat.title || key,
  components: cat.components || [],
}));
const darekCategoryKeys = new Set(Object.keys(puckConfigDarek.categories || {}));

for (const cat of hmCategoriesArr) {
  // Filtrera bort komponenter som Darek redan har (Hero, Section, Heading, Text, Button, Image, Spacer)
  const filtered = cat.components.filter((c: string) => !puckConfigDarek.components[c as keyof typeof puckConfigDarek.components]);
  if (filtered.length === 0) continue;
  const newKey = darekCategoryKeys.has(cat.key) ? `hm_${cat.key}` : cat.key;
  (puckConfigDarek.categories as any)[newKey] = {
    title: `HM ${cat.title}`,
    components: filtered,
  };
}

// Importera HM Motor-komponenters render + fields
for (const [name, comp] of Object.entries(hmConfig.components)) {
  if (!(puckConfigDarek.components as any)[name]) {
    (puckConfigDarek.components as any)[name] = comp;
  }
}
