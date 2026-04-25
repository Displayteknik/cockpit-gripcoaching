"use client";

import { usePathname } from "next/navigation";
import CoachWidget from "./CoachWidget";

// Visar coach-widget på publika sidor, inte i dashboard eller admin.
export default function CoachWidgetGate() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return null;
  return <CoachWidget />;
}
