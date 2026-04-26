import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { PuckRenderer } from "@/components/PuckRenderer";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Reserved slugs that should NOT match this route
const RESERVED = ["fordon", "blogg", "admin", "dashboard", "api"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (RESERVED.includes(slug)) return {};

  const { data: page } = await supabase
    .from("hm_pages")
    .select("title")
    .eq("client_id", "00000000-0000-0000-0000-000000000001")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  return {
    title: page?.title || slug,
  };
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (RESERVED.includes(slug)) {
    notFound();
  }

  const { data: page } = await supabase
    .from("hm_pages")
    .select("*")
    .eq("client_id", "00000000-0000-0000-0000-000000000001")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!page) {
    notFound();
  }

  const pageData = page.data as Data;

  return (
    <>
      <TopBar />
      <Navigation />
      <main className="flex-1">
        <PuckRenderer data={pageData} />
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
