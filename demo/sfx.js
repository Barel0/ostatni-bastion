/* Dźwięki i wibracje dema. Dźwięki powstają w kodzie (Web Audio), więc nie ma plików ani licencji.
   Każdy dźwięk to przepis z tonów i szumu; można go też wyrenderować offline do testów (SFX.render). */
var SFX = (function () {
  'use strict';
  var ctx = null, master = null, noiseBuf = null, last = {}, recent = [], soundOn = true, vibOn = true;

  function noise(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    var n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0), seed = 22222;
    for (var i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
    return (noiseBuf = b);
  }
  /* obwiednia: szybkie wejście, wybrzmienie do ciszy */
  function env(c, out, t, a, dur, vol) {
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(out);
    return g;
  }
  /* ton: fala type od częstotliwości f do f2 */
  function tone(c, out, t, o) {
    var s = c.createOscillator(), dur = o.dur, g = env(c, out, t, o.a || 0.005, dur, o.vol);
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(o.f, t);
    if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
    if (o.vib) {
      var l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.f * 0.02; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur);
    }
    if (o.lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; s.connect(f); f.connect(g); } else s.connect(g);
    s.start(t); s.stop(t + dur + 0.02);
  }
  /* szum przez filtr: świsty, wybuchy, uderzenia */
  function hiss(c, out, t, o) {
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = env(c, out, t, o.a || 0.003, o.dur, o.vol);
    s.buffer = noise(c); s.loop = true;
    f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    s.connect(f); f.connect(g);
    s.start(t, Math.random() * 0.5); s.stop(t + o.dur + 0.02);
  }
  function notes(c, out, t, list, o) {
    list.forEach(function (n) { tone(c, out, t + n[1], { type: o.type, f: n[0], dur: n[2], vol: o.vol, a: o.a, lp: o.lp, vib: o.vib }); });
  }
  function horn(c, out, t, f, dur, vol) {
    tone(c, out, t, { type: 'sawtooth', f: f, dur: dur, vol: vol, a: 0.07, lp: 900, vib: 5 });
    tone(c, out, t, { type: 'sawtooth', f: f * 1.006, dur: dur, vol: vol * 0.8, a: 0.09, lp: 700 });
    tone(c, out, t, { type: 'triangle', f: f / 2, dur: dur, vol: vol * 0.9, a: 0.05 });
  }
  function drum(c, out, t, vol) {
    tone(c, out, t, { f: 130, f2: 38, dur: 0.32, vol: vol });
    hiss(c, out, t, { type: 'lowpass', f: 500, dur: 0.09, vol: vol * 0.5 });
  }
  function metal(c, out, t, f, dur, vol) {
    [1, 2.76, 5.4, 8.93].forEach(function (m, i) { tone(c, out, t, { type: 'square', f: f * m, dur: dur / (1 + i * 0.5), vol: vol / (2 + i * 1.6), lp: 6000 }); });
    hiss(c, out, t, { type: 'highpass', f: 3500, dur: 0.05, vol: vol * 0.6 });
  }

  /* [id, nazwa, kiedy gra, najkrótszy odstęp w s, przepis] */
  var LIST = [
    ['tap', 'Stuknięcie', 'przyciski i otwarcie panelu wieży', 0.04, function (c, o, t) { tone(c, o, t, { type: 'triangle', f: 880, f2: 620, dur: 0.06, vol: 0.22 }); }],
    ['build', 'Postawienie wieży', 'wieża stoi na polu', 0.1, function (c, o, t) { drum(c, o, t, 0.5); hiss(c, o, t + 0.03, { f: 1400, f2: 500, dur: 0.22, vol: 0.16 }); tone(c, o, t + 0.09, { type: 'triangle', f: 392, dur: 0.18, vol: 0.18 }); }],
    ['bad', 'Błąd', 'nie można tu postawić', 0.2, function (c, o, t) { tone(c, o, t, { type: 'square', f: 170, f2: 140, dur: 0.11, vol: 0.14, lp: 1200 }); tone(c, o, t + 0.13, { type: 'square', f: 130, f2: 105, dur: 0.16, vol: 0.14, lp: 1000 }); }],
    ['upgrade', 'Ulepszenie', 'wybrana karta', 0.1, function (c, o, t) { notes(c, o, t, [[523, 0, 0.18], [659, 0.07, 0.18], [784, 0.14, 0.2], [1047, 0.21, 0.4]], { type: 'triangle', vol: 0.22 }); hiss(c, o, t + 0.2, { type: 'highpass', f: 6000, dur: 0.35, vol: 0.06 }); }],
    ['sell', 'Sprzedaż', 'wieża sprzedana', 0.1, function (c, o, t) { [0, 0.07, 0.13].forEach(function (d, i) { tone(c, o, t + d, { type: 'square', f: 1180 + i * 240, dur: 0.12, vol: 0.09, lp: 5000 }); }); }],
    ['pause', 'Pauza', 'menu po przytrzymaniu przycisku', 0.2, function (c, o, t) { notes(c, o, t, [[660, 0, 0.14], [440, 0.09, 0.22]], { type: 'sine', vol: 0.25 }); }],
    ['resume', 'Wznowienie', 'koniec pauzy', 0.2, function (c, o, t) { notes(c, o, t, [[440, 0, 0.12], [660, 0.08, 0.2]], { type: 'sine', vol: 0.25 }); }],
    ['star', 'Awans zamku', 'czeka nagroda ★', 0.5, function (c, o, t) { notes(c, o, t, [[784, 0, 0.3], [988, 0.1, 0.3], [1319, 0.2, 0.55]], { type: 'sine', vol: 0.2 }); notes(c, o, t, [[1568, 0.22, 0.5]], { type: 'triangle', vol: 0.07 }); }],
    ['wave', 'Róg bojowy', 'start fali (z napisem „FALA x”)', 0.8, function (c, o, t) { horn(c, o, t, 147, 0.55, 0.2); horn(c, o, t + 0.42, 220, 0.9, 0.22); drum(c, o, t, 0.5); drum(c, o, t + 0.42, 0.55); }],
    ['done', 'Fala odparta', 'zielony ptaszek', 0.8, function (c, o, t) { notes(c, o, t, [[523, 0, 0.16], [784, 0.11, 0.16], [1047, 0.22, 0.55]], { type: 'triangle', vol: 0.26 }); notes(c, o, t, [[392, 0.22, 0.55], [659, 0.22, 0.55]], { type: 'sine', vol: 0.14 }); }],
    ['boss', 'Nadchodzi boss', 'boss wchodzi na drogę', 1, function (c, o, t) { drum(c, o, t, 0.75); drum(c, o, t + 0.28, 0.75); drum(c, o, t + 0.56, 0.9); horn(c, o, t + 0.5, 98, 1.2, 0.24); horn(c, o, t + 0.5, 104, 1.2, 0.14); }],
    ['bossdie', 'Boss pokonany', 'boss pada', 0.5, function (c, o, t) { hiss(c, o, t, { type: 'lowpass', f: 1800, f2: 90, dur: 0.9, vol: 0.5 }); tone(c, o, t, { f: 220, f2: 36, dur: 0.8, vol: 0.4 }); notes(c, o, t + 0.35, [[392, 0, 0.2], [523, 0.1, 0.2], [784, 0.2, 0.5]], { type: 'triangle', vol: 0.2 }); }],
    ['die', 'Wróg pada', 'zwykły wróg', 0.07, function (c, o, t) { tone(c, o, t, { f: 420 + Math.random() * 120, f2: 140, dur: 0.1, vol: 0.14 }); hiss(c, o, t, { f: 900, dur: 0.06, vol: 0.07 }); }],
    ['hurt', 'Zamek trafiony', 'wróg doszedł do zamku', 0.18, function (c, o, t) { drum(c, o, t, 0.8); hiss(c, o, t, { type: 'lowpass', f: 1200, f2: 150, dur: 0.4, vol: 0.4 }); tone(c, o, t + 0.02, { type: 'sawtooth', f: 160, f2: 70, dur: 0.35, vol: 0.16, lp: 700 }); }],
    ['arrow', 'Łuk', 'wieża łucznicza', 0.11, function (c, o, t) { hiss(c, o, t, { f: 2600, f2: 900, q: 1.5, dur: 0.09, vol: 0.22 }); tone(c, o, t, { type: 'triangle', f: 330, f2: 180, dur: 0.05, vol: 0.12 }); }],
    ['cannon', 'Armata', 'Bombarda', 0.16, function (c, o, t) { tone(c, o, t, { f: 110, f2: 42, dur: 0.26, vol: 0.42 }); hiss(c, o, t, { type: 'lowpass', f: 1500, f2: 200, dur: 0.22, vol: 0.26 }); }],
    ['catapult', 'Katapulta', 'Trebusz', 0.2, function (c, o, t) { tone(c, o, t, { type: 'sawtooth', f: 95, f2: 190, dur: 0.12, vol: 0.26, lp: 600 }); hiss(c, o, t + 0.08, { f: 500, f2: 1400, q: 1, dur: 0.3, a: 0.1, vol: 0.32 }); }],
    ['snipe', 'Strzał z Czatowni', 'mocny pojedynczy strzał', 0.16, function (c, o, t) { hiss(c, o, t, { type: 'highpass', f: 2200, dur: 0.07, vol: 0.3 }); tone(c, o, t, { f: 240, f2: 70, dur: 0.14, vol: 0.2 }); }],
    ['hammer', 'Młot', 'Kuźnia', 0.14, function (c, o, t) { metal(c, o, t, 420, 0.22, 0.2); tone(c, o, t, { f: 120, f2: 55, dur: 0.12, vol: 0.24 }); }],
    ['windmill', 'Skrzydła', 'Wiatrak', 0.35, function (c, o, t) { hiss(c, o, t, { f: 300, f2: 900, q: 0.8, dur: 0.28, a: 0.12, vol: 0.45 }); }],
    ['saw', 'Piła', 'Tartak', 0.25, function (c, o, t) { tone(c, o, t, { type: 'sawtooth', f: 520, f2: 430, dur: 0.24, vol: 0.13, lp: 2400, vib: 34 }); hiss(c, o, t, { f: 3200, q: 2, dur: 0.22, vol: 0.14 }); }],
    ['keg', 'Beczka', 'Karczma toczy beczkę', 0.2, function (c, o, t) { [0, 0.07, 0.15].forEach(function (d) { tone(c, o, t + d, { type: 'triangle', f: 150, f2: 100, dur: 0.07, vol: 0.18 }); }); }],
    ['boom', 'Wybuch', 'pociski obszarowe i beczki', 0.14, function (c, o, t) { hiss(c, o, t, { type: 'lowpass', f: 2200, f2: 160, dur: 0.38, vol: 0.34 }); tone(c, o, t, { f: 90, f2: 35, dur: 0.3, vol: 0.3 }); }],
    ['spear', 'Włócznie bramy', 'Brama Królewska', 0.22, function (c, o, t) { hiss(c, o, t, { f: 3400, f2: 1500, q: 1.6, dur: 0.1, vol: 0.26 }); metal(c, o, t + 0.04, 900, 0.1, 0.12); }],
    ['grate', 'Krata', 'opadająca krata', 0.8, function (c, o, t) { hiss(c, o, t, { f: 900, f2: 2600, q: 4, dur: 0.16, vol: 0.18 }); metal(c, o, t + 0.15, 190, 0.7, 0.34); drum(c, o, t + 0.15, 0.55); }],
    ['volley', 'Salwa łuczników', 'Brama Strzelców', 0.3, function (c, o, t) { [0, 0.03, 0.065, 0.1].forEach(function (d) { hiss(c, o, t + d, { f: 2400 + Math.random() * 900, f2: 900, q: 1.4, dur: 0.1, vol: 0.3 }); }); }],
    ['coin', 'Myto', 'Rogatka bierze opłatę', 0.12, function (c, o, t) { tone(c, o, t, { type: 'square', f: 988, dur: 0.07, vol: 0.09, lp: 6000 }); tone(c, o, t + 0.07, { type: 'square', f: 1319, dur: 0.2, vol: 0.09, lp: 6000 }); }],
    ['sack', 'Sakwy', 'strażnicy Rogatki', 0.3, function (c, o, t) { tone(c, o, t, { f: 180, f2: 80, dur: 0.1, vol: 0.2 }); hiss(c, o, t, { type: 'highpass', f: 5000, dur: 0.07, vol: 0.07 }); }],
    ['zap', 'Piorun', 'Brama Burzy', 0.3, function (c, o, t) { hiss(c, o, t, { type: 'highpass', f: 1800, dur: 0.12, vol: 0.18 }); tone(c, o, t, { type: 'sawtooth', f: 1500, f2: 110, dur: 0.14, vol: 0.09 }); hiss(c, o, t + 0.06, { f: 600, f2: 200, dur: 0.16, vol: 0.12 }); }],
    ['skill', 'Umiejętność zamku', 'trzy przyciski po lewej', 0.3, function (c, o, t) { hiss(c, o, t, { f: 300, f2: 3200, q: 1.4, dur: 0.4, a: 0.18, vol: 0.2 }); notes(c, o, t + 0.12, [[587, 0, 0.35], [880, 0.08, 0.4]], { type: 'triangle', vol: 0.18 }); }],
    ['heal', 'Leczenie', '+2 HP po bossie w Hardcore', 0.5, function (c, o, t) { notes(c, o, t, [[659, 0, 0.4], [831, 0.12, 0.4], [988, 0.24, 0.6]], { type: 'sine', vol: 0.22 }); }],
    ['win', 'Wygrana', 'bastion obroniony', 1, function (c, o, t) { [[262, 0], [330, 0.18], [392, 0.36], [523, 0.54]].forEach(function (n, i) { horn(c, o, t + n[1], n[0], i === 3 ? 1.3 : 0.3, 0.2); }); drum(c, o, t, 0.5); drum(c, o, t + 0.54, 0.7); }],
    ['lose', 'Porażka', 'zamek padł', 1, function (c, o, t) { [[220, 0], [196, 0.36], [175, 0.72], [117, 1.08]].forEach(function (n, i) { horn(c, o, t + n[1], n[0], i === 3 ? 1.4 : 0.42, 0.2); }); drum(c, o, t + 1.08, 0.8); }]
  ];
  var BY = {};
  LIST.forEach(function (d) { BY[d[0]] = d; });

  /* Przeglądarka i aplikacja pozwalają włączyć dźwięk dopiero po dotknięciu ekranu. */
  function unlock() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      var comp = ctx.createDynamicsCompressor();                    // wiele dźwięków naraz nie może trzeszczeć
      comp.threshold.value = -14; comp.ratio.value = 8; comp.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0.7; master.connect(comp);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function play(id) {
    var d = BY[id];
    if (!d || !soundOn || !ctx || ctx.state !== 'running') return false;
    var t = ctx.currentTime;
    if (last[id] !== undefined && t - last[id] < d[3]) return false;
    recent = recent.filter(function (x) { return t - x < 0.12; });
    if (recent.length >= 7) return false;                            // przy dużej bitwie pomijamy nadmiar
    last[id] = t; recent.push(t);
    d[4](ctx, master, t + 0.005);
    return true;
  }
  function render(id, c, out, t) { BY[id][4](c, out, t || 0); }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }

  /* Wibracje (ms; tablica to wzór: wibracja, przerwa, wibracja…). W aplikacji obsługuje je Android, w przeglądarce navigator.vibrate. */
  var BUZZ = {
    pick: [12], build: [25], bad: [30, 40, 30], upgrade: [15, 30, 35], sell: [20], pause: [30], wave: [45], done: [20, 60, 20, 60, 40],
    hurt: [70], boss: [80, 70, 130], win: [40, 60, 40, 60, 160], lose: [220, 90, 220]
  };
  var lastBuzz = 0;
  function buzz(kind) {
    var p = BUZZ[kind];
    if (!p || !vibOn) return false;
    var now = Date.now();
    if (kind === 'hurt' && now - lastBuzz < 350) return false;
    lastBuzz = now;
    try {
      if (window.BibApp && window.BibApp.vibrate) window.BibApp.vibrate(p.join(','));
      else if (navigator.vibrate) navigator.vibrate(p);
    } catch (e) { return false; }
    return true;
  }

  return {
    list: LIST.map(function (d) { return { id: d[0], n: d[1], d: d[2] }; }), buzzKinds: BUZZ,
    unlock: unlock, play: play, render: render, suspend: suspend, buzz: buzz,
    set: function (s, v) { soundOn = !!s; vibOn = !!v; }
  };
})();
if (typeof module !== 'undefined') module.exports = SFX;
