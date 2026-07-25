import { NextResponse } from "next/server";
import { resolveClientId, type Client } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { getAdminScope, requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  // Referer-medveten: anrop från /k → kundens EGEN klient (även om en admin-cookie
  // ligger kvar i browsern, t.ex. vid förhandsvisning). Anrop från /dashboard → admins
  // aktiva klient. Löser cross-tenant-läckan där Studio i /k visade fel klient/brand.
  const id = await resolveClientId();
  const sb = supabaseService();
  const { data: c } = await sb
    .from("clients")
    .select("id, slug, name, industry, public_url, primary_color, resource_module, archived, report_recipients, ig_handle, ig_account_id")
    .eq("id", id)
    .single<Client>();
  // scoped = sessionen är låst till en klient (t.ex. HM Motor) → UI döljer klientväxling/agentur-flikar.
  const scoped = !!(await getAdminScope());
  // Endast icke-hemliga fält — getActiveClient() gör select("*") och innehåller secrets
  // (customer_token, customer_pin, ig_access_token, ghl_api_key, ghl_webhook_url). Aldrig spreada hela raden.
  return NextResponse.json(
    c
      ? {
          id: c.id,
          slug: c.slug,
          name: c.name,
          industry: c.industry,
          public_url: c.public_url,
          primary_color: c.primary_color,
          resource_module: c.resource_module,
          archived: c.archived,
          report_recipients: c.report_recipients,
          ig_handle: c.ig_handle,
          ig_account_id: c.ig_account_id,
          scoped,
        }
      : c,
  );
}
