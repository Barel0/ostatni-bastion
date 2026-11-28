// Bot grający w demo bez przeglądarki: sprawdza błędy i trudność.
// Użycie: node tests/demo-sim.js [gier] [easy,normal,hard,hardcore]
const path = require('path');
const DATA = require(path.join('..', 'demo', 'data.js'));
const GAME = require(path.join('..', 'demo', 'game.js'));
const N = +process.argv[2] || 40;
const diffs = (process.argv[3] || 'easy,normal,hard,hardcore').split(',');
// strojenie: GATE="crown=1.5,forest=2" mnoży siłę bram, HCHP=mnożnik HP w Hardcore
if (process.env.GATE) for (const part of process.env.GATE.split(',')) { const [id, k] = part.split('='); const L = DATA.FACTIONS.find(f => f.id === id).leg; for (const key of ['dmg', 'grate']) if (L[key]) L[key] *= +k; }
if (process.env.HCHP) DATA.DIFF.hardcore.hp *= +process.env.HCHP;
// strojenie: HPK=mnożnik HP wrogów
if (process.env.HPK) for (const k in DATA.DIFF) DATA.DIFF[k].hp *= +process.env.HPK;
let seed = 1;
Math.random = function () { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function value(type, c, r) {
  const S = GAME.S, d = DATA.TOWERS[type];
  const cov = GAME.coveredCells(c, r, d.range).filter(p => Math.hypot(p[0] - c, p[1] - r) >= (d.min || 0)).length;
  const near = S.towers.filter(t => GAME.footprint(t).some(q => Math.abs(q[0] - c) <= 1 && Math.abs(q[1] - r) <= 1)).length;
  let v = cov + near * 0.4;
  const f = S.fields[c + ',' + r];
  if (f === 'hill' || f === 'power') v += 1;
  return v;
}
function bestCell(type) {
  let best = null, bv = -1e9;
  for (let c = 0; c < 16; c++) for (let r = 0; r < 9; r++) {
    if (GAME.cellState(c, r)) continue;
    const v = value(type, c, r) + Math.random() * 0.5;
    if (v > bv) { bv = v; best = [c, r]; }
  }
  return best;
}
/* Jak dobre jest miejsce na bramę: ile wież sięga w jej strefę (Las: ile sięga dalej), Rogatka liczy wieże przy filarach. */
function gateValue(sp) {
  const S = GAME.S, atk = S.f.leg.atk, zone = GAME.zoneCells(sp.k), after = S.road.cells.slice(sp.k + 1);
  const towers = S.towers.filter(t => t.type !== 'legend');
  const reach = (t, cells) => cells.filter(p => Math.hypot(p[0] - t.c, p[1] - t.r) <= GAME.stats(t).range + 0.3).length;
  let v = 0;
  for (const t of towers) {
    if (atk === 'volley') v += Math.min(6, reach(t, after)) * 0.5;
    else v += reach(t, zone) * (atk === 'storm' && t.path === 'frost' ? 2 : 1);
  }
  if (atk === 'toll') {
    const ft = GAME.footprint({ type: 'legend', c: sp.c, r: sp.r, o: sp.o });
    v += 4 * towers.filter(t => ft.some(q => Math.abs(q[0] - t.c) <= 1 && Math.abs(q[1] - t.r) <= 1)).length;
  }
  return v + Math.random() * 0.5;
}
function placeGate(stat) {
  const S = GAME.S;
  let spots = GAME.gateSpots();
  if (!spots.length) {
    // bez miejsca: przestaw (za darmo) wieże, które blokują któreś prawidłowe miejsce
    stat.blocked = (stat.blocked || 0) + 1;
    const mine = S.towers.slice();
    S.towers = [];
    spots = GAME.gateSpots();
    S.towers = mine;
    if (!spots.length) return false;
    const sp = spots[Math.random() * spots.length | 0];
    const ft = GAME.footprint({ type: 'legend', c: sp.c, r: sp.r, o: sp.o });
    for (const t of mine) if (ft.some(q => q[0] === t.c && q[1] === t.r)) {
      let to = null;
      for (let c = 0; c < 16 && !to; c++) for (let r = 0; r < 9 && !to; r++) if (!GAME.cellState(c, r, t) && !ft.some(q => q[0] === c && q[1] === r)) to = [c, r];
      if (to) GAME.move(t, to[0], to[1]);
    }
    spots = GAME.gateSpots();
    if (!spots.length) return false;
  }
  spots.forEach(s => s.v = gateValue(s));
  spots.sort((a, b) => b.v - a.v);
  return !!GAME.build('legend', spots[0].c, spots[0].r);
}
const PREF = { path: { steel: 3, fire: 3.4, frost: 3, bolt: 3, poison: 3.2 } };
function think(stat) {
  const S = GAME.S;
  while (S.castle.pending) {
    const o = GAME.castleOffer();
    let i = o.findIndex(x => x.id === 'q' || x.id === 'pt');
    GAME.castleChoose(i < 0 ? 0 : i);
  }
  // budowa: legenda, potem rodzaje, których ma najmniej
  let guard = 0;
  while (guard++ < 20) {
    let types = S.f.tw.concat(['legend']).filter(t => !GAME.buildState(t));
    if (!types.length) break;
    if (GAME.nextWave() >= 15 && GAME.count('legend') === 0) { if (types.includes('legend')) types = ['legend']; else break; }
    types.sort((a, b) => GAME.count(a) - GAME.count(b) || S.f.tw.indexOf(b) - S.f.tw.indexOf(a));
    if (types[0] === 'legend') { if (!placeGate(stat)) break; continue; }
    const cell = bestCell(types[0]);
    if (!cell || !GAME.build(types[0], cell[0], cell[1])) break;
  }
  // punkty: legenda, potem wieża najbliżej pełnego ulepszenia
  guard = 0;
  while (S.points > 0 && guard++ < 40) {
    const list = S.towers.filter(t => GAME.canUpgrade(t));
    if (!list.length) break;
    list.sort((a, b) => (b.type === 'legend') - (a.type === 'legend') || b.level - a.level);
    const half = S.towers.filter(t => t.level > 0).length;
    let t = list[0];
    if (half < Math.min(4, S.towers.length)) t = list.find(x => x.level === 0) || t;
    const o = GAME.offer(t);
    let bi = 0, bs = -1;
    o.forEach((c, i) => { const s = (c.kind === 'path' ? PREF.path[c.id] : 3) + Math.random(); if (s > bs) { bs = s; bi = i; } });
    GAME.choose(t, bi);
    if (t.path) stat.paths[t.path] = (stat.paths[t.path] || 0) + 1;
  }
}
function run(fid, diff, k) {
  GAME.newGame({ faction: fid, diff, seed: 1000 + k * 17, enemy: DATA.ENEMY_FACTIONS[(k >> 2) % 5].id, theme: DATA.THEMES[(k >> 2) % 6].id });
  const S = () => GAME.S, stat = { paths: {}, dur: [], lost: [] };
  let steps = 0;
  while (!S().result) {
    think(stat);
    (stat.gold = stat.gold || [])[S().wave] = Math.round(S().gold);
    (stat.built = stat.built || [])[S().wave] = S().towers.length;
    const hp0 = S().hp, t0 = S().time;
    GAME.startWave();
    while (S().phase === 'wave' && !S().result) {
      GAME.update(1 / 30);
      const c = S().castle;
      if (S().enemies.some(e => Math.hypot(e.x - c.x, e.y - c.y) < 4)) { GAME.skill('q'); GAME.skill('e'); }
      if (S().enemies.length > 4) GAME.skill('r');
      if (++steps > 2e6) throw new Error('gra się nie kończy, fala ' + S().wave);
    }
    stat.dur[S().wave - 1] = S().time - t0;
    stat.lost[S().wave - 1] = hp0 - S().hp;
    const saved = GAME.save();
    if (saved && S().wave === 7) { GAME.load(saved); if (GAME.save() !== saved) throw new Error('zapis i odczyt dają różne stany'); }
  }
  return { score: S().score, scoreHp: S().scoreHp, scoreTime: S().scoreTime, gate: S().towers.some(t => t.type === 'legend'), res: S().result, wave: S().wave, towers: S().towers.length, enemy: S().ef.id, fid, ...stat };
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
for (const d of diffs) {
  const all = [];
  for (let i = 0; i < N; i++) all.push(run(DATA.FACTIONS[i % 4].id, d, i));
  const wins = all.filter(r => r.res === 'win');
  const grp = key => [...new Set(all.map(r => r[key]))].sort().map(v => { const g = all.filter(r => r[key] === v); return v + ' ' + Math.round(100 * g.filter(r => r.res === 'win').length / g.length) + '%'; }).join(' | ');
  console.log(d.padEnd(8), 'wygrane', wins.length + '/' + N, '(' + Math.round(100 * wins.length / N) + '%)', 'śr. fala', avg(all.map(r => r.wave)).toFixed(1));
  console.log('   frakcje:', grp('fid'));
  if (wins.length) console.log('   punkty w wygranych (średnio): za pokonanych', Math.round(avg(wins.map(r => r.score - r.scoreHp - r.scoreTime))), '| za HP', Math.round(avg(wins.map(r => r.scoreHp))), '| za czas', Math.round(avg(wins.map(r => r.scoreTime))), '| razem', Math.round(avg(wins.map(r => r.score))));
  console.log('   wrogowie:', grp('enemy'));
  console.log('   bramy postawione:', all.filter(r => r.gate).length, '| bez wolnego miejsca (przestawianie):', all.filter(r => r.blocked).length, '| porażki w falach 1-3:', all.filter(r => r.res === 'lose' && r.wave <= 3).length);
  console.log('   strata HP na falę:', Array.from({ length: 20 }, (_, w) => avg(all.map(r => r.lost[w]).filter(x => x !== undefined)).toFixed(1)).join(' '));
  const col = key => Array.from({ length: 20 }, (_, w) => Math.round(avg(all.map(r => r[key][w]).filter(x => x !== undefined)))).join(' ');
  console.log('   wolne złoto przed falą:', col('gold'));
  console.log('   wieże przed falą:', col('built'));
  console.log('   czas fali s:', Array.from({ length: 20 }, (_, w) => Math.round(avg(all.map(r => r.dur[w]).filter(x => x !== undefined)))).join(' '), '| walka w wygranych min:', (avg(wins.map(r => r.dur.reduce((a, b) => a + b, 0))) / 60).toFixed(1));
}
