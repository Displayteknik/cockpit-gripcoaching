// K3-INKÖP — bruttomarginal per kund. Server-only (service-role).
//
// Intäkten byggs INTE om: den bor redan i hq_mrr_entries, ägarens egna intäktsrader från
// HQ-1. Här läses de bara, plus sålda påfyllningar innevarande månad ur creditsystemets
// beställningar. Kostnaden kommer ur samma ai_usage_events som resten av modulen.
//
// ⚠ Kopplingen mellan intäktsrad och tenant: `hq_mrr_entries.client_id` om ägaren satt
// den, annars exakt namnmatchning. Namnmatchning ensam är för svag för att bygga en
// marginal på, och en felmatchad rad hade sett ut som en sanning.

import { supabaseService } from "../supabase-admin";
import { raknaMarginal, summeraMarginal, type MarginalIn, type MarginalRad, type MarginalSumma } from "./berakning";

export interface MrrVal {
  id: string;
  kund: string;
  bolag: string;
  belopp_ex_moms: number;
  status: string;
  client_id: string | null;
}

export interface MarginalData {
  rader: MarginalRad[];
  summa: MarginalSumma;
  /** Alla aktiva intäktsrader, så vyn kan erbjuda en koppling till rätt kund. */
  mrrVal: MrrVal[];
  manad: string;
}

const TZ = "Europe/Stockholm";

export async function byggMarginal(nu: Date = new Date()): Promise<MarginalData> {
  const manad = nu.toLocaleDateString("sv-SE", { timeZone: TZ }).slice(0, 7);
  const tom: MarginalData = {
    rader: [],
    summa: { intaktSek: 0, aiKostnadSek: 0, marginalSek: 0, marginalProcent: null, utanPris: 0 },
    mrrVal: [],
    manad,
  };

  try {
    const sb = supabaseService();
    const manadStart = new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), 1)).toISOString();

    const [{ data: klientData }, { data: mrrData }, { data: ordrarData }, { data: handelseData }] = await Promise.all([
      sb.from("clients").select("id, name").order("name"),
      sb.from("hq_mrr_entries").select("id, kund, bolag, belopp_ex_moms, status, client_id"),
      sb
        .from("topup_orders")
        .select("tenant_id, price_sek, status, decided_at")
        .eq("status", "approved")
        .gte("decided_at", manadStart),
      sb.from("ai_usage_events").select("tenant_id, estimated_cost_sek").gte("created_at", manadStart).limit(50000),
    ]);

    const klienter = ((klientData as Array<{ id: string; name: string }> | null) || []).map((c) => ({
      id: c.id,
      namn: c.name,
    }));
    const mrr = ((mrrData as MrrVal[] | null) || []).map((r) => ({ ...r, belopp_ex_moms: Number(r.belopp_ex_moms) || 0 }));
    const aktivMrr = mrr.filter((r) => r.status === "aktiv");

    // Priset per tenant: kopplad rad först, exakt namnmatchning som reserv.
    // Flera aktiva rader mot samma kund summeras — en kund kan ha två abonnemang.
    const prisPerTenant = new Map<string, number>();
    for (const r of aktivMrr) {
      let tenantId = r.client_id || null;
      if (!tenantId) {
        const namn = r.kund.trim().toLowerCase();
        tenantId = klienter.find((c) => c.namn.trim().toLowerCase() === namn)?.id ?? null;
      }
      if (!tenantId) continue;
      prisPerTenant.set(tenantId, (prisPerTenant.get(tenantId) || 0) + r.belopp_ex_moms);
    }

    const topupPerTenant = new Map<string, number>();
    for (const o of ((ordrarData as Array<{ tenant_id: string; price_sek: number | string }> | null) || [])) {
      topupPerTenant.set(o.tenant_id, (topupPerTenant.get(o.tenant_id) || 0) + (Number(o.price_sek) || 0));
    }

    const aiPerTenant = new Map<string, number>();
    for (const h of ((handelseData as Array<{ tenant_id: string | null; estimated_cost_sek: number | string }> | null) || [])) {
      if (!h.tenant_id) continue;
      aiPerTenant.set(h.tenant_id, (aiPerTenant.get(h.tenant_id) || 0) + (Number(h.estimated_cost_sek) || 0));
    }

    const inn: MarginalIn[] = klienter.map((c) => ({
      tenantId: c.id,
      namn: c.namn,
      abonnemangSek: prisPerTenant.has(c.id) ? prisPerTenant.get(c.id)! : null,
      topupSek: topupPerTenant.get(c.id) || 0,
      aiKostnadSek: aiPerTenant.get(c.id) || 0,
    }));

    const rader = raknaMarginal(inn).sort((a, b) => {
      // Kunder med pris först, sedan fallande marginal. Luckorna hamnar sist men syns.
      if (a.prisSaknas !== b.prisSaknas) return a.prisSaknas ? 1 : -1;
      return (b.marginalSek ?? 0) - (a.marginalSek ?? 0);
    });

    return { rader, summa: summeraMarginal(rader), mrrVal: aktivMrr, manad };
  } catch (e) {
    console.error("[inkop] kunde inte bygga marginalen:", (e as Error).message);
    return tom;
  }
}
