import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("clients")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sb = supabaseServer();
  const slug = String(body.slug || body.name || "").toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { data, error } = await sb
    .from("clients")
    .insert({
      slug,
      name: body.name,
      industry: body.industry,
      public_url: body.public_url,
      primary_color: body.primary_color || "#2563eb",
      resource_module: body.resource_module || "generic",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Skapa default brand_profile och setting-rad
  await sb.from("hm_brand_profile").insert({ client_id: data.id, company_name: body.name, location: body.location }).select();
  await logActivity(data.id, "client_created", `Klient skapad: ${body.name}`);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("clients")
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
