import type React from "react";
import OpticurFotoGulRuta from "./templates/OpticurFotoGulRuta";
import OpticurBageRubrik from "./templates/OpticurBageRubrik";
import OpticurSkarmSplit from "./templates/OpticurSkarmSplit";
import ArkFotoRuta from "./archetypes/ArkFotoRuta";
import ArkStatement from "./archetypes/ArkStatement";
import ArkCitat from "./archetypes/ArkCitat";
import ArkLista from "./archetypes/ArkLista";
import ArkErbjudande from "./archetypes/ArkErbjudande";
import ArkOverlay from "./archetypes/ArkOverlay";
import ArkTextkort from "./archetypes/ArkTextkort";
import ArkKarusell from "./archetypes/ArkKarusell";
import ArkSkarm from "./archetypes/ArkSkarm";
import type { StudioPayload, StudioFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";
import type { LogoHint } from "@/lib/studio/logo-style";

// templateId → mallkomponent + tillåtna format. Ny mall = en rad här + en komponent.

export interface TemplateProps {
  payload: StudioPayload;
  brand: StudioBrand;
  slideIndex?: number; // ark-karusell: vilken slide som renderas (0-baserad)
  // BILD-5a: serverns val av ljus/mörk logga + ev. platta (ark-overlay/ark-karusell).
  // Sätts av render-routen; saknas i live-editorn (client) → mallens fallback gäller.
  logoHint?: LogoHint | null;
}

export interface TemplateDef {
  id: string;
  name: string;
  formats: StudioFormat[];
  component: React.ComponentType<TemplateProps>;
}

export const STUDIO_TEMPLATES: Record<string, TemplateDef> = {
  "opticur-foto-gul-ruta": {
    id: "opticur-foto-gul-ruta",
    name: "Opticur — foto + gul ruta",
    formats: ["1080x1350", "1080x1080"],
    component: OpticurFotoGulRuta,
  },
  "opticur-bage-rubrik": {
    id: "opticur-bage-rubrik",
    name: "Opticur — bågform + rubrik",
    formats: ["1080x1350", "1080x1080"],
    component: OpticurBageRubrik,
  },
  // Opticur-exklusiv, fri storlek — se lib/studio/templates-meta.ts (freeSize).
  "opticur-skarm-split": {
    id: "opticur-skarm-split",
    name: "Opticur — delad yta (skärm)",
    formats: ["1080x1350"],
    component: OpticurSkarmSplit,
  },
  "ark-foto-ruta": { id: "ark-foto-ruta", name: "Foto + ruta", formats: ["1080x1350", "1080x1080"], component: ArkFotoRuta },
  "ark-statement": { id: "ark-statement", name: "Statement", formats: ["1080x1350", "1080x1080", "1080x1920"], component: ArkStatement },
  "ark-citat": { id: "ark-citat", name: "Citat", formats: ["1080x1350", "1080x1080", "1080x1920"], component: ArkCitat },
  "ark-lista": { id: "ark-lista", name: "Lista / tips", formats: ["1080x1350", "1080x1080"], component: ArkLista },
  "ark-erbjudande": { id: "ark-erbjudande", name: "Erbjudande", formats: ["1080x1350", "1080x1080"], component: ArkErbjudande },
  "ark-overlay": { id: "ark-overlay", name: "Foto + overlay", formats: ["1080x1350", "1080x1080", "1080x1920"], component: ArkOverlay },
  "ark-textkort": { id: "ark-textkort", name: "Textkort", formats: ["1080x1350", "1080x1080", "1080x1920"], component: ArkTextkort },
  "ark-karusell": { id: "ark-karusell", name: "Karusell", formats: ["1080x1350", "1080x1080"], component: ArkKarusell },
  // OPTICUR-1 Etapp B: fri storlek — `formats` är en oanvänd platshållare, canvasmåttet
  // kommer alltid från payload.customSize (effectiveDims), aldrig FORMAT_DIMENSIONS.
  "ark-skarm": { id: "ark-skarm", name: "Egen storlek / Skärm", formats: ["1080x1350"], component: ArkSkarm },
};

export function getTemplate(id: string): TemplateDef | null {
  return STUDIO_TEMPLATES[id] ?? null;
}
