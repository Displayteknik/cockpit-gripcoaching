// 46elks SMS-klient. Basic auth via env (aldrig i kod eller databas).
// POST https://api.46elks.com/a1/sms  (from, to, message[, dryrun=yes])
// Svar-JSON: { id, status, cost, parts, ... }. cost = heltal i 10000-delar av
// kontovalutan (5000 = 0,50 kr). Vid dryrun kommer kostnaden som estimated_cost.

const ELKS_URL = "https://api.46elks.com/a1/sms";

export function smsConfigured(): boolean {
  return !!(process.env.ELKS_API_USERNAME && process.env.ELKS_API_PASSWORD);
}

// DRYRUN är PÅ som default. Skarpt läge kräver uttryckligen SMS_DRYRUN=false.
export function smsDryrunDefault(): boolean {
  const v = (process.env.SMS_DRYRUN ?? "true").toLowerCase().trim();
  return !["false", "0", "no", "off"].includes(v);
}

// Rensar ett avsändarnamn till max 11 alfanumeriska tecken (46elks-krav).
export function sanitizeSender(raw?: string): string {
  const clean = (raw || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
  return clean || "MySales";
}

// Default-avsändare från env (kan skrivas över per utskick i UI:t).
export function smsSender(): string {
  return sanitizeSender(process.env.SMS_SENDER_NAME || "MySales");
}

export function smsTestPhone(): string {
  return (process.env.SMS_TEST_PHONE || "").trim();
}

// Konfigurerbart öre-pris för kostnadsuppskattning i förhandsgranskningen.
export function smsCostPerPart(): number {
  const n = Number(process.env.SMS_COST_PER_SMS);
  return Number.isFinite(n) && n > 0 ? n : 0.35;
}

export interface ElksResult {
  to: string;
  ok: boolean;
  dryrun: boolean;
  id?: string;
  status?: string;   // created | sent | failed | delivered
  costRaw?: number;  // 10000-delar av valutan
  costKr?: number;   // kronor (costRaw / 10000)
  parts?: number;
  error?: string;
}

// Skickar ETT sms. Kastar aldrig — fel fångas och returneras, så en trasig
// mottagare aldrig stoppar resten av en batch. dryrun=true → 46elks validerar
// numret och returnerar kostnad men skickar inget.
export async function sendSms(
  to: string,
  message: string,
  opts?: { dryrun?: boolean; from?: string }
): Promise<ElksResult> {
  const user = process.env.ELKS_API_USERNAME;
  const pass = process.env.ELKS_API_PASSWORD;
  const dryrun = opts?.dryrun ?? smsDryrunDefault();

  if (!user || !pass) {
    return { to, ok: false, dryrun, error: "46elks-nycklar saknas (ELKS_API_USERNAME/ELKS_API_PASSWORD)" };
  }

  const from = opts?.from ? sanitizeSender(opts.from) : smsSender();
  const body = new URLSearchParams({ from, to, message });
  if (dryrun) body.set("dryrun", "yes");

  try {
    const r = await fetch(ELKS_URL, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const text = await r.text();
    if (!r.ok) {
      return { to, ok: false, dryrun, error: `46elks ${r.status}: ${text.slice(0, 200)}` };
    }
    let d: Record<string, unknown> = {};
    try { d = JSON.parse(text); } catch { /* tomt/ej-JSON svar */ }
    const costRaw = (d.cost ?? d.estimated_cost) as number | undefined;
    return {
      to,
      ok: true,
      dryrun,
      id: d.id as string | undefined,
      status: d.status as string | undefined,
      costRaw,
      costKr: typeof costRaw === "number" ? costRaw / 10000 : undefined,
      parts: d.parts as number | undefined,
    };
  } catch (e) {
    return { to, ok: false, dryrun, error: (e as Error).message };
  }
}

// Skickar sekventiellt. Ett fel stoppar aldrig resten (sendSms kastar aldrig).
export async function sendMany(
  items: { to: string; message: string }[],
  opts?: { dryrun?: boolean; delayMs?: number; from?: string }
): Promise<ElksResult[]> {
  const out: ElksResult[] = [];
  for (const it of items) {
    out.push(await sendSms(it.to, it.message, { dryrun: opts?.dryrun, from: opts?.from }));
    if (opts?.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
  }
  return out;
}
