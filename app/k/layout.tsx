import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-context";
import CustomerChrome from "@/components/CustomerChrome";

interface Props {
  children: React.ReactNode;
}

// Flik-titel brandad mot kunden själv — inte ärvd publik HM Motor-titel.
export async function generateMetadata(): Promise<Metadata> {
  const session = await getCustomerSession();
  const name = session?.client_name ? `${session.client_name} · MySales Pro` : "Kundportal · MySales Pro";
  // Överskriv ALLT HM-Motor-arv (titel, beskrivning, dela-bild/sajtnamn) — kunden ska
  // aldrig se HM Motor i flik, sökresultat eller länk-förhandsvisning.
  return {
    title: { absolute: name },
    description: "Din egen vy i MySales Pro — besök, synlighet i Google och AI-sök, och din profil på ett ställe.",
    robots: { index: false, follow: false },
    icons: { icon: "/portal-icon.svg" },
    openGraph: { title: name, siteName: "MySales Pro", images: [] },
    twitter: { card: "summary", title: name },
  };
}

export default async function CustomerLayout({ children }: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/k-utloggad");
  }

  return (
    <CustomerChrome
      clientName={session.client_name}
      primaryColor={session.primary_color}
      features={session.features}
    >
      {children}
    </CustomerChrome>
  );
}
