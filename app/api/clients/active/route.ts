import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const c = await getActiveClient();
  return NextResponse.json(c);
}
