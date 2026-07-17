import { redirect } from "next/navigation";

// §3.3c — "Skapa inlägg"-sidan pensionerad. Studio är makaren (äkta on-brand-
// renderingar). Admin-vägen är nu en tunn genväg dit. Kundens makare lever kvar
// på /k/skapa (delad komponent i components/SkapaInlaggMaker) tills en /k Studio-vy byggs.
export default function SkapaPensionerad() {
  redirect("/dashboard/studio");
}
