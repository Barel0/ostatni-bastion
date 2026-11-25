# Ostatni Bastion: kontekst dla agenta

Użytkownik pisze po polsku i oczekuje odpowiedzi po polsku. Gra jest w całości w `index.html` (jeden plik, Canvas, ES5-style JS w IIFE). Nie dodawaj bibliotek ani etapu budowania.

## Co to jest
Tower defence z elementami roguelike. Stały zamek na końcu ścieżki (pasywne umiejętności q/e/r, brak klawiszy QWE), kosmici jako wrogowie, 8 zamków (Chiny, Niemcy WWII, Misie, Kartel, Słowianie, Cyberpunk, Egipt, Rasta), 15 fal, bossowie co 5 fal.

## Zasady projektu
- 30x18 kafelków po 32 px (canvas 960x576), losowa ścieżka.
- Każdy zamek ma 7 własnych wież (tablica `tw` w `CASTLES`) plus startowego Strzelca. Rysunki wież w tabeli `ART[castleId][ARTI[type]]`.
- Ulepszenia wież są globalne dla typu (`S.tup[type]` 1..5) i padają tylko jako nagrody za fale. Brak ulepszania za złoto.
- Nagrody (awans zamku i nagroda za falę) trafiają do kolejki `S.rq` i są odbierane w popupie w prawym górnym rogu (Enter lub klik), bez pauzy gry.
- Trudność w `DIFF`: easy/normal/hard oraz osobny hardcore (1 HP zamku, awanse tylko po fali, zamek płonie cały czas).
- Bossowie w `BOSS`: Al Husain Wisimulaha (spowalnia wieże w promieniu 5 kratek), Skurvvinox (unik pocisków, wrażliwy na spowolnienia i lasery), Bóg Kosmitów (najsilniejszy, jedno wskrzeszenie na 50% HP; jego statystyki są tymczasowe i do omówienia).
- Zapis stały w `localStorage` pod kluczem `bib-meta` (kryształy, poziomy ulepszeń, XP zamków, wybrany zamek i trudność).

## Treści wrażliwe
Zamek niemiecki ma neutralną stylistykę wojskową bez symboli historycznych, kartel jest fikcyjną kreskówkową haciendą, Rasta używa szacunkowych motywów (lew, czerwień-złoto-zieleń). Zachowaj ten ton.

## Testy przed każdym commitem
```
node tests/strict.js   # musi dać "errors: 0"
node tests/extract.js && node tests/sim.js
```
Cele balansu botów: Normalny około 40-90% wygranych, Trudny około 20-50%, Hardcore bot nie przechodzi fali 5.

## Styl pracy
Zmieniaj małymi, dokładnymi edycjami (Edit). Po zmianie uruchom testy. Nie wprowadzaj zmian w mechanice bez prośby użytkownika.
