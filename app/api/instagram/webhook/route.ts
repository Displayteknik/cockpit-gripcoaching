import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-admin";
import { hanteraKommentar } from "@/lib/instagram/comments";
import { getIgConnection } from "@/lib/instagram";
import { safeEqual, verifieraSignatur } from "@/lib/instagram/webhook-signatur";

export const runtime = "nodejs";

// Etapp L2a — Metas webhook för Instagram. Spec: docs/plattform/LEAD-AUTOMATION.md
//
// Routen är undantagen från admin-grinden i proxy.ts eftersom Meta inte skickar någon
// cookie. Hela skyddet ligger därför i signaturkontrollen nedan. Utan den vore det här
// en öppen dörr som vem som helst kan posta påhittade kommentarer till.
//
// Två saker som gör webhookar knepiga och som hanteras här:
//   1. Meta levererar SAMMA händelse flera gånger. Idempotens via ig_events.external_id.
//   2. Meta gör om leveransen om vi svarar långsamt eller med fel. Vi svarar därför
//      alltid 200 så snart signaturen är godkänd, även när något går snett internt.

// GET — Metas verifiering vid registrering av prenumerationen.
// Svaret MÅSTE vara hub.challenge i ren text, inget JSON.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  const vantat = process.env.IG_WEBHOOK_VERIFY_TOKEN;

  if (!vantat) return new NextResponse("IG_WEBHOOK_VERIFY_TOKEN saknas", { status: 500 });
  if (mode === "subscribe" && token && challenge && safeEqual(token, vantat)) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaKommentar {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
}

export async function POST(req: NextRequest) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "IG_APP_SECRET saknas" }, { status: 500 });

  // Rå body krävs för HMAC. Läs den EN gång och parsa själv; req.json() först skulle
  // konsumera strömmen och göra signaturen omöjlig att räkna ut.
  const raw = await req.text();
  if (!verifieraSignatur(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "ogiltig signatur" }, { status: 401 });
  }

  let body: { entry?: { id?: string; changes?: { field?: string; value?: MetaKommentar }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // trasig body: kvittera, be aldrig om omleverans
  }

  // Allt arbete sker efter att signaturen godkänts, och fel sväljs: Meta ska aldrig
  // få anledning att leverera om.
  try {
    await behandla(body);
  } catch (e) {
    console.error("[ig-webhook]", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}

async function behandla(body: { entry?: { id?: string; changes?: { field?: string; value?: MetaKommentar }[] }[] }) {
  const sb = supabaseService();

  for (const entry of body.entry || []) {
    const igAccountId = entry.id;
    if (!igAccountId) continue;

    // Multi-tenant: hitta klienten via IG-kontot i nyttolasten. Aldrig hårdkoda en klient
    // och aldrig anta att det bara finns en; webhooken kan bära flera konton.
    const { data: klient } = await sb
      .from("clients")
      .select("id, slug, ig_handle")
      .eq("ig_account_id", igAccountId)
      .maybeSingle();
    if (!klient?.id) continue;

    // Token via den centrala lösaren (tenant_ig_connections krypterad först, clients-fallback).
    const conn = await getIgConnection(klient.id);
    if (!conn?.ig_access_token) continue;

    const bas = (process.env.NEXT_PUBLIC_SITE_URL || "https://cockpit.gripcoaching.se").replace(/\/$/, "");
    const uppladdningsUrl = `${bas}/skicka-bild/${klient.slug}`;

    for (const change of entry.changes || []) {
      if (change.field !== "comments") continue;
      const v = change.value || {};
      if (!v.id) continue;

      await hanteraKommentar({
        clientId: klient.id,
        kommentarId: v.id,
        mediaId: v.media?.id,
        text: v.text || "",
        username: v.from?.username,
        egenUsername: klient.ig_handle || undefined,
        token: conn.ig_access_token,
        uppladdningsUrl,
        payload: v,
      });
    }
  }
}

// Läget (dryrun eller skarpt) syns i ig_events-tabellens atgard-kolumn.
export const dynamic = "force-dynamic";
