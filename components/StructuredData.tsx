// Server component som hämtar profile + settings och injekterar JSON-LD.
// Kan användas på publika sidor: <StructuredData type="localbusiness" />

import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";
import { localBusinessJsonLd, jsonLdScript } from "@/lib/structured-data";

export default async function StructuredData({ type = "localbusiness" }: { type?: "localbusiness" }) {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const [{ data: profile }, { data: settingsRows }] = await Promise.all([
    sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("hm_settings").select("*").eq("client_id", clientId),
  ]);
  const settings = Object.fromEntries((settingsRows || []).map((s) => [s.key, s.value])) as Record<string, string>;

  if (type === "localbusiness") {
    if (!profile) return null;
    return <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(localBusinessJsonLd(profile, settings))} />;
  }
  return null;
}
