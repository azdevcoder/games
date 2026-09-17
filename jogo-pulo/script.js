const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const hiscoreEl = document.getElementById("hiscore");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const zone = document.getElementById("touch-zone");

const W = canvas.width, H = canvas.height;
const GROUND_Y = H - 40;
const PLAYER_X = 60, PLAYER_SIZE = 24;
const GRAV = 0.7, JUMP_V = -12;

let player, obstacles, score, hiscore = 0, speed, spawnIn;
let started = false, alive = true, raf = null, lastTouch = 0, frame = 0;

try { hiscore = parseInt(localStorage.getItem("pulo-hi") || "0", 10) || 0; } catch (e) {}
hiscoreEl.textContent = hiscore;

function reset() {
  player = { y: GROUND_Y - PLAYER_SIZE, vy: 0, jumps: 0 };
  obstacles = [];
  score = 0;
  speed = 4;
  spawnIn = 60;
  frame = 0;
  started = true;
  alive = true;
  overlay.classList.add("hidden");
  scoreEl.textContent = "0";
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function jump() {
  if (!started || !alive) { reset(); return; }
  if (player.jumps < 2) {
    player.vy = JUMP_V;
    player.jumps++;
  }
}

function loop() {
  step();
  draw();
  if (alive) raf = requestAnimationFrame(loop);
}

function step() {
  frame++;
  // física do jogador
  player.vy += GRAV;
  player.y += player.vy;
  if (player.y >= GROUND_Y - PLAYER_SIZE) {
    player.y = GROUND_Y - PLAYER_SIZE;
    player.vy = 0;
    player.jumps = 0;
  }
  // velocidade aumenta com o tempo
  speed = 4 + Math.min(score / 300, 5);
  // spawna obstáculos
  spawnIn--;
  if (spawnIn <= 0) {
    const h = 20 + Math.random() * 26;
    const w = 14 + Math.random() * 14;
    const flying = score > 250 && Math.random() < 0.3;
    obstacles.push({
      x: W + 10,
      y: flying ? GROUND_Y - 50 - Math.random() * 30 : GROUND_Y - h,
      w, h: flying ? 16 : h,
      flying: !!flying,
    });
    spawnIn = Math.max(45, 110 - score / 25) + Math.random() * 50;
  }
  for (const o of obstacles) o.x -= speed;
  obstacles = obstacles.filter((o) => o.x + o.w > -10);
  // colisão
  const px = PLAYER_X, py = player.y, ps = PLAYER_SIZE;
  for (const o of obstacles) {
    if (px + ps - 4 > o.x && px + 4 < o.x + o.w && py + ps - 2 > o.y && py + 2 < o.y + o.h) {
      return die();
    }
  }
  score += speed * 0.12;
  scoreEl.textContent = Math.floor(score);
}

function die() {
  alive = false;
  cancelAnimationFrame(raf);
  const s = Math.floor(score);
  if (s > hiscore) {
    hiscore = s;
    hiscoreEl.textContent = hiscore;
    try { localStorage.setItem("pulo-hi", String(hiscore)); } catch (e) {}
  }
  overlayTitle.textContent = "BATEU! " + s + " PTS — TOQUE PARA REINICIAR";
  overlay.classList.remove("hidden");
  draw();
}

function draw() {
  ctx.fillStyle = "#001100";
  ctx.fillRect(0, 0, W, H);
  // estrelas / nuvens
  ctx.fillStyle = "rgba(255,255,255,.4)";
  for (let i = 0; i < 20; i++) {
    const sx = (i * 173 + frame * 0) % W, sy = (i * 61) % (GROUND_Y - 60);
    ctx.fillRect(sx, sy, 1, 1);
  }
  // chão
  ctx.fillStyle = "#33ff66";
  ctx.fillRect(0, GROUND_Y, W, 3);
  const off = started ? (frame * speed) % 20 : 0;
  ctx.fillStyle = "rgba(51,255,102,.5)";
  for (let x = -off; x < W; x += 20) ctx.fillRect(x, GROUND_Y + 8, 10, 2);
  // jogador (quadradinho com olho)
  const py = player ? player.y : GROUND_Y - PLAYER_SIZE;
  ctx.fillStyle = "#ccffcc";
  ctx.fillRect(PLAYER_X, py, PLAYER_SIZE, PLAYER_SIZE);
  ctx.fillStyle = "#003300";
  ctx.fillRect(PLAYER_X + 14, py + 6, 4, 4);
  // obstáculos
  for (const o of obstacles) {
    ctx.fillStyle = o.flying ? "#ff9933" : "#ff3355";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }
  ctx.shadowBlur = 0;
}

// teclado
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (k === " " || k === "ArrowUp") e.preventDefault();
  if (k === "Escape") { window.location.href = "../index.html"; return; }
  if (k === "r" || k === "R") { reset(); return; }
  if (k === " " || k === "ArrowUp") jump();
});

// touch: qualquer toque pula
zone.addEventListener("touchstart", (e) => {
  e.preventDefault();
  lastTouch = Date.now();
  jump();
}, { passive: false });
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
onTap(overlay, () => { if (!started || !alive) reset(); else jump(); });

// estado inicial
player = { y: GROUND_Y - PLAYER_SIZE, vy: 0, jumps: 0 };
obstacles = [];
score = 0; speed = 4;
draw();
