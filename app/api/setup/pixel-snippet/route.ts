import { NextRequest } from "next/server";
import { generateTrackingPixel } from "@/lib/setup-tools";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  if (!clientId) return Response.json({ error: "client_id krävs" }, { status: 400 });

  const result = await generateTrackingPixel({ client_id: clientId });
  if (!result.ok) return Response.json({ error: result.summary }, { status: 400 });

  const data = result.data as { snippet: string; client_name: string };
  return Response.json({
    snippet: data.snippet,
    client_name: data.client_name,
    summary: result.summary,
  });
}
