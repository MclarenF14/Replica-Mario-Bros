// Constants for NES style
const W = 256, H = 240;
const GRAVITY = 0.36, JUMP_V = -5.8, MOVE_V = 1.1, MAX_FALL = 4;
const COLORS = {
  bg: '#5c94fc',
  plat: '#784c09',
  ground: '#20a048',
  player: '#fe5e38',
  playerHat: '#b30000',
  playerSkin: '#ffde88',
  playerPants: '#345ceb',
  coin: '#ffdb58',
  white: '#fff',
  pause: '#222',
  overlay: '#181818',
  btn: '#fff',
  btnShadow: '#aaa'
};

// Game state
let level = 1;
const MAX_LEVEL = 150;
let platforms = [];
let coins = [];
const player = {
  x: 12, y: 200, w: 14, h: 16,
  vx: 0, vy: 0,
  onGround: false,
  score: 0
};
let keys = {};
let paused = false;

// Level transition state
let levelTransition = false;         // Show transition overlay?
let levelTransitionReady = false;    // Show next button?
let justCompletedLevel = false;      // To avoid accidental spam-click
let finishedGame = false;

// DOM/canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Next button dimensions/pos
const BTN_W = 56, BTN_H = 56;
const BTN_X = (W - BTN_W) / 2, BTN_Y = (H - BTN_H) / 2 + 18;

// --- INPUT: Key/mouse ---
function key(e, d) {
  if (levelTransition || finishedGame) return; // Block controls on overlay
  if (["ArrowLeft", "a"].includes(e.key)) keys.left = d;
  if (["ArrowRight", "d"].includes(e.key)) keys.right = d;
  if ([" ", "z", "k", "ArrowUp"].includes(e.key.toLowerCase())) keys.jump = d;
  if ((e.key === "p" || e.key === "P") && d) paused = !paused;
}
window.addEventListener('keydown', e => key(e, true));
window.addEventListener('keyup', e => key(e, false));

canvas.addEventListener('mousedown', function(e) {
  if (levelTransition && levelTransitionReady && !justCompletedLevel) {
    // Get mouse position relative to canvas pixel grid
    const rect = this.getBoundingClientRect();
    let mx = (e.clientX - rect.left) * (W/rect.width);
    let my = (e.clientY - rect.top) * (H/rect.height);
    if (mx >= BTN_X && mx <= BTN_X+BTN_W && my >= BTN_Y && my <= BTN_Y+BTN_H) {
      advanceLevel();
    }
  }
});

// --- LEVEL GENERATION --- //
function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function genLevel(lvl) {
  let numPlatforms = Math.min(5 + Math.floor(lvl / 5), 11);
  const minGap = Math.max(14 - Math.floor(lvl / 20), 6);
  const maxGap = Math.max(37 - Math.floor(lvl / 3), 12);
  const minPlatW = Math.max(36 - Math.floor(lvl / 12), 16);
  const maxPlatW = Math.max(minPlatW + 10, minPlatW + Math.floor(lvl/4));
  const vertVar = Math.max(24 - lvl, 6);

  platforms = [ { x: 0, y: 216, w: W, h: 24 } ];
  let x = 10, y = 216 - randomBetween(48, 90);
  for (let i = 1; i < numPlatforms; ++i) {
    let w = randomBetween(minPlatW, maxPlatW);
    let gap = randomBetween(minGap, maxGap);
    x += gap + w;
    if (x + w > W - 10) break;
    y = 216 - randomBetween(32, vertVar + 32);
    platforms.push({ x: x, y: y, w: w, h: 10 });
  }
  coins = [];
  for (let plat of platforms.slice(1)) {
    let nCoins = (lvl < 30 ? 1 : randomBetween(1, 2 + Math.floor(lvl/30)));
    for (let i = 0; i < nCoins; ++i) {
      let cx = plat.x + randomBetween(2, Math.max(plat.w-10,4));
      let cy = plat.y - 12;
      coins.push({ x: cx, y: cy, got: false });
    }
  }
  player.x = 12; player.y = 200; player.vx = 0; player.vy = 0; player.onGround = false;
  justCompletedLevel = false;
}

// --- DRAWING ---
function drawRect(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function drawPlayer() {
  const x = player.x, y = player.y;
  drawRect(x+2, y, 10, 3, COLORS.playerHat);
  drawRect(x+2, y+3, 10, 5, COLORS.playerSkin);
  drawRect(x+4, y+8, 6, 8, COLORS.player);
  drawRect(x, y+8, 4, 3, COLORS.playerSkin);
  drawRect(x+10, y+8, 4, 3, COLORS.playerSkin);
  drawRect(x+4, y+14, 2, 2, COLORS.playerPants);
  drawRect(x+8, y+14, 2, 2, COLORS.playerPants);
}
function drawPlatforms() {
  for (const p of platforms)
    drawRect(p.x, p.y, p.w, p.h, p === platforms[0] ? COLORS.ground : COLORS.plat);
}
function drawCoins() {
  for (const c of coins) if (!c.got) drawRect(c.x, c.y, 8, 8, COLORS.coin);
}
function drawScoreAndLevel() {
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = COLORS.white;
  ctx.fillText(`COINS: ${player.score}`, 6, 18);
  ctx.fillText(`LEVEL: ${level}/${MAX_LEVEL}`, W-86, 18);
}
function drawPause() {
  ctx.save();
  ctx.globalAlpha = 0.7;
  drawRect(0, 0, W, H, COLORS.pause);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 24px monospace';
  ctx.fillText('PAUSED', (W/2)-48, H/2-12);
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Press P to resume', (W/2)-64, H/2+16);
  ctx.restore();
}

// Draw the transition overlay (button+message)
function drawLevelTransition() {
  ctx.save();
  ctx.globalAlpha = 0.83;
  drawRect(0, 0, W, H, COLORS.overlay);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 18px monospace';
  if (finishedGame) {
    ctx.fillText('YOU WIN!', (W/2)-40, H/2-18);
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Congratulations on beating all 150 levels!', (W/2)-110, H/2);
    return;
  }
  if (level === 1) {
    ctx.fillText('Level 1', (W/2)-31, H/2-26);
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Get all coins to win the level.', (W/2)-92, H/2-10);
  } else {
    ctx.fillText(`Level ${level}`, (W/2)-38, H/2-26);
    ctx.font = 'bold 13px monospace';
    ctx.fillText('Go for the coins!', (W/2)-57, H/2-10);
  }
  if (levelTransitionReady) drawBigTriangleBtn();
  ctx.restore();
}

// Draws the big triangle button (bottom half of overlay)
function drawBigTriangleBtn() {
  // Shadow
  ctx.save();
  ctx.shadowColor = COLORS.btnShadow;
  ctx.shadowBlur = 7;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  // Button rectangle
  drawRect(BTN_X, BTN_Y, BTN_W, BTN_H, COLORS.btn);
  // Triangle symbol (right-pointing) inside button
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = COLORS.overlay;
  ctx.beginPath();
  // Equilateral triangle centered in the button
  let cx = BTN_X+BTN_W/2, cy=BTN_Y+BTN_H/2;
  let s = 32;
  ctx.moveTo(cx-s/3, cy-s/2.1);
  ctx.lineTo(cx+s/2, cy);
  ctx.lineTo(cx-s/3, cy+s/2.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hint text
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = COLORS.overlay;
  ctx.fillText('Click ▶ to continue', BTN_X-10, BTN_Y+BTN_H+18);
}

// --- COLLISION ---
function collides(a, b) {
  return (a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y);
}

// --- PLAYER MOVE/LOGIC ---
function updatePlayer() {
  player.vx = 0;
  if (keys.left) player.vx = -MOVE_V;
  if (keys.right) player.vx = MOVE_V;
  if (keys.jump && player.onGround) {
    player.vy = JUMP_V - Math.min(0.33 * Math.floor(level/30), 1.4);
  }
  player.vy += GRAVITY + Math.min(0.03*level,0.6);
  if (player.vy > MAX_FALL + level/22) player.vy = MAX_FALL + level/22;
  player.x += player.vx;
  for (let plat of platforms)
    if (collides(player, plat))
      if (player.vx > 0) player.x = plat.x - player.w;
      else if (player.vx < 0) player.x = plat.x + plat.w;
  player.y += player.vy;
  player.onGround = false;
  for (let plat of platforms) {
    if (collides(player, plat)) {
      if (player.vy > 0) {player.y = plat.y-player.h; player.vy = 0; player.onGround = true;}
      else if (player.vy < 0) {player.y = plat.y+plat.h; player.vy =0;}
    }
  }
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;
  if (player.y + player.h > H) {player.y = H - player.h; player.vy = 0; player.onGround = true;}

  // Coin collection
  let gotNew = false;
  for (const c of coins) {
    if (!c.got && collides(player, {...c,w:8,h:8})) {
      c.got = true; player.score++; gotNew = true;
    }
  }

  // When all coins collected, trigger transition overlay
  if (!levelTransition && coins.every(c => c.got)) {
    levelTransition = true;
    levelTransitionReady = false;
    justCompletedLevel = true;
    setTimeout(() => {
      levelTransitionReady = true;
      justCompletedLevel = false;
      // On last level, show finishedGame message
      if (level > MAX_LEVEL) finishedGame = true;
    }, 700);
  }
}

function advanceLevel() {
  if (level < MAX_LEVEL) {
    level++;
    genLevel(level);
    levelTransition = false;
    levelTransitionReady = false;
  } else {
    // End screen
    finishedGame = true;
    levelTransition = true;
    levelTransitionReady = false;
  }
}

// --- GAME LOOP ---
function gameLoop() {
  if (paused) {
    drawPause();
    requestAnimationFrame(gameLoop);
    return;
  }
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  drawPlatforms();
  drawCoins();
  drawPlayer();
  drawScoreAndLevel();

  if (levelTransition || finishedGame) {
    drawLevelTransition();
    requestAnimationFrame(gameLoop);
    return;
  }

  // Only update/move when not on overlay
  updatePlayer();
  requestAnimationFrame(gameLoop);
}

// Handle returning from tab out/unpause
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !paused)
    requestAnimationFrame(gameLoop);
});

// --- STARTUP ---
genLevel(level);
levelTransition = true;
levelTransitionReady = false;
setTimeout(() => { levelTransitionReady = true; }, 900);
gameLoop();
