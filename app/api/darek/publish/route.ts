import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";

const NETLIFY_BUILD_HOOKS: Record<string, string | undefined> = {
  // slug → env-variabel som innehåller Netlify-build-hook-URL
  darek: process.env.DAREK_NETLIFY_BUILD_HOOK,
};

export async function POST() {
  const client = await getActiveClient();
  if (!client) return NextResponse.json({ error: "Ingen aktiv klient" }, { status: 400 });

  const hookUrl = NETLIFY_BUILD_HOOKS[client.slug];
  if (!hookUrl) return NextResponse.json({ error: `Ingen build-hook konfigurerad för ${client.slug}` }, { status: 400 });

  const r = await fetch(hookUrl, { method: "POST" });
  if (!r.ok) return NextResponse.json({ error: `Netlify svarade ${r.status}` }, { status: 502 });

  return NextResponse.json({ ok: true, message: "Build triggad — sajten uppdateras om ~1 min" });
}
