import type { StudioFormat } from "./payload";
import type { ContentFormat } from "./brand";

// Client-säker mall-metadata (inga React-komponenter — kan importeras i klient-UI).
// Kompletterar components/studio/registry.ts (som har själva komponenterna, server-side).

export interface TemplateMeta {
  id: string;
  name: string;
  formats: StudioFormat[];
  headlineSoftMax: number; // ~tecken som ryms på en rubrik-rad (mjuk varning i UI)
  archetype?: boolean; // brand-kit-driven (funkar för alla klienter)
  clientSlug?: string; // exklusiv för denna klient (t.ex. Opticurs handgjorda mallar)
  formatKey?: ContentFormat; // vilket contentProfile-format mallen tillhör
  fields: {
    headline1: string; // etikett; tom = dölj fältet
    headline2: string;
    body: string;
    badge: boolean; // stödjer stjärn-badge
    brush: boolean; // har färgbar penseldrags-ruta bakom brödtexten
  };
}

export const TEMPLATE_META: TemplateMeta[] = [
  // ── Brand-kit-arketyper (alla klienter) ──
  {
    id: "ark-overlay", name: "Foto + overlay", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 22, archetype: true, formatKey: "overlay",
    fields: { headline1: "Rubrik (på bilden)", headline2: "Etikett (valfri)", body: "Text på bilden", badge: false, brush: false },
  },
  {
    id: "ark-textkort", name: "Textkort", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 28, archetype: true, formatKey: "text-only",
    fields: { headline1: "Etikett (valfri)", headline2: "Rubrik", body: "Huvudtext", badge: false, brush: false },
  },
  {
    id: "ark-foto-ruta", name: "Foto + ruta", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 26, archetype: true, formatKey: "poster",
    fields: { headline1: "Rubrik (versaler)", headline2: "Underrubrik", body: "Text i rutan", badge: true, brush: true },
  },
  {
    id: "ark-statement", name: "Statement", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 20, archetype: true, formatKey: "statement",
    fields: { headline1: "Jätterubrik", headline2: "Underrubrik", body: "Kort text (valfri)", badge: false, brush: false },
  },
  {
    id: "ark-citat", name: "Citat / kundröst", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 24, archetype: true, formatKey: "quote",
    fields: { headline1: "Etikett (valfri, t.ex. KUNDRÖST)", headline2: "Avsändare / roll", body: "Citatet", badge: false, brush: false },
  },
  {
    id: "ark-lista", name: "Lista / tips", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 22, archetype: true, formatKey: "list",
    fields: { headline1: "Rubrik", headline2: "Underrubrik (valfri)", body: "Punkter — en per rad", badge: false, brush: false },
  },
  {
    id: "ark-erbjudande", name: "Erbjudande", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 24, archetype: true, formatKey: "offer",
    fields: { headline1: "Rubrik", headline2: "Underrubrik", body: "Text (om ingen badge)", badge: true, brush: false },
  },
  // ── Opticur-exklusiva (handgjorda, premium) ──
  {
    id: "opticur-foto-gul-ruta", name: "Opticur — foto + gul ruta", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 26, clientSlug: "opticur",
    fields: { headline1: "Rubrik (grön, versaler)", headline2: "Underrubrik (svart)", body: "Text i rutan", badge: true, brush: true },
  },
  {
    id: "opticur-bage-rubrik", name: "Opticur — bågform + rubrik", formats: ["1080x1350", "1080x1080"], headlineSoftMax: 15, clientSlug: "opticur",
    fields: { headline1: "Jätterubrik (gul kontur)", headline2: "Underrubrik (grön)", body: "Brödtext (valfri)", badge: false, brush: false },
  },
];

export function getTemplateMeta(id: string): TemplateMeta | undefined {
  return TEMPLATE_META.find((t) => t.id === id);
}

// ALLA klienter har tillgång till ALLA arketyper — flexibilitet byggs aldrig bort.
// `recommended` (contentProfile.formats) FILTRERAR inte, den bara sorterar de
// föreslagna formaten först. Opticurs exklusiva mallar visas bara för Opticur.
export function templatesForClient(slug: string, recommended?: ContentFormat[]): TemplateMeta[] {
  const list = TEMPLATE_META.filter((t) => !t.clientSlug || t.clientSlug === slug);
  if (!recommended || !recommended.length) return list;
  const rec = new Set(recommended);
  return [...list].sort((a, b) => {
    const ra = a.formatKey && rec.has(a.formatKey) ? 0 : 1;
    const rb = b.formatKey && rec.has(b.formatKey) ? 0 : 1;
    return ra - rb;
  });
}

// Är formatet föreslaget för klienten (för "Föreslås"-markering i UI)?
export function isRecommendedFormat(meta: TemplateMeta, recommended?: ContentFormat[]): boolean {
  return !!recommended?.length && !!meta.formatKey && recommended.includes(meta.formatKey);
}
