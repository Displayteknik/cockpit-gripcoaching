import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { exchangeCodeForToken, exchangeForLongLived, getMe, META_SCOPES } from "@/lib/meta-oauth";
import { encryptToken } from "@/lib/crypto/token-vault";

export const runtime = "nodejs";

const IMPOSSIBLE_ID = "00000000-0000-0000-0000-000000000000";

function backUrl(): URL {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/$/, "");
  return new URL("/dashboard/installningar/meta", base);
}

// ANSLUT-1: byter code → long-lived user-token, krypterar och sparar EN ägar-rad.
// Allt token-utbyte sker server-side; app-secret rör aldrig klienten. Inget token loggas.
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const cookieState = req.cookies.get("meta_oauth_state")?.value;

  const done = (ok: boolean, msg: string) => {
    const u = backUrl();
    u.searchParams.set(ok ? "connected" : "error", msg.slice(0, 200));
    const res = NextResponse.redirect(u);
    res.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (oauthError) return done(false, url.searchParams.get("error_description") || oauthError);
  if (!code || !state || !cookieState || state !== cookieState) return done(false, "Ogiltig state — försök igen.");

  try {
    const shortToken = await exchangeCodeForToken(code);
    const { token, expiresIn } = await exchangeForLongLived(shortToken);
    const me = await getMe(token);

    const sb = supabaseService();
    // Single owner: nolla ev. gammal koppling, sätt ny.
    await sb.from("meta_owner_connection").delete().neq("id", IMPOSSIBLE_ID);
    const { error } = await sb.from("meta_owner_connection").insert({
      fb_user_id: me.id,
      fb_user_name: me.name,
      user_token_enc: encryptToken(token),
      token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      scopes: META_SCOPES,
      status: "ok",
      last_checked_at: new Date().toISOString(),
    });
    if (error) return done(false, "Kunde inte spara kopplingen.");
    return done(true, me.name || "Meta");
  } catch (e) {
    return done(false, (e as Error).message);
  }
}
