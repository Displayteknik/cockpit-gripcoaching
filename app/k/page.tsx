import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { Sparkles, Calendar, Users, Target, Trophy, FileText, AlertTriangle } from "lucide-react";

export default async function CustomerHome() {
  const session = await getCustomerSession();
  if (!session) return null;

  const sb = supabaseService();

  // Hämta enkla räknare
  const [postsRes, contactsRes, qualityRes] = await Promise.all([
    sb.from("hm_social_posts").select("status", { count: "exact", head: false }).eq("client_id", session.client_id),
    sb.from("cockpit_dm_contacts").select("stage", { count: "exact", head: false }).eq("client_id", session.client_id),
    sb.from("hm_brand_profile").select("usp, icp_primary, tone_rules, customer_quotes, booking_url").eq("client_id", session.client_id).maybeSingle(),
  ]);

  const totalPosts = postsRes.data?.length || 0;
  const drafts = postsRes.data?.filter((p) => p.status === "draft").length || 0;
  const published = postsRes.data?.filter((p) => p.status === "published").length || 0;
  const totalContacts = contactsRes.data?.length || 0;
  const wonContacts = contactsRes.data?.filter((c) => c.stage === "won").length || 0;

  const profile = qualityRes.data || {};
  const profileFilled = ["usp", "icp_primary", "tone_rules", "customer_quotes", "booking_url"].filter(
    (k) => (profile as Record<string, unknown>)[k] && String((profile as Record<string, unknown>)[k]).length > 10
  ).length;
  const profileOK = profileFilled >= 4;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-gray-900">Välkommen tillbaka</h1>
        <p className="text-gray-500 mt-1">
          Här skapar du, schemalägger och följer dina sociala-medie-inlägg.
        </p>
      </div>

      {!profileOK && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-amber-900 text-sm">Din profil behöver kompletteras</div>
            <div className="text-sm text-amber-800 mt-1">
              Ju mer din profil är ifylld, desto bättre blir AI:n på att skriva i din röst.{" "}
              <Link href="/k/profil" className="underline font-medium">
                Komplettera nu →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Inlägg totalt" value={totalPosts} icon={FileText} />
        <StatCard label="Utkast" value={drafts} icon={Sparkles} color="text-amber-600" />
        <StatCard label="Publicerade" value={published} icon={Trophy} color="text-emerald-600" />
        <StatCard label="Kunder i pipeline" value={`${wonContacts}/${totalContacts}`} icon={Users} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          href="/k/skapa"
          icon={Sparkles}
          title="Skapa ett inlägg"
          desc="Tre varianter på 30 sekunder — du väljer vilken som passar bäst"
          color="from-purple-600 to-blue-600"
        />
        <ActionCard
          href="/k/veckoplan"
          icon={Calendar}
          title="Planera hela veckan"
          desc="Skriv ett tema och få sju färdiga inlägg enligt 4A-rytmen"
          color="from-emerald-600 to-teal-600"
        />
        <ActionCard
          href="/k/profil"
          icon={Target}
          title="Min profil"
          desc="Det som gör dina inlägg bra — uppdatera röst, bilder och kunder"
          color="from-amber-600 to-orange-600"
        />
        <ActionCard
          href="/k/dm"
          icon={Users}
          title="DM & uppföljning"
          desc="Håll koll på alla som DM:at — från kommentar till bokad kund"
          color="from-blue-600 to-cyan-600"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-gray-700" }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-gray-500 uppercase font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ActionCard({ href, icon: Icon, title, desc, color }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string; color: string }) {
  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 hover:border-gray-300 rounded-xl p-5 transition-all hover:shadow-md group"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="font-display font-bold text-gray-900 group-hover:text-purple-700">{title}</div>
      </div>
      <div className="text-sm text-gray-600">{desc}</div>
    </Link>
  );
}
