"use client";

import { usePathname } from "next/navigation";
import CoachWidget from "./CoachWidget";

// Visar HM Motors coach-widget BARA på HM Motors publika sajt.
// Aldrig i dashboard/admin, kund-portalen (/k, /k-utloggad…), inloggning eller gripcoaching-ytor
// — annars läcker HM Motors bil-chatt in hos andra klienter (t.ex. Ledarskapskultur).
export default function CoachWidgetGate() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/ikigai") ||
    pathname === "/k" || pathname.startsWith("/k/") || pathname.startsWith("/k-") ||
    pathname.startsWith("/logga-in")
  ) return null;
  return <CoachWidget />;
}
