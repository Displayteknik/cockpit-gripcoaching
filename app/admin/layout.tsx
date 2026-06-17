import type { Metadata } from "next";

// Egen flik-titel för Puck-sidbyggaren — annars ärvs den publika HM Motor-titeln.
export const metadata: Metadata = {
  title: { absolute: "Sidbyggare · Cockpit — GripCoaching" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
