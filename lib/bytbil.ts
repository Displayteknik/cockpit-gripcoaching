// Bytbil Accesspaket → hm_vehicles-mappning.
// Källa: <subdomän>.accesspaket.bytbilcms.com/wp-json/accesspackage/v1/cars (öppet REST, ingen auth).
// HM Motor: https://hmmotor.accesspaket.bytbilcms.com/...
// Designat för multi: feed-URL lagras per klient (clients.bytbil_feed_url), inte hårdkodat.

import { supabaseServer } from "./supabase-admin";
import { logActivity } from "./client-context";

// Bytbil-feed per klient. v1: HM Motor. Multi: flytta till clients.bytbil_feed_url.
export const BYTBIL_FEEDS: Record<string, string> = {
  "00000000-0000-0000-0000-000000000001":
    "https://hmmotor.accesspaket.bytbilcms.com/wp-json/accesspackage/v1/cars",
};

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

// Bytbil-synkade rader får slug som slutar på "-<bytbil-id>" (minst 7 siffror).
// Allt annat = manuellt inlagt och rörs ALDRIG av synken.
const bytbilIdOf = (slug: string): string | null => slug.match(/-(\d{7,})$/)?.[1] || null;

export interface SyncResult {
  ok: boolean;
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  soldMarked: number;
  legacyHidden: number;
  legacyManualCount: number;
  syncedAt: string;
  errors?: string[];
}

// Kärn-synk: körs av både admin-knappen (med cookie/aktiv klient) och cron-rutten (per client_id).
// EDIT-BEVARANDE: befintlig Bytbil-bil uppdaterar bara pris; utvald/bilder/text/rubrik består.
// Manuellt inlagda rader (slug utan id-suffix) rörs aldrig.
export async function syncBytbilForClient(
  clientId: string,
  feedUrl: string,
  opts?: { dryRun?: boolean; hideLegacyManual?: boolean }
): Promise<SyncResult> {
  const dryRun = !!opts?.dryRun;
  const hideLegacyManual = !!opts?.hideLegacyManual;
  const syncedAt = new Date().toISOString();
  const sb = supabaseServer();

  const cars = await fetchBytbilCars(feedUrl);
  const mapped = cars.map((c, i) => ({ ...mapCarToVehicle(c, clientId, syncedAt), sort_order: i }));
  const feedIds = new Set(mapped.map((m) => m.bytbil_id));

  const { data: existing } = await sb
    .from("hm_vehicles")
    .select("id, slug, is_sold, title, price")
    .eq("client_id", clientId);

  const existingById = new Map<string, { id: string; slug: string; is_sold: boolean; title: string; price: number }>();
  let legacyManualCount = 0;
  for (const v of existing || []) {
    const bid = bytbilIdOf(v.slug);
    if (bid) existingById.set(bid, v);
    else if (!v.is_sold) legacyManualCount++;
  }

  let created = 0, updated = 0, soldMarked = 0, legacyHidden = 0;
  const errors: string[] = [];

  for (const m of mapped) {
    const ex = existingById.get(m.bytbil_id);
    if (dryRun) { ex ? updated++ : created++; continue; }
    if (ex) {
      const { error } = await sb.from("hm_vehicles").update({ price: m.price }).eq("id", ex.id);
      error ? errors.push(`${m.slug}: ${error.message}`) : updated++;
    } else {
      const row = {
        client_id: m.client_id, slug: m.slug, title: m.title, brand: m.brand, model: m.model,
        category: m.category, image_url: m.image_url, gallery: m.gallery, description: m.description,
        specs: m.specs, price: m.price, price_label: m.price_label, is_sold: false, sort_order: m.sort_order,
      };
      const { error } = await sb.from("hm_vehicles").insert(row);
      error ? errors.push(`${m.slug}: ${error.message}`) : created++;
    }
  }

  if (!dryRun) {
    // Bytbil-bil som lämnat feeden = såld/borttagen på Bytbil → dölj + logga sälj.
    for (const [bid, v] of existingById) {
      if (!feedIds.has(bid) && !v.is_sold) {
        const { error } = await sb.from("hm_vehicles").update({ is_sold: true }).eq("id", v.id);
        if (!error) {
          soldMarked++;
          await logActivity(clientId, "vehicle_sold", v.title || "Fordon", "/dashboard/fordon", {
            price: v.price ?? null,
            via: "bytbil",
          });
        }
      }
    }
    // Engångs: dölj gamla manuella dubbletter (bara när användaren godkänt det).
    if (hideLegacyManual) {
      for (const v of existing || []) {
        if (!bytbilIdOf(v.slug) && !v.is_sold) {
          const { error } = await sb.from("hm_vehicles").update({ is_sold: true }).eq("id", v.id);
          if (!error) legacyHidden++;
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    dryRun,
    total: mapped.length,
    created,
    updated,
    soldMarked,
    legacyHidden,
    legacyManualCount,
    syncedAt,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  };
}
