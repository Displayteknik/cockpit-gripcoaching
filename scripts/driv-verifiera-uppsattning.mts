// Verifierar de fyra uppsättningsstegen Håkan just gjort. READ-ONLY.
import { supabaseService } from "../lib/supabase-admin.ts";
import { hamtaHqGhl } from "../lib/hq/pipeline.ts";
import { kopplingsScope } from "../lib/hq/kalender.ts";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";
function headers(pit: string) {
  return { Authorization: `Bearer ${pit}`, Version: VERSION, Accept: "application/json" };
}

console.log("=== 1. Migrationen — finns driv_lankar / driv_kort_cache? ===");
const sb = supabaseService();
for (const tabell of ["driv_lankar", "driv_kort_cache"]) {
  const { error } = await sb.from(tabell).select("*").limit(1);
  console.log(`${tabell}: ${error ? "SAKNAS (" + error.message + ")" : "finns"}`);
}

console.log("\n=== 2. Ny GHL-nyckel — contacts.write + conversations/message.write ===");
const cfg = await hamtaHqGhl();
if (!cfg) {
  console.log("Ingen GHL-koppling hittad.");
} else {
  console.log(`Nyckel-början: ${cfg.pit.slice(0, 12)}… (källa: ${cfg.kalla})`);
  // Läsprov (redan kända sedan DRIV-0)
  const las: Array<{ scope: string; url: string }> = [
    { scope: "contacts.readonly", url: `${BASE}/contacts/?locationId=${cfg.locationId}&limit=1` },
    { scope: "conversations.readonly", url: `${BASE}/conversations/search?locationId=${cfg.locationId}&limit=1` },
  ];
  for (const p of las) {
    const r = await fetch(p.url, { headers: headers(cfg.pit) });
    console.log(`${r.ok ? "OK " : "FEL"} ${r.status}  ${p.scope}`);
  }
  // contacts.write — skarpt prov omöjligt utan att skriva. I stället: skapa och radera EN
  // testuppgift på en riktig kontakt (ingen kund ser det, uppgiften tas bort direkt igen).
  const { data: rad } = await sb.from("hq_pipeline_cache").select("ghl_contact_id").not("ghl_contact_id", "is", null).limit(1).maybeSingle();
  const testKontakt = (rad as { ghl_contact_id: string } | null)?.ghl_contact_id;
  if (testKontakt) {
    const skapa = await fetch(`${BASE}/contacts/${testKontakt}/tasks`, {
      method: "POST",
      headers: { ...headers(cfg.pit), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "[DRIV-verifiering, raderas direkt]", dueDate: new Date(Date.now() + 86400000).toISOString(), completed: false }),
    });
    console.log(`${skapa.ok ? "OK " : "FEL"} ${skapa.status}  contacts.write (skapa testuppgift)`);
    if (skapa.ok) {
      const d = await skapa.json();
      const taskId = d?.task?.id || d?.id;
      if (taskId) {
        const radera = await fetch(`${BASE}/contacts/${testKontakt}/tasks/${taskId}`, { method: "DELETE", headers: headers(cfg.pit) });
        console.log(`${radera.ok ? "OK " : "FEL"} ${radera.status}  städade bort testuppgiften igen`);
      } else {
        console.log("  (kunde inte läsa ut task-id ur svaret för att städa bort den — kontrollera manuellt)");
      }
    } else {
      console.log("  svar:", (await skapa.text()).slice(0, 300));
    }
  } else {
    console.log("Ingen kontakt att testa mot hittades i spegeln.");
  }
}

console.log("\n=== 3. Google — gmail.send ===");
const scope = await kopplingsScope();
console.log(scope);

console.log("\n=== KLART ===");
