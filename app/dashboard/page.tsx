"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Car, FileText, Layers, Sparkles, BookOpen, ExternalLink,
  Pencil, Plus, TrendingUp, MessageSquare,
} from "lucide-react";

interface Stats {
  vehicles: number;
  vehiclesSold: number;
  blogPosts: number;
  blogDrafts: number;
  socialPosts: number;
  socialDrafts: number;
  queued: number;
  leads: number;
  newLeads: number;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const [vAll, vSold, bPub, bDraft, sAll, sDraft, queue, leadsAll, leadsNew] = await Promise.all([
        supabase.from("hm_vehicles").select("id", { count: "exact", head: true }),
        supabase.from("hm_vehicles").select("id", { count: "exact", head: true }).eq("is_sold", true),
        supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("published", true),
        supabase.from("hm_blog").select("id", { count: "exact", head: true }).eq("published", false),
        supabase.from("hm_social_posts").select("id", { count: "exact", head: true }),
        supabase.from("hm_social_posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("hm_blog_queue").select("id", { count: "exact", head: true }).eq("status", "queued"),
        supabase.from("hm_leads").select("id", { count: "exact", head: true }),
        supabase.from("hm_leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);
      setStats({
        vehicles: vAll.count || 0,
        vehiclesSold: vSold.count || 0,
        blogPosts: bPub.count || 0,
        blogDrafts: bDraft.count || 0,
        socialPosts: sAll.count || 0,
        socialDrafts: sDraft.count || 0,
        queued: queue.count || 0,
        leads: leadsAll.count || 0,
        newLeads: leadsNew.count || 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">HM Motor — Säljmaskinen</h1>
        <p className="text-gray-500 mt-1">Allt du behöver för att driva försäljningen — samlat.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Fordon i lager" value={stats ? stats.vehicles - stats.vehiclesSold : "—"} sub={stats ? `${stats.vehiclesSold} sålda` : ""} icon={Car} color="blue" />
        <StatCard label="Bloggartiklar" value={stats?.blogPosts ?? "—"} sub={stats ? `${stats.blogDrafts} utkast` : ""} icon={FileText} color="emerald" />
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
          description={stats?.queued ? `${stats.queued} ämnen i kön — nästa kör ${nextCronText()}` : "Generera nya artiklar 3 ggr/vecka automatiskt."}
          href="/dashboard/blogg-maskin"
          cta="Hantera ämnen"
          icon={BookOpen}
          color="emerald"
        />
        <ActionCard
          title="Redigera startsida"
          description="Puck-editorn öppnas direkt. Drag & drop med designverktyg."
          href="/admin"
          cta="Öppna editor"
          icon={Pencil}
          color="blue"
        />
        <ActionCard
          title="Lägg upp fordon"
          description="Bilar, ATV, UTV, släp — med bilder, specs och bytesstatus."
          href="/dashboard/fordon"
          cta="Öppna fordon"
          icon={Plus}
          color="amber"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-display text-lg font-bold text-gray-900 mb-4">Snabblänkar</h2>
        <div className="flex flex-wrap gap-3">
          <QuickLink href="/" external>Visa publik sajt</QuickLink>
          <QuickLink href="/admin" external>Sideditor (Puck)</QuickLink>
          <QuickLink href="/dashboard/sidor">Alla sidor</QuickLink>
          <QuickLink href="/dashboard/fordon">Fordon</QuickLink>
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

function nextCronText() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const cronDays = [1, 3, 5]; // mån, ons, fre
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
