import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-context";
import { LogOut } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";

interface Props {
  children: React.ReactNode;
}

// Flik-titel brandad mot kunden själv — inte ärvd publik HM Motor-titel.
export async function generateMetadata(): Promise<Metadata> {
  const session = await getCustomerSession();
  const name = session?.client_name ? `${session.client_name} · MySales Pro` : "Kundportal · MySales Pro";
  // Överskriv ALLT HM-Motor-arv (titel, beskrivning, dela-bild/sajtnamn) — kunden ska
  // aldrig se HM Motor i flik, sökresultat eller länk-förhandsvisning.
  return {
    title: { absolute: name },
    description: "Din egen vy i MySales Pro — besök, synlighet i Google och AI-sök, och din profil på ett ställe.",
    robots: { index: false, follow: false },
    openGraph: { title: name, siteName: "MySales Pro", images: [] },
    twitter: { card: "summary", title: name },
  };
}

export default async function CustomerLayout({ children }: Props) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/k-utloggad");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-display font-bold flex-shrink-0"
              style={{ background: session.primary_color }}
            >
              {(session.client_name || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div
                className="text-[11px] uppercase tracking-wider font-bold"
                style={{ color: session.primary_color }}
              >
                MySales Pro
              </div>
              <div className="font-display font-bold text-gray-900 text-sm leading-tight truncate">
                {session.client_name}
              </div>
            </div>
          </div>
        </div>

        <CustomerNav features={session.features} primaryColor={session.primary_color} />

        <div className="p-4 border-t border-gray-100">
          <form action="/k-logout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logga ut
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
