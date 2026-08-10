import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCustomerSession } from "@/lib/customer-context";
import { statusbesked } from "@/lib/billing/status";
import { hamtaSaldo, CREDIT_MODUL } from "@/lib/credits";
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

// Sidor en spärrad kund fortfarande når. Utan betalsidan kan hon inte betala sig ut
// ur spärren, och utan utloggningen sitter hon fast i portalen.
const TILLATNA_VID_SPARR = ["/k/betalning", "/k-utloggad", "/k-logout"];

export default async function CustomerLayout({ children }: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/k-utloggad");
  }

  // BETAL-1: den centrala spärren för SIDOR. Layouten kör för varje /k-sida, både de
  // som finns idag och de som byggs imorgon — därför bor den här och inte per sida.
  const path = (await headers()).get("x-pathname") || "";
  const sparrad = session.billing_status === "sparrad";
  if (sparrad && !TILLATNA_VID_SPARR.some((p) => path === p || path.startsWith(p + "/"))) {
    redirect("/k/betalning");
  }

  const besked = statusbesked(session.billing_status);

  // Tokenmätaren i sidomenyn. Bara för kunder som faktiskt har modulen på — övriga
  // ska inte möta ett saldo de aldrig fått höra talas om.
  const saldo = session.features.includes(CREDIT_MODUL) ? await hamtaSaldo(session.client_id) : null;

  return (
    <CustomerChrome
      clientName={session.client_name}
      primaryColor={session.primary_color}
      features={session.features}
      tokens={saldo ? { anvant: saldo.anvant, tak: saldo.kvot + saldo.extra } : null}
      banner={besked && !sparrad ? { ton: besked.ton, rubrik: besked.rubrik, text: besked.text, knapp: besked.knapp } : null}
    >
      {children}
    </CustomerChrome>
  );
}
