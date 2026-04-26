import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { sendEmail, approvalEmailHtml } from "@/lib/email";

export const runtime = "nodejs";

function token() {
  return Array.from({ length: 24 }, () => Math.random().toString(36)[2]).join("");
}

export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const { resource_type, resource_id, recipient_email, recipient_name, expires_days = 30 } = body;
  if (!resource_type || !resource_id) return NextResponse.json({ error: "resource_type + resource_id krävs" }, { status: 400 });
  const sb = supabaseServer();
  const expires_at = new Date(Date.now() + expires_days * 86400000).toISOString();
  const { data, error } = await sb.from("share_links").insert({
    client_id: clientId,
    token: token(),
    resource_type,
    resource_id,
    recipient_email,
    recipient_name,
    expires_at,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Auto-mejl om mottagare angiven + Resend konfigurerat
  let email_status: { sent: boolean; reason?: string } = { sent: false };
  if (recipient_email) {
    const sb2 = supabaseServer();
    const { data: client } = await sb2.from("clients").select("name").eq("id", clientId).maybeSingle();
    let preview = "";
    if (resource_type === "social") {
      const { data: post } = await sb2.from("hm_social_posts").select("hook, caption").eq("id", resource_id).maybeSingle();
      preview = post?.hook || post?.caption || "";
    } else if (resource_type === "blog") {
      const { data: post } = await sb2.from("hm_blog").select("title, excerpt").eq("id", resource_id).maybeSingle();
      preview = post?.excerpt || post?.title || "";
    }
    const origin = req.nextUrl.origin;
    const share_url = `${origin}/granska/${data.token}`;
    email_status = await sendEmail({
      to: recipient_email,
      subject: `${client?.name || "Granskning"} — ${resource_type === "blog" ? "ny artikel" : "nytt inlägg"} att godkänna`,
      html: approvalEmailHtml({ recipient_name, client_name: client?.name || "", share_url, resource_type, preview }),
    });
  }

  await logActivity(clientId, "share_created", `Delning skapad (${resource_type})${recipient_email ? ` → ${recipient_email}${email_status.sent ? " (mejl skickat)" : email_status.reason === "no_key" ? " (mejl ej satt upp)" : " (mejl misslyckades)"}` : ""}`, `/granska/${data.token}`);
  return NextResponse.json({ ...data, email_status });
}

export async function GET(req: NextRequest) {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const status = req.nextUrl.searchParams.get("status");
  let q = sb.from("share_links").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q.limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const clientId = await getActiveClientId();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseServer();
  await sb.from("share_links").delete().eq("id", id).eq("client_id", clientId);
  return NextResponse.json({ ok: true });
}
