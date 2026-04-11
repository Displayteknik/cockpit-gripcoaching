"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { PageHeader } from "@/components/puck/PageHeader";
import { VehicleGrid } from "@/components/puck/VehicleGrid";
import { CTASection } from "@/components/puck/CTASection";

const categoryLabels: Record<string, { title: string; subtitle: string }> = {
  car: { title: "Begagnade bilar", subtitle: "Kvalitetskontrollerade bilar i Krokom" },
  atv: { title: "Fyrhjulingar & UTV", subtitle: "CF Moto, KAYO och fler — för jobb och fritid" },
  moped: { title: "Mopeder & elmopeder", subtitle: "Perfekt för vardagen" },
  slapvagn: { title: "Släpvagnar", subtitle: "Robusta släpvagnar för alla behov" },
  tradgard: { title: "Trädgårdsmaskiner", subtitle: "Gräsklippare, snöslungor och mer" },
  all: { title: "Alla fordon", subtitle: "Hela vårt sortiment på ett ställe" },
};

function FordonContent() {
  const searchParams = useSearchParams();
  const kategori = searchParams.get("kategori") || "all";
  const info = categoryLabels[kategori] || categoryLabels.all;

  const filterBrands =
    kategori === "atv" ? "CF Moto,KAYO" : kategori === "car" ? "" : "";

  const category = kategori === "atv" ? "atv,utv" : kategori;

  return (
    <>
      <PageHeader title={info.title} subtitle={info.subtitle} variant="dark" />
      <VehicleGrid
        category={category}
        title=""
        subtitle=""
        showSearch={true}
        showFilters={!!filterBrands}
        filterBrands={filterBrands}
        maxItems={100}
        featuredOnly={false}
      />
      <CTASection
        title="Hittar du inte rätt?"
        subtitle="Ring oss så hjälper vi dig"
        showPhone={true}
        showEmail={true}
        variant="blue"
      />
    </>
  );
}

export default function FordonPage() {
  return (
    <>
      <TopBar />
      <Navigation />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="py-20 text-center text-text-muted">
              Laddar fordon...
            </div>
          }
        >
          <FordonContent />
        </Suspense>
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
