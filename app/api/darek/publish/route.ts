import { NextResponse } from "next/server";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";

// Map slug → GitHub-repo + workflow att trigga
const PUBLISH_TARGETS: Record<string, { repo: string; workflow: string } | undefined> = {
  darek: { repo: "Displayteknik/darek-uhrberg", workflow: "deploy.yml" },
};

export async function POST() {
  const client = await getActiveClient();
  if (!client) return NextResponse.json({ error: "Ingen aktiv klient" }, { status: 400 });

  const target = PUBLISH_TARGETS[client.slug];
  if (!target) return NextResponse.json({ error: `Ingen publish-target konfigurerad för ${client.slug}` }, { status: 400 });

  const token = process.env.GH_DEPLOY_TOKEN;
  if (!token) return NextResponse.json({ error: "GH_DEPLOY_TOKEN saknas i env" }, { status: 500 });

  const r = await fetch(`https://api.github.com/repos/${target.repo}/actions/workflows/${target.workflow}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "master", inputs: { reason: `Cockpit publish av ${client.name}` } }),
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: `GitHub svarade ${r.status}: ${txt.slice(0, 200)}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Build startad — ${client.public_url || "sajten"} uppdateras om ~1 min` });
}
