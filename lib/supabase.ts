import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Types ---

export interface Vehicle {
  id: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  category: "car" | "atv" | "utv" | "moped" | "slapvagn" | "tradgard";
  image_url: string;
  description: string;
  specs: Record<string, string>;
  price: number;
  price_label: string;
  badge: string | null;
  is_featured: boolean;
  is_sold: boolean;
  sort_order: number;
}

export interface ArtWork {
  id: string;
  client_id: string;
  slug: string;
  title: string;
  artist: string | null;
  year: number | null;
  technique: string | null;
  medium: string | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  price: number;
  price_label: string | null;
  description: string | null;
  image_url: string | null;
  gallery: string[];
  tags: string[];
  status: "for_sale" | "sold" | "reserved" | "exhibition_only" | "archived";
  is_featured: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Exhibition {
  id: string;
  client_id: string;
  year: number;
  year_label: string | null;
  title: string;
  venue: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "upcoming" | "ongoing" | "past";
  description: string | null;
  image_url: string | null;
  url: string | null;
  sort_order: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string;
  image_url: string;
  author: string;
  published_at: string;
  published: boolean;
}

export interface PageData {
  id: string;
  slug: string;
  title: string;
  data: Record<string, unknown>;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// HM Motor klient-id — publika rutter (hmmotor-next.vercel.app/hmmotor.se) är HM-specifika
export const HM_MOTOR_CLIENT_ID = "00000000-0000-0000-0000-000000000001";

// --- Vehicle queries (HM Motor publika sajt) ---

export async function getVehicles(category?: string, featured?: boolean) {
  let query = supabase
    .from("hm_vehicles")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .eq("is_sold", false)
    .order("sort_order", { ascending: true });

  if (category) query = query.eq("category", category);
  if (featured) query = query.eq("is_featured", true);

  const { data, error } = await query;
  if (error) throw error;
  return data as Vehicle[];
}

export async function getVehicleBySlug(slug: string) {
  const { data, error } = await supabase
    .from("hm_vehicles")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as Vehicle;
}

// --- Blog queries (HM Motor publika sajt) ---

export async function getBlogPosts(limit?: number) {
  let query = supabase
    .from("hm_blog")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data as BlogPost[];
}

export async function getBlogPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from("hm_blog")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as BlogPost;
}

// --- Page queries (HM Motor publika sajt) ---

export async function getPage(slug: string) {
  const { data, error } = await supabase
    .from("hm_pages")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .eq("slug", slug)
    .eq("is_published", true)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as PageData | null;
}

export async function getAllPages() {
  const { data, error } = await supabase
    .from("hm_pages")
    .select("*")
    .eq("client_id", HM_MOTOR_CLIENT_ID)
    .order("title", { ascending: true });
  if (error) throw error;
  return data as PageData[];
}

export async function savePage(slug: string, title: string, pageData: Record<string, unknown>, clientId: string = HM_MOTOR_CLIENT_ID) {
  const { data, error } = await supabase
    .from("hm_pages")
    .upsert(
      {
        client_id: clientId,
        slug,
        title,
        data: pageData,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,slug" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as PageData;
}

// --- Utilities ---

export function formatPrice(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " kr";
}
