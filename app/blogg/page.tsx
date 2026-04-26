import { supabase, type BlogPost } from "@/lib/supabase";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { PageHeader } from "@/components/puck/PageHeader";
import { BlogCard } from "@/components/ui/BlogCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blogg",
  description: "Tips, nyheter och historier från HM Motor i Krokom.",
};

export default async function BlogPage() {
  const { data: posts } = await supabase
    .from("hm_blog")
    .select("*")
    .eq("client_id", "00000000-0000-0000-0000-000000000001")
    .eq("published", true)
    .order("published_at", { ascending: false });

  return (
    <>
      <TopBar />
      <Navigation />
      <main className="flex-1">
        <PageHeader
          title="Blogg"
          subtitle="Tips, nyheter och historier från HM Motor"
          variant="light"
        />
        <section className="py-12 md:py-16">
          <div className="max-w-[1140px] mx-auto px-4">
            {posts && posts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(posts as BlogPost[]).map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <p className="text-center text-text-muted py-12">
                Inga blogginlägg publicerade ännu.
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
