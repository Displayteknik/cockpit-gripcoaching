import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

// Hela darek_content.live.content
export async function GET() {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast för Darek-klient" }, { status: 403 });
  const sb = supabaseServer();
  const { data, error } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.content || {});
}

// PATCH — uppdatera EN sektion: { section: "hero", value: {...} }
export async function PATCH(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast för Darek-klient" }, { status: 403 });
  const body = await req.json();
  const { section, value } = body as { section: string; value: unknown };
  if (!section) return NextResponse.json({ error: "section krävs" }, { status: 400 });

  const sb = supabaseServer();
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const current = (row?.content as Record<string, unknown>) || {};
  const next = { ...current, [section]: value };

  const { error } = await sb.from("darek_content").upsert({ id: "live", content: next }).eq("id", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Versionera
  await sb.from("darek_content_versions").insert({ content: next, note: `Cockpit-redigering: ${section}` }).select();

  await logActivity(client!.id, "content_edit", `Redigerade ${section}`, "/dashboard/sidor");
  return NextResponse.json({ ok: true });
}
