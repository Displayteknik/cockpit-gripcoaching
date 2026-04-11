import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (slug) {
    const { data, error } = await supabase
      .from("hm_pages")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("hm_pages")
    .select("id, slug, title, is_published, updated_at")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { slug, title, data, is_published } = body;

  if (!slug || !title || !data) {
    return NextResponse.json(
      { error: "slug, title, and data are required" },
      { status: 400 }
    );
  }

  const { data: result, error } = await supabase
    .from("hm_pages")
    .upsert(
      {
        slug,
        title,
        data,
        is_published: is_published ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(result);
}
