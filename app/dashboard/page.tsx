"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Car, Palette, Image as ImageIcon, FileText, Sparkles, BookOpen, ExternalLink,
  Pencil, Plus, TrendingUp, MessageSquare, Activity, ChevronRight,
} from "lucide-react";

interface Stats {
  productCount: number | null;
  productSold: number | null;
  blogPosts: number | null;
  blogDrafts: number | null;
  socialPosts: number;
  socialDrafts: number;
  queued: number | null;
  leads: number;
  newLeads: number;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  link: string | null;
  created_at: string;
}

interface ActiveClient { id: string; name: string; industry: string | null; primary_color: string; resource_module: string }

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [client, setClient] = useState<ActiveClient | null>(null);

  useEffect(() => {
    fetch("/api/activity").then((r) => r.json()).then(setActivity).catch(() => {});
    fetch("/api/clients/active").then((r) => r.json()).then((c: ActiveClient) => {
      setClient(c);
      loadStats(c);
    }).catch(() => {});
  }, []);

  const loadStats = async (c: ActiveClient) => {
    const isAutomotive = c.resource_module === "automotive";
    const isArt = c.resource_module === "art";

    const productAll = isAutomotive
      ? supabase.from("hm_vehicles").select("id", { count: "exact", head: true }).eq("client_id", c.id)
      : isArt
      ? supabase.from("art_works").select("id", { count: "exact", head: true }).eq("client_id", c.id)
      : null;
    const productSold = isAutomotive
      ? supabase.from("hm_vehicles").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("is_sold", true)
      : isArt
      ? supabase.from("art_works").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "sold")
      : null;

    const blogAll = supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("published", true);
    const blogDraftQ = supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("published", false);
    const queueQ = supabase.from("hm_blog_queue").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "queued");

    const [p, ps, b, bd, sAll, sDraft, queue, leadsAll, leadsNew] = await Promise.all([
      productAll, productSold, blogAll, blogDraftQ,
      supabase.from("hm_social_posts").select("id", { count: "exact", head: true }).eq("client_id", c.id),
      supabase.from("hm_social_posts").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "draft"),
      queueQ,
      supabase.from("hm_leads").select("id", { count: "exact", head: true }).eq("client_id", c.id),
      supabase.from("hm_leads").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "new"),
    ]);

    setStats({
      productCount: p?.count ?? null,
      productSold: ps?.count ?? null,
      blogPosts: b?.count ?? null,
      blogDrafts: bd?.count ?? null,
      socialPosts: sAll.count || 0,
      socialDrafts: sDraft.count || 0,
      queued: queue?.count ?? null,
      leads: leadsAll.count || 0,
      newLeads: leadsNew.count || 0,
    });
  };

  const module = client?.resource_module || "generic";
  const isAutomotive = module === "automotive";
  const isArt = module === "art";

  const productConfig = isAutomotive
    ? { label: "Fordon i lager", soldLabel: "sålda", icon: Car, href: "/dashboard/fordon", actionTitle: "Lägg upp fordon", actionDesc: "Bilar, ATV, UTV, släp — med bilder, specs och bytesstatus.", actionCta: "Öppna fordon" }
    : isArt
    ? { label: "Verk till salu", soldLabel: "sålda", icon: Palette, href: "/dashboard/verk", actionTitle: "Lägg upp verk", actionDesc: "Måleri, skulptur, foto — med teknik, mått, pris och status.", actionCta: "Öppna verk" }
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Översikt · {new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="font-display text-3xl font-bold text-gray-900 flex items-center gap-3">
            {client && <span className="w-3 h-3 rounded-full" style={{ background: client.primary_color }} />}
            {client?.name || "Cockpit"}
          </h1>
          <p className="text-gray-500 mt-1">{client?.industry ? `${client.industry} · ` : ""}Allt du behöver för att driva klientens försäljning — samlat.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {productConfig && (
          <StatCard
            label={productConfig.label}
            value={stats && stats.productCount !== null ? (stats.productCount - (stats.productSold || 0)) : "—"}
            sub={stats && stats.productSold !== null ? `${stats.productSold} ${productConfig.soldLabel}` : ""}
            icon={productConfig.icon}
            color="blue"
          />
        )}
        <StatCard label="Bloggartiklar" value={stats?.blogPosts ?? "—"} sub={stats ? `${stats.blogDrafts ?? 0} utkast` : ""} icon={FileText} color="emerald" />
        <StatCard label="Social-inlägg" value={stats?.socialPosts ?? "—"} sub={stats ? `${stats.socialDrafts} utkast` : ""} icon={Sparkles} color="purple" />
        <StatCard label="Nya leads" value={stats?.newLeads ?? "—"} sub={stats ? `${stats.leads} totalt` : ""} icon={MessageSquare} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="Skapa social-inlägg"
          description="Instagram eller Facebook — konverterande hooks baserat på ditt lager."
          href="/dashboard/social"
          cta="Öppna generator"
          icon={Sparkles}
          color="purple"
        />
        <ActionCard
          title="Blogg-maskinen"
          description={stats?.queued ? `${stats.queued} ämnen i kön — nästa kör ${nextCronText()}` : "Generera nya artiklar automatiskt."}
          href="/dashboard/blogg-maskin"
          cta="Hantera ämnen"
          icon={BookOpen}
          color="emerald"
        />
        {isArt && (
          <ActionCard
            title="Utställningar"
            description="Hantera kommande, pågående och genomförda utställningar."
            href="/dashboard/utstallningar"
            cta="Öppna utställningar"
            icon={ImageIcon}
            color="emerald"
          />
        )}
        <ActionCard
          title="Redigera sidor"
          description="Puck-editorn — drag & drop med designverktyg."
          href="/dashboard/sidor"
          cta="Öppna sidor"
          icon={Pencil}
          color="blue"
        />
        {productConfig && (
          <ActionCard
            title={productConfig.actionTitle}
            description={productConfig.actionDesc}
            href={productConfig.href}
            cta={productConfig.actionCta}
            icon={Plus}
            color="amber"
          />
        )}
      </div>

      {activity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Senaste aktivitet
          </h2>
          <div className="space-y-2">
            {activity.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-b-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activityColor(a.type)}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{a.title}</div>
                    <div className="text-xs text-gray-400">{relativeTime(a.created_at)}</div>
                  </div>
                </div>
                {a.link && (
                  <Link href={a.link} className="text-gray-400 hover:text-brand-blue flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-display text-lg font-bold text-gray-900 mb-4">Snabblänkar</h2>
        <div className="flex flex-wrap gap-3">
          {isAutomotive && <QuickLink href="/" external>Visa publik sajt</QuickLink>}
          <QuickLink href="/dashboard/sidor">Alla sidor</QuickLink>
          {productConfig && <QuickLink href={productConfig.href}>{isArt ? "Verk" : "Fordon"}</QuickLink>}
          {isArt && <QuickLink href="/dashboard/utstallningar">Utställningar</QuickLink>}
          <QuickLink href="/dashboard/blogg">Blogg</QuickLink>
          <QuickLink href="/dashboard/social">Social generator</QuickLink>
          <QuickLink href="/dashboard/blogg-maskin">Blogg-maskin</QuickLink>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-display font-bold text-gray-900">Tips för veckan</h3>
            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
              Bäst tider för sociala inlägg: <strong>tisdag–torsdag 07:00, 12:00, 20:00</strong>. Lägg upp
              3 st/vecka. Rotera mellan <em>fråge-hook</em>, <em>berättelse-öppning</em> och <em>djärvt påstående</em>.
              En CTA per inlägg. Svenska tecken alltid korrekt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function activityColor(type: string): string {
  if (type.startsWith("blog")) return "bg-emerald-500";
  if (type.startsWith("social")) return "bg-purple-500";
  if (type.startsWith("share")) return "bg-blue-500";
  if (type.includes("approve")) return "bg-emerald-600";
  if (type.includes("reject")) return "bg-red-500";
  if (type.startsWith("client")) return "bg-amber-500";
  return "bg-gray-400";
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nu";
  if (m < 60) return `${m} min sen`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h sen`;
  const d = Math.floor(h / 24);
  return `${d} d sen`;
}

function nextCronText() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const cronDays = [1, 3, 5];
  for (let offset = 0; offset < 8; offset++) {
    const d = (day + offset) % 7;
    if (cronDays.includes(d)) {
      if (offset === 0 && hour >= 7) continue;
      const names = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
      return `${offset === 0 ? "idag" : offset === 1 ? "imorgon" : names[d]} kl 07:00`;
    }
  }
  return "snart";
}

const colorMap = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  purple: "bg-purple-50 text-purple-600 border-purple-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
} as const;

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: number | string; sub?: string; icon: React.ComponentType<{ className?: string }>; color: keyof typeof colorMap }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 font-display">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionCard({ title, description, href, cta, icon: Icon, color }: { title: string; description: string; href: string; cta: string; icon: React.ComponentType<{ className?: string }>; color: keyof typeof colorMap }) {
  return (
    <Link href={href} className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-brand-blue hover:shadow-sm transition-all flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${colorMap[color]} flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-bold text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
        <div className="text-sm font-medium text-brand-blue mt-3 group-hover:underline">{cta} →</div>
      </div>
    </Link>
  );
}

function QuickLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 border border-gray-200 transition-colors">
      {children}
      {external && <ExternalLink className="w-3 h-3 text-gray-400" />}
    </Link>
  );
}
