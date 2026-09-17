const boardEl = document.getElementById("board");
const minesEl = document.getElementById("mines");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const btnMode = document.getElementById("btn-mode");
const btnNew = document.getElementById("btn-new");

const N = 9;
let MINES = 10;

// Ícones SVG próprios (estilo arcade verde do jogo)
const FACE_OK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#062b12" stroke="#33ff66" stroke-width="2"/><circle cx="9" cy="10" r="1.4" fill="#33ff66"/><circle cx="15" cy="10" r="1.4" fill="#33ff66"/><path d="M7.5 14.5c1.2 2 2.8 3 4.5 3s3.3-1 4.5-3" fill="none" stroke="#33ff66" stroke-width="1.8" stroke-linecap="round"/></svg>';
const FACE_DEAD = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#550000" stroke="#ff5555" stroke-width="2"/><path d="M7.6 8.6l2.8 2.8M10.4 8.6l-2.8 2.8M13.6 8.6l2.8 2.8M16.4 8.6l-2.8 2.8" stroke="#ff5555" stroke-width="1.8" stroke-linecap="round"/><path d="M8 17h8" stroke="#ff5555" stroke-width="1.8" stroke-linecap="round"/></svg>';
const FACE_WIN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#062b12" stroke="#ffee33" stroke-width="2"/><rect x="5" y="8.5" width="5.4" height="4.2" rx="1.6" fill="#111" stroke="#ffee33" stroke-width="1.4"/><rect x="13.6" y="8.5" width="5.4" height="4.2" rx="1.6" fill="#111" stroke="#ffee33" stroke-width="1.4"/><path d="M10.4 10.2h3.2" stroke="#ffee33" stroke-width="1.4"/><path d="M7.5 15.5c1.2 1.6 2.8 2.4 4.5 2.4s3.3-.8 4.5-2.4" fill="none" stroke="#ffee33" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_BOMB = '<svg viewBox="0 0 24 24"><path d="M14.5 9.5L18 6" stroke="#9dffb8" stroke-width="2" stroke-linecap="round"/><path d="M20.5 2.5v4M18.5 4.5h4" stroke="#ffee33" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="15" r="6.5" fill="#1a2b1a" stroke="#33ff66" stroke-width="1.8"/><circle cx="7.8" cy="12.8" r="1.5" fill="#9dffb8"/></svg>';
const ICON_FLAG = '<svg viewBox="0 0 24 24"><path d="M6 21V3" stroke="#9dffb8" stroke-width="2" stroke-linecap="round"/><path d="M6 3.5h12l-3.5 4.5L18 12.5H6z" fill="#ff3b30"/></svg>';
const ICON_DIG = '<svg viewBox="0 0 24 24"><g stroke="#33ff66" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L12 12"/><path d="M12.5 3.5l8 8-3.5 3.5-8-8z"/></g></svg>';

let grid, revealed, flags, gameOver, won, minesLeft, timer, seconds, firstClick;

function reset() {
  grid = Array.from({ length: N }, () => Array(N).fill(0));
  revealed = Array.from({ length: N }, () => Array(N).fill(false));
  flags = Array.from({ length: N }, () => Array(N).fill(false));
  gameOver = false; won = false;
  minesLeft = MINES;
  seconds = 0;
  firstClick = true;
  clearInterval(timer);
  timer = null;
  minesEl.textContent = minesLeft;
  timeEl.textContent = "0";
  statusEl.innerHTML = FACE_OK;
  setModeButton();
  overlay.classList.add("hidden");
  render();
}

function plantMines(safeR, safeC) {
  let placed = 0;
  while (placed < MINES) {
    const r = Math.floor(Math.random() * N);
    const c = Math.floor(Math.random() * N);
    if (grid[r][c] === -1) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    grid[r][c] = -1;
    placed++;
  }
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (grid[r][c] === -1) continue;
      grid[r][c] = neighbors(r, c).filter(([nr, nc]) => grid[nr][nc] === -1).length;
    }
}

function neighbors(r, c) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push([nr, nc]);
    }
  return out;
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    seconds++;
    timeEl.textContent = seconds;
  }, 1000);
}

function reveal(r, c) {
  if (gameOver || won || flags[r][c] || revealed[r][c]) return;
  if (firstClick) { plantMines(r, c); firstClick = false; startTimer(); }
  revealed[r][c] = true;
  if (grid[r][c] === -1) return boom();
  if (grid[r][c] === 0) {
    for (const [nr, nc] of neighbors(r, c))
      if (!revealed[nr][nc] && !flags[nr][nc]) reveal(nr, nc);
  }
  checkWin();
  render();
}

function toggleFlag(r, c) {
  if (gameOver || won || revealed[r][c]) return;
  if (firstClick) startTimer();
  flags[r][c] = !flags[r][c];
  minesLeft += flags[r][c] ? -1 : 1;
  minesEl.textContent = minesLeft;
  render();
}

function boom() {
  gameOver = true;
  clearInterval(timer);
  statusEl.innerHTML = FACE_DEAD;
  // mostra as minas
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c] === -1) revealed[r][c] = true;
  render(true);
  setTimeout(() => {
    overlayTitle.textContent = "BOOM! — TOQUE PARA REINICIAR";
    overlay.classList.remove("hidden");
  }, 600);
}

function checkWin() {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c] !== -1 && !revealed[r][c]) return;
  won = true;
  clearInterval(timer);
  statusEl.innerHTML = FACE_WIN;
  minesEl.textContent = "0";
  overlayTitle.textContent = "VITÓRIA em " + seconds + "s — TOQUE PARA JOGAR DE NOVO";
  overlay.classList.remove("hidden");
  render();
}

function render(dead = false) {
  boardEl.innerHTML = "";
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const b = document.createElement("button");
      b.className = "cell";
      b.dataset.r = r;
      b.dataset.c = c;
      if (revealed[r][c]) {
        b.classList.add("open");
        if (grid[r][c] === -1) {
          b.innerHTML = ICON_BOMB;
          if (dead) b.classList.add("boom");
        } else if (grid[r][c] > 0) {
          b.textContent = grid[r][c];
          b.classList.add("n" + grid[r][c]);
        }
      } else if (flags[r][c]) {
        b.innerHTML = ICON_FLAG;
        b.classList.add("flag");
      }
      boardEl.appendChild(b);
    }
}

// clique: modo bandeira ou cavar
boardEl.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const r = +cell.dataset.r, c = +cell.dataset.c;
  if (flagMode) toggleFlag(r, c); else reveal(r, c);
});
// botão direito marca
boardEl.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const cell = e.target.closest(".cell");
  if (!cell) return;
  toggleFlag(+cell.dataset.r, +cell.dataset.c);
});
// segurar 500ms marca (mobile)
let holdTimer = null;
boardEl.addEventListener("touchstart", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  const r = +cell.dataset.r, c = +cell.dataset.c;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    toggleFlag(r, c);
    holdTimer = "fired";
  }, 500);
}, { passive: true });
boardEl.addEventListener("touchend", (e) => {
  if (holdTimer === "fired") {
    e.preventDefault();
    holdTimer = null;
  } else clearTimeout(holdTimer);
});
boardEl.addEventListener("touchmove", () => clearTimeout(holdTimer), { passive: true });

function setModeButton() {
  btnMode.innerHTML = flagMode ? ICON_FLAG + " BANDEIRA" : ICON_DIG + " CAVAR";
}

btnMode.addEventListener("click", () => {
  flagMode = !flagMode;
  setModeButton();
  btnMode.classList.toggle("active", flagMode);
});
btnNew.addEventListener("click", reset);
overlay.addEventListener("click", reset);

// seletor de dificuldade (nº de bombas)
const diffBtns = document.querySelectorAll(".diff");
diffBtns.forEach((b) => b.addEventListener("click", () => {
  MINES = +b.dataset.mines;
  diffBtns.forEach((x) => x.classList.toggle("active", x === b));
  reset();
}));

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "Escape") { window.location.href = "../index.html"; return; }
  if (k === "r" || k === "R") reset();
  if (k === "f" || k === "F") btnMode.click();
});

let flagMode = false;
btnMode.textContent = "⛏ CAVAR";
reset();
