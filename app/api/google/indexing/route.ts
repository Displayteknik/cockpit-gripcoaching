import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

// Google Indexing API — pingar Google direkt vid nya/uppdaterade URL:er.
// Officiellt support: JobPosting + BroadcastEvent. I praktiken accepterar Google också andra URL:er
// och nya/uppdaterade artiklar tas ofta upp snabbare. Inte garanti — men kostar inget.
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const { url, type = "URL_UPDATED" } = await req.json();
  if (!url) return NextResponse.json({ error: "url krävs" }, { status: 400 });

  try {
    const token = await getValidAccessToken(clientId);
    const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, type }),
    });
    const data = r.ok ? await r.json() : await r.text();
    await logActivity(clientId, "indexing_pinged", `Indexing API: ${url}`, undefined, { type, response: typeof data === "string" ? data : "ok" });
    return NextResponse.json({ ok: r.ok, status: r.status, data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
