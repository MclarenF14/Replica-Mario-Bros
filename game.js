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
  score: 0,
  doubleJumpAvailable: false,  // Allow double jump in air
  jumpKeyLastDown: 0,         // For double-press up arrow
  jumpKeyDoublePressed: false
};
let keys = {};
let paused = false;

// Level transition state
let levelTransition = false;
let levelTransitionReady = false;
let justCompletedLevel = false;
let finishedGame = false;

// DOM/canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Next button dimensions/pos
const BTN_W = 56, BTN_H = 56;
const BTN_X = (W - BTN_W) / 2, BTN_Y = (H - BTN_H) / 2 + 18;

// Input helpers for double jump timing
let lastArrowUpTime = 0;
let jumpTimeout = 240; // ms to register double tap

// --- INPUT: Key/mouse ---
function key(e, d) {
  // Block controls on overlay
  if (levelTransition || finishedGame) return;
  if (["ArrowLeft", "a"].includes(e.key)) keys.left = d;
  if (["ArrowRight", "d"].includes(e.key)) keys.right = d;

  // Space/Z/K also jump (single jump)
  if ([" ", "z", "k"].includes(e.key.toLowerCase()) && d) {
    tryJump('other');
  }

  // Up arrow (jump and double jump on double-press)
  if (e.key === "ArrowUp") {
    if (d) {
      const now = performance.now();
      if (now - lastArrowUpTime < jumpTimeout) {
        // Double-tap Up: enable double jump
        player.jumpKeyDoublePressed = true;
        tryJump('double'); // Try to trigger double-jump
        lastArrowUpTime = 0;
      } else {
        // Single Up
        player.jumpKeyDoublePressed = false;
        tryJump('up');
        lastArrowUpTime = now;
      }
      keys.jump = true;
    } else {
      keys.jump = false;
    }
  }

  // Toggle pause with P
  if ((e.key === "p" || e.key === "P") && d) paused = !paused;
}

window.addEventListener('keydown', e => key(e, true));
window.addEventListener('keyup', e => key(e, false));

canvas.addEventListener('mousedown', function(e) {
  if (levelTransition && levelTransitionReady && !justCompletedLevel) {
    const rect = this.getBoundingClientRect();
    let mx = (e.clientX - rect.left) * (W/rect.width);
    let my = (e.clientY - rect.top) * (H/rect.height);
    if (mx >= BTN_X && mx <= BTN_X+BTN_W && my >= BTN_Y && my <= BTN_Y+BTN_H) {
      advanceLevel();
    }
  }
});

// LEVEL GENERATION AND DRAW FUNCTIONS: (UNCHANGED, omitted for brevity in this snippet)
// ...[all drawRect, drawPlayer, drawPlatforms, drawCoins, drawScoreAndLevel, drawPause, drawLevelTransition, drawBigTriangleBtn, collides, etc. go here unchanged]...

// (Paste all previous supporting code here as in previous version for genLevel, drawing, and so on.)

// --- PLAYER JUMP AND DOUBLE JUMP LOGIC ---
function tryJump(origin) {
  // Jump from ground (any jump key)
  if (player.onGround) {
    player.vy = JUMP_V - Math.min(0.33 * Math.floor(level/30), 1.4);
    player.onGround = false;
    player.doubleJumpAvailable = true;
    return true;
  }
  // Double jump if in air and allowed (only for Up Arrow double-tap)
  // Only if not already double-jumped and using ArrowUp
  if (
    (origin === 'double' || (origin === 'up' && player.jumpKeyDoublePressed)) &&
    player.doubleJumpAvailable
  ) {
    player.vy = JUMP_V - Math.min(0.33 * Math.floor(level/30), 1.4);
    player.doubleJumpAvailable = false;
    return true;
  }
  return false;
}

function updatePlayer() {
  player.vx = 0;
  if (keys.left) player.vx = -MOVE_V;
  if (keys.right) player.vx = MOVE_V;

  // Gravity and movement
  player.vy += GRAVITY + Math.min(0.03*level,0.6);
  if (player.vy > MAX_FALL + level/22) player.vy = MAX_FALL + level/22;

  // Horizontal movement/collision
  player.x += player.vx;
  for (let plat of platforms)
    if (collides(player, plat))
      if (player.vx > 0) player.x = plat.x - player.w;
      else if (player.vx < 0) player.x = plat.x + plat.w;

  // Vertical movement/collision
  player.y += player.vy;
  let grounded = false;
  for (let plat of platforms) {
    if (collides(player, plat)) {
      if (player.vy > 0) {
        player.y = plat.y-player.h;
        player.vy = 0;
        grounded = true;
        player.doubleJumpAvailable = true;  // Reset double jump on landing
      } else if (player.vy < 0) {
        player.y = plat.y+plat.h; player.vy =0;
      }
    }
  }
  player.onGround = grounded;

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;
  if (player.y + player.h > H) {player.y = H - player.h; player.vy = 0; player.onGround = true;}

  // Coin collection
  for (const c of coins)
    if (!c.got && collides(player, {...c,w:8,h:8}))
      {c.got = true; player.score++;}

  // All coins?
  if (!levelTransition && coins.every(c => c.got)) {
    levelTransition = true;
    levelTransitionReady = false;
    justCompletedLevel = true;
    setTimeout(() => {
      levelTransitionReady = true;
      justCompletedLevel = false;
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
    finishedGame = true;
    levelTransition = true;
    levelTransitionReady = false;
  }
}

// Include full drawing functions and utility functions from previous code

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

  updatePlayer();
  requestAnimationFrame(gameLoop);
}

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
