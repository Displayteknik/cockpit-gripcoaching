import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { summera } from "@/lib/offert/kalkyl";

export const runtime = "nodejs";

// Generisk offert (nya motorn). GET = lista klientens offerter. POST = skapa offert + rader.
// Tenant-låst via getActiveClientId. Interna kostnader/marginal lagras men klient äger sin egen data.

interface ItemIn {
  product_id?: string | null;
  name: string;
  qty?: number;
  unit_price?: number | null;
  cost?: number | null;
  lead_time_days?: number | null;
}

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  const { data, error } = await sb
    .from("offert_quotes")
    .select("id, quote_number, customer_name, customer_company, status, total, margin_pct, created_at, updated_at, sent_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quotes: data || [] });
}

export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  let body: {
    quote_number?: string;
    customer_name?: string;
    customer_company?: string;
    ghl_contact_id?: string;
    ghl_opportunity_id?: string;
    notes?: string;
    items?: ItemIn[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const items = (body.items || []).filter((i) => i.name && i.name.trim());
  if (!items.length) return NextResponse.json({ error: "Minst en rad krävs" }, { status: 400 });

  const { total, costTotal, marginPct } = summera(
    items.map((i) => ({ qty: Number(i.qty) || 1, unit_price: i.unit_price ?? 0, cost: i.cost ?? 0 })),
  );

  const sb = supabaseService();
  const { data: quote, error } = await sb
    .from("offert_quotes")
    .insert({
      client_id: clientId,
      quote_number: body.quote_number || null,
      customer_name: body.customer_name || null,
      customer_company: body.customer_company || null,
      ghl_contact_id: body.ghl_contact_id || null,
      ghl_opportunity_id: body.ghl_opportunity_id || null,
      notes: body.notes || null,
      total,
      cost_total: costTotal,
      margin_pct: marginPct,
      status: "draft",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rader = items.map((i, idx) => ({
    quote_id: quote.id,
    product_id: i.product_id || null,
    name: i.name,
    qty: Number(i.qty) || 1,
    unit_price: i.unit_price ?? null,
    cost: i.cost ?? null,
    lead_time_days: i.lead_time_days ?? null,
    sort: idx,
  }));
  const { error: iErr } = await sb.from("offert_quote_items").insert(rader);
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, quote });
}
