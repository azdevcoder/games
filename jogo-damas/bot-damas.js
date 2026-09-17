// Bot de damas brasileiras — minimax alfa-beta, 5 niveis.
(function (global) {
  'use strict';

  var LEVELS = {
    'muito-facil': { depth: 1, random: 0.70, maxMs: 200 },
    'facil': { depth: 2, random: 0.12, maxMs: 300 },
    'medio': { depth: 3, random: 0, maxMs: 600 },
    'dificil': { depth: 5, random: 0, maxMs: 1200 },
    'muito-dificil': { depth: 8, random: 0, maxMs: 2500, iterative: true }
  };

  function opp(c) { return c === 'w' ? 'b' : 'w'; }

  function evaluate(g) {
    var s = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = g.board[r][c];
      if (!p) continue;
      var v;
      if (p.k) {
        v = 275 + (3 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c))) * 4;
      } else {
        var adv = p.c === 'w' ? (7 - r) : r;
        v = 100 + adv * 6;
        if ((r + c) % 2 === 1) v += (3 - Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c))) * 2;
        if ((p.c === 'w' && r === 7) || (p.c === 'b' && r === 0)) v += 8; // guarda base
      }
      s += p.c === 'w' ? v : -v;
    }
    return s;
  }

  // aplica sequencia completa (busca); desfaz via snapshot leve
  function doFull(g, mv) {
    var snap = {
      board: g.board.map(function (row) { return row.slice(); }),
      turn: g.turn, half: g.half, full: g.full
    };
    var p = g.board[mv.from.r][mv.from.c];
    var wasMan = !p.k;
    var cr = mv.from.r, cc = mv.from.c;
    g.board[cr][cc] = null;
    for (var i = 0; i < mv.path.length; i++) {
      var t = mv.path[i];
      var dr = t.r > cr ? 1 : -1, dc = t.c > cc ? 1 : -1, rr = cr + dr, cc2 = cc + dc;
      while (rr !== t.r || cc2 !== t.c) {
        if (g.board[rr][cc2]) { g.board[rr][cc2] = null; break; }
        rr += dr; cc2 += dc;
      }
      cr = t.r; cc = t.c;
    }
    g.board[cr][cc] = p;
    if (wasMan && cr === g.lastRank(p.c)) g.board[cr][cc] = { c: p.c, k: true };
    g.half = (mv.cap || wasMan) ? 0 : g.half + 1;
    if (g.turn === 'b') g.full++;
    g.turn = opp(g.turn);
    return snap;
  }
  function undoFull(g, snap) {
    g.board = snap.board; g.turn = snap.turn; g.half = snap.half; g.full = snap.full;
  }

  function orderMoves(g, moves) {
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i], s = 0;
      if (mv.cap) s = 10000 + mv.caps.length * 100;
      var p = g.board[mv.from.r][mv.from.c];
      if (p && !p.k) {
        var t = mv.path[mv.path.length - 1];
        if (t.r === g.lastRank(p.c)) s += 500;
      }
      mv._s = s;
    }
    moves.sort(function (a, b) { return b._s - a._s; });
    return moves;
  }

  function negamax(g, depth, alpha, beta, ply, deadline, nodes, extLeft) {
    if (nodes.stop) return 0;
    if ((nodes.count & 1023) === 0 && Date.now() > deadline) { nodes.stop = true; return 0; }
    nodes.count++;
    if (g.half >= 80) return 0;
    var color = g.turn, sign = color === 'w' ? 1 : -1;
    var moves = orderMoves(g, g.allMoves(color));
    if (!moves.length) {
      var n = g.countPieces(), mine = color === 'w' ? n.w : n.b;
      if (mine === 0) return -(100000 - ply);
      return -(100000 - ply); // bloqueado = derrota
    }
    if (depth <= 0) {
      // extensao: capturas forcadas entram mais fundo (limite)
      if (moves[0].cap && extLeft > 0) {
        // cai no loop abaixo com depth 0 -> forca sequencia de capturas
      } else {
        return sign * evaluate(g);
      }
    }
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var nd = depth - 1;
      var nextExt = extLeft;
      if (depth <= 0 && moves[i].cap && extLeft > 0) { nd = 0; nextExt = extLeft - 1; }
      var snap = doFull(g, moves[i]);
      var sc = -negamax(g, nd, -beta, -alpha, ply + 1, deadline, nodes, nextExt);
      undoFull(g, snap);
      if (nodes.stop) return 0;
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function searchRoot(g, depth, deadline, nodes) {
    var color = g.turn;
    var moves = orderMoves(g, g.allMoves(color));
    if (!moves.length) return { done: true, moves: [] };
    var scored = [], alpha = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var snap = doFull(g, moves[i]);
      var sc = -negamax(g, depth - 1, -Infinity, -alpha, 1, deadline, nodes, 6);
      undoFull(g, snap);
      if (nodes.stop) return { done: false, moves: scored };
      scored.push({ mv: moves[i], sc: sc });
      if (sc > alpha) alpha = sc;
    }
    scored.sort(function (a, b) { return b.sc - a.sc; });
    return { done: true, moves: scored };
  }

  function pickRandom(moves) { return moves[Math.floor(Math.random() * moves.length)]; }

  function chooseBotMove(game, levelKey) {
    var cfg = LEVELS[levelKey] || LEVELS.medio;
    var legal = game.allMoves(game.turn);
    if (!legal.length) return null;
    if (cfg.random && Math.random() < cfg.random) return pickRandom(legal);
    var deadline = Date.now() + cfg.maxMs;
    var nodes = { count: 0, stop: false };
    var depths = cfg.iterative ? [2, 3, 4, 5, 6, cfg.depth] : [cfg.depth];
    var best = null;
    for (var d = 0; d < depths.length; d++) {
      var res = searchRoot(game, depths[d], deadline, nodes);
      if (res.done && res.moves.length) best = res.moves;
      if (nodes.stop || Date.now() > deadline) break;
    }
    if (!best || !best.length) return pickRandom(legal);
    var top = best[0].sc;
    var pool = best.filter(function (e) { return top - e.sc <= 15; });
    return pickRandom(pool).mv;
  }

  var DamBot = { choose: chooseBotMove, levels: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = DamBot;
  global.DamBot = global.DamBot || DamBot;
})(typeof window !== 'undefined' ? window : globalThis);
