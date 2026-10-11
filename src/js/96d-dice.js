// ---------- dobbelstenen: ruimte-stenen, energiesteen, teller en energie die naar de balk vliegt ----------
// Eén tekenfunctie voor het dobbelvak (#walkDice) in alle modi: Zelf spelen, nagespeelde
// bot-beurten, Automatisch en Multiplayer. renderWalkDice (96-walk.js) en renderSoloDicePending
// (97-solo.js) roepen dit aan.
//
//   loopsteen     donker glas met gloeiende stippen (Stuwstoot-steen in amber)
//   energiesteen  groen glas met 0-3 bliksems op stip-plekken; ernaast groot "+2"
//   draaien       een nieuwe worp draait om de eigen as, steeds langzamer, en staat dan rechtop
//                 stil. Dezelfde worp nog eens tekenen (Multiplayer tekent 5x per seconde) laat
//                 hem NIET opnieuw draaien: #walkDice onthoudt welke worp er staat (data-key).
//   teller        "Gegooid" en "Nog te zetten … van …" groot, met een stappenbalk eronder
//   energie       na het stilvallen vliegen de energiebolletjes van de steen naar je energiebalk;
//                 de balk telt pas op als een bolletje aankomt (diceEnergyCap, gebruikt door
//                 soloRenderEnergyOverview). Alleen voor je eigen worp — bij een bot verandert
//                 jouw balk niet.
//
// Prestatie: elke steen bevat alle kanten en toont er één via data-face. Een attribuut-wijziging
// valt buiten de MutationObserver van de pulsen (97-solo.js: alleen class/hidden), dus het
// wisselen van kanten tijdens het draaien kost bijna niets.
//
// Staat in de bouwvolgorde vóór 97-solo.js (die roept bij het laden al setWalkMode aan, en via
// stopSoloGame komt dat bij diceReset).

const DICE_PIPS = {
  1: [[50,50]], 2: [[28,28],[72,72]], 3: [[27,27],[50,50],[73,73]], 4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[27,27],[73,27],[50,50],[27,73],[73,73]], 6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
};
const DICE_BOLT_POS = { 1: [[50,50]], 2: [[32,32],[68,68]], 3: [[27,27],[50,50],[73,73]] };
const DICE_SPIN_MS = 1050;          // eigen worp: lekker uitdraaien
const DICE_SPIN_SHORT_MS = 500;     // na het schudden van een bot / Automatisch: kort uitdraaien
const DICE_ORB_STAGGER_MS = 200;    // tussen twee energiebolletjes
const DICE_ORB_FLIGHT_MS = 620;

// gloed = een zacht, half doorzichtig cirkeltje achter elke stip (geen CSS-filter: dat liet de
// browser het hele dobbelvak elk beeldje opnieuw tekenen — gemeten: 20 i.p.v. 44 beeldjes/s)
const diceFaceSvg = n => `<svg class="sd-face sd-f${n}" viewBox="0 0 100 100" aria-hidden="true">${DICE_PIPS[n].map(([x, y]) => `<circle class="sd-halo" cx="${x}" cy="${y}" r="14"/><circle cx="${x}" cy="${y}" r="9"/>`).join('')}</svg>`;
const DICE_ALL_FACES = [1,2,3,4,5,6].map(diceFaceSvg).join('');
const diceBoltSvg = (x, y) => `<svg style="left:${x}%;top:${y}%" viewBox="0 0 14 24" aria-hidden="true"><path d="M9.4 .8 1.6 13.4h4.3L4.6 23.2l7.8-13h-4.5z"/></svg>`;
const DICE_E_FACES = [0,1,2,3].map(v => `<span class="sd-face sd-f${v}">${v === 0 ? '<i class="sd-empty"></i>' : DICE_BOLT_POS[v].map(([x, y]) => diceBoltSvg(x, y)).join('')}</span>`).join('');

// één loopsteen. face: 1-6, of '?' (nog niet gegooid). cls: extra klassen (boost, pending, sm…)
function diceDieHtml(face, cls = ''){
  if (face === '?' || face === null || face === undefined) return `<span class="sd-die is-pending ${cls}"><span class="sd-q">?</span></span>`;
  return `<span class="sd-die ${cls}" data-face="${face}" aria-label="${face}">${DICE_ALL_FACES}</span>`;
}
// de energiesteen. face: 0-3 of null (nog niet gegooid)
function diceEnergyDieHtml(face, cls = ''){
  if (face === null || face === undefined) return `<span class="sd-edie is-pending ${cls}"><span class="sd-q">?</span></span>`;
  return `<span class="sd-edie ${cls}" data-face="${face}" aria-label="${face} energie">${DICE_E_FACES}</span>`;
}

const diceHudEl = document.querySelector('#walkDice') ? document.querySelector('#walkDice').closest('.walk-hud') : null;
function diceSetHudResult(on){
  if (diceHudEl && diceHudEl.classList.contains('has-result') !== on) diceHudEl.classList.toggle('has-result', on);
}

// ---------- tekenen ----------
// Beweging (zelfde aanpak als "Wie begint?", zie openingDiceSet onderaan): browser-animaties op
// alleen transform, met een gedeelde, bekende starttijd (diceMotion). Daardoor kan elke volgende
// beweging precies verder vanaf de hoek waar de steen nu staat, zonder die hoek bij de browser op
// te vragen (getComputedStyle dwong midden in de klik een herberekening van de opmaak af, ±7 ms,
// gemeten). Eerst draaiden wiebelen en tollen via CSS, en begon de worp altijd vanaf 0°: bij een
// bot of in Automatisch sprong de steen dan bij de overgang tollen → uitrollen (gebruikersmelding:
// "hakkelig"). De twee loopstenen en de energiesteen draaien om en om de andere kant op.
const DICE_TUMBLE_MS = 450;   // één rondje tijdens het tollen (= 800°/s)
let diceMotion = { mode: 'none', t0: 0, pausedAt: null };
const diceSign = i => i % 2 ? -1 : 1;
// hoek (graden) van steen i in de huidige beweging
function diceMotionAngle(i, now){
  const t = (diceMotion.pausedAt ?? now) - diceMotion.t0;
  if (diceMotion.mode === 'wiggle') return diceSign(i) * OD_WIGGLE_DEG * Math.sin(2 * Math.PI * t / OD_WIGGLE_MS);
  if (diceMotion.mode === 'tumble') return diceSign(i) * 360 * t / DICE_TUMBLE_MS;
  return 0;
}
// wiebelen of tollen starten op alle stenen in #walkDice (met de gedeelde starttijd)
function diceStartMotion(mode){
  diceMotion = { mode, t0: odNow(), pausedAt: null };
  if (crystalReduceMotion()) return;
  walkDiceEl.querySelectorAll('.sd-die, .sd-edie').forEach((el, i) => {
    const s = diceSign(i);
    const anim = mode === 'wiggle'
      ? el.animate(OD_WIGGLE_FRAMES.map(a => ({ transform: `rotate(${(s * a).toFixed(2)}deg)` })), { duration: OD_WIGGLE_MS, iterations: Infinity })
      : el.animate([{ transform: 'rotate(0deg) scale(.94)' }, { transform: `rotate(${s * 360}deg) scale(.94)` }], { duration: DICE_TUMBLE_MS, iterations: Infinity });
    anim.startTime = diceMotion.t0;
  });
  if (walkPanelEl && walkPanelEl.classList.contains('walk-is-paused')) dicePause(true);
}
// Pauze in Automatisch: de stenen staan dan ook stil (setWalkPaused, 96-walk.js)
function dicePause(on){
  if (!walkDiceEl || diceMotion.mode === 'none') return;
  const now = odNow();
  if (on && diceMotion.pausedAt === null) diceMotion.pausedAt = now;
  else if (!on && diceMotion.pausedAt !== null){ diceMotion.t0 += now - diceMotion.pausedAt; diceMotion.pausedAt = null; }
  else return;
  walkDiceEl.querySelectorAll('.sd-die, .sd-edie').forEach(el => el.getAnimations().forEach(a => on ? a.pause() : a.play()));
}

// Wacht op de worp: "?"-stenen die zachtjes om hun as wiebelen. `energy` is al bekend als de
// energiesteen eerder viel (na Zwaartekracht-laarzen e.d.), anders null. Staat precies dit al in
// beeld, dan niets doen: in Multiplayer komt de stand 5x per seconde binnen, en opnieuw tekenen liet
// het wiebelen elke keer opnieuw beginnen (hakkelig bij de gasten).
function diceRenderPending(n, energy){
  if (!walkDiceEl) return;
  const key = `pending|${n}|${energy}`;
  if (walkDiceEl.dataset.key === key && walkDiceEl.firstElementChild) return;
  diceProgress = null;
  const dice = Array.from({ length: n }, (_, i) => diceDieHtml('?', i === 2 ? 'boost' : '')).join('');
  const known = energy !== null && energy !== undefined;
  walkDiceEl.dataset.key = key;
  walkDiceEl.innerHTML = `<div class="sd-row"><span class="sd-dice">${dice}</span>`
    + `<span class="sd-ewrap"><span class="sd-gain${known ? ' show' : ''}${energy === 0 ? ' zero' : ''}">${known ? '+' + energy : ''}</span>${diceEnergyDieHtml(known ? energy : null)}</span></div>`;
  diceSetHudResult(false);
  // in Multiplayer tijdens andermans beurt niet wiebelen: daar hoef jij niets te doen
  if (!(walkPlayAreaEl && walkPlayAreaEl.classList.contains('mp-not-my-turn'))) diceStartMotion('wiggle');
  else diceMotion = { mode: 'none', t0: 0, pausedAt: null };
}
// Schudden (Automatisch / bot naspelen): willekeurige kanten, de stenen tollen rond. Wordt elke
// 90 ms opnieuw aangeroepen; daarom alleen de kanten bijwerken als de stenen er al staan.
function diceRenderTumble(n){
  if (!walkDiceEl) return;
  const rnd = () => 1 + Math.floor(Math.random() * 6);
  const rndE = () => ENERGY_DIE_FACES[Math.floor(Math.random() * ENERGY_DIE_FACES.length)];
  if (walkDiceEl.dataset.key === 'tumble' && walkDiceEl.querySelectorAll('.sd-die').length === n){
    walkDiceEl.querySelectorAll('.sd-die').forEach(d => { d.dataset.face = rnd(); });
    const e = walkDiceEl.querySelector('.sd-edie'); if (e) e.dataset.face = rndE();
    return;
  }
  walkDiceEl.dataset.key = 'tumble';
  const dice = Array.from({ length: n }, (_, i) => diceDieHtml(rnd(), 'is-tumbling' + (i === 2 ? ' boost' : ''))).join('');
  walkDiceEl.innerHTML = `<div class="sd-row"><span class="sd-dice">${dice}</span>`
    + `<span class="sd-ewrap"><span class="sd-gain"></span>${diceEnergyDieHtml(rndE(), 'is-tumbling')}</span></div>`;
  diceSetHudResult(false);
  diceStartMotion('tumble');
}
// De uitgevallen worp. `key` maakt de worp uniek: is hij al getekend, dan alleen de teller
// bijwerken (geen tweede keer draaien). opts.spinMs: hoe lang uitdraaien (0 = meteen stil),
// opts.flow: energiebolletjes naar de balk laten vliegen (alleen je eigen worp).
function diceRenderRoll(d, e, total, key, opts = {}){
  if (!walkDiceEl) return;
  if (walkDiceEl.dataset.key === key && walkDiceEl.querySelector('.sd-result')){ diceRenderProgress(); return; }
  const sum = d.reduce((a, b) => a + b, 0);
  const steps = (total === undefined || total === null) ? sum : total;
  const fresh = walkDiceEl.dataset.key !== key;
  walkDiceEl.dataset.key = key;
  if (!diceProgress || diceProgress.key !== key) diceProgress = { key, sum, steps, done: 0, left: steps };
  const spinMs = crystalReduceMotion() ? 0 : (opts.spinMs === undefined ? DICE_SPIN_MS : opts.spinMs);
  const spinning = fresh && spinMs > 0;
  // waar stonden de stenen (wiebelen of tollen)? Daar gaat de worp verder
  const now = odNow(), from = diceMotion.mode;
  const fromAngles = Array.from({ length: d.length + 1 }, (_, i) => diceMotionAngle(i, now));
  diceMotion = { mode: 'none', t0: 0, pausedAt: null };
  const dice = d.map((v, i) => diceDieHtml(v, (spinning ? 'is-spinning' : '') + (i === 2 ? ' boost' : ''))).join('');
  walkDiceEl.innerHTML = `<div class="sd-row"><span class="sd-dice">${dice}</span>`
    + `<span class="sd-ewrap"><span class="sd-gain${spinning ? '' : ' show'}${e === 0 ? ' zero' : ''}">+${e}</span>${diceEnergyDieHtml(e, spinning ? 'is-spinning' : '')}</span></div>`
    + `<div class="sd-result${spinning ? ' is-waiting' : ''}">`
    +   `<div class="sd-count"><div class="sd-cnt"><span class="sd-lbl">Gegooid</span><span class="sd-val sd-rolled">${spinning ? '…' : sum}${!spinning && steps < sum ? `<small class="sd-pen">−${sum - steps}</small>` : ''}</span></div>`
    +   `<div class="sd-cnt sd-left"><span class="sd-lbl">Nog te zetten</span><span class="sd-val sd-leftval">…</span></div></div>`
    +   `<div class="sd-track"></div>`
    + `</div>`;
  diceSetHudResult(true);
  if (!spinning){ diceRenderProgress(); if (fresh && opts.flow) diceFlowEnergy(); return; }

  // draaien om de eigen as en rechtop stoppen (hele rondjes); de kanten wisselen intussen, ook
  // steeds trager, tot de echte uitkomst
  const els = [...walkDiceEl.querySelectorAll('.sd-die, .sd-edie')];
  const finals = [...d, e];
  let left = els.length;
  els.forEach((el, i) => {
    const isE = el.classList.contains('sd-edie');
    const s = diceSign(i), a0 = fromAngles[i] || 0;
    let dur, anim;
    if (from === 'tumble'){
      // tollen (bot / Automatisch): met dezelfde vaart (800°/s) verder en kwadratisch afremmen tot
      // het volgende hele rondje; kwadratisch afremmen begint met snelheid 2·afstand/duur
      const v = 360 / DICE_TUMBLE_MS;   // graden per ms
      const a1 = s * Math.ceil((s * a0 + v * spinMs / 2) / 360) * 360;
      dur = Math.round(2 * Math.abs(a1 - a0) / v) + i * 40;
      anim = el.animate([{ transform: `rotate(${a0.toFixed(2)}deg) scale(.94)` }, { transform: `rotate(${a1}deg) scale(1)` }],
                        { duration: dur, easing: OD_EASE_OUT });
    } else {
      // eigen worp (vanuit het wiebelen): een flinke zwiep, steeds langzamer, rechtop stoppen
      dur = spinMs + i * Math.round(spinMs / 9);
      const turns = (isE ? 2 : 3) + (i % 2);
      anim = el.animate([{ transform: `rotate(${a0.toFixed(2)}deg) scale(.96)` }, { transform: `rotate(${s * 360 * turns * .7}deg) scale(1.06)`, offset: .55 }, { transform: `rotate(${s * 360 * turns}deg) scale(1)` }],
                        { duration: dur, easing: 'cubic-bezier(.2,.65,.3,1)' });
    }
    anim.startTime = now;   // zelfde moment als waarop de hoek hierboven berekend is
    let t = 0, gap = 55;
    while (t + gap < dur - 120){
      t += gap; gap *= 1.22;
      diceLater(() => { el.dataset.face = isE ? ENERGY_DIE_FACES[Math.floor(Math.random() * ENERGY_DIE_FACES.length)] : 1 + Math.floor(Math.random() * 6); }, t);
    }
    diceLater(() => {
      el.dataset.face = finals[i];
      el.classList.remove('is-spinning'); el.classList.add('is-landed');
      if (--left === 0) landed();
    }, dur);
  });
  function landed(){
    if (walkDiceEl.dataset.key !== key) return;   // intussen een andere worp getekend
    const g = walkDiceEl.querySelector('.sd-gain'); if (g) g.classList.add('show');
    const r = walkDiceEl.querySelector('.sd-rolled');
    if (r){ r.innerHTML = `${sum}${steps < sum ? `<small class="sd-pen">−${sum - steps}</small>` : ''}`; r.classList.add('is-pop'); }
    const res = walkDiceEl.querySelector('.sd-result'); if (res) res.classList.remove('is-waiting');
    diceRenderProgress();
    if (opts.flow) diceLater(diceFlowEnergy, 300);
  }
}

// Geen worp nodig (een sprong/sprint maakte de beurt al af): alleen de energiesteen.
function diceRenderNoRoll(e){
  if (!walkDiceEl) return;
  diceProgress = null;
  diceMotion = { mode: 'none', t0: 0, pausedAt: null };
  walkDiceEl.dataset.key = '';
  walkDiceEl.innerHTML = `<div class="sd-row"><span class="sd-none">geen worp nodig</span>`
    + `<span class="sd-ewrap"><span class="sd-gain show${e === 0 ? ' zero' : ''}">+${e}</span>${diceEnergyDieHtml(e)}</span></div>`;
  diceSetHudResult(false);
}

// ---------- teller + stappenbalk ----------
let diceProgress = null;   // { key, sum, steps, done, left }
// absolute stand (Zelf spelen / Multiplayer: uit soloMove)
function diceSetProgress(done, left){
  if (!diceProgress) return;
  diceProgress.done = done;
  diceProgress.left = left;
  diceRenderProgress();
}
// één stap verder (bot naspelen / Automatisch, die tellen zelf mee)
function diceProgressStep(){
  if (!diceProgress) return;
  diceProgress.done++;
  diceProgress.left = Math.max(0, diceProgress.left - 1);
  diceRenderProgress();
}
function diceProgressDone(){
  if (!diceProgress) return;
  diceProgress.left = 0;
  diceRenderProgress();
}
function diceRenderProgress(){
  if (!walkDiceEl || !diceProgress) return;
  const res = walkDiceEl.querySelector('.sd-result');
  if (!res || res.classList.contains('is-waiting')) return;
  const { sum, steps, done, left } = diceProgress;
  const total = Math.max(steps, done + left);
  const lv = res.querySelector('.sd-leftval');
  const html = left <= 0 ? 'Klaar' : `${left}<small>van ${total}</small>`;
  if (lv && lv.innerHTML !== html){
    lv.innerHTML = html;
    // "plop" via een losse animatie i.p.v. klasse eraf/erop met een gedwongen herberekening van de
    // opmaak ertussen: dat kostte bij elke stap ±8 ms en liet de rest haperen (gemeten)
    if (!crystalReduceMotion()) lv.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,1.8,.4,1)' });
    lv.parentNode.classList.toggle('is-done', left <= 0);
  }
  // één streepje per stap; de straf van Stroomonderbreking doorgestreept erachter
  const pen = Math.max(0, sum - steps);
  let bar = '';
  for (let i = 0; i < total; i++) bar += `<i class="${i < done ? 'is-done' : i === done && left > 0 ? 'is-next' : ''}"></i>`;
  for (let i = 0; i < pen; i++) bar += '<i class="is-pen"></i>';
  const tr = res.querySelector('.sd-track');
  if (tr && tr.dataset.bar !== bar){ tr.dataset.bar = bar; tr.innerHTML = bar; }
}

// ---------- energie naar de balk ----------
// diceFlow: welke speler, vanaf welke stand, hoeveel er al zijn aangekomen. Zolang hij loopt
// toont soloRenderEnergyOverview niet meer dan base + aangekomen (diceEnergyCap).
let diceFlow = { done: true };
const diceTimers = new Set();
function diceLater(fn, ms){ const t = setTimeout(() => { diceTimers.delete(t); fn(); }, ms); diceTimers.add(t); return t; }
// begin de "wacht op de bolletjes"-stand zodra een eigen worp is gevallen (vóór de balk wordt
// getekend): base = energie vóór deze worp
function diceHoldEnergy(player, gain){
  if (!player || !gain) return;
  const total = (gain.gained || 0) + (gain.wasted || 0);
  if (!total){ diceFlow = { done: true }; return; }
  diceFlow = { idx: player.idx, base: player.energy - (gain.gained || 0), gained: gain.gained || 0, total, arrived: 0, started: false, done: false };
  // vangnet: lukt de animatie niet (vak verborgen, tab op de achtergrond), dan na een tijdje gewoon vrijgeven
  diceLater(() => { if (!diceFlow.done){ diceFlow.done = true; soloRenderEnergyOverview(); } }, DICE_SPIN_MS + 1500 + total * (DICE_ORB_STAGGER_MS + DICE_ORB_FLIGHT_MS));
}
function diceEnergyCap(player, energy){
  if (diceFlow.done || !player || player.idx !== diceFlow.idx) return energy;
  return Math.min(energy, diceFlow.base + Math.min(diceFlow.arrived, diceFlow.gained));
}
function diceFlowEnergy(){
  const f = diceFlow;
  if (f.done || f.started) return;
  f.started = true;
  const from = walkDiceEl && walkDiceEl.querySelector('.sd-edie');
  const cells = walkEnergyNodes();   // de knooppunten van het stroomcircuit (97-solo.js)
  const visible = from && from.getClientRects().length && cells.length && cells[0].getClientRects().length;
  if (!visible || crystalReduceMotion()){ f.arrived = f.total; f.done = true; soloRenderEnergyOverview(); return; }
  // Alle posities één keer vooraf opmeten (elke meting midden in het spel dwingt de browser de
  // opmaak opnieuw te berekenen, ±8 ms). Het vliegen zelf is een browser-animatie (alleen
  // transform/opacity): die loopt los van JavaScript, dus hapert niet als er tegelijk een pion
  // loopt of de zijkolom opnieuw getekend wordt (gebruikersmelding: "enorm hakkelig"). Eerst werd
  // elk beeldje de positie in JavaScript gezet, met een drop-shadow-filter, en kwam er elke 30 ms
  // een nieuw spoorelementje bij. Nu: een vaste gloed (geen filter) en 4 volgers als staart.
  const fr = from.getBoundingClientRect(), A = [fr.left + fr.width / 2, fr.top + fr.height / 2];
  const targets = Array.from({ length: f.total }, (_, k) => {
    const cr = cells[Math.min(ENERGY_MAX - 1, f.base + k)].getBoundingClientRect();
    return k >= f.gained ? [cr.left + cr.width / 2 + 16, cr.top - 30] : [cr.left + cr.width / 2, cr.top + cr.height / 2];
  });
  let landed = 0;
  for (let k = 0; k < f.total; k++){
    diceLater(() => {
      if (diceFlow !== f) return;
      const lost = k >= f.gained, C = targets[k];
      const P = [(A[0] + C[0]) / 2 + 30, Math.min(A[1], C[1]) - 50];
      const orb = diceOrbFly('sd-orb', A, P, C, 1, 1, 0);
      for (const t of DICE_ORB_TRAIL) diceOrbFly('sd-trail', A, P, C, t.scale, t.alpha, t.delay);
      orb.finished.then(() => {
        orb.effect.target.remove();
        if (diceFlow !== f) return;   // intussen nieuw potje / gestopt
        if (lost){
          const l = document.createElement('div');
          l.className = 'sd-fx sd-lost'; l.textContent = 'verloren'; l.style.left = C[0] + 'px'; l.style.top = C[1] + 'px';
          document.body.appendChild(l); l.addEventListener('animationend', () => l.remove());
        } else {
          f.arrived++;
          soloRenderEnergyOverview();   // precies deze cel laadt nu op
        }
        if (++landed === f.total){ f.done = true; soloRenderEnergyOverview(); }
      }, () => {});   // afgebroken (nieuw potje): niets doen
    }, k * DICE_ORB_STAGGER_MS);
  }
}
// de staart: kleinere, vagere kopieën die hetzelfde pad iets later afleggen
const DICE_ORB_TRAIL = [
  { delay: 40, scale: .75, alpha: .6 }, { delay: 80, scale: .58, alpha: .42 },
  { delay: 120, scale: .44, alpha: .28 }, { delay: 160, scale: .32, alpha: .16 },
];
// één bolletje (of staartstuk) langs de boog A → (P) → C laten vliegen; geeft de Animation terug
function diceOrbFly(cls, A, P, C, scale, alpha, delay){
  const el = document.createElement('div');
  el.className = 'sd-fx ' + cls;
  document.body.appendChild(el);
  const N = 24, frames = [];
  for (let i = 0; i <= N; i++){
    const t = i / N, q = t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;
    const [x, y] = crystalBez(A, P, C, q);
    frames.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(scale * (1 + .4 * Math.sin(t * Math.PI))).toFixed(3)})`, opacity: alpha });
  }
  const anim = el.animate(frames, { duration: DICE_ORB_FLIGHT_MS, delay });
  if (cls !== 'sd-orb') anim.finished.then(() => el.remove(), () => el.remove());
  return anim;
}
// Is de worp die nu in soloMove staat die van mij (de kijker), en nog niet "afgehandeld"?
// Dan de energiebalk laten wachten op de bolletjes. Gebruikt door de host/Zelf spelen
// (soloRollDice) én een gast (mpApplyState, vóór de balk getekend wordt).
let diceFlowKey = null;
function diceSoloRollKey(){
  if (!soloMove || soloMove.d1 === undefined || soloMove.d1 === null) return null;
  return `${soloTurn}|${soloActiveIdx}|${soloMove.d1}|${soloMove.d2}|${soloMove.d3}|${soloEnergyRoll}`;
}
function diceMaybeHold(){
  if (!diceSoloRollKey() || soloEnergyRoll === null || soloEnergyRoll === undefined) return;
  const key = `${soloTurn}|${soloActiveIdx}`;   // per beurt: een Koerscorrectie geeft geen nieuwe energie
  if (key === diceFlowKey) return;
  diceFlowKey = key;
  const p = soloPlayers[soloActiveIdx];
  if (p && typeof soloViewer === 'function' && soloViewer() === p && soloEnergyGain) diceHoldEnergy(p, soloEnergyGain);
  else diceFlow = { done: true };
}
// ---------- "Wie begint?": wiebelen, doorrollen en uitrollen ----------
// renderOpeningPanel (96-walk.js) bouwt het paneel bij elke stap opnieuw op. De draaiing zit
// daarom niet in de stenen zelf maar hier, per speler: welke beweging, sinds wanneer, vanaf welke
// hoek. Elke (nieuwe) steen van die speler (data-od="speler-steen") krijgt dezelfde animatie met
// dezelfde starttijd, dus een draai loopt gewoon door over een nieuwe opbouw heen.
// Het draaien zelf doet de browser (Web Animations, alleen transform): dat loopt los van
// JavaScript en hapert dus niet als de pagina even druk is (gebruikersmelding: de eerste versie,
// die elk beeldje zelf de hoek zette, was hakkelig). Bij elke overgang rekenen we de huidige
// hoek en snelheid uit (odAngle), zodat de volgende beweging precies daar verder gaat:
//   wiggle  wacht op de worp: zachtjes heen en weer om de eigen as (gebruikerswens: niet meer
//           op en neer)
//   spin    gooien: vanuit het wiebelen kwadratisch optrekken tot 2,5 rondje per seconde (sneller
//           oogt flikkerig), de kanten flitsen voorbij
//   land    de worp is bekend: met die vaart uitrollen (kwadratisch afremmen) en precies rechtop
//           stilvallen op de uitkomst; de som verschijnt pas dan
// De twee stenen draaien tegen elkaar in. De kanten wisselen via data-face.
const OD_WIGGLE_DEG = 11, OD_WIGGLE_MS = 1400, OD_SPIN_DPS = 900, OD_ACCEL_MS = 350;
const OD_ACCEL_DEG = OD_SPIN_DPS * OD_ACCEL_MS / 2000;   // eindigt precies op de draaisnelheid
const OD_EASE_IN = 'cubic-bezier(.333,0,.667,.333)';    // = u²
const OD_EASE_OUT = 'cubic-bezier(.333,.667,.667,1)';   // = 1 − (1 − u)²
// het wiebelen als sinus, in stukjes (lineair ertussen), zodat odAngle het precies kan volgen
const OD_WIGGLE_FRAMES = Array.from({ length: 25 }, (_, i) => OD_WIGGLE_DEG * Math.sin(2 * Math.PI * i / 24));
const odState = new Map();   // speler-idx -> { mode, t0, a0, a1, dur, finals, v, timers }
const odNow = () => document.timeline.currentTime;
// hoek (graden) van steen 0 van deze speler op tijdstip `now`; steen 1 draait gespiegeld
function odAngle(s, now){
  const t = Math.max(0, now - s.t0);
  if (s.mode === 'wiggle') return OD_WIGGLE_DEG * Math.sin(2 * Math.PI * t / OD_WIGGLE_MS);
  if (s.mode === 'spin') return t < OD_ACCEL_MS
    ? s.a0 + OD_ACCEL_DEG * (t / OD_ACCEL_MS) ** 2
    : s.a0 + OD_ACCEL_DEG + OD_SPIN_DPS * (t - OD_ACCEL_MS) / 1000;
  if (s.mode === 'land'){ const u = Math.min(1, t / s.dur); return s.a0 + (s.a1 - s.a0) * (1 - (1 - u) ** 2); }
  return 0;
}
// hoe lang (ms) rollen er nog stenen uit? (openingShuffle in 96-walk.js wacht daarop)
function openingDiceBusyMs(){
  const now = odNow();
  let ms = 0;
  for (const s of odState.values()) if (s.mode === 'land') ms = Math.max(ms, s.t0 + s.dur - now);
  return ms;
}
function odClearTimers(s){ for (const t of s.timers) clearTimeout(t); s.timers = []; }
function odLater(s, fn, ms){ s.timers.push(setTimeout(fn, ms)); }
const odEls = idx => document.querySelectorAll(`[data-od^="${idx}-"]`);
const odFlip = idx => odEls(idx).forEach(el => { const d = el.firstElementChild; if (d && d.dataset.face) d.dataset.face = 1 + Math.floor(Math.random() * 6); });
// de animatie van deze toestand op één steen zetten (opnieuw, met de gedeelde starttijd)
function odApply(el, s){
  el.getAnimations().forEach(a => a.cancel());
  el.dataset.odv = s.v;
  if (s.mode === 'rest') return;
  const sg = el.dataset.od.endsWith('-1') ? -1 : 1;
  const rot = a => ({ transform: `rotate(${(sg * a).toFixed(2)}deg)` });
  const anims = [];
  if (s.mode === 'wiggle'){
    anims.push(el.animate(OD_WIGGLE_FRAMES.map(rot), { duration: OD_WIGGLE_MS, iterations: Infinity }));
  } else if (s.mode === 'spin'){
    const b = s.a0 + OD_ACCEL_DEG;
    anims.push(el.animate([rot(s.a0), rot(b)], { duration: OD_ACCEL_MS, easing: OD_EASE_IN }));
    anims.push(el.animate([rot(b), rot(b + 360)], { duration: 360 / OD_SPIN_DPS * 1000, delay: OD_ACCEL_MS, iterations: Infinity }));
  } else if (s.mode === 'land'){
    anims.push(el.animate([rot(s.a0), rot(s.a1)], { duration: s.dur, easing: OD_EASE_OUT }));
  }
  for (const a of anims) a.startTime = s.t0;
}
function odSetSumHidden(idx, on){
  odEls(idx).forEach(el => {
    const sum = el.closest('.walk-opening-row')?.querySelector('.walk-opening-sum');
    if (sum) sum.classList.toggle('is-hidden', on);
  });
}
// mode: 'wiggle' | 'spin' | 'result' (finals = de worp) | 'rest'. Aangeroepen na elke opbouw.
function openingDiceSet(idx, mode, finals){
  let s = odState.get(idx);
  if (!s){ s = { mode: 'rest', t0: 0, a0: 0, v: 0, timers: [] }; odState.set(idx, s); }
  if (crystalReduceMotion()) mode = 'rest';
  const now = odNow();
  let next = mode;
  if (mode === 'result') next = s.mode === 'spin' || s.mode === 'wiggle' ? 'land' : s.mode === 'land' ? 'land' : 'rest';
  if (next !== s.mode){
    const a = odAngle(s, now);
    odClearTimers(s);
    if (next === 'spin'){
      Object.assign(s, { mode: 'spin', t0: now, a0: a });
      const tick = () => { odFlip(idx); odLater(s, tick, 80); };
      odLater(s, tick, 80);
    } else if (next === 'land'){
      // snelheid op dit moment (graden/s): na het optrekken de draaisnelheid; kwam de worp nog
      // tijdens het wiebelen binnen (Multiplayer kan de schudstand overslaan), dan toch vlot
      const t = now - s.t0;
      const v = s.mode === 'spin' && t < OD_ACCEL_MS ? Math.max(300, 2 * OD_ACCEL_DEG * t / OD_ACCEL_MS ** 2 * 1000) : OD_SPIN_DPS;
      const a1 = Math.ceil((a + 270) / 360) * 360;
      // kwadratisch afremmen begint met snelheid 2·afstand/duur: duur zo kiezen dat dat klopt
      const dur = Math.min(1800, Math.max(500, 2 * (a1 - a) / v * 1000));
      Object.assign(s, { mode: 'land', t0: now, a0: a, a1, dur, finals });
      // kanten flitsen steeds trager voorbij, het laatste kwart staat de echte uitkomst er
      let at = 0, gap = 80;
      while (at + gap < dur * .75){ at += gap; gap *= 1.25; odLater(s, () => odFlip(idx), at); }
      odLater(s, () => odEls(idx).forEach(el => { const d = el.firstElementChild; if (d && d.dataset.face) d.dataset.face = s.finals[+el.dataset.od.split('-')[1]]; }), dur * .75);
      odLater(s, () => {
        s.mode = 'rest'; s.v++;
        odEls(idx).forEach(el => { el.dataset.odv = s.v; el.firstElementChild?.classList.add('is-landed'); });
        odSetSumHidden(idx, false);
      }, dur);
    } else {
      Object.assign(s, { mode: next, t0: now, a0: 0 });
    }
    s.v++;
  }
  // nieuwe of verouderde stenen van deze speler de juiste animatie geven
  odEls(idx).forEach(el => { if (el.dataset.odv !== String(s.v)) odApply(el, s); });
  odSetSumHidden(idx, s.mode === 'land');
}

// nieuw potje / gestopt
function diceReset(){
  for (const t of diceTimers) clearTimeout(t);
  diceTimers.clear();
  for (const s of odState.values()) odClearTimers(s);
  odState.clear();
  diceMotion = { mode: 'none', t0: 0, pausedAt: null };
  diceFlow = { done: true };
  diceFlowKey = null;
  diceProgress = null;
  document.querySelectorAll('.sd-fx').forEach(el => el.remove());
  if (walkDiceEl) walkDiceEl.dataset.key = '';
  diceSetHudResult(false);
}
