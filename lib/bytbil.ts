// Bytbil Accesspaket → hm_vehicles-mappning.
// Källa: <subdomän>.accesspaket.bytbilcms.com/wp-json/accesspackage/v1/cars (öppet REST, ingen auth).
// HM Motor: https://hmmotor.accesspaket.bytbilcms.com/...
// Designat för multi: feed-URL lagras per klient (clients.bytbil_feed_url), inte hårdkodat.

export interface BytbilImageFormat { url: string; name: string; width: number; height: number }
export interface BytbilImage { sortOrder: number; imageFormats: BytbilImageFormat[] }
export interface BytbilCar {
  id: string | number;
  title: string;
  permalink?: string;
  publishedDate?: string;
  data: {
    make?: string; model?: string; modelYear?: number; modelRaw?: string;
    vehicleType?: string; bodyType?: string;
    fuel?: string; gearBox?: string; enginePower?: number; engineSize?: number | null;
    color?: string; freetextColor?: string;
    regNo?: string; regNoHidden?: boolean;
    milage?: number | null;
    equipment?: string[];
    description?: string;
    isNew?: boolean;
    images?: BytbilImage[];
    price?: { value?: number; isLeasing?: boolean; isAuction?: boolean };
    currentPrice?: number;
  };
}

type Category = "car" | "atv" | "utv" | "moped" | "slapvagn" | "tradgard";

export interface MappedVehicle {
  client_id: string;
  bytbil_id: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  category: Category;
  image_url: string;
  gallery: string[];
  description: string;
  specs: Record<string, string>;
  price: number;
  price_label: string;
  is_sold: boolean;
  bytbil_synced_at: string;
}

function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[åä]/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Bytbils vehicleType → vår kategori-enum. Default car.
function mapCategory(vehicleType?: string, bodyType?: string): Category {
  const t = (vehicleType || "").toLowerCase();
  const b = (bodyType || "").toLowerCase();
  if (t.includes("moped") || b.includes("moped")) return "moped";
  if (t === "atv" || b.includes("atv")) return "atv";
  if (t === "utv" || b.includes("utv")) return "utv";
  if (t.includes("slap") || t.includes("trailer") || b.includes("släp") || b.includes("slap")) return "slapvagn";
  if (t.includes("tradgard") || t.includes("garden")) return "tradgard";
  return "car";
}

// Strippar HTML men behåller radbrytningar (Bytbils description är HTML med <br/>).
function htmlToText(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mainImageUrl(img: BytbilImage): string | null {
  const fmt = img.imageFormats?.find((f) => f.name === "main") || img.imageFormats?.[0];
  return fmt?.url || null;
}

export function mapCarToVehicle(car: BytbilCar, clientId: string, syncedAt: string): MappedVehicle {
  const d = car.data || {};
  const brand = d.make || "";
  const model = d.model || "";
  const bytbilId = String(car.id);

  const imgs = (d.images || [])
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map(mainImageUrl)
    .filter((u): u is string => !!u);

  // Strukturerade fält → specs (visas på kort/detaljsida). Bara ifyllda värden.
  const specs: Record<string, string> = {};
  if (d.modelYear) specs["Årsmodell"] = String(d.modelYear);
  if (typeof d.milage === "number") specs["Miltal"] = `${d.milage.toLocaleString("sv-SE")} mil`;
  if (d.fuel) specs["Bränsle"] = d.fuel;
  if (d.gearBox) specs["Växellåda"] = d.gearBox;
  if (d.enginePower) specs["Effekt"] = `${d.enginePower} hk`;
  if (d.color || d.freetextColor) specs["Färg"] = d.freetextColor || d.color || "";
  if (d.bodyType) specs["Kaross"] = d.bodyType;
  if (d.regNo && !d.regNoHidden) specs["Reg.nr"] = d.regNo;
  if (d.equipment?.length) specs["Utrustning"] = d.equipment.join(", ");

  const price = d.price?.value ?? d.currentPrice ?? 0;

  return {
    client_id: clientId,
    bytbil_id: bytbilId,
    slug: slugify(`${brand}-${model}-${bytbilId}`),
    title: car.title || `${brand} ${model}`.trim(),
    brand,
    model,
    category: mapCategory(d.vehicleType, d.bodyType),
    image_url: imgs[0] || "",
    gallery: imgs.slice(1),
    description: htmlToText(d.description),
    specs,
    price,
    price_label: d.price?.isLeasing ? "Leasing" : "",
    is_sold: false,
    bytbil_synced_at: syncedAt,
  };
}

export async function fetchBytbilCars(feedUrl: string): Promise<BytbilCar[]> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "Cockpit/1.0 (+bytbil-sync)" },
    // Bytbil-feeden är publik och ändras sällan; ingen cache i Next behövs
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bytbil-feed svarade ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : (json.cars || json.data || json.items || []);
  return arr as BytbilCar[];
}
