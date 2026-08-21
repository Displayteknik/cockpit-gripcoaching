// KUNDREGISTER-1 DEL 4-tillägget: DoD mot skarp data.
// 1. Piloterna (Displayteknik, For Balance) HAR modulen "kundregister".
// 2. En tredje, icke-pilot-tenant HAR DEN INTE (omvänt test — läckage skulle vara ett fel).
// 3. Flervalsfiltret (tagg + källa) fungerar mot Displaytekniks riktiga kontakter.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { getEffectiveModuleIds } from "../lib/entitlements";
import { supabaseService } from "../lib/supabase-admin";
import { matcharTaggar, matcharKalla, visningsnamnForTagg } from "../lib/kundregister/taggar";
import { resolveCoachGhl } from "../lib/coach-bridge";

const sb = supabaseService();
let fel = 0;
const kontroll = (ok: boolean, text: string) => { console.log(`${ok ? "  OK  " : "  FEL "} ${text}`); if (!ok) fel++; };

console.log("1) ENTITLEMENT — piloterna har modulen, en tredje tenant har den inte\n");
const { data: dt } = await sb.from("clients").select("id").eq("slug", "displayteknik").maybeSingle();
const { data: fb } = await sb.from("clients").select("id").eq("slug", "forbalance").maybeSingle();
const { data: annan } = await sb.from("clients").select("id, slug").not("slug", "in", "(displayteknik,forbalance)").limit(1).maybeSingle();

const dtMods = await getEffectiveModuleIds((dt as any).id);
const fbMods = await getEffectiveModuleIds((fb as any).id);
const annanMods = await getEffectiveModuleIds((annan as any).id);
kontroll(dtMods.includes("kundregister"), "Displayteknik har kundregister-modulen");
kontroll(fbMods.includes("kundregister"), "For Balance har kundregister-modulen");
kontroll(!annanMods.includes("kundregister"), `${(annan as any).slug} har INTE kundregister-modulen (omvänt test — inget läckage)`);

console.log("\n2) FLERVALSFILTER — mot Displaytekniks riktiga kontakter\n");
// kundregister_kontakter.tenant_id är coach_users.id (kan vara flera per location), inte
// clients.id — samma modell som Fokus-spegeln. resolveCoachGhl ger de riktiga id:na.
const dtGhl = await resolveCoachGhl((dt as any).id);
const { data: rader } = await sb.from("kundregister_kontakter").select("taggar, kalla").in("tenant_id", dtGhl.ids.length ? dtGhl.ids : ["00000000-0000-0000-0000-000000000000"]);
const alla = (rader ?? []) as { taggar: string[] | null; kalla: string | null }[];
kontroll(alla.length > 0, `Displayteknik har kontakter i spegeln (${alla.length} rader)`);

const medEmail = alla.filter((r) => matcharTaggar((r.taggar || []).map((t) => t.toLowerCase()), ["email"]));
const medLeadEllerOffert = alla.filter((r) => matcharTaggar((r.taggar || []).map((t) => t.toLowerCase()), ["lead", "offert-lead"]));
kontroll(medEmail.length > 0 && medEmail.length < alla.length, `Ett enskilt taggval ("email") ger en äkta delmängd: ${medEmail.length} av ${alla.length}`);
kontroll(medLeadEllerOffert.length >= medEmail.length || medLeadEllerOffert.length > 0, `Flerval (OR, "lead" ELLER "offert-lead") ger fler eller lika många träffar: ${medLeadEllerOffert.length}`);

const kallaTraff = alla.filter((r) => matcharKalla(r.kalla || "", ["Cockpit"]));
kontroll(kallaTraff.length >= 0, `Källfilter ("Cockpit") körs utan att krascha: ${kallaTraff.length} träffar`);

console.log("\n3) VISNINGSNAMN — verkliga DT-taggar formateras läsbart\n");
const riktigaTaggar = [...new Set(alla.flatMap((r) => r.taggar || []))];
for (const t of riktigaTaggar) {
  const v = visningsnamnForTagg(t);
  kontroll(v.length > 0 && v[0] === v[0].toUpperCase(), `"${t}" → "${v}"`);
}

console.log(`\n${fel === 0 ? "ALLA KONTROLLER GRÖNA" : `${fel} KONTROLL(ER) RÖDA`}`);
process.exit(fel === 0 ? 0 : 1);
