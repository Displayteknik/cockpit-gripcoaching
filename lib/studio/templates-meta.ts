import type { StudioFormat } from "./payload";

// Client-säker mall-metadata (inga React-komponenter — kan importeras i klient-UI).
// Kompletterar components/studio/registry.ts (som har själva komponenterna, server-side).

export interface TemplateMeta {
  id: string;
  name: string;
  formats: StudioFormat[];
  headlineSoftMax: number; // ~tecken som ryms på en rubrik-rad (mjuk varning i UI)
  fields: {
    headline1: string; // etikett; tom = dölj fältet
    headline2: string;
    body: string;
    badge: boolean; // stödjer stjärn-badge
    brush: boolean; // har färgbar penseldrags-ruta bakom brödtexten
  };
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "opticur-foto-gul-ruta",
    name: "Foto + gul ruta",
    formats: ["1080x1350", "1080x1080"],
    headlineSoftMax: 26,
    fields: {
      headline1: "Rubrik (grön, versaler)",
      headline2: "Underrubrik (svart)",
      body: "Text i rutan",
      badge: true,
      brush: true,
    },
  },
  {
    id: "opticur-bage-rubrik",
    name: "Bågform + rubrik",
    formats: ["1080x1350", "1080x1080"],
    headlineSoftMax: 15,
    fields: {
      headline1: "Jätterubrik (gul kontur)",
      headline2: "Underrubrik (grön)",
      body: "Brödtext (valfri)",
      badge: false,
      brush: false,
    },
  },
];

export function getTemplateMeta(id: string): TemplateMeta | undefined {
  return TEMPLATE_META.find((t) => t.id === id);
}
