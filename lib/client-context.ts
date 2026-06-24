import { cookies, headers } from "next/headers";
import { supabaseServer } from "./supabase-admin";
import { ADMIN_COOKIE, getSessionScope } from "./admin-auth";

const COOKIE_NAME = "active_client_id";
const DEFAULT_CLIENT_ID = "00000000-0000-0000-0000-000000000001"; // HM Motor

export interface Client {
  id: string;
  slug: string;
  name: string;
  industry: string | null;
  public_url: string | null;
  primary_color: string;
  resource_module: string;
  archived: boolean;
  report_recipients?: string | null;
  ig_handle?: string | null;
  ig_account_id?: string | null;
  ig_access_token?: string | null;
}

export async function getActiveClientId(): Promise<string> {
  try {
    const c = await cookies();
    // Klient-scopad session (t.ex. HM Motor-login) pinnas till sin klient och
    // ignorerar active_client_id-cookien helt → kan aldrig nå annan tenants data.
    const secret = process.env.ADMIN_SESSION_SECRET;
    const token = c.get(ADMIN_COOKIE)?.value;
    if (secret && token) {
      const scope = await getSessionScope(token, secret);
      if (scope) return scope;
    }
    return c.get(COOKIE_NAME)?.value || DEFAULT_CLIENT_ID;
  } catch {
    return DEFAULT_CLIENT_ID;
  }
}

// Resolva tenant för endpoints som nås av BÅDE admin-dashboarden och kund-portalen (/k).
// Diskriminator = vilken sida gjorde anropet (referer):
//  - från kund-portalen (/k) → den HttpOnly-validerade kund-sessionen vinner (kund låst
//    till sin egen data, kan ej escapa via active_client_id-cookien).
//  - från admin (/dashboard) → admins valda aktiva klient, ÄVEN om en gammal kund-cookie
//    ligger kvar i webbläsaren (t.ex. efter att admin förhandsgranskat en kunds portal).
export async function resolveClientId(): Promise<string> {
  try {
    const h = await headers();
    const referer = h.get("referer") || "";
    let fromPortal = false;
    try { fromPortal = /^\/k(\/|$)/.test(new URL(referer).pathname); } catch { /* ingen/ogiltig referer */ }
    if (fromPortal) {
      const { getCustomerSession } = await import("./customer-context");
      const cs = await getCustomerSession();
      if (cs) return cs.client_id;
    }
  } catch {
    /* admin-kontext */
  }
  return getActiveClientId();
}

export async function setActiveClientId(id: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, id, {
    httpOnly: true, // server-only; läses aldrig client-side (verifierat) → ej manipulerbar i JS
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
}

export async function getActiveClient(): Promise<Client | null> {
  const id = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb.from("clients").select("*").eq("id", id).single();
  return (data as Client) || null;
}

export async function logActivity(
  clientId: string,
  type: string,
  title: string,
  link?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = supabaseServer();
    await sb.from("client_activity").insert({ client_id: clientId, type, title, link, meta });
  } catch {
    // Tyst — logg ska aldrig blockera huvudoperationen
  }
}

export const HM_MOTOR_ID = DEFAULT_CLIENT_ID;
