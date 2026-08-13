-- KUNSKAP-1 — tenantens egen ordlista i varumärkesprofilen.
--
-- Bakgrund (mätt, inte antaget): For Balances blogg om "regression" blev rätt, ett kort
-- inlägg om samma ämne blev fel. Beställningen antog att blogg- och inläggsvägen hämtar
-- kunskap olika. Det gör de inte — alla fyra flöden fick identisk profiltext (10 879
-- tecken), identisk klippning, och ordet fanns med i allihop.
--
-- Den verkliga orsaken: ordet är aldrig DEFINIERAT. Hos For Balance står "regression" på
-- två ställen, båda som uppräkning:
--   · Erbjudande: tjänster  — "Regression, resa till ett tidigare liv: två tillfällen…"
--   · Erbjudande: priser    — en prisrad, i sektionen märkt "skrivs aldrig ut"
-- En lång artikel har plats för sammanhanget bredvid; ett kort inlägg har det inte, och då
-- vinner modellens allmänna betydelse (statistisk regression). Tomrum fyller en språkmodell
-- alltid med allmän kunskap.
--
-- Fältet är fritext, en rad per ord, `ord = betydelse` eller `ord: betydelse` — samma
-- fält-stil som resten av profilformuläret, inget format användaren måste minnas.

alter table hm_brand_profile
  add column if not exists ordlista text;

comment on column hm_brand_profile.ordlista is
  'KUNSKAP-1: kundens egna ord. En rad per ord: "ord = betydelse". Läses av lib/ordlista och '
  'läggs som eget promptlager i prompt-core, sent (väger tyngst) och utanför profilklippningen. '
  'Definierar BETYDELSE, aldrig sanning — sanningskravet och prisregeln gäller oförändrat.';

-- Gittes eget exempel, formulerat ur hennes egen profiltext ("Regression, resa till ett
-- tidigare liv") — inte påhittat åt henne. Skrivs bara om fältet är tomt, så en ordlista
-- hon själv fyllt i aldrig skrivs över av en migration.
update hm_brand_profile
set ordlista = 'regression = regressionsterapi, en guidad resa till ett tidigare liv. Aldrig statistisk regression, matematik eller dataanalys.'
where client_id = 'd07d7288-2651-47df-b5f3-a010c1a1a97f'
  and (ordlista is null or btrim(ordlista) = '');

notify pgrst, 'reload schema';
