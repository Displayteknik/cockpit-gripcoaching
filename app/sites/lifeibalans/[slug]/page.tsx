import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { LibRender } from "@/components/puck-lifeibalans/Render";
import { LibHeader, LibFooter } from "@/components/puck-lifeibalans/chrome";
import { getLifeibalansClientId } from "../page";
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
  const title = page?.title ? `${page.title} — Life i Balans` : "Life i Balans";
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
  return (
    <>
      <LibHeader />
      <main>
        <LibRender data={page.data as Data} />
      </main>
      <LibFooter />
    </>
  );
}
