import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { Sparkles, Users, Target, Trophy, FileText, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";

export default async function CustomerHome() {
  const session = await getCustomerSession();
  if (!session) return null;

  const has = (k: string) => session.features.includes(k);
  const showSocialStats = has("skapa") || has("veckoplan") || has("dm");
  const showSeo = has("seo");

  const sb = supabaseService();
  const cid = session.client_id;

  // Hämta bara den statistik som är relevant för kundens moduler.
  const [postsRes, contactsRes, qualityRes, seoAuditRes, seoKwRes] = await Promise.all([
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">Välkommen tillbaka</h1>
        <p className="text-gray-500 mt-1">Här är läget för {session.client_name}.</p>
      </div>

      {!profileOK && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
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
            <h2 className="font-display font-bold text-gray-900 text-lg">Din synlighet i sök</h2>
            <Link
              href="/k/seo"
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: session.primary_color }}
            >
              Öppna SEO & AEO <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScoreStat label="Google (SEO)" value={audit?.seo_score} />
            <ScoreStat label="AI-sökmotorer" value={audit?.aeo_score} />
            <StatCard label="Sökord du följer" value={kwCount} icon={Target} accent="purple" />
            <StatCard label="Topp 10 på Google" value={top10} icon={Trophy} accent="amber" />
          </div>
          <p className="text-xs text-gray-400">
            {auditDate ? `Senaste analys ${auditDate}${audit?.url ? " · " + audit.url.replace(/^https?:\/\//, "") : ""}` : "Du har inte kört någon analys än — gör din första på SEO-sidan."}
          </p>
        </section>
      )}

      {/* Social-statistik */}
      {showSocialStats && (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-gray-900 text-lg">Ditt innehåll</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Inlägg totalt" value={totalPosts} icon={FileText} />
            <StatCard label="Utkast" value={drafts} icon={Sparkles} accent="amber" />
            <StatCard label="Publicerade" value={published} icon={Trophy} accent="emerald" />
            <StatCard label="Kunder i pipeline" value={`${wonContacts}/${totalContacts}`} icon={Users} accent="purple" />
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
};

function StatCard({ label, value, icon: Icon, accent = "gray" }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: keyof typeof ACCENTS | string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ACCENTS[accent] || ACCENTS.gray}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="text-xs text-gray-500 uppercase font-medium tracking-wide leading-tight">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

// SEO/AEO-poäng (0–100) med färg efter hur bra det är.
function ScoreStat({ label, value }: { label: string; value?: number }) {
  const has = typeof value === "number";
  const tone = !has ? "#9ca3af" : value! >= 80 ? "#059669" : value! >= 60 ? "#d97706" : "#dc2626";
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        {/* Brickan färgas efter poängen (grön=bra) så det viktigaste talet poppar. */}
        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${tone}1a` }}>
          <TrendingUp className="w-[18px] h-[18px]" style={{ color: tone }} />
        </span>
        <span className="text-xs text-gray-500 uppercase font-medium tracking-wide leading-tight">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums" style={{ color: tone }}>{has ? value : "—"}</span>
        {has && <span className="text-sm text-gray-400 font-medium">/100</span>}
      </div>
    </div>
  );
}
