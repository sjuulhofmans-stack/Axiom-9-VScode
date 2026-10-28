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

// ---------- aftellende tijd in de laadvakjes (gedeeld: map genereren + simulatie) ----------
// Het "Aan het genereren"-vakje (#genOverlay, sterrenbeeld hieronder) en het "Aan het
// simuleren"-vakje (#simLoader, datastroom in 95-simulate.js) tonen allebei hoe lang het nog
// duurt. Vroeger zat hier ook een voortgangsring bij; die is met beide nieuwe animaties vervallen.
// GEN_FADE_MS moet gelijk blijven aan de transitieduur van .gen-overlay/.sim-loader e.d.
const GEN_FADE_MS = 900;
function genSleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function genNextFrames(n){
  return new Promise(r => { const tick = () => (--n <= 0 ? r() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
}

// createProgressLoader(root): root bevat .gen-eta. Geeft { start, progress(gedaan, totaal,
// verstrekenMs), complete, stop }.
function createProgressLoader(root){
  const etaEl = root.querySelector('.gen-eta');
  let pct = 0;                          // echte voortgang in % (voor de "bijna klaar…"-tekst)
  let etaEnd = null, etaTimer = null;

  function start(){
    pct = 0;
    etaEnd = null;
    if (etaEl) etaEl.textContent = 'even geduld…';
    clearInterval(etaTimer);
    // aftellen per seconde op basis van de laatste schatting (progress)
    // het getal mag alleen dalen (de schatting schommelt per brok), en is het klaar dan wordt
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
    etaEnd = performance.now() + (elapsedMs / done) * (total - done);
  }
  function complete(){ pct = 100; }
  function stop(){
    clearInterval(etaTimer); etaTimer = null;
  }
  return { start, progress, complete, stop };
}

// ---------- "Sterrenbeeld" in het genereer-vakje (gekozen variant 8 uit 8, 2026-10) ----------
// Elke tegelplek is een ster (op het midden van die plek op het bord). Vanuit een ster in het midden
// trekken verbindingen (de naden) zich over het bord; hoeveel er al liggen = de voortgang. Af en toe
// schiet er een rode lijn uit die weer terugtrekt: de solver die terugspoort. Klaar → alles verbonden,
// een golf door het netwerk vanaf waar Hibernatie op de NIEUWE kaart ligt, sterren kleuren naar kamer
// (blauw) / gang (paars) en de echte kaart faadt erover in. Het netwerk is van begin tot eind even
// groot als het bord (geen zoom, geen tekst eronder; gebruikerswens 2026-10).
// Alleen transform/opacity (zie het blok in styles.css). Zonder #genNet doet alles niets.
const GEN_NET_DONE_MS = 650;   // na het laatste brok: lijnen vol + begin van de golf
const GEN_NET_ZOOM_MS = 700;   // na de golf nog even het volle netwerk laten staan
const genNet = (() => {
  const root = document.getElementById('genNet');
  const vis = root && root.querySelector('.gen-net-vis');
  if (!vis) return null;
  const pos = i => ({ c: i % 5, r: Math.floor(i / 5) });
  const edges = [];   // [a, b]: a links van/boven b
  for (let i = 0; i < 20; i++){ const { c, r } = pos(i); if (c < 4) edges.push([i, i + 1]); if (r < 3) edges.push([i, i + 5]); }
  let html = '';
  for (let i = 0; i < 20; i++){ const { c, r } = pos(i); html += `<span class="gen-net-tile" style="left:${c * 20}%;top:${r * 25}%"></span>`; }
  const edgeHtml = (cls, [a, b]) => {
    const { c, r } = pos(a);
    return `<span class="gen-edge ${b === a + 1 ? 'is-h' : 'is-v'} ${cls}" style="left:${c * 20 + 10}%;top:${r * 25 + 12.5}%">`
      + (cls ? '<i></i>' : '<i class="ok"></i><i class="bad"></i><i class="hot"></i>') + '</span>';
  };
  for (const e of edges) html += edgeHtml('is-ghost', e);
  for (const e of edges) html += edgeHtml('', e);
  for (let i = 0; i < 20; i++){
    const { c, r } = pos(i);
    html += `<span class="gen-node" style="left:${c * 20 + 10}%;top:${r * 25 + 12.5}%"><i class="n-on"></i><i class="n-gang"></i><i class="n-ping"></i></span>`;
  }
  vis.innerHTML = html;
  const edgeEls = [...vis.querySelectorAll('.gen-edge:not(.is-ghost)')];
  const nodeEls = [...vis.querySelectorAll('.gen-node')];
  let conn = new Set(), act = new Set(), timers = [], lastBad = 0;

  const frontier = () => edges.map((e, i) => i)
    .filter(i => !act.has(i) && (conn.has(edges[i][0]) || conn.has(edges[i][1])));
  // lijn laten groeien vanaf de ster die al verbonden is
  function aim(ei){ const [a] = edges[ei]; edgeEls[ei].classList.toggle('is-rev', !conn.has(a)); }
  function activate(ei){
    const [a, b] = edges[ei], to = conn.has(a) ? b : a;
    aim(ei); act.add(ei);
    edgeEls[ei].classList.remove('is-bad'); edgeEls[ei].classList.add('is-on');
    if (!conn.has(to)){ conn.add(to); nodeEls[to].classList.add('is-on'); }
  }
  function later(fn, ms){ timers.push(setTimeout(fn, ms)); }

  function start(){
    stop();
    root.classList.add('is-reset');
    root.classList.remove('is-done', 'is-reveal');
    edgeEls.forEach(el => el.classList.remove('is-on', 'is-bad', 'is-rev'));
    nodeEls.forEach(el => { el.classList.remove('is-on', 'is-gang'); el.style.removeProperty('--d'); });
    const first = [6, 7, 8, 11, 12, 13][Math.floor(Math.random() * 6)];   // ergens binnenin
    conn = new Set([first]); act = new Set(); lastBad = 0;
    // pas na een getekend beeldje weer met overgangen (geen gedwongen herberekening nodig)
    genNextFrames(2).then(() => { root.classList.remove('is-reset'); nodeEls[first].classList.add('is-on'); });
  }
  function progress(frac){
    const want = Math.min(edges.length - 1, Math.floor(frac * edges.length));
    while (act.size < want){ const f = frontier(); if (!f.length) break; activate(f[Math.floor(Math.random() * f.length)]); }
    // terugsporen: hooguit één rode lijn per 350 ms (de brokken komen veel vaker)
    const t = performance.now();
    if (frac < 0.85 && t - lastBad > 350 && Math.random() < 0.35){
      const f = frontier();
      if (f.length){
        lastBad = t;
        const ei = f[Math.floor(Math.random() * f.length)], el = edgeEls[ei];
        aim(ei); el.classList.add('is-bad', 'is-on');
        later(() => { if (!act.has(ei)) el.classList.remove('is-on'); }, 380);
        later(() => { if (!act.has(ei)) el.classList.remove('is-bad'); }, 760);
      }
    }
  }
  // newLayout: tile-id per plek; geeft de golf zijn beginpunt (Hibernatie) en de kleuren
  function complete(newLayout){
    let f;
    while ((f = frontier()).length) activate(f[0]);
    const from = Math.max(0, newLayout.indexOf(8));
    const dist = { [from]: 0 }, q = [from];
    while (q.length){
      const n = q.shift();
      for (const [a, b] of edges){ const o = a === n ? b : b === n ? a : -1; if (o >= 0 && dist[o] === undefined){ dist[o] = dist[n] + 1; q.push(o); } }
    }
    nodeEls.forEach((el, i) => {
      el.style.setProperty('--d', (dist[i] * 0.09 + 0.2).toFixed(2) + 's');
      if (!ROOM_NAMES[newLayout[i]]) el.classList.add('is-gang');
    });
    root.classList.add('is-done');
  }
  function reveal(){ root.classList.add('is-reveal'); }
  function stop(){ timers.forEach(clearTimeout); timers = []; }
  return { start, progress, complete, reveal, stop };
})();

// netwerk precies over het bord leggen (alleen bij het begin van het genereren en bij een andere
// schermgrootte — nooit tijdens een potje). Is het bord niet te meten, dan blijft het gecentreerd.
function genNetPlace(){
  const netEl = document.getElementById('genNet');
  const boardEl = document.getElementById('board');
  if (!netEl || !boardEl || !genOverlayEl) return;
  const b = boardEl.getBoundingClientRect(), o = genOverlayEl.getBoundingClientRect();
  if (!b.width || !o.width){ netEl.classList.remove('is-placed'); netEl.removeAttribute('style'); return; }
  netEl.classList.add('is-placed');
  netEl.style.left = (b.left - o.left) + 'px';
  netEl.style.top = (b.top - o.top) + 'px';
  netEl.style.width = b.width + 'px';
  netEl.style.height = b.height + 'px';
}

// ---------- "Aan het genereren"-vakje (index.html, #genOverlay) ----------
// Tijdens het genereren (én bij het openen, vóórdat er een kaart is) faadt de kaart rustig uit en
// verschijnt het sterrenbeeld (genNet, hierboven) op bordgrootte. Klaar → het netwerk faadt uit en
// de nieuwe kaart faadt in. De losse voortgangsbalk rechts is weg.
const genOverlayEl = document.getElementById('genOverlay');
const mapBoardPanelEl = document.querySelector('.map-board-panel');
const genLoader = createProgressLoader(genOverlayEl);
// Tijdens het genereren zijn Simulatie, Spelen en Multiplayer uitgefaded en niet te kiezen (ook niet
// met het toetsenbord: disabled); ze rekenen allemaal op de kaart die er nog niet is (gebruikerswens
// 2026-10). Ze staan in index.html al op slot, want bij het openen wordt er meteen gegenereerd.
const GEN_LOCKED_TABS = ['tabBtnSimulate', 'tabBtnWalk', 'tabBtnMulti'];
function genLockTabs(on){
  for (const id of GEN_LOCKED_TABS){
    const b = document.getElementById(id);
    if (b) b.disabled = on;
  }
}
function showGenOverlay(){
  genLockTabs(true);
  genNetPlace();
  if (genNet) genNet.start();
  if (mapBoardPanelEl) mapBoardPanelEl.classList.add('is-generating');
  genLoader.start();
}
function hideGenOverlay(){
  genLockTabs(false);
  if (mapBoardPanelEl) mapBoardPanelEl.classList.remove('is-generating');
  genLoader.stop();
  if (genNet) genNet.stop();
}
window.addEventListener('resize', () => { if (genRunning) genNetPlace(); });
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
    if (genNet && target) genNet.progress(found / target);
  });
  if (runId !== simRunId){ return; } // verouderd: bord is inmiddels iets anders geworden
  // netwerk afmaken (golf), en de oude kaart moet helemaal uitgefaded zijn vóórdat de nieuwe erin
  // komt — wachten op wat het langst duurt; daarna staat het volle netwerk nog even
  genLoader.complete();
  if (genNet) genNet.complete(generated);
  const waited = performance.now() - t0;
  await genSleep(Math.max(GEN_NET_DONE_MS, GEN_FADE_MS - waited));
  if (runId !== simRunId){ return; }
  if (genNet){
    genNet.reveal();
    await genSleep(GEN_NET_ZOOM_MS);
    if (runId !== simRunId){ return; }
  }

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
  rules: document.getElementById('tabRules'),
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
  // simulatie-uitslag die klaarkwam terwijl dit tabblad verborgen was: nu pas in kolommen verdelen
  if (name === 'simulate' && typeof layoutSimSections === 'function') layoutSimSections();
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
  // spelregels: bij het eerste openen opbouwen (98c-rules.js)
  if (name === 'rules') renderRulesTab();
  // mpRenderLobby() wordt vanuit setWalkMode('multi') aangeroepen (hierboven, bij het openen
  // van het tabblad Multiplayer), niet apart hiervandaan.
}
tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// ---------- speelmenu: tabbladen als uitschuifmenu tijdens een potje ----------
// Alleen in de speelweergave (body.is-playing, gezet door walkPauseStopSyncVisibility in
// 96-walk.js): dan staat er links in de smalle kop een knop "☰ Menu" en schuiven de tabbladen
// over het spel heen. Het spel loopt eronder gewoon door. Dicht via ✕, Escape, klik ernaast of
// door een tabblad te kiezen.
function playMenuSetOpen(open){
  document.body.classList.toggle('play-menu-open', !!open);
  const btn = document.getElementById('btnPlayMenu');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  const seed = document.getElementById('playMenuSeed');
  if (open && seed) seed.textContent = statSeed.textContent;
}
{
  const isOpen = () => document.body.classList.contains('play-menu-open');
  document.getElementById('btnPlayMenu').addEventListener('click', () => playMenuSetOpen(!isOpen()));
  document.getElementById('btnPlayMenuClose').addEventListener('click', () => playMenuSetOpen(false));
  document.getElementById('playMenuBackdrop').addEventListener('click', () => playMenuSetOpen(false));
  tabButtons.forEach(btn => btn.addEventListener('click', () => playMenuSetOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) playMenuSetOpen(false); });
}

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

// ---------- console i.p.v. keuzelijsten (artifact "Axiom-9 Lobbyvarianten") ----------
// In de lobby van Spelen en bij Spel hosten is elke keuze een rij knoppen. De <select> (of bij
// Tempo de <input type=range>) blijft verborgen de bron: alle code leest/zet gewoon
// .value/.disabled en luistert naar 'change'/'input'. Op een optie: data-short = kort woord op de
// knop (de volle tekst komt dan als stand naast het label), data-note = eigen uitleg eronder,
// data-cost = prijs met een bliksempje. Een range krijgt zijn woorden uit data-labels ("a|b|c").
// Een MutationObserver houdt de knoppen gelijk als de code opties hernoemt (Energie-inzet: naam +
// prijs uit ENERGY_ACTIONS, 96-walk.js) of de keuze uitzet (Beurten van de bots zonder bots).
// CONSOLE (gekozen variant 3 uit 6, 2026-10, met de glazen knopstijl van de schuifrail; de
// schuifrail zelf viel af): losse knoppen met een lampje, onder elkaar (.is-vert) = een lijst met
// lampjes, een range = meter die volloopt (.is-meter). Rechts naast het label staat de stand
// (.seg-out). Geen glijdend schuifje meer, dus ook geen animatie.
const SEG_BOLT ='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>';
function segmentSelect(sel){
  if (!sel || sel.dataset.seg) return;
  sel.dataset.seg = '1';
  const isRange = sel.type === 'range';
  const evt = isRange ? 'input' : 'change';
  const box = document.createElement('div');
  box.className = 'seg-group' + (isRange ? ' is-meter' : sel.dataset.rail === 'vert' ? ' is-vert' : '');
  box.setAttribute('role', 'radiogroup');
  const cap = document.createElement('div');
  cap.className = 'seg-cap';
  const out = document.createElement('output');
  out.className = 'seg-out';
  const lbl = sel.id && document.querySelector(`label[for="${sel.id}"]`);
  if (lbl){
    if (!lbl.id) lbl.id = sel.id + 'RailLabel';   // niet "…Label": #walkSpeedLabel bestaat al
    box.setAttribute('aria-labelledby', lbl.id);
    lbl.removeAttribute('for');   // een label voor een verborgen lijst doet niets
    lbl.classList.add('has-seg-out');
    lbl.append(out);
  }
  sel.classList.add('seg-source');
  sel.after(box);
  const options = () => isRange
    ? (sel.dataset.labels || '').split('|').map((t, i) => ({ value: String(Number(sel.min) + i), text: t, ds: {} }))
    : [...sel.options].map(o => ({ value: o.value, text: o.textContent.trim(), ds: o.dataset, disabled: o.disabled }));
  let builtKey = '';
  function render(){
    const opts = options();
    const i = Math.max(0, opts.findIndex(o => o.value === sel.value));
    const key = opts.map(o => o.value + '=' + o.text + (o.ds.short || '') + (o.ds.cost || '')).join('|');
    const isNum = opts.every(o => /^\d+$/.test(o.ds.short || o.text));
    if (key !== builtKey){
      builtKey = key;
      box.classList.toggle('is-num', isNum);
      box.replaceChildren(...opts.map(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seg-btn';
        b.setAttribute('role', 'radio');
        b.dataset.value = o.value;
        if (isRange){ b.title = b.ariaLabel = o.text; return b; }   // meter: alleen een balkje
        const led = document.createElement('i');
        led.className = 'seg-led';
        const name = document.createElement('span');
        name.textContent = o.ds.short || o.text;
        b.append(led, name);
        if (o.ds.cost){
          const c = document.createElement('em');
          c.className = 'seg-bolt';
          c.innerHTML = SEG_BOLT + o.ds.cost;
          b.append(c);
        }
        if (o.ds.short) b.title = o.text;
        return b;
      }));
    }
    box.style.setProperty('--n', opts.length);
    box.classList.toggle('is-disabled', sel.disabled);
    [...box.querySelectorAll('.seg-btn')].forEach((b, j) => {
      b.classList.toggle('is-on', j === i);
      b.classList.toggle('is-lit', isRange && j <= i);
      b.setAttribute('aria-checked', String(j === i));
      b.disabled = sel.disabled || !!opts[j].disabled;
    });
    // stand rechts naast het label: het korte woord, of de volle tekst als die meer zegt
    // (Beurten van de bots: "Laten zien — snel"); bij een eigen uitleg eronder het korte woord
    const cur = opts[i];
    out.textContent = sel.disabled || !cur ? '—'
      : isRange || isNum || cur.ds.note || !cur.ds.short ? (cur.ds.short || cur.text) : cur.text;
    // regeltje eronder: alleen een eigen uitleg (data-note) of waarom het uit staat
    const capText = sel.disabled && sel.dataset.offNote ? sel.dataset.offNote
      : cur ? (cur.ds.note || '') : '';
    if (capText){ cap.textContent = capText; if (!cap.isConnected) box.after(cap); }
    else if (cap.isConnected) cap.remove();
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.disabled || b.dataset.value === sel.value) return;
    sel.value = b.dataset.value;
    sel.dispatchEvent(new Event(evt, { bubbles: true }));
    render();
  });
  sel.addEventListener(evt, render);
  sel.segRender = render;   // voor code die .value zet zonder event (Tempo tijdens het lopen)
  if (!isRange) new MutationObserver(render).observe(sel, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true, characterData: true });
  render();
}
['walkPlayers', 'walkEnergyMode', 'walkSpeed', 'walkSoloBotView', 'mpHostTotal', 'mpHostFillBots', 'mpHostBotView']
  .forEach(id => segmentSelect(document.getElementById(id)));
