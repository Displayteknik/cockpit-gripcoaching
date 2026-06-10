import PostsTabs from "@/components/dashboard/PostsTabs";

// Delad layout för alla inläggs-rutter (Skapa, Veckoplan, Fordonsinlägg, Schemalägg,
// DM, Analys). Route-gruppen (inlagg) påverkar inte URL:erna — de är kvar som
// /dashboard/skapa osv. Vänstermenyn har bara EN "Inlägg"-rad; kategorierna är flikar här.
export default function InlaggLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PostsTabs />
      {children}
    </div>
  );
}
