import { NextResponse } from "next/server";
import { createElement } from "react";
import { Render, type Data } from "@puckeditor/core";
import { puckConfigDarek as puckConfig } from "@/lib/puck-config-darek";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSR Puck Data → HTML body. Public endpoint — Netlify build kallar denna.
export async function GET() {
  const sb = supabaseServer();
  const { data: row } = await sb.from("darek_content").select("content").eq("id", "live").maybeSingle();
  const content = (row?.content as Record<string, unknown>) || {};
  const puckData = content.puck_data as Data | undefined;

  if (!puckData || !puckData.content?.length) {
    return new NextResponse("EMPTY", { status: 200, headers: { "Content-Type": "text/plain", "X-Render-Status": "empty" } });
  }

  // dynamic import — undviker Next.js 16 statiska ban på react-dom/server i route handlers
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = renderToStaticMarkup(createElement(Render, { config: puckConfig, data: puckData }));

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
