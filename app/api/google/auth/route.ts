import { NextRequest, NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID/SECRET saknas i env. Sätt dem i Vercel/lokalt först." }, { status: 400 });
  }
  const clientId = await getActiveClientId();
  const url = authUrl(clientId, req.nextUrl.origin);
  return NextResponse.redirect(url);
}
