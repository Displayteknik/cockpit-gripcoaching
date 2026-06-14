import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fordon — bilar, fyrhjulingar, mopeder & släp i Krokom",
  description:
    "Hela HM Motors sortiment: begagnade bilar, CF Moto-fyrhjulingar, mopeder, släpvagnar och trädgårdsmaskiner i Krokom, Jämtland.",
  alternates: { canonical: "/fordon" },
};

export default function FordonLayout({ children }: { children: ReactNode }) {
  return children;
}
