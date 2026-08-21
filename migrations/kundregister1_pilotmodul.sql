-- KUNDREGISTER-1 DEL 4-tillägget (HELG-1, 2026-08-21): egen entitlement i stället för att
-- åka på "dm"-modulen. "dm" gav alla DM-kunder registret automatiskt — HELG-1 DEL 4 vill
-- ha en styrd pilot: PÅ bara för Displayteknik och For Balance (Gitte), AV för alla andra
-- tills piloten är godkänd. Samma mönster som studio-skarmformat (OPTICUR-1 Etapp B).

insert into platform_modules (id, label, description, href, icon, owner_area, sort_order, active, in_pro_default)
values ('kundregister', 'Kontakter', 'Din kundlista från MySales, sökbar och taggfiltrerad — samlad på ett ställe.', '/k/kunder', 'Users', 'content', 64, true, false)
on conflict (id) do nothing;

insert into tenant_modules (client_id, module_id, enabled, source)
select id, 'kundregister', true, 'manuell' from clients where slug in ('displayteknik', 'forbalance')
on conflict (client_id, module_id) do update set enabled = true, source = 'manuell';

notify pgrst, 'reload schema';
