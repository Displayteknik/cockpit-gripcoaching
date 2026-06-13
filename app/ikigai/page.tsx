import type { Metadata } from "next";
import IkigaiPublic from "./IkigaiPublic";

// Egen gripcoaching-metadata — ärver INTE HM Motors titel/beskrivning/dela-text.
export const metadata: Metadata = {
  title: "Hitta din Ikigai — gratis | GripCoaching",
  description:
    "Svara på fyra frågor och få din nisch, ett första erbjudande du kan sälja redan nästa vecka och en 14-dagars plan. Gratis, resultat direkt.",
  openGraph: {
    title: "Hitta din Ikigai — gratis",
    description:
      "Fyra frågor om dig själv → din nisch, ett första erbjudande och en konkret plan. Gratis verktyg från GripCoaching.",
    siteName: "GripCoaching",
    locale: "sv_SE",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function IkigaiRoute() {
  return <IkigaiPublic />;
}
