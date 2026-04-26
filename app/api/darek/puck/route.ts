import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient, logActivity } from "@/lib/client-context";
import { sectionsToPuck, puckToSections } from "@/lib/puck-config-art";
import type { Data } from "@puckeditor/core";

export const runtime = "nodejs";

// GET — översätter darek_content sektioner till Puck Data
export async function GET() {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });
  const sb = supabaseServer();
  const { data } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const content = (data?.content as Record<string, unknown>) || {};
  return NextResponse.json(sectionsToPuck(content as Record<string, unknown>));
}

// POST — Puck Data tas emot, översätts till sektioner och sparas
export async function POST(req: NextRequest) {
  const client = await getActiveClient();
  if (client?.slug !== "darek") return NextResponse.json({ error: "Endast Darek" }, { status: 403 });

  const puckData = (await req.json()) as Data;
  const sb = supabaseServer();

  // Hämta nuvarande för att bevara fält som inte finns i Puck (t.ex. shop.items, exhibitions.years)
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const baseContent = (row?.content as Record<string, unknown>) || {};

  const nextContent = puckToSections(puckData, baseContent);
  const { error } = await sb.from("darek_content").upsert({ id: "live", content: nextContent }).eq("id", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("darek_content_versions").insert({ content: nextContent, note: "Puck-redigering" });
  await logActivity(client!.id, "puck_save", "Sparade Puck-redigering", "/admin");

  return NextResponse.json({ ok: true });
}
