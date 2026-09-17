// Damas brasileiras (8x8): peao anda p/ frente, captura p/ frente e tras,
// dama VOADORA (longa distância), captura obrigatoria com regra da maioria,
// promocao ao parar na ultima fileira, multiplos saltos no mesmo turno.
(function (global) {
  'use strict';

  var DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function Draughts() { this.reset(); }

  Draughts.prototype.reset = function () {
    this.board = [];
    for (var r = 0; r < 8; r++) {
      this.board.push([]);
      for (var c = 0; c < 8; c++) {
        var p = null;
        if ((r + c) % 2 === 1) {
          if (r < 3) p = { c: 'b', k: false };
          else if (r > 4) p = { c: 'w', k: false };
        }
        this.board[r].push(p);
      }
    }
    this.turn = 'w';
    this.half = 0; this.full = 1;
    this.history = [];
    this.midTurn = null; // {r,c} peca no meio de captura multipla
    this.counts = {};
    this._bump();
  };

  Draughts.prototype.inB = function (r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; };
  Draughts.prototype.opp = function (x) { return x === 'w' ? 'b' : 'w'; };
  Draughts.prototype.lastRank = function (color) { return color === 'w' ? 0 : 7; };
  Draughts.prototype.fwd = function (color) { return color === 'w' ? -1 : 1; };

  Draughts.prototype.key = function (b, t) {
    var s = t || this.turn, bd = b || this.board, out = s + '|';
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = bd[r][c];
      out += p ? (p.c + (p.k ? 'K' : 'M')) : '.';
    }
    return out;
  };
  Draughts.prototype._bump = function () {
    var k = this.key();
    this.counts[k] = (this.counts[k] || 0) + 1;
  };
  Draughts.prototype._snap = function () {
    return { b: JSON.parse(JSON.stringify(this.board)), t: this.turn, h: this.half, f: this.full, mid: this.midTurn ? { r: this.midTurn.r, c: this.midTurn.c } : null, counts: Object.assign({}, this.counts) };
  };
  Draughts.prototype._restore = function (s) {
    this.board = s.b; this.turn = s.t; this.half = s.h; this.full = s.f;
    this.midTurn = s.mid;
    this.counts = Object.assign({}, s.counts);
  };

  // ---- geracao de capturas (sequencias) sobre um tabuleiro dado ----
  Draughts.prototype._manCaps = function (b, r, c, color) {
    var self = this, seqs = [];
    var visited = {};
    visited[r + ',' + c] = true;
    (function rec(cr, cc, path, caps) {
      var extended = false;
      for (var d = 0; d < 4; d++) {
        var mr = cr + DIRS[d][0], mc = cc + DIRS[d][1];
        var lr = cr + 2 * DIRS[d][0], lc = cc + 2 * DIRS[d][1];
        if (!self.inB(lr, lc)) continue;
        var mid = b[mr][mc], land = b[lr][lc];
        if (!mid || mid.c !== self.opp(color) || land) continue;
        if (visited[lr + ',' + lc]) continue;
        extended = true;
        var taken = mid;
        b[mr][mc] = null; b[cr][cc] = null; b[lr][lc] = { c: color, k: false };
        visited[lr + ',' + lc] = true;
        path.push({ r: lr, c: lc }); caps.push({ r: mr, c: mc });
        rec(lr, lc, path, caps);
        path.pop(); caps.pop();
        delete visited[lr + ',' + lc];
        b[mr][mc] = taken; b[lr][lc] = null; b[cr][cc] = { c: color, k: false };
      }
      if (!extended && caps.length) seqs.push({ path: path.slice(), caps: caps.slice() });
    })(r, c, [{ r: r, c: c }], []);
    return seqs;
  };

  Draughts.prototype._kingCaps = function (b, r, c, color) {
    var self = this, seqs = [];
    var visited = {};
    visited[r + ',' + c] = true;
    (function rec(cr, cc, path, caps) {
      var extended = false;
      for (var d = 0; d < 4; d++) {
        var dr = DIRS[d][0], dc = DIRS[d][1];
        var rr = cr + dr, cc2 = cc + dc;
        // varre casas vazias ate a primeira peca
        while (self.inB(rr, cc2) && !b[rr][cc2]) { rr += dr; cc2 += dc; }
        if (!self.inB(rr, cc2)) continue;
        var mid = b[rr][cc2];
        if (!mid || mid.c !== self.opp(color)) continue;
        // cada casa vazia apos a peca e um pouso possivel
        var lr = rr + dr, lc = cc2 + dc;
        var landings = [];
        while (self.inB(lr, lc) && !b[lr][lc]) { landings.push({ r: lr, c: lc }); lr += dr; lc += dc; }
        for (var i = 0; i < landings.length; i++) {
          var L = landings[i];
          if (visited[L.r + ',' + L.c]) continue;
          extended = true;
          b[rr][cc2] = null; b[cr][cc] = null; b[L.r][L.c] = { c: color, k: true };
          visited[L.r + ',' + L.c] = true;
          path.push({ r: L.r, c: L.c }); caps.push({ r: rr, c: cc2 });
          rec(L.r, L.c, path, caps);
          path.pop(); caps.pop();
          delete visited[L.r + ',' + L.c];
          b[rr][cc2] = mid; b[L.r][L.c] = null; b[cr][cc] = { c: color, k: true };
        }
      }
      if (!extended && caps.length) seqs.push({ path: path.slice(), caps: caps.slice() });
    })(r, c, [{ r: r, c: c }], []);
    return seqs;
  };

  Draughts.prototype._capsFrom = function (b, r, c) {
    var p = b[r][c];
    if (!p) return [];
    return p.k ? this._kingCaps(b, r, c, p.c) : this._manCaps(b, r, c, p.c);
  };

  Draughts.prototype.allCaptures = function (color, b) {
    var bd = b || this.board, all = [], max = 0, r, c;
    for (r = 0; r < 8; r++) for (c = 0; c < 8; c++) {
      var p = bd[r][c];
      if (!p || p.c !== color) continue;
      var seqs = this._capsFrom(bd, r, c);
      for (var i = 0; i < seqs.length; i++) {
        var mv = { from: { r: r, c: c }, path: seqs[i].path.slice(1), caps: seqs[i].caps, cap: true };
        all.push(mv);
        if (seqs[i].caps.length > max) max = seqs[i].caps.length;
      }
    }
    // regra da maioria: so as sequencias com o maximo de capturas
    return all.filter(function (m) { return m.caps.length === max; });
  };

  Draughts.prototype.quietMoves = function (color, b) {
    var bd = b || this.board, out = [], r, c, i;
    for (r = 0; r < 8; r++) for (c = 0; c < 8; c++) {
      var p = bd[r][c];
      if (!p || p.c !== color) continue;
      if (!p.k) {
        var f = this.fwd(color);
        var steps = [[f, -1], [f, 1]];
        for (i = 0; i < 2; i++) {
          var tr = r + steps[i][0], tc = c + steps[i][1];
          if (this.inB(tr, tc) && !bd[tr][tc]) out.push({ from: { r: r, c: c }, path: [{ r: tr, c: tc }], caps: [], cap: false });
        }
      } else {
        for (i = 0; i < 4; i++) {
          var rr = r + DIRS[i][0], cc = c + DIRS[i][1];
          while (this.inB(rr, cc) && !bd[rr][cc]) {
            out.push({ from: { r: r, c: c }, path: [{ r: rr, c: cc }], caps: [], cap: false });
            rr += DIRS[i][0]; cc += DIRS[i][1];
          }
        }
      }
    }
    return out;
  };

  Draughts.prototype.allMoves = function (color, b) {
    var caps = this.allCaptures(color, b);
    return caps.length ? caps : this.quietMoves(color, b);
  };

  Draughts.prototype.movesForPiece = function (r, c) {
    var p = this.board[r][c];
    if (!p || p.c !== this.turn) return [];
    if (this.midTurn && (this.midTurn.r !== r || this.midTurn.c !== c)) return [];
    var seqs;
    if (this.midTurn) {
      // continuacao obrigatoria: so capturas a partir da peca
      seqs = this._capsFrom(this.board, r, c);
      if (!seqs.length) return [];
      var mx = 0, i;
      for (i = 0; i < seqs.length; i++) mx = Math.max(mx, seqs[i].caps.length);
      var out = [];
      for (i = 0; i < seqs.length; i++) {
        if (seqs[i].caps.length === mx) out.push({ from: { r: r, c: c }, path: seqs[i].path.slice(1), caps: seqs[i].caps, cap: true });
      }
      return out;
    }
    var all = this.allMoves(this.turn);
    return all.filter(function (m) { return m.from.r === r && m.from.c === c; });
  };

  Draughts.prototype.captureFroms = function () {
    if (this.midTurn) return [{ r: this.midTurn.r, c: this.midTurn.c }];
    var caps = this.allCaptures(this.turn), seen = {}, out = [];
    for (var i = 0; i < caps.length; i++) {
      var k = caps[i].from.r + ',' + caps[i].from.c;
      if (!seen[k]) { seen[k] = true; out.push({ r: caps[i].from.r, c: caps[i].from.c }); }
    }
    return out;
  };

  // aplica UM passo (um pouso). Retorna info ou null se ilegal.
  // {continued:true} quando ha mais capturas obrigatorias com a mesma peca.
  Draughts.prototype.step = function (fr, fc, tr, tc) {
    var p = this.board[fr][fc];
    if (!p || p.c !== this.turn) return null;
    if (this.midTurn && (this.midTurn.r !== fr || this.midTurn.c !== fc)) return null;
    var opts = this.movesForPiece(fr, fc);
    var chosen = null, i;
    for (i = 0; i < opts.length; i++) {
      if (opts[i].path[0].r === tr && opts[i].path[0].c === tc) { chosen = opts[i]; break; }
    }
    if (!chosen) return null;
    if (!this.midTurn) this.history.push(this._snap());
    var stepCaps = [];
    if (chosen.cap) {
      // remove capturadas deste passo: peca(s) entre origem e pouso
      var dr = tr > fr ? 1 : -1, dc = tc > fc ? 1 : -1, rr = fr + dr, cc = fc + dc;
      while (rr !== tr || cc !== tc) {
        if (this.board[rr][cc]) { stepCaps.push({ r: rr, c: cc, p: this.board[rr][cc] }); this.board[rr][cc] = null; break; }
        rr += dr; cc += dc;
      }
      // peao: captura adjacente (mid conhecido); dama: a encontrada acima.
      // garante remocao mesmo se o laco acima falhar (peao):
      if (!stepCaps.length) {
        for (i = 0; i < chosen.caps.length; i++) {
          var cp = chosen.caps[i];
          if (this.board[cp.r][cp.c]) { stepCaps.push({ r: cp.r, c: cp.c, p: this.board[cp.r][cp.c] }); this.board[cp.r][cp.c] = null; break; }
        }
      }
    }
    this.board[tr][tc] = p;
    this.board[fr][fc] = null;
    var crowned = false;
    if (!p.k && tr === this.lastRank(p.c)) { this.board[tr][tc] = { c: p.c, k: true }; crowned = true; }
    this.half = (chosen.cap || !p.k) ? 0 : this.half + 1;
    var mover = this.turn, continued = false;
    if (chosen.cap && !crowned) {
      var more = this._capsFrom(this.board, tr, tc);
      if (more.length) { this.midTurn = { r: tr, c: tc }; continued = true; }
    }
    if (!continued) {
      this.midTurn = null;
      this.turn = this.opp(mover);
      if (mover === 'b') this.full++;
      this._bump();
    }
    return { cap: chosen.cap, caps: stepCaps, crowned: crowned, continued: continued, fullCaps: chosen.caps };
  };

  Draughts.prototype.undo = function () {
    if (!this.history.length) return false;
    var s = this.history.pop();
    this._restore(s);
    return true;
  };

  Draughts.prototype.countPieces = function () {
    var n = { w: 0, b: 0, wk: 0, bk: 0 };
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      if (!p) continue;
      if (p.c === 'w') { n.w++; if (p.k) n.wk++; } else { n.b++; if (p.k) n.bk++; }
    }
    return n;
  };

  Draughts.prototype.capturedBy = function (color) {
    // pecas que 'color' capturou do oponente (p/ exibicao)
    var n = this.countPieces(), out = [], i;
    var enemyStart = 12;
    var enemyLeft = color === 'w' ? n.b : n.w;
    for (i = 0; i < enemyStart - enemyLeft; i++) out.push('m');
    return out;
  };

  Draughts.prototype.status = function () {
    var t = this.turn, o = this.opp(t);
    var n = this.countPieces();
    var mine = t === 'w' ? n.w : n.b;
    if (mine === 0) return { over: true, winner: o, reason: 'capture-all' };
    if (!this.midTurn && !this.allMoves(t).length) return { over: true, winner: o, reason: 'blocked' };
    if (n.w === 1 && n.b === 1 && n.wk === 1 && n.bk === 1) return { over: true, winner: null, reason: 'kings' };
    if (this.half >= 80) return { over: true, winner: null, reason: 'forty' };
    if ((this.counts[this.key()] || 0) >= 3) return { over: true, winner: null, reason: 'threefold' };
    return { over: false, winner: null, reason: null };
  };

  Draughts.prototype.sqName = function (r, c) {
    return 'abcdefgh'[c] + (8 - r);
  };

  var D = { Draughts: Draughts };
  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  global.Draughts = global.Draughts || Draughts;
})(typeof window !== 'undefined' ? window : globalThis);
