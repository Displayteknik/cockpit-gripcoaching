"use client";

import { useState, useEffect } from "react";
import { supabase, type BlogPost } from "@/lib/supabase";
import { BlogCard } from "@/components/ui/BlogCard";

export interface BlogGridProps {
  title: string;
  subtitle: string;
  maxItems: number;
}

export function BlogGrid({ title, subtitle, maxItems = 3 }: BlogGridProps) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("hm_blog")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(maxItems);
      setPosts(data || []);
      setLoading(false);
    }
    load();
  }, [maxItems]);

  if (!loading && posts.length === 0) return null;

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-[1140px] mx-auto px-4">
        {title && (
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-3">
              {title}
            </h2>
            {subtitle && (
              <p className="text-text-muted text-lg">{subtitle}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-[16/10] bg-surface-light" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-surface-light rounded w-1/4" />
                  <div className="h-5 bg-surface-light rounded w-3/4" />
                  <div className="h-4 bg-surface-light rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
