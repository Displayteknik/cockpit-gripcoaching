import type { Metadata } from "next";

// Egen metadata — annars ärvs den publika HM Motor-titeln/beskrivningen/dela-bilden.
export const metadata: Metadata = {
  title: { absolute: "Logga in · Cockpit — GripCoaching" },
  description: "Logga in på din portal.",
  robots: { index: false, follow: false },
  openGraph: { title: "Logga in · Cockpit", siteName: "Cockpit · GripCoaching", images: [] },
  twitter: { card: "summary" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
