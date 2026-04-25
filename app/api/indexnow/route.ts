import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// IndexNow — gratis, instant indexering hos Bing/Yandex (Google ignorerar men gör inget illa)
// Skicka URL:er → Bing m.fl. crawlar inom minuter
export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = supabaseServer();
  const { data: settings } = await sb.from("hm_settings").select("*").in("key", ["indexnow_key", "site_url"]);
  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]));
  const key = map.indexnow_key;
  const host = (map.site_url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!key || !host) {
    return NextResponse.json({ error: "Sätt site_url + indexnow_key i Inställningar först" }, { status: 400 });
  }

  const urls: string[] = Array.isArray(body.urls) ? body.urls : [body.url].filter(Boolean);
  if (!urls.length) return NextResponse.json({ error: "Inga URL:er" }, { status: 400 });

  const r = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host,
      key,
      keyLocation: `https://${host}/${key}.txt`,
      urlList: urls,
    }),
  });
  return NextResponse.json({ status: r.status, ok: r.ok, urls: urls.length });
}
