-- MODELL-1 — pris för Claude Fable 5, så en dyrare modell inte blir osynligt dyr.
--
-- Bakgrund: specialistens `model:` i .md-filen lästes aldrig av routen, som körde en
-- hårdkodad `claude-sonnet-4-5`. När fältet nu får en kodväg måste varje modell som går att
-- välja också ha ett pris — en modell utan prisrad loggas som 0 kr, och då reagerar varken
-- kostnadstaket eller kostnadsvyn. Samma tysta hål som video har i dag.
--
-- Priserna är Anthropics listpriser per miljon tokens i USD. Kursen 10,5 är samma
-- omräkning som övriga rader i tabellen använder — den är ett antagande om USD/SEK och
-- ska ses över när kursen rör sig, precis som för de befintliga raderna.
--
-- Fable 5: 10 USD in / 50 USD ut per miljon tokens.
-- (Jämförelse: sonnet-4-5 ligger på 3 / 15, haiku-4-5 på 1 / 5.)

insert into ai_pricing (provider, model, pris_in_per_mtoken, pris_ut_per_mtoken, valuta, vaxelkurs, aktiv)
values ('anthropic', 'claude-fable-5', 10.00, 50.00, 'USD', 10.5, true)
on conflict do nothing;

-- ★ Sonnet 4.6 — sex specialister (saljbrev, icp-clarifier, linkedin-post, cold-email,
-- kundprojekt-kickoff, seo-technical-audit) har deklarerat den sedan de skrevs, men fick
-- 4.5 eftersom fältet aldrig lästes. Nu när det läses måste priset finnas, annars faller
-- de tillbaka igen. Samma prisnivå som 4.5 (3 / 15), alltså ingen kostnadsändring — det
-- som ändras är att de får den modell deras egen fil redan sa att de skulle ha.
insert into ai_pricing (provider, model, pris_in_per_mtoken, pris_ut_per_mtoken, valuta, vaxelkurs, aktiv)
values ('anthropic', 'claude-sonnet-4-6', 3.00, 15.00, 'USD', 10.5, true)
on conflict do nothing;

-- Kontroll: ska ge fyra aktiva anthropic-rader (haiku-4-5, sonnet-4-5, sonnet-4-6, fable-5).
-- select provider, model, pris_in_per_mtoken, pris_ut_per_mtoken from ai_pricing
--   where provider = 'anthropic' and aktiv order by model;
