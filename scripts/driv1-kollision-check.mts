// Kollar om de tre delade e-postadresserna hör till SAMMA ghl_contact_id (flera affärer,
// samma person — ingen tvetydighet) eller OLIKA ghl_contact_id (äkta kollision).
import { supabaseService } from "../lib/supabase-admin.ts";

const sb = supabaseService();
const { data } = await sb
  .from("hq_pipeline_cache")
  .select("ghl_opportunity_id, epost, ghl_contact_id, namn, harledd_status");

const alla = (data || []) as Array<{ ghl_opportunity_id: string; epost: string | null; ghl_contact_id: string | null; namn: string | null; harledd_status: string }>;
const perEpost = new Map<string, typeof alla>();
for (const r of alla) {
  if (!r.epost) continue;
  const lista = perEpost.get(r.epost) || [];
  lista.push(r);
  perEpost.set(r.epost, lista);
}
for (const [epost, lista] of perEpost) {
  if (lista.length < 2) continue;
  const unikaContactIds = new Set(lista.map((r) => r.ghl_contact_id));
  console.log(`\n${epost} — ${lista.length} affärer, ${unikaContactIds.size} unika ghl_contact_id`);
  for (const r of lista) console.log(`  opp=${r.ghl_opportunity_id} contact=${r.ghl_contact_id} namn=${r.namn} status=${r.harledd_status}`);
  console.log(unikaContactIds.size > 1 ? "  => ÄKTA KOLLISION (olika kontakter, samma adress)" : "  => samma person, flera affärer (ingen tvetydighet)");
}
