/* ══════════════════════════════════════════
   ECHOES — UI.JS  Navigation, Loadout, Shop, Battle Pass, Game Over
══════════════════════════════════════════ */
'use strict';

/* ── Title particle loop ── */
const tcEl = document.getElementById('tc');
const tctx = tcEl ? tcEl.getContext('2d') : null;
const TP = [];
let titleActive = false;
setInterval(() => {
  if (titleActive) TP.push({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, r: 0, l: 1, c: Math.random() > 0.5 ? '0,255,231' : '255,23,68' });
}, 280);
function titleLoop() {
  if (!titleActive || !tctx) return;
  tcEl.width = window.innerWidth; tcEl.height = window.innerHeight;
  tctx.clearRect(0, 0, tcEl.width, tcEl.height);
  for (let i = TP.length - 1; i >= 0; i--) {
    const p = TP[i]; p.r += 0.5; p.l -= 0.003;
    if (p.l <= 0) { TP.splice(i, 1); continue; }
    tctx.beginPath(); tctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    tctx.strokeStyle = `rgba(${p.c},${p.l * 0.07})`; tctx.lineWidth = 1; tctx.stroke();
  }
  requestAnimationFrame(titleLoop);
}

/* ══════════════ NAVIGATION ══════════════
   CRITICAL FIX: All menus have solid backgrounds and are completely
   separate from the game canvas. No more transparency bleed-through.
══════════════════════════════════════════ */
const PAGES = { title:'pg-title', loadout:'pg-loadout', levels:'pg-levels', shop:'pg-shop', bp:'pg-bp' };

function nav(page) {
  rez();
  if (gameRunning) { gameRunning = false; }

  // Stop game loop by pausing
  document.getElementById('hud')?.classList.add('off');

  // Hide ALL pages and overlays
  Object.values(PAGES).forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.add('off'); el.style.display = 'none';
  });
  ['pg-upg', 'pg-over'].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('off');
  });

  // Update nav highlight
  document.querySelectorAll('.b-nav').forEach(n => n.classList.remove('on'));
  document.getElementById('bar')?.classList.remove('off');

  // Show target page
  const target = document.getElementById(PAGES[page]);
  if (!target) return;
  target.classList.remove('off');
  target.style.display = target.classList.contains('cover-scroll') ? 'block' : 'flex';
  const navBtn = document.getElementById('bn-' + page);
  if (navBtn) navBtn.classList.add('on');

  // Page-specific setup
  titleActive = page === 'title'; if (titleActive) titleLoop();
  if (page === 'loadout') { prevAnimR = true; animPrev(); renderLoadout(); }
  else { prevAnimR = false; }
  if (page === 'levels') renderLevels();
  if (page === 'shop') shTab('skins', document.querySelector('#sh-tabs .tab'));
  if (page === 'bp') renderBP();
  refreshUI();
  playSFX('navigate');
}

/* ══════════════ START GAME ══════════════ */
function startGame() {
  rez();
  SAVE.equippedChar = _sChar; SAVE.equippedWeapon = _sWpn; sv();

  // Hide ALL menu pages
  Object.values(PAGES).forEach(id => {
    const el = document.getElementById(id); if (el) { el.classList.add('off'); el.style.display = 'none'; }
  });
  ['pg-upg', 'pg-over'].forEach(id => document.getElementById(id)?.classList.add('off'));

  titleActive = false; prevAnimR = false;
  document.getElementById('hud')?.classList.remove('off');
  document.getElementById('bar')?.classList.remove('off');

  // Init game state
  buildArena(); makeStars();
  gLevel = 1; score = 0; kills = 0; maxCombo = 0; combo = 0; comboT = 0;
  ultCharge = 0; frame = 0; between = false; sessionCoins = 0; sessionXP = 0;
  activeUpgrades = []; echoRec.length = 0;
  particles = []; rings = [];

  P = makePlayer(); ECHO = null; BOSS = null;
  bullets = []; ebullets = []; drones = []; loot = [];

  wData = WEAPONS[SAVE.equippedWeapon] || WEAPONS.pistol;
  curWpn = { ammo: wData.maxAmmo, res: wData.res };
  reloading = false; rlTimer = 0;

  spawnDrones(LEVELS[0]); spawnLoot(1);
  $('v-lvl').textContent = 1; setPill('learn', 'CLEAR THE AREA');
  refreshUI();
  showAlert('LEVEL 1 — MEDULLA', 2200, '#00ffe7');
  gameRunning = true; lastT = performance.now();
  requestAnimationFrame(gameLoop);
}

/* ══════════════ GAME OVER ══════════════ */
function gameOver(won) {
  gameRunning = false;
  const pm = PM(), cm = coinM(), xm = xpM();
  const ec = Math.round((30 + kills * 4.5 + gLevel * 22) * pm.coins * cm);
  const xpg = Math.round((35 + kills * 5.5 + gLevel * 14) * xm);
  addCoins(ec); addXP(xpg); addBPXP(xpg);

  setTimeout(() => {
    document.getElementById('hud')?.classList.add('off');
    const ovr = document.getElementById('pg-over');
    if (!ovr) return;
    ovr.classList.remove('off'); ovr.style.display = 'flex';

    const isWin = won === true;
    $('ov-title').textContent = isWin ? 'VICTORIOUS' : 'ELIMINATED';
    $('ov-title').className = 'ov-title ' + (isWin ? 'ov-win' : 'ov-lose');
    $('ov-sub').textContent = isWin ? 'SEASON TWO COMPLETE — PRESTIGE AWAITS' : 'THE VOID CLAIMS ANOTHER OPERATIVE';
    $('ov-score').textContent = score.toLocaleString();
    $('ov-level').textContent = gLevel + '/20';
    $('ov-kills').textContent = kills;
    $('ov-combo').textContent = maxCombo;
    $('ov-earned').textContent = '⬡' + sessionCoins.toLocaleString();
    $('ov-rews').innerHTML = `<div class="ov-rew">⬡ +${ec}</div><div class="ov-rew">XP +${xpg}</div>`;
    $('ov-upgs').innerHTML = activeUpgrades.map(id => {
      const u = UPGRADES.find(x => x.id === id); return u ? `<div class="ov-upg">${u.icon} ${u.name}</div>` : '';
    }).join('');
    const lv = LEVELS[gLevel - 1];
    const msgs = {
      learn: 'The drone swarm overwhelmed you. Buy power-ups, level up, try again.',
      echo: 'The Echo mastered your patterns. Be unpredictable next run.',
      boss: 'The boss outgunned you. Stock up in the shop, then return.',
      win: 'All 20 levels beaten. Season Two complete. Time to Prestige.'
    };
    const key = isWin ? 'win' : lv?.type === 'boss' ? 'boss' : lv?.type === 'echo' ? 'echo' : 'learn';
    $('ov-msg').textContent = msgs[key];
  }, 1200);
}

/* ══════════════ LOADOUT ══════════════ */
let _sChar = SAVE.equippedChar, _sWpn = SAVE.equippedWeapon;
let prevAnimR = false, prevFrame = 0;

function renderLoadout() {
  _sChar = _sChar || SAVE.equippedChar;
  _sWpn  = _sWpn  || SAVE.equippedWeapon;

  // Characters
  const cl = $('lo-chars'); cl.innerHTML = '';
  Object.values(CHARS).forEach(c => {
    const owned = charUnlocked(c.id);
    const d = document.createElement('div');
    d.className = 'lo-item' + (_sChar === c.id ? ' sel' : '') + (owned ? '' : ' lk');
    // Mini canvas preview
    const cv = document.createElement('canvas');
    cv.width = 38; cv.height = 38; cv.className = 'lo-mini';
    const cx2 = cv.getContext('2d');
    if (c.draw) c.draw(cx2, 19, 19, 14, 0, 'default', { x: 1, y: 0 });
    d.appendChild(cv);
    const info = document.createElement('div'); info.style.flex = '1'; info.style.minWidth = '0';
    info.innerHTML = `<div class="lo-iname" style="color:${c.color}">${c.name}</div><div class="lo-idesc">${c.stats.hp}HP · ${c.stats.spd}SPD · ${c.stats.sh}SH</div>`;
    d.appendChild(info);
    const badge = document.createElement('div'); badge.className = 'lo-badge';
    badge.textContent = owned ? '' : c.unlock === 'battlepass' ? '🎫 BP' : '🔒';
    d.appendChild(badge);
    if (owned) d.onclick = () => { _sChar = c.id; renderLoadout(); playSFX('navigate'); };
    cl.appendChild(d);
  });

  // Weapons
  const wl = $('lo-wpns'); wl.innerHTML = '';
  Object.values(WEAPONS).forEach(w => {
    const owned = wpnUnlocked(w.id);
    const d = document.createElement('div');
    d.className = 'lo-item' + (_sWpn === w.id ? ' sel' : '') + (owned ? '' : ' lk');
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:22px;width:38px;text-align:center;flex-shrink:0';
    icon.textContent = '🔫'; d.appendChild(icon);
    const info = document.createElement('div'); info.style.flex = '1'; info.style.minWidth = '0';
    const lockNote = !owned ? (w.unlock === 'battlepass' ? ` [BP T${w.bpTier}]` : w.unlock === 'lv5' ? ' [Lv5]' : w.unlock === 'lv10' ? ' [Lv10]' : w.unlock === 'lv15' ? ' [Lv15]' : w.unlock === 'gems' ? ` [💠${w.price}]` : '') : '';
    info.innerHTML = `<div class="lo-iname" style="color:${w.bc}">${w.name}</div><div class="lo-idesc">${w.desc}${lockNote} · DMG:${w.dmg} AMMO:${w.maxAmmo}</div>`;
    d.appendChild(info);
    if (owned) d.onclick = () => { _sWpn = w.id; renderLoadout(); playSFX('navigate'); };
    wl.appendChild(d);
  });

  // Live preview
  updatePreview();
}

function updatePreview() {
  const ch = CHARS[_sChar] || CHARS.ghost;
  const pv = document.getElementById('prev-cv');
  if (!pv) return;
  const pvctx = pv.getContext('2d');
  pvctx.clearRect(0, 0, 158, 158);
  if (ch.draw) ch.draw(pvctx, 79, 79, 38, prevFrame, 'default', { x: Math.cos(prevFrame * 0.022), y: Math.sin(prevFrame * 0.022) });
  $('lo-pname').textContent = ch.name;
  $('lo-passive').textContent = ch.passive;
  $('ps-hp').style.width  = (ch.stats.hp / 1.55) + '%';
  $('ps-spd').style.width = ch.stats.spd + '%';
  $('ps-sh').style.width  = (ch.stats.sh / 1.2) + '%';
  $('ps-dmg').style.width = ch.stats.dmg + '%';
}

function animPrev() {
  if (!prevAnimR) return;
  prevFrame++;
  updatePreview();
  requestAnimationFrame(animPrev);
}

/* ══════════════ LEVELS PAGE ══════════════ */
function renderLevels() {
  const grid = $('lvs-grid'); if (!grid) return;
  grid.innerHTML = '';
  LEVELS.forEach(lv => {
    // We'll track "done" via simple heuristic — prestige > 0 means finished, or could store in save
    const isDone = SAVE.prestige > 0 && lv.n <= 20;
    const isCurr = false; // Could track this in SAVE
    const isLocked = false; // All visible
    const typeClass = { learn: 'lct-learn', echo: 'lct-echo', boss: 'lct-boss' }[lv.type] || 'lct-learn';
    const typeLabel = { learn: '👊 ELIMINATE', echo: '🔴 ECHO', boss: '💀 BOSS' }[lv.type] || 'FIGHT';
    const drones = lv.drones > 0 ? `${lv.drones} drones` : '';
    const poolStr = lv.pool.length > 0 ? [...new Set(lv.pool)].join(', ') : '';
    const bossStr = lv.boss ? `${lv.boss.name} · ${lv.boss.phases} phases · ${lv.boss.hp.toLocaleString()} HP` : '';
    const echoStr = lv.echoAdapt ? `Echo adapt: ${Math.round(lv.echoAdapt * 100)}%` : '';
    const card = document.createElement('div');
    card.className = 'lv-card' + (isDone ? ' done' : isCurr ? ' current' : isLocked ? ' locked' : '');
    card.style.borderTopColor = lv.col;
    card.innerHTML = `
      <div class="lv-card-n">LEVEL ${lv.n} / 20</div>
      <div class="lv-card-name" style="color:${lv.col}">${lv.name}</div>
      <div class="lv-card-type ${typeClass}">${typeLabel}</div>
      <div class="lv-card-info">${bossStr || drones}${poolStr ? '<br><span style="opacity:.6">' + poolStr + '</span>' : ''}${echoStr ? '<br>' + echoStr : ''}</div>
      ${isDone ? '<div class="lv-card-done">✓</div>' : ''}
      <div class="lv-card-bar" style="background:${lv.col}55"></div>
    `;
    grid.appendChild(card);
  });
}

/* ══════════════ SHOP ══════════════ */
let currentShopTab = 'skins';
function shTab(cat, tabEl) {
  currentShopTab = cat;
  document.querySelectorAll('#sh-tabs .tab').forEach(t => t.classList.remove('on'));
  if (tabEl) tabEl.classList.add('on');
  const grid = $('sh-grid'); grid.innerHTML = '';

  let items = [];
  if (cat === 'skins') {
    items = Object.values(SKINS).map(s => ({ ...s, _cat: 'skins' }));
  } else if (cat === 'weapons') {
    items = Object.values(WEAPONS)
      .filter(w => w.price > 0 && w.unlock !== 'battlepass')
      .map(w => ({ id: w.id, name: w.name, price: w.price, currency: w.unlock === 'gems' ? 'gems' : 'coins', desc: w.desc, _cat: 'weapons', _bc: w.bc }));
  } else if (cat === 'powerups') {
    items = POWERUPS.map(p => ({ ...p, _cat: 'powerups' }));
  }

  items.forEach(item => {
    const owned = SAVE.owned.includes(item.id);
    const cost = item.price || 0;
    const canAfford = item.currency === 'gems' ? SAVE.gems >= cost : SAVE.coins >= cost;
    const d = document.createElement('div');
    d.className = 'sh-card' + (owned ? ' owned' : (!canAfford && cost > 0) ? ' cant' : '');
    const pIcon = item.currency === 'gems' ? '💠' : '⬡';
    const pCol  = item.currency === 'gems' ? '#c770ff' : '#ffd600';
    const priceStr = owned ? 'OWNED' : cost === 0 ? 'FREE' : `${pIcon} ${cost.toLocaleString()}`;

    // Skin canvas preview
    let previewHtml = '';
    if (cat === 'skins') {
      previewHtml = `<canvas class="sh-preview-cv" width="72" height="72" id="sp_${item.id}"></canvas>`;
    } else {
      previewHtml = `<span class="sh-icon">${item.icon || '🔫'}</span>`;
    }
    d.innerHTML = `
      ${previewHtml}
      <div class="sh-name">${item.name}</div>
      <div class="sh-desc">${item.desc || ''}</div>
      <div class="sh-price" style="color:${pCol}">${priceStr}</div>
    `;
    if (!owned && canAfford && cost > 0) d.onclick = () => buyItem(item);
    else if (!owned && cost === 0) d.onclick = () => equipFree(item);
    else if (!owned && !canAfford) d.onclick = () => { playSFX('noMoney'); floatFixed('NOT ENOUGH ' + (item.currency === 'gems' ? 'GEMS' : 'COINS'), '#ff1744'); };
    grid.appendChild(d);

    // Draw skin preview
    if (cat === 'skins') {
      requestAnimationFrame(() => {
        const pvc = document.getElementById('sp_' + item.id); if (!pvc) return;
        const pvctx2 = pvc.getContext('2d');
        pvctx2.clearRect(0, 0, 72, 72);
        const ch = CHARS[SAVE.equippedChar] || CHARS.ghost;
        const oldSkin = SAVE.equippedSkin;
        // Temporarily set skin to draw preview
        if (SAVE.owned.includes(item.id) || item.id === 'default') {
          SAVE.equippedSkin = item.id;
        }
        if (ch.draw) ch.draw(pvctx2, 36, 36, 22, 0, item.id, { x: 1, y: 0 });
        SAVE.equippedSkin = oldSkin;
      });
    }
  });
}

function buyItem(item) {
  if (SAVE.owned.includes(item.id)) return;
  const cost = item.price || 0;
  if (item.currency === 'gems') {
    if (SAVE.gems < cost) { playSFX('noMoney'); return; }
    SAVE.gems -= cost;
  } else {
    if (SAVE.coins < cost) { playSFX('noMoney'); return; }
    SAVE.coins -= cost;
  }
  SAVE.owned.push(item.id);
  sv(); playSFX('buy'); refreshUI();
  floatFixed('✓ ' + item.name + ' UNLOCKED', '#00e676');
  shTab(currentShopTab, null);
}

function equipFree(item) {
  if (!SAVE.owned.includes(item.id)) SAVE.owned.push(item.id);
  sv(); refreshUI(); floatFixed('EQUIPPED: ' + item.name, '#00ffe7');
}

/* ══════════════ BATTLE PASS ══════════════ */
function renderBP() {
  const pct = Math.min(100, (SAVE.bpXp / BP_XP_PER_TIER) * 100);
  const bf = $('bp-xp-bar'); if (bf) bf.style.width = pct + '%';
  const tn = $('bp-tier-n'); if (tn) tn.textContent = SAVE.bpTier;
  const bc2 = $('bp-xp-cur'); if (bc2) bc2.textContent = SAVE.bpXp;
  const bm = $('bp-xp-max'); if (bm) bm.textContent = BP_XP_PER_TIER;
  const bb = $('bp-buy-btn'); if (bb) { bb.textContent = SAVE.bpPremium ? '✓ OWNED' : 'UNLOCK NOW'; bb.disabled = SAVE.bpPremium; }
  const gems = $('bp-gems'); if (gems) gems.textContent = SAVE.gems.toLocaleString();

  const cont = $('bp-content'); if (!cont) return;
  cont.innerHTML = '';

  const makeSection = (label, isPrem) => {
    const title = document.createElement('div');
    title.className = 'bp-section-title';
    title.innerHTML = `<span style="color:${isPrem ? 'var(--violet)' : 'var(--green)'};font-family:Orbitron,monospace;font-size:7px;letter-spacing:3px">${isPrem ? '★ PREMIUM TRACK' : 'FREE TRACK'}</span>`;
    cont.appendChild(title);

    const row = document.createElement('div');
    row.className = 'bp-row';

    BP_TIERS.forEach(tier => {
      const rw = isPrem ? tier.p : tier.f;
      if (!rw) return;

      const unlocked = tier.t <= SAVE.bpTier;
      const claimKey = isPrem ? 'p' + tier.t : String(tier.t);
      const claimed = SAVE.bpClaimed.includes(claimKey);
      const premLocked = isPrem && !SAVE.bpPremium;

      const card = document.createElement('div');
      card.className = 'bp-card' + (premLocked ? ' plk' : claimed ? ' claimed' : unlocked ? ' claimable' : '');

      card.innerHTML = `
        <div class="bp-tier-n">T${tier.t}</div>
        <span class="bp-icon">${rw.i}</span>
        <div class="bp-card-name">${rw.n}</div>
        <div class="bp-flair ${isPrem ? 'bp-flair-p' : 'bp-flair-f'}">${isPrem ? '★' : 'FREE'}</div>
        ${claimed ? '<div class="bp-check">✓</div>' : ''}
      `;
      if (unlocked && !claimed && !premLocked) {
        card.onclick = () => claimBP(tier.t, isPrem, rw);
      }
      row.appendChild(card);
    });
    cont.appendChild(row);
  };

  makeSection('FREE TRACK', false);
  makeSection('PREMIUM TRACK', true);
}

function claimBP(tier, isPrem, rw) {
  const key = isPrem ? 'p' + tier : String(tier);
  if (SAVE.bpClaimed.includes(key)) return;
  SAVE.bpClaimed.push(key);
  playSFX('bpClaim');
  if (rw.t === 'coins')  addCoins(rw.v);
  if (rw.t === 'gems')   addGems(rw.v);
  if (['skin','weapon','char'].includes(rw.t)) { if (!SAVE.owned.includes(rw.v)) SAVE.owned.push(rw.v); }
  if (rw.t === 'trail')  { if (!SAVE.owned.includes(rw.v)) { SAVE.owned.push(rw.v); SAVE.trailId = rw.v; } }
  if (rw.t === 'perm')   { if (!SAVE.permUpgrades.includes(rw.v)) SAVE.permUpgrades.push(rw.v); }
  sv(); refreshUI(); renderBP();
  floatFixed('✓ ' + rw.n, '#ffd600');
}

function buyBP() {
  if (SAVE.bpPremium) { floatFixed('ALREADY OWNED', '#c770ff'); return; }
  if (SAVE.gems < 800) { playSFX('noMoney'); floatFixed('NEED 💠 800 GEMS', '#ff1744'); return; }
  SAVE.gems -= 800; SAVE.bpPremium = true; sv();
  playSFX('buy'); refreshUI(); renderBP();
  floatFixed('★ PREMIUM PASS UNLOCKED!', '#c770ff');
}

/* ══════════════ BOOT ══════════════ */
nav('title');
refreshUI();
