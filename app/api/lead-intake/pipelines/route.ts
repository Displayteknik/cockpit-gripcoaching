import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachGhl } from "@/lib/coach-bridge";

export const runtime = "nodejs";

// GET /api/lead-intake/pipelines
//
// Klientens pipelines och steg ur MySales, så inställningarna kan vara två rullgardiner
// i stället för två ID-fält att klistra in. Displaytekniks uppsättning låg tidigare som
// råa id:n i miljövariabler på Netlify, vilket ingen annan kund kan sätta upp själv.
//
// Admin-grindad av proxy:n (/api/lead-intake/* är varken publik, cron eller kundbetjänad).
// Token stannar server-side och når aldrig klienten.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const { token, locationId } = await resolveCoachGhl(clientId);
  if (!token || !locationId) {
    return NextResponse.json({ linked: false, pipelines: [] });
  }

  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      { headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" } },
    );
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ linked: true, pipelines: [], fel: `MySales svarade ${r.status}: ${t.slice(0, 120)}` });
    }
    const d = await r.json();
    const raa: Array<{ id: string; name?: string; stages?: Array<{ id: string; name?: string }> }> =
      d?.pipelines ?? d ?? [];
    const pipelines = raa.map((p) => ({
      id: p.id,
      namn: p.name || "Namnlös pipeline",
      steg: (p.stages || []).map((s) => ({ id: s.id, namn: s.name || "Namnlöst steg" })),
    }));
    return NextResponse.json({ linked: true, pipelines });
  } catch (e) {
    return NextResponse.json({ linked: true, pipelines: [], fel: (e as Error).message.slice(0, 120) });
  }
}
