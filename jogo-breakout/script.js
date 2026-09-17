const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const zone = document.getElementById("touch-zone");

const W = canvas.width, H = canvas.height;
const PADDLE_H = 10, PADDLE_Y = H - 30;
const BALL_R = 6;
const COLS = 8, BRICK_H = 20, BRICK_GAP = 4, BRICK_TOP = 50;
const BRICK_W = (W - BRICK_GAP * (COLS + 1)) / COLS;
const COLORS = ["#ff3355", "#ff9933", "#ffee33", "#33ff66", "#33ccff"];

let paddleX, paddleW, ball, bricks, score, lives, level;
let started = false, paused = false, stuck = true, raf = null;
let bannerTicks = 0;
let lastTouch = 0;

function reset(all = true) {
  if (all) { score = 0; lives = 3; level = 1; }
  buildBricks();
  paddleX = (W - paddleW) / 2;
  stickBall();
  started = true; paused = false;
  bannerTicks = 0;
  overlay.classList.add("hidden");
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  cancelAnimationFrame(raf);
  loop();
}

function buildBricks() {
  // paddle encolhe a cada fase (mín 46)
  paddleW = Math.max(70 - (level - 1) * 6, 46);
  // +1 fileira por fase (máx 7)
  const rows = 5 + Math.min(level - 1, 2);
  bricks = [];
  // blocos duros (2 rebatidas) a partir da fase 2, mais comuns na 4+
  const hardEvery = level >= 4 ? 2 : 3;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < COLS; c++) {
      const hard = level >= 2 && (r * COLS + c) % hardEvery === 0;
      bricks.push({ x: BRICK_GAP + c * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), hp: hard ? 2 : 1, maxHp: hard ? 2 : 1, color: COLORS[r % COLORS.length] });
    }
}

function stickBall() {
  stuck = true;
  ball = { x: paddleX + paddleW / 2, y: PADDLE_Y - BALL_R, dx: 0, dy: 0 };
}

function launch() {
  if (!stuck) return;
  stuck = false;
  const speed = 3 + level * 0.5;
  ball.dx = (Math.random() < 0.5 ? -1 : 1) * speed * 0.6;
  ball.dy = -speed;
}

function loop() {
  if (!paused) step();
  draw();
  raf = requestAnimationFrame(loop);
}

function step() {
  if (bannerTicks > 0) bannerTicks--;
  if (stuck) { ball.x = paddleX + paddleW / 2; return; }
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.dx *= -1; }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.dx *= -1; }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.dy *= -1; }
  // paddle
  if (ball.dy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
      ball.x >= paddleX - BALL_R && ball.x <= paddleX + paddleW + BALL_R) {
    const hit = (ball.x - (paddleX + paddleW / 2)) / (paddleW / 2);
    const sp = Math.hypot(ball.dx, ball.dy);
    ball.dx = hit * sp * 0.8;
    ball.dy = -Math.sqrt(Math.max(sp * sp - ball.dx * ball.dx, 1));
    ball.y = PADDLE_Y - BALL_R;
  }
  // bricks (duros precisam de 2 rebatidas)
  for (const b of bricks) {
    if (b.hp <= 0) continue;
    if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W &&
        ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H) {
      b.hp--;
      score += 10;
      scoreEl.textContent = score;
      // rebate pelo lado de menor penetração
      const ox = Math.min(ball.x + BALL_R - b.x, b.x + BRICK_W - (ball.x - BALL_R));
      const oy = Math.min(ball.y + BALL_R - b.y, b.y + BRICK_H - (ball.y - BALL_R));
      if (ox < oy) ball.dx *= -1; else ball.dy *= -1;
      break;
    }
  }
  if (bricks.every((b) => b.hp <= 0)) {
    level++;
    levelEl.textContent = level;
    buildBricks();
    paddleX = Math.max(0, Math.min(W - paddleW, paddleX));
    stickBall();
    bannerTicks = 150; // ~2,5s de aviso da fase nova
    return;
  }
  if (ball.y - BALL_R > H) {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) return gameOver();
    stickBall();
  }
}

function gameOver() {
  cancelAnimationFrame(raf);
  started = false;
  overlayTitle.textContent = "GAME OVER · " + score + " PTS — TOQUE PARA REINICIAR";
  overlay.classList.remove("hidden");
  draw();
}

function togglePause() {
  if (!started) return;
  paused = !paused;
  if (paused) {
    overlayTitle.textContent = "PAUSADO — TOQUE PARA CONTINUAR";
    overlay.classList.remove("hidden");
  } else overlay.classList.add("hidden");
}

function draw() {
  ctx.fillStyle = "#001100";
  ctx.fillRect(0, 0, W, H);
  for (const b of bricks) {
    if (b.hp <= 0) continue;
    if (b.maxHp > 1 && b.hp === 2) {
      // bloco duro intacto: prateado com miolo da cor
      ctx.fillStyle = "#c0c0c0";
      ctx.shadowColor = "#c0c0c0";
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      ctx.shadowBlur = 0;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x + 4, b.y + 4, BRICK_W - 8, BRICK_H - 8);
    } else {
      ctx.fillStyle = b.hp < b.maxHp ? "#ffffff" : b.color;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
      if (b.hp < b.maxHp) {
        // rachado: risca a cor original
        ctx.shadowBlur = 0;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x + 3, b.y + BRICK_H / 2 - 1, BRICK_W - 6, 2);
      }
    }
  }
  ctx.shadowBlur = 0;
  // paddle
  ctx.fillStyle = "#ccffcc";
  ctx.fillRect(paddleX, PADDLE_Y, paddleW, PADDLE_H);
  // ball
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  // aviso de fase nova
  if (bannerTicks > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, H / 2 - 26, W, 52);
    ctx.fillStyle = "#ffee33";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚠ FASE " + level + " ⚠", W / 2, H / 2 - 2);
    ctx.fillStyle = "#9dffb8";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText(
      level === 2 ? "BLOCOS DUROS: 2 REBATIDAS!" :
      level === 3 ? "PADDLE MENOR + FILEIRA EXTRA!" :
      "MAIS RÁPIDO E MAIS DURO!",
      W / 2, H / 2 + 18
    );
  }
}

// teclado
const keys = {};
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
  if (k === "Escape") { window.location.href = "../index.html"; return; }
  if (k === "r" || k === "R") { reset(true); return; }
  if (k === " ") {
    if (!started) { reset(true); return; }
    if (stuck) launch(); else togglePause();
    return;
  }
  keys[k] = true;
});
document.addEventListener("keyup", (e) => { keys[e.key] = false; });
setInterval(() => {
  if (!started || paused) return;
  if (keys["ArrowLeft"]) paddleX = Math.max(0, paddleX - 7);
  if (keys["ArrowRight"]) paddleX = Math.min(W - paddleW, paddleX + 7);
}, 16);

// arraste (mouse + touch) move o paddle
function moveTo(clientX) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * W;
  paddleX = Math.max(0, Math.min(W - paddleW, x - paddleW / 2));
}
zone.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  moveTo(t.clientX);
}, { passive: true });
zone.addEventListener("touchmove", (e) => {
  e.preventDefault();
  moveTo(e.changedTouches[0].clientX);
}, { passive: false });
zone.addEventListener("mousemove", (e) => { if (e.buttons) moveTo(e.clientX); });

// toque no overlay: inicia / continua / reinicia
function onTap(el, fn) {
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
onTap(overlay, () => {
  if (!started) { reset(true); return; }
  if (paused) { togglePause(); return; }
  if (stuck) launch();
});
// toque simples no tabuleiro lança a bola
zone.addEventListener("touchend", (e) => {
  if (started && !paused && stuck && e.changedTouches.length) launch();
});

// estado inicial
score = 0; lives = 3; level = 1;
buildBricks();
paddleX = (W - paddleW) / 2;
stickBall();
draw();
