import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Cache for hostname -> client_id (servern lever lange, undvik DB-slag per request)
const hostMapCache: { map: Map<string, string>; expiresAt: number } = { map: new Map(), expiresAt: 0 };

async function getHostMap(sb: ReturnType<typeof supabaseServer>): Promise<Map<string, string>> {
  if (hostMapCache.expiresAt > Date.now()) return hostMapCache.map;
  const { data } = await sb.from("clients").select("id, public_url").not("public_url", "is", null);
  const map = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; public_url: string }>) {
    try {
      const host = new URL(r.public_url).hostname.replace(/^www\./, "").toLowerCase();
      if (host) map.set(host, r.id);
    } catch {}
  }
  hostMapCache.map = map;
  hostMapCache.expiresAt = Date.now() + 5 * 60 * 1000; // 5 min cache
  return map;
}

function hostFromUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Lattviktig analytics-endpoint. Kallas fran publika sajten.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sb = supabaseServer();
    const ua = req.headers.get("user-agent") || "";
    const country = req.headers.get("x-vercel-ip-country") || null;
    // Filtrera bort uppenbara bottar
    if (/bot|crawl|spider|preview/i.test(ua)) return NextResponse.json({ ok: true, skipped: "bot" });

    const insertRow: Record<string, unknown> = {
      path: body.path?.slice(0, 500),
      referrer: body.referrer?.slice(0, 500) || null,
      user_agent: ua.slice(0, 300),
      country,
      session_id: body.session_id?.slice(0, 100),
    };

    // 1. Explicit client_id fran pixel-body har hogst prio
    let resolvedClientId: string | null = null;
    if (typeof body.client_id === "string" && /^[0-9a-f-]{36}$/i.test(body.client_id)) {
      resolvedClientId = body.client_id;
    }

    // 2. Annars - resolva fran hostname (Origin > Referer > body.host)
    if (!resolvedClientId) {
      const candidateHosts = [
        hostFromUrl(req.headers.get("origin")),
        hostFromUrl(req.headers.get("referer")),
        hostFromUrl(typeof body.host === "string" ? body.host : null),
        hostFromUrl(typeof body.url === "string" ? body.url : null),
      ].filter(Boolean) as string[];

      if (candidateHosts.length > 0) {
        const hostMap = await getHostMap(sb);
        for (const h of candidateHosts) {
          const id = hostMap.get(h);
          if (id) {
            resolvedClientId = id;
            break;
          }
        }
      }
    }

    if (resolvedClientId) insertRow.client_id = resolvedClientId;
    // Annars fas DB-default (HM Motor) - bakåtkompatibelt

    await sb.from("hm_visits").insert(insertRow);
    return NextResponse.json({ ok: true, resolved_client_id: resolvedClientId });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
