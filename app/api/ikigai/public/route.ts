import { NextRequest, NextResponse } from "next/server";
import { getStaticKnowledge } from "@/lib/knowledge";
import { supabaseService } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/client-context";
import { generateIkigai, type IkigaiInputs } from "@/lib/ikigai";

export const runtime = "nodejs";
export const maxDuration = 120;

// Publik leadmagnet → leads landar på GripCoaching-klienten i Cockpit.
const GRIPCOACHING_CLIENT_ID = "3bf4f1d3-cf8f-4f2a-9220-051c69954161";

function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: NextRequest) {
  const sb = supabaseService(); // ikigai_sessions har RLS på → service-role (publik endpoint, nyckeln server-side)
  let inputs: IkigaiInputs = {};
  try {
    inputs = (await req.json()) as IkigaiInputs;

    const name = (inputs.person_name || "").trim();
    const email = (inputs.person_email || "").trim();
    if (!name) return NextResponse.json({ error: "Fyll i ditt namn." }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json({ error: "Fyll i en giltig e-postadress." }, { status: 400 });
    if (![inputs.love, inputs.skill, inputs.need, inputs.pay].every((v) => (v || "").trim().length >= 3)) {
      return NextResponse.json({ error: "Fyll i alla fyra frågorna." }, { status: 400 });
    }

    // Ingen klient-profil — innehållet ska handla om besökaren, inte om en Cockpit-klient.
    const knowledge = await getStaticKnowledge("ikigai-method");
    const result = await generateIkigai(inputs, knowledge);
    const markdown = result.markdown;
    if (!markdown) throw new Error("Kunde inte skapa din Ikigai just nu. Försök igen om en stund.");

    const { data: row } = await sb
      .from("ikigai_sessions")
      .insert({
        client_id: GRIPCOACHING_CLIENT_ID,
        person_name: name,
        person_email: email,
        inputs,
        result_markdown: markdown,
        diagram: result.diagram ?? null,
        source: "public",
        status: "done",
      })
      .select("id")
      .single();

    await logActivity(
      GRIPCOACHING_CLIENT_ID,
      "ikigai_lead",
      `Ny Ikigai-lead: ${name} (${email})`,
      "/dashboard/ikigai",
    );

    return NextResponse.json({
      ikigai_session_id: row?.id ?? null,
      markdown,
      diagram: result.diagram ?? null,
    });
  } catch (e) {
    await sb.from("ikigai_sessions").insert({
      client_id: GRIPCOACHING_CLIENT_ID,
      person_name: (inputs.person_name || "").trim() || null,
      person_email: (inputs.person_email || "").trim() || null,
      inputs,
      source: "public",
      status: "failed",
      error_message: (e as Error).message,
    }).then(() => {}, () => {});
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
