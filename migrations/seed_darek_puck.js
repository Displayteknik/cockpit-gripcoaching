#!/usr/bin/env node
// Seed Darek's puck_data — översätter darek_content sektioner till HM Motor Puck-blocks
// Kör: SUPABASE_TOKEN=sbp_... node migrations/seed_darek_puck.js

const TOKEN = process.env.SUPABASE_TOKEN;
const REF = 'liunepzrmygiaaibsbni';

if (!TOKEN) { console.error('SUPABASE_TOKEN saknas'); process.exit(1); }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL fail ${r.status}: ${await r.text()}`);
  return r.json();
}

const id = (n) => `${n}-${Math.random().toString(36).slice(2, 10)}`;
const empty = { top: '0', right: '0', bottom: '0', left: '0' };
const size = { width: 'auto', height: 'auto', minWidth: '', maxWidth: '' };

(async () => {
  const rows = await sql(`SELECT content FROM darek_content WHERE id='live'`);
  const content = rows[0]?.content || {};

  const blocks = [];

  // HERO
  if (content.hero) {
    blocks.push({
      type: 'Hero',
      props: {
        id: id('Hero'),
        badge: content.hero.year || '',
        title: `${content.hero.titleLine1 || ''} ${content.hero.titleLine2 || ''}`.trim(),
        subtitle: content.hero.tagline || '',
        cta1Text: content.hero.ctaLabel || '',
        cta1Url: content.hero.ctaHref || '#',
        cta2Text: '',
        cta2Url: '',
        backgroundImage: content.hero.heroImage || '',
        trustItems: [],
      },
    });
  }

  // ABOUT — Heading + paragraphs as Text + stats as ValuesGrid
  if (content.about) {
    blocks.push({
      type: 'Section',
      props: {
        id: id('Section'),
        background: 'light', maxWidth: 'wide', layout: 'stack', gap: 'md',
        spacing: { top: '64', right: '0', bottom: '64', left: '0' },
        componentSize: size,
      },
    });
    blocks.push({
      type: 'Heading',
      props: {
        id: id('Heading'),
        text: (content.about.titleHtml || 'Om konstnären').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        level: 'h2',
        spacing: empty, componentSize: size,
      },
    });
    for (const p of content.about.paragraphs || []) {
      blocks.push({
        type: 'Text',
        props: { id: id('Text'), text: p, spacing: empty, componentSize: size },
      });
    }
  }

  // GALLERI-rubrik (ovanför verken som auto-renderas på sajten)
  if (content.shop) {
    blocks.push({
      type: 'PageHeader',
      props: {
        id: id('PageHeader'),
        title: content.shop.heading || 'Konst till salu',
        subtitle: content.shop.intro?.quote || '',
        variant: 'light',
      },
    });
  }

  // UTSTÄLLNINGAR-rubrik
  if (content.exhibitions) {
    blocks.push({
      type: 'PageHeader',
      props: {
        id: id('PageHeader'),
        title: content.exhibitions.heading || 'Utställningar',
        subtitle: content.exhibitions.sectionLabel || '',
        variant: 'dark',
      },
    });
  }

  // KONTAKT
  if (content.contact) {
    blocks.push({
      type: 'CTASection',
      props: {
        id: id('CTASection'),
        title: (content.contact.heading || 'Kontakt').replace(/<[^>]+>/g, ' '),
        subtitle: content.contact.subheading || '',
        ctaText: 'Mejla',
        ctaUrl: `mailto:${content.contact.email || ''}`,
        variant: 'dark',
      },
    });
  }

  const puck = {
    content: blocks,
    root: { props: { title: content.site?.title || 'Darek Uhrberg — Konstnär' } },
  };

  // Save
  const next = { ...content, puck_data: puck };
  await sql(`UPDATE darek_content SET content = '${JSON.stringify(next).replace(/'/g, "''")}'::jsonb WHERE id='live'`);
  console.log(`✔ Seedade ${blocks.length} Puck-blocks från Dareks sektioner`);
})();
