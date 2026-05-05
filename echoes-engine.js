/* ═══════════════════════════════════════════════════
   ECHOES — ENGINE.JS  Core game loop & rendering
═══════════════════════════════════════════════════ */
'use strict';

/* ── Canvas ── */
const gc = document.getElementById('gc');
const ctx = gc.getContext('2d');
const mmC = document.getElementById('mm');
const mctx = mmC.getContext('2d');
let W, H;
const resize = () => { W = gc.width = window.innerWidth; H = gc.height = window.innerHeight; };
resize(); window.addEventListener('resize', resize);

/* ── Input ── */
const keys = {}, mouse = { x: W / 2, y: H / 2, down: false };
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup',   e => delete keys[e.code]);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; rez(); });
window.addEventListener('mouseup',   e => { if (e.button === 0) mouse.down = false; });
window.addEventListener('contextmenu', e => e.preventDefault());

/* ── Helpers ── */
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dst = (ax, ay, bx, by) => Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
const shuffle = a => a.slice().sort(() => Math.random() - 0.5);
const droneColor = t => ({ chase:'#ff6b8a', shoot:'#ffd600', bomb:'#ff6d00', orbit:'#c770ff', sniper:'#d040fb', tank:'#2979ff', stealth:'#00e676', elite:'#f472b6' }[t] || '#e2e8f0');
const lootColor  = t => ({ hp:'#00e676', sh:'#c770ff', coin:'#ffd600', ammo:'#2979ff' }[t] || '#fff');
const lootLabel  = t => ({ hp:'HP', sh:'SH', coin:'⬡', ammo:'AMO' }[t] || '?');
const coinM = () => SAVE.owned.includes('pu_coin') ? 1.3 : 1;
const xpM   = () => SAVE.owned.includes('pu_xp') ? 1.35 : 1;

/* ── Particle FX ── */
let particles = [], rings = [];
const puff = (x, y, n, col) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 44 + Math.random() * 112;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: col, l: 0.75 + Math.random() * 0.5, r: 1.5 + Math.random() * 2.5 });
  }
};

/* ── Arena ── */
const PAD = 62;
let AR = {};
const buildArena = () => { AR = { x: PAD, y: PAD + 60, w: W - PAD * 2, h: H - PAD * 2 - 60 }; };

/* ── Stars ── */
let stars = [];
const makeStars = () => { stars = []; for (let i = 0; i < 520; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: 0.2 + Math.random() * 1.7, t: Math.random() * Math.PI * 2, s: 0.006 + Math.random() * 0.012 }); };

/* ═══════════════════════════════════════════════════
   GAME STATE
═══════════════════════════════════════════════════ */
let P, ECHO, BOSS;
let bullets = [], ebullets = [], drones = [], loot = [];
const echoRec = [];
let gLevel = 1, score = 0, kills = 0, maxCombo = 0, combo = 0, comboT = 0;
let between = false, gameRunning = false, ultCharge = 0;
let activeUpgrades = [], sessionCoins = 0, sessionXP = 0;
let reloading = false, rlTimer = 0, curWpn, wData;
let frame = 0, lastT = 0;

/* ═══════════════ PLAYER FACTORY ═══════════════ */
function makePlayer() {
  const ch = CHARS[SAVE.equippedChar] || CHARS.ghost;
  const bon = lvBonus(SAVE.lv);
  const pm = PM();
  const hasPU = id => SAVE.permUpgrades.includes(id) || SAVE.owned.includes(id);

  const p = {
    x: AR.x + AR.w * 0.28, y: AR.y + AR.h / 2,
    vx: 0, vy: 0, r: 14, alive: true,
    hp: ch.stats.hp + bon.hp + pm.hp,
    maxHp: ch.stats.hp + bon.hp + pm.hp,
    sh: ch.stats.sh + bon.sh + (hasPU('pu_sh') ? 55 : 0),
    maxSh: ch.stats.sh + bon.sh + (hasPU('pu_sh') ? 55 : 0),
    speed: ch.stats.spd * 2.25 * bon.spd * pm.spd,
    dmg: 15 * bon.dmg * pm.dmg, frMult: 1,
    invince: 0, face: { x: 1, y: 0 },
    dashCd: hasPU('pu_dash2') ? 2.5 : 5,
    dashMax: hasPU('pu_dash2') ? 2 : 1,
    dashCur: hasPU('pu_dash2') ? 2 : 1,
    dashRech: 0, blinkCd: 8, blinkRange: 180, waveCd: 10,
    ab: { dash: 0, wave: 0, blink: 0 },
    lastShot: 0,
    // Upgrades
    pierce: false, explosive: false, homing: false, critLow: false,
    twin: false, barrage: false, barCount: 0,
    vampire: hasPU('pu_vampire_p'), aura: false, auraT: 0,
    shRegen: hasPU('pu_nanite'), shRegenRate: hasPU('pu_nanite') ? 3 : 0, shRegenT: 0,
    hpRegen: hasPU('pu_nanite'), hpRegenRate: hasPU('pu_nanite') ? 2.5 : 0,
    thorns: hasPU('pu_thorns_p'), lastStand: false, counterEcho: false, ultUpg: false,
    hasRevive: hasPU('pu_revive'), usedRevive: false,
    // Char passives
    invinceDash: 0.22, dashDecoy: false,
    slipstream: false, slipCnt: 0, slipT: 0,
    fortress: false, killCdR: 0,
    streakBoost: false, novaUlt: false,
    quantum: false, qCount: 0, blinkRift: false,
    charId: ch.id, skinId: SAVE.equippedSkin,
    trail: [],
    getColor: () => skinColor(SAVE.equippedSkin, ch.color, frame),
  };

  // Apply char passive
  if (ch.id === 'ghost')      { p.invinceDash = 0.6; p.dashDecoy = true; }
  if (ch.id === 'blade')      { p.slipstream = true; }
  if (ch.id === 'titan')      { p.fortress = true; p.shRegen = true; p.shRegenRate = Math.max(p.shRegenRate, 6); }
  if (ch.id === 'wraith')     { p.killCdR = 0.6; p.blinkRange += 80; }
  if (ch.id === 'nova')       { p.streakBoost = true; p.novaUlt = true; }
  if (ch.id === 'voidwalker') { p.quantum = true; p.qCount = 0; p.blinkRift = true; p.dmg *= 1.2; p.speed *= 1.2; }

  // Perm upgrades
  SAVE.permUpgrades.forEach(uid => { const u = UPGRADES.find(x => x.id === uid); if (u) u.fn(p); });
  return p;
}

/* ═══════════════ ECHO FACTORY ═══════════════ */
function makeEcho(lv) {
  return {
    x: AR.x + AR.w * 0.72, y: AR.y + AR.h / 2,
    vx: 0, vy: 0, r: 14,
    hp: 170 + lv.n * 32, maxHp: 170 + lv.n * 32,
    alive: true, pi: 0, pt: 0, adapt: lv.echoAdapt || 0.3,
    lastShot: 0, flare: 0, slowT: 0, slowM: 1,
  };
}

/* ═══════════════ BOSS FACTORY ═══════════════ */
function makeBoss(lv) {
  const bd = lv.boss, fin = bd.isFinal;
  return {
    x: AR.x + AR.w / 2, y: AR.y + AR.h * 0.3,
    vx: 0, vy: 0, r: 34 + (lv.n * 0.6) | 0,
    hp: bd.hp, maxHp: bd.hp, alive: true,
    name: bd.name, phases: bd.phases, phase: 0, triggered: [],
    shHp: bd.hp * 0.18, maxShHp: bd.hp * 0.18, shielded: true,
    orbitA: 0, patT: 0, pat: 'orbit',
    shootT: 0, chargeDir: { x: 0, y: 0 }, charging: false, chargeT: 0,
    flare: 0, slowT: 0, slowM: 1,
    shootCd: fin ? 0.2 : lv.n >= 15 ? 0.3 : lv.n >= 10 ? 0.48 : 0.7,
    bDmg: fin ? 34 : lv.n >= 15 ? 27 : lv.n >= 10 ? 21 : 14,
    spreadN: fin ? 13 : lv.n >= 15 ? 10 : lv.n >= 10 ? 7 : 4,
    ringN: fin ? 22 : lv.n >= 15 ? 16 : 14,
    bspd: 310 + lv.n * 6,
    speed: 58 + lv.n * 5, isFinal: fin,
  };
}

/* ═══════════════ DRONES ═══════════════ */
function droneStatFor(type, n) {
  const s = { r: 11, hp: 32 + n * 9, spd: 45 + n * 7, sCd: 1.6 };
  if (type === 'sniper')  { s.r = 8;  s.hp = 25 + n * 6;  s.spd = 24 + n * 5;  s.sCd = 2.5; }
  if (type === 'bomb')    { s.r = 13; s.hp = 20 + n * 5;  s.spd = 56 + n * 8; }
  if (type === 'tank')    { s.r = 17; s.hp = 90 + n * 22; s.spd = 24 + n * 4;  s.tankSh = 75 + n * 8; }
  if (type === 'stealth') { s.r = 10; s.hp = 22 + n * 6;  s.spd = 60 + n * 9; }
  if (type === 'elite')   { s.r = 14; s.hp = 68 + n * 16; s.spd = 65 + n * 10; s.sCd = 0.95; }
  if (type === 'orbit')   { s.r = 11; s.hp = 30 + n * 8;  s.spd = 42 + n * 6;  s.oDist = 82 + Math.random() * 55; }
  return s;
}
function spawnDrones(lv) {
  drones = []; if (!lv.pool || !lv.pool.length) return;
  for (let i = 0; i < lv.drones; i++) {
    const side = i % 4;
    let x, y;
    if (side === 0) { x = AR.x + Math.random() * AR.w; y = AR.y + 8; }
    else if (side === 1) { x = AR.x + AR.w - 8; y = AR.y + Math.random() * AR.h; }
    else if (side === 2) { x = AR.x + Math.random() * AR.w; y = AR.y + AR.h - 8; }
    else { x = AR.x + 8; y = AR.y + Math.random() * AR.h; }
    const type = lv.pool[Math.floor(Math.random() * lv.pool.length)];
    const s = droneStatFor(type, lv.n);
    drones.push({
      x, y, vx: 0, vy: 0, r: s.r, hp: s.hp, maxHp: s.hp, speed: s.spd, alive: true,
      type, flare: 0, sCd: s.sCd || 1.5, sT: (s.sCd || 1.5) + Math.random() * 1.5,
      oA: Math.random() * Math.PI * 2, oDist: s.oDist || 80,
      slowM: 1, slowT: 0, cloaked: false, cloakT: type === 'stealth' ? 3 : 0,
      tankSh: s.tankSh || 0,
    });
  }
}
function spawnLoot(n) {
  loot = [];
  const types = ['hp', 'sh', 'coin', 'ammo', 'coin', 'coin']; // coins more common
  const cnt = 3 + Math.floor(n / 3);
  for (let i = 0; i < cnt; i++) loot.push({
    x: AR.x + 60 + Math.random() * (AR.w - 120),
    y: AR.y + 60 + Math.random() * (AR.h - 120),
    type: types[Math.floor(Math.random() * types.length)],
    alive: true, pulse: 0, life: 25,
  });
}

/* ═══════════════ MAIN LOOP ═══════════════ */
function gameLoop(ts) {
  if (!gameRunning) return;
  const dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts; frame++;
  if (!between) { update(dt); render(); }
  updateHUD();
  requestAnimationFrame(gameLoop);
}

/* ═══════════════ UPDATE ═══════════════ */
function update(dt) {
  const p = P; if (!p || !p.alive) return;
  const lv = LEVELS[gLevel - 1];

  // Record for Echo
  if (lv.echoAdapt && ECHO) {
    echoRec.push({ dx: (keys.KeyA||keys.ArrowLeft)?-1:(keys.KeyD||keys.ArrowRight)?1:0, dy: (keys.KeyW||keys.ArrowUp)?-1:(keys.KeyS||keys.ArrowDown)?1:0, mx: mouse.x, my: mouse.y, shoot: mouse.down, blink: !!keys.KeyF, px: p.x, py: p.y });
  }

  // Movement
  let dx = (keys.KeyA||keys.ArrowLeft)?-1:(keys.KeyD||keys.ArrowRight)?1:0;
  let dy = (keys.KeyW||keys.ArrowUp)?-1:(keys.KeyS||keys.ArrowDown)?1:0;
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  let spd = p.speed;
  if (p.slipstream && p.slipT > 0) { spd *= (1 + p.slipCnt * 0.08); p.slipT -= dt; if (p.slipT <= 0) p.slipCnt = 0; }
  p.vx += (dx * spd - p.vx) * dt * 12; p.vy += (dy * spd - p.vy) * dt * 12;
  p.x = clamp(p.x + p.vx * dt, AR.x + p.r, AR.x + AR.w - p.r);
  p.y = clamp(p.y + p.vy * dt, AR.y + p.r, AR.y + AR.h - p.r);

  // Aim
  const fx = mouse.x - p.x, fy = mouse.y - p.y, fl = Math.sqrt(fx * fx + fy * fy) || 1;
  p.face = { x: fx / fl, y: fy / fl };

  // Trail
  p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 28) p.trail.pop();

  // Regen
  if (p.hpRegen) p.hp = Math.min(p.maxHp, p.hp + (p.hpRegenRate || 3) * dt);
  if (p.shRegen) { p.shRegenT -= dt; if (p.shRegenT <= 0) { p.shRegenT = 0.5; p.sh = Math.min(p.maxSh, p.sh + (p.shRegenRate || 3)); } }
  if (p.aura) { p.auraT -= dt; if (p.auraT <= 0) { p.auraT = 3; rings.push({ x: p.x, y: p.y, r: 8, maxR: 225, l: 1, col: 'rgba(199,112,255,0.6)' }); drones.forEach(e => { if (!e.alive) return; if (dst(p.x, p.y, e.x, e.y) < 225) { e.slowM = 0.44; e.slowT = 2.5; } }); } }
  if (p.invince > 0) p.invince -= dt;
  if (p.decoyT > 0) { p.decoyT -= dt; if (p.decoyT <= 0) p.decoyPos = null; }

  // Ability cooldowns
  ['dash', 'wave', 'blink'].forEach(k => { if (p.ab[k] > 0) p.ab[k] = Math.max(0, p.ab[k] - dt); });
  if (p.dashCur < p.dashMax) { p.dashRech += dt; if (p.dashRech >= p.dashCd) { p.dashRech = 0; p.dashCur++; } }

  // Reload
  if (reloading) { rlTimer -= dt; if (rlTimer <= 0) { const need = wData.maxAmmo - curWpn.ammo, got = Math.min(need, curWpn.res); curWpn.ammo += got; curWpn.res -= got; reloading = false; } }

  // Shooting
  if (mouse.down && !reloading) {
    const now = performance.now(), fr2 = wData.fr * (p.frMult || 1);
    if (now - p.lastShot > fr2 && curWpn.ammo > 0) {
      p.lastShot = now;
      if (p.barrage) { p.barCount++; if (p.barCount % 5 === 0) { const ba = Math.atan2(p.face.y, p.face.x); for (let i = 0; i < 8; i++) { const a = ba + (i / 8) * Math.PI * 2; spawnBullet(p, Math.cos(a) * wData.bspd * 0.88, Math.sin(a) * wData.bspd * 0.88); } playSFX(wData.sfx); } else { fireBullet(p); } }
      else fireBullet(p);
      if (p.quantum) { p.qCount++; if (p.qCount % 8 === 0) { const qb = mkBullet(p, p.face.x * wData.bspd, p.face.y * wData.bspd); qb.pierce = true; qb.pierceCnt = 99; qb.col = '#f472b6'; qb.r = 8; bullets.push(qb); } }
      curWpn.ammo--;
      ultCharge = Math.min(1, ultCharge + (p.novaUlt ? 0.07 : SAVE.owned.includes('pu_ult') ? 0.07 : 0.045));
      // Auto reload when empty
      if (curWpn.ammo === 0 && curWpn.res > 0) doReload();
    }
  }

  // Entities
  drones.forEach(e => tickDrone(e, dt, p));
  if (ECHO && ECHO.alive) tickEcho(dt, p);
  if (BOSS && BOSS.alive) tickBoss(dt, p);

  // Bullets
  tickBullets(dt, p);

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i]; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.84; pt.vy *= 0.84; pt.l -= dt * 1.6;
    if (pt.l <= 0) particles.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.r += 165 * dt; r.l -= dt * 1.7; if (r.l <= 0) rings.splice(i, 1);
  }

  // Loot pickup
  loot.forEach(lt => {
    if (!lt.alive) return; lt.pulse = (lt.pulse + dt * 22) % 32; lt.life -= dt;
    if (lt.life <= 0) { lt.alive = false; return; }
    if (dst(p.x, p.y, lt.x, lt.y) < p.r + 20) {
      lt.alive = false; playSFX('pickup');
      const pm = PM(), cm = coinM();
      if (lt.type === 'hp')    { p.hp = Math.min(p.maxHp, p.hp + 48);   floatText(lt.x, lt.y, '+48 HP', '#00e676'); }
      if (lt.type === 'sh')    { p.sh = Math.min(p.maxSh, p.sh + 58);   floatText(lt.x, lt.y, '+58 SH', '#c770ff'); }
      if (lt.type === 'coin')  { const n = Math.round((45 + gLevel * 12) * pm.coins * cm); addCoins(n); playSFX('coin'); floatText(lt.x, lt.y, '⬡+' + n, '#ffd600'); }
      if (lt.type === 'ammo')  { curWpn.res = Math.min(wData.res, curWpn.res + wData.maxAmmo * 3); floatText(lt.x, lt.y, 'AMMO+', '#2979ff'); }
      puff(lt.x, lt.y, 8, lootColor(lt.type));
    }
  });

  // Combo decay
  if (combo > 0) { comboT -= dt; if (comboT <= 0) { combo = 0; $('cn').style.opacity = '0'; $('cl').style.opacity = '0'; } }
  checkLvEnd();
}

/* ═══════════════ BULLET HELPERS ═══════════════ */
function mkBullet(p, vx, vy) {
  return { x: p.x, y: p.y, vx, vy, alive: true, r: wData.bs, dmg: p.dmg, col: wData.bc, pierce: false, pierceCnt: 0, plasma: false, laser: false, voidSlash: false, l: 1 };
}
function spawnBullet(p, vx, vy) {
  const b = mkBullet(p, vx, vy);
  bullets.push(b);
  if (p.twin) { const sn = 0.1 * (Math.random() > 0.5 ? 1 : -1), cv = Math.cos(sn), sv = Math.sin(sn); bullets.push(Object.assign({}, b, { vx: vx * cv - vy * sv, vy: vx * sv + vy * cv })); }
}
function fireBullet(p) {
  const ax = mouse.x - p.x, ay = mouse.y - p.y, al = Math.sqrt(ax * ax + ay * ay) || 1;
  const bspd = wData.bspd, sp = wData.spread || 0;
  playSFX(wData.sfx);
  if (wData.pellets > 1) {
    const ba = Math.atan2(ay, ax);
    for (let i = 0; i < wData.pellets; i++) { const a = ba + (Math.random() - 0.5) * sp * 2; spawnBullet(p, Math.cos(a) * bspd, Math.sin(a) * bspd); }
  } else {
    const a = Math.atan2(ay, ax) + (Math.random() - 0.5) * sp * 2;
    const b = mkBullet(p, Math.cos(a) * bspd, Math.sin(a) * bspd);
    if (wData.isLaser)  { b.laser = true; b.l = 0.12; }
    if (wData.isPlasma) { b.plasma = true; }
    if (wData.isPierce) { b.voidSlash = true; b.pierce = true; b.pierceCnt = 99; }
    if (p.twin) { const sn = 0.1 * (Math.random() > 0.5 ? 1 : -1), cv = Math.cos(sn), sv = Math.sin(sn); bullets.push(Object.assign({}, b, { vx: b.vx * cv - b.vy * sv, vy: b.vx * sv + b.vy * cv })); }
    bullets.push(b);
  }
  puff(p.x + p.face.x * p.r, p.y + p.face.y * p.r, 3, wData.bc);
}

function tickBullets(dt, p) {
  // Player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (!b.alive) { bullets.splice(i, 1); continue; }
    if (p.homing && !b.laser) {
      let cl3 = null, cd3 = 150 * 150;
      [...drones.filter(d => d.alive && !d.cloaked), ...(ECHO && ECHO.alive ? [ECHO] : []), ...(BOSS && BOSS.alive && !BOSS.shielded ? [BOSS] : [])].forEach(e => { const d3 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2; if (d3 < cd3) { cd3 = d3; cl3 = e; } });
      if (cl3) { const bx = cl3.x - b.x, by = cl3.y - b.y, bl = Math.sqrt(bx * bx + by * by) || 1; b.vx += (bx / bl * 720 - b.vx) * dt * 3.8; b.vy += (by / bl * 720 - b.vy) * dt * 3.8; }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.laser) b.l -= dt;
    if (b.x < AR.x || b.x > AR.x + AR.w || b.y < AR.y || b.y > AR.y + AR.h || b.l <= 0) { b.alive = false; continue; }

    const targets = [...drones.filter(d => d.alive && !d.cloaked), ...(ECHO && ECHO.alive ? [ECHO] : []), ...(BOSS && BOSS.alive && !BOSS.shielded ? [BOSS] : [])];
    for (const t of targets) {
      if (dst(b.x, b.y, t.x, t.y) < b.r + t.r) {
        let dmg = b.dmg;
        if (p.critLow && t.hp < t.maxHp * 0.3) { dmg *= 2; playSFX('crit'); }
        if (p.streakBoost && combo >= 5) dmg *= 1.45;
        if (t.tankSh > 0) { const sd = Math.min(t.tankSh, dmg); t.tankSh -= sd; dmg -= sd; }
        t.hp -= dmg; t.flare = 1;
        if (p.vampire) p.hp = Math.min(p.maxHp, p.hp + 3);
        t === BOSS ? playSFX('bossHit') : playSFX('hit');
        puff(b.x, b.y, 4, b.col);
        if (b.plasma || p.explosive) doAoe(b.x, b.y, 58, dmg * 0.65);
        if (t.hp <= 0) { if (t === ECHO) killEcho(); else if (t !== BOSS) killDrone(t); }
        if (!b.pierce && !b.voidSlash) { b.alive = false; break; }
        b.pierceCnt++; if (b.pierceCnt >= (b.voidSlash ? 99 : 3)) { b.alive = false; break; }
      }
    }
    // Boss shield
    if (b.alive && BOSS && BOSS.alive && BOSS.shielded && dst(b.x, b.y, BOSS.x, BOSS.y) < b.r + BOSS.r) {
      b.alive = false; BOSS.shHp -= b.dmg; puff(b.x, b.y, 4, '#2979ff');
    }
  }

  // Enemy bullets
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    if (!b.alive) { ebullets.splice(i, 1); continue; }
    if (b.homing) { const dpx = p.x - b.x, dpy = p.y - b.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1; b.vx += (dpx / dpd * 400 - b.vx) * dt * 2.8; b.vy += (dpy / dpd * 400 - b.vy) * dt * 2.8; }
    else { b.x += b.vx * dt; b.y += b.vy * dt; }
    if (b.x < AR.x || b.x > AR.x + AR.w || b.y < AR.y || b.y > AR.y + AR.h) { b.alive = false; continue; }
    if (dst(b.x, b.y, p.x, p.y) < b.r + p.r && p.invince <= 0) { b.alive = false; hurtP(b.dmg); }
  }
}

/* ═══════════════ DRONE AI ═══════════════ */
function tickDrone(e, dt, p) {
  if (!e.alive) return;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowM = 1; }
  if (e.type === 'stealth') { e.cloakT -= dt; if (e.cloakT <= 0) { e.cloaked = !e.cloaked; e.cloakT = e.cloaked ? 4 : 2; } }
  e.flare = Math.max(0, e.flare - dt * 3);
  const spd = e.speed * e.slowM;
  const dpx = p.x - e.x, dpy = p.y - e.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1;
  const tx = p.decoyPos && dst(e.x, e.y, p.decoyPos.x, p.decoyPos.y) < 240 ? p.decoyPos.x : p.x;
  const ty = p.decoyPos && dst(e.x, e.y, p.decoyPos.x, p.decoyPos.y) < 240 ? p.decoyPos.y : p.y;
  const ftx = tx - e.x, fty = ty - e.y, ftd = Math.sqrt(ftx * ftx + fty * fty) || 1;

  if (e.type === 'chase' || e.type === 'stealth') { e.vx += (ftx / ftd) * spd * dt * 7 - e.vx * dt * 5; e.vy += (fty / ftd) * spd * dt * 7 - e.vy * dt * 5; }
  else if (e.type === 'shoot' || e.type === 'elite') {
    const kd = e.type === 'elite' ? 230 : 200;
    if (dpd > kd) { e.vx += (dpx / dpd) * spd * dt * 5 - e.vx * dt * 4; e.vy += (dpy / dpd) * spd * dt * 5 - e.vy * dt * 4; }
    else { e.vx *= Math.pow(0.06, dt); e.vy *= Math.pow(0.06, dt); }
    e.sT -= dt;
    if (e.sT <= 0 && dpd < 470) {
      e.sT = e.sCd + Math.random() * 1.2;
      const bspd = e.type === 'elite' ? 390 : 310, dmg = e.type === 'elite' ? 17 : 11;
      ebullets.push({ x: e.x, y: e.y, vx: dpx / dpd * bspd + (Math.random() - 0.5) * 50, vy: dpy / dpd * bspd + (Math.random() - 0.5) * 50, alive: true, r: e.type === 'elite' ? 7 : 5, dmg, col: e.type === 'elite' ? '#f472b6' : '#ff6b8a', homing: false });
      if (e.type === 'elite') { const ba = Math.atan2(dpy, dpx); [-0.23, 0.23].forEach(off => { const a = ba + off; ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 285, vy: Math.sin(a) * 285, alive: true, r: 4, dmg: 10, col: '#f472b6', homing: false }); }); }
    }
  }
  else if (e.type === 'sniper') {
    if (dpd > 320) { e.vx += (dpx / dpd) * spd * dt * 4 - e.vx * dt * 4; e.vy += (dpy / dpd) * spd * dt * 4 - e.vy * dt * 4; }
    else { e.vx *= Math.pow(0.04, dt); e.vy *= Math.pow(0.04, dt); }
    e.sT -= dt;
    if (e.sT <= 0 && dpd < 550) { e.sT = e.sCd + Math.random() * 1.5; playSFX('sniper'); ebullets.push({ x: e.x, y: e.y, vx: dpx / dpd * 800 + (Math.random() - 0.5) * 20, vy: dpy / dpd * 800 + (Math.random() - 0.5) * 20, alive: true, r: 6, dmg: 34, col: '#c770ff', homing: false }); }
  }
  else if (e.type === 'bomb') {
    e.vx += (dpx / dpd) * spd * dt * 10 - e.vx * dt * 6; e.vy += (dpy / dpd) * spd * dt * 10 - e.vy * dt * 6;
    if (dpd < e.r + p.r + 6) { bombBlast(e); return; }
  }
  else if (e.type === 'orbit') {
    e.oA += dt * 0.8;
    const ox = p.x + Math.cos(e.oA) * e.oDist, oy = p.y + Math.sin(e.oA) * e.oDist;
    e.vx += (ox - e.x) * dt * 5 - e.vx * dt * 4; e.vy += (oy - e.y) * dt * 5 - e.vy * dt * 4;
    e.sT -= dt; if (e.sT <= 0) { e.sT = e.sCd + Math.random(); ebullets.push({ x: e.x, y: e.y, vx: dpx / dpd * 350 + (Math.random() - 0.5) * 45, vy: dpy / dpd * 350 + (Math.random() - 0.5) * 45, alive: true, r: 5, dmg: 13, col: '#c770ff', homing: false }); }
  }
  else if (e.type === 'tank') {
    e.vx += (dpx / dpd) * spd * dt * 5 - e.vx * dt * 6; e.vy += (dpy / dpd) * spd * dt * 5 - e.vy * dt * 6;
    e.sT -= dt; if (e.sT <= 0 && dpd < 370) { e.sT = e.sCd + Math.random(); const ba = Math.atan2(dpy, dpx); for (let i = 0; i < 3; i++) { const a = ba + (i - 1) * 0.22; ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 275, vy: Math.sin(a) * 275, alive: true, r: 7, dmg: 21, col: '#2979ff', homing: false }); } }
  }

  if (e.cloaked) { e.x = clamp(e.x + e.vx * dt, AR.x + e.r, AR.x + AR.w - e.r); e.y = clamp(e.y + e.vy * dt, AR.y + e.r, AR.y + AR.h - e.r); return; }
  e.x = clamp(e.x + e.vx * dt, AR.x + e.r, AR.x + AR.w - e.r);
  e.y = clamp(e.y + e.vy * dt, AR.y + e.r, AR.y + AR.h - e.r);
  if (dpd < e.r + p.r && p.invince <= 0 && e.type !== 'bomb') hurtP(10, e);
}

/* ═══════════════ ECHO AI ═══════════════ */
function tickEcho(dt, p) {
  const e = ECHO;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowM = 1; }
  e.flare = Math.max(0, e.flare - dt * 4); e.pt -= dt;
  if (e.pt <= 0) {
    e.pt = 1 / 60;
    if (echoRec.length > 0) {
      const idx = Math.floor(e.pi) % echoRec.length;
      const rec = echoRec[idx]; e.pi += 1 + e.adapt * 0.6;
      const dpx = p.x - e.x, dpy = p.y - e.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1;
      let mx = rec.dx, my = rec.dy;
      if (Math.random() < e.adapt) { mx += dpx / dpd * 0.76; my += dpy / dpd * 0.76; }
      const ml = Math.sqrt(mx * mx + my * my) || 0.001;
      e.vx += (mx / ml * 180 * e.slowM - e.vx) * dt * 10; e.vy += (my / ml * 180 * e.slowM - e.vy) * dt * 10;
      if (rec.shoot) {
        const now = performance.now();
        if (now - e.lastShot > 138 + Math.random() * 72) {
          e.lastShot = now;
          const tx2 = rec.mx - rec.px, ty2 = rec.my - rec.py, tl = Math.sqrt(tx2 * tx2 + ty2 * ty2) || 1;
          const axa = (tx2 / tl) * (1 - e.adapt) + (dpx / dpd) * e.adapt, aya = (ty2 / tl) * (1 - e.adapt) + (dpy / dpd) * e.adapt;
          const ala = Math.sqrt(axa * axa + aya * aya) || 1;
          ebullets.push({ x: e.x, y: e.y, vx: axa / ala * 630, vy: aya / ala * 630, alive: true, r: 5, dmg: 14, col: '#ff1744', homing: false });
        }
      }
      if (rec.blink && Math.random() < 0.18) { puff(e.x, e.y, 5, '#ff1744'); e.x = clamp(e.x + (dpx / dpd) * 125, AR.x + e.r, AR.x + AR.w - e.r); e.y = clamp(e.y + (dpy / dpd) * 125, AR.y + e.r, AR.y + AR.h - e.r); puff(e.x, e.y, 5, '#ff1744'); }
    }
  }
  e.x = clamp(e.x + e.vx * dt, AR.x + e.r, AR.x + AR.w - e.r);
  e.y = clamp(e.y + e.vy * dt, AR.y + e.r, AR.y + AR.h - e.r);
  if (dst(e.x, e.y, p.x, p.y) < e.r + p.r && p.invince <= 0) hurtP(19, null, true);
}

/* ═══════════════ BOSS AI ═══════════════ */
function tickBoss(dt, p) {
  const b = BOSS; if (!b.alive) return;
  b.flare = Math.max(0, b.flare - dt * 3);
  if (b.slowT > 0) { b.slowT -= dt; if (b.slowT <= 0) b.slowM = 1; }

  // Phase transitions
  const thresholds = b.isFinal ? [0.78, 0.58, 0.38, 0.2] : b.phases === 4 ? [0.68, 0.42, 0.22] : b.phases === 3 ? [0.62, 0.36] : b.phases === 2 ? [0.52] : [];
  thresholds.forEach((thresh, i) => {
    if (!b.triggered[i] && b.hp < b.maxHp * thresh) {
      b.triggered[i] = true; b.phase = i + 1; playSFX('bossPhase');
      flashScreen('boss-hit', 200);
      rings.push({ x: b.x, y: b.y, r: 12, maxR: 360, l: 1, col: 'rgba(255,214,0,0.7)' });
      showAlert(b.phase === thresholds.length ? 'FINAL PHASE' : 'RAGE!', 1400, '#ffd600');
    }
  });

  if (b.shielded && b.shHp <= 0) { b.shielded = false; rings.push({ x: b.x, y: b.y, r: b.r, maxR: 230, l: 1, col: 'rgba(41,121,255,0.85)' }); showAlert('SHIELD BROKEN — ATTACK!', 1200, '#2979ff'); }

  // Movement patterns
  const spd = b.speed * (1 + b.phase * 0.42) * b.slowM;
  b.patT -= dt;
  if (b.patT <= 0) {
    b.patT = 2 + Math.random() * 2;
    const pats = b.phase >= 3 ? ['orbit', 'rush', 'strafe', 'charge', 'zigzag'] : b.phase >= 2 ? ['orbit', 'rush', 'strafe', 'charge'] : b.phase >= 1 ? ['orbit', 'rush', 'charge'] : ['orbit', 'rush'];
    b.pat = pats[Math.floor(Math.random() * pats.length)];
    if (b.pat === 'charge') { const dpx = p.x - b.x, dpy = p.y - b.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1; b.chargeDir = { x: dpx / dpd, y: dpy / dpd }; b.charging = true; b.chargeT = 0.6; }
  }
  const cx = AR.x + AR.w / 2, cy = AR.y + AR.h * 0.32;
  if (b.charging) { b.vx += b.chargeDir.x * spd * 5.8 * dt; b.vy += b.chargeDir.y * spd * 5.8 * dt; b.chargeT -= dt; if (b.chargeT <= 0) b.charging = false; }
  else if (b.pat === 'orbit') { b.orbitA += dt * (0.3 + b.phase * 0.2); const rad = 150 - b.phase * 30; b.vx += (cx + Math.cos(b.orbitA) * rad - b.x) * dt * 3 - b.vx * dt * 3; b.vy += (cy + Math.sin(b.orbitA) * rad - b.y) * dt * 3 - b.vy * dt * 3; }
  else if (b.pat === 'rush') { const dpx = p.x - b.x, dpy = p.y - b.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1; b.vx += (dpx / dpd) * spd * dt * 5 - b.vx * dt * 3; b.vy += (dpy / dpd) * spd * dt * 5 - b.vy * dt * 3; }
  else if (b.pat === 'strafe') { const dpx = p.x - b.x, dpy = p.y - b.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1; b.vx += (-dpy / dpd) * spd * dt * 4 - b.vx * dt * 3; b.vy += (dpx / dpd) * spd * dt * 4 - b.vy * dt * 3; }
  else if (b.pat === 'zigzag') { b.vx += Math.sin(frame * 0.08) * spd * dt * 3 - b.vx * dt * 2; b.vy += (p.y - b.y > 0 ? 1 : -1) * spd * dt * 2 - b.vy * dt * 2; }
  else { b.vx += (cx - b.x) * dt * 2 - b.vx * dt * 2; b.vy += (cy - b.y) * dt * 2 - b.vy * dt * 2; }
  b.x = clamp(b.x + b.vx * dt, AR.x + b.r + 14, AR.x + AR.w - b.r - 14);
  b.y = clamp(b.y + b.vy * dt, AR.y + b.r + 14, AR.y + AR.h - b.r - 14);

  // Shooting escalation
  b.shootT -= dt;
  const sCd = Math.max(0.1, b.shootCd * (1 - b.phase * 0.17));
  if (b.shootT <= 0) {
    b.shootT = sCd + Math.random() * 0.18;
    const dpx = p.x - b.x, dpy = p.y - b.y, dpd = Math.sqrt(dpx * dpx + dpy * dpy) || 1;
    const bspd = b.bspd + b.phase * 62;
    if (b.phase === 0) {
      ebullets.push({ x: b.x, y: b.y, vx: dpx / dpd * bspd + (Math.random() - 0.5) * 30, vy: dpy / dpd * bspd + (Math.random() - 0.5) * 30, alive: true, r: 9, dmg: b.bDmg, col: '#ff6d00', homing: false });
    } else if (b.phase === 1) {
      const ba = Math.atan2(dpy, dpx), n = b.spreadN;
      for (let i = 0; i < n; i++) { const a = ba + (i - (n - 1) / 2) * (0.36 / Math.max(1, n / 4)); ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * bspd, vy: Math.sin(a) * bspd, alive: true, r: 8, dmg: b.bDmg, col: '#ffd600', homing: false }); }
    } else if (b.phase >= 2) {
      const ba = Math.atan2(dpy, dpx), n = b.spreadN;
      for (let i = 0; i < n; i++) { const a = ba + (i - (n - 1) / 2) * 0.3; ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * bspd, vy: Math.sin(a) * bspd, alive: true, r: 7, dmg: b.bDmg, col: '#ff1744', homing: false }); }
      if (Math.random() < 0.44) { for (let i = 0; i < b.ringN; i++) { const a = (i / b.ringN) * Math.PI * 2; ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 255, vy: Math.sin(a) * 255, alive: true, r: 5, dmg: b.bDmg - 4, col: '#ff1744', homing: false }); } }
      if (b.phase >= 3 && Math.random() < 0.32) { ebullets.push({ x: b.x, y: b.y, vx: dpx / dpd * 200, vy: dpy / dpd * 200, alive: true, r: 10, dmg: b.bDmg + 7, col: '#ffd600', homing: true }); }
      if (b.isFinal && b.phase >= 4 && Math.random() < 0.28) { for (let i = 0; i < b.ringN + 8; i++) { const a = (i / (b.ringN + 8)) * Math.PI * 2; ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, alive: true, r: 6, dmg: b.bDmg, col: '#d040fb', homing: false }); } }
    }
  }

  if (dst(b.x, b.y, p.x, p.y) < b.r + p.r && p.invince <= 0) hurtP(30);
  if (b.hp <= 0) { b.alive = false; playSFX('ult'); puff(b.x, b.y, 90, '#ffd600'); rings.push({ x: b.x, y: b.y, r: 12, maxR: 650, l: 1, col: 'rgba(255,214,0,0.7)' }); rings.push({ x: b.x, y: b.y, r: 12, maxR: 430, l: 1, col: 'rgba(255,23,68,0.6)' }); const pm = PM(), cm = coinM(); const bc = Math.round((720 + gLevel * 58) * pm.coins * cm); addCoins(bc); addXP(460 + gLevel * 38); addBPXP(460 + gLevel * 38); score += 9500 + gLevel * 650; floatText(b.x, b.y - 50, '⬡+' + bc + ' BOSS!', '#ffd600'); showAlert(b.isFinal ? '🏆 SEASON COMPLETE!' : 'BOSS DESTROYED!', 2800, '#ffd600'); setTimeout(levelEnd, 3200); }
}

/* ═══════════════ KILL / HURT ═══════════════ */
function killDrone(e) {
  if (!e.alive) return; e.alive = false; kills++; playSFX('kill');
  puff(e.x, e.y, 18, '#ffd600'); rings.push({ x: e.x, y: e.y, r: 4, maxR: 58, l: 1, col: 'rgba(255,214,0,0.55)' });
  combo++; comboT = 3.8; if (combo > maxCombo) maxCombo = combo;
  const pm = PM(), cm = coinM(), xm = xpM();
  const base = { chase: 11, shoot: 13, bomb: 15, orbit: 14, sniper: 20, tank: 26, stealth: 17, elite: 23 }[e.type] || 11;
  const ec = Math.round(base * (1 + combo * 0.08) * pm.coins * cm);
  const xpg = Math.round((base + 5) * (1 + combo * 0.05) * xm);
  addCoins(ec); addXP(xpg); addBPXP(Math.floor(xpg * 0.5)); score += 85 + combo * 38;
  showCombo(); floatText(e.x, e.y - 24, '⬡+' + ec, '#ffd600'); klog(e.type.toUpperCase() + ' +⬡' + ec);
  if (P.killCdR > 0) { ['wave', 'blink'].forEach(k => P.ab[k] = Math.max(0, P.ab[k] - P.killCdR)); }
  if (P.vampire) P.hp = Math.min(P.maxHp, P.hp + 10);
  if (P.slipstream) { P.slipCnt = Math.min(5, P.slipCnt + 1); P.slipT = 3; }
}
function killEcho() {
  if (!ECHO || !ECHO.alive) return; ECHO.alive = false; playSFX('lvEnd');
  puff(ECHO.x, ECHO.y, 45, '#ff1744'); rings.push({ x: ECHO.x, y: ECHO.y, r: 10, maxR: 160, l: 1, col: 'rgba(255,23,68,0.7)' });
  const pm = PM(), cm = coinM(), xm = xpM();
  const ec = Math.round((125 + gLevel * 32) * pm.coins * cm); const xpg = Math.round((105 + gLevel * 22) * xm);
  addCoins(ec); addXP(xpg); addBPXP(xpg); score += 1100 + gLevel * 145;
  floatText(ECHO.x, ECHO.y - 34, '⬡+' + ec + ' ECHO', '#ff1744'); showAlert('ECHO DESTROYED!', 1800, '#ff1744');
}
function hurtP(dmg, src, isEcho) {
  const p = P; if (!p || p.invince > 0) return;
  if (p.lastStand && p.hp <= p.maxHp * 0.25) dmg = Math.floor(dmg * 0.38);
  if (p.fortress && p.hp <= p.maxHp * 0.3) dmg = Math.floor(dmg * 0.35);
  if (p.sh > 0) { const sd = Math.min(p.sh, dmg); p.sh -= sd; dmg -= sd; }
  p.hp -= dmg; p.invince = 0.32;
  playSFX('hurt'); flashScreen('hit', 90); puff(p.x, p.y, 7, '#ff1744');
  if (p.thorns && src) { src.hp -= dmg * 0.28; if (src.hp <= 0 && src !== BOSS) killDrone(src); }
  if (p.counterEcho && isEcho && ECHO && ECHO.alive) { ECHO.hp -= ECHO.maxHp * 0.22; ECHO.flare = 1; puff(ECHO.x, ECHO.y, 5, '#ff1744'); }
  if (p.hp <= 0) {
    if (p.hasRevive && !p.usedRevive) { p.usedRevive = true; p.hp = 1; p.invince = 3; showAlert('LAST BREATH', 1500, '#00e676'); rings.push({ x: p.x, y: p.y, r: 10, maxR: 145, l: 1, col: 'rgba(0,230,118,0.7)' }); }
    else { p.alive = false; gameOver(); }
  }
}
function bombBlast(e) {
  if (!e.alive) return; e.alive = false; puff(e.x, e.y, 26, '#ff6d00'); rings.push({ x: e.x, y: e.y, r: 7, maxR: 105, l: 1, col: 'rgba(255,109,0,0.65)' });
  if (P && dst(P.x, P.y, e.x, e.y) < 92 && P.invince <= 0) hurtP(36); kills++; score += 55; checkLvEnd();
}
function doAoe(x, y, rad, dmg) {
  puff(x, y, 12, '#d040fb'); rings.push({ x, y, r: 4, maxR: rad, l: 1, col: 'rgba(208,64,251,0.55)' });
  drones.filter(d => d.alive).forEach(e => { if (dst(x, y, e.x, e.y) < rad) { e.hp -= dmg; e.flare = 1; if (e.hp <= 0) killDrone(e); } });
}
function checkLvEnd() {
  const lv = LEVELS[gLevel - 1];
  if (lv.type === 'learn' && drones.filter(d => d.alive).length === 0) levelEnd();
  if (lv.type === 'echo' && (!ECHO || !ECHO.alive) && drones.filter(d => d.alive).length === 0) levelEnd();
}

/* ═══════════════ ABILITIES ═══════════════ */
function useAb(name) {
  if (!gameRunning || !P || !P.alive || between) return; rez();
  const p = P;
  if (name === 'dash') {
    if (p.dashCur <= 0) return; p.dashCur--; p.dashRech = 0; playSFX('dash');
    p.vx += p.face.x * 545; p.vy += p.face.y * 545; p.invince = p.invinceDash; puff(p.x, p.y, 12, p.getColor());
    if (p.dashDecoy) { p.decoyPos = { x: p.x, y: p.y }; p.decoyT = 2.5; }
    if (p.killCdR > 0) { ['wave', 'blink'].forEach(k => p.ab[k] = Math.max(0, p.ab[k] - p.killCdR)); }
  } else if (name === 'wave') {
    if (p.ab.wave > 0) return; p.ab.wave = p.waveCd; playSFX('wave');
    [...drones.filter(d => d.alive), ...(ECHO && ECHO.alive ? [ECHO] : []), ...(BOSS && BOSS.alive ? [BOSS] : [])].forEach(e => { const ex = e.x - p.x, ey = e.y - p.y, ed = Math.sqrt(ex * ex + ey * ey) || 1; if (ed < 220) { const f = (1 - ed / 220) * 570; e.vx = ex / ed * f; e.vy = ey / ed * f; } });
    rings.push({ x: p.x, y: p.y, r: 8, maxR: 235, l: 1, col: 'rgba(0,255,231,0.78)' });
  } else if (name === 'blink') {
    if (p.ab.blink > 0) return; p.ab.blink = p.blinkCd; playSFX('blink');
    const dx = mouse.x - p.x, dy = mouse.y - p.y, dl = Math.sqrt(dx * dx + dy * dy) || 1;
    const bd = Math.min(dl, p.blinkRange);
    puff(p.x, p.y, 10, '#c770ff');
    p.x = clamp(p.x + dx / dl * bd, AR.x + p.r, AR.x + AR.w - p.r);
    p.y = clamp(p.y + dy / dl * bd, AR.y + p.r, AR.y + AR.h - p.r);
    puff(p.x, p.y, 10, '#c770ff'); p.invince = 0.18;
    if (p.blinkRift) { rings.push({ x: p.x, y: p.y, r: 8, maxR: 88, l: 1, col: 'rgba(240,90,160,0.7)' }); drones.filter(d => d.alive).forEach(e => { if (dst(p.x, p.y, e.x, e.y) < 88) { e.hp -= 25; e.flare = 1; if (e.hp <= 0) killDrone(e); } }); }
  } else if (name === 'ult') {
    if (ultCharge < 1) return; ultCharge = 0; playSFX('ult');
    const rad = p.ultUpg ? 295 : 180, stun = p.ultUpg ? 2.5 : 0;
    rings.push({ x: p.x, y: p.y, r: 10, maxR: rad, l: 1, col: 'rgba(255,214,0,0.98)' });
    rings.push({ x: p.x, y: p.y, r: 10, maxR: rad * 0.6, l: 1, col: 'rgba(255,214,0,0.5)' });
    const pm = PM();
    [...drones.filter(d => d.alive), ...(ECHO && ECHO.alive ? [ECHO] : []), ...(BOSS && BOSS.alive && !BOSS.shielded ? [BOSS] : [])].forEach(e => {
      if (dst(p.x, p.y, e.x, e.y) < rad) { e.hp -= 82 * pm.dmg; e.flare = 1; if (stun) { e.slowM = 0.02; e.slowT = stun; } if (e.hp <= 0 && e !== BOSS) { if (e === ECHO) killEcho(); else killDrone(e); } }
    });
    puff(p.x, p.y, 45, '#ffd600'); showAlert('⚡ VOID NOVA ⚡', 1200, '#ffd600');
  }
}
function doReload() {
  if (reloading || curWpn.res <= 0) return; reloading = true; rlTimer = wData.rl; playSFX('reload'); showAlert('RELOADING…', wData.rl * 900, '#2979ff');
}

/* ═══════════════ LEVEL END ═══════════════ */
function levelEnd() {
  if (between) return; between = true; playSFX('lvEnd');
  P.hp = Math.min(P.maxHp, P.hp + 32); P.sh = Math.min(P.maxSh, P.sh + 28);
  const pm = PM(), cm = coinM(), xm = xpM();
  const rc = Math.round((50 + gLevel * 18) * pm.coins * cm), rx = Math.round((55 + gLevel * 15) * xm);
  addCoins(rc); addXP(rx); addBPXP(rx);

  const nextN = gLevel + 1, nextLv = LEVELS[nextN - 1];
  $('rt-rews').innerHTML = `<div class="rt-rew">⬡ +${rc}</div><div class="rt-rew">XP +${rx}</div>`;
  $('rt-n').textContent = nextLv ? nextN + '/20' : gLevel + '/20';
  $('rt-n').style.color = nextLv ? nextLv.col : '#ffd600';
  $('rt-name').textContent = nextLv ? nextLv.name : 'COMPLETE!';
  const warn = nextLv ? (nextLv.type === 'boss' ? '⚠ BOSS: ' + nextLv.boss.name : nextLv.type === 'echo' ? '🔴 ECHO ADAPT: ' + Math.round((nextLv.echoAdapt || 0.3) * 100) + '%' : '👊 ELIMINATE ALL ENEMIES') : '';
  $('rt-type').textContent = warn; $('rt-type').style.color = nextLv && nextLv.type === 'boss' ? '#ffd600' : nextLv && nextLv.type === 'echo' ? '#ff1744' : '#00ffe7';
  $('rtrans').classList.add('show');

  setTimeout(() => {
    $('rtrans').classList.remove('show');
    if (!nextLv) { gameRunning = false; setTimeout(() => gameOver(true), 500); return; }
    gLevel = nextN; bullets = []; ebullets = []; loot = []; ECHO = null; BOSS = null; reloading = false;
    $('v-lvl').textContent = gLevel;
    const lv = LEVELS[gLevel - 1];
    if (lv.type === 'boss') { BOSS = makeBoss(lv); spawnDrones(lv); playSFX('bossRoar'); showAlert('⚠ ' + lv.boss.name, 2500, '#ffd600'); setPill('boss', lv.boss.name); }
    else if (lv.type === 'echo') { ECHO = makeEcho(lv); spawnDrones(lv); playSFX('bossPhase'); setPill('echo', 'ECHO ACTIVE'); }
    else { spawnDrones(lv); setPill('learn', 'CLEAR THE AREA'); }
    spawnLoot(gLevel); between = false; showUpgrade();
  }, 3700);
}

/* ═══════════════ UPGRADES ═══════════════ */
function showUpgrade() {
  const avail = UPGRADES.filter(u => !activeUpgrades.includes(u.id));
  if (!avail.length) { between = false; return; }
  const picks = shuffle(avail).slice(0, 3);
  $('upg-title').textContent = 'LEVEL ' + gLevel;
  $('upg-owned').textContent = activeUpgrades.length ? 'ACTIVE: ' + activeUpgrades.map(id => UPGRADES.find(u => u.id === id)?.name || '').join(' · ') : 'No upgrades yet. Choose wisely.';
  const grid = $('upg-cards'); grid.innerHTML = '';
  picks.forEach(u => {
    const d = document.createElement('div'); d.className = 'uc';
    d.innerHTML = `<span class="uc-icon">${u.icon}</span><div class="uc-name">${u.name}</div><div class="uc-desc">${u.desc}</div><div class="uc-tag" style="background:${u.cc}18;color:${u.cc};border-color:${u.cc}30">${u.cat}</div>`;
    d.onclick = () => { u.fn(P); activeUpgrades.push(u.id); playSFX('upgradeSelect'); $('pg-upg').classList.add('off'); between = false; };
    grid.appendChild(d);
  });
  $('pg-upg').classList.remove('off'); between = true;
}
function skipUpgrade() { $('pg-upg').classList.add('off'); between = false; }

/* ═══════════════ ECONOMY ═══════════════ */
function addCoins(n) { if (!n || n <= 0) return; SAVE.coins += n; sessionCoins += n; sv(); refreshUI(); }
function addGems(n) { if (!n || n <= 0) return; SAVE.gems += n; sv(); refreshUI(); }
function addXP(n) {
  if (!n || n <= 0) return; const xg = Math.round(n * xpM()); sessionXP += xg; SAVE.xp += xg;
  while (SAVE.lv < 12 && SAVE.xp >= xpFor(SAVE.lv)) { SAVE.xp -= xpFor(SAVE.lv); SAVE.lv++; doLevelUp(); }
  sv(); refreshUI();
}
function addBPXP(n) {
  if (!n) return; SAVE.bpXp += Math.round(n * (SAVE.owned.includes('pu_bpxp') ? 1.6 : 1));
  while (SAVE.bpTier < 50 && SAVE.bpXp >= BP_XP_PER_TIER) { SAVE.bpXp -= BP_XP_PER_TIER; SAVE.bpTier++; }
  sv();
}
function doLevelUp() {
  playSFX('levelUp'); const lv = SAVE.lv; const bon = lvBonus(lv);
  $('lvu-num').textContent = lv; $('lvu-name').textContent = lvName(lv);
  $('lvu-bonus').textContent = `+${((bon.dmg - 1) * 100) | 0}% DMG  ·  +${((bon.spd - 1) * 100) | 0}% SPD  ·  +${bon.hp} HP`;
  const ov = $('lvup'); ov.classList.add('show'); setTimeout(() => ov.classList.remove('show'), 2800);
  if (lv === 5)  showAlert('🔫 SCATTER CANNON UNLOCKED!', 2200, '#ff6d00');
  if (lv === 10) showAlert('⚡ PHASE LASER UNLOCKED!', 2200, '#ff1744');
  if (lv === 15) showAlert('🎯 VOID SNIPER UNLOCKED!', 2200, '#c770ff');
}
function refreshUI() {
  const vc = SAVE.coins.toLocaleString();
  ['bar-coins', 'sh-coins', 'v-coins-hud', 'lo-coins'].forEach(id => { const el2 = $(id); if (el2) el2.textContent = vc; });
  const vg = SAVE.gems.toLocaleString();
  ['bar-gems', 'sh-gems', 'bp-gems', 'lo-gems'].forEach(id => { const el2 = $(id); if (el2) el2.textContent = vg; });
  const lv = SAVE.lv, nm = lvName(lv), need = xpFor(lv), pct = lv >= 12 ? 100 : Math.min(100, SAVE.xp / need * 100);
  ['bar-lv', 'lo-lv-n'].forEach(id => { const el2 = $(id); if (el2) el2.textContent = lv; });
  ['bar-lvname', 'lo-lv-name'].forEach(id => { const el2 = $(id); if (el2) el2.textContent = nm; });
  ['bar-xpf', 'lo-xpf'].forEach(id => { const el2 = $(id); if (el2) el2.style.width = pct + '%'; });
  const ps = $('bar-prestige'); if (ps) ps.textContent = '★'.repeat(SAVE.prestige);
  const pi = $('v-prestige'); if (pi && SAVE.prestige > 0) { const pm = PM(); pi.textContent = '★' + SAVE.prestige + '  ×' + pm.dmg.toFixed(1) + 'DMG'; }
}

/* ═══════════════ HUD UPDATE ═══════════════ */
function updateHUD() {
  if (!P) return; const p = P;
  const hpPct = Math.max(0, p.hp / p.maxHp) * 100;
  $('b-hp').style.width = hpPct + '%'; $('b-hp').style.background = hpPct > 50 ? '#00ffe7' : hpPct > 25 ? '#ffd600' : '#ff1744';
  $('b-sh').style.width = (p.sh / p.maxSh * 100) + '%';
  $('v-hp').textContent = Math.ceil(p.hp); $('v-sh').textContent = Math.ceil(p.sh);
  $('v-score').textContent = score.toLocaleString(); $('v-kills').textContent = kills;
  $('v-streak').textContent = combo > 1 ? combo + '× STREAK' : '';

  const en = BOSS && BOSS.alive ? BOSS : ECHO && ECHO.alive ? ECHO : null;
  if (en) {
    $('b-ehp').style.width = (en.hp / en.maxHp * 100) + '%'; $('v-ehp').textContent = Math.ceil(en.hp);
    $('enemy-lbl').textContent = en === BOSS ? BOSS.name : 'ECHO';
    $('b-esh').style.width = en === BOSS && BOSS.shielded ? (BOSS.shHp / BOSS.maxShHp * 100) + '%' : '0%';
  } else { $('b-ehp').style.width = '0%'; $('v-ehp').textContent = '—'; $('b-esh').style.width = '0%'; $('enemy-lbl').textContent = 'ENEMY'; }

  if (curWpn && wData) {
    $('wpn-name').textContent = wData.name; $('wpn-name').style.color = wData.bc;
    $('wpn-ammo').textContent = reloading ? '…' : curWpn.ammo;
    $('wpn-res').textContent = curWpn.res === 999 ? '∞' : curWpn.res;
    const dots = $('ammo-dots'); dots.innerHTML = '';
    for (let i = 0; i < Math.min(wData.maxAmmo, 25); i++) { const d = document.createElement('div'); d.className = 'ad ' + (reloading ? 'rl' : i < curWpn.ammo ? 'f' : 'e'); if (reloading) d.style.animationDelay = (i * 0.04) + 's'; dots.appendChild(d); }
  }

  const abDefs = {
    dash:  { rdy: () => p.dashCur > 0,    pct: () => p.dashCur / p.dashMax * 100, txt: () => Math.ceil(p.dashCd - p.dashRech) + 's' },
    wave:  { rdy: () => p.ab.wave === 0,  pct: () => (1 - p.ab.wave / p.waveCd) * 100, txt: () => Math.ceil(p.ab.wave) + 's' },
    blink: { rdy: () => p.ab.blink === 0, pct: () => (1 - p.ab.blink / p.blinkCd) * 100, txt: () => Math.ceil(p.ab.blink) + 's' },
  };
  Object.entries(abDefs).forEach(([k, def]) => {
    const fi = $('abf-' + k), ci = $('abc-' + k), si = $('ab-' + k); if (!fi) return;
    fi.style.height = Math.max(0, def.pct()) + '%';
    if (def.rdy()) { ci.classList.add('h'); si.classList.add('rdy'); } else { ci.classList.remove('h'); ci.textContent = def.txt(); si.classList.remove('rdy'); }
  });
  const uf = $('abf-ult'), uc = $('abc-ult'), us = $('ab-ult');
  if (uf) { uf.style.height = (ultCharge * 100) + '%'; if (ultCharge >= 1) { uc.classList.add('h'); us.classList.add('ult-rdy'); } else { uc.classList.remove('h'); uc.textContent = Math.round(ultCharge * 100) + '%'; us.classList.remove('ult-rdy'); } }

  updateObj(); refreshUI();
}
function updateObj() {
  const oc = $('obj-body'); if (!oc) return; const lv = LEVELS[gLevel - 1]; if (!lv) return;
  if (lv.type === 'boss') { const bh = BOSS && BOSS.alive ? BOSS.hp : 0; const sh = BOSS && BOSS.shielded ? BOSS.shHp : 0; oc.innerHTML = `<div class="obj-row"><span class="obj-lbl">${lv.boss?.name || 'BOSS'} HP</span><span class="obj-val" style="color:#ffd600">${Math.ceil(bh)}</span></div><div class="obj-prog"><div class="obj-prog-f" style="width:${BOSS ? bh / BOSS.maxHp * 100 : 0}%;background:#ffd600"></div></div>${sh > 0 ? `<div class="obj-row" style="margin-top:5px"><span class="obj-lbl">SHIELD</span><span class="obj-val" style="color:#2979ff">${Math.ceil(sh)}</span></div><div class="obj-prog"><div class="obj-prog-f" style="width:${BOSS ? sh / BOSS.maxShHp * 100 : 0}%;background:#2979ff"></div></div>` : '<div style="font-size:7px;color:#2979ff;margin-top:4px;letter-spacing:1px">⚔ SHIELD BROKEN — ATTACK HP!</div>'}`; }
  else if (lv.type === 'echo') { const al = drones.filter(d => d.alive).length; const eh = ECHO && ECHO.alive ? ECHO.hp : 0; oc.innerHTML = `<div class="obj-row"><span class="obj-lbl">ECHO HP</span><span class="obj-val" style="color:#ff1744">${Math.ceil(eh)}</span></div><div class="obj-prog"><div class="obj-prog-f" style="width:${ECHO ? eh / ECHO.maxHp * 100 : 0}%;background:#ff1744"></div></div><div class="obj-row" style="margin-top:5px"><span class="obj-lbl">DRONES LEFT</span><span class="obj-val" style="color:#ffd600">${al}</span></div>`; }
  else { const al = drones.filter(d => d.alive).length, tot = drones.length; const pct = tot > 0 ? (1 - al / tot) * 100 : 100; oc.innerHTML = `<div class="obj-row"><span class="obj-lbl">ENEMIES</span><span class="obj-val" style="color:#00ffe7">${al} / ${tot}</span></div><div class="obj-prog"><div class="obj-prog-f" style="width:${pct}%;background:#00ffe7"></div></div><div class="obj-row" style="margin-top:5px"><span class="obj-lbl">LEVEL</span><span class="obj-val" style="color:#ffd600">${gLevel} / 20</span></div>`; }
}

/* ═══════════════ RENDERING ═══════════════ */
function render() {
  ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#030010'; ctx.fillRect(0, 0, W, H);

  // Stars
  stars.forEach(s => { s.t += s.s; ctx.globalAlpha = 0.14 + Math.sin(s.t) * 0.12; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = '#d0c8ff'; ctx.fill(); }); ctx.globalAlpha = 1;

  // Nebula
  const nb = ctx.createRadialGradient(AR.x + AR.w / 2, AR.y + AR.h / 2, 0, AR.x + AR.w / 2, AR.y + AR.h / 2, Math.max(AR.w, AR.h) * 0.75);
  nb.addColorStop(0, 'rgba(28,6,70,0.48)'); nb.addColorStop(1, 'transparent');
  ctx.fillStyle = nb; ctx.fillRect(AR.x, AR.y, AR.w, AR.h);

  // Grid
  ctx.strokeStyle = 'rgba(199,112,255,0.018)'; ctx.lineWidth = 1;
  for (let x = AR.x % 60; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = AR.y % 60; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Arena border
  ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(120,0,255,0.25)'; ctx.strokeStyle = 'rgba(120,0,255,0.22)'; ctx.lineWidth = 2; ctx.strokeRect(AR.x, AR.y, AR.w, AR.h); ctx.shadowBlur = 0;
  // Corner brackets
  const cs = 24;
  [[AR.x, AR.y, 1, 1], [AR.x + AR.w, AR.y, -1, 1], [AR.x, AR.y + AR.h, 1, -1], [AR.x + AR.w, AR.y + AR.h, -1, -1]].forEach(([bx, by, sx, sy]) => {
    ctx.strokeStyle = 'rgba(0,255,231,0.55)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sx * cs, by); ctx.moveTo(bx, by); ctx.lineTo(bx, by + sy * cs); ctx.stroke();
  });

  // Rings
  rings.forEach(r => { ctx.globalAlpha = r.l * 0.35; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.strokeStyle = r.col; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; });

  // Decoy
  if (P && P.decoyPos) {
    const dp = P.decoyPos, ch = CHARS[P.charId];
    ctx.globalAlpha = 0.35 + Math.sin(frame * 0.18) * 0.1;
    if (ch && ch.draw) ch.draw(ctx, dp.x, dp.y, P.r, frame, P.skinId, { x: 1, y: 0 });
    ctx.globalAlpha = 1;
  }

  // Loot
  loot.forEach(lt => {
    if (!lt.alive) return; const c = lootColor(lt.type);
    ctx.globalAlpha = 0.12 * (1 - lt.pulse / 32); ctx.beginPath(); ctx.arc(lt.x, lt.y, lt.pulse, 0, Math.PI * 2); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.shadowBlur = 12; ctx.shadowColor = c; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(lt.x, lt.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = 'bold 8px Orbitron, monospace'; ctx.textAlign = 'center'; ctx.fillText(lootLabel(lt.type), lt.x, lt.y - 13);
  });

  // Particles
  particles.forEach(pt => { ctx.globalAlpha = Math.max(0, pt.l * 0.9); ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.1, pt.r * pt.l), 0, Math.PI * 2); ctx.fillStyle = pt.c; ctx.fill(); ctx.globalAlpha = 1; });

  // Enemy bullets
  ebullets.forEach(b => {
    if (!b.alive) return; ctx.shadowBlur = 7; ctx.shadowColor = b.col;
    if (b.homing) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(frame * 0.16); ctx.fillStyle = b.col; ctx.beginPath(); ctx.moveTo(0, -b.r * 1.6); ctx.lineTo(b.r, b.r); ctx.lineTo(-b.r, b.r); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else { ctx.fillStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
  });

  // Player trail
  if (P) {
    const tc = getTrailColor();
    P.trail.forEach((pt, i) => { const a = (1 - i / P.trail.length) * 0.42; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.3, 6 * (1 - i / P.trail.length)), 0, Math.PI * 2); ctx.fillStyle = tc; ctx.fill(); }); ctx.globalAlpha = 1;
  }

  // Player bullets
  bullets.forEach(b => {
    if (!b.alive) return; ctx.shadowBlur = 14; ctx.shadowColor = b.col;
    if (b.voidSlash) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = 'rgba(100,0,150,0.35)'; ctx.fillRect(-b.r * 2.2, -b.r * 0.8, b.r * 4.4, b.r * 1.6);
      ctx.fillStyle = '#0a0020'; ctx.fillRect(-b.r * 2, -b.r * 0.5, b.r * 4, b.r);
      ctx.strokeStyle = '#c770ff'; ctx.lineWidth = 1.5; ctx.strokeRect(-b.r * 2, -b.r * 0.5, b.r * 4, b.r);
      ctx.restore();
    } else if (b.plasma) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.3, '#f0a0ff'); g.addColorStop(1, b.col + '44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    } else if (b.laser) {
      const len = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * 0.1;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.strokeStyle = b.col + '44'; ctx.lineWidth = b.r * 3.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-len, 0); ctx.stroke();
      ctx.strokeStyle = b.col; ctx.lineWidth = b.r; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-len, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = b.r * 0.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-len * 0.6, 0); ctx.stroke();
      ctx.restore();
    } else if (wData && wData.id === 'sniper') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r * 2.2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, b.col); g.addColorStop(1, b.col + '22');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 2.2, b.r * 0.65, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, b.col); g.addColorStop(1, b.col + '44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  });

  // Drones
  drones.forEach(e => {
    if (!e.alive) return; if (e.cloaked) ctx.globalAlpha = 0.14;
    const col = droneColor(e.type);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(frame * 0.022 + (e.type === 'orbit' ? frame * 0.05 : 0));
    ctx.shadowBlur = e.flare > 0 ? 28 : 12; ctx.shadowColor = col; ctx.fillStyle = col;
    if (e.type === 'chase')   { ctx.beginPath(); ctx.moveTo(0, -e.r * 1.1); ctx.lineTo(e.r * 0.75, 0); ctx.lineTo(0, e.r * 1.1); ctx.lineTo(-e.r * 0.75, 0); ctx.closePath(); ctx.fill(); }
    else if (e.type === 'shoot') { ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.6, 0, Math.PI * 2); ctx.stroke(); }
    else if (e.type === 'sniper') { ctx.beginPath(); ctx.moveTo(0, -e.r * 1.5); ctx.lineTo(e.r * 0.45, e.r * 0.8); ctx.lineTo(-e.r * 0.45, e.r * 0.8); ctx.closePath(); ctx.fill(); }
    else if (e.type === 'bomb') { ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = (0.3 + Math.sin(frame * 0.2) * 0.3) * (e.cloaked ? 0.14 : 1); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.55, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = e.cloaked ? 0.14 : 1; }
    else if (e.type === 'orbit') { ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); ctx.closePath(); ctx.fill(); }
    else if (e.type === 'tank') { ctx.fillRect(-e.r, -e.r, e.r * 2, e.r * 2); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.strokeRect(-e.r * 0.55, -e.r * 0.55, e.r * 1.1, e.r * 1.1); }
    else if (e.type === 'stealth') { ctx.globalAlpha = e.cloaked ? 0.14 : 0.7; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    else if (e.type === 'elite') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); } ctx.closePath(); ctx.fill(); }
    ctx.shadowBlur = 0; ctx.restore(); ctx.globalAlpha = 1;
    if (e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2, 3.5); ctx.fillStyle = col; ctx.fillRect(e.x - e.r, e.y - e.r - 9, e.r * 2 * (e.hp / e.maxHp), 3.5); }
    if (e.tankSh > 0) { ctx.strokeStyle = 'rgba(41,121,255,0.5)'; ctx.lineWidth = 2.5; ctx.strokeRect(e.x - e.r - 4, e.y - e.r - 4, e.r * 2 + 8, e.r * 2 + 8); }
  });

  // Echo
  if (ECHO && ECHO.alive) {
    const e = ECHO, fl = e.flare > 0;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 12 + Math.sin(frame * 0.08) * 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,23,68,${0.1 + Math.sin(frame * 0.09) * 0.06})`; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.shadowBlur = fl ? 42 : 22; ctx.shadowColor = '#ff1744';
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + frame * 0.024; const disp = fl ? Math.random() * 5 : Math.sin(frame * 0.055 + i) * 3; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * disp, e.y + Math.sin(a) * disp, e.r * (1 - i * 0.008), a, a + Math.PI * 2 / 14 * 0.82); ctx.strokeStyle = `rgba(255,23,68,${fl ? 0.98 : 0.86})`; ctx.lineWidth = fl ? 3.5 : 2; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.4, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,23,68,${fl ? 1 : 0.65})`; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - 62, e.y - e.r - 17, 124, 7); ctx.fillStyle = '#ff1744'; ctx.fillRect(e.x - 62, e.y - e.r - 17, 124 * (e.hp / e.maxHp), 7); ctx.strokeStyle = 'rgba(255,23,68,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(e.x - 62, e.y - e.r - 17, 124, 7);
    ctx.fillStyle = 'rgba(255,23,68,0.55)'; ctx.font = 'bold 8px Orbitron, monospace'; ctx.textAlign = 'center'; ctx.fillText('ECHO · ADAPT ' + Math.round(ECHO.adapt * 100) + '%', e.x, e.y + e.r + 17);
  }

  // Boss
  if (BOSS && BOSS.alive) {
    const b = BOSS, ph = b.phase;
    const col = ph >= 4 ? '#ff1744' : ph >= 3 ? '#f472b6' : ph >= 2 ? '#ff1744' : ph >= 1 ? '#ffd600' : '#ff6d00';
    for (let ri = 0; ri < 5; ri++) { const rr = b.r + 22 + ri * 18 + Math.sin(frame * 0.07 + ri * 1.1) * (8 + ph * 4.5); ctx.beginPath(); ctx.arc(b.x, b.y, rr, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,214,0,${0.1 - ri * 0.018})`; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.shadowBlur = b.flare > 0 ? 60 : 35; ctx.shadowColor = col;
    const segs = 22 + ph * 6;
    for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2 + frame * 0.02; const disp = b.flare > 0 ? Math.random() * 9 : Math.sin(frame * 0.06 + i * 1.1) * (4 + ph * 3); ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * disp, b.y + Math.sin(a) * disp, b.r * (1 - i * 0.008), a, a + Math.PI * 2 / segs * 0.88); ctx.strokeStyle = col; ctx.lineWidth = b.flare > 0 ? 4.5 : 3; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); ctx.fillStyle = 'rgba(3,0,16,0.94)'; ctx.fill();
    const ec = ['#ff6d00', '#ffd600', '#ff1744', '#f472b6', '#c770ff'][Math.min(ph, 4)];
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.3, 0, Math.PI * 2); ctx.fillStyle = ec; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(3,0,16,0.92)'; ctx.fill();
    ctx.shadowBlur = 0;
    if (b.shielded) { const shp = b.shHp / b.maxShHp; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 22, 0, Math.PI * 2 * shp); ctx.strokeStyle = 'rgba(41,121,255,0.9)'; ctx.lineWidth = 4; ctx.stroke(); ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 26, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(41,121,255,0.14)'; ctx.lineWidth = 1; ctx.stroke(); }
    const bw = 160; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(b.x - bw / 2, b.y - b.r - 26, bw, 10); ctx.fillStyle = col; ctx.fillRect(b.x - bw / 2, b.y - b.r - 26, bw * (b.hp / b.maxHp), 10); ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.strokeRect(b.x - bw / 2, b.y - b.r - 26, bw, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 10px Orbitron, monospace'; ctx.textAlign = 'center'; ctx.fillText(b.name, b.x, b.y + b.r + 17);
    const pn = ['PHASE 1', 'PHASE 2', 'PHASE 3', 'PHASE 4', '★ FINAL FORM ★'][Math.min(ph, 4)];
    ctx.fillStyle = col; ctx.font = '7px Orbitron, monospace'; ctx.fillText(pn, b.x, b.y + b.r + 29);
  }

  // Player
  if (P && P.alive && !(P.invince > 0 && frame % 5 < 2)) {
    const p = P, ch = CHARS[p.charId];
    ctx.shadowBlur = 26; ctx.shadowColor = p.getColor();
    if (ch && ch.draw) ch.draw(ctx, p.x, p.y, p.r, frame, p.skinId, p.face);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = p.getColor() + '55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x + p.face.x * p.r, p.y + p.face.y * p.r); ctx.lineTo(p.x + p.face.x * (p.r + 28), p.y + p.face.y * (p.r + 28)); ctx.stroke();
    if (p.sh > 0) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, Math.PI * 2 * (p.sh / p.maxSh)); ctx.strokeStyle = 'rgba(199,112,255,0.62)'; ctx.lineWidth = 2.5; ctx.stroke(); }
  }

  // Crosshair
  const cc = wData ? wData.bc : '#00ffe7'; const cs2 = reloading ? 16 : 10;
  ctx.strokeStyle = cc + 'aa'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mouse.x - cs2, mouse.y); ctx.lineTo(mouse.x - 3, mouse.y); ctx.moveTo(mouse.x + 3, mouse.y); ctx.lineTo(mouse.x + cs2, mouse.y); ctx.moveTo(mouse.x, mouse.y - cs2); ctx.lineTo(mouse.x, mouse.y - 3); ctx.moveTo(mouse.x, mouse.y + 3); ctx.lineTo(mouse.x, mouse.y + cs2); ctx.stroke();
  ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2, 0, Math.PI * 2); ctx.fillStyle = cc + 'cc'; ctx.fill();

  renderMM();
}

function getTrailColor() {
  if (SAVE.trailId === 'trail_gold' && SAVE.owned.includes('trail_gold')) return 'rgba(255,214,0,0.42)';
  if (SAVE.trailId === 'trail_void' && SAVE.owned.includes('trail_void')) return 'rgba(120,50,255,0.45)';
  if (SAVE.trailId === 'trail_rose' && SAVE.owned.includes('trail_rose')) return 'rgba(255,65,90,0.4)';
  const ch = CHARS[SAVE.equippedChar] || CHARS.ghost; return ch.glow.replace('#', 'rgba(') + ',0)'.replace(',0)', ',0.38)') || 'rgba(0,255,231,0.38)';
}
function renderMM() {
  const sc = 140 / Math.max(AR.w, AR.h); mctx.clearRect(0, 0, 140, 140); mctx.fillStyle = 'rgba(3,0,16,0.9)'; mctx.fillRect(0, 0, 140, 140); mctx.strokeStyle = 'rgba(120,0,255,0.2)'; mctx.lineWidth = 1; mctx.strokeRect(0, 0, 140, 140);
  loot.forEach(lt => { if (!lt.alive) return; mctx.beginPath(); mctx.arc((lt.x - AR.x) * sc, (lt.y - AR.y) * sc, 2.5, 0, Math.PI * 2); mctx.fillStyle = lootColor(lt.type); mctx.fill(); });
  drones.forEach(e => { if (!e.alive || e.cloaked) return; mctx.beginPath(); mctx.arc((e.x - AR.x) * sc, (e.y - AR.y) * sc, 3, 0, Math.PI * 2); mctx.fillStyle = droneColor(e.type); mctx.fill(); });
  if (ECHO && ECHO.alive) { mctx.beginPath(); mctx.arc((ECHO.x - AR.x) * sc, (ECHO.y - AR.y) * sc, 5.5, 0, Math.PI * 2); mctx.fillStyle = '#ff1744'; mctx.fill(); }
  if (BOSS && BOSS.alive) { mctx.beginPath(); mctx.arc((BOSS.x - AR.x) * sc, (BOSS.y - AR.y) * sc, 8.5, 0, Math.PI * 2); mctx.fillStyle = '#ffd600'; mctx.fill(); }
  if (P && P.alive) { mctx.beginPath(); mctx.arc((P.x - AR.x) * sc, (P.y - AR.y) * sc, 6, 0, Math.PI * 2); mctx.fillStyle = P.getColor(); mctx.fill(); }
}

/* ═══════════════ UI HELPERS ═══════════════ */
let _dfT;
function flashScreen(cls, dur = 90) {
  const d = $('dmg-overlay'); if (!d) return;
  d.className = cls; clearTimeout(_dfT); _dfT = setTimeout(() => d.className = '', dur);
}
function klog(msg) { const kl = $('klog'); if (!kl) return; const d = document.createElement('div'); d.className = 'kl'; d.textContent = '// ' + msg; kl.appendChild(d); while (kl.children.length > 7) kl.firstChild.remove(); setTimeout(() => { try { d.remove(); } catch {} }, 3700); }
function floatText(x, y, txt, col) { const d = document.createElement('div'); d.className = 'fr'; d.style.cssText = `left:${x}px;top:${y}px;color:${col};text-shadow:0 0 9px ${col}`; d.textContent = txt; document.body.appendChild(d); setTimeout(() => d.remove(), 950); }
function floatFixed(txt, col) { const d = document.createElement('div'); d.className = 'fr'; d.style.cssText = `top:70px;left:50%;transform:translateX(-50%);color:${col};font-size:11px`; d.textContent = txt; document.body.appendChild(d); setTimeout(() => d.remove(), 900); }

let _alT;
function showAlert(txt, dur, col = '#00ffe7') { const e = $('at'); if (!e) return; e.textContent = txt; e.style.opacity = '1'; e.style.color = col; e.style.textShadow = `0 0 20px ${col}`; clearTimeout(_alT); _alT = setTimeout(() => e.style.opacity = '0', dur); }
function showCombo() { const cn = $('cn'), cl2 = $('cl'); if (!cn || !cl2) return; if (combo >= 3) { cn.textContent = combo + '×'; cn.style.opacity = '1'; cl2.textContent = combo >= 10 ? 'G O D L I K E' : combo >= 7 ? 'UNSTOPPABLE!' : combo >= 5 ? 'RAMPAGE!' : 'COMBO!'; cl2.style.opacity = '1'; if (combo === 3) playSFX('kill'); else if (combo === 5) playSFX('killBig'); else if (combo >= 8) { playSFX('killBig'); setTimeout(() => playSFX('killBig'), 65); } } }
function setPill(type, text) { const pb = $('phase-badge'); pb.className = 'phase-badge pb-' + type; $('phase-txt').textContent = text; }

/* Weapon hotkeys */
const WK = { Digit1:'pistol', Digit2:'shotgun', Digit3:'laser', Digit4:'sniper', Digit5:'plasma', Digit6:'vblade' };
window.addEventListener('keydown', e => {
  rez(); keys[e.code] = true;
  if (!gameRunning || between) return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { e.preventDefault(); useAb('dash'); }
  if (e.code === 'KeyE') { e.preventDefault(); useAb('wave'); }
  if (e.code === 'KeyF') { e.preventDefault(); useAb('blink'); }
  if (e.code === 'KeyR') { e.preventDefault(); if (curWpn && curWpn.ammo < (wData?.maxAmmo || 15) && !reloading) doReload(); else useAb('ult'); }
  if (e.code === 'KeyQ') { e.preventDefault(); doReload(); }
  if (e.code === 'Space') e.preventDefault();
  const wid = WK[e.code];
  if (wid && wpnUnlocked(wid)) { wData = WEAPONS[wid]; SAVE.equippedWeapon = wid; curWpn = { ammo: wData.maxAmmo, res: wData.res }; reloading = false; showAlert(wData.name, 700, wData.bc); }
});
window.addEventListener('keyup', e => delete keys[e.code]);
