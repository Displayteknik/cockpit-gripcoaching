"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Car, Palette, Image as ImageIcon, FileText, Sparkles, BookOpen, ExternalLink,
  Pencil, Plus, MessageSquare, Activity, ArrowUpRight, Zap,
} from "lucide-react";
import { DashHero, LivePill, HeroChip, StatTile, TONES, type Tone } from "@/components/ui/dash";

interface Stats {
  productCount: number | null; productSold: number | null;
  blogPosts: number | null; blogDrafts: number | null;
  socialPosts: number; socialDrafts: number;
  queued: number | null; leads: number; newLeads: number;
}
interface ActivityItem { id: string; type: string; title: string; link: string | null; created_at: string }
interface ActiveClient { id: string; name: string; industry: string | null; primary_color: string; resource_module: string }

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [client, setClient] = useState<ActiveClient | null>(null);

  useEffect(() => {
    fetch("/api/activity").then((r) => r.json()).then(setActivity).catch(() => {});
    fetch("/api/clients/active").then((r) => r.json()).then((c: ActiveClient) => { setClient(c); loadStats(c); }).catch(() => {});
  }, []);

  const loadStats = async (c: ActiveClient) => {
    const isAutomotive = c.resource_module === "automotive";
    const isArt = c.resource_module === "art";
    const productAll = isAutomotive
      ? supabase.from("hm_vehicles").select("id", { count: "exact", head: true }).eq("client_id", c.id)
      : isArt ? supabase.from("art_works").select("id", { count: "exact", head: true }).eq("client_id", c.id) : null;
    const productSold = isAutomotive
      ? supabase.from("hm_vehicles").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("is_sold", true)
      : isArt ? supabase.from("art_works").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "sold") : null;
    const [p, ps, b, bd, sAll, sDraft, queue, leadsAll, leadsNew] = await Promise.all([
      productAll, productSold,
      supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("published", true),
      supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("published", false),
      supabase.from("hm_social_posts").select("id", { count: "exact", head: true }).eq("client_id", c.id),
      supabase.from("hm_social_posts").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "draft"),
      supabase.from("hm_blog_queue").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "queued"),
      supabase.from("hm_leads").select("id", { count: "exact", head: true }).eq("client_id", c.id),
      supabase.from("hm_leads").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("status", "new"),
    ]);
    setStats({
      productCount: p?.count ?? null, productSold: ps?.count ?? null,
      blogPosts: b?.count ?? null, blogDrafts: bd?.count ?? null,
      socialPosts: sAll.count || 0, socialDrafts: sDraft.count || 0,
      queued: queue?.count ?? null, leads: leadsAll.count || 0, newLeads: leadsNew.count || 0,
    });
  };

  const module = client?.resource_module || "generic";
  const isAutomotive = module === "automotive";
  const isArt = module === "art";
  const primary = client?.primary_color || "#6366f1";
  const inLager = stats && stats.productCount !== null ? stats.productCount - (stats.productSold || 0) : null;
  const dateStr = new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });

  const productConfig = isAutomotive
    ? { label: "Fordon i lager", soldLabel: "sålda", icon: Car, href: "/dashboard/fordon", actionTitle: "Lägg upp fordon", actionDesc: "Bilar, ATV, UTV, släp — med bilder, specs och bytesstatus.", actionCta: "Öppna fordon" }
    : isArt
    ? { label: "Verk till salu", soldLabel: "sålda", icon: Palette, href: "/dashboard/verk", actionTitle: "Lägg upp verk", actionDesc: "Måleri, skulptur, foto — teknik, mått, pris och status.", actionCta: "Öppna verk" }
    : null;

  return (
    <div className="space-y-6">
      <DashHero
        title={client?.name || "Cockpit"}
        subtitle={`${client?.industry ? `${client.industry} · ` : ""}Allt du behöver för att driva klientens försäljning — samlat.`}
        accent={primary}
        eyebrow={<LivePill label={dateStr} />}
        chips={stats && (
          <>
            {inLager !== null && <HeroChip icon={productConfig?.icon || Car} label={`${inLager} i lager`} />}
            <HeroChip icon={MessageSquare} label={`${stats.newLeads} nya leads`} />
            <HeroChip icon={Sparkles} label={`${stats.socialDrafts} utkast`} />
            <HeroChip icon={FileText} label={`${stats.blogPosts ?? 0} artiklar`} />
          </>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {productConfig && <StatTile i={0} label={productConfig.label} value={inLager} sub={stats && stats.productSold !== null ? `${stats.productSold} ${productConfig.soldLabel}` : ""} icon={productConfig.icon} tone="blue" />}
        <StatTile i={1} label="Bloggartiklar" value={stats?.blogPosts ?? null} sub={stats ? `${stats.blogDrafts ?? 0} utkast` : ""} icon={FileText} tone="emerald" />
        <StatTile i={2} label="Social-inlägg" value={stats?.socialPosts ?? null} sub={stats ? `${stats.socialDrafts} utkast` : ""} icon={Sparkles} tone="violet" />
        <StatTile i={3} label="Nya leads" value={stats?.newLeads ?? null} sub={stats ? `${stats.leads} totalt` : ""} icon={MessageSquare} tone="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard i={0} title="Skapa social-inlägg" description="Instagram eller Facebook — konverterande hooks baserat på ditt lager." href="/dashboard/social" cta="Öppna generator" icon={Sparkles} tone="violet" />
        <ActionCard i={1} title="Blogg-maskinen" description={stats?.queued ? `${stats.queued} ämnen i kön — nästa kör ${nextCronText()}` : "Generera nya artiklar automatiskt."} href="/dashboard/blogg-maskin" cta="Hantera ämnen" icon={BookOpen} tone="emerald" />
        {isArt && <ActionCard i={2} title="Utställningar" description="Hantera kommande, pågående och genomförda utställningar." href="/dashboard/utstallningar" cta="Öppna utställningar" icon={ImageIcon} tone="emerald" />}
        <ActionCard i={2} title="Redigera sidor" description="Puck-editorn — drag & drop med designverktyg." href="/dashboard/sidor" cta="Öppna sidor" icon={Pencil} tone="blue" />
        {productConfig && <ActionCard i={3} title={productConfig.actionTitle} description={productConfig.actionDesc} href={productConfig.href} cta={productConfig.actionCta} icon={Plus} tone="amber" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cw-reveal lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-gray-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: TONES.blue.grad, boxShadow: `0 6px 16px -6px rgba(${TONES.blue.rgb},.6)` }}>
              <Activity className="h-4 w-4 text-white" />
            </span>
            Senaste aktivitet
          </h2>
          {activity.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Inget än — börja skapa så dyker det upp här.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activity.slice(0, 8).map((a) => (
                <div key={a.id} className="group flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${activityColor(a.type)} ring-4 ring-current/10`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-800">{a.title}</div>
                      <div className="text-xs text-gray-400">{relativeTime(a.created_at)}</div>
                    </div>
                  </div>
                  {a.link && <Link href={a.link} className="flex-shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-gray-600"><ArrowUpRight className="h-4 w-4" /></Link>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="cw-reveal relative overflow-hidden rounded-2xl p-6 text-white" style={{ background: "linear-gradient(135deg,#111827,#312e81)", animationDelay: "180ms" }}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-2xl opacity-40" style={{ background: "radial-gradient(circle,#8b5cf6,transparent 70%)" }} />
          <div className="relative">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
              <Zap className="h-[18px] w-[18px] text-amber-300" />
            </span>
            <h3 className="mt-3 font-display font-bold">Tips för veckan</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">
              Bäst tider: <strong className="text-white">tis–tors 07:00, 12:00, 20:00</strong>. Lägg upp 3/vecka. Rotera fråge-hook, berättelse-öppning och djärvt påstående. En CTA per inlägg.
            </p>
          </div>
        </div>
      </div>

      <div className="cw-reveal flex flex-wrap gap-2" style={{ animationDelay: "240ms" }}>
        {isAutomotive && <QuickLink href="/" external>Visa publik sajt</QuickLink>}
        <QuickLink href="/dashboard/innehall">Innehålls-navet</QuickLink>
        <QuickLink href="/dashboard/sidor">Alla sidor</QuickLink>
        {productConfig && <QuickLink href={productConfig.href}>{isArt ? "Verk" : "Fordon"}</QuickLink>}
        <QuickLink href="/dashboard/studio/kalender">Kalender</QuickLink>
        <QuickLink href="/dashboard/seo">SEO & AEO</QuickLink>
      </div>
    </div>
  );
}

function ActionCard({ title, description, href, cta, icon: Icon, tone, i }: { title: string; description: string; href: string; cta: string; icon: React.ComponentType<{ className?: string }>; tone: Tone; i: number }) {
  const t = TONES[tone];
  return (
    <Link href={href}
      className="cw-reveal group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_-16px_rgba(0,0,0,0.18)]"
      style={{ animationDelay: `${i * 70}ms` }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: t.grad }} />
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105" style={{ background: t.grad, boxShadow: `0 8px 20px -8px rgba(${t.rgb},.6)` }}>
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-bold text-gray-900">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
          <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold transition-all group-hover:gap-2" style={{ color: `rgb(${t.rgb})` }}>
            {cta} <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function QuickLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50">
      {children}
      {external && <ExternalLink className="h-3 w-3 text-gray-400" />}
    </Link>
  );
}

function activityColor(type: string): string {
  if (type.startsWith("blog")) return "bg-emerald-500 text-emerald-500";
  if (type.startsWith("social")) return "bg-violet-500 text-violet-500";
  if (type.startsWith("share")) return "bg-blue-500 text-blue-500";
  if (type.includes("approve")) return "bg-emerald-600 text-emerald-600";
  if (type.includes("reject")) return "bg-red-500 text-red-500";
  if (type.startsWith("client")) return "bg-amber-500 text-amber-500";
  return "bg-gray-400 text-gray-400";
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nu";
  if (m < 60) return `${m} min sen`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h sen`;
  return `${Math.floor(h / 24)} d sen`;
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
