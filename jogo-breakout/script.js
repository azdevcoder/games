const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const zone = document.getElementById("touch-zone");

const W = canvas.width, H = canvas.height;
const PADDLE_W = 70, PADDLE_H = 10, PADDLE_Y = H - 30;
const BALL_R = 6;
const COLS = 8, ROWS = 5, BRICK_H = 20, BRICK_GAP = 4, BRICK_TOP = 50;
const BRICK_W = (W - BRICK_GAP * (COLS + 1)) / COLS;
const COLORS = ["#ff3355", "#ff9933", "#ffee33", "#33ff66", "#33ccff"];

let paddleX, ball, bricks, score, lives, level;
let started = false, paused = false, stuck = true, raf = null;
let lastTouch = 0;

function reset(all = true) {
  if (all) { score = 0; lives = 3; level = 1; }
  paddleX = (W - PADDLE_W) / 2;
  buildBricks();
  stickBall();
  started = true; paused = false;
  overlay.classList.add("hidden");
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  cancelAnimationFrame(raf);
  loop();
}

function buildBricks() {
  bricks = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      bricks.push({ x: BRICK_GAP + c * (BRICK_W + BRICK_GAP), y: BRICK_TOP + r * (BRICK_H + BRICK_GAP), hp: 1, color: COLORS[r % COLORS.length] });
}

function stickBall() {
  stuck = true;
  ball = { x: paddleX + PADDLE_W / 2, y: PADDLE_Y - BALL_R, dx: 0, dy: 0 };
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
  if (stuck) { ball.x = paddleX + PADDLE_W / 2; return; }
  ball.x += ball.dx;
  ball.y += ball.dy;
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.dx *= -1; }
  if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.dx *= -1; }
  if (ball.y < BALL_R) { ball.y = BALL_R; ball.dy *= -1; }
  // paddle
  if (ball.dy > 0 && ball.y + BALL_R >= PADDLE_Y && ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
      ball.x >= paddleX - BALL_R && ball.x <= paddleX + PADDLE_W + BALL_R) {
    const hit = (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
    const sp = Math.hypot(ball.dx, ball.dy);
    ball.dx = hit * sp * 0.8;
    ball.dy = -Math.sqrt(Math.max(sp * sp - ball.dx * ball.dx, 1));
    ball.y = PADDLE_Y - BALL_R;
  }
  // bricks
  for (const b of bricks) {
    if (b.hp <= 0) continue;
    if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + BRICK_W &&
        ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + BRICK_H) {
      b.hp = 0;
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
    stickBall();
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
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 6;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
  }
  ctx.shadowBlur = 0;
  // paddle
  ctx.fillStyle = "#ccffcc";
  ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
  // ball
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
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
  if (keys["ArrowRight"]) paddleX = Math.min(W - PADDLE_W, paddleX + 7);
}, 16);

// arraste (mouse + touch) move o paddle
function moveTo(clientX) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * W;
  paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
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
paddleX = (W - PADDLE_W) / 2;
buildBricks();
stickBall();
draw();
