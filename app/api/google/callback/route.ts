import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getUserInfo } from "@/lib/google";
import { supabaseService } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";
import { KALENDER_STATE, sparaKoppling } from "@/lib/hq/kalender";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=${encodeURIComponent(error)}`);
  if (!code || !state) return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=missing_code`);

  // PLAN-1: ägarens kalenderkoppling återvänder hit med ett eget state i stället för ett
  // klient-id. Grenen ligger först och rör inte klientflödet nedanför. Skälet att dela
  // callback: adressen är redan registrerad hos Google, så ingen ny redirect-URI behövs.
  if (state === KALENDER_STATE) {
    const r = await sparaKoppling(code, req.nextUrl.origin);
    const mal = `${req.nextUrl.origin}/dashboard/hq/planering`;
    return NextResponse.redirect(r.ok ? `${mal}?kalender_ok=1` : `${mal}?kalender_fel=${encodeURIComponent(r.fel || "okänt fel")}`);
  }

  try {
    const tokens = await exchangeCode(code, req.nextUrl.origin);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${req.nextUrl.origin}/dashboard/installningar?google_error=no_refresh_token`);
    }
    const userInfo = await getUserInfo(tokens.access_token);
    const expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const sb = supabaseService();
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
