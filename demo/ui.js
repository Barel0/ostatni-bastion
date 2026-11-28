/* Rysowanie i sterowanie demo. Cała logika gry jest w game.js. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var stageEl = $('stage'), world = $('world'), cv = $('cv'), ctx = cv.getContext('2d'), topCv = $('top'), tctx = topCv.getContext('2d');
  var CW = 80, TOP = 62, W = 16 * CW, H = TOP + 9 * CW + 8, SPR = CW / 120, FOOT = 17;
  var LIFT = 52, HOLD = 2, TAP = 0.4;
  var K = 1;                       // piksele urządzenia na piksel logiczny planszy
  /* układ w jednostkach sceny; k = ile jednostek sceny ma 1 jednostka planszy; ox, oy, ew, eh = płótno poza planszą (jednostki planszy) */
  var L = { s: 1, w: 915, h: 412, x: 0, y: 0, bx: 123, by: 0, bw: 668, bh: 412, zoom: 1.37, k: 0.52, ox: 236, oy: 0, ew: 1753, eh: 790 };
  var pages = [], outlineCache = {}, ground = null, deco = [];
  var sel = null, buildType = null, hover = null, drag = null, finger = null, pan = 0, wasPlacing = false;
  var speed = 1, clock = 0, modal = null, ghostUntil = 0, drawerOpen = false;
  var w2 = { state: 'idle', since: 0 };                 // idle | hold | open
  var u5 = { view: 'orbs', info: false, sure: false }, baseDirty = true;
  var pick = { faction: null, diff: 'normal' };
  var SAVE = 'bib-demo2-save', LAST = 'bib-demo2-last', PICK = 'bib-demo2-pick', SET = 'bib-demo2-set';
  var cfg = { sound: true, vib: true, nick: '', share: null };     // share: null = jeszcze nie pytaliśmy o publiczny ranking
  var APP = !!window.BibApp;      // w aplikacji na Androida działa mostek do systemu
  var DOOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 3H4v18h7 M10 12h11 M17 8l4 4-4 4"/></svg>';
  function say(id, buzz) { SFX.play(id); if (buzz) SFX.buzz(buzz === true ? id : buzz); }
  var awake = null;
  /* ekran nie gaśnie w trakcie gry; w menu wraca zwykłe wygaszanie */
  function keepAwake(on) {
    if (on === awake) return;
    awake = on;
    try {
      if (APP) window.BibApp.keepAwake(on);
      else if (navigator.wakeLock) {
        if (on) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () { awake = null; });
        else if (wakeLock) { wakeLock.release(); wakeLock = null; }
      }
    } catch (e) { }
  }
  var wakeLock = null;
  var S = function () { return GAME.S; };

  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }
  function fetchStore(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sx(c) { return c * CW + CW / 2; }
  function sy(r) { return TOP + r * CW + CW / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function now() { return (window.performance ? performance.now() : Date.now()) / 1000; }

  /* ---------- obrazki ---------- */
  function loadAssets(done) {
    var left = ASSETS.pages.length;
    ASSETS.pages.forEach(function (uri, i) {
      var im = new Image();
      im.onload = im.onerror = function () { if (--left === 0) done(); };
      im.src = uri;
      pages[i] = im;
    });
  }
  /* rysuje sprite tak, żeby punkt podstawy modelu znalazł się w (x, y) */
  function sprite(g, name, x, y, scale, flip) {
    var s = ASSETS.s[name];
    if (!s) return;
    var k = SPR * (scale || 1);
    if (flip) {
      g.save(); g.translate(x, y); g.scale(-1, 1);
      g.drawImage(pages[s[0]], s[1], s[2], s[3], s[4], -s[5] * k, -s[6] * k, s[3] * k, s[4] * k);
      g.restore();
    } else g.drawImage(pages[s[0]], s[1], s[2], s[3], s[4], x - s[5] * k, y - s[6] * k, s[3] * k, s[4] * k);
  }
  function thumb(canvas, name) {
    var s = ASSETS.s[name], g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!s) return;
    var k = Math.min(canvas.width / s[3], canvas.height / s[4]);
    g.drawImage(pages[s[0]], s[1], s[2], s[3], s[4], (canvas.width - s[3] * k) / 2, (canvas.height - s[4] * k) / 2, s[3] * k, s[4] * k);
  }
  /* Obramówka: czarna bez ulepszeń; potem kolor ścieżki (I cienka, II-III gruba, IV gruba z poświatą). */
  function outlined(name, col, wCol, wBlack, glow) {
    var key = name + '|' + col + '|' + wCol + '|' + wBlack + '|' + glow;
    if (outlineCache[key]) return outlineCache[key];
    var s = ASSETS.s[name], k = SPR * K, pad = Math.ceil((wCol + wBlack + (glow ? 14 : 2)) * K);
    var w = Math.ceil(s[3] * k) + pad * 2, h = Math.ceil(s[4] * k) + pad * 2;
    function grown(radius, color) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var g = c.getContext('2d');
      for (var a = 0; a < 20; a++) {
        var an = a / 20 * Math.PI * 2;
        g.drawImage(pages[s[0]], s[1], s[2], s[3], s[4], pad + Math.cos(an) * radius * K, pad + Math.sin(an) * radius * K, s[3] * k, s[4] * k);
      }
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      return c;
    }
    var out = document.createElement('canvas'); out.width = w; out.height = h;
    var o = out.getContext('2d');
    if (glow) {
      var halo = grown(wCol + 1, col);
      o.shadowColor = col; o.shadowBlur = 16 * K;
      o.drawImage(halo, 0, 0); o.drawImage(halo, 0, 0);
      o.shadowBlur = 0;
    }
    o.drawImage(grown(wCol + wBlack, '#0a0a0c'), 0, 0);
    if (wCol) o.drawImage(grown(wCol, col), 0, 0);
    o.drawImage(pages[s[0]], s[1], s[2], s[3], s[4], pad, pad, s[3] * k, s[4] * k);
    return (outlineCache[key] = { c: out, ax: s[5] * k + pad, ay: s[6] * k + pad });
  }
  function drawOutlined(g, o, x, y, bump) {
    bump = bump || 1;
    g.drawImage(o.c, x - o.ax / K * bump, y - o.ay / K * bump, o.c.width / K * bump, o.c.height / K * bump);
  }
  function towerSprite(t) { return 't_' + S().f.id + '_' + t.type; }
  function gateSprite(t) { return 'gate_' + S().f.id + '_' + t.o + (S().f.id === 'crown' && t.grateT > 0 ? '_down' : ''); }
  /* złote koła pod filarami bramy */
  function gateRings(g, t) {
    GAME.footprint(t).forEach(function (p) {
      g.fillStyle = 'rgba(255,196,40,.92)'; ellipse(g, sx(p[0]), sy(p[1]) + 20, 40, 24); g.fill();
      g.fillStyle = '#3a3222'; ellipse(g, sx(p[0]), sy(p[1]) + 20, 31, 18); g.fill();
    });
  }
  function stormCurtain(g, t) {
    var x = sx(t.c), y = sy(t.r) + 22, busy = S().enemies.some(function (e) { return Math.abs(e.d - t.k) <= 2.5; });
    g.lineJoin = 'round';
    for (var i = 0; i < 5; i++) {
      if (!busy && (Math.floor(clock * 6) + i) % 3) continue;
      var u = -36 + i * 18, x0 = t.o === 'v' ? x + u : x + Math.sin(clock * 9 + i) * 6, y0 = t.o === 'v' ? y - 78 : y - 82 + u * 0.8;
      g.beginPath(); g.moveTo(x0, y0);
      for (var s = 1; s < 6; s++) g.lineTo(x0 + Math.sin(clock * 23 + i * 7 + s * 5) * 11, y0 + s * 15);
      g.globalAlpha = busy ? 0.95 : 0.5;
      g.strokeStyle = '#ffe23f'; g.lineWidth = 4.5; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.stroke();
      g.globalAlpha = 1;
    }
  }
  function drawGate(g, t, alpha) {
    if (alpha !== undefined) g.globalAlpha = alpha;
    drawOutlined(g, outlined(gateSprite(t), '#000000', 0, 3.2, false), sx(t.c), sy(t.r) + 22);
    g.globalAlpha = 1;
    if (S().f.leg.atk === 'storm' && alpha === undefined) stormCurtain(g, t);
  }
  function drawTower(g, t, x, y, alpha) {
    var o, name = towerSprite(t);
    if (!t.level) o = outlined(name, '#000000', 0, 2.8, false);
    else o = outlined(name, DATA.PATHS[t.path].col, t.level === 1 ? 2.4 : 4.6, 1.3, t.level === 4);
    if (alpha !== undefined) g.globalAlpha = alpha;
    drawOutlined(g, o, x, y, t.anim > 0 ? 1.04 : 1);
    g.globalAlpha = 1;
  }

  /* ---------- tło ---------- */
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  /* ext = obszar do zamalowania w jednostkach planszy (domyślnie sama plansza); poza planszą ciągnie się ta sama łąka i droga */
  function paintGround(g, th, cells, seed, ext) {
    ext = ext || { x0: 0, y0: 0, x1: W, y1: H };
    function rnd() { seed = (seed * 16807 + 7) % 2147483647; return (seed & 0xffff) / 0x10000; }
    g.fillStyle = th.ground[0]; g.fillRect(ext.x0, ext.y0, ext.x1 - ext.x0, ext.y1 - ext.y0);
    for (var c = Math.floor(ext.x0 / CW); c < Math.ceil(ext.x1 / CW); c++) for (var r = Math.floor((ext.y0 - TOP) / CW); r < Math.ceil((ext.y1 - TOP) / CW); r++) {
      g.fillStyle = th.ground[((c + r) % 2 + 2) % 2]; g.fillRect(c * CW, TOP + r * CW, CW, CW);
      g.fillStyle = 'rgba(255,255,255,' + (rnd() * 0.035) + ')'; g.fillRect(c * CW, TOP + r * CW, CW, CW);
    }
    function stroke(width, color, dash) {
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'butt'; g.setLineDash(dash || []);
      g.beginPath();
      cells.forEach(function (p, i) { var x = sx(p[0]), y = sy(p[1]); if (!i) g.moveTo(Math.min(x - CW, ext.x0 - CW), y); g.lineTo(x, y); });
      var end = cells[cells.length - 1];
      g.lineTo(sx(end[0] + 0.75), sy(end[1]));          // dojście do bramy zamku
      g.stroke(); g.setLineDash([]);
    }
    stroke(CW * 0.94, th.edge);
    stroke(CW * 0.8, th.road);
    if (th.dashes) stroke(4, '#ffd23f', [18, 18]);
    else for (var i = 0; i < 260; i++) {
      var p = cells[1 + (rnd() * (cells.length - 1) | 0)];
      g.fillStyle = 'rgba(0,0,0,.12)'; ellipse(g, sx(p[0]) + (rnd() - 0.5) * 54, sy(p[1]) + (rnd() - 0.5) * 54, 2 + rnd() * 3, 1.5 + rnd() * 2); g.fill();
    }
    return rnd;
  }
  function buildGround() {
    var s = S(), th = s.theme;
    ground = document.createElement('canvas'); ground.width = cv.width; ground.height = cv.height;
    var g = ground.getContext('2d'); g.setTransform(K, 0, 0, K, L.ox * K, L.oy * K);
    var ext = { x0: -L.ox, y0: -L.oy, x1: L.ew - L.ox, y1: L.eh - L.oy };
    var rnd = paintGround(g, th, s.road.cells, s.seed, ext);
    /* ozdoby na łące poza planszą (nie da się tam budować); omijają drogę wchodzącą z lewej */
    var around = [], roadRow = s.road.cells[0][1];
    for (var ac = Math.floor(ext.x0 / CW); ac < Math.ceil(ext.x1 / CW); ac++) for (var ar = Math.floor((ext.y0 - TOP) / CW); ar < Math.ceil((ext.y1 - TOP) / CW); ar++) {
      if (ac >= 0 && ac < 16 && ar >= 0 && ar < 9) continue;
      if (ac < 0 && Math.abs(ar - roadRow) < 1) continue;
      if (rnd() < 0.22) around.push({ name: 'd_' + th.id + '_' + (rnd() * 6 | 0), x: sx(ac) + (rnd() - 0.5) * 24, y: sy(ar) + 22 + (rnd() - 0.5) * 14, k: 0.62 + rnd() * 0.18 });
    }
    around.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { sprite(g, o.name, o.x, o.y, o.k); });
    Object.keys(s.fields).forEach(function (key) {
      var q = key.split(','), cx = sx(+q[0]), cy = sy(+q[1]), fl = DATA.FIELDS[s.fields[key]];
      if (s.fields[key] === 'rock') {
        sprite(g, 'd_meadow_5', cx - 6, cy + 16, 0.95); sprite(g, 'd_meadow_4', cx + 18, cy + 24, 0.7);
      } else {
        g.fillStyle = fl.col + '40'; g.strokeStyle = fl.col; g.lineWidth = 3; rr(g, cx - 33, cy - 33, 66, 66, 12); g.fill(); g.stroke();
        g.fillStyle = fl.col; g.font = '700 28px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fl.ico, cx, cy + 2);
      }
    });
    /* dekoracje tylko na polach daleko od drogi, żeby nie myliły się z wieżami */
    deco = [];
    for (var c = 0; c < 16; c++) for (var r = 0; r < 9; r++) {
      if (s.road.set[c + ',' + r] || s.fields[c + ',' + r]) continue;
      if (s.road.castle.some(function (z) { return z[0] === c && z[1] === r; })) continue;
      var far = !s.road.cells.some(function (z) { return Math.abs(z[0] - c) <= 1 && Math.abs(z[1] - r) <= 1; });
      if (far && rnd() < 0.42) deco.push({ c: c, r: r, name: 'd_' + th.id + '_' + (rnd() * 6 | 0), x: sx(c) + (rnd() - 0.5) * 20, y: sy(r) + 20 + (rnd() - 0.5) * 12, k: 0.62 + rnd() * 0.18 });
    }
  }

  /* ---------- układ sceny ---------- */
  function layout() {
    var p = getComputedStyle($('probe'));
    var il = parseFloat(p.paddingLeft) || 0, ir = parseFloat(p.paddingRight) || 0, it = parseFloat(p.paddingTop) || 0, ib = parseFloat(p.paddingBottom) || 0;
    var vw = window.innerWidth - il - ir, vh = window.innerHeight - it - ib;
    if (!(vw > 0 && vh > 0)) return;
    var s = Math.min(vw / 915, vh / 412);
    L.s = s; L.w = vw / s; L.h = vh / s; L.x = il; L.y = it;
    stageEl.style.width = L.w + 'px'; stageEl.style.height = L.h + 'px';
    stageEl.style.transform = 'translate(' + il + 'px,' + it + 'px) scale(' + s + ')';
    L.bw = Math.min(L.w - 120, L.h * W / H); L.bh = L.bw * H / W;
    L.bx = (L.w - L.bw) / 2; L.by = (L.h - L.bh) / 2;
    L.zoom = clamp(L.w / L.bw, 1, 1.8);
    L.k = L.bw / W; L.ox = L.bx / L.k; L.oy = L.by / L.k; L.ew = L.w / L.k; L.eh = L.h / L.k;
    world.style.width = L.w + 'px'; world.style.height = L.h + 'px';
    /* rozdzielczość płótna dobrana do przybliżenia przy stawianiu */
    var nk = clamp(L.k * L.zoom * s * (window.devicePixelRatio || 1), 0.5, 1.5);
    var cw = Math.round(L.ew * nk), ch = Math.round(L.eh * nk);
    if (Math.abs(nk - K) > 0.01 || cv.width !== cw || cv.height !== ch) {
      K = nk;
      cv.width = topCv.width = cw; cv.height = topCv.height = ch;
      outlineCache = {};
      baseDirty = true;
      if (S()) buildGround();
    }
    paintGlow();
    if (sel) renderU5();
  }
  function toStage(clientX, clientY) {
    var b = stageEl.getBoundingClientRect();
    return { x: (clientX - b.left) / b.width * L.w, y: (clientY - b.top) / b.height * L.h };
  }
  /* Podgląd wieży jest nad palcem; przy dolnej krawędzi przesunięcie maleje, żeby dało się trafić w dolny rząd. */
  function liftAt(y) { return LIFT * clamp((L.h - y) / 120, 0, 1); }
  function cellAt(clientX, clientY, lift) {
    var p = toStage(clientX, clientY);
    if (lift) clientY -= liftAt(p.y) * L.s;
    var b = cv.getBoundingClientRect();
    var x = (clientX - b.left) / b.width * L.ew - L.ox, y = (clientY - b.top) / b.height * L.eh - L.oy;
    if (x < 0 || x >= W || y < 0 || y >= H + 20) return null;
    return { c: Math.floor(x / CW), r: clamp(Math.floor((y - TOP) / CW), 0, 8) };
  }

  /* ---------- tryb stawiania: plansza na cały ekran, przesuwana za palcem ---------- */
  function isPlacing() { return !!(S() && (buildType || (drag && drag.moved))); }
  function panMax() { return Math.max(0, L.bh * L.zoom - L.h); }
  function applyWorld(placing) {
    if (!placing) { world.style.transform = 'none'; return; }
    var z = L.zoom, nw = L.bw * z, nh = L.bh * z;
    var left = (L.w - nw) / 2, top = nh <= L.h ? (L.h - nh) / 2 : -pan;
    world.style.transform = 'translate(' + (left - L.bx * z) + 'px,' + (top - L.by * z) + 'px) scale(' + z + ')';
  }
  function overCancel(p) { return !!p && p.x < 206 && p.y < 44; }
  function updatePlacing(dt) {
    var placing = isPlacing();
    if (placing !== wasPlacing) {
      wasPlacing = placing;
      stageEl.classList.toggle('placing', placing);
      if (!placing) { pan = 0; world.classList.remove('live'); }
      applyWorld(placing);
    }
    stageEl.classList.toggle('tapmode', !!buildType && !(drag && drag.moved && !drag.place));
    if (!placing) return;
    if (drag && drag.moved && finger) {
      var v = 0;
      if (finger.y > L.h - 96) v = (finger.y - (L.h - 96)) / 96;
      else if (finger.y < 96 && finger.x < L.w - 155) v = -(96 - finger.y) / 96;
      if (v) {
        pan = clamp(pan + v * 190 * dt, 0, panMax());
        world.classList.add('live');
        applyWorld(true);
        hover = overCancel(finger) ? null : cellAt(finger.cx, finger.cy, drag.touch);
      }
    }
    var type = drag && drag.moved ? (drag.tower ? drag.tower.type : drag.type) : buildType;
    if (!type) return;
    var txt = tName(type);
    if (!(drag && drag.tower)) txt += ' · ' + GAME.cost(type) + ' zł · ' + GAME.count(type) + '/' + (type === 'legend' ? 1 : 3);
    if (type === 'legend') txt += ' · nad prostą drogą';
    setText('chip', txt);
    var c = $('cancel');
    c.classList.toggle('hot', !!(drag && drag.moved) && overCancel(finger));
    setText('cancel', drag && drag.moved ? '✕ puść tu, żeby anulować' : '✕ anuluj budowę');
  }

  /* ---------- rysowanie ---------- */
  function drawCover(g, c, r, range, min, color) {
    GAME.coveredCells(c, r, range).forEach(function (p) {
      if (Math.hypot(p[0] - c, p[1] - r) < (min || 0)) return;
      g.fillStyle = color; rr(g, sx(p[0]) - 34, sy(p[1]) - 34, 68, 68, 10); g.fill();
    });
  }
  function drawZone(g, t) {
    GAME.zoneCells(t.k).forEach(function (p) {
      var under = p[0] === t.c && p[1] === t.r;
      g.fillStyle = under ? 'rgba(255,225,90,.5)' : 'rgba(255,225,90,.32)'; g.strokeStyle = 'rgba(255,236,130,.95)'; g.lineWidth = 3;
      rr(g, sx(p[0]) - 34, sy(p[1]) - 34, 68, 68, 10); g.fill(); g.stroke();
    });
  }
  function drawRange(g, t) {
    var s = S(), st = GAME.stats(t), x = sx(t.c), y = sy(t.r), R = (st.range + 0.05) * CW;
    if (t.type === 'legend') drawZone(g, t);
    else {
      drawCover(g, t.c, t.r, st.range, st.min, 'rgba(255,225,90,.34)');
      g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 3; g.fillStyle = 'rgba(255,255,255,.07)';
      ellipse(g, x, y, R, R); g.fill(); g.stroke();
      if (st.min) { g.setLineDash([10, 8]); g.strokeStyle = '#ff8a7a'; ellipse(g, x, y, st.min * CW, st.min * CW); g.stroke(); g.setLineDash([]); }
    }
    /* premie z sąsiedztwa: różne ścieżki obok i załoga Rogatki */
    var mine = GAME.footprint(t);
    s.towers.forEach(function (o) {
      if (o === t || o.id === t.id) return;
      var other = GAME.footprint(o), pair = null;
      mine.forEach(function (a) { other.forEach(function (b) { if (!pair && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1) pair = [a, b]; }); });
      if (!pair) return;
      var toll = s.f.leg.atk === 'toll' && (t.type === 'legend' || o.type === 'legend');
      if (!toll && !(o.path && o.path !== t.path)) return;
      g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.beginPath(); g.moveTo(sx(pair[0][0]), sy(pair[0][1]) + 12); g.lineTo(sx(pair[1][0]), sy(pair[1][1]) + 12); g.stroke();
    });
  }

  function bar(g, x, y, w, frac, col) {
    g.fillStyle = '#12100e'; g.fillRect(x - w / 2 - 2, y - 2, w + 4, 9);
    g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 5);
  }
  function drawEnemy(g, e) {
    var x = sx(e.x), y = sy(e.y) + FOOT, big = e.boss ? 1 : 0;
    var sh = (e.r + 0.08) * CW;
    g.fillStyle = 'rgba(0,0,0,.17)'; ellipse(g, x, y, sh * 0.8, sh * 0.34); g.fill();
    if (e.slowT > 0) { g.strokeStyle = '#8fd8ff'; g.lineWidth = 4; ellipse(g, x, y, sh + 3, sh * 0.55 + 2); g.stroke(); }
    if (e.poisonT > 0) { g.fillStyle = 'rgba(120,230,70,.45)'; ellipse(g, x, y, sh * 0.8, sh * 0.4); g.fill(); }
    if (e.heal) { g.strokeStyle = 'rgba(120,255,150,.45)'; g.lineWidth = 2; ellipse(g, x, y, 1.35 * CW, 1.35 * CW * 0.7); g.stroke(); }
    var name = 'e_' + S().ef.id + '_' + e.si + '_' + e.dir + '_' + (Math.floor(e.walk) % 6);
    if (e.inv > 0) g.globalAlpha = 0.55;
    sprite(g, name, x, y, 1, e.flip);
    g.globalAlpha = 1;
    var s = ASSETS.s[name], hgt = s ? s[6] * SPR : 60;
    if (e.burn.length) for (var i = 0; i < 3; i++) {
      var ph = (clock * 2.4 + i / 3 + e.eid * 0.13) % 1;
      g.fillStyle = 'rgba(255,' + (120 + i * 40) + ',30,' + (1 - ph) + ')'; ellipse(g, x - 12 + i * 12, y - hgt * 0.35 - ph * 28, 5 - ph * 3, 8 - ph * 4); g.fill();
    }
    if (e.stunT > 0) { g.fillStyle = '#ffe96a'; g.font = '700 18px system-ui'; g.textAlign = 'center'; g.fillText('✶ ✶', x, y - hgt - 14); }
    var bw = big ? 90 : Math.max(30, e.r * CW * 1.7), by = y - hgt - (big ? 12 : 6);
    bar(g, x, by, bw, e.hp / e.max, '#ff4a3d');
    if (e.sh > 0) bar(g, x, by - 8, bw, e.sh / e.shMax, '#6ec8ff');
    if (e.mark) { g.fillStyle = '#b6f08a'; g.strokeStyle = '#123008'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + bw / 2 + 9, by - 6); g.lineTo(x + bw / 2 + 15, by + 3); g.lineTo(x + bw / 2 + 3, by + 3); g.closePath(); g.fill(); g.stroke(); }
    if (big) { g.font = '800 15px system-ui'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(e.name, x, by - 14); g.fillStyle = '#ffd0c8'; g.fillText(e.name, x, by - 14); }
  }
  function drawKeg(g, k) {
    var x = sx(k.x), y = sy(k.y) + 8;
    g.fillStyle = 'rgba(0,0,0,.25)'; ellipse(g, x, y + 10, 14, 6); g.fill();
    g.fillStyle = '#8a5a2b'; g.strokeStyle = '#1c120a'; g.lineWidth = 3; rr(g, x - 11, y - 12, 22, 24, 7); g.fill(); g.stroke();
    g.strokeStyle = '#c9ced4'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 10, y - 5); g.lineTo(x + 10, y - 5); g.moveTo(x - 10, y + 5); g.lineTo(x + 10, y + 5); g.stroke();
  }
  function drawSaw(g, w) {
    var x = sx(w.x), y = sy(w.y);
    g.save(); g.translate(x, y); g.rotate(w.spin);
    g.fillStyle = w.t.path ? DATA.PATHS[w.t.path].col : '#dfe5ea'; g.strokeStyle = '#111'; g.lineWidth = 3;
    g.beginPath();
    for (var i = 0; i < 20; i++) { var a = i / 20 * Math.PI * 2, r = i % 2 ? 17 : 26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#59606a'; ellipse(g, 0, 0, 7, 7); g.fill();
    g.restore();
  }
  function drawShot(g, s) {
    var x = sx(s.x), y = sy(s.y), col = s.t.path ? DATA.PATHS[s.t.path].col : '#fff1c8';
    if (s.kind === 'ball' || s.kind === 'lob') {
      g.fillStyle = '#26282c'; g.strokeStyle = col; g.lineWidth = 3; ellipse(g, x, y, s.kind === 'lob' ? 10 : 7, s.kind === 'lob' ? 10 : 7); g.fill(); g.stroke();
    } else if (s.kind === 'snipe') {
      g.strokeStyle = col; g.lineWidth = 4; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(sx(s.sx), sy(s.sy)); g.lineTo(x, y); g.stroke(); g.globalAlpha = 1;
    } else {
      var a = Math.atan2(s.ty - s.sy, s.tx - s.sx);
      g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - Math.cos(a) * 15, y - Math.sin(a) * 15); g.lineTo(x, y); g.stroke();
      g.strokeStyle = col; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - Math.cos(a) * 14, y - Math.sin(a) * 14); g.lineTo(x, y); g.stroke();
    }
  }
  function drawFx(g, f) {
    var k = f.t / f.life, x = sx(f.x), y = sy(f.y);
    g.globalAlpha = Math.max(0, 1 - k);
    if (f.k === 'boom') { g.fillStyle = f.col; ellipse(g, x, y, f.max * CW * (0.4 + 0.6 * k), f.max * CW * (0.4 + 0.6 * k) * 0.75); g.globalAlpha *= 0.55; g.fill(); }
    else if (f.k === 'ring' || f.k === 'wave') { g.strokeStyle = f.col; g.lineWidth = 6 * (1 - k) + 2; ellipse(g, x, y, f.max * CW * k, f.max * CW * k * 0.8); g.stroke(); }
    else if (f.k === 'bolt') {
      var x2 = sx(f.x2), y2 = sy(f.y2);
      g.strokeStyle = f.col; g.lineWidth = 3.5; g.beginPath(); g.moveTo(x, y);
      for (var i = 1; i < 5; i++) g.lineTo(x + (x2 - x) * i / 5 + (Math.random() - 0.5) * 16, y + (y2 - y) * i / 5 + (Math.random() - 0.5) * 16);
      g.lineTo(x2, y2); g.stroke();
    } else if (f.k === 'lob') { g.fillStyle = f.col; ellipse(g, x + (sx(f.x2) - x) * k, y + (sy(f.y2) - y) * k - Math.sin(Math.PI * k) * 60, 9, 9); g.globalAlpha = 1; g.fill(); }
    else if (f.k === 'bit') { g.fillStyle = f.col; g.fillRect(x - 3, y - 3, 6, 6); }
    else if (f.k === 'num' || f.k === 'text') {
      g.font = (f.k === 'num' ? '800 17px' : '900 22px') + ' system-ui'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)';
      g.strokeText(f.text, x, y); g.fillStyle = f.col; g.fillText(f.text, x, y);
    }
    g.globalAlpha = 1;
  }

  /* ---------- płonący zamek (Hardcore, dopóki HP nie przekroczy 30%) ---------- */
  function burning() { var s = S(); return !!(s && s.hc && s.hp <= s.hpMax * 0.3); }
  function flame(g, x, y, w, h, phase) {
    var f = Math.sin(clock * 11 + phase), f2 = Math.sin(clock * 7 + phase * 2);
    var hh = h * (1 + 0.16 * f), ww = w * (1 - 0.1 * f), lean = f2 * w * 0.22;
    function shape(k, col) {
      var wk = ww * k, hk = hh * k;
      g.fillStyle = col; g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x - wk * 0.75, y - hk * 0.04, x - wk * 0.55, y - hk * 0.45, x - wk * 0.2 + lean * k, y - hk * 0.62);
      g.bezierCurveTo(x - wk * 0.1, y - hk * 0.8, x + lean * k, y - hk * 0.88, x + lean * 1.4 * k, y - hk);
      g.bezierCurveTo(x + wk * 0.2 + lean * k, y - hk * 0.72, x + wk * 0.75, y - hk * 0.45, x + wk * 0.52, y - hk * 0.2);
      g.bezierCurveTo(x + wk * 0.45, y - hk * 0.02, x + wk * 0.25, y, x, y);
      g.fill();
    }
    shape(1, '#ff5a0a'); shape(0.55, '#ffd23f');
  }
  var FIRES = [[-44, 63, 27, 46], [-17, 71, 23, 34], [17, 69, 27, 42], [46, 60, 25, 46], [6, -44, 19, 40], [-36, 2, 17, 33], [38, 15, 19, 36]];
  function drawCastleFire(g, cx, cy) {
    var glow = g.createRadialGradient(cx, cy + 6, 5, cx, cy + 6, 96);
    glow.addColorStop(0, 'rgba(255,122,24,.45)'); glow.addColorStop(1, 'rgba(255,122,24,0)');
    g.fillStyle = glow; g.fillRect(cx - 100, cy - 90, 200, 196);
    for (var i = 0; i < 6; i++) {
      var ph = (clock * 0.38 + i / 6) % 1;
      g.fillStyle = 'rgba(45,38,36,' + 0.55 * (1 - ph) + ')';
      ellipse(g, cx - 20 + (i * 23 % 44) + ph * 26, cy - 36 - ph * 88, 12 + ph * 26, 11 + ph * 22); g.fill();
    }
    FIRES.forEach(function (q, j) { flame(g, cx + q[0], cy + q[1], q[2], q[3], j * 1.9); });
  }

  /* panel U5: ostra zostaje tylko zaznaczona wieża (rozmyte płótno leży pod spodem) */
  function drawSelected() {
    if (!sel) return;
    tctx.setTransform(K, 0, 0, K, L.ox * K, L.oy * K);
    if (sel.type === 'legend') {
      GAME.zoneCells(sel.k).forEach(function (p) { tctx.strokeStyle = 'rgba(255,236,130,.9)'; tctx.lineWidth = 2.5; rr(tctx, sx(p[0]) - 34, sy(p[1]) - 34, 68, 68, 10); tctx.stroke(); });
      gateRings(tctx, sel); drawGate(tctx, sel);
    } else {
      var st = GAME.stats(sel);
      tctx.strokeStyle = 'rgba(255,255,255,.9)'; tctx.lineWidth = 2.5; ellipse(tctx, sx(sel.c), sy(sel.r), (st.range + 0.05) * CW, (st.range + 0.05) * CW); tctx.stroke();
      drawTower(tctx, sel, sx(sel.c), sy(sel.r) + 22);
    }
  }

  function draw() {
    var s = S();
    tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, topCv.width, topCv.height);
    /* przy otwartym panelu gra stoi, więc rozmytego płótna nie rysujemy co klatkę (oszczędza telefon) */
    if (sel && !baseDirty) { drawSelected(); return; }
    baseDirty = !sel;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!s || !ground) { ctx.fillStyle = '#1b2430'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
    ctx.drawImage(ground, 0, 0);
    ctx.setTransform(K, 0, 0, K, L.ox * K, L.oy * K);
    ctx.textBaseline = 'alphabetic';
    s.patches.forEach(function (p) {
      ctx.fillStyle = p.kind === 'fire' ? 'rgba(255,110,30,.45)' : p.kind === 'ice' ? 'rgba(150,220,255,.5)' : 'rgba(130,230,70,.45)';
      ellipse(ctx, sx(p.x), sy(p.y) + 12, 38, 24); ctx.fill();
    });
    if (s.zone) { ctx.fillStyle = 'rgba(140,210,255,.18)'; ctx.strokeStyle = 'rgba(170,225,255,.8)'; ctx.lineWidth = 3; ellipse(ctx, sx(s.zone.x), sy(s.zone.y), s.zone.r * CW, s.zone.r * CW); ctx.fill(); ctx.stroke(); }
    /* podpowiedzi miejsc podczas stawiania */
    var placing = drag && drag.moved ? drag : buildType ? { type: buildType } : null;
    var type = placing ? (placing.tower ? placing.tower.type : placing.type) : null;
    if (placing) {
      if (type === 'legend') {
        GAME.gateSpots(placing.tower).forEach(function (p) {
          ctx.fillStyle = 'rgba(255,205,50,.32)'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; rr(ctx, sx(p.c) - 30, sy(p.r) - 30, 60, 60, 10); ctx.fill(); ctx.stroke();
        });
      } else for (var c = 0; c < 16; c++) for (var r = 0; r < 9; r++) if (!GAME.cellState(c, r, placing.tower)) { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; rr(ctx, sx(c) - 36, sy(r) - 36, 72, 72, 9); ctx.stroke(); }
    }
    var ghost = null;
    if (placing && hover) {
      var why = GAME.placeState(type, hover.c, hover.r, placing.tower);
      var gt = placing.tower ? { id: placing.tower.id, type: type, path: placing.tower.path, level: placing.tower.level, cards: placing.tower.cards, mastery: placing.tower.mastery } : { type: type, path: null, level: 0, cards: [], mastery: null };
      gt.c = hover.c; gt.r = hover.r;
      if (type === 'legend') { var spot = GAME.gateSpot(hover.c, hover.r, placing.tower); gt.o = spot.o; gt.k = spot.k; }
      ctx.fillStyle = why ? 'rgba(255,80,70,.5)' : 'rgba(110,255,130,.45)'; rr(ctx, sx(hover.c) - 38, sy(hover.r) - 38, 76, 76, 10); ctx.fill();
      if (!why) { drawRange(ctx, gt); ghost = gt; }
    }

    var list = [];
    var cc = s.road.castle, cx = (sx(cc[0][0]) + sx(cc[1][0])) / 2, cy = (sy(cc[0][1]) + sy(cc[2][1])) / 2;
    list.push({ y: cy + 52, f: function () { sprite(ctx, 'castle_' + s.f.id, cx, cy + 46, 1); if (burning()) drawCastleFire(ctx, cx, cy); } });
    deco.forEach(function (d) { if (!GAME.towerAt(d.c, d.r)) list.push({ y: d.y, f: function () { sprite(ctx, d.name, d.x, d.y, d.k); } }); });
    s.towers.forEach(function (t) {
      var dim = drag && drag.moved && drag.tower === t ? 0.35 : undefined;
      if (t.type === 'legend') {
        gateRings(ctx, t);
        list.push({ y: sy(t.r) + 22, f: function () { drawGate(ctx, t, dim); } });
      } else list.push({ y: sy(t.r) + 22, f: function () { drawTower(ctx, t, sx(t.c), sy(t.r) + 22, dim); } });
    });
    s.enemies.forEach(function (e) { list.push({ y: sy(e.y) + FOOT, f: function () { drawEnemy(ctx, e); } }); });
    s.kegs.forEach(function (k) { list.push({ y: sy(k.y) + 12, f: function () { drawKeg(ctx, k); } }); });
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });
    if (ghost) { if (ghost.type === 'legend') drawGate(ctx, ghost, 0.66); else drawTower(ctx, ghost, sx(ghost.c), sy(ghost.r) + 22, 0.62); }
    s.saws.forEach(function (w) { if (w.x !== undefined) drawSaw(ctx, w); });
    s.shots.forEach(function (sh) { drawShot(ctx, sh); });
    s.fx.forEach(function (f) { drawFx(ctx, f); });
    if (s.theme.dark) { ctx.fillStyle = 'rgba(10,18,52,.16)'; ctx.fillRect(-L.ox, -L.oy, L.ew, L.eh); }
    /* HP zamku */
    /* gdy zamek stoi wysoko, pasek HP schodzi pod niego, żeby nie schował się pod napisem o bossie */
    var low = L.by + (cy - 134) * L.k < 40, hy = low ? cy + 82 : cy - 112;
    bar(ctx, cx, hy, 130, s.hp / s.hpMax, burning() ? '#ff5a3d' : '#5ae06a');
    ctx.font = '800 15px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(s.hp + ' / ' + s.hpMax, cx, hy - 6); ctx.fillStyle = '#fff'; ctx.fillText(s.hp + ' / ' + s.hpMax, cx, hy - 6);
    drawSelected();
  }

  /* ---------- HUD ---------- */
  var cache = {};
  function setHTML(id, html) { if (cache[id] !== html) { cache[id] = html; $(id).innerHTML = html; return true; } return false; }
  function setText(id, t) { if (cache['t' + id] !== t) { cache['t' + id] = t; $(id).textContent = t; } }
  function types() { return S().f.tw.concat(['legend']); }
  function tName(type) { return type === 'legend' ? S().f.leg.n : DATA.TOWERS[type].n; }
  var SKILL_ICO = { q: '🏹', e: '🛡', r: '👑' }, SKILL_CD = { q: 18, e: 22, r: 28 };
  function initPanel() {
    cache = {};
    var box = $('towers');
    box.innerHTML = '';
    types().forEach(function (type) {
      var b = document.createElement('button');
      b.className = 'tb' + (type === 'legend' ? ' leg' : '');
      b.id = 'tb-' + type;
      b.setAttribute('data-type', type);
      b.setAttribute('aria-label', tName(type));
      b.innerHTML = '<u id="tn-' + type + '"></u><canvas width="' + (type === 'legend' ? 184 : 124) + '" height="124"></canvas><small id="tc-' + type + '"></small>';
      box.appendChild(b);
      thumb(b.getElementsByTagName('canvas')[0], type === 'legend' ? 'gate_' + S().f.id + '_v' : 't_' + S().f.id + '_' + type);
      b.addEventListener('pointerdown', buttonDown);
    });
    thumb($('twbtn').getElementsByTagName('canvas')[0], 't_' + S().f.id + '_' + S().f.tw[0]);
    var sk = $('skills');
    sk.innerHTML = '';
    ['q', 'e', 'r'].forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'sk'; b.id = 'sk-' + k;
      b.innerHTML = '<i></i><em></em>';
      b.addEventListener('click', function () {
        if (!GAME.skill(k)) hint(GAME.skillName(k) + ': ' + (S().castle.sk[k] ? (S().phase === 'wave' ? 'odnawia się' : 'działa w czasie fali') : 'dostaniesz za awans zamku'));
      });
      sk.appendChild(b);
    });
  }
  /* drabinka fal w poziomie: bossowie wyżsi, bieżąca fala z numerem */
  function ladderHTML() {
    var cur = GAME.nextWave(), out = '';
    for (var w = 1; w <= DATA.WAVES; w++) {
      var boss = w % 5 === 0, tall = boss || w === cur;
      var col = w < cur ? '#2a7a40' : w === cur ? '#f0be46' : boss ? '#7a2b31' : '#1d2836e0';
      out += '<i style="left:' + ((w - 1) * 16.5) + 'px;top:' + (tall ? 0 : 3) + 'px;height:' + (tall ? 16 : 10) + 'px;background:' + col + (w === cur ? ';color:#1a1204;box-shadow:0 0 8px #f0be46' : '') + '">' + (w === cur ? w : boss ? '☠' : '') + '</i>';
    }
    return out;
  }
  function updatePanel() {
    var s = S();
    if (!s) return;
    setText('hwave', Math.max(1, GAME.nextWave()) + '/' + DATA.WAVES);
    setText('hhp', s.hp + '/' + s.hpMax);
    $('sthp').className = 'st' + (burning() ? ' low' : '');
    setText('hgold', '' + Math.floor(s.gold));
    setText('hpts', '' + s.points);
    setHTML('ladder', ladderHTML());
    var bs = GAME.nextBoss();
    $('boss').style.display = bs ? '' : 'none';
    if (bs) setText('boss', '☠ ' + (bs.wave === GAME.nextWave() ? 'Boss w tej fali' : 'Fala ' + bs.wave) + ': ' + bs.name + (bs.resist ? ' · odporny: ' + bs.resist : ''));
    types().forEach(function (type) {
      var b = $('tb-' + type), why = GAME.buildState(type), locked = !GAME.unlocked(type);
      setText('tc-' + type, locked ? '🔒 fala ' + GAME.unlockWave(type) : GAME.cost(type) + ' zł');
      setText('tn-' + type, locked ? '' : GAME.count(type) + '/' + (type === 'legend' ? 1 : 3));
      var cls = 'tb' + (type === 'legend' ? ' leg' : '') + (locked ? ' lock off' : why ? ' off' : '');
      if (b.className !== cls) b.className = cls;
    });
    ['q', 'e', 'r'].forEach(function (k) {
      var b = $('sk-' + k), lv = s.castle.sk[k], cd = s.castle.cd[k];
      var html = (lv ? SKILL_ICO[k] : '🔒') + '<span>' + GAME.skillName(k) + (lv > 1 ? ' ' + lv : '') + '</span>';
      if (cache['sk' + k] !== html) { cache['sk' + k] = html; b.lastChild.innerHTML = html; }
      b.firstChild.style.background = cd > 0 ? 'conic-gradient(#000b ' + Math.round(100 * Math.min(1, cd / SKILL_CD[k])) + '%, transparent 0)' : '';
      b.classList.toggle('off', !(lv && s.phase === 'wave' && cd <= 0));
    });
    $('star').style.display = s.castle.pending && !modal ? 'block' : 'none';
    setText('starn', '' + s.castle.pending);
    updateGo();
    revealTowers();
    updateGlow();
  }

  var COVERS = ['stats', 'ladder', 'boss', 'sk-q', 'sk-e', 'sk-r', 'twbtn', 'go'];
  /* miejsca dla ★ (od prawej i od dołu): pierwsze obok przycisku fali, pozostałe, gdy tam stoi wieża */
  var STAR_SPOTS = [[117, 26], [22, 208], [120, 108], [200, 26]];
  function revealTowers() {
    var s = S(), k = L.k;
    var boxes = [];
    s.towers.forEach(function (t) {
      GAME.footprint(t).forEach(function (p) {
        var x = L.bx + sx(p[0]) * k, y = L.by + sy(p[1]) * k;
        boxes.push([x - 36 * k, y - 62 * k, x + 36 * k, y + 34 * k]);
      });
    });
    function covers(x0, y0, x1, y1) { return boxes.some(function (q) { return q[0] < x1 - 3 && q[2] > x0 + 3 && q[1] < y1 - 3 && q[3] > y0 + 3; }); }
    var spot = STAR_SPOTS.filter(function (p) { return !covers(L.w - p[0] - 52, L.h - p[1] - 52, L.w - p[0], L.h - p[1]); })[0] || STAR_SPOTS[0];
    $('star').style.right = spot[0] + 'px'; $('star').style.bottom = spot[1] + 'px';
    COVERS.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var r = el.getBoundingClientRect(), a = toStage(r.left, r.top), b = toStage(r.right, r.bottom);
      el.classList.toggle('over', r.width > 0 && covers(a.x, a.y, b.x, b.y));
    });
  }
  function setDrawer(open) {
    drawerOpen = open;
    $('hud').classList.toggle('drawer', open);
    $('twbtn').classList.toggle('on', open);
  }

  var hintT = null;
  function hint(msg, ms) {
    var h = $('hint');
    h.textContent = msg; h.className = modal ? 'on top' : 'on';
    clearTimeout(hintT);
    hintT = setTimeout(function () { h.className = ''; }, ms || 2600);
  }

  /* ---------- żar Hardcore (Z8) ---------- */
  var glowKey = '';
  function paintGlow() {
    var w = Math.round(L.w), h = Math.round(L.h), key = w + 'x' + h;
    if (key === glowKey) return;
    glowKey = key;
    var seed = 33;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var pts = [[8, 8], [w - 8, 8], [w - 8, h - 8], [8, h - 8], [8, 8]], out = [];
    for (var i = 0; i < 4; i++) {
      var a = pts[i], b = pts[i + 1], n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 22) + 1;
      for (var k = 0; k < n; k++) out.push(Math.round(a[0] + (b[0] - a[0]) * k / n + (rnd() * 8 - 4)) + ' ' + Math.round(a[1] + (b[1] - a[1]) * k / n + (rnd() * 8 - 4)));
    }
    var d = 'M' + out.join('L') + 'Z';
    var html = '<svg width="' + w + '" height="' + h + '"><path d="M-20 -20H' + (w + 20) + 'V' + (h + 20) + 'H-20Z ' + d + '" fill="#140904" fill-rule="evenodd" opacity=".94"/>' +
      '<g class="line" fill="none" stroke-linejoin="round"><path d="' + d + '" stroke="#ff4a00" stroke-width="5" style="filter:drop-shadow(0 0 8px #ff5a00)"/><path d="' + d + '" stroke="#ffcf4a" stroke-width="1.6"/></g></svg>';
    for (var e = 0; e < 18; e++) {
      var z = 3 + (rnd() * 4 | 0), du = 2.2 + rnd() * 2.6;
      html += '<i style="left:' + (rnd() * w | 0) + 'px;top:' + (h - 100 + rnd() * 100 | 0) + 'px;width:' + z + 'px;height:' + z + 'px;--dx:' + ((rnd() - 0.5) * 100 | 0) + 'px;--dy:-' + (190 + rnd() * 200 | 0) + 'px;animation-duration:' + du.toFixed(2) + 's;animation-delay:-' + (rnd() * du).toFixed(2) + 's;background:' + ['#ffd23f', '#ff8a1e', '#ff5a1e'][e % 3] + '"></i>';
    }
    $('glow').innerHTML = html;
  }
  /* W grze: mocny żar, gdy zamek płonie, słabszy po wyleczeniu. W menu: gdy wybrany jest Hardcore. */
  function updateGlow() {
    var cls = '';
    if (modal === 'menu') cls = pick.diff === 'hardcore' ? 'on' : '';
    else if (inMenu()) cls = '';                     // menu główne ma własny żar (S10)
    else if (modal !== 'intro-logo' && modal !== 'intro-title' && S() && S().hc) cls = burning() ? 'on' : 'low';
    if ($('glow').className !== cls) $('glow').className = cls;
    stageEl.classList.toggle('hc', !!(S() && S().hc));
  }

  /* ---------- napis fali (F7 Żar) i ptaszek po fali (P7 Rozbłysk) ---------- */
  function showEffect(html, ms) {
    var d = document.createElement('div');
    d.innerHTML = html;
    $('fx').appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, ms);
  }
  function waveText(n) {
    var html = '<svg class="wtxt" viewBox="0 0 600 140"><defs><linearGradient id="fireg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#ff9a1f"/><stop offset="1" stop-color="#d8330f"/></linearGradient></defs>' +
      '<text x="300" y="102" text-anchor="middle" font-family="Georgia,\'Noto Serif\',serif" font-size="92" font-weight="700" letter-spacing="2" fill="url(#fireg)" stroke="#3a0c02" stroke-width="11" stroke-linejoin="round" paint-order="stroke">FALA ' + n + '</text></svg>';
    for (var i = 0; i < 46; i++) {
      var z = 4 + (Math.random() * 7 | 0);
      html += '<i class="ember2" style="left:' + (Math.random() * 330 - 165 | 0) + 'px;top:' + (Math.random() * 60 - 26 | 0) + 'px;width:' + z + 'px;height:' + z + 'px;background:' + ['#ffd23f', '#ff8a1e', '#ff5a1e'][i % 3] + ';--dx:' + (Math.random() * 120 - 60 | 0) + 'px;--dy:-' + (50 + Math.random() * 100 | 0) + 'px"></i>';
    }
    $('fx').innerHTML = '';
    showEffect(html, 2050);
  }
  function waveDone() {
    var rays = '';
    for (var i = 0; i < 14; i++) {
      var a = i * Math.PI / 7;
      rays += 'M230 230L' + Math.round(230 + 230 * Math.cos(a)) + ' ' + Math.round(230 + 230 * Math.sin(a)) + 'L' + Math.round(230 + 230 * Math.cos(a + 0.2)) + ' ' + Math.round(230 + 230 * Math.sin(a + 0.2)) + 'Z';
    }
    var path = 'M-52 2L-17 38L55 -40';
    $('fx').innerHTML = '';
    showEffect('<div class="rays"><svg width="460" height="460"><path d="' + rays + '" fill="#fff3a0"/></svg></div>' +
      '<svg class="check" viewBox="-110 -90 220 180"><g transform="scale(1.55)" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + path + '" stroke="#0d2415" stroke-width="46"/><path d="' + path + '" stroke="#fff" stroke-width="34"/><path d="' + path + '" stroke="#2fc653" stroke-width="24"/></g></svg>', 1050);
  }

  /* ---------- przycisk fali W2 / W10 ---------- */
  function isOpen() { return w2.state === 'open'; }
  function updateGo() {
    var s = S();
    if (!s) return;
    var go = $('go'), build = s.phase === 'build';
    var face = isOpen() ? (build ? '<b>✕</b><span>Zamknij</span>' : '<b>▶</b><span>Wznów</span>') : '<b>' + (build ? '▶' : '⚔') + '</b><span>Fala ' + (build ? GAME.nextWave() : s.wave) + '</span>';
    setHTML('go', face);
    var cls = isOpen() ? 'open' : build ? 'build' : '';
    if (go.className !== cls) go.className = cls;
    setText('spd', '×' + speed);
  }
  function setW2(state) {
    w2.state = state;
    $('w2').classList.toggle('open', state === 'open');
    if (state !== 'hold') $('w2').classList.remove('hold');
    stageEl.classList.toggle('paused', state === 'open');
    updateGo();
  }
  function openMenu() {
    if (!S() || modal || S().result) return;
    sel = null; closeU5(); buildType = null; drag = null; hover = null; setDrawer(false);
    setW2('open'); say('pause');
  }
  $('go').addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    if (modal || !S() || isPlacing() || sel) return;
    if (isOpen()) { setW2('idle'); say('resume'); w2.skipUp = true; return; }
    w2.since = now(); setW2('hold');
  });
  $('go').addEventListener('pointerup', function () {
    if (w2.skipUp) { w2.skipUp = false; return; }
    if (w2.state !== 'hold') return;
    var d = now() - w2.since;
    setW2('idle');
    if (d < TAP && S().phase === 'build') startWave();       // krótkie stuknięcie: fala rusza po puszczeniu
  });
  ['pointercancel', 'pointerleave'].forEach(function (n) {
    $('go').addEventListener(n, function () { if (w2.state === 'hold') setW2('idle'); });
  });
  (function () {
    var html = '';
    for (var i = 0; i < 18; i++) {
      var z = 4 + (i * 7 % 5);
      html += '<i style="left:' + ((i * 37) % 100) + 'px;top:' + (20 + (i * 23) % 60) + 'px;width:' + z + 'px;height:' + z + 'px;--dx:' + ((i * 29) % 48 - 24) + 'px;animation-delay:-' + (i * 0.067).toFixed(2) + 's;background:' + ['#ffd23f', '#ff8a1e', '#ff5a1e'][i % 3] + '"></i>';
    }
    $('sparks').innerHTML = html;
  })();
  function tickW2() {
    if (w2.state !== 'hold') return;
    var d = now() - w2.since;
    $('w2').classList.toggle('hold', d > 0.25);
    $('arc').style.strokeDashoffset = 100 - Math.min(1, d / HOLD) * 100;
    if (d >= HOLD) {
      w2.skipUp = true;
      setW2('open');
      say('pause', true);
    }
  }
  $('orb-speed').addEventListener('click', function () { speed = speed >= 3 ? 1 : speed + 1; say('tap'); updateGo(); });
  $('orb-menu').addEventListener('click', function () {
    if (S().phase === 'wave') plain('<h1>Na pewno?</h1><p>Wyjście przerwie falę ' + S().wave + '. Po wznowieniu zacznie się od początku.</p><div class="btns"><button data-a="tomenu">Wyjdź do menu</button><button class="main" data-a="close">Zostań</button></div>', 'confirm');
    else { persist(); mainMenu(); }
  });

  $('orb-exit').addEventListener('click', function () { say('tap'); exitAsk('game'); });

  /* ---------- wyjście z aplikacji (przeglądarka nie pozwala stronie zamknąć karty, więc tylko w aplikacji) ---------- */
  var exitFrom = 'menu';
  function exitAsk(from) {
    exitFrom = from;
    var s = S(), text;
    if (from === 'menu') text = savedInfo(fetchStore(SAVE)) ? 'Zapisana gra zostanie na później.' : 'Gra się zamknie.';
    else if (s.phase === 'wave') text = 'Fala ' + s.wave + ' zacznie się od początku. Gra zapisała się przed jej startem.';
    else text = 'Gra zostanie zapisana.';
    plain('<h1>Wyjść z gry?</h1><p>' + text + '</p><div class="btns"><button data-a="stay">Zostań</button><button class="danger" data-a="quit">Wyjdź</button></div>', 'exitask');
  }
  function exitStay() { if (exitFrom === 'menu') mainMenu(); else hide(); }         // z gry wraca do pauzy
  function exitGame() {
    tickClock(); saveClock();
    if (exitFrom === 'game' && S() && !S().result) persist();                       // w trakcie fali zostaje zapis sprzed niej
    SFX.suspend();
    window.BibApp.exit();
  }

  /* ---------- panel wieży U5 ---------- */
  function select(t) {
    if (w2.state !== 'idle') setW2('idle');
    setDrawer(false);
    sel = t; u5.view = 'orbs'; u5.info = false; u5.sure = false;
    say('tap', 'pick');
    stageEl.classList.add('u5');
    renderU5();
  }
  function closeU5() {
    sel = null;
    stageEl.classList.remove('u5');
    $('u5').innerHTML = '';
  }
  function towerPoint(t) {
    var k = L.bw / W;
    return { x: L.bx + sx(t.c) * k, y: L.by + (sy(t.r) - 6) * k };
  }
  function statLine(t) {
    var st = GAME.stats(t), d = GAME.def(t);
    if (t.type === 'legend') return Math.round(st.dmg) + ' obr. co ' + d.tick.toString().replace('.', ',') + ' s · strefa 5 kratek';
    if (d.atk === 'keg') return 'beczka ' + Math.round(st.dmg) + ' obr. · zasięg ' + st.range.toFixed(1).replace('.', ',');
    return Math.round(st.dmg) + ' obr. · ' + st.rate.toFixed(1).replace('.', ',') + '/s · zasięg ' + st.range.toFixed(1).replace('.', ',');
  }
  function pathLabel(t) {
    if (t.type === 'legend') { var m = S().f.leg.m.filter(function (q) { return q[0] === t.mastery; })[0]; return m ? m[1] : 'legenda'; }
    return t.path ? DATA.PATHS[t.path].n + ' ' + ['', 'I', 'II', 'III', 'IV'][t.level] : 'bez ulepszeń';
  }
  function infoHTML(t) {
    var s = S(), st = GAME.stats(t), d = GAME.def(t), P = t.path ? DATA.PATHS[t.path] : null;
    var html = '<p><b>' + d.n + '</b><br>' + (t.type === 'legend' ? d.info : d.d) + '</p>';
    if (P) {
      html += '<p style="color:' + P.col + '"><b>I · ' + P.n + '</b><br>' + P.one + '</p>';
      t.cards.forEach(function (id, i) { var c = P.cards.filter(function (x) { return x[0] === id; })[0]; html += '<p><b>' + ['II', 'III'][i] + ' · ' + c[1] + '</b><br>' + c[2] + '</p>'; });
      var pm = t.mastery && P.m.filter(function (x) { return x[0] === t.mastery; })[0];
      if (pm) html += '<p><b>IV · ' + pm[1] + '</b><br>' + pm[2] + '</p>';
    }
    if (t.type === 'legend' && t.mastery) { var gm = s.f.leg.m.filter(function (x) { return x[0] === t.mastery; })[0]; html += '<p><b>Mistrzostwo · ' + gm[1] + '</b><br>' + gm[2] + '</p>'; }
    if (st.notes.length) html += '<p class="flaw">' + st.notes.join('<br>') + '</p>';
    if (s.phase === 'build') html += '<p style="color:#9fb2c4">Między falami przeciągnij wieżę, żeby ją przestawić.</p>';
    return html;
  }
  function renderU5() {
    var t = sel, s = S();
    if (!t || !s) return;
    baseDirty = true;
    if (u5.view === 'cards') { renderCards(); return; }
    var p = towerPoint(t), R = t.type === 'legend' ? 112 : 94, items = [];
    var max = GAME.maxLevel(t);
    items.push({ act: 'up', d: 74, ang: -90, cls: 'o up', off: !GAME.canUpgrade(t), html: '⬆<span>' + (t.level >= max ? 'Pełna' : GAME.upCost(t) + ' pkt') + '</span>', aria: 'Ulepsz' });
    var def = GAME.def(t);
    if (t.type !== 'legend' && def.atk !== 'pulse' && def.atk !== 'keg') items.push({ act: 'mode', d: 62, ang: 180, cls: 'o', html: '🎯<span>' + (t.mode === 'strong' ? 'Silny' : 'Pierwszy') + '</span>', aria: 'Wybór celu' });
    var v = GAME.sellValue(t);
    items.push({ act: 'sell', d: 62, ang: 0, cls: 'o sell' + (u5.sure ? ' sure' : ''), html: '🪙<span>' + (u5.sure ? 'Na pewno?' : v.gold + ' zł' + (v.pts ? ' +' + v.pts : '')) + '</span>', aria: 'Sprzedaj' });
    items.push({ act: 'close', d: 56, ang: 90, cls: 'o', html: '✕', aria: 'Zamknij' });
    items.push({ act: 'info', d: 52, ang: 45, cls: 'o', html: '<b style="font:italic 700 22px Georgia,serif">i</b>', aria: 'Opisy' });
    /* każdy przycisk trafia jak najbliżej swojego kąta, ale w całości na ekranie i bez nakładania */
    var placed = [];
    function free(x, y, d) {
      if (x - d / 2 < 4 || y - d / 2 < 4 || x + d / 2 > L.w - 4 || y + d / 2 > L.h - 4) return false;
      return !placed.some(function (q) { return Math.hypot(q.x - x, q.y - y) < (q.d + d) / 2 + 4; });
    }
    items.forEach(function (it) {
      var rad = [R, R + 34, R + 68];
      for (var j = 0; j < rad.length && it.x === undefined; j++) for (var off = 0; off <= 180; off += 15) {
        var tries = off ? [it.ang + off, it.ang - off] : [it.ang];
        for (var q = 0; q < tries.length && it.x === undefined; q++) {
          var a = tries[q] * Math.PI / 180, x = p.x + Math.cos(a) * rad[j], y = p.y + Math.sin(a) * rad[j];
          if (free(x, y, it.d)) { it.x = x; it.y = y; }
        }
        if (it.x !== undefined) break;
      }
      if (it.x === undefined) { it.x = clamp(p.x, it.d, L.w - it.d); it.y = clamp(p.y + R, it.d, L.h - it.d); }
      placed.push(it);
    });
    var html = items.map(function (it) {
      return '<button class="' + it.cls + '" data-u="' + it.act + '" aria-label="' + it.aria + '"' + (it.off ? ' disabled' : '') + ' style="left:' + Math.round(it.x - it.d / 2) + 'px;top:' + Math.round(it.y - it.d / 2) + 'px;width:' + it.d + 'px;height:' + it.d + 'px">' + it.html + '</button>';
    }).join('');
    var col = t.path ? DATA.PATHS[t.path].col : t.type === 'legend' ? '#ffd23f' : '#fff';
    html += '<div class="pill" id="upill"><b style="color:' + col + '">' + def.n + ' · ' + pathLabel(t) + '</b>' + statLine(t) + '</div>';
    if (u5.info) html += '<div class="panel" id="upanel">' + infoHTML(t) + '</div>';
    $('u5').innerHTML = html;
    /* pigułka z nazwą: w wolnym miejscu nad albo pod przyciskami */
    var pill = $('upill'), pw = pill.offsetWidth, ph = pill.offsetHeight;
    var spots = [[p.x, p.y - R - 62], [p.x, p.y + R + 36], [p.x + R + 40 + pw / 2, p.y - 66], [p.x - R - 40 - pw / 2, p.y - 66], [p.x + R + 40 + pw / 2, p.y + 66], [p.x - R - 40 - pw / 2, p.y + 66], [L.w / 2, 24], [L.w / 2, L.h - 26]];
    for (var i = 0; i < spots.length; i++) {
      var px = clamp(spots[i][0] - pw / 2, 4, L.w - pw - 4), py = clamp(spots[i][1] - ph / 2, 4, L.h - ph - 4);
      var hit = placed.some(function (q) { var nx = clamp(q.x, px, px + pw), ny = clamp(q.y, py, py + ph); return Math.hypot(q.x - nx, q.y - ny) < q.d / 2 + 2; }) || (Math.abs(p.x - (px + pw / 2)) < pw / 2 + 30 && Math.abs(p.y - (py + ph / 2)) < ph / 2 + 30);
      if (!hit || i === spots.length - 1) { pill.style.left = px + 'px'; pill.style.top = py + 'px'; break; }
    }
    var panel = $('upanel');
    if (panel) { panel.style.top = '8px'; panel.style[p.x < L.w / 2 ? 'right' : 'left'] = '8px'; }
  }
  function renderCards() {
    baseDirty = true;
    var t = sel, offer = GAME.offer(t);
    if (!offer) { u5.view = 'orbs'; renderU5(); return; }
    var p = towerPoint(t), below = p.y < L.h / 2;
    var title = t.type === 'legend' ? 'Mistrzostwo bramy: wybierz' : t.level === 0 ? 'Wybierz ścieżkę' : t.level === 3 ? 'Mistrzostwo: wybierz' : 'Poziom ' + ['I', 'II', 'III', 'IV'][t.level] + ': wybierz kartę';
    /* karty pod wieżą albo nad nią; gdy wieża stoi pośrodku, w kolumnie po drugiej stronie ekranu, żeby jej nie zasłonić */
    var side = !(p.y + 36 < L.h - 218 || p.y - 36 > 220);
    var cardTop = side ? (L.h - (offer.length * 106 + 62)) / 2 + 26 : below ? L.h - 190 : 40;
    var at = side ? ';left:' + Math.round(p.x < L.w / 2 ? L.w - 260 : 12) + 'px' : '', sideCls = side ? ' side' : '';
    var html = '<div class="ctitle' + sideCls + '" style="top:' + Math.round(cardTop - 26) + 'px' + at + '">' + title + '</div><div class="cards' + sideCls + '" style="top:' + Math.round(cardTop) + 'px' + at + '">';
    offer.forEach(function (c, i) {
      var col = c.path ? DATA.PATHS[c.path].col : '#ffc21f';
      html += '<button class="card" data-pick="' + i + '" style="border-color:' + col + (offer.length === 2 && !side ? ';width:230px' : '') + '"><em>' + (c.kind === 'path' ? 'ścieżka' : c.kind === 'card' ? 'karta' : 'mistrzostwo') + '</em><b style="color:' + col + '">' + c.n + '</b><span>' + c.d + '</span></button>';
    });
    html += '</div><div class="cbtns' + sideCls + '" style="top:' + Math.round(cardTop + (side ? offer.length * 106 : 144)) + 'px' + at + '">';
    if (t.type !== 'legend' && t.level < 3) html += '<button data-u="reroll"' + (GAME.canReroll(t) ? '' : ' disabled') + '>⟳ Przelosuj ' + (S().rerollFree ? '(darmowe)' : '(' + S().rerollCost + ' zł)') + '</button>';
    html += '<button data-u="later">Później</button></div>';
    $('u5').innerHTML = html;
  }
  $('u5').addEventListener('click', function (ev) {
    if (!sel) return;
    var b = ev.target.closest('button');
    if (!b) {
      if (ev.target === $('u5')) { closeU5(); updatePanel(); }          // stuknięcie w rozmyte tło zamyka
      return;
    }
    if (b.disabled) return;
    if (b.hasAttribute('data-pick')) {
      GAME.choose(sel, +b.getAttribute('data-pick'));
      say('upgrade', true);
      persist(); u5.view = 'orbs'; u5.sure = false;
      hint('✓ Ulepszono', 1400); renderU5(); updatePanel();
      return;
    }
    var a = b.getAttribute('data-u');
    if (a !== 'sell') { u5.sure = false; say('tap'); }
    if (a === 'close') closeU5();
    else if (a === 'up') { u5.view = 'cards'; u5.info = false; renderU5(); }
    else if (a === 'later') { u5.view = 'orbs'; renderU5(); }
    else if (a === 'reroll') { if (GAME.reroll(sel)) { persist(); renderU5(); } }
    else if (a === 'mode') { sel.mode = sel.mode === 'strong' ? 'first' : 'strong'; persist(); renderU5(); }
    else if (a === 'info') { u5.info = !u5.info; renderU5(); }
    else if (a === 'sell') {
      if (u5.sure) { GAME.sell(sel); closeU5(); persist(); say('sell', true); }
      else {
        u5.sure = true; renderU5();
        var asked = sel;
        setTimeout(function () { if (sel === asked && u5.sure) { u5.sure = false; renderU5(); } }, 2500);
      }
    }
    updatePanel();
  });

  /* ---------- zapis ---------- */
  function persist() { var s = GAME.save(); if (s) store(SAVE, s); }
  function startWave() {
    if (!S() || S().phase !== 'build' || S().result) return;
    persist();                      // wznowienie w trakcie fali wraca tuż przed nią
    setDrawer(false);
    if (GAME.startWave()) { buildType = null; waveText(S().wave); say('wave', true); updatePanel(); }
  }

  /* ---------- okna ---------- */
  var introT = null;
  function show(html, kind, full) { modal = kind; $('box').innerHTML = html; $('ov').className = 'on' + (full ? ' full' : ''); $('ov').scrollTop = 0; updateGlow(); }
  function hide() { modal = null; $('ov').className = ''; updatePanel(); }
  function pathKey() { return '<div class="legend-key">' + DATA.PATH_IDS.map(function (id) { return '<span style="border-color:' + DATA.PATHS[id].col + '">' + DATA.PATHS[id].n + '</span>'; }).join('') + '</div>'; }

  /* intro: logo → nazwa gry → menu główne; twarde cięcia, stuknięcie przeskakuje */
  function intro(step) {
    clearTimeout(introT);
    if (step === 0) show('<div class="scr logo" data-a="skip"><div class="name">m<i>AI</i>n<i>IA</i>c</div><div class="dev">dev<i>_</i></div></div>', 'intro-logo', true);
    else if (step === 1) {
      show('<div class="scr titlescr" data-a="skip"><canvas id="tcastle" width="380" height="440"></canvas><h2>OSTATNI BASTION</h2></div>', 'intro-title', true);
      thumb($('tcastle'), 'castle_crown');
    } else { mainMenu(); return; }
    introT = setTimeout(function () { intro(step + 1); }, 2000);
  }
  var menuMap = null;
  function drawMenuMap(c) {
    if (!menuMap) menuMap = { road: Roads.cellsOf(Roads.random(function () { return Math.random(); }).nodes), seed: 7 + (Math.random() * 1000 | 0) };
    c.width = 640; c.height = 395;
    var g = c.getContext('2d'); g.scale(0.5, 0.5);
    paintGround(g, DATA.THEMES[0], menuMap.road, menuMap.seed);
  }
  /* tło menu głównego (G17): ta sama łąka z wieżami przy drodze i wrogami na drodze */
  function drawBattle(c) {
    drawMenuMap(c);
    var g = c.getContext('2d'), road = menuMap.road, set = {}, list = [], seed = menuMap.seed;
    function rnd() { seed = (seed * 16807 + 11) % 2147483647; return (seed & 0xffff) / 0x10000; }
    road.forEach(function (p) { set[p[0] + ',' + p[1]] = 1; });
    var kinds = ['archer', 'bombard', 'lookout', 'windmill'], placed = [];
    for (var i = 2; i < road.length - 2 && placed.length < 8; i += 3) {
      var side = [[0, -1], [0, 1], [1, 0], [-1, 0]].filter(function (d) {
        var x = road[i][0] + d[0], y = road[i][1] + d[1];
        return x >= 0 && x < 16 && y >= 0 && y < 9 && !set[x + ',' + y] && !placed.some(function (q) { return Math.abs(q[0] - x) + Math.abs(q[1] - y) < 2; });
      })[0];
      if (!side) continue;
      var tx = road[i][0] + side[0], ty = road[i][1] + side[1];
      placed.push([tx, ty]);
      list.push({ name: 't_crown_' + kinds[placed.length % 4], x: sx(tx), y: sy(ty) + 22 });
    }
    for (var j = 1; j < road.length - 3; j += 2) if (rnd() < 0.6) list.push({ name: 'e_aliens_' + (rnd() * 3 | 0) + '_r_' + (rnd() * 6 | 0), x: sx(road[j][0]) + (rnd() - 0.5) * 30, y: sy(road[j][1]) + FOOT });
    var end = road[road.length - 1];
    for (var c2 = 0; c2 < 16; c2++) for (var r2 = 0; r2 < 9; r2++) {      // drzewa z dala od drogi i zamku
      var far = !road.some(function (z) { return Math.abs(z[0] - c2) <= 1 && Math.abs(z[1] - r2) <= 1; }) && (Math.abs(c2 - end[0] - 2) > 2 || Math.abs(r2 - end[1]) > 2);
      if (far && rnd() < 0.3) list.push({ name: 'd_meadow_' + (rnd() * 6 | 0), x: sx(c2), y: sy(r2) + 22 });
    }
    list.push({ name: 'castle_crown', x: sx(end[0]) + CW * 1.4, y: sy(end[1]) + 52 });
    list.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { sprite(g, o.name, o.x, o.y, 1); });
  }

  /* ---------- menu główne (G17): S5, a przy zapisanej grze Hardcore S10 „Żar” ---------- */
  var MENU_ICO = {
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    fresh: '<path d="M4 4l10 10M20 4 10 14M6.5 13.5l4 4M17.5 13.5l-4 4M8.5 15.5 4.5 19.5M15.5 15.5l4 4"/>',
    rank: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3.5 4M17 6h3a3 3 0 0 1-3.5 4M12 14v4M8 20h8"/>',
    set: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    who: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 5a3 3 0 0 1 0 6M18 14c2.3.8 3.5 2.8 3.5 6"/>'
  };
  function mico(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + MENU_ICO[name] + '</svg>'; }
  function savedData() {
    var text = fetchStore(SAVE), info = savedInfo(text);
    return info ? { info: info, hc: !!(DATA.DIFF[JSON.parse(text).diff] || {}).hc } : null;
  }
  /* żar unoszący się od dołu ekranu albo od dołu pytania */
  function emberHTML(n, x0, w, y0, h, rise) {
    var seed = 5, out = '';
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < n; i++) {
      var z = 3 + (rnd() * 4 | 0), du = 2.4 + rnd() * 2.4;
      out += '<i class="mem" style="left:' + (x0 + rnd() * w | 0) + 'px;top:' + (y0 + rnd() * h | 0) + 'px;width:' + z + 'px;height:' + z + 'px;--dx:' + (rnd() * 100 - 50 | 0) + 'px;--dy:-' + rise + 'px;animation-duration:' + du.toFixed(2) + 's;animation-delay:-' + (rnd() * du).toFixed(2) + 's;background:' + ['#ffd23f', '#ff8a1e', '#ff5a1e'][i % 3] + '"></i>';
    }
    return out;
  }
  function screenBase(kind, inner, hot, corner) {
    tickClock(); saveClock();
    closeU5(); setW2('idle'); buildType = null; drag = null; hover = null; setDrawer(false);
    $('fx').innerHTML = ''; $('hint').className = '';
    show('<canvas id="menubg" class="soft"></canvas><div class="shade mshade"></div><div class="sel915 main">' + inner + '</div>' + (corner || ''), kind, true);
    $('box').className = hot ? 'hot' : '';
    drawBattle($('menubg'));
  }
  function mainMenu() {
    var sv = savedData(), hot = !!(sv && sv.hc);
    var html = (hot ? emberHTML(26, 0, 910, 300, 116, 280) : '') + '<div class="mtitle">OSTATNI<br>BASTION</div><i class="mline"></i>';
    html += '<button class="mbig mcont" data-a="resume"' + (sv ? '' : ' disabled') + '>' + mico('play') + '<span><b>Kontynuuj</b><small>' + (sv ? sv.info : 'brak zapisu') + '</small></span></button>';
    html += '<button class="mbig mnew" data-a="newgame">' + mico('fresh') + '<span><b>Nowa gra</b></span></button>';
    [['rank', 'Ranking'], ['set', 'Ustawienia'], ['who', 'Autorzy']].forEach(function (m, i) {
      html += '<button class="mrow" data-a="' + m[0] + '" style="top:' + (306 + i * 35) + 'px">' + mico(m[0]) + m[1] + '</button>';
    });
    /* pytanie Q9 „W miejscu”: rozwija się pod „Nowa gra”, gdy jest zapisana gra */
    if (sv) html += '<div class="ask">' + (hot ? emberHTML(16, 0, 430, 80, 34, 120) : '') + '<b>Zastąpić zapisaną grę?</b><small>' + sv.info + '</small><button class="red" data-a="replace">Zastąp</button><button data-a="askno">Anuluj</button></div>';
    /* wyjście tylko w aplikacji: X1, a w menu z żarem X10 */
    screenBase('main', html, hot, APP ? '<button class="mexit" data-a="exit" aria-label="Wyjście z gry">' + DOOR + '<span>Wyjście</span></button>' : '');
  }
  function askNew(open) {
    var m = $('box').querySelector('.main');
    if (m) m.classList.toggle('asking', open);
  }
  function askOpen() { var m = $('box').querySelector('.main'); return !!(m && m.classList.contains('asking')); }
  function subScreen(kind, title, inner) {
    screenBase(kind, '<div class="stitle">' + title + '</div><i class="mline sline"></i>' + inner + '<button class="mrow back" data-a="tomenu">‹ Wstecz</button>', false);
  }
  function setRow(key, ico, label, top) {
    var on = cfg[key] === true;
    return '<button class="setrow' + (on ? ' on' : '') + '" data-a="' + key + '" style="top:' + top + 'px" aria-pressed="' + on + '"><i>' + ico + '</i>' + label + '<em>' + (on ? 'włączone' : 'wyłączone') + '</em></button>';
  }
  function settingsScreen() {
    subScreen('settings', 'Ustawienia', '<label class="setrow nickrow" style="top:100px"><i>👤</i>Nick<input id="nick" maxlength="' + NICK_MAX + '" placeholder="Anonim" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + cfg.nick + '"></label>' +
      setRow('sound', '🔊', 'Dźwięk', 142) + setRow('vib', '📳', 'Wibracje', 184) + setRow('share', '🌍', 'Wysyłaj wyniki do rankingu', 226) +
      '<button class="setrow" data-a="help" style="top:268px"><i>❓</i>Jak grać<em>›</em></button>' +
      (APP ? '' : '<button class="setrow" data-a="full" style="top:310px"><i>⛶</i>Pełny ekran<em>›</em></button>'));
  }
  /* nick trafia do HTML, więc znaki specjalne odpadają */
  var NICK_MAX = ONLINE.NICK_MAX, cleanNick = ONLINE.cleanNick;
  $('ov').addEventListener('input', function (ev) {
    if (ev.target.id !== 'nick' && ev.target.id !== 'gamenick') return;
    var v = cleanNick(ev.target.value);
    if (v !== ev.target.value) ev.target.value = v;
    if (ev.target.id === 'nick') { cfg.nick = v; store(SET, JSON.stringify(cfg)); }       // Ustawienia i pytanie o zgodę
  });
  $('ov').addEventListener('keydown', function (ev) { if ((ev.target.id === 'nick' || ev.target.id === 'gamenick') && ev.key === 'Enter') ev.target.blur(); });
  function keepGameNick() {
    var inp = $('gamenick');
    if (!inp) return;                   // „Jeszcze raz” po grze: zostaje ostatnio użyty
    cfg.nick = cleanNick(inp.value).trim();
    store(SET, JSON.stringify(cfg));
  }
  function shownNick() { return cfg.nick.trim() || 'Anonim'; }
  function authorsScreen() {
    subScreen('authors', 'Autorzy', '<div class="credits"><b class="studio">m<i>AI</i>n<i>IA</i>c dev</b><b>Claudiusz Sonnet V Wielki</b><span>Grafiki: KayKit, Kay Lousberg (licencja CC0)</span></div>');
  }
  /* Ranking: szkic R6 „Złoto, srebro, brąz” z kapsułą H5 (fala, serce z HP, czas). Lista publiczna z online.js. */
  var HEART = 'M12 21.4C12 21.4 1.8 15.2 1.8 8.4 1.8 5.3 4.2 3 7.2 3 9.2 3 11 4.1 12 5.9 13 4.1 14.8 3 16.8 3 19.8 3 22.2 5.3 22.2 8.4 22.2 15.2 12 21.4 12 21.4Z';
  var HEART_FIRE = '<svg width="0" height="0" style="left:0;top:0"><defs><linearGradient id="hfire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe46a"/><stop offset=".55" stop-color="#ff8a1e"/><stop offset="1" stop-color="#d8330f"/></linearGradient></defs></svg>';
  var rankTab = null, rankSrc = 'all';            // 'all' = wszyscy gracze, 'mine' = ten telefon
  var netState = 'idle', netAt = 0, NET_FRESH = 30000;
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function when(at, day) { var d = new Date(at); return (day ? two(d.getDate()) + '.' + two(d.getMonth() + 1) + ' ' : '') + two(d.getHours()) + ':' + two(d.getMinutes()); }
  /* e.nick pochodzi z sieci albo z Ustawień; oba przeszły przez cleanNick */
  function rankRow(e, i, y, nick, me) {
    var f = DATA.FACTIONS.filter(function (x) { return x.id === e.castle; })[0], size = i < 3 ? 38 : 22;
    if (!f) return '';
    return '<div class="rrow' + (i < 3 ? ' medal m' + (i + 1) : '') + (me ? ' me' : '') + '" style="top:' + y + 'px">' +
      '<b class="rpl">' + (i + 1) + '</b><canvas width="' + size * 2 + '" height="' + size * 2 + '" data-th="castle_' + f.id + '" role="img" aria-label="' + f.n + '"></canvas>' +
      '<b class="rnick">' + nick + (me ? '<em class="rty">TY</em>' : '') + '</b><b class="rdiff">' + DATA.DIFF[rankTab].n + '</b>' +
      '<span class="rcap"><span>fala ' + (+e.wave) + '</span><span class="rhp' + (e.hp > 0 ? '' : ' zero') + '" aria-label="HP zamku ' + (+e.hp) + '"><svg viewBox="0 0 24 24"><path d="' + HEART + '"/></svg><b>' + (+e.hp) + '</b></span><span class="rtime">' + clockText(+e.time) + '</span></span>' +
      '<b class="rpts">' + String(+e.score).replace(/\B(?=(\d{3})+$)/g, ' ') + '</b></div>';
  }
  function paintRank() {
    if (modal !== 'rank') return;
    var all = rankSrc === 'all', pub = all ? ONLINE.cached() : null, mine = ranking(), own = {};
    Object.keys(mine).forEach(function (k) { mine[k].forEach(function (e) { if (e.id) own[e.id] = true; }); });
    var list = all ? (pub ? pub.lists[rankTab] : []) : (mine[rankTab] || []).slice(0, 10), y = 60, html = '';
    list.forEach(function (e, i) {
      html += rankRow(e, i, y, all ? e.nick : cleanNick(e.nick) || shownNick(), all && !!own[e.id]);      // starsze wpisy nie mają nicku
      y += i < 3 ? 49 : 28;
    });
    if (!list.length) {
      var text = !all ? 'Brak wyników na tym poziomie.<br>Dokończ grę, a wynik pojawi się tutaj.'
        : !pub && netState === 'loading' ? 'Pobieram listę…'
          : !pub ? 'Nie udało się pobrać listy.<br>Sprawdź internet albo przełącz na „Mój telefon”.'
            : 'Nikt jeszcze nie ma wyniku na tym poziomie.' + (cfg.share === true ? '' : '<br>Wysyłanie swoich wyników włączysz w Ustawieniach.');
      html = '<div class="rempty">' + text + '</div>';
    }
    var waiting = all && netState !== 'loading' ? ONLINE.queue().length : 0;
    $('rstat').textContent = !all ? 'zapisane w telefonie' : waiting ? 'czeka na wysłanie: ' + waiting : netState === 'loading' ? 'pobieram…'
      : netState === 'fail' ? (pub ? 'brak sieci, z ' + when(pub.at, true) : 'brak połączenia') : pub ? 'stan z ' + when(pub.at, false) : '';
    $('rlist').innerHTML = html;
    Array.prototype.forEach.call($('rlist').querySelectorAll('canvas[data-th]'), function (c) { thumb(c, c.getAttribute('data-th')); });
  }
  /* najpierw wysyła to, co czeka, potem pobiera listę; świeżej nie pobiera drugi raz */
  function refreshRank() {
    if (rankSrc !== 'all' || netState === 'loading' || (netState === 'ok' && Date.now() - netAt < NET_FRESH)) return;
    netState = 'loading';
    paintRank();
    var sent = cfg.share === true ? ONLINE.flush() : Promise.resolve();
    sent.then(ONLINE.load).then(function () { netState = 'ok'; netAt = Date.now(); paintRank(); }, function () { netState = 'fail'; paintRank(); });
  }
  function rankScreen(tab) {
    var ids = Object.keys(DATA.DIFF);
    rankTab = DATA.DIFF[tab] ? tab : DATA.DIFF[pick.diff] ? pick.diff : 'normal';
    var hot = !!DATA.DIFF[rankTab].hc;
    var html = HEART_FIRE + '<button class="rback" data-a="tomenu">‹ Wstecz</button><div class="rtitle">Ranking</div>' +
      '<button class="rsrc" data-a="rsrc" aria-label="Zmień listę: wszyscy gracze albo ten telefon">' + (rankSrc === 'all' ? '🌍 Wszyscy' : '📱 Mój telefon') + ' ⇄</button><div class="rsub" id="rstat"></div>';
    ids.forEach(function (k, i) {
      html += '<button class="rtab' + (k === rankTab ? ' on' : '') + (DATA.DIFF[k].hc ? ' rhc' : '') + '" data-rt="' + k + '" aria-pressed="' + (k === rankTab) + '" style="left:' + (430 + i * 119) + 'px">' + (DATA.DIFF[k].hc ? '☠ <b class="fire">' + DATA.DIFF[k].n + '</b>' : DATA.DIFF[k].n) + '</button>';
    });
    screenBase('rank', html + '<div class="rlist" id="rlist"></div>' + (hot ? emberHTML(22, 0, 910, 300, 116, 280) : ''), hot);
    paintRank();
    refreshRank();
  }
  function inMenu() { return /^(main|menu|settings|authors|rank|help)$/.test(modal) || (modal === 'exitask' && exitFrom === 'menu'); }

  /* ---------- zegar Hardcore ---------- */
  /* Do rankingu liczy się prawdziwy czas gry. Nie zatrzymuje go pauza, panel wieży, okno w grze ani zejście aplikacji w tło;
     stoi tylko, gdy gra jest zamknięta (menu główne, wyjście). Leży też obok zapisu, bo zapis powstaje przed falą,
     a czas przerwanej fali nie może przepaść. */
  var CLOCK = 'bib-demo2-clock', wall = Date.now(), clockSaved = 0;
  function tickClock() {
    var t = Date.now(), d = Math.max(0, (t - wall) / 1000), s = S();
    wall = t;
    if (!s || !s.hc || s.result || inMenu() || /^intro/.test(modal)) return;
    s.real += d;
    if (s.phase === 'wave') {           // czas bieżącej fali; przy powtórce tej samej fali rośnie dalej
      if (s.wn !== s.wave) { s.wn = s.wave; s.wt = 0; }
      s.wt += d;
    }
    if (t - clockSaved > 1000) saveClock();
  }
  function saveClock() {
    var s = S();
    if (!s || !s.hc || s.result) return;
    clockSaved = Date.now();
    store(CLOCK, JSON.stringify({ seed: s.seed, real: s.real, wn: s.wn, wt: s.wt }));
  }
  function loadClock() {
    var s = S(), c = null;
    try { c = JSON.parse(fetchStore(CLOCK) || 'null'); } catch (e) { }
    if (s.hc && c && c.seed === s.seed && c.real > s.real) { s.real = c.real; s.wn = c.wn || 0; s.wt = c.wt || 0; }
  }

  /* ---------- wyniki w telefonie: osobne top 10 dla każdej trudności ---------- */
  var RANK = 'bib-demo2-rank';
  function ranking() {
    try { var r = JSON.parse(fetchStore(RANK) || '{}'); return r && typeof r === 'object' ? r : {}; } catch (e) { return {}; }
  }
  /* kolejność: najdalsza fala, potem więcej HP zamku, potem krótszy czas (w Hardcore cały czas gry, poza nim sama walka) */
  function rankOrder(a, b) { return b.wave - a.wave || b.hp - a.hp || a.time - b.time; }
  function recordResult(s) {
    var all = ranking(), list = all[s.did] || [];
    var entry = { id: ONLINE.newId(), nick: shownNick(), castle: s.f.id, wave: s.wave, hp: s.hp, time: Math.round(s.hc ? s.real : s.fight), score: s.score, win: s.result === 'win', at: Date.now() };
    list.push(entry);
    all[s.did] = list.sort(rankOrder).slice(0, 10);
    store(RANK, JSON.stringify(all));
    return entry;
  }

  function renameEntry(w, nick) {
    w.entry.nick = nick;
    var all = ranking();
    (all[w.diff] || []).forEach(function (e) { if (e.id === w.entry.id) e.nick = nick; });
    store(RANK, JSON.stringify(all));
  }

  /* ---------- publiczny ranking: zgoda i wysyłka ---------- */
  var consentWait = null;
  function sendResult(w) {
    var e = w.entry;
    ONLINE.add({ game: 'ostatni-bastion-demo', id: e.id, nick: e.nick, diff: w.diff, castle: e.castle, wave: e.wave, hp: e.hp, time: e.time, score: e.score });
    netAt = 0;                          // przy następnym otwarciu rankingu pobierz listę od nowa
    ONLINE.flush();
  }
  /* pytanie przed pierwszym wysłaniem; potem decyduje przełącznik w Ustawieniach */
  function consentScreen() {
    plain('<h1>Publiczny ranking</h1><p style="font-size:14px;color:#fff">Czy Twoje wyniki mają być widoczne dla wszystkich graczy?<br>Po każdej skończonej grze wyślemy: <b>nick, trudność, zamek, falę, HP zamku, czas i punkty</b> (z losowym numerem wpisu).</p>' +
      '<p>Lista działa na serwerach Google. Decyzję zmienisz w Ustawieniach.</p>' +
      '<label class="asknick">Nick <input id="nick" maxlength="' + NICK_MAX + '" placeholder="Anonim" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + cfg.nick + '"></label>' +
      '<div class="btns"><button data-a="share-no">Nie wysyłaj</button><button class="main" data-a="share-yes">Wysyłaj</button></div>', 'consent');
  }
  function consentAnswer(yes) {
    var w = consentWait;
    consentWait = null;
    cfg.share = yes;
    store(SET, JSON.stringify(cfg));
    if (!w) { mainMenu(); return; }
    renameEntry(w, shownNick());        // w pytaniu można było jeszcze poprawić nick
    if (yes) sendResult(w); else ONLINE.clear();
    plain(w.html, 'end');
  }

  /* wybór zamku: tło i pozostałe zamki rozmyte, ostry tylko wybrany; w Hardcore dochodzi żar */
  function menuScreen() {
    closeU5(); setW2('idle'); buildType = null; drag = null; hover = null; setDrawer(false);
    $('fx').innerHTML = ''; $('hint').className = '';
    var hc = pick.diff === 'hardcore';
    var html = '<canvas id="menubg"></canvas><div class="shade"></div><div class="sel915"><h1>Wybierz zamek</h1>';
    DATA.FACTIONS.forEach(function (f, i) {
      html += '<button class="fc' + (pick.faction === f.id ? ' on' : '') + '" data-f="' + f.id + '" style="left:' + (20 + i * 222) + 'px"><canvas width="300" height="320" data-th="castle_' + f.id + '"></canvas><b>' + f.n + '</b><span>' + f.trait + '</span><span class="gate">★ ' + f.leg.n + '</span><span class="hpl">🔥 start: 1 / ' + (20 + (f.hp || 0)) + ' HP</span></button>';
    });
    var xs = [[14, 78], [98, 94], [198, 74], [278, 112]];
    Object.keys(DATA.DIFF).forEach(function (k, i) { html += '<button class="df' + (pick.diff === k ? ' on' : '') + '" data-d="' + k + '" style="left:' + xs[i][0] + 'px;width:' + xs[i][1] + 'px">' + (k === 'hardcore' ? '☠ <b class="fire">' + DATA.DIFF[k].n + '</b>' : DATA.DIFF[k].n) + '</button>'; });
    /* nick na tę grę; zapamiętuje się dopiero po „Graj”, więc „Wstecz” nie zmienia ostatnio użytego */
    html += '<label class="selnick">Nick <input id="gamenick" maxlength="' + NICK_MAX + '" placeholder="Anonim" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="' + cfg.nick + '"></label>';
    html += '<button class="play" data-a="new" style="left:400px;width:300px"' + (pick.faction ? '' : ' disabled') + '>▶ Graj</button>';
    html += '<button class="df" data-a="tomenu" style="left:712px;width:189px">‹ Wstecz</button></div>';
    show(html, 'menu', true);
    $('box').className = (pick.faction ? 'picked ' : '') + (hc ? 'ishc' : '');
    drawMenuMap($('menubg'));
    Array.prototype.forEach.call($('box').querySelectorAll('canvas[data-th]'), function (c) { thumb(c, c.getAttribute('data-th')); });
  }
  /* krótki opis zapisu na przycisku „Kontynuuj”; null, gdy zapisu nie da się odczytać */
  function savedInfo(text) {
    try {
      var d = JSON.parse(text);
      if (!d || d.v !== 2) return null;
      var f = DATA.FACTIONS.filter(function (x) { return x.id === d.faction; })[0];
      return 'przed falą ' + (d.wave + 1) + ' · ' + DATA.DIFF[d.diff].n + (f ? ' · ' + f.n.split(' ')[1] : '');
    } catch (e) { return null; }
  }
  function pickMenu() {
    var box = $('box');
    box.className = (pick.faction ? 'picked ' : '') + (pick.diff === 'hardcore' ? 'ishc' : '');
    Array.prototype.forEach.call(box.querySelectorAll('[data-f]'), function (b) { b.classList.toggle('on', b.getAttribute('data-f') === pick.faction); });
    Array.prototype.forEach.call(box.querySelectorAll('[data-d]'), function (b) { b.classList.toggle('on', b.getAttribute('data-d') === pick.diff); });
    box.querySelector('[data-a="new"]').disabled = !pick.faction;
    updateGlow();
  }
  /* Okna nad grą; wszystko związane z Hardcore ma ogniste nagłówki (klasa hot). */
  function plain(html, kind) {
    var sv = savedData(), hot = kind === 'exitask' && exitFrom === 'menu' ? !!(sv && sv.hc) : kind !== 'help' && !!(S() && S().hc);
    $('box').className = hot ? 'hot' : '';
    show(html, kind);
  }
  function helpScreen() {
    plain('<h1>Jak grać</h1><p style="text-align:left">• <b>Budowa:</b> stuknij „Wieże”, potem przeciągnij wieżę z paska na planszę (można też stuknąć wieżę, a potem pole). Na czas stawiania plansza wypełnia ekran i przesuwa się za palcem; żeby anulować, puść w lewym górnym rogu.<br>' +
      '• <b>Przestawianie:</b> między falami przeciągnij wieżę na inne pole. Za darmo.<br>• <b>Przycisk fali:</b> krótkie stuknięcie uruchamia falę. Przytrzymanie przez 2 s zatrzymuje grę i pokazuje prędkość i menu.<br>' +
      (APP ? '• <b>„Wstecz” w telefonie:</b> tylko zatrzymuje grę. Wznawiasz przyciskiem fali, do menu wchodzisz kółkiem „Menu”.<br>• <b>Wyjście:</b> grę zamyka czerwony przycisk w menu głównym albo w menu przycisku fali.<br>' : '') +
      '• <b>Punkty:</b> za pokonanych wrogów z fali i bossów (przywołani przez bossa i powstali z rozpadu nie liczą się). Po każdej odpartej fali dostajesz ' + DATA.SCORE.hp + ' pkt za każde HP zamku i ' + DATA.SCORE.time + ' pkt za każdą sekundę przed limitem fali. Limit to czas, w którym wyjdą wszyscy wrogowie i można by przejść całą drogę wolnym marszem. W Hardcore do czasu fali liczą się też pauzy.<br>' +
      '• <b>Limit:</b> miejsc przybywa z falami (3, 4, 5, 6, 7), od fali 15 dochodzi miejsce na bramę. Najwyżej 3 wieże jednego rodzaju.<br>' +
      '• <b>Brama:</b> staje na prostej drodze i zajmuje po jednym polu z obu stron. Atakuje pod łukiem i po 2 kratki drogi przed i za nim.<br>' +
      '• <b>Ulepszenia:</b> stuknij wieżę. Pierwszy wybór wyznacza ścieżkę. Kolor obramówki to ścieżka: cienka to poziom I, gruba II–III, z poświatą IV.<br>' +
      '• <b>Reakcje:</b> Mróz + Stal (+25% Stali w spowolnionych), Ogień + Trucizna (wybuch), Mróz + Piorun (dodatkowy przeskok). Ogień zdejmuje spowolnienie.<br>' +
      '• <b>Ranking:</b> lista „Wszyscy” wymaga internetu. Swoje wyniki wysyłasz tylko za zgodą; zmienisz to w Ustawieniach. „Mój telefon” działa bez internetu.<br>' +
      '• <b>Sąsiedztwo:</b> każda inna ścieżka obok to +8% obrażeń (do +24%).<br>' +
      '• <b>Hardcore:</b> zamek zaczyna z 1 HP i płonie, dopóki ma 30% HP lub mniej. Wrogowie są mocniejsi, bossowie mają losową odporność, a pokonany boss daje +2 HP. Do rankingu liczy się cały czas gry, także pauza; zegar stoi tylko w menu głównym i po wyjściu z gry.</p>' + pathKey() +
      '<div class="btns"><button class="main" data-a="set">Wróć</button></div>', 'help');
  }
  function startInfo() {
    var s = S();
    plain('<h1>' + s.theme.n + '</h1><p style="font-size:15px;color:#fff">Wrogowie: <b>' + s.ef.n + '</b><br>' + s.ef.d + '</p>' +
      (s.hc ? '<p style="color:#ffb08a"><b>Hardcore:</b> zamek zaczyna z 1 HP i płonie. Lecz go nagrodami za awans zamku; każdy pokonany boss daje +2 HP.</p>' : '') +
      '<p>Droga została wylosowana. Obejrzyj ją i postaw wieże tam, gdzie obejmą jak najwięcej kratek.</p>' + pathKey() + '<div class="btns"><button class="main" data-a="close">Do boju</button></div>', 'start');
  }
  function castleScreen() {
    var o = GAME.castleOffer();
    if (!o) return;
    var html = '<h1>Awans zamku</h1><p>Wybierz jedną nagrodę.</p><div class="grid3">';
    o.forEach(function (c, i) { html += '<button class="reward" data-castle="' + i + '"><b>' + c.n + '</b><span>' + c.d + '</span></button>'; });
    html += '</div><div class="btns"><button data-a="close">Później</button></div>';
    plain(html, 'castle');
  }
  function clockText(sec) { var t = Math.round(sec); return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }
  function endScreen() {
    var s = S(), win = s.result === 'win';
    store(SAVE, null); store(CLOCK, null);
    var entry = recordResult(s);
    closeU5(); setW2('idle'); buildType = null; drag = null;
    say(win ? 'win' : 'lose', true);
    var paths = {};
    s.towers.forEach(function (t) { if (t.path) paths[DATA.PATHS[t.path].n] = (paths[DATA.PATHS[t.path].n] || 0) + 1; });
    var html = ('<h1>' + (win ? 'Bastion obroniony!' : 'Zamek padł') + '</h1><p style="font-size:15px;color:#fff">' + s.f.n + ' · ' + s.diff.n + '<br>' + s.theme.n + ' · ' + s.ef.n + '<br>Fala ' + s.wave + ' z ' + DATA.WAVES + ' · pokonani: ' + s.kills + ' · HP zamku: ' + s.hp + '/' + s.hpMax +
      '<br><b style="color:#f4c54e;font-size:17px">Wynik: ' + s.score + ' pkt</b> · ' + (s.hc ? 'czas gry ' + clockText(s.real) : 'czas walki ' + clockText(s.fight)) +
      '<br><span style="font-size:12px">za pokonanych ' + (s.score - s.scoreHp - s.scoreTime) + ' · za HP zamku ' + s.scoreHp + ' · za czas fal ' + s.scoreTime + '</span>' +
      '<br>Wieże: ' + s.towers.length + (Object.keys(paths).length ? ' · ścieżki: ' + Object.keys(paths).map(function (k) { return k + ' ×' + paths[k]; }).join(', ') : '') + '</p><div class="btns"><button class="main" data-a="again">Jeszcze raz</button><button data-a="tomenu">Menu główne</button></div>');
    var w = { entry: entry, diff: s.did, html: html };
    if (cfg.share === null) { consentWait = w; consentScreen(); return; }
    if (cfg.share) sendResult(w);
    plain(html, 'end');
  }
  function begin() {
    closeU5(); setW2('idle'); buildType = null; drag = null; hover = null; speed = 1; setDrawer(false);
    $('fx').innerHTML = '';
    buildGround(); initPanel(); updatePanel();
    lastPhase = S().phase;
    wall = Date.now();
  }
  function newGame() {
    var last = {};
    try { last = JSON.parse(fetchStore(LAST) || '{}'); } catch (e) { }
    store(CLOCK, null);
    GAME.newGame({ faction: pick.faction, diff: pick.diff, lastTheme: last.t, lastEnemy: last.e });
    store(LAST, JSON.stringify({ t: S().theme.id, e: S().ef.id }));
    store(PICK, JSON.stringify(pick));
    begin(); persist(); startInfo();
  }
  function fullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req || document.fullscreenElement) return;
    try {
      var p = req.call(el);
      if (p && p.then) p.then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { }); }).catch(function () { });
    } catch (e) { }
  }
  function coarse() { return !APP && window.matchMedia && matchMedia('(pointer:coarse)').matches; }
  $('ov').addEventListener('click', function (ev) {
    var b = ev.target.closest('button,[data-a]');
    if (!b || b.disabled) return;
    if (b.getAttribute('data-a') === 'skip') { intro(modal === 'intro-logo' ? 1 : 2); return; }
    say('tap');
    if (b.hasAttribute('data-f')) { pick.faction = b.getAttribute('data-f'); pickMenu(); return; }
    if (b.hasAttribute('data-d')) { pick.diff = b.getAttribute('data-d'); pickMenu(); return; }
    if (b.hasAttribute('data-rt')) { rankScreen(b.getAttribute('data-rt')); return; }
    if (b.hasAttribute('data-castle')) { GAME.castleChoose(+b.getAttribute('data-castle')); persist(); if (S().castle.pending) castleScreen(); else hide(); return; }
    var a = b.getAttribute('data-a');
    if (a === 'new' || a === 'again') { keepGameNick(); if (coarse()) fullscreen(); newGame(); }
    else if (a === 'resume') {
      var ok = null;
      try { ok = GAME.load(fetchStore(SAVE)); } catch (e) { ok = null; }
      if (!ok) { store(SAVE, null); mainMenu(); return; }
      if (coarse()) fullscreen();
      loadClock();
      pick.faction = S().f.id; pick.diff = S().did; begin(); hide();
    } else if (a === 'newgame') {       // zapis znika dopiero po „Graj” na wyborze zamku
      if (savedData()) askNew(!askOpen()); else menuScreen();
    } else if (a === 'replace') menuScreen();
    else if (a === 'askno') askNew(false);
    else if (a === 'rank') rankScreen();
    else if (a === 'rsrc') { rankSrc = rankSrc === 'all' ? 'mine' : 'all'; rankScreen(rankTab); }
    else if (a === 'share-yes' || a === 'share-no') consentAnswer(a === 'share-yes');
    else if (a === 'set') settingsScreen();
    else if (a === 'who') authorsScreen();
    else if (a === 'help') helpScreen();
    else if (a === 'tomenu') mainMenu();
    else if (a === 'exit') exitAsk('menu');
    else if (a === 'stay') exitStay();
    else if (a === 'quit') exitGame();
    else if (a === 'close') hide();
    else if (a === 'full') fullscreen();
    else if (a === 'sound' || a === 'vib' || a === 'share') {
      var key = a;
      cfg[key] = cfg[key] !== true;
      if (key === 'share' && !cfg.share) ONLINE.clear();       // wyłączenie kasuje też to, co jeszcze czeka na wysłanie
      store(SET, JSON.stringify(cfg));
      SFX.set(cfg.sound, cfg.vib);
      b.classList.toggle('on', cfg[key]);
      b.setAttribute('aria-pressed', cfg[key]);
      b.querySelector('em').textContent = cfg[key] ? 'włączone' : 'wyłączone';
      if (cfg[key]) { if (key === 'sound') SFX.play('done'); else if (key === 'vib') SFX.buzz('done'); }
    }
  });

  /* ---------- sterowanie planszą ---------- */
  function setFinger(ev) { var p = toStage(ev.clientX, ev.clientY); finger = { x: p.x, y: p.y, cx: ev.clientX, cy: ev.clientY }; }
  function canControl() { return !modal && S() && w2.state !== 'open' && !sel; }
  function tryBuild(type, cell) {
    var why = GAME.buildState(type) || GAME.placeState(type, cell.c, cell.r);
    if (why) { hint(why); say('bad', true); return false; }
    var t = GAME.build(type, cell.c, cell.r);
    if (t) { persist(); say('build', true); }
    updatePanel();
    return !!t;
  }
  function typeInfo(type) { var d = type === 'legend' ? S().f.leg : DATA.TOWERS[type]; return d.n + ': ' + d.d; }
  function buttonDown(ev) {
    if (!canControl()) return;
    var type = ev.currentTarget.getAttribute('data-type');
    drag = { type: type, x: ev.clientX, y: ev.clientY, moved: false, touch: ev.pointerType !== 'mouse', id: ev.pointerId };
    try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) { }
    ev.preventDefault();
  }
  /* Przyciski leżą na mapie, więc na części ekranów któryś zasłania wieżę. Między falami stuknięcie dokładnie w pole
     z wieżą wybiera wieżę (i nie uruchamia np. fali); reszta przycisku działa jak zwykle. */
  document.addEventListener('pointerdown', function (ev) {
    if (!canControl() || S().phase !== 'build' || buildType || !ev.target.closest) return;
    if (!ev.target.closest('#go,#twbtn,#boss,.sk')) return;
    var cell = cellAt(ev.clientX, ev.clientY), t = cell && GAME.towerAt(cell.c, cell.r);
    if (!t) return;
    ev.stopPropagation(); ev.preventDefault();
    setFinger(ev);
    drag = { tower: t, routed: true, x: ev.clientX, y: ev.clientY, moved: false, touch: ev.pointerType !== 'mouse', id: ev.pointerId };
  }, true);
  $('twbtn').addEventListener('click', function () { if (canControl()) { say('tap'); setDrawer(!drawerOpen); } });
  cv.addEventListener('pointerdown', function (ev) {
    if (!canControl()) return;
    if (drawerOpen) setDrawer(false);
    var cell = cellAt(ev.clientX, ev.clientY);
    if (!cell) return;
    ev.preventDefault();
    setFinger(ev);
    if (buildType) { hover = cell; drag = { place: true, type: buildType, x: ev.clientX, y: ev.clientY, moved: false, touch: ev.pointerType !== 'mouse', id: ev.pointerId }; return; }
    var t = GAME.towerAt(cell.c, cell.r);
    if (!t) {                         // wysoka wieża z pola poniżej zasłania to pole: stuknięcie w jej górę też ją wybiera
      var under = GAME.towerAt(cell.c, cell.r + 1);
      if (under) t = under;
    }
    if (t) drag = { tower: t, x: ev.clientX, y: ev.clientY, moved: false, touch: ev.pointerType !== 'mouse', id: ev.pointerId };
    else {
      var f = S().fields[cell.c + ',' + cell.r];
      if (f) hint(DATA.FIELDS[f].n + ': ' + DATA.FIELDS[f].d);
    }
  });
  document.addEventListener('pointermove', function (ev) {
    if (!canControl()) return;
    if (drag && ev.pointerId === drag.id) {
      setFinger(ev);
      if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 10) {
        if (drag.tower && S().phase !== 'build') { hint('Wieże można przestawiać tylko między falami'); drag = null; return; }
        if (drag.type && !drag.place) { var why = GAME.buildState(drag.type); if (why) { hint(why); drag = null; return; } buildType = null; }
        drag.moved = true;
        pan = 0;
        if (drag.tower) {             // przestawianie: przybliż tak, żeby wieża została pod palcem
          var k = L.bw / W, wy = sy(drag.tower.r) * k;
          pan = clamp(wy * L.zoom - (finger.y - liftAt(finger.y)), 0, panMax());
        }
        updatePlacing(0);
        SFX.buzz('pick');
      }
      if (drag.moved) hover = overCancel(finger) ? null : cellAt(ev.clientX, ev.clientY, drag.touch);
    } else if (buildType && ev.pointerType === 'mouse') hover = cellAt(ev.clientX, ev.clientY);
  });
  document.addEventListener('pointerup', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var d = drag;
    setFinger(ev);
    /* Telefon wysyła po puszczeniu palca jeszcze "kliknięcie" w to, co właśnie się pojawiło (panel, HUD): ignorujemy je. */
    if (d.touch || d.routed) ghostUntil = now() + 0.45;
    /* pole liczymy przy jeszcze przybliżonej planszy */
    var cell = d.moved ? (overCancel(finger) ? null : cellAt(ev.clientX, ev.clientY, d.touch)) : cellAt(ev.clientX, ev.clientY);
    drag = null;
    if (modal || !S()) return;
    if (d.place) {                    // tryb „stuknij wieżę, potem pole”
      if (d.moved && overCancel(finger)) buildType = null;
      else if (cell && tryBuild(d.type, cell)) buildType = null;
      hover = null;
    } else if (d.type) {
      if (d.moved) {
        if (cell) tryBuild(d.type, cell);
        hover = null; buildType = null;
        setDrawer(false);
      } else {
        var why = GAME.buildState(d.type);
        if (why) { hint(why + ' · ' + typeInfo(d.type), 3200); buildType = null; }
        else { setDrawer(false); buildType = d.type; hover = null; hint(typeInfo(d.type) + '. Stuknij pole albo przeciągnij.', 3000); }
      }
    } else if (d.tower) {
      if (d.moved) {
        if (cell) {
          var bad = GAME.placeState(d.tower.type, cell.c, cell.r, d.tower);
          if (bad) { hint(bad); say('bad', true); } else if (GAME.move(d.tower, cell.c, cell.r)) { persist(); say('build', true); }
        }
        hover = null;
      } else select(d.tower);
    }
    updatePlacing(0);
    updatePanel();
  });
  document.addEventListener('pointercancel', function () { drag = null; hover = null; });
  document.addEventListener('click', function (ev) { if (now() < ghostUntil) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  $('cancel').addEventListener('click', function () { buildType = null; drag = null; hover = null; });
  $('star').addEventListener('click', function () { if (canControl()) castleScreen(); });
  $('boss').addEventListener('click', function () { var b = GAME.nextBoss(); if (b) hint('Fala ' + b.wave + ': ' + b.name + '. ' + b.d + (b.resist ? ' Odporny na: ' + b.resist + ' (35% mniej obrażeń).' : ''), 4500); });
  $('rotok').addEventListener('click', function () { $('rot').className = ''; setTimeout(layout, 50); });
  document.addEventListener('keydown', function (ev) {
    if (modal) {
      if (ev.key === 'Escape') {
        if (modal === 'exitask') exitStay();
        else if (modal === 'castle' || modal === 'confirm' || modal === 'start') hide();
        else if (modal === 'main') askNew(false);
        else if (modal === 'help') settingsScreen();
        else if (modal === 'menu' || modal === 'settings' || modal === 'authors' || modal === 'rank') mainMenu();
      }
      return;
    }
    if (!S()) return;
    if (ev.key === 'Escape') {
      if (sel) closeU5(); else if (drawerOpen) setDrawer(false); else if (buildType) { buildType = null; hover = null; } else if (isOpen()) setW2('idle'); else openMenu();
    } else if (!canControl()) return;
    else if (ev.key === ' ') { ev.preventDefault(); startWave(); }
    else if (ev.key === 'q' || ev.key === 'e' || ev.key === 'r') GAME.skill(ev.key);
    else { var n = parseInt(ev.key, 10); if (n >= 1 && n <= 5) { var type = types()[n - 1], why = GAME.buildState(type); if (why) hint(why); else buildType = type; } }
    updatePanel();
  });
  document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); buildType = null; hover = null; });
  window.addEventListener('resize', layout);
  /* Aplikacja schodzi w tło: zapisz, wstrzymaj grę i dźwięk. */
  function appPause() {
    tickClock(); saveClock();
    if (S() && !S().result && !inMenu()) persist();
    if (S() && !modal && !S().result && !sel && !isOpen()) openMenu();
    SFX.suspend();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) appPause(); else awake = null; });
  window.addEventListener('pagehide', appPause);
  window.addEventListener('online', function () { if (cfg.share === true) ONLINE.flush(); netAt = 0; });
  ['pointerdown', 'pointerup', 'keydown'].forEach(function (n) { document.addEventListener(n, function () { SFX.unlock(); }, true); });
  /* Przycisk „Wstecz” w Androidzie (wariant K5): w grze tylko pauzuje i nic więcej. Nie wznawia, nie wychodzi do menu
     i nie zamyka aplikacji; wznawia przycisk fali, a do menu prowadzi kółko „Menu”. */
  function back() {
    if (S() && !modal && !S().result && !isOpen()) { openMenu(); updatePlacing(0); updatePanel(); }
    return 'ok';
  }

  /* ---------- pętla ---------- */
  var last = 0, panelT = 0, lastPhase = null, lastBanner = null;
  function frame(ts) {
    var dt = Math.min(0.1, (ts - last) / 1000 || 0);
    last = ts; clock += dt;
    tickClock();
    tickW2();
    var s = S();
    /* gra stoi, gdy otwarte jest okno, menu przycisku fali albo panel wieży */
    if (s && !modal && !s.result && !isOpen() && !sel) {
      var left = dt * speed;
      while (left > 1e-6) { var step = Math.min(1 / 30, left); GAME.update(step); left -= step; if (s.result) break; }
    }
    if (s) {
      if (lastPhase === 'wave' && s.phase === 'build' && !s.result) { persist(); waveDone(); say('done', true); }
      lastPhase = s.phase;
      if (s.banner && s.banner !== lastBanner && !modal) { lastBanner = s.banner; var msg = s.banner.text; setTimeout(function () { if (!modal) hint(msg, 3200); }, 1100); }
      if (sel && s.towers.indexOf(sel) < 0) closeU5();
      while (s.ev.length) { var cueName = s.ev.shift(); say(cueName); if (cueName === 'hurt' || cueName === 'boss') SFX.buzz(cueName); }
      if (s.result && !s.ended) { s.ended = true; endScreen(); }     // raz na grę: wynik zapisuje się tylko raz
    }
    keepAwake(!!(s && !modal && !s.result));
    updatePlacing(dt);
    draw();
    panelT -= dt;
    if (panelT <= 0) { panelT = 0.15; if (s) updatePanel(); }
    requestAnimationFrame(frame);
  }

  loadAssets(function () {
    try { var c0 = JSON.parse(fetchStore(SET) || 'null'); if (c0) { cfg.sound = c0.sound !== false; cfg.vib = c0.vib !== false; cfg.nick = cleanNick(c0.nick); cfg.share = c0.share === true ? true : c0.share === false ? false : null; } } catch (e) { }
    SFX.set(cfg.sound, cfg.vib);
    if (APP) document.body.classList.add('app');
    try { var p = JSON.parse(fetchStore(PICK) || 'null'); if (p && p.diff && DATA.DIFF[p.diff]) { pick.diff = p.diff; pick.faction = p.faction; } } catch (e) { }
    layout();
    intro(0);
    if (cfg.share === true) ONLINE.flush();
    requestAnimationFrame(frame);
  });
  window.__back = back;
  window.__appPause = appPause;
  window.__demo = {
    newGame: function (o) { clearTimeout(introT); pick.faction = o.faction; pick.diff = o.diff; GAME.newGame(o); begin(); hide(); },
    select: select, upgrade: function (t) { select(t); u5.view = 'cards'; renderU5(); }, refresh: function () { updatePanel(); updatePlacing(0); draw(); },
    menu: menuScreen, main: mainMenu, ranking: ranking, placing: function (type, cell) { buildType = type; hover = cell; }, resize: layout, openMenu: openMenu, waveText: waveText, waveDone: waveDone,
    state: function () { return { modal: modal, sel: sel, w2: w2.state, speed: speed, buildType: buildType, placing: isPlacing(), pan: pan, drawer: drawerOpen, layout: L }; },
    drawer: setDrawer,
    tick: function (ts) { frame(ts); }
  };
})();
