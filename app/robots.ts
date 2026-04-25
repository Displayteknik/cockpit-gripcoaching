import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sb = supabaseServer();
  const { data } = await sb.from("hm_settings").select("value").eq("key", "site_url").maybeSingle();
  const base = (data?.value || "https://hmmotor-next.vercel.app").replace(/\/$/, "");
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
