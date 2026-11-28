/* Publiczny ranking nowej wersji gry (Google Apps Script + Arkusz Google, darmowe).
   Instrukcja wdrożenia: tools/RANKING-INSTRUKCJA.md
   POST: dodaje jeden wynik. GET: oddaje top 10 dla każdej trudności.
   Moderacja: wpisz cokolwiek w kolumnie "ukryj" albo usuń wiersz. */
var SHEET_NAME = 'wyniki';
var HEAD = ['data', 'id', 'nick', 'trudnosc', 'zamek', 'fala', 'hp', 'czas_s', 'punkty', 'ukryj'];
var DIFFS = ['easy', 'normal', 'hard', 'hardcore'];
var CASTLES = ['crown', 'forest', 'guild', 'order'];

function sheet() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sh = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  return sh;
}
function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function whole(v, min, max) {
  return typeof v === 'number' && v === Math.floor(v) && v >= min && v <= max;
}
/* te same zasady co w grze; początkowe = + - @ odpadają, żeby arkusz nie wziął nicku za formułę */
function cleanNick(v) {
  var s = String(v || '').replace(/[<>&"'`=\\\x00-\x1f]/g, '').replace(/^[\s+\-@]+/, '').slice(0, 12);
  return s.replace(/\s+$/, '') || 'Anonim';
}
/* odrzuca wpisy, które nie mogły powstać w grze; nie zatrzyma kogoś, kto celowo wyśle wiarygodne liczby */
function valid(r) {
  return !!r && r.game === 'ostatni-bastion-demo' && typeof r.id === 'string' && /^[a-z0-9-]{8,40}$/.test(r.id) &&
    DIFFS.indexOf(r.diff) >= 0 && CASTLES.indexOf(r.castle) >= 0 &&
    whole(r.wave, 1, 20) && whole(r.hp, 0, 99) && whole(r.score, 0, 40000) && whole(r.time, r.wave * 5, 864000) &&
    (r.hp === 0 || r.wave === 20);        // przegrana to zawsze 0 HP
}

function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 1000) return reply({ ok: false, why: 'zly rozmiar' });
    var r = JSON.parse(e.postData.contents);
    if (!valid(r)) return reply({ ok: false, why: 'zly wpis' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sh = sheet(), n = sh.getLastRow() - 1;
      var ids = n > 0 ? sh.getRange(2, 2, n, 1).getValues() : [];
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === r.id) return reply({ ok: true, again: true });   // ten sam wynik wysłany drugi raz
      /* apostrof: arkusz zapisuje nick jako zwykły tekst */
      sh.appendRow([new Date(), r.id, "'" + cleanNick(r.nick), r.diff, r.castle, r.wave, r.hp, r.time, r.score, '']);
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, why: 'blad' });
  }
}

function doGet() {
  try {
    var sh = sheet(), n = sh.getLastRow() - 1;
    var rows = n > 0 ? sh.getRange(2, 1, n, HEAD.length).getValues() : [];
    var lists = {};
    DIFFS.forEach(function (d) { lists[d] = []; });
    rows.forEach(function (v) {
      if (String(v[9]) !== '' || !lists[v[3]]) return;        // ukryte albo uszkodzone
      lists[v[3]].push({ id: String(v[1]), nick: cleanNick(v[2]), castle: String(v[4]), wave: Number(v[5]), hp: Number(v[6]), time: Number(v[7]), score: Number(v[8]) });
    });
    /* kolejność jak w grze: dalsza fala, więcej HP, krótszy czas */
    DIFFS.forEach(function (d) {
      lists[d] = lists[d].sort(function (a, b) { return b.wave - a.wave || b.hp - a.hp || a.time - b.time; }).slice(0, 10);
    });
    return reply({ ok: true, at: new Date().toISOString(), lists: lists });
  } catch (err) {
    return reply({ ok: false, why: 'blad' });
  }
}
