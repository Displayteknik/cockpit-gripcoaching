// Lagerstatus-flagga för fordon (sätts manuellt av ägaren i dashboarden).
// Lagras i den annars oanvända kolumnen `hm_vehicles.badge_type` → ingen DB-migration,
// och den fria `badge`-texten ("Populär"/"Ny") påverkas inte.
// Format: "stock:in:3" | "stock:in" | "stock:order" | "stock:out". Allt annat = ingen flagga.

export type StockStatus = "in" | "order" | "out";

export interface Stock {
  status: StockStatus;
  count: number | null;
}

const PREFIX = "stock:";

export function parseStock(badgeType?: string | null): Stock | null {
  if (!badgeType || !badgeType.startsWith(PREFIX)) return null;
  const [, status, count] = badgeType.split(":");
  if (status !== "in" && status !== "order" && status !== "out") return null;
  const n = count ? parseInt(count, 10) : NaN;
  return { status, count: Number.isFinite(n) && n > 0 ? n : null };
}

// status="" → ingen flagga ("default" så vi inte skriver null som krockar med befintliga rader).
export function encodeStock(status: StockStatus | "", count: number | null): string {
  if (!status) return "default";
  if (status === "in" && count && count > 0) return `stock:in:${count}`;
  return `stock:${status}`;
}

export interface StockFlag {
  label: string;
  tone: "green" | "amber" | "gray";
}

export function stockFlag(stock: Stock): StockFlag {
  if (stock.status === "in") {
    return { label: stock.count ? `${stock.count} i lager` : "I lager", tone: "green" };
  }
  if (stock.status === "order") return { label: "Beställningsvara", tone: "amber" };
  return { label: "Slut i lager", tone: "gray" };
}

// Alternativ för dropdown i dashboarden.
export const STOCK_OPTIONS: { value: StockStatus | ""; label: string }[] = [
  { value: "", label: "Ingen flagga" },
  { value: "in", label: "I lager" },
  { value: "order", label: "Beställningsvara" },
  { value: "out", label: "Slut i lager" },
];

export const STOCK_TONE_CLASSES: Record<StockFlag["tone"], string> = {
  green: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  gray: "bg-gray-500 text-white",
};
