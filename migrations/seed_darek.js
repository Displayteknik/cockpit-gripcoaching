#!/usr/bin/env node
// Seed Dareks verk + utställningar från darek-uhrberg/content.json → cockpit art_works/art_exhibitions
// Kör: SUPABASE_TOKEN=sbp_... node migrations/seed_darek.js

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.SUPABASE_TOKEN;
const REF = 'liunepzrmygiaaibsbni';
const DAREK_ID = '00000000-0000-0000-0000-000000000002';
const CONTENT = path.resolve(__dirname, '../../darek-uhrberg/content.json');

if (!TOKEN) { console.error('SUPABASE_TOKEN saknas'); process.exit(1); }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL fail ${r.status}: ${await r.text()}`);
  return r.json();
}

const slug = s => s.toLowerCase()
  .replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/é/g,'e')
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

function parseTech(tech) {
  // "Akryl · Canvas · 87×87 cm" eller "Akryl, ink, struktur · Canvas · 87×87 cm"
  const parts = tech.split(/\s*·\s*/);
  const dim = parts.find(p => /\d+[×x]\d+/.test(p)) || '';
  const dimMatch = dim.match(/(\d+(?:[,.]\d+)?)\s*[×x]\s*(\d+(?:[,.]\d+)?)(?:\s*[×x]\s*(\d+(?:[,.]\d+)?))?/);
  return {
    technique: parts[0] || null,
    medium: parts.length >= 3 ? parts[1] : null,
    width_cm: dimMatch ? Math.round(parseFloat(dimMatch[1].replace(',','.'))) : null,
    height_cm: dimMatch ? Math.round(parseFloat(dimMatch[2].replace(',','.'))) : null,
    depth_cm: dimMatch && dimMatch[3] ? Math.round(parseFloat(dimMatch[3].replace(',','.'))) : null,
  };
}

function parsePrice(price, sold) {
  if (sold || /såld/i.test(price)) return { price: 0, price_label: 'Såld', status: 'sold' };
  const num = price.replace(/[^\d]/g,'');
  if (num) return { price: parseInt(num,10), price_label: null, status: 'for_sale' };
  return { price: 0, price_label: price, status: 'for_sale' };
}

async function main() {
  const c = JSON.parse(fs.readFileSync(CONTENT,'utf8'));

  // Rensa befintliga (om några)
  await sql(`DELETE FROM art_works WHERE client_id = '${DAREK_ID}'`);
  await sql(`DELETE FROM art_exhibitions WHERE client_id = '${DAREK_ID}'`);

  // Verk
  const slugSet = new Set();
  const works = c.shop.items.map((it, i) => {
    const tech = parseTech(it.tech || '');
    const pr = parsePrice(it.price || '', it.sold);
    let s = slug(it.title);
    if (slugSet.has(s)) s = `${s}-${i}`;
    slugSet.add(s);
    return {
      client_id: DAREK_ID,
      title: it.title,
      slug: s,
      artist: 'Darek Uhrberg',
      year: null,
      ...tech,
      ...pr,
      description: null,
      image_url: it.image || null,
      gallery: [],
      tags: (it.tags || []).filter(t => t !== 'alla' && t !== 'tillganglig'),
      is_featured: false,
      sort_order: i,
    };
  });

  for (const w of works) {
    const cols = Object.keys(w).join(',');
    const vals = Object.values(w).map(v => {
      if (v === null) return 'NULL';
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v;
      if (Array.isArray(v)) return `'${JSON.stringify(v).replace(/'/g,"''")}'::jsonb`;
      return `'${String(v).replace(/'/g,"''")}'`;
    }).join(',');
    await sql(`INSERT INTO art_works (${cols}) VALUES (${vals})`);
  }
  console.log(`✔ ${works.length} verk seedade`);

  // Utställningar
  let exhCount = 0;
  for (const year of c.exhibitions.years) {
    const yearNum = parseInt(year.label.match(/\d{4}/)[0], 10);
    for (let i = 0; i < year.items.length; i++) {
      const it = year.items[i];
      const status = it.highlight ? 'ongoing' : (yearNum >= new Date().getFullYear() ? 'past' : 'past');
      const venue = it.tag && !/pågår|kommande/i.test(it.tag) ? it.tag : null;
      const data = {
        client_id: DAREK_ID,
        year: yearNum,
        title: it.title,
        venue,
        city: null,
        start_date: null,
        end_date: null,
        status,
        description: it.description || null,
        image_url: it.image || null,
        url: it.link || null,
        sort_order: i,
      };
      const cols = Object.keys(data).join(',');
      const vals = Object.values(data).map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g,"''")}'`;
      }).join(',');
      await sql(`INSERT INTO art_exhibitions (${cols}) VALUES (${vals})`);
      exhCount++;
    }
  }
  console.log(`✔ ${exhCount} utställningar seedade`);
}

main().catch(e => { console.error(e); process.exit(1); });
