import { NextRequest, NextResponse } from "next/server";
import { getActiveClientId } from "@/lib/client-context";
import {
  listAssets,
  createTextAsset,
  attachSignedUrls,
  ASSET_TYPES,
  AssetType,
} from "@/lib/assets";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const url = new URL(req.url);
    const type = url.searchParams.get("type") as AssetType | null;
    const limit = Number(url.searchParams.get("limit") || 200);

    const assets = await listAssets(clientId, {
      type: type && ASSET_TYPES.includes(type) ? type : undefined,
      limit,
    });
    const withUrls = await attachSignedUrls(assets);
    return NextResponse.json({ assets: withUrls });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientId = await getActiveClientId();
    const body = await req.json();

    if (!ASSET_TYPES.includes(body.asset_type)) {
      return NextResponse.json({ error: "Ogiltig asset_type" }, { status: 400 });
    }

    // Bara dessa typer skapas via JSON (text-assets) — filer går via /upload
    if (!["post", "testimonial", "link"].includes(body.asset_type)) {
      return NextResponse.json(
        { error: "Använd /api/assets/upload för fil-baserade assets" },
        { status: 400 }
      );
    }

    const asset = await createTextAsset({
      client_id: clientId,
      asset_type: body.asset_type,
      title: body.title,
      body: body.body,
      source_url: body.source_url,
      category: body.category,
      person_name: body.person_name,
      person_label: body.person_label,
      tags: Array.isArray(body.tags) ? body.tags : [],
    });

    return NextResponse.json({ asset });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
