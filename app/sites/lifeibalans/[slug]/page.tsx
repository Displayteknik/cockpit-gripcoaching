import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { LibRender } from "@/components/puck-lifeibalans/Render";
import { LibHeader, LibFooter } from "@/components/puck-lifeibalans/chrome";
import { getLifeibalansClientId } from "../page";

type Params = { params: Promise<{ slug: string }> };

async function loadPage(slug: string) {
  const clientId = await getLifeibalansClientId();
  if (!clientId) return null;
  const { data } = await supabase
    .from("hm_pages")
    .select("data,title")
    .eq("client_id", clientId)
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  return data || null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  return {
    title: page?.title ? { absolute: `${page.title} — Life i Balans` } : "Life i Balans",
    alternates: { canonical: `https://lifeibalans.se/${slug}` },
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
