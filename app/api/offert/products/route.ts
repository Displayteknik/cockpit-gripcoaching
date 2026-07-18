import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Generisk produktkatalog per klient (offert_products). Produkt ↔ leverantör ↔ inpris ↔ frakt ↔
// ledtid ↔ pålägg. Branschoberoende. Tenant-låst via getActiveClientId.

const FIELDS = ["name", "category", "unit", "supplier_name", "sku", "purchase_price", "freight", "currency", "lead_time_days", "markup_pct", "image_url", "notes"] as const;

function pick(body: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in body) row[f] = body[f] === "" ? null : body[f];
  return row;
}

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const sb = supabaseService();
  const { data, error } = await sb
    .from("offert_products")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data || [] });
}

export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string") return NextResponse.json({ error: "name krävs" }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("offert_products")
    .insert({ ...pick(body), client_id: clientId })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, product: data });
}

export async function PUT(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseService();
  const { data, error } = await sb
    .from("offert_products")
    .update({ ...pick(body), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, product: data });
}

export async function DELETE(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id krävs" }, { status: 400 });
  const sb = supabaseService();
  const { error } = await sb.from("offert_products").delete().eq("id", id).eq("client_id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
