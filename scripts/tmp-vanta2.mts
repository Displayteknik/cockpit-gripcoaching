import { readFileSync, writeFileSync } from "node:fs";
for (const rad of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = rad.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { finalizePendingAudits } = await import("@/lib/deep-audit-finalize");
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UT = "C:/Users/hakan/AppData/Local/Temp/claude/C--Users-hakan-OneDrive-Dokument-Antigravity-hmmotor-next/769143f6-6ac2-45fc-9e3d-bcfe7dbeb61c/scratchpad/";
const jobb = [
  { id: "e9524679-4a74-40ef-b8d4-b54a2061704d", namn: "dt-rapport-v3", klient: "a6a33547-5ca7-475f-9a62-43ff2c74d000" },
  { id: "7a2e70cd-553a-4f72-b097-ce15de4aca8e", namn: "engens-rapport", klient: null as string | null },
];
for (let i = 0; i < 60; i++) {
  await finalizePendingAudits().catch(() => 0);
  let kvar = 0;
  for (const j of jobb) {
    const { data } = await sb.from("client_assets").select("status, body, metadata").eq("id", j.id).maybeSingle();
    const r = data as any;
    if (r?.status === "active" && r.body) {
      writeFileSync(UT + j.namn + ".md", r.body, "utf8");
      const bes = r.metadata?.grind_sifferbeslut ?? [];
      console.log(`\n=== ${j.namn} KLAR: ${r.body.length} tecken ===`);
      console.log(`tankstreck: ${(r.body.match(/[–—]/g) || []).length}  klippta tal: ${(r.body.match(/\[DIN SIFFRA\] \d{3}/g) || []).length}  halva intervall: ${(r.body.match(/\d-\[DIN SIFFRA\]|\[DIN SIFFRA\]-\d/g) || []).length}`);
      console.log(`sifferbeslut: ${bes.length}  T=${bes.filter((b: any) => b.klass === "T").length} B=${bes.filter((b: any) => b.klass === "B").length} G=${bes.filter((b: any) => b.klass === "G").length}  luckor=${(r.metadata?.grind_luckor ?? []).length}`);
      console.log(`avvikelser: ${JSON.stringify(r.metadata?.grind_avvikelser ?? [])}`.slice(0, 400));
      j.namn = "";
    } else if (r?.status === "failed") { console.log(`${j.namn}: MISSLYCKADES`); j.namn = ""; }
    if (j.namn) kvar++;
  }
  if (!kvar) { console.log("\nBÅDA KLARA"); process.exit(0); }
  await new Promise((s) => setTimeout(s, 30000));
}
console.log("TIMEOUT, cron fortsätter");
