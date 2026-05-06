import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// POST /api/dm/contacts/[id]/sync-ghl
// Skickar kontakten till klientens GHL-webhook (om konfigurerad).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const sb = supabaseService();

    const { data: client, error: cErr } = await sb
      .from("clients")
      .select("ghl_webhook_url, name")
      .eq("id", clientId)
      .single();
    if (cErr || !client) {
      return NextResponse.json({ error: "Kund hittades inte" }, { status: 404 });
    }
    if (!client.ghl_webhook_url) {
      return NextResponse.json(
        { error: "GHL-webhook saknas. Lägg till i Inställningar." },
        { status: 400 }
      );
    }

    const { data: contact, error: kErr } = await sb
      .from("cockpit_dm_contacts")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();
    if (kErr || !contact) {
      return NextResponse.json({ error: "Kontakt hittades inte" }, { status: 404 });
    }

    const payload = {
      source: "cockpit-dm-pipeline",
      client: client.name,
      ig_username: contact.ig_username,
      display_name: contact.display_name,
      stage: contact.stage,
      notes: contact.notes,
      next_action: contact.next_action,
      origin: contact.source,
      origin_post: contact.source_post,
      contact_id: contact.id,
    };

    const r = await fetch(client.ghl_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json(
        { error: `GHL-webhook svarade ${r.status}: ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }

    let ghlContactId: string | null = null;
    try {
      const respData = await r.json();
      ghlContactId = respData?.contact_id || respData?.id || null;
    } catch {
      // GHL kan svara med tom body — det räknas ändå som lyckat
    }

    await sb
      .from("cockpit_dm_contacts")
      .update({
        synced_to_ghl: true,
        ghl_synced_at: new Date().toISOString(),
        ghl_contact_id: ghlContactId || contact.ghl_contact_id,
      })
      .eq("id", id)
      .eq("client_id", clientId);

    return NextResponse.json({ ok: true, ghl_contact_id: ghlContactId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
