import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { rebuildVoiceFingerprint } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let clientId: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.client_id === "string" && /^[0-9a-f-]{36}$/i.test(body.client_id)) {
        clientId = body.client_id;
      }
    } catch {}
    if (!clientId) clientId = await getActiveClientId();
    const fp = await rebuildVoiceFingerprint(clientId);
    return NextResponse.json({
      ok: true,
      client_id: clientId,
      source_count: fp.source_asset_count,
      built_at: fp.built_at,
      tone_summary: fp.tone_summary,
      signature_phrases: fp.signature_phrases,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
