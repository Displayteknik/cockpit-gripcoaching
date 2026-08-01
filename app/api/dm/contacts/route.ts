import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contacts: data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

const STEG = ["new", "acknowledge", "connect", "offer", "won", "lost"];

/** Tom sträng ska bli null i databasen, inte ett tomt fält som ser ifyllt ut. */
function text(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

/** Tidsfält: bara giltiga tidpunkter sparas, aldrig "Invalid Date". */
function tid(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();
    // Kanaler utan användarnamn (Messenger, LinkedIn) får aldrig blockeras:
    // namnet räcker. Bara när BÅDA saknas vet vi inte vem kontakten är.
    const anvandarnamn = text(typeof body.ig_username === "string" ? body.ig_username.replace(/^@/, "") : "");
    const namn = text(body.display_name);
    if (!anvandarnamn && !namn) {
      return NextResponse.json({ error: "Namn eller användarnamn krävs" }, { status: 400 });
    }
    const stage = STEG.includes(body.stage) ? body.stage : "new";
    const sb = supabaseService();
    const { data, error } = await sb
      .from("cockpit_dm_contacts")
      .insert({
        client_id: clientId,
        ig_username: anvandarnamn,
        display_name: namn,
        channel: text(body.channel),
        source: text(body.source) || "manuell",
        source_post: text(body.source_post),
        stage,
        notes: text(body.notes),
        next_action: text(body.next_action),
        next_action_at: tid(body.next_action_at),
        reminder_at: tid(body.reminder_at),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
