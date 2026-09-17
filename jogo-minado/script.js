const boardEl = document.getElementById("board");
const minesEl = document.getElementById("mines");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const btnMode = document.getElementById("btn-mode");
const btnNew = document.getElementById("btn-new");

const N = 9, MINES = 10;

let grid, revealed, flags, gameOver, won, minesLeft, timer, seconds, flagMode, firstClick;

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
  statusEl.textContent = "😊";
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
  statusEl.textContent = "😵";
  // mostra as minas
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c] === -1) revealed[r][c] = true;
  render(true);
  setTimeout(() => {
    overlayTitle.textContent = "💥 BOOM! — TOQUE PARA REINICIAR";
    overlay.classList.remove("hidden");
  }, 600);
}

function checkWin() {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r][c] !== -1 && !revealed[r][c]) return;
  won = true;
  clearInterval(timer);
  statusEl.textContent = "😎";
  minesEl.textContent = "0";
  overlayTitle.textContent = "🏆 VITÓRIA em " + seconds + "s — TOQUE PARA JOGAR DE NOVO";
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
          b.textContent = "💣";
          if (dead) b.classList.add("boom");
        } else if (grid[r][c] > 0) {
          b.textContent = grid[r][c];
          b.classList.add("n" + grid[r][c]);
        }
      } else if (flags[r][c]) {
        b.textContent = "🚩";
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

btnMode.addEventListener("click", () => {
  flagMode = !flagMode;
  btnMode.textContent = flagMode ? "🚩 BANDEIRA" : "⛏ CAVAR";
  btnMode.classList.toggle("active", flagMode);
});
btnNew.addEventListener("click", reset);
overlay.addEventListener("click", reset);

document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === "Escape") { window.location.href = "../index.html"; return; }
  if (k === "r" || k === "R") reset();
  if (k === "f" || k === "F") btnMode.click();
});

let flagMode = false;
reset();
