# Onboarda en ny kunds Instagram — steg för steg

Så kopplar du en ny kunds Instagram till Cockpit med Anslutningsmotorn. Enkelt, inga tokens
att klistra in.

## En gång totalt (redan gjort)
- **Anslut Meta** på `/dashboard/installningar/meta` (ägarnivå). Görs en enda gång för hela
  Cockpit. Är det grönt "Anslutet" där är du klar med det steget för alltid.

## Steg 0 — förbered kundens konton (utanför Cockpit, en gång per kund)
Kunden måste ha:
1. Ett **Instagram Business- eller Creator-konto** (inte privat).
2. IG-kontot **kopplat till en Facebook-sida**.
3. Att **du har åtkomst till den Facebook-sidan** — enklast via **Meta Business Manager**:
   kunden lägger till dig/din byrå som partner eller admin på sidan.

> När du har åtkomst till sidan dyker den upp **automatiskt** i dropdownen i Cockpit.
> Har du inte åtkomst syns den inte — då är det steg 0 som saknas, inte Cockpit.

## Steg 1–4 — i Cockpit (30 sekunder)
1. **Välj kunden** i klientväljaren uppe till vänster.
2. Gå till **Inställningar → Instagram**.
3. I **"Välj sida att koppla"**-dropdownen: välj kundens Facebook-sida
   (visar `@användarnamn` om IG är kopplat).
4. Klicka **Anslut Instagram**.

Klart! Rutan blir grön och visar `@handle` + antal följare. Nu kan kunden publiceras och
analyseras precis som DT och HM Motor.

## Om en sida inte har IG kopplat
Dropdownen visar sidan gråmarkerad med "(inget IG kopplat)". Fixa det hos kunden:
Instagram-appen → Inställningar → Konto → dela till andra appar → koppla Facebook-sidan.
Sen syns den som valbar.

## Nödutgång — "Avancerat"
Under dropdownen finns **Avancerat → klistra in manuellt** (IG Business Account ID + token).
Använd bara om en sida av någon anledning inte går via dropdownen. Vanliga fall behöver den inte.

## Efter kopplingen — sköter sig själv
- **Tokenhälsovakten** kollar alla kopplingar dagligen.
- Går en token sönder får du **mejl** med kundens namn + en åtgärdslänk.
- Åtgärd = samma dropdown: välj sidan igen → Anslut. Klart.

## Status-lampor (på Meta-sidan under "Kopplade konton")
- 🟢 **OK** — allt fungerar.
- 🟡 **Varning** — token går snart ut, koppla om snart.
- 🔴 **Död** — slutat fungera, koppla om nu (dropdownen).
- ⚪ **Ej kollad** — hälsovakten har inte hunnit köra än.
