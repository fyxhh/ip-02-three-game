const THREE = window.__THREE;   // three.js 已内联在上方 <script> 中

/* ==================================================================
 *  小熊快跑 · 四季滚动天空 3D
 *
 *  模块目录：
 *   模块 1  全局参数配置（速度 / 概率 / 四季配色 / 音乐参数）
 *   模块 2  渲染器、场景、相机、灯光
 *   模块 3  四季系统（缓慢平滑过渡）
 *   模块 4  地面网格 / 云朵 / 季节粒子 / 路边景物
 *   模块 5  地砖（含冬季冰面）
 *   模块 6  障碍（果冻方块 / 夏季水塘）
 *   模块 7  金币
 *   模块 8  玩家：小熊模型（GLB + 备用拼装小熊）
 *   模块 9  状态机 / HUD / 弹窗 / 闪电加速
 *   模块 10 输入控制
 *   模块 11 世界生成
 *   模块 12 碰撞检测
 *   模块 13 主循环
 *   模块 14 声音（四季 BGM + 音效）
 *   模块 15 自适应与启动
 * ================================================================== */


/* ==================================================================
 * 【模块 1】全局参数配置区
 * 所有高频调整项都集中在这里，改这里即可。
 * ================================================================== */
const CFG = {

  /* ---------- 赛道与地面 ---------- */
  LANE_COUNT:      5,
  LANE_WIDTH:      1.5,
  TRACK_HALF:      3.75,
  VIEW_DISTANCE:   92,
  RECYCLE_Z:       14,
  GROUND_Y:       -7.0,

  TILE_SIZE:       1.5,
  TILE_HEIGHT:     0.36,
  HOLE_GAP_CHANCE: 0.15,
  HOLE_COOLDOWN:   6,
  HOLE_MIN_ROW:    28,
  HOLE_MAX_ROWS:   2,
  TILE_RISE_TIME:  0.32,

  /* ---------- 玩家小熊 ---------- */
  PLAYER_RADIUS:   0.46,      // 碰撞半径（比视觉略小，判定更宽容）
  PLAYER_START_Y:  9,
  GRAVITY:         52,
  KEY_SPEED:       10.5,
  FOLLOW:          11,
  DASH_SPEED:      26,
  HIT_SCALE:       0.80,
  MODEL_URL:       './bear.glb',
  BEAR_HEIGHT:     0.85,      // 小熊身高：只占大半条车道，看起来更精致

  /* ---------- 跳跃 ---------- */
  MAX_JUMPS:       2,
  JUMP_VELOCITY:   13.0,
  JUMP_HOLD_MAX:   0.14,
  GRAVITY_JUMP:    56,
  COYOTE_TIME:     0.10,

  /* ---------- 速度与难度 ---------- */
  BASE_SPEED:      9.4,
  MAX_SPEED:       21,
  MAX_SPEED_ABS:   25,
  SPEED_GROWTH:    0.26,
  HURT_SLOWDOWN:   0.55,
  SAFE_AFTER_PROTECT: 14,

  /* ---------- 障碍 ---------- */
  OBSTACLE_CHANCE: 0.19,
  OBSTACLE_MAX:    2,
  OBSTACLE_GAP:    3,
  OBSTACLE_MIN_ROW: 22,
  OBSTACLE_W:      0.30,      // 糖果大小：只有车道 1/5 宽，完全不挡视线
  OBSTACLE_H:      0.55,      // 比小熊矮，跑起来看得清前方
  OBSTACLE_D:      0.38,      // 纵深也收窄，跳跃更容易越过
  OBSTACLE_FORGIVE: 0.12,
  POND_CHANCE:     0.40,      // 【夏】水塘障碍所占比例
  POND_H:          0.42,      // 水塘很矮，轻轻一跳就过去
  CLUSTER_MAX:     3,         // 一排障碍的数量上限（2~3 个连成一整块）
  OBSTACLE_OFFSET: 0.60,      // 障碍偏离车道中心的距离（贴边摆放，中间留出通过的缝）

  /* ---------- 金币 ---------- */
  COIN_CHANCE:     0.22,
  COIN_CHAIN_RATE: 0.45,
  COIN_RADIUS:     0.42,
  COIN_THICK:      0.14,
  COIN_START_Y:    16,
  COIN_FALL_SPEED: 12,
  COIN_REST_Y:     1.05,
  COIN_SPIN:       4.0,

  /* ---------- 闪电加速 ---------- */
  BOLT_PER_SCORE:  10,        // 每 10 分获得 1 次加速
  BOLT_MAX:        3,         // 最多存 3 次
  BOOST_TIME:      5.0,       // 加速持续 5 秒
  BOOST_SPEED_MUL: 1.5,       // 加速倍率
  BOOST_FOV:       68,        // 加速时相机视野（正常 56）

  /* ---------- 四季（缓慢变化：以「金币」为主要节奏） ---------- */
  SEASON_COINS:       30,     // 每收集这么多枚金币，推进到下一个季节（约 40 秒一季）
  SEASON_FADE_COINS: 10,      // 末尾这么多枚金币的区间内完成渐变
  SEASON_MAX_RATE:   0.050,   // 渐变速度上限：每秒最多推进 5%（保证至少 20 秒的平滑过渡）
  SEASON_TIME_HOLD:  40,      // 兜底：一直吃不到币时，40 秒后也开始换季
  SEASON_TIME_FADE:  15,      // 兜底换季的过渡时长
  ICE_CHANCE:      0.18,      // 【冬】冰面地砖概率
  ICE_SLIP:        0.85,      // 冰面打滑强度（0 = 不打滑）
  PARTICLE_COUNT:  240,       // 季节飘落物数量

  /* ---------- 声音 ---------- */
  SFX_VOLUME:      0.34,      // 音效音量（要高于 BGM，保证反馈听得见）
  MUSIC_VOLUME:    0.13,      // BGM 音量（低于音效）
  SFX_ON:          true,
  MUSIC_ON:        true,
  FOOT_STEP:       0.27,      // 脚步声间隔（秒）

  /* ---------- 生命与节奏 ---------- */
  START_LIVES:     3,
  INVINCIBLE_TIME: 1.6,
  SPAWN_PROTECT:   3.0,
  LAND_NO_SNAP_TIME: 0.6,
  START_SAFE_DIST: 34,
  PROTECT_VISUAL_LEAD: 0.6
};

/* ==================================================================
 * 四季配置：每一季的天空 / 雾 / 地砖色调 / 灯光 / 障碍配色 / 飘落物 / 音乐
 * 关键：相邻两季之间会做 12 秒的插值，所以这里是「慢慢变」而不是瞬间切换。
 * ================================================================== */
const SEASONS = [
  {
    key: 'spring', name: '春', icon: '🌸',
    skyTop: '#bfe9d2', skyMid: '#e3fbe6', skyBottom: '#f7fff4',
    fog: 0xdfeee0, grid: 0xcfeacf, dot: 0x9ed3a4, void: 0xe8f8ea,
    tileTint: 0xdff7cf, tileTintAmt: 0.28,
    sun: { color: 0xfff4dc, intensity: 2.0 },
    hemi: { sky: 0xdff7e2, ground: 0xbfe6c2, intensity: 1.50 },
    amb: { color: 0xfff6e6, intensity: 0.34 },
    obstacle: { body: '#ff9ec4', cap: '#ffe0ee', glow: 0xff6fae },
    foliage: { color: 0xa9e39a, scale: 1.00 },
    accent: { color: 0xffb7d5, scale: 1.00 },     // 春：花朵点缀
    trunk: 0x9c7b52,
    particle: { color: 0xffc2d8, fall: 1.6, sway: 1.3, size: 0.20 },
    ice: 0, pond: 0,
    music: { bpm: 112, root: 62, lead: 'triangle', leadGain: 0.10, drum: 0.075, pad: 0.10, flute: 1.0, saw: 0.0 }
  },
  {
    key: 'summer', name: '夏', icon: '🌿',
    skyTop: '#8fd9f2', skyMid: '#d4f5ff', skyBottom: '#eaffff',
    fog: 0xc6e9f5, grid: 0xb7e3c2, dot: 0x4fa563, void: 0xdff6ff,
    tileTint: 0xcfeeb2, tileTintAmt: 0.30,
    sun: { color: 0xfffbe8, intensity: 2.65 },     // 强光 → 斑驳树影
    hemi: { sky: 0xd8f6ff, ground: 0x9fd7a0, intensity: 1.62 },
    amb: { color: 0xfffce8, intensity: 0.40 },
    obstacle: { body: '#4fc98a', cap: '#d9ffe6', glow: 0x2fae63 },
    foliage: { color: 0x2f9e46, scale: 1.30 },     // 夏：浓密树冠
    accent: { color: 0xffe066, scale: 0.55 },      // 夏：阳光斑点
    trunk: 0x7d5f3c,
    particle: { color: 0xfff0b0, fall: 1.0, sway: 0.6, size: 0.15 },  // 浮尘/花粉
    ice: 0, pond: 1,                                // 夏：水塘障碍
    music: { bpm: 132, root: 67, lead: 'sawtooth', leadGain: 0.085, drum: 0.115, pad: 0.07, flute: 0.25, saw: 0.7 }
  },
  {
    key: 'autumn', name: '秋', icon: '🍁',
    skyTop: '#ffd9a8', skyMid: '#ffe9c4', skyBottom: '#fff6e0',
    fog: 0xf5dcb8, grid: 0xe8c48f, dot: 0xc07a34, void: 0xfbe9cb,
    tileTint: 0xffcf8a, tileTintAmt: 0.34,
    sun: { color: 0xffe0b0, intensity: 2.05 },
    hemi: { sky: 0xffe6c4, ground: 0xd9a15c, intensity: 1.42 },
    amb: { color: 0xffe8cc, intensity: 0.38 },
    obstacle: { body: '#f08a3c', cap: '#ffd9a0', glow: 0xd96a1e },
    foliage: { color: 0xe8843a, scale: 1.05 },     // 秋：橙红树冠
    accent: { color: 0xc9552f, scale: 1.10 },      // 秋：落叶堆
    trunk: 0x8a5a34,
    particle: { color: 0xef8f3c, fall: 2.1, sway: 1.6, size: 0.23 },  // 枫叶
    ice: 0, pond: 0,
    music: { bpm: 104, root: 60, lead: 'triangle', leadGain: 0.095, drum: 0.055, pad: 0.14, flute: 0.45, saw: 0.15 }
  },
  {
    key: 'winter', name: '冬', icon: '❄️',
    skyTop: '#cfe4ef', skyMid: '#eaf5fb', skyBottom: '#f8fdff',
    fog: 0xe4f0f7, grid: 0xdceaf2, dot: 0xa9c6d6, void: 0xf2f9fd,
    tileTint: 0xeaf7ff, tileTintAmt: 0.42,
    sun: { color: 0xf2f8ff, intensity: 1.75 },
    hemi: { sky: 0xeaf6ff, ground: 0xcfe2ec, intensity: 1.38 },
    amb: { color: 0xf0f8ff, intensity: 0.46 },
    obstacle: { body: '#9fd3ea', cap: '#f2fbff', glow: 0x6fb6d8 },
    foliage: { color: 0xdff0f7, scale: 0.72 },     // 冬：覆雪枯枝
    accent: { color: 0xffffff, scale: 1.25 },      // 冬：雪帽
    trunk: 0x8c7b6a,
    particle: { color: 0xffffff, fall: 1.2, sway: 0.9, size: 0.17 },  // 雪花
    ice: 1, pond: 0,                                // 冬：结冰路面
    music: { bpm: 96, root: 55, lead: 'sine', leadGain: 0.09, drum: 0.042, pad: 0.16, flute: 0.2, saw: 0.0 }
  }
];

/* 由配置派生的常量 */
const LANE_X = [];
for (let i = 0; i < CFG.LANE_COUNT; i++) LANE_X.push(-CFG.TRACK_HALF + CFG.LANE_WIDTH * (i + 0.5));
const ALL_LANES = LANE_X.map((_, i) => i);
const P_MIN_X = -CFG.TRACK_HALF + CFG.PLAYER_RADIUS;
const P_MAX_X =  CFG.TRACK_HALF - CFG.PLAYER_RADIUS;
const TILE_Y = -CFG.TILE_HEIGHT / 2;


/* ==================================================================
 * 【模块 2】渲染器 / 场景 / 相机 / 灯光
 * ================================================================== */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfeee0, 46, 108);

const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.1, 8.2);
camera.lookAt(0, 0.9, -6);
const CAM_FOV_BASE = 56;

/* --- 天空：一张 4×256 的竖向渐变画布，可随季节实时重绘 --- */
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4; skyCanvas.height = 256;
const skyCtx = skyCanvas.getContext('2d');
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;

const _cssColor = new THREE.Color();
function css(c) { return '#' + _cssColor.copy(c).getHexString(); }

function drawSky(top, mid, bottom) {
  const g = skyCtx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, css(top));
  g.addColorStop(0.62, css(mid));
  g.addColorStop(1, css(bottom));
  skyCtx.fillStyle = g;
  skyCtx.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
}

const hemiLight = new THREE.HemisphereLight(0xdff7e2, 0xbfe6c2, 1.5);
const ambLight  = new THREE.AmbientLight(0xfff6e6, 0.34);
const sunLight  = new THREE.DirectionalLight(0xfff4dc, 2.0);
sunLight.position.set(7, 18, 9);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.left = -14;
sunLight.shadow.camera.right = 14;
sunLight.shadow.camera.top = 16;
sunLight.shadow.camera.bottom = -16;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 70;
sunLight.shadow.bias = -0.0012;
sunLight.shadow.normalBias = 0.02;
sunLight.target.position.set(0, 0, -6);
scene.add(hemiLight, ambLight, sunLight, sunLight.target);


/* ==================================================================
 * 【模块 3】四季系统
 *  - 节奏：每满 100 枚金币推进一个季节（兜底：长时间不吃币也会换季）
 *  - 过渡：渐变速度被限制在每秒 2%，所以无论吃币多快都是「慢慢变」
 *  - 所有颜色 / 灯光 / 飘落物 / 音乐参数都参与插值，是「渐变」不是「切换」
 * ================================================================== */
const seasonState = { index: 0, k: 0, t: 0 };

/* 缓存的插值结果（避免每帧新建对象） */
const VIEW = {
  skyTop: new THREE.Color(), skyMid: new THREE.Color(), skyBottom: new THREE.Color(),
  fog: new THREE.Color(), grid: new THREE.Color(), dot: new THREE.Color(), voidC: new THREE.Color(),
  tileTint: new THREE.Color(), tileTintAmt: 0,
  sunColor: new THREE.Color(), sunInt: 2,
  hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiInt: 1.5,
  ambColor: new THREE.Color(), ambInt: 0.34,
  obBody: new THREE.Color(), obCap: new THREE.Color(), obGlow: new THREE.Color(),
  foliage: new THREE.Color(), foliageScale: 1,
  accent: new THREE.Color(), accentScale: 1,
  trunk: new THREE.Color(),
  particle: new THREE.Color(), fall: 1.5, sway: 1, pSize: 0.2,
  ice: 0, pond: 0,
  music: { bpm: 112, root: 62, lead: 'triangle', leadGain: 0.1, drum: 0.075, pad: 0.1, flute: 1, saw: 0 }
};

const _cA = new THREE.Color(), _cB = new THREE.Color();
function mixColor(out, hexA, hexB, k) {
  return out.copy(_cA.setHex(hexA)).lerp(_cB.setHex(hexB), k);
}
function mix(out, a, b, k) { return a + (b - a) * k; }

/**
 * 推进季节（每帧调用）
 * 目标进度由「金币」决定：每 100 枚币换一季，最后 26 枚币的区间内完成渐变。
 * 但真实进度 k 每秒最多只推进 SEASON_MAX_RATE，所以吃币再快也不会瞬间换季。
 */
function updateSeason(dt) {
  seasonState.t += dt;
  /* ① 金币进度：本季已收集到的金币数 */
  const within = game.score % CFG.SEASON_COINS;
  const fadeStart = CFG.SEASON_COINS - CFG.SEASON_FADE_COINS;
  let coinTarget = within <= fadeStart ? 0 : (within - fadeStart) / CFG.SEASON_FADE_COINS;
  /* ② 兜底时间进度：一直吃不到币也会慢慢换季 */
  const timeTarget = (seasonState.t - CFG.SEASON_TIME_HOLD) / CFG.SEASON_TIME_FADE;
  const target = Math.max(0, Math.min(1, Math.max(coinTarget, timeTarget)));

  /* ③ 限速：每秒最多变化 SEASON_MAX_RATE —— 这就是「慢慢变」的关键 */
  if (target > seasonState.k) seasonState.k = Math.min(target, seasonState.k + CFG.SEASON_MAX_RATE * dt);
  else seasonState.k = Math.max(target, seasonState.k - CFG.SEASON_MAX_RATE * dt);

  /* ④ 过渡完成 → 正式进入下一季 */
  if (seasonState.k >= 1) {
    seasonState.index = (seasonState.index + 1) % SEASONS.length;
    seasonState.k = 0;
    seasonState.t = 0;
    const s = SEASONS[seasonState.index];
    showToast(s.icon + ' ' + s.name + '天来了', 'good');
  }
}

/** 当前季节的插值系数：0 = 完全在本季，1 = 完全进入下一季 */
function seasonMix() {
  const i = seasonState.index;
  const j = (i + 1) % SEASONS.length;
  let k = Math.max(0, Math.min(1, seasonState.k));
  k = k * k * (3 - 2 * k);      // smoothstep：两头慢、中间快，过渡更自然
  return { a: SEASONS[i], b: SEASONS[j], k };
}

function updateSeasonBlend() {
  const { a, b, k } = seasonMix();
  mixColor(VIEW.skyTop, hexOf(a.skyTop), hexOf(b.skyTop), k);
  mixColor(VIEW.skyMid, hexOf(a.skyMid), hexOf(b.skyMid), k);
  mixColor(VIEW.skyBottom, hexOf(a.skyBottom), hexOf(b.skyBottom), k);
  mixColor(VIEW.fog, a.fog, b.fog, k);
  mixColor(VIEW.grid, a.grid, b.grid, k);
  mixColor(VIEW.dot, a.dot, b.dot, k);
  mixColor(VIEW.voidC, a.void, b.void, k);
  mixColor(VIEW.tileTint, a.tileTint, b.tileTint, k);
  VIEW.tileTintAmt = mix(a.tileTintAmt, b.tileTintAmt, k);

  mixColor(VIEW.sunColor, a.sun.color, b.sun.color, k);
  VIEW.sunInt = mix(a.sun.intensity, b.sun.intensity, k);
  mixColor(VIEW.hemiSky, a.hemi.sky, b.hemi.sky, k);
  mixColor(VIEW.hemiGround, a.hemi.ground, b.hemi.ground, k);
  VIEW.hemiInt = mix(a.hemi.intensity, b.hemi.intensity, k);
  mixColor(VIEW.ambColor, a.amb.color, b.amb.color, k);
  VIEW.ambInt = mix(a.amb.intensity, b.amb.intensity, k);

  mixColor(VIEW.obBody, hexOf(a.obstacle.body), hexOf(b.obstacle.body), k);
  mixColor(VIEW.obCap, hexOf(a.obstacle.cap), hexOf(b.obstacle.cap), k);
  mixColor(VIEW.obGlow, a.obstacle.glow, b.obstacle.glow, k);

  mixColor(VIEW.foliage, a.foliage.color, b.foliage.color, k);
  VIEW.foliageScale = mix(a.foliage.scale, b.foliage.scale, k);
  mixColor(VIEW.accent, a.accent.color, b.accent.color, k);
  VIEW.accentScale = mix(a.accent.scale, b.accent.scale, k);
  mixColor(VIEW.trunk, a.trunk, b.trunk, k);

  mixColor(VIEW.particle, a.particle.color, b.particle.color, k);
  VIEW.fall = mix(a.particle.fall, b.particle.fall, k);
  VIEW.sway = mix(a.particle.sway, b.particle.sway, k);
  VIEW.pSize = mix(a.particle.size, b.particle.size, k);
  VIEW.ice = mix(a.ice, b.ice, k);
  VIEW.pond = mix(a.pond, b.pond, k);

  const ma = a.music, mb = b.music;
  VIEW.music.bpm = mix(ma.bpm, mb.bpm, k);
  VIEW.music.root = Math.round(mix(ma.root, mb.root, k));
  VIEW.music.lead = k < 0.5 ? ma.lead : mb.lead;
  VIEW.music.leadGain = mix(ma.leadGain, mb.leadGain, k);
  VIEW.music.drum = mix(ma.drum, mb.drum, k);
  VIEW.music.pad = mix(ma.pad, mb.pad, k);
  VIEW.music.flute = mix(ma.flute, mb.flute, k);
  VIEW.music.saw = mix(ma.saw, mb.saw, k);
}

function hexOf(s) { return parseInt(s.slice(1), 16); }

/* 天空贴图不必每帧重绘：颜色变化超过阈值或每 0.15 秒重绘一次 */
let skyDrawAcc = 0;
const _lastSky = new THREE.Color();
function applySeasonVisual(dt) {
  drawSky(VIEW.skyTop, VIEW.skyMid, VIEW.skyBottom);
  skyDrawAcc = 0;
  scene.fog.color.copy(VIEW.fog);
  groundMat.color.copy(VIEW.grid);
  voidFloor.material.color.copy(VIEW.voidC);
  hemiLight.color.copy(VIEW.hemiSky);
  hemiLight.groundColor.copy(VIEW.hemiGround);
  hemiLight.intensity = VIEW.hemiInt;
  ambLight.color.copy(VIEW.ambColor);
  ambLight.intensity = VIEW.ambInt;
  sunLight.color.copy(VIEW.sunColor);
  sunLight.intensity = VIEW.sunInt;
}


/* ==================================================================
 * 【模块 4】地面网格 / 云朵 / 季节飘落物 / 路边景物
 * ================================================================== */
const GROUND_W = 60, GROUND_D = 210, GRID_CELL = CFG.LANE_WIDTH;

const groundTex = (function () {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = '#ffffff';                 // 白色线条，实际颜色由材质 color 决定（方便随季节染色）
  ctx.lineWidth = 2.6;
  ctx.strokeRect(1.3, 1.3, S - 2.6, S - 2.6);
  ctx.fillStyle = '#ffffff';
  for (const p of [[0, 0], [S, 0], [0, S], [S, S]]) {
    ctx.beginPath(); ctx.arc(p[0], p[1], 4.2, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(GROUND_W / GRID_CELL, GROUND_D / GRID_CELL);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
})();

const groundMat = new THREE.MeshBasicMaterial({
  map: groundTex, transparent: true, opacity: 0.55, color: 0xcfeacf, depthWrite: false
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_W, GROUND_D), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, CFG.GROUND_Y, -GROUND_D / 2 + 24);
ground.renderOrder = -1;
scene.add(ground);
const GRID_SCROLL_PER_UNIT = groundTex.repeat.y / GROUND_D;

/* 跑道下方的"天空底板"，让缺口看起来是通透的天空 */
const voidFloor = new THREE.Mesh(
  new THREE.PlaneGeometry(GROUND_W * 1.4, GROUND_D),
  new THREE.MeshBasicMaterial({ color: 0xe8f8ea, transparent: true, opacity: 0.72 })
);
voidFloor.rotation.x = -Math.PI / 2;
voidFloor.position.set(0, CFG.GROUND_Y + 0.6, -GROUND_D / 2 + 24);
voidFloor.renderOrder = -2;
scene.add(voidFloor);

/* ---------- 云朵 ---------- */
const clouds = [];
(function buildClouds() {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const blobGeo = new THREE.SphereGeometry(1, 12, 10);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 3 + ((Math.random() * 3) | 0);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(blobGeo, mat);
      m.position.set((j - n / 2) * 1.5 + Math.random(), Math.random() * 0.6, Math.random() * 1.2 - 0.6);
      m.scale.set(1.5 + Math.random(), 1.0 + Math.random() * 0.5, 1.3 + Math.random() * 0.6);
      g.add(m);
    }
    g.position.set((Math.random() - 0.5) * 46, 9 + Math.random() * 10, -20 - Math.random() * 90);
    g.scale.setScalar(1.4 + Math.random() * 1.6);
    scene.add(g);
    clouds.push(g);
  }
})();

/* ---------- 季节飘落物（花瓣 / 浮尘 / 枫叶 / 雪花） ---------- */
const PN = CFG.PARTICLE_COUNT;
const pPos = new Float32Array(PN * 3);
const pPhase = new Float32Array(PN);
const pSpeed = new Float32Array(PN);
for (let i = 0; i < PN; i++) {
  pPos[i * 3]     = (Math.random() - 0.5) * 34;
  pPos[i * 3 + 1] = Math.random() * 22 - 2;
  pPos[i * 3 + 2] = -Math.random() * 90 + 10;
  pPhase[i] = Math.random() * Math.PI * 2;
  pSpeed[i] = 0.7 + Math.random() * 0.7;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

/* 圆形柔边贴图，让飘落物看起来是花瓣/雪花而不是方块 */
const pTex = (function () {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

const pMat = new THREE.PointsMaterial({
  size: 0.2, map: pTex, transparent: true, opacity: 0.92,
  depthWrite: false, sizeAttenuation: true
});
const particles = new THREE.Points(pGeo, pMat);
particles.frustumCulled = false;
scene.add(particles);

/** 飘落物更新：随季节改变下落速度 / 摆动幅度 / 大小 / 颜色 */
function updateParticles(dt, dz, t) {
  pMat.color.copy(VIEW.particle);
  pMat.size = VIEW.pSize;
  for (let i = 0; i < PN; i++) {
    const i3 = i * 3;
    pPos[i3 + 1] -= VIEW.fall * pSpeed[i] * dt;
    pPos[i3]     += Math.sin(t * 1.6 + pPhase[i]) * VIEW.sway * dt;
    pPos[i3 + 2] += dz;                                   // 跟着世界一起后退
    /* 秋天：小熊跑过时会卷起地面的枯叶 */
    if (VIEW.ice < 0.5 && VIEW.fall > 1.8 && pPos[i3 + 1] < 1.1 && Math.abs(pPos[i3 + 2]) < 2.5) {
      pPos[i3 + 1] += dt * 1.6;
    }
    if (pPos[i3 + 1] < -3 || pPos[i3 + 2] > 16) {         // 回收重生
      pPos[i3]     = (Math.random() - 0.5) * 34;
      pPos[i3 + 1] = 16 + Math.random() * 8;
      pPos[i3 + 2] = -60 - Math.random() * 40;
    }
  }
  pGeo.attributes.position.needsUpdate = true;
}

/* ---------- 路边景物：花草 / 树 / 落叶堆 / 覆雪枯枝 ---------- */
/* 用同一套"树干 + 树冠 + 点缀"结构，靠颜色和缩放随季节形变，过渡自然 */
const props = [];
const PROP_GEO_TRUNK = new THREE.CylinderGeometry(0.10, 0.14, 1.0, 7);
const PROP_GEO_LEAF  = new THREE.SphereGeometry(0.52, 10, 8);
const PROP_GEO_ACC   = new THREE.SphereGeometry(0.26, 8, 6);

(function buildProps() {
  for (let i = 0; i < 30; i++) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(PROP_GEO_TRUNK, new THREE.MeshLambertMaterial({ color: 0x9c7b52 }));
    trunk.position.y = 0.5;
    const leaf = new THREE.Mesh(PROP_GEO_LEAF, new THREE.MeshLambertMaterial({ color: 0xa9e39a }));
    leaf.position.y = 1.15;
    leaf.castShadow = true;
    const acc = new THREE.Mesh(PROP_GEO_ACC, new THREE.MeshLambertMaterial({ color: 0xffb7d5 }));
    acc.position.y = 1.5;
    g.add(trunk, leaf, acc);
    /* 只摆在跑道两侧，绝不伸到跑道上方（保证不遮挡视线） */
    const side = Math.random() < 0.5 ? -1 : 1;
    g.position.set(side * (5.2 + Math.random() * 4.6), -0.1, -Math.random() * 90 + 10);
    const s = 0.85 + Math.random() * 0.75;
    g.scale.setScalar(s);
    g.userData.baseScale = s;
    scene.add(g);
    props.push(g);
  }
})();

function updateProps(dz) {
  for (const g of props) {
    g.position.z += dz;
    if (g.position.z > 16) {
      g.position.z = -95 - Math.random() * 25;
      const side = Math.random() < 0.5 ? -1 : 1;
      g.position.x = side * (5.2 + Math.random() * 4.6);
    }
    const [trunk, leaf, acc] = g.children;
    trunk.material.color.copy(VIEW.trunk);
    leaf.material.color.copy(VIEW.foliage);
    leaf.scale.setScalar(VIEW.foliageScale * (0.9 + g.userData.baseScale * 0.2));
    acc.material.color.copy(VIEW.accent);
    acc.scale.setScalar(Math.max(0.001, VIEW.accentScale));
    acc.position.y = 1.15 + VIEW.foliageScale * 0.42;
  }
}

/* 夏日斑驳树影：地面上几片缓慢移动的深色光斑 */
const shadowBlobs = [];
(function buildShadowBlobs() {
  const geo = new THREE.CircleGeometry(1.5, 16);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x2f6b3a, transparent: true, opacity: 0, depthWrite: false
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((Math.random() - 0.5) * 16, CFG.GROUND_Y + 0.05, -Math.random() * 80 + 10);
    m.scale.setScalar(0.7 + Math.random() * 1.1);
    m.renderOrder = -0.5;
    scene.add(m);
    shadowBlobs.push(m);
  }
})();

function updateShadowBlobs(dz) {
  /* 夏季权重：sunIntensity 高 + 树冠大 => 光斑明显 */
  const summerW = THREE.MathUtils.clamp((VIEW.foliageScale - 0.85) / 0.45, 0, 1);
  for (const m of shadowBlobs) {
    m.position.z += dz;
    if (m.position.z > 16) {
      m.position.z = -80 - Math.random() * 20;
      m.position.x = (Math.random() - 0.5) * 16;
    }
    m.material.opacity = 0.16 * summerW;
  }
}


/* ==================================================================
 * 【模块 5】地砖（InstancedMesh）
 * ================================================================== */
const MAX_TILES = Math.ceil((CFG.VIEW_DISTANCE + CFG.RECYCLE_Z) / CFG.TILE_SIZE + 6) * CFG.LANE_COUNT + 80;

const tileMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(CFG.TILE_SIZE * 0.97, CFG.TILE_HEIGHT, CFG.TILE_SIZE * 0.97),
  [
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xdfeaf2 }),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  ],
  MAX_TILES
);
tileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
tileMesh.castShadow = true;
tileMesh.receiveShadow = true;
tileMesh.frustumCulled = false;
tileMesh.count = 0;
scene.add(tileMesh);

const tileMap = new Map();
const activeTiles = [];
const _m4 = new THREE.Matrix4();
const _color = new THREE.Color();
const _iceColor = new THREE.Color(0xdff4ff);
const TILE_PALETTE = ['#ffc2d4', '#a9ecc2', '#ffe89a', '#b9caff', '#ffd0a3', '#cdb8ff', '#a9e6ee']
  .map(h => new THREE.Color(h));

function addTile(lane, z) {
  const key = `${lane}:${Math.round(z / CFG.TILE_SIZE)}`;
  if (tileMap.has(key)) return;
  if (activeTiles.length >= MAX_TILES) return;
  const t = {
    lane, x: LANE_X[lane], z0: z, z, rise: 1,
    color: TILE_PALETTE[(Math.random() * TILE_PALETTE.length) | 0],
    ice: Math.random() < CFG.ICE_CHANCE && VIEW.ice > 0.5   // 只有冬天才会结冰
  };
  t.key = key;
  tileMap.set(key, t);
  activeTiles.push(t);
}

function writeTileInstance(i, t) {
  const ease = 1 - t.rise;
  _m4.makeTranslation(t.x, TILE_Y - t.rise * 0.6, t.z);
  _m4.elements[5]  = 0.35 + ease * 0.65;
  _m4.elements[10] = 0.35 + ease * 0.65;
  tileMesh.setMatrixAt(i, _m4);
  _color.copy(t.color).lerp(VIEW.tileTint, VIEW.tileTintAmt);
  if (t.ice) _color.lerp(_iceColor, 0.75);
  tileMesh.setColorAt(i, _color);
}

function updateTiles(dt) {
  const riseStep = dt / CFG.TILE_RISE_TIME;
  for (let i = activeTiles.length - 1; i >= 0; i--) {
    const t = activeTiles[i];
    t.z = t.z0 + game.travel;
    if (t.z > CFG.RECYCLE_Z) {
      tileMap.delete(t.key);
      const last = activeTiles.pop();
      if (i < activeTiles.length) { activeTiles[i] = last; writeTileInstance(i, last); }
      continue;
    }
    if (t.rise > 0) t.rise = Math.max(0, t.rise - riseStep);
    writeTileInstance(i, t);
  }
  tileMesh.count = activeTiles.length;
  tileMesh.instanceMatrix.needsUpdate = true;
  if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;
}

function tileUnderBall(lane) {
  for (const t of activeTiles) {
    if (t.lane !== lane) continue;
    if (Math.abs(t.z) < CFG.TILE_SIZE * 0.62 && t.rise < 0.75) return t;
  }
  return null;
}

function nearestTileWithin(x, maxDist) {
  let best = null, bestD = maxDist;
  for (const t of activeTiles) {
    if (t.rise > 0.75 || Math.abs(t.z) > CFG.TILE_SIZE * 0.62) continue;
    const d = Math.abs(t.x - x);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}


/* ==================================================================
 * 【模块 6】障碍：果冻方块（四季配色）+ 夏季水塘
 * ================================================================== */
const obstacles = [];
const obPoolJelly = [], obPoolPond = [];

const JELLY_GEO = new THREE.SphereGeometry(0.6, 16, 12);      // 圆润果冻本体
const JELLY_CAP = new THREE.CylinderGeometry(0.52, 0.60, 0.16, 16);
const JELLY_CORE = new THREE.SphereGeometry(0.22, 10, 8);
const JELLY_TOP = new THREE.SphereGeometry(0.15, 8, 6);
const POND_GEO = new THREE.CylinderGeometry(0.24, 0.24, 0.10, 18);
const POND_RING = new THREE.TorusGeometry(0.24, 0.03, 6, 18);

const OB_NEAR = new THREE.Color(0xff5c6c);   // 近距离警示色
const _tmpCol = new THREE.Color();

function acquireObstacle(type) {
  const pool = type === 'pond' ? obPoolPond : obPoolJelly;
  let g = pool.pop();
  if (!g) {
    g = new THREE.Group();
    if (type === 'pond') {
      const water = new THREE.Mesh(POND_GEO, new THREE.MeshStandardMaterial({
        color: 0x63c7ef, transparent: true, opacity: 0.78, roughness: 0.1, metalness: 0.2,
        emissive: 0x1c7fa8, emissiveIntensity: 0.25
      }));
      water.position.y = 0.07;
      const ring = new THREE.Mesh(POND_RING, new THREE.MeshStandardMaterial({ color: 0xbfeee0, roughness: 0.6 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      g.add(water, ring);
      g.userData.parts = [water];
    } else {
      /* 果冻方块：半透明本体 + 发光内核 + 亮顶盖 + 季节小点缀 */
      const body = new THREE.Mesh(JELLY_GEO, new THREE.MeshStandardMaterial({
        color: 0xff9ec4, transparent: true, opacity: 0.85,
        roughness: 0.16, metalness: 0.0, emissive: 0xff6fae, emissiveIntensity: 0.22
      }));
      const kx = CFG.OBSTACLE_W / 1.2, ky = CFG.OBSTACLE_H * 0.62 / 1.2, kz = CFG.OBSTACLE_D / 1.2;
      body.scale.set(kx, ky, kz);
      body.position.y = CFG.OBSTACLE_H * 0.34;
      body.castShadow = body.receiveShadow = true;
      const core = new THREE.Mesh(JELLY_CORE, new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5, transparent: true, opacity: 0.75
      }));
      core.position.y = CFG.OBSTACLE_H * 0.34;
      const cap = new THREE.Mesh(JELLY_CAP, new THREE.MeshStandardMaterial({
        color: 0xffe0ee, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.12
      }));
      cap.position.y = CFG.OBSTACLE_H * 0.66;
      cap.scale.set(kx * 0.95, 1, kz * 0.95);   // 顶盖跟随障碍宽度，不会超出车道
      cap.castShadow = true;
      const top = new THREE.Mesh(JELLY_TOP, new THREE.MeshStandardMaterial({
        color: 0xffb7d5, roughness: 0.35, emissive: 0xffb7d5, emissiveIntensity: 0.3
      }));
      top.position.y = CFG.OBSTACLE_H * 0.82;
      top.scale.setScalar(0.7);
      g.add(body, core, cap, top);
      g.userData.parts = [body, cap, top];
      g.userData.core = core;
    }
    g.userData.type = type;
  }
  g.visible = true;
  scene.add(g);
  return g;
}

/**
 * @param {number} side  -1 = 贴车道左边，1 = 贴车道右边，0 = 随机
 * 障碍一律不摆在车道正中间：贴边放，玩家往另一边靠就能擦过去。
 */
function spawnObstacle(lane, z, side = 0) {
  const type = (VIEW.pond > 0.5 && Math.random() < CFG.POND_CHANCE) ? 'pond' : 'jelly';
  const g = acquireObstacle(type);
  const s = side !== 0 ? side : (Math.random() < 0.5 ? -1 : 1);
  const x = LANE_X[lane] + CFG.OBSTACLE_OFFSET * s;
  g.position.set(x, 0, z);
  const h = type === 'pond' ? CFG.POND_H : CFG.OBSTACLE_H;
  obstacles.push({ group: g, x, z0: z, z, alive: true, type, h, bob: Math.random() * 6 });
}

function releaseObstacle(o) {
  o.group.visible = false;
  scene.remove(o.group);
  (o.type === 'pond' ? obPoolPond : obPoolJelly).push(o.group);
}

function updateObstacles(dt, t) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.z = o.z0 + game.travel;
    o.group.position.z = o.z;

    /* 距离染色：远处偏季节色（温和），近处混入警示红 */
    const k = THREE.MathUtils.clamp((o.z + 42) / 36, 0, 1);
    const parts = o.group.userData.parts;
    if (o.type === 'jelly') {
      const body = parts[0], cap = parts[1], top = parts[2];
      body.material.color.copy(_tmpCol.copy(VIEW.obBody).lerp(OB_NEAR, k * 0.65));
      body.material.emissive.copy(VIEW.obGlow);
      cap.material.color.copy(_tmpCol.copy(VIEW.obCap).lerp(OB_NEAR, k * 0.25));
      top.material.color.copy(VIEW.accent);
      top.material.emissive.copy(VIEW.accent);
      /* 果冻呼吸感：轻微上下浮动 + 挤压 */
      o.bob += dt;
      const s = 1 + Math.sin(o.bob * 2.4) * 0.05;
      body.scale.y = CFG.OBSTACLE_H * 0.62 / 1.2 * (2 - s);
      body.scale.x = CFG.OBSTACLE_W / 1.2 * s;
      o.group.userData.core.material.emissiveIntensity = 0.35 + Math.sin(o.bob * 3) * 0.15;
    } else {
      /* 水塘：轻微波动 */
      parts[0].scale.setScalar(1 + Math.sin(t * 2.2 + o.z) * 0.04);
    }

    if (o.z > CFG.RECYCLE_Z || !o.alive) { obstacles.splice(i, 1); releaseObstacle(o); }
  }
}


/* ==================================================================
 * 【模块 7】金币
 * ================================================================== */
const coins = [];
const coinPool = [];
const COIN_GEO = new THREE.CylinderGeometry(CFG.COIN_RADIUS, CFG.COIN_RADIUS, CFG.COIN_THICK, 20);
const COIN_MAT = new THREE.MeshStandardMaterial({
  color: 0xffd23f, emissive: 0xf0a52b, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.32
});
const COIN_RING_GEO = new THREE.TorusGeometry(CFG.COIN_RADIUS * 0.9, 0.05, 6, 18);
const COIN_RING_MAT = new THREE.MeshStandardMaterial({ color: 0xf0a52b, metalness: 0.3, roughness: 0.45 });

function acquireCoin() {
  let g = coinPool.pop();
  if (!g) {
    g = new THREE.Group();
    const disc = new THREE.Mesh(COIN_GEO, COIN_MAT);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    const ring = new THREE.Mesh(COIN_RING_GEO, COIN_RING_MAT);
    g.add(disc, ring);
  }
  g.visible = true;
  scene.add(g);
  return g;
}
function spawnCoin(lane, z) {
  const g = acquireCoin();
  g.position.set(LANE_X[lane], CFG.COIN_START_Y, z);
  coins.push({ group: g, x: LANE_X[lane], y: CFG.COIN_START_Y, z0: z, z, landed: false });
}
function releaseCoin(c) { c.group.visible = false; scene.remove(c.group); coinPool.push(c.group); }

function updateCoins(dt) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.z = c.z0 + game.travel;
    if (!c.landed) {
      c.y -= CFG.COIN_FALL_SPEED * dt;
      if (c.y <= CFG.COIN_REST_Y) { c.y = CFG.COIN_REST_Y; c.landed = true; }
    }
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.y += CFG.COIN_SPIN * dt;
    if (c.z > CFG.RECYCLE_Z) { coins.splice(i, 1); releaseCoin(c); }
  }
}


/* ==================================================================
 * 【模块 8】玩家：小熊
 * 优先加载 bear.glb；加载失败则用球体拼一只"备用小熊"，保证游戏一定能玩
 * ================================================================== */
const playerGroup = new THREE.Group();
playerGroup.position.set(0, CFG.PLAYER_RADIUS, 0);
scene.add(playerGroup);

const bearHolder = new THREE.Group();      // 模型单独一层，方便做挤压/倾斜动画
playerGroup.add(bearHolder);

let bearReady = false;

/** 用基础几何体拼一只可爱小熊（兜底方案） */
function buildFallbackBear() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.75, metalness: 0.02 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf6e3c8, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.40, 16, 14), fur);
  body.scale.set(1, 1.05, 0.92); body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 14), fur);
  head.position.y = 0.86;
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fur);
  earL.position.set(-0.23, 1.06, 0);
  const earR = earL.clone(); earR.position.x = 0.23;
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), cream);
  muzzle.position.set(0, 0.80, 0.24); muzzle.scale.set(1.1, 0.85, 0.8);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), dark);
  nose.position.set(0, 0.82, 0.35);
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
  eyeL.position.set(-0.11, 0.92, 0.26);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.11;
  const armL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fur);
  armL.position.set(-0.38, 0.52, 0.05); armL.scale.set(0.9, 1.2, 0.9);
  const armR = armL.clone(); armR.position.x = 0.38;
  const legL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), fur);
  legL.position.set(-0.19, 0.13, 0.02); legL.scale.set(1, 0.85, 1.15);
  const legR = legL.clone(); legR.position.x = 0.19;
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), cream);
  tail.position.set(0, 0.40, -0.36);

  for (const m of g.children) { m.castShadow = true; }
  g.add(body, head, earL, earR, muzzle, nose, eyeL, eyeR, armL, armR, legL, legR, tail);
  return g;
}

/** 极简 GLB 解析：只处理本模型用到的单网格 + 单贴图，避免再引入额外加载库 */
function parseGLB(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('不是合法的 glb 文件');
  let off = 12, json = null, bin = null;
  while (off + 8 <= arrayBuffer.byteLength) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(arrayBuffer, start, len)));
    else if (type === 0x004e4942) bin = new Uint8Array(arrayBuffer, start, len);
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error('glb 缺少数据块');

  const CTOR = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  function readAcc(idx) {
    const acc = json.accessors[idx];
    const bv = json.bufferViews[acc.bufferView];
    const n = COMP[acc.type];
    const Ctor = CTOR[acc.componentType];
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    return new Ctor(bin.buffer, bin.byteOffset + byteOffset, acc.count * n);
  }

  const prim = json.meshes[0].primitives[0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(readAcc(prim.attributes.POSITION)), 3));
  if (prim.attributes.NORMAL) geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(readAcc(prim.attributes.NORMAL)), 3));
  if (prim.attributes.TEXCOORD_0) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(readAcc(prim.attributes.TEXCOORD_0)), 2));
  if (prim.indices !== undefined) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(readAcc(prim.indices)), 1));

  /* 应用节点变换（Blender 导出的 Z-up 旋转等） */
  const node = (json.nodes || []).find(n => n.mesh !== undefined) || {};
  const m = new THREE.Matrix4();
  const t = node.translation || [0, 0, 0];
  const q = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  m.compose(
    new THREE.Vector3(t[0], t[1], t[2]),
    new THREE.Quaternion(q[0], q[1], q[2], q[3]),
    new THREE.Vector3(s[0], s[1], s[2])
  );
  geo.applyMatrix4(m);

  /* 贴图（取第一张 baseColorTexture） */
  let tex = null;
  const mat = (json.materials || [])[prim.material || 0] || {};
  const texIdx = mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorTexture
    ? mat.pbrMetallicRoughness.baseColorTexture.index : (mat.baseColorTexture ? mat.baseColorTexture.index : null);
  if (texIdx !== null && texIdx !== undefined) {
    const imgIdx = json.textures[texIdx].source !== undefined ? json.textures[texIdx].source : texIdx;
    const img = json.images[imgIdx];
    const bv = json.bufferViews[img.bufferView];
    const bytes = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
    const blob = new Blob([bytes.slice()], { type: img.mimeType || 'image/png' });
    tex = new THREE.Texture();
    tex.image = new Image();
    tex.image.onload = () => { tex.needsUpdate = true; };
    tex.image.src = URL.createObjectURL(blob);
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return { geo, tex };
}

function fitBear(group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const scale = CFG.BEAR_HEIGHT / Math.max(size.y, 0.0001);
  group.scale.setScalar(scale);
  group.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
}

function setBear(obj) {
  bearHolder.add(obj);
  bearReady = true;
}

/* 先放备用小熊，保证立刻能玩；GLB 到位后替换 */
setBear(buildFallbackBear());

(function loadBear() {
  fetch(CFG.MODEL_URL).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.arrayBuffer();
  }).then(buf => {
    const { geo, tex } = parseGLB(buf);
    const mat = new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : 0xd9a066,
      roughness: 0.72, metalness: 0.03
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const wrap = new THREE.Group();
    wrap.add(mesh);
    fitBear(wrap);
    bearHolder.remove(bearHolder.children[0]);
    setBear(wrap);
  }).catch(err => {
    console.warn('小熊模型加载失败，使用备用小熊：', err);
  });
})();

/* 落地假阴影 */
const blobShadow = new THREE.Mesh(
  new THREE.CircleGeometry(CFG.PLAYER_RADIUS * 1.15, 24),
  new THREE.MeshBasicMaterial({ color: 0x2b6ea8, transparent: true, opacity: 0.18, depthWrite: false })
);
blobShadow.rotation.x = -Math.PI / 2;
blobShadow.position.y = 0.02;
scene.add(blobShadow);

/* 保护罩 */
const shieldMesh = new THREE.Mesh(
  new THREE.SphereGeometry(CFG.PLAYER_RADIUS * 1.32, 24, 18),
  new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.30, side: THREE.BackSide, depthWrite: false })
);
shieldMesh.visible = false;
playerGroup.add(shieldMesh);

/* 闪电模型：加速时在小熊头顶旋转 */
const boltMesh = (function buildBolt() {
  const s = new THREE.Shape();
  s.moveTo(0.10, 0.62); s.lineTo(-0.22, 0.06); s.lineTo(-0.02, 0.06);
  s.lineTo(-0.14, -0.62); s.lineTo(0.24, 0.02); s.lineTo(0.02, 0.02);
  s.lineTo(0.16, 0.62); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.10, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 });
  geo.center();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xffe14d, emissive: 0xffb703, emissiveIntensity: 0.85, roughness: 0.25, metalness: 0.1
  }));
  m.scale.setScalar(0.9);
  m.visible = false;
  return m;
})();
playerGroup.add(boltMesh);


/* ==================================================================
 * 【模块 9】游戏状态机 / HUD / 弹窗 / 闪电加速
 * ================================================================== */
const STATE = { READY: 'ready', COUNTDOWN: 'countdown', INTRO: 'intro', PLAYING: 'playing', FALLING: 'falling', OVER: 'over' };

const game = {
  state: STATE.READY,
  score: 0, lives: CFG.START_LIVES, best: 0,
  speed: CFG.BASE_SPEED, speedMul: 1, elapsed: 0,
  ballX: 0, ballY: CFG.PLAYER_RADIUS, ballVY: 0,
  grounded: true, jumpHeld: 0, jumpsUsed: 0, coyote: 0,
  squash: 0, invincible: 0, blink: 0, travel: 0,
  countdown: 0, protect: 0, landLock: 0, timeScale: 1,
  slipVX: 0,          // 冰面打滑的横向惯性
  bolts: 0,           // 存了几次闪电加速
  boost: 0,           // 加速剩余时间
  footAcc: 0
};

try { game.best = Number(localStorage.getItem('bearrun_best') || 0) || 0; } catch (e) { game.best = 0; }

/* ---------- DOM ---------- */
const elScore    = document.getElementById('scoreValue');
const elLives    = document.getElementById('livesValue');
const elSpeedBar = document.getElementById('speedBar');
const elOverlay  = document.getElementById('overlay');
const elCard     = document.getElementById('card');
const elFlash    = document.getElementById('flash');
const elBoltBtn  = document.getElementById('boltBtn');
const elBoltCnt  = document.getElementById('boltCount');
const elBoostWrap= document.getElementById('boostWrap');
const elBoostBar = document.getElementById('boostBar');
const elBoostFx  = document.getElementById('boostFx');
const elSeasonName = document.getElementById('seasonName');
const elSeasonIcon = document.getElementById('seasonIcon');

function renderHUD() {
  elScore.textContent = game.score;
  let html = '';
  for (let i = 0; i < CFG.START_LIVES; i++) html += `<i class="heart${i < game.lives ? '' : ' lost'}"></i>`;
  elLives.innerHTML = html;
  elBoltCnt.textContent = game.bolts;
  elBoltBtn.classList.toggle('ready', game.bolts > 0 && game.boost <= 0 && game.state === STATE.PLAYING);
  updateSpeedBar();
}

function updateSpeedBar() {
  const p = (game.speed - CFG.BASE_SPEED) / (CFG.MAX_SPEED_ABS - CFG.BASE_SPEED);
  elSpeedBar.style.width = Math.round(Math.max(0, Math.min(1, p)) * 100) + '%';
}

function updateSeasonTag() {
  const { a, b, k } = seasonMix();
  const cur = k > 0.5 ? b : a;
  if (elSeasonName.textContent !== cur.name) {
    elSeasonName.textContent = cur.name;
    elSeasonIcon.textContent = cur.icon;
  }
}

function showToast(text, kind = 'bad') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'bad' ? '' : ' ' + kind);
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/** 使用一次闪电加速 */
function tryBoost() {
  if (game.bolts <= 0 || game.boost > 0 || game.state !== STATE.PLAYING) return;
  game.bolts--;
  game.boost = CFG.BOOST_TIME;
  sfxBolt();
  showToast('⚡ 加速！', 'bolt');
  elBoostWrap.classList.add('on');
  elBoostFx.classList.add('on');
  renderHUD();
}

function endBoost() {
  game.boost = 0;
  elBoostWrap.classList.remove('on');
  elBoostFx.classList.remove('on');
  renderHUD();
}

function takeDamage(obstacle, reason = '撞上障碍') {
  if (game.invincible > 0 || game.protect > 0 || game.state !== STATE.PLAYING) return;
  if (game.boost > 0) { if (obstacle) obstacle.alive = false; return; }   // 加速期间直接撞碎障碍
  game.lives--;
  game.invincible = CFG.INVINCIBLE_TIME;
  game.speed = Math.max(CFG.BASE_SPEED * 0.6, game.speed * CFG.HURT_SLOWDOWN);
  sfxHurt();
  elFlash.classList.add('on');
  setTimeout(() => elFlash.classList.remove('on'), 90);
  const hearts = elLives.querySelectorAll('.heart');
  if (hearts[game.lives]) hearts[game.lives].classList.add('pulse');
  showToast(reason, 'bad');
  if (obstacle) obstacle.alive = false;
  renderHUD();
  if (game.lives <= 0) gameOver();
}

function grantProtection() {
  game.protect = CFG.SPAWN_PROTECT;
  shieldMesh.visible = true;
  showToast('保护中', 'good');
}

function startFalling() {
  if (game.state !== STATE.PLAYING) return;
  game.lives--;
  renderHUD();
  game.state = STATE.FALLING;
  game.ballVY = -2;
  elFlash.classList.add('on');
  setTimeout(() => elFlash.classList.remove('on'), 120);
  showToast('掉下去了！');
  const hearts = elLives.querySelectorAll('.heart');
  if (hearts[game.lives]) hearts[game.lives].classList.add('pulse');
  setTimeout(() => game.lives > 0 ? respawn() : gameOver(), 640);
}

function respawn() {
  if (game.state === STATE.OVER) return;
  let target = null, bestDist = Infinity;
  for (const t of activeTiles) {
    if (t.rise > 0.75 || t.z >= 0) continue;
    const d = Math.abs(t.x - game.ballX) + Math.abs(t.z) * 0.4;
    if (d < bestDist) { bestDist = d; target = t; }
  }
  game.ballX = target ? target.x : 0;
  game.ballY = 7;
  game.ballVY = 0;
  game.grounded = false;
  game.jumpsUsed = 0;
  game.invincible = 0;
  game.blink = 0;
  game.slipVX = 0;
  game.state = STATE.INTRO;
  blobShadow.visible = true;
  clearAhead();
  grantProtection();
}

function clearAhead() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.z < 2) { obstacles.splice(i, 1); releaseObstacle(o); }
  }
  const rows = CFG.SAFE_AFTER_PROTECT + 2;
  for (let r = 0; r < rows; r++) {
    const z = -r * CFG.TILE_SIZE - game.travel;
    for (let lane = 0; lane < CFG.LANE_COUNT; lane++) {
      const key = `${lane}:${Math.round(z / CFG.TILE_SIZE)}`;
      if (!tileMap.has(key)) addTile(lane, z);
    }
  }
  hole = null;
  holeCooldown = CFG.HOLE_COOLDOWN;
  obstacleGap = CFG.OBSTACLE_GAP;
  safeDistance = Math.max(safeDistance, rows);
}

function gameOver() {
  game.state = STATE.OVER;
  sfxOver();
  if (game.score > game.best) {
    game.best = game.score;
    try { localStorage.setItem('bearrun_best', String(game.best)); } catch (e) {}
  }
  endBoost();
  showOverCard();
}

function clearWorld() {
  activeTiles.length = 0;
  tileMap.clear();
  tileMesh.count = 0;
  for (const o of obstacles) releaseObstacle(o);
  obstacles.length = 0;
  for (const c of coins) releaseCoin(c);
  coins.length = 0;
}

const ROW_START = 1.5;
function buildInitialWorld() {
  lastFreeLanes = ALL_LANES.slice();
  obstacleGap = 0;
  const N = Math.ceil((ROW_START + CFG.VIEW_DISTANCE) / CFG.TILE_SIZE);
  for (let r = 0; r <= N; r++) {
    spawnRow(+(ROW_START - r * CFG.TILE_SIZE).toFixed(3), (-(ROW_START - r * CFG.TILE_SIZE)) > -CFG.START_SAFE_DIST);
  }
  rowSpawned = N;
  game.travel = 0;
  nextRowTravel = CFG.TILE_SIZE;
}

function restart() {
  clearWorld();
  game.state = STATE.COUNTDOWN;
  game.countdown = 3;
  game.score = 0;
  game.lives = CFG.START_LIVES;
  game.speed = CFG.BASE_SPEED;
  game.elapsed = 0;
  game.ballX = 0;
  game.ballY = CFG.PLAYER_START_Y;
  game.ballVY = 0;
  game.grounded = false;
  game.jumpHeld = 0;
  game.jumpsUsed = 0;
  game.coyote = 0;
  game.squash = 0;
  game.invincible = 0;
  game.blink = 0;
  game.protect = 0;
  game.landLock = 0;
  game.travel = 0;
  game.slipVX = 0;
  game.bolts = 0;
  game.boost = 0;
  game.footAcc = 0;
  rowSpawned = 0;
  nextRowTravel = 0;
  rowIndex = 0;
  hole = null;
  holeCooldown = 0;
  obstacleGap = 0;
  safeDistance = 0;
  seasonState.index = 0;
  seasonState.k = 0;
  seasonState.t = 0;

  playerGroup.position.set(0, game.ballY, 0);
  playerGroup.scale.set(1, 1, 1);
  playerGroup.visible = true;
  blobShadow.visible = true;
  shieldMesh.visible = false;
  boltMesh.visible = false;

  input.mode = 'key';
  input.keyDir = 0;
  input.mouseTargetX = 0;
  input.clickTarget = null;
  input.left = input.right = false;
  input.jump = false;

  endBoost();
  buildInitialWorld();
  updateSeasonBlend();
  applySeasonVisual(0);
  elOverlay.classList.add('hidden');
  document.body.classList.add('show-cursor');
  showCountdown(3);
  renderHUD();
}

function showCountdown(n) {
  const el = document.createElement('div');
  el.className = 'countdown';
  el.textContent = n > 0 ? String(n) : 'GO!';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function showStartCard() {
  elCard.innerHTML = `
    <h1>小熊快跑</h1>
    <div class="subtitle">四季滚动天空 · 3D 跑酷</div>
    <div class="sectionTitle">操作方式</div>
    <div class="tips">
      <span class="key">←</span><span class="key">→</span> &nbsp;左右移动（手机：滑动 / 点击）<br>
      <span class="key">空格</span> &nbsp;跳跃（长按跳更高，可二段跳）<br>
      <span class="key">F</span> &nbsp;释放 ⚡ 闪电加速（或点击左下角按钮）
    </div>
    <div class="sectionTitle">游戏规则</div>
    <div class="tips">
      🪙 &nbsp;吃金币 <b>+1 分</b>；每满 <b>10 分</b> 获得一次 ⚡ 加速（5 秒）<br>
      🍮 &nbsp;撞到果冻障碍 <b>失去一条生命</b>（跳起来就能越过）<br>
      🕳 &nbsp;踩到缺口会 <b>掉下去</b>（同样扣一条生命）<br>
      🍃 &nbsp;春夏秋冬会 <b>慢慢轮换</b>：冬天有冰面会打滑，夏天有水塘<br>
      ⚡ &nbsp;加速期间可以直接撞碎障碍
    </div>
    <br>
    <div class="sectionTitle">难度</div>
    <div class="diffRow" id="diffRow">
      <button class="diffBtn" data-mul="0.82">轻松</button>
      <button class="diffBtn active" data-mul="1">标准</button>
      <button class="diffBtn" data-mul="1.3">挑战</button>
    </div>
    <br>
    <button class="btn" id="startBtn">开始游戏</button>
  `;
  bindDiffRow();
  elCard.querySelector('#startBtn').addEventListener('click', restart);
  elOverlay.classList.remove('hidden');
  document.body.classList.add('show-cursor');
}

function showOverCard() {
  const isNewBest = game.score >= game.best && game.score > 0;
  elCard.innerHTML = `
    <h2>游戏结束</h2>
    <div class="subtitle">本局最终成绩</div>
    <div class="finalScore">🪙 ${game.score}</div>
    <div class="best">历史最佳：${game.best}${isNewBest ? ' &nbsp;🎉 新纪录！' : ''}</div>
    <div class="sectionTitle">难度</div>
    <div class="diffRow" id="diffRow">
      <button class="diffBtn" data-mul="0.82">轻松</button>
      <button class="diffBtn active" data-mul="1">标准</button>
      <button class="diffBtn" data-mul="1.3">挑战</button>
    </div>
    <br>
    <button class="btn" id="againBtn">再来一次</button>
  `;
  bindDiffRow();
  elCard.querySelector('#againBtn').addEventListener('click', restart);
  elOverlay.classList.remove('hidden');
  document.body.classList.add('show-cursor');
}

function bindDiffRow() {
  const row = elCard.querySelector('#diffRow');
  row.querySelectorAll('.diffBtn').forEach(btn => {
    btn.classList.toggle('active', Math.abs(Number(btn.dataset.mul) - game.speedMul) < 1e-6);
    btn.addEventListener('click', () => {
      row.querySelectorAll('.diffBtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      game.speedMul = Number(btn.dataset.mul) || 1;
    });
  });
}


/* ==================================================================
 * 【模块 10】输入控制
 * ================================================================== */
const input = {
  left: false, right: false, keyDir: 0,
  mode: 'key', mouseTargetX: 0, clickTarget: null,
  jump: false, jumpPressed: false, touching: false
};

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { input.left = true; input.mode = 'key'; e.preventDefault(); }
  if (k === 'ArrowRight' || k === 'd' || k === 'D') { input.right = true; input.mode = 'key'; e.preventDefault(); }
  if (k === ' ' || k === 'Spacebar') {
    e.preventDefault();
    if (game.state === STATE.READY || game.state === STATE.OVER) { restart(); return; }
    input.jump = true;
    if (!e.repeat) input.jumpPressed = true;
    clearTimeout(input._jumpRelease);
    input._jumpRelease = setTimeout(() => { input.jump = false; }, 250);
  }
  if ((k === 'f' || k === 'F' || k === 'Shift') && !e.repeat) tryBoost();
  if (k === 'Enter' && (game.state === STATE.READY || game.state === STATE.OVER)) restart();
});
window.addEventListener('keyup', (e) => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
  if (k === ' ' || k === 'Spacebar') { input.jump = false; clearTimeout(input._jumpRelease); }
});

function screenXToTrackX(clientX) {
  const r = (clientX / window.innerWidth) * 2 - 1;
  return THREE.MathUtils.clamp(r * (CFG.TRACK_HALF + 0.6), P_MIN_X, P_MAX_X);
}

window.addEventListener('mousemove', (e) => {
  input.mouseTargetX = screenXToTrackX(e.clientX);
  input.mode = 'mouse';
  input.clickTarget = null;
});
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (game.state !== STATE.PLAYING && game.state !== STATE.INTRO) return;
  if (e.button === 2) { input.jumpPressed = true; input.jump = true; return; }
  input.clickTarget = screenXToTrackX(e.clientX);
  input.mode = 'click';
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

let touchStartY = 0;
renderer.domElement.addEventListener('touchstart', (e) => {
  if (game.state !== STATE.PLAYING && game.state !== STATE.INTRO) return;
  input.touching = true;
  touchStartY = e.touches[0].clientY;
  if (e.touches.length >= 2) { input.jumpPressed = true; input.jump = true; return; }
  input.clickTarget = screenXToTrackX(e.touches[0].clientX);
  input.mode = 'click';
}, { passive: true });
renderer.domElement.addEventListener('touchmove', (e) => {
  if (!input.touching) return;
  if (touchStartY - e.touches[0].clientY > 60 && !input.jump) { input.jumpPressed = true; input.jump = true; }
  input.mouseTargetX = screenXToTrackX(e.touches[0].clientX);
  input.mode = 'mouse';
  input.clickTarget = null;
}, { passive: true });
renderer.domElement.addEventListener('touchend', () => { input.touching = false; input.jump = false; }, { passive: true });

elBoltBtn.addEventListener('click', tryBoost);


/* ==================================================================
 * 【模块 11】世界生成
 * ================================================================== */
let obstacleGap = 0, rowIndex = 0, lastFreeLanes = ALL_LANES.slice();
let hole = null, holeCooldown = 0, safeDistance = 0;
let rowSpawned = 0, nextRowTravel = 0;

function startHole(lane) {
  const maxRows = Math.min(CFG.HOLE_MAX_ROWS, CFG.LANE_COUNT);
  hole = { lane, rows: 1 + ((Math.random() * maxRows) | 0) };
}

function spawnRow(z, safe = false) {
  rowIndex++;
  const protectRows = game.protect > 0 ? Math.ceil((game.protect * game.speed) / CFG.TILE_SIZE) + 2 : 0;
  if (protectRows > 0) safeDistance = Math.max(safeDistance, protectRows);
  const isSafeRow = safe || safeDistance > 0;
  if (safeDistance > 0) safeDistance--;

  const dangerMax = Math.floor(CFG.LANE_COUNT / 2);
  const skipLanes = new Set();
  if (hole && !isSafeRow) skipLanes.add(hole.lane);

  for (let lane = 0; lane < CFG.LANE_COUNT; lane++) {
    if (isSafeRow) { addTile(lane, z); continue; }
    if (skipLanes.has(lane)) continue;
    addTile(lane, z);
  }
  if (isSafeRow) return;

  if (hole) {
    hole.rows--;
    if (hole.rows <= 0) { hole = null; holeCooldown = CFG.HOLE_COOLDOWN; }
  }
  if (holeCooldown > 0) holeCooldown--;
  else if (!hole && rowIndex > CFG.HOLE_MIN_ROW && game.protect <= 0 &&
           Math.random() < CFG.HOLE_GAP_CHANCE * game.speedMul) {
    startHole((Math.random() * CFG.LANE_COUNT) | 0);
  }

  const occupied = [...skipLanes];
  const canPlace = !hole && obstacleGap <= 0 && game.protect <= 0 &&
                   rowIndex > CFG.OBSTACLE_MIN_ROW &&
                   Math.random() < CFG.OBSTACLE_CHANCE * game.speedMul;
  if (canPlace) {
    /* 障碍成"组"出现：一排连着 2~3 个，贴着车道边缘交错摆放，
       中间留一条斜着能穿过去的缝（保持"斜着过"的手感） */
    const size = Math.min(CFG.LANE_COUNT - 1, 2 + ((Math.random() * 2) | 0));  // 2 或 3 个
    const a = (Math.random() * (CFG.LANE_COUNT - size + 1)) | 0;
    const base = (rowIndex % 2 === 0) ? -1 : 1;          // 每一排左右翻转，形成穿插节奏
    for (let i = 0; i < size; i++) {
      const side = (i % 2 === 0) ? base : -base;         // 组内再交错，逼玩家斜着走位
      spawnObstacle(a + i, z, side);
      occupied.push(a + i);
    }
    lastFreeLanes = ALL_LANES.slice();                   // 每条道都还留着大半边，过得去
    obstacleGap = CFG.OBSTACLE_GAP;
  } else if (obstacleGap > 0) obstacleGap--;
  if (hole) lastFreeLanes = ALL_LANES.filter(l => !skipLanes.has(l));

  if (!isSafeRow && occupied.length < dangerMax && Math.random() < CFG.COIN_CHANCE) {
    const free = ALL_LANES.filter(l => !occupied.includes(l));
    if (free.length) {
      const lane = free[(Math.random() * free.length) | 0];
      const chain = Math.random() < CFG.COIN_CHAIN_RATE ? 3 : 1;
      for (let k = 0; k < chain; k++) spawnCoin(lane, z - k * CFG.TILE_SIZE);
    }
  }
}


/* ==================================================================
 * 【模块 12】碰撞检测
 * ================================================================== */
const P_HALF = CFG.PLAYER_RADIUS * CFG.HIT_SCALE;
const OB_HALF_X = CFG.OBSTACLE_W / 2 - CFG.OBSTACLE_FORGIVE;
const OB_HALF_Z = CFG.OBSTACLE_D / 2 - CFG.OBSTACLE_FORGIVE;

function checkObstacleCollision() {
  if (game.state !== STATE.PLAYING) return;
  for (const o of obstacles) {
    if (!o.alive) continue;
    if (game.ballY - CFG.PLAYER_RADIUS > o.h - 0.05) continue;         // 跳过障碍
    if (Math.abs(o.x - game.ballX) < OB_HALF_X + P_HALF &&
        Math.abs(o.z - 0)          < OB_HALF_Z + P_HALF) {
      if (game.boost > 0) { o.alive = false; sfxSmash(); continue; }   // 加速撞碎
      takeDamage(o, o.type === 'pond' ? '踩进水塘' : '撞上障碍');
      break;
    }
  }
}

function checkCoinCollision() {
  if (game.state !== STATE.PLAYING && game.state !== STATE.INTRO) return;
  const reach = CFG.COIN_RADIUS + CFG.PLAYER_RADIUS * 0.9;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.abs(c.x - game.ballX) < reach &&
        Math.abs(c.z - 0)          < reach &&
        Math.abs(c.y - game.ballY) < CFG.PLAYER_RADIUS + 0.9) {
      game.score++;
      coins.splice(i, 1);
      releaseCoin(c);
      sfxCoin();
      if (game.score % CFG.BOLT_PER_SCORE === 0 && game.bolts < CFG.BOLT_MAX) {
        game.bolts++;
        showToast('⚡ 获得加速！', 'bolt');
        sfxBoltReady();
      }
      renderHUD();
    }
  }
}

function laneOfBall() {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < LANE_X.length; i++) {
    const d = Math.abs(LANE_X[i] - game.ballX);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}


/* ==================================================================
 * 【模块 13】主循环
 * ================================================================== */
const clock = new THREE.Clock();
let cameraShake = 0;
let realTime = 0;
let slipSfxAcc = 0;

function updatePlayer(dt, speed) {
  /* 保护罩 */
  if (game.protect > 0) {
    game.protect -= dt;
    if (game.protect <= 0) { game.protect = 0; shieldMesh.visible = false; clearAhead(); }
  }
  if (shieldMesh.visible) {
    shieldMesh.rotation.y += dt * 0.9;
    shieldMesh.scale.setScalar(1 + Math.sin(realTime * 6) * 0.05);
    shieldMesh.material.opacity = 0.22 + Math.sin(realTime * 4) * 0.08;
    const fadeFrom = CFG.PROTECT_VISUAL_LEAD;
    if (game.protect < fadeFrom) {
      const k = Math.max(0, game.protect / fadeFrom);
      shieldMesh.material.opacity *= k;
      shieldMesh.scale.multiplyScalar(0.92 + 0.08 * k);
    }
  }

  /* 加速倒计时 */
  if (game.boost > 0) {
    game.boost -= dt;
    elBoostBar.style.width = Math.max(0, game.boost / CFG.BOOST_TIME * 100) + '%';
    if (game.boost <= 0) endBoost();
  }

  /* 横向控制 */
  input.keyDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const lane = laneOfBall();
  const under = tileUnderBall(lane);
  const hasGround = !!under;
  const onIce = !!(under && under.ice) && VIEW.ice > 0.4;

  if (game.state !== STATE.READY && game.state !== STATE.OVER) {
    let move = 0;
    if (input.keyDir !== 0) {
      input.mode = 'key';
      move = input.keyDir * CFG.KEY_SPEED * dt;
      input.mouseTargetX = game.ballX;
    } else if (input.mode === 'click' && input.clickTarget !== null) {
      const diff = input.clickTarget - game.ballX;
      const step = CFG.DASH_SPEED * dt;
      move = Math.abs(diff) <= step ? diff : Math.sign(diff) * step;
      if (Math.abs(diff) <= step) input.clickTarget = null;
      input.mouseTargetX = game.ballX;
    } else if (input.mode === 'mouse') {
      const k = 1 - Math.exp(-CFG.FOLLOW * dt);
      move = (input.mouseTargetX - game.ballX) * k;
    }
    game.ballX += move;

    /* 冰面打滑：横向惯性更强、摩擦更小，还会轻微飘 */
    if (onIce) {
      game.slipVX += move * CFG.ICE_SLIP * 6;
      game.slipVX *= Math.exp(-1.1 * dt);
      game.ballX += game.slipVX * dt + Math.sin(realTime * 3.1) * CFG.ICE_SLIP * 0.35 * dt;
      slipSfxAcc += dt;
      if (slipSfxAcc > 0.85) { slipSfxAcc = 0; sfxSlip(); }
    } else {
      game.slipVX *= Math.exp(-6 * dt);
    }
    game.ballX = THREE.MathUtils.clamp(game.ballX, P_MIN_X, P_MAX_X);
  }

  if (game.landLock > 0) game.landLock -= dt;

  /* 垂直方向 */
  if (game.state === STATE.INTRO) {
    game.ballVY -= CFG.GRAVITY * dt;
    game.ballY += game.ballVY * dt;
    if (game.ballY <= CFG.PLAYER_RADIUS) {
      game.ballY = CFG.PLAYER_RADIUS;
      if (!hasGround) {
        const near = nearestTileWithin(game.ballX, 3.0);
        if (near) game.ballX = near.x;
      }
      game.ballVY = 0;
      game.grounded = true;
      game.jumpsUsed = 0;
      game.squash = 1;
      game.state = STATE.PLAYING;
      cameraShake = 0.24;
      game.landLock = CFG.LAND_NO_SNAP_TIME;
      grantProtection();
    }
  } else if (game.state === STATE.PLAYING) {
    if (!hasGround && game.grounded) { game.grounded = false; game.coyote = CFG.COYOTE_TIME; }
    if (game.coyote > 0) game.coyote -= dt;

    if (input.jumpPressed) {
      const canFirst = game.grounded || game.coyote > 0;
      const canSecond = !game.grounded && game.jumpsUsed < CFG.MAX_JUMPS;
      if (canFirst || canSecond) {
        game.ballVY = CFG.JUMP_VELOCITY * (canFirst ? 1 : 0.92);
        game.grounded = false;
        game.coyote = 0;
        game.jumpHeld = 0;
        game.squash = 0;
        game.jumpsUsed = canFirst ? 1 : game.jumpsUsed + 1;
        sfxJump(!canFirst);
      }
    }
    input.jumpPressed = false;

    if (!game.grounded) {
      let g = CFG.GRAVITY_JUMP;
      if (input.jump && game.ballVY > 0 && game.jumpHeld < CFG.JUMP_HOLD_MAX) {
        g *= 0.55;
        game.jumpHeld += dt;
      }
      game.ballVY -= g * dt;
      game.ballY += game.ballVY * dt;
      if (game.ballVY <= 0 && game.ballY <= CFG.PLAYER_RADIUS && hasGround) {
        game.ballY = CFG.PLAYER_RADIUS;
        game.ballVY = 0;
        game.grounded = true;
        game.squash = 1;
        game.jumpsUsed = 0;
        game.landLock = CFG.LAND_NO_SNAP_TIME;
        sfxLand();
      }
    }

    if (!hasGround && game.ballY <= CFG.PLAYER_RADIUS + 0.02 && game.ballVY <= 0) {
      if (game.protect > 0) {
        addTile(lane, 0 - game.travel);
        game.ballY = CFG.PLAYER_RADIUS;
        game.ballVY = 0;
        game.grounded = true;
        game.jumpsUsed = 0;
      } else {
        startFalling();
      }
    }

    /* 脚步声：踩在地面上时规律轻响，音量高于 BGM */
    if (game.grounded) {
      game.footAcc += dt;
      if (game.footAcc >= CFG.FOOT_STEP) { game.footAcc = 0; sfxStep(); }
    }
  } else if (game.state === STATE.FALLING) {
    game.ballVY -= CFG.GRAVITY * 0.9 * dt;
    game.ballY += game.ballVY * dt;
  }

  /* 坑沿吸附 */
  if (game.state === STATE.PLAYING && !hasGround && game.ballVY <= 0 && game.landLock <= 0) {
    const near = nearestTileWithin(game.ballX, 0.9);
    if (near && Math.abs(near.x - game.ballX) < CFG.PLAYER_RADIUS * 0.55) {
      game.ballX += (near.x - game.ballX) * 0.5;
    }
  }

  /* 挤压回弹 */
  if (game.squash > 0) game.squash = Math.max(0, game.squash - dt * 3.6);
  const sq = Math.sin(game.squash * Math.PI) * 0.32;
  playerGroup.scale.set(1 + sq * 0.7, 1 - sq, 1 + sq * 0.7);

  /* 位置与小熊动画：跑步上下颠 + 转向侧倾 + 空中翻滚 */
  playerGroup.position.set(game.ballX, game.ballY, 0);
  const bob = game.grounded ? Math.sin(realTime * 12) * 0.045 : 0;
  bearHolder.position.y = bob;
  bearHolder.rotation.z += ((-input.keyDir * 0.22) - bearHolder.rotation.z) * Math.min(1, dt * 8);
  if (game.grounded) {
    bearHolder.rotation.x += ((0.06 + Math.sin(realTime * 12) * 0.05) - bearHolder.rotation.x) * Math.min(1, dt * 8);
    bearHolder.rotation.y += ((game.slipVX * 0.6) - bearHolder.rotation.y) * Math.min(1, dt * 8);
  } else {
    bearHolder.rotation.x -= dt * 5.5;
  }

  /* 加速时头顶闪电旋转 */
  if (game.boost > 0) {
    boltMesh.visible = true;
    boltMesh.position.set(0, CFG.PLAYER_RADIUS + 1.15, 0);
    boltMesh.rotation.y += dt * 6;
    boltMesh.position.y += Math.sin(realTime * 8) * 0.04;
  } else {
    boltMesh.visible = false;
  }

  /* 假阴影 */
  blobShadow.position.set(game.ballX, 0.02, 0);
  const h = Math.max(0, game.ballY - CFG.PLAYER_RADIUS);
  blobShadow.scale.setScalar(1 + h * 0.12);
  blobShadow.material.opacity = hasGround ? 0.20 / (1 + h * 0.55) : 0;

  /* 无敌闪烁 */
  if (game.invincible > 0) {
    game.invincible -= dt;
    game.blink += dt;
    const vis = Math.floor(game.blink * 14) % 2 === 0;
    bearHolder.visible = vis;
    if (game.invincible <= 0) { game.invincible = 0; bearHolder.visible = true; }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = rawDt * (game.timeScale || 1);
  realTime += rawDt;

  if (game.state === STATE.COUNTDOWN) {
    game.countdown -= rawDt;
    const n = Math.ceil(game.countdown);
    if (n > 0 && n !== game._lastCount) { game._lastCount = n; showCountdown(n); }
    if (game.countdown <= 0) {
      showCountdown(0);
      game.state = STATE.INTRO;
      game.ballVY = 0;
      document.body.classList.remove('show-cursor');
    }
  }

  const running = (game.state === STATE.INTRO || game.state === STATE.PLAYING);

  /* 速度曲线 */
  if (game.state === STATE.PLAYING) {
    game.elapsed += dt;
    const base = Math.min(CFG.MAX_SPEED, CFG.BASE_SPEED + game.elapsed * CFG.SPEED_GROWTH);
    game.speed = Math.min(CFG.MAX_SPEED_ABS, base * game.speedMul);
    updateSpeedBar();
  }

  const boostMul = game.boost > 0 ? CFG.BOOST_SPEED_MUL : 1;
  const speed = running ? game.speed * boostMul : 0;
  const dz = speed * dt;

  /* 季节推进（只在游戏中推进） */
  if (running) updateSeason(dt);   // 季节推进：以金币为节奏，过渡限速、慢慢变
  updateSeasonBlend();
  skyDrawAcc += rawDt;
  if (skyDrawAcc > 0.15) applySeasonVisual(skyDrawAcc);
  updateSeasonTag();

  if (running) {
    game.travel += dz;
    updateTiles(dt);
    updateObstacles(dt, realTime);
    updateCoins(dt);
    groundTex.offset.y += dz * GRID_SCROLL_PER_UNIT;
    updateParticles(dt, dz, realTime);
    updateProps(dz);
    updateShadowBlobs(dz);

    let guard = 0;
    while (game.travel >= nextRowTravel && guard++ < 12) {
      nextRowTravel += CFG.TILE_SIZE;
      rowSpawned++;
      spawnRow(+(ROW_START - rowSpawned * CFG.TILE_SIZE).toFixed(3));
    }

    for (const c of clouds) {
      c.position.z += dz * 0.55;
      c.position.x += Math.sin(game.elapsed * 0.3 + c.position.z) * dt * 1.2;
      if (c.position.z > 30) {
        c.position.z = -110 - Math.random() * 40;
        c.position.x = (Math.random() - 0.5) * 46;
      }
    }

    checkObstacleCollision();
    checkCoinCollision();
  }

  if (game.state !== STATE.OVER && game.state !== STATE.READY) updatePlayer(dt, speed);

  /* 相机：跟随 + 加速时视野变宽 */
  const hMax = Math.max(0, game.ballY - CFG.PLAYER_RADIUS);
  const hN = Math.min(hMax / 3.2, 1);
  const targetFov = game.boost > 0 ? CFG.BOOST_FOV : CAM_FOV_BASE;
  if (Math.abs(camera.fov - targetFov) > 0.1) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, rawDt * 4);
    camera.updateProjectionMatrix();
  }
  camera.position.x += (game.ballX * 0.42 - camera.position.x) * (1 - Math.exp(-6 * dt));
  camera.position.y = 4.1 + hN * 1.5;
  camera.position.z = 8.2 + hN * 0.6;
  camera.lookAt(game.ballX * 0.42, 0.9 + hN * 1.1, -6);

  if (cameraShake > 0) {
    cameraShake = Math.max(0, cameraShake - dt * 1.2);
    camera.position.x += (Math.random() - 0.5) * cameraShake;
    camera.position.y += (Math.random() - 0.5) * cameraShake * 0.6;
  }

  renderer.render(scene, camera);
}


/* ==================================================================
 * 【模块 14】声音：四季 BGM + 音效（WebAudio 实时合成，无需音频文件）
 *  - 四季切换时，BPM / 音色 / 鼓点强度全部插值，做到平滑淡入淡出
 *  - 全年保留稳定鼓点，给玩家节奏参考
 *  - BGM 音量低于音效，保证碰撞 / 金币 / 道具提示听得见
 * ================================================================== */
const AudioSys = (function () {
  let ctx = null, musicGain = null, sfxGain = null, timer = null;
  let step = 0, bgmOn = CFG.MUSIC_ON;

  /* 五声音阶（明快不刺耳），root 随季节移动 */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const MELODY = [0, 4, 2, 5, 4, 2, 0, 3, 5, 4, 2, 0, 4, 5, 7, 5];

  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    musicGain = ctx.createGain();
    musicGain.gain.value = bgmOn ? CFG.MUSIC_VOLUME : 0;
    musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = CFG.SFX_ON ? CFG.SFX_VOLUME : 0;
    sfxGain.connect(ctx.destination);
    return true;
  }

  function tone({ freq, dur = 0.18, type = 'triangle', gain = 0.25, slideTo = null, bus = 'sfx', delay = 0, detune = 0 }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    if (detune) osc.detune.value = detune;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus === 'music' ? musicGain : sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** 鼓：低频 sine 下滑 + 一点噪声感，四季都保留 */
  function drum(gain, bright) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + bright * 60, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.09);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    osc.connect(g); g.connect(musicGain);
    osc.start(t0); osc.stop(t0 + 0.13);

    /* 高频"哒"，让节拍更清晰 */
    const o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = 'square';
    o2.frequency.setValueAtTime(1800, t0);
    g2.gain.setValueAtTime(gain * 0.25, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
    o2.connect(g2); g2.connect(musicGain);
    o2.start(t0); o2.stop(t0 + 0.05);
  }

  /** 一个音乐步进：旋律 + 贝斯 + 鼓 + 季节特色音色 */
  function scheduleStep() {
    if (!ctx) return;
    const m = VIEW.music;
    const beat = 60 / m.bpm / 2;                 // 八分音符
    const n = step % MELODY.length;
    const deg = MELODY[n];

    /* 主旋律 */
    tone({
      freq: midiToFreq(m.root + 12 + SCALE[deg % SCALE.length]),
      dur: beat * 1.4, type: m.lead, gain: m.leadGain, bus: 'music'
    });
    /* 夏季加入一点锯齿亮音，更有活力 */
    if (m.saw > 0.3 && n % 2 === 0) {
      tone({
        freq: midiToFreq(m.root + 24 + SCALE[(deg + 2) % SCALE.length]),
        dur: beat * 0.9, type: 'sawtooth', gain: m.leadGain * m.saw * 0.5, bus: 'music', detune: 6
      });
    }
    /* 春季木笛点缀：正弦 + 微微颤音 */
    if (m.flute > 0.5 && n % 8 === 4) {
      tone({ freq: midiToFreq(m.root + 24 + SCALE[(deg + 4) % SCALE.length]), dur: beat * 2.2, type: 'sine', gain: 0.06 * m.flute, bus: 'music' });
      tone({ freq: midiToFreq(m.root + 24 + SCALE[(deg + 4) % SCALE.length]) * 1.005, dur: beat * 2.0, type: 'sine', gain: 0.035 * m.flute, bus: 'music', delay: 0.02 });
    }
    /* 铺底和弦（秋/冬更厚，夏更薄） */
    if (n % 8 === 0) {
      [0, 4, 7].forEach((c, i) => tone({
        freq: midiToFreq(m.root - 12 + c), dur: beat * 6.5,
        type: 'sine', gain: m.pad * 0.5, bus: 'music', delay: i * 0.015
      }));
    }
    /* 稳定鼓点：四季都有，强弱随季节变化 */
    if (n % 2 === 0) drum(m.drum, m.saw);
    if (n % 8 === 4 && m.drum > 0.06) drum(m.drum * 0.7, m.saw);

    step++;
    /* 用递归 setTimeout：BPM 随季节平滑变化时，间隔也会跟着平滑变化 */
    timer = setTimeout(scheduleStep, beat * 1000);
  }

  return {
    start() {
      if (!ensure()) return;
      if (!timer && bgmOn) { scheduleStep(); }
    },
    toggleMusic(on) {
      bgmOn = on;
      if (!ctx) return;
      musicGain.gain.value = on ? CFG.MUSIC_VOLUME : 0;
      if (on && !timer) scheduleStep();
      if (!on && timer) { clearTimeout(timer); timer = null; }
    },
    get musicOn() { return bgmOn; },

    jump(double) {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: double ? 620 : 440, dur: 0.16, type: 'sine', gain: 0.22, slideTo: double ? 1100 : 780 });
    },
    land() { if (!ensure() || !CFG.SFX_ON) return; tone({ freq: 180, dur: 0.1, type: 'sine', gain: 0.14, slideTo: 90 }); },
    step() { if (!ensure() || !CFG.SFX_ON) return; tone({ freq: 120, dur: 0.06, type: 'sine', gain: 0.09, slideTo: 70 }); },
    coin() {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: 988, dur: 0.07, type: 'sine', gain: 0.18 });
      tone({ freq: 1319, dur: 0.12, type: 'sine', gain: 0.16, delay: 0.06 });
    },
    hurt() { if (!ensure() || !CFG.SFX_ON) return; tone({ freq: 300, dur: 0.24, type: 'square', gain: 0.10, slideTo: 90 }); },
    over() {
      if (!ensure() || !CFG.SFX_ON) return;
      [523, 440, 349, 262].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.14, delay: i * 0.14 }));
    },
    boltReady() {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: 660, dur: 0.1, type: 'square', gain: 0.12 });
      tone({ freq: 990, dur: 0.14, type: 'square', gain: 0.10, delay: 0.08 });
    },
    bolt() {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: 300, dur: 0.35, type: 'sawtooth', gain: 0.16, slideTo: 1600 });
      tone({ freq: 1200, dur: 0.2, type: 'square', gain: 0.10, delay: 0.05 });
    },
    smash() {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: 520, dur: 0.12, type: 'square', gain: 0.12, slideTo: 180 });
    },
    slip() {
      if (!ensure() || !CFG.SFX_ON) return;
      tone({ freq: 1500, dur: 0.09, type: 'sine', gain: 0.10, slideTo: 700 });   // 冰面短促提示音
    }
  };
})();

const sfxJump  = (d) => AudioSys.jump(d);
const sfxLand  = () => AudioSys.land();
const sfxStep  = () => AudioSys.step();
const sfxCoin  = () => AudioSys.coin();
const sfxHurt  = () => AudioSys.hurt();
const sfxOver  = () => AudioSys.over();
const sfxBoltReady = () => AudioSys.boltReady();
const sfxBolt  = () => AudioSys.bolt();
const sfxSmash = () => AudioSys.smash();
const sfxSlip  = () => AudioSys.slip();

['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, () => AudioSys.start(), { once: true }));


/* ==================================================================
 * 【模块 15】窗口自适应与启动
 * ================================================================== */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (window.matchMedia('(pointer: coarse)').matches) {
  document.getElementById('touchHint').style.display = 'block';
}

buildInitialWorld();
updateSeasonBlend();
applySeasonVisual(0);
renderHUD();
showStartCard();
animate();
