import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, supabaseService } from "@/lib/supabase-admin";
import { getActiveClient, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

const SLUG = "scandinavian-haydays";

// Hela haydays_content.live.content
export async function GET() {
  const client = await getActiveClient();
  if (client?.slug !== SLUG) return NextResponse.json({ error: "Endast för Hay Days-klient" }, { status: 403 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("haydays_content").select("content").eq("id", "live").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.content || {});
}

// PUT — ersätt hela innehållet { content: {...} }
export async function PUT(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== SLUG) return NextResponse.json({ error: "Endast för Hay Days-klient" }, { status: 403 });

  const body = await req.json();
  const content = body?.content;
  if (!content || typeof content !== "object") {
    return NextResponse.json({ error: "content krävs" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb
    .from("haydays_content")
    .upsert({ id: "live", content, updated_at: new Date().toISOString() })
    .eq("id", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(client!.id, "content_edit", "Redigerade Hay Days-innehåll", "/dashboard/haydays");
  return NextResponse.json({ ok: true });
}
