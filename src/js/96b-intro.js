// ---------- startanimatie vóór een potje (Automatisch + Zelf spelen) ----------
// Gebruikerswens: na "Start spel" faadt de lobby uit naar een zwart scherm met sterren, er wordt
// afgeteld 3-2-1-START met bij elke tel een donkere dreun, daarna een hyperjump door de sterren
// die eindigt in een implosie zoals een zwart gat — en dan pas start het spel. Kort gehouden
// (±5,5 s). Klik of Esc slaat hem over. Aan/uit via het vinkje "Startanimatie" in de lobby
// (#walkIntroToggle), onthouden in localStorage (puur een gemak per browser).
// Wordt aangeroepen vanuit walkTryStart() in 96-walk.js, en in Multiplayer vanuit
// mpHostStartClick() (99-multiplayer.js): de host stuurt dan een 'intro'-bericht zodat alle gasten
// hem tegelijk afspelen, en start het potje pas als de animatie klaar is — zo mist niemand de
// opening.
const INTRO_STORE_KEY = 'axiom9.startIntro';
const INTRO_T = {          // tijdlijn in ms vanaf de start van de animatie
  fadeIn: 320,             // lobby → zwart
  count: [320, 1020, 1720],// 3, 2, 1
  go: 2420,                // START
  // hyperjump en zwart gat iets ruimer (gebruikerswens: "gaat iets te snel"): sprong 1,3 s
  // (was 0,75 s), implosie 1,2 s (was 0,6 s)
  jump: 2900,              // hyperjump begint (START vervaagt)
  implode: 4200,           // zwart gat trekt alles naar binnen
  end: 5400,               // klaar: spel start, overlay faadt weg
  fadeOut: 380,
};

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

// ---------- geluid: donkere dreunen + een whoosh, puur met Web Audio (geen bestanden) ----------
function introAudio(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  let ctx;
  try { ctx = new AC(); } catch (e){ return null; }
  const master = ctx.createGain();
  master.gain.value = 0.75;
  master.connect(ctx.destination);
  const noiseBuf = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();
  // dreun: een diepe sinus die omlaag glijdt + een kort gedempt ruisklapje voor de "tik"
  function boom(at, { f0 = 72, f1 = 30, len = 0.9, vol = 1 } = {}){
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + len + 0.05);
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuf;
    lp.type = 'lowpass'; lp.frequency.value = 260;
    ng.gain.setValueAtTime(vol * 0.55, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    n.connect(lp).connect(ng).connect(master);
    n.start(t); n.stop(t + 0.25);
  }
  // whoosh: ruis door een bandfilter dat omhoog (hyperjump) of omlaag (implosie) zwiept
  function whoosh(at, len, fA, fB, vol){
    const t = ctx.currentTime + at;
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noiseBuf;
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(fA, t);
    bp.frequency.exponentialRampToValueAtTime(fB, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(bp).connect(g).connect(master);
    n.start(t); n.stop(t + len + 0.05);
  }
  return {
    schedule(){
      const s = (ms) => ms / 1000;
      for (const c of INTRO_T.count) boom(s(c));
      boom(s(INTRO_T.go), { f0: 60, f1: 22, len: 1.4, vol: 1 });
      whoosh(s(INTRO_T.jump) - 0.1, s(INTRO_T.implode - INTRO_T.jump) + 0.15, 180, 3200, 0.35);
      whoosh(s(INTRO_T.implode), s(INTRO_T.end - INTRO_T.implode), 2400, 90, 0.4);
      boom(s(INTRO_T.end) - 0.12, { f0: 48, f1: 20, len: 1.1, vol: 0.9 });
    },
    stop(){
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => ctx.close(), 400);
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
  overlay.innerHTML = '<canvas></canvas><div class="start-intro-count"></div>' +
    '<div class="start-intro-skip">klik of Esc om over te slaan</div>';
  // alleen in het lobbyvak (#walkPanel), niet over het hele scherm (gebruikerswens) — de kop
  // met logo en tabbladen blijft gewoon zichtbaar
  const host = document.getElementById('walkPanel') || document.body;
  host.appendChild(overlay);
  const canvas = overlay.querySelector('canvas');
  const countEl = overlay.querySelector('.start-intro-count');
  const ctx = canvas.getContext('2d');
  const audio = introAudio();
  if (audio) audio.schedule();

  let W = 0, H = 0;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, overlay.clientWidth); H = Math.max(1, overlay.clientHeight);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  // het vak kan van maat veranderen (venster, of het speelscherm dat erachter verschijnt)
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(overlay); else window.addEventListener('resize', resize);

  // klassiek 3D-sterrenveld: x/y willekeurig, z = diepte; projectie naar het midden
  const STARS = 520;
  const newStar = (far) => ({
    x: (Math.random() * 2 - 1), y: (Math.random() * 2 - 1),
    z: far ? 1 : 0.15 + Math.random() * 0.85, pz: 0,
    hue: Math.random() < 0.18 ? 'blue' : 'white',
  });
  const stars = Array.from({ length: STARS }, () => newStar(false));
  for (const s of stars) s.pz = s.z;

  const t0 = performance.now();
  let last = t0, raf = 0, finished = false;
  let shownCount = -1, prevImpP = 0;
  const labels = ['3', '2', '1', 'START'];
  const showLabel = (i) => {
    if (shownCount === i) return;
    shownCount = i;
    countEl.textContent = labels[i];
    countEl.classList.toggle('is-go', i === 3);
    countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop');
  };

  const ease = (x) => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  function frame(now){
    const t = now - t0, dt = Math.min(50, now - last) / 16.7;
    last = now;
    const cx = W / 2, cy = H / 2, scale = Math.max(W, H) * 0.6;

    // aftellen
    if (t >= INTRO_T.go) showLabel(3);
    else for (let i = 2; i >= 0; i--) if (t >= INTRO_T.count[i]){ showLabel(i); break; }
    if (t >= INTRO_T.jump) countEl.classList.add('is-gone');

    // snelheid: rustig drijven → hyperjump (steeds sneller) → implosie
    const jumpP = ease((t - INTRO_T.jump) / (INTRO_T.implode - INTRO_T.jump));
    const impP = Math.max(0, Math.min(1, (t - INTRO_T.implode) / (INTRO_T.end - INTRO_T.implode)));
    const speed = 0.0025 + jumpP * jumpP * 0.042;   // topsnelheid iets lager: rustiger sprong

    // achtergrond met een beetje nagloei, zodat strepen ontstaan tijdens de sprong
    ctx.fillStyle = `rgba(0,0,0,${impP > 0 ? 0.35 : 0.55 - jumpP * 0.35})`;
    ctx.fillRect(0, 0, W, H);
    // vage nevel in het midden, die tijdens de sprong blauw opgloeit
    const neb = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.9);
    neb.addColorStop(0, `rgba(40,70,140,${0.05 + jumpP * 0.18 * (1 - impP)})`);
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);

    // zwart gat: een gloeiende ring die eerst opzwelt en dan in een punt verdwijnt. Eerst de
    // ring, dan de sterren die er zichtbaar in spiralen, en de zwarte kern als laatste erover.
    const holeR = impP > 0 ? Math.max(0, scale * 0.11 * Math.sin(Math.PI * Math.min(1, impP * 1.1))) : 0;
    if (holeR > 0.5){
      const ring = ctx.createRadialGradient(cx, cy, holeR * 0.8, cx, cy, holeR * 2.2);
      ring.addColorStop(0, 'rgba(0,0,0,0)');
      ring.addColorStop(0.2, 'rgba(255,160,80,0.32)');
      ring.addColorStop(0.42, 'rgba(110,150,255,0.18)');
      ring.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ring;
      ctx.beginPath(); ctx.arc(cx, cy, holeR * 2.2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalCompositeOperation = 'lighter';
    // implosie: alles draait rond het midden (swirl) en wordt naar binnen getrokken (pull);
    // het spoor van een ster loopt vanaf zijn plek in het vorige beeldje
    const swirlOf = (p) => p * p * 5, pullOf = (p) => Math.pow(1 - p, 1.6);
    const sw = swirlOf(impP), pl = pullOf(impP), psw = swirlOf(prevImpP), ppl = pullOf(prevImpP);
    prevImpP = impP;
    for (const s of stars){
      s.pz = s.z;
      if (impP === 0){
        s.z -= speed * dt;
        if (s.z <= 0.02){ Object.assign(s, newStar(true)); s.pz = s.z; continue; }
      }
      const proj = (z, swirl, pull) => {
        let px = s.x / z * scale * 0.5, py = s.y / z * scale * 0.5;
        if (impP > 0){
          const a = Math.atan2(py, px) + swirl, r = Math.hypot(px, py) * pull;
          px = Math.cos(a) * r; py = Math.sin(a) * r;
        }
        return [cx + px, cy + py];
      };
      const [x, y] = proj(s.z, sw, pl), [ox, oy] = proj(s.pz, psw, ppl);
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50){ if (impP === 0){ Object.assign(s, newStar(true)); s.pz = s.z; } continue; }
      const b = Math.min(1, (1 - s.z) * 1.3 + jumpP * 0.4);
      const col = s.hue === 'blue' ? `rgba(140,190,255,${b})` : `rgba(235,240,255,${b})`;
      const w = Math.max(0.6, (1 - s.z) * 2.2);
      if (jumpP > 0.05 || impP > 0){
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.fillRect(x - w / 2, y - w / 2, w, w);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    if (impP > 0){
      if (holeR > 0.5){
        // dunne heldere rand (de "horizon") + de zwarte kern
        ctx.strokeStyle = 'rgba(255,200,140,0.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, holeR * 0.86, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(cx, cy, holeR * 0.82, 0, Math.PI * 2); ctx.fill();
      }
      // op het laatst: alles weg, één korte lichtflits in het midden
      if (impP > 0.86){
        const f = (impP - 0.86) / 0.14;
        ctx.fillStyle = `rgba(0,0,0,${f})`; ctx.fillRect(0, 0, W, H);
        const fl = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.25 * (1 - f));
        fl.addColorStop(0, `rgba(220,235,255,${0.9 * (1 - f)})`);
        fl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
      }
    }

    if (t >= INTRO_T.end){ finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish(){
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
    document.removeEventListener('keydown', onKey, true);
    if (audio) audio.stop();
    // het spel start nu al achter de overlay, die daarna rustig wegfaadt
    try { onDone(); } finally {
      overlay.classList.add('is-leaving');
      setTimeout(() => { overlay.remove(); introRunning = false; }, INTRO_T.fadeOut);
    }
  }
  const onKey = (e) => { if (e.key === 'Escape'){ e.preventDefault(); finish(); } };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', finish);

  // zwart erin faden (de lobby verdwijnt eronder), daarna loopt de rest vanzelf
  requestAnimationFrame(() => overlay.classList.add('is-in'));
  raf = requestAnimationFrame(frame);
}
