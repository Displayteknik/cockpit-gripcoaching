import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSpecialist, buildUserPrompt } from "@/lib/specialists";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const t0 = Date.now();
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY saknas i miljövariabler" },
        { status: 500 }
      );
    }

    const specialist = await getSpecialist(id);
    if (!specialist) {
      return NextResponse.json({ error: "Specialist saknas" }, { status: 404 });
    }
    if (specialist.target_app !== "cockpit" && specialist.target_app !== "both") {
      return NextResponse.json({ error: "Specialist är inte för Cockpit" }, { status: 400 });
    }

    const body = await req.json();
    const inputs: Record<string, string> = body?.inputs ?? {};

    for (const f of specialist.inputs) {
      if (f.required && !inputs[f.key]?.trim()) {
        return NextResponse.json(
          { error: `Saknar obligatoriskt fält: ${f.label}` },
          { status: 400 }
        );
      }
    }

    const clientId = await getActiveClientId();
    const userPrompt = buildUserPrompt(specialist, inputs);

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: specialist.systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();

    const duration = Date.now() - t0;

    const sb = supabaseServer();
    await sb.from("specialist_runs").insert({
      specialist_id: specialist.id,
      app: "cockpit",
      client_id: clientId,
      inputs,
      output: text,
      model: MODEL,
      tokens_in: msg.usage?.input_tokens ?? null,
      tokens_out: msg.usage?.output_tokens ?? null,
      duration_ms: duration,
      status: "completed",
    });

    await logActivity(
      clientId,
      "specialist_run",
      `Körde specialist: ${specialist.name}`,
      `/dashboard/specialister/${specialist.id}`,
      { specialist_id: specialist.id, tokens_out: msg.usage?.output_tokens ?? null }
    );

    return NextResponse.json({
      output: text,
      model: MODEL,
      tokens_in: msg.usage?.input_tokens ?? null,
      tokens_out: msg.usage?.output_tokens ?? null,
      duration_ms: duration,
    });
  } catch (e) {
    const message = (e as Error).message ?? "Okänt fel";
    try {
      const sb = supabaseServer();
      await sb.from("specialist_runs").insert({
        specialist_id: id,
        app: "cockpit",
        inputs: {},
        status: "failed",
        error: message,
        duration_ms: Date.now() - t0,
      });
    } catch {}
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
