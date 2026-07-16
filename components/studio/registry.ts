import type React from "react";
import OpticurFotoGulRuta from "./templates/OpticurFotoGulRuta";
import OpticurBageRubrik from "./templates/OpticurBageRubrik";
import type { StudioPayload, StudioFormat } from "@/lib/studio/payload";
import type { StudioBrand } from "@/lib/studio/brand";

// templateId → mallkomponent + tillåtna format. Ny mall = en rad här + en komponent.

export interface TemplateProps {
  payload: StudioPayload;
  brand: StudioBrand;
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
};

export function getTemplate(id: string): TemplateDef | null {
  return STUDIO_TEMPLATES[id] ?? null;
}
