import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { supabaseService } from "@/lib/supabase-admin";
import { sendSms, sendMany, smsConfigured, smsDryrunDefault, sanitizeSender, smsSender, smsTestPhone } from "@/lib/sms/elks";
import { renderMessage } from "@/lib/sms/message";
import { normalizePhone } from "@/lib/sms/phone";

export const runtime = "nodejs";
export const maxDuration = 60; // sekventiellt utskick kan ta tid vid många mottagare

interface InRecipient {
  name?: string;
  firstName?: string;
  e164: string;
}

// POST — testskick ELLER skarpt utskick. Endast huvudadmin. DRYRUN styrs av env
// (SMS_DRYRUN, default PÅ). Ett misslyckat nummer stoppar aldrig resten.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  if (!smsConfigured()) {
    return NextResponse.json({ error: "46elks-nycklar saknas. Sätt ELKS_API_USERNAME och ELKS_API_PASSWORD." }, { status: 400 });
  }

  let body: {
    mode?: "test" | "live";
    message?: string;
    sender?: string;
    source?: string;
    testName?: string;
    recipients?: InRecipient[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const mode = body.mode === "live" ? "live" : "test";
  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Meddelandet är tomt" }, { status: 400 });

  const from = body.sender ? sanitizeSender(body.sender) : undefined; // undefined → default från env
  const effectiveSender = from ?? smsSender();                        // faktisk avsändare (för logg + svar)
  const dryrun = smsDryrunDefault();

  // ── Testskick: ett SMS till testnumret från inställningarna ──────────────
  if (mode === "test") {
    const to = smsTestPhone();
    if (!to) return NextResponse.json({ error: "Inget testnummer satt (SMS_TEST_PHONE)" }, { status: 400 });
    const rendered = renderMessage(message, (body.testName || "Håkan").trim());
    const res = await sendSms(to, rendered, { dryrun, from });
    await logSend({ sender: effectiveSender, message, source: body.source, mode, dryrun, results: [{ ...res, name: "Test" }] });
    return NextResponse.json({ mode, dryrun, sender: effectiveSender, sample: rendered, result: res });
  }

  // ── Skarpt utskick ───────────────────────────────────────────────────────
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  if (!recipients.length) return NextResponse.json({ error: "Inga mottagare" }, { status: 400 });

  // Servern om-validerar varje nummer (försvar i djupet) och renderar per mottagare.
  const jobs: { to: string; message: string; name: string }[] = [];
  const rejected: { to: string; name: string; ok: false; error: string }[] = [];
  const seen = new Set<string>();
  for (const r of recipients) {
    const name = (r.name || "").trim();
    const { e164, valid, reason } = normalizePhone(r.e164);
    if (!valid) { rejected.push({ to: r.e164 || "", name, ok: false, error: reason || "ogiltigt nummer" }); continue; }
    if (seen.has(e164)) { rejected.push({ to: e164, name, ok: false, error: "dubblett" }); continue; }
    seen.add(e164);
    jobs.push({ to: e164, message: renderMessage(message, (r.firstName || name.split(/\s+/)[0] || "").trim()), name });
  }

  const sent = await sendMany(jobs, { dryrun, from });
  const results = [
    ...sent.map((res, i) => ({ ...res, name: jobs[i].name })),
    ...rejected.map((r) => ({ to: r.to, ok: false as const, dryrun, name: r.name, error: r.error })),
  ];

  await logSend({ sender: effectiveSender, message, source: body.source, mode, dryrun, results });

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({
    mode,
    dryrun,
    sender: effectiveSender,
    total: results.length,
    ok: okCount,
    fail: results.length - okCount,
    results,
  });
}

// Skriver en rad i sms_sends. Fel här får aldrig fälla själva utskicket.
async function logSend(args: {
  sender?: string;
  message: string;
  source?: string;
  mode: "test" | "live";
  dryrun: boolean;
  results: { to: string; ok: boolean; status?: string; error?: string; costKr?: number; name?: string }[];
}) {
  try {
    const ok = args.results.filter((r) => r.ok).length;
    const costKr = args.results.reduce((s, r) => s + (r.costKr || 0), 0);
    await supabaseService().from("sms_sends").insert({
      sender: args.sender || null,
      body: args.message,
      source: args.source || null,
      mode: args.mode,
      dryrun: args.dryrun,
      total: args.results.length,
      ok_count: ok,
      fail_count: args.results.length - ok,
      cost_kr: costKr || null,
      results: args.results,
      created_by: "owner",
    });
  } catch {
    /* loggfel ska inte fälla utskicket */
  }
}
