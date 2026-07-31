// T-6 DoD-bevis (körs manuellt, sparar INGET i DB — caption- och enskilt-flödena skriver inte).
// (b) A2: 10 berättelse-varianter för tenant med TOM story-bank (Annas Blommor) —
//     visar att ingen fabricerar specifika minnen/case/citat.
// (c) A3: tre varianter ur ETT anrop (enskilt-flödet) för rik (Displayteknik) och
//     tunn (Annas Blommor) profil — bevisat olika retoriska ingångar/öppningar.
//
// Körning: npx tsx --tsconfig scripts/text1/tsconfig.json scripts/text1/t6-dod.mts

import { readFileSync, writeFileSync } from "node:fs";
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

const captionRoute = await import("@/app/api/studio/suggest-caption/route");
const postRoute = await import("@/app/api/generate/post/route");

const RIK = { slug: "displayteknik", id: "a6a33547-5ca7-475f-9a62-43ff2c74d000" };
const TUNN = { slug: "annas-blommor", id: "7461fa8b-3fcb-4729-9cf6-53e27687656e" }; // TOM story-bank + 0 customer_voice

function req(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ut: Record<string, unknown> = {};

// ── (b) A2: 10 berättelse-varianter, tom story-bank ──────────────────────────
setActiveClient(TUNN.id);
const berattelser: string[] = [];
for (let i = 0; i < 10; i++) {
  const res = await captionRoute.POST(req("/api/studio/suggest-caption", {
    topic: "Därför vissnar dina snittblommor för tidigt",
    postType: "post",
    variants: 3, // Fråga, Påstående, Berättelse — vi plockar Berättelse
  }) as never);
  const json = (await res.json()) as { variants?: { angle: string; caption: string }[] };
  const b = (json.variants ?? []).find((v) => v.angle === "Berättelse");
  berattelser.push(b?.caption ?? `(FEL: ingen Berättelse-variant, status ${res.status})`);
  console.log(`A2 ${i + 1}/10 klar`);
}
ut.a2_berattelser_tom_storybank = { tenant: TUNN.slug, captions: berattelser };

// ── (c) A3: tre varianter ur ETT anrop, rik + tunn profil ────────────────────
for (const p of [RIK, TUNN]) {
  setActiveClient(p.id);
  const res = await postRoute.POST(req("/api/generate/post", {
    topic: p.slug === "displayteknik" ? "Skyltfönstret som säljer när butiken är stängd" : "Blommor som håller hela veckan",
    format: "single",
    platform: "instagram",
  }) as never);
  const json = (await res.json()) as { variants?: { hook: string; body: string; cta: string; hook_format: string }[] };
  ut[`a3_varianter_${p.slug}`] = (json.variants ?? []).map((v) => ({
    hook_format: v.hook_format,
    oppning: v.hook,
    cta: v.cta,
  }));
  console.log(`A3 ${p.slug} klar (${json.variants?.length ?? 0} varianter)`);
}

const fil = path.join(ROOT, "docs/text1/t6/dod-bevis.json");
writeFileSync(fil, JSON.stringify(ut, null, 2), "utf8");
console.log(`KLART → ${fil}`);
