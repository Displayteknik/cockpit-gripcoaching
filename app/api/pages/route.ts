import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const slug = request.nextUrl.searchParams.get("slug");

  if (slug) {
    const { data, error } = await sb
      .from("hm_pages")
      .select("*")
      .eq("client_id", clientId)
      .eq("slug", slug)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const { data, error } = await sb
    .from("hm_pages")
    .select("id, slug, title, is_published, updated_at")
    .eq("client_id", clientId)
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const body = await request.json();
  const { slug, title, data, is_published } = body;

  if (!slug || !title || !data) {
    return NextResponse.json({ error: "slug, title, and data are required" }, { status: 400 });
  }

  const { data: result, error } = await sb
    .from("hm_pages")
    .upsert(
      {
        client_id: clientId,
        slug,
        title,
        data,
        is_published: is_published ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,slug" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(result);
}
