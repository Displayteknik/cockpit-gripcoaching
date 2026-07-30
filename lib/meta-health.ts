// ANSLUT-3 — tokenhälsovakt. Kör debug_token + ett billigt läsanrop per tenant (och för
// ägar-token). Sätter status OK / warning / dead, loggar i token_health_checks, uppdaterar
// tenant_ig_connections och mejlar vid STATUSÖVERGÅNG till warning/dead (ingen spam).
//
// Läser aldrig ut token till svar/logg. Fel per tenant isoleras — en trasig tenant stoppar
// aldrig svepet.

import { supabaseService } from "./supabase-admin";
import { getIgConnection } from "./instagram";
import { getOwnerToken } from "./meta-owner";
import { debugToken, getIgUsername } from "./meta-oauth";
import { notifyTokenHealth } from "./meta-health-notify";

export type HealthStatus = "ok" | "warning" | "dead";
const WARN_DAYS = 7;

interface CheckResult { clientId: string | null; scope: "owner" | "page"; status: HealthStatus; detail: string }

// dbgValid: true = giltig, false = definitivt ogiltig, null = okänt (debug_token svarade inte).
// readOk = det billiga läsanropet lyckades. Läsanropet är det AUKTORITATIVA livstecknet: ett
// transient debug_token-fel (null) med lyckad läsning räknas som OK, aldrig som falskt "död".
function statusFromToken(dbgValid: boolean | null, expiresAt: number | undefined, readOk: boolean): { status: HealthStatus; detail: string } {
  if (dbgValid === false) return { status: "dead", detail: "debug_token: is_valid=false" };
  if (!readOk) return { status: "dead", detail: "läsanrop mot Graph misslyckades" };
  if (dbgValid === true && expiresAt && expiresAt > 0) {
    const daysLeft = (expiresAt * 1000 - Date.now()) / 86_400_000;
    if (daysLeft < WARN_DAYS) return { status: "warning", detail: `token går ut om ${Math.max(0, Math.round(daysLeft))} dgr` };
  }
  return { status: "ok", detail: "ok" };
}

async function prevStatus(sb: ReturnType<typeof supabaseService>, clientId: string | null, scope: string): Promise<HealthStatus | null> {
  let q = sb.from("token_health_checks").select("status").eq("scope", scope).order("checked_at", { ascending: false }).limit(1);
  q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
  const { data } = await q.maybeSingle();
  return (data?.status as HealthStatus) || null;
}

async function record(
  sb: ReturnType<typeof supabaseService>,
  r: CheckResult,
  clientName: string,
): Promise<void> {
  const prev = await prevStatus(sb, r.clientId, r.scope);
  await sb.from("token_health_checks").insert({ client_id: r.clientId, scope: r.scope, status: r.status, detail: r.detail });

  if (r.scope === "page" && r.clientId) {
    await sb.from("tenant_ig_connections").update({
      status: r.status,
      last_checked_at: new Date().toISOString(),
      last_error: r.status === "ok" ? null : r.detail,
    }).eq("client_id", r.clientId);
  } else if (r.scope === "owner") {
    await sb.from("meta_owner_connection").update({
      status: r.status,
      last_checked_at: new Date().toISOString(),
      last_error: r.status === "ok" ? null : r.detail,
    }).not("id", "is", null);
  }

  // Mejla bara vid övergång till warning/dead (och inte om det var samma redan).
  if ((r.status === "warning" || r.status === "dead") && prev !== r.status) {
    await notifyTokenHealth({ clientId: r.clientId, clientName, scope: r.scope, status: r.status, reason: r.detail });
  }
}

export interface HealthSweepSummary { checked: number; ok: number; warning: number; dead: number }

// dryrun = kör alla kontroller men UTAN sidoeffekter (inga DB-skrivningar, inga mail).
// Används för att verifiera en nyss satt IG_APP_SECRET utan att riskera falsklarm.
export async function runHealthChecks(dryrun = false): Promise<HealthSweepSummary> {
  const sb = supabaseService();
  const summary: HealthSweepSummary = { checked: 0, ok: 0, warning: 0, dead: 0 };

  // Utan app-secret kan INGEN token verifieras (debug_token + appsecret_proof kräver den).
  // Hoppa hela svepet hellre än att markera allt som "död" och spamma falska larm till kunder.
  if (!process.env.IG_APP_SECRET) return summary;

  // Namn-uppslag.
  const { data: clientsData } = await sb.from("clients").select("id, name");
  const nameOf = new Map<string, string>((clientsData || []).map((c) => [c.id, c.name || "Kund"]));

  // 1. Ägar-token.
  try {
    const ownerToken = await getOwnerToken();
    let res: CheckResult;
    if (!ownerToken) {
      res = { clientId: null, scope: "owner", status: "dead", detail: "ingen ägar-token sparad" };
    } else {
      const dbg = await debugToken(ownerToken);
      res = { clientId: null, scope: "owner", ...statusFromToken(!!dbg.is_valid, dbg.expires_at, true) };
    }
    // Räkna bara om ägar-koppling finns (annars är "ingen token" väntat, inte ett larm).
    const { data: ownerRow } = await sb.from("meta_owner_connection").select("id").limit(1).maybeSingle();
    if (ownerRow) { if (!dryrun) await record(sb, res, "Ägar-konto (Meta)"); summary.checked++; summary[res.status]++; }
  } catch { /* isolera ägar-fel */ }

  // 2. Per-tenant. tenant_ig_connections + legacy clients (ig_account_id utan tenant-rad).
  const targets = new Map<string, string>(); // clientId → igId
  const { data: tenantRows } = await sb.from("tenant_ig_connections").select("client_id, ig_business_account_id");
  for (const t of tenantRows || []) if (t.ig_business_account_id) targets.set(t.client_id, t.ig_business_account_id);
  const { data: legacy } = await sb.from("clients").select("id, ig_account_id").not("ig_account_id", "is", null);
  for (const c of legacy || []) if (!targets.has(c.id) && c.ig_account_id) targets.set(c.id, c.ig_account_id);

  for (const [clientId, igId] of targets) {
    try {
      const conn = await getIgConnection(clientId);
      let res: CheckResult;
      if (!conn?.ig_access_token) {
        res = { clientId, scope: "page", status: "dead", detail: "ingen token kunde läsas" };
      } else {
        let dbgValid: boolean | null = null;
        let expiresAt: number | undefined;
        let readOk = false;
        try { const dbg = await debugToken(conn.ig_access_token); dbgValid = !!dbg.is_valid; expiresAt = dbg.expires_at; } catch { dbgValid = null; }
        try { await getIgUsername(igId, conn.ig_access_token); readOk = true; } catch { readOk = false; }
        res = { clientId, scope: "page", ...statusFromToken(dbgValid, expiresAt, readOk) };
      }
      if (!dryrun) await record(sb, res, nameOf.get(clientId) || "Kund");
      summary.checked++; summary[res.status]++;
    } catch { /* isolera tenant-fel, fortsätt svepet */ }
  }

  return summary;
}
