# Roadmap

- [x] Daily highlights: stable muted category colours, top seven plus Ostatní, count/percentage legend; 3 tests pass, signed-in desktop and 320/390/727px verified

- [x] Preserve chat AI error status/reason, display actionable failure and stop loading — authenticated UI verified with 403 and restored draft
- [x] Persist workspace AI pause and gate all AI entrypoints; blocked path verified after deployment, 25 tests passed
- [ ] Restore AI access — blocked by workspace monthly AI cap (120 credits); owner must choose a higher cap

- [x] Apply Norgejobs theme across app, replace black styling, verify AA on vineyard/forest desktop and mobile
- [x] Extend employer headlines to Czechia, Slovakia and other countries

- [x] Six-scene landing background: licensed self-hosted clips, still-photo fallback, contrast and desktop/mobile performance verification

- [x] Newest-jobs landing counter: refresh-time active/24-hour count, durable snapshot, mobile layout and count verification

- [x] Fáze 2: firemní nabídky (tabulka, pravidla stavů, synchronizace do katalogu, formulář, přehled, karty, admin tlačítko Zveřejnit)
- [x] Pravidlo: nezměněný stav povolen; uzavření/koncept zveřejněné nabídky ji skryje z katalogu
- [x] Fáze 3: schvalovací fronta, trust levely, hlášení, pozastavení firmy
- [x] Pravidlo: nabídku lze zveřejnit jen u schválené firmy; majitel vidí náhled své firmy
- [x] E-maily zaměstnavatelům (Resend) – napojeno na uložený klíč; odesílatel onboarding@resend.dev doručí jen vlastníkovi účtu, dokud nebude ověřená doména

- [x] Verify employer logo ownership, route separation, email confirmation settings and auth triggers; server-side anonymous logos implemented. Full employer/email/logo flow awaits a confirmed employer and company logo.

- [x] Zmapovat Archiles a všechny aktuální zdroje pracovních nabídek
- [x] Shrnout způsob načítání a stav zdrojů pro uživatele
- [ ] Opravit přihlášení (tlačítko Povolit) – server teď běží; zvětšení čeká na potvrzení po diagnostice
- [x] Diagnostika po 3 měsících (jen čtení, žádné změny)
- [ ] Nahradit neplatný model motivačních dopisů – plán schválen; blokuje chybějící dokumentace Gateway Messages pro tento projekt a neověřené obnovení AI přístupu; kód nezměněn
- [x] Krok 4: kontaktní možnosti u firemních nabídek (CV / zpráva / e-mail), přihlášky, Moje přihlášky se stažením, přehled pro firmu, upozornění e-mailem, mazání 6 měsíců po uzavření
- [x] Zobrazení e-mailu se jen počítá zvlášť (bez upozornění, bez limitu), není to přihláška
