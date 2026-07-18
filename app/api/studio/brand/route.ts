import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { loadBrand } from "@/lib/studio/brand";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";

// GET /api/studio/brand — resolved StudioBrand (JSON) för aktiv klient.
// Editorn renderar mall-komponenterna klient-sidan med detta → WYSIWYG med exporten.
export async function GET() {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;

  try {
    const client = await getActiveClient();
    const slug = client?.slug || "opticur";
    const brand = await loadBrand(slug);
    return NextResponse.json({ brand });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
