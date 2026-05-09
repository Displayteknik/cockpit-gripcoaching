import { NextRequest } from "next/server";
import { runNightIterateForClient } from "@/lib/setup-tools";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const clientId = body.client_id as string | undefined;
  if (!clientId) return Response.json({ ok: false, error: "client_id krävs" }, { status: 400 });

  const result = await runNightIterateForClient({ client_id: clientId });
  return Response.json(result);
}
