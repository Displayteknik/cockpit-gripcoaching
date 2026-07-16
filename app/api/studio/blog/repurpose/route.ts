import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, getActiveClientId } from "@/lib/client-context";
import { repurposeToSocial } from "@/lib/studio/blog";
import { getKitDirectives } from "@/lib/studio/kit";
import { supabaseService } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/studio/blog/repurpose — { title, articleText, topic }
// Gör om artikeln till 3 sociala affisch-inlägg → sparas i studio_posts (biblioteket).
export async function POST(req: NextRequest) {
  try {
    const client = await getActiveClient();
    const clientId = await getActiveClientId();
    const b = await req.json().catch(() => ({}));
    const title = (b.title || "").toString().trim();
    const articleText = (b.articleText || "").toString();
    if (!articleText) return NextResponse.json({ error: "Ingen artikel att göra om" }, { status: 400 });

    const variants = await repurposeToSocial({
      clientId, title, articleText,
      brandName: client?.name || undefined,
      industry: client?.industry || undefined,
    });
    if (!variants.length) return NextResponse.json({ error: "Kunde inte skapa inlägg ur artikeln" }, { status: 500 });

    const slug = client?.slug || "opticur";
    // Format-medvetet arketypval ur klientens contentProfile. Faller tillbaka på statement.
    const { formats } = await getKitDirectives(clientId);
    const has = (f: string) => !formats.length || formats.includes(f);
    const pickArchetype = (hook: string): string => {
      if (hook === "berättelse") return has("overlay") ? "ark-overlay" : has("poster") ? "ark-foto-ruta" : "ark-statement";
      if (hook === "fråga" || hook === "konträr") return has("text-only") ? "ark-textkort" : "ark-statement";
      if (hook === "statistik") return has("list") ? "ark-lista" : "ark-statement";
      return has("statement") ? "ark-statement" : has("text-only") ? "ark-textkort" : "ark-foto-ruta";
    };
    const rows = variants.map((v) => {
      const templateId = pickArchetype(v.hookType);
      return {
        client_id: clientId,
        template_id: templateId,
        format: "1080x1350",
        title: v.headline1 || title,
        payload: {
          clientId: slug,
          templateId,
          format: "1080x1350",
          headline1: v.headline1,
          headline2: v.headline2,
          body: v.body,
          badge: { enabled: false, line1: "", line2: "" },
          imageUrl: "",
          imageFocusY: 40,
          brushColor: "",
          source: "blog-repurpose",
        },
        image_url: null,
        updated_at: new Date().toISOString(),
      };
    });

    const sb = supabaseService();
    const { data, error } = await sb.from("studio_posts").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: data?.length || 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
