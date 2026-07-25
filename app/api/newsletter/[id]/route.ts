import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/newsletter/[id] — hämta ett utkast med full HTML (tenant-låst).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const sb = supabaseService();
    const { data, error } = await sb
      .from("newsletters")
      .select("id, subject, preheader, content, html, status, source_blog_id, created_at")
      .eq("id", id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
    return NextResponse.json({ newsletter: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/newsletter/[id] — ta bort ett utkast (tenant-låst).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const sb = supabaseService();
    const { error } = await sb.from("newsletters").delete().eq("id", id).eq("client_id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
