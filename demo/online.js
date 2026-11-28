/* Publiczny ranking: wysyłanie i pobieranie wyników. Serwer to tools/ranking-apps-script.js w arkuszu autora.
   Bez zgody gracza nic nie jest wysyłane (o zgodzie decyduje ui.js). Wszystko, co przychodzi z sieci, jest czyszczone. */
var ONLINE = (function () {
  'use strict';
  var URL = 'https://script.google.com/macros/s/AKfycbzngbD_XGzJPH02Abr0oJIbzsRdmFxOeiraFAy1B6Hgz3efx4j2BBa5AEvdJ1vWgWzuzw/exec';
  var OUTBOX = 'bib-demo2-outbox', CACHE = 'bib-demo2-public', MAX_QUEUE = 30, WAIT = 15000, NICK_MAX = 12;
  var DIFFS = ['easy', 'normal', 'hard', 'hardcore'], CASTLES = ['crown', 'forest', 'guild', 'order'];
  var sending = null;

  function read(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v || fallback; } catch (e) { return fallback; } }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { } }

  /* nick trafia do HTML i do arkusza: bez znaków specjalnych i bez początku, który arkusz uznałby za formułę */
  function cleanNick(v) { return String(v || '').replace(/[<>&"'`=\\\x00-\x1f]/g, '').replace(/^[\s+\-@]+/, '').slice(0, NICK_MAX); }
  function newId() { return 'r-' + Date.now().toString(36) + '-' + (Math.random().toString(36) + '00000000').slice(2, 10); }

  /* zapytanie z limitem czasu; odpowiedź musi być obiektem JSON */
  function request(options) {
    if (!window.fetch) return Promise.reject(new Error('brak fetch'));
    options.credentials = 'omit';
    options.referrerPolicy = 'no-referrer';
    options.cache = 'no-store';
    var timer, stop = window.AbortController ? new AbortController() : null;
    if (stop) options.signal = stop.signal;
    var late = new Promise(function (ok, fail) { timer = setTimeout(function () { if (stop) stop.abort(); fail(new Error('za długo')); }, WAIT); });
    var call = window.fetch(URL, options).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    return Promise.race([call, late]).then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function queue() { var q = read(OUTBOX, []); return Array.isArray(q) ? q : []; }
  function drop(id) { write(OUTBOX, queue().filter(function (r) { return r.id !== id; })); }
  function clear() { write(OUTBOX, []); }
  function add(record) { var q = queue(); q.push(record); write(OUTBOX, q.slice(-MAX_QUEUE)); }

  /* Wysyła kolejkę po jednym wpisie. Bez sieci wpisy zostają na później; serwer sam pomija powtórki (po id).
     „type text/plain” to zwykłe zapytanie, którego Apps Script nie wymaga wstępnie potwierdzać. */
  function flush() {
    if (sending) return sending;
    function next() {
      var first = queue()[0];
      if (!first) return Promise.resolve();
      return request({ method: 'POST', body: JSON.stringify(first), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }).then(function (d) {
        if (d && (d.ok === true || d.why === 'zly wpis' || d.why === 'zly rozmiar')) { drop(first.id); return next(); }   // przyjęty albo nie do przyjęcia
      });
    }
    var done = function () { sending = null; };
    sending = next().then(done, done);
    return sending;
  }

  function whole(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && v === Math.floor(v); }
  /* z odpowiedzi zostaje tylko to, co ma poprawny kształt; najwyżej 10 wpisów na trudność */
  function clean(lists) {
    var out = {};
    DIFFS.forEach(function (d) {
      var list = lists && Array.isArray(lists[d]) ? lists[d] : [];
      out[d] = list.filter(function (e) {
        return !!e && CASTLES.indexOf(e.castle) >= 0 && whole(e.wave) && e.wave >= 1 && e.wave <= 20 && whole(e.hp) && e.hp <= 99 && whole(e.time) && whole(e.score) && e.score <= 99999;
      }).slice(0, 10).map(function (e) {
        return { id: String(e.id).slice(0, 40), nick: cleanNick(e.nick) || 'Anonim', castle: e.castle, wave: e.wave, hp: e.hp, time: e.time, score: e.score };
      });
    });
    return out;
  }
  /* ostatnio pobrana lista (zostaje na czas bez internetu) */
  function cached() {
    var c = read(CACHE, null);
    return c && c.lists ? { at: +c.at || 0, lists: clean(c.lists) } : null;
  }
  function load() {
    return request({ method: 'GET' }).then(function (d) {
      if (!d || d.ok !== true || !d.lists) throw new Error('zła odpowiedź');
      var c = { at: Date.now(), lists: clean(d.lists) };
      write(CACHE, c);
      return c;
    });
  }

  return { cleanNick: cleanNick, newId: newId, add: add, flush: flush, clear: clear, queue: queue, cached: cached, load: load, clean: clean, NICK_MAX: NICK_MAX };
})();
