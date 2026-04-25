import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = supabaseServer();
  const [{ data: settings }, { data: vehicles }, { data: blog }, { data: pages }] = await Promise.all([
    sb.from("hm_settings").select("*").eq("key", "site_url").maybeSingle(),
    sb.from("hm_vehicles").select("slug, updated_at").eq("is_sold", false),
    sb.from("hm_blog").select("slug, published_at").eq("published", true),
    sb.from("hm_pages").select("slug, updated_at").eq("is_published", true),
  ]);

  const base = (settings?.value || "https://hmmotor-next.vercel.app").replace(/\/$/, "");
  const now = new Date();

  const staticRoutes = ["", "/fordon", "/blogg", "/kontakt", "/om-oss"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1.0 : 0.8,
  }));

  const vehicleRoutes = (vehicles || []).map((v) => ({
    url: `${base}/fordon/${v.slug}`,
    lastModified: v.updated_at ? new Date(v.updated_at) : now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const blogRoutes = (blog || []).map((b) => ({
    url: `${base}/blogg/${b.slug}`,
    lastModified: b.published_at ? new Date(b.published_at) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const pageRoutes = (pages || [])
    .filter((p) => !["index", "home", "/"].includes(p.slug))
    .map((p) => ({
      url: `${base}/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...staticRoutes, ...vehicleRoutes, ...blogRoutes, ...pageRoutes];
}
