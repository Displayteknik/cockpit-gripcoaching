import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, logActivity } from "@/lib/client-context";
import type { Data } from "@puckeditor/core";

export const runtime = "nodejs";

const EMPTY: Data = { content: [], root: { props: { title: "Ny sida" } } };

// GET ?slug=index → returnerar Puck Data för sidan + lista över alla sidor
export async function GET(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });
  const slug = req.nextUrl.searchParams.get("slug") || "index";
  const sb = supabaseServer();
  const { data } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const content = (data?.content as Record<string, unknown>) || {};
  const pages = (content.pages as Record<string, Data>) || {};
  const puck = pages[slug] || EMPTY;
  return NextResponse.json({ data: puck, pages: Object.keys(pages) });
}

// POST ?slug=index — sparar Puck Data för sidan
export async function POST(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });

  const slug = req.nextUrl.searchParams.get("slug") || "index";
  const puckData = (await req.json()) as Data;
  const sb = supabaseServer();
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const baseContent = (row?.content as Record<string, unknown>) || {};
  const pages = ((baseContent.pages as Record<string, Data>) || {});
  pages[slug] = puckData;
  const nextContent = { ...baseContent, pages };
  delete (nextContent as any).puck_data; // legacy

  const { error } = await sb.from("darek_content").upsert({ id: "live", content: nextContent }).eq("id", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("darek_content_versions").insert({ content: nextContent, note: `Puck-redigering (${slug})` });
  await logActivity(client!.id, "puck_save", `Sparade ${slug}`, "/admin");
  return NextResponse.json({ ok: true });
}

// DELETE ?slug=om — tar bort sidan
export async function DELETE(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || slug === "index") return NextResponse.json({ error: "index kan inte tas bort" }, { status: 400 });
  const sb = supabaseServer();
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const baseContent = (row?.content as Record<string, unknown>) || {};
  const pages = ((baseContent.pages as Record<string, Data>) || {});
  delete pages[slug];
  await sb.from("darek_content").upsert({ id: "live", content: { ...baseContent, pages } }).eq("id", "live");
  return NextResponse.json({ ok: true });
}
