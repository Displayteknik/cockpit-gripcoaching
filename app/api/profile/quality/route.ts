import { NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { countAssetsByType } from "@/lib/assets";

export const runtime = "nodejs";

interface DimensionScore {
  key: string;
  label: string;
  status: "red" | "yellow" | "green";
  score: number;        // 0-100
  filled: number;
  total: number;
  missing: string[];
  hint: string;
}

interface QualityReport {
  overall: number;
  ready_to_produce: boolean;
  dimensions: DimensionScore[];
}

function len(s: unknown): number {
  return typeof s === "string" ? s.trim().length : 0;
}
function has(s: unknown, min = 10): boolean {
  return len(s) >= min;
}

export async function GET() {
  try {
    const clientId = await getActiveClientId();
    const sb = supabaseService();

    const { data: profile } = await sb
      .from("hm_brand_profile")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();

    const counts = await countAssetsByType(clientId);
    const p = profile || {};

    const dims: DimensionScore[] = [];

    // ========== 1. RÖST ==========
    {
      const checks = [
        { ok: has(p.tone_rules, 30), label: "Tonregler" },
        { ok: has(p.dos, 10), label: "GÖR-lista" },
        { ok: has(p.donts, 10), label: "GÖR INTE-lista" },
        { ok: counts.post >= 5, label: "Minst 5 egna inlägg" },
        { ok: counts.audio + counts.video >= 1, label: "Minst 1 ljud/video-inspelning" },
      ];
      const filled = checks.filter((c) => c.ok).length;
      const missing = checks.filter((c) => !c.ok).map((c) => c.label);
      const score = Math.round((filled / checks.length) * 100);
      dims.push({
        key: "voice",
        label: "Röst",
        status: filled >= 5 ? "green" : filled >= 3 ? "yellow" : "red",
        score,
        filled,
        total: checks.length,
        missing,
        hint: "AI:n imiterar bara så bra som den får exempel. Lägg in fler riktiga inlägg och en ljudinspelning.",
      });
    }

    // ========== 2. ICP ==========
    {
      const checks = [
        { ok: has(p.icp_primary, 50), label: "Primär ICP" },
        { ok: has(p.icp_secondary, 30), label: "Sekundär ICP" },
        { ok: has(p.pain_points, 50), label: "Smärtpunkter" },
        { ok: has(p.customer_quotes, 80), label: "Riktiga kundord" },
      ];
      const filled = checks.filter((c) => c.ok).length;
      const score = Math.round((filled / checks.length) * 100);
      dims.push({
        key: "icp",
        label: "ICP — vem skriver vi för",
        status: filled >= 4 ? "green" : filled >= 2 ? "yellow" : "red",
        score,
        filled,
        total: checks.length,
        missing: checks.filter((c) => !c.ok).map((c) => c.label),
        hint: "Utan tydlig ICP blir innehållet generiskt. Kör ICP-wizarden om primär saknas.",
      });
    }

    // ========== 3. AUKTORITET ==========
    {
      const checks = [
        { ok: has(p.usp, 40), label: "USP" },
        { ok: has(p.brand_story, 100), label: "Brand story" },
        { ok: has(p.differentiators, 30), label: "Differentiatorer (3 saker bara ni kan säga)" },
      ];
      const filled = checks.filter((c) => c.ok).length;
      const score = Math.round((filled / checks.length) * 100);
      dims.push({
        key: "authority",
        label: "Auktoritet & differentiering",
        status: filled >= 3 ? "green" : filled >= 2 ? "yellow" : "red",
        score,
        filled,
        total: checks.length,
        missing: checks.filter((c) => !c.ok).map((c) => c.label),
        hint: "Tre saker bara ni kan säga är hjärtat i alla bra inlägg. Skriv ned dem.",
      });
    }

    // ========== 4. BEVIS ==========
    {
      const checks = [
        { ok: counts.testimonial >= 3, label: "Minst 3 vittnesmål med namn" },
        { ok: counts.photo >= 3, label: "Minst 3 foton från verksamheten" },
        { ok: has(p.customer_journey, 80), label: "Kundresan (5 stadier)" },
      ];
      const filled = checks.filter((c) => c.ok).length;
      const score = Math.round((filled / checks.length) * 100);
      dims.push({
        key: "proof",
        label: "Bevis",
        status: filled >= 3 ? "green" : filled >= 2 ? "yellow" : "red",
        score,
        filled,
        total: checks.length,
        missing: checks.filter((c) => !c.ok).map((c) => c.label),
        hint: "Vittnesmål och riktiga foton slår all stockfoto-design. Ladda upp.",
      });
    }

    // ========== 5. ERBJUDANDE ==========
    {
      const checks = [
        { ok: has(p.services, 30), label: "Tjänster/produkter" },
        { ok: has(p.booking_url, 8) && /^https?:\/\//i.test(String(p.booking_url || "")), label: "Bokningslänk (giltig URL)" },
        { ok: has(p.pricing_notes, 10), label: "Prisnotiser (valfritt)", optional: true },
      ];
      // Kärnkraven är de två första — pricing_notes är valfri
      const core = checks.slice(0, 2);
      const filledCore = core.filter((c) => c.ok).length;
      const filled = checks.filter((c) => c.ok).length;
      const score = Math.round((filledCore / 2) * 100);
      dims.push({
        key: "offer",
        label: "Erbjudande & CTA",
        status: filledCore >= 2 ? "green" : filledCore >= 1 ? "yellow" : "red",
        score,
        filled,
        total: checks.length,
        missing: core.filter((c) => !c.ok).map((c) => c.label),
        hint: "Ett inlägg utan tydlig nästa-handling konverterar inte. Bokningslänken måste fungera.",
      });
    }

    const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
    const ready = dims.every((d) => d.status === "green");

    const report: QualityReport = {
      overall,
      ready_to_produce: ready,
      dimensions: dims,
    };

    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
