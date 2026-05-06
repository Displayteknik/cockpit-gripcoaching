import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/import/instagram-pro
// Migrerar Instagram Pros legacy-data (dm_pipeline_contacts, scheduled_posts från IG-Pros profile_id)
// till aktiv Cockpit-klient. Använd ENDAST om aktiv klient är @displayteknik.
export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    const profileId = body.profile_id || "default"; // Instagram Pros profile_id

    const sb = supabaseService();

    // 1. Migrera DM-kontakter från legacy dm_pipeline_contacts → cockpit_dm_contacts
    const { data: legacyContacts } = await sb
      .from("dm_pipeline_contacts")
      .select("*")
      .eq("profile_id", profileId);

    let contactsImported = 0;
    if (legacyContacts && legacyContacts.length > 0) {
      const rows = legacyContacts.map((c) => ({
        client_id: clientId,
        ig_username: c.ig_username,
        ig_user_id: c.ig_user_id,
        stage: c.stage || "new",
        source: c.source || "import",
        notes: c.notes,
        ghl_contact_id: c.ghl_contact_id,
        synced_to_ghl: c.synced_to_ghl || false,
      }));
      const { data: inserted } = await sb.from("cockpit_dm_contacts").insert(rows).select("id");
      contactsImported = inserted?.length || rows.length;
    }

    // 2. Migrera tidigare inlägg från Instagram Pros scheduled_posts → hm_social_posts
    const { data: legacyPosts } = await sb
      .from("scheduled_posts")
      .select("*")
      .eq("profile_id", profileId);

    let postsImported = 0;
    if (legacyPosts && legacyPosts.length > 0) {
      const rows = legacyPosts.map((p) => ({
        client_id: clientId,
        platform: "instagram" as const,
        format: p.content_type || "single",
        hook: p.hook_text || "",
        caption: p.caption || "",
        hashtags: p.hashtags || "",
        cta: "",
        slides: p.slides || null,
        status: p.status || "draft",
        scheduled_for: p.scheduled_at || null,
        published_at: p.published_at || null,
      }));
      const { data: inserted } = await sb.from("hm_social_posts").insert(rows).select("id");
      postsImported = inserted?.length || rows.length;
    }

    // 3. Importera klientens publicerade inlägg som voice samples i client_assets
    const publishedPosts = (legacyPosts || []).filter((p) => p.status === "published" && p.caption);
    let voiceSamplesImported = 0;
    if (publishedPosts.length > 0) {
      const samples = publishedPosts.slice(0, 20).map((p) => ({
        client_id: clientId,
        asset_type: "post" as const,
        category: "imported_from_ig",
        title: (p.hook_text || p.caption || "").slice(0, 80),
        body: p.caption,
        status: "active" as const,
      }));
      const { data: inserted } = await sb.from("client_assets").insert(samples).select("id");
      voiceSamplesImported = inserted?.length || samples.length;
    }

    return NextResponse.json({
      ok: true,
      imported: {
        contacts: contactsImported,
        posts: postsImported,
        voice_samples: voiceSamplesImported,
      },
      next_step: voiceSamplesImported > 0
        ? "Voice fingerprint kommer byggas om vid nästa generering"
        : "Inga importerade voice samples — lägg till material manuellt",
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
