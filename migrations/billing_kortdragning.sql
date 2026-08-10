-- BETAL-1b — dragning på kundens redan sparade kort.
--
-- Bakgrund: en påfyllning kan nu komma in på TVÅ vägar. Antingen direkt (vi drar på det
-- sparade kortet och krediterar med en gång, så kunden ser saldot öka direkt), eller via
-- webhooken när Stripe hör av sig. Utan spärr nedan skulle samma köp kunna krediteras två
-- gånger, och tokens som delats ut går inte att ta tillbaka.
--
-- Lösningen är en referens till betalningen hos Stripe, unik per transaktion. Andra
-- gången samma referens dyker upp gör laggTillCredits ingenting.
--
-- Idempotensen på billing_events (stripe_event_id) skyddar mot att Stripe skickar OM en
-- händelse. Den här skyddar mot något annat: att två OLIKA vägar krediterar samma köp.

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS extern_referens text;

-- Partiellt unikt index: bara rader MED referens omfattas. Alla gamla rader och all
-- vanlig förbrukning (som saknar referens) berörs inte.
CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_extern_referens_idx
  ON public.credit_transactions (extern_referens)
  WHERE extern_referens IS NOT NULL;

NOTIFY pgrst, 'reload schema';
