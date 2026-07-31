// TEXT-1 — bygger docs/text1/fore/SAMMANFATTNING.md ur batchens JSON-filer + körmetadata.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/text1/fore");
const SCRATCH = "C:/Users/hakan/AppData/Local/Temp/claude/C--Users-hakan-OneDrive-Dokument-Antigravity/69f20a37-dcf3-4038-aa77-5c740de668f9/scratchpad";

const PROFILER = [
  { slug: "displayteknik", name: "Displayteknik" },
  { slug: "engens-trad", name: "Engens Träd & Trädgård" },
  { slug: "hm-motor", name: "HM Motor Krokom" },
  { slug: "annas-blommor", name: "Annas Blommor" },
];
const FLODEN = ["studio-text", "caption", "karusell", "linkedin", "social", "nyhetsbrev", "blogg", "veckoplan", "enskilt"];

interface Post {
  amne_id: string;
  output: string | null;
  duration_ms: number;
  fel?: string;
  autochecks?: {
    cta_count: number; svag_hook: boolean; forbjudna_ord: string[]; floskler: string[];
    tankstreck_i_loptext: boolean; hashtags: number; rostmarkorer_traffade: number; rostmarkorer_totalt: number;
  };
}

const meta = JSON.parse(readFileSync(path.join(SCRATCH, "text1-run-meta.json"), "utf8"));

// Tabell profil × flöde
const cellRows: string[] = [];
const perFlode = new Map<string, Post[]>();
let totOk = 0, totFel = 0, totDurMs = 0;

for (const p of PROFILER) {
  const celler: string[] = [];
  for (const f of FLODEN) {
    const fil = path.join(OUT_DIR, p.slug, `${f}.json`);
    if (!existsSync(fil)) { celler.push("—"); continue; }
    const data = JSON.parse(readFileSync(fil, "utf8")) as { poster: Post[] };
    const ok = data.poster.filter((x) => x.output !== null).length;
    const fel = data.poster.length - ok;
    totOk += ok; totFel += fel;
    totDurMs += data.poster.reduce((a, x) => a + (x.duration_ms || 0), 0);
    celler.push(fel === 0 ? `${ok}/${data.poster.length}` : `${ok}/${data.poster.length} (${fel} fel)`);
    (perFlode.get(f) || perFlode.set(f, []).get(f)!).push(...data.poster);
  }
  cellRows.push(`| ${p.name} | ${celler.join(" | ")} |`);
}

// Snitt-autochecks per flöde
const snittRows: string[] = [];
for (const f of FLODEN) {
  const poster = (perFlode.get(f) || []).filter((x) => x.autochecks);
  if (!poster.length) { snittRows.push(`| ${f} | — | — | — | — | — | — | — |`); continue; }
  const n = poster.length;
  const avg = (fn: (a: NonNullable<Post["autochecks"]>) => number) =>
    (poster.reduce((s, x) => s + fn(x.autochecks!), 0) / n);
  const pct = (fn: (a: NonNullable<Post["autochecks"]>) => boolean) =>
    Math.round((poster.filter((x) => fn(x.autochecks!)).length / n) * 100);
  const rostPct = Math.round(
    (poster.reduce((s, x) => s + (x.autochecks!.rostmarkorer_totalt ? x.autochecks!.rostmarkorer_traffade / x.autochecks!.rostmarkorer_totalt : 0), 0) / n) * 100,
  );
  snittRows.push(
    `| ${f} | ${avg((a) => a.cta_count).toFixed(1)} | ${pct((a) => a.svag_hook)} % | ${avg((a) => a.forbjudna_ord.length).toFixed(2)} | ${avg((a) => a.floskler.length).toFixed(2)} | ${pct((a) => a.tankstreck_i_loptext)} % | ${avg((a) => a.hashtags).toFixed(1)} | ${rostPct} % |`,
  );
}

// Fel-lista
const felRader: string[] = [];
for (const p of PROFILER) {
  for (const f of FLODEN) {
    const fil = path.join(OUT_DIR, p.slug, `${f}.json`);
    if (!existsSync(fil)) continue;
    const data = JSON.parse(readFileSync(fil, "utf8")) as { poster: Post[] };
    for (const post of data.poster) {
      if (post.output === null) felRader.push(`- ${p.slug} × ${f} × ${post.amne_id}: ${post.fel}`);
    }
  }
}

const md = `# TEXT-1 FÖRE-BATCH — sammanfattning

Genererad ${meta.run_slut} mot **dagens kod** (före promptmigreringen). Detta är mätvärden att jämföra efter-batchen (T-4) mot — inte en kvalitetsbedömning i sig.

## Resultat per profil × flöde (lyckade/körda)

| Profil | ${FLODEN.join(" | ")} |
|---|${FLODEN.map(() => "---").join("|")}|
${cellRows.join("\n")}

**Totalt: ${totOk} lyckade, ${totFel} misslyckade av ${totOk + totFel} genereringar.**

## Snitt-autochecks per flöde (alla profiler)

| Flöde | CTA-ord (snitt) | Svag hook | Förbjudna ord (snitt) | Floskler (snitt) | Tankstreck i löptext | Hashtags (snitt) | Röstmarkör-träff |
|---|---|---|---|---|---|---|---|
${snittRows.join("\n")}

Anm: "CTA-ord" räknas med \`raknaCta\` (grov heuristik — flera träffar betyder inte alltid flera uppmaningar). "Röstmarkör-träff" = andel av klientens signature_phrases + pain_words + joy_words (ur \`client_voice_profile\`) som förekommer i texten. För JSON-flöden (linkedin, social, nyhetsbrev, veckoplan, enskilt) kördes autochecks på den sammanfogade kundtexten; för blogg på titel + avtaggad HTML; för enskilt på bästa varianten.

## Skippade flöden

Inga. Alla 9 flöden gick att köra utan kodändringar: lib-flöden (studio-text, karusell, nyhetsbrev, blogg) anropades direkt med explicit clientId; route-flöden (caption, linkedin, social, veckoplan, enskilt) anropades via importerad POST-handler med syntetisk Request. Session-beroendet (\`cookies()\`/\`headers()\`) löstes med en shim för \`next/headers\` (endast i batch-skriptets tsconfig — produktionskoden orörd) som bar en riktig HMAC-signerad admin-session + \`active_client_id\` per profil.

## Raderade bieffektsrader (tenant-datan orörd)

${(meta.stadning as string[]).map((s: string) => `- ${s}`).join("\n")}

## Kostnad & körtid

- Total körtid: **${Math.round(meta.total_korntid_s / 60)} min ${meta.total_korntid_s % 60} s** (summerad generering ${Math.round(totDurMs / 1000 / 60)} min ${Math.round((totDurMs / 1000) % 60)} s över parallella anrop)
- Utdata: ${meta.total_output_tecken.toLocaleString("sv-SE")} tecken ≈ **${meta.token_uppskattning_ut.toLocaleString("sv-SE")} utdata-tokens** (grov uppskattning, tecken/4 — flödena exponerar inte usage-metadata)
- Modellmix enligt flödenas egna val: Anthropic claude-sonnet-4-5 (studio-text, 7 varianter/generering), gemini-2.5-pro (linkedin, social, nyhetsbrev, blogg, veckoplan, enskilt), gemini-2.5-flash (caption, karusell)

## Var filerna ligger

\`docs/text1/fore/{profilslug}/{flode}.json\` — profilsluggar: ${PROFILER.map((p) => p.slug).join(", ")}.

## Misslyckade genereringar

${felRader.length ? felRader.join("\n") : "Inga."}
`;

writeFileSync(path.join(OUT_DIR, "SAMMANFATTNING.md"), md, "utf8");
console.log("Skrev docs/text1/fore/SAMMANFATTNING.md");
