import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, logActivity } from "@/lib/client-context";
import type { Data } from "@puckeditor/core";

export const runtime = "nodejs";

const EMPTY: Data = { content: [], root: { props: { title: "Darek Uhrberg — Konstnär" } } };

// GET — Puck Data sparat i darek_content.live.content.puck_data
export async function GET() {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });
  const sb = supabaseServer();
  const { data } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const content = (data?.content as Record<string, unknown>) || {};
  const puck = (content.puck_data as Data) || EMPTY;
  return NextResponse.json(puck);
}

// POST — sparar Puck Data till darek_content.live.content.puck_data (bevarar resten)
export async function POST(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });

  const puckData = (await req.json()) as Data;
  const sb = supabaseServer();
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const baseContent = (row?.content as Record<string, unknown>) || {};
  const nextContent = { ...baseContent, puck_data: puckData };

  const { error } = await sb.from("darek_content").upsert({ id: "live", content: nextContent }).eq("id", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("darek_content_versions").insert({ content: nextContent, note: "Puck-redigering (full toolkit)" });
  await logActivity(client!.id, "puck_save", "Sparade Puck-redigering", "/admin");

  return NextResponse.json({ ok: true });
}
