// R-5b, steg 0: finns en sparad Makzy-rapport att mäta FÖRE-läget på?
// Läser client_assets (category = deep_audit_report) och listar dem per klient.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: klienter } = await sb.from("clients").select("id, name, slug");
const namn = new Map((klienter ?? []).map((k: any) => [k.id, `${k.name} (${k.slug})`]));

const { data, error } = await sb
  .from("client_assets")
  .select("id, client_id, category, title, status, created_at, body, metadata")
  .eq("category", "deep_audit_report")
  .order("created_at", { ascending: false })
  .limit(50);
if (error) throw error;

console.log(`Djupgranskningar i client_assets: ${data?.length ?? 0}\n`);
for (const a of (data ?? []) as any[]) {
  const md = String(a.body ?? "");
  const m = a.metadata ?? {};
  console.log(
    `${String(a.created_at).slice(0, 16)}  ${String(a.status).padEnd(11)} ${String(namn.get(a.client_id) ?? a.client_id).padEnd(30)} ` +
    `tecken=${String(md.length).padStart(6)}  beslut=${(m.grind_sifferbeslut?.length ?? 0)}  luckor=${(m.grind_luckor?.length ?? 0)}  ${a.id}`,
  );
  console.log(`    url=${m.url ?? "?"}  sort=${m.sort ?? "full"}  tackning=${m.tackning ?? "?"}`);
}
