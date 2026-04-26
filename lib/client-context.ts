import { cookies } from "next/headers";
import { supabaseServer } from "./supabase-admin";

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
    return c.get(COOKIE_NAME)?.value || DEFAULT_CLIENT_ID;
  } catch {
    return DEFAULT_CLIENT_ID;
  }
}

export async function setActiveClientId(id: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, id, {
    httpOnly: false,
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
