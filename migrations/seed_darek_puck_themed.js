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

  // NAV — toppmeny (matchar template.html nav)
  if (c.site?.navLinks) {
    blocks.push({
      type: 'Nav',
      props: {
        id: id('Nav'),
        logoText: c.site.navLogo || 'DAREK UHRBERG',
        links: (c.site.navLinks || []).map(l => ({ label: l.label, href: l.href })),
      },
    });
  }

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
        slideshow: (c.hero.slideshow || []).map(img => ({ image: img })),
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
    blocks.push({
      type: 'GallerySection',
      props: {
        id: id('GallerySection'),
        label: c.shop.sectionLabel || 'Galleri',
        heading: c.shop.heading || 'Konst till salu',
        introQuote: c.shop.intro?.quote || '',
        introSub: c.shop.intro?.sub || '',
        filters: (c.shop.filters || [{ value: 'alla', label: 'Alla verk' }, { value: 'tillganglig', label: 'Tillgänglig' }, { value: 'akryl', label: 'Akryl' }]).map(f => ({ value: f.label || f.value || f })),
      },
    });
  }

  // EXHIBITIONS (utställningarna auto-renderas från art_exhibitions på sajten)
  if (c.exhibitions) {
    const years = (c.exhibitions.years || []).map(y => ({ year: y.label, sample: '' }));
    blocks.push({
      type: 'ExhibitionsSection',
      props: {
        id: id('ExhibitionsSection'),
        label: c.exhibitions.sectionLabel || 'CV',
        heading: c.exhibitions.heading || 'Utställningar',
        previewYears: years.length ? years : [{ year: '2026', sample: '' }, { year: '2025', sample: '' }],
      },
    });
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
        showForm: true,
        formSubjects: c.contact.formSubjects || [],
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
  const pages = c.pages || {};
  pages.index = puck;
  const { puck_data, ...rest } = c;
  const next = { ...rest, pages };
  await sql(`UPDATE darek_content SET content = '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb WHERE id='live'`);
  console.log(`✔ Seedade ${blocks.length} Darek-stylade Puck-blocks`);
})();
