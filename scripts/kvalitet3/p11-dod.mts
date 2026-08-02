// KVALITET-3/punkt 11 — DoD-bevis för CTA-golvet.
//
// 10 captions i följd via OLIKA vägar, fördelade över två skarpa tenants. För varje
// caption sparas hela texten, sista meningen (det Håkan ska kunna läsa) och om vägen
// behövde CTA-omgenereringen. Kontrollen som avgör är den deterministiska
// harImperativCta — samma funktion som körs i produktion, ingen AI-bedömning.
//
// Ingen av vägarna nedan skriver i databasen (generate/week anropas UTAN compass →
// inget insert i studio_posts). Skriptet räknar ändå rader i de tabeller batcharna
// brukar smutsa ned, före och efter, och skriver ut differensen.
//
// Körning: npx tsx --tsconfig scripts/text1/tsconfig.json scripts/kvalitet3/p11-dod.mts

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const headersShim = (await import("next/headers")) as unknown as {
  __setBatchCookie: (n: string, v: string) => void;
};
const { createAdminSession, ADMIN_COOKIE } = await import("@/lib/admin-auth");
headersShim.__setBatchCookie(ADMIN_COOKIE, await createAdminSession(process.env.ADMIN_SESSION_SECRET!));
const setActiveClient = (id: string) => headersShim.__setBatchCookie("active_client_id", id);

const { harCtaISlutet, harImperativCta, hittaImperativCta } = await import("@/lib/content/writing-rules");
const { supabaseService } = await import("@/lib/supabase-admin");

const captionRoute = await import("@/app/api/studio/suggest-caption/route");
const adaptRoute = await import("@/app/api/studio/adapt-channel/route");
const improveRoute = await import("@/app/api/studio/improve-post/route");
const regenRoute = await import("@/app/api/generate/regenerate/route");
const weekRoute = await import("@/app/api/generate/week/route");

const DT = { slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" };
const ENGENS = { slug: "engens-trad", id: "e9e9e9e9-7e2d-4a2b-9c1f-e1ce115da001" };

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Sista MENINGEN i captionen: hashtag-rader räknas inte som en mening.
function sistaMening(text: string): string {
  const rader = String(text || "")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r && !/^(?:#[\p{L}\p{N}_]+\s*)+$/u.test(r));
  const sista = rader[rader.length - 1] || "";
  const meningar = sista.match(/[^.!?]+[.!?]*/g);
  return (meningar?.[meningar.length - 1] || sista).trim();
}

interface Bevis {
  nr: number;
  vag: string;
  tenant: string;
  caption: string;
  sista_mening: string;
  cta_traffar: string[];
  /** Finns en imperativ uppmaning någonstans i texten? */
  cta_finns: boolean;
  /** Står uppmaningen i slutstycket? Det är grinden produktionen använder. */
  cta_ok: boolean;
  omgenererad: boolean;
}

const bevis: Bevis[] = [];
let nr = 0;
function lagg(vag: string, tenant: string, caption: string, omgenererad: boolean): void {
  const traffar = hittaImperativCta(caption);
  bevis.push({
    nr: ++nr,
    vag,
    tenant,
    caption,
    sista_mening: sistaMening(caption),
    cta_traffar: traffar,
    cta_finns: harImperativCta(caption),
    cta_ok: harCtaISlutet(caption),
    omgenererad,
  });
  console.log(`${nr}. ${vag} (${tenant}) → ${harCtaISlutet(caption) ? "CTA OK (sist)" : harImperativCta(caption) ? "CTA FINNS MEN INTE SIST" : "SAKNAR CTA"}${omgenererad ? " [omgenererad]" : ""}`);
}

// ── Bieffektsräkning före ────────────────────────────────────────────────────
const TABELLER = ["agent_experiments", "studio_posts", "linkedin_posts", "hm_social_posts"];
async function radantal(): Promise<Record<string, number>> {
  const sb = supabaseService();
  const ut: Record<string, number> = {};
  for (const t of TABELLER) {
    const { count } = await sb.from(t).select("id", { count: "exact", head: true });
    ut[t] = count ?? -1;
  }
  return ut;
}
const fore = await radantal();
console.log("Radantal före:", fore);

// ── Väg 1 + 2: suggest-caption, direktgenerering (en per tenant) ─────────────
for (const p of [DT, ENGENS]) {
  setActiveClient(p.id);
  const res = await captionRoute.POST(req("/api/studio/suggest-caption", {
    topic: p.slug === "displayteknik"
      ? "Skyltfönstret som säljer när butiken är stängd"
      : "Så vet du när ditt träd behöver beskäras",
    postType: "post",
  }) as never);
  const j = (await res.json()) as { caption?: string; ctaOmgenererad?: boolean };
  lagg("suggest-caption (direktgenerering)", p.slug, j.caption ?? `(FEL status ${res.status})`, !!j.ctaOmgenererad);
}

// ── Väg 3: suggest-caption, variantväljaren (3 krok-vinklar, DT) ─────────────
setActiveClient(DT.id);
{
  const res = await captionRoute.POST(req("/api/studio/suggest-caption", {
    topic: "Digital skyltning i butiksfönstret",
    postType: "post",
    variants: 3,
  }) as never);
  const j = (await res.json()) as { variants?: { angle: string; caption: string; ctaOmgenererad?: boolean }[] };
  for (const v of j.variants ?? []) lagg(`suggest-caption variant (${v.angle})`, DT.slug, v.caption, !!v.ctaOmgenererad);
}

// ── Väg 4: adapt-channel, kanalanpassning (Engens, ig+fb+li) ─────────────────
setActiveClient(ENGENS.id);
{
  const res = await adaptRoute.POST(req("/api/studio/adapt-channel", {
    caption: "Höststormarna avslöjar vilka träd som är sjuka. En gren som ser frisk ut kan vara ihålig inuti, och den syns inte förrän den ligger på taket.",
    topic: "Trädbesiktning inför hösten",
    postType: "post",
    channels: ["ig", "fb", "li"],
  }) as never);
  const j = (await res.json()) as { captions?: Record<string, string>; ctaOmgenererad?: boolean };
  for (const [k, v] of Object.entries(j.captions ?? {})) {
    lagg(`adapt-channel (${k})`, ENGENS.slug, v, !!j.ctaOmgenererad);
  }
}

// ── Väg 5: improve-post, "Förbättra inlägg" (DT) ────────────────────────────
setActiveClient(DT.id);
{
  const res = await improveRoute.POST(req("/api/studio/improve-post", {
    text: "Vi jobbar med digitala skyltar för butiker. Det ger bättre synlighet och gör att fler ser dina erbjudanden. Vi ser till att du får en lösning som passar din lokal.",
  }) as never);
  const j = (await res.json()) as { improved?: string };
  lagg("improve-post (Förbättra)", DT.slug, j.improved ?? `(FEL status ${res.status})`, false);
}

// ── Väg 6: generate/regenerate, "gör om på instruktion" (Engens) ────────────
// Det HÄR var vägen som saknade CTA-golvet helt före punkt 11.
setActiveClient(ENGENS.id);
{
  const res = await regenRoute.POST(req("/api/generate/regenerate", {
    hook: "Hösten är den bästa tiden att se över träden.",
    body: "Löven är borta och strukturen syns. Då märks det direkt om en gren är död eller om stammen har spruckit.",
    cta: "Vi hjälper dig gärna.",
    instruction: "varmare och mer personligt",
  }) as never);
  const j = (await res.json()) as { hook?: string; body?: string; cta?: string; ctaOmgenererad?: boolean };
  const hel = [j.hook, j.body, j.cta].filter(Boolean).join("\n\n");
  lagg("generate/regenerate (gör om)", ENGENS.slug, hel || `(FEL status ${res.status})`, !!j.ctaOmgenererad);
}

console.log(`\n=== ${bevis.length} captions klara ===`);

// ── Extra: veckoplanens 7 dagar (DT) — captionen som landar i kalendern ──────
// Formen hook + body + cta + hashtags är exakt den Håkan såg sluta i ett konstaterande
// plus hashtags. Anropas utan compass → inget insert i studio_posts.
setActiveClient(DT.id);
const veckan: { dag: string; caption: string; sista_mening: string; cta_ok: boolean }[] = [];
try {
  const res = await weekRoute.POST(req("/api/generate/week", { theme: "Skyltfönstret som säljer dygnet runt" }) as never);
  const j = (await res.json()) as { days?: { day: string; hook: string; body: string; cta: string; hashtags: string[] }[] };
  for (const d of j.days ?? []) {
    const hashtags = (d.hashtags || []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
    const caption = [d.hook, d.body, d.cta, hashtags].filter(Boolean).join("\n\n");
    veckan.push({ dag: d.day, caption, sista_mening: sistaMening(caption), cta_ok: harCtaISlutet(caption) });
    console.log(`vecka ${d.day} → ${harCtaISlutet(caption) ? "CTA OK (sist)" : "SAKNAR CTA SIST"}`);
  }
} catch (e) {
  console.warn(`veckoplan hoppades över: ${(e as Error).message}`);
}

const efter = await radantal();
console.log("Radantal efter:", efter);
const diff = Object.fromEntries(TABELLER.map((t) => [t, efter[t] - fore[t]]));
console.log("Differens (ska vara 0 överallt):", diff);

const utkatalog = path.join(ROOT, "docs/kvalitet3/p11");
mkdirSync(utkatalog, { recursive: true });
const fil = path.join(utkatalog, "dod-bevis.json");
writeFileSync(fil, JSON.stringify({
  kord: new Date().toISOString(),
  sammanfattning: {
    antal: bevis.length,
    godkanda: bevis.filter((b) => b.cta_ok).length,
    omgenererade: bevis.filter((b) => b.omgenererad).length,
  },
  captions: bevis,
  veckoplan: { antal: veckan.length, godkanda: veckan.filter((v) => v.cta_ok).length, dagar: veckan },
  db_bieffekter: { fore, efter, diff },
}, null, 2), "utf8");
console.log(`KLART → ${fil}`);
