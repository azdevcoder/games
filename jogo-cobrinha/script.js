const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hiscoreEl = document.getElementById("hiscore");
const speedEl = document.getElementById("speed");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const cabinet = document.getElementById("cabinet");

const GRID = 20;
const CELL = canvas.width / GRID;

const SPEEDS = [
  { label: "1x", interval: 150 },
  { label: "2x", interval: 100 },
  { label: "3x", interval: 65 },
];

let snake, dir, nextDir, food, score, hiscore = 0;
let speedIndex = 0;
let timer = null;
let alive = true;
let started = false;
let paused = false;

try {
  hiscore = parseInt(localStorage.getItem("snake-hi") || "0", 10) || 0;
} catch (e) { /* sem storage = ignora */ }
hiscoreEl.textContent = hiscore;

function reset() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  alive = true;
  started = true;
  paused = false;
  scoreEl.textContent = "0";
  overlay.classList.add("hidden");
  placeFood();
  restartLoop();
}

function placeFood() {
  while (true) {
    const p = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) {
      food = p;
      return;
    }
  }
}

function restartLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(step, SPEEDS[speedIndex].interval);
  speedEl.textContent = SPEEDS[speedIndex].label;
}

function atravessarParede(pos) {
  // wrap-around: sai de um lado, entra do outro
  return (pos + GRID) % GRID;
}

function step() {
  if (!alive || paused) return;
  dir = nextDir;

  // atravessa a parede em vez de morrer
  const head = {
    x: atravessarParede(snake[0].x + dir.x),
    y: atravessarParede(snake[0].y + dir.y),
  };

  // colisão só com o próprio corpo (ignora rabo que vai sair)
  // verifica contra corpo sem o último segmento se não vai comer
  const vaiComer = head.x === food.x && head.y === food.y;
  const corpo = vaiComer ? snake : snake.slice(0, -1);
  if (corpo.some((s) => s.x === head.x && s.y === head.y)) {
    return die();
  }

  snake.unshift(head);

  // comeu
  if (vaiComer) {
    score += 10;
    scoreEl.textContent = score;
    if (score > hiscore) {
      hiscore = score;
      hiscoreEl.textContent = hiscore;
      try { localStorage.setItem("snake-hi", String(hiscore)); } catch (e) {}
    }
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function die() {
  alive = false;
  clearInterval(timer);
  overlayTitle.textContent = "GAME OVER · " + score + " PTS — R REINICIA";
  overlay.classList.remove("hidden");
  draw();
}

function draw() {
  // fundo
  ctx.fillStyle = "#001100";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // grade sutil
  ctx.strokeStyle = "rgba(51,255,102,0.08)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke();
  }

  // comida
  ctx.fillStyle = "#ff3355";
  ctx.shadowColor = "#ff3355";
  ctx.shadowBlur = 10;
  ctx.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
  ctx.shadowBlur = 0;

  // cobra
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? "#ccffcc" : "#33ff66";
    ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    if (i === 0) {
      ctx.fillStyle = "#003300";
      // olhos
      ctx.fillRect(s.x * CELL + 5, s.y * CELL + 5, 3, 3);
      ctx.fillRect(s.x * CELL + 12, s.y * CELL + 5, 3, 3);
    }
  });
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (cabinet.requestFullscreen) cabinet.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function cycleSpeed() {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedEl.textContent = SPEEDS[speedIndex].label;
  const btnSpeed = document.getElementById("btn-speed");
  if (btnSpeed) btnSpeed.textContent = SPEEDS[speedIndex].label;
  if (alive && started && !paused) restartLoop();
}

function togglePause() {
  if (!started || !alive) return;
  paused = !paused;
  if (paused) {
    overlayTitle.textContent = "PAUSADO — TOQUE ▶ / ENTER PARA CONTINUAR";
    overlay.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
  }
  const btnPause = document.getElementById("btn-pause");
  if (btnPause) btnPause.textContent = paused ? "▶" : "⏸";
}

function setDir(x, y) {
  // impede ré 180°
  if (x === -dir.x && y === -dir.y && (dir.x !== 0 || dir.y !== 0)) {
    // permite se for a partir do estado inicial? mantém regra simples:
    if (snake.length > 1) return;
  }
  if (paused || !alive) return;
  if (!started) { reset(); }
  if (x === 0 && y === -1 && dir.y !== 1) nextDir = { x, y };
  else if (x === 0 && y === 1 && dir.y !== -1) nextDir = { x, y };
  else if (x === -1 && y === 0 && dir.x !== 1) nextDir = { x, y };
  else if (x === 1 && y === 0 && dir.x !== -1) nextDir = { x, y };
}

document.addEventListener("keydown", (e) => {
  const k = e.key;

  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter"].includes(k)) {
    e.preventDefault();
  }

  // pausa: Enter ou Espaço
  if (k === " " || k === "Enter") {
    if (!started) { reset(); return; }
    togglePause();
    return;
  }

  // se pausado, ignora movimento/V/T, só R destrava
  if (paused && k !== "r" && k !== "R") return;

  // movimento
  if (k === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
  else if (k === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
  else if (k === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
  else if (k === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
  // comandos
  else if (k === "r" || k === "R") reset();
  else if (k === "t" || k === "T") toggleFullscreen();
  else if (k === "v" || k === "V") cycleSpeed();
  else return;

  // se ainda não começou e apertou seta, inicia
  if (!started && k.startsWith("Arrow")) reset();
});

// estado inicial (sem loop até começar)
snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
dir = { x: 1, y: 0 };
nextDir = { x: 1, y: 0 };
food = { x: 14, y: 10 };
score = 0;
draw();

// ---- input touch / mobile ----
// swipe no tabuleiro
(function initSwipe() {
  const zone = document.getElementById("touch-zone") || canvas;
  let sx = 0, sy = 0, tracking = false;
  zone.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX; sy = t.clientY; tracking = true;
  }, { passive: true });
  zone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!tracking) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    sx = t.clientX; sy = t.clientY;
  }, { passive: false });
  zone.addEventListener("touchend", () => { tracking = false; }, { passive: true });
})();

// helper anti double-fire (touchstart + click sintetico)
function onTap(el, fn) {
  let lastTouch = 0;
  el.addEventListener("touchstart", (e) => {
    e.preventDefault();
    lastTouch = Date.now();
    fn(e);
  }, { passive: false });
  el.addEventListener("click", (e) => {
    if (Date.now() - lastTouch < 600) return;
    e.preventDefault();
    fn(e);
  });
}

// d-pad + botões
document.querySelectorAll(".dpad .tbtn").forEach((btn) => {
  const press = () => {
    const d = btn.dataset.dir;
    if (d === "up") setDir(0, -1);
    else if (d === "down") setDir(0, 1);
    else if (d === "left") setDir(-1, 0);
    else if (d === "right") setDir(1, 0);
  };
  onTap(btn, press);
});

(function initTouchButtons() {
  const bp = document.getElementById("btn-pause");
  const br = document.getElementById("btn-restart");
  const bs = document.getElementById("btn-speed");
  if (bp) onTap(bp, () => { if (!started) reset(); else togglePause(); });
  if (br) onTap(br, () => reset());
  if (bs) onTap(bs, () => cycleSpeed());
  // toque no overlay inicia / continua / reinicia
  onTap(overlay, () => {
    if (!started || !alive) reset();
    else if (paused) togglePause();
  });
})();

// evita scroll/zoom por gesto duplo no iOS
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gesturestart", (e) => e.preventDefault());
