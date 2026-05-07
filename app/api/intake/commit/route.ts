import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClientId, logActivity } from "@/lib/client-context";

export const runtime = "nodejs";
export const maxDuration = 120;

interface CommitBody {
  session_id: string;
}

const BRAND_FIELDS = new Set([
  "usp",
  "icp_primary",
  "icp_secondary",
  "pain_points",
  "differentiators",
  "services",
  "brand_story",
  "tone_rules",
  "customer_journey",
  "customer_quotes",
  "tagline",
]);

function effectiveValue(p: { proposed_value: string; edited_value: string | null; decision: string }): string {
  if (p.decision === "edited" && p.edited_value) return p.edited_value;
  return p.proposed_value;
}

function appendUnique(existing: string | null | undefined, addition: string): string {
  if (!existing) return addition;
  if (existing.toLowerCase().includes(addition.toLowerCase().slice(0, 30))) return existing;
  return `${existing}\n${addition}`;
}

function uniqueArray(existing: string[] | null | undefined, addition: string): string[] {
  const arr = Array.isArray(existing) ? [...existing] : [];
  const lower = addition.toLowerCase().trim();
  if (!lower) return arr;
  if (arr.some((x) => x.toLowerCase().trim() === lower)) return arr;
  arr.push(addition.trim());
  return arr;
}

export async function POST(req: NextRequest) {
  const { session_id }: CommitBody = await req.json();
  if (!session_id) return NextResponse.json({ error: "session_id krävs" }, { status: 400 });

  const sb = supabaseServer();
  const clientId = await getActiveClientId();

  const { data: session } = await sb.from("intake_sessions").select("*").eq("id", session_id).eq("client_id", clientId).single();
  if (!session) return NextResponse.json({ error: "Session saknas" }, { status: 404 });
  if (session.status === "committed") return NextResponse.json({ error: "Redan committad" }, { status: 400 });

  const { data: accepted } = await sb
    .from("intake_proposals")
    .select("*")
    .eq("session_id", session_id)
    .in("decision", ["accepted", "edited"])
    .order("sort_order", { ascending: true });

  if (!accepted || accepted.length === 0) {
    await sb.from("intake_sessions").update({ status: "dismissed", committed_at: new Date().toISOString() }).eq("id", session_id);
    return NextResponse.json({ ok: true, applied: 0, message: "Inga förslag accepterade — sessionen avslutad utan ändringar" });
  }

  const summary = { brand_profile: 0, pillars: 0, voice: 0, customer_voice: 0, post_ideas: 0 };

  // BRAND PROFILE
  const profileUpdates: Record<string, string> = {};
  let { data: profile } = await sb.from("hm_brand_profile").select("*").eq("client_id", clientId).maybeSingle();

  for (const p of accepted) {
    if (p.target === "brand_profile" && p.field && BRAND_FIELDS.has(p.field)) {
      const val = effectiveValue(p);
      if (p.action === "update" || p.action === "confirm") profileUpdates[p.field] = val;
      else if (p.action === "add") profileUpdates[p.field] = appendUnique(profile?.[p.field] as string, val);
      summary.brand_profile++;
    } else if (
      ["differentiators", "service", "icp_primary", "icp_secondary"].includes(p.target) &&
      p.action !== "ignore"
    ) {
      const fieldMap: Record<string, string> = { differentiators: "differentiators", service: "services", icp_primary: "icp_primary", icp_secondary: "icp_secondary" };
      const f = fieldMap[p.target];
      profileUpdates[f] = appendUnique(profile?.[f] as string, effectiveValue(p));
      summary.brand_profile++;
    }
  }

  if (Object.keys(profileUpdates).length > 0) {
    if (profile) {
      await sb.from("hm_brand_profile").update({ ...profileUpdates, updated_at: new Date().toISOString() }).eq("client_id", clientId);
    } else {
      // Need to create — id col default is 1 so we max+1
      const { data: maxRow } = await sb.from("hm_brand_profile").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
      const nextId = ((maxRow?.id as number) ?? 100) + 1;
      await sb.from("hm_brand_profile").insert({ id: nextId, client_id: clientId, ...profileUpdates });
    }
  }

  // PILLARS
  const pillarsToAdd = accepted.filter((p) => p.target === "pillar" && (p.action === "add" || p.action === "update"));
  if (pillarsToAdd.length > 0) {
    const { data: existingPillars } = await sb.from("linkedin_pillars").select("id, name").eq("client_id", clientId).eq("archived", false);
    for (const p of pillarsToAdd) {
      const [name, ...descParts] = effectiveValue(p).split("|");
      const description = descParts.join("|").trim();
      const cleanName = name.trim();
      const existing = (existingPillars ?? []).find((ep) => ep.name.toLowerCase().trim() === cleanName.toLowerCase());
      if (existing && p.action === "update") {
        await sb.from("linkedin_pillars").update({ description }).eq("id", existing.id);
      } else if (!existing) {
        await sb.from("linkedin_pillars").insert({ client_id: clientId, name: cleanName, description, sort_order: (existingPillars?.length ?? 0) + 1 });
      }
      summary.pillars++;
    }
  }

  // VOICE PROFILE
  const voiceTargets = accepted.filter((p) => ["signature_phrase", "forbidden_word", "pain_word", "joy_word", "tone_rule"].includes(p.target));
  if (voiceTargets.length > 0) {
    const { data: voice } = await sb.from("client_voice_profile").select("*").eq("client_id", clientId).maybeSingle();
    const updates: Record<string, unknown> = {};
    let signature = voice?.signature_phrases ?? [];
    let forbidden = voice?.forbidden_words ?? [];
    let pain = voice?.pain_words ?? [];
    let joy = voice?.joy_words ?? [];
    let tone = voice?.tone_summary ?? "";

    for (const p of voiceTargets) {
      const v = effectiveValue(p);
      if (p.target === "signature_phrase") signature = uniqueArray(signature, v);
      else if (p.target === "forbidden_word") forbidden = uniqueArray(forbidden, v);
      else if (p.target === "pain_word") pain = uniqueArray(pain, v);
      else if (p.target === "joy_word") joy = uniqueArray(joy, v);
      else if (p.target === "tone_rule") tone = appendUnique(tone, v);
      summary.voice++;
    }
    updates.signature_phrases = signature;
    updates.forbidden_words = forbidden;
    updates.pain_words = pain;
    updates.joy_words = joy;
    updates.tone_summary = tone;
    updates.updated_at = new Date().toISOString();

    if (voice) await sb.from("client_voice_profile").update(updates).eq("client_id", clientId);
    else await sb.from("client_voice_profile").insert({ client_id: clientId, ...updates });
  }

  // CUSTOMER VOICE
  const cvTargets = accepted.filter((p) => p.target === "customer_voice" || p.target === "catchphrase" || p.target === "objection" || p.target === "transformation_case");
  if (cvTargets.length > 0) {
    const inserts = cvTargets.map((p) => ({
      client_id: clientId,
      phrase: effectiveValue(p),
      category:
        p.target === "catchphrase"
          ? "catchphrase"
          : p.target === "objection"
          ? "objection"
          : p.target === "transformation_case"
          ? "transformation"
          : (p.field as string) || "vocabulary",
      context: p.evidence ?? null,
      source_session_id: session_id,
    }));
    await sb.from("customer_voice").insert(inserts);
    summary.customer_voice = inserts.length;
  }

  // POST IDEAS
  const ideaTargets = accepted.filter((p) => p.target === "post_idea" || p.target === "framework");
  if (ideaTargets.length > 0) {
    const inserts = ideaTargets.map((p) => {
      const [hook, ...angleParts] = effectiveValue(p).split("|");
      return {
        client_id: clientId,
        status: "idea" as const,
        format: "text",
        hook: hook.trim().slice(0, 250),
        idea_seed: angleParts.join("|").trim() || p.evidence,
        notes: `Från intake: ${p.evidence?.slice(0, 100) ?? ""}`,
        source_module: "intake",
      };
    });
    await sb.from("linkedin_posts").insert(inserts);
    summary.post_ideas = inserts.length;
  }

  await sb
    .from("intake_sessions")
    .update({ status: "committed", committed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", session_id);

  await logActivity(
    clientId,
    "intake_committed",
    `Intake commit: ${summary.brand_profile} brand-fält, ${summary.pillars} pelare, ${summary.voice} voice, ${summary.customer_voice} VoC, ${summary.post_ideas} post-idéer`,
    "/dashboard/profil",
  );
  return NextResponse.json({ ok: true, summary });
}
