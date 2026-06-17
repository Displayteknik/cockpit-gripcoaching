import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hela lagret — alla fordon live i Krokom",
  description:
    "Hela HM Motors lager i realtid: begagnade bilar, fyrhjulingar, mopeder, släpvagnar och mer i Krokom, Jämtland. Alltid uppdaterat.",
  alternates: { canonical: "/lager" },
};

export default function LagerLayout({ children }: { children: ReactNode }) {
  return children;
}
