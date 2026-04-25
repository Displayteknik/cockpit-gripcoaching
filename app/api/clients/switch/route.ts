import { NextRequest, NextResponse } from "next/server";
import { setActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: "client_id krävs" }, { status: 400 });
  await setActiveClientId(client_id);
  return NextResponse.json({ ok: true });
}
