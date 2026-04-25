import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

// Importerar CSV-export från Google Search Console (Performance → Export → CSV).
// Format: Top queries.csv eller Pages.csv
export async function POST(req: NextRequest) {
  const clientId = await getActiveClientId();
  const body = await req.json();
  const csv: string = body.csv;
  const period_start: string | undefined = body.period_start;
  const period_end: string | undefined = body.period_end;
  if (!csv) return NextResponse.json({ error: "csv krävs" }, { status: 400 });

  // Naive CSV parse — GSC exporterar header: "Query,Clicks,Impressions,CTR,Position" eller liknande
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return NextResponse.json({ error: "Tom CSV" }, { status: 400 });
  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));
  const idxQuery = header.findIndex((h) => /^(top.?queries?|query|sökord|fråga)$/i.test(h)) === -1 ? 0 : header.findIndex((h) => /^(top.?queries?|query|sökord|fråga)$/i.test(h));
  const idxPage = header.findIndex((h) => /^(top.?pages?|page|sida|url)$/i.test(h));
  const idxClicks = header.findIndex((h) => /click/i.test(h));
  const idxImpr = header.findIndex((h) => /impression|visning/i.test(h));
  const idxCtr = header.findIndex((h) => /ctr/i.test(h));
  const idxPos = header.findIndex((h) => /position|placering/i.test(h));

  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const query = idxQuery >= 0 ? cols[idxQuery] : null;
    if (!query) continue;
    rows.push({
      client_id: clientId,
      query,
      page: idxPage >= 0 ? cols[idxPage] : null,
      clicks: idxClicks >= 0 ? parseInt(cols[idxClicks]) || 0 : 0,
      impressions: idxImpr >= 0 ? parseInt(cols[idxImpr]) || 0 : 0,
      ctr: idxCtr >= 0 ? parseFloat(cols[idxCtr].replace("%", "")) / 100 : null,
      position: idxPos >= 0 ? parseFloat(cols[idxPos]) || null : null,
      period_start,
      period_end,
    });
  }

  if (!rows.length) return NextResponse.json({ error: "Inga rader hittades" }, { status: 400 });

  const sb = supabaseServer();
  const { error } = await sb.from("gsc_queries").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, imported: rows.length });
}

export async function GET() {
  const clientId = await getActiveClientId();
  const sb = supabaseServer();
  const { data } = await sb
    .from("gsc_queries")
    .select("*")
    .eq("client_id", clientId)
    .order("clicks", { ascending: false })
    .limit(200);
  return NextResponse.json(data || []);
}
