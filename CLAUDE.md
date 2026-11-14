# MTB servis

Osobní PWA: opotřebení komponent Vladanova MTB podle ujetých km, limity s upozorněním, faktury z oprav a verdikty kontrol.

## Zadání
- Kdo: jen Vladan, iPhone.
- Kolo: Specialized Epic Expert 2023 (koupeno 3. 8. 2023), jediné kolo.
- Kde běží: GitHub Pages (repo VM73/mtb-servis) + vlastní Supabase projekt `klpcgnivfvczvvyoqzal` (nesdílí se s pracovními appkami).
- Hotovo když: km komponent sedí na jízdách z Garminu, upozornění na limit přijde jako push na iPhone.

## Stack a nasazení
- `index.html` (vše v jednom), `sw.js` (cache `mtb-servis-vN`), `manifest.webmanifest`, ikony 192 / 512 / 512 maskable, `apple-touch-icon.png`, `favicon-32.png`.
- Supabase JS z cdn.jsdelivr.net, Publishable key v `index.html`. Nikdy secret / service_role klíč.
- Edge Function `mtb`: `?akce=faktura` (zpracování naskenované faktury).
- Jízdy: zkratka iOS „MTB jízdy“ ze Zdraví po zavření Garmin Connect; ručně jen výjimky (např. Apple Watch).
- Nasazení: soubory do kořene repa; zvýšit `VERZE` v `index.html` i `CACHE` v `sw.js`.

## Data
- Tabulky: `mtb_kolo`, `mtb_kusy` (konkrétní kusy komponent), `mtb_polozky`, `mtb_jizdy`, `mtb_doklady` (faktury), `mtb_verdikty` (kontroly v servisu).
- Komponenty: řetěz, převodník, kazeta, brzdové destičky a kotouče zvlášť přední / zadní, vidlice a tlumič (jen km), pláště přední / zadní. Duše se nesledují.
- Kontrola v servisu: slovní verdikt „vydrží ještě ~X km“ prodlouží limit jen aktuálního kusu; bez připomínky kontrol.
- Indoor cycling se nepočítá (je v Apple Watch / Sports Tracker, ne v Garminu).

## Pravidla
- **Dopad na náklady a limity:** u každé úpravy předem zvážit a v souhrnu oznámit dopad na Claude (tokeny), GitHub (Actions minuty, Pages), Supabase (DB, Storage, Edge Functions – free tier), OpenAI/Anthropic API (cena za volání). Když se nic nemění, napsat „bez dopadu“.
- Nejjednodušší řešení, měnit jen nutné.
- UI česky, iOS vzhled, od 320 px.
- Diagnostika: `?debug=1` nebo při chybě JS se ukáže panel s logem; viditelné číslo verze.
- Ikona: osobní styl (grafit/karbon, bílé kolo, oranžový klíč – varianta A), ne rodinná modrá.
- České názvy akcí Zkratek neodhadovat (screenshot).

## Testy
- Playwright: iPhone 13, 320 / 390 px; výpočet km na kus na známých jízdách.

## Stav
- Verze 2.
- Odloženo: záznam měrky řetězu (až Vladan ověří značení měrky).

## Supabase v repu
- `supabase/schema.sql` (tabulky, pohled `mtb_stav_kusu`, RLS, Storage) + `supabase/functions/mtb/` – snímek 2026-11-14, postup změn v `supabase/README.md`.
- Limity komponent v `mtb_kolo.limity` (výchozí hodnota sloupce: řetěz 1500 km, destičky přední 3000, zadní 2000); vlastní limit kusu `mtb_kusy.limit_km` má přednost.
- Upozornění na limit: funkce `mtb` je vrací zkratce při ≥ 80 % limitu.

## Neměnit
- Oddělený Supabase projekt (nespojovat s pracovním).
