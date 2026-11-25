# Ostatni Bastion

Gra 2D w przeglądarce: tower defence z elementami roguelike. Kosmici maszerują do Twojego zamku, a Ty budujesz wieże. Osiem zamków z różnych światów, każdy z własnym zestawem 7 wież, trzema bossami (fale 5, 10, 15) i czterema poziomami trudności (w tym Hardcore).

Cała gra to jeden plik `index.html` (Canvas, czysty JS, bez bibliotek i bez budowania).

## Granie online
Po wypchnięciu na GitHuba strona wdraża się sama przez GitHub Pages:
`https://TWOJ_LOGIN.github.io/NAZWA_REPO/`

## Granie lokalnie
Otwórz `index.html` w przeglądarce.

## Testy
```
node tests/strict.js     # rysowanie wszystkich wież, zamków, wrogów (szuka NaN i błędów)
node tests/extract.js    # wyciąga skrypt do tests/game.js
node tests/sim.js        # boty grają całe runy, pokazuje % wygranych
```
