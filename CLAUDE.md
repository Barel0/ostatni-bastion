# Ostatni Bastion: kontekst dla agenta

Użytkownik pisze po polsku i oczekuje odpowiedzi po polsku. Gra jest w całości w `index.html` (jeden plik, Canvas, ES5-style JS w IIFE). Nie dodawaj bibliotek ani etapu budowania.

## Co to jest
Tower defence z elementami roguelike. Stały zamek na końcu ścieżki (pasywne umiejętności q/e/r, brak klawiszy QWE), kosmici jako wrogowie, 8 zamków (Chiny, Niemcy WWII, Misie, Kartel, Słowianie, Cyberpunk, Egipt, Rasta), 15 fal, bossowie co 5 fal.

## Zasady projektu
- 30x18 kafelków po 32 px (canvas 960x576), losowa ścieżka.
- Każdy zamek ma 7 własnych wież (tablica `tw` w `CASTLES`) plus startowego Strzelca. Rysunki wież w tabeli `ART[castleId][ARTI[type]]`.
- Ulepszenia wież są globalne dla typu (`S.tup[type]` 1..5) i padają tylko jako nagrody za fale. Brak ulepszania za złoto.
- Nagrody (awans zamku i nagroda za falę) trafiają do kolejki `S.rq` i są odbierane z małych okrągłych ikon z licznikiem (Enter lub klik); wybór kart otwiera się na środku planszy z przyciemnieniem, bez pauzy gry. Wybór za awans zamku jest dostępny tylko po zakończeniu fali (`rqOk`), nagroda za falę zawsze.
- Trudność w `DIFF`: easy/normal/hard oraz osobny hardcore (1 HP zamku, brak kart leczących, zamek płonie cały czas).
- Bossowie w `BOSS`: Al Husain Wisimulaha (spowalnia wieże w promieniu 5 kratek), Skurvvinox (unik pocisków, wrażliwy na spowolnienia i lasery), Bóg Kosmitów (najsilniejszy, jedno wskrzeszenie na 50% HP; jego statystyki są tymczasowe i do omówienia).
- Zapis stały w `localStorage` pod kluczem `bib-meta` (kryształy, poziomy ulepszeń, XP zamków, wybrany zamek i trudność, `nick` gracza i `rank` czyli top 10 wyników osobno dla każdej trudności).
- Zapis gier do analizy: każdy run (wygrana, przegrana, `quit` po przytrzymaniu przycisku, `abandon` po porzuceniu) trafia do `localStorage` pod `bib-runs` (ostatnie 200, `logRun`, `GAMEVER`). Rekord: `v` wersja, `at` data, `cs` zamek, `cl` poziom zamku, `df` trudność, `res`, `wave`, `score`, `kills`, `bosses`, `hp`/`hpMax`, `lvl`, `gt` czas gry (s), `rt` czas rzeczywisty (s), `cr` kryształy, `ml` stałe ulepszenia, `tup` ulepszenia wież, `sk` umiejętności, `items`, `tw` końcowe wieże `[typ,kol,wiersz]`, `lk` przecieki, `w` fale (`hp0/hp1`, `g0/g1` złoto, `tw` liczba wież typami, `k` zabici, `lk` przecieki, `dt` czas, `part` jeśli przerwana), `pk` wybrane karty `[fala,rodzaj,id,poziom zamku]`, `bd` budowy i sprzedaże `[fala,typ,kol,wiersz,sprzedaż 0/1]`. Bez nicku. Eksport do JSON: Ranking → „Pobierz zapis gier”. Przy zmianie balansu podnieś `GAMEVER`.
- Punkty rankingowe dostaje się za zabójstwa (`PTS` oraz `pts` w `BOSS`), wynik trafia do rankingu w `endRun`.
- Ikony nagród: awans zamku (★, prawy górny róg, złota) i nagroda za falę (⚔, lewy górny róg, niebieska) to dwie osobne ikony (`LVG`, `lvToggle(kind)`), baner fali jest na środku.
- Przycisk „Zgłoś błąd” (nagłówek) pauzuje grę i otwiera nowe zgłoszenie w GitHub Issues (`bugUrl`, `BUGREPO`) z opisem gracza i danymi gry bez nicku.
- Przycisk „Zakończ grę” działa po przytrzymaniu 3 s (bez potwierdzenia). Żółty przycisk wyjścia pod prędkością (`exitToMenu`) pauzuje grę i otwiera menu startowe; run można wznowić („Wznów grę”, `S.live`).
- Menu startowe ma też Ranking, Tournament i Dominion (na razie puste, `MODES`) oraz „???”. Pełny ekran włącza się przy pierwszym kliknięciu lub klawiszu (przeglądarki wymagają gestu) i przyciskiem ⛶.

## Treści wrażliwe
Zamek niemiecki ma neutralną stylistykę wojskową bez symboli historycznych, kartel jest fikcyjną kreskówkową haciendą, Rasta używa szacunkowych motywów (lew, czerwień-złoto-zieleń). Zachowaj ten ton.

## Testy przed każdym commitem
```
node tests/strict.js   # musi dać "errors: 0"
node tests/extract.js && node tests/sim.js
node tests/smart.js 64   # mądrzejszy bot, kalibracja trudności
```
Cele balansu (stan od kalibracji pod graczy, którzy uznali grę za zbyt łatwą):
- `smart.js` (bot z sensownym stawianiem wież i wyborem kart, imituje niezłego gracza): Łatwy ≥85% wygranych, Normalny około 40-65%, Trudny około 15-35%, Hardcore do około 15%.
- `sim.js` (prosty bot, zawsze pierwsza karta): Normalny najwyżej około 20%, Trudny około 0%, Hardcore nie przechodzi fali 5.
Trudność stroi się w `DIFF` (mnożnik HP, liczba i prędkość wrogów) oraz we wzorze HP fali w `spawn()` (`hpMul`).

## Styl pracy
Zmieniaj małymi, dokładnymi edycjami (Edit). Po zmianie uruchom testy. Nie wprowadzaj zmian w mechanice bez prośby użytkownika.
