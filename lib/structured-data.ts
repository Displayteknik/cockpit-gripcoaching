// JSON-LD structured data builders för AEO-vinst.
// Inject via <script type="application/ld+json"> på public-sidor.

interface Profile {
  company_name?: string;
  location?: string;
  founder_name?: string;
  founder_phone?: string;
  founder_email?: string;
  brand_story?: string;
  tagline?: string;
}

interface Settings {
  site_url?: string;
  site_name?: string;
}

export function localBusinessJsonLd(profile: Profile, settings: Settings) {
  const url = (settings.site_url || "").replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: profile.company_name || settings.site_name,
    description: profile.tagline || profile.brand_story?.slice(0, 200),
    url: url || undefined,
    telephone: profile.founder_phone || undefined,
    email: profile.founder_email || undefined,
    address: profile.location ? { "@type": "PostalAddress", addressLocality: profile.location, addressCountry: "SE" } : undefined,
    founder: profile.founder_name ? { "@type": "Person", name: profile.founder_name } : undefined,
  };
}

export function articleJsonLd(article: { title: string; excerpt?: string; published_at?: string; updated_at?: string; image_url?: string; slug: string }, profile: Profile, settings: Settings) {
  const url = (settings.site_url || "").replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: { "@type": "Organization", name: profile.company_name || settings.site_name },
    publisher: { "@type": "Organization", name: profile.company_name || settings.site_name },
    mainEntityOfPage: url ? `${url}/blogg/${article.slug}` : undefined,
  };
}

interface Vehicle {
  title: string;
  brand?: string;
  model?: string;
  description?: string;
  price?: number;
  image_url?: string;
  slug: string;
  category?: string;
  specs?: Record<string, string>;
}

export function vehicleJsonLd(v: Vehicle, profile: Profile, settings: Settings) {
  const url = (settings.site_url || "").replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: v.title,
    brand: v.brand ? { "@type": "Brand", name: v.brand } : undefined,
    model: v.model,
    description: v.description,
    image: v.image_url ? [v.image_url] : undefined,
    category: v.category,
    additionalProperty: v.specs ? Object.entries(v.specs).map(([n, val]) => ({ "@type": "PropertyValue", name: n, value: val })) : undefined,
    offers: v.price && v.price > 0 ? {
      "@type": "Offer",
      price: v.price,
      priceCurrency: "SEK",
      availability: "https://schema.org/InStock",
      url: url ? `${url}/fordon/${v.slug}` : undefined,
      seller: { "@type": "Organization", name: profile.company_name || settings.site_name },
    } : undefined,
  };
}

export function faqJsonLd(faq: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export function jsonLdScript(data: unknown) {
  return { __html: JSON.stringify(data, (_k, v) => v === undefined ? undefined : v) };
}
