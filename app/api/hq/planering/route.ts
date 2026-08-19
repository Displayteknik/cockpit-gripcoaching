import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminScope } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { DT_CLIENT_ID } from "@/lib/dt-client";
import { supabaseService } from "@/lib/supabase-admin";
import {
  flyttaHandelse, glomHandelse, hamtaKoppling, kalenderAuthUrl, lasCache,
  senastSynkad, skapaHandelse, synkaKalender, taBortHandelse, arLast,
} from "@/lib/hq/kalender";
import {
  flaggor, fordelning, klassa, mallForslag, nyckeltal, svenskTidpunkt, veckoSpann,
  type MallRad, type Tidstyp,
} from "@/lib/hq/planering";

export const runtime = "nodejs";

// PLAN-1 — underlaget till /dashboard/hq/planering. ENDAST huvudadmin (owner):
// det här är ägarens egen kalender. Inga AI-anrop i modulen.
// Skrivningar mot Google sker BARA från ett klick i vyn, aldrig automatiskt.

async function ownerGrind() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if ((await getAdminScope()) !== null) {
    return NextResponse.json({ error: "Endast huvudadmin har åtkomst" }, { status: 403 });
  }
  // Läckage-fix 19/8: se app/api/hq/route.ts — samma DT-spärr här.
  if ((await getActiveClientId()) !== DT_CLIENT_ID) {
    return NextResponse.json({ error: "Planering visas bara när Displayteknik är aktiv klient." }, { status: 403 });
  }
  return null;
}

const TZ = "Europe/Stockholm";
const idagSvenskt = () => new Date().toLocaleDateString("sv-SE", { timeZone: TZ });

async function laddaTyper(): Promise<{ tidstyper: Tidstyp[]; overrides: Record<string, string>; mall: MallRad[] }> {
  const sb = supabaseService();
  const [{ data: typer }, { data: ov }, { data: mall }] = await Promise.all([
    sb.from("hq_tidstyper").select("*").order("sortering"),
    sb.from("hq_handelse_typ").select("google_event_id, tidstyp_id"),
    sb.from("hq_mallvecka").select("*").order("veckodag").order("starttid"),
  ]);
  const overrides: Record<string, string> = {};
  for (const r of ((ov as Array<{ google_event_id: string; tidstyp_id: string }> | null) || [])) {
    overrides[r.google_event_id] = r.tidstyp_id;
  }
  return {
    tidstyper: ((typer as Tidstyp[] | null) || []).map((t) => ({ ...t, nyckelord: t.nyckelord || [] })),
    overrides,
    mall: (mall as MallRad[] | null) || [],
  };
}

/** Sammanställer en vecka ur spegeln. Rör aldrig Google. */
async function byggVecka(datum: string, typer: Awaited<ReturnType<typeof laddaTyper>>) {
  const v = veckoSpann(datum);
  const fran = new Date(`${v.dagar[0]}T00:00:00Z`);
  const till = new Date(`${v.dagar[6]}T23:59:59Z`);
  const handelser = klassa(await lasCache(fran, till), typer.overrides, typer.tidstyper);
  const kt = nyckeltal(handelser);
  const mallHarInlagg = typer.mall.some(
    (m) => m.aktiv && typer.tidstyper.find((t) => t.id === m.tidstyp_id)?.namn === "Inlägg",
  );
  return {
    vecka: v,
    handelser: handelser
      .map((h) => ({ ...h, last: arLast(h) }))
      .sort((a, b) => a.datum.localeCompare(b.datum) || a.startMinut - b.startMinut),
    fordelning: fordelning(handelser, typer.tidstyper),
    nyckeltal: kt,
    flaggor: flaggor(handelser, kt, mallHarInlagg),
  };
}

export async function GET(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const koppling = await hamtaKoppling();
  const valdDag = req.nextUrl.searchParams.get("vecka") || idagSvenskt();
  const v = veckoSpann(valdDag);
  const nastaV = veckoSpann(new Date(`${v.dagar[6]}T12:00:00Z`).toISOString().slice(0, 10) === v.dagar[6]
    ? new Date(new Date(`${v.dagar[6]}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10)
    : v.dagar[6]);

  // Inte kopplad än: vyn ska säga det rakt ut och erbjuda knappen, inte visa en tom vecka
  // som såg ut att vara sann.
  //
  // ⚠ Svaret bär ÄNDÅ hela formen, med tomma listor och nollställda tal. Ett svar som
  // saknade fält kraschade sidan: `data.handelser.filter(...)` kastade innan något ens
  // hann renderas, och felet syntes som att sidan inte gick att öppna trots att servern
  // svarade 200. En delmängd av formen är farligare än tom data.
  if (!koppling) {
    return NextResponse.json({
      kopplad: false,
      authUrl: kalenderAuthUrl(req.nextUrl.origin),
      idag: idagSvenskt(),
      vecka: v,
      handelser: [],
      fordelning: [],
      nyckeltal: { bokadeTimmar: 0, timmarWhiteSpace: 0, antalMoten: 0, lifestyle: null, arbetstimmar: 0 },
      flaggor: [],
      tidstyper: [],
      mall: [],
      mallForslag: [],
      uppgifter: [],
      synk: { senastSynkad: null, ok: true, fel: null },
    });
  }

  // Synk vid sidladdning, högst var femte minut. Två veckor i taget, så överblicken för
  // nästa vecka bygger på riktig data i stället för en tom spegel.
  const tvinga = req.nextUrl.searchParams.get("uppdatera") === "1";
  const synk = await synkaKalender(
    new Date(`${v.dagar[0]}T00:00:00Z`),
    new Date(`${nastaV.dagar[6]}T23:59:59Z`),
    tvinga,
  );

  const typer = await laddaTyper();
  const [denna, nasta, synkadTid] = await Promise.all([
    byggVecka(valdDag, typer),
    byggVecka(nastaV.dagar[0], typer),
    senastSynkad(),
  ]);

  return NextResponse.json({
    kopplad: true,
    epost: koppling.email,
    idag: idagSvenskt(),
    ...denna,
    nastaVecka: { vecka: nasta.vecka, fordelning: nasta.fordelning, nyckeltal: nasta.nyckeltal, flaggor: nasta.flaggor },
    tidstyper: typer.tidstyper,
    mall: typer.mall,
    mallForslag: mallForslag(typer.mall, denna.handelser, denna.vecka),
    uppgifter: await oppnaUppgifter(),
    synk: { senastSynkad: synkadTid, ok: synk.ok, fel: synk.fel || null, lank: synk.lank || null, lankText: synk.lankText || null },
  });
}

/** Öppna HQ-uppgifter, för att kunna dras in i kalendern som ett tidsatt block. */
async function oppnaUppgifter() {
  const { data } = await supabaseService()
    .from("hq_tasks")
    .select("id, titel, bolag, datum")
    .eq("klar", false)
    .order("datum", { nullsFirst: false });
  return (data as Array<{ id: string; titel: string; bolag: string; datum: string | null }> | null) || [];
}

/** Efter varje egen skrivning speglas veckan om direkt, annars visar vyn gammal sanning. */
async function synkaOm(datum: string) {
  const v = veckoSpann(datum);
  await synkaKalender(new Date(`${v.dagar[0]}T00:00:00Z`), new Date(`${v.dagar[6]}T23:59:59Z`), true);
}

// POST — skapa händelse, lägg ut mallveckan, eller tidsätt en HQ-uppgift.
export async function POST(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  // ── Ny händelse (dubbelklick på tom yta, eller en uppgift som dras in) ──
  if (b.typ === "handelse" || b.typ === "uppgift") {
    const datum = String(b.datum || "").slice(0, 10);
    const start = String(b.start || "");
    const slut = String(b.slut || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(slut)) {
      return NextResponse.json({ error: "Datum och tider behövs" }, { status: 400 });
    }
    const s = svenskTidpunkt(datum, start);
    const e = svenskTidpunkt(datum, slut);
    if (e <= s) return NextResponse.json({ error: "Sluttiden måste ligga efter starttiden" }, { status: 400 });

    let titel = String(b.titel || "").trim().slice(0, 200);
    let uppgiftsId = "";
    if (b.typ === "uppgift") {
      uppgiftsId = String(b.uppgiftId || "");
      const { data } = await supabaseService().from("hq_tasks").select("titel").eq("id", uppgiftsId).maybeSingle();
      const t = (data as { titel: string } | null)?.titel;
      if (!t) return NextResponse.json({ error: "Uppgiften finns inte" }, { status: 400 });
      titel = t;
    }
    if (!titel) return NextResponse.json({ error: "Skriv vad händelsen gäller" }, { status: 400 });

    const r = await skapaHandelse(titel, s, e, b.typ === "uppgift" ? "Skapad ur HQ-uppgift." : undefined);
    if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 502 });

    if (b.tidstypId) await sattTidstyp(String(r.id), String(b.tidstypId));
    await synkaOm(datum);
    return NextResponse.json({ ok: true, id: r.id });
  }

  // ── Mallveckan ──────────────────────────────────────────────────────────
  // Utan bekräftelse returneras BARA förhandsgranskningen. Ingenting skapas.
  if (b.typ === "mallvecka") {
    const datum = String(b.vecka || idagSvenskt()).slice(0, 10);
    const typer = await laddaTyper();
    const denna = await byggVecka(datum, typer);
    const forslag = mallForslag(typer.mall, denna.handelser, denna.vecka);

    if (!b.bekrafta) return NextResponse.json({ forhandsgranskning: forslag });

    const skapade: string[] = [];
    const misslyckade: { titel: string; fel: string }[] = [];
    for (const f of forslag) {
      if (f.finnsRedan) continue; // aldrig en dubblett
      const mallrad = typer.mall.find((m) => m.id === f.mallId);
      const r = await skapaHandelse(f.titel, svenskTidpunkt(f.datum, f.start), svenskTidpunkt(f.datum, f.slut));
      if (!r.ok) { misslyckade.push({ titel: f.titel, fel: r.fel || "okänt fel" }); continue; }
      if (mallrad?.tidstyp_id && r.id) await sattTidstyp(r.id, mallrad.tidstyp_id);
      skapade.push(f.titel);
    }
    await synkaOm(datum);
    return NextResponse.json({
      ok: misslyckade.length === 0,
      skapade,
      hoppadeOver: forslag.filter((f) => f.finnsRedan).map((f) => f.titel),
      misslyckade,
    });
  }

  return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
}

async function sattTidstyp(eventId: string, tidstypId: string) {
  await supabaseService().from("hq_handelse_typ").upsert(
    { google_event_id: eventId, tidstyp_id: tidstypId, uppdaterad: new Date().toISOString() },
    { onConflict: "google_event_id" },
  );
}

// PATCH — flytta, ändra längd, eller sätt tidstyp. Inget annat får ändras.
export async function PATCH(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "Händelsen saknas" }, { status: 400 });

  // Tidstyp är vårt eget fält, inget skrivs till Google.
  if (b.tidstypId !== undefined) {
    const tid = String(b.tidstypId || "");
    const sb = supabaseService();
    if (!tid) await sb.from("hq_handelse_typ").delete().eq("google_event_id", id);
    else await sattTidstyp(id, tid);
    return NextResponse.json({ ok: true });
  }

  // Flytt eller längdändring. Båda är samma skrivning: ny start och nytt slut.
  const datum = String(b.datum || "").slice(0, 10);
  const start = String(b.start || "");
  const slut = String(b.slut || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(slut)) {
    return NextResponse.json({ error: "Datum och tider behövs" }, { status: 400 });
  }
  const s = svenskTidpunkt(datum, start);
  const e = svenskTidpunkt(datum, slut);
  if (e <= s) return NextResponse.json({ error: "Sluttiden måste ligga efter starttiden" }, { status: 400 });

  // ⚠ Låsta händelser stoppas här, inte bara i UI:t. En heldag har ingen tidsaxel att
  // flyttas på, och en händelse Google skapat ur ett mejl går inte att ändra via API:t.
  const { data } = await supabaseService()
    .from("hq_kalender_cache").select("event_type, heldag").eq("google_event_id", id).maybeSingle();
  const rad = data as { event_type: string | null; heldag: boolean } | null;
  if (rad && arLast(rad)) {
    return NextResponse.json({ error: "Den här händelsen går inte att flytta härifrån. Öppna den i Google Kalender." }, { status: 400 });
  }

  const r = await flyttaHandelse(id, s, e);
  if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 502 });
  await synkaOm(datum);
  return NextResponse.json({ ok: true });
}

// DELETE — ta bort en händelse. Bekräftas i vyn innan anropet görs.
export async function DELETE(req: NextRequest) {
  const denied = await ownerGrind();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Händelsen saknas" }, { status: 400 });

  const r = await taBortHandelse(id);
  if (!r.ok) return NextResponse.json({ error: r.fel }, { status: 502 });
  await glomHandelse(id);
  return NextResponse.json({ ok: true });
}
