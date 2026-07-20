import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// Levererar brand-profil-data mappad till specialist-fältnycklar, så återkommande
// fält (läsare/bransch/USP) fylls i automatiskt i stället för varje gång för hand.
// Källan är hm_brand_profile + clients.industry — en sanningskälla.
export async function GET() {
  const sb = supabaseService();
  const clientId = await resolveClientId();

  const [{ data: profile }, { data: client }] = await Promise.all([
    sb.from("hm_brand_profile").select("usp, icp_primary, icp_secondary, pain_points").eq("client_id", clientId).maybeSingle(),
    sb.from("clients").select("industry").eq("id", clientId).maybeSingle(),
  ]);

  const p = (profile ?? {}) as { usp?: string | null; icp_primary?: string | null; icp_secondary?: string | null };
  const industry = (client as { industry?: string | null } | null)?.industry ?? null;

  // Nycklarna matchar specialist-input-keys (geo-aeo-optimizer m.fl.) → prefill i UI.
  const prefill: Record<string, string> = {};
  const malgrupp = [p.icp_primary, p.icp_secondary].filter(Boolean).join(" · ").trim();
  if (malgrupp) prefill.malgrupp = malgrupp;
  if (industry) prefill.bransch = industry;
  if (p.usp && p.usp.trim()) prefill.differentiering = p.usp.trim();

  return NextResponse.json({ prefill });
}
