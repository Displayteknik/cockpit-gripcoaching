import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getOwnerToken } from "@/lib/meta-owner";
import { getPages } from "@/lib/meta-oauth";

export const runtime = "nodejs";

// ANSLUT-2: lista ägarens sidor + kopplade IG-konton, för dropdownen. Hämtas server-side med
// ägarens user-token. Page-access-token INKLUDERAS ALDRIG i svaret till klienten.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const token = await getOwnerToken();
  if (!token) return NextResponse.json({ owner_connected: false, pages: [] });

  try {
    const pages = await getPages(token);
    return NextResponse.json({
      owner_connected: true,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        ig_username: p.instagram_business_account?.username || null,
        has_ig: !!p.instagram_business_account,
      })),
    });
  } catch (e) {
    return NextResponse.json({ owner_connected: true, pages: [], error: (e as Error).message.slice(0, 200) });
  }
}
