/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Config, Data } from "@puckeditor/core";
import {
  Hero, type HeroProps,
  NuPagar, type NuPagarProps,
  Portfolio, type PortfolioProps,
  About, type AboutProps,
  GalleryHeading, type GalleryHeadingProps,
  ExhibitionsHeading, type ExhibitionsHeadingProps,
  Contact, type ContactProps,
  Footer, type FooterProps,
} from "@/components/puck-darek/sections";

// Hjälpfält för listor (Puck array-fält)
const kvList = (keyLabel: string, valLabel: string) => ({
  type: "array" as const,
  arrayFields: {
    key: { type: "text" as const, label: keyLabel },
    val: { type: "text" as const, label: valLabel },
  },
  defaultItemProps: { key: "", val: "" },
});

const stringList = {
  type: "array" as const,
  arrayFields: { value: { type: "text" as const } },
  defaultItemProps: { value: "" },
};

export const puckConfigArt: Config<{
  Hero: HeroProps;
  NuPagar: NuPagarProps;
  Portfolio: PortfolioProps;
  About: AboutProps;
  GalleryHeading: GalleryHeadingProps;
  ExhibitionsHeading: ExhibitionsHeadingProps;
  Contact: ContactProps;
  Footer: FooterProps;
}> = {
  components: {
    Hero: {
      label: "Hero",
      fields: {
        year: { type: "text", label: "Övre etikett" },
        titleLine1: { type: "text", label: "Titel rad 1" },
        titleLine2: { type: "text", label: "Titel rad 2 (italic)" },
        tagline: { type: "text", label: "Tagline" },
        ctaLabel: { type: "text", label: "Knapp-text" },
        ctaHref: { type: "text", label: "Knapp-länk" },
        heroImage: { type: "text", label: "Hero-bild URL" },
        heroAlt: { type: "text", label: "Bild alt-text" },
        scrollHint: { type: "text", label: "Scroll-text" },
      },
      defaultProps: { year: "Konstnär · Sandarne", titleLine1: "Darek", titleLine2: "Uhrberg", tagline: "", ctaLabel: "Utforska verken", ctaHref: "#portfolio", heroImage: "", heroAlt: "", scrollHint: "Scrolla" },
      render: Hero,
    },
    NuPagar: {
      label: "Nu pågår-banner",
      fields: {
        enabled: { type: "radio", label: "Visa banner", options: [{ label: "Ja", value: true }, { label: "Nej", value: false }] },
        label: { type: "text", label: "Etikett" },
        title: { type: "text", label: "Titel" },
        ctaLabel: { type: "text", label: "CTA-text" },
        ctaHref: { type: "text", label: "CTA-länk" },
        meta: { ...kvList("Etikett", "Värde"), label: "Detaljer" },
      },
      defaultProps: { enabled: true, label: "Nu pågår", title: "", ctaLabel: "Mer info", ctaHref: "#", meta: [] },
      render: NuPagar,
    },
    Portfolio: {
      label: "Portfolio (utvalda verk)",
      fields: {
        filters: { ...stringList, label: "Filter-knappar" } as any,
        rows: {
          type: "array",
          label: "Rader",
          arrayFields: {
            class: { type: "select", label: "Layout", options: [
              { label: "Stor + 2 små", value: "gallery-row-1" },
              { label: "3 lika", value: "gallery-row-2" },
              { label: "Liten + stor + liten", value: "gallery-row-3" },
            ]},
            items: {
              type: "array",
              label: "Verk",
              arrayFields: {
                image: { type: "text", label: "Bild URL" },
                alt: { type: "text", label: "Alt-text" },
                category: { type: "text", label: "Kategori" },
                title: { type: "text", label: "Titel" },
                caption: { type: "text", label: "Caption" },
              },
              defaultItemProps: { image: "", alt: "", category: "", title: "", caption: "" },
            },
          },
          defaultItemProps: { class: "gallery-row-2", items: [] },
        } as any,
      },
      defaultProps: { filters: [{ value: "Alla" }] as any, rows: [] },
      render: Portfolio,
    },
    About: {
      label: "Om konstnären",
      fields: {
        sectionLabel: { type: "text", label: "Etikett" },
        titleHtml: { type: "text", label: "Rubrik (HTML — em + br tillåtna)" },
        portrait: { type: "text", label: "Porträtt URL" },
        portraitAlt: { type: "text", label: "Alt-text" },
        portraitLabel: { type: "text", label: "Bildtext" },
        paragraphs: { ...stringList, label: "Stycken" } as any,
        stats: {
          type: "array",
          label: "Statistik",
          arrayFields: {
            number: { type: "text", label: "Siffra" },
            label: { type: "text", label: "Etikett" },
          },
          defaultItemProps: { number: "", label: "" },
        },
      },
      defaultProps: { sectionLabel: "Om konstnären", titleHtml: "", portrait: "", portraitAlt: "", portraitLabel: "", paragraphs: [] as any, stats: [] },
      render: About,
    },
    GalleryHeading: {
      label: "Galleri-rubrik (verken auto)",
      fields: {
        sectionLabel: { type: "text", label: "Etikett" },
        heading: { type: "text", label: "Rubrik" },
        introQuote: { type: "textarea", label: "Citat" },
        introSub: { type: "textarea", label: "Underrubrik" },
      },
      defaultProps: { sectionLabel: "Galleri", heading: "Konst till salu", introQuote: "", introSub: "" },
      render: GalleryHeading,
    },
    ExhibitionsHeading: {
      label: "Utställningar-rubrik",
      fields: {
        sectionLabel: { type: "text", label: "Etikett" },
        heading: { type: "text", label: "Rubrik" },
      },
      defaultProps: { sectionLabel: "CV", heading: "Utställningar" },
      render: ExhibitionsHeading,
    },
    Contact: {
      label: "Kontakt",
      fields: {
        heading: { type: "text", label: "Rubrik (HTML)" },
        subheading: { type: "text", label: "Underrubrik" },
        email: { type: "text", label: "E-post" },
        phone: { type: "text", label: "Telefon" },
        address: { type: "text", label: "Adress" },
        social: {
          type: "array",
          label: "Sociala länkar",
          arrayFields: {
            label: { type: "text", label: "Etikett" },
            href: { type: "text", label: "URL" },
          },
          defaultItemProps: { label: "", href: "" },
        },
      },
      defaultProps: { heading: "", subheading: "", email: "", phone: "", address: "", social: [] },
      render: Contact,
    },
    Footer: {
      label: "Footer",
      fields: {
        copyright: { type: "text", label: "Copyright" },
        logo: { type: "text", label: "Logo (text)" },
        location: { type: "text", label: "Plats" },
      },
      defaultProps: { copyright: "", logo: "DU", location: "" },
      render: Footer,
    },
  },
  root: { fields: { title: { type: "text", label: "Sidans titel" } }, defaultProps: { title: "Darek Uhrberg — Konstnär" } },
};

// ─────────────────────────────────────────────────────────────────────
// SEKTIONER ↔ PUCK DATA — översätter darek_content sektioner till Puck Data
// ─────────────────────────────────────────────────────────────────────

type ContentMap = Record<string, any>;

export function sectionsToPuck(content: ContentMap): Data {
  const blocks: Data["content"] = [];
  const push = (type: string, props: any) => {
    blocks.push({ type, props: { id: `${type}-${blocks.length}`, ...props } });
  };
  if (content.hero) push("Hero", content.hero);
  if (content.nuPagar) push("NuPagar", content.nuPagar);
  if (content.portfolio) push("Portfolio", content.portfolio);
  if (content.about) push("About", content.about);
  if (content.shop) push("GalleryHeading", { sectionLabel: content.shop.sectionLabel, heading: content.shop.heading, introQuote: content.shop.intro?.quote || "", introSub: content.shop.intro?.sub || "" });
  if (content.exhibitions) push("ExhibitionsHeading", { sectionLabel: content.exhibitions.sectionLabel, heading: content.exhibitions.heading });
  if (content.contact) push("Contact", content.contact);
  if (content.footer) push("Footer", content.footer);
  return { content: blocks, root: { props: { title: content.site?.title || "Darek Uhrberg — Konstnär" } } };
}

export function puckToSections(data: Data, baseContent: ContentMap): ContentMap {
  const out = { ...baseContent };
  for (const block of data.content) {
    const props = { ...(block.props as any) };
    delete props.id;
    switch (block.type) {
      case "Hero": out.hero = props; break;
      case "NuPagar": out.nuPagar = props; break;
      case "Portfolio": out.portfolio = props; break;
      case "About": out.about = props; break;
      case "GalleryHeading":
        out.shop = { ...(out.shop || {}), sectionLabel: props.sectionLabel, heading: props.heading, intro: { quote: props.introQuote, sub: props.introSub } };
        break;
      case "ExhibitionsHeading":
        out.exhibitions = { ...(out.exhibitions || {}), sectionLabel: props.sectionLabel, heading: props.heading };
        break;
      case "Contact": out.contact = props; break;
      case "Footer": out.footer = props; break;
    }
  }
  if ((data.root?.props as any)?.title) out.site = { ...(out.site || {}), title: (data.root!.props as any).title };
  return out;
}
