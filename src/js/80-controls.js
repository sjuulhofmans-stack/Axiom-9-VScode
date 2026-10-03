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

// ---------- "Aan het genereren"-vakje (index.html, #genOverlay) ----------
// Tijdens het genereren (én bij het openen, vóórdat er een kaart is) faadt de kaart rustig uit en
// verschijnt in het midden een vakje in ruimtestijl: een planeet met een ring die zich vult met
// de voortgang, en eronder hoe lang het nog duurt (telt af). Klaar → het vakje faadt uit en de
// nieuwe kaart faadt in. De losse voortgangsbalk rechts is weg (gebruikerswens).
// GEN_FADE_MS moet gelijk blijven aan de transitieduur van .map-board-panel/.gen-overlay.
const GEN_FADE_MS = 900;
const genOverlayEl = document.getElementById('genOverlay');
const mapBoardPanelEl = document.querySelector('.map-board-panel');
const genArcEl = document.getElementById('genArc');
const genEtaEl = document.getElementById('genEta');
const GEN_ARC_LEN = 2 * Math.PI * 54;   // omtrek van de ring (r = 54 in het SVG-plaatje)
let genEtaEnd = null, genEtaTimer = null;
function genSleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function showGenOverlay(){
  if (mapBoardPanelEl) mapBoardPanelEl.classList.add('is-generating');
  setGenRing(0);
  genEtaEnd = null;
  if (genEtaEl) genEtaEl.textContent = 'even geduld…';
  clearInterval(genEtaTimer);
  // aftellen per seconde op basis van de laatste schatting (updateGenProgress)
  // het getal mag alleen dalen (de schatting schommelt per brok), en is de ring vol dan wordt
  // er nog afgerond: "bijna klaar…" i.p.v. een "nog 1 seconde" die blijft hangen
  let shown = Infinity;
  genEtaTimer = setInterval(() => {
    if (!genEtaEl || genEtaEnd === null) return;
    if (genPct >= 100){ genEtaEl.textContent = 'bijna klaar…'; return; }
    const left = Math.max(0, Math.ceil((genEtaEnd - performance.now()) / 1000));
    shown = Math.min(shown, left);
    genEtaEl.textContent = shown > 0 ? `nog ${shown} ${shown === 1 ? 'seconde' : 'seconden'}` : 'bijna klaar…';
  }, 200);
}
function hideGenOverlay(){
  if (mapBoardPanelEl) mapBoardPanelEl.classList.remove('is-generating');
  clearInterval(genEtaTimer); genEtaTimer = null;
}
let genPct = 0;
function setGenRing(pct){
  genPct = pct;
  if (genArcEl) genArcEl.style.strokeDashoffset = String(GEN_ARC_LEN * (1 - pct / 100));
}
function hideGenProgress(){
  hideGenOverlay();
  genRunning = false;
  const btnShuffleEl = document.getElementById('btnShuffle');
  if (btnShuffleEl) btnShuffleEl.disabled = false;
}
function updateGenProgress(found, target, elapsedMs){
  const pct = target ? Math.min(100, (found / target) * 100) : 0;
  setGenRing(pct);
  if (found > 0) genEtaEnd = performance.now() + (elapsedMs / found) * (target - found);
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
    updateGenProgress(found, target, performance.now() - t0);
  });
  if (runId !== simRunId){ return; } // verouderd: bord is inmiddels iets anders geworden
  setGenRing(100);
  // de oude kaart moet helemaal uitgefaded zijn vóórdat de nieuwe erin komt
  const waited = performance.now() - t0;
  if (waited < GEN_FADE_MS) await genSleep(GEN_FADE_MS - waited);
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
function switchTab(name){
  if (window.mpGameActive && name !== 'walk') return;
  for (const btn of tabButtons){
    const active = btn.dataset.tab === name;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  }
  for (const key of Object.keys(tabPanels)) tabPanels[key].hidden = key !== name;
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
  if (name === 'walk' && !walkRunning && !soloGraph) renderWalkBoard();
  // de kamernaam op een opdrachtkaart hangt aan de tegel, dus bij elk openen opnieuw opbouwen
  if (name === 'cards') renderCardsTab();
  // multiplayer heeft geen eigen tabblad meer (zit als derde modus in #walkLobby, zie
  // #walkModeMulti/setWalkMode() in 97-solo.js) — mpRenderLobby() wordt daarom vanuit
  // setWalkMode('multi') aangeroepen, niet meer hiervandaan.
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
