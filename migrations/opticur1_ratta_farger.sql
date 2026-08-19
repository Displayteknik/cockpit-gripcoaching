-- OPTICUR-1 — Ingelas officiella färgkoder ersätter de platshållarfärger som legat i
-- studio_brand_kits sedan starten (samma fel värden som legat i clients/opticur/brand.json,
-- fixat i samma commit).
--
-- FASTSTÄLLDA FÄRGER (FOGRA39-konverterade från kundens CMYK, Ingela 19/8):
--   Mörkgrön #007A3D  (tryck: CMYK 100/35/100/0)
--   Ljusgrön #62A936  (tryck: CMYK 65/0/100/8,5)
--
-- greenDeep/primaryDeep är INTE kundgiven — auto-uträknad skugga av primary med samma
-- shade(-0.28)-formel som resten av systemet använder när fältet saknas (#00582C).

update studio_brand_kits
set kit = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(kit, '{colors,primary}', '"#007A3D"'),
      '{colors,primaryDeep}', '"#00582C"'
    ),
    '{colors,primaryLight}', '"#62A936"'
  ),
  '{colorsCmyk}', '{"primary": {"c": 100, "m": 35, "y": 100, "k": 0}, "primaryLight": {"c": 65, "m": 0, "y": 100, "k": 8.5}}'::jsonb
)
where client_id = (select id from clients where slug = 'opticur');

update clients
set primary_color = '#007A3D'
where slug = 'opticur';

notify pgrst, 'reload schema';
