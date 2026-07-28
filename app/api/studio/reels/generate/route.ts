import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { REEL_TEMPLATES, type ReelTemplateKey } from "@/lib/studio/reels";
import { generateReelStoryboard } from "@/lib/studio/reels-generate";
import type { DiscLetter } from "@/lib/content-compass/data";

export const runtime = "nodejs";
// Upp till tre genereringsförsök med gemini-2.5-pro innan ordgränsen kapas.
export const maxDuration = 120;

const DISC_OK: DiscLetter[] = ["D", "I", "S", "C"];

// POST — idé + mall → storyboard. Endast huvudadmin under R1, verktyget testas skarpt
// innan det blir en modul kunder kan se (docs/studio/REELS-PLAN.md §5).
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }

  let body: { ide?: string; templateKey?: string; disc?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const ide = String(body.ide || "").trim();
  if (!ide) return NextResponse.json({ error: "Skriv en idé först" }, { status: 400 });

  const templateKey = String(body.templateKey || "") as ReelTemplateKey;
  if (!REEL_TEMPLATES[templateKey]) {
    return NextResponse.json({ error: "Välj en mall" }, { status: 400 });
  }

  const disc = (Array.isArray(body.disc) ? body.disc : [])
    .map((d) => String(d).toUpperCase())
    .filter((d): d is DiscLetter => (DISC_OK as string[]).includes(d));

  try {
    const clientId = await getActiveClientId();
    const storyboard = await generateReelStoryboard({ clientId, ide, templateKey, disc });
    return NextResponse.json(storyboard);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kunde inte skapa manuset";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
