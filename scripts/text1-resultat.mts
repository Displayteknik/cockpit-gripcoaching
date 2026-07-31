// TEXT-1 T-4 — bygger TEXT1-RESULTAT.md: före/efter-jämförelse per flöde ur
// docs/text1/fore + docs/text1/efter (samma låsta ämnen, samma autochecks).
// Körning: npx tsx scripts/text1-resultat.mts

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PROFILER = [
  { slug: "displayteknik", name: "Displayteknik" },
  { slug: "engens-trad", name: "Engens Träd & Trädgård" },
  { slug: "hm-motor", name: "HM Motor Krokom" },
  { slug: "annas-blommor", name: "Annas Blommor" },
];
const FLODEN = ["studio-text", "caption", "karusell", "linkedin", "social", "nyhetsbrev", "blogg", "veckoplan", "enskilt"];

interface AC { cta_count: number; svag_hook: boolean; forbjudna_ord: string[]; floskler: string[]; tankstreck_i_loptext: boolean; hashtags: number; rostmarkorer_traffade: number; rostmarkorer_totalt: number }
interface Post { amne_id: string; tema: string; output: string | null; fel?: string; autochecks?: AC }

function lasFil(sida: "fore" | "efter", slug: string, flode: string): Post[] {
  const p = path.join(ROOT, "docs/text1", sida, slug, `${flode}.json`);
  if (!existsSync(p)) return [];
  try { return (JSON.parse(readFileSync(p, "utf8")).poster || []) as Post[]; } catch { return []; }
}

interface Agg { n: number; cta: number; ctaExakt1: number; svag: number; forbjudna: number; floskler: number; tank: number; hash: number; rostAndel: number; rostN: number }
function aggregera(poster: Post[]): Agg {
  const a: Agg = { n: 0, cta: 0, ctaExakt1: 0, svag: 0, forbjudna: 0, floskler: 0, tank: 0, hash: 0, rostAndel: 0, rostN: 0 };
  for (const p of poster) {
    if (!p.autochecks || !p.output || p.fel) continue;
    const c = p.autochecks;
    a.n++;
    a.cta += c.cta_count;
    if (c.cta_count === 1) a.ctaExakt1++;
    if (c.svag_hook) a.svag++;
    a.forbjudna += c.forbjudna_ord.length;
    a.floskler += c.floskler.length;
    if (c.tankstreck_i_loptext) a.tank++;
    a.hash += c.hashtags;
    if (c.rostmarkorer_totalt > 0) { a.rostAndel += c.rostmarkorer_traffade / c.rostmarkorer_totalt; a.rostN++; }
  }
  return a;
}
const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const pct = (x: number, n: number) => (n ? Math.round((100 * x) / n) + " %" : "–");

const rader: string[] = [];
rader.push("# TEXT1-RESULTAT — före/efter promptmigreringen (T-4)");
rader.push("");
rader.push(`Genererad ${new Date().toISOString().slice(0, 16).replace("T", " ")}. Samma 5 låsta ämnen (docs/text1/amnen.json), samma 4 klientprofiler, samma mätsticka (autochecks) på båda sidor. FÖRE = koden före TEXT-1 (studio-text fångad från worktree på T-2-commit — vägen orörd t.o.m. dess). EFTER = prompt-core-vägen.`);
rader.push("");
rader.push("Läsanvisning: CTA-ord räknas med grov heuristik (`raknaCta`) — riktningen är det viktiga, inte absolutvärdet. \"Röst-träff\" = andel av klientens signaturfraser/smärtord/glädjeord som förekommer. Floskler = plattformens förbjudna AI-ord. Tankstreck = som skiljetecken i löptext.");
rader.push("");
rader.push("## Autochecks per flöde — alla profiler ihop");
rader.push("");
rader.push("| Flöde | Texter (före→efter) | CTA-snitt | Svag hook | Förbjudna ord/text | Floskler/text | Tankstreck | Hashtags-snitt | Röst-träff |");
rader.push("|---|---|---|---|---|---|---|---|---|");

const perFlodeSummering: Record<string, { fore: Agg; efter: Agg }> = {};
for (const flode of FLODEN) {
  const fore = aggregera(PROFILER.flatMap((p) => lasFil("fore", p.slug, flode)));
  const efter = aggregera(PROFILER.flatMap((p) => lasFil("efter", p.slug, flode)));
  perFlodeSummering[flode] = { fore, efter };
  if (!efter.n) { rader.push(`| ${flode} | ${fore.n} → SAKNAS | | | | | | | |`); continue; }
  const cell = (fv: string, ev: string) => `${fv} → **${ev}**`;
  rader.push(
    `| ${flode} | ${fore.n} → ${efter.n} | ` +
      [
        cell(f1(fore.cta / fore.n), f1(efter.cta / efter.n)),
        cell(pct(fore.svag, fore.n), pct(efter.svag, efter.n)),
        cell(f1(fore.forbjudna / fore.n), f1(efter.forbjudna / efter.n)),
        cell(f1(fore.floskler / fore.n), f1(efter.floskler / efter.n)),
        cell(pct(fore.tank, fore.n), pct(efter.tank, efter.n)),
        cell(f1(fore.hash / fore.n), f1(efter.hash / efter.n)),
        cell(pct(Math.round(100 * fore.rostAndel), 100 * fore.rostN || 1), pct(Math.round(100 * efter.rostAndel), 100 * efter.rostN || 1)),
      ].join(" | ") +
      " |",
  );
}

rader.push("");
rader.push("## Exakt en CTA (skrivregel 4) — andel texter");
rader.push("");
rader.push("| Flöde | Före | Efter |");
rader.push("|---|---|---|");
for (const flode of FLODEN) {
  const { fore, efter } = perFlodeSummering[flode];
  if (!efter.n) continue;
  rader.push(`| ${flode} | ${pct(fore.ctaExakt1, fore.n)} | **${pct(efter.ctaExakt1, efter.n)}** |`);
}

rader.push("");
rader.push("## Sida vid sida — första ämnet (\"misstag\") per flöde, Displayteknik");
rader.push("");
const visa = (t: string | null) => String(t || "").replace(/\r/g, "").trim().slice(0, 550) + (String(t || "").length > 550 ? " …" : "");
for (const flode of FLODEN) {
  const fp = lasFil("fore", "displayteknik", flode).find((p) => p.amne_id === "misstag");
  const ep = lasFil("efter", "displayteknik", flode).find((p) => p.amne_id === "misstag");
  if (!fp?.output || !ep?.output) continue;
  rader.push(`### ${flode}`);
  rader.push("");
  rader.push("**Före:**");
  rader.push("```");
  rader.push(visa(fp.output));
  rader.push("```");
  rader.push("**Efter:**");
  rader.push("```");
  rader.push(visa(ep.output));
  rader.push("```");
  rader.push("");
}

rader.push("## Blindbedömning (Håkan — bilaga B i REVISION-protokollet)");
rader.push("");
rader.push("Per profil, 10 slumpade EFTER-texter: Nivå 1 publicerar direkt / Nivå 2 en minuts puts / Nivå 3 omskrivning. Ribba: minst 7/10 på nivå 1–2.");
rader.push("");
rader.push("| Profil | N1 | N2 | N3 | Godkänd? | Kommentar |");
rader.push("|---|---|---|---|---|---|");
for (const p of PROFILER) rader.push(`| ${p.name} | | | | | |`);
rader.push("");
rader.push("Under ribban → justera PROFILLAGRET (brand-profil/fingerprint/winning examples för den klienten), inte arkitekturen.");

writeFileSync(path.join(ROOT, "TEXT1-RESULTAT.md"), rader.join("\n") + "\n");
console.log("Skrev TEXT1-RESULTAT.md");
