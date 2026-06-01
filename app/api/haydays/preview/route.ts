import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-admin";
import { getActiveClient } from "@/lib/client-context";

export const runtime = "nodejs";

const SLUG = "scandinavian-haydays";
const SITE = "https://scandinavian-haydays.netlify.app";

// ── samma render-logik som build.js (håll i synk) ──────────────
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escRich = (s: unknown) =>
  String(s ?? "").replace(/&(?!(amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");

function replaceRegion(html: string, key: string, inner: string) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(<!--HD:${k}-->)[\\s\\S]*?(<!--/HD:${k}-->)`);
  if (!re.test(html)) return html;
  return html.replace(re, (_m, open, close) => `${open}${inner}${close}`);
}

type Partner = { name: string; url: string; logo: string; initials: string; wide: boolean };
type Klass = { namn: string; spec: string };
type Oppet = { dag: string; tid: string };

function renderPartners(list: Partner[] = []) {
  const items = list
    .map((p) => {
      const hasUrl = p.url && p.url.trim();
      const hasLogo = p.logo && p.logo.trim();
      const wide = p.wide ? " partner-logo-wide" : "";
      const logoSpan = hasLogo
        ? `<span class="partner-logo${wide}"><img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.classList.add('no-logo')"><span class="logo-fallback">${esc(p.initials)}</span></span>`
        : `<span class="partner-logo no-logo"><span class="logo-fallback">${esc(p.initials)}</span></span>`;
      const inner = `\n          ${logoSpan}\n          <span class="partner-name">${esc(p.name)}</span>\n        `;
      const wrapped = hasUrl
        ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${inner}</a>`
        : `<span class="partner-link">${inner}</span>`;
      return `      <li>\n        ${wrapped}\n      </li>`;
    })
    .join("\n");
  return `\n${items}\n`;
}

function renderKlasser(list: Klass[] = []) {
  const items = list
    .map((k) => {
      const spec = k.spec && k.spec.trim() ? esc(k.spec) : "&nbsp;";
      return `        <li><span class="klass-namn">${esc(k.namn)}</span><span class="klass-spec">${spec}</span></li>`;
    })
    .join("\n");
  return `\n${items}\n`;
}

function renderOppettider(list: Oppet[] = []) {
  return list.map((o) => `<strong>${esc(o.dag)}</strong> — ${esc(o.tid)}`).join("<br>\n           ");
}

// ── klick-till-redigera overlay (injiceras i preview) ──────────
const OVERLAY = `
<base href="${SITE}/">
<style>
  [data-hd]{ transition: outline .12s; }
  [data-hd].hd-hover{ outline:2px dashed #2563eb; outline-offset:4px; cursor:pointer; border-radius:4px; }
  .hd-badge{ position:fixed; z-index:99999; background:#2563eb; color:#fff; font:600 12px/1 system-ui,sans-serif;
    padding:6px 10px; border-radius:8px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.25); display:none; }
</style>
<script>
(function(){
  var badge=document.createElement('div'); badge.className='hd-badge'; badge.textContent='✎ Klicka för att redigera';
  document.addEventListener('DOMContentLoaded',function(){ document.body.appendChild(badge); wire(); });
  function wire(){
    var it=document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
    var n, map={};
    while((n=it.nextNode())){
      var v=(n.nodeValue||'').trim();
      if(v.indexOf('HD:')===0 && v.indexOf('/HD:')!==0){ if(n.parentElement) map[v.slice(3)]=n.parentElement; }
    }
    Object.keys(map).forEach(function(key){
      var el=map[key];
      el.setAttribute('data-hd',key);
      el.addEventListener('mouseenter',function(){ el.classList.add('hd-hover'); var r=el.getBoundingClientRect(); badge.style.display='block'; badge.style.top=Math.max(8,r.top-34)+'px'; badge.style.left=Math.max(8,r.left)+'px'; });
      el.addEventListener('mouseleave',function(){ el.classList.remove('hd-hover'); badge.style.display='none'; });
      el.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); parent.postMessage({type:'hd-edit',key:key},'*'); });
    });
  }
})();
</script>
`;

export async function GET() {
  const client = await getActiveClient();
  if (client?.slug !== SLUG) return NextResponse.json({ error: "Endast för Hay Days-klient" }, { status: 403 });

  // Mall = live-sajtens HTML (markörer intakta)
  let html: string;
  try {
    const res = await fetch(SITE + "/", { cache: "no-store" });
    html = await res.text();
  } catch {
    return NextResponse.json({ error: "Kunde inte hämta sajt-mallen" }, { status: 502 });
  }

  // Innehåll = senast sparade i Supabase
  const sb = supabaseServer();
  const { data } = await sb.from("haydays_content").select("content").eq("id", "live").maybeSingle();
  const c = (data?.content || {}) as {
    hero?: { tagline?: string };
    eventet?: { lead1?: string; lead2?: string };
    historien?: { p1?: string; p2?: string; p3?: string; avslut?: string };
    oppettider?: Oppet[];
    klasser?: Klass[];
    partners?: Partner[];
  };

  html = replaceRegion(html, "hero.tagline", escRich(c.hero?.tagline));
  html = replaceRegion(html, "eventet.lead1", escRich(c.eventet?.lead1));
  html = replaceRegion(html, "eventet.lead2", escRich(c.eventet?.lead2));
  html = replaceRegion(html, "historien.p1", escRich(c.historien?.p1));
  html = replaceRegion(html, "historien.p2", escRich(c.historien?.p2));
  html = replaceRegion(html, "historien.p3", escRich(c.historien?.p3));
  html = replaceRegion(html, "historien.avslut", escRich(c.historien?.avslut));
  html = replaceRegion(html, "oppettider", renderOppettider(c.oppettider));
  html = replaceRegion(html, "klasser", renderKlasser(c.klasser));
  html = replaceRegion(html, "partners", renderPartners(c.partners));

  // injicera base + overlay direkt efter <head>
  html = html.replace(/<head([^>]*)>/i, (m) => m + OVERLAY);

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
