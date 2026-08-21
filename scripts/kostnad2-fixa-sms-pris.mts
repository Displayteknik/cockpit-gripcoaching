// KOSTNAD-2 (HELG-1 DEL 8): SMS-priset i ai_pricing stod på 0 kr med fel enhetsetikett
// ("bild"). sendSms() korrigerar redan varje ENSKILD händelse med 46elks egna returnerade
// pris (lib/sms/elks.ts::skrivKostnad) — men den STATISKA raden andra vyer läser (t.ex.
// K3-INKÖP:s kurs-uppslagning) visade fortfarande noll. Sätter samma fallback-belopp som
// koden redan använder för förhandsvisning (smsCostPerPart(), 0.35 kr) så bokföringen är
// sann även innan det första riktiga anropet korrigerat den enskilda raden.
import { readFileSync } from "node:fs";
import path from "node:path";
const ROOT = process.cwd();
for (const line of readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
import { supabaseService } from "../lib/supabase-admin";
const sb = supabaseService();

const { data: fore } = await sb.from("ai_pricing").select("*").eq("provider", "elks").eq("model", "sms").maybeSingle();
console.log("FÖRE:", JSON.stringify(fore));

// media_enhet är begränsat av en check-constraint till ('bild','sekund') — byggd för
// bild/video-priser. "bild" betyder här bara "per diskret enhet", vilket stämmer för ett
// SMS också (ett pris per skickat meddelande) — bara PRISET var fel (0 kr), inte formen.
const { error } = await sb
  .from("ai_pricing")
  .update({ pris_per_media: 0.35, uppdaterad: new Date().toISOString() })
  .eq("provider", "elks")
  .eq("model", "sms");
if (error) { console.error("FEL:", error.message); process.exit(1); }

const { data: efter } = await sb.from("ai_pricing").select("*").eq("provider", "elks").eq("model", "sms").maybeSingle();
console.log("EFTER:", JSON.stringify(efter));
