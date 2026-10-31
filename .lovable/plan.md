# Oprava modelu pro motivační dopisy

## Ověřený stav
- Devět AI funkcí používá `google/gemini-3-flash-preview` nebo `google/gemini-3.1-flash-lite`. Oba jsou v aktuálním katalogu podporované, bez označení deprecated; zůstanou beze změny.
- Motivační dopisy používají `anthropic/claude-sonnet-4-6`. Není v aktuálním katalogu a kontrolní požadavek vrátil HTTP 400 „invalid model“. Automatické přesměrování tohoto názvu tedy nefunguje; datum ukončení podpory nebylo potvrzeno.
- Aktuální `anthropic/claude-sonnet-5` je podporovaný, ale katalog uvádí pouze protokol Messages. Pouhá změna názvu v dnešním Chat Completions požadavku nestačí.
- Produkční volání Gemini z 31. 10. 2026 vracejí HTTP 403 `credit_hard_block_workspace`. Jde o samostatné zablokování kreditu, nikoli zastaralost modelu. Živé ověření výsledného dopisu počká na obnovení přístupu k AI.

## Navržená změna
1. Zachovat Claude Sonnet pro motivační dopisy a nahradit neplatný název modelem `anthropic/claude-sonnet-5`, pokud bude potvrzen jeho dokumentovaný protokol pro tento projekt.
2. Upravit pouze požadavek a čtení odpovědi motivačních dopisů podle ověřené dokumentace Messages. Zachovat tři odstavce, profil uchazeče, ukládání dopisů, měsíční limit a současné chování ostatních funkcí.
3. Doplnit odpovídající účtování využití Claude; dnešní výpočet pro neznámý model používá cenu Gemini. Denní rozpočet $3 zůstane zachován.
4. Po obnovení AI přístupu ověřit vytvoření a opětovné načtení dopisu na přihlášeném účtu. Teprve po úspěšném ověření označit nález jako opravený.

## Cena a omezení
- Aktuální katalog uvádí pro Sonnet 5 základní cenu 8 kreditů za milion vstupních tokenů a 40 kreditů za milion výstupních tokenů. Cenu původního neplatného modelu nelze ověřit, proto nelze spolehlivě vyčíslit rozdíl.
- Messages pro Sonnet 5 uchovává data u poskytovatele; aktuální pravidla pracovního prostoru tento model a protokol povolují. Konkrétní dostupnost v regionu a skutečný požadavek bude nutné ověřit po obnovení přístupu.
- Pokud dokumentovaný protokol nebude pro tento projekt dostupný, změna se zastaví bez tiché náhrady Claude jiným poskytovatelem.
- Žádné publikování, změny katalogu nabídek, sběr dat ani enrichment.

## Technické podrobnosti
- Rozsah: `supabase/functions/generate-cover-letter/index.ts`, příslušná položka v `_shared/aiBudget.ts` a malé testy transformace odpovědi a využití tokenů.
- Nejprve získat přesnou dokumentaci Gateway Messages: URL, hlavičky, požadované parametry a tvar odpovědi. Současné načtené návody popisují pouze OpenAI a Google a nejsou důkazem protokolu Anthropic.
- Nepřidávat nové retry ani časové limity; při potvrzeném odmítnutí přístupu nebo nedostupnosti dokumentovaného endpointu zastavit ověřování.
- Zachovat existující promptové omezení délky. Pokud Messages vyžaduje výstupní rozpočet, použít dokumentovanou vhodnou hodnotu.