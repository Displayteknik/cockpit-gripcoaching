// Tools som setup-agenten kan kora.
// Varje tool: (input) => { ok: boolean, summary: string, data?: any }

import { supabaseService } from "../supabase-admin";
import { rebuildVoiceFingerprint } from "../voice-fingerprint";

export interface ToolResult {
  ok: boolean;
  summary: string;
  data?: unknown;
}

// 1. Klient-halsa: vad ar status pa klienten?
export async function checkClientHealth(input: { client_id: string }): Promise<ToolResult> {
  const sb = supabaseService();
  const { client_id } = input;

  const [client, profile, fingerprint, assets, winning, visits, audits] = await Promise.all([
    sb.from("clients").select("id, name, slug, public_url").eq("id", client_id).maybeSingle(),
    sb.from("hm_brand_profile").select("client_id, tone_rules, dos, donts").eq("client_id", client_id).maybeSingle(),
    sb.from("client_voice_profile").select("client_id, source_asset_count, signature_phrases, last_built_at").eq("client_id", client_id).maybeSingle(),
    sb.from("client_assets").select("id", { count: "exact", head: true }).eq("client_id", client_id).eq("status", "active"),
    sb.from("client_assets").select("id", { count: "exact", head: true }).eq("client_id", client_id).eq("category", "winning_example").eq("status", "active"),
    sb.from("hm_visits").select("id", { count: "exact", head: true }).eq("client_id", client_id).gte("ts", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    sb.from("hm_seo_audits").select("id", { count: "exact", head: true }).eq("client_id", client_id),
  ]);

  if (!client.data) {
    return { ok: false, summary: `Klienten med id ${client_id} finns inte.` };
  }

  const c = client.data as { name: string; slug: string; public_url: string | null };
  const p = profile.data as { tone_rules: string | null; dos: string | null; donts: string | null } | null;
  const f = fingerprint.data as { source_asset_count: number | null; signature_phrases: string[] | null; last_built_at: string | null } | null;

  const checks = {
    klient_finns: true,
    public_url_satt: !!c.public_url,
    brand_profile_finns: !!p,
    brand_profile_komplett: !!(p?.tone_rules && p?.dos && p?.donts),
    voice_fingerprint_byggd: !!f?.last_built_at,
    voice_fingerprint_har_5_assets: (f?.source_asset_count ?? 0) >= 5,
    voice_fingerprint_har_signature_phrases: (f?.signature_phrases?.length ?? 0) > 0,
    assets_finns: (assets.count ?? 0) > 0,
    winning_examples_finns: (winning.count ?? 0) >= 3,
    trafik_data_finns: (visits.count ?? 0) > 0,
    audit_data_finns: (audits.count ?? 0) > 0,
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.keys(checks).length;

  return {
    ok: true,
    summary: `Klient: ${c.name} | ${passed}/${total} checkar OK | ${c.public_url ?? "ingen URL"}`,
    data: {
      client: c,
      checks,
      stats: {
        active_assets: assets.count ?? 0,
        winning_examples: winning.count ?? 0,
        visits_30d: visits.count ?? 0,
        seo_audits: audits.count ?? 0,
        voice_source_assets: f?.source_asset_count ?? 0,
        voice_built_at: f?.last_built_at ?? null,
        signature_phrases: f?.signature_phrases?.length ?? 0,
      },
    },
  };
}

// 2. Bygg om voice-fingerprint
export async function rebuildFingerprint(input: { client_id: string }): Promise<ToolResult> {
  try {
    const fp = await rebuildVoiceFingerprint(input.client_id);
    return {
      ok: true,
      summary: `Voice-fingerprint byggd. ${fp.source_asset_count} kallfiler, ${fp.signature_phrases.length} signaturfraser.`,
      data: {
        source_asset_count: fp.source_asset_count,
        signature_phrases: fp.signature_phrases,
        tone_summary: fp.tone_summary,
        forbidden_words_count: fp.forbidden_words.length,
      },
    };
  } catch (e) {
    return { ok: false, summary: `Fel vid bygge: ${(e as Error).message}` };
  }
}

// 3. Generera trafik-pixel-snippet
export async function generateTrackingPixel(input: { client_id: string }): Promise<ToolResult> {
  const sb = supabaseService();
  const { data } = await sb.from("clients").select("name, slug").eq("id", input.client_id).maybeSingle();
  if (!data) return { ok: false, summary: "Klient saknas" };

  const c = data as { name: string; slug: string };
  const trackingUrl = "https://cockpit.gripcoaching.se/api/track";
  const snippet = `<!-- Cockpit trafikspårning för ${c.name} -->
<script>
  (function() {
    fetch('${trackingUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: '${input.client_id}',
        path: location.pathname,
        referrer: document.referrer || null
      }),
      keepalive: true
    }).catch(() => {});
  })();
</script>`;

  return {
    ok: true,
    summary: `Pixel-snippet for ${c.name} genererad. Klistra in i <head> pa klientens sajt.`,
    data: { snippet, client_name: c.name, client_slug: c.slug },
  };
}

// 4. Markera asset som winning_example
export async function markWinningExample(input: {
  asset_id: string;
  voice_score?: number;
  subcategory?: string;
}): Promise<ToolResult> {
  const sb = supabaseService();
  const updates: Record<string, unknown> = {
    category: "winning_example",
    voice_score: input.voice_score ?? 90,
  };
  if (input.subcategory) updates.subcategory = input.subcategory;

  const { error, data } = await sb
    .from("client_assets")
    .update(updates)
    .eq("id", input.asset_id)
    .select("id, asset_type, body")
    .maybeSingle();

  if (error) return { ok: false, summary: `Fel: ${error.message}` };
  if (!data) return { ok: false, summary: "Asset hittades inte" };

  return {
    ok: true,
    summary: `Asset ${input.asset_id} markerad som winning_example (subcategory: ${input.subcategory ?? "ingen"}, score: ${updates.voice_score}).`,
    data,
  };
}

// 5. Kor natt-iterate for SPECIFIK klient nu
export async function runNightIterateForClient(input: { client_id: string }): Promise<ToolResult> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, summary: "CRON_SECRET saknas i ENV" };

  // Kor genom samma endpoint men med client-filter via query
  const r = await fetch(`https://cockpit.gripcoaching.se/api/agents/night-iterate?client_id=${input.client_id}`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  const result = await r.json();

  if (!r.ok) return { ok: false, summary: `Fel: ${result.error ?? "okant"}` };

  return {
    ok: true,
    summary: `Natt-iterate kord. ${result.ideas_saved ?? 0} idéer sparade.`,
    data: result,
  };
}

// 6. Lista assets for klient (for att hjalpa hitta winning examples)
export async function listClientAssets(input: {
  client_id: string;
  limit?: number;
}): Promise<ToolResult> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("client_assets")
    .select("id, asset_type, category, subcategory, body, voice_score, created_at")
    .eq("client_id", input.client_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (error) return { ok: false, summary: error.message };

  const list = (data ?? []) as Array<{
    id: string;
    asset_type: string;
    category: string | null;
    body: string | null;
  }>;
  return {
    ok: true,
    summary: `${list.length} assets hittade.`,
    data: list.map((a) => ({
      id: a.id,
      asset_type: a.asset_type,
      category: a.category,
      preview: a.body?.slice(0, 120) ?? "",
    })),
  };
}

// 7. Injicera pixel i HTML-filer (filsystem-write — anvands fran setup-agenten)
export async function injectPixelInHtml(input: {
  file_paths: string[];
  pixel_url?: string;
}): Promise<ToolResult> {
  const fs = await import("node:fs/promises");
  const SCRIPT = `<script src="${input.pixel_url ?? "https://cockpit.gripcoaching.se/pixel.js"}" async></script>`;
  const results: Array<{ path: string; status: string }> = [];

  for (const p of input.file_paths) {
    try {
      const html = await fs.readFile(p, "utf8");
      if (html.includes("cockpit.gripcoaching.se/pixel.js")) {
        results.push({ path: p, status: "redan" });
        continue;
      }
      const re = /<\/head>/i;
      if (!re.test(html)) {
        results.push({ path: p, status: "ingen </head>-tagg" });
        continue;
      }
      const newHtml = html.replace(re, `${SCRIPT}\n</head>`);
      await fs.writeFile(p, newHtml, "utf8");
      results.push({ path: p, status: "injicerad" });
    } catch (e) {
      results.push({ path: p, status: `fel: ${(e as Error).message}` });
    }
  }

  const okCount = results.filter((r) => r.status === "injicerad").length;
  return {
    ok: true,
    summary: `${okCount}/${input.file_paths.length} filer injicerade.`,
    data: results,
  };
}

// 8. Lista alla klienter
export async function listClients(): Promise<ToolResult> {
  const sb = supabaseService();
  const { data, error } = await sb.from("clients").select("id, name, slug, public_url").order("name");
  if (error) return { ok: false, summary: error.message };
  return {
    ok: true,
    summary: `${(data ?? []).length} klienter.`,
    data,
  };
}

export const TOOLS = [
  {
    name: "check_client_health",
    description: "Kor en halsokontroll pa en klient. Visar vad som ar uppsatt och vad som saknas (brand-profil, voice-fingerprint, assets, winning examples, trafik, audits).",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string", description: "Klient-UUID" } },
      required: ["client_id"],
    },
    handler: checkClientHealth,
  },
  {
    name: "rebuild_voice_fingerprint",
    description: "Bygger om en klients voice-fingerprint fran scratch. Anvand efter att nya client_assets lagts till.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
    handler: rebuildFingerprint,
  },
  {
    name: "generate_tracking_pixel",
    description: "Genererar en HTML-snippet for trafikspårning som ska klistras in i klientens sajt-<head>.",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
    handler: generateTrackingPixel,
  },
  {
    name: "mark_winning_example",
    description: "Markerar en client_assets-rad som winning_example. Anvands for att lyfta Hakan-godkanda inlagg som benchmark for AI.",
    input_schema: {
      type: "object",
      properties: {
        asset_id: { type: "string" },
        voice_score: { type: "number", description: "0-100, default 90" },
        subcategory: { type: "string", description: "linkedin | email | saljbrev" },
      },
      required: ["asset_id"],
    },
    handler: markWinningExample,
  },
  {
    name: "run_night_iterate_for_client",
    description: "Kor natt-iteraten direkt for en specifik klient nu (genererar 5 LinkedIn + 5 mejl-utkast).",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
    handler: runNightIterateForClient,
  },
  {
    name: "list_client_assets",
    description: "Listar de senaste client_assets for en klient. Anvands for att hitta kandidater att markera som winning_example.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["client_id"],
    },
    handler: listClientAssets,
  },
  {
    name: "list_clients",
    description: "Listar alla klienter med id, namn, slug, URL. Anvands nar Hakan inte vet client_id.",
    input_schema: { type: "object", properties: {} },
    handler: () => listClients(),
  },
  {
    name: "inject_pixel_in_html",
    description: "Injicerar Cockpit-pixeln (https://cockpit.gripcoaching.se/pixel.js) i HTML-filer. Anvands for klient-sajter pa filsystemet (statiska HTML-projekt). Skippar filer dar pixeln redan finns.",
    input_schema: {
      type: "object",
      properties: {
        file_paths: { type: "array", items: { type: "string" }, description: "Absoluta paths till HTML-filer" },
        pixel_url: { type: "string", description: "Override pixel-URL (default: cockpit-pixeln)" },
      },
      required: ["file_paths"],
    },
    handler: injectPixelInHtml,
  },
] as const;
