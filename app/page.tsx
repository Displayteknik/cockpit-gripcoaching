import { type Data } from "@puckeditor/core";
import { supabase } from "@/lib/supabase";
import { PuckRenderer } from "@/components/PuckRenderer";
import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";

// Default homepage data if no page is saved yet
const defaultHomepage: Data = {
  content: [
    {
      type: "Hero",
      props: {
        id: "hero-1",
        badge: "Auktoriserad CF Moto-återförsäljare",
        title: "Rätt fordon för jobb och fritid i Jämtland",
        subtitle:
          "Personlig rådgivning, inga genvägar. Vi har hjälpt kunder i Krokom med omnejd sedan 1990.",
        cta1Text: "Se fyrhjulingar",
        cta1Url: "/fordon?kategori=atv",
        cta2Text: "Begagnade bilar",
        cta2Url: "/fordon?kategori=car",
        backgroundImage: "https://www.cfmoto.co.uk/wp-content/uploads/2025/04/CFORCE-1000-MV_Action-5.webp",
        trustItems: [
          { bold: "35+", text: "års erfarenhet" },
          { bold: "14", text: "ATV-modeller i lager" },
          { bold: "Wasa Kredit", text: "finansiering" },
        ],
      },
    },
    {
      type: "QuickCategories",
      props: {
        id: "cats-1",
        items: [
          { label: "Bilar", url: "/fordon?kategori=car", icon: "car", count: "" },
          { label: "Fyrhjulingar", url: "/fordon?kategori=atv", icon: "tractor", count: "" },
          { label: "Mopeder", url: "/fordon?kategori=moped", icon: "bike", count: "" },
          { label: "Släpvagnar", url: "/fordon?kategori=slapvagn", icon: "truck", count: "" },
          { label: "Trädgård", url: "/fordon?kategori=tradgard", icon: "trees", count: "" },
        ],
      },
    },
    {
      type: "VehicleGrid",
      props: {
        id: "featured-1",
        category: "all",
        title: "Utvalda fordon",
        subtitle: "Handplockade erbjudanden just nu",
        showSearch: false,
        showFilters: false,
        filterBrands: "",
        maxItems: 6,
        featuredOnly: true,
      },
    },
    {
      type: "WhySection",
      props: {
        id: "why-1",
        title: "Mer än bara fordon",
        subtitle: "",
        points: [
          {
            title: "Personlig service",
            description: "Vi tar oss tid att förstå dina behov och hittar rätt fordon för dig.",
            icon: "heart",
          },
          {
            title: "Kvalitetsgaranti",
            description: "Alla fordon genomgår noggrann kontroll innan leverans.",
            icon: "shield",
          },
          {
            title: "Fullservice verkstad",
            description: "Service och reparation av alla märken — allt under ett tak.",
            icon: "wrench",
          },
        ],
      },
    },
    {
      type: "FAQ",
      props: {
        id: "faq-1",
        title: "Vanliga frågor",
        subtitle: "",
        items: [
          {
            question: "Vilka fyrhjulingar säljer ni?",
            answer:
              "Vi är auktoriserad CF Moto-återförsäljare och erbjuder ett brett utbud av ATV och UTV för både jobb och fritid.",
          },
          {
            question: "Kan jag provköra innan köp?",
            answer:
              "Absolut! Ring oss på 0640-103 50 så bokar vi en provkörning som passar dig.",
          },
          {
            question: "Erbjuder ni finansiering?",
            answer:
              "Ja, vi samarbetar med Wasa Kredit och kan erbjuda förmånliga avbetalningslösningar.",
          },
        ],
      },
    },
    {
      type: "CTASection",
      props: {
        id: "cta-1",
        title: "Redo att hitta ditt nästa fordon?",
        subtitle: "Kontakta oss för personlig rådgivning — vi hjälper dig hela vägen",
        showPhone: true,
        showEmail: true,
        variant: "blue",
      },
    },
  ],
  root: { props: { title: "HM Motor Krokom" } },
};

export default async function HomePage() {
  // Try to load from Supabase
  const { data: page } = await supabase
    .from("hm_pages")
    .select("*")
    .eq("slug", "index")
    .eq("is_published", true)
    .single();

  const pageData = page ? (page.data as Data) : defaultHomepage;

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
