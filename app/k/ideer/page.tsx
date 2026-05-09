import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-context";
import { supabaseService } from "@/lib/supabase-admin";
import { Lightbulb } from "lucide-react";
import IdeasList from "./IdeasList";

export const dynamic = "force-dynamic";

export default async function CustomerIdeasPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/k-utloggad");

  const sb = supabaseService();
  const { data } = await sb
    .from("ideas_bank")
    .select("id, type, body, voice_score, status, created_at, metadata")
    .eq("client_id", session.client_id)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(50);

  type IdeaRow = {
    id: string;
    type: string;
    body: string;
    voice_score: number | null;
    status: string;
    created_at: string;
    metadata: unknown;
  };
  const ideas = (data ?? []) as IdeaRow[];

  return (
    <div className="pb-12">
      <div className="mb-6">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: `${session.primary_color}15`, color: session.primary_color }}
        >
          Idé-bank
        </span>
        <h1 className="font-display text-2xl font-bold text-gray-900 flex items-center gap-2 mt-1">
          <Lightbulb className="w-6 h-6" style={{ color: session.primary_color }} />
          Förslag att granska
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Här är AI-genererade utkast — godkänn det du gillar, avvisa resten. Det godkända blir mall för framtida förslag.
        </p>
      </div>

      <IdeasList initialIdeas={ideas} primaryColor={session.primary_color} />
    </div>
  );
}
