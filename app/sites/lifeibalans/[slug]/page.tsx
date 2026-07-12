import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { LibRender } from "@/components/puck-lifeibalans/Render";
import { LibHeader, LibFooter } from "@/components/puck-lifeibalans/chrome";
import { getLifeibalansClientId, getSiteBase } from "../page";
import { LIB_PAGES } from "@/lib/puck-lifeibalans-pages";

type Params = { params: Promise<{ slug: string }> };

async function loadPage(slug: string): Promise<{ data: Data; title?: string } | null> {
  const clientId = await getLifeibalansClientId();
  if (clientId) {
    const { data } = await supabase
      .from("hm_pages")
      .select("data,title")
      .eq("client_id", clientId)
      .eq("slug", slug)
      .eq("is_published", true)
      .single();
    if (data?.data) return { data: data.data as Data, title: data.title };
  }
  const fallback = LIB_PAGES[slug];
  if (fallback) {
    const t = (fallback.root?.props as { title?: string } | undefined)?.title;
    return { data: fallback, title: t };
  }
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  const t = page?.title || "";
  const title = !t ? "Life i Balans" : /life i balans/i.test(t) ? t : `${t} — Life i Balans`;
  return {
    metadataBase: new URL("https://cockpit.gripcoaching.se"),
    title: { absolute: title },
    alternates: { canonical: `https://lifeibalans.se/${slug}` },
    openGraph: {
      type: "website",
      locale: "sv_SE",
      siteName: "Life i Balans",
      url: `https://cockpit.gripcoaching.se/sites/lifeibalans/${slug}`,
      title,
    },
    twitter: { card: "summary_large_image", title },
  };
}

export default async function LifeibalansPage({ params }: Params) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page?.data) notFound();
  const basePath = await getSiteBase();
  return (
    <>
      <LibHeader basePath={basePath} />
      <main>
        <LibRender data={page.data as Data} basePath={basePath} />
      </main>
      <LibFooter basePath={basePath} />
    </>
  );
}
