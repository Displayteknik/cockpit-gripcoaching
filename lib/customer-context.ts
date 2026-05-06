import { cookies } from "next/headers";
import { supabaseService } from "./supabase-admin";

const TOKEN_COOKIE = "customer_token";
const CLIENT_COOKIE = "customer_client_id";

export interface CustomerSession {
  client_id: string;
  client_name: string;
  client_slug: string;
  primary_color: string;
}

// Validera token mot DB och cacha-id i cookie
export async function resolveCustomerToken(token: string): Promise<CustomerSession | null> {
  if (!token || token.length < 32) return null;
  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("id, name, slug, primary_color, customer_access_enabled")
    .eq("customer_token", token)
    .maybeSingle();
  if (!data || !data.customer_access_enabled) return null;
  return {
    client_id: data.id as string,
    client_name: data.name as string,
    client_slug: data.slug as string,
    primary_color: (data.primary_color as string) || "#1A6B3C",
  };
}

// Server-side: hämta aktuell kund-session från cookies
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const c = await cookies();
  const clientId = c.get(CLIENT_COOKIE)?.value;
  if (!clientId) return null;

  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("id, name, slug, primary_color, customer_access_enabled")
    .eq("id", clientId)
    .maybeSingle();
  if (!data || !data.customer_access_enabled) return null;
  return {
    client_id: data.id as string,
    client_name: data.name as string,
    client_slug: data.slug as string,
    primary_color: (data.primary_color as string) || "#1A6B3C",
  };
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
