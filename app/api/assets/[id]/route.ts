import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { archiveAsset, updateAsset } from "@/lib/assets";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    const body = await req.json();
    const updated = await updateAsset(id, clientId, body);
    return NextResponse.json({ asset: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientId = await getActiveClientId();
    const { id } = await params;
    await archiveAsset(id, clientId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
