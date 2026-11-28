# Publiczny ranking: wdrożenie (około 5 minut, na komputerze)

Potrzebujesz tylko konta Google. Lista wyników będzie w Twoim arkuszu.

1. Wejdź na https://sheets.new i nazwij arkusz, np. **Ranking Ostatni Bastion**.
2. W arkuszu wybierz **Rozszerzenia → Apps Script**.
3. Usuń to, co jest w oknie kodu, wklej całą zawartość pliku `tools/ranking-apps-script.js` i kliknij ikonę dyskietki (Zapisz).
4. Kliknij **Wdróż → Nowe wdrożenie**. Przy „Wybierz typ” kliknij koło zębate i zaznacz **Aplikacja internetowa**.
5. Ustaw:
   - **Wykonaj jako:** Ja
   - **Kto ma dostęp:** Wszyscy
6. Kliknij **Wdróż** i zezwól na dostęp. Google może ostrzec, że aplikacja jest niezweryfikowana. To Twój własny skrypt: **Zaawansowane → Otwórz projekt (niebezpieczne)**. Zrób tak tylko dla kodu wklejonego w punkcie 3.
7. Skopiuj **adres aplikacji internetowej** (kończy się na `/exec`).
8. Sprawdzenie: otwórz ten adres w przeglądarce w trybie prywatnym. Powinien pojawić się tekst zaczynający się od `{"ok":true`.
9. Wyślij adres autorowi kodu. Po podłączeniu w grze pojawi się lista publiczna.

## Co trafia do arkusza
Data, losowy numer wpisu, nick, trudność, zamek, fala, HP zamku, czas i punkty. Bez adresu e-mail i danych o telefonie.

## Usuwanie wpisów
Wpisz cokolwiek w kolumnie **ukryj** (wiersz zniknie z listy w grze) albo usuń cały wiersz.

## Zmiana skryptu później
**Wdróż → Zarządzaj wdrożeniami → ołówek → Wersja: Nowa wersja → Wdróż.** Adres zostaje ten sam. „Nowe wdrożenie” utworzyłoby nowy adres.

## Ograniczenie
Wynik liczy telefon gracza. Skrypt odrzuca liczby niemożliwe w grze, ale ktoś, kto zna adres, może wysłać wymyślony, wiarygodny wynik. Takie wpisy usuwasz ręcznie.
