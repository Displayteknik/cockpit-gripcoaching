import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseService } from "./supabase-admin";
import { getEffectiveModuleIds } from "./entitlements";

const TOKEN_COOKIE = "customer_token";
const CLIENT_COOKIE = "customer_client_id";

export interface CustomerSession {
  client_id: string;
  client_name: string;
  client_slug: string;
  primary_color: string;
  role: string;              // 'customer' (delad länk) | roll från platform_users
  features: string[];
}

// Validera token mot DB. Löser BÅDE en delad klient-token (customer_token) OCH
// en per-användar magic-link (platform_users.login_token) → per-användar-inloggning
// funkar genom samma /k/[token]-route, och att avaktivera en användare släcker
// länken direkt (nästa sidladdning → utloggad).
export async function resolveCustomerToken(token: string): Promise<CustomerSession | null> {
  if (!token || token.length < 32) return null;
  const sb = supabaseService();

  // 1. Delad klient-token (befintlig väg — behåll-fungerande-väg).
  const { data } = await sb
    .from("clients")
    .select("id, name, slug, primary_color, customer_access_enabled")
    .eq("customer_token", token)
    .maybeSingle();
  if (data && data.customer_access_enabled) {
    return {
      client_id: data.id as string,
      client_name: data.name as string,
      client_slug: data.slug as string,
      primary_color: (data.primary_color as string) || "#1A6B3C",
      role: "customer",
      features: await getEffectiveModuleIds(data.id as string),
    };
  }

  // 2. Per-användar magic-link (platform_users). Kräver aktiv användare + klient med access.
  const { data: u } = await sb
    .from("platform_users")
    .select("id, role, client_id, active, activated_at")
    .eq("login_token", token)
    .maybeSingle();
  if (u && u.active && u.client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("id, name, slug, primary_color, customer_access_enabled")
      .eq("id", u.client_id)
      .maybeSingle();
    if (c && c.customer_access_enabled) {
      if (!u.activated_at) {
        await sb.from("platform_users").update({ activated_at: new Date().toISOString() }).eq("id", u.id);
      }
      return {
        client_id: c.id as string,
        client_name: c.name as string,
        client_slug: c.slug as string,
        primary_color: (c.primary_color as string) || "#1A6B3C",
        role: (u.role as string) || "customer",
        features: await getEffectiveModuleIds(c.id as string),
      };
    }
  }

  return null;
}

// Server-side: hämta aktuell kund-session från cookies.
// ENDAST via den HttpOnly-skyddade token-cookien — den går inte att läsa eller manipulera
// från webbläsaren. Den läsbara client_id-cookien används ALDRIG som auth (ett underkonto
// ska aldrig kunna byta tenant genom att skriva om en cookie). Token sätts vid varje
// inloggning (CUSTOMER_LOGINS + /k/[token]), så ingen riktig användare påverkas.
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const c = await cookies();
  const token = c.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return resolveCustomerToken(token);
}

// Serverside-spärr för en portal-sida som kräver en viss modul.
// Saknar kunden session → /k-utloggad. Saknar modul-behörighet → /k (översikt).
// Returnerar sessionen så sidan kan använda den direkt.
export async function requireCustomerFeature(featureKey: string): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect("/k-utloggad");
  if (!session.features.includes(featureKey)) redirect(`/k/ej-i-paket?m=${encodeURIComponent(featureKey)}`);
  return session;
}

export async function setCustomerSession(token: string, clientId: string): Promise<void> {
  const c = await cookies();
  c.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  c.set(CLIENT_COOKIE, clientId, {
    httpOnly: false, // klienten läser för UI
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function clearCustomerSession(): Promise<void> {
  const c = await cookies();
  c.delete(TOKEN_COOKIE);
  c.delete(CLIENT_COOKIE);
}
