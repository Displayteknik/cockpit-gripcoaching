import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import CoachWidgetGate from "@/components/CoachWidgetGate";
import VisitorTracker from "@/components/VisitorTracker";
import StructuredData from "@/components/StructuredData";
import ClarityScript from "@/components/ClarityScript";

// Bara HM Motors PUBLIKA sajt får ärva HM Motors schema/analys/widget/spårning.
// Kund-portalen (/k, /k-utloggad…), inloggning och gripcoaching-ytor undantas — annars
// läcker HM Motors localbusiness-schema, Clarity och besöksspårning in hos andra klienter.
function isHmMotorSurface(path: string): boolean {
  if (
    path === "/k" || path.startsWith("/k/") || path.startsWith("/k-") ||
    path.startsWith("/logga-in") || path.startsWith("/ikigai") ||
    path.startsWith("/sites/") || path.startsWith("/studio/")
  ) return false;
  return true;
}

// ★ TYPSNITTEN LIGGER I PROJEKTET, INTE HOS GOOGLE (Håkans beslut 13/8).
//
//   `next/font/google` hämtar filerna VID BYGGTIDEN. Deployen 19:09 föll på att
//   fonts.gstatic.com svarade 404 på sju Inter-filer: Google hade bytt filnamn, medan
//   Vercels byggcache satt kvar med den gamla CSS:en som pekade på de gamla namnen.
//   Följdfelet i loggen ("Can't resolve @vercel/turbopack-next/internal/font/google/font")
//   såg ut som ett kodfel men var det inte, och det stoppade allt tills cachen tömdes.
//
//   Ett bygge ska inte kunna falla för att en extern tjänst byter filnamn. Filerna är
//   därför hämtade en gång och incheckade. Båda familjerna är variabla, alltså EN fil per
//   familj som täcker 400 till 700. Latin-subsetet räcker: all kundsynlig text är svensk.
//   Inter och Space Grotesk ligger båda under SIL Open Font License, som uttryckligen
//   tillåter att filerna distribueras med projektet.
const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-var-latin.woff2",
  variable: "--font-display",
  weight: "400 700",
  display: "swap",
});

const inter = localFont({
  src: "./fonts/inter-var-latin.woff2",
  variable: "--font-body",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    // Neutral fallback för agency-ytorna (dashboard m.fl.) — så de inte ärver HM Motor i fliken.
    // HM Motors publika sidor (hem, fordon, blogg, [slug]) sätter sina EGNA titlar nedan/i sina segment.
    default: "Cockpit · GripCoaching",
    template: "%s | HM Motor Krokom",
  },
  description:
    "HM Motor i Krokom — auktoriserad CF Moto-återförsäljare. Begagnade bilar, fyrhjulingar, UTV, mopeder och trädgårdsmaskiner. 35+ års erfarenhet.",
  metadataBase: new URL("https://www.hmmotor.se"),
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "HM Motor Krokom",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const path = (await headers()).get("x-pathname") || "";
  const hm = isHmMotorSurface(path);
  return (
    <html lang="sv" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col font-body text-text-primary bg-white antialiased">
        {hm && <StructuredData type="localbusiness" />}
        {hm && <ClarityScript />}
        {children}
        {hm && <VisitorTracker />}
        {hm && <CoachWidgetGate />}
      </body>
    </html>
  );
}
