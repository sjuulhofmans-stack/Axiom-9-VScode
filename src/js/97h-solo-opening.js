// ---------- begin van het potje: dobbelen wie begint, dan startposities kiezen ----------
// Zelf spelen én Multiplayer (dat dezelfde motor gebruikt; alleen de host voert dit uit, gasten
// tekenen het na uit de gedeelde stand, zie mpApplyState). Iedereen gooit met 2 dobbelstenen;
// bij gelijke worp gooien alleen die spelers opnieuw, voor elke plek (openingSplitBucket,
// 95-simulate.js). Daarna kiest iedereen in die volgorde een startpositie, en die volgorde is
// meteen de beurtvolgorde. Pas als je aan de beurt bent om te kiezen zie je je eerste opdracht
// (p.questHidden). De weergave (het grote paneel rechts, de gloeiende startvakjes) is gedeeld
// met Automatisch: renderOpeningPanel/walkGlowStarts in 96-walk.js.
// soloPhase: 'opening-roll' (soloActiveIdx = wie moet gooien) → 'opening-pick' (= wie kiest).
let soloOpening = null;   // zie walkNewOpening (96-walk.js) voor de vorm
const SOLO_OPENING_BOT_ROLL_MS = 1100;   // even de stenen laten rollen voordat een bot gooit
const SOLO_OPENING_HUMAN_ROLL_MS = 800;  // en na jouw klik ook even laten schudden, dan pas de worp
const SOLO_OPENING_BOT_PICK_MS = 1500;   // even laten zien welke opdracht een bot heeft
// mag de kijker op DIT scherm nu zelf gooien/kiezen?
function soloOpeningIsMine(){
  const p = soloPlayers[soloActiveIdx];
  if (!p || !p.isHuman) return false;
  if (typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game') return p.peerId === mp.myPeerId;
  return true;
}
// alleen uitvoeren als het potje intussen niet gestopt/herstart is
function soloOpeningLater(ms, fn){
  const runId = soloRunId;
  setTimeout(() => { if (runId === soloRunId && soloOpening) fn(); }, ms);
}
function soloRenderOpening(){
  const op = soloOpening;
  if (!op) return;
  const mine = soloOpeningIsMine();
  if (op.stage === 'roll'){
    walkClearStartGlow();
    renderOpeningPanel(soloPlayers, op, { canRoll: mine && op.rolling === soloActiveIdx && !op.shaking, shaking: !!op.shaking });
  } else {
    const free = walkOpeningFreeLabels(soloPlayers);
    const chooser = soloPlayers[op.order[op.pickPos]];
    renderOpeningPanel(soloPlayers, op, { canPick: mine && !!chooser && chooser.idx === soloActiveIdx, freeLabels: free });
    if (chooser) walkGlowStarts(soloGraph, free, chooser.color);
  }
}
function soloBeginOpening(){
  soloOpening = walkNewOpening(soloPlayers);
  for (const p of soloPlayers) p.questHidden = true;
  walkSetOpeningMode(true);
  clearWalkTarget();
  if (soloPlayers.length > 1){
    walkLog(`<b>Wie begint?</b> Iedereen gooit met 2 dobbelstenen; de hoogste kiest als eerste een startpositie en begint het spel.`);
  }
  soloOpeningStep();   // met 1 speler valt er niets te dobbelen: meteen kiezen
}
function soloOpeningStep(){
  const op = soloOpening;
  if (!op) return;
  soloClearClickable();
  if (op.stage === 'roll'){
    if (!op.group){
      const group = openingNextGroup(op.buckets);
      if (!group){
        op.stage = 'pick';
        op.order = openingOrder(op.buckets);
        op.pickPos = 0;
        if (soloPlayers.length > 1) walkLog(`Volgorde: ${op.order.map(i => soloPlayers[i].name).join(' → ')}. In deze volgorde kies je een startpositie, en zo gaan ook de beurten.`);
        soloOpeningStep();
        return;
      }
      op.group = group;
      op.rolls = {};
      op.round++;
    }
    const roller = op.group.find(i => !(i in op.rolls));
    const p = soloPlayers[roller];
    soloActiveIdx = roller;
    soloPhase = 'opening-roll';
    op.rolling = roller;
    op.shaking = !p.isHuman;
    if (walkSideStackEl) walkSideStackEl.style.setProperty('--pc', p.color);
    renderWalkScore(soloPlayers, roller);
    renderSoloMeta();
    soloRenderOpening();
    if (!p.isHuman) soloOpeningLater(SOLO_OPENING_BOT_ROLL_MS, () => soloOpeningDoRoll(roller));
    return;
  }
  if (op.pickPos >= op.order.length){ soloFinishOpening(); return; }
  const idx = op.order[op.pickPos];
  const p = soloPlayers[idx];
  soloActiveIdx = idx;
  soloPhase = 'opening-pick';
  p.questHidden = false;   // nu pas zie je je eerste opdracht
  if (walkSideStackEl) walkSideStackEl.style.setProperty('--pc', p.color);
  soloRefreshTarget();
  renderWalkScore(soloPlayers, idx);
  renderSoloMeta();
  const free = walkOpeningFreeLabels(soloPlayers);
  if (p.isHuman) soloMarkClickable(soloGraph, free.map(l => soloGraph.startCells[l]));
  soloRenderOpening();
  if (!p.isHuman) soloOpeningLater(SOLO_OPENING_BOT_PICK_MS, () => soloOpeningDoPick(idx, botPickStartLabel(soloGraph, p, free)));
}
// knop "Gooi de dobbelstenen" in het paneel (mens; in Multiplayer via de host)
function soloOpeningRoll(){
  if (soloPhase !== 'opening-roll' || !soloOpening || soloOpening.shaking) return;
  if (mpIntercept('openingRoll', {})) return;
  const p = soloPlayers[soloActiveIdx];
  if (!p || !p.isHuman) return;
  // eerst even schudden (zelfde animatie als bij een bot), dan pas de worp
  const idx = soloActiveIdx;
  soloOpening.shaking = true;
  soloRenderOpening();
  soloOpeningLater(SOLO_OPENING_HUMAN_ROLL_MS, () => soloOpeningDoRoll(idx));
}
function soloOpeningDoRoll(idx){
  const op = soloOpening;
  if (!op || op.stage !== 'roll' || op.rolling !== idx) return;
  const r = [simRollD6(soloRand), simRollD6(soloRand)];
  op.rolls[idx] = r;
  op.last[idx] = r;
  op.rolling = null;
  op.shaking = false;
  walkLog(`${soloPlayers[idx].name} gooit ${r[0]}+${r[1]} = <b>${r[0] + r[1]}</b>${op.round > 1 ? ' (opnieuw)' : ''}.`, null, soloPlayers[idx]);
  if (op.group.every(i => i in op.rolls)){
    // iedereen in deze groep heeft gegooid: splitsen op de worpen, gelijke worpen blijven samen
    op.buckets.splice(op.buckets.indexOf(op.group), 1, ...openingSplitBucket(op.group, op.rolls));
    op.group = null;
    op.note = walkOpeningNote(soloPlayers, op.buckets);
    walkLog(op.note);
    soloRenderOpening();
    // even laten zien wie er bovenaan staat: wachten tot de stenen stilliggen en de rijen naar
    // hun nieuwe plek geschoven zijn (openingBusyMs, 96-walk.js)
    soloOpeningLater(Math.max(1100, openingBusyMs() + 600), soloOpeningStep);
  } else {
    soloRenderOpening();
    soloOpeningLater(500, soloOpeningStep);
  }
}
// klik op een gloeiend startvakje, of een knop in het paneel (mens; in Multiplayer via de host)
function soloOpeningPick(key){
  if (soloPhase !== 'opening-pick' || !soloOpening) return;
  if (mpIntercept('openingPick', { key })) return;
  const p = soloPlayers[soloActiveIdx];
  if (!p || !p.isHuman) return;
  const label = walkOpeningFreeLabels(soloPlayers).find(l => soloGraph.startCells[l] === key);
  if (!label) return;
  soloOpeningDoPick(soloActiveIdx, label);
}
function soloOpeningDoPick(idx, label){
  const op = soloOpening;
  if (!op || op.stage !== 'pick' || op.order[op.pickPos] !== idx) return;
  if (walkFlyingIdx.has(idx)) return;   // vliegt al: een tweede klik telt niet
  const p = soloPlayers[idx];
  p.startLabel = label;
  p.pos = soloGraph.startCells[label];
  op.picks[idx] = label;
  const first = p.deck[p.nextIdx];
  walkLog(`${p.name} kiest startpositie <b>${label}</b> — eerste opdracht ${first} ${QUEST_NAMES[first] || ''}.`, null, p);
  soloClearClickable();
  // komeet naar het startvak (walkCometToStart, 96-walk.js); pas na de landing staat de pion en is
  // de volgende aan de beurt. op.pickPos schuift ook pas dan door, zodat Multiplayer-gasten
  // ondertussen "gekozen, onderweg" zien en dezelfde komeet afspelen (mpApplyState).
  walkFlyingIdx.add(idx);
  const runId = soloRunId;
  walkCometToStart(soloGraph, p, p.pos).then(() => {
    walkFlyingIdx.delete(idx);
    if (runId !== soloRunId || soloOpening !== op) return;   // intussen gestopt of opnieuw begonnen
    op.pickPos++;
    paintWalkPawns(soloGraph, soloPlayers, idx);
    soloOpeningStep();
  });
}
function soloFinishOpening(){
  soloTurnOrder = soloOpening.order.slice();
  walkScoreOrder = soloTurnOrder;
  soloOpening = null;
  soloPhase = 'idle';
  soloActiveIdx = -1;
  soloClearClickable();
  clearWalkTarget();
  walkSetOpeningMode(false);
  for (const p of soloPlayers) p.questHidden = false;
  soloLogGameStart();
  renderWalkScore(soloPlayers, soloTurnOrder[0]);
  paintWalkPawns(soloGraph, soloPlayers, soloTurnOrder[0]);
  soloAdvanceLoop();
}
// de openingsregels van het logboek, zodra iedereen een startpositie heeft — gedeeld met
// Multiplayer (mpHostStartGame laat de opening ook via soloBeginOpening lopen)
function soloLogGameStart(){
  const multi = typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game';
  // Alleen de EERSTE opdracht loggen, niet de hele stapel — net als in het zijpaneel ligt
  // de rest van je opdrachtenstapel dichtgeslagen (zie renderSoloMeta).
  for (const p of soloPlayers){
    const who = p.isHuman ? (multi ? '(mens)' : '(jij)') : '(bot)';
    const stratNote = p.isHuman ? '' : ` · energie: <b>${energyStrategyName(p.strategy)}</b>`;
    const first = p.deck[0];
    walkLog(`${p.name} ${who} start op <b>${p.startLabel}</b>${stratNote} · eerste opdracht: ${first} — ${QUEST_NAMES[first] || ''}`, null, p);
  }
  walkLog(`Elke voltooide opdracht levert een kristal op uit een gedeelde stapel — net als het kristalvakje in elke gang (zet stopt er niet voor, hooguit 1x per beurt) — max ${ACTION_CARD_HAND_MAX} kristallen in de kluis.`);
  if (soloPlayers.length > 1){
    walkLog(`Beurtvolgorde: ${soloTurnOrder.map(i => soloPlayers[i].name).join(' → ')}.`);
    walkLog(soloPlayers.length === 2
      ? `Er wordt gespeeld tot de winnaar binnen is — de ander is dan tweede.`
      : `Er wordt doorgespeeld tot de <b>${soloFinishTarget}e</b> binnen is; de laatste speler is dan automatisch ${soloPlayers.length}e.`);
  } else {
    walkLog(`Solo potje: niemand blokkeert je. Kristallen die een tegenstander raken (Kortsluiting, Duwstoot, Vergrendeling, Stroomonderbreking, Energielek, Blinde Vlek) kun je hier niet gebruiken.`);
  }
}
if (walkOpeningPanelEl){
  walkOpeningPanelEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-opening-roll]')){ soloOpeningRoll(); return; }
    const pick = e.target.closest('[data-opening-pick]');
    if (pick && soloGraph) soloOpeningPick(soloGraph.startCells[pick.dataset.openingPick]);
  });
}

// ---------- potje starten/stoppen ----------
function stopSoloGame(){
  soloRunId++;   // breekt ook een lopende soloAnimateBotTurn() af
  crystalResetVault();   // lopende kristal-animaties, "Nieuw"-labels en de gekozen plek weg
  diceReset();
  soloPhase = 'idle';
  soloBotViewSpeed = null;
  // geen vertraagde soloPeekQuestEnd() laten hangen op een potje dat hierna niet meer bestaat
  if (soloPeekEndTimer){ clearTimeout(soloPeekEndTimer); soloPeekEndTimer = null; }
  soloPeeking = false;
  soloRefreshCardVault();
  soloGraph = null; soloPlayers = []; soloMove = null; soloActiveIdx = -1;
  soloRoundFinishers = []; soloFinished = 0; soloRoundPos = 0;
  soloOpening = null;
  walkSetOpeningMode(false);   // gestopt tijdens het dobbelen/kiezen aan het begin
  soloClearClickable();
  soloHideStepCounter();
  soloHideEndgame();
  // De spelersbalk bleef anders de stand van het vorige potje tonen (scores, energie,
  // kaarten) terwijl de opzet-UI alweer open stond.
  walkScoreOrder = null;
  if (walkScoreEl) walkScoreEl.innerHTML = '';
  if (walkScoreActiveEl) walkScoreActiveEl.innerHTML = '';
  if (walkSoloPanelEl) walkSoloPanelEl.hidden = true;
  if (walkEnergyOverviewEl) walkEnergyOverviewEl.hidden = true;
  if (walkOrSep1El) walkOrSep1El.hidden = true;
  if (walkOrSep2El) walkOrSep2El.hidden = true;
  // opzet-UI komt terug in beeld (zie startSoloGame hieronder, die 'm juist wegstopt zodra er
  // een potje loopt) — scheelt flink wat hoogte boven het bord tijdens het spelen zelf
  // (gebruikerseis: alles moet in 1 pagina passen).
  // ALLEEN als Zelf spelen ook echt de gekozen modus is — stopSoloGame() loopt ook bij elke
  // bordwijziging (clearSimResults, dus ook bij het genereren bij het openen), en zette de
  // Zelf-spelen-velden dan onder Automatisch erbij (gebruikersmelding: "2x aantal spelers")
  const soloModeOn = !!walkModeSoloBtn && walkModeSoloBtn.classList.contains('active');
  if (walkSoloControlsEl && soloModeOn) walkSoloControlsEl.hidden = false;
  if (walkSoloHintEl && soloModeOn) walkSoloHintEl.hidden = false;
  if (walkStatTilesEl){ walkStatTilesEl.innerHTML = ''; walkStatTilesEl.dataset.html = ''; }
  if (walkInfoPanelEl) walkInfoPanelEl.classList.remove('is-mission');
  if (walkQuestChecklistEl){ walkQuestChecklistEl.innerHTML = ''; walkQuestChecklistEl.dataset.html = ''; }
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  if (btnWalkSoloRoll) btnWalkSoloRoll.hidden = true;
  if (btnWalkSoloSkip) btnWalkSoloSkip.hidden = true;
  if (btnWalkSoloStart) btnWalkSoloStart.disabled = false;
  if (btnWalkSoloReset) btnWalkSoloReset.disabled = true;
  for (const sel of walkSoloSetupEl ? walkSoloSetupEl.querySelectorAll('select') : []) sel.disabled = false;
}
function startSoloGame(){
  stopSoloGame();
  walkLogEl.innerHTML = '';
  walkStatusEl.innerHTML = '';
  if (walkSoloPanelEl) walkSoloPanelEl.hidden = false;
  if (walkEnergyOverviewEl) walkEnergyOverviewEl.hidden = false;
  if (walkOrSep1El) walkOrSep1El.hidden = false;
  // opzet-UI (spelers-/bot-aantal, de lange regelparagraaf) heeft tijdens het spelen zelf geen
  // functie meer en kost boven het bord veel hoogte — weg ermee zodra het potje loopt, zodat
  // bord + zijkolom weer een kans hebben om zonder scrollen op het scherm te passen.
  if (walkSoloControlsEl) walkSoloControlsEl.hidden = true;
  if (walkSoloHintEl) walkSoloHintEl.hidden = true;

  const reach = analyseCellReachability();
  if (reach.unreachable.length > 0){
    walkStatusEl.innerHTML = `<span class="bad">✕ Dit bord heeft ${reach.unreachable.length} onbereikbare vakjes — pas de indeling aan voordat je speelt.</span>`;
    return;
  }
  renderWalkBoard();
  const graph = buildSimGraph();
  const missing = [...SIM_QUEST_LABELS, ...SIM_START_LABELS].filter(l =>
    graph.questCells[l] === undefined && graph.startCells[l] === undefined);
  if (missing.length){
    walkStatusEl.innerHTML = `<span class="bad">✕ Deze vakjes ontbreken op het bord: ${missing.join(', ')}.</span>`;
    return;
  }
  if (!soloSetupPlayers.length) soloRebuildSetup();

  soloGraph = graph;
  soloRand = soloSetupRand;
  soloPlayers = soloSetupPlayers;
  const botView = walkSoloBotViewSel ? walkSoloBotViewSel.value : 'instant';
  soloBotViewSpeed = botView === 'instant' ? null : (parseInt(botView, 10) || 2);
  // nog niemand op het bord: startposities en beurtvolgorde volgen uit het dobbelen aan het
  // begin (soloBeginOpening hieronder); tot die tijd staat de balk gewoon op spelersvolgorde
  for (const p of soloPlayers){ p.startLabel = null; p.pos = null; p.questHidden = true; }
  soloTurnOrder = soloPlayers.map(p => p.idx);
  walkScoreOrder = soloTurnOrder;   // balk in beurtvolgorde, zie renderWalkScore in 96-walk.js
  soloFinishTarget = simFinishTarget(soloPlayers.length);
  soloFinished = 0;
  soloRoundFinishers = [];
  soloRoundPos = 0;
  soloTurn = 0;
  soloDeck = buildActionDeck(soloRand);
  portalSetup(soloGraph, soloRand);   // vier portalen (twee paren) liggen al bij de start
  walkPaintPortals(soloGraph);
  crystalResetVault();
  diceReset();

  // De per-mens startpositie-kiezers hebben hun werk gedaan zodra het potje loopt — laten staan
  // (uitgeschakeld) kostte alleen maar ruimte boven het speelveld en liet het bord bij de eerste
  // volgende klik met een sprong omhoog schieten toen die rijen alsnog ergens verdwenen.
  // `.walk-solo-setup:empty{display:none;}` verbergt 'm meteen; soloRenderSetupUI() vult 'm
  // straks gewoon weer als je op "Nieuw potje" klikt.
  if (walkSoloSetupEl) walkSoloSetupEl.innerHTML = '';
  btnWalkSoloStart.disabled = true;
  btnWalkSoloReset.disabled = false;

  renderWalkScore(soloPlayers, -1);
  paintWalkPawns(soloGraph, soloPlayers, -1);
  // eerst het dobbelen wie begint + startposities kiezen; soloFinishOpening() start daarna het
  // potje zelf (soloAdvanceLoop). `soloRunId` bewaakt dat deze uitgestelde stap zichzelf
  // afbreekt als het potje ondertussen alweer gestopt/herstart is (`stopSoloGame()`).
  const runId = soloRunId;
  requestAnimationFrame(() => {
    if (runId !== soloRunId) return;
    soloBeginOpening();
  });
}

if (walkModeAutoBtn) walkModeAutoBtn.addEventListener('click', () => setWalkMode('auto'));
if (walkModeSoloBtn) walkModeSoloBtn.addEventListener('click', () => setWalkMode('solo'));
if (walkModeMultiBtn) walkModeMultiBtn.addEventListener('click', () => setWalkMode('multi'));
// walkTryStart() (96-walk.js) doet de reachability-check en faded pas daarna naar het
// speelscherm — zie de toelichting daar.
if (btnWalkSoloStart) btnWalkSoloStart.addEventListener('click', () => walkTryStart(startSoloGame));
// "Nieuw potje" moet een SCHONE lei zijn (energie/opdrachten/posities terug naar 0, nieuwe
// shuffle) — niet startSoloGame() nogmaals, want die hergebruikt soloPlayers = soloSetupPlayers
// rechtstreeks (zelfde objecten, geen kopie) zonder ze te resetten. Zonder deze route bleef
// b.v. Speler 1's energie van het vorige potje gewoon staan en tellen bots' oude startLabel nog
// mee als "bezet" voor de volgende ronde — vandaar de gemelde bug ("energie blijft oplopen,
// startposities kloppen niet"). soloRebuildSetup() bouwt frisse spelerobjecten met energie 0,
// nieuw geschudde stapels en een nieuwe RNG, en vult de lobby-opzet weer — walkFadeToLobby()
// erna brengt die ook echt weer in beeld (gebruikerswens: "Nieuw potje" gaat terug naar het
// startscherm, net als "Stoppen" bij Automatisch).
function walkResetConfirmedReset(){
  if (walkResetConfirmEl) walkResetConfirmEl.hidden = true;
  walkFadeToLobby(soloRebuildSetup);   // opnieuw opbouwen achter het donkere scherm
}
// Klikken opent nu eerst een bevestiging i.p.v. meteen te resetten — de knop staat in de
// tabbladenbalk, vlak boven de rest van de pagina, en een misklik (bv. net naast de dobbelknop
// op een telefoon) gooide zonder dit een lopend potje weg zonder enige kans om terug te
// krabbelen (gebruikersmelding). Klik naast het paneel of Escape = annuleren, net als de
// andere overlays (zie editorOverlay in 90-editor.js).
if (btnWalkSoloReset) btnWalkSoloReset.addEventListener('click', () => {
  if (walkResetConfirmEl) walkResetConfirmEl.hidden = false;
});
if (btnWalkResetConfirmYes) btnWalkResetConfirmYes.addEventListener('click', walkResetConfirmedReset);
if (btnWalkResetConfirmCancel) btnWalkResetConfirmCancel.addEventListener('click', () => {
  if (walkResetConfirmEl) walkResetConfirmEl.hidden = true;
});
if (walkResetConfirmEl) walkResetConfirmEl.addEventListener('click', (e) => {
  if (e.target === walkResetConfirmEl) walkResetConfirmEl.hidden = true;   // klik naast het venster sluit het
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && walkResetConfirmEl && !walkResetConfirmEl.hidden) walkResetConfirmEl.hidden = true;
});
// Zichtbaarheid van de knop zelf: alleen op tabblad "Stap voor stap", alleen in Zelf spelen, en
// nooit tijdens multiplayer (dat heeft zijn eigen "Verlaat potje", zie 99-multiplayer.js) — de
// knop leeft nu in de globale tabbladenbalk (index.html), die anders dan #tabWalk niet vanzelf
// meeverbergt met switchTab(). Aangeroepen vanuit setWalkMode() hierboven en switchTab()
// (80-controls.js); walkPanelEl (= #tabWalk) komt uit 96-walk.js.
function walkSoloResetSyncVisibility(){
  if (!btnWalkSoloReset) return;
  const onWalkTab = !!walkPanelEl && !walkPanelEl.hidden;
  const soloActive = !!walkModeSoloBtn && walkModeSoloBtn.classList.contains('active');
  const inMultiplayer = !!window.mpGameActive;
  // alleen tijdens het speelscherm — in de lobby stond hij er eerst al (uitgeschakeld) terwijl
  // er nog geen potje was om opnieuw te beginnen (gebruikersmelding)
  const playing = !!walkPlayAreaEl && !walkPlayAreaEl.hidden;
  btnWalkSoloReset.hidden = !(onWalkTab && soloActive && playing && !inMultiplayer);
}

// "Zelf spelen" is de standaard-actieve tab (zie de HTML; sinds 2026-11, gebruikerswens — daarvoor
// was dat "Automatisch", op het scherm nu "Bots spelen"). Deze aanroep zet alle mode-afhankelijke
// zichtbaarheid bij het laden meteen goed en bouwt de solo-opzet op.
setWalkMode('solo');
