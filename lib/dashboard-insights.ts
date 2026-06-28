// Delad "Att fokusera på / Att göra nu"-motor.
// Räknar 1–N konkreta nästa-steg ur kundens EGEN dashboard-data.
// Används av både kund-Statistik (CustomerAnalytics) och kund-översikt (/k) så
// logiken aldrig driftar isär. Returnerar ett icon-TOKEN (sträng) — varje vy
// mappar token → faktisk ikon, så funktionen kan köras både server- och clientside.

export type FocusIcon = "trophy" | "target" | "clicks" | "trend" | "search" | "repeat" | "sparkles";

export interface FocusInsight {
  icon: FocusIcon;
  accent: string;
  title: string;
  detail: string;
}

// Minimal strukturell form — både CustomerAnalytics "Dashboard" och
// buildDashboardData()-returen uppfyller den.
interface InsightInput {
  kpi: { gsc_impressions: number; gsc_clicks: number; gsc_avg_position: number | null; gsc_keyword_count: number };
  position_distribution: { top20: number };
  brand_split: { brand: { clicks: number }; non_brand: { clicks: number } };
  quick_wins: Array<{ query: string; impressions: number; avg_position: number | null }>;
  queries_top: Array<{ query: string; avg_position: number | null }>;
  ga4?: { ai: { sessions: number } } | null;
}

export function computeFocusInsights(data: InsightInput): FocusInsight[] {
  const insights: FocusInsight[] = [];
  const k = data.kpi;
  const pd = data.position_distribution;
  const hasGa4 = !!data.ga4;
  const qw0 = data.quick_wins[0];
  const totImp = k.gsc_impressions, totClk = k.gsc_clicks, avgPos = k.gsc_avg_position, kwCount = k.gsc_keyword_count;
  // Närmaste riktiga klättrings-möjlighet: lägst placering men utanför topp 3 (inte redan etta).
  const bestKw = data.queries_top.filter((q) => q.avg_position != null && q.avg_position > 3).sort((a, b) => (a.avg_position! - b.avg_position!))[0];

  if (qw0) insights.push({ icon: "trophy", accent: "amber", title: `"${qw0.query}" är din snabbaste möjlighet`, detail: `Du syns redan på plats ${qw0.avg_position} (${qw0.impressions.toLocaleString("sv-SE")} visningar). Lyfts sidan till topp 3 ger det ungefär ${Math.round(qw0.impressions * 0.25)} fler besök i månaden.` });
  if (pd.top20 > 0) insights.push({ icon: "target", accent: "blue", title: `${pd.top20} sökord ligger på sida 2 i Google`, detail: `De är närmast att nå sida 1. Öppna "Var rankar du på Google" på Statistik och titta på bandet 11–20.` });
  if (totImp > 0 && totClk === 0) insights.push({ icon: "clicks", accent: "pink", title: "Du syns i Google men får inga klick än", detail: "Din sajt visas i sökresultaten men ingen har klickat. Skriv mer lockande sidtitlar och beskrivningar — och jobba dig uppåt i placering — så blir visningar till besök." });
  if (avgPos !== null && avgPos > 15 && bestKw) insights.push({ icon: "trend", accent: "blue", title: `Du ligger lågt i Google (snitt plats ${avgPos})`, detail: `Du syns men långt ner. Innehåll som svarar tydligare på frågan lyfter dig uppåt. Närmast toppen: "${bestKw.query}" (plats ${bestKw.avg_position}).` });
  if (kwCount > 0 && kwCount < 20) insights.push({ icon: "search", accent: "emerald", title: `Du syns på ${kwCount} sökord`, detail: `Fler sidor och inlägg om dina ämnen ger fler vägar in. Klicka "Vad ska du ranka på?" på SEO & AEO-sidan för förslag.` });
  const bClicks = data.brand_split.brand.clicks;
  const totClicks = bClicks + data.brand_split.non_brand.clicks;
  if (totClicks >= 5 && bClicks / totClicks > 0.7) insights.push({ icon: "repeat", accent: "purple", title: `${Math.round((bClicks / totClicks) * 100)}% av klicken kommer från ditt eget namn`, detail: `Du hittas mest av folk som redan känner till dig. Mer innehåll om det du erbjuder når nya kunder.` });
  if (hasGa4 && data.ga4!.ai.sessions === 0) insights.push({ icon: "sparkles", accent: "violet", title: "Inga besök från AI-sökmotorer än", detail: "ChatGPT, Copilot och Perplexity skickar inga besök ännu. Tydliga svar, jämförelser och konkreta siffror gör att de börjar tipsa om dig." });
  // Säkerställ alltid minst ett konkret nästa steg.
  if (insights.length === 0) insights.push({ icon: "sparkles", accent: "emerald", title: "Fyll i din Brand-profil", detail: "Ju mer ifylld din profil är (din röst, ditt erbjudande, dina kunder), desto skarpare blir sökords-förslagen och allt AI skapar åt dig." });

  return insights;
}
