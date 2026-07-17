// ============================================================================
// ENTITLEMENTS — EN central plats för effektiv modul-behörighet (Fas 1)
// ============================================================================
// Effektiv behörighet = (Pro-standard ∪ aktiv kampanj ∪ manuella tillägg)
//                        − manuella avdrag.  Beräknas HÄR, aldrig ad hoc i
//                        komponenter. Läser strikt-RLS-tabellerna via service-role.
//
// Källor:
//   clients.plan            → 'pro' (standard-uppsättning gäller) | 'mysales' (bara bas)
//   platform_modules        → registret + Pro-standard (in_pro_default) + kampanjfält
//   tenant_modules          → per-tenant tillägg/avdrag (enabled true/false) + källa
//
// Fallback: om platform_modules ännu inte är seedad (kod deployad före migration)
// faller vi tillbaka på legacy clients.customer_features → befintliga kunder
// påverkas aldrig (behåll-fungerande-väg-regeln).
// ============================================================================

import { supabaseService } from "./supabase-admin";
import { normalizeFeatures, CUSTOMER_FEATURES } from "./customer-features";

export interface PlatformModule {
  id: string;
  label: string;
  description: string | null;
  href: string | null;
  icon: string | null;
  owner_area: string | null;
  sort_order: number;
  active: boolean;
  in_pro_default: boolean;
  campaign: boolean;
  campaign_label: string | null;
  campaign_until: string | null; // 'YYYY-MM-DD'
}

// En modul som en given tenant FAKTISKT har, med varifrån den kommer.
export interface EffectiveModule {
  id: string;
  label: string;
  description: string | null;
  href: string | null;
  icon: string | null;
  campaign: boolean;             // aktiv kampanj just nu → badge i kundvyn
  campaign_label: string | null; // "Just nu ingår även …"
  source: "standard" | "kampanj" | "manuell";
}

// Kampanj aktiv om campaign=true OCH (inget slutdatum ELLER slutdatum ej passerat).
function campaignActive(m: PlatformModule): boolean {
  if (!m.campaign) return false;
  if (!m.campaign_until) return true;
  return m.campaign_until >= new Date().toISOString().slice(0, 10);
}

// Hela registret (för admin Vy 1). Ordnat på sort_order.
export async function getModuleRegistry(): Promise<PlatformModule[]> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("platform_modules")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data as PlatformModule[];
}

// ── DEN CENTRALA FUNKTIONEN ─────────────────────────────────────────────────
export async function getEffectiveModules(clientId: string): Promise<EffectiveModule[]> {
  const sb = supabaseService();

  const [clientRes, modsRes, ovRes] = await Promise.all([
    sb.from("clients").select("plan, customer_features").eq("id", clientId).maybeSingle(),
    sb.from("platform_modules").select("*").eq("active", true).order("sort_order", { ascending: true }),
    sb.from("tenant_modules").select("module_id, enabled, source").eq("client_id", clientId),
  ]);

  const modules = (modsRes.data as PlatformModule[] | null) || [];

  // Fallback: registret ej seedat (eller tabell saknas) → legacy customer_features.
  if (modules.length === 0) {
    return legacyEffectiveModules((clientRes.data?.customer_features as string[] | null) ?? null);
  }

  const plan = (clientRes.data?.plan as string) || "pro";
  const overrides = (ovRes.data as { module_id: string; enabled: boolean; source: string }[] | null) || [];
  const removed = new Set(overrides.filter((o) => !o.enabled).map((o) => o.module_id));
  const manualAdds = new Set(overrides.filter((o) => o.enabled).map((o) => o.module_id));

  const result: EffectiveModule[] = [];
  for (const m of modules) {
    if (removed.has(m.id)) continue; // manuellt avdrag vinner alltid

    const inStandard = plan === "pro" && m.in_pro_default;
    const inCampaign = plan === "pro" && campaignActive(m);
    const manualAdd = manualAdds.has(m.id);
    if (!inStandard && !inCampaign && !manualAdd) continue;

    // Källa för admin-visning: standard > kampanj > manuell.
    const source: EffectiveModule["source"] = inStandard ? "standard" : inCampaign ? "kampanj" : "manuell";

    result.push({
      id: m.id,
      label: m.label,
      description: m.description,
      href: m.href,
      icon: m.icon,
      campaign: inCampaign,
      campaign_label: inCampaign ? m.campaign_label : null,
      source,
    });
  }
  return result;
}

export async function getEffectiveModuleIds(clientId: string): Promise<string[]> {
  return (await getEffectiveModules(clientId)).map((m) => m.id);
}

// Admin Vy 2: varje modul för en tenant med effektiv-status, källa och ev. override.
export interface TenantModuleRow {
  id: string;
  label: string;
  description: string | null;
  in_pro_default: boolean;
  active: boolean;
  effective: boolean;
  source: EffectiveModule["source"] | null;
  override: "add" | "remove" | null; // manuellt tillägg/avdrag om satt
}

export async function getTenantModuleView(clientId: string): Promise<TenantModuleRow[]> {
  const sb = supabaseService();
  const [modsRes, ovRes] = await Promise.all([
    sb.from("platform_modules").select("*").order("sort_order", { ascending: true }),
    sb.from("tenant_modules").select("module_id, enabled").eq("client_id", clientId),
  ]);
  const modules = (modsRes.data as PlatformModule[] | null) || [];
  const overrides = new Map(
    ((ovRes.data as { module_id: string; enabled: boolean }[] | null) || []).map((o) => [o.module_id, o.enabled]),
  );
  const eff = new Map((await getEffectiveModules(clientId)).map((e) => [e.id, e]));
  return modules.map((m) => {
    const e = eff.get(m.id);
    const override: "add" | "remove" | null = overrides.has(m.id)
      ? overrides.get(m.id)
        ? "add"
        : "remove"
      : null;
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      in_pro_default: m.in_pro_default,
      active: m.active,
      effective: !!e,
      source: e?.source ?? null,
      override,
    };
  });
}

// Serverside-grind: används av layouts/route handlers.
export async function hasModule(clientId: string, moduleId: string): Promise<boolean> {
  const ids = await getEffectiveModuleIds(clientId);
  return ids.includes(moduleId);
}

// ── Legacy-fallback (customer_features) → EffectiveModule[] ──────────────────
function legacyEffectiveModules(customerFeatures: string[] | null): EffectiveModule[] {
  const keys = normalizeFeatures(customerFeatures);
  return CUSTOMER_FEATURES.filter((f) => keys.includes(f.key)).map((f) => ({
    id: f.key,
    label: f.label,
    description: f.description,
    href: f.href,
    icon: null,
    campaign: false,
    campaign_label: null,
    source: "standard" as const,
  }));
}
