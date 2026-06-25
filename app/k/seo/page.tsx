// Kund-yta för SEO & AEO — serverside-spärr på modulen "seo".
// Återanvänder de befintliga /api/seo/*-endpointsen som redan scopas till kundens
// client_id via customer-cookien (satt av /k/[token]).
import { requireCustomerFeature } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { hasKeywordIdeas } from "@/lib/feature-flags";
import SeoClient from "./SeoClient";

export const dynamic = "force-dynamic";

export default async function KSeo() {
  const session = await requireCustomerFeature("seo");

  const sb = supabaseService();
  const { data } = await sb
    .from("clients")
    .select("public_url")
    .eq("id", session.client_id)
    .maybeSingle();

  return (
    <SeoClient
      primaryColor={session.primary_color}
      clientName={session.client_name}
      publicUrl={(data?.public_url as string) || ""}
      showKeywordIdeas={hasKeywordIdeas(session.client_id)}
    />
  );
}
