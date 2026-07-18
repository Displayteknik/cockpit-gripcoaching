import { NextResponse } from "next/server";
import { requireAdminOrCustomer } from "@/lib/api-auth";
import { getActiveClientId } from "@/lib/client-context";
import { supabaseService } from "@/lib/supabase-admin";
import { generateJSON } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST /api/offert/generate { quoteId } — fyller klientens inlärda blueprint med AI-skriven text
// för DENNA affär (kund + rader), i klientens ton. Returnerar färdig offert-struktur att rendera
// (sektioner + prislista + villkor + signatur). Tenant-låst. Ingen annans blueprint någonsin.
export async function POST(req: Request) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const clientId = await getActiveClientId();
  let body: { quoteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }
  if (!body.quoteId) return NextResponse.json({ error: "quoteId krävs" }, { status: 400 });

  const sb = supabaseService();
  const [{ data: quote }, { data: items }, { data: bp }, { data: client }] = await Promise.all([
    sb.from("offert_quotes").select("*").eq("id", body.quoteId).eq("client_id", clientId).maybeSingle(),
    sb.from("offert_quote_items").select("name, qty, unit_price, lead_time_days, sort").eq("quote_id", body.quoteId).order("sort"),
    sb.from("offert_blueprint").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("clients").select("name").eq("id", clientId).maybeSingle(),
  ]);
  if (!quote) return NextResponse.json({ error: "Offert hittades inte" }, { status: 404 });

  const rader = (items as { name: string; qty: number; unit_price: number | null; lead_time_days: number | null }[] | null) || [];
  const foretag = client?.name || "Vårt företag";

  // Blueprint (kundens egen) styr sektionerna. Saknas den → generisk standardstruktur (aldrig annans).
  const sektionerIn: { rubrik: string; syfte: string; exempeltext: string }[] =
    (bp?.sektioner as { rubrik: string; syfte: string; exempeltext: string }[] | null) || [
      { rubrik: "Inledning", syfte: "Tacka för förtroendet och sammanfatta uppdraget", exempeltext: "" },
      { rubrik: "Vårt förslag", syfte: "Beskriv den föreslagna lösningen", exempeltext: "" },
      { rubrik: "Pris", syfte: "Sammanfatta priset", exempeltext: "" },
      { rubrik: "Nästa steg", syfte: "Hur kunden går vidare", exempeltext: "" },
    ];
  const ton = bp?.ton || "rak, varm, professionell, inga floskler";

  // Prissektionen skrivs ALDRIG av AI:n (den fylls med den deterministiska pristabellen vid render) —
  // annars hittar modellen på priser. AI skriver bara de berättande sektionerna.
  const isPris = (r: string) => /pris|kostnad|invester|belopp/i.test(r);
  const narrativa = sektionerIn.filter((s) => !isPris(s.rubrik));

  const produktText = rader.map((r) => `${r.qty}× ${r.name}`).join(", ") || "de offererade posterna";
  const system = `Du skriver en färdig, säljande men ärlig OFFERT på svenska i ENBART den här tonen: ${ton}. Skriv ALDRIG priser, siffror i kronor, tabeller eller villkorstext (de läggs till separat och deterministiskt). För varje angiven sektion: skriv innehållet skräddarsytt för DENNA kund och affär, i naturligt flytande text. Använd kundens namn och de offererade produkterna där det passar. Hitta ALDRIG på fakta, priser eller referenser. Undvik AI-floskler ("kraftfull", "banbrytande", "nästa nivå", "handlar om").`;
  const user = `Företag som skickar offerten: ${foretag}
Kund: ${quote.customer_name || ""}${quote.customer_company ? ` (${quote.customer_company})` : ""}
Det som offereras: ${produktText}

Skriv dessa sektioner (behåll rubrikerna EXAKT som angivet, inga priser/siffror i kronor):
${narrativa.map((s) => `- "${s.rubrik}": ${s.syfte}.${s.exempeltext ? ` Stil/exempel: ${s.exempeltext}` : ""}`).join("\n")}

Returnera JSON: {"sektioner":[{"rubrik":"exakt rubrik","text":"skräddarsydd text"}]}`;

  let aiSektioner: { rubrik: string; text: string }[] = [];
  try {
    const out = await generateJSON<{ sektioner: { rubrik: string; text: string }[] }>({
      model: "gemini-2.5-flash",
      systemInstruction: system,
      prompt: user,
      temperature: 0.5,
      maxOutputTokens: 4096,
    });
    aiSektioner = out?.sektioner || [];
  } catch (e) {
    return NextResponse.json({ error: "Kunde inte generera texten: " + (e as Error).message }, { status: 500 });
  }
  if (!aiSektioner.length) return NextResponse.json({ error: "Tom generering" }, { status: 422 });

  // Sätt ihop i ursprunglig ordning: berättande = AI-text, prissektion = tom (tabell renderas separat).
  const byIndex = aiSektioner.length === narrativa.length;
  let ni = 0;
  const sektioner = sektionerIn.map((s) => {
    if (isPris(s.rubrik)) return { rubrik: s.rubrik, text: "" };
    const ai = byIndex ? aiSektioner[ni++] : aiSektioner.find((a) => a.rubrik.trim() === s.rubrik.trim());
    return { rubrik: s.rubrik, text: ai?.text || "" };
  });

  return NextResponse.json({
    ok: true,
    offert: {
      foretag,
      quote_number: quote.quote_number,
      customer_name: quote.customer_name,
      customer_company: quote.customer_company,
      valuta: bp?.valuta || "SEK",
      sektioner,
      rader: rader.map((r) => ({ name: r.name, qty: r.qty, unit_price: r.unit_price, lead_time_days: r.lead_time_days })),
      total: quote.total,
      villkor: (bp?.villkor as Record<string, unknown>) || {},
      signatur: (bp?.meta as { signatur?: string } | null)?.signatur || `Med vänliga hälsningar\n${foretag}`,
    },
  });
}
