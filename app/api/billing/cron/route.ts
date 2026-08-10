import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// BETAL-1 — dygnets betaljobb. Tre saker, i den här ordningen:
//   1. månadsreset av tokens (K2 hade ingen cron — resetten skedde först när någon råkade
//      röra systemet, så en kund som inte skapade något den 1:a såg förra månadens siffror)
//   2. rulla fram passerade förfallodatum på manuella avtal
//   3. påminnelsetrappan
//
// Grindas på CRON_SECRET i routen (fail-closed) — proxy:n släpper igenom cron-vägar
// eftersom Vercel Cron inte bär någon admin-cookie. Samma mönster som övriga cron-rutter.

function auktoriserad(req: Request): boolean {
  const hemlighet = process.env.CRON_SECRET;
  if (!hemlighet) return false; // fail-closed
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${hemlighet}`;
}

export async function GET(req: Request) {
  if (!auktoriserad(req)) {
    return NextResponse.json({ error: "ej behörig" }, { status: 401 });
  }

  const [{ manadsresetAlla }, { rullaFramForfallna }, { korDunning }] = await Promise.all([
    import("@/lib/credits"),
    import("@/lib/billing/avtal"),
    import("@/lib/billing/paminnelser"),
  ]);

  // Varje steg är fail-open för sig: går ett fel ska de andra ändå köras.
  const tokens = await manadsresetAlla().catch((e) => {
    console.error("[billing-cron] månadsreset failade:", (e as Error).message);
    return 0;
  });
  const framrullade = await rullaFramForfallna().catch(() => 0);
  const dunning = await korDunning().catch((e) => {
    console.error("[billing-cron] påminnelsetrappan failade:", (e as Error).message);
    return null;
  });

  return NextResponse.json({
    ok: true,
    tokens_nollstallda: tokens,
    avtal_framrullade: framrullade,
    dunning: dunning
      ? {
          aktiv: dunning.aktiv,
          granskade: dunning.granskade,
          paminnelser: dunning.paminnelser_skickade,
          sparrade: dunning.sparrade,
          utan_mottagare: dunning.utan_mottagare,
        }
      : { fel: "kunde inte köras" },
  });
}
