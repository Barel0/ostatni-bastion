# Ostatni Bastion

Gra 2D w przeglądarce: tower defence z elementami roguelike. Kosmici maszerują do Twojego zamku, a Ty budujesz wieże. Osiem zamków z różnych światów, każdy z własnym zestawem 7 wież, trzema bossami (fale 5, 10, 15) i czterema poziomami trudności (w tym Hardcore).

Cała gra to jeden plik `index.html` (Canvas, czysty JS, bez bibliotek i bez budowania).

## Granie online
Po wypchnięciu na GitHuba strona wdraża się sama przez GitHub Pages:
- obecna gra: https://barel0.github.io/ostatni-bastion/
- demo nowych zasad: https://barel0.github.io/ostatni-bastion/demo/

## Granie lokalnie
Otwórz `index.html` (albo `demo/index.html`) w przeglądarce.

## Demo nowych zasad i aplikacja na Androida
`demo/` to osobna wersja gry na telefon w poziomie: 4 frakcje, 20 fal, wieże ulepszane osobno, bramy nad drogą, tryb Hardcore, losowe mapy i drogi.

- Instalacja na telefonie: [android/INSTALACJA.md](android/INSTALACJA.md)
- Publiczny ranking (`demo/online.js`): wyniki trafiają do Arkusza Google autora tylko za zgodą gracza; gra działa też bez internetu. Serwer: [tools/RANKING-INSTRUKCJA.md](tools/RANKING-INSTRUKCJA.md).
- Budowanie pliku APK: `python android/build.py --version X.Y --code N` (wymaga JDK i Android SDK; opis na początku `android/build.py`). Klucz podpisu nie jest częścią repozytorium.
- Balans dema: `node tests/demo-sim.js 800`
- Grafiki: KayKit (Kay Lousberg, www.kaylousberg.com), licencja CC0.

## Testy
```
node tests/strict.js     # rysowanie wszystkich wież, zamków, wrogów (szuka NaN i błędów)
node tests/extract.js    # wyciąga skrypt do tests/game.js
node tests/sim.js        # boty grają całe runy, pokazuje % wygranych
```
