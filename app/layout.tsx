import type { Metadata } from "next";
import { headers } from "next/headers";
import { Space_Grotesk, Inter } from "next/font/google";
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
    path.startsWith("/sites/")
  ) return false;
  return true;
}

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
