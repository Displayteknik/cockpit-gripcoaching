import { NextRequest, NextResponse } from "next/server";
import { setActiveClientId } from "@/lib/client-context";
import { getCustomerSession } from "@/lib/customer-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Endast admin får byta aktiv klient. En inloggad kund får ALDRIG flytta
  // admin-kontexten (annars kringgås tenant-isoleringen).
  if (await getCustomerSession()) {
    return NextResponse.json({ error: "ej tillåtet" }, { status: 403 });
  }
  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: "client_id krävs" }, { status: 400 });
  await setActiveClientId(client_id);
  return NextResponse.json({ ok: true });
}
