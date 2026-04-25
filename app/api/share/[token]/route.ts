import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Public endpoint — kunden hämtar resurs via token, ingen auth.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseServer();
  const { data: link } = await sb.from("share_links").select("*").eq("token", token).maybeSingle();
  if (!link) return NextResponse.json({ error: "Ogiltig länk" }, { status: 404 });
  if (link.expires_at && new Date(link.expires_at) < new Date()) return NextResponse.json({ error: "Länken har gått ut" }, { status: 410 });

  const { data: client } = await sb.from("clients").select("name, primary_color").eq("id", link.client_id).maybeSingle();

  let resource: unknown = null;
  if (link.resource_type === "social") {
    const { data } = await sb.from("hm_social_posts").select("*").eq("id", link.resource_id).maybeSingle();
    resource = data;
  } else if (link.resource_type === "blog") {
    const { data } = await sb.from("hm_blog").select("*").eq("id", link.resource_id).maybeSingle();
    resource = data;
  }

  return NextResponse.json({ link, client, resource });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  const { action, comment, edits } = body;
  const sb = supabaseServer();
  const { data: link } = await sb.from("share_links").select("*").eq("token", token).maybeSingle();
  if (!link) return NextResponse.json({ error: "Ogiltig länk" }, { status: 404 });

  const update: Record<string, unknown> = {
    status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "pending",
    decided_at: new Date().toISOString(),
  };
  if (comment) update.comment = comment;
  if (edits) update.edits = edits;

  await sb.from("share_links").update(update).eq("token", token);

  // Logga aktivitet
  await sb.from("client_activity").insert({
    client_id: link.client_id,
    type: `share_${action}`,
    title: action === "approve" ? "Kund godkände delning" : action === "reject" ? "Kund avvisade delning" : "Kund kommenterade delning",
    link: `/dashboard/godkannande`,
    meta: { token, comment, edits },
  });

  return NextResponse.json({ ok: true, status: update.status });
}
