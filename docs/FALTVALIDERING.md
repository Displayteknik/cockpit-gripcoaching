# FÄLTVALIDERING — Håkan bockar av (före lördag kväll)

Detta är sådant jag **inte kunde klick-testa** åt dig (interaktivt / auth-gated / mobil). Kör i kundvyn:
`https://cockpit.gripcoaching.se/k/06cb3d30-ec91-4810-9f02-b06af3e6127e` · tenant **Annas Blommor**.
Bocka `[x]` = funkar, notera fel. **Det du inte hinner → visa inte i demon.**

## A · Studio inline-redigering, alla mallar (`/k/studio`)
För varje mall: välj den → ändra rubriken → se att förhandsvisningen uppdateras → **Exportera/rendera** bild.

- [ ] 1. **Foto + overlay** — rubrik ändras, bild syns bakom, export ger PNG
- [ ] 2. **Textkort** — rubrik + brödtext på färgplatta
- [ ] 3. **Foto + ruta** — text i ruta över foto
- [ ] 4. **Statement** — stor rubrik centrerad
- [ ] 5. **Citat / kundröst** — citattecken + attribution
- [ ] 6. **Lista / tips** — punktlista renderar
- [ ] 7. **Erbjudande** — erbjudande-badge/CTA syns
- [ ] 8. **Karusell** — flera slides, swajp funkar
  *(Verktyget har 8 mallar, inte 10 — hela uppsättningen täckt ovan.)*

## B · AI-funktioner (`/k/studio`, sektion Bildtext)
- [ ] 9. **A/B-caption** — "Få 3 varianter med olika krokar" → tre olika förslag i Annas röst, går att välja
- [ ] 10. **Bästa-tid** — schemaläggnings-steget föreslår en publiceringstid *(visa i demon ENDAST om förslaget är rimligt)*
- [ ] 11. **Föreslå bildtext** — genererar caption utan AI-språk (inga "kraftfull/nästa nivå")
- [ ] 12. **Föreslå text** (rubrik på bild) — delar upp i rubrik + brödtext

## C · Nya leads — skapa live (`/dashboard/leads`, agency-vy)
- [ ] 13. **Lead via inklistrad bild** — klistra skärmbild av en DM → fält fylls i (namn/plattform/meddelande)
- [ ] 14. **Lead via röst** — "Prata in" → transkriberas till lead *(testa båda; bild rekommenderas för demon)*
- [ ] 15. **Värme-trappan** — flytta ett lead Ny → Kontaktad → Dialog, färg/steg uppdateras
- [ ] 16. **AI-svarsförslag** — öppna ett lead i Dialog → förslag på svar genereras

## D · Fokus (`/k/fokus`)
- [ ] 17. **Board renderar** — 88 800 kr, Sara överst "I risk", Att göra idag (3), Inflödet
- [ ] 18. **Coacha affären** — klick ger AI-coachning på affären
- [ ] 19. **Planera kontakt / Omplanera** — sparar utan fel
- [ ] 20. **Drag-and-drop** — ⚠️ visas INTE på demo-tenanten (ingen GHL). Bekräfta bara att ingen stegrad/fel dyker upp. Vill du visa drag: gör det på en riktig GHL-tenant utanför demon.

## E · Mobil (kundvyn i 390 px bredd)
Öppna kundlänken i mobil eller DevTools 390 px.
- [ ] 21. **/k Översikt** — meny fäller ut, kort staplas snyggt
- [ ] 22. **/k/studio** — mallväljare + fälten går att använda med tumme
- [ ] 23. **/k/fokus** — korten läsbara, knappar nåbara
- [ ] 24. **Ingen horisontell scroll** på någon vy

---
**Redan verifierat av mig (behöver du inte testa):** /k Översikt-branding, /k/fokus board-data, /k/studio laddar alla mallar, Nya leads-datan (9 st), Kalendern (14 poster), att drag är tyst utan GHL. Säkerhet: qa-security 10/10 live.
