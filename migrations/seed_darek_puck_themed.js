#!/usr/bin/env node
// Seed Darek's puck_data med Darek-stilade blocks (Hero, TwoColumn, Stats, etc.)
// Speglar nuvarande darekuhrberg.se så när användaren öppnar Puck-editorn ser de hela sajten

const TOKEN = process.env.SUPABASE_TOKEN;
const REF = 'liunepzrmygiaaibsbni';
if (!TOKEN) { console.error('SUPABASE_TOKEN saknas'); process.exit(1); }

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const id = (n) => `${n}-${Math.random().toString(36).slice(2, 10)}`;

(async () => {
  const rows = await sql(`SELECT content FROM darek_content WHERE id='live'`);
  const c = rows[0]?.content || {};

  const blocks = [];

  // HERO
  if (c.hero) {
    blocks.push({
      type: 'Hero',
      props: {
        id: id('Hero'),
        label: c.hero.year || 'Konstnär · Sandarne',
        titleLine1: c.hero.titleLine1 || 'Darek',
        titleLine2: c.hero.titleLine2 || 'Uhrberg',
        tagline: c.hero.tagline || '',
        ctaText: c.hero.ctaLabel || 'Utforska verken',
        ctaHref: c.hero.ctaHref || '#portfolio',
        heroImage: c.hero.heroImage || '',
        heroAlt: c.hero.heroAlt || '',
        layout: 'split',
      },
    });
  }

  // NU PÅGÅR (direkt efter Hero, matchar originalet)
  if (c.nuPagar?.enabled) {
    blocks.push({
      type: 'NuPagar',
      props: {
        id: id('NuPagar'),
        enabled: true,
        label: c.nuPagar.label || 'Nu pågår',
        title: c.nuPagar.title || '',
        ctaText: c.nuPagar.ctaLabel || 'Mer info',
        ctaHref: c.nuPagar.ctaHref || c.nuPagar.href || '#',
        meta: c.nuPagar.meta || [],
      },
    });
  }

  // PORTFOLIO — utvalda verk i 3 rader (matchar template.html)
  if (c.portfolio) {
    const layoutMap = { 'gallery-row-1': 'big-2small', 'gallery-row-2': '3equal', 'gallery-row-3': 'small-big-small' };
    blocks.push({
      type: 'Portfolio',
      props: {
        id: id('Portfolio'),
        label: 'Portfolio',
        heading: 'Utvalda',
        headingItalic: 'Verk',
        filters: (c.portfolio.filters || []).map(v => ({ value: v })),
        rows: (c.portfolio.rows || []).map(r => ({
          layout: layoutMap[r.class] || '3equal',
          items: (r.items || []).map(it => ({
            image: it.image || '',
            alt: it.alt || '',
            title: it.title || '',
            caption: it.caption || '',
            category: it.category || '',
          })),
        })),
      },
    });
  }

  // ABOUT — TwoColumn
  if (c.about) {
    blocks.push({
      type: 'TwoColumn',
      props: {
        id: id('TwoColumn'),
        image: c.about.portrait?.startsWith('http') ? c.about.portrait : `https://darekuhrberg.se/${c.about.portrait || ''}`,
        imageAlt: c.about.portraitAlt || '',
        imagePosition: 'left',
        label: c.about.sectionLabel || 'Om konstnären',
        heading: (c.about.titleHtml || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim(),
        headingItalic: false,
        body: (c.about.paragraphs || []).join('\n\n'),
        ctaText: '',
        ctaHref: '',
      },
    });
    if (c.about.stats && c.about.stats.length) {
      blocks.push({
        type: 'Stats',
        props: { id: id('Stats'), items: c.about.stats, align: 'center' },
      });
    }
  }

  // SHOP rubrik (verken auto-renderas på sajten från art_works)
  if (c.shop) {
    blocks.push({ type: 'Label', props: { id: id('Label'), text: c.shop.sectionLabel || 'Galleri', align: 'left' } });
    blocks.push({ type: 'Heading', props: { id: id('Heading'), text: c.shop.heading || 'Konst till salu', level: 'h2', size: '2xl', align: 'left', italic: false, color: 'cream' } });
    if (c.shop.intro?.quote) blocks.push({ type: 'Text', props: { id: id('Text'), text: c.shop.intro.quote, size: 'lg', italic: true, align: 'left', color: 'muted' } });
  }

  // EXHIBITIONS rubrik (utställningarna auto-renderas från art_exhibitions)
  if (c.exhibitions) {
    blocks.push({ type: 'Label', props: { id: id('Label'), text: c.exhibitions.sectionLabel || 'CV', align: 'left' } });
    blocks.push({ type: 'Heading', props: { id: id('Heading'), text: c.exhibitions.heading || 'Utställningar', level: 'h2', size: '2xl', align: 'left', italic: false, color: 'cream' } });
  }

  // CONTACT
  if (c.contact) {
    blocks.push({
      type: 'Contact',
      props: {
        id: id('Contact'),
        heading: (c.contact.heading || '').split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, ' ').trim() || 'Kontakt',
        headingItalic: (c.contact.heading || '').split(/<br\s*\/?>/i)[1]?.replace(/<[^>]+>/g, ' ').trim() || '',
        subheading: c.contact.subheading || '',
        email: c.contact.email || '',
        phone: c.contact.phone || '',
        address: c.contact.address || '',
        social: c.contact.social || [],
      },
    });
  }

  // FOOTER
  if (c.footer) {
    blocks.push({
      type: 'Footer',
      props: {
        id: id('Footer'),
        copyright: c.footer.copyright || '',
        logo: c.footer.logo || 'DU',
        location: c.footer.location || '',
      },
    });
  }

  const puck = { content: blocks, root: { props: { title: c.site?.title || 'Darek Uhrberg — Konstnär' } } };
  const next = { ...c, puck_data: puck };
  await sql(`UPDATE darek_content SET content = '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb WHERE id='live'`);
  console.log(`✔ Seedade ${blocks.length} Darek-stylade Puck-blocks`);
})();
