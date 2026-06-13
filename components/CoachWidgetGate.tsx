"use client";

import { usePathname } from "next/navigation";
import CoachWidget from "./CoachWidget";

// Visar HM Motors coach-widget på publika sidor, inte i dashboard/admin.
// Undantas även på /ikigai — det är en gripcoaching-yta, inte HM Motor.
export default function CoachWidgetGate() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/ikigai")) return null;
  return <CoachWidget />;
}
