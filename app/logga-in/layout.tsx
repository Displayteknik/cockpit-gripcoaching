import type { Metadata } from "next";

// Egen flik-titel — annars ärvs den publika HM Motor-titeln.
export const metadata: Metadata = {
  title: { absolute: "Logga in · Cockpit — GripCoaching" },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
