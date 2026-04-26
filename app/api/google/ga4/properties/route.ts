import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/google";
import { getActiveClientId } from "@/lib/client-context";

export const runtime = "nodejs";

export async function GET() {
  const clientId = await getActiveClientId();
  try {
    const token = await getValidAccessToken(clientId);
    const r = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 500 });
    const data = await r.json();
    const props: { id: string; name: string; account: string }[] = [];
    for (const a of data.accountSummaries || []) {
      for (const p of a.propertySummaries || []) {
        props.push({ id: p.property.replace("properties/", ""), name: p.displayName, account: a.displayName });
      }
    }
    return NextResponse.json(props);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
