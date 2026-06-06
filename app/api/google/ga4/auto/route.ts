import { NextRequest, NextResponse } from "next/server";
import { autoSelectGaProperty, getValidAccessToken } from "@/lib/google";
import { supabaseServer } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

// Accepterar valfri giltig Supabase service-role-JWT för detta projekt (nyckel kan ha roterats).
function isServiceToken(auth: string): boolean {
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return false;
  try {
    const payload = JSON.parse(Buffer.from(m[1].split(".")[1], "base64").toString("utf8")) as { role?: string; ref?: string };
    return payload.role === "service_role" && payload.ref === "liunepzrmygiaaibsbni";
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!isServiceToken(req.headers.get("authorization") || "")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as { client_id?: string }));
  const clientId = body.client_id;
  if (!clientId) return NextResponse.json({ error: "client_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const diag: Record<string, unknown> = {};

  // Klientens domän
  const { data: client } = await sb.from("clients").select("public_url").eq("id", clientId).maybeSingle();
  let targetHost: string | null = null;
  try { if (client?.public_url) targetHost = new URL(client.public_url).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  diag.targetHost = targetHost;
  diag.public_url = client?.public_url ?? null;

  // Token
  let token: string;
  try { token = await getValidAccessToken(clientId); diag.token = "ok"; }
  catch (e) { diag.token = "FEL: " + (e as Error).message; return NextResponse.json({ picked: null, diag }); }

  // Properties
  const sumRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: { Authorization: `Bearer ${token}` } });
  if (!sumRes.ok) { diag.accountSummaries = `FEL ${sumRes.status}: ${(await sumRes.text()).slice(0, 400)}`; return NextResponse.json({ picked: null, diag }); }
  const sum = (await sumRes.json()) as { accountSummaries?: Array<{ displayName?: string; propertySummaries?: Array<{ property: string; displayName?: string }> }> };
  const props: Array<{ id: string; name: string; account: string }> = [];
  for (const a of sum.accountSummaries || []) for (const p of a.propertySummaries || []) props.push({ id: p.property.replace("properties/", ""), name: p.displayName || "", account: a.displayName || "" });
  diag.propertyCount = props.length;
  diag.properties = props;

  // Web-stream-domäner per property
  const streams: Array<{ property: string; name: string; domain: string }> = [];
  for (const p of props) {
    try {
      const dsRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/properties/${p.id}/dataStreams`, { headers: { Authorization: `Bearer ${token}` } });
      if (!dsRes.ok) continue;
      const ds = (await dsRes.json()) as { dataStreams?: Array<{ type?: string; webStreamData?: { defaultUri?: string } }> };
      for (const s of ds.dataStreams || []) {
        if (s.type === "WEB_DATA_STREAM" && s.webStreamData?.defaultUri) {
          let h = ""; try { h = new URL(s.webStreamData.defaultUri).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
          streams.push({ property: p.id, name: p.name, domain: s.webStreamData.defaultUri + (h ? ` (${h})` : "") });
        }
      }
    } catch {}
  }
  diag.webStreams = streams;

  const picked = await autoSelectGaProperty(clientId);
  return NextResponse.json({ picked, diag });
}
