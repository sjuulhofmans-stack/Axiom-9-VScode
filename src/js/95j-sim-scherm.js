// ---------- UI ----------
const simCountEl = document.getElementById('simCount');
const simStatusEl = document.getElementById('simStatus');
const simResultsEl = document.getElementById('simResults');
const btnSimulate = document.getElementById('btnSimulate');
// ---------- rolteller "Aantal potjes" (gekozen ontwerp B, zie index.html) ----------
// #simCount (verborgen) is de bron; dit tekent 5 rolcijfers die naar hun cijfer schuiven
// (transform, geen herberekening van de opmaak), voorloopnullen gedimd. −100/+100: klik = 100,
// ingedrukt houden telt steeds sneller door (na 12 stappen per 500). −1000/+1000 (data-sim-size)
// werken net zo, maar altijd per 1000. Pijltjestoetsen op de teller
// werken ook. Snelkeuzes zetten het getal in één keer.
const SIM_COUNT_MIN = 100, SIM_COUNT_MAX = 20000, SIM_COUNT_STEP = 100;
const SIM_COUNT_DIGITS = 5;
const SIM_COUNT_PRESETS = [500, 1000, 2000, 5000, 10000];
const simDigitsEl = document.getElementById('simDigits');
const simPresetsEl = document.getElementById('simPresets');
function simCountClamp(n){
  if (!Number.isFinite(n)) n = 2000;
  return Math.max(SIM_COUNT_MIN, Math.min(SIM_COUNT_MAX, Math.round(n / SIM_COUNT_STEP) * SIM_COUNT_STEP));
}
// Elke rol = 3x de cijfers 9..0 van boven naar onder, zodat een hoger cijfer van BOVEN binnenkomt en
// 9 → 0 gewoon doorrolt (als een kilometerteller) i.p.v. de hele rol terug (gebruikerswens 2026-10).
// Per cijfer het getoonde cijfer (simReelPos); in rust staat de rol altijd in de middelste ronde, de
// beweging zelf is een Web Animation vanaf waar de rol op dat moment is.
const SIM_REEL_CELLS = 30, SIM_REEL_MS = 450;
const simReelPos = new Array(SIM_COUNT_DIGITS).fill(null);
const simReelAnims = new Array(SIM_COUNT_DIGITS).fill(null);
let simCounterLast = null;
if (simDigitsEl){
  const cells = Array.from({ length: SIM_REEL_CELLS }, (_, j) => `<i>${9 - (j % 10)}</i>`).join('');
  simDigitsEl.innerHTML = Array.from({ length: SIM_COUNT_DIGITS }, () =>
    `<span class="sim-digit"><span class="sim-reel">${cells}</span></span>`
  ).join('');
}
// rij in de rol → translateY in % van de rol; in rust staat cijfer d op rij 19 - d (middelste ronde)
const simReelY = (row) => -row * 100 / SIM_REEL_CELLS;
const simReelRest = (d) => 19 - d;
function simReelMove(reel, i, digit, dir){
  const old = simReelPos[i];
  simReelPos[i] = digit;
  reel.style.transform = `translateY(${simReelY(simReelRest(digit))}%)`;
  if (old === null || dir === 0 || old === digit) return;
  // waar staat de rol nu (een vorige beweging kan nog lopen)? uitrekenen, niet opmeten
  let fromRow = simReelRest(old);
  const prev = simReelAnims[i];
  if (prev && prev.playState === 'running'){
    const p = prev.effect.getComputedTiming().progress || 0;
    fromRow = prev._from + (prev._to - prev._from) * p;
    prev.cancel();
  }
  // omhoog tellen = de rol zakt (lager rijnummer, nieuw cijfer komt van boven); omlaag = andersom.
  // Doel = eerstvolgende rij met dat cijfer in die richting; daarna beide met hele rondes
  // verschuiven zodat de beweging binnen de 30 rijen blijft.
  const resid = simReelRest(digit) % 10;
  let toRow;
  if (dir > 0){ toRow = fromRow - (((fromRow - resid) % 10) + 10) % 10; if (toRow === fromRow) toRow -= 10; }
  else { toRow = fromRow + (((resid - fromRow) % 10) + 10) % 10; if (toRow === fromRow) toRow += 10; }
  const shift = dir > 0 ? -Math.floor(toRow / 10) * 10 : (2 - Math.floor(toRow / 10)) * 10;
  fromRow += shift; toRow += shift;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = reel.animate([{ transform:`translateY(${simReelY(fromRow)}%)` }, { transform:`translateY(${simReelY(toRow)}%)` }],
    { duration: SIM_REEL_MS, easing: 'cubic-bezier(.2,.9,.25,1)' });
  a._from = fromRow; a._to = toRow;
  simReelAnims[i] = a;
}
function simCounterRender(){
  if (!simCountEl || !simDigitsEl) return;
  const n = simCountClamp(parseInt(simCountEl.value, 10));
  const s = String(n).padStart(SIM_COUNT_DIGITS, '0');
  const lead = SIM_COUNT_DIGITS - String(n).length;
  const dir = simCounterLast === null ? 0 : Math.sign(n - simCounterLast);
  simCounterLast = n;
  [...simDigitsEl.children].forEach((d, i) => {
    d.classList.toggle('is-lead', i < lead);
    simReelMove(d.firstChild, i, Number(s[i]), dir);
  });
  simDigitsEl.setAttribute('aria-valuenow', String(n));
  simDigitsEl.setAttribute('aria-valuetext', `${n.toLocaleString('nl-NL')} potjes`);
  if (simPresetsEl){
    simPresetsEl.innerHTML = SIM_COUNT_PRESETS.map(p =>
      `<button type="button" class="sim-preset${p === n ? ' is-on' : ''}" data-sim-preset="${p}">${p.toLocaleString('nl-NL')}</button>`
    ).join('');
  }
}
function simCountSet(n){
  if (!simCountEl) return;
  simCountEl.value = String(simCountClamp(n));
  simCounterRender();
}
function simCountStep(dir, size = SIM_COUNT_STEP){
  simCountSet(parseInt(simCountEl.value, 10) + dir * size);
}
{
  let holdTimer = null;
  const stopHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  for (const btn of document.querySelectorAll('[data-sim-step]')){
    const dir = Number(btn.dataset.simStep);
    const size = Number(btn.dataset.simSize) || SIM_COUNT_STEP;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      simCountStep(dir, size);
      let delay = 380, n = 0;
      const tick = () => {
        n++;
        simCountStep(dir, size === SIM_COUNT_STEP && n > 12 ? 5 * SIM_COUNT_STEP : size);
        delay = Math.max(45, delay * 0.8);
        holdTimer = setTimeout(tick, delay);
      };
      holdTimer = setTimeout(tick, delay);
    });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, stopHold);
    // toetsenbord (Enter/spatie op de knop): de click zonder pointerdown ervoor
    btn.addEventListener('click', (e) => { if (e.detail === 0) simCountStep(dir, size); });
  }
  if (simDigitsEl) simDigitsEl.addEventListener('keydown', (e) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (dir){ e.preventDefault(); simCountStep(dir); return; }
    // wat je bij een spinbutton verwacht: PageUp/PageDown = grote stap, Home/End = minimum/maximum
    if (e.key === 'PageUp' || e.key === 'PageDown'){ e.preventDefault(); simCountStep(e.key === 'PageUp' ? 1 : -1, 1000); }
    else if (e.key === 'Home'){ e.preventDefault(); simCountSet(SIM_COUNT_MIN); }
    else if (e.key === 'End'){ e.preventDefault(); simCountSet(SIM_COUNT_MAX); }
  });
  if (simPresetsEl) simPresetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sim-preset]');
    if (b) simCountSet(Number(b.dataset.simPreset));
  });
  simCounterRender();
}
// ---------- "Tijdring" in het simulatievak (gekozen: Zwaartekracht → variant 2 "Tijdring", 2026-10) ----------
// Een zwart gat met een gloeiende schijf; deeltjes spiraleren erin. Zestig streepjes rond het gat
// gloeien met de klok mee op naarmate de simulatie vordert (alles aan = klaar). Geen getal in de
// kern (gebruikerswens 2026-10: eerst wel seconden, weer weggehaald). Alles beweegt via Web Animations/transitions op transform/
// opacity, zodat de browser het afspeelt terwijl runSimulationBatch in brokken van 30 ms rekent.
// Opmeten gebeurt één keer, bij de start.
const SIM_STREAM_DONE_MS = 700;   // na het laatste brok: de volle ring nog even in beeld
const SIM_RING_TICKS = 60;
const simStream = (() => {
  const root = document.getElementById('simRing');
  if (!root) return null;
  const AM = '#ffb545', HOT = '#fff1dc';
  let ticks = [], diskEl = null, spawnTimer = null;
  let cx = 0, cy = 0, r = 0, R0 = 0, run = 0, litTicks = -1;
  const mk = (parent, css, html) => { const e = document.createElement('div'); e.style.cssText = css; if (html != null) e.textContent = html; parent.appendChild(e); return e; };
  // deeltje dat in een spiraal naar binnen valt (draaiende arm + deeltje dat naar het midden schuift)
  function particle(){
    const arm = mk(root, `position:absolute;left:${cx}px;top:${cy}px;width:0;height:0`);
    const d = mk(arm, `position:absolute;left:-2px;top:-2px;width:4px;height:4px;border-radius:50%;background:${Math.random() < .5 ? HOT : AM}`);
    const a = Math.random() * 360, dur = 1400 + Math.random() * 600, ease = 'cubic-bezier(.4,0,1,1)';
    arm.animate([{ transform:`rotate(${a}deg)` }, { transform:`rotate(${a + 300}deg)` }], { duration:dur, easing:ease });
    d.animate([
      { transform:`translateX(${R0 * .95}px)`, opacity:0 },
      { transform:`translateX(${R0 * .5}px)`, opacity:1, offset:.4 },
      { transform:`translateX(${r * .9}px) scale(.4)`, opacity:0 },
    ], { duration:dur, easing:ease }).onfinish = () => arm.remove();
  }
  // de eerste `frac` van de streepjes (vanaf boven, met de klok mee) gloeit
  function setTicks(frac){
    if (!ticks.length) return;
    const lit = Math.min(SIM_RING_TICKS, Math.floor(frac * SIM_RING_TICKS));
    if (lit === litTicks) return;
    for (let k = 0; k < SIM_RING_TICKS; k++) ticks[k].style.opacity = k < lit ? 1 : .12;
    litTicks = lit;
  }

  function start(){
    stop();
    run++;
    root.innerHTML = '';
    const W = root.clientWidth, H = root.clientHeight;
    // vak niet zichtbaar bij de start (bv. ander tabblad): dan niets tekenen
    if (!W || !H){ ticks = []; return; }
    cx = W / 2; cy = H / 2; R0 = Math.min(W, H) * .45; r = R0 * .3;
    litTicks = -1;
    // gloeiende schijf: buitenste laag schaalt, binnenste draait
    const S = r * 5.2;
    diskEl = mk(root, `position:absolute;left:${cx - S / 2}px;top:${cy - S / 2}px;width:${S}px;height:${S}px;transform:scale(.85);transition:transform .6s ease`);
    const spin = mk(diskEl, `position:absolute;inset:0;border-radius:50%;
      background:conic-gradient(from 0deg, ${AM}00, ${AM}cc, ${HOT}, ${AM}00 40%, ${AM}88 70%, ${AM}00);
      -webkit-mask:radial-gradient(circle, transparent 38%, #000 40%, #000 52%, transparent 70%);
      mask:radial-gradient(circle, transparent 38%, #000 40%, #000 52%, transparent 70%)`);
    spin.animate([{ transform:'rotate(0)' }, { transform:'rotate(360deg)' }], { duration:2600, iterations:Infinity });
    ticks = [];
    for (let k = 0; k < SIM_RING_TICKS; k++){
      ticks.push(mk(root, `position:absolute;left:${cx - 1.5}px;top:${cy - R0}px;width:3px;height:${R0 * .12}px;border-radius:2px;background:${AM};
        transform-origin:1.5px ${R0}px;transform:rotate(${k * 360 / SIM_RING_TICKS}deg);transition:opacity .3s`));
    }
    mk(root, `position:absolute;left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:#000;
      box-shadow:0 0 0 2px #ffcf9a55, 0 0 18px #ffcf9a44`);
    setTicks(0);
    spawnTimer = setInterval(particle, 70);
  }
  // frac = gedaan/totaal
  function progress(frac){ setTicks(frac); }
  function complete(){
    setTicks(1);
    if (diskEl) diskEl.style.transform = 'scale(1)';
  }
  // pas na het uitfaden de deeltjes weghalen (anders verdwijnen ze zichtbaar)
  function stop(){
    clearInterval(spawnTimer); spawnTimer = null;
    const me = run;
    setTimeout(() => { if (me === run) root.innerHTML = ''; }, GEN_FADE_MS);
  }
  return { start, progress, complete, stop };
})();

// "Aan het simuleren"-vakje: de tijdring hierboven, de potjesteller en
// Stoppen; vervangt de oude voortgangsbalk, de ring met radar en de datastroom (gebruikerswens).
// createProgressLoader (80-controls.js) blijft aan voor start/stop; er is geen .gen-eta meer.
const simStageEl = document.getElementById('simStage');
const simLoaderEl = document.getElementById('simLoader');
const simLoaderCountEl = document.getElementById('simLoaderCount');
const simLoader = simLoaderEl ? createProgressLoader(simLoaderEl) : null;
function showSimLoader(){
  if (!simLoader) return;
  clearTimeout(simHoldTimer);
  simStageEl.classList.remove('is-holding');
  simStageEl.classList.add('is-running');
  simLoader.start();
  if (simStream) simStream.start();   // na is-running: dan heeft het vak zijn maat
}
let simHoldTimer = null;
function hideSimLoader(){
  if (!simLoader || !simStageEl.classList.contains('is-running')) return;
  // de ruimte nog even vasthouden tot het vakje helemaal uitgefaded is (anders klapt het vak
  // dicht terwijl het vakje nog half zichtbaar over de rand hangt, bv. na "Stoppen")
  simStageEl.classList.add('is-holding');
  simStageEl.classList.remove('is-running');
  simLoader.stop();
  if (simStream) simStream.stop();
  clearTimeout(simHoldTimer);
  simHoldTimer = setTimeout(() => simStageEl.classList.remove('is-holding'), GEN_FADE_MS);
}
let simRunning = false;   // voorkomt twee overlappende potjes-reeksen bij dubbelklikken
let simRunId = 0;         // verhoogd bij elke nieuwe run/bordwijziging; een verouderde
                           // in-brokken-lopende run herkent hieraan dat hij moet stoppen
let simDone = 0, simTotal = 0;   // voortgang van de lopende run, voor de melding na "Stoppen"

// knop "Stoppen" onder de voortgangsbalk (gebruikerswens): zelfde mechanisme als een
// bordwijziging — simRunId verhogen, dan stopt de lopende run bij zijn volgende brok vanzelf
function stopSimulation(){
  if (!simRunning) return;
  simRunId++;
  simRunning = false;
  hideSimLoader();
  if (btnSimulate) btnSimulate.disabled = false;
  simResultsEl.innerHTML = '';
  simStatusEl.innerHTML = `<span class="sub sim-stopped">Simulatie gestopt na ${simDone.toLocaleString('nl-NL')} van ${simTotal.toLocaleString('nl-NL')} potjes.</span>`;
}
{
  const btnSimStop = document.getElementById('btnSimStop');
  if (btnSimStop) btnSimStop.addEventListener('click', stopSimulation);
}

// wordt aangeroepen door alles wat de indeling wijzigt (genereren, herstellen,
// slepen, draaien, tegel-editor) — de cijfers horen bij een specifieke indeling en
// worden ongeldig zodra die verandert. Tabwisselingen raken dit niet aan (die
// laten de tab-inhoud gewoon in de DOM staan).
function clearSimResults(){
  // een lopende stap-voor-stap-pion hoort niet op een bord dat onder hem vandaan verandert
  stopWalkSimulation();
  stopSoloGame();
  // het potje is gestopt, dus ook het speelscherm dicht en terug naar de lobby (zonder fade: je
  // staat op een ander tabblad). Anders zat je terug op Spelen vast in een leeg speelscherm met
  // grijze Pauze/Stoppen en geen weg terug. Multiplayer niet: daar zitten de andere tabbladen op slot.
  if (!window.mpGameActive && typeof walkPlayAreaEl !== 'undefined' && walkPlayAreaEl && !walkPlayAreaEl.hidden){
    walkPlayAreaEl.hidden = true;
    walkPlayAreaEl.classList.remove('walk-fade-hidden');
    if (walkLobbyEl){ walkLobbyEl.hidden = false; walkLobbyEl.classList.remove('walk-fade-hidden'); }
    walkFooterSyncVisibility();
    walkPauseStopSyncVisibility();
  }
  // de batch-simulatie rekent nu in brokken (zie runSimulationBatch), dus loopt niet meer
  // per se blokkerend af vóórdat de gebruiker iets anders kan aanklikken — een lopende reeks
  // potjes voor de OUDE indeling mag straks niet alsnog deze melding overschrijven
  simRunId++;
  hideSimLoader();
  simRunning = false;
  if (btnSimulate) btnSimulate.disabled = false;
  // zelfde verhaal voor een lopende bord-generatie (zie applyGeneratedLayout in 80-controls.js):
  // die rekent ook in brokken, dus een tegel slepen/draaien terwijl er nog gegenereerd wordt
  // moet de balk/knoppen direct resetten — de simRunId-check daar zorgt dat het resultaat van
  // die verouderde run straks ook niet meer wordt toegepast.
  if (typeof hideGenProgress === 'function') hideGenProgress();
  if (!simResultsEl) return;
  simResultsEl.innerHTML = '';
  // Alleen als er al eens een simulatie is gedraaid zijn er "oude" cijfers om voor te waarschuwen
  // — niet bij het openen of het eerste genereren (gebruikersmelding: stond er meteen al).
  // Gecentreerd onder de knop, net als de rest van dat vak.
  simStatusEl.innerHTML = simHasRun
    ? `<span class="sub sim-stopped">Indeling gewijzigd — draai de simulatie opnieuw voor cijfers die bij dit bord horen.</span>`
    : '';
}
// var (geen let): clearSimResults kan al lopen voordat deze regel geladen is
var simHasRun = false;   // wordt true zodra er een uitslag is getoond (renderSimResults)

// 95%-foutmarge (in procentpunten) op een winpercentage uit `wins` van `n` potjes.
function simMarginOfError(wins, n){
  if (!n) return 0;
  const p = wins / n;
  return 1.96 * Math.sqrt(p * (1 - p) / n) * 100;
}

function renderHistogram(gameLengths){
  if (!gameLengths.length) return '';
  const min = Math.min(...gameLengths), max = Math.max(...gameLengths);
  const binCount = Math.min(SIM_HISTOGRAM_BINS, Math.max(1, max - min + 1));
  const binWidth = Math.max(1, (max - min + 1) / binCount);
  const counts = new Array(binCount).fill(0);
  for (const v of gameLengths){
    const bin = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
    counts[bin]++;
  }
  const maxCount = Math.max(...counts);
  const bars = counts.map((c, i) => {
    const lo = Math.round(min + i * binWidth), hi = Math.round(min + (i + 1) * binWidth - 1);
    const h = maxCount ? Math.round((c / maxCount) * 100) : 0;
    const label = i === 0 || i === binCount - 1 || i === Math.floor(binCount / 2) ? `<span class="sim-hist-tick">${lo}</span>` : '';
    return `<div class="sim-hist-bar-wrap" title="${lo}–${hi} beurten: ${c} potjes"><div class="sim-hist-bar" style="height:${h}%"></div>${label}</div>`;
  }).join('');
  return `<div class="sim-hist">${bars}</div>`;
}

// sequentiële amber-verloopkleur (één kleur, licht->donker/fel naar bezoekfrequentie) —
// vlakken zonder bezoek blijven dicht bij het paneel, vlakken buiten het bord blijven
// het bestaande "onbenutte sjabloonplek"-donker.
function heatColor(t){
  const c0 = [26, 33, 42], c1 = [255, 181, 69];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// afstand tot de dichtstbijzijnde opdracht per cel, op de HUIDIGE (mogelijk gedraaide) indeling
// — multi-bron BFS vanaf alle opdrachtvakjes tegelijk, zelfde idee als questCoverageScore in
// 70-generator.js maar dan op de getoonde graph i.p.v. de ongedraaide generator-kandidaat.
function computeQuestDistances(graph){
  const dist = new Int32Array(graph.N).fill(-1);
  const queue = [];
  for (const k of Object.values(graph.questCells)){ dist[k] = 0; queue.push(k); }
  let qi = 0;
  while (qi < queue.length){
    const ck = queue[qi++];
    const d = dist[ck];
    const neigh = graph.adjKey[ck];
    for (let j = 0; j < neigh.length; j++){
      const nk = neigh[j];
      if (dist[nk] !== -1) continue;
      dist[nk] = d + 1;
      queue.push(nk);
    }
  }
  return dist;
}

