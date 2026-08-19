-- OPTICUR-1 Etapp B (B6) — registrerar "Egen storlek/Skärm" som en vanlig modul, default
-- AV för alla (även nya tenants), PÅ manuellt bara för Opticur. Byrå-dashboarden
-- (/dashboard/studio) filtrerar aldrig på detta — bara kundvyn (/k/studio), se
-- templatesForClient() i lib/studio/templates-meta.ts.
--
-- Seedar också Opticurs första sparade mått: "Infartsskärmen" 1200x900 (DoD).

insert into platform_modules (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
values ('studio-skarmformat', 'Egen storlek / Skärm', 'Bygg en annons i valfri pixelstorlek — infartsskärmar, foajéskärmar och andra mått utanför Instagram/Facebook.', '/dashboard/studio', 'Monitor', 'content', 63, true, false)
on conflict (id) do nothing;

insert into tenant_modules (client_id, module_id, enabled, source)
select id, 'studio-skarmformat', true, 'manuell' from clients where slug = 'opticur'
on conflict (client_id, module_id) do update set enabled = true, source = 'manuell';

update studio_brand_kits
set kit = jsonb_set(
  kit, '{screenFormats}',
  coalesce(kit->'screenFormats', '[]'::jsonb) || '[{"name": "Infartsskärmen", "w": 1200, "h": 900}]'::jsonb
)
where client_id = (select id from clients where slug = 'opticur')
  and not exists (
    select 1 from jsonb_array_elements(coalesce((select kit->'screenFormats' from studio_brand_kits where client_id = (select id from clients where slug = 'opticur')), '[]'::jsonb)) elem
    where elem->>'name' = 'Infartsskärmen'
  );

notify pgrst, 'reload schema';
