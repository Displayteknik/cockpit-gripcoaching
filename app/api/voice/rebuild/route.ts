import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { rebuildVoiceFingerprint } from "@/lib/voice-fingerprint";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const clientId = await getActiveClientId();
    const fp = await rebuildVoiceFingerprint(clientId);
    return NextResponse.json({
      ok: true,
      source_count: fp.source_asset_count,
      built_at: fp.built_at,
      tone_summary: fp.tone_summary,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
