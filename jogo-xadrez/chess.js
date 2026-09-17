// Motor de xadrez — regras FIDE completas (local, 2 jogadores).
// Board: board[r][c], r=0 rank8, r=7 rank1. Peca: {t:'p|n|b|r|q|k', c:'w|b'}
(function (global) {
  'use strict';

  function initialBoard() {
    var back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    var b = [];
    for (var r = 0; r < 8; r++) { b.push([null, null, null, null, null, null, null, null]); }
    for (var c = 0; c < 8; c++) {
      b[0][c] = { t: back[c], c: 'b' };
      b[1][c] = { t: 'p', c: 'b' };
      b[6][c] = { t: 'p', c: 'w' };
      b[7][c] = { t: back[c], c: 'w' };
    }
    return b;
  }

  function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  function sqName(r, c) { return 'abcdefgh'.charAt(c) + String(8 - r); }
  function parseSq(s) {
    var c = 'abcdefgh'.indexOf(s.charAt(0));
    var r = 8 - parseInt(s.charAt(1), 10);
    return { r: r, c: c };
  }

  function Chess() { this.reset(); }

  Chess.prototype.reset = function () {
    this.board = initialBoard();
    this.turn = 'w';
    this.castling = { K: true, Q: true, k: true, q: true };
    this.ep = null; // {r,c} casa capturavel en passant
    this.halfmove = 0;
    this.fullmove = 1;
    this.history = [];
    this.posCounts = {};
    this._countPos();
  };

  Chess.prototype._key = function () {
    var s = this.turn + '|';
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      s += p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.';
    }
    s += '|' + (this.castling.K ? 'K' : '') + (this.castling.Q ? 'Q' : '') +
      (this.castling.k ? 'k' : '') + (this.castling.q ? 'q' : '') + '|' +
      (this.ep ? sqName(this.ep.r, this.ep.c) : '-');
    return s;
  };

  Chess.prototype._countPos = function () {
    var k = this._key();
    this.posCounts[k] = (this.posCounts[k] || 0) + 1;
  };

  Chess.prototype.kingPos = function (color) {
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      if (p && p.t === 'k' && p.c === color) return { r: r, c: c };
    }
    return null;
  };

  // Casa (r,c) atacada por cor `by`?
  Chess.prototype.isAttacked = function (r, c, by) {
    var b = this.board, i, rr, cc;
    // peoes
    var pr = by === 'w' ? r + 1 : r - 1;
    for (var dc = -1; dc <= 1; dc += 2) {
      var pc = c + dc;
      if (inB(pr, pc)) { var p = b[pr][pc]; if (p && p.c === by && p.t === 'p') return true; }
    }
    // cavalos
    var N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (i = 0; i < N.length; i++) {
      rr = r + N[i][0]; cc = c + N[i][1];
      if (inB(rr, cc)) { var n = b[rr][cc]; if (n && n.c === by && n.t === 'n') return true; }
    }
    // rei
    for (var dr = -1; dr <= 1; dr++) for (var dc2 = -1; dc2 <= 1; dc2++) {
      if (!dr && !dc2) continue;
      rr = r + dr; cc = c + dc2;
      if (inB(rr, cc)) { var k = b[rr][cc]; if (k && k.c === by && k.t === 'k') return true; }
    }
    // deslizantes
    var dirsR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var dirsB = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    var d;
    for (d = 0; d < 4; d++) {
      rr = r + dirsR[d][0]; cc = c + dirsR[d][1];
      while (inB(rr, cc)) {
        var q = b[rr][cc];
        if (q) { if (q.c === by && (q.t === 'r' || q.t === 'q')) return true; break; }
        rr += dirsR[d][0]; cc += dirsR[d][1];
      }
    }
    for (d = 0; d < 4; d++) {
      rr = r + dirsB[d][0]; cc = c + dirsB[d][1];
      while (inB(rr, cc)) {
        var q2 = b[rr][cc];
        if (q2) { if (q2.c === by && (q2.t === 'b' || q2.t === 'q')) return true; break; }
        rr += dirsB[d][0]; cc += dirsB[d][1];
      }
    }
    return false;
  };

  Chess.prototype.isInCheck = function (color) {
    var k = this.kingPos(color);
    if (!k) return false;
    return this.isAttacked(k.r, k.c, opp(color));
  };

  // pseudo-lances (sem filtro de auto-xeque). Move: {from:{r,c},to:{r,c},promo?,castle?,ep?}
  Chess.prototype.pseudoMoves = function (r, c) {
    var b = this.board, p = b[r][c], out = [];
    if (!p) return out;
    var i, rr, cc;
    function slide(dirs) {
      for (var d = 0; d < dirs.length; d++) {
        var nr = r + dirs[d][0], nc = c + dirs[d][1];
        while (inB(nr, nc)) {
          var t = b[nr][nc];
          if (!t) out.push({ from: { r: r, c: c }, to: { r: nr, c: nc } });
          else { if (t.c !== p.c) out.push({ from: { r: r, c: c }, to: { r: nr, c: nc } }); break; }
          nr += dirs[d][0]; nc += dirs[d][1];
        }
      }
    }
    if (p.t === 'p') {
      var dir = p.c === 'w' ? -1 : 1;
      var start = p.c === 'w' ? 6 : 1;
      var last = p.c === 'w' ? 0 : 7;
      if (inB(r + dir, c) && !b[r + dir][c]) {
        if (r + dir === last) {
          ['q', 'r', 'b', 'n'].forEach(function (pr) {
            out.push({ from: { r: r, c: c }, to: { r: r + dir, c: c }, promo: pr });
          });
        } else {
          out.push({ from: { r: r, c: c }, to: { r: r + dir, c: c } });
          if (r === start && !b[r + 2 * dir][c]) out.push({ from: { r: r, c: c }, to: { r: r + 2 * dir, c: c }, double: true });
        }
      }
      for (var dc = -1; dc <= 1; dc += 2) {
        var nr2 = r + dir, nc2 = c + dc;
        if (!inB(nr2, nc2)) continue;
        var t2 = b[nr2][nc2];
        if (t2 && t2.c !== p.c) {
          if (nr2 === last) {
            ['q', 'r', 'b', 'n'].forEach(function (pr2) {
              out.push({ from: { r: r, c: c }, to: { r: nr2, c: nc2 }, promo: pr2 });
            });
          } else out.push({ from: { r: r, c: c }, to: { r: nr2, c: nc2 } });
        }
        if (this.ep && this.ep.r === nr2 && this.ep.c === nc2) {
          out.push({ from: { r: r, c: c }, to: { r: nr2, c: nc2 }, ep: true });
        }
      }
    } else if (p.t === 'n') {
      var NN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (i = 0; i < NN.length; i++) {
        rr = r + NN[i][0]; cc = c + NN[i][1];
        if (!inB(rr, cc)) continue;
        var tn = b[rr][cc];
        if (!tn || tn.c !== p.c) out.push({ from: { r: r, c: c }, to: { r: rr, c: cc } });
      }
    } else if (p.t === 'b') slide([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    else if (p.t === 'r') slide([[-1, 0], [1, 0], [0, -1], [0, 1]]);
    else if (p.t === 'q') slide([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]);
    else if (p.t === 'k') {
      for (var dr = -1; dr <= 1; dr++) for (var dc3 = -1; dc3 <= 1; dc3++) {
        if (!dr && !dc3) continue;
        rr = r + dr; cc = c + dc3;
        if (!inB(rr, cc)) continue;
        var tk = b[rr][cc];
        if (!tk || tk.c !== p.c) out.push({ from: { r: r, c: c }, to: { r: rr, c: cc } });
      }
      // roque
      var home = p.c === 'w' ? 7 : 0;
      if (r === home && c === 4 && !this.isInCheck(p.c)) {
        var enemy = opp(p.c);
        var Kside = p.c === 'w' ? this.castling.K : this.castling.k;
        var Qside = p.c === 'w' ? this.castling.Q : this.castling.q;
        if (Kside && !b[home][5] && !b[home][6] &&
            b[home][7] && b[home][7].t === 'r' && b[home][7].c === p.c &&
            !this.isAttacked(home, 5, enemy) && !this.isAttacked(home, 6, enemy)) {
          out.push({ from: { r: r, c: c }, to: { r: home, c: 6 }, castle: 'K' });
        }
        if (Qside && !b[home][3] && !b[home][2] && !b[home][1] &&
            b[home][0] && b[home][0].t === 'r' && b[home][0].c === p.c &&
            !this.isAttacked(home, 3, enemy) && !this.isAttacked(home, 2, enemy)) {
          out.push({ from: { r: r, c: c }, to: { r: home, c: 2 }, castle: 'Q' });
        }
      }
    }
    return out;
  };

  // aplica lance cru no tabuleiro (sem validacao, sem historico) — p/ teste de xeque
  Chess.prototype._applyRaw = function (mv) {
    var b = this.board;
    var piece = b[mv.from.r][mv.from.c];
    var captured = null;
    if (mv.ep) captured = b[mv.from.r][mv.to.c];
    else captured = b[mv.to.r][mv.to.c];
    b[mv.to.r][mv.to.c] = piece;
    b[mv.from.r][mv.from.c] = null;
    if (mv.ep) b[mv.from.r][mv.to.c] = null;
    if (mv.promo) b[mv.to.r][mv.to.c] = { t: mv.promo, c: piece.c };
    if (mv.castle) {
      var home = piece.c === 'w' ? 7 : 0;
      if (mv.castle === 'K') { b[home][5] = b[home][7]; b[home][7] = null; }
      else { b[home][3] = b[home][0]; b[home][0] = null; }
    }
    return captured;
  };

  Chess.prototype.legalMoves = function (r, c) {
    var self = this;
    var p = this.board[r][c];
    if (!p || p.c !== this.turn) return [];
    return this.pseudoMoves(r, c).filter(function (mv) {
      var snap = JSON.stringify({ b: self.board, e: self.ep });
      var cap = self._applyRaw(mv);
      var k = self.kingPos(p.c);
      var illegal = self.isAttacked(k.r, k.c, opp(p.c));
      var s = JSON.parse(snap);
      self.board = s.b; self.ep = s.e;
      void cap;
      return !illegal;
    });
  };

  Chess.prototype.allLegalMoves = function (color) {
    color = color || this.turn;
    var saved = this.turn, out = [], self = this;
    this.turn = color;
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      if (p && p.c === color) {
        self.legalMoves(r, c).forEach(function (m) { out.push(m); });
      }
    }
    this.turn = saved;
    return out;
  };

  function sanDisamb(board, piece, from, to, pseudos) {
    if (piece.t === 'p' || piece.t === 'k') return '';
    var others = [];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      if (r === from.r && c === from.c) continue;
      var q = board[r][c];
      if (q && q.c === piece.c && q.t === piece.t) {
        // essa outra peca alcanca `to` por pseudo?
        var found = false;
        // verificacao barata: so importa se pode mover p/ to ignorando xeque
        // (suficiente p/ desambiguacao na pratica)
        outer: for (var dr = -1; dr <= 1 && !found; dr++) { void dr; break; }
        others.push({ r: r, c: c });
      }
    }
    // filtra: mantem so quem realmente ataca `to`
    others = others.filter(function (o) {
      var qq = board[o.r][o.c];
      var dr = to.r - o.r, dc = to.c - o.c;
      var adr = Math.abs(dr), adc = Math.abs(dc);
      if (qq.t === 'n') return (adr === 1 && adc === 2) || (adr === 2 && adc === 1);
      if (qq.t === 'b') { if (adr !== adc) return false; return clearPath(board, o, to); }
      if (qq.t === 'r') { if (dr !== 0 && dc !== 0) return false; return clearPath(board, o, to); }
      if (qq.t === 'q') { if (!(dr === 0 || dc === 0 || adr === adc)) return false; return clearPath(board, o, to); }
      if (qq.t === 'k') return adr <= 1 && adc <= 1;
      return false;
    });
    if (!others.length) return '';
    var sameFile = others.some(function (o) { return o.c === from.c; });
    var sameRank = others.some(function (o) { return o.r === from.r; });
    if (!sameFile) return 'abcdefgh'.charAt(from.c);
    if (!sameRank) return String(8 - from.r);
    return sqName(from.r, from.c);
  }

  function clearPath(board, from, to) {
    var dr = Math.sign(to.r - from.r), dc = Math.sign(to.c - from.c);
    var r = from.r + dr, c = from.c + dc;
    while (r !== to.r || c !== to.c) {
      if (board[r][c]) return false;
      r += dr; c += dc;
    }
    return true;
  }

  Chess.prototype.makeMove = function (fr, fc, tr, tc, promoChoice) {
    var legal = this.legalMoves(fr, fc);
    var mv = null;
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (m.to.r === tr && m.to.c === tc) {
        if (m.promo) {
          if (!mv) mv = m; // candidato
          if (promoChoice && m.promo === promoChoice) { mv = m; break; }
          if (!promoChoice && m.promo === 'q') { mv = m; /* continua p/ respeitar escolha? usa q default */ }
        } else { mv = m; break; }
      }
    }
    if (!mv) return null;
    if (mv.promo && promoChoice) mv = { from: mv.from, to: mv.to, promo: promoChoice };
    var piece = this.board[fr][fc];
    var isCap = !!this.board[tr][tc] || !!mv.ep;
    var isPawn = piece.t === 'p';
    var dis = sanDisamb(this.board, piece, mv.from, mv.to);

    // snapshot p/ desfazer
    this.history.push({
      board: JSON.parse(JSON.stringify(this.board)),
      turn: this.turn, castling: Object.assign({}, this.castling),
      ep: this.ep ? { r: this.ep.r, c: this.ep.c } : null,
      halfmove: this.halfmove, fullmove: this.fullmove,
      posCounts: Object.assign({}, this.posCounts)
    });

    // atualiza roque
    if (piece.t === 'k') {
      if (piece.c === 'w') { this.castling.K = false; this.castling.Q = false; }
      else { this.castling.k = false; this.castling.q = false; }
    }
    if (piece.t === 'r') {
      if (fr === 7 && fc === 0) this.castling.Q = false;
      if (fr === 7 && fc === 7) this.castling.K = false;
      if (fr === 0 && fc === 0) this.castling.q = false;
      if (fr === 0 && fc === 7) this.castling.k = false;
    }
    var capturedRook = this.board[tr][tc];
    if (capturedRook && capturedRook.t === 'r') {
      if (tr === 7 && tc === 0) this.castling.Q = false;
      if (tr === 7 && tc === 7) this.castling.K = false;
      if (tr === 0 && tc === 0) this.castling.q = false;
      if (tr === 0 && tc === 7) this.castling.k = false;
    }

    this._applyRaw(mv);

    // ep alvo
    this.ep = mv.double ? { r: (mv.from.r + mv.to.r) / 2, c: mv.from.c } : null;
    // meio-lance
    this.halfmove = (isPawn || isCap) ? 0 : this.halfmove + 1;
    var mover = piece.c;
    if (mover === 'b') this.fullmove++;
    this.turn = opp(this.turn);
    this._countPos();

    // SAN
    var san;
    if (mv.castle) san = mv.castle === 'K' ? 'O-O' : 'O-O-O';
    else if (piece.t === 'p') {
      san = isCap ? 'abcdefgh'.charAt(fr) + 'x' + sqName(tr, tc) : sqName(tr, tc);
      if (mv.promo) san += '=' + mv.promo.toUpperCase();
    } else {
      var L = { n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' }[piece.t];
      san = L + dis + (isCap ? 'x' : '') + sqName(tr, tc);
      if (mv.promo) san += '=' + mv.promo.toUpperCase();
    }
    var st = this.status();
    if (st.over && (st.reason === 'checkmate')) san += '#';
    else if (this.isInCheck(this.turn)) san += '+';
    mv.san = san;
    mv.mover = mover;
    this.history[this.history.length - 1].san = san;
    return mv;
  };

  Chess.prototype.undo = function () {
    var h = this.history.pop();
    if (!h) return false;
    this.board = h.board; this.turn = h.turn; this.castling = h.castling;
    this.ep = h.ep; this.halfmove = h.halfmove; this.fullmove = h.fullmove;
    this.posCounts = h.posCounts;
    return true;
  };

  Chess.prototype.insufficientMaterial = function () {
    var pieces = [];
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      if (p && p.t !== 'k') pieces.push({ t: p.t, c: p.c, r: r, col: c });
    }
    if (pieces.length === 0) return true; // K vs K
    if (pieces.length === 1) {
      return pieces[0].t === 'b' || pieces[0].t === 'n'; // K+menor vs K
    }
    if (pieces.length === 2 && pieces[0].t === 'b' && pieces[1].t === 'b' &&
        pieces[0].c !== pieces[1].c) {
      // bispos mesma cor de casa?
      var c1 = (pieces[0].r + pieces[0].col) % 2, c2 = (pieces[1].r + pieces[1].col) % 2;
      if (c1 === c2) return true;
    }
    return false;
  };

  Chess.prototype.status = function () {
    var moves = this.allLegalMoves(this.turn);
    var inChk = this.isInCheck(this.turn);
    if (!moves.length) {
      if (inChk) return { over: true, reason: 'checkmate', winner: opp(this.turn) };
      return { over: true, reason: 'stalemate', winner: null };
    }
    if (this.halfmove >= 100) return { over: true, reason: 'fifty', winner: null };
    if (this.insufficientMaterial()) return { over: true, reason: 'material', winner: null };
    var k = this._key();
    if ((this.posCounts[k] || 0) >= 3) return { over: true, reason: 'threefold', winner: null };
    return { over: false, reason: inChk ? 'check' : 'ok', winner: null, inCheck: inChk };
  };

  Chess.prototype.captured = function () {
    var start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    var now = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var p = this.board[r][c];
      if (p && p.t !== 'k') now[p.c][p.t]++;
    }
    var out = { byWhite: [], byBlack: [] }; // pecas pretas capturadas por brancas, etc
    ['q', 'r', 'b', 'n', 'p'].forEach(function (t) {
      for (var i = 0; i < start[t] - now.b[t]; i++) out.byWhite.push(t);
      for (var j = 0; j < start[t] - now.w[t]; j++) out.byBlack.push(t);
    });
    return out;
  };

  Chess.prototype.movesSAN = function () {
    return this.history.map(function (h) { return h.san; }).filter(Boolean);
  };

  // API p/ testes via string "e2e4"
  Chess.prototype.moveUCI = function (uci, promo) {
    if (uci === 'O-O' || uci === 'O-O-O') {
      var home = this.turn === 'w' ? 7 : 0;
      return this.makeMove(home, 4, home, uci === 'O-O' ? 6 : 2);
    }
    var a = parseSq(uci.slice(0, 2)), b2 = parseSq(uci.slice(2, 4));
    var pr = uci.length > 4 ? uci.charAt(4) : (promo || undefined);
    return this.makeMove(a.r, a.c, b2.r, b2.c, pr);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
  global.Chess = global.Chess || Chess;
})(typeof window !== 'undefined' ? window : globalThis);
