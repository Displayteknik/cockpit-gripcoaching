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

-- ★ INGEN SEEDNING, och det är en rättelse efter Håkans invändning:
-- "det ska ju inte STÅ regression i systemet, jag vill att systemet FATTAR när hon vill
-- använda det." Han har rätt. En ordlista någon måste fylla i är ingen förståelse — det är
-- en lapp, och den lappen måste underhållas för varje ord, hos varje kund, för alltid.
--
-- Huvudmekanismen är därför självlärd: `amnesordIProfilen` letar upp ämnesordet i kundens
-- egen profil och lyfter in HENNES EGNA RADER som betydelse. Hos For Balance ger det
-- "Regression, resa till ett tidigare liv: två tillfällen…" — hon hade redan skrivit vad
-- hon menar; raden stod bara aldrig på en plats där den gällde som betydelse.
-- Bevisat med tom ordlista: `scripts/kunskap1-dod.mts`.
--
-- Fältet finns kvar som ÖVERSTYRNING för de fall profilen inte räcker (ett ord kunden
-- använder men aldrig skrivit ned, eller en betydelse som behöver avgränsas mot något
-- annat). Det ska vara tomt tills någon har ett skäl att fylla i det.

notify pgrst, 'reload schema';
