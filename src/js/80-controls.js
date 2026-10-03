// ---------- controls ----------
// pool van 60 kandidaten (zie constrainedShuffleAsync in 70-generator.js) duurt ~2s i.p.v. de
// vroegere ~0,7s bij pool 20 — loopt daarom in brokken met een voortgangsbalk (zelfde patroon
// als runSimulationBatch in 95-simulate.js), anders bevriest de pagina zichtbaar tijdens het
// genereren. genRunning/btnShuffle.disabled voorkomt dat een dubbele klik twee generaties
// tegelijk start; hideGenProgress() (aangeroepen vanuit clearSimResults() bij ELKE bordwijziging)
// zorgt dat de balk en knoppen direct resetten zodra het bord op een ANDERE manier verandert
// terwijl er nog gegenereerd wordt (bv. een tegel slepen) — de simRunId-check in
// applyGeneratedLayout zorgt dat zo'n verouderde run zijn resultaat dan ook niet meer toepast.
const genProgressEl = document.getElementById('genProgress');
const genProgressFillEl = document.getElementById('genProgressFill');
const genProgressTextEl = document.getElementById('genProgressText');
let genRunning = false;

// Het "aan het genereren"-vakje over het bordvak (index.html, #genOverlay): het bord zelf is
// dan onzichtbaar, zodat je bij het openen niet eerst een (oude) kaart ziet.
const genOverlayEl = document.getElementById('genOverlay');
const mapBoardPanelEl = document.querySelector('.map-board-panel');
function showGenOverlay(seed){
  if (genOverlayEl) genOverlayEl.hidden = false;
  if (mapBoardPanelEl) mapBoardPanelEl.classList.add('is-generating');
  const s = document.getElementById('genOverlaySeed');
  if (s) s.textContent = seed ? `seed: ${seed}` : '';
}
function hideGenOverlay(){
  if (genOverlayEl) genOverlayEl.hidden = true;
  if (mapBoardPanelEl) mapBoardPanelEl.classList.remove('is-generating');
}
function hideGenProgress(){
  if (genProgressEl) genProgressEl.hidden = true;
  hideGenOverlay();
  genRunning = false;
  const btnShuffleEl = document.getElementById('btnShuffle'), btnDiceEl = document.getElementById('btnDice');
  if (btnShuffleEl) btnShuffleEl.disabled = false;
  if (btnDiceEl) btnDiceEl.disabled = false;
}
function updateGenProgress(found, target, elapsedMs){
  if (!genProgressEl) return;
  const pct = target ? Math.min(100, (found / target) * 100) : 0;
  genProgressFillEl.style.width = `${pct.toFixed(1)}%`; // CSS: hier moet de punt blijven staan
  const perCandidate = found ? elapsedMs / found : 0;
  const etaMs = perCandidate * (target - found);
  genProgressTextEl.innerHTML =
    `<span><b>${found}</b> / ${target} kandidaten (${nl(pct, 0)}%)</span>` +
    `<span>verstreken ${formatSimSeconds(elapsedMs)} · nog ongeveer ${found > 0 ? formatSimSeconds(etaMs) : '…'}</span>`;
}

async function applyGeneratedLayout(seed){
  if (genRunning) return; // een dubbele klik mag geen tweede generatie tegelijk starten
  // de huidige kaart onthouden voor "Vorige indeling" (alleen als er al een gegenereerde is)
  const before = hasGeneratedLayout ? snapshotLayout() : null;
  clearSimResults();
  const runId = simRunId; // clearSimResults() heeft 'm net verhoogd; deze aanroep "claimt" dat nummer
  genRunning = true;
  showGenOverlay(seed);
  const btnShuffleEl = document.getElementById('btnShuffle'), btnDiceEl = document.getElementById('btnDice');
  if (btnShuffleEl) btnShuffleEl.disabled = true;
  if (btnDiceEl) btnDiceEl.disabled = true;
  if (genProgressEl){ genProgressEl.hidden = false; updateGenProgress(0, 60, 0); }

  const t0 = performance.now();
  const generated = await constrainedShuffleAsync(seed, (found, target) => {
    if (runId !== simRunId) return; // bord intussen op een andere manier gewijzigd
    updateGenProgress(found, target, performance.now() - t0);
  });
  if (runId !== simRunId){ return; } // verouderd: bord is inmiddels iets anders geworden

  layout = generated;
  hideGenProgress();
  selectedSlot = null; highlightTile = null;
  statSeed.textContent = seed;
  hasGeneratedLayout = true;
  if (before){ previousLayout = before; if (btnPrevLayout) btnPrevLayout.disabled = false; }
  // Geen lange kwaliteitsmelding meer onder de knoppen (gebruikerswens: die liep over meerdere
  // regels, maakte de kolom langer en liet alles verschuiven). De seed staat al rechtsboven in
  // de kop; alleen als het NIET gelukt is volgt er een korte waarschuwing.
  const conn = computeConnectivity();
  if (conn.groups.length === 1 && conn.brokenCount === 0){
    swapHint.textContent = 'Sleep een tegel over een andere om ze te verwisselen.';
  } else {
    swapHint.innerHTML = `<span style="color:var(--danger)">Beste poging: ${conn.brokenCount} doodlopende naad/naden — probeer een andere seed.</span>`;
  }
  renderBoard();
}

document.getElementById('btnShuffle').addEventListener('click', ()=>{
  const seed = seedInput.value.trim() || 'axiom-9';
  applyGeneratedLayout(seed);
});

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
if (btnPrevLayout) btnPrevLayout.addEventListener('click', () => {
  if (!previousLayout || genRunning) return;
  const current = snapshotLayout();
  clearSimResults();
  layout = previousLayout.layout.slice();
  for (let tid = 1; tid <= 20; tid++) tileRotation[tid] = previousLayout.rot[tid] || 0;
  statSeed.textContent = previousLayout.seed;
  seedInput.value = previousLayout.seed;
  previousLayout = current;
  selectedSlot = null; highlightTile = null;
  swapHint.textContent = 'Sleep een tegel over een andere om ze te verwisselen.';
  renderBoard();
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
document.getElementById('btnDice').addEventListener('click', ()=>{
  const seed = randomSeedName();
  seedInput.value = seed;
  // direct genereren, geen extra klik op "Genereer indeling" nodig
  applyGeneratedLayout(seed);
});
// Bij elke keer openen (of verversen) van het document meteen een nieuwe, willekeurige indeling
// i.p.v. telkens dezelfde beginkaart (gebruikerswens) — precies wat de dobbelsteenknop doet.
// "Herstel alles" brengt de originele indeling nog steeds terug. setTimeout: pas nadat het hele
// script geladen is, want applyGeneratedLayout gebruikt dingen uit latere bestanden (95-simulate).
setTimeout(() => {
  const seed = randomSeedName();
  seedInput.value = seed;
  applyGeneratedLayout(seed);
}, 0);

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
