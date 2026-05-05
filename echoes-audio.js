/* ═══════════════════════════════════════════════════
   ECHOES — AUDIO.JS
═══════════════════════════════════════════════════ */
'use strict';

let _AC;
const AC = () => { if (!_AC) try { _AC = new (window.AudioContext || window.webkitAudioContext)(); } catch {} return _AC; };
const rez = () => { const a = AC(); if (a && a.state === 'suspended') a.resume(); };
['click','keydown','mousedown'].forEach(e => document.addEventListener(e, rez, { passive: true }));

const T = (f, t, d, v = 0.07, det = 0, del = 0) => {
  const a = AC(); if (!a) return;
  setTimeout(() => {
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = t; o.frequency.value = f;
      if (det) o.detune.value = det;
      g.gain.setValueAtTime(v, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + Math.max(d, 0.04));
      o.start(); o.stop(a.currentTime + d + 0.01);
    } catch {}
  }, del * 1000);
};
const N = (d, v = 0.05, fr = 600) => {
  const a = AC(); if (!a) return;
  try {
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * d), a.sampleRate);
    const da = buf.getChannelData(0);
    for (let i = 0; i < da.length; i++) da[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = 1.2;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(v, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    s.start(); s.stop(a.currentTime + d + 0.01);
  } catch {}
};

const SFX = {
  shoot:    () => { T(200,'sawtooth',0.07,0.06); N(0.055,0.028,700); },
  shotgun:  () => { N(0.12,0.1,320); T(100,'square',0.14,0.07); },
  laser:    () => { T(900,'sine',0.18,0.05,-700); T(650,'sine',0.16,0.035,-450); },
  sniper:   () => { N(0.045,0.13,1400); T(155,'sawtooth',0.065,0.11); },
  plasma:   () => { T(260,'sawtooth',0.12,0.085,-240); T(170,'sine',0.15,0.06,240); },
  blade:    () => { T(60,'sine',0.2,0.11); T(85,'sine',0.18,0.07,7); },
  hit:      () => { T(430,'square',0.055,0.08); N(0.038,0.05,980); },
  crit:     () => { T(640,'square',0.05,0.12); T(960,'square',0.07,0.08,400); },
  kill:     () => { T(540,'square',0.06,0.1); T(760,'square',0.085,0.07,200,0.055); },
  killBig:  () => { T(650,'sine',0.07,0.12); T(870,'sine',0.1,0.09,0,0.06); T(1090,'sine',0.13,0.065,0,0.12); },
  dash:     () => { T(280,'sawtooth',0.12,0.08,-400); N(0.07,0.032,300); },
  wave:     () => { T(125,'sine',0.45,0.12); T(250,'sine',0.3,0.055,100); },
  blink:    () => { T(740,'sine',0.085,0.095); T(540,'sine',0.14,0.06,-300); },
  ult:      () => { [0,1,2,3,4,5].forEach(i => T(210+i*66,'sine',0.3,0.072,0,i*0.05)); },
  hurt:     () => { T(100,'sawtooth',0.24,0.17); N(0.13,0.08,250); },
  reload:   () => { T(175,'square',0.18,0.055); T(255,'square',0.13,0.045,0,0.16); },
  pickup:   () => { T(660,'sine',0.13,0.085); T(880,'sine',0.11,0.055,0,0.08); },
  coin:     () => { T(870,'sine',0.09,0.09); T(1090,'sine',0.08,0.07,0,0.06); },
  lvEnd:    () => { T(440,'sine',0.11,0.085); T(660,'sine',0.14,0.065,0,0.09); T(880,'sine',0.18,0.05,0,0.18); },
  bossRoar: () => { [0,1,2,3,4].forEach(i => T(75+i*26,'sawtooth',0.55,0.11,0,i*0.09)); },
  bossHit:  () => { T(370,'square',0.045,0.12); N(0.028,0.07,1200); },
  bossPhase:() => { [0,1,2,3,4,5,6].forEach(i => T(90+i*24,'sawtooth',0.38,0.08,0,i*0.06)); },
  levelUp:  () => { [440,550,660,880,1100].forEach((f,i) => T(f,'sine',0.2-0.01*i,0.1+i*0.005,0,i*0.075)); },
  buy:      () => { T(650,'sine',0.09,0.11); T(870,'sine',0.12,0.09,0,0.08); T(1090,'sine',0.15,0.07,0,0.16); },
  noMoney:  () => { T(155,'square',0.14,0.09); T(110,'square',0.17,0.07,0,0.07); },
  bpClaim:  () => { T(540,'sine',0.09,0.1); T(760,'sine',0.12,0.085,0,0.07); T(980,'sine',0.16,0.065,0,0.14); },
  navigate: () => { T(660,'sine',0.06,0.055); },
  upgradeSelect: () => { T(880,'sine',0.1,0.09); T(1100,'sine',0.12,0.07,0,0.07); },
};

const playSFX = name => { if (SFX[name]) SFX[name](); };
