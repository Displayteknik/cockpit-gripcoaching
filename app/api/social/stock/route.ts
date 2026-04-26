import { NextRequest, NextResponse } from "next/server";
import { searchStockPhotos } from "@/lib/images";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const client = await getActiveClient();
  const result = await searchStockPhotos(body.topic || body.text || "", client?.industry || undefined, body.count || 12);
  return NextResponse.json(result);
}
