const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const zone = document.getElementById("touch-zone");

const W = canvas.width, H = canvas.height;
const SHIP_W = 36, SHIP_H = 14, SHIP_Y = H - 34;

let shipX, invaders, bullets, enemyBullets;
let score, lives, level, invDir, invSpeed, lastEnemyShot;
let dropStep = 14, bannerTicks = 0;
let started = false, paused = false, raf = null, lastTime = 0;
let moveLeft = false, moveRight = false, lastTouch = 0;

function reset(all = true) {
  if (all) { score = 0; lives = 3; level = 1; }
  shipX = (W - SHIP_W) / 2;
  bullets = [];
  enemyBullets = [];
  buildWave();
  started = true; paused = false;
  bannerTicks = 0;
  overlay.classList.add("hidden");
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  levelEl.textContent = level;
  cancelAnimationFrame(raf);
  lastTime = performance.now();
  lastEnemyShot = lastTime;
  raf = requestAnimationFrame(loop);
}

function buildWave() {
  invaders = [];
  // +1 fileira a cada 2 fases (máx 6)
  const cols = 7, rows = 4 + Math.min(Math.floor((level - 1) / 2), 2);
  const iw = 30, ih = 20, gapX = 14, gapY = 14;
  const totalW = cols * iw + (cols - 1) * gapX;
  const x0 = (W - totalW) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      invaders.push({ x: x0 + c * (iw + gapX), y: 50 + r * (ih + gapY), w: iw, h: ih, alive: true, row: r % 4 });
  invDir = 1;
  invSpeed = 20 + level * 8;
  dropStep = 14 + Math.min(level, 5) * 2;
}

function fire() {
  if (!started || paused) return;
  if (bullets.length >= 3) return;
  bullets.push({ x: shipX + SHIP_W / 2 - 2, y: SHIP_Y - 10, w: 4, h: 10 });
}

function loop(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  if (!paused) step(dt, t);
  draw();
  raf = requestAnimationFrame(loop);
}

function step(dt, t) {
  if (bannerTicks > 0) bannerTicks--;
  // nave
  const shipSpeed = 220;
  if (moveLeft) shipX = Math.max(0, shipX - shipSpeed * dt);
  if (moveRight) shipX = Math.min(W - SHIP_W, shipX + shipSpeed * dt);
  // tiro
  for (const b of bullets) b.y -= 380 * dt;
  bullets = bullets.filter((b) => b.y + b.h > 0);
  // invasores
  const alive = invaders.filter((i) => i.alive);
  let minX = Infinity, maxX = -Infinity;
  for (const i of alive) { minX = Math.min(minX, i.x); maxX = Math.max(maxX, i.x + i.w); }
  if ((invDir > 0 && maxX + invSpeed * dt > W - 6) || (invDir < 0 && minX - invSpeed * dt < 6)) {
    invDir *= -1;
    for (const i of alive) i.y += dropStep;
  } else {
    for (const i of alive) i.x += invDir * invSpeed * dt;
  }
  // invasor chegou na base
  if (alive.some((i) => i.y + i.h >= SHIP_Y)) return loseLife(true);
  // colisão tiro x invasor
  for (const b of bullets) {
    for (const i of alive) {
      if (b.x < i.x + i.w && b.x + b.w > i.x && b.y < i.y + i.h && b.y + b.h > i.y) {
        i.alive = false;
        b.y = -99;
        score += (4 - i.row) * 10;
        scoreEl.textContent = score;
        break;
      }
    }
  }
  bullets = bullets.filter((b) => b.y > -50);
  if (invaders.every((i) => !i.alive)) {
    level++;
    levelEl.textContent = level;
    buildWave();
    bullets = [];
    enemyBullets = [];
    bannerTicks = 150; // ~2,5s de aviso da fase nova
    return;
  }
  // tiro inimigo (rajada dupla a partir da fase 3, mirado a partir da 2)
  const interval = Math.max(1100 - level * 120, 350);
  if (t - lastEnemyShot > interval && alive.length) {
    lastEnemyShot = t;
    const shots = level >= 3 ? 2 : 1;
    const pool = alive.slice();
    for (let s = 0; s < shots && pool.length; s++) {
      const shooter = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      let vx = 0;
      if (level >= 2) {
        vx = (shipX + SHIP_W / 2 - (shooter.x + shooter.w / 2)) * 0.4;
        vx = Math.max(-130, Math.min(130, vx));
      }
      enemyBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 10, vx });
    }
  }
  for (const b of enemyBullets) {
    b.y += (140 + level * 20) * dt;
    b.x += (b.vx || 0) * dt;
  }
  enemyBullets = enemyBullets.filter((b) => b.y < H && b.x > -10 && b.x < W + 10);
  for (const b of enemyBullets) {
    if (b.x < shipX + SHIP_W && b.x + b.w > shipX && b.y < SHIP_Y + SHIP_H && b.y + b.h > SHIP_Y) {
      enemyBullets = [];
      return loseLife(false);
    }
  }
}

function loseLife(invaded) {
  lives--;
  livesEl.textContent = lives;
  if (lives <= 0) return gameOver(invaded ? "INVASÃO! " : "");
  // reposiciona sem zerar pontos
  shipX = (W - SHIP_W) / 2;
  bullets = [];
  enemyBullets = [];
  if (invaded) buildWave();
}

function gameOver(prefix = "") {
  cancelAnimationFrame(raf);
  started = false;
  overlayTitle.textContent = "GAME OVER · " + prefix + score + " PTS — TOQUE PARA REINICIAR";
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
  // estrelas
  ctx.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137) % W, sy = (i * 89) % H;
    ctx.fillRect(sx, sy, 1, 1);
  }
  // invasores
  for (const i of invaders) {
    if (!i.alive) continue;
    ctx.fillStyle = i.row === 0 ? "#ff3355" : i.row === 1 ? "#ff9933" : i.row === 2 ? "#ffee33" : "#33ccff";
    ctx.fillRect(i.x, i.y, i.w, i.h);
    ctx.fillStyle = "#000";
    ctx.fillRect(i.x + 6, i.y + 5, 5, 5);
    ctx.fillRect(i.x + i.w - 11, i.y + 5, 5, 5);
  }
  // nave
  ctx.fillStyle = "#33ff66";
  ctx.fillRect(shipX, SHIP_Y, SHIP_W, SHIP_H);
  ctx.fillRect(shipX + SHIP_W / 2 - 3, SHIP_Y - 8, 6, 8);
  // tiros
  ctx.fillStyle = "#ffffff";
  for (const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = "#ff3355";
  for (const b of enemyBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
  // aviso de fase nova
  if (bannerTicks > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, H / 2 - 26, W, 52);
    ctx.fillStyle = "#ff3355";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚠ FASE " + level + " ⚠", W / 2, H / 2 - 2);
    ctx.fillStyle = "#9dffb8";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText(
      level >= 3 ? "RAJADA DUPLA + TIRO MIRADO!" :
      level >= 2 ? "CUIDADO: TIRO MIRADO!" :
      "ELES ESTÃO MAIS RÁPIDOS!",
      W / 2, H / 2 + 18
    );
  }
}

// teclado
document.addEventListener("keydown", (e) => {
  const k = e.key;
  if (["ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
  if (k === "Escape") { window.location.href = "../index.html"; return; }
  if (k === "r" || k === "R") { reset(true); return; }
  if (k === "ArrowLeft") moveLeft = true;
  if (k === "ArrowRight") moveRight = true;
  if (k === " ") {
    if (!started) { reset(true); return; }
    if (!paused) fire(); else togglePause();
  }
  if (k === "p" || k === "P") togglePause();
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") moveLeft = false;
  if (e.key === "ArrowRight") moveRight = false;
});

// arraste move a nave; toque atira
zone.addEventListener("touchstart", (e) => {
  const t = e.changedTouches[0];
  moveShipTo(t.clientX);
}, { passive: true });
zone.addEventListener("touchmove", (e) => {
  e.preventDefault();
  moveShipTo(e.changedTouches[0].clientX);
}, { passive: false });
function moveShipTo(clientX) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * W;
  shipX = Math.max(0, Math.min(W - SHIP_W, x - SHIP_W / 2));
}

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
  if (paused) togglePause();
});
// d-pad segurar para mover
document.querySelectorAll(".dpad .tbtn").forEach((btn) => {
  const d = btn.dataset.dir;
  const start = (e) => {
    e.preventDefault();
    if (d === "left") moveLeft = true; else moveRight = true;
  };
  const stop = (e) => {
    e.preventDefault();
    if (d === "left") moveLeft = false; else moveRight = false;
  };
  btn.addEventListener("touchstart", start, { passive: false });
  btn.addEventListener("touchend", stop);
  btn.addEventListener("touchcancel", stop);
  btn.addEventListener("mousedown", start);
  btn.addEventListener("mouseup", stop);
  btn.addEventListener("mouseleave", stop);
});
const bf = document.getElementById("btn-fire");
if (bf) onTap(bf, () => { if (!started) reset(true); else if (!paused) fire(); });

// estado inicial
score = 0; lives = 3; level = 1;
shipX = (W - SHIP_W) / 2;
bullets = []; enemyBullets = [];
buildWave();
draw();
