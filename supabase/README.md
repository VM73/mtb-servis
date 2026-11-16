# supabase/ – záloha projektu MTB servis

Supabase projekt **mtb-servis** (`klpcgnivfvczvvyoqzal`), oddělený od pracovních appek.

| Soubor | Co obsahuje |
|---|---|
| `schema.sql` | tabulky, pohled `mtb_stav_kusu` (km a limit každého kusu), RLS politiky, Storage bucket `mtb-doklady` |
| `functions/mtb/index.ts` | Edge Function `mtb` – jízdy ze zkratky (`akce=jizdy`), stav (`akce=stav`), čtení faktury (`akce=faktura`) |

Snímek stažen 2026-11-14 čtením přes konektor Supabase – v Supabase se nic neměnilo.
Kód funkce je přepsán z výpisu konektoru; před prvním nasazením z repa ho porovnej
s editorem v Supabase (Edge Functions → mtb → Code).

**Žádná data ani klíče.** Secrets (SHORTCUT_TOKEN, OWNER_USER_ID, OPENAI_API_KEY) jsou jen
v Supabase → Edge Functions → Secrets.

## Pravidlo pro další změny
1. Změnu databáze napsat jako nový soubor `migrations/RRRRMMDDHHMM_popis.sql`.
2. Spustit přes konektor Supabase (po Vladanově souhlasu; bez konektoru v SQL Editoru), ověřit v appce.
3. Obnovit `schema.sql` (nechat Clauda stáhnout znovu).
4. Změnu Edge Function nejdřív v repu, pak nasadit – ne naopak.
