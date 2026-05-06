// lib/assets.ts — kärnan för kunskapsbanken (client_assets)
// Används av /api/assets/* endpoints och kommande generator-flöden.

import { supabaseService } from "./supabase-admin";

export const ASSET_TYPES = [
  "post",
  "photo",
  "audio",
  "video",
  "testimonial",
  "link",
  "document",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface ClientAsset {
  id: string;
  client_id: string;
  asset_type: AssetType;
  category: string | null;
  title: string | null;
  body: string | null;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_bytes: number | null;
  duration_s: number | null;
  person_name: string | null;
  person_label: string | null;
  tags: string[];
  ai_summary: string | null;
  voice_score: number | null;
  status: "active" | "archived" | "processing" | "failed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// MIME-vitlistor — säkerhet vid uppladdning
export const ALLOWED_MIME = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/m4a", "audio/x-m4a"],
  video: ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"],
  document: ["application/pdf", "text/plain", "text/markdown"],
};

export const MAX_BYTES = {
  photo: 20 * 1024 * 1024,      // 20 MB
  audio: 100 * 1024 * 1024,     // 100 MB
  video: 500 * 1024 * 1024,     // 500 MB
  document: 25 * 1024 * 1024,   // 25 MB
};

export function detectAssetType(mime: string): AssetType | null {
  if (ALLOWED_MIME.photo.includes(mime)) return "photo";
  if (ALLOWED_MIME.audio.includes(mime)) return "audio";
  if (ALLOWED_MIME.video.includes(mime)) return "video";
  if (ALLOWED_MIME.document.includes(mime)) return "document";
  return null;
}

export function validateUpload(mime: string, bytes: number): { ok: true; type: AssetType } | { ok: false; reason: string } {
  const type = detectAssetType(mime);
  if (!type) return { ok: false, reason: `Filtyp ${mime} stöds inte` };
  const max = MAX_BYTES[type as keyof typeof MAX_BYTES];
  if (max && bytes > max) {
    return { ok: false, reason: `Fil för stor. Max ${Math.round(max / 1024 / 1024)} MB för ${type}` };
  }
  return { ok: true, type };
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

export function buildStoragePath(clientId: string, type: AssetType, originalName: string): string {
  const ext = (originalName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const uuid = crypto.randomUUID();
  return `${clientId}/${type}/${uuid}.${ext}`;
}

// Lista assets för en klient
export async function listAssets(clientId: string, opts?: { type?: AssetType; limit?: number }): Promise<ClientAsset[]> {
  const sb = supabaseService();
  let q = sb
    .from("client_assets")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (opts?.type) q = q.eq("asset_type", opts.type);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as ClientAsset[];
}

// Räkna assets per typ — driver kvalitetsmätaren
export async function countAssetsByType(clientId: string): Promise<Record<AssetType, number>> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("client_assets")
    .select("asset_type")
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const counts = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<AssetType, number>;
  for (const row of data || []) {
    const t = (row as { asset_type: AssetType }).asset_type;
    if (t in counts) counts[t]++;
  }
  return counts;
}

// Skapa en text-asset (post, testimonial, link)
export async function createTextAsset(input: {
  client_id: string;
  asset_type: AssetType;
  title?: string;
  body?: string;
  source_url?: string;
  category?: string;
  person_name?: string;
  person_label?: string;
  tags?: string[];
}): Promise<ClientAsset> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("client_assets")
    .insert({
      client_id: input.client_id,
      asset_type: input.asset_type,
      title: input.title || null,
      body: input.body || null,
      source_url: input.source_url || null,
      category: input.category || null,
      person_name: input.person_name || null,
      person_label: input.person_label || null,
      tags: input.tags || [],
      status: "active",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ClientAsset;
}

export async function updateAsset(id: string, clientId: string, patch: Partial<ClientAsset>): Promise<ClientAsset> {
  const sb = supabaseService();
  const safe: Partial<ClientAsset> = { ...patch };
  delete safe.id;
  delete safe.client_id;
  delete safe.created_at;
  const { data, error } = await sb
    .from("client_assets")
    .update(safe)
    .eq("id", id)
    .eq("client_id", clientId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ClientAsset;
}

export async function archiveAsset(id: string, clientId: string): Promise<void> {
  const sb = supabaseService();
  // Hämta först för storage-cleanup
  const { data: existing } = await sb
    .from("client_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing?.storage_path) {
    await sb.storage.from("client-assets").remove([existing.storage_path as string]);
  }

  await sb.from("client_assets").update({ status: "archived" }).eq("id", id).eq("client_id", clientId);
}

// Skapa signerad URL för privat fil i client-assets bucket
export async function getSignedAssetUrl(storagePath: string, expiresInSec = 3600): Promise<string | null> {
  const sb = supabaseService();
  const { data, error } = await sb.storage.from("client-assets").createSignedUrl(storagePath, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

// Många assets samtidigt — för UI-listor
export async function attachSignedUrls(assets: ClientAsset[]): Promise<(ClientAsset & { signed_url?: string })[]> {
  const sb = supabaseService();
  const paths = assets.filter((a) => a.storage_path).map((a) => a.storage_path as string);
  if (paths.length === 0) return assets;

  const { data, error } = await sb.storage.from("client-assets").createSignedUrls(paths, 3600);
  if (error || !data) return assets;

  const map = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) map.set(paths[i], d.signedUrl);
  });

  return assets.map((a) => ({
    ...a,
    signed_url: a.storage_path ? map.get(a.storage_path) : undefined,
  }));
}
