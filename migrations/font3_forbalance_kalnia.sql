-- FONT-3 — For Balance får sitt egna rubriktypsnitt.
--
-- FÄRG-2 satte Playfair Display på både rubrik och brödtext, eftersom Kalnia inte fanns
-- bland kitets tillåtna typsnitt. Nu finns den (public/fonts/kalnia.ttf, OFL), och mätningen
-- på forbalance.se sa: Kalnia i rubrikerna, Playfair Display i brödtexten. Så blir det.
update studio_brand_kits
set kit = jsonb_set(kit, '{fonts,headline}', '"Kalnia"'),
    updated_at = now()
where client_id = 'd07d7288-2651-47df-b5f3-a010c1a1a97f';

notify pgrst, 'reload schema';
