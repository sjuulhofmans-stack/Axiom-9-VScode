// ---------- controls ----------
// pool van 60 kandidaten (zie constrainedShuffleAsync in 70-generator.js) duurt ~2s i.p.v. de
// vroegere ~0,7s bij pool 20 — loopt daarom in brokken met een voortgangsbalk (zelfde patroon
// als runSimulationBatch in 95-simulate.js), anders bevriest de pagina zichtbaar tijdens het
// genereren. genRunning/btnShuffle.disabled voorkomt dat een dubbele klik twee generaties
// tegelijk start; hideGenProgress() (aangeroepen vanuit clearSimResults() bij ELKE bordwijziging)
// zorgt dat de balk en knoppen direct resetten zodra het bord op een ANDERE manier verandert
// terwijl er nog gegenereerd wordt (bv. een tegel slepen) — de simRunId-check in
// applyGeneratedLayout zorgt dat zo'n verouderde run zijn resultaat dan ook niet meer toepast.
let genRunning = false;

// ---------- laadvakje met voortgangsring (gedeeld: map genereren + simulatie) ----------
// Eén vakje in ruimtestijl (.gen-box in styles.css) met een ring die zich vult met de voortgang en
// eronder hoe lang het nog duurt (telt af). Wordt gebruikt door het "Aan het genereren"-vakje op
// het bord (#genOverlay, hieronder) en het "Aan het simuleren"-vakje (#simLoader, 95-simulate.js);
// alleen het plaatje in het midden verschilt (planeet met maantje / radarscherm met pionnen).
// GEN_FADE_MS moet gelijk blijven aan de transitieduur van .gen-overlay/.sim-loader e.d.
const GEN_FADE_MS = 900;
const GEN_RING_FILL_MS = 350;   // zo lang duurt het volmaken van de ring als het klaar is
const GEN_RING_CAP = 0.96;      // verder dan dit gaat de ring niet zolang er nog gerekend wordt
function genSleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function genNextFrames(n){
  return new Promise(r => { const tick = () => (--n <= 0 ? r() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
}

// Vroeger sprong de ring per rekenbrok naar het nieuwe percentage (met een korte CSS-overgang op
// stroke-dashoffset). Dat hakkelde: de brokken komen onregelmatig, en die overgang draait op
// dezelfde draad als het rekenwerk, dus elk brok van 30 ms liet hem haperen.
// Nu: de ring is twee halve bogen + een kopje die alleen DRAAIEN (index.html/styles.css), en die
// draaiing loopt via element.animate() — dat speelt de browser los van JavaScript af. Bij elke
// nieuwe schatting start er een nieuw, rechtlijnig stuk animatie vanaf waar de ring NU staat
// richting GEN_RING_CAP op de geschatte eindtijd; zo verandert alleen de snelheid, nooit de plek
// (geen sprongen, nooit achteruit). Pas als het echt klaar is gaat hij in 0,35 s naar 100%.
//
// createProgressLoader(root): root bevat .gen-orbit (met .gen-half-r > i, .gen-half-l > i,
// .gen-lead) en .gen-eta. Geeft { start, progress(gedaan, totaal, verstrekenMs), complete, stop }.
function createProgressLoader(root){
  const orbitEl = root.querySelector('.gen-orbit');
  const arcREl = root.querySelector('.gen-half-r > i');
  const arcLEl = root.querySelector('.gen-half-l > i');
  const leadEl = root.querySelector('.gen-lead');
  const etaEl = root.querySelector('.gen-eta');
  let seg = { p0: 0, p1: 0, dur: 1 };   // huidig animatiestuk (voortgang 0..1)
  let anims = [];
  let lastStart = 0;
  let pct = 0;                          // echte voortgang in % (voor de "bijna klaar…"-tekst)
  let etaEnd = null, etaTimer = null;

  // waar de ring op dit moment echt staat: uit de lopende animatie zelf (currentTime), niet uit
  // een eigen klok — zo begint een nieuw stuk exact waar het vorige was, zonder sprongetje
  function now(){
    const a = anims[2];
    if (!a || seg.p1 === seg.p0) return seg.p1;
    const f = Math.min(1, Math.max(0, (a.currentTime || 0) / seg.dur));
    return seg.p0 + (seg.p1 - seg.p0) * f;
  }
  function keyframes(p0, p1, angleOf){
    const rot = p => ({ transform: `rotate(${angleOf(p).toFixed(2)}deg)` });
    // knik precies op de helft (daar neemt de linkerboog het over van de rechter)
    if (p0 < 0.5 && p1 > 0.5){
      const f = (0.5 - p0) / (p1 - p0);
      return [{ ...rot(p0), offset: 0 }, { ...rot(0.5), offset: f }, { ...rot(p1), offset: 1 }];
    }
    return [rot(p0), rot(p1)];
  }
  function setTarget(p1, dur, easing = 'linear'){
    const p0 = now();
    p1 = Math.max(p0, Math.min(1, p1));
    dur = Math.max(16, dur);
    // now() rekent rechtlijnig; met een andere easing (alleen het volmaken op het eind) doen we
    // alsof hij al op zijn eindstand staat — daarna komt er toch geen nieuw stuk meer
    seg = easing === 'linear' ? { p0, p1, dur } : { p0: p1, p1, dur: 1 };
    lastStart = performance.now();
    if (orbitEl) orbitEl.classList.toggle('on', p1 > 0);
    const opts = { duration: dur, easing, fill: 'forwards' };
    const old = anims;
    anims = [];
    if (arcREl && arcREl.animate){
      anims.push(
        arcREl.animate(keyframes(p0, p1, p => 360 * Math.min(p, 0.5)), opts),
        arcLEl.animate(keyframes(p0, p1, p => 360 * Math.max(p - 0.5, 0)), opts),
        leadEl.animate([{ transform: `rotate(${(360 * p0).toFixed(2)}deg)` },
                        { transform: `rotate(${(360 * p1).toFixed(2)}deg)` }], opts),
      );
    }
    for (const a of old) a.cancel();   // pas NA het starten van de nieuwe: geen knipperframe
  }
  function reset(){
    for (const a of anims) a.cancel();
    anims = [];
    seg = { p0: 0, p1: 0, dur: 1 };
    if (orbitEl) orbitEl.classList.remove('on');
  }

  function start(){
    reset();
    pct = 0;
    // nog geen schatting: rustig op gang komen (eerste brok is er binnen ~30 ms)
    setTarget(0.08, 1500);
    etaEnd = null;
    if (etaEl) etaEl.textContent = 'even geduld…';
    clearInterval(etaTimer);
    // aftellen per seconde op basis van de laatste schatting (progress)
    // het getal mag alleen dalen (de schatting schommelt per brok), en is de ring vol dan wordt
    // er nog afgerond: "bijna klaar…" i.p.v. een "nog 1 seconde" die blijft hangen
    let shown = Infinity;
    etaTimer = setInterval(() => {
      if (!etaEl || etaEnd === null) return;
      if (pct >= 100){ etaEl.textContent = 'bijna klaar…'; return; }
      const left = Math.max(0, Math.ceil((etaEnd - performance.now()) / 1000));
      shown = Math.min(shown, left);
      etaEl.textContent = shown > 0 ? `nog ${shown} ${shown === 1 ? 'seconde' : 'seconden'}` : 'bijna klaar…';
    }, 200);
  }
  function progress(done, total, elapsedMs){
    pct = total ? Math.min(100, (done / total) * 100) : 0;
    if (done <= 0 || !total) return;
    const t = performance.now();
    const left = (elapsedMs / done) * (total - done);
    etaEnd = t + left;
    if (done >= total) return;   // klaar: complete() maakt de ring vol
    // vanaf waar de ring nu staat in één rechte lijn naar GEN_RING_CAP op de geschatte eindtijd.
    // Hooguit 4x per seconde bijsturen: de schatting schommelt per brok, en dan zou de snelheid
    // onrustig gaan wiebelen. De eerste schatting wel meteen gebruiken (dan staat er nog het
    // langzame op-gang-komen-stuk uit start()).
    const firstEstimate = seg.p1 < GEN_RING_CAP;
    if (!firstEstimate && t - lastStart < 250) return;
    // is het vorige stuk nog niet eens gestart (de browser heeft sindsdien geen beeldje gemaakt),
    // dan dat stuk laten staan — steeds vervangen hield de ring anders eindeloos op zijn beginstand
    if (!firstEstimate && anims[2] && anims[2].pending) return;
    if (now() < GEN_RING_CAP) setTarget(GEN_RING_CAP, Math.max(200, left));
  }
  // ring rustig volmaken (afremmend)
  function complete(){
    pct = 100;
    setTarget(1, GEN_RING_FILL_MS, 'cubic-bezier(.3,.7,.4,1)');
  }
  function stop(){
    clearInterval(etaTimer); etaTimer = null;
  }
  return { start, progress, complete, stop };
}

// ---------- "Aan het genereren"-vakje (index.html, #genOverlay) ----------
// Tijdens het genereren (én bij het openen, vóórdat er een kaart is) faadt de kaart rustig uit en
// verschijnt in het midden het laadvakje met een planeet en een draaiend maantje. Klaar → het
// vakje faadt uit en de nieuwe kaart faadt in. De losse voortgangsbalk rechts is weg (gebruikerswens).
const genOverlayEl = document.getElementById('genOverlay');
const mapBoardPanelEl = document.querySelector('.map-board-panel');
const genLoader = createProgressLoader(genOverlayEl);
function showGenOverlay(){
  if (mapBoardPanelEl) mapBoardPanelEl.classList.add('is-generating');
  genLoader.start();
}
function hideGenOverlay(){
  if (mapBoardPanelEl) mapBoardPanelEl.classList.remove('is-generating');
  genLoader.stop();
}
function hideGenProgress(){
  hideGenOverlay();
  genRunning = false;
  const btnShuffleEl = document.getElementById('btnShuffle');
  if (btnShuffleEl) btnShuffleEl.disabled = false;
}

async function applyGeneratedLayout(seed){
  if (genRunning) return; // een dubbele klik mag geen tweede generatie tegelijk starten
  // de huidige kaart onthouden voor "Vorige indeling" (alleen als er al een gegenereerde is)
  const before = hasGeneratedLayout ? snapshotLayout() : null;
  clearSimResults();
  const runId = simRunId; // clearSimResults() heeft 'm net verhoogd; deze aanroep "claimt" dat nummer
  genRunning = true;
  showGenOverlay();
  const btnShuffleEl = document.getElementById('btnShuffle');
  if (btnShuffleEl) btnShuffleEl.disabled = true;

  const t0 = performance.now();
  const generated = await constrainedShuffleAsync(seed, (found, target) => {
    if (runId !== simRunId) return; // bord intussen op een andere manier gewijzigd
    genLoader.progress(found, target, performance.now() - t0);
  });
  if (runId !== simRunId){ return; } // verouderd: bord is inmiddels iets anders geworden
  // ring rustig volmaken, en de oude kaart moet helemaal uitgefaded zijn vóórdat de nieuwe erin
  // komt — wachten op wat het langst duurt
  genLoader.complete();
  const waited = performance.now() - t0;
  await genSleep(Math.max(GEN_RING_FILL_MS + 120, GEN_FADE_MS - waited));
  if (runId !== simRunId){ return; }

  layout = generated;
  selectedSlot = null; highlightTile = null;
  statSeed.textContent = seed;
  hasGeneratedLayout = true;
  if (before){ previousLayout = before; if (btnPrevLayout) btnPrevLayout.disabled = false; }
  // Geen tekst meer onder de knoppen (gebruikerswens); alleen als het NIET gelukt is volgt er
  // een korte waarschuwing. De seed staat in het seed-veld en rechtsboven in de kop.
  const conn = computeConnectivity();
  swapHint.innerHTML = conn.groups.length === 1 && conn.brokenCount === 0
    ? ''
    : `<span style="color:var(--danger)">Beste poging: ${conn.brokenCount} doodlopende naad/naden — probeer een nieuwe map.</span>`;
  renderBoard();
  // eerst het (nog onzichtbare) nieuwe bord laten opbouwen en tekenen, pas dán infaden — anders
  // valt dat zware eerste tekenwerk precies in de eerste frames van de overgang en hapert die
  await genNextFrames(2);
  if (runId !== simRunId){ return; }
  hideGenProgress();   // vakje faadt uit, nieuwe kaart faadt in
}

// "Genereer nieuwe map": altijd een willekeurige nieuwe kaart (gebruikerswens — het losse
// dobbelsteentje ernaast is weg). Het seed-veld toont alleen nog welke seed er nu ligt.
function generateRandomMap(){
  if (genRunning) return;
  const seed = randomSeedName();
  seedInput.value = seed;
  applyGeneratedLayout(seed);
}
document.getElementById('btnShuffle').addEventListener('click', generateRandomMap);

// ---------- "Vorige indeling" ----------
// Eén stap terug: de kaart (indeling + draaiingen + seed) van vóór de laatste keer genereren.
// Klik je nog eens, dan wissel je weer terug — zo kun je twee kaarten makkelijk vergelijken.
// (Vervangt "Herstel alles": er is geen vaste beginkaart meer, je begint altijd vers.)
let hasGeneratedLayout = false;
let previousLayout = null;
const btnPrevLayout = document.getElementById('btnPrevLayout');
function snapshotLayout(){
  const rot = {};
  for (let tid = 1; tid <= 20; tid++) rot[tid] = tileRotation[tid] || 0;
  return { layout: layout.slice(), rot, seed: statSeed.textContent };
}
// ook hier rustig: kaart uitfaden, wisselen, nieuwe kaart infaden (zonder genereer-vakje)
let prevSwapping = false;
if (btnPrevLayout) btnPrevLayout.addEventListener('click', async () => {
  if (!previousLayout || genRunning || prevSwapping) return;
  prevSwapping = true;
  if (mapBoardPanelEl) mapBoardPanelEl.classList.add('is-swapping');
  await genSleep(GEN_FADE_MS);
  const current = snapshotLayout();
  clearSimResults();
  layout = previousLayout.layout.slice();
  for (let tid = 1; tid <= 20; tid++) tileRotation[tid] = previousLayout.rot[tid] || 0;
  statSeed.textContent = previousLayout.seed;
  seedInput.value = previousLayout.seed;
  previousLayout = current;
  selectedSlot = null; highlightTile = null;
  swapHint.textContent = '';
  renderBoard();
  if (mapBoardPanelEl) mapBoardPanelEl.classList.remove('is-swapping');
  prevSwapping = false;
});

function tryRotate(delta){
  if (selectedSlot === null) return;
  const tid = layout[selectedSlot];
  const prevRotation = tileRotation[tid] || 0;
  const newRotation = (prevRotation + delta) % 360;
  tileRotation[tid] = newRotation;
  const ok = canTileGoInSlotNow(tid, selectedSlot);
  if (!ok){
    tileRotation[tid] = prevRotation;
    swapHint.innerHTML = `<span style="color:var(--danger)">Kan niet draaien — tegel #${tid} zou dan op deze positie een doorgang het bord af laten wijzen.</span>`;
    return;
  }
  clearSimResults();
  renderBoard();
}
document.getElementById('btnRotL').addEventListener('click', ()=> tryRotate(270));
document.getElementById('btnRotR').addEventListener('click', ()=> tryRotate(90));

function randomSeedName(){
  const adjectives = ['zwart','stil','koud','verweerd','duister','verloren','laatst','ijl'];
  const nouns = ['nova','komeet','ruim','koers','sector','baan','romp','sein'];
  const rand = () => Math.floor(Math.random()*1000);
  return `${adjectives[rand()%adjectives.length]}-${nouns[rand()%nouns.length]}-${rand()%100}`;
}
// Bij elke keer openen (of verversen) van het document meteen een nieuwe, willekeurige kaart
// i.p.v. telkens dezelfde beginkaart (gebruikerswens) — precies wat "Genereer nieuwe map" doet.
// setTimeout: pas nadat het hele script geladen is, want applyGeneratedLayout gebruikt dingen uit
// latere bestanden (95-simulate).
setTimeout(generateRandomMap, 0);

// ---------- tabbladen ----------
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = {
  map: document.getElementById('tabMap'),
  simulate: document.getElementById('tabSimulate'),
  walk: document.getElementById('tabWalk'),
  cards: document.getElementById('tabCards'),
};
// Zolang een multiplayer-potje loopt (window.mpGameActive, gezet door 99-multiplayer.js) mag
// je het tabblad "Zelf spelen" niet verlaten — anders loop je zomaar uit je eigen potje weg
// terwijl je medespelers nog wachten (gebruikersverzoek).
// Tabblad "multi" (Multiplayer) is GEEN eigen paneel: het gebruikt hetzelfde #tabWalk als
// Spelen, maar dan meteen in de modus Multiplayer (setWalkMode, 97-solo.js); Spelen zelf heeft
// alleen nog Automatisch en Zelf spelen. De klasse .is-multi-tab op #tabWalk verbergt daar de
// modusknoppen (styles.css). Tijdens een multiplayer-potje kan alleen dit tabblad open staan.
function switchTab(name){
  if (window.mpGameActive && name !== 'multi') return;
  const panelKey = name === 'multi' ? 'walk' : name;
  for (const btn of tabButtons){
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const key of Object.keys(tabPanels)) tabPanels[key].hidden = key !== panelKey;
  tabPanels.walk.classList.toggle('is-multi-tab', name === 'multi');
  const multiModeOn = typeof walkModeMultiBtn !== 'undefined' && walkModeMultiBtn && walkModeMultiBtn.classList.contains('active');
  if (name === 'multi' && !multiModeOn) setWalkMode('multi');
  else if (name === 'walk' && multiModeOn) setWalkMode('auto');
  // "Nieuw potje" (97-solo.js) leeft in de tabbladenbalk zelf, niet in #tabWalk — die balk
  // verbergt niet vanzelf mee met de rest van dit tabblad, dus hier expliciet herchecken.
  walkSoloResetSyncVisibility();
  // zelfde soort herchecken voor de voettekst (96-walk.js) — die moet weg zodra je zowel op
  // dit tabblad zit als er een potje in beeld staat, en switchTab() is het enige punt dat
  // "welk tabblad" kan wijzigen.
  walkFooterSyncVisibility();
  // het stap-voor-stap-bord staat verborgen zolang zijn tab dicht is en wordt daarom pas
  // getekend zodra je hem opent (en opnieuw, want de indeling kan intussen gewijzigd zijn) —
  // MAAR niet tijdens een lopend potje: renderWalkBoard() bouwt het bord helemaal opnieuw op
  // (wist alle pionnen, het doelvakje, de kamerrand, enz.) zonder de huidige spelstand ook weer
  // terug te tekenen, dus wisselde je tijdens "Zelf spelen" naar een ander tabblad en terug, dan
  // leek het potje gereset — de spelers waren pas weer zichtbaar na de eerstvolgende zet, want
  // ELKE render-functie in de bot-/mensbeurt (paintWalkPawns, markWalkTarget, ...) tekent ze dan
  // opnieuw (gebruikersmelding: "spelers niet meer zichtbaar, gaat pas weer goed als je loopt").
  // walkRunning bewaakt de Automatisch-modus, soloGraph (null buiten een potje) Zelf spelen én
  // multiplayer — samen dus "loopt er ergens een potje", en zo niet, dan mag het bord gewoon vers
  // getekend worden zoals hiervoor.
  if (panelKey === 'walk' && !walkRunning && !soloGraph) renderWalkBoard();
  // de kamernaam op een opdrachtkaart hangt aan de tegel, dus bij elk openen opnieuw opbouwen
  if (name === 'cards') renderCardsTab();
  // mpRenderLobby() wordt vanuit setWalkMode('multi') aangeroepen (hierboven, bij het openen
  // van het tabblad Multiplayer), niet apart hiervandaan.
}
tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ---------- bord vergroten op een telefoon ----------
// Alleen zichtbaar onder 640px (zie .board-tools in styles.css). "Vergroten" zet de cellen op
// een leesbare 20px; het bord past dan niet meer en schuift binnen .board-outer.
document.querySelectorAll('.board-zoom').forEach(btn => {
  btn.addEventListener('click', () => {
    const wrap = btn.closest('.board-zoom-wrap');
    const zoomed = wrap.classList.toggle('is-zoomed');
    btn.textContent = zoomed ? 'Passend maken' : 'Vergroten';
    btn.setAttribute('aria-pressed', String(zoomed));
    if (zoomed){
      // op het midden van het bord beginnen in plaats van linksboven
      const outer = wrap.querySelector('.board-outer');
      outer.scrollLeft = (outer.scrollWidth - outer.clientWidth) / 2;
    }
  });
});

// ---------- klik op het logo = pagina vernieuwen (gebruikerswens) ----------
// Loopt er een potje of zit je in een multiplayer-kamer, dan eerst even vragen: vernieuwen
// verbreekt de verbinding en het potje is dan weg.
{
  const logo = document.getElementById('logoReload');
  const reload = () => {
    const busy = (typeof mp !== 'undefined' && mp.active) ||
      (typeof soloPhase !== 'undefined' && soloPhase !== 'idle' && soloPhase !== 'game-over');
    if (busy && !confirm('Pagina vernieuwen? Het lopende potje of de multiplayer-kamer wordt dan afgesloten.')) return;
    location.reload();
  };
  if (logo){
    logo.addEventListener('click', reload);
    logo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); reload(); } });
  }
}
