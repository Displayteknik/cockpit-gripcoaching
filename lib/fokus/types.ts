// Fokusmotorn — kärntyper. Rena datatyper, ingen framework-koppling.
// Portad från MySales Coach (standalone) → Cockpit /k/fokus. Håll i synk med källan.

/** De fyra generiska stegtyperna (spec §2.1). Branschoberoende. */
export type StegTyp = "kontakt" | "mote" | "offert" | "uppfoljning";

/** Pengalinjens zoner (spec §3.3). */
export type Zon = "frisk" | "risk" | "kallnar";

/** UI-färgnyckel per brådskenivå (spec §2.1 / §5.2). */
export type Farg = "neutral" | "amber" | "red" | "cold";

/** Var kortet hamnar i UI:t. */
export type Sektion = "dagens_drag" | "avgor";

/** Rå affär, som den läses ur GHL / spegeltabellen. */
export interface RawOpportunity {
  id: string;
  namn: string;
  foretag: string;
  varde: number;
  stegId: string;
  status: string;
  lastStageChangeAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  kalla?: string;
  /** GHL-kontakt-id → deeplink till MySales. */
  ghlContactId?: string;
}

/** Konfiguration för ett enskilt GHL-steg → generisk typ + vikt + SLA. */
export interface StegRegel {
  typ: StegTyp;
  namn: string;
  /** Stegvikt (spec §2.1). Senare steg = närmare pengarna. */
  vikt: number;
  /** Max antal dagar i steget innan SLA bryts. null = ingen dagsgräns (t.ex. "tills mötesdatum"). */
  sla: number | null;
}

/** Tenant-konfiguration — allt en ny verksamhet ställer in (spec §2.2, §6). */
export interface TenantConfig {
  pipelineId: string;
  pipelineNamn: string;
  wonStageId: string;
  lostStageId: string;
  /** stegId → regel. Nyckeln till "vilken verksamhet som helst" (spec §6). */
  stegMap: Record<string, StegRegel>;
  /** Fallback-regel för steg som saknas i stegMap. */
  fallback: StegRegel;
}

/** Ett färdigberäknat kort — det dashboarden och digesten läser. */
export interface ScoredCard {
  id: string;
  namn: string;
  foretag: string;
  varde: number;
  stegNamn: string;
  typ: StegTyp;
  dagarISteget: number;
  sla: number | null;
  dagarOverSla: number;
  vardepoang: number;
  bradskepoang: number;
  stegvikt: number;
  prioritet: number;
  zon: Zon;
  farg: Farg;
  sektion: Sektion;
  okantVarde: boolean;
  /** GHL-kontakt-id → deeplink till MySales. */
  ghlContactId?: string;
  /** Deterministisk lägesbild ur data (spec §3.4 punkt 3 — alltid sann). */
  lagesText: string;
  /** Regelbaserat rekommenderat drag (spec §3.4 punkt 4). */
  rekommenderatDrag: string;
}

/** Resultatet av en prioriteringskörning — motsvarar dagens_drag-vyn (spec §6). */
export interface Prioritering {
  dagensDrag: ScoredCard[];
  avgor: ScoredCard[];
  pengalinjen: { frisk: number; risk: number; kallnar: number; totalt: number };
  antalKallnar: number;
}
