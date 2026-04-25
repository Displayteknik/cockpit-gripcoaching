import { NextRequest, NextResponse } from "next/server";
import { auditUrl, pageSpeed } from "@/lib/seo-audit";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const targetUrl: string = body.url;
  const skipPageSpeed: boolean = body.skip_pagespeed ?? false;
  if (!targetUrl) return NextResponse.json({ error: "url krävs" }, { status: 400 });

  const result = await auditUrl(targetUrl, targetUrl);
  if (!skipPageSpeed) {
    const ps = await pageSpeed(targetUrl);
    result.pagespeed_mobile = ps.mobile ?? undefined;
    result.pagespeed_desktop = ps.desktop ?? undefined;
  }

  const sb = supabaseServer();
  await sb.from("hm_seo_audits").insert({
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
  const sb = supabaseServer();
  const { data } = await sb
    .from("hm_seo_audits")
    .select("*")
    .order("audited_at", { ascending: false })
    .limit(50);
  return NextResponse.json(data || []);
}
