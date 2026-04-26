import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import CoachWidgetGate from "@/components/CoachWidgetGate";
import VisitorTracker from "@/components/VisitorTracker";
import StructuredData from "@/components/StructuredData";
import ClarityScript from "@/components/ClarityScript";

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
    default: "Cockpit GripCoaching",
    template: "%s | Cockpit",
  },
  description:
    "HM Motor i Krokom — auktoriserad CF Moto-återförsäljare. Begagnade bilar, fyrhjulingar, UTV, mopeder och trädgårdsmaskiner. 35+ års erfarenhet.",
  metadataBase: new URL("https://hmmotor-krokom.vercel.app"),
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "HM Motor Krokom",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col font-body text-text-primary bg-white antialiased">
        <StructuredData type="localbusiness" />
        <ClarityScript />
        {children}
        <VisitorTracker />
        <CoachWidgetGate />
      </body>
    </html>
  );
}
