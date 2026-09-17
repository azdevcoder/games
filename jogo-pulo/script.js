const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const tierEl = document.getElementById("tier");
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
// nível sobe a cada 1000 pts: mais voadores, mais frequência, mais velocidade
let tier = 0, bannerTicks = 0;

try { hiscore = parseInt(localStorage.getItem("pulo-hi") || "0", 10) || 0; } catch (e) {}
hiscoreEl.textContent = hiscore;

function reset() {
  player = { y: GROUND_Y - PLAYER_SIZE, vy: 0, jumps: 0 };
  obstacles = [];
  score = 0;
  speed = 4;
  spawnIn = 60;
  frame = 0;
  tier = 0;
  bannerTicks = 0;
  if (tierEl) tierEl.textContent = "1";
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
  // nível de dificuldade: +1 a cada 1000 pts
  const newTier = Math.floor(score / 1000);
  if (newTier > tier) {
    tier = newTier;
    bannerTicks = 130; // ~2s de aviso
    if (tierEl) tierEl.textContent = tier + 1;
  }
  if (bannerTicks > 0) bannerTicks--;
  // velocidade aumenta com o tempo + bônus por nível
  speed = 4 + Math.min(score / 300, 5) + Math.min(tier * 0.4, 2);
  // spawna obstáculos (mais frequência por nível)
  spawnIn--;
  if (spawnIn <= 0) {
    const h = 20 + Math.random() * 26;
    const w = 14 + Math.random() * 14;
    // chance de voador cresce com o nível
    const flyChance = tier === 0
      ? (score > 250 ? 0.3 : 0)
      : Math.min(0.35 + (tier - 1) * 0.15, 0.7);
    const flying = Math.random() < flyChance;
    obstacles.push({
      x: W + 10,
      y: flying ? GROUND_Y - 46 - Math.random() * 34 : GROUND_Y - h,
      w, h: flying ? 16 : h,
      flying: !!flying,
      // voadores de nível 2+ são mais rápidos
      vx: flying ? Math.min((tier - 1) * 0.5, 2) : 0,
    });
    spawnIn = Math.max(38, 110 - score / 25 - tier * 10) + Math.random() * 50;
  }
  for (const o of obstacles) o.x -= speed + (o.vx || 0);
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
    // asinhas do voador
    if (o.flying) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffd699";
      const flap = Math.sin((frame + o.x) * 0.3) > 0 ? 5 : 2;
      ctx.fillRect(o.x + 2, o.y - flap, 5, flap);
      ctx.fillRect(o.x + o.w - 7, o.y - flap, 5, flap);
    }
  }
  ctx.shadowBlur = 0;
  // aviso de nível novo
  if (bannerTicks > 0 && alive) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, H / 2 - 26, W, 52);
    ctx.fillStyle = "#ff9933";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚠ NÍVEL " + (tier + 1) + " ⚠", W / 2, H / 2 - 2);
    ctx.fillStyle = "#ffd699";
    ctx.font = "bold 13px 'Courier New', monospace";
    ctx.fillText("VOADORES MAIS FREQUENTES!", W / 2, H / 2 + 18);
  }
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
