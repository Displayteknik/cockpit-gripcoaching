// KANAL-2 (HELG-1 DEL 5): DoD mot skarp data. Bekräftar att Displaytekniks riktiga
// GHL-konton (inkl. Google Business Profile) klassas rätt av den delade logiken.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
import { getGhlConfig, ghlListAccounts } from "../lib/studio/ghl";
import { synligaKanaler, arAnsluten, arUtgangen } from "../lib/kanal-anatomi";

const sb = supabaseService();
let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

const { data: dt } = await sb.from("clients").select("id, slug").eq("slug", "displayteknik").maybeSingle();
const cfg = await getGhlConfig((dt as any).id);
if (!cfg) { console.error("Ingen GHL-koppling för Displayteknik."); process.exit(1); }
const { accounts, error } = await ghlListAccounts(cfg);
if (error) { console.error("GHL-fel:", error); process.exit(1); }

console.log(`Displayteknik: ${accounts.length} GHL-konton\n`);
for (const a of accounts) console.log(`  ${a.platform} (${a.type}) — utgången: ${a.isExpired}`);

console.log("\n1) GBP dyker upp som kanal hos DT (som HAR GBP kopplad)\n");
const synliga = synligaKanaler(accounts, false);
kontroll(synliga.includes("google"), `synligaKanaler() innehåller "google" för DT: [${synliga.join(", ")}]`);
kontroll(arAnsluten("google", accounts), "arAnsluten('google', DTs konton) === true");
kontroll(!arUtgangen("google", accounts), "GBP är inte markerad utgången hos DT (mätt av STATUS.md: inget utgånget)");

console.log("\n2) Tenant UTAN GBP ser den inte (omvänt test, hittepå-konton utan google)\n");
const utanGoogle = accounts.filter((a) => a.platform.toLowerCase() !== "google");
const synligaUtan = synligaKanaler(utanGoogle, false);
kontroll(!synligaUtan.includes("google"), `Utan ett google-konto i listan visas inte "google": [${synligaUtan.join(", ")}]`);

console.log("\n3) En utgången koppling visas ändå (simulerat — DT har ingen utgången just nu)\n");
const simuleratUtgangen = [...utanGoogle, { platform: "google", isExpired: true, id: "x", name: "test", type: "location" }];
kontroll(synligaKanaler(simuleratUtgangen, false).includes("google"), "En simulerat utgången GBP-koppling syns ändå i listan");
kontroll(arUtgangen("google", simuleratUtgangen), "...och klassas korrekt som 'behöver förnyas', inte 'ej kopplad'");

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
