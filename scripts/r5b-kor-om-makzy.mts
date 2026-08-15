// R-5b DoD, sista steget: kör om Makzy-rapporten med den kalibrerade siffergrinden.
// Startar crawl + Anthropic-batch. Batchen tar tid; `r5b-hamta-hem.mts` finaliserar den.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: klient } = await sb.from("clients").select("id, name, public_url").eq("slug", "makzy").maybeSingle();
if (!klient) throw new Error("hittade inte Makzy");
console.log(`Kör om djupgranskningen för ${(klient as any).name} (${(klient as any).public_url ?? "https://www.makzy.se"})`);

const { runDeepAudit } = await import("../lib/deep-audit-generate");
const res = await runDeepAudit((klient as any).id, "https://www.makzy.se");
console.log(JSON.stringify(res, null, 2));
