// lib/profil/las.ts — hämtar underlaget till kvalitetsberäkningen.
// Separerad från lib/profil/kvalitet.ts med flit: beräkningen ska vara ren och
// testbar, läsningen är det som rör databasen. Alla anropare (kvalitetsmätaren,
// kundportalens översikt, onboarding-statusen, mjuka grinden i genereringsvyerna)
// går genom den här funktionen så att svaret på "hur komplett är profilen?" är ETT.

import { supabaseService } from "@/lib/supabase-admin";
import { beraknaKvalitet, type KvalitetsIndata, type KvalitetsRapport } from "@/lib/profil/kvalitet";

export async function lasKvalitetsIndata(clientId: string): Promise<KvalitetsIndata> {
  const sb = supabaseService();
  const [profil, assets, kundroster, berattelser, fingerprint, klient] = await Promise.all([
    sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("client_assets").select("asset_type, category, subcategory, body").eq("client_id", clientId).eq("status", "active"),
    sb.from("customer_voice").select("phrase, category, context").eq("client_id", clientId).eq("archived", false).limit(200),
    sb
      .from("linkedin_posts")
      .select("hook, idea_seed, notes")
      .eq("client_id", clientId)
      .eq("source_module", "intake")
      .in("status", ["idea", "draft", "approved", "posted"])
      .limit(100),
    sb.from("client_voice_profile").select("signature_phrases, source_asset_count").eq("client_id", clientId).maybeSingle(),
    sb.from("clients").select("name, industry").eq("id", clientId).maybeSingle(),
  ]);

  return {
    profil: (profil.data as Record<string, unknown> | null) ?? null,
    assets: (assets.data as KvalitetsIndata["assets"] | null) ?? [],
    kundroster: (kundroster.data as KvalitetsIndata["kundroster"] | null) ?? [],
    berattelser: (berattelser.data as KvalitetsIndata["berattelser"] | null) ?? [],
    fingerprint: (fingerprint.data as KvalitetsIndata["fingerprint"] | null) ?? null,
    klient: (klient.data as KvalitetsIndata["klient"] | null) ?? null,
  };
}

export async function profilKvalitet(clientId: string): Promise<KvalitetsRapport> {
  return beraknaKvalitet(await lasKvalitetsIndata(clientId));
}
