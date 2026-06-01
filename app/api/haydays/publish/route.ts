import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";

const SLUG = "scandinavian-haydays";
const REPO = "Displayteknik/scandinavian-haydays";
const WORKFLOW = "deploy.yml";

export async function POST() {
  const client = await getActiveClient();
  if (client?.slug !== SLUG) return NextResponse.json({ error: "Endast för Hay Days-klient" }, { status: 400 });

  const token = process.env.GH_DEPLOY_TOKEN;
  if (!token) return NextResponse.json({ error: "GH_DEPLOY_TOKEN saknas i env" }, { status: 500 });

  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { reason: `Cockpit publish av ${client.name}` } }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: `GitHub svarade ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Publicering startad — ${client.public_url || "sajten"} uppdateras om ~1 min` });
}
