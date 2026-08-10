-- G-6 — bildfeedbacken kopplas till genereringen den gäller.
--
-- BAKGRUND (G0 + mätning 10/8): tummen finns i ImagePicker och lovar kunden "Bra bild —
-- AI lär sig". Tre saker gjorde löftet tomt:
--   1. Feedbacken lästes BARA av legacy-vägen (/api/social/generate-image). Studios
--      Bildhjälpen, som är den väg kunderna faktiskt använder, läste den aldrig.
--   2. Bara ett betyg (+1/-1) sparades. Ingen kunde säga VARFÖR en bild var fel, och
--      "dålig bild" utan skäl är svårt att lära sig något av.
--   3. Ingen koppling till genereringen. Raden bar promptsträngen som fritext, så det
--      gick inte att svara på vilken modell, vilken promptversion eller vilket motiv
--      som gav det nedslaget.
--
-- ⚠ MÄTT 10/8: samtliga tre rader i image_feedback har client_id = NULL (de skrevs i
-- april, före multi-tenancy, och bär bara profile_id). Läsningen filtrerar på client_id.
-- De tre tummarna har alltså ALDRIG påverkat en enda bild. Raderna lämnas orörda —
-- de går inte att mappa till en tenant i efterhand utan att gissa, och en gissad
-- tenant är värre än en tom historik.
--
-- Kopplingen görs mot generation_log (G-1), inte mot en egen ny tabell. Bildflödena
-- skrev inga rader dit förut; G-6 kopplar in dem, och då bär motiv_kategori-kolumnen
-- (byggd i G-1, aldrig skriven) äntligen ett värde.

alter table public.image_feedback
  add column if not exists generation_id uuid references public.generation_log (id) on delete set null,
  add column if not exists kommentar text;

comment on column public.image_feedback.generation_id is
  'G-6: genereringen betyget gäller. Ger modell, promptversion och motivkategori utan att duplicera dem här.';
comment on column public.image_feedback.kommentar is
  'G-6: kundens egna ord om varför bilden var bra/dålig. Ett betyg utan skäl går inte att lära sig av.';

create index if not exists image_feedback_client_idx on public.image_feedback (client_id, created_at desc);
create index if not exists image_feedback_generation_idx on public.image_feedback (generation_id) where generation_id is not null;

notify pgrst, 'reload schema';
