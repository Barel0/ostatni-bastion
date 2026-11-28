# Ostatni Bastion: kontekst dla agenta

Użytkownik pisze po polsku i oczekuje odpowiedzi po polsku. Gra jest w całości w `index.html` (jeden plik, Canvas, ES5-style JS w IIFE). Nie dodawaj bibliotek ani etapu budowania.

## Co to jest
Tower defence z elementami roguelike. Stały zamek na końcu ścieżki (pasywne umiejętności q/e/r, brak klawiszy QWE), kosmici jako wrogowie, 8 zamków (Chiny, Niemcy WWII, Misie, Kartel, Słowianie, Cyberpunk, Egipt, Rasta), 15 fal, bossowie co 5 fal.

## Zasady projektu
- 30x18 kafelków po 32 px (canvas 960x576), losowa ścieżka.
- Każdy zamek ma 7 własnych wież (tablica `tw` w `CASTLES`) plus startowego Strzelca. Rysunki wież w tabeli `ART[castleId][ARTI[type]]`.
- Ulepszenia wież są globalne dla typu (`S.tup[type]` 1..5) i padają tylko jako nagrody za fale. Brak ulepszania za złoto. Kolejna kopia tego samego typu dostaje ulepszenia słabiej (`TUPDEC`, −8% za każdą wcześniejszą, min. 50%, `uf` w `synCalc`).
- Wieże: kolejna kopia tego samego typu kosztuje +15% (`TCOSTUP`, `towerCost`), twardy limit 7 sztuk na typ (`TLIMIT`, `tryBuild`). Sąsiedztwo w 8 polach wokół wieży (`synCalc`, cache po `S.tver`): −8% szybkostrzelności za każdego sąsiada tego samego typu (`SAMEPEN`, do 5), +6% obrażeń za każdy inny typ obok (`MIXBON`, do 4), plus pary z premiami (`SYNU` dla wszystkich zamków, `CSYN[id]` po 3 własne pary na zamek; wpis `[A,B,efekt dla A,efekt dla B,nazwa]`). Złote kreski na planszy łączą pary, czerwone przerywane (zaznaczona wieża i podgląd budowy) wskazują sąsiadów tego samego typu.
- Kontry: `dealDamage(e,dmg,quiet,crit,k)` z rodzajem obrażeń `k` (`splash`, `energy`, `dot`). Pancernik ma pancerz `arm` (stała redukcja na trafienie, min. 35%, trucizna `dot` ją ignoruje), Spodek ma `rs.splash` .6, Tarczownik (nowy wróg `shield`, od fali 6) ma `rs.energy` .4. Snajper celuje w najmocniejszego (`strongest`), Moździerz nie trafia bliżej niż `MORTAR_MIN`.
- Pola specjalne mapy (`genSpec`, `S.spec`, opisy w `SPEC`): wzgórze (+20% zasięgu), pole mocy (+15% szybkostrzelności), złoże (+6 zł po fali za wieżę), głaz (blokuje budowę). Losowe w każdym runie, rozmieszczone 1–3 kratki od ścieżki.
- Nagrody (awans zamku i nagroda za falę) trafiają do kolejki `S.rq` i są odbierane z małych okrągłych ikon z licznikiem (Enter lub klik); wybór kart otwiera się na środku planszy z przyciemnieniem, bez pauzy gry. Wybór za awans zamku jest dostępny tylko po zakończeniu fali (`rqOk`), nagroda za falę zawsze.
- Trudność w `DIFF`: easy/normal/hard oraz osobny hardcore (1 HP zamku, brak kart leczących, zamek płonie cały czas).
- Frakcje wrogów (`FAC`, wybór przed runem w menu, `meta.fac`, `S.fac`): Kosmici (bez mechaniki), Kościelni (`heal`: Proboszcz leczy wrogów w promieniu `HEAL_R`), Ruscy dresiarze (`rage`: poniżej 50% HP +40% prędkości), Politycy (`shield`: tarcza 20% HP, fikcyjne postacie bez prawdziwych nazwisk), Influenserzy (`split`: Streamer rozpada się na 3 Followerów). Statystyki bazowe są wspólne (`ENEMY`, `BOSS`), frakcja zmienia nazwy, wygląd (`drawHum`) i ma mnożnik HP `hp` do strojenia (nie działa na Hardcore, ma 1.0 ustawione w `spawn`). Bossowie frakcji mają `id` sultan/hunter/god, więc zachowują mechaniki. `smart.js` przyjmuje frakcję jako 4. argument. Rekord runu ma pole `fc`.
- Bossowie w `BOSS`: Al Husain Wisimulaha (spowalnia wieże w promieniu 5 kratek), Skurvvinox (unik pocisków, wrażliwy na spowolnienia i lasery), Bóg Kosmitów (najsilniejszy, jedno wskrzeszenie na 50% HP; jego statystyki są tymczasowe i do omówienia).
- Zapis stały w `localStorage` pod kluczem `bib-meta` (kryształy, poziomy ulepszeń, XP zamków, wybrany zamek i trudność, `nick` gracza i `rank` czyli top 10 wyników osobno dla każdej trudności).
- Zapis gier do analizy: każdy run (wygrana, przegrana, `quit` po przytrzymaniu przycisku, `abandon` po porzuceniu) trafia do `localStorage` pod `bib-runs` (ostatnie 200, `logRun`, `GAMEVER`). Rekord: `v` wersja, `at` data, `cs` zamek, `cl` poziom zamku, `df` trudność, `res`, `wave`, `score`, `kills`, `bosses`, `hp`/`hpMax`, `lvl`, `gt` czas gry (s), `rt` czas rzeczywisty (s), `cr` kryształy, `ml` stałe ulepszenia, `tup` ulepszenia wież, `sk` umiejętności, `items`, `tw` końcowe wieże `[typ,kol,wiersz]`, `lk` przecieki, `w` fale (`hp0/hp1`, `g0/g1` złoto, `tw` liczba wież typami, `k` zabici, `lk` przecieki, `dt` czas, `part` jeśli przerwana), `pk` wybrane karty `[fala,rodzaj,id,poziom zamku]`, `bd` budowy i sprzedaże `[fala,typ,kol,wiersz,sprzedaż 0/1]`. Bez nicku. Eksport do JSON: Ranking → „Pobierz zapis gier”. Przy zmianie balansu podnieś `GAMEVER`. Automatyczne wysyłanie: `sendRun` (sendBeacon, anonimowo) wysyła rekord na `COLLECTURL`; pusty = wyłączone. Gracz może to wyłączyć checkboxem (`meta.share`, domyślnie włączone) na ekranie startowym i w Ranking. Punkt zbierający: `tools/collector-apps-script.js` (Google Apps Script → arkusz).
- Punkty rankingowe dostaje się za zabójstwa (`PTS` oraz `pts` w `BOSS`), wynik trafia do rankingu w `endRun`.
- Ikony nagród: awans zamku (★, prawy górny róg, złota) i nagroda za falę (⚔, lewy górny róg, niebieska) to dwie osobne ikony (`LVG`, `lvToggle(kind)`), baner fali jest na środku.
- Przycisk „Zgłoś błąd” (nagłówek) pauzuje grę i otwiera nowe zgłoszenie w GitHub Issues (`bugUrl`, `BUGREPO`) z opisem gracza i danymi gry bez nicku.
- Przycisk „Zakończ grę” działa po przytrzymaniu 3 s (bez potwierdzenia). Żółty przycisk wyjścia pod prędkością (`exitToMenu`) pauzuje grę i otwiera menu startowe; run można wznowić („Wznów grę”, `S.live`).
- Telefon: w poziomie (`@media (orientation:landscape) and (max-height:540px)`) plansza zajmuje cały ekran, a statystyki, pasek wież, umiejętności i przyciski pływają nad nią (klasy `hassel`/`inmodal` na `#app` ukrywają i pokazują panele). W pionie na urządzeniach dotykowych `#rot` pokazuje podpowiedź „Obróć telefon poziomo” (`rotGo` próbuje pełnego ekranu i blokady orientacji, „Graj w pionie” zamyka). Nie testowane na prawdziwym telefonie, tylko w Edge headless.
- Komputer (`@media (min-width:900px) and (min-height:541px)`, układ „kompakt”): cienka belka u góry (tytuł, statystyki, 🐞, ⛶), plansza skalowana do wysokości okna (`100vh - 184px`, wyśrodkowana), jedna belka na dole: wieże (klawisz, koszt i licznik n/7; nazwa w `title`) | `.mid` z umiejętnościami i przedmiotami | sterowanie (Start, x1, Zakończ, wyjście). Info o zaznaczonej wieży (`.info` z `#sel`) to dymek na dole planszy, widoczny tylko po zaznaczeniu (`#app.hassel`). Węższe ekrany i pion mają stos jak dawniej. Zrzuty sprawdzono w Edge headless (1366×768, 1920×1080).
- Menu startowe ma też Ranking, Tournament i Dominion (na razie puste, `MODES`) oraz „???”. Pełny ekran włącza się przy pierwszym kliknięciu lub klawiszu (przeglądarki wymagają gestu) i przyciskiem ⛶.

## Demo nowych zasad (`demo/`)
Online: https://barel0.github.io/ostatni-bastion/demo/ (GitHub Pages w trybie „branch”: publikuje całą gałąź `main`, więc każdy push publikuje też demo; lokalny `.github/workflows/pages.yml` jest ignorowany przez git i nieużywany). Nowy plik gry trzeba dopisać do `android/build.py` i testów.
Osobna grywalna wersja z nowymi zasadami (zaakceptowane przez użytkownika 2026-11-27). Nie zmienia `index.html`. Kierunek: Android w poziomie, grafiki KayKit (CC0).
- `demo/index.html` (układ), `ui.js` (Canvas, dotyk, panele), `game.js` (logika bez DOM), `data.js` (liczby i teksty), `roads.js` (generator dróg 16×9), `assets.js` (wygenerowane sprite'y, nie edytować ręcznie). Bez bibliotek i etapu budowania; ES5-style.
- Zasady: 20 fal; frakcja ma 4 zwykłe rodzaje wież i bramę jako piątą wieżę (odblokowania w falach 1, 1, 3, 6, 15); miejsca na zwykłe wieże 3/4/5/6/7 (od fal 1/3/6/10/15), od fali 15 osobne miejsce na bramę, najwyżej 3 jednego rodzaju; każda wieża ulepszana osobno (4 poziomy: ścieżka, 2 karty, mistrzostwo; brama tylko mistrzostwo za 2 punkty), 25 punktów na grę; ścieżkę pokazuje kolor obramówki; mapa, droga i frakcja wrogów są losowe.
- Sprite'y: `demo/tools/render_sprites.py` (Blender; potrzebuje wypakowanej kolekcji KayKit i skryptów makiet z `Downloads/ostatni-bastion-makiety-kaykit/skrypty`), potem `demo/tools/pack_atlas.py`.
- Test i balans: `node tests/demo-sim.js 800` (bot; `GATE="crown=1.2,..."` i `HCHP=` do strojenia). Stan: Łatwy ~97%, Normalny ~54% (frakcje 48–58%), Trudny ~17%, Hardcore ~11%. Po zmianie liczb w `data.js` lub `game.js` uruchom go ponownie.

### Interfejs i bramy (zaakceptowane 2026-11-28; szkice w `Downloads/ostatni-bastion-makiety-kaykit/szkice-intro-hud/`)
- Intro przy uruchomieniu: logo „mAInIAc dev” 2 s → nazwa gry 2 s → wybór zamku (twarde cięcia, stuknięcie przeskakuje). Wybór zamku: rozmyte tło i pozostałe zamki, ostry tylko wybrany; żar Z8 tylko w Hardcore.
- Scena ma jednostki 915×412 skalowane do ekranu (`layout()`). HUD „E8 Czyste pole” (zatwierdzony 2026-11-28, zastąpił M2): płótno obejmuje cały ekran (`L.ox/oy/ew/eh`, łąka i droga ciągną się poza planszę 16×9), u góry po lewej pasek statystyk i pozioma drabinka 20 fal, po prawej napis o bossie, umiejętności w lewym dolnym rogu, kółko „Wieże” wysuwa pasek 5 wież (chowa się po użyciu), ★ obok przycisku fali (`STAR_SPOTS`: ucieka, gdy zasłaniałaby wieżę). Element zasłaniający wieżę jest półprzezroczysty, a między falami stuknięcie w pole z wieżą pod przyciskiem wybiera wieżę.
- Przycisk fali „W2” (w Hardcore „W10”): stuknięcie < 0,4 s uruchamia falę po puszczeniu; przytrzymanie 2 s pauzuje i pokazuje prędkość oraz menu; wznawia ten sam przycisk; wyjście w trakcie fali pyta „Na pewno?”.
- Stawianie (wariant B): HUD znika, plansza rośnie na całą szerokość i przesuwa się za palcem; anulowanie w lewym górnym rogu. Podniesienie podglądu nad palec maleje przy dolnej krawędzi (`liftAt`), inaczej dolny rząd jest nieosiągalny.
- Panel wieży „U5”: przyciski w kole, tło rozmyte, ostra tylko zaznaczona wieża, gra stoi. Napis „FALA x” (F7 „Żar”, 1 s + 1 s zanikania), ptaszek po fali (P7, 1 s).
- Brama (typ `legend`, `t.c/t.r` = kratka drogi, `t.o` v/h, `t.k` = indeks drogi): zajmuje po polu z obu stron prostej drogi (`footprint`, `gateSpot`), atakuje w strefie `e.d` w `k±2,5`. Korona: włócznie i krata; Las: salwy i znacznik; Gildia: Rogatka (myto, +tempo wież przy filarach); Zakon: pioruny ×2 na spowolnionych. Bramy ignorują pola specjalne. Brama skupia wszystkie pociski, gdy wrogów jest mniej.
- Hardcore (`DIFF.hardcore`, `DATA.HARDCORE`): start 1 HP, zamek płonie przy HP ≤30%, +2 HP po bossie, leczenie z nagród bez zmian, wzmocnienia wrogów i losowa odporność bossa (−35%).
- Grafiki bram: `demo/tools/render_gates.py` dopisuje je do sprite'ów po `render_sprites.py`.
- Zapis: klucz `bib-demo2-save`, format `v: 2` (stare zapisy dema są pomijane).

## Aplikacja na Androida (`android/`)
Użytkownik wybrał APK (2026-11-28) i chce dać grę innym. Opakowanie: własna aktywność z WebView (`MainActivity.java`), bez bibliotek i bez Gradle; zasada „bez etapu budowania” dotyczy gry, ten folder tylko ją pakuje.
- Budowanie: `JAVA_HOME=%USERPROFILE%\android-tools\jdk ANDROID_HOME=%USERPROFILE%\android-tools\sdk python android/build.py --version 0.3 --code 3`. Każde wydanie musi mieć większy `--code`. APK trafia do `Downloads\OstatniBastion-apk\`.
- Klucz podpisu i hasło: `%USERPROFILE%\ostatni-bastion-klucz\` (poza repozytorium; nie dodawać do gita, nie wypisywać hasła). Inny klucz = gracze muszą odinstalować grę i tracą zapisy.
- `applicationId` to `pl.maniacdev.ostatnibastion`; zmiana po rozdaniu APK tworzy osobną aplikację.
- Aplikacja nie ma uprawnienia do internetu. Mostek `window.BibApp`: `vibrate("ms,ms")`, `keepAwake(bool)`. Zejście w tło woła `window.__appPause()`. Przycisk „Wstecz” (`window.__back()`) działa w wariancie K5 wybranym przez użytkownika: w grze tylko pauzuje; nie wznawia, nie otwiera menu i nigdy nie zamyka aplikacji.
- Instrukcja dla graczy: `android/INSTALACJA.md` (po wydaniu nowej wersji zmień w niej nazwę pliku). Klucz ma kopię zapasową na komputerze użytkownika.
- Nazwa bossa „Al Husain Wisimulaha” zostaje (decyzja użytkownika, 2026-11-28); nie zmieniać.
- `android/icon.png` to ikona I3 „Płonący bastion” (wybrana przez użytkownika). Zatwierdzone też dźwięki, wibracje i zapisy. Ostatnie wydanie: 0.3 (code 3).
- Dźwięki i wibracje: `demo/sfx.js` (Web Audio, bez plików). `game.js` tylko zgłasza zdarzenia w `S.ev` (`cue`), nie zmienia to mechaniki ani balansu.

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
Uwaga do kalibracji: `smart.js` przenosi poziomy zamków między runami, więc zawsze uruchamiaj go w pełnej kolejności (domyślnie Łatwy→Hardcore, minimum 96 runów); pojedynczy poziom trudności puszczony osobno wychodzi trudniejszy. `tests/game.js` jest współdzielony przez `extract.js`, więc przy równoległej pracy kalibruj na kopii. `MONO=typ node tests/smart.js ...` sprawdza ścianę z jednego typu wież (po zmianach mono-typ wygrywa na Normalnym <10%). Stan po kalibracji z limitem wież, sąsiedztwem i kontrami (`DIFF.normal.hp` 2, `DIFF.hard.hp` 2,4, `GAMEVER` 2026.11.25.2): smart.js Łatwy ~99%, Normalny ~55%, Trudny ~29%, Hardcore ~10-15%.

## Styl pracy
Zmieniaj małymi, dokładnymi edycjami (Edit). Po zmianie uruchom testy. Nie wprowadzaj zmian w mechanice bez prośby użytkownika.
