import Image from "next/image";
import Link from "next/link";
import type { BlogPost } from "@/lib/supabase";

interface BlogCardProps {
  post: BlogPost;
}

export function BlogCard({ post }: BlogCardProps) {
  const date = new Date(post.published_at).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Link
      href={`/blogg/${post.slug}`}
      className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-300 hover:translate-y-[-2px] flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-light">
        {post.image_url ? (
          <Image
            src={post.image_url}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue/10 to-brand-gold/10" />
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <time className="text-xs text-text-muted mb-2">{date}</time>
        <h3 className="font-display font-bold text-lg text-text-primary mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-text-muted line-clamp-3 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <div className="mt-auto pt-4">
          <span className="text-sm text-brand-blue font-medium group-hover:translate-x-1 inline-block transition-transform">
            Läs mer &rarr;
          </span>
        </div>
      </div>
    </Link>
  );
}
