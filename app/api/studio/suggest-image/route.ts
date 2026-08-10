import { NextRequest, NextResponse } from "next/server";
import { getActiveClient, resolveClientId } from "@/lib/client-context";
import { searchStockPhotos, generateImagen, visualScene, motivPassar, NO_DASH_IN_IMAGE_EN, DEPICTED_CONTENT_EN, DEPICTED_RELEVANCE_EN, PERSON_ATTENTION_EN } from "@/lib/images";
import { genereraMedExaktText, type TextAspekt } from "@/lib/studio/text-in-image";
import { stavningsgrind, kontrolleraAvbildadText, type StavUtfall } from "@/lib/bildtext";
import { getKitDirectives, imageDirectiveSuffix } from "@/lib/studio/kit";
import { seasonPromptLineEn } from "@/lib/content/sasong";
import { supabaseService } from "@/lib/supabase-admin";
import { requireAdminOrCustomer } from "@/lib/api-auth";

export const runtime = "nodejs";
// B3-slingan (upp till 3 gen + vision + fallback) behöver mer tid än enkel generering.
export const maxDuration = 60;

const BUCKET = "studio-images";

// G-6: bildvägens egen regelversion. Textvägen räknar sin ur prompt-core (G-1), men
// bilden har ingen prompt-core-prompt — dess regeluppsättning är realism-receptet,
// säsongsraden, motiv-grinden och stavningsgrinden. Höj den för hand när något av dem
// ändras, annars går ett före/efter i bildkvaliteten inte att tolka.
// v1 = läget vid G-6 (10/8): REALISM + säsong + motivPassar + stavningsgrind + kit.
const BILD_PROMPT_VERSION = "bild-v1";

// Realism-recept mot "AI-look": dokumentär stil, verklig vardagsmiljö, och framför allt —
// skärmar i bilden visar ENKELT verkligt innehåll. Abstrakta färgvirvlar på en LED-skärm
// är det största AI-avslöjandet i signage-sammanhang (skarp feedback från Håkan).
const REALISM_BAS =
  " Documentary-style photograph, believable everyday Swedish setting, natural light, candid realism with slight imperfections — not a sterile architectural render.";
// BILD-7a: avbildat exempelinnehåll ska ha relevans OCH budskap (DEPICTED_CONTENT_EN
// bär även BILD-6a:s tankstrecksregel). Den gamla raden krävde bara "enkelt verkligt
// innehåll" — skyltarna blev relevanta men tomma.
// (DEPICTED_CONTENT_EN bär även BILD-8b:s blickriktningsregel.)
const REALISM = `${REALISM_BAS} ${DEPICTED_CONTENT_EN}`;
// Text-i-bild-vägen (B3) sätter den exakta texten själv — då gäller bara relevans-
// halvan, annars konkurrerar två textkällor om samma yta. BILD-8b gäller ändå: en
// person i bilden ska vara vänd mot skylten som texten hamnar på.
const REALISM_EXAKT_TEXT = `${REALISM_BAS} ${DEPICTED_RELEVANCE_EN} ${PERSON_ATTENTION_EN} ${NO_DASH_IN_IMAGE_EN}`;

// BILD-8a: hela requestens tidsbudget. Grindens omtag får bara starta om det finns tid
// kvar innan routens maxDuration (60 s) — annars släpps bilden igenom som den är.
const MAX_MS = 46000;

// POST /api/studio/suggest-image — { mode: "stock" | "ai", topic, aspect }
// stock → Pexels-foton (publika URL:er, direkt användbara). ai → Imagen 4.0 → studio-images.
// Admin-grindad av proxy.ts.
export async function POST(req: NextRequest) {
  const denied = await requireAdminOrCustomer();
  if (denied) return denied;
  const t0 = Date.now();

  try {
    const client = await getActiveClient();
    // ALDRIG en annan klients bransch som fallback (samma familj som Opticur-läckan) —
    // saknas industry används klientnamnet, annars neutralt.
    const niche = client?.industry || client?.name || "företaget";
    const body = await req.json().catch(() => ({}));
    const topic = (body.topic || "").toString().slice(0, 200) || niche;

    if (body.mode === "ai") {
      const ar = body.aspect === "story" ? "9:16" : body.aspect === "portrait" ? "3:4" : body.aspect === "square" ? "1:1" : "4:3";
      const directives = await getKitDirectives(await resolveClientId());
      // BILD-5b: säsongsrad i bildprompten — hela scenen (kläder/ljus/växtlighet/väder)
      // ska stämma med årstiden (skarpt fel: semla i juli).
      const SEASON = ` ${seasonPromptLineEn()}`;

      // B3: exakt text i bilden — egen väg med vision-verifiering + programmatisk fallback.
      // Fältet är separat ("Text i bilden"), inte inbakat i friprompten.
      const exactText = String(body.exactText || "").slice(0, 120).trim();
      if (exactText) {
        const aspekt: TextAspekt = ar === "9:16" ? "9:16" : ar === "3:4" ? "3:4" : "1:1";
        const scen = await visualScene(topic, niche, { textYta: true });
        const korExakt = (skarpning: string) => genereraMedExaktText({
          scen: `${scen} Verkligt foto, naturligt ljus.${REALISM_EXAKT_TEXT}${SEASON}${skarpning}`,
          text: exactText,
          aspekt,
          stil: body.textStil === "overlay" ? "overlay" : "lapp",
          stilSuffix: imageDirectiveSuffix(directives),
          // textForsok 0 = direkt programmatisk (garanterat rättstavat) — QA/kraftläge.
          maxForsok: typeof body.textForsok === "number" ? body.textForsok : undefined,
        });
        const res = await korExakt("");
        // BILD-8a: B3 verifierar sin EGEN text bokstav för bokstav — men modellen kan ha
        // ritat annan text i bilden (bakgrundsskylt). Grinden dömer bara de orden, och
        // bara om det finns tid kvar. Sista utvägen är förbjuden här: texten ÄR poängen.
        if (res.image) {
          const grind = await stavningsgrind({
            bild: res.image,
            ignorera: exactText,
            maxOmtag: 1,
            tillatBlank: false,
            tidsbudgetMs: MAX_MS - (Date.now() - t0),
            generera: async ({ skarpning }) => korExakt(skarpning),
          });
          res.image = grind.image;
        }
        const em = res.image?.match(/^data:image\/(\w+);base64,(.+)$/);
        if (res.error || !em) {
          return NextResponse.json({ error: res.error || "Kunde inte skapa bilden med texten — försök igen." }, { status: 500 });
        }
        const cid = await resolveClientId();
        const sbx = supabaseService();
        const { data: bks } = await sbx.storage.listBuckets();
        if (!bks?.some((b) => b.name === BUCKET)) await sbx.storage.createBucket(BUCKET, { public: true });
        const p = `${cid}/ai-text-${Date.now()}.${em[1] === "jpeg" ? "jpg" : "png"}`;
        const upx = await sbx.storage.from(BUCKET).upload(p, Buffer.from(em[2], "base64"), { contentType: `image/${em[1]}` });
        if (upx.error) return NextResponse.json({ error: upx.error.message }, { status: 500 });
        const pubx = sbx.storage.from(BUCKET).getPublicUrl(p);
        return NextResponse.json({
          photos: [{ url: pubx.data.publicUrl, thumb: pubx.data.publicUrl, credit: res.metod === "programmatisk" ? "AI + textsäkring" : "AI (Imagen)" }],
          description: scen,
          textInfo: { metod: res.metod, forsok: res.forsok, verifierad: res.verifierad, avlastText: res.avlastText },
        });
      }

      // Två steg: gör om ämnet/bildtexten (ofta prosa) till en visuell scen först — annars
      // svarar bildmodellen NO_IMAGE på ett meddelande/råd.
      const scene = await visualScene(topic, niche);
      // G-6: kundens egna omdömen om tidigare bilder. Tummen har funnits i gränssnittet
      // och lovat "AI lär sig", men BARA legacy-vägen läste den — Studios Bildhjälpen,
      // som är den väg kunderna faktiskt använder, gjorde det aldrig. Fail-open.
      const { hamtaBildfeedback, bildfeedbackBlock } = await import("@/lib/bildfeedback");
      const bildlage = await hamtaBildfeedback(await resolveClientId());
      const FEEDBACK = bildlage.finns ? `\n${bildfeedbackBlock(bildlage)}` : "";
      const bas = `${scene} Verkligt foto, naturligt ljus. Ingen pålagd rubrik, uppmaning eller logotyp ovanpå bilden — skyltning som hör hemma i miljön följer regeln nedan.${REALISM}${SEASON}${imageDirectiveSuffix(directives)}${FEEDBACK}`;
      const branschKrav = `${scene} The scene must clearly and unmistakably belong to this business: ${niche}. Show its real environment, products or customers — no metaphors from other industries. Verkligt foto, naturligt ljus. Ingen pålagd rubrik, uppmaning eller logotyp ovanpå bilden — skyltning som hör hemma i miljön följer regeln nedan.${REALISM}${SEASON}${imageDirectiveSuffix(directives)}${FEEDBACK}`;
      // Motiv-grind: bilden måste höra hemma i verksamheten (skarpt fel: "Sluta köpa
      // billigt" gav en sliten tröja för ett digital signage-företag). Ett omtag med
      // hårdare branschkrav, sen fail-closed — hellre "prova Sök foto" än fel bransch.
      let promptIBruk = bas;
      let gen = await generateImagen(bas, ar);
      if (gen.image && !(await motivPassar(gen.image, niche))) {
        promptIBruk = branschKrav;
        gen = await generateImagen(branschKrav, ar);
        if (gen.image && !(await motivPassar(gen.image, niche))) {
          return NextResponse.json({ error: "Motivet ville inte träffa er verksamhet den här gången. Prova “Sök foto”, eller skriv i ämnesraden vad bilden ska föreställa." }, { status: 500 });
        }
      }
      // BILD-8a: modellen ritar skyltar även utan att bli ombedd — och stavar fel när den
      // gör det (skarpt fel: "VÅRA NYHIETES"). Grinden läser av teckenvis, begär omtag med
      // skärpt stavningsinstruktion, och ber till sist om ett TEXTLÖST MOTIV (BILD-8c —
      // tomma skyltar motverkade BILD-7a). Fail-open i alla led.
      let stavning: Record<string, unknown> | undefined;
      if (gen.image) {
        // Ren observabilitet (BILD-8 DoD): varje avläsning sparas via den seam som redan
        // finns för test (`kontrollera`). Grindens beteende är identiskt — wrappern
        // returnerar exakt vad kontrolleraAvbildadText returnerar.
        const avlasningar: StavUtfall[] = [];
        const diagnostik = body.diagnostik === true;
        const grind = await stavningsgrind({
          bild: gen.image,
          maxOmtag: 2,
          tidsbudgetMs: MAX_MS - (Date.now() - t0),
          generera: ({ skarpning }) => generateImagen(`${promptIBruk}${skarpning}`, ar),
          kontrollera: diagnostik
            ? async (b, o) => { const u = await kontrolleraAvbildadText(b, o); avlasningar.push(u); return u; }
            : undefined,
        });
        gen = { ...gen, image: grind.image };
        // Fältet följer bara med när anroparen ber om det — vanliga svar till Studio är oförändrade.
        if (diagnostik) {
          stavning = { orsak: grind.utfall.orsak, text: grind.utfall.text, ord: grind.utfall.ord, ordBak: grind.utfall.ordBak, fel: grind.utfall.fel, omtag: grind.omtag, blank: grind.blank, avlasningar };
        }
      }
      const m = gen.image?.match(/^data:image\/(\w+);base64,(.+)$/);
      // ETAPP K2-2: en grind (slut kvot eller kostnadstak) har ett besked skrivet FÖR
      // användaren. Det får aldrig ersättas av "prova Sök foto" — då förstår hon inte varför.
      if (gen.stopp) return NextResponse.json({ error: gen.error }, { status: 429 });
      if (gen.error || !m) {
        // Snäll, handlingsbar text (t.ex. vid känsligt motiv som nekas) — peka mot Sök foto.
        // 500 → klientens felruta visar meddelandet.
        return NextResponse.json({ error: "Kunde inte skapa en bild för det här ämnet. Prova “Sök foto”, eller skriv kort i “vad det handlar om” vad bilden ska föreställa." }, { status: 500 });
      }

      const clientId = await resolveClientId();
      const sb = supabaseService();
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((b) => b.name === BUCKET)) await sb.storage.createBucket(BUCKET, { public: true });
      const path = `${clientId}/ai-${Date.now()}.png`;
      const up = await sb.storage.from(BUCKET).upload(path, Buffer.from(m[2], "base64"), { contentType: "image/png" });
      if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
      const pub = sb.storage.from(BUCKET).getPublicUrl(path);
      // G-6: raden i generationsloggen som feedbacken ska kunna peka på. Bildflödena
      // skrev inga rader dit förut — därför bar `motiv_kategori` (byggd i G-1) aldrig
      // ett värde, och ett nedslag gick inte att knyta till modell eller promptversion.
      // Skrivs EFTER uppladdningen: en bild som aldrig blev till ska inte ha en rad.
      // Fail-open — loggningen får aldrig fälla en färdig bild.
      let generationId: string | null = null;
      try {
        const { loggaGenerering } = await import("@/lib/generationslogg");
        generationId = await loggaGenerering({
          tenantId: clientId,
          syfte: "bild",
          format: ar,
          // Bildvägen bygger ingen textprompt, så den har ingen prompt-core-version.
          // Motivreceptet ÄR regeluppsättningen här, och det versioneras för sig.
          promptVersion: BILD_PROMPT_VERSION,
          motivKategori: promptIBruk === branschKrav ? "branschkrav-omtag" : "standard",
        });
      } catch (e) {
        console.error("[suggest-image] generationsloggen kunde inte skrivas:", e);
      }
      // Returnera scenbeskrivningen: textförslagen grundas i vad bilden faktiskt föreställer
      // (så en säljande rubrik inte hamnar ovanpå en problembild).
      // generationId följer med ut så tummen kan binda sitt omdöme till RÄTT generering
      // i stället för att jämföra promptsträngar i efterhand.
      return NextResponse.json({ photos: [{ url: pub.data.publicUrl, thumb: pub.data.publicUrl, credit: "AI (Imagen 4.0)" }], description: scene, generationId, ...(stavning ? { stavning } : {}) });
    }

    // stock (Pexels) — riktiga foton, brand-medveten sökfråga
    const res = await searchStockPhotos(topic, niche, 9);
    if (res.error) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({
      photos: res.photos.map((p) => ({ url: p.src, thumb: p.srcMedium, credit: p.photographer })),
      query: res.query,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
