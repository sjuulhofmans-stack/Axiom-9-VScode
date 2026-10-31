// ---------- dobbelstenen: ruimte-stenen, energiesteen, teller en energie die naar de balk vliegt ----------
// Eén tekenfunctie voor het dobbelvak (#walkDice) in alle modi: Zelf spelen, nagespeelde
// bot-beurten, Automatisch en Multiplayer. renderWalkDice (96-walk.js) en renderSoloDicePending
// (97-solo.js) roepen dit aan.
//
//   loopsteen     "Pantser": afgeschuinde hoeken, ruitvormige stippen (Stuwstoot-steen in amber)
//   energiesteen  zelfde vorm met een groene rand en 0-3 bliksems op stip-plekken; ernaast groot "+2"
//   wachten       "Pulse": alle stenen samen iets groter en weer kleiner
//   gooien        "Teleport": de steen verdwijnt in een lichtstraal en komt terug met de uitkomst.
//                 Dezelfde worp nog eens tekenen (Multiplayer tekent 5x per seconde) laat
//                 hem NIET opnieuw gooien: #walkDice onthoudt welke worp er staat (data-key).
//   (alle drie gekozen uit 10 varianten, artifact "Axiom-9 Dobbelstenen", 2026-10)
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

// gloed = een zachte, half doorzichtige ruit achter elke stip (geen CSS-filter: dat liet de
// browser het hele dobbelvak elk beeldje opnieuw tekenen — gemeten: 20 i.p.v. 44 beeldjes/s)
const diceRuit = (x, y, r) => `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;
const diceFaceSvg = n => `<svg class="sd-face sd-f${n}" viewBox="0 0 100 100" aria-hidden="true">${DICE_PIPS[n].map(([x, y]) => `<polygon class="sd-halo" points="${diceRuit(x, y, 15)}"/><polygon points="${diceRuit(x, y, 10.5)}"/>`).join('')}</svg>`;
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
// Vakje om een steen, met de lichtstraal en de ring van de teleport er al in (onzichtbaar). Die
// staan naast de steen en niet erin: de steen zelf krimpt bij het teleporteren tot bijna niets.
// Vooraf erin, zodat er midden in een beurt niets aan de DOM verandert. cls: 'boost' / 'is-e'.
function diceCell(html, cls = ''){
  return `<span class="sd-cell ${cls}">${html}<i class="sd-beam"></i><i class="sd-ring"></i></span>`;
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
// "hakkelig"). De twee loopstenen en de energiesteen tollen om en om de andere kant op.
const DICE_TUMBLE_MS = 450;   // één rondje tijdens het tollen (= 800°/s)
let diceMotion = { mode: 'none', t0: 0, pausedAt: null };
const diceSign = i => i % 2 ? -1 : 1;

// Wachten = puls: alle stenen tegelijk iets groter en weer kleiner (in stukjes, lineair ertussen,
// zodat dicePulseScale precies kan zeggen hoe groot een steen op een moment is)
const DICE_PULSE_MS = 1600, DICE_PULSE_AMP = .08;
const dicePulseScale = t => 1 + DICE_PULSE_AMP * (.5 - .5 * Math.cos(2 * Math.PI * t / DICE_PULSE_MS));
const DICE_PULSE_FRAMES = Array.from({ length: 25 }, (_, i) => ({ transform: `scale(${dicePulseScale(i / 24 * DICE_PULSE_MS).toFixed(4)})` }));

// stand van steen i in de huidige beweging: hoek (graden) en grootte
function diceMotionPose(i, now){
  const t = (diceMotion.pausedAt ?? now) - diceMotion.t0;
  if (diceMotion.mode === 'pulse') return { a: 0, k: dicePulseScale(t) };
  if (diceMotion.mode === 'tumble') return { a: diceSign(i) * 360 * t / DICE_TUMBLE_MS, k: .94 };
  return { a: 0, k: 1 };
}
// pulseren of tollen starten op alle stenen in #walkDice (met de gedeelde starttijd)
function diceStartMotion(mode){
  diceMotion = { mode, t0: odNow(), pausedAt: null };
  if (crystalReduceMotion()) return;
  walkDiceEl.querySelectorAll('.sd-die, .sd-edie').forEach((el, i) => {
    const s = diceSign(i);
    const anim = mode === 'pulse'
      ? el.animate(DICE_PULSE_FRAMES, { duration: DICE_PULSE_MS, iterations: Infinity })
      : el.animate([{ transform: 'rotate(0deg) scale(.94)' }, { transform: `rotate(${s * 360}deg) scale(.94)` }], { duration: DICE_TUMBLE_MS, iterations: Infinity });
    anim.startTime = diceMotion.t0;
  });
  if (walkPanelEl && walkPanelEl.classList.contains('walk-is-paused')) dicePause(true);
}

// Gooien = teleport: de steen draait weg en krimpt in een lichtstraal (tot 32%), is even weg
// (de uitkomst wordt dan neergezet, bij 40%), schiet groot terug (76%) en staat rechtop stil.
// Begint precies in de stand van daarvoor (a0 = hoek, k0 = grootte), dus naadloos vanuit de puls
// of het tollen. Gebruikt in #walkDice én bij "Wie begint?". Geeft de Animation terug.
const DICE_TP_FACE_AT = .4;
function diceTeleport(el, s, a0, k0, dur, startTime){
  const a = ((a0 % 360) + 540) % 360 - 180;   // tollen kan op 1000° staan: niet terugdraaien
  const tf = (r, k) => `rotate(${r.toFixed(2)}deg) scale(${k})`;
  const anim = el.animate([
    { transform: tf(a, k0.toFixed(4)), opacity: 1, easing: 'ease-in' },
    { transform: tf(a + s * 120, .08), opacity: 0, offset: .32 },
    { transform: tf(s * 120, .08), opacity: 0, offset: .5, easing: 'cubic-bezier(.2,.8,.3,1.2)' },
    { transform: tf(-s * 8, 1.22), opacity: 1, offset: .76 },
    { transform: tf(0, 1), opacity: 1 },
  ], { duration: dur });
  anim.startTime = startTime;
  const cell = el.closest('.sd-cell');
  if (cell){
    const beam = cell.querySelector('.sd-beam'), ring = cell.querySelector('.sd-ring');
    const fx = (node, frames, delay, d) => {
      if (!node) return;
      const an = node.animate(frames, { duration: d, delay, easing: 'cubic-bezier(.2,.7,.3,1)' });
      an.startTime = startTime;
    };
    fx(beam, [{ transform: 'scaleY(.1)', opacity: 0 }, { transform: 'scaleY(1)', opacity: .9, offset: .4 }, { transform: 'scaleY(.2)', opacity: 0 }], dur * .18, dur * .55);
    fx(ring, [{ transform: 'scale(.2)', opacity: 1 }, { transform: 'scale(1.7)', opacity: 0 }], dur * .5, 450);
  }
  return anim;
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
// de rij stenen in #walkDice: loopstenen (de 3e = Stuwstoot, amber) en rechts de energiesteen
function diceRowHtml(diceHtml, gainHtml, eDieHtml){
  return `<div class="sd-row"><span class="sd-dice">${diceHtml.map((h, i) => diceCell(h, i === 2 ? 'boost' : '')).join('')}</span>`
    + `<span class="sd-ewrap">${gainHtml}${diceCell(eDieHtml, 'is-e')}</span></div>`;
}

// Wacht op de worp: "?"-stenen die zachtjes pulseren. `energy` is al bekend als de
// energiesteen eerder viel (na Zwaartekracht-laarzen e.d.), anders null. Staat precies dit al in
// beeld, dan niets doen: in Multiplayer komt de stand 5x per seconde binnen, en opnieuw tekenen liet
// de beweging elke keer opnieuw beginnen (hakkelig bij de gasten).
function diceRenderPending(n, energy){
  if (!walkDiceEl) return;
  const key = `pending|${n}|${energy}`;
  if (walkDiceEl.dataset.key === key && walkDiceEl.firstElementChild) return;
  diceProgress = null;
  diceLandAt = 0;
  const dice = Array.from({ length: n }, (_, i) => diceDieHtml('?', i === 2 ? 'boost' : ''));
  const known = energy !== null && energy !== undefined;
  walkDiceEl.dataset.key = key;
  walkDiceEl.innerHTML = diceRowHtml(dice, `<span class="sd-gain${known ? ' show' : ''}${energy === 0 ? ' zero' : ''}">${known ? '+' + energy : ''}</span>`, diceEnergyDieHtml(known ? energy : null));
  diceSetHudResult(false);
  // in Multiplayer tijdens andermans beurt niet pulseren: daar hoef jij niets te doen
  if (!(walkPlayAreaEl && walkPlayAreaEl.classList.contains('mp-not-my-turn'))) diceStartMotion('pulse');
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
  const dice = Array.from({ length: n }, (_, i) => diceDieHtml(rnd(), 'is-tumbling' + (i === 2 ? ' boost' : '')));
  walkDiceEl.innerHTML = diceRowHtml(dice, '<span class="sd-gain"></span>', diceEnergyDieHtml(rndE(), 'is-tumbling'));
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
  // waar stonden de stenen (pulseren of tollen)? Daar gaat de worp verder
  const now = odNow(), from = diceMotion.mode;
  const fromPoses = Array.from({ length: d.length + 1 }, (_, i) => diceMotionPose(i, now));
  diceMotion = { mode: 'none', t0: 0, pausedAt: null };
  const dice = d.map((v, i) => diceDieHtml(v, (spinning ? 'is-spinning' : '') + (i === 2 ? ' boost' : '')));
  walkDiceEl.innerHTML = diceRowHtml(dice, `<span class="sd-gain${spinning ? '' : ' show'}${e === 0 ? ' zero' : ''}">+${e}</span>`, diceEnergyDieHtml(e, spinning ? 'is-spinning' : ''))
    + `<div class="sd-result${spinning ? ' is-waiting' : ''}">`
    +   `<div class="sd-count"><div class="sd-cnt"><span class="sd-lbl">Gegooid</span><span class="sd-val sd-rolled">${spinning ? '…' : sum}${!spinning && steps < sum ? `<small class="sd-pen">−${sum - steps}</small>` : ''}</span></div>`
    +   `<div class="sd-cnt sd-left"><span class="sd-lbl">Nog te zetten</span><span class="sd-val sd-leftval">…</span></div></div>`
    +   `<div class="sd-track"></div>`
    + `</div>`;
  diceSetHudResult(true);
  diceLandAt = 0;
  if (!spinning){ diceRenderProgress(); if (fresh && opts.flow) diceFlowEnergy(); return; }

  // teleporteren: de steen verdwijnt in een lichtstraal; terwijl hij weg is komt de uitkomst
  // erop, en zo komt hij terug. De stenen komen kort na elkaar terug.
  const els = [...walkDiceEl.querySelectorAll('.sd-die, .sd-edie')];
  const finals = [...d, e];
  let left = els.length;
  els.forEach((el, i) => {
    const { a, k } = fromPoses[i] || { a: 0, k: 1 };
    // eigen worp: rustig; na het tollen van een bot / Automatisch (korte spinMs) iets vlotter
    const dur = from === 'tumble' ? Math.max(650, spinMs) + i * 60 : spinMs + i * Math.round(spinMs / 9);
    diceTeleport(el, diceSign(i), a, k, dur, now);   // zelfde moment als waarop de stand hierboven berekend is
    diceLater(() => { el.dataset.face = finals[i]; }, dur * DICE_TP_FACE_AT);
    diceLater(() => {
      el.classList.remove('is-spinning');
      if (--left === 0) landed();
    }, dur);
    diceLandAt = Math.max(diceLandAt, now + dur);
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

// Wanneer liggen de stenen van de laatste worp stil (odNow-tijd, 0 = nu al)? Pas dan mag je lopen
// (gebruikersmelding: je kon al stappen zetten terwijl de stenen nog draaiden). soloMarkClickable
// (97-solo.js) wacht hierop; dat dekt Zelf spelen, Koerscorrectie en een gast in Multiplayer, die
// elk de worp in hun eigen venster zien uitrollen.
let diceLandAt = 0;
function diceBusyMs(){ return diceLandAt ? Math.max(0, diceLandAt - odNow()) : 0; }

// Geen worp nodig (een sprong/sprint maakte de beurt al af): alleen de energiesteen.
function diceRenderNoRoll(e){
  if (!walkDiceEl) return;
  diceLandAt = 0;
  diceProgress = null;
  diceMotion = { mode: 'none', t0: 0, pausedAt: null };
  walkDiceEl.dataset.key = '';
  walkDiceEl.innerHTML = `<div class="sd-row"><span class="sd-none">geen worp nodig</span>`
    + `<span class="sd-ewrap"><span class="sd-gain show${e === 0 ? ' zero' : ''}">+${e}</span>${diceCell(diceEnergyDieHtml(e), 'is-e')}</span></div>`;
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
// ---------- "Wie begint?": pulseren, doorrollen en teleporteren ----------
// renderOpeningPanel (96-walk.js) bouwt het paneel bij elke stap opnieuw op. De beweging zit
// daarom niet in de stenen zelf maar hier, per speler: welke beweging, sinds wanneer, vanaf welke
// hoek. Elke (nieuwe) steen van die speler (data-od="speler-steen") krijgt dezelfde animatie met
// dezelfde starttijd, dus een beweging loopt gewoon door over een nieuwe opbouw heen.
// Het bewegen zelf doet de browser (Web Animations, alleen transform/opacity): dat loopt los van
// JavaScript en hapert dus niet als de pagina even druk is (gebruikersmelding: de eerste versie,
// die elk beeldje zelf de hoek zette, was hakkelig). Bij elke overgang rekenen we de huidige
// stand uit (odAngle/odScale), zodat de volgende beweging precies daar verder gaat:
//   pulse   wacht op de worp: zachtjes groter en kleiner, net als in het dobbelvak
//   spin    gooien: vanuit de puls kwadratisch optrekken tot 2,5 rondje per seconde (sneller
//           oogt flikkerig), de kanten flitsen voorbij
//   land    de worp is bekend: teleporteren (diceTeleport) en terugkomen met de uitkomst; de som
//           verschijnt pas dan
// De twee stenen draaien tegen elkaar in. De kanten wisselen via data-face. Even groot als in het
// dobbelvak (42px, --od in styles.css).
const OD_SPIN_DPS = 900, OD_ACCEL_MS = 350;
const OD_ACCEL_DEG = OD_SPIN_DPS * OD_ACCEL_MS / 2000;   // eindigt precies op de draaisnelheid
const OD_EASE_IN = 'cubic-bezier(.333,0,.667,.333)';    // = u²
const OD_TP_MS = 1050, OD_TP_STAGGER = 120;            // teleport; de tweede steen komt iets later terug
const odState = new Map();   // speler-idx -> { mode, t0, a0, k0, dur, finals, v, timers }
const odNow = () => document.timeline.currentTime;
// hoek (graden) van steen 0 van deze speler op tijdstip `now`; steen 1 draait gespiegeld
function odAngle(s, now){
  const t = Math.max(0, now - s.t0);
  if (s.mode === 'spin') return t < OD_ACCEL_MS
    ? s.a0 + OD_ACCEL_DEG * (t / OD_ACCEL_MS) ** 2
    : s.a0 + OD_ACCEL_DEG + OD_SPIN_DPS * (t - OD_ACCEL_MS) / 1000;
  return 0;
}
// grootte op tijdstip `now` (de puls; tijdens het optrekken van groot naar gewoon)
function odScale(s, now){
  const t = Math.max(0, now - s.t0);
  if (s.mode === 'pulse') return dicePulseScale(t);
  if (s.mode === 'spin' && t < OD_ACCEL_MS) return s.k0 + (1 - s.k0) * t / OD_ACCEL_MS;
  return 1;
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
  const second = el.dataset.od.endsWith('-1'), sg = second ? -1 : 1;
  const rot = (a, k = 1) => ({ transform: `rotate(${(sg * a).toFixed(2)}deg) scale(${k.toFixed(4)})` });
  if (s.mode === 'land'){
    diceTeleport(el, sg, sg * s.a0, s.k0, OD_TP_MS + (second ? OD_TP_STAGGER : 0), s.t0);
    return;
  }
  const anims = [];
  if (s.mode === 'pulse'){
    anims.push(el.animate(DICE_PULSE_FRAMES, { duration: DICE_PULSE_MS, iterations: Infinity }));
  } else if (s.mode === 'spin'){
    const b = s.a0 + OD_ACCEL_DEG;
    anims.push(el.animate([rot(s.a0, s.k0), rot(b)], { duration: OD_ACCEL_MS, easing: OD_EASE_IN }));
    anims.push(el.animate([rot(b), rot(b + 360)], { duration: 360 / OD_SPIN_DPS * 1000, delay: OD_ACCEL_MS, iterations: Infinity }));
  }
  for (const a of anims) a.startTime = s.t0;
}
function odSetSumHidden(idx, on){
  odEls(idx).forEach(el => {
    const sum = el.closest('.walk-opening-row')?.querySelector('.walk-opening-sum');
    if (sum) sum.classList.toggle('is-hidden', on);
  });
}
// mode: 'pulse' | 'spin' | 'result' (finals = de worp) | 'rest'. Aangeroepen na elke opbouw.
function openingDiceSet(idx, mode, finals){
  let s = odState.get(idx);
  if (!s){ s = { mode: 'rest', t0: 0, a0: 0, k0: 1, v: 0, timers: [] }; odState.set(idx, s); }
  if (crystalReduceMotion()) mode = 'rest';
  const now = odNow();
  let next = mode;
  if (mode === 'result') next = s.mode === 'spin' || s.mode === 'pulse' ? 'land' : s.mode === 'land' ? 'land' : 'rest';
  if (next !== s.mode){
    const a = odAngle(s, now), k = odScale(s, now);
    odClearTimers(s);
    if (next === 'spin'){
      Object.assign(s, { mode: 'spin', t0: now, a0: a, k0: k });
      const tick = () => { odFlip(idx); odLater(s, tick, 80); };
      odLater(s, tick, 80);
    } else if (next === 'land'){
      // teleporteren vanuit de huidige hoek en grootte (ook als de worp nog tijdens het pulseren
      // binnenkwam: Multiplayer kan de schudstand overslaan). Tot de steen weg is een willekeurige
      // kant, dan de uitkomst, zodat je de worp niet al ziet vóór hij verdwijnt.
      const dur = OD_TP_MS + OD_TP_STAGGER;
      Object.assign(s, { mode: 'land', t0: now, a0: a % 360, k0: k, dur, finals });
      odFlip(idx);
      odLater(s, () => odEls(idx).forEach(el => { const d = el.firstElementChild; if (d && d.dataset.face) d.dataset.face = s.finals[+el.dataset.od.split('-')[1]]; }), OD_TP_MS * DICE_TP_FACE_AT);
      odLater(s, () => {
        s.mode = 'rest'; s.v++;
        odEls(idx).forEach(el => { el.dataset.odv = s.v; });
        odSetSumHidden(idx, false);
      }, dur);
    } else {
      Object.assign(s, { mode: next, t0: now, a0: 0, k0: 1 });
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
  diceLandAt = 0;
  diceFlow = { done: true };
  diceFlowKey = null;
  diceProgress = null;
  document.querySelectorAll('.sd-fx').forEach(el => el.remove());
  if (walkDiceEl) walkDiceEl.dataset.key = '';
  diceSetHudResult(false);
}
