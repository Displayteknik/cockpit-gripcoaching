import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";

// Accepts TSV/CSV pasted from Excel. Auto-detects delimiter.
// Expected columns (any order, header row required): post_text, posted_at, impressions, engagements, reactions, comments, shares, post_url
// Or LinkedIn export style: "Date", "Post URL", "Post Text", "Impressions", "Engagements" etc — we map them.

function detectDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  if (tabs >= semis && tabs >= commas) return "\t";
  if (semis >= commas) return ";";
  return ",";
}

function parseRow(line: string, delim: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === delim && !inQuote) { cols.push(cur); cur = ""; continue; }
    cur += c;
  }
  cols.push(cur);
  return cols.map((s) => s.trim());
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

const FIELD_ALIASES: Record<string, string> = {
  post_text: "post_text",
  text: "post_text",
  innehall: "post_text",
  inneh_ll: "post_text",
  message: "post_text",
  date: "posted_at",
  posted_at: "posted_at",
  publishing_date: "posted_at",
  publicerad: "posted_at",
  datum: "posted_at",
  post_url: "post_url",
  url: "post_url",
  link: "post_url",
  impressions: "impressions",
  visningar: "impressions",
  engagements: "engagements",
  engagement: "engagements",
  engagemang: "engagements",
  reactions: "reactions",
  reaktioner: "reactions",
  comments: "comments",
  kommentarer: "comments",
  shares: "shares",
  delningar: "shares",
};

export async function POST(req: NextRequest) {
  try {
    const { raw }: { raw: string } = await req.json();
    if (!raw?.trim()) return NextResponse.json({ error: "Tomt input" }, { status: 400 });

    const sb = supabaseServer();
    const clientId = await getActiveClientId();

    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return NextResponse.json({ error: "Behöver minst en header-rad och en data-rad" }, { status: 400 });

    const delim = detectDelimiter(lines[0]);
    const headers = parseRow(lines[0], delim).map((h) => FIELD_ALIASES[normalizeHeader(h)] ?? normalizeHeader(h));

    const rows = lines.slice(1).map((line) => {
      const cells = parseRow(line, delim);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
      return row;
    });

    const inserts = rows
      .filter((r) => r.post_text || r.post_url)
      .map((r) => ({
        client_id: clientId,
        posted_at: r.posted_at ? new Date(r.posted_at).toISOString() : null,
        post_text: r.post_text || null,
        post_url: r.post_url || null,
        impressions: r.impressions ? Number(r.impressions.replace(/\s/g, "")) : null,
        engagements: r.engagements ? Number(r.engagements.replace(/\s/g, "")) : null,
        reactions: r.reactions ? Number(r.reactions.replace(/\s/g, "")) : null,
        comments: r.comments ? Number(r.comments.replace(/\s/g, "")) : null,
        shares: r.shares ? Number(r.shares.replace(/\s/g, "")) : null,
        source: "paste_import",
      }))
      .filter((r) => r.post_text || r.post_url);

    if (!inserts.length) return NextResponse.json({ error: "Hittade inga giltiga rader. Säkerställ kolumnerna: post_text, posted_at, impressions, engagements, reactions, comments, shares, post_url" }, { status: 400 });

    const { data, error } = await sb.from("linkedin_history").insert(inserts).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity(clientId, "linkedin_history_import", `Importerade ${data?.length ?? 0} LinkedIn-inlägg`, "/dashboard/linkedin");
    return NextResponse.json({ imported: data?.length ?? 0, headers_detected: headers });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const sb = supabaseServer();
  const clientId = await getActiveClientId();
  const { data, error } = await sb
    .from("linkedin_history")
    .select("*")
    .eq("client_id", clientId)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}
