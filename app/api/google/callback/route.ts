import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getUserInfo } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=${encodeURIComponent(error)}`);
  if (!code || !state) return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=missing_code`);

  try {
    const tokens = await exchangeCode(code, req.nextUrl.origin);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=no_refresh_token`);
    }
    const userInfo = await getUserInfo(tokens.access_token);
    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const sb = supabaseServer();
    await sb.from("google_connections").upsert({
      client_id: state,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at,
      scopes: tokens.scope,
      email: userInfo.email,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id" });

    await logActivity(state, "google_connected", `Google anslutet (${userInfo.email})`, "/dashboard/installningar");

    return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_ok=1`);
  } catch (e) {
    return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=${encodeURIComponent((e as Error).message)}`);
  }
}
