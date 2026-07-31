// TEXT-1 T-2 — smoke-verifiering EFTER Stack A-migreringen till prompt-core.
// Kör EN riktig generering för linkedin-draft + caption + veckoplan-klassisk mot
// Displayteknik via samma shim/admin-session som scripts/text1-batch.mts.
// Verifierar (1) att svaren har samma fält som före migreringen, (2) att system-
// prompten har alla lager (byggTextPrompt anropas med samma syften → meta.lager).
// DB-bieffekter (linkedin_posts, client_activity) raderas efteråt som batchskriptet gör.
//
// Körning:  npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1/smoke-t2.mts

import { readFileSync } from "node:fs";
import path from "node:path";

// 1) Env
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

// 2) Shim-kakor (admin-session + aktiv klient = Displayteknik)
const DT = "a6a33547-5ca7-475f-9a62-43ff2c74d000";
const headersShim = (await import("next/headers")) as unknown as { __setBatchCookie: (n: string, v: string) => void };
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));
headersShim.__setBatchCookie("active_client_id", DT);

const { supabaseService } = await import("@/lib/supabase-admin");
const sb = supabaseService();
const RUN_START = new Date().toISOString();

// Snapshot av voice-profilen (återställs om fingerprint-ombyggnad hann skriva)
const { data: voiceSnap } = await sb.from("client_voice_profile").select("*").eq("client_id", DT).maybeSingle();

// 3) meta.lager per syfte — samma parametrar som de migrerade flödena skickar
const { byggTextPrompt } = await import("@/lib/prompt-core");
const lagerKoll: Record<string, unknown>[] = [];
for (const [namn, params] of [
  ["linkedin-draft", { clientId: DT, syfte: "linkedin", kanal: "linkedin", uppdrag: "UPPDRAG", underlag: "u", knowledge: ["linkedin-foundation", "linkedin-formats", "linkedin-advanced"], jsonSchema: "{}" }],
  ["caption", { clientId: DT, syfte: "caption", kanal: "instagram", uppdrag: "UPPDRAG", underlag: "u" }],
  ["veckoplan", { clientId: DT, syfte: "veckoplan", uppdrag: "UPPDRAG", underlag: "u", jsonSchema: "{}" }],
] as const) {
  const b = await byggTextPrompt(params as Parameters<typeof byggTextPrompt>[0]);
  lagerKoll.push({ flode: namn, lager: b.meta.lager, profilKlippt: b.meta.profilKlippt, systemTecken: b.system.length });
  console.log(`[lager] ${namn}:`, JSON.stringify(b.meta.lager), `| profilKlippt: ${JSON.stringify(b.meta.profilKlippt)} | system=${b.system.length} tecken`);
}

// 4) Riktiga genereringar via route-POST (samma metod som text1-batch)
function jsonReq(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
const harFalt = (obj: unknown, falt: string[]): string[] => falt.filter((f) => (obj as Record<string, unknown>)?.[f] === undefined);

const skapadeLinkedinIds: string[] = [];
let fel = 0;

// linkedin-draft — förväntade fält: post, draft{hook,body,hashtags,cta,word_count,notes}, voice_score
try {
  const routeLi = await import("@/app/api/linkedin/draft/route");
  const resLi = await routeLi.POST(jsonReq("/api/linkedin/draft", { angle: "Varför LED-skyltar utomhus kräver rätt ljusstyrka", length: "medium", format: "text" }) as never);
  const jsonLi = (await resLi.json()) as Record<string, unknown>;
  const liPost = jsonLi.post as { id?: string } | null;
  if (liPost?.id) skapadeLinkedinIds.push(liPost.id);
  const saknasTopp = harFalt(jsonLi, ["post", "draft", "voice_score"]);
  const saknasDraft = harFalt(jsonLi.draft, ["hook", "body", "hashtags", "cta", "word_count", "notes"]);
  const ok = resLi.status === 200 && !saknasTopp.length && !saknasDraft.length;
  if (!ok) fel++;
  console.log(`[gen] linkedin-draft: HTTP ${resLi.status} — fält ${ok ? "OK" : `SAKNAS: ${[...saknasTopp, ...saknasDraft].join(",")}`}`);
  const d = jsonLi.draft as { hook?: string } | undefined;
  console.log(`      hook: ${(d?.hook || "").slice(0, 90)}`);
} catch (e) { fel++; console.log(`[gen] linkedin-draft FEL: ${(e as Error).message?.slice(0, 300)}`); }

// caption — förväntat fält: caption (sträng)
try {
  const routeCap = await import("@/app/api/studio/suggest-caption/route");
  const resCap = await routeCap.POST(jsonReq("/api/studio/suggest-caption", { topic: "Digital meny som säljer mer i lunchrusningen", postType: "post" }) as never);
  const jsonCap = (await resCap.json()) as Record<string, unknown>;
  const ok = resCap.status === 200 && typeof jsonCap.caption === "string" && (jsonCap.caption as string).length > 0;
  if (!ok) fel++;
  console.log(`[gen] caption: HTTP ${resCap.status} — fält ${ok ? "OK" : `FEL: ${JSON.stringify(jsonCap).slice(0, 200)}`}`);
  console.log(`      caption (start): ${String(jsonCap.caption || "").slice(0, 90)}`);
} catch (e) { fel++; console.log(`[gen] caption FEL: ${(e as Error).message?.slice(0, 300)}`); }

// veckoplan klassisk — förväntade fält: theme, voice_source_count, days[7]{day,fourA,disc,funnel,format,hook,body,cta,hashtags}
try {
  const routeWeek = await import("@/app/api/generate/week/route");
  const resW = await routeWeek.POST(jsonReq("/api/generate/week", { theme: "Skyltar som syns i decembermörkret" }) as never);
  const jsonW = (await resW.json()) as Record<string, unknown>;
  const days = jsonW.days as Record<string, unknown>[] | undefined;
  const saknasTopp = harFalt(jsonW, ["theme", "voice_source_count", "days"]);
  const saknasDag = days?.length ? harFalt(days[0], ["day", "fourA", "disc", "funnel", "format", "hook", "body", "cta", "hashtags"]) : ["days tom"];
  const ok = resW.status === 200 && Array.isArray(days) && days.length === 7 && !saknasTopp.length && !saknasDag.length;
  if (!ok) fel++;
  console.log(`[gen] veckoplan: HTTP ${resW.status} — ${days?.length ?? 0} dagar, voice_source_count=${jsonW.voice_source_count} — fält ${ok ? "OK" : `SAKNAS: ${[...saknasTopp, ...saknasDag].join(",")}`}`);
  console.log(`      måndag-hook: ${String(days?.[0]?.hook || "").slice(0, 90)}`);
} catch (e) { fel++; console.log(`[gen] veckoplan FEL: ${(e as Error).message?.slice(0, 300)}`); }

// 5) Städa bieffekter
console.log("\n=== STÄDNING ===");
if (skapadeLinkedinIds.length) {
  const { data: raderade } = await sb.from("linkedin_posts").delete().in("id", skapadeLinkedinIds).select("id");
  const { data: kvar } = await sb.from("linkedin_posts").select("id").in("id", skapadeLinkedinIds);
  console.log(`linkedin_posts: raderade ${(raderade || []).length}, kvar ${(kvar || []).length}`);
} else console.log("linkedin_posts: inga rader skapades");
const { data: aktRaderade } = await sb.from("client_activity").delete().eq("client_id", DT).gte("created_at", RUN_START).in("type", ["linkedin_draft", "social_generated"]).select("id");
console.log(`client_activity: raderade ${(aktRaderade || []).length}`);
const { data: veckoRester } = await sb.from("studio_posts").select("id").eq("client_id", DT).gte("created_at", RUN_START);
console.log(`studio_posts: ${(veckoRester || []).length} nya (förväntat 0)`);
if (voiceSnap) {
  const { data: nu } = await sb.from("client_voice_profile").select("last_built_at").eq("client_id", DT).maybeSingle();
  if (nu && nu.last_built_at !== voiceSnap.last_built_at) {
    await sb.from("client_voice_profile").upsert(voiceSnap, { onConflict: "client_id" });
    console.log("client_voice_profile: ombyggd under körningen → återställd");
  } else console.log("client_voice_profile: oförändrad");
}

console.log(`\nSMOKE ${fel === 0 ? "GRÖN" : `RÖD (${fel} fel)`}`);
process.exit(fel === 0 ? 0 : 1);
