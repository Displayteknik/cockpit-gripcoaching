import { NextRequest, NextResponse } from "next/server";
import { auditUrlRendered, pageSpeed } from "@/lib/seo-audit";
import { supabaseServer } from "@/lib/supabase-admin";
import { resolveClientId } from "@/lib/client-context";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { assertSafePublicUrl } from "@/lib/safe-url";
import { arSidaEjLast } from "@/lib/seo-hamta";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const body = await req.json();
  const targetUrl: string = body.url;
  const skipPageSpeed: boolean = body.skip_pagespeed ?? false;
  if (!targetUrl) return NextResponse.json({ error: "url krävs" }, { status: 400 });

  // SSRF-skydd: blockera interna/privata adresser.
  try {
    await assertSafePublicUrl(targetUrl);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const clientId = await resolveClientId();

  // S-1: gick sidan inte att läsa sparas INGENTING. En rad med nollor i hm_seo_audits
  // är omöjlig att skilja från en riktig mätning i efterhand — det var så
  // "0 ord, 0 bilder, ingen title" kunde bli en kundrapport.
  let result;
  try {
    result = await auditUrlRendered(targetUrl);
  } catch (e) {
    const logg = arSidaEjLast(e) ? e.logg : null;
    return NextResponse.json(
      { error: (e as Error).message || "Sidan kunde inte läsas", hamtning: logg },
      { status: 502 },
    );
  }

  if (!skipPageSpeed) {
    const ps = await pageSpeed(targetUrl);
    result.pagespeed_mobile = ps.mobile ?? undefined;
    result.pagespeed_desktop = ps.desktop ?? undefined;
  }

  const sb = supabaseServer();
  await sb.from("hm_seo_audits").insert({
    client_id: clientId,
    url: result.url,
    title: result.title,
    meta_description: result.meta_description,
    h1: result.h1,
    word_count: result.word_count,
    has_schema: result.has_schema,
    has_faq: result.has_faq,
    has_og: result.has_og,
    internal_links: result.internal_links,
    external_links: result.external_links,
    images_total: result.images_total,
    images_no_alt: result.images_no_alt,
    pagespeed_mobile: result.pagespeed_mobile,
    pagespeed_desktop: result.pagespeed_desktop,
    seo_score: result.seo_score,
    aeo_score: result.aeo_score,
    issues: result.issues,
  });

  return NextResponse.json(result);
}

export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const sb = supabaseServer();
  const clientId = await resolveClientId();
  const { data } = await sb
    .from("hm_seo_audits")
    .select("*")
    .eq("client_id", clientId)
    .order("audited_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
