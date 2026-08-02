// Verifierar siffergrinden i BÅDA veckoplansvägarna (Håkans order 2/8, punkt 1).
// Samma metod som p11: skarpa anrop mot riktiga routen, mät obackade tal i utfallet.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const l of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const headersShim = (await import("next/headers")) as unknown as { __setBatchCookie: (n: string, v: string) => void };
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));
const DT = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
headersShim.__setBatchCookie("active_client_id", DT);

const { supabaseService } = await import("@/lib/supabase-admin");
const { obackadeSiffror, talTokens, utanHashtags } = await import("@/lib/content/writing-rules");
const { getProfileAsMarkdown } = await import("@/lib/knowledge");
const weekRoute = await import("@/app/api/generate/week/route");
const sb = supabaseService();

const profil = await getProfileAsMarkdown(DT, { medVoice: false });
const TEMA = "Varför en vanlig TV inte klarar skyltfönstret på sommaren";
const tillatna = new Set<string>([...talTokens(profil), ...talTokens(TEMA)]);
const start = new Date().toISOString();

async function kor(compass: boolean) {
  const req = new Request("http://localhost/api/generate/week", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(compass ? { theme: TEMA, compass: true } : { theme: TEMA }),
  });
  const res = await (weekRoute.POST as (r: never) => Promise<Response>)(req as never);
  const j = await res.json().catch(() => ({}));
  return { status: res.status, json: j as Record<string, unknown> };
}

const ut: Record<string, unknown> = { tema: TEMA, korningar: [] as unknown[] };
for (const compass of [false, true]) {
  const namn = compass ? "compass-vecka" : "veckoplan (klassisk)";
  const r = await kor(compass);
  const dagar: { dag: string; text: string }[] = [];
  const d = r.json as { days?: { day?: string; hook?: string; body?: string; cta?: string }[]; posts?: { caption?: string; title?: string }[] };
  for (const x of d.days ?? []) dagar.push({ dag: String(x.day ?? ""), text: [x.hook, x.body, x.cta].filter(Boolean).join("\n\n") });
  for (const p of d.posts ?? []) dagar.push({ dag: String(p.title ?? ""), text: String(p.caption ?? "") });
  const fynd = dagar.map((x) => ({ dag: x.dag, obackade: obackadeSiffror(utanHashtags(x.text), tillatna) })).filter((x) => x.obackade.length);
  console.log(`\n### ${namn} → HTTP ${r.status}, ${dagar.length} dagar`);
  console.log(fynd.length ? `  ⚠ OBACKADE TAL: ${JSON.stringify(fynd)}` : "  ✓ inga obackade tal");
  for (const x of dagar.slice(0, 2)) console.log(`  ${x.dag}: ${x.text.replace(/\s+/g, " ").slice(0, 110)}`);
  (ut.korningar as unknown[]).push({ vag: namn, status: r.status, antal_dagar: dagar.length, obackade: fynd, dagar });
}

// Städa bieffekter (compass-vägen sparar utkast).
const { data: bort } = await sb.from("studio_posts").delete().eq("client_id", DT).gte("created_at", start).select("id");
console.log(`\nStädat studio_posts: ${bort?.length ?? 0} rader.`);
mkdirSync(path.join(ROOT, "docs/kvalitet3/veckoplan-siffror"), { recursive: true });
writeFileSync(path.join(ROOT, "docs/kvalitet3/veckoplan-siffror/bevis.json"), JSON.stringify(ut, null, 2));
console.log("KLART");
