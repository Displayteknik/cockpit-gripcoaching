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
        subtitle: "Handplockat ur vårt sortiment. Alla kontrollerade innan försäljning.",
        showSearch: false,
        showFilters: false,
        filterBrands: "",
        maxItems: 6,
        featuredOnly: true,
      },
    },
    {
      type: "JustNuCards",
      props: {
        id: "justnu-1",
        title: "",
        cards: [
          {
            label: "Nyheter",
            title: "Nya CFORCE 625 finns nu i lager",
            text: "Helt ny modell med 580cc motor, förbättrad fjädring och EPS som standard. Kom och provkör!",
            linkUrl: "/fordon?kategori=atv",
            linkText: "Läs mer",
          },
          {
            label: "Erbjudande",
            title: "Finansiering från 0% ränta",
            text: "Just nu erbjuder vi räntefri finansiering på utvalda fyrhjulingar via Wasa Kredit.",
            linkUrl: "tel:+46703218232",
            linkText: "Ring Håkan för detaljer",
          },
          {
            label: "Säsong",
            title: "Snöslungor & vinterutrustning",
            text: "AL-KO snöslungor från 9 990 kr. Gör dig redo för vintern — vi har lager.",
            linkUrl: "/fordon?kategori=tradgard",
            linkText: "Se trädgårdsutrustning",
          },
        ],
      },
    },
    {
      type: "TradeInStrip",
      props: {
        id: "tradein-1",
        text: "Vi tar inbyten på alla märken",
        ctaText: "Ring Håkan för kostnadsfri värdering",
        ctaUrl: "tel:+46703218232",
      },
    },
    {
      type: "WhySection",
      props: {
        id: "why-1",
        title: "Mer än bara en bilhandlare",
        subtitle: "HM Motor är din kompletta partner för fordon och maskiner i Jämtland.",
        points: [
          {
            title: "Alltid Håkan du möter",
            description: "Ingen telefonväxel, inga mellanhänder. Direkt kontakt från första samtal till nyckelöverlämning.",
            icon: "heart",
          },
          {
            title: "Ärliga affärer sedan 1990",
            description: "Inga dolda kostnader, rak kommunikation. Du vet vad du får och vad det kostar.",
            icon: "shield",
          },
          {
            title: "Förankrade i Krokom",
            description: "Vi stöttar lokala föreningar och sponsrar idrott. Det är här vi bor, jobbar och lever.",
            icon: "wrench",
          },
        ],
      },
    },
    {
      type: "Spotlight",
      props: {
        id: "spotlight-1",
        title: "Auktoriserad CF Moto-återförsäljare i Jämtland",
        subtitle: "Vi är stolta att representera CF Moto — Europas mest sålda ATV-märke. Alla modeller finns att provköra hos oss i Krokom.",
        ctaText: "Se alla modeller",
        ctaUrl: "/fordon?kategori=atv",
        backgroundImage: "https://www.cfmoto.co.uk/wp-content/uploads/2025/04/2025-cforce-625-basic-green-large.webp",
        tags: "CF Moto,KAYO,Från 11 900 kr till 199 900 kr",
      },
    },
    {
      type: "PartnerLogos",
      props: {
        id: "partners-1",
        title: "Varumärken & partners vi jobbar med",
        logos: [
          { name: "CF Moto", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/cfmoto-logotyp.png", url: "/fordon?kategori=atv" },
          { name: "KAYO", imageUrl: "", url: "/fordon?kategori=atv" },
          { name: "Super Soco", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/SOCO-Logo_1-1024x902.jpg", url: "/fordon?kategori=moped" },
          { name: "Respo", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/respo-slapvagnar.png", url: "/fordon?kategori=slapvagn" },
          { name: "AL-KO", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/al-ko-logo.png", url: "/fordon?kategori=tradgard" },
          { name: "Wasa Kredit", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/wasa_kredit_logo.png", url: "#" },
          { name: "Ecster", imageUrl: "https://hmmotor.se/wp-content/uploads/2020/09/ecster_logo_neg.png", url: "#" },
        ],
      },
    },
    {
      type: "BlogGrid",
      props: {
        id: "blog-1",
        title: "Från garaget",
        subtitle: "Tips, nyheter och historier från HM Motor.",
        maxItems: 3,
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
            answer: "Vi är auktoriserad CF Moto- och KAYO-återförsäljare med modeller från 11 900 kr (KAYO AT70) till 199 900 kr (UFORCE 1000). Alla modeller finns att provköra i Krokom.",
          },
          {
            question: "Erbjuder ni finansiering?",
            answer: "Ja. Vi samarbetar med Wasa Kredit och Ecster och hjälper dig hitta en lösning som passar — oavsett om du köper bil, fyrhjuling eller moped.",
          },
          {
            question: "Kan jag byta in min gamla bil?",
            answer: "Absolut. Ring Håkan på 070-321 82 32 för en kostnadsfri värdering av ditt fordon. Vi tar emot alla märken.",
          },
          {
            question: "Var ligger ni?",
            answer: "Krokomsporten 13, 835 32 Krokom. Mitt i Jämtlands handelscentrum med gott om parkering. Öppet mån–tor 08–17, fre 08–16.",
          },
          {
            question: "Vilka märken har ni?",
            answer: "CF Moto och KAYO (fyrhjulingar), Super Soco, MOTOCR och TWS (mopeder/elcyklar), Respo (släpvagnar) och AL-KO (gräsklippare, snöslungor).",
          },
        ],
      },
    },
    {
      type: "CTASection",
      props: {
        id: "cta-1",
        title: "Redo att hitta ditt nästa fordon?",
        subtitle: "Ring Håkan direkt eller kom förbi Krokomsporten. Vi finns här för dig.",
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
