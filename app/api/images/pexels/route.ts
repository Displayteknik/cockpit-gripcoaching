import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { searchStockPhotos } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/images/pexels?topic=... — söker stockfoton via Pexels
// Auto-fyller niche från brand-profil
export async function GET(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || "";
    const count = Number(url.searchParams.get("count") || 12);

    const sb = supabaseService();
    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("company_name, location")
      .eq("client_id", clientId)
      .maybeSingle();
    const niche = [profile?.company_name, profile?.location].filter(Boolean).join(" ");

    const result = await searchStockPhotos(topic, niche || undefined, count);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
