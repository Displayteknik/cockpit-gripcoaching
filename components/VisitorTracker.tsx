"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "hm_session_id";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function VisitorTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        session_id: getSessionId(),
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
