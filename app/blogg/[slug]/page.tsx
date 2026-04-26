import { supabase } from "@/lib/supabase";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, User } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await supabase
    .from("hm_blog")
    .select("title, excerpt")
    .eq("client_id", "00000000-0000-0000-0000-000000000001")
    .eq("slug", slug)
    .single();

  return {
    title: post?.title || "Blogg",
    description: post?.excerpt || "",
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: post } = await supabase
    .from("hm_blog")
    .select("*")
    .eq("client_id", "00000000-0000-0000-0000-000000000001")
    .eq("slug", slug)
    .single();

  if (!post) notFound();

  const date = new Date(post.published_at).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <TopBar />
      <Navigation />
      <main className="flex-1">
        {/* Hero image */}
        {post.image_url && (
          <div className="relative h-64 md:h-96 bg-surface-dark">
            <Image
              src={post.image_url}
              alt={post.title}
              fill
              className="object-cover opacity-80"
              priority
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
          </div>
        )}

        <article className="max-w-[800px] mx-auto px-4 py-12 md:py-16">
          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-text-muted mb-6">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {date}
            </span>
            {post.author && (
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {post.author}
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-8 leading-tight">
            {post.title}
          </h1>

          {/* Content */}
          <div className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand-blue">
            {post.content.split("\n").map((line: string, i: number) => {
              if (line.startsWith("## "))
                return (
                  <h2 key={i} className="text-2xl mt-10 mb-4">
                    {line.replace("## ", "")}
                  </h2>
                );
              if (line.startsWith("### "))
                return (
                  <h3 key={i} className="text-xl mt-8 mb-3">
                    {line.replace("### ", "")}
                  </h3>
                );
              if (line.trim() === "") return <br key={i} />;
              return (
                <p key={i} className="mb-4 text-text-muted leading-relaxed">
                  {line}
                </p>
              );
            })}
          </div>

          {/* Back */}
          <div className="mt-12 pt-8 border-t border-gray-100">
            <Link
              href="/blogg"
              className="inline-flex items-center gap-2 text-brand-blue font-semibold hover:gap-3 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              Tillbaka till bloggen
            </Link>
          </div>
        </article>
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
