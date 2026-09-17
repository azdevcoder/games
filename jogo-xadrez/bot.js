// Bot de xadrez — minimax alfa-beta com tabelas posicao, 5 niveis.
// Usa a API publica de Chess (pseudoMoves, isAttacked, kingPos, isInCheck)
// com aplicar/desfazer leve proprio (sem historico), para busca rapida.
(function (global) {
  'use strict';

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var PST = {
    p: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [50, 50, 50, 50, 50, 50, 50, 50],
      [10, 10, 20, 30, 30, 20, 10, 10],
      [5, 5, 10, 25, 25, 10, 5, 5],
      [0, 0, 0, 20, 20, 0, 0, 0],
      [5, -5, -10, 0, 0, -10, -5, 5],
      [5, 10, 10, -20, -20, 10, 10, 5],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    n: [
      [-50, -40, -30, -30, -30, -30, -40, -50],
      [-40, -20, 0, 0, 0, 0, -20, -40],
      [-30, 0, 10, 15, 15, 10, 0, -30],
      [-30, 5, 15, 20, 20, 15, 5, -30],
      [-30, 0, 15, 20, 20, 15, 0, -30],
      [-30, 5, 10, 15, 15, 10, 5, -30],
      [-40, -20, 0, 5, 5, 0, -20, -40],
      [-50, -40, -30, -30, -30, -30, -40, -50]
    ],
    b: [
      [-20, -10, -10, -10, -10, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 10, 10, 5, 0, -10],
      [-10, 5, 5, 10, 10, 5, 5, -10],
      [-10, 0, 10, 10, 10, 10, 0, -10],
      [-10, 10, 10, 10, 10, 10, 10, -10],
      [-10, 5, 0, 0, 0, 0, 5, -10],
      [-20, -10, -10, -10, -10, -10, -10, -20]
    ],
    r: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [5, 10, 10, 10, 10, 10, 10, 5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [-5, 0, 0, 0, 0, 0, 0, -5],
      [0, 0, 0, 5, 5, 0, 0, 0]
    ],
    q: [
      [-20, -10, -10, -5, -5, -10, -10, -20],
      [-10, 0, 0, 0, 0, 0, 0, -10],
      [-10, 0, 5, 5, 5, 5, 0, -10],
      [-5, 0, 5, 5, 5, 5, 0, -5],
      [0, 0, 5, 5, 5, 5, 0, -5],
      [-10, 5, 5, 5, 5, 5, 0, -10],
      [-10, 0, 5, 0, 0, 0, 0, -10],
      [-20, -10, -10, -5, -5, -10, -10, -20]
    ],
    k: [
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-30, -40, -40, -50, -50, -40, -40, -30],
      [-20, -30, -30, -40, -40, -30, -30, -20],
      [-10, -20, -20, -20, -20, -20, -20, -10],
      [20, 20, 0, 0, 0, 0, 20, 20],
      [20, 30, 10, 0, 0, 10, 30, 20]
    ]
  };

  var LEVELS = {
    'muito-facil': { depth: 1, quiesce: false, random: 0.70, maxMs: 200 },
    'facil': { depth: 1, quiesce: false, random: 0.12, maxMs: 300 },
    'medio': { depth: 2, quiesce: true, random: 0, maxMs: 600 },
    'dificil': { depth: 3, quiesce: true, random: 0, maxMs: 1200 },
    'muito-dificil': { depth: 4, quiesce: true, random: 0, maxMs: 2500, iterative: true }
  };

  function opp(c) { return c === 'w' ? 'b' : 'w'; }

  function evaluate(game) {
    var s = 0;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = game.board[r][c];
      if (!p || p.t === 'k') continue;
      var v = VAL[p.t] + (p.c === 'w' ? PST[p.t][r][c] : PST[p.t][7 - r][c]);
      s += p.c === 'w' ? v : -v;
    }
    return s;
  }

  // aplicar/desfazer leve (sem historico/SAN/contagem) p/ busca
  function doRaw(game, mv) {
    var b = game.board;
    var piece = b[mv.from.r][mv.from.c];
    var capSq = mv.ep ? { r: mv.from.r, c: mv.to.c } : { r: mv.to.r, c: mv.to.c };
    var snap = {
      board: b.map(function (row) { return row.slice(); }),
      castling: { K: game.castling.K, Q: game.castling.Q, k: game.castling.k, q: game.castling.q },
      ep: game.ep, half: game.halfmove, full: game.fullmove,
      mover: game.turn, captured: b[capSq.r][capSq.c]
    };
    if (piece.t === 'k') {
      if (piece.c === 'w') { game.castling.K = false; game.castling.Q = false; }
      else { game.castling.k = false; game.castling.q = false; }
    }
    if (piece.t === 'r') {
      if (mv.from.r === 7 && mv.from.c === 0) game.castling.Q = false;
      if (mv.from.r === 7 && mv.from.c === 7) game.castling.K = false;
      if (mv.from.r === 0 && mv.from.c === 0) game.castling.q = false;
      if (mv.from.r === 0 && mv.from.c === 7) game.castling.k = false;
    }
    var rook = b[mv.to.r][mv.to.c];
    if (rook && rook.t === 'r') {
      if (mv.to.r === 7 && mv.to.c === 0) game.castling.Q = false;
      if (mv.to.r === 7 && mv.to.c === 7) game.castling.K = false;
      if (mv.to.r === 0 && mv.to.c === 0) game.castling.q = false;
      if (mv.to.r === 0 && mv.to.c === 7) game.castling.k = false;
    }
    game._applyRaw(mv);
    game.ep = mv.double ? { r: (mv.from.r + mv.to.r) / 2, c: mv.from.c } : null;
    game.halfmove = (piece.t === 'p' || snap.captured) ? 0 : game.halfmove + 1;
    if (snap.mover === 'b') game.fullmove++;
    game.turn = opp(game.turn);
    return snap;
  }

  function undoRaw(game, mv, snap) {
    game.board = snap.board;
    game.castling = snap.castling;
    game.ep = snap.ep;
    game.halfmove = snap.half;
    game.fullmove = snap.full;
    game.turn = snap.mover;
    void mv;
  }

  function genLegal(game, color, capturesOnly) {
    var out = [];
    var saved = game.turn;
    game.turn = color;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = game.board[r][c];
      if (!p || p.c !== color) continue;
      var pseudos = game.pseudoMoves(r, c);
      for (var i = 0; i < pseudos.length; i++) {
        var mv = pseudos[i];
        if (capturesOnly) {
          if (!game.board[mv.to.r][mv.to.c] && !mv.ep) continue;
        }
        var snap = doRaw(game, mv);
        var k = game.kingPos(color);
        if (!game.isAttacked(k.r, k.c, opp(color))) out.push(mv);
        undoRaw(game, mv, snap);
      }
    }
    game.turn = saved;
    return out;
  }

  function orderMoves(game, moves) {
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      var victim = game.board[mv.to.r][mv.to.c];
      var attacker = game.board[mv.from.r][mv.from.c];
      var s = 0;
      if (victim) s = 10 * VAL[victim.t] - VAL[attacker.t];
      else if (mv.ep) s = 10 * VAL.p - VAL.p;
      if (mv.promo) s += VAL[mv.promo] || 0;
      mv._s = s;
    }
    moves.sort(function (a, b) { return b._s - a._s; });
    return moves;
  }

  function quiesce(game, alpha, beta, ply, deadline, nodes, qd) {
    if (nodes.stop) return 0;
    if ((nodes.count & 1023) === 0 && Date.now() > deadline) { nodes.stop = true; return 0; }
    nodes.count++;
    var color = game.turn;
    var sign = color === 'w' ? 1 : -1;
    var inChk = game.isInCheck(color);
    if (!inChk) {
      var stand = sign * evaluate(game);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd <= 0) return alpha;
    } else if (qd <= -4) {
      return sign * evaluate(game);
    }
    var moves = orderMoves(game, genLegal(game, color, !inChk));
    if (inChk && !moves.length) return -(100000 - ply);
    for (var i = 0; i < moves.length; i++) {
      var snap = doRaw(game, moves[i]);
      var sc = -quiesce(game, -beta, -alpha, ply + 1, deadline, nodes, qd - 1);
      undoRaw(game, moves[i], snap);
      if (nodes.stop) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(game, depth, alpha, beta, ply, deadline, nodes, useQ) {
    if (nodes.stop) return 0;
    if ((nodes.count & 1023) === 0 && Date.now() > deadline) { nodes.stop = true; return 0; }
    nodes.count++;
    if (game.halfmove >= 100) return 0;
    var color = game.turn;
    var sign = color === 'w' ? 1 : -1;
    if (depth <= 0) {
      if (useQ) return quiesce(game, alpha, beta, ply, deadline, nodes, 8);
      return sign * evaluate(game);
    }
    var moves = orderMoves(game, genLegal(game, color, false));
    if (!moves.length) return game.isInCheck(color) ? -(100000 - ply) : 0;
    var best = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var snap = doRaw(game, moves[i]);
      var sc = -negamax(game, depth - 1, -beta, -alpha, ply + 1, deadline, nodes, useQ);
      undoRaw(game, moves[i], snap);
      if (nodes.stop) return 0;
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function searchRoot(game, depth, deadline, nodes, useQ) {
    var color = game.turn;
    var moves = orderMoves(game, genLegal(game, color, false));
    if (!moves.length) return { done: true, moves: [] };
    var scored = [];
    var alpha = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var snap = doRaw(game, moves[i]);
      var sc = -negamax(game, depth - 1, -Infinity, -alpha, 1, deadline, nodes, useQ);
      undoRaw(game, moves[i], snap);
      if (nodes.stop) return { done: false, moves: scored };
      scored.push({ mv: moves[i], sc: sc });
      if (sc > alpha) alpha = sc;
    }
    scored.sort(function (a, b) { return b.sc - a.sc; });
    return { done: true, moves: scored };
  }

  function pickRandom(moves) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  function chooseBotMove(game, levelKey) {
    var cfg = LEVELS[levelKey] || LEVELS.medio;
    var color = game.turn;
    var legal = genLegal(game, color, false);
    if (!legal.length) return null;
    if (cfg.random && Math.random() < cfg.random) {
      var rm = pickRandom(legal);
      return { from: rm.from, to: rm.to, promo: rm.promo };
    }
    var deadline = Date.now() + cfg.maxMs;
    var nodes = { count: 0, stop: false };
    var depths = cfg.iterative
      ? [1, 2, 3, cfg.depth]
      : [cfg.depth];
    var best = null;
    for (var d = 0; d < depths.length; d++) {
      var res = searchRoot(game, depths[d], deadline, nodes, cfg.quiesce);
      if (res.done && res.moves.length) best = res.moves;
      if (nodes.stop || Date.now() > deadline) break;
    }
    if (!best || !best.length) {
      var fm = pickRandom(legal);
      return { from: fm.from, to: fm.to, promo: fm.promo };
    }
    // variedade: sorteia entre lances ate 12cp do melhor
    var top = best[0].sc;
    var pool = best.filter(function (e) { return top - e.sc <= 12; });
    var chosen = pickRandom(pool).mv;
    return { from: chosen.from, to: chosen.to, promo: chosen.promo };
  }

  var Bot = { choose: chooseBotMove, levels: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Bot;
  global.Bot = global.Bot || Bot;
})(typeof window !== 'undefined' ? window : globalThis);
