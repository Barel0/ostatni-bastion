/* Punkt zbierający runy z gry (Google Apps Script, darmowy).
   1. script.google.com → Nowy projekt → wklej ten plik.
   2. Utwórz arkusz Google, skopiuj jego ID z adresu do SHEET_ID.
   3. Wdróż → Nowe wdrożenie → Aplikacja internetowa: wykonuj jako "Ja", dostęp "Wszyscy".
   4. Skopiuj adres wdrożenia (…/exec) do COLLECTURL w index.html.
   Każdy run to jeden wiersz: czas, wersja, zamek, trudność, wynik, fala oraz pełny JSON w ostatniej kolumnie.
   Do analizy: Plik → Pobierz, albo wklej kolumnę JSON do skryptu w tests/. */
var SHEET_ID = 'WKLEJ_ID_ARKUSZA';
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.game !== 'ostatni-bastion' || !d.run) return ContentService.createTextOutput('ignored');
    var r = d.run, json = JSON.stringify(r);
    if (json.length > 45000) return ContentService.createTextOutput('too big');
    SpreadsheetApp.openById(SHEET_ID).getSheets()[0]
      .appendRow([new Date(), r.v, r.cs, r.cl, r.df, r.res, r.wave, r.score, r.kills, r.hp, r.gt, json]);
    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('error');
  }
}
