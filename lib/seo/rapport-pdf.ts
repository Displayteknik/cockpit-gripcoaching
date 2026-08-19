// SEO/AEO-djupgranskningen som utskriftsfärdig rapport.
//
// Rapporten föds som en enda Markdown-text på ~50 000 tecken. Kunden kunde bara ladda ner
// den som .md — en fil hon inte kan öppna, inte läsa och absolut inte visa för någon.
// Här blir den ett dokument hon kan skriva ut, spara som PDF och lämna ifrån sig.
//
// ★ REN FUNKTION MED FLIT. Ingen DOM, inga beroenden, inget nätanrop: `byggRapportHtml`
//   tar text in och ger text ut. Det gör den testbar, och det gör att samma HTML kan
//   renderas från admin-vyn, kundvyn eller ett skript utan att bete sig olika.
//
// ⚠ INGEN DATA UPPFINNS HÄR. Grafiken räknar bara det som redan står i rapporten —
//   statusraderna, fynden, tiderna. Hittar parsningen inget ritas ingen graf, och texten
//   renderas som vanligt. En figur som visar något källan inte säger vore samma sorts fel
//   som djupgranskningen stängdes av för i augusti.

export interface RapportKontext {
  klientNamn: string;
  url: string;
  /** Märkesfärgen. Bär rubrikband och magnitudstaplar — aldrig text. */
  primarFarg: string;
  logoUrl?: string | null;
  /** Visas i sidfoten. Faller tillbaka på rapportens eget datum. */
  datum?: string | null;
}

// ── Textsäkerhet ─────────────────────────────────────────────────────────────

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Inline-formatering EFTER escaping. Ordningen är viktig: `code` först, så att en asterisk
 * inne i ett kodavsnitt inte blir kursiv.
 */
function inline(rå: string): string {
  let t = esc(rå);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

// ── Statusmärken ─────────────────────────────────────────────────────────────
//
// Statusfärgerna är fasta och paras ALLTID med ikon och ord. Två av dem ligger under 3:1
// mot vitt med flit — färgen får därför aldrig bära betydelsen ensam.
type Status = "god" | "varning" | "kritisk";

const STATUS: Record<Status, { farg: string; ikon: string; ord: string }> = {
  god: { farg: "#0ca30c", ikon: "✓", ord: "Klart" },
  varning: { farg: "#fab219", ikon: "!", ord: "Se över" },
  kritisk: { farg: "#d03b3b", ikon: "×", ord: "Åtgärda" },
};

function statusAv(cell: string): Status | null {
  if (/✅|✔/.test(cell)) return "god";
  if (/⚠/.test(cell)) return "varning";
  if (/❌|✖/.test(cell)) return "kritisk";
  return null;
}

// ── Parsning av det grafiken vilar på ────────────────────────────────────────

interface StatusRad { omrade: string; status: Status; kommentar: string }

/**
 * Nulägestabellen (`| Område | Status | Kommentar |`). Den är rapportens enda ställe med
 * en fullständig genomgång per område, och därmed det enda som får bli en översiktsfigur.
 */
export function lasStatusTabell(md: string): StatusRad[] {
  const rader: StatusRad[] = [];
  for (const m of md.matchAll(/^\|([^|\n]+)\|([^|\n]+)\|([^|\n]*)\|\s*$/gm)) {
    const omrade = m[1].trim();
    const status = statusAv(m[2]);
    if (!status || /^-+$/.test(omrade) || /^område$/i.test(omrade)) continue;
    rader.push({ omrade, status, kommentar: m[3].trim() });
  }
  return rader;
}

interface Fynd { nr: string; rubrik: string; kategori: string | null }

/**
 * Fynden står som `## 3. Canonical-tagg saknas — Google ser två versioner — Teknisk hygien`.
 * Sista tankstrecks-delen är effektklassen och blir en etikett; resten är rubriken.
 */
export function lasFynd(md: string): Fynd[] {
  const ut: Fynd[] = [];
  for (const m of md.matchAll(/^## (\d+)\.\s+(.+)$/gm)) {
    const delar = m[2].split(/\s+—\s+/);
    const kategori = delar.length > 1 ? delar[delar.length - 1].trim() : null;
    const rubrik = delar.length > 1 ? delar.slice(0, -1).join(" — ").trim() : m[2].trim();
    ut.push({ nr: m[1], rubrik, kategori });
  }
  return ut;
}

/**
 * Tidsuppskattningar i planen. Raden ser ut så här i mallen:
 *
 *   ## Steg 1 — denna vecka (snabbt + störst effekt) → ~4 timmar
 *
 * ⚠ Skiljetecknet före tiden är en PIL, inte ett tankstreck — och tankstreck förekommer
 *   inuti etiketten. Ett mönster som delar på tankstreck fångar därför ingenting alls
 *   (utfall: tom lista, ingen figur). Parentesen klipps bort ur etiketten: den är en
 *   motivering, inte ett namn, och gör stapelraden dubbelt så bred som den behöver vara.
 */
export function lasTider(md: string): { steg: string; minuter: number; text: string }[] {
  const ut: { steg: string; minuter: number; text: string }[] = [];
  for (const m of md.matchAll(/^##\s+(Steg\s[^\n→]+?)\s*→\s*~?\s*([\d]+(?:[,.]\d+)?)\s*(min(?:uter)?|timm[ae]r?|tim|h)\b/gim)) {
    const tal = parseFloat(m[2].replace(",", "."));
    if (!isFinite(tal) || tal <= 0) continue;
    const minuter = /^min/i.test(m[3]) ? tal : tal * 60;
    const steg = m[1].replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    ut.push({ steg, minuter, text: `${m[2].replace(".", ",")} ${/^min/i.test(m[3]) ? "min" : "tim"}` });
  }
  return ut;
}

// ── Figurerna ────────────────────────────────────────────────────────────────

/**
 * Nuläget som en liggande andelsstapel. Tre segment, aldrig fler — och varje segment bär
 * sin egen siffra och sitt eget ord, så färgen aldrig är enda bäraren.
 *
 * 2 px mellanrum mellan segmenten görs med vit ram, inte med border runt marken.
 * Etiketten läggs UTANFÖR när segmentet är för smalt för att rymma den.
 */
function halsostapel(rader: StatusRad[], _farg: string): string {
  if (rader.length < 3) return "";
  const antal = (s: Status) => rader.filter((r) => r.status === s).length;
  const total = rader.length;
  const segment = (["god", "varning", "kritisk"] as Status[])
    .map((s) => ({ s, n: antal(s), andel: (antal(s) / total) * 100 }))
    .filter((x) => x.n > 0);

  return `
  <figure class="fig">
    <figcaption class="fig-titel">Nuläget — ${total} kontrollerade områden</figcaption>
    <div class="stapel">
      ${segment
        .map(
          (x) => `<div class="seg" style="width:${x.andel.toFixed(2)}%;background:${STATUS[x.s].farg}">${
            x.andel >= 14 ? `<span class="seg-tal">${x.n}</span>` : ""
          }</div>`,
        )
        .join("")}
    </div>
    <div class="legend">
      ${segment
        .map(
          (x) =>
            `<span class="legend-post"><span class="prick" style="background:${STATUS[x.s].farg}">${STATUS[x.s].ikon}</span>${x.n} ${STATUS[x.s].ord.toLowerCase()}</span>`,
        )
        .join("")}
    </div>
  </figure>`;
}

/** Områdena som lista med statusmärke. Identitet och tillstånd — alltså tabell, inte graf. */
function statusrutnat(rader: StatusRad[]): string {
  if (!rader.length) return "";
  return `
  <div class="rutnat">
    ${rader
      .map(
        (r) => `<div class="rut">
      <span class="prick" style="background:${STATUS[r.status].farg}">${STATUS[r.status].ikon}</span>
      <div><div class="rut-namn">${esc(r.omrade)}</div><div class="rut-kom">${inline(r.kommentar)}</div></div>
    </div>`,
      )
      .join("")}
  </div>`;
}

/** Tidsåtgång per steg. En storhet, en färg — längden bär värdet. */
function tidsstaplar(tider: { steg: string; minuter: number; text: string }[], farg: string): string {
  if (tider.length < 2) return "";
  const max = Math.max(...tider.map((t) => t.minuter));
  const summa = tider.reduce((a, t) => a + t.minuter, 0);
  // Svenskt decimalkomma. Dokumentet är kundens, och en punkt läses som tusentalsavskiljare.
  const total = summa >= 60 ? `${(summa / 60).toFixed(1).replace(/\.0$/, "").replace(".", ",")} timmar` : `${summa} min`;
  return `
  <figure class="fig">
    <figcaption class="fig-titel">Så lång tid tar det — ${total} totalt</figcaption>
    <div class="tider">
      ${tider
        .map(
          (t) => `<div class="tid-rad">
        <span class="tid-namn">${esc(t.steg)}</span>
        <span class="tid-spar"><span class="tid-bar" style="width:${((t.minuter / max) * 100).toFixed(1)}%;background:${farg}"></span></span>
        <span class="tid-val">${esc(t.text)}</span>
      </div>`,
        )
        .join("")}
    </div>
  </figure>`;
}

/**
 * Innehållsförteckning ur avsnittsrubrikerna.
 *
 * ★ MOTIVERAD AV LÄNGDEN, inte av vana. Rapporten blir ~37 sidor för en enkel sajt, och
 *   merparten är färdiga texter att klistra in. Utan en väg in läser ingen förbi sidan tre.
 *   Under fyra avsnitt ritas ingen — då är den bara dekoration.
 */
function innehall(md: string): string {
  const avsnitt = [...md.matchAll(/^#\s+(.+)$/gm)].map((m) => m[1].trim());
  if (avsnitt.length < 4) return "";
  return `
  <nav class="innehall">
    <div class="fig-titel">Innehåll</div>
    <ol class="innehall-lista">
      ${avsnitt.map((a) => `<li>${inline(a)}</li>`).join("")}
    </ol>
  </nav>`;
}

/** Nyckeltal ur nulägestabellen — bara sådant som står ordagrant där. */
function statrutor(md: string, rader: StatusRad[]): string {
  const rutor: { tal: string; etikett: string }[] = [];

  const sidor = md.match(/hela sajten \((\d+) sid/i);
  if (sidor) rutor.push({ tal: sidor[1], etikett: sidor[1] === "1" ? "sida granskad" : "sidor granskade" });

  const ord = rader.find((r) => /ordmängd/i.test(r.omrade))?.kommentar.match(/([\d\s]+)\s*ord/);
  if (ord) rutor.push({ tal: ord[1].trim(), etikett: "ord på sajten" });

  const alt = rader.find((r) => /alt-text/i.test(r.omrade))?.kommentar.match(/(\d+)\s*av\s*(\d+)/);
  if (alt) rutor.push({ tal: `${alt[1]}/${alt[2]}`, etikett: "bilder utan alt-text" });

  const kritiska = rader.filter((r) => r.status === "kritisk").length;
  if (kritiska) rutor.push({ tal: String(kritiska), etikett: kritiska === 1 ? "sak att åtgärda" : "saker att åtgärda" });

  if (rutor.length < 2) return "";
  return `<div class="statrutor">${rutor
    .map((r) => `<div class="statruta"><div class="stat-tal">${esc(r.tal)}</div><div class="stat-etikett">${esc(r.etikett)}</div></div>`)
    .join("")}</div>`;
}

// ── Markdown → HTML ──────────────────────────────────────────────────────────

/**
 * Blockrenderare. Medvetet liten: rapporten skrivs av vår egen mall, så formatmängden är
 * känd. Allt okänt faller tillbaka på ett stycke — hellre tråkigt än trasigt.
 */
function renderaBlock(md: string, brytForstaH1: boolean): string {
  const ut: string[] = [];
  const rader = md.split(/\r?\n/);
  let i = 0;
  let h1Sedda = 0;

  const stang = (typ: "ul" | "ol" | null) => (typ ? `</${typ}>` : "");
  let lista: "ul" | "ol" | null = null;

  while (i < rader.length) {
    const rad = rader[i];

    // Kodblock — innehållet rörs aldrig, bara escapas.
    if (/^```/.test(rad)) {
      const sprak = rad.slice(3).trim();
      const kropp: string[] = [];
      i++;
      while (i < rader.length && !/^```/.test(rader[i])) kropp.push(rader[i++]);
      i++;
      ut.push(stang(lista)); lista = null;
      ut.push(`<pre class="kod"${sprak ? ` data-sprak="${esc(sprak)}"` : ""}><code>${esc(kropp.join("\n"))}</code></pre>`);
      continue;
    }

    // Tabell
    if (/^\|/.test(rad) && /^\|[\s:-]+\|/.test(rader[i + 1] ?? "")) {
      const celler = (r: string) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const huvud = celler(rad);
      i += 2;
      const kropp: string[][] = [];
      while (i < rader.length && /^\|/.test(rader[i])) kropp.push(celler(rader[i++]));
      ut.push(stang(lista)); lista = null;
      ut.push(`<table><thead><tr>${huvud.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${kropp
        .map((r) => {
          const s = statusAv(r[1] ?? "");
          return `<tr>${r
            .map((c, k) =>
              k === 1 && s
                ? `<td class="td-status"><span class="prick" style="background:${STATUS[s].farg}">${STATUS[s].ikon}</span><span class="status-ord">${STATUS[s].ord}</span></td>`
                : `<td>${inline(c)}</td>`,
            )
            .join("")}</tr>`;
        })
        .join("")}</tbody></table>`);
      continue;
    }

    const rubrik = rad.match(/^(#{1,4})\s+(.+)$/);
    if (rubrik) {
      ut.push(stang(lista)); lista = null;
      const n = rubrik[1].length;
      // H1 inleder ett nytt avsnitt och börjar på ny sida. Undantag: finns ingen
      // översiktssida före texten ska första avsnittet börja direkt under omslaget —
      // annars inleds dokumentet med en nästan tom sida.
      if (n === 1) h1Sedda++;
      const bryt = n === 1 && (brytForstaH1 || h1Sedda > 1);
      ut.push(`<h${n}${bryt ? ' class="ny-sida"' : ""}>${inline(rubrik[2])}</h${n}>`);
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(rad)) {
      ut.push(stang(lista)); lista = null;
      const kropp: string[] = [];
      while (i < rader.length && /^\s*>\s?/.test(rader[i])) kropp.push(rader[i++].replace(/^\s*>\s?/, ""));
      ut.push(`<blockquote>${inline(kropp.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(rad)) {
      if (lista !== "ul") { ut.push(stang(lista)); ut.push("<ul>"); lista = "ul"; }
      ut.push(`<li>${inline(rad.replace(/^\s*[-*]\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(rad)) {
      if (lista !== "ol") { ut.push(stang(lista)); ut.push("<ol>"); lista = "ol"; }
      ut.push(`<li>${inline(rad.replace(/^\s*\d+\.\s+/, ""))}</li>`);
      i++;
      continue;
    }

    if (/^\s*---+\s*$/.test(rad)) {
      ut.push(stang(lista)); lista = null;
      ut.push("<hr>");
      i++;
      continue;
    }

    if (!rad.trim()) { ut.push(stang(lista)); lista = null; i++; continue; }

    ut.push(stang(lista)); lista = null;
    ut.push(`<p>${inline(rad)}</p>`);
    i++;
  }
  ut.push(stang(lista));
  return ut.join("\n");
}

// ── Dokumentet ───────────────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box}
:root{
  --ink:#0b0b0b; --ink-2:#52514e; --ink-3:#78766f;
  --yta:#ffffff; --yta-2:#f7f7f5; --linje:#e6e5e1;
}
@page{size:A4;margin:16mm 15mm 18mm}
html,body{margin:0;padding:0}
body{
  font:400 10.5pt/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;
  color:var(--ink); background:var(--yta);
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.ark{max-width:190mm;margin:0 auto;padding:0 2mm}

/* Omslag */
.omslag{padding:26mm 0 12mm;border-bottom:1px solid var(--linje);margin-bottom:9mm}
.band{height:5px;border-radius:3px;margin-bottom:9mm}
.omslag h1{font-size:25pt;line-height:1.15;margin:0 0 5mm;letter-spacing:-.015em;font-weight:650}
.omslag .under{font-size:11.5pt;color:var(--ink-2);margin:0 0 2mm}
.omslag .meta{font-size:9.5pt;color:var(--ink-3);margin:0}
.omslag .logga{max-height:17mm;max-width:56mm;margin-bottom:7mm;display:block}

/* Rubriker */
h1,h2,h3,h4{line-height:1.25;letter-spacing:-.01em;font-weight:650;color:var(--ink)}
h1{font-size:16pt;margin:11mm 0 4mm;padding-bottom:2.5mm;border-bottom:2px solid var(--ink)}
/* Bara avsnittsrubriker ur rapporttexten bryter sida. Omslaget och Översikt ligger i egna
   element och rörs inte — därför klassen, inte en :first-of-type-regel (den matchade per
   förälder och kunde både missa rätt rubrik och ge en tom förstasida). */
h1.ny-sida{break-before:page;page-break-before:always}
h2{font-size:12.5pt;margin:7mm 0 2.5mm}
h3{font-size:10.5pt;margin:5mm 0 2mm;color:var(--ink-2)}
h4{font-size:10pt;margin:4mm 0 1.5mm;color:var(--ink-2)}
p{margin:0 0 2.6mm;orphans:3;widows:3}
ul,ol{margin:0 0 3mm;padding-left:5.5mm}
li{margin-bottom:1.2mm}
hr{border:0;border-top:1px solid var(--linje);margin:6mm 0}
a{color:inherit;text-decoration:underline;text-underline-offset:2px}
strong{font-weight:650}

blockquote{
  margin:3.5mm 0;padding:3mm 4mm;background:var(--yta-2);
  border-left:3px solid var(--linje);border-radius:0 4px 4px 0;
  font-size:9.5pt;color:var(--ink-2)
}

/* Tabell */
table{width:100%;border-collapse:collapse;margin:3.5mm 0;font-size:9pt;break-inside:auto}
th{
  text-align:left;font-weight:650;font-size:8pt;letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-3);padding:0 3mm 1.8mm;border-bottom:1px solid var(--linje)
}
td{padding:2mm 3mm;border-bottom:1px solid var(--linje);vertical-align:top}
tr{break-inside:avoid}
.td-status{white-space:nowrap}
.status-ord{font-size:8.5pt;color:var(--ink-2)}

/* Statusmärke — färgen bär aldrig betydelsen ensam */
.prick{
  display:inline-flex;align-items:center;justify-content:center;
  width:13px;height:13px;border-radius:50%;color:#fff;
  font-size:8.5px;font-weight:700;line-height:1;margin-right:5px;
  vertical-align:-2px;flex:0 0 auto
}

/* Figurer */
.fig{margin:5mm 0 7mm;break-inside:avoid}
.fig-titel{font-size:9pt;font-weight:650;color:var(--ink-2);margin-bottom:2.5mm}
.stapel{display:flex;height:22px;border-radius:4px;overflow:hidden;background:var(--yta-2)}
.seg{display:flex;align-items:center;justify-content:center;box-shadow:inset -2px 0 0 #fff}
.seg:last-child{box-shadow:none}
.seg-tal{color:#fff;font-size:9pt;font-weight:650}
.legend{display:flex;gap:5mm;margin-top:2.5mm;font-size:8.5pt;color:var(--ink-2)}
.legend-post{display:inline-flex;align-items:center}

.statrutor{display:flex;gap:3mm;margin:5mm 0 6mm;break-inside:avoid}
.statruta{flex:1;border:1px solid var(--linje);border-radius:5px;padding:3.5mm 3mm;background:var(--yta-2)}
.stat-tal{font-size:19pt;font-weight:650;line-height:1.1;letter-spacing:-.02em}
.stat-etikett{font-size:8pt;color:var(--ink-3);margin-top:.8mm;line-height:1.3}

.rutnat{display:grid;grid-template-columns:1fr 1fr;gap:2mm 4mm;margin:4mm 0 6mm}
.rut{display:flex;gap:1mm;align-items:flex-start;padding:2mm 0;border-top:1px solid var(--linje);break-inside:avoid}
.rut-namn{font-size:9pt;font-weight:650}
.rut-kom{font-size:8.2pt;color:var(--ink-3);line-height:1.4}

.tider{display:flex;flex-direction:column;gap:2mm}
.tid-rad{display:flex;align-items:center;gap:3mm;font-size:9pt}
.tid-namn{flex:0 0 34mm;color:var(--ink-2)}
.tid-spar{flex:1;height:9px;background:var(--yta-2);border-radius:4px;overflow:hidden}
.tid-bar{display:block;height:100%;border-radius:4px}
.tid-val{flex:0 0 18mm;text-align:right;color:var(--ink-3);font-variant-numeric:tabular-nums}

.innehall{margin:6mm 0 0;padding-top:4mm;border-top:1px solid var(--linje);break-inside:avoid}
.innehall-lista{margin:2mm 0 0;padding-left:5mm;font-size:9.5pt;color:var(--ink-2)}
.innehall-lista li{margin-bottom:1.4mm}

/* Kod och färdiga texter */
.kod{
  background:var(--yta-2);border:1px solid var(--linje);border-radius:5px;
  padding:3mm 3.5mm;margin:2.5mm 0 3.5mm;overflow-x:auto;
  font:9pt/1.5 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  white-space:pre-wrap;word-break:break-word;break-inside:avoid
}
code{
  font:9.2pt/1.4 ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  background:var(--yta-2);padding:.4mm 1.2mm;border-radius:3px
}
.kod code{background:none;padding:0;font-size:inherit}

.sidfot{margin-top:10mm;padding-top:3mm;border-top:1px solid var(--linje);font-size:8pt;color:var(--ink-3)}

@media print{
  .ingen-print{display:none!important}
  .kod{break-inside:auto}
}
@media screen{
  body{background:#eceae5;padding:8mm 0}
  .ark{background:#fff;padding:14mm 16mm;border-radius:6px;box-shadow:0 2px 18px rgba(0,0,0,.10)}
  .skrivut{
    position:fixed;top:14px;right:14px;padding:9px 16px;border:0;border-radius:8px;
    color:#fff;font:600 13px/1 inherit;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.18)
  }
}`;

/**
 * Bygger hela dokumentet. Analysdelen får figurerna; delen med färdiga texter får
 * typografi och sidbrytningar — det är två olika sorters läsning och ska se olika ut.
 */
export function byggRapportHtml(markdown: string, ctx: RapportKontext): string {
  const md = String(markdown || "").trim();
  const farg = /^#[0-9a-f]{6}$/i.test(ctx.primarFarg || "") ? ctx.primarFarg : "#6B7280";

  // Titelraden och datumet ur rapportens eget huvud — aldrig påhittade.
  const datum = ctx.datum || md.match(/^\*\*Datum:\*\*\s*(.+)$/m)?.[1]?.trim() || "";
  const granskat = md.match(/^\*\*Vad jag granskat:\*\*\s*(.+)$/m)?.[1]?.trim() || "";

  // Huvudet lyfts ur brödtexten så det inte dubbleras under omslaget.
  const kropp = md
    .replace(/^#\s+.+$/m, "")
    .replace(/^\*\*Datum:\*\*.*$/m, "")
    .replace(/^\*\*Vad jag granskat:\*\*.*$/m, "")
    .replace(/^\s*---\s*$/m, "")
    .trim();

  const status = lasStatusTabell(md);
  const tider = lasTider(md);

  const grafik = [statrutor(md, status), halsostapel(status, farg), statusrutnat(status), tidsstaplar(tider, farg)]
    .filter(Boolean)
    .join("\n");

  const oversikt = grafik
    // Byggs ur brödtexten, inte ur hela dokumentet: annars listas rapportens egen
    // titelrad som ett avsnitt, och den står redan på omslaget.
    ? `<section class="oversikt"><h1>Översikt</h1>${grafik}${innehall(kropp)}</section>`
    : "";

  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<title>SEO- och AEO-rapport — ${esc(ctx.klientNamn)}</title>
<style>${CSS}</style></head>
<body>
<button class="skrivut ingen-print" style="background:${farg}" onclick="window.print()">Spara som PDF</button>
<div class="ark">
  <header class="omslag">
    <div class="band" style="background:${farg}"></div>
    ${ctx.logoUrl ? `<img class="logga" src="${esc(ctx.logoUrl)}" alt="">` : ""}
    <h1>Så syns ${esc(ctx.klientNamn)}<br>i Google och AI-sökmotorer</h1>
    <p class="under">${esc(granskat || "Genomgång av sajten")}</p>
    <p class="meta">${esc(ctx.url)}${datum ? ` · ${esc(datum)}` : ""}</p>
  </header>
  ${oversikt}
  ${renderaBlock(kropp, !!oversikt)}
  <footer class="sidfot">Framtagen i Cockpit för ${esc(ctx.klientNamn)}${datum ? ` · ${esc(datum)}` : ""}</footer>
</div>
<script>window.addEventListener("load",function(){if(location.hash==="#skrivut")setTimeout(function(){window.print()},300)})</script>
</body></html>`;
}
