/* Logika demo Ostatniego Bastionu. Bez DOM: ten sam kod działa w przeglądarce i w bocie testowym (node).
   Współrzędne w kratkach siatki 16 x 9; środek kratki (c, r) to punkt (c, r). */
var GAME = (function (DATA, Roads) {
  'use strict';
  var COLS = 16, ROWS = 9;
  var S = null;

  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  function mulberry(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return list[0]; }
  function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var s = Math.random() * (k + 1) | 0, t = a[k]; a[k] = a[s]; a[s] = t; } return a; }
  function has(t, card) { return t.cards.indexOf(card) >= 0; }
  function fx(o) { if (S.fx.length < 220) { o.t = 0; S.fx.push(o); } }
  /* zdarzenia dla dźwięków i wibracji; odbiera je ui.js (bot je ignoruje) */
  function cue(name) { if (S.ev.length < 40) S.ev.push(name); }
  function say(text, boss) { S.banner = { text: text, t: 0, life: boss ? 3.2 : 2.2, boss: !!boss }; }

  /* ---------- droga i mapa ---------- */
  function buildRoad(nodes) {
    var cells = Roads.cellsOf(nodes), segs = [], len = 0, set = {}, i;
    for (i = 0; i < cells.length; i++) set[cells[i][0] + ',' + cells[i][1]] = 1;
    for (i = 1; i < cells.length; i++) {
      segs.push({ a: cells[i - 1], b: cells[i], s: len });
      len += 1;
    }
    return { nodes: nodes, cells: cells, segs: segs, len: len, set: set, castle: Roads.castleOf(nodes) };
  }
  function pathPos(d) {
    var P = S.road, i = Math.max(0, Math.min(P.segs.length - 1, Math.floor(d))), s = P.segs[i], k = Math.max(0, Math.min(1, d - s.s));
    return { x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k, dx: s.b[0] - s.a[0], dy: s.b[1] - s.a[1] };
  }
  function isCastle(c, r) { return S.road.castle.some(function (p) { return p[0] === c && p[1] === r; }); }
  function genFields(rnd) {
    var cand = [], c, r;
    for (c = 0; c < COLS; c++) for (r = 0; r < ROWS; r++) {
      if (S.road.set[c + ',' + r] || isCastle(c, r)) continue;
      var near = S.road.cells.some(function (p) { return Math.abs(p[0] - c) <= 1 && Math.abs(p[1] - r) <= 1; });
      if (near) cand.push([c, r]);
    }
    var kinds = ['hill', 'hill', 'hill', 'power', 'power', 'gold', 'rock', 'rock'], out = {};
    kinds.forEach(function (k) {
      if (!cand.length) return;
      var p = cand.splice(rnd() * cand.length | 0, 1)[0];
      out[p[0] + ',' + p[1]] = k;
    });
    return out;
  }
  function coveredCells(c, r, range) {
    var out = [];
    S.road.cells.forEach(function (p) { if (p[0] >= 0 && dist(c, r, p[0], p[1]) <= range + 0.3) out.push(p); });
    return out;
  }

  /* ---------- nowa gra ---------- */
  function pickOther(list, last, rnd) {
    var pool = list.filter(function (x) { return x.id !== last; });
    return pool[rnd() * pool.length | 0];
  }
  function newGame(opt) {
    var seed = opt.seed !== undefined ? opt.seed : (Math.random() * 1e9) | 0, rnd = mulberry(seed);
    var f = byId(DATA.FACTIONS, opt.faction), diff = DATA.DIFF[opt.diff] || DATA.DIFF.normal;
    var theme = opt.theme ? byId(DATA.THEMES, opt.theme) : pickOther(DATA.THEMES, opt.lastTheme, rnd);
    var enemy = opt.enemy ? byId(DATA.ENEMY_FACTIONS, opt.enemy) : pickOther(DATA.ENEMY_FACTIONS, opt.lastEnemy, rnd);
    var nodes = opt.nodes || Roads.random(rnd).nodes;
    S = { seed: seed, f: f, did: opt.diff || 'normal', diff: diff, theme: theme, ef: enemy, road: buildRoad(nodes),
      wave: 0, phase: 'build', gold: diff.gold, points: 0, towers: [], enemies: [], shots: [], patches: [], kegs: [], saws: [], fx: [],
      spawnQ: [], spawnT: 0, time: 0, kills: 0, tid: 1, result: null, banner: null, rerollFree: 1, rerollCost: 60,
      mods: { tdmg: f.mods.tdmg || 1, cost: f.mods.cost || 1, gold: f.mods.gold || 1, hdmg: f.mods.hdmg || 1, crit: f.mods.crit || 0, xp: f.mods.xp || 1 },
      hpMax: 20 + (f.hp || 0), hp: 20 + (f.hp || 0), castle: null, buffT: 0, buff: 0, hc: !!diff.hc, ev: [] };
    if (S.hc) S.hp = 1;
    S.fields = genFields(mulberry(seed + 7));
    var cc = S.road.castle;
    S.castle = { x: (cc[0][0] + cc[1][0]) / 2, y: (cc[0][1] + cc[2][1]) / 2, lvl: 1, xp: 0, need: 70, pending: 0, offer: null, sk: { q: 1, e: 0, r: 0 }, cd: { q: 0, e: 0, r: 0 }, atk: 0, dmgBonus: 0 };
    return S;
  }

  /* ---------- wieże ---------- */
  function def(t) { return t.type === 'legend' ? S.f.leg : DATA.TOWERS[t.type]; }
  /* Pola zajęte przez wieżę. Brama stoi na dwóch polach po bokach drogi ('v' = droga pionowa, filary z lewej i prawej). */
  function footprint(t) {
    if (t.type !== 'legend') return [[t.c, t.r]];
    return t.o === 'v' ? [[t.c - 1, t.r], [t.c + 1, t.r]] : [[t.c, t.r - 1], [t.c, t.r + 1]];
  }
  function towerAt(c, r) {
    for (var i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      if (t.type === 'legend' && t.c === c && t.r === r) return t;          // pod łukiem
      if (footprint(t).some(function (p) { return p[0] === c && p[1] === r; })) return t;
    }
    return null;
  }
  function touching(a, b) {
    var B = footprint(b);
    return footprint(a).some(function (p) { return B.some(function (q) { return Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1; }); });
  }
  function neighbors(t) { return S.towers.filter(function (o) { return o !== t && o.id !== t.id && touching(t, o); }); }
  function count(type) { return S.towers.filter(function (t) { return t.type === type; }).length; }
  function regularCount() { return S.towers.filter(function (t) { return t.type !== 'legend'; }).length; }
  function nextWave() { return S.phase === 'wave' ? S.wave : Math.min(DATA.WAVES, S.wave + 1); }
  function unlocked(type) {
    var w = nextWave(), idx = type === 'legend' ? 4 : S.f.tw.indexOf(type);
    return idx >= 0 && idx < DATA.typesAt(w);
  }
  function unlockWave(type) { return [1, 1, 3, 6, 15][type === 'legend' ? 4 : S.f.tw.indexOf(type)]; }
  function cost(type) {
    if (type === 'legend') return DATA.LEGEND_COST;
    return Math.round(DATA.TOWERS[type].cost * S.mods.cost * (1 + 0.15 * count(type)));
  }
  function buildState(type) {
    if (!unlocked(type)) return 'Odblokuje się w fali ' + unlockWave(type);
    if (type === 'legend') { if (count('legend') >= 1) return 'Legendę można mieć tylko jedną'; }
    else {
      if (count(type) >= 3) return 'Najwyżej 3 wieże tego rodzaju';
      if (regularCount() >= DATA.slotsAt(nextWave())) return 'Brak miejsca: limit ' + DATA.slotsAt(nextWave()) + ' zwykłych wież';
    }
    if (S.gold < cost(type)) return 'Za mało złota';
    return '';
  }
  function cellState(c, r, self) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return 'Poza planszą';
    if (S.road.set[c + ',' + r]) return 'Tu biegnie droga';
    if (isCastle(c, r)) return 'Tu stoi zamek';
    if (S.fields[c + ',' + r] === 'rock') return 'Głaz blokuje budowę';
    var o = towerAt(c, r);
    if (o && o !== self) return 'Pole zajęte';
    return '';
  }
  function sideState(c, r, self) {
    var why = cellState(c, r, self);
    return why === 'Tu biegnie droga' ? 'Obok musi być wolne miejsce, nie droga' : why;
  }
  /* Brama: kratka prostej drogi (c, r) i dwa wolne pola po bokach. Zwraca opis miejsca albo powód odmowy. */
  function gateSpot(c, r, self) {
    var P = S.road.cells, why = 'Brama staje nad drogą';
    for (var k = 1; k < P.length - 1; k++) {
      if (P[k][0] !== c || P[k][1] !== r || c < 0 || c >= COLS) continue;
      var a = P[k - 1], b = P[k + 1], o = a[0] === c && b[0] === c ? 'v' : a[1] === r && b[1] === r ? 'h' : null;
      if (!o) { why = 'Brama potrzebuje prostego odcinka drogi'; continue; }
      var sides = footprint({ type: 'legend', c: c, r: r, o: o });
      var bad = sideState(sides[0][0], sides[0][1], self) || sideState(sides[1][0], sides[1][1], self);
      if (!bad) return { k: k, o: o, why: '' };
      why = bad;
    }
    return { k: -1, o: null, why: why };
  }
  function gateSpots(self) {
    var out = [], seen = {};
    S.road.cells.forEach(function (p) {
      var key = p[0] + ',' + p[1];
      if (seen[key]) return;
      seen[key] = 1;
      var s = gateSpot(p[0], p[1], self);
      if (!s.why) out.push({ c: p[0], r: p[1], k: s.k, o: s.o });
    });
    return out;
  }
  /* Czy wieżę danego rodzaju można postawić na polu. Pusty napis = można. */
  function placeState(type, c, r, self) { return type === 'legend' ? gateSpot(c, r, self).why : cellState(c, r, self); }
  /* Kratki drogi w strefie bramy: pod łukiem i po 2 przed i za nim, liczone wzdłuż drogi. */
  function zoneCells(k) { return S.road.cells.slice(Math.max(0, k - 2), k + 3).filter(function (p) { return p[0] >= 0 && p[0] < COLS; }); }
  function inZone(t, e) { return Math.abs(e.d - t.k) <= 2.5; }

  function build(type, c, r) {
    if (S.result || buildState(type) || placeState(type, c, r)) return null;
    var price = cost(type);
    S.gold -= price;
    var t = { id: S.tid++, type: type, c: c, r: r, path: null, level: 0, cards: [], mastery: null, spentGold: price, spentPts: 0,
      cd: 0.3, mode: type !== 'legend' && DATA.TOWERS[type].strong ? 'strong' : 'first', offer: null, n: 0, freezeCd: 0, stormCd: 8, kegCd: 0.5, grateCd: 2, grateT: 0, anim: 0 };
    if (type === 'legend') { var sp = gateSpot(c, r); t.k = sp.k; t.o = sp.o; }
    S.towers.push(t);
    fx({ k: 'ring', x: c, y: r, max: 0.9, life: 0.4, col: S.f.col });
    return t;
  }
  function removeKegs(t) { S.kegs = S.kegs.filter(function (k) { return k.owner !== t.id; }); }
  function sellValue(t) { return { gold: Math.floor(t.spentGold * 0.7), pts: Math.max(0, t.spentPts - 1) }; }
  function sell(t) {
    var v = sellValue(t);
    S.gold += v.gold;
    S.points += v.pts;
    removeKegs(t);
    S.towers = S.towers.filter(function (o) { return o !== t; });
  }
  function move(t, c, r) {
    if (S.phase !== 'build' || placeState(t.type, c, r, t)) return false;
    if (t.c !== c || t.r !== r) removeKegs(t);
    if (t.type === 'legend') { var sp = gateSpot(c, r, t); t.k = sp.k; t.o = sp.o; }
    t.c = c; t.r = r;
    return true;
  }

  /* ---------- ulepszenia ---------- */
  function maxLevel(t) { return t.type === 'legend' ? 1 : 4; }
  function upCost(t) { return t.type === 'legend' ? 2 : 1; }
  function canUpgrade(t) { return t.level < maxLevel(t) && S.points >= upCost(t); }
  function makeOffer(t) {
    var P, out = [];
    if (t.type === 'legend') return S.f.leg.m.map(function (m) { return { kind: 'mastery', id: m[0], path: null, n: m[1], d: m[2] }; });
    if (t.level === 0) {
      return shuffle(DATA.PATH_IDS.slice()).slice(0, 3).map(function (id) {
        P = DATA.PATHS[id];
        return { kind: 'path', id: id, path: id, n: P.n, d: P.one };
      });
    }
    P = DATA.PATHS[t.path];
    if (t.level < 3) {
      out = shuffle(P.cards.filter(function (c) { return !has(t, c[0]); })).slice(0, 3);
      return out.map(function (c) { return { kind: 'card', id: c[0], path: t.path, n: c[1], d: c[2] }; });
    }
    return P.m.map(function (m) { return { kind: 'mastery', id: m[0], path: t.path, n: m[1], d: m[2] }; });
  }
  /* Oferta jest zapamiętana na wieży, więc zamknięcie okna nie losuje nowych kart. */
  function offer(t) {
    if (!canUpgrade(t)) return null;
    if (!t.offer) t.offer = makeOffer(t);
    return t.offer;
  }
  function canReroll(t) { return t.type !== 'legend' && t.level < 3 && (S.rerollFree > 0 || S.gold >= S.rerollCost); }
  function reroll(t) {
    if (!canReroll(t)) return false;
    if (S.rerollFree > 0) S.rerollFree--;
    else { S.gold -= S.rerollCost; S.rerollCost += 40; }
    t.offer = makeOffer(t);
    return true;
  }
  function choose(t, i) {
    var o = offer(t);
    if (!o || !o[i]) return false;
    var card = o[i];
    S.points -= upCost(t);
    t.spentPts += upCost(t);
    t.level++;
    if (card.kind === 'path') t.path = card.id;
    else if (card.kind === 'card') t.cards.push(card.id);
    else t.mastery = card.id;
    t.offer = null;
    removeKegs(t);
    fx({ k: 'ring', x: t.c, y: t.r, max: 1.1, life: 0.6, col: t.path ? DATA.PATHS[t.path].col : '#ffc21f' });
    return true;
  }

  /* ---------- statystyki wieży ---------- */
  function kindOf(t) { return t.type === 'legend' ? S.f.leg.kind : t.path ? DATA.PATHS[t.path].kind : 'phys'; }
  function mixBonus(t) {
    var seen = {}, n = 0;
    neighbors(t).forEach(function (o) { if (o.path && o.path !== t.path && !seen[o.path]) { seen[o.path] = 1; n++; } });
    return Math.min(0.24, n * 0.08);
  }
  function stats(t) {
    var d = def(t), s = { dmg: 0, rate: 0, range: d.range, min: d.min || 0, kind: kindOf(t), notes: [] };
    var dmg, rate, nb = neighbors(t), leg = t.type === 'legend';
    var mix = mixBonus(t);
    if (leg) { dmg = d.dmg; rate = 1 / d.tick; }
    else {
      dmg = d.dmg; rate = d.rate; s.splash = d.splash || 0;
      dmg *= DATA.LEVEL_DMG[t.level];
      if (t.path === 'steel') dmg *= 1.6;
      if (t.path === 'frost' || t.path === 'bolt') dmg *= 1.2;
      if (has(t, 'heart')) dmg *= 1.25;
      if (has(t, 'speed')) rate *= 1.35;
      if (has(t, 'range')) s.range *= 1.25;
      if (has(t, 'heavy')) { dmg *= 1.45; rate *= 0.85; }
    }
    s.boost = S.mods.tdmg * (1 + mix);
    dmg *= s.boost;
    if (mix) s.notes.push('Różne ścieżki obok: +' + Math.round(mix * 100) + '%');
    var field = leg ? null : S.fields[t.c + ',' + t.r];                       // brama nie korzysta z pól specjalnych
    if (field === 'hill') { s.range *= 1.2; s.notes.push('Wzgórze: +20% zasięgu'); }
    if (field === 'power') { rate *= 1.15; s.notes.push('Pole mocy: +15% tempa'); }
    if (S.buffT > 0) rate *= 1 + S.buff;
    if (!leg && S.f.leg.atk === 'toll') {
      var toll = nb.filter(function (o) { return o.type === 'legend'; })[0];
      if (toll) { var aura = toll.mastery === 'crew' ? 0.4 : S.f.leg.aura; rate *= 1 + aura; s.notes.push('Załoga Rogatki: +' + Math.round(aura * 100) + '% tempa'); }
    }
    s.dmg = dmg; s.rate = rate;
    return s;
  }

  /* ---------- obrażenia i efekty ---------- */
  function alive(e) { return !e.dead; }
  function hit(e, amount, kind, src, o) {
    if (e.dead || e.inv > 0 || amount <= 0) return 0;
    o = o || {};
    var res = (e.res && e.res[kind]) || 1;
    if (res < 1) {
      if (kind === 'phys' && src && (has(src, 'pierce') || (o.pierce))) res = 1;
      else if (kind === 'phys' && e.burn.length && e.melt) res = 1;
      else if (e.poisonT > 0) res = 1 - (1 - res) * (1 - e.shred);
    }
    amount *= res;
    if (o.splash && e.splashRes) amount *= e.splashRes;
    amount *= 1 + Math.min(0.35, (e.crackT > 0 ? 0.25 : 0) + (e.rotT > 0 ? 0.2 : 0));
    if (e.mark && src && src.type !== 'legend') amount *= 1 + e.mark;               // znacznik Bramy Strzelców
    if (!o.dot && src && src.type !== 'legend') {
      if (src.path === 'steel' && e.slowT > 0) amount *= 1.25;                       // Kruszenie
      if (has(src, 'brittle') && e.slowT > 0) amount *= 1.25;
      if (has(src, 'hunter') && e.cls === 'runner') amount *= 1.3;
      if (src.path === 'bolt' && has(src, 'giant') && e.boss) amount *= 1.3;
    }
    var dealt = amount;
    if (e.sh > 0) {
      var mult = 1 + (src && has(src, 'breaker') ? 1 : 0) + (src && has(src, 'overload') ? 1 : 0);
      var soak = Math.min(e.sh, amount * mult);
      e.sh -= soak;
      amount -= soak / mult;
    }
    e.hp -= amount;
    e.flash = 0.08;
    if (!o.dot) {
      e.acc += dealt;
      if (e.numT <= 0 && e.acc >= 1) { fx({ k: 'num', x: e.x, y: e.y - e.r - 0.3, life: 0.6, text: '' + Math.round(e.acc), col: DMG_COL[kind] }); e.acc = 0; e.numT = 0.22; }
    }
    if (src && e.hp > 0) {
      var lim = src.mastery === 'execute' ? (e.boss ? 0.05 : 0.15) : src.mastery === 'judge' ? 0.12 : 0;
      if (lim && e.hp < e.max * lim) e.hp = 0;
    }
    if (e.hp <= 0) die(e);
    return dealt;
  }
  var DMG_COL = { phys: '#f2f4f6', fire: '#ff9a4a', frost: '#9fdcff', bolt: '#ffe96a', poison: '#a8f070' };

  function die(e) {
    if (e.boss === 'revive' && !e.revived) {
      e.revived = true;
      e.hp = e.max * (e.burn.length ? 0.25 : 0.5);
      e.inv = 2; e.burn = []; e.poisonT = 0;
      fx({ k: 'text', x: e.x, y: e.y - 1, life: 1.6, text: 'WSKRZESZENIE!', col: '#ffe38a' });
      return;
    }
    e.dead = true;
    cue(e.boss ? 'bossdie' : 'die');
    S.kills++;
    if (S.hc && e.boss && S.hp < S.hpMax) {
      var heal = Math.min(DATA.HARDCORE.bossHeal, S.hpMax - S.hp);
      S.hp += heal;
      cue('heal');
      fx({ k: 'text', x: S.castle.x, y: S.castle.y - 1.4, life: 1.8, text: '+' + heal + ' HP za bossa', col: '#7dff9a' });
    }
    S.gold += Math.round(e.gold * S.mods.gold);
    addXp(e.xp * S.mods.xp);
    for (var i = 0; i < 6; i++) fx({ k: 'bit', x: e.x, y: e.y - 0.2, vx: (Math.random() - 0.5) * 2.6, vy: -Math.random() * 2, life: 0.5, col: '#e9eef2' });
    var near = function (rad) { return S.enemies.filter(function (o) { return o !== e && !o.dead && dist(o.x, o.y, e.x, e.y) <= rad; }); };
    if (e.sparks && e.burn.length) near(1.2).slice(0, 2).forEach(function (o) { addBurn(o, e.burn[0].dps, e.burn[0].total, 1); });
    if (e.ash && e.burn.length) {
      fx({ k: 'boom', x: e.x, y: e.y, max: 1, life: 0.35, col: '#ff7a2a' });
      var ash = e.ash; e.ash = 0;
      near(1).forEach(function (o) { hit(o, ash, 'fire', null, { splash: true, dot: true }); });
    }
    if (e.shards && e.slowT > 0) {
      var sh = e.shards; e.shards = 0;
      fx({ k: 'boom', x: e.x, y: e.y, max: 0.9, life: 0.3, col: '#9fdcff' });
      near(0.9).forEach(function (o) { hit(o, sh, 'frost', null, { dot: true }); });
    }
    if (e.plague && e.poisonT > 0) near(1.6).slice(0, 3).forEach(function (o) { o.poisonT = Math.max(o.poisonT, 4); o.pdps = Math.max(o.pdps, e.pdps); o.shred = Math.max(o.shred, e.shred); });
    if (e.split) for (var q = 0; q < 3; q++) spawn(3, Math.max(0, e.d - q * 0.35), true);
  }

  function addBurn(e, dps, dur, stacks) {
    if (e.burn.length < stacks) e.burn.push({ dps: dps, t: dur, total: dur });
    else {
      var weak = 0;
      for (var i = 1; i < e.burn.length; i++) if (e.burn[i].dps * e.burn[i].t < e.burn[weak].dps * e.burn[weak].t) weak = i;
      if (dps * dur >= e.burn[weak].dps * e.burn[weak].t) e.burn[weak] = { dps: dps, t: dur, total: dur };
    }
  }
  function patch(kind, x, y, src, power) {
    if (S.patches.length > 40) S.patches.shift();
    var p = pathPos(nearestD(x, y));
    S.patches.push({ kind: kind, x: p.x, y: p.y, t: kind === 'ice' ? 1.5 : 2, src: src, power: power });
  }
  function nearestD(x, y) {
    var best = 0, bd = 1e9;
    for (var i = 1; i < S.road.cells.length; i++) { var c = S.road.cells[i], d = dist(x, y, c[0], c[1]); if (d < bd) { bd = d; best = i; } }
    return best;
  }

  /* Efekty ścieżki po bezpośrednim trafieniu. raw = obrażenia ataku przed odpornościami. */
  function applyPath(e, t, raw, dealt, ctx) {
    if (!t || t.type === 'legend' || !t.path) return;
    if (t.path === 'steel') return;
    if (e.dead) return;
    if (t.path === 'fire') {
      var share = has(t, 'long') ? 0.9 : 0.6, dur = has(t, 'long') ? 5 : 3;
      if (has(t, 'fast')) dur /= 2;
      addBurn(e, raw * share / dur, dur, t.mastery === 'stack' ? 3 : 1);
      e.slowT = 0; e.slow = 0;                                                        // Para: ogień zdejmuje spowolnienie
      if (has(t, 'sparks')) e.sparks = true;
      if (has(t, 'melt')) e.melt = true;
      if (t.mastery === 'ash') e.ash = Math.max(e.ash || 0, raw);
      if (has(t, 'ground') && !ctx.patched) { ctx.patched = true; patch('fire', e.x, e.y, t, raw * 0.25); }
    } else if (t.path === 'frost') {
      var sl = has(t, 'deep') ? 0.35 : 0.25, st = has(t, 'deep') ? 2.5 : 1.5;
      e.slow = Math.max(e.slowT > 0 ? e.slow : 0, sl); e.slowT = Math.max(e.slowT, st);
      e.burn.forEach(function (b) { b.t *= 0.5; });                                    // Para: mróz skraca palenie
      if (has(t, 'shards')) e.shards = Math.max(e.shards || 0, raw * 0.6);
      if (t.mastery === 'crack') e.crackT = Math.max(e.crackT, st);
      if (t.mastery === 'freeze' && ctx.freeze) { e.stunT = Math.max(e.stunT, e.boss ? 0.4 : 1); }
      if (has(t, 'patch') && !ctx.patched) { ctx.patched = true; patch('ice', e.x, e.y, t, 0.25); }
    } else if (t.path === 'bolt') {
      if (has(t, 'shock') && Math.random() < 0.1) e.stunT = Math.max(e.stunT, e.boss ? 0.2 : 0.4);
    } else if (t.path === 'poison') {
      var pt = has(t, 'long') ? 7 : 4, pdps = raw * 0.1 * (has(t, 'strong') ? 1.5 : 1);
      e.pdps = Math.max(e.poisonT > 0 ? e.pdps : 0, pdps);
      e.shred = Math.max(e.poisonT > 0 ? e.shred : 0, has(t, 'acid') ? 1 : 0.5);
      e.poisonT = Math.max(e.poisonT, pt);
      if (has(t, 'weaken')) e.weakT = e.poisonT;
      if (has(t, 'giant')) e.pgiant = e.boss ? 0.003 : 0.01;
      if (t.mastery === 'plague') e.plague = true;
      if (t.mastery === 'rot') e.rotT = e.poisonT;
      if (has(t, 'cloud') && !ctx.patched) { ctx.patched = true; patch('poison', e.x, e.y, t, pdps); }
    }
    if (e.burn.length && e.poisonT > 0 && e.boomT <= 0 && !e.dead) {                  // Zapłon
      e.boomT = 3;
      fx({ k: 'boom', x: e.x, y: e.y, max: 0.7, life: 0.3, col: '#ffd23f' });
      hit(e, dealt, 'fire', null, { dot: true });
    }
  }

  /* Jedno trafienie wieży w jednego wroga (z krytykiem, efektami i ewentualnym przeskokiem). */
  function strike(t, st, e, dmg, ctx, o) {
    if (e.dead) return;
    o = o || {};
    if (o.dodge && e.boss === 'dodge' && st.kind !== 'bolt' && Math.random() < (e.slowT > 0 ? 0.2 : 0.45)) {
      fx({ k: 'text', x: e.x, y: e.y - 0.8, life: 0.6, text: 'UNIK', col: '#ff8aa0' });
      return;
    }
    var raw = dmg;
    if (has(t, 'crit') && Math.random() < 0.25) raw *= 2;
    var ex = e.x, ey = e.y, wasSlow = e.slowT > 0;
    var dealt = hit(e, raw, st.kind, t, { splash: o.splash });
    applyPath(e, t, raw, dealt, ctx);
    if (ctx.stun) e.stunT = Math.max(e.stunT, e.boss ? ctx.stun * 0.4 : ctx.stun);
    if (!o.noChain) {
      var jumps = 0, frac = 0;
      if (t.path === 'bolt') { jumps = 1 + (has(t, 'chain') ? 1 : 0) + (wasSlow ? 1 : 0) + ctx.extraJumps; frac = has(t, 'volt') ? 0.85 : 0.6; }
      else if (ctx.conduct) { jumps = 1; frac = 0.3; }
      if (jumps && (!ctx.chained || ctx.chained < 3)) {
        ctx.chained = (ctx.chained || 0) + 1;
        var from = { x: ex, y: ey }, used = [e], part = raw * frac;
        for (var j = 0; j < jumps; j++) {
          var nx = null, nd = 1.4;
          for (var i = 0; i < S.enemies.length; i++) { var q = S.enemies[i]; if (!q.dead && used.indexOf(q) < 0) { var d = dist(from.x, from.y, q.x, q.y); if (d < nd) { nd = d; nx = q; } } }
          if (!nx) break;
          used.push(nx);
          fx({ k: 'bolt', x: from.x, y: from.y - 0.25, x2: nx.x, y2: nx.y - 0.25, life: 0.18, col: '#ffe96a' });
          var dd = hit(nx, part, st.kind, t, {});
          applyPath(nx, t, part, dd, ctx);
          from = { x: nx.x, y: nx.y };
        }
      }
    }
  }
  /* Parametry jednego ataku: liczniki kart i mistrzostw. */
  function attackCtx(t) {
    t.n++;
    var ctx = { mult: 1, extraJumps: 0, stun: 0, patched: false, freeze: false, conduct: false };
    if (t.mastery === 'ram' && t.n % 4 === 0) { ctx.mult *= 2; ctx.stun = 0.6; }
    if (has(t, 'charge') && t.n % 5 === 0) { ctx.mult *= 2; ctx.extraJumps = 2; }
    if (t.mastery === 'freeze' && t.freezeCd <= 0) { ctx.freeze = true; t.freezeCd = 5; }
    if (t.path !== 'bolt') ctx.conduct = neighbors(t).some(function (o) { return o.mastery === 'conduct'; });
    return ctx;
  }
  function area(t, st, x, y, rad, dmg, ctx, o) {
    fx({ k: 'boom', x: x, y: y, max: rad, life: 0.32, col: st.kind === 'phys' ? '#ffb066' : DMG_COL[st.kind] });
    cue('boom');
    S.enemies.filter(alive).forEach(function (e) { if (dist(e.x, e.y, x, y) <= rad + e.r) strike(t, st, e, dmg, ctx, o || { splash: true, noChain: false }); });
  }

  /* ---------- celowanie i ataki ---------- */
  function inRange(t, st, filter) {
    return S.enemies.filter(function (e) {
      if (e.dead) return false;
      var d = dist(t.c, t.r, e.x, e.y);
      return d <= st.range + e.r && d >= st.min && (!filter || filter(e));
    });
  }
  function pickTarget(t, list) {
    var best = null, bv = -1;
    list.forEach(function (e) { var v = t.mode === 'strong' ? e.hp + e.sh + e.d * 0.001 : e.d; if (v > bv) { bv = v; best = e; } });
    return best;
  }
  function sorted(t, list) { return list.sort(function (a, b) { return t.mode === 'strong' ? (b.hp + b.sh) - (a.hp + a.sh) : b.d - a.d; }); }

  function shoot(t, st, target, kind, dmg, ctx, extra) {
    var s = { kind: kind, t: t, st: st, ctx: ctx, dmg: dmg, x: t.c, y: t.r - 0.6, sx: t.c, sy: t.r - 0.6, tg: target, tx: target.x, ty: target.y, el: 0 };
    var d = dist(s.x, s.y, s.tx, s.ty);
    s.dur = kind === 'lob' ? Math.max(0.55, d / 5) : kind === 'ball' ? Math.max(0.15, d / 7) : kind === 'snipe' ? 0.08 : Math.max(0.08, d / 11);
    if (extra) for (var k in extra) s[k] = extra[k];
    if (kind === 'lob') {
      var p = pathPos(target.d + target.spd * s.dur * 0.85);
      s.tx = p.x; s.ty = p.y; s.tg = null;
    }
    S.shots.push(s);
  }
  function landShot(s) {
    var t = s.t, st = s.st;
    if (s.tg && !s.tg.dead) { s.tx = s.tg.x; s.ty = s.tg.y; }
    if (s.kind === 'ball' || s.kind === 'lob') area(t, st, s.tx, s.ty, st.splash, s.dmg, s.ctx);
    else if (s.tg && !s.tg.dead) strike(t, st, s.tg, s.dmg, s.ctx, { dodge: true });
  }

  function dropKeg(t, st) {
    var mine = S.kegs.filter(function (k) { return k.owner === t.id; });
    if (mine.length >= 3) return false;
    var spots = [];
    for (var d = 1.2; d < S.road.len - 0.4; d += 0.25) {
      var p = pathPos(d);
      if (dist(t.c, t.r, p.x, p.y) <= st.range && !mine.some(function (k) { return dist(k.x, k.y, p.x, p.y) < 0.7; })) spots.push(p);
    }
    if (!spots.length) return false;
    var sp = spots[Math.random() * spots.length | 0];
    S.kegs.push({ owner: t.id, x: sp.x, y: sp.y, arm: 0.3 });
    cue('keg');
    fx({ k: 'lob', x: t.c, y: t.r - 0.5, x2: sp.x, y2: sp.y, life: 0.3, col: '#8a5a2b' });
    return true;
  }

  /* Bramy atakują tylko wrogów w swojej strefie (pod łukiem i po 2 kratki drogi przed i za). */
  function fireGate(t, st) {
    var L = S.f.leg, list = S.enemies.filter(function (e) { return !e.dead && inZone(t, e); }).sort(function (a, b) { return b.d - a.d; });
    if (!list.length) return false;
    /* brama ma stałą liczbę pocisków; gdy wrogów jest mniej, skupia na nich wszystkie (ważne na bossów) */
    var shots = Math.max(L.shots, L.all ? list.length : 0), targets = [], top = t.o === 'v' ? 1.0 : 1.2;
    for (var n = 0; n < shots; n++) targets.push(list[n % list.length]);
    t.n++;
    cue({ portcullis: 'spear', volley: 'volley', toll: 'sack', storm: 'zap' }[L.atk]);
    targets.forEach(function (e) {
      if (e.dead) return;
      if (L.atk === 'storm') {
        fx({ k: 'bolt', x: t.c + (Math.random() - 0.5) * 0.7, y: t.r - top, x2: e.x, y2: e.y - 0.2, life: 0.16, col: '#ffe96a' });
        hit(e, st.dmg * (e.slowT > 0 ? 2 : 1), 'bolt', t, {});
        if (t.mastery === 'thunder' && t.n % 4 === 0) e.stunT = Math.max(e.stunT, e.boss ? 0.15 : 0.4);
      } else {
        fx({ k: 'bolt', x: t.c, y: t.r - top, x2: e.x, y2: e.y - 0.2, life: 0.09, col: L.atk === 'toll' ? '#ffd23f' : L.atk === 'volley' ? '#d8ffc0' : '#e8eef6' });
        hit(e, st.dmg, st.kind, t, {});
        if (L.atk === 'volley') {
          e.mark = Math.max(e.mark || 0, t.mastery === 'brand' ? 0.35 : L.mark);
          if (t.mastery === 'venom' && !e.dead) { e.poisonT = Math.max(e.poisonT, 3); e.pdps = Math.max(e.pdps, st.dmg * 0.5); e.shred = Math.max(e.shred, 0.5); }
        }
      }
    });
    return true;
  }
  /* Efekty niezależne od rytmu strzałów: opadająca krata i myto. */
  function gateTick(t, dt) {
    var L = S.f.leg;
    if (t.grateT > 0) t.grateT -= dt;
    if (L.atk === 'portcullis') {
      t.grateCd -= dt;
      if (t.grateCd > 0 || !S.enemies.some(function (e) { return !e.dead && e.d >= t.k - 1.2 && e.d <= t.k + 0.2; })) return;
      var st = stats(t), hold = L.hold + (t.mastery === 'winch' ? 0.5 : 0);
      t.grateCd = t.mastery === 'winch' ? 4.5 : L.every;
      t.grateT = hold;
      cue('grate');
      fx({ k: 'wave', x: t.c, y: t.r, max: 1.2, life: 0.35, col: '#e8eef6' });
      S.enemies.forEach(function (e) {
        if (e.dead || e.d < t.k - 2.5 || e.d > t.k + 0.4) return;
        e.stunT = Math.max(e.stunT, e.boss ? hold * 0.35 : hold);
        hit(e, L.grate * st.boost * (t.mastery === 'teeth' ? 2 : 1), 'phys', t, { pierce: t.mastery === 'teeth' });
      });
    } else if (L.atk === 'toll') {
      S.enemies.forEach(function (e) {
        if (e.dead || e.tolled || e.d < t.k - 0.4 || e.d > t.k + 0.6) return;
        e.tolled = true;
        var greed = t.mastery === 'greed', gold = (e.boss ? 20 : L.coin) * (greed ? 2 : 1);
        S.gold += gold;
        cue('coin');
        fx({ k: 'text', x: e.x, y: e.y - 0.9, life: 0.8, text: '+' + gold + ' zł', col: '#ffd23f' });
        hit(e, e.max * (e.boss ? L.bossToll : L.toll) * (greed ? 1.5 : 1), 'toll', t, { dot: true });
      });
    }
  }

  function fire(t, st, dt) {
    if (t.type === 'legend') return fireGate(t, st);
    var d = DATA.TOWERS[t.type], list, target, ctx;
    if (d.atk === 'keg') return dropKeg(t, st);
    list = inRange(t, st);
    if (!list.length) return false;
    target = pickTarget(t, list);
    ctx = attackCtx(t);
    var dmg = st.dmg * ctx.mult;
    t.anim = 0.18;
    cue({ arrow: 'arrow', ball: 'cannon', lob: 'catapult', snipe: 'snipe', hammer: 'hammer', pulse: 'windmill', saw: 'saw' }[d.atk]);
    if (d.atk === 'arrow') shoot(t, st, target, 'arrow', dmg, ctx);
    else if (d.atk === 'ball') shoot(t, st, target, 'ball', dmg, ctx);
    else if (d.atk === 'lob') shoot(t, st, target, 'lob', dmg, ctx);
    else if (d.atk === 'snipe') shoot(t, st, target, 'snipe', dmg, ctx);
    else if (d.atk === 'hammer') {
      ctx.stun = Math.max(ctx.stun, d.stun);
      fx({ k: 'boom', x: target.x, y: target.y, max: 0.55, life: 0.22, col: '#ffd08a' });
      strike(t, st, target, dmg, ctx, {});
    } else if (d.atk === 'pulse') {
      fx({ k: 'wave', x: t.c, y: t.r, max: st.range, life: 0.35, col: t.path ? DATA.PATHS[t.path].col : '#e8e0c8' });
      list.forEach(function (e) { strike(t, st, e, dmg, ctx, {}); });
    } else if (d.atk === 'saw') {
      S.saws.push({ t: t, st: st, ctx: ctx, dmg: dmg, d: Math.min(S.road.len - 0.1, target.d + 0.6), left: 3, hit: [], spin: 0 });
    }
    if (t.mastery === 'storm' && t.stormCd <= 0) {
      t.stormCd = 8;
      var sctx = { mult: 1, extraJumps: 0, chained: 9 };
      fx({ k: 'wave', x: t.c, y: t.r, max: st.range, life: 0.6, col: '#ffe96a' });
      inRange(t, st).forEach(function (e) { fx({ k: 'bolt', x: t.c, y: t.r - 0.9, x2: e.x, y2: e.y - 0.25, life: 0.3, col: '#ffe96a' }); strike(t, st, e, st.dmg * 2, sctx, { noChain: true }); });
    }
    return true;
  }

  /* ---------- wrogowie i fale ---------- */
  var eidc = 1;
  function hpScale(w) { return (1 + (w - 1) * 0.3 + Math.pow(w - 1, 2) * 0.027) * (1 + Math.max(0, w - 15) * 0.07); }
  function extend(base, over) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in over) o[k] = over[k]; return o; }
  function spawn(ui, d0, child) {
    var u = DATA.UNITS[ui], w = Math.max(1, S.wave), F = S.ef;
    var b = S.hc ? DATA.HARDCORE.units[u.cls] : {};
    var hp = u.hp * hpScale(w) * S.diff.hp * F.hp * (b.hp || 1);
    var p = pathPos(d0 || 0);
    var e = { eid: eidc++, si: ui, cls: u.cls, boss: null, name: F.names[ui], d: d0 || 0, x: p.x, y: p.y, dir: 'r', flip: false, hp: hp, max: hp, spd: u.spd * (b.spd || 1), r: u.r,
      gold: u.gold * Math.max(0.3, 1.1 - w * 0.075), xp: u.xp, dmg: u.dmg, res: b.res ? extend(u.res || {}, b.res) : u.res || null, splashRes: u.splashRes || 0,
      sh: hp * ((b.shield || u.shield || 0) + (F.mech === 'shield' ? 0.2 : 0)), shMax: 0,
      heal: F.mech === 'heal' && u.cls === 'brute', rage: F.mech === 'rage', split: F.mech === 'split' && u.cls === 'brute' && !child };
    return finishEnemy(e);
  }
  /* W Hardcore każdy boss ma dodatkową losową odporność; wynika z ziarna gry, więc widać ją przed falą. */
  function bossResist(i) {
    if (!S.hc) return null;
    var K = DATA.HARDCORE.kinds;
    return K[mulberry(S.seed + 977 + i * 131)() * K.length | 0];
  }
  function spawnBoss(i) {
    var b = DATA.BOSSES[i], F = S.ef, kind = bossResist(i), res = b.res || null;
    var hp = b.hp * S.diff.hp * F.hp * (S.hc ? DATA.HARDCORE.bossHp : 1);
    if (kind) { res = extend(res || {}, {}); res[kind] = (res[kind] || 1) * DATA.HARDCORE.bossResist; }
    var p = pathPos(0);
    cue('boss');
    var e = { eid: eidc++, si: b.si, cls: 'boss', boss: b.mech, name: F.names[b.si], d: 0, x: p.x, y: p.y, dir: 'r', flip: false, hp: hp, max: hp, spd: b.spd, r: b.r,
      gold: b.gold, xp: b.xp, dmg: b.dmg, res: res, splashRes: 0, sh: F.mech === 'shield' ? hp * 0.15 : 0, shMax: 0, heal: false, rage: F.mech === 'rage', split: false, sumT: 3 };
    return finishEnemy(e);
  }
  function finishEnemy(e) {
    e.shMax = e.sh;
    e.burn = []; e.poisonT = 0; e.pdps = 0; e.shred = 0; e.slow = 0; e.slowT = 0; e.stunT = 0; e.crackT = 0; e.rotT = 0; e.weakT = 0; e.boomT = 0; e.inv = 0;
    e.flash = 0; e.acc = 0; e.numT = 0; e.walk = Math.random() * 6; e.dead = false; e.mark = 0; e.tolled = false;
    S.enemies.push(e);
    return e;
  }
  function genWave(w) {
    var q = [], n = Math.min(28, 6 + Math.floor(w * 1.3)), rnd = mulberry(S.seed + w * 101), i, k;
    for (i = 0; i < n; i++) {
      var x = rnd(), ui = 0;
      if (w >= 2 && x < 0.22) ui = 1;
      else if (w >= 4 && x < 0.36) ui = 2;
      else if (w >= 3 && x < 0.50) ui = 3;
      else if (w >= 6 && x < 0.66) ui = 4;
      if (ui === 3) { for (k = 0; k < 3; k++) q.push({ ui: 3, gap: 0.28 }); q.push({ ui: 0, gap: 0.8 }); }
      else q.push({ ui: ui, gap: ui === 1 ? 0.6 : ui === 2 ? 1.2 : 0.9 });
    }
    if (w % 5 === 0) q.splice(Math.floor(q.length * 0.45), 0, { boss: w / 5 - 1, gap: 2 });
    return q;
  }
  function nextBoss() {
    var w = Math.ceil(nextWave() / 5) * 5;
    if (w > DATA.WAVES) return null;
    var b = DATA.BOSSES[w / 5 - 1];
    var kind = bossResist(w / 5 - 1);
    return { wave: w, name: S.ef.names[b.si], d: b.d, si: b.si, resist: kind ? DATA.HARDCORE.kindName[kind] : null };
  }
  function startWave() {
    if (S.result || S.phase !== 'build' || S.wave >= DATA.WAVES) return false;
    S.wave++;
    S.phase = 'wave';
    S.spawnQ = genWave(S.wave);
    S.spawnT = 0.8;
    S.banner = null;                      // numer fali pokazuje napis na środku ekranu (ui.js)
    return true;
  }
  function endWave() {
    S.phase = 'build';
    S.shots = []; S.saws = []; S.patches = [];
    if (S.wave >= DATA.WAVES) { S.result = 'win'; return; }
    var pts = 1 + (S.wave % 5 === 0 ? 2 : 0);
    S.points += pts;
    var mine = S.towers.filter(function (t) { return t.type !== 'legend' && S.fields[t.c + ',' + t.r] === 'gold'; }).length * 8;
    var bonus = Math.round((24 + S.wave) * S.mods.gold) + mine;
    S.gold += bonus;
    var msg = 'Fala odparta. +' + pts + (pts > 1 ? ' punkty' : ' punkt') + ' ulepszeń, +' + bonus + ' zł';
    var w = nextWave();
    if (DATA.typesAt(w) > DATA.typesAt(w - 1)) {
      var nt = DATA.typesAt(w) === 5 ? S.f.leg.n : DATA.TOWERS[S.f.tw[DATA.typesAt(w) - 1]].n;
      msg += ' · Nowa wieża: ' + nt;
    }
    say(msg);
  }

  /* ---------- zamek ---------- */
  function addXp(v) {
    var c = S.castle;
    c.xp += v;
    while (c.xp >= c.need) { c.xp -= c.need; c.lvl++; c.pending++; c.need = Math.round(c.need * 1.32 + 15); cue('star'); }
  }
  var CASTLE_CARDS = [
    { id: 'q', n: 'sk', ok: function () { return S.castle.sk.q < 5; } },
    { id: 'e', n: 'sk', ok: function () { return S.castle.sk.e < 5; } },
    { id: 'r', n: 'sk', ok: function () { return S.castle.sk.r < 5; } },
    { id: 'dmg', n: 'Ostrzejsze strzały', d: 'Zamek zadaje +30% obrażeń.', ok: function () { return true; } },
    { id: 'heal', n: 'Murarze', d: 'Zamek odzyskuje 4 HP.', ok: function () { return S.hp < S.hpMax; } },
    { id: 'wall', n: 'Grubsze mury', d: '+3 do maksymalnego HP zamku.', ok: function () { return true; } },
    { id: 'gold', n: 'Danina z wiosek', d: '+90 złota.', ok: function () { return true; } },
    { id: 'pt', n: 'Mistrz rzemiosła', d: '+1 punkt ulepszeń.', ok: function () { return !S.castle.gotPoint; } }
  ];
  function skillName(k) { return S.f.sk[k]; }
  var SKILL_TEXT = { q: 'Obrażenia wokół zamku.', e: 'Spowalnia wrogów w pobliżu zamku.', r: 'Wszystkie wieże strzelają szybciej.' };
  function castleOffer() {
    var c = S.castle;
    if (!c.pending) return null;
    if (!c.offer) {
      var pool = shuffle(CASTLE_CARDS.filter(function (x) { return x.ok(); }));
      c.offer = pool.slice(0, 3).map(function (x) {
        if (x.n === 'sk') return { id: x.id, n: skillName(x.id) + (c.sk[x.id] ? ' ' + (c.sk[x.id] + 1) : ' (nowa)'), d: SKILL_TEXT[x.id] };
        return { id: x.id, n: x.n, d: x.d };
      });
    }
    return c.offer;
  }
  function castleChoose(i) {
    var o = castleOffer(), c = S.castle;
    if (!o || !o[i]) return false;
    var id = o[i].id;
    if (id === 'q' || id === 'e' || id === 'r') c.sk[id]++;
    else if (id === 'dmg') c.dmgBonus += 0.3;
    else if (id === 'heal') S.hp = Math.min(S.hpMax, S.hp + 4);
    else if (id === 'wall') { S.hpMax += 3; S.hp += 3; }
    else if (id === 'gold') S.gold += 90;
    else if (id === 'pt') { S.points++; c.gotPoint = true; }
    c.pending--; c.offer = null;
    return true;
  }
  var SKILL_CD = { q: 18, e: 22, r: 28 };
  function skill(k) {
    var c = S.castle, L = c.sk[k];
    if (!L || c.cd[k] > 0 || S.phase !== 'wave') return false;
    c.cd[k] = SKILL_CD[k];
    cue('skill');
    if (k === 'q') {
      fx({ k: 'wave', x: c.x, y: c.y, max: 4.2, life: 0.6, col: S.f.col });
      var dmg = (120 + 130 * L) * S.mods.hdmg * hpScale(S.wave) * 0.22;
      S.enemies.filter(alive).forEach(function (e) { if (dist(e.x, e.y, c.x, c.y) <= 4.2) hit(e, dmg, 'phys', null, {}); });
    } else if (k === 'e') {
      S.zone = { x: c.x, y: c.y, r: 4.5, t: 4 + L, slow: 0.3 + 0.04 * L };
    } else {
      S.buffT = 5 + L; S.buff = 0.25 + 0.07 * L;
      fx({ k: 'wave', x: c.x, y: c.y, max: 2.5, life: 0.6, col: '#ffffff' });
    }
    return true;
  }

  /* ---------- aktualizacja ---------- */
  function update(dt) {
    if (S.result) return;
    var i, e, t;
    S.time += dt;
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.life) S.banner = null; }
    for (i = S.fx.length - 1; i >= 0; i--) {
      var f = S.fx[i];
      f.t += dt;
      if (f.vx !== undefined) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 6 * dt; }
      if (f.k === 'num' || f.k === 'text') f.y -= 0.7 * dt;
      if (f.t >= f.life) S.fx.splice(i, 1);
    }
    for (i = 0; i < S.towers.length; i++) { t = S.towers[i]; if (t.anim > 0) t.anim -= dt; }
    if (S.phase !== 'wave') return;
    if (S.buffT > 0) S.buffT -= dt;
    if (S.zone) { S.zone.t -= dt; if (S.zone.t <= 0) S.zone = null; }
    var c = S.castle;
    ['q', 'e', 'r'].forEach(function (k) { if (c.cd[k] > 0) c.cd[k] = Math.max(0, c.cd[k] - dt); });

    if (S.spawnQ.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) {
        var q = S.spawnQ.shift();
        if (q.boss !== undefined) spawnBoss(q.boss); else spawn(q.ui, 0, false);
        S.spawnT = q.gap;
      }
    }
    var auraTowers = S.towers.filter(function (o) { return has(o, 'aura'); });
    var healers = S.enemies.filter(function (o) { return o.heal && !o.dead; });
    for (i = 0; i < S.enemies.length; i++) {
      e = S.enemies[i];
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.numT > 0) e.numT -= dt;
      if (e.inv > 0) e.inv -= dt;
      ['slowT', 'crackT', 'rotT', 'weakT', 'boomT'].forEach(function (k) { if (e[k] > 0) e[k] -= dt; });
      for (var b = e.burn.length - 1; b >= 0; b--) {
        var br = e.burn[b], step = Math.min(dt, br.t);
        br.t -= dt;
        hit(e, br.dps * step, 'fire', null, { dot: true });
        if (e.dead || !e.burn[b]) break;
        if (br.t <= 0) e.burn.splice(b, 1);
      }
      if (e.dead) continue;
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        hit(e, (e.pdps + (e.pgiant ? e.max * e.pgiant : 0)) * dt, 'poison', null, { dot: true });
        if (e.dead) continue;
      } else { e.plague = false; e.pgiant = 0; }
      if (e.boss === 'summon') {
        e.sumT -= dt;
        if (e.sumT <= 0) { e.sumT = 4; spawn(3, Math.max(0, e.d - 0.3), true); spawn(3, Math.max(0, e.d - 0.7), true); }
      }
      for (var h = 0; h < healers.length; h++) {
        var hl = healers[h];
        if (hl !== e && !hl.dead && dist(hl.x, hl.y, e.x, e.y) < 1.35) { e.hp = Math.min(e.max, e.hp + e.max * 0.03 * dt); break; }
      }
      var slow = e.slowT > 0 ? e.slow : 0;
      if (e.weakT > 0) slow += 0.1;
      if (auraTowers.some(function (a) { return dist(a.c, a.r, e.x, e.y) <= DATA.TOWERS[a.type].range + 0.3; })) slow += 0.1;
      if (S.zone && dist(S.zone.x, S.zone.y, e.x, e.y) <= S.zone.r) slow += S.zone.slow;
      var speed = e.spd * (1 - Math.min(0.5, slow));
      if (e.rage && e.hp < e.max * 0.5) speed *= 1.4;
      if (e.stunT > 0) { e.stunT -= dt; speed = 0; }
      e.d += speed * dt;
      e.walk += speed * dt * 7;
      if (e.d >= S.road.len - 0.1) {
        e.dead = true;
        S.hp -= e.dmg;
        cue('hurt');
        fx({ k: 'text', x: c.x, y: c.y - 1.4, life: 0.9, text: '-' + e.dmg + ' HP', col: '#ff6a5a' });
        if (S.hp <= 0) { S.hp = 0; S.result = 'lose'; return; }
        continue;
      }
      var p = pathPos(e.d);
      e.x = p.x; e.y = p.y;
      if (p.dx > 0.1) { e.dir = 'r'; e.flip = false; } else if (p.dx < -0.1) { e.dir = 'r'; e.flip = true; } else { e.dir = p.dy > 0 ? 'd' : 'u'; e.flip = false; }
    }

    var slowBosses = S.enemies.filter(function (o) { return o.boss === 'slow' && !o.dead; });
    for (i = 0; i < S.towers.length; i++) {
      t = S.towers[i];
      if (t.type === 'legend') gateTick(t, dt);
      if (t.freezeCd > 0) t.freezeCd -= dt;
      if (t.stormCd > 0) t.stormCd -= dt;
      t.cd -= dt;
      if (t.cd > 0) continue;
      var st = stats(t);
      var held = slowBosses.some(function (bs) { return dist(t.c, t.r, bs.x, bs.y) <= 2.8; });
      var rate = st.rate * (held ? 0.55 : 1);
      if (fire(t, st, dt)) t.cd = (t.type !== 'legend' && DATA.TOWERS[t.type].atk === 'keg' ? 2.5 * DATA.TOWERS.tavern.rate / rate : 1 / rate);
      else t.cd = 0.05;
    }

    for (i = S.shots.length - 1; i >= 0; i--) {
      var s = S.shots[i];
      s.el += dt;
      var k = Math.min(1, s.el / s.dur);
      if (s.tg && !s.tg.dead) { s.tx = s.tg.x; s.ty = s.tg.y - 0.25; }
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k - (s.kind === 'lob' ? Math.sin(Math.PI * k) * 1.6 : s.kind === 'ball' ? Math.sin(Math.PI * k) * 0.35 : 0);
      if (k >= 1) { S.shots.splice(i, 1); if (s.tg) s.ty = s.tg.y; landShot(s); }
    }
    for (i = S.saws.length - 1; i >= 0; i--) {
      var w = S.saws[i], mv = 5 * dt;
      w.d -= mv; w.left -= mv; w.spin += dt * 20;
      var wp = pathPos(w.d);
      w.x = wp.x; w.y = wp.y;
      for (var m = 0; m < S.enemies.length && w.hit.length < 4; m++) {
        e = S.enemies[m];
        if (!e.dead && w.hit.indexOf(e.eid) < 0 && dist(e.x, e.y, wp.x, wp.y) <= 0.45 + e.r) { w.hit.push(e.eid); strike(w.t, w.st, e, w.dmg, w.ctx, {}); }
      }
      if (w.left <= 0 || w.d <= 0.5 || w.hit.length >= 4) S.saws.splice(i, 1);
    }
    for (i = S.kegs.length - 1; i >= 0; i--) {
      var keg = S.kegs[i];
      if (keg.arm > 0) { keg.arm -= dt; continue; }
      var trig = S.enemies.some(function (o) { return !o.dead && dist(o.x, o.y, keg.x, keg.y) <= 0.3 + o.r; });
      if (!trig) continue;
      S.kegs.splice(i, 1);
      var owner = S.towers.filter(function (o) { return o.id === keg.owner; })[0];
      if (!owner) continue;
      var kst = stats(owner), kctx = attackCtx(owner);
      area(owner, kst, keg.x, keg.y, kst.splash, kst.dmg * kctx.mult, kctx);
    }
    for (i = S.patches.length - 1; i >= 0; i--) {
      var pa = S.patches[i];
      pa.t -= dt;
      S.enemies.forEach(function (o) {
        if (o.dead || dist(o.x, o.y, pa.x, pa.y) > 0.55 + o.r) return;
        if (pa.kind === 'fire') hit(o, pa.power * dt * (1), 'fire', null, { dot: true });
        else if (pa.kind === 'poison') { o.poisonT = Math.max(o.poisonT, 0.3); o.pdps = Math.max(o.pdps, pa.power); o.shred = Math.max(o.shred, 0.5); }
        else { o.slow = Math.max(o.slowT > 0 ? o.slow : 0, pa.power); o.slowT = Math.max(o.slowT, 0.2); }
      });
      if (pa.t <= 0) S.patches.splice(i, 1);
    }
    c.atk -= dt;
    if (c.atk <= 0) {
      var near = null, nd = 2.9;
      S.enemies.forEach(function (o) { if (!o.dead) { var d = dist(c.x, c.y, o.x, o.y); if (d < nd) { nd = d; near = o; } } });
      if (near) {
        var cd = 30 * S.mods.hdmg * (1 + c.dmgBonus) * (1 + 0.12 * (c.lvl - 1));
        if (Math.random() < S.mods.crit) cd *= 2;
        fx({ k: 'bolt', x: c.x, y: c.y - 1.5, x2: near.x, y2: near.y - 0.25, life: 0.12, col: S.f.col });
        hit(near, cd, 'phys', null, {});
        c.atk = 0.7;
      } else c.atk = 0.1;
    }
    for (i = S.enemies.length - 1; i >= 0; i--) if (S.enemies[i].dead) S.enemies.splice(i, 1);
    if (!S.spawnQ.length && !S.enemies.length && !S.result) endWave();
  }

  /* ---------- zapis ---------- */
  var KEEP = ['id', 'type', 'c', 'r', 'o', 'k', 'path', 'level', 'cards', 'mastery', 'spentGold', 'spentPts', 'mode', 'offer', 'n'];
  function save() {
    if (!S || S.result || S.phase !== 'build') return null;
    var c = S.castle;
    return JSON.stringify({ v: 2, seed: S.seed, faction: S.f.id, diff: S.did, theme: S.theme.id, enemy: S.ef.id, nodes: S.road.nodes, fields: S.fields,
      wave: S.wave, gold: S.gold, points: S.points, hp: S.hp, hpMax: S.hpMax, kills: S.kills, time: S.time, tid: S.tid, rerollFree: S.rerollFree, rerollCost: S.rerollCost,
      kegs: S.kegs, castle: { lvl: c.lvl, xp: c.xp, need: c.need, pending: c.pending, offer: c.offer, sk: c.sk, dmgBonus: c.dmgBonus, gotPoint: c.gotPoint },
      towers: S.towers.map(function (t) { var o = {}; KEEP.forEach(function (k) { o[k] = t[k]; }); return o; }) });
  }
  function load(text) {
    var d = JSON.parse(text);
    if (!d || d.v !== 2) return null;
    newGame({ faction: d.faction, diff: d.diff, theme: d.theme, enemy: d.enemy, nodes: d.nodes, seed: d.seed });
    ['wave', 'gold', 'points', 'hp', 'hpMax', 'kills', 'time', 'tid', 'rerollFree', 'rerollCost', 'fields', 'kegs'].forEach(function (k) { S[k] = d[k]; });
    for (var k in d.castle) S.castle[k] = d.castle[k];
    S.towers = d.towers.map(function (o) { o.cd = 0.3; o.freezeCd = 0; o.stormCd = 8; o.grateCd = 2; o.grateT = 0; o.anim = 0; return o; });
    return S;
  }

  return {
    COLS: COLS, ROWS: ROWS, get S() { return S; }, newGame: newGame, load: load, save: save, update: update, startWave: startWave,
    build: build, buildState: buildState, cellState: cellState, cost: cost, count: count, regularCount: regularCount, unlocked: unlocked, unlockWave: unlockWave, nextWave: nextWave, nextBoss: nextBoss,
    towerAt: towerAt, def: def, stats: stats, sell: sell, sellValue: sellValue, move: move, coveredCells: coveredCells, pathPos: pathPos,
    footprint: footprint, gateSpot: gateSpot, gateSpots: gateSpots, placeState: placeState, zoneCells: zoneCells,
    offer: offer, choose: choose, canUpgrade: canUpgrade, canReroll: canReroll, reroll: reroll, upCost: upCost, maxLevel: maxLevel,
    castleOffer: castleOffer, castleChoose: castleChoose, skill: skill, skillName: skillName, hpScale: hpScale
  };
})(typeof DATA !== 'undefined' ? DATA : require('./data.js'), typeof Roads !== 'undefined' ? Roads : require('./roads.js'));
if (typeof module !== 'undefined') module.exports = GAME;
