import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";
import { loadBrand } from "@/lib/studio/brand";

export const runtime = "nodejs";

// GET /api/studio/brand — resolved StudioBrand (JSON) för aktiv klient.
// Editorn renderar mall-komponenterna klient-sidan med detta → WYSIWYG med exporten.
export async function GET() {
  try {
    const client = await getActiveClient();
    const slug = client?.slug || "opticur";
    const brand = await loadBrand(slug);
    return NextResponse.json({ brand });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
