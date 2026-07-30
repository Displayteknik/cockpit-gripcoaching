import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { getProfile } from "@/lib/instagram";
import { encryptToken } from "@/lib/crypto/token-vault";

export const runtime = "nodejs";

// ANSLUT-2 fallback ("Avancerat"): manuellt inklistrad IG Business Account ID + token.
// Samma lagring som dropdown-vägen — token krypteras, non-secret speglas till clients.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const { ig_account_id, ig_access_token, ig_handle } = (await req.json()) as {
    ig_account_id?: string;
    ig_access_token?: string;
    ig_handle?: string;
  };
  if (!ig_account_id || !ig_access_token) {
    return NextResponse.json({ error: "ig_account_id + ig_access_token krävs" }, { status: 400 });
  }

  try {
    const profile = await getProfile(ig_account_id, ig_access_token); // validerar token
    const sb = supabaseService();
    const nowIso = new Date().toISOString();

    const { error: upErr } = await sb.from("tenant_ig_connections").upsert(
      {
        client_id: clientId,
        fb_page_id: null,
        page_name: null,
        page_token_enc: encryptToken(ig_access_token),
        ig_business_account_id: ig_account_id,
        ig_username: ig_handle?.replace(/^@/, "") || profile.username || null,
        followers_count: profile.followers_count ?? null,
        source: "manual",
        status: "ok",
        last_checked_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      },
      { onConflict: "client_id" },
    );
    if (upErr) return NextResponse.json({ error: "Kunde inte spara kopplingen." }, { status: 500 });

    await sb.from("clients").update({
      ig_account_id,
      ig_handle: ig_handle?.replace(/^@/, "") || profile.username || null,
      ig_access_token: null,
      updated_at: nowIso,
    }).eq("id", clientId);

    if (profile.followers_count != null) {
      await sb.from("follower_snapshots").insert({ client_id: clientId, platform: "instagram", followers: profile.followers_count });
    }
    await logActivity(clientId, "ig_connected", `Instagram anslutet (manuellt): @${profile.username}`, "/dashboard/installningar");

    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    return NextResponse.json({ error: "Validering misslyckades: " + (e as Error).message.slice(0, 200) }, { status: 400 });
  }
}
