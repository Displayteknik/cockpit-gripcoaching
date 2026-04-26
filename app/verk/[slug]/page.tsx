import Image from "next/image";
import Link from "next/link";
import { supabase, type ArtWork } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { artworkJsonLd, jsonLdScript } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase.from("art_works").select("title, description, artist").eq("slug", slug).single();
  return {
    title: data ? `${data.title}${data.artist ? ` — ${data.artist}` : ""}` : "Verk",
    description: data?.description?.slice(0, 160) || "",
  };
}

const formatPrice = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kr";

const STATUS_LABEL: Record<string, string> = {
  for_sale: "Till salu",
  sold: "Såld",
  reserved: "Reserverad",
  exhibition_only: "Endast utställning",
  archived: "Arkiverad",
};

export default async function ArtWorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: work } = await supabase.from("art_works").select("*").eq("slug", slug).single();
  if (!work) notFound();
  const w = work as ArtWork;
  const dim = [w.width_cm, w.height_cm, w.depth_cm].filter(Boolean).join(" × ");
  const allImages = [w.image_url, ...(w.gallery || [])].filter(Boolean) as string[];

  const { data: client } = await supabase.from("clients").select("public_url, name").eq("id", w.client_id).single();
  const ld = artworkJsonLd(w, { company_name: client?.name }, { site_url: client?.public_url || "" });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(ld)} />
      <main className="min-h-screen bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <Link href="/dashboard/verk" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till verken
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-3">
              {allImages.length > 0 ? (
                allImages.map((url, i) => (
                  <div key={i} className="relative w-full bg-white rounded-sm overflow-hidden shadow-sm" style={{ aspectRatio: "4/5" }}>
                    <Image src={url} alt={w.title} fill className="object-contain" sizes="(max-width: 1024px) 100vw, 50vw" priority={i === 0} />
                  </div>
                ))
              ) : (
                <div className="aspect-[4/5] bg-stone-200 rounded-sm" />
              )}
            </div>

            <div className="lg:sticky lg:top-10">
              <div className="text-xs text-stone-500 uppercase tracking-[0.2em] mb-3">{w.artist || "Konstnär"}</div>
              <h1 className="font-display text-3xl md:text-4xl font-light text-stone-900 mb-2 leading-tight">{w.title}</h1>
              {w.year && <div className="text-sm text-stone-500 mb-8">{w.year}</div>}

              <dl className="space-y-3 text-sm border-t border-stone-200 pt-6 mb-8">
                {w.technique && <Row label="Teknik" value={w.technique} />}
                {w.medium && <Row label="Underlag" value={w.medium} />}
                {dim && <Row label="Mått" value={`${dim} cm`} />}
                <Row label="Status" value={STATUS_LABEL[w.status] || w.status} />
                {(w.tags?.length || 0) > 0 && <Row label="Taggar" value={w.tags.join(", ")} />}
              </dl>

              {w.price > 0 && w.status === "for_sale" && (
                <div className="border-t border-stone-200 pt-6 mb-8">
                  <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">Pris</div>
                  <div className="font-display text-2xl text-stone-900">{formatPrice(w.price)}</div>
                </div>
              )}
              {w.price_label && (
                <div className="border-t border-stone-200 pt-6 mb-8 text-stone-700">{w.price_label}</div>
              )}

              {w.description && (
                <div className="border-t border-stone-200 pt-6 prose prose-stone prose-sm max-w-none whitespace-pre-line text-stone-700">
                  {w.description}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <dt className="w-28 text-stone-500">{label}</dt>
      <dd className="flex-1 text-stone-900">{value}</dd>
    </div>
  );
}
