// DRIV-3 — prisrutan. Läser PRIS-1:s säljlager (samma Supabase-projekt som Cockpit,
// verifierat live 2026-08-15: `v_sl_publik` finns och har 7 rader för Displayteknik).
//
// ⚠ Tenantnyckeln i säljlagret är MySales Coachs `coach_users.id`, INTE Cockpits
// `clients.id`. De är olika id:n för samma kund — verifierat live att
// coach_users.id=8c99b995…, ghl_location_id=cZzTvCeFRDLinf5Ha3je (samma location som
// resten av DRIV). Bara DT seedas i den här etappen, så id:t är hårdkodat precis som
// DT_CLIENT_ID är på andra ställen i DRIV.
//
// `v_sl_publik` (inte `v_sl_gallande` eller `sl_prices`) med flit — den vyn saknar VARJE
// inköpskolumn. Kortet ska aldrig kunna visa ett internt kalkylunderlag av misstag.

import { supabaseService } from "@/lib/supabase-admin";

const SALJLAGER_USER_ID = "8c99b995-90c2-41fb-b12e-3f3d2469df77";

export interface Prisrad {
  artikelnr: string;
  benamning: string;
  kategori: string | null;
  pris: number | null; // null = pris tas fram i samtal, t.ex. installation
  enhet: string | null;
  franPris: boolean;
  giltigFran: string;
  tb?: Tb; // PRIS2-5, endast satt för artiklar med bekräftad leverantörskoppling
}

export async function hamtaPrislista(): Promise<Prisrad[]> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("v_sl_publik")
    .select("artikelnr, benamning, kategori, pris, enhet, fran_pris, giltig_fran")
    .eq("user_id", SALJLAGER_USER_ID)
    .order("artikelnr");
  if (error) throw new Error(`Säljlagret svarade inte: ${error.message}`);
  return ((data as Array<{ artikelnr: string; benamning: string; kategori: string | null; pris: number | null; enhet: string | null; fran_pris: boolean; giltig_fran: string }> | null) || []).map((r) => ({
    artikelnr: r.artikelnr,
    benamning: r.benamning,
    kategori: r.kategori,
    pris: r.pris,
    enhet: r.enhet,
    franPris: r.fran_pris,
    giltigFran: r.giltig_fran,
  }));
}

// PRIS2-5 — TB, endast för DRIV-kortet i Cockpit (aldrig kundportalen /k/…, aldrig
// assistenten). Läser DÄRFÖR `v_sl_gallande`, inte `v_sl_publik` — den enda platsen i DRIV
// som medvetet läser det interna kalkylunderlaget. `tb_kr`/`tb_pct` är förräknade av
// PRIS2-5-importen (samma formel som Prislisteagenten, `landatSek`/`tb` i kalkyl.ts) och
// finns bara för artiklar som fått en bekräftad leverantörskoppling i artikellagret.
export interface Tb {
  kr: number;
  pct: number;
  bastaInkopsvag: string | null;
}

export async function hamtaTb(): Promise<Map<string, Tb>> {
  const sb = supabaseService();
  const { data, error } = await sb
    .from("v_sl_gallande")
    .select("artikelnr, tb_kr, tb_pct, kalkyl_underlag")
    .eq("user_id", SALJLAGER_USER_ID)
    .not("tb_kr", "is", null);
  if (error) return new Map(); // TB är ett tillägg, en trasig läsning ska aldrig fälla kortet
  const karta = new Map<string, Tb>();
  for (const r of (data as Array<{ artikelnr: string; tb_kr: number; tb_pct: number; kalkyl_underlag: { basta_inkopsvag?: string } | null }>) || []) {
    karta.set(r.artikelnr, { kr: r.tb_kr, pct: r.tb_pct, bastaInkopsvag: r.kalkyl_underlag?.basta_inkopsvag || null });
  }
  return karta;
}
