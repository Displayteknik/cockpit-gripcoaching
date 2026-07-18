import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { resolveCoachUserIds } from "@/lib/coach-bridge";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// GET /api/fokus/overview — aktiv klients säljöversikt (MySales Coach), read-only.
// Tenant-låst via identitetsbryggan. Aktivitet (30 dgr) + pipeline + offert-KPI.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  const clientId = await getActiveClientId();
  const coachIds = await resolveCoachUserIds(clientId);
  if (!coachIds.length) return NextResponse.json({ linked: false });

  const sb = supabaseService();
  const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [actRes, contRes, quoteRes] = await Promise.all([
    sb.from("activity_log").select("messages_sent, offers_sent, follow_ups_done, responses_received, meetings_booked, date").in("user_id", coachIds).gte("date", since),
    sb.from("lobby_contacts").select("status").in("user_id", coachIds),
    sb.from("sales_quotes").select("status, total").in("user_id", coachIds),
  ]);

  const act = ((actRes.data as Record<string, number>[] | null) || []).reduce(
    (a, r) => ({
      messages: a.messages + (r.messages_sent || 0),
      offers: a.offers + (r.offers_sent || 0),
      followups: a.followups + (r.follow_ups_done || 0),
      responses: a.responses + (r.responses_received || 0),
      meetings: a.meetings + (r.meetings_booked || 0),
    }),
    { messages: 0, offers: 0, followups: 0, responses: 0, meetings: 0 },
  );
  const contacts = (contRes.data as { status?: string }[] | null) || [];
  const quotes = (quoteRes.data as { status?: string; total?: number }[] | null) || [];
  const won = quotes.filter((q) => q.status === "won");

  return NextResponse.json({
    linked: true,
    activity: act,
    pipeline: { total: contacts.length },
    quotes: { total: quotes.length, won: won.length, wonValue: won.reduce((s, q) => s + (q.total || 0), 0) },
  });
}
