import { NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface StepStatus {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  cta_label: string;
  cta_href: string;
}

export async function GET(req: NextRequest) {
  const sb = supabaseService();
  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");

  // Lista-mode: returnera alla klienter med progress 0-5
  if (!clientId) {
    const { data: clients } = await sb.from("clients").select("id, name, slug, public_url").order("name");
    if (!clients) return Response.json({ clients: [] });

    const out = await Promise.all(
      clients.map(async (c) => {
        const status = await computeStatus(c.id, c.public_url);
        const done = status.steps.filter((s) => s.done).length;
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          public_url: c.public_url,
          progress: done,
          total: status.steps.length,
        };
      })
    );
    return Response.json({ clients: out });
  }

  // Detalj-mode: returnera fullt status per steg
  const { data: client } = await sb
    .from("clients")
    .select("id, name, slug, public_url")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return Response.json({ error: "Klient saknas" }, { status: 404 });

  const status = await computeStatus(clientId, client.public_url);
  return Response.json({ client, ...status });
}

async function computeStatus(
  clientId: string,
  publicUrl: string | null
): Promise<{ steps: StepStatus[]; stats: Record<string, number> }> {
  const sb = supabaseService();

  const [profile, fingerprint, assets, winning, visits, gscRow, ideas] = await Promise.all([
    sb
      .from("hm_brand_profile")
      .select("client_id, tone_rules, dos, donts, usp, target_audience")
      .eq("client_id", clientId)
      .maybeSingle(),
    sb
      .from("client_voice_profile")
      .select("source_asset_count, signature_phrases, last_built_at")
      .eq("client_id", clientId)
      .maybeSingle(),
    sb
      .from("client_assets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "active"),
    sb
      .from("client_assets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("category", "winning_example")
      .eq("status", "active"),
    sb
      .from("hm_visits")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .gte("ts", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    sb.from("hm_seo_keywords").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    sb.from("ideas_bank").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);

  const p = profile.data as {
    tone_rules: string | null;
    dos: string | null;
    donts: string | null;
    usp: string | null;
    target_audience: string | null;
  } | null;
  const f = fingerprint.data as {
    source_asset_count: number | null;
    signature_phrases: string[] | null;
    last_built_at: string | null;
  } | null;

  const brandComplete = !!(p?.tone_rules && p?.dos && p?.donts && p?.usp);
  const voiceBuilt = !!f?.last_built_at && (f.source_asset_count ?? 0) >= 5;
  const winningOK = (winning.count ?? 0) >= 3;
  const pixelOK = (visits.count ?? 0) > 0;
  const ideasOK = (ideas.count ?? 0) > 0 || (gscRow.count ?? 0) > 0;

  const steps: StepStatus[] = [
    {
      id: "brand",
      label: "Brand-profil",
      done: brandComplete,
      detail: brandComplete
        ? "Tone, dos/donts, USP ifyllda."
        : p
        ? "Profilen finns men något saknas (USP, tone, dos eller donts)."
        : "Ingen profil skapad än.",
      cta_label: brandComplete ? "Granska" : "Fyll i",
      cta_href: `/dashboard/profil?client=${clientId}`,
    },
    {
      id: "voice",
      label: "Voice-fingerprint",
      done: voiceBuilt,
      detail: f?.last_built_at
        ? `Byggd ${new Date(f.last_built_at).toLocaleDateString("sv-SE")} · ${f.source_asset_count ?? 0} källor · ${(f.signature_phrases?.length ?? 0)} signaturfraser`
        : `${assets.count ?? 0} assets — behöver minst 5 för att bygga.`,
      cta_label: (assets.count ?? 0) >= 5 ? "Bygg/uppdatera" : "Lägg till assets",
      cta_href: `/dashboard/profil?client=${clientId}#voice`,
    },
    {
      id: "winning",
      label: "Winning examples",
      done: winningOK,
      detail: `${winning.count ?? 0}/3 markerade. ${winningOK ? "Klart." : "Markera 3+ Hakan-godkända inlägg."}`,
      cta_label: winningOK ? "Hantera" : "Markera",
      cta_href: `/dashboard/profil?client=${clientId}#assets`,
    },
    {
      id: "pixel",
      label: "Trafik-pixel",
      done: pixelOK,
      detail: pixelOK
        ? `${visits.count ?? 0} besök senaste 30d.`
        : publicUrl
        ? "Inga besök registrerade än. Klistra in pixeln på sajten."
        : "Sätt public_url på klienten först.",
      cta_label: pixelOK ? "Visa trafik" : "Hämta snippet",
      cta_href: pixelOK ? `/dashboard/seo?client=${clientId}` : `/dashboard/setup?prompt=pixel-${clientId}`,
    },
    {
      id: "ideas",
      label: "Idé-motor (GSC + idé-bank)",
      done: ideasOK,
      detail: `${gscRow.count ?? 0} sökord · ${ideas.count ?? 0} idéer i banken.`,
      cta_label: (ideas.count ?? 0) > 0 ? "Granska idéer" : "Generera idéer",
      cta_href: (ideas.count ?? 0) > 0 ? `/dashboard/agents?client=${clientId}` : `/dashboard/setup?prompt=night-${clientId}`,
    },
  ];

  return {
    steps,
    stats: {
      assets: assets.count ?? 0,
      winning: winning.count ?? 0,
      visits_30d: visits.count ?? 0,
      voice_sources: f?.source_asset_count ?? 0,
      gsc_keywords: gscRow.count ?? 0,
      ideas: ideas.count ?? 0,
    },
  };
}
