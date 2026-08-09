import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { REEL_TEMPLATES, type ReelStoryboard } from "@/lib/studio/reels";

export const runtime = "nodejs";

async function grind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  return null;
}

// GET — klientens sparade reels, senast ändrad först.
export async function GET() {
  const denied = await grind();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const { data, error } = await supabaseService()
      .from("studio_reels")
      .select("id, title, template_key, status, storyboard, caption, ai_generated, duration_ms, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return NextResponse.json({ items: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — spara nytt reel eller uppdatera befintligt ({ id } medskickat).
export async function POST(req: NextRequest) {
  const denied = await grind();
  if (denied) return denied;

  let body: { id?: string; storyboard?: ReelStoryboard };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const sb = body.storyboard;
  if (!sb || !Array.isArray(sb.scenes) || !REEL_TEMPLATES[sb.templateKey]) {
    return NextResponse.json({ error: "Ogiltigt storyboard" }, { status: 400 });
  }

  try {
    const clientId = await getActiveClientId();
    const db = supabaseService();
    // Äkthetsflaggan härleds ur materialet, aldrig ur klienten: så fort en scen bär en
    // AI-bild markeras hela reelen och mallen Före och efter kräver bekräftelse.
    const aiGenerated = sb.scenes.some((s) => s.source === "ai");
    const rad = {
      client_id: clientId,
      title: sb.title || null,
      template_key: sb.templateKey,
      storyboard: sb,
      caption: sb.caption || null,
      ai_generated: aiGenerated,
      duration_ms: sb.durationMs || null,
    };

    if (body.id) {
      // Tenant-lås: både id OCH client_id måste matcha.
      const { data, error } = await db
        .from("studio_reels")
        .update(rad)
        .eq("id", body.id)
        .eq("client_id", clientId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ id: data.id, uppdaterad: true });
    }

    const { data, error } = await db.from("studio_reels").insert(rad).select("id").single();
    if (error) throw new Error(error.message);
    // G-1c: manusets generering binds till reelen den blev. Id:t reste med inuti
    // storyboarden, så ingen klientkomponent behövde ändras.
    if (sb.generationId) {
      const { kopplaTillInlagg } = await import("@/lib/generationslogg");
      await kopplaTillInlagg(sb.generationId, { tabell: "studio_reels", id: String(data.id) });
    }
    return NextResponse.json({ id: data.id, uppdaterad: false });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE — { id }
export async function DELETE(req: NextRequest) {
  const denied = await grind();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "Inget id" }, { status: 400 });
    const { error } = await supabaseService().from("studio_reels").delete().eq("id", id).eq("client_id", clientId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
