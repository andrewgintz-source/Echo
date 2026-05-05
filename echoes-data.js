/* ═══════════════════════════════════════════════════
   ECHOES — DATA.JS  All static game data
═══════════════════════════════════════════════════ */
'use strict';

/* ── ACCOUNT LEVELS ── */
const LV_NAMES = ['RECRUIT','SOLDIER','VETERAN','SPECIALIST','ELITE','SHADOW','PHANTOM','WRAITH','SPECTRE','VOID WALKER','ECHO MASTER','TRANSCENDENT'];
const LV_XP    = [0,250,600,1100,1800,2700,3900,5400,7200,9400,12000,15500];
const xpFor    = lv => LV_XP[Math.min(lv - 1, LV_XP.length - 1)] || 15500;
const lvName   = lv => LV_NAMES[Math.min(lv - 1, LV_NAMES.length - 1)];
const lvBonus  = lv => ({ dmg: 1 + lv * 0.022, spd: 1 + lv * 0.01, hp: lv * 3, sh: lv * 2 });

/* ── PRESTIGE MULTIPLIERS ── */
const PM = () => {
  const p = SAVE.prestige;
  return { dmg: 1 + p * 0.15, spd: 1 + p * 0.07, coins: 1 + p * 0.22, xp: 1 + p * 0.18, hp: p * 15 };
};

/* ═══════════════ CHARACTERS ═══════════════ */
const CHARS = {
  ghost: {
    id: 'ghost', name: 'GHOST', shape: 'circle', unlock: 'free',
    color: '#00ffe7', glow: '#00ffe7',
    stats: { hp: 95, spd: 110, sh: 55, dmg: 100 },
    passive: 'GHOST STEP: Dash → 0.6s full invincibility + phantom decoy for 2.5s.',
    draw(ctx, x, y, r, fr, skin) {
      const c = skinColor(skin, this.color, fr);
      ctx.shadowBlur = 22; ctx.shadowColor = c;
      // Outer ring pulse
      const pulse = Math.sin(fr * 0.07) * 3;
      ctx.strokeStyle = c + '33'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r + 10 + pulse, 0, Math.PI * 2); ctx.stroke();
      // Translucent body
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, '#ffffff88'); g.addColorStop(0.4, c + 'cc'); g.addColorStop(1, c + '44');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      // Void eye
      ctx.fillStyle = '#020014dd'; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.15, 0, Math.PI * 2); ctx.fill();
      // Orbiting particles
      for (let i = 0; i < 3; i++) {
        const a = fr * 0.045 + i * (Math.PI * 2 / 3);
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  },
  blade: {
    id: 'blade', name: 'BLADE', shape: 'triangle', unlock: 'free',
    color: '#ff6d00', glow: '#ff6d00',
    stats: { hp: 80, spd: 128, sh: 28, dmg: 115 },
    passive: 'SLIPSTREAM: Kills grant +8% speed for 3s (stacks ×5).',
    draw(ctx, x, y, r, fr, skin, face) {
      const c = skinColor(skin, this.color, fr);
      const a = Math.atan2(face ? face.y : 0, face ? face.x : 1) - Math.PI / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.shadowBlur = 24; ctx.shadowColor = c;
      // Outer energy glow
      ctx.strokeStyle = c + '44'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -(r + 10)); ctx.lineTo(r + 8, r + 7); ctx.lineTo(-(r + 8), r + 7); ctx.closePath(); ctx.stroke();
      // Main body gradient
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#fff5e0'); g.addColorStop(0.35, c); g.addColorStop(1, '#3a1200');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.05); ctx.lineTo(r * 0.88, r * 0.78); ctx.lineTo(-r * 0.88, r * 0.78); ctx.closePath(); ctx.fill();
      // Center energy line
      ctx.strokeStyle = 'rgba(255,255,220,0.55)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.38); ctx.stroke();
      // Speed fire trail
      if (face && (Math.abs(face.x) > 0.1 || Math.abs(face.y) > 0.1)) {
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.15 - i * 0.04;
          ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(0, r + i * 5); ctx.lineTo(-4 - i, r + 12 + i * 8); ctx.lineTo(4 + i, r + 12 + i * 8); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.shadowBlur = 0; ctx.restore();
    }
  },
  titan: {
    id: 'titan', name: 'TITAN', shape: 'hexagon', unlock: 'coins', price: 1200,
    color: '#2979ff', glow: '#2979ff',
    stats: { hp: 155, spd: 72, sh: 100, dmg: 90 },
    passive: 'FORTRESS: Below 30% HP → 65% less damage. Shield regens 6/sec always.',
    draw(ctx, x, y, r, fr, skin) {
      const c = skinColor(skin, this.color, fr);
      ctx.save(); ctx.translate(x, y);
      ctx.shadowBlur = 22; ctx.shadowColor = c;
      // Outer armor ring
      ctx.strokeStyle = c + '44'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 6; ctx.lineTo(Math.cos(a) * (r + 10), Math.sin(a) * (r + 10)); }
      ctx.closePath(); ctx.stroke();
      // Body gradient
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#a0c4ff'); g.addColorStop(0.5, c); g.addColorStop(1, '#0a1a4a');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      // Plate divisions
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 - Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-r * 0.2, -r * 0.2, r * 0.4, r * 0.4);
      ctx.shadowBlur = 0; ctx.restore();
    }
  },
  wraith: {
    id: 'wraith', name: 'WRAITH', shape: 'diamond', unlock: 'coins', price: 1800,
    color: '#c770ff', glow: '#c770ff',
    stats: { hp: 82, spd: 124, sh: 38, dmg: 112 },
    passive: 'VOID STEP: Kills reduce ALL cooldowns by 0.6s. Blink range +80px.',
    draw(ctx, x, y, r, fr, skin) {
      const c = skinColor(skin, this.color, fr);
      ctx.save(); ctx.translate(x, y); ctx.rotate(fr * 0.016);
      ctx.shadowBlur = 24; ctx.shadowColor = c;
      // Orbiting mini-diamonds
      for (let i = 0; i < 3; i++) {
        const a = fr * 0.025 + i * (Math.PI * 2 / 3);
        const ox = Math.cos(a) * (r + 13), oy = Math.sin(a) * (r + 13);
        ctx.fillStyle = c + '88';
        ctx.beginPath(); ctx.moveTo(ox, oy - 4); ctx.lineTo(ox + 4, oy); ctx.lineTo(ox, oy + 4); ctx.lineTo(ox - 4, oy); ctx.closePath(); ctx.fill();
      }
      // Main diamond
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#f0d0ff'); g.addColorStop(0.4, c); g.addColorStop(1, '#1a0030');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 0.75, 0); ctx.lineTo(0, r * 1.1); ctx.lineTo(-r * 0.75, 0); ctx.closePath(); ctx.fill();
      // Crack
      ctx.strokeStyle = 'rgba(3,0,16,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.38); ctx.lineTo(r * 0.08, 0); ctx.lineTo(-r * 0.14, r * 0.28); ctx.stroke();
      ctx.shadowBlur = 0; ctx.restore();
    }
  },
  nova: {
    id: 'nova', name: 'NOVA', shape: 'star', unlock: 'coins', price: 2400,
    color: '#ffd600', glow: '#ffd600',
    stats: { hp: 98, spd: 102, sh: 58, dmg: 128 },
    passive: 'STELLAR: 5+ kill streaks deal +45% dmg. Ultimate charges 55% faster.',
    draw(ctx, x, y, r, fr, skin) {
      const c = skinColor(skin, this.color, fr);
      ctx.save(); ctx.translate(x, y); ctx.rotate(fr * 0.014);
      ctx.shadowBlur = 28; ctx.shadowColor = c;
      // Spike corona
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = r + 14 + Math.sin(fr * 0.08 + i) * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
        ctx.lineTo(Math.cos(a) * spike, Math.sin(a) * spike);
        ctx.strokeStyle = c + '88'; ctx.lineWidth = 2; ctx.stroke();
      }
      // Star body
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#fffde0'); g.addColorStop(0.35, c); g.addColorStop(1, '#5a4000');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 12;
        ctx.lineTo(Math.cos(a) * (i % 2 === 0 ? r : r * 0.45), Math.sin(a) * (i % 2 === 0 ? r : r * 0.45));
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(3,0,16,0.55)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3 + Math.sin(fr * 0.08) * 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
    }
  },
  voidwalker: {
    id: 'voidwalker', name: 'VOID WALKER', shape: 'hexagon_void', unlock: 'battlepass', bpTier: 30,
    color: '#ff1744', glow: '#ff1744',
    stats: { hp: 100, spd: 108, sh: 62, dmg: 120 },
    passive: 'QUANTUM: Every 8th shot pierces ALL. Blink tears a 25dmg void rift. +20% all stats.',
    draw(ctx, x, y, r, fr, skin) {
      const c = skinColor(skin, this.color, fr);
      ctx.save(); ctx.translate(x, y); ctx.rotate(fr * 0.01);
      ctx.shadowBlur = 28; ctx.shadowColor = c;
      // Void tendrils
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + fr * 0.03;
        const len = r + 20 + Math.sin(fr * 0.09 + i) * 5;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.strokeStyle = c + '33'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // Outer hex glow
      ctx.strokeStyle = c + '44'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9)); }
      ctx.closePath(); ctx.stroke();
      // Body
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#ff8fab'); g.addColorStop(0.45, c); g.addColorStop(1, '#150008');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill();
      // Corruption cracks
      ctx.strokeStyle = 'rgba(3,0,16,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.1); ctx.lineTo(r * 0.05, r * 0.2); ctx.lineTo(r * 0.28, -r * 0.15); ctx.stroke();
      ctx.fillStyle = 'rgba(3,0,16,0.9)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.restore();
    }
  }
};

/* ═══════════════ SKINS ═══════════════ */
const SKINS = {
  default:  { id: 'default',  name: 'DEFAULT',      price: 0,    currency: 'coins', unlock: 'free',       desc: 'Standard issue.',             fn: (b) => b },
  crimson:  { id: 'crimson',  name: 'CRIMSON',       price: 500,  currency: 'coins', unlock: 'coins',      desc: 'Blood-red energy.',           fn: () => '#ff1744' },
  neon:     { id: 'neon',     name: 'NEON PULSE',    price: 700,  currency: 'coins', unlock: 'coins',      desc: 'Electric lime-green.',        fn: () => '#00e676' },
  void_s:   { id: 'void_s',   name: 'VOID CRACK',    price: 900,  currency: 'coins', unlock: 'coins',      desc: 'Deep void purple.',           fn: () => '#7c3aff' },
  gold_s:   { id: 'gold_s',   name: 'GOLD',          price: 1400, currency: 'coins', unlock: 'coins',      desc: 'Solid noble gold.',           fn: () => '#ffd600' },
  prismatic:{ id: 'prismatic',name: 'PRISMATIC',     price: 450,  currency: 'gems',  unlock: 'gems',       desc: 'Rainbow phase shift.',        fn: (b, fr) => `hsl(${(fr * 2.2) % 360},100%,62%)` },
  eclipse:  { id: 'eclipse',  name: 'ECLIPSE',       price: 650,  currency: 'gems',  unlock: 'gems',       desc: 'Dark matter, light halo.',    fn: () => '#2a0080' },
  bp_fire:  { id: 'bp_fire',  name: 'INFERNO',       price: 0,    currency: 'free',  unlock: 'battlepass', bpTier: 8,  desc: 'Blazing fire.',   fn: (b, fr) => `hsl(${18 + Math.sin(fr * 0.1) * 16},100%,52%)` },
  bp_king:  { id: 'bp_king',  name: 'ECHO KING',     price: 0,    currency: 'free',  unlock: 'battlepass', bpTier: 50, desc: 'The rarest skin.',fn: (b, fr) => `hsl(${(fr * 3.1) % 360},72%,42%)` },
};
function skinColor(id, base, fr = 0) {
  const sk = SKINS[id] || SKINS.default;
  if (SAVE.owned.includes(id)) return sk.fn(base, fr);
  return base;
}

/* ═══════════════ WEAPONS ═══════════════ */
const WEAPONS = {
  pistol:  { id: 'pistol',  name: 'PULSE PISTOL',   unlock: 'free',       price: 0,    dmg: 16,  fr: 130,  maxAmmo: 15, res: 90,  rl: 1.3,  bspd: 680, bs: 4,  bc: '#00ffe7', spread: 0,   pellets: 1, desc: 'Fast & reliable.',           sfx: 'shoot'  },
  shotgun: { id: 'shotgun', name: 'SCATTER CANNON',  unlock: 'lv5',        price: 1000, dmg: 11,  fr: 700,  maxAmmo: 8,  res: 56,  rl: 2.0,  bspd: 520, bs: 5,  bc: '#ff6d00', spread: 0.34, pellets: 6, desc: '6 pellets. Devastating close.', sfx: 'shotgun' },
  laser:   { id: 'laser',   name: 'PHASE LASER',     unlock: 'lv10',       price: 1500, dmg: 7,   fr: 52,   maxAmmo: 120, res: 999, rl: 0.65, bspd: 960, bs: 2.5,bc: '#ff1744', spread: 0,   pellets: 1, isLaser: true, desc: 'Beam. Massive DPS.',  sfx: 'laser'  },
  sniper:  { id: 'sniper',  name: 'VOID SNIPER',     unlock: 'lv15',       price: 2000, dmg: 100, fr: 1280, maxAmmo: 6,  res: 30,  rl: 2.7,  bspd: 1250,bs: 7,  bc: '#c770ff', spread: 0,   pellets: 1, desc: '100 dmg per shot.',          sfx: 'sniper' },
  plasma:  { id: 'plasma',  name: 'PLASMA CANNON',   unlock: 'gems',       price: 350,  dmg: 40,  fr: 510,  maxAmmo: 10, res: 50,  rl: 2.1,  bspd: 460, bs: 11, bc: '#d040fb', spread: 0,   pellets: 1, isPlasma: true, desc: 'AoE blast.',       sfx: 'plasma' },
  vblade:  { id: 'vblade',  name: 'VOID BLADE',      unlock: 'battlepass', price: 0,    dmg: 32,  fr: 270,  maxAmmo: 25, res: 150, rl: 1.5,  bspd: 600, bs: 13, bc: '#7c00ff', spread: 0.07, pellets: 1, isPierce: true, desc: 'Slashes. Pierce all.', sfx: 'blade' },
};
const wpnUnlocked = id => {
  const w = WEAPONS[id];
  if (w.unlock === 'free') return true;
  if (w.unlock === 'gems' || w.unlock === 'battlepass') return SAVE.owned.includes(id);
  if (w.unlock === 'lv5')  return SAVE.lv >= 5  || SAVE.owned.includes(id);
  if (w.unlock === 'lv10') return SAVE.lv >= 10 || SAVE.owned.includes(id);
  if (w.unlock === 'lv15') return SAVE.lv >= 15 || SAVE.owned.includes(id);
  return SAVE.owned.includes(id);
};
const charUnlocked = id => {
  const c = CHARS[id];
  if (c.unlock === 'free') return true;
  if (c.unlock === 'battlepass') return SAVE.owned.includes(id);
  return SAVE.owned.includes(id);
};

/* ═══════════════ 19 UPGRADES ═══════════════ */
const UPGRADES = [
  { id: 'dmg',    name: 'OVERLOAD',      icon: '🔥', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Damage +48%. Crits deal ×2 when enemy is below 30% HP.',       fn: p => { p.dmg *= 1.48; p.critLow = true; } },
  { id: 'pierce', name: 'PHASE ROUND',   icon: '💠', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Bullets pierce through up to 3 enemies.',                       fn: p => { p.pierce = true; } },
  { id: 'rapid',  name: 'RAPID FIRE',    icon: '⚡', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Fire rate +95%. Slight damage reduction.',                      fn: p => { p.frMult *= 0.15; p.dmg *= 0.8; } },
  { id: 'explode',name: 'VOID CHARGE',   icon: '💥', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Bullets explode on impact — 58px AoE.',                         fn: p => { p.explosive = true; } },
  { id: 'homing', name: 'MAGNET PULL',   icon: '🧲', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Bullets curve toward nearest enemy automatically.',             fn: p => { p.homing = true; } },
  { id: 'barrage',name: 'BARRAGE',       icon: '🌊', cat: 'OFFENSE',  cc: '#ff6d00', desc: 'Every 5th shot fires a burst of 8 bullets in a ring.',          fn: p => { p.barrage = true; p.barCount = 0; } },
  { id: 'hp',     name: 'BIOTIC WEAVE',  icon: '❤️', cat: 'DEFENSE',  cc: '#00e676', desc: 'Max HP +70. Restore 45 HP immediately.',                        fn: p => { p.maxHp += 70; p.hp = Math.min(p.hp + 45, p.maxHp); } },
  { id: 'shield', name: 'PHASE SHIELD',  icon: '🛡️', cat: 'DEFENSE',  cc: '#00e676', desc: 'Max Shield +80. Begins passive regeneration.',                  fn: p => { p.maxSh += 80; p.sh = Math.min(p.sh + 55, p.maxSh); p.shRegen = true; } },
  { id: 'regen',  name: 'NANITE REPAIR', icon: '🩺', cat: 'DEFENSE',  cc: '#00e676', desc: 'Regenerate 4.5 HP per second.',                                 fn: p => { p.hpRegen = true; p.hpRegenRate = 4.5; } },
  { id: 'lastst', name: 'LAST STAND',    icon: '🏰', cat: 'DEFENSE',  cc: '#00e676', desc: 'Below 25% HP, take 60% reduced damage.',                        fn: p => { p.lastStand = true; } },
  { id: 'thorns', name: 'THORNS',        icon: '🌵', cat: 'DEFENSE',  cc: '#00e676', desc: 'Return 28% of damage received back to the attacker.',           fn: p => { p.thorns = true; } },
  { id: 'dashcd', name: 'GHOST STRIDE',  icon: '👟', cat: 'MOBILITY', cc: '#2979ff', desc: 'Dash cooldown −4s. Gain 1 extra charge.',                       fn: p => { p.dashCd = Math.max(1.5, p.dashCd - 4); p.dashMax++; } },
  { id: 'blinkcd',name: 'PHASE WALK',    icon: '🌀', cat: 'MOBILITY', cc: '#2979ff', desc: 'Blink cooldown −4s. Range +120px.',                             fn: p => { p.blinkCd = Math.max(2, p.blinkCd - 4); p.blinkRange += 120; } },
  { id: 'speed',  name: 'OVERDRIVE',     icon: '💨', cat: 'MOBILITY', cc: '#2979ff', desc: 'Movement speed +34%.',                                           fn: p => { p.speed *= 1.34; } },
  { id: 'vampire',name: 'LIFESTEAL',     icon: '🧛', cat: 'SPECIAL',  cc: '#ffd600', desc: '10 HP per kill. 3 HP per hit landed.',                          fn: p => { p.vampire = true; } },
  { id: 'aura',   name: 'VOID AURA',     icon: '✨', cat: 'SPECIAL',  cc: '#ffd600', desc: 'Pulse every 3s slows all enemies 55% for 2.5s.',                fn: p => { p.aura = true; p.auraT = 0; } },
  { id: 'counter',name: 'COUNTER ECHO',  icon: '🪞', cat: 'SPECIAL',  cc: '#ffd600', desc: 'When Echo hits you, Echo loses 22% max HP.',                    fn: p => { p.counterEcho = true; } },
  { id: 'ultupg', name: 'NOVA BLAST',    icon: '☀️', cat: 'SPECIAL',  cc: '#ffd600', desc: 'Ultimate radius +90%. Stuns all targets for 2.5s.',             fn: p => { p.ultUpg = true; } },
  { id: 'twin',   name: 'TWIN SHOT',     icon: '🔀', cat: 'SPECIAL',  cc: '#ffd600', desc: 'Fire 2 bullets simultaneously every shot.',                     fn: p => { p.twin = true; } },
];

/* ═══════════════ 20 LEVELS ═══════════════ */
const LEVELS = [
  { n:1,  name:'MEDULLA',      col:'#00ffe7', type:'learn', drones:5,  pool:['chase'] },
  { n:2,  name:'SYNAPSE',      col:'#00ffe7', type:'learn', drones:8,  pool:['chase','shoot'] },
  { n:3,  name:'CORTEX',       col:'#4da6ff', type:'learn', drones:12, pool:['chase','shoot'] },
  { n:4,  name:'CEREBELLUM',   col:'#c770ff', type:'echo',  drones:4,  pool:['chase','shoot'],          echoAdapt:0.22 },
  { n:5,  name:'LIMBIC',       col:'#ff6d00', type:'boss',  drones:0,  pool:[],                         boss:{ name:'VOID SENTRY', hp:900,  phases:2 } },
  { n:6,  name:'HIPPOCAMPUS',  col:'#c770ff', type:'learn', drones:14, pool:['chase','shoot','bomb'] },
  { n:7,  name:'AMYGDALA',     col:'#ff6d00', type:'echo',  drones:5,  pool:['chase','shoot','bomb','orbit'],  echoAdapt:0.45 },
  { n:8,  name:'PREFRONTAL',   col:'#ff6d00', type:'learn', drones:17, pool:['chase','shoot','bomb','orbit'] },
  { n:9,  name:'THALAMUS',     col:'#ff6d00', type:'echo',  drones:8,  pool:['chase','shoot','bomb','orbit','sniper'], echoAdapt:0.62 },
  { n:10, name:'VOID GATE',    col:'#ffd600', type:'boss',  drones:4,  pool:['chase','shoot'],          boss:{ name:'ECHO PRIME',    hp:2100, phases:3 } },
  { n:11, name:'NEOCORTEX',    col:'#c770ff', type:'learn', drones:19, pool:['chase','shoot','bomb','orbit','sniper','tank'] },
  { n:12, name:'SINGULARITY',  col:'#ff1744', type:'echo',  drones:11, pool:['chase','shoot','bomb','orbit','sniper','tank'], echoAdapt:0.75 },
  { n:13, name:'FRACTURE',     col:'#ff1744', type:'learn', drones:22, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth'] },
  { n:14, name:'COLLAPSE',     col:'#ff1744', type:'echo',  drones:13, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth','elite'], echoAdapt:0.83 },
  { n:15, name:'VOID CORE',    col:'#ffd600', type:'boss',  drones:6,  pool:['shoot','sniper','elite'],  boss:{ name:'NEURAL TITAN',  hp:4000, phases:4 } },
  { n:16, name:'TRANSCEND',    col:'#ff1744', type:'learn', drones:23, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth','elite'] },
  { n:17, name:'ECHO STORM',   col:'#ff1744', type:'echo',  drones:14, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth','elite'], echoAdapt:0.89 },
  { n:18, name:'OBLIVION',     col:'#ff1744', type:'learn', drones:27, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth','elite'] },
  { n:19, name:'VOID APEX',    col:'#ff1744', type:'echo',  drones:18, pool:['chase','shoot','bomb','orbit','sniper','tank','stealth','elite'], echoAdapt:0.95 },
  { n:20, name:'ECHO KING',    col:'#ffd600', type:'boss',  drones:10, pool:['shoot','elite','sniper'],  boss:{ name:'THE ECHO KING', hp:8500, phases:5, isFinal:true }, echoAdapt:0.98 },
];

/* ═══════════════ BATTLE PASS ═══════════════ */
const BP_XP_PER_TIER = 600;
function buildBP() {
  const free = {
    1:{i:'⬡',n:'500 Coins',t:'coins',v:500}, 3:{i:'🩺',n:'Regen Perk',t:'perm',v:'regen'},
    5:{i:'⬡',n:'800 Coins',t:'coins',v:800}, 8:{i:'🔥',n:'INFERNO SKIN',t:'skin',v:'bp_fire'},
    10:{i:'⬡',n:'1,200 Coins',t:'coins',v:1200}, 12:{i:'💎',n:'100 Gems',t:'gems',v:100},
    15:{i:'⬡',n:'1,500 Coins',t:'coins',v:1500}, 18:{i:'⚡',n:'Speed Boost',t:'perm',v:'speed_boost'},
    20:{i:'⬡',n:'2,000 Coins',t:'coins',v:2000}, 22:{i:'💎',n:'200 Gems',t:'gems',v:200},
    25:{i:'⬡',n:'2,500 Coins',t:'coins',v:2500}, 28:{i:'🌹',n:'Rose Trail',t:'trail',v:'trail_rose'},
    30:{i:'⬡',n:'3,000 Coins',t:'coins',v:3000}, 32:{i:'💎',n:'300 Gems',t:'gems',v:300},
    35:{i:'⬡',n:'3,500 Coins',t:'coins',v:3500}, 38:{i:'💨',n:'+5% Speed',t:'hint',v:''},
    40:{i:'⬡',n:'4,000 Coins',t:'coins',v:4000}, 42:{i:'💎',n:'400 Gems',t:'gems',v:400},
    45:{i:'⬡',n:'5,000 Coins',t:'coins',v:5000}, 50:{i:'🏆',n:'CHAMPION TITLE',t:'title',v:'champion'}
  };
  const prem = {
    1:{i:'💎',n:'200 Gems',t:'gems',v:200},   2:{i:'⬡',n:'600 Coins',t:'coins',v:600},
    4:{i:'✨',n:'Gold Trail',t:'trail',v:'trail_gold'}, 5:{i:'💎',n:'300 Gems',t:'gems',v:300},
    6:{i:'⬡',n:'1,000 Coins',t:'coins',v:1000}, 7:{i:'🌵',n:'Thorns Perk',t:'perm',v:'thorns'},
    9:{i:'💎',n:'400 Gems',t:'gems',v:400},   10:{i:'⬡',n:'1,800 Coins',t:'coins',v:1800},
    11:{i:'💜',n:'Void Trail',t:'trail',v:'trail_void'}, 13:{i:'💎',n:'500 Gems',t:'gems',v:500},
    14:{i:'⬡',n:'2,000 Coins',t:'coins',v:2000}, 16:{i:'💎',n:'600 Gems',t:'gems',v:600},
    17:{i:'⬡',n:'2,200 Coins',t:'coins',v:2200}, 19:{i:'⚡',n:'Rapid Perk',t:'perm',v:'rapid'},
    20:{i:'💎',n:'700 Gems',t:'gems',v:700},   21:{i:'⬡',n:'2,400 Coins',t:'coins',v:2400},
    23:{i:'💎',n:'800 Gems',t:'gems',v:800},   24:{i:'⬡',n:'2,600 Coins',t:'coins',v:2600},
    25:{i:'⚔️',n:'VOID BLADE',t:'weapon',v:'vblade'},
    26:{i:'💎',n:'900 Gems',t:'gems',v:900},   27:{i:'⬡',n:'2,800 Coins',t:'coins',v:2800},
    29:{i:'💎',n:'1,000 Gems',t:'gems',v:1000}, 30:{i:'🌌',n:'VOID WALKER',t:'char',v:'voidwalker'},
    31:{i:'⬡',n:'3,000 Coins',t:'coins',v:3000}, 33:{i:'💎',n:'1,100 Gems',t:'gems',v:1100},
    34:{i:'⬡',n:'3,200 Coins',t:'coins',v:3200}, 36:{i:'💎',n:'1,200 Gems',t:'gems',v:1200},
    37:{i:'⬡',n:'3,500 Coins',t:'coins',v:3500}, 39:{i:'🧛',n:'Vampire Perk',t:'perm',v:'vampire'},
    40:{i:'💎',n:'1,400 Gems',t:'gems',v:1400}, 41:{i:'⬡',n:'4,000 Coins',t:'coins',v:4000},
    43:{i:'💎',n:'1,600 Gems',t:'gems',v:1600}, 44:{i:'⬡',n:'4,500 Coins',t:'coins',v:4500},
    46:{i:'💎',n:'1,800 Gems',t:'gems',v:1800}, 47:{i:'⬡',n:'5,000 Coins',t:'coins',v:5000},
    48:{i:'💥',n:'Void Charge',t:'perm',v:'explode'}, 49:{i:'💎',n:'2,000 Gems',t:'gems',v:2000},
    50:{i:'👑',n:'ECHO KING SKIN',t:'skin',v:'bp_king'}
  };
  const tiers = [];
  for (let i = 1; i <= 50; i++) tiers.push({ t: i, f: free[i] || null, p: prem[i] || null });
  return tiers;
}
const BP_TIERS = buildBP();

/* ═══════════════ SHOP POWER-UPS ═══════════════ */
const POWERUPS = [
  { id:'pu_sh',      name:'BATTLE READY',   icon:'🛡️', price:1500, currency:'coins', desc:'Start every match with +55 bonus shield.' },
  { id:'pu_coin',    name:'COIN MAGNET',     icon:'💰', price:2500, currency:'coins', desc:'+30% coins earned from all kills & loot.' },
  { id:'pu_xp',      name:'NEURAL LINK',     icon:'🧠', price:2200, currency:'coins', desc:'+35% account XP per match.' },
  { id:'pu_ult',     name:'OVERCHARGE',      icon:'⚡', price:2800, currency:'coins', desc:'Ultimate charges 40% faster every match.' },
  { id:'pu_nanite',  name:'NANITE CORE',     icon:'💉', price:3000, currency:'coins', desc:'HP & Shield regeneration every match.' },
  { id:'pu_revive',  name:'LAST BREATH',     icon:'❤️‍🔥',price:4500, currency:'coins', desc:'Survive one fatal hit at 1 HP per match.' },
  { id:'pu_dash2',   name:'DOUBLE DASH',     icon:'👟', price:2000, currency:'coins', desc:'Start every match with 2 dash charges.' },
  { id:'pu_thorns_p',name:'REFLECT AURA',    icon:'🌵', price:3500, currency:'coins', desc:'Return 25% of damage back to attacker.' },
  { id:'pu_bpxp',    name:'XP ACCELERATOR', icon:'🚀', price:500,  currency:'gems',  desc:'+60% Battle Pass XP per match.' },
  { id:'pu_vampire_p',name:'LIFESTEAL',      icon:'🧛', price:3200, currency:'coins', desc:'10 HP per kill · 3 HP per shot landed.' },
];

/* ═══════════════ SAVE ═══════════════ */
const SAVE_KEY = 'echoes_v4';
let SAVE = loadSave();
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return {
      coins: d.coins || 500,
      gems: d.gems || 0,
      lv: d.lv || 1,
      xp: d.xp || 0,
      prestige: d.prestige || 0,
      owned: d.owned || ['ghost', 'blade', 'pistol', 'default'],
      equippedChar: d.equippedChar || 'ghost',
      equippedWeapon: d.equippedWeapon || 'pistol',
      equippedSkin: d.equippedSkin || 'default',
      bpTier: d.bpTier || 1,
      bpXp: d.bpXp || 0,
      bpPremium: d.bpPremium || false,
      bpClaimed: d.bpClaimed || [],
      permUpgrades: d.permUpgrades || [],
      trailId: d.trailId || null,
    };
  } catch {
    return { coins:500, gems:0, lv:1, xp:0, prestige:0, owned:['ghost','blade','pistol','default'], equippedChar:'ghost', equippedWeapon:'pistol', equippedSkin:'default', bpTier:1, bpXp:0, bpPremium:false, bpClaimed:[], permUpgrades:[], trailId:null };
  }
}
const sv = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch {} };
