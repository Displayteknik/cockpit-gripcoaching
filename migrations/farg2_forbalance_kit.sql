-- FÄRG-2 — For Balances grafiska profil, mätt på hennes riktiga sajt.
--
-- LÄGET INNAN: `studio_brand_kits` hade INGEN rad för For Balance. All hennes grafik ritades
-- därför på kodens standardfärger:
--     accent  #F2B01E  (gul)
--     support #7ECECA  (turkos)
--     paper   #FFFFFF  (vit)
--     primary #7C6058  (ur clients-raden)
-- Gult och turkost finns inte någonstans på forbalance.se. Det är samma fel som AluCons
-- gula accent, fast hos Gitte — och det syns i varje bild och varje CTA-bricka.
--
-- MÄTT, INTE BEDÖMT (renderad DOM på forbalance.se och /om-gitte, viktat efter hur stor
-- yta varje färg faktiskt målar — inte hur många element som råkar bära den):
--     #FCF7EB   4 244 723 px²   grädde, den dominerande bakgrunden (båda sidorna)
--     #5C3C40   2 667 346 px²   mörk vinröd, stora mörka band och knappar
--     #80494E   3 419 117 px²   vinröd, ytor OCH färgen på 14 av 14 länkar
--     #ECD5BC   1 735 699 px²   sand, kontrastbandet på startsidan
--     #F7EBCC     123 332 px²   ljus sand
--     #E4C4A0      21 822 px²   varmare sand
--     #7C6058     475 363 px²   ★ femte största, OCH saknas helt på /om-gitte
--     #000000                   brödtextens faktiska färg
--
-- ★ Slutsatsen om den sparade färgen: `#7C6058` ÄR en riktig färg från hennes sajt, men en
-- underordnad. Den målar en niondel av grädden, finns bara på startsidan, och var ändå det
-- enda Cockpit visste om hennes varumärke.
--
-- KONTRAST, räknad på varje par hennes sajt faktiskt använder (WCAG):
--     19,64:1  svart på grädde            AAA
--      9,03:1  grädde på mörk vinröd      AAA   (knapparna)
--      9,03:1  mörk vinröd på grädde      AAA
--      6,59:1  vinröd på grädde           AA    (länkarna)
--      6,81:1  mörk vinröd på sand        AA
--      4,97:1  vinröd på sand             AA
-- Allt håller, det mesta med marginal. Paletten behövde inte kompromissas för läsbarhet.
--
-- ROLLERNA. Sex av sju färger är mätta värden; ingen är påhittad:
--     paper        #FCF7EB   det allt vilar på
--     primary      #80494E   hennes signaturfärg — rubriker och länkar
--     primaryDeep  #5C3C40   knappar och mörka band
--     primaryLight #E4C4A0   den ljusa varma ton hennes sajt parar med vinrött
--     accent       #ECD5BC   sanden, det som ska fånga blicken mot grädden
--     support      #F7EBCC   mjuka fyllningar (ritas med låg genomskinlighet)
--     ink          #000000   hennes brödtext är faktiskt helsvart
--
-- ⚠ primaryLight är den enda där rollnamnet ("ljus variant av primary") inte stämmer
-- ordagrant — en uträknad ljus vinröd hade blivit en dammrosa som inte finns hos henne.
-- Mätt färg går före härledd: paletten ska se ut som sajten, inte som en formel.
--
-- TYPSNITT: sajten kör Kalnia i rubriker och Playfair Display i brödtext. Kalnia finns inte
-- bland kitets tillåtna typsnitt; Playfair Display gör det OCH är hennes egen brödtextfont,
-- alltså närmast möjliga utan att gissa.
--
-- FÖRBJUDNA: gult och turkost skrivs in som förbjudna, så standardfärgerna aldrig kan
-- smyga tillbaka via en tom kolumn.

insert into studio_brand_kits (client_id, kit, source, updated_at)
values (
  'd07d7288-2651-47df-b5f3-a010c1a1a97f',
  jsonb_build_object(
    'colors', jsonb_build_object(
      'paper',        '#FCF7EB',
      'primary',      '#80494E',
      'primaryDeep',  '#5C3C40',
      'primaryLight', '#E4C4A0',
      'accent',       '#ECD5BC',
      'support',      '#F7EBCC',
      'ink',          '#000000',
      'forbidden',    jsonb_build_array('#F2B01E', '#7ECECA')
    ),
    'fonts', jsonb_build_object(
      'headline', 'Playfair Display',
      'body',     'Playfair Display'
    )
  ),
  'matt-pa-sajten',
  now()
)
on conflict (client_id) do update
  set kit = excluded.kit,
      source = excluded.source,
      updated_at = now();

-- Klientraden bär fallback-färgen som används där kitet inte når (t.ex. accenter i
-- kundportalen). Den ska vara hennes signaturfärg, inte den underordnade tonen.
update clients
set primary_color = '#80494E'
where id = 'd07d7288-2651-47df-b5f3-a010c1a1a97f';

notify pgrst, 'reload schema';
