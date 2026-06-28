import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { buildDashboardData } from "@/lib/dashboard-data";
import { computeFocusInsights, type FocusIcon, type FocusInsight } from "@/lib/dashboard-insights";
import { Sparkles, Users, Target, Trophy, FileText, AlertTriangle, TrendingUp, ArrowRight, Eye, Search, Bot, BookOpen, Zap, MousePointerClick, Repeat } from "lucide-react";

// Token → ikon för "Att göra nu" (delad insikts-motor).
const FOCUS_ICON: Record<FocusIcon, React.ComponentType<{ className?: string }>> = {
  trophy: Trophy, target: Target, clicks: MousePointerClick, trend: TrendingUp,
  search: Search, repeat: Repeat, sparkles: Sparkles,
};

export default async function CustomerHome() {
  const session = await getCustomerSession();
  if (!session) return null;

  const has = (k: string) => session.features.includes(k);
  const showSocialStats = has("skapa") || has("veckoplan") || has("dm");
  const showSeo = has("seo");
  const showVisitors = has("besokare");
  const primary = session.primary_color;

  const sb = supabaseService();
  const cid = session.client_id;
  const now = Date.now();
  const day = 86400000;
  const since30 = new Date(now - 30 * day).toISOString();

  // Hämta bara den statistik som är relevant för kundens moduler.
  const [postsRes, contactsRes, qualityRes, seoAuditRes, seoKwRes, visitsRes] = await Promise.all([
    showSocialStats
      ? sb.from("hm_social_posts").select("status").eq("client_id", cid)
      : Promise.resolve({ data: null }),
    showSocialStats
      ? sb.from("cockpit_dm_contacts").select("stage").eq("client_id", cid)
      : Promise.resolve({ data: null }),
    has("profil")
      ? sb.from("hm_brand_profile").select("usp, icp_primary, tone_rules, customer_quotes, booking_url").eq("client_id", cid).maybeSingle()
      : Promise.resolve({ data: null }),
    showSeo
      ? sb.from("hm_seo_audits").select("seo_score, aeo_score, url, audited_at").eq("client_id", cid).order("audited_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    showSeo
      ? sb.from("hm_seo_keywords").select("current_rank").eq("client_id", cid)
      : Promise.resolve({ data: null }),
    showVisitors
      ? sb.from("hm_visits").select("ts").eq("client_id", cid).gte("ts", since30).limit(20000)
      : Promise.resolve({ data: null }),
  ]);

  const posts = (postsRes.data as { status: string }[] | null) || [];
  const totalPosts = posts.length;
  const drafts = posts.filter((p) => p.status === "draft").length;
  const published = posts.filter((p) => p.status === "published").length;
  const contacts = (contactsRes.data as { stage: string }[] | null) || [];
  const totalContacts = contacts.length;
  const wonContacts = contacts.filter((c) => c.stage === "won").length;

  const profile = (qualityRes.data || {}) as Record<string, unknown>;
  const profileFilled = ["usp", "icp_primary", "tone_rules", "customer_quotes", "booking_url"].filter(
    (k) => profile[k] && String(profile[k]).length > 10
  ).length;
  const profileOK = !has("profil") || profileFilled >= 4;

  const audit = seoAuditRes.data as { seo_score?: number; aeo_score?: number; url?: string; audited_at?: string } | null;
  const kws = ((seoKwRes.data as { current_rank: number | null }[] | null) || []);
  const kwCount = kws.length;
  const top10 = kws.filter((k) => k.current_rank != null && k.current_rank <= 10).length;
  const auditDate = audit?.audited_at ? new Date(audit.audited_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : null;

  // Besök: totaler + 14-dagars trend för sparkline.
  const visits = (visitsRes.data as { ts: string }[] | null) || [];
  const visitTimes = visits.map((v) => +new Date(v.ts));
  const visits24 = visitTimes.filter((t) => t >= now - day).length;
  const visits7 = visitTimes.filter((t) => t >= now - 7 * day).length;
  const visits30 = visitTimes.length;
  const spark = Array.from({ length: 14 }, (_, i) => {
    const start = new Date(now - (13 - i) * day);
    start.setHours(0, 0, 0, 0);
    const s = +start;
    return visitTimes.filter((t) => t >= s && t < s + day).length;
  });

  // "Att göra nu" — samma insikts-motor som Statistik, men först på översikten så
  // kunden direkt ser vad han ska göra härnäst. Bara om SEO/besökar-data finns.
  let focusInsights: FocusInsight[] = [];
  if (showSeo || showVisitors) {
    try {
      const dash = await buildDashboardData(cid, 30);
      focusInsights = computeFocusInsights(dash).slice(0, 3);
    } catch {}
  }

  // Dagens datum till hero-bandet (stor bokstav).
  const todayRaw = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  // Snabb-chips i hero: leder med RIKTIG data (besök/sökord). Tekniska poäng sist
  // och tydligt märkta "Teknisk" så de inte läses som synlighet/ranking.
  const chips: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [];
  if (showVisitors) chips.push({ icon: Eye, label: `${visits30.toLocaleString("sv-SE")} besök / 30 dgr` });
  if (showSeo && kwCount > 0) chips.push({ icon: Target, label: `${kwCount} sökord följs` });
  if (showSocialStats) chips.push({ icon: FileText, label: `${published} publicerade` });
  if (showSeo && typeof audit?.seo_score === "number") chips.push({ icon: Search, label: `Teknisk SEO ${audit.seo_score}` });
  if (showSeo && typeof audit?.aeo_score === "number") chips.push({ icon: Bot, label: `Teknisk AEO ${audit.aeo_score}` });

  return (
    <div className="space-y-8">
      {/* HERO — kundens färg, premium-känsla, leder med siffror */}
      <div
        className="relative overflow-hidden rounded-3xl px-7 py-9 md:px-10 md:py-11 shadow-sm"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}e0 55%, ${primary}b3 100%)` }}
      >
        <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full bg-black/15 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-xs uppercase tracking-[0.2em] font-semibold text-white/70 mb-3">
            MySales Pro · {today}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white">Välkommen tillbaka</h1>
          <p className="text-white/80 mt-2 max-w-xl text-sm md:text-base">
            Här är läget för {session.client_name} just nu.
          </p>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mt-6">
              {chips.map((c, i) => {
                const Icon = c.icon;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white px-3.5 py-1.5 text-sm font-medium"
                  >
                    <Icon className="w-3.5 h-3.5 opacity-80" />
                    {c.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ATT GÖRA NU — det första kunden ser: 1–3 konkreta nästa steg ur egen data */}
      {focusInsights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: primary }} /> Att göra nu
            </h2>
            {showVisitors && (
              <Link
                href="/k/besokare"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: primary }}
              >
                Se mer i Statistik <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {focusInsights.map((a, i) => {
              const Icon = FOCUS_ICON[a.icon];
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${ACCENTS[a.accent] || ACCENTS.gray}`}>
                    <Icon className="w-[18px] h-[18px]" />
                  </span>
                  <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                  <div className="text-xs text-gray-600 mt-1 leading-relaxed">{a.detail}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!profileOK && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900 text-sm">Din profil behöver kompletteras</div>
            <div className="text-sm text-amber-800 mt-1">
              Ju mer din profil är ifylld, desto bättre blir AI:n på att skriva i din röst.{" "}
              <Link href="/k/profil" className="underline font-medium">Komplettera nu →</Link>
            </div>
          </div>
        </div>
      )}

      {/* SEO — din synlighet i sök */}
      {showSeo && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-gray-900 text-lg">Din SEO &amp; AEO</h2>
            <Link
              href="/k/seo"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: primary }}
            >
              Öppna SEO & AEO <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreStat label="Teknisk SEO" value={audit?.seo_score} hint="Hur välbyggd sidan är tekniskt (titel, rubriker, schema, laddtid). Säger INTE hur högt du rankar — din riktiga placering ser du under Statistik." />
            <ScoreStat label="Teknisk AEO" value={audit?.aeo_score} hint="Hur väl sidan är förberedd för AI-svar (tydliga svar, FAQ, struktur). Inte ett mått på trafik." />
            <StatCard label="Sökord du följer" value={kwCount} icon={Target} accent="purple" hint="Antal sökord du själv lagt till i din bevakningslista. (Sökord du faktiskt syns på i Google ser du under Statistik.)" />
            <StatCard label="Topp 10 på Google" value={top10} icon={Trophy} accent="amber" hint="Hur många av dina bevakade sökord som ligger på Googles första sida (plats 1–10)." />
          </div>
          <p className="text-xs text-gray-400">
            Poängen mäter sidans tekniska kvalitet — din faktiska synlighet (placering, klick, visningar) ser du under <strong>Statistik</strong>.
            {auditDate ? ` Senaste analys ${auditDate}.` : " Du har inte kört någon analys än — gör din första på SEO-sidan."}
          </p>
        </section>
      )}

      {/* Besökare — trafik med 14-dagars trend */}
      {showVisitors && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-gray-900 text-lg">Din trafik</h2>
            <Link
              href="/k/besokare"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: primary }}
            >
              Öppna full statistik <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex gap-7">
                <Metric value={visits30} label="Besök / 30 dgr" color={primary} big />
                <Metric value={visits7} label="7 dagar" color={primary} />
                <Metric value={visits24} label="24 timmar" color={primary} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-1.5 text-right">Senaste 14 dagarna</div>
                <Sparkline data={spark} color={primary} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Social-statistik */}
      {showSocialStats && (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-gray-900 text-lg">Ditt innehåll</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Inlägg totalt" value={totalPosts} icon={FileText} hint="Alla sociala inlägg du skapat i verktyget (utkast + publicerade)." />
            <StatCard label="Utkast" value={drafts} icon={Sparkles} accent="amber" hint="Inlägg som är skapade men inte publicerade än." />
            <StatCard label="Publicerade" value={published} icon={Trophy} accent="emerald" hint="Inlägg som har publicerats." />
            <StatCard label="Kunder i pipeline" value={`${wonContacts}/${totalContacts}`} icon={Users} accent="purple" hint="Vunna kunder av totalt antal kontakter i din DM-pipeline." />
          </div>
        </section>
      )}
    </div>
  );
}

const ACCENTS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  amber: "bg-amber-100 text-amber-600",
  emerald: "bg-emerald-100 text-emerald-600",
  purple: "bg-purple-100 text-purple-600",
  blue: "bg-blue-100 text-blue-600",
  pink: "bg-pink-100 text-pink-600",
  violet: "bg-violet-100 text-violet-600",
};

function StatCard({ label, value, icon: Icon, accent = "gray", hint }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: keyof typeof ACCENTS | string; hint?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ACCENTS[accent] || ACCENTS.gray}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="text-xs text-gray-500 font-medium leading-tight flex items-center gap-1">
          {label}
          {hint && <span title={hint} className="cursor-help"><BookOpen className="w-3 h-3 text-gray-300 flex-shrink-0" /></span>}
        </span>
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

// Teknisk SEO/AEO-poäng (0–100) — mäter sidans uppbyggnad, INTE ranking.
function ScoreStat({ label, value, hint }: { label: string; value?: number; hint?: string }) {
  const has = typeof value === "number";
  const tone = !has ? "#9ca3af" : value! >= 80 ? "#059669" : value! >= 60 ? "#d97706" : "#dc2626";
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        {/* Brickan färgas efter poängen (grön=bra) så det viktigaste talet poppar. */}
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${tone}1a` }}>
          <TrendingUp className="w-[18px] h-[18px]" style={{ color: tone }} />
        </span>
        <span className="text-xs text-gray-500 font-medium leading-tight flex items-center gap-1">
          {label}
          {hint && <span title={hint} className="cursor-help"><BookOpen className="w-3 h-3 text-gray-300 flex-shrink-0" /></span>}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums" style={{ color: tone }}>{has ? value : "—"}</span>
        {has && <span className="text-sm text-gray-400 font-medium">/100</span>}
      </div>
    </div>
  );
}

// Trafik-siffra (stora talet i klientfärg, mindre syskon i grått).
function Metric({ value, label, color, big = false }: { value: number; label: string; color: string; big?: boolean }) {
  return (
    <div>
      <div
        className={`font-bold font-display tabular-nums leading-none ${big ? "text-4xl" : "text-3xl text-gray-900"}`}
        style={big ? { color } : undefined}
      >
        {value.toLocaleString("sv-SE")}
      </div>
      <div className="text-xs text-gray-500 mt-1.5">{label}</div>
    </div>
  );
}

// Lättviktig sparkline (inline SVG, inga beroenden) — visar trafiktrend 14 dagar.
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 320;
  const h = 56;
  const pad = 3;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? pad : pad + (i * (w - pad * 2)) / (n - 1));
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${(h - pad).toFixed(1)} ${line} ${x(n - 1).toFixed(1)},${(h - pad).toFixed(1)}`;
  const gid = "spark-grad";
  const allZero = data.every((v) => v === 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none" role="img" aria-label="Trafiktrend 14 dagar">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!allZero && <polygon points={area} fill={`url(#${gid})`} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity={allZero ? 0.3 : 1} />
      {data.map((v, i) => v > 0 && <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={color} />)}
    </svg>
  );
}
