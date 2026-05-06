import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-context";
import { Sparkles, Calendar, Users, Target, Home, LogOut } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

export default async function CustomerLayout({ children }: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/k-utloggad");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-gray-200">
          <div
            className="text-xs uppercase tracking-wider font-bold mb-1"
            style={{ color: session.primary_color }}
          >
            MySales Pro
          </div>
          <div className="font-display font-bold text-gray-900 text-lg leading-tight">
            {session.client_name}
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          <NavLink href="/k" icon={Home} label="Översikt" />
          <NavLink href="/k/profil" icon={Target} label="Min profil" />
          <NavLink href="/k/skapa" icon={Sparkles} label="Skapa inlägg" />
          <NavLink href="/k/veckoplan" icon={Calendar} label="Veckoplan" />
          <NavLink href="/k/dm" icon={Users} label="DM & Pipeline" />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <Link
            href="/k-logout"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <LogOut className="w-4 h-4" /> Logga ut
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}

function NavLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      <Icon className="w-4 h-4 text-gray-400" />
      {label}
    </Link>
  );
}
