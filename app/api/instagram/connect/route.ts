import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { getProfile } from "@/lib/instagram";

export const runtime = "nodejs";

interface Body { ig_account_id: string; ig_access_token: string; ig_handle?: string }

export async function PUT(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = (await req.json()) as Body;
  if (!body.ig_account_id || !body.ig_access_token) return NextResponse.json({ error: "ig_account_id + ig_access_token krävs" }, { status: 400 });

  // Validera mot Graph API
  try {
    const profile = await getProfile(body.ig_account_id, body.ig_access_token);
    const sb = supabaseServer();
    await sb.from("clients").update({
      ig_account_id: body.ig_account_id,
      ig_access_token: body.ig_access_token,
      ig_handle: body.ig_handle || profile.username,
      updated_at: new Date().toISOString(),
    }).eq("id", clientId);

    // Snapshot:a följare direkt
    if (profile.followers_count != null) {
      await sb.from("follower_snapshots").insert({
        client_id: clientId,
        platform: "instagram",
        followers: profile.followers_count,
        following: profile.follows_count,
        posts_count: profile.media_count,
      });
    }

    await logActivity(clientId, "ig_connected", `Instagram anslutet: @${profile.username} (${profile.followers_count} följare)`, "/dashboard/installningar");
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    return NextResponse.json({ error: "Validering misslyckades: " + (e as Error).message }, { status: 400 });
  }
}

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("clients").select("ig_account_id, ig_handle").eq("id", clientId).maybeSingle();
  return NextResponse.json({
    connected: !!data?.ig_account_id,
    handle: data?.ig_handle || null,
  });
}

export async function DELETE() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  await sb.from("clients").update({ ig_account_id: null, ig_access_token: null, ig_handle: null }).eq("id", clientId);
  return NextResponse.json({ ok: true });
}
