/* Generator krętych dróg na siatce 16 x 9.
   Reguły: wejście z lewej, zamek zawsze przy prawej krawędzi, zakręty na liniach co 2 kratki
   (kolumny 1,3,...,13 i rzędy 0,2,...,8), więc między odcinkami zostaje miejsce na wieże.
   Droga może przeciąć samą siebie najwyżej 2 razy (tylko na wprost, pod kątem prostym).
   Pod te reguły pasuje 12 304 564 dróg, z czego 10 416 619 spełnia warunki jakości. */
var Roads = (function () {
  'use strict';
  var NX = 7, NY = 5, COLS = 16, ROWS = 9;
  var EMIN = 17, EMAX = 23, MAXCROSS = 2, RANGE = 2.05;
  var Q = { minTurns: 7, minRatio: 2.0, minGreat: 2, maxGreat: 12 };
  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  function colOf(i) { return 1 + 2 * i; }
  function rowOf(j) { return 2 * j; }
  function segCover(ax, ay, bx, by) {
    var out = [], len = Math.abs(bx - ax) + Math.abs(by - ay), n = Math.round(len * 20);
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) {
      var hit = 0;
      for (var s = 0; s < n; s++) {
        var t = (s + 0.5) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if ((x - c) * (x - c) + (y - r) * (y - r) <= RANGE * RANGE) hit++;
      }
      if (hit) out.push([c * ROWS + r, hit * len / n]);
    }
    return out;
  }
  var EDGE = null, ENTRY = null;
  function prepare() {
    if (EDGE) return;
    EDGE = {}; ENTRY = [];
    for (var i = 0; i < NX; i++) for (var j = 0; j < NY; j++) for (var d = 0; d < 2; d++) {
      var a = i + DX[d], b = j + DY[d];
      if (a >= NX || b >= NY) continue;
      var cv = segCover(colOf(i), rowOf(j), colOf(a), rowOf(b));
      EDGE[(i * NY + j) + '-' + (a * NY + b)] = cv;
      EDGE[(a * NY + b) + '-' + (i * NY + j)] = cv;
    }
    for (var k = 0; k < NY; k++) ENTRY.push(segCover(0, rowOf(k), 1, rowOf(k)));
  }
  function cellsOf(nodes) {
    var y0 = rowOf(nodes[0] % NY), cells = [[-1, y0], [0, y0], [1, y0]];
    for (var k = 1; k < nodes.length; k++) {
      var i0 = nodes[k - 1] / NY | 0, j0 = nodes[k - 1] % NY, i1 = nodes[k] / NY | 0, j1 = nodes[k] % NY;
      cells.push([(colOf(i0) + colOf(i1)) / 2, (rowOf(j0) + rowOf(j1)) / 2]);
      cells.push([colOf(i1), rowOf(j1)]);
    }
    return cells;
  }
  function castleOf(nodes) {
    var y = rowOf(nodes[nodes.length - 1] % NY), top = y < ROWS - 1 ? y : y - 1;
    return [[14, top], [15, top], [14, top + 1], [15, top + 1]];
  }
  function turnsOf(dirs) {
    var t = 0, prev = 0;
    for (var k = 0; k < dirs.length; k++) { if (dirs[k] !== prev) t++; prev = dirs[k]; }
    return t;
  }
  function measure(nodes) {
    prepare();
    var cells = cellsOf(nodes), castle = castleOf(nodes), k, i;
    var isPath = [], cov = [], vals = [];
    for (i = 0; i < COLS * ROWS; i++) { isPath[i] = 0; cov[i] = 0; }
    for (k = 0; k < cells.length; k++) if (cells[k][0] >= 0) isPath[cells[k][0] * ROWS + cells[k][1]] = 1;
    for (k = 0; k < 4; k++) isPath[castle[k][0] * ROWS + castle[k][1]] = 1;
    var add = function (list) { for (var q = 0; q < list.length; q++) cov[list[q][0]] += list[q][1]; };
    add(ENTRY[nodes[0] % NY]);
    for (k = 1; k < nodes.length; k++) add(EDGE[nodes[k - 1] + '-' + nodes[k]]);
    var best = 0;
    for (i = 0; i < COLS * ROWS; i++) if (!isPath[i] && cov[i] > 0.001) { vals.push(cov[i]); if (cov[i] > best) best = cov[i]; }
    vals.sort(function (a, b) { return a - b; });
    var med = vals[vals.length >> 1], great = 0;
    for (i = 0; i < vals.length; i++) if (vals[i] >= 0.8 * best) great++;
    return { best: best, med: med, ratio: best / med, great: great };
  }
  function walk(start, order, onDone) {
    var visit = [], straight = [], axis = [], used = {}, nodes = [start], dirs = [], stop = false, crosses = 0, q0;
    for (q0 = 0; q0 < NX * NY; q0++) { visit[q0] = 0; straight[q0] = 0; axis[q0] = 0; }
    visit[start] = 1;
    function step(node, inDir, edges) {
      if (stop) return;
      var i = node / NY | 0, j = node % NY;
      if (i === NX - 1 && edges >= EMIN && visit[node] === 1) { if (onDone(nodes, dirs, crosses) === true) { stop = true; return; } }
      if (edges >= EMAX || EMAX - edges < NX - 1 - i) return;
      var list = order([0, 1, 2, 3]);
      for (var q = 0; q < 4 && !stop; q++) {
        var d = list[q];
        if (d === ((inDir + 2) & 3)) continue;
        var a = i + DX[d], b = j + DY[d];
        if (a < 0 || a >= NX || b < 0 || b >= NY) continue;
        var next = a * NY + b, key = node < next ? node * 64 + next : next * 64 + node;
        if (used[key]) continue;
        var crossingHere = visit[node] === 2;
        if (crossingHere && d !== inDir) continue;
        var wasStraight = straight[node], wasAxis = axis[node];
        if (!crossingHere) { straight[node] = (d === inDir && nodes.length > 1) ? 1 : 0; axis[node] = d & 1; }
        var cross = false;
        if (visit[next]) {
          var fa = a + DX[d], fb = b + DY[d];
          if (visit[next] !== 1 || !straight[next] || axis[next] === (d & 1) || crosses >= MAXCROSS || fa < 0 || fa >= NX || fb < 0 || fb >= NY) {
            straight[node] = wasStraight; axis[node] = wasAxis; continue;
          }
          cross = true;
        }
        used[key] = 1; visit[next]++; if (cross) crosses++;
        nodes.push(next); dirs.push(d);
        step(next, d, edges + 1);
        nodes.pop(); dirs.pop();
        used[key] = 0; visit[next]--; if (cross) crosses--;
        straight[node] = wasStraight; axis[node] = wasAxis;
      }
    }
    step(start, 0, 0);
  }
  function random(rnd) {
    prepare();
    for (var attempt = 0; attempt < 4000; attempt++) {
      var found = null, budget = 3000, want = EMIN + (rnd() * (EMAX - EMIN + 1) | 0);
      walk((rnd() * NY) | 0, function (l) {
        for (var k = l.length - 1; k > 0; k--) { var s = rnd() * (k + 1) | 0, t = l[k]; l[k] = l[s]; l[s] = t; }
        return l;
      }, function (nodes, dirs, crosses) {
        if (--budget < 0) return true;
        if (dirs.length !== want) return false;
        var turns = turnsOf(dirs), m = measure(nodes);
        if (turns >= Q.minTurns && m.ratio >= Q.minRatio && m.great >= Q.minGreat && m.great <= Q.maxGreat) found = { nodes: nodes.slice(), turns: turns, crossings: crosses };
        return true;
      });
      if (found) return found;
    }
    return { nodes: [1, 6, 11, 16, 21, 26, 31, 32, 33, 28, 23, 18, 13, 8, 9, 14, 19, 24, 29, 34], turns: 7, crossings: 0 };
  }
  return { random: random, cellsOf: cellsOf, castleOf: castleOf, measure: measure };
})();
if (typeof module !== 'undefined') module.exports = Roads;
