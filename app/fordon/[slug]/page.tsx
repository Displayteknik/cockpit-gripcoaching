import Image from "next/image";
import Link from "next/link";
import { supabase, type Vehicle } from "@/lib/supabase";
import { formatPrice } from "@/lib/utils";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { VehicleCard } from "@/components/ui/VehicleCard";
import { notFound } from "next/navigation";
import { Phone, ArrowLeft, CreditCard, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { vehicleJsonLd, jsonLdScript } from "@/lib/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const HM = "00000000-0000-0000-0000-000000000001";
  const { data: vehicle } = await supabase
    .from("hm_vehicles")
    .select("title, description")
    .eq("client_id", HM)
    .eq("slug", slug)
    .single();

  return {
    title: vehicle?.title || "Fordon",
    description: vehicle?.description?.slice(0, 160) || "",
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const HM = "00000000-0000-0000-0000-000000000001";

  const { data: vehicle } = await supabase
    .from("hm_vehicles")
    .select("*")
    .eq("client_id", HM)
    .eq("slug", slug)
    .single();

  if (!vehicle) notFound();

  const v = vehicle as Vehicle;
  const specs = v.specs || {};

  // JSON-LD Product per fordon
  const [{ data: profile }, { data: settingsRows }] = await Promise.all([
    supabase.from("hm_brand_profile").select("company_name, location, founder_phone, founder_email").eq("client_id", HM).maybeSingle(),
    supabase.from("hm_settings").select("key, value").eq("client_id", HM),
  ]);
  const settings = Object.fromEntries((settingsRows || []).map((s) => [s.key, s.value])) as Record<string, string>;
  const productJsonLd = vehicleJsonLd(v as unknown as Parameters<typeof vehicleJsonLd>[0], profile || {}, settings);

  // Get related vehicles
  const { data: related } = await supabase
    .from("hm_vehicles")
    .select("*")
    .eq("client_id", HM)
    .eq("category", v.category)
    .neq("id", v.id)
    .eq("is_sold", false)
    .limit(3);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(productJsonLd)} />
      <TopBar />
      <Navigation />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-surface-dark py-12 md:py-20">
          <div className="max-w-[1140px] mx-auto px-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
              <Link href="/" className="hover:text-white transition-colors">
                Hem
              </Link>
              <span>/</span>
              <Link
                href={`/fordon?kategori=${v.category}`}
                className="hover:text-white transition-colors"
              >
                {v.category === "car"
                  ? "Bilar"
                  : v.category === "atv"
                  ? "Fyrhjulingar"
                  : v.category === "moped"
                  ? "Mopeder"
                  : v.category}
              </Link>
              <span>/</span>
              <span className="text-white">{v.title}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Image */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-surface-darker">
                {v.image_url ? (
                  <Image
                    src={v.image_url}
                    alt={v.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                    Ingen bild
                  </div>
                )}
                {v.badge && (
                  <span className="absolute top-4 left-4 bg-brand-gold text-white px-4 py-1.5 rounded-full text-sm font-bold">
                    {v.badge}
                  </span>
                )}
              </div>

              {/* Info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {v.brand && (
                    <span className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-xs font-medium">
                      {v.brand}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                  {v.title}
                </h1>

                {v.price > 0 && (
                  <div className="mb-6">
                    <span className="font-display text-3xl font-bold text-brand-gold">
                      {formatPrice(v.price)}
                    </span>
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex flex-wrap gap-3 mb-8">
                  <a
                    href="tel:+46640-10350"
                    className="inline-flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-light text-white px-6 py-3 rounded-lg font-semibold transition-all"
                  >
                    <Phone className="w-5 h-5" />
                    Ring för info
                  </a>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CreditCard className="w-4 h-4" />
                    <span>Finansiering via Wasa Kredit</span>
                  </div>
                </div>

                {/* Specs */}
                {Object.keys(specs).length > 0 && (
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="font-display font-semibold text-white mb-4">
                      Specifikationer
                    </h3>
                    <dl className="grid grid-cols-2 gap-3">
                      {Object.entries(specs).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-xs text-gray-500 uppercase tracking-wider">
                            {key}
                          </dt>
                          <dd className="text-sm text-white font-medium">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Description */}
        {v.description && (
          <section className="py-12 md:py-16">
            <div className="max-w-[800px] mx-auto px-4">
              <h2 className="font-display text-2xl font-bold text-text-primary mb-6">
                Om detta fordon
              </h2>
              <div className="prose prose-lg max-w-none text-text-muted whitespace-pre-line">
                {v.description}
              </div>
            </div>
          </section>
        )}

        {/* Location */}
        <section className="py-8 bg-surface-light">
          <div className="max-w-[1140px] mx-auto px-4 flex items-center justify-center gap-3 text-text-muted">
            <MapPin className="w-5 h-5 text-brand-blue" />
            <span>
              Finns hos HM Motor, Krokomsporten 13, 835 95 Krokom
            </span>
          </div>
        </section>

        {/* Related */}
        {related && related.length > 0 && (
          <section className="py-16 md:py-20">
            <div className="max-w-[1140px] mx-auto px-4">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-10">
                Liknande fordon
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(related as Vehicle[]).map((rv) => (
                  <VehicleCard key={rv.id} vehicle={rv} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Back */}
        <div className="max-w-[1140px] mx-auto px-4 pb-12">
          <Link
            href={`/fordon?kategori=${v.category}`}
            className="inline-flex items-center gap-2 text-brand-blue font-semibold hover:gap-3 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Tillbaka till sortimentet
          </Link>
        </div>
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
