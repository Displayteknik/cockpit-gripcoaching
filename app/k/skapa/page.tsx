// Pensionerad (Fas C): gamla "Skapa"-vyn ersatt av premium-Studion på /k/studio.
// Behåller routen som permanent redirect så gamla länkar/bokmärken inte dör.
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function KSkapa() {
  redirect("/k/studio");
}
