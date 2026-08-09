import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/newsletter — lista aktiv klients nyhetsbrev-utkast (tenant-låst).
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("newsletters")
      .select("id, subject, preheader, status, source_blog_id, created_at, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ newsletters: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST /api/newsletter — spara nytt eller uppdatera utkast (tenant-låst).
// { id?, subject, preheader?, content, html, source_blog_id? }
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  try {
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const subject = String(b.subject || "").trim().slice(0, 200) || "Nyhetsbrev";
    const row = {
      client_id: clientId,
      subject,
      preheader: String(b.preheader || "").slice(0, 300),
      content: b.content && typeof b.content === "object" ? b.content : null,
      html: typeof b.html === "string" ? b.html : null,
      source_blog_id: b.source_blog_id || null,
      status: "draft",
      updated_at: new Date().toISOString(),
    };
    const sb = supabaseService();

    if (b.id) {
      const { data, error } = await sb
        .from("newsletters")
        .update(row)
        .eq("id", b.id)
        .eq("client_id", clientId)
        .select("id, subject, updated_at")
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "Hittade inte utkastet" }, { status: 404 });
      return NextResponse.json({ newsletter: data });
    }

    const { data, error } = await sb.from("newsletters").insert(row).select("id, subject, updated_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // G-1c: genereringen binds till nyhetsbrevet den blev. Id:t reste med inuti
    // innehållsobjektet, så ingen klientkomponent behövde ändras.
    const genId = (row.content as { generationId?: string } | null)?.generationId;
    if (genId && data?.id) {
      const { kopplaTillInlagg } = await import("@/lib/generationslogg");
      await kopplaTillInlagg(genId, { tabell: "newsletters", id: String(data.id) });
    }
    return NextResponse.json({ newsletter: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
