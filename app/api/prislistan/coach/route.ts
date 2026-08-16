import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { landatSek, tb } from "@/lib/pris/kalkyl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PRIS2-6 — Priscoachen, portad från mysales-coach/netlify/functions/pris-coach.ts till
// en Cockpit API-route. Samma läge-format, samma marknadssökning (via om-market-research
// i mysales-coach — ingen ny sökintegration byggd om här), samma källdisciplin.
const TENANT = process.env.SALJLAGER_TENANT || "8c99b995-90c2-41fb-b12e-3f3d2469df77";
const MARKNAD_URL = "https://mysales-coach.netlify.app/.netlify/functions/om-market-research";

interface Body {
  artikelnummer: string;
  fraga?: string;
  historik?: Array<{ roll: "user" | "assistant"; text: string }>;
}

async function hamtaLaget(artikelnummer: string) {
  const sb = supabaseService();
  const { data: artikel } = await sb.from("al_artiklar").select("id, artikelnummer, namn, kategori").eq("user_id", TENANT).eq("artikelnummer", artikelnummer).maybeSingle();
  if (!artikel) return null;
  const { data: kopplingar } = await sb.from("al_leverantorskoppling").select("produktnyckel, bekraftad").eq("user_id", TENANT).eq("artikel_id", artikel.id);
  const nycklar = (kopplingar || []).map((k) => k.produktnyckel);
  const { data: sl } = await sb.from("sl_prices").select("artikelnr, pris, prismodell, version, giltig_fran").eq("user_id", TENANT).eq("katalog_kod", artikelnummer).eq("gallande", true).maybeSingle();
  const { data: golvRad } = await sb.from("sl_golv").select("golv_pct").eq("user_id", TENANT).eq("kategori", artikel.kategori === "fonsterskarm" ? "skyltfonster" : artikel.kategori).maybeSingle();
  const golv = golvRad?.golv_pct ?? 30;

  const rader: Array<{ produktnyckel: string; sku: string; qty_tier: number; shipping_way: string; landat_sek: number; tb_kr: number | null; tb_pct: number | null }> = [];
  if (nycklar.length) {
    const { data: priser } = await sb.from("om_prices").select("produktnyckel, sku, qty_tier, shipping_way, unit_price, freight_per_unit, price_list_id, om_price_lists!inner(calc_rate_at_import)").eq("user_id", TENANT).in("produktnyckel", nycklar);
    for (const p of priser || []) {
      const rate = Number((p as unknown as { om_price_lists?: { calc_rate_at_import?: number } }).om_price_lists?.calc_rate_at_import) || 0;
      const landat = rate ? landatSek(Number(p.unit_price), Number(p.freight_per_unit) || 0, rate) : NaN;
      if (Number.isNaN(landat)) continue;
      const t = sl?.pris != null ? tb(Number(sl.pris), landat) : { kr: null, pct: null };
      rader.push({ produktnyckel: p.produktnyckel, sku: p.sku, qty_tier: p.qty_tier, shipping_way: p.shipping_way, landat_sek: landat, tb_kr: t.kr, tb_pct: t.pct });
    }
  }
  rader.sort((a, b) => a.landat_sek - b.landat_sek);
  return { artikel, saljpris: sl, golv, bastaInkop: rader[0] || null, allaInkop: rader };
}

async function hamtaMarknad(kategoriText: string) {
  try {
    const r = await fetch(MARKNAD_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: TENANT, kategori: kategoriText }),
    });
    if (!r.ok) return { priser: [], fel: `Marknadssökningen svarade ${r.status}` };
    return await r.json();
  } catch (e) {
    return { priser: [], fel: `Marknadssökningen (mysales-coach) kunde inte nås: ${String(e)}` };
  }
}

const SYSTEM = `Du är Displaytekniks priscoach. Du agerar exakt som Håkan och Claude
resonerar tillsammans om pris i skarpt läge (K&M, Fresh Air, Lars-affärerna): affärsmässig,
källkritisk, rak, aldrig salig, aldrig gissande.

HÅRDA REGLER:
- Varje siffra du nämner måste komma från LÄGET eller MARKNADEN i användarmeddelandet. Hittar
  du ingen siffra: säg "uppgift saknas", gissa ALDRIG.
- Marknadspriser utan källa (source_url) räknas INTE, nämn dem aldrig som fakta.
- TB-golvet i LÄGET är ett golv, inte ett tak. Ett förslag under golvet ska sägas rakt ut.
- Visa alltid känsligheten: hur TB ändras vid minst två alternativa prisnivåer.
- Coachen FÖRESLÅR. Skriv aldrig som att beslutet redan är fattat.
- Inga tankstreck i din text.
- Svara på svenska, kort och konkret.`;

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas" }, { status: 500 });

  const b = (await req.json()) as Body;
  if (!b.artikelnummer) return NextResponse.json({ error: "artikelnummer krävs" }, { status: 400 });

  const laget = await hamtaLaget(b.artikelnummer);
  if (!laget) return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });

  const kategoriText = `${laget.artikel.namn} (Displayteknik-artikel ${laget.artikel.artikelnummer})`;
  const marknad = b.fraga ? null : await hamtaMarknad(kategoriText);

  const lagetText = laget.saljpris
    ? `Artikel: ${laget.artikel.namn} (${laget.artikel.artikelnummer}). Gällande säljpris: ${laget.saljpris.pris ?? "offereras"} kr (version ${laget.saljpris.version}, satt ${laget.saljpris.giltig_fran}). TB-golv för kategorin: ${laget.golv}%.
Bästa kända inköpsväg: ${laget.bastaInkop ? `${laget.bastaInkop.sku}, ${laget.bastaInkop.shipping_way}, qty ${laget.bastaInkop.qty_tier}, landat ${laget.bastaInkop.landat_sek} kr, TB ${laget.bastaInkop.tb_kr} kr (${laget.bastaInkop.tb_pct}%)` : "ingen inköpsdata kopplad ännu"}.
Alla kända inköpsvägar: ${laget.allaInkop.map((r) => `${r.sku}/${r.shipping_way}/qty${r.qty_tier}: landat ${r.landat_sek} kr, TB ${r.tb_pct}%`).join(" | ") || "inga"}.`
    : `Artikel: ${laget.artikel.namn} (${laget.artikel.artikelnummer}). INGET säljpris kopplat än i säljlagret.`;

  const marknadText = marknad
    ? marknad.fel
      ? `MARKNADEN: sökningen misslyckades (${marknad.fel}). Inga marknadspriser tillgängliga, säg det rakt ut.`
      : marknad.priser?.length
        ? `MARKNADEN (${marknad.fromCache ? "cachad, <30 dagar" : "ny sökning"}): ${marknad.priser
            .map((p: { competitor: string; model?: string; price_sek: number | null; source_url?: string | null; tier: string }) =>
              p.price_sek != null && p.source_url ? `${p.competitor}${p.model ? " " + p.model : ""}: ${p.price_sek} kr (${p.tier}, källa: ${p.source_url})` : `${p.competitor}: pris ej källbelagt, uteslutet`,
            )
            .join(" | ")}`
        : `MARKNADEN: ingen belagd konkurrentsiffra hittades för "${kategoriText}". Säg "uppgift saknas".`
    : "(marknaden söktes bara vid start av samtalet)";

  const historik = (b.historik || []).map((h) => ({ role: h.roll, content: h.text }));
  const anvandarText = b.fraga
    ? b.fraga
    : `LÄGET: ${lagetText}\n\n${marknadText}\n\nGör tre saker i ordning: (1) läs läget, (2) sammanfatta marknadsläget, (3) föreslå en motiverad sweet spot med TB i kr och %, position mot marknaden om den finns, och känslighet vid minst två prisnivåer.`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const svar = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: SYSTEM,
    messages: [...historik, { role: "user", content: anvandarText }],
  });
  const text = svar.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("\n");

  return NextResponse.json({
    svar: text,
    laget: { artikelnummer: laget.artikel.artikelnummer, saljpris: laget.saljpris?.pris ?? null, golv: laget.golv, bastaInkop: laget.bastaInkop },
    marknad: marknad ? { fromCache: !!marknad.fromCache, antalPriser: marknad.priser?.filter((p: { price_sek: number | null }) => p.price_sek != null).length || 0 } : null,
  });
}
