// ---------- startanimatie vóór een potje (Automatisch + Zelf spelen + Multiplayer) ----------
// Variant "Titan" (gekozen uit 4 plasmavarianten, 2026-10). Gebruikerswens: echt opgehypt worden.
// Tijdlijn: aftellen 3-2-1 (traag, met een zware donkere dreun) → het schip schudt en laadt op,
// schokringen trekken samen naar het midden → even stil → BAM (flits, schokgolven, vonken, camera
// schiet naar voren) → hyperjump (warme kleuren) → een zwart gat met een gloeiende schijf, de
// sterren buigen eromheen → je duikt erin, het beeld draait en wordt zwart → het spel start.
// ±10,6 s; klik of Esc slaat hem over. Aan/uit via het vinkje "Startanimatie" in de lobby
// (#walkIntroToggle), onthouden in localStorage (puur een gemak per browser).
// Wordt aangeroepen vanuit walkTryStart() in 96-walk.js, en in Multiplayer vanuit
// mpHostStartClick() (99-multiplayer.js): de host stuurt dan een 'intro'-bericht zodat alle gasten
// hem tegelijk afspelen, en start het potje pas als de animatie klaar is — zo mist niemand de
// opening.
// Alles beweegt via het canvas of via transform/opacity (zie Prestatie in CLAUDE.md); de sterren
// worden per kleur/dikte in één stroke getekend, niet per ster.
const INTRO_STORE_KEY = 'axiom9.startIntro';
const INTRO_T = {          // tijdlijn in ms vanaf de start van de animatie
  count: [700, 1850, 3000],// 3, 2, 1 (1,15 s per tel; gebruikerswens: "iets langzamer")
  go: 4150,                // LANCEER + opbouw: schudden, samentrekkende ringen, stijgend geluid
  bam: 6000,               // BAM → hyperjump
  hole: 8000,              // zwart gat verschijnt in de verte
  dive: 9350,              // erin duiken: het gat groeit tot het hele beeld zwart is
  inside: 10150,           // helemaal zwart
  end: 10600,              // klaar: spel start, overlay faadt weg (het geluid klinkt nog even na)
  fadeOut: 1200,           // zwart → potje, rustig; = .start-intro.is-leaving
};
const INTRO_SUBS = ['reactor ontstoken', 'stuwkracht 60%', 'stuwkracht 100%', 'hou je vast'];
const INTRO_WARM = [[255, 241, 220], [255, 176, 112]];   // hyperspace + schijf: warm (gebruikerswens)

// Orbitron 900 zit ingebakken (build.py → {{ORBITRON}}), zodat de letters ook offline kloppen
try {
  if ('{{ORBITRON}}' && window.FontFace){
    const f = new FontFace('Axiom Orbitron', 'url(data:font/woff2;base64,{{ORBITRON}}) format("woff2")', { weight: '900' });
    document.fonts.add(f); f.load().catch(() => {});
  }
} catch (e){}

function introEnabled(){
  try { return localStorage.getItem(INTRO_STORE_KEY) !== 'off'; } catch (e){ return true; }
}
// twee vinkjes met dezelfde waarde: in de lobby (Automatisch/Zelf spelen) en in de
// Multiplayer-kamer van de host — wijzig je er één, dan gaat de ander mee
{
  const boxes = ['walkIntroToggle', 'mpIntroToggle'].map(id => document.getElementById(id)).filter(Boolean);
  for (const box of boxes){
    box.checked = introEnabled();
    box.addEventListener('change', () => {
      try { localStorage.setItem(INTRO_STORE_KEY, box.checked ? 'on' : 'off'); } catch (e){}
      for (const other of boxes) other.checked = box.checked;
    });
  }
}

const introClamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const introSmooth = (x) => { x = introClamp(x); return x * x * (3 - 2 * x); };
const introEaseOut = (x) => 1 - Math.pow(1 - introClamp(x), 3);
const introLerp = (a, b, p) => a + (b - a) * p;
const introRgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// lijnen bundelen per stijl: één stroke per kleur/dikte/helderheid i.p.v. één per ster
function introBatch(){
  const m = new Map();
  const get = (key, col, a, w) => { let e = m.get(key); if (!e){ e = { p: new Path2D(), col, a, w }; m.set(key, e); } return e.p; };
  return {
    line(key, col, a, w, x1, y1, x2, y2){ const p = get(key, col, a, w); p.moveTo(x1, y1); p.lineTo(x2, y2); },
    poly(key, col, a, w, pts){ const p = get(key, col, a, w); p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); },
    flush(ctx){
      ctx.lineCap = 'round';
      for (const e of m.values()){ ctx.strokeStyle = introRgba(e.col, e.a); ctx.lineWidth = e.w; ctx.stroke(e.p); }
      m.clear();
    },
  };
}

// ---------- geluid: puur Web Audio (geen bestanden) ----------
function introAudio(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx;
  try { ctx = new AC(); } catch (e){ return null; }
  const t0 = ctx.currentTime + 0.03, nodes = [];
  const out = ctx.createGain(); out.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.3;
  out.connect(comp).connect(ctx.destination);
  // galm: zelfgemaakte impulsrespons van 3,5 s (grote ruimte)
  const verb = ctx.createConvolver();
  {
    const len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
  }
  const wet = ctx.createGain(); wet.gain.value = 0.5; verb.connect(wet).connect(out);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }

  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; nodes.push(o); return o; };
  const nsrc = () => { const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true; nodes.push(n); return n; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = () => { const g = ctx.createGain(); g.gain.value = 0.0001; return g; };
  const drive = (k) => {
    const ws = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++){ const x = i / 511.5 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    ws.curve = c; return ws;
  };
  const to = (node, send = 0) => { node.connect(out); if (send){ const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(verb); } };
  const hit = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  // donkere dreun: diepe sinus die wegzakt + een vervormde "BRAAM" + een doffe klap, met galm
  function boom(at, p = 1){
    const t = t0 + at;
    const s = osc('sine', 48); s.frequency.setValueAtTime(48, t); s.frequency.exponentialRampToValueAtTime(19, t + 1.8);
    const sg = gain(); hit(sg, t, 0.012, Math.min(1, 0.85 * p), 2.4 + 0.4 * p); s.connect(sg); to(sg);
    s.start(t); s.stop(t + 3.4);
    const lp = filt('lowpass', 1100, 5); lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(60, t + 1.5);
    const bg = gain(); hit(bg, t, 0.02, 0.32 * p, 2.0);
    for (const f of [34, 34.45, 51.3]){ const o = osc('sawtooth', f); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.82, t + 2); o.connect(lp); o.start(t); o.stop(t + 2.4); }
    lp.connect(drive(3.5)).connect(bg); to(bg, 0.7);
    const n = nsrc(), nl = filt('lowpass', 170), ng = gain(); hit(ng, t, 0.004, 0.9 * Math.min(1.3, p), 0.4);
    n.connect(nl).connect(ng); to(ng, 0.35); n.start(t, Math.random() * 3); n.stop(t + 0.6);
  }
  // opbouw: ruis die omhoog zwiept, stijgende zaagtanden, gerommel en een steeds snellere hartslag;
  // vlak voor de BAM valt alles even stil
  function riser(at, len){
    const t = t0 + at, cut = t + len - 0.09;
    const n = nsrc(), bp = filt('bandpass', 180, 2.2), g = gain();
    bp.frequency.setValueAtTime(160, t); bp.frequency.exponentialRampToValueAtTime(5200, cut);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, cut); g.gain.setValueAtTime(0.5, cut); g.gain.exponentialRampToValueAtTime(0.0001, cut + 0.03);
    n.connect(bp).connect(g); to(g, 0.2); n.start(t, Math.random() * 3); n.stop(cut + 0.1);
    const lp = filt('lowpass', 250, 3), g2 = gain();
    lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(3600, cut);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.2, cut); g2.gain.setValueAtTime(0.2, cut); g2.gain.exponentialRampToValueAtTime(0.0001, cut + 0.03);
    for (const f of [55, 55.6, 82.5, 110.7]){ const o = osc('sawtooth', f); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 3.4, cut); o.connect(lp); o.start(t); o.stop(cut + 0.1); }
    lp.connect(drive(2.2)).connect(g2); to(g2, 0.25);
    const r = nsrc(), rl = filt('lowpass', 95), g3 = gain();
    g3.gain.setValueAtTime(0.05, t); g3.gain.linearRampToValueAtTime(1.1, cut); g3.gain.setValueAtTime(1.1, cut); g3.gain.exponentialRampToValueAtTime(0.0001, cut + 0.03);
    r.connect(rl).connect(g3); to(g3); r.start(t, Math.random() * 3); r.stop(cut + 0.1);
    let k = t + 0.15, step = 0.42;
    while (k < cut - 0.05){
      const o = osc('sine', 62), gg = gain();
      o.frequency.setValueAtTime(62, k); o.frequency.exponentialRampToValueAtTime(32, k + 0.12);
      hit(gg, k, 0.004, 0.55, 0.16); o.connect(gg); to(gg); o.start(k); o.stop(k + 0.2);
      k += step; step = Math.max(0.07, step * 0.8);
    }
  }
  // BAM: dreun, subdrop, knal, vervormde explosie, veel galm
  function bam(at){
    const t = t0 + at;
    boom(at, 1.9);
    const s = osc('sine', 120), sg = gain(); s.frequency.setValueAtTime(120, t); s.frequency.exponentialRampToValueAtTime(21, t + 1.3);
    hit(sg, t, 0.004, 1, 2.8); s.connect(sg); to(sg); s.start(t); s.stop(t + 3.2);
    const c = nsrc(), hp = filt('highpass', 1300), cg = gain(); hit(cg, t, 0.002, 0.9, 0.4); c.connect(hp).connect(cg); to(cg, 0.6); c.start(t, Math.random() * 3); c.stop(t + 0.5);
    const m = nsrc(), mb = filt('bandpass', 420, 0.7), mg = gain(); hit(mg, t, 0.004, 0.75, 1.3);
    m.connect(mb).connect(drive(4)).connect(mg); to(mg, 0.8); m.start(t, Math.random() * 3); m.stop(t + 1.5);
  }
  // hyperspace: brullende wind met een langzaam golvend filter
  function roar(at, len){
    const t = t0 + at, e = t + len;
    const n = nsrc(), bp = filt('bandpass', 700, 0.8), g = gain();
    const lfo = osc('sine', 0.9), lg = ctx.createGain(); lg.gain.value = 380; lfo.connect(lg).connect(bp.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.34, t + 0.12); g.gain.setValueAtTime(0.34, e - 0.8); g.gain.exponentialRampToValueAtTime(0.0001, e);
    n.connect(bp).connect(g); to(g, 0.15); n.start(t, Math.random() * 3); n.stop(e + 0.05); lfo.start(t); lfo.stop(e + 0.05);
    const r = nsrc(), rl = filt('lowpass', 140), rg = gain();
    rg.gain.setValueAtTime(0.0001, t); rg.gain.exponentialRampToValueAtTime(0.5, t + 0.1); rg.gain.exponentialRampToValueAtTime(0.0001, e);
    r.connect(rl).connect(rg); to(rg); r.start(t, Math.random() * 3); r.stop(e + 0.05);
  }
  // het zwarte gat in (van INTRO_T.hole tot en met inside): "Gong van de leegte" (gekozen uit 15,
  // 2026-10) — een aanzwellende diepe bromtoon, en zodra je erin zit één enorme gong (onharmonische
  // boventonen op 62 Hz, tot 7 s uitgalm) met een subdreun eronder
  function holeSound(at, len){
    const t = t0 + at, e = t + len;
    for (const f of [55, 55.4, 82.4]){
      const o = osc('sawtooth', f), g = gain(), lp = filt('lowpass', 300, 1);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, e - 0.02); g.gain.linearRampToValueAtTime(0, e);
      o.connect(lp).connect(g); to(g, 0.3); o.start(t); o.stop(e + 0.05);
    }
    // [verhouding t.o.v. de grondtoon, volume, uitgalm in s]
    for (const [r, v, d] of [[1, 0.5, 7], [1.48, 0.32, 5.5], [2.0, 0.22, 6], [2.66, 0.2, 4], [3.6, 0.13, 3.2], [4.2, 0.1, 2.6], [5.4, 0.07, 2]]){
      const o = osc('sine', 62 * r), g = gain();
      o.frequency.setValueAtTime(62 * r * 1.01, e); o.frequency.exponentialRampToValueAtTime(62 * r * 0.985, e + d);
      hit(g, e, 0.006, v, d); o.connect(g); to(g, 0.9); o.start(e); o.stop(e + d + 0.1);
    }
    const s = osc('sine', 45), sg = gain(); s.frequency.setValueAtTime(45, e); s.frequency.exponentialRampToValueAtTime(22, e + 1.5);
    hit(sg, e, 0.01, 0.9, 2.2); s.connect(sg); to(sg); s.start(e); s.stop(e + 2.4);
  }
  return {
    schedule(){
      const s = (ms) => ms / 1000;
      INTRO_T.count.forEach((c, i) => boom(s(c), 1 + i * 0.18));
      boom(s(INTRO_T.go), 1.4);
      riser(s(INTRO_T.go) + 0.1, s(INTRO_T.bam - INTRO_T.go) - 0.1);
      bam(s(INTRO_T.bam));
      roar(s(INTRO_T.bam) + 0.05, s(INTRO_T.hole - INTRO_T.bam) + 0.9);
      holeSound(s(INTRO_T.hole), s(INTRO_T.inside - INTRO_T.hole));
    },
    // overgeslagen: meteen (zacht) stil. Gewoon afgelopen: de gong mag uitgalmen (tot 7 s na het gat).
    stop(now){
      try {
        if (now) out.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
        setTimeout(() => { for (const n of nodes){ try { n.stop(); } catch (e){} } ctx.close(); }, now ? 400 : 7500);
      } catch (e){}
    },
  };
}

// ---------- beeld ----------
let introRunning = false;
function playStartIntro(onDone){
  if (introRunning) return;
  introRunning = true;
  const overlay = document.createElement('div');
  overlay.className = 'start-intro';
  overlay.innerHTML = '<canvas></canvas><div class="start-intro-layer"></div><div class="start-intro-vig"></div>' +
    '<div class="start-intro-flash"></div><div class="start-intro-skip">klik of Esc om over te slaan</div>';
  // alleen in het lobbyvak (#walkPanel), niet over het hele scherm (gebruikerswens) — de kop
  // met logo en tabbladen blijft gewoon zichtbaar
  const host = document.getElementById('walkPanel') || document.body;
  host.appendChild(overlay);
  const canvas = overlay.querySelector('canvas');
  const layer = overlay.querySelector('.start-intro-layer');
  const vigEl = overlay.querySelector('.start-intro-vig');
  const flashEl = overlay.querySelector('.start-intro-flash');
  const ctx = canvas.getContext('2d');
  const audio = introAudio();
  if (audio) audio.schedule();

  let W = 1, H = 1, dpr = 1, scale = 1, F = 1, minDim = 1, halfDiag = 1;
  const resize = () => {
    dpr = Math.min(1.75, window.devicePixelRatio || 1);
    W = Math.max(1, overlay.clientWidth); H = Math.max(1, overlay.clientHeight);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    scale = Math.max(W, H) * 0.6; F = scale * 0.5; minDim = Math.min(W, H); halfDiag = Math.hypot(W, H) / 2;
  };
  resize();
  // het vak kan van maat veranderen (venster, of het speelscherm dat erachter verschijnt)
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(overlay); else window.addEventListener('resize', resize);

  const shakes = [], rings = [], flashes = [], sparks = [], pulls = [];
  const shakeAt = (now, amp, dur) => shakes.push({ t: now, amp, dur });
  const ringAt = (now, power, col, width, dur) => rings.push({ t: now, power, col, width, dur });
  const flashAt = (now, peak, dur) => flashes.push({ t: now, peak, dur });
  let lastPull = 0;

  // klassiek 3D-sterrenveld: x/y willekeurig, z = diepte; projectie naar het midden
  const newStar = (far) => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: far ? 1 + Math.random() * 0.3 : 0.12 + Math.random() * 0.9, acc: Math.random() < 0.22 });
  const stars = Array.from({ length: 560 }, () => newStar(false));
  // de schijf rond het zwarte gat: deeltjes in een baan (r in eenheden van de gat-straal)
  const disk = Array.from({ length: 1300 }, () => ({ r: 1.45 + Math.pow(Math.random(), 1.6) * 3.1, th: Math.random() * 6.283 }));

  const t0 = performance.now();
  let last = t0, raf = 0, finished = false, shown = -1, countEl = null, bamDone = false, insideDone = false;
  function showLabel(i, now){
    if (shown === i) return;
    shown = i;
    if (countEl){ const old = countEl; setTimeout(() => old.remove(), 250); }
    countEl = document.createElement('div');
    countEl.className = 'start-intro-count ' + (i === 3 ? 'is-go' : 'is-digit');
    const txt = i === 3 ? 'LANCEER' : String(3 - i);
    countEl.innerHTML = `<span class="start-intro-word">${txt}</span><span class="start-intro-sub">${INTRO_SUBS[i]}</span>`;
    layer.appendChild(countEl);
    // elke dreun: schok door het beeld, blauwe schokgolf, korte flits; elke tel iets zwaarder
    shakeAt(now, 8 + i * 3, 650);
    ringAt(now, 0.55 + i * 0.12, [120, 190, 255], 10, 900);
    flashAt(now, 0.1 + i * 0.03, 260);
  }
  function blast(now){
    for (let k = 0; k < 240; k++){
      const a = Math.random() * 6.283, sp = 6 + Math.random() * 34;
      sparks.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, warm: Math.random() < 0.55, t: now, life: 700 + Math.random() * 700 });
    }
  }

  const sb = introBatch();
  function frame(now){
    const t = now - t0, dt = Math.min(50, now - last) / 16.7;
    last = now;
    const T = INTRO_T;
    if (t < T.bam){ if (t >= T.go) showLabel(3, now); else for (let i = 2; i >= 0; i--) if (t >= T.count[i]){ showLabel(i, now); break; } }
    const bp = introClamp((t - T.go) / (T.bam - T.go));     // opbouw
    const af = t - T.bam;                                    // tijd sinds de BAM
    const hp = introClamp((t - T.hole) / (T.dive - T.hole)); // zwart gat nadert
    const dp = introClamp((t - T.dive) / (T.inside - T.dive)); // erin duiken
    const inside = t >= T.inside;

    if (af >= 0 && !bamDone){
      bamDone = true;
      shakeAt(now, 38, 1000);
      ringAt(now, 1.4, [255, 255, 255], 26, 650); ringAt(now + 70, 1.9, [130, 200, 255], 18, 850); ringAt(now + 170, 2.6, [255, 180, 110], 12, 1000);
      flashAt(now, 1, 700);
      blast(now);
      if (countEl){
        countEl.getAnimations().forEach(a => a.cancel());
        countEl.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(5)', opacity: 0 }], { duration: 340, easing: 'cubic-bezier(.5,0,1,.6)', fill: 'forwards' });
      }
    }
    if (inside && !insideDone){ insideDone = true; shakeAt(now, 26, 700); }

    // --- toestand: snelheid, zoom, gat, draaiing, schudden ---
    let bump = 0;
    for (const c of T.count) if (t >= c) bump += Math.exp(-(t - c) / 260);
    if (t >= T.go && af < 0) bump += Math.exp(-(t - T.go) / 260);
    let speed, warp;
    if (af < 0){ speed = 0.0022 + bump * 0.006 + bp * bp * 0.014; warp = bp * bp * 0.55; }
    else { speed = introLerp(0.085, 0.05, introSmooth(af / 900)) * introLerp(1, 0.55, introSmooth(hp)) + dp * dp * 0.07; warp = 1; }
    // vlak voor de BAM trekt het beeld iets terug, bij de BAM schiet het naar voren
    const zoom = af < 0 ? 1 - 0.08 * introSmooth((t - (T.bam - 380)) / 380) : 1 + 0.32 * Math.exp(-af / 240);
    let R = 0;
    if (t >= T.hole){
      const R0 = minDim * 0.105, Rend = halfDiag * 1.15;
      R = t < T.dive ? minDim * (0.008 + 0.097 * hp * hp) : R0 * Math.pow(Rend / R0, Math.pow(dp, 1.7));
    }
    const holeA = introSmooth(hp * 2.5);
    const roll = 0.15 * introSmooth(hp) + 1.3 * dp * dp;
    const tilt = introLerp(0.27, 0.11, introSmooth(dp));
    const spinMul = 1 + 3.5 * dp * dp;
    let shakeAmp = 0;
    if (af < 0) shakeAmp = t >= T.go ? 1 + 15 * bp * bp : 0;
    else if (t < T.hole) shakeAmp = introLerp(6, 2.5, introSmooth(af / 1200));
    else if (!inside) shakeAmp = introLerp(2.5, 6, hp) + 16 * dp * dp;
    for (let k = shakes.length - 1; k >= 0; k--){
      const s = shakes[k], p = (now - s.t) / s.dur;
      if (p >= 1){ shakes.splice(k, 1); continue; }
      if (p >= 0) shakeAmp += s.amp * (1 - p) * (1 - p);
    }
    const sx = shakeAmp * (0.55 * Math.sin(t * 0.21) + 0.3 * Math.sin(t * 0.37 + 1.3) + 0.15 * Math.sin(t * 0.071 + 2));
    const sy = shakeAmp * (0.55 * Math.sin(t * 0.19 + 0.7) + 0.3 * Math.sin(t * 0.41 + 2.1) + 0.15 * Math.sin(t * 0.063));
    layer.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;

    // --- tekenen (oorsprong = midden van het vak) ---
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2 + sx, H / 2 + sy); ctx.rotate(roll); ctx.scale(zoom, zoom);
    ctx.globalCompositeOperation = 'lighter';

    // warme gloed in het midden (hyperspace), die bij het gat dooft
    if (!inside){
      const ng = (af < 0 ? 0.04 + bp * 0.08 : 0.26) * (1 - introSmooth(hp));
      const neb = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 0.9);
      neb.addColorStop(0, `rgba(160,70,20,${ng})`); neb.addColorStop(0.5, `rgba(90,30,10,${ng * 0.4})`); neb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = neb; ctx.fillRect(-W, -H, W * 2, H * 2);
    }

    // sterren; rond het zwarte gat buigen ze eromheen (lens) en draaien ze mee
    const E = R * 1.55, swirl = 0.7 * hp + 3 * dp * dp, lensOn = R > 0.5;
    const lens = (px, py) => {
      const r = Math.hypot(px, py) || 0.001, r2 = (r + Math.sqrt(r * r + 4 * E * E)) / 2;
      const a = Math.atan2(py, px) + swirl * (E / r2) * (E / r2);
      return [Math.cos(a) * r2, Math.sin(a) * r2];
    };
    const starA = introSmooth(t / 700) * (inside ? 0 : 1);
    const limX = W * 0.8 / zoom, limY = H * 0.8 / zoom;
    for (const s of stars){
      s.z -= speed * dt;
      if (s.z <= 0.02){ Object.assign(s, newStar(true)); continue; }
      const px = s.x / s.z * F, py = s.y / s.z * F;
      if (Math.abs(px) > limX || Math.abs(py) > limY){ Object.assign(s, newStar(true)); continue; }
      if (starA <= 0 || s.z > 1) continue;
      const zt = Math.min(1.6, s.z + speed * (1 + warp * 9));
      const tx = s.x / zt * F, ty = s.y / zt * F;
      const b = Math.min(1, (1 - s.z) * 1.25 + warp * 0.35) * starA;
      const bb = Math.min(4, (b * 5) | 0), w = Math.max(0.7, (1 - s.z) * 2.7), wc = w < 1.2 ? 1 : w < 2 ? 1.7 : 2.6;
      const col = INTRO_WARM[s.acc ? 1 : 0], key = (s.acc ? 100 : 0) + wc * 10 + bb;
      if (lensOn){
        const [x1, y1] = lens(px, py), [x2, y2] = lens((px + tx) / 2, (py + ty) / 2), [x3, y3] = lens(tx, ty);
        sb.poly(key, col, (bb + 1) / 5, wc, [x3, y3, x2, y2, x1, y1]);
      } else if (warp < 0.04) sb.line(key, col, (bb + 1) / 5, wc, px, py, px + 0.01, py);
      else sb.line(key, col, (bb + 1) / 5, wc, tx, ty, px, py);
    }
    sb.flush(ctx);

    // opbouw: kern in het midden + schokringen die steeds sneller naar binnen trekken
    if (t >= T.go && af < 0){
      const coreR = scale * (0.02 + 0.2 * bp * bp) * (1 + 0.12 * Math.sin(t * 0.06));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + bp * 0.5})`); g.addColorStop(0.25, `rgba(130,205,255,${0.35 + bp * 0.4})`);
      g.addColorStop(0.6, `rgba(20,100,255,${0.15 + bp * 0.2})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, coreR, 0, 6.283); ctx.fill();
      if (now - lastPull > introLerp(420, 70, bp * bp)){ lastPull = now; pulls.push({ t: now, life: introLerp(750, 330, bp) }); }
    }
    for (let k = pulls.length - 1; k >= 0; k--){
      const r = pulls[k], p = (now - r.t) / r.life;
      if (p >= 1 || af >= 0){ pulls.splice(k, 1); continue; }
      ctx.strokeStyle = `rgba(120,195,255,${0.12 + 0.7 * p})`; ctx.lineWidth = 1.5 + 4 * p;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(1, scale * 1.35 * Math.pow(1 - p, 1.6)), 0, 6.283); ctx.stroke();
    }
    // vonken van de BAM
    for (let k = sparks.length - 1; k >= 0; k--){
      const s = sparks[k], p = (now - s.t) / s.life;
      if (p >= 1){ sparks.splice(k, 1); continue; }
      const f = Math.pow(0.965, dt); s.vx *= f; s.vy *= f; s.x += s.vx * dt; s.y += s.vy * dt;
      const bb = Math.min(4, ((1 - p) * 5) | 0);
      sb.line((s.warm ? 5 : 0) + bb, s.warm ? [255, 190, 120] : [160, 215, 255], (bb + 1) / 5, 2, s.x - s.vx * 2.5, s.y - s.vy * 2.5, s.x, s.y);
    }
    sb.flush(ctx);

    // zwart gat: warme gloed, schijf (achterkant, afgebogen ring), kern, fotonring, voorkant schijf
    if (R > 0.5 && !inside){
      const gl = ctx.createRadialGradient(0, 0, R * 0.9, 0, 0, R * 5.5);
      gl.addColorStop(0, `rgba(255,150,70,${0.32 * holeA})`); gl.addColorStop(0.3, `rgba(200,80,30,${0.12 * holeA})`); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 5.5, 0, 6.283); ctx.fill();
      const colOf = (r) => r < 2 ? [255, 246, 232] : r < 3 ? [255, 192, 112] : [255, 120, 55];
      const ci = (r) => r < 2 ? 0 : r < 3 ? 1 : 2;
      const front = [];
      for (let i = 0; i < disk.length; i++){
        const d = disk[i];
        const w = 0.05 * Math.pow(1.45 / d.r, 1.5) * spinMul;
        d.th += w * dt;
        const a0 = d.th - w * dt * 5, dop = 1 + 0.65 * Math.cos(d.th);
        const b = introClamp(dop * Math.pow(1.7 / d.r, 1.25) * 0.75) * holeA, bb = Math.min(4, (b * 5) | 0);
        const seg = [ci(d.r) * 10 + bb, colOf(d.r), (bb + 1) / 5, 1.5,
          Math.cos(a0) * d.r * R, Math.sin(a0) * d.r * R * tilt, Math.cos(d.th) * d.r * R, Math.sin(d.th) * d.r * R * tilt];
        if (Math.sin(d.th) >= 0) front.push(seg);
        else sb.line(seg[0], seg[1], seg[2], seg[3], seg[4], seg[5], seg[6], seg[7]);
        if (i % 2 === 0){
          const rho = R * (1.05 + (d.r - 1.45) * 0.13), hb = Math.min(4, ((b * 0.6) * 5) | 0);
          sb.line(100 + ci(d.r) * 10 + hb, colOf(d.r), (hb + 1) / 5 * 0.8, 1.3,
            Math.cos(a0 + 1.57) * rho, Math.sin(a0 + 1.57) * rho, Math.cos(d.th + 1.57) * rho, Math.sin(d.th + 1.57) * rho);
        }
      }
      sb.flush(ctx);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,230,190,${0.85 * holeA})`; ctx.lineWidth = Math.max(1.5, R * 0.025);
      ctx.beginPath(); ctx.arc(0, 0, R * 1.02, 0, 6.283); ctx.stroke();
      for (const s of front) sb.line(s[0] + 200, s[1], s[2], s[3], s[4], s[5], s[6], s[7]);
      sb.flush(ctx);
    }

    // schokgolven (tellen + BAM)
    for (let k = rings.length - 1; k >= 0; k--){
      const r = rings[k], p = (now - r.t) / r.dur;
      if (p < 0) continue;
      if (p >= 1){ rings.splice(k, 1); continue; }
      const rad = scale * (0.08 + introEaseOut(p) * 0.95) * r.power;
      ctx.strokeStyle = introRgba(r.col, (1 - p) * 0.8); ctx.lineWidth = r.width * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = introRgba(r.col, (1 - p) * 0.25); ctx.lineWidth = r.width * 3 * (1 - p);
      ctx.beginPath(); ctx.arc(0, 0, rad * 0.94, 0, 6.283); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // flitsen + vignet: alleen opacity
    let fa = 0;
    for (let k = flashes.length - 1; k >= 0; k--){
      const f = flashes[k], a = now - f.t;
      if (a >= f.dur){ flashes.splice(k, 1); continue; }
      fa = Math.max(fa, f.peak * Math.pow(1 - a / f.dur, 2));
    }
    flashEl.style.opacity = fa.toFixed(3);
    const vg = af < 0 ? 0.5 + 0.45 * bp + 0.25 * Math.min(1, bump) : t < T.hole ? introLerp(0.2, 0.55, introSmooth(af / 1500)) : 0.55 + 0.4 * dp;
    vigEl.style.opacity = Math.min(1, vg).toFixed(3);

    if (t >= T.end){ finish(false); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish(skipped){
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey, true);
    if (audio) audio.stop(skipped);
    // het spel start nu al achter de overlay, die daarna rustig wegfaadt
    try { onDone(); } finally {
      overlay.classList.add('is-leaving');
      setTimeout(() => { overlay.remove(); introRunning = false; }, INTRO_T.fadeOut);
    }
  }
  const onKey = (e) => { if (e.key === 'Escape'){ e.preventDefault(); finish(true); } };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', () => finish(true));

  // zwart erin faden (de lobby verdwijnt eronder), daarna loopt de rest vanzelf
  requestAnimationFrame(() => overlay.classList.add('is-in'));
  raf = requestAnimationFrame(frame);
}
