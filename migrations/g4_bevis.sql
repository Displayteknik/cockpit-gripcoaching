-- G-4 — bevis-motorn: verifierade siffror får ett eget fält.
--
-- BAKGRUND (G0-RAPPORT 0.3c + mätning 9/8): bevis-motorns primära källa skulle vara
-- "profilens verifierade siffror". Den källan fanns inte. Det enda numeriska fältet var
-- `pricing_notes` — exakt det fält som prisregeln spärrar som citatmaterial.
--
-- Mätt över alla nio profiler: 20 av 51 tal som profilmätaren räknade som "siffror vi
-- får använda" fanns BARA i pricing_notes. För For Balance 17 av 31. Mätaren lovade
-- alltså kunden bevismaterial som motorn har förbud att skriva ut.
--
-- Håkans beslut (31/7, bekräftat 9/8): verifierade siffror och priser är två olika
-- saker, två olika fält, två olika regler. Priserna förblir SANNINGSUNDERLAG (så att
-- ordet "prisvärt" är sant och CTA:n pekar rätt) och skrivs aldrig ut. Verifierade
-- siffror är det motsatta: de FÅR skrivas ut, för att de är kontrollerbara påståenden
-- om verksamheten — "sedan 1998", "över 400 genomförda jobb", "besiktad inom 24 timmar".
--
-- Fältet är fritext, inte en lista. Samma form som resten av profilen, och kunden ska
-- kunna skriva "vi har levererat 400+ skyltar sedan 1998" utan att först lära sig ett
-- format. Bevis-motorn (lib/bevis.ts) plockar talen ur texten.

alter table public.hm_brand_profile
  add column if not exists verified_numbers text;

comment on column public.hm_brand_profile.verified_numbers is
  'G-4: kontrollerbara siffror om verksamheten som FÅR citeras i text (år, antal, mått, tider). Skilt från pricing_notes, som är sanningsunderlag och aldrig får skrivas ut.';

notify pgrst, 'reload schema';
