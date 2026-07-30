import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId, logActivity } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { getOwnerToken } from "@/lib/meta-owner";
import { getPages, getIgUsername } from "@/lib/meta-oauth";
import { encryptToken } from "@/lib/crypto/token-vault";

export const runtime = "nodejs";

// ANSLUT-2: status för aktiv tenants IG-koppling. Aldrig token i svaret.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const sb = supabaseService();

  const { data: t } = await sb
    .from("tenant_ig_connections")
    .select("fb_page_id, page_name, ig_username, followers_count, source, status, last_error")
    .eq("client_id", clientId)
    .maybeSingle();
  if (t) {
    return NextResponse.json({
      connected: true,
      source: t.source,
      page_name: t.page_name,
      ig_username: t.ig_username,
      followers_count: t.followers_count,
      status: t.status,
      last_error: t.last_error,
    });
  }

  // Fallback: äldre koppling i clients (DT/HM).
  const { data: c } = await sb.from("clients").select("ig_account_id, ig_handle").eq("id", clientId).maybeSingle();
  return NextResponse.json({
    connected: !!c?.ig_account_id,
    source: c?.ig_account_id ? "legacy" : null,
    ig_username: c?.ig_handle || null,
  });
}

// Koppla via vald sida ur dropdownen. Page-token krypteras. Non-secret speglas till clients
// (så webhook-reverse-lookup + status-endpoints hittar tenanten); clients.ig_access_token
// nollas för nya kopplingar — token lever bara krypterat i tenant_ig_connections.
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const { page_id } = (await req.json()) as { page_id?: string };
  if (!page_id) return NextResponse.json({ error: "page_id krävs" }, { status: 400 });

  const ownerToken = await getOwnerToken();
  if (!ownerToken) return NextResponse.json({ error: "Anslut Meta först (Inställningar → Meta / Facebook)." }, { status: 400 });

  try {
    const pages = await getPages(ownerToken);
    const page = pages.find((p) => p.id === page_id);
    if (!page) return NextResponse.json({ error: "Sidan hittades inte på ditt Meta-konto." }, { status: 404 });
    if (!page.instagram_business_account?.id) {
      return NextResponse.json({ error: "Sidan saknar ett kopplat Instagram Business-konto." }, { status: 400 });
    }

    const igId = page.instagram_business_account.id;
    const pageToken = page.access_token;
    const profile = await getIgUsername(igId, pageToken); // bekräftelse + followers

    const sb = supabaseService();
    const nowIso = new Date().toISOString();
    const { error: upErr } = await sb.from("tenant_ig_connections").upsert(
      {
        client_id: clientId,
        fb_page_id: page.id,
        page_name: page.name,
        page_token_enc: encryptToken(pageToken),
        ig_business_account_id: igId,
        ig_username: profile.username || page.instagram_business_account.username || null,
        followers_count: profile.followers_count ?? null,
        source: "oauth",
        status: "ok",
        last_checked_at: nowIso,
        last_error: null,
        updated_at: nowIso,
      },
      { onConflict: "client_id" },
    );
    if (upErr) return NextResponse.json({ error: "Kunde inte spara kopplingen." }, { status: 500 });

    // Non-secret spegling till clients. Token nollas (secret bara i krypterad tabell).
    await sb.from("clients").update({
      ig_account_id: igId,
      ig_handle: profile.username || page.instagram_business_account.username || null,
      fb_page_id: page.id,
      ig_access_token: null,
      updated_at: nowIso,
    }).eq("id", clientId);

    if (profile.followers_count != null) {
      await sb.from("follower_snapshots").insert({ client_id: clientId, platform: "instagram", followers: profile.followers_count });
    }
    await logActivity(clientId, "ig_connected", `Instagram anslutet via Meta: @${profile.username || igId}`, "/dashboard/installningar");

    return NextResponse.json({ ok: true, ig_username: profile.username, followers_count: profile.followers_count, page_name: page.name });
  } catch (e) {
    return NextResponse.json({ error: "Anslutning misslyckades: " + (e as Error).message.slice(0, 200) }, { status: 400 });
  }
}

// Full frånkoppling: rensa tenant_ig_connections OCH nolla clients.ig_*.
export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const sb = supabaseService();
  await sb.from("tenant_ig_connections").delete().eq("client_id", clientId);
  await sb.from("clients").update({ ig_account_id: null, ig_access_token: null, ig_handle: null, fb_page_id: null }).eq("id", clientId);
  await logActivity(clientId, "ig_disconnected", "Instagram frånkopplat", "/dashboard/installningar");
  return NextResponse.json({ ok: true });
}
