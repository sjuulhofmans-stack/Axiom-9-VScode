// ---------- dobbelen + lopen ----------
function renderSoloDicePending(){
  diceRenderPending(soloPendingBoost ? 3 : 2, soloEnergyRoll);
}
// `soloCurrentLegalMoves` voedt niet alleen deze teller maar ook de pijltjestoetsen
// hieronder — bewegen zelf gaat via een klik op een omrand bordvakje (.walk-clickable) of
// via die pijltjestoetsen, dit is puur de "gezet/nog"-teller ernaast.
function soloRenderStepCounter(legal){
  soloCurrentLegalMoves = legal;
  if (walkStepCounterEl) walkStepCounterEl.hidden = false;
  if (walkStepDoneEl) walkStepDoneEl.textContent = soloMove.path.length - 1;
  if (walkStepLeftEl) walkStepLeftEl.textContent = soloMove.stepsLeft;
  diceSetProgress(soloMove.path.length - 1, soloMove.stepsLeft);   // teller + stappenbalk in het dobbelvak
}
// verborgen zolang je nog niet hebt gedobbeld (gebruikerswens) — pas zichtbaar vanaf de eerste
// soloRenderStepCounter()-aanroep, die precies samenvalt met het moment dat je stappen kunt
// gaan zetten.
function soloHideStepCounter(){
  soloCurrentLegalMoves = [];
  if (walkStepCounterEl) walkStepCounterEl.hidden = true;
  if (walkStepDoneEl) walkStepDoneEl.textContent = '–';
  if (walkStepLeftEl) walkStepLeftEl.textContent = '–';
}
// Op een pc mogen de pijltjestoetsen een stap zetten, net als een klik op een omrand
// bordvakje (gebruikersverzoek). Alleen actief tijdens het lopen (soloPhase === 'moving') en
// niet terwijl je ergens anders op de pagina aan het typen bent (bv. de seed-invoer op
// tabblad "Speelbord genereren"), anders zouden de pijltjes daar niet meer gewoon door de tekst
// kunnen bewegen.
const SOLO_ARROW_DIR = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
document.addEventListener('keydown', (e) => {
  const dir = SOLO_ARROW_DIR[e.key];
  // Blokkeer scrollen tijdens de HELE actieve beurt (elke fase behalve 'idle'/'game-over'), niet
  // alleen tijdens 'moving' zelf — anders scrolt de pagina alsnog zodra je klaar bent met lopen
  // en een pijltje indrukt terwijl de fase net is doorgeschoven naar bv. 'choose-action' voor de
  // volgende beurt (gebruikersmelding: "als je klaar bent met je zetten scrollt de pagina").
  if (dir === undefined || soloPhase === 'idle' || soloPhase === 'game-over') return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  // Pijltjes zijn tijdens een potje alleen om te lopen. Bleef er na een muisklik een knop
  // geselecteerd (bv. het tabblad Energie), dan tekende de browser er bij het pijltje een witte
  // focusrand omheen, vooral als er geen stap kon (gebruikersmelding 2026-11). Dus eerst loslaten.
  if (tag === 'BUTTON') document.activeElement.blur();
  if (soloPhase !== 'moving' || diceBusyMs() > 0) return;   // stenen rollen nog uit
  const match = soloCurrentLegalMoves.find(l => l.dir === dir);
  if (!match) return;
  soloHandleMoveClick(match.key);
});

// 10e eigenaar-actie, naast de 9 uit het onderzoek: "geen energie-actie, gewoon dobbelen" bleek
// bij het testen met twee losse browsers rechtstreeks vanuit de skip-knop aangeroepen te worden,
// buiten soloUseEnergyAction om — zonder guard muteerde een non-host client hier stilletjes zijn
// eigen soloPhase, los van de host (desync bij de eerstvolgende snapshot).
function soloProceedToRoll(){
  if (mpIntercept('proceedToRoll', {})) return;
  walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  soloHideStepCounter();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = false;
  syncPulse(btnWalkSoloRoll);
  btnWalkSoloRoll.textContent = soloPendingBoost ? '🎲 Gooi 3 dobbelstenen' : '🎲 Gooi de dobbelstenen';
  renderSoloDicePending();
  soloPhase = 'rolling';
  soloRefreshCardVault();
  renderWalkScore(soloPlayers, soloActiveIdx);
  renderSoloMeta();
}
// Rolt en verwerkt de energiesteen voor deze beurt, als dat nog niet gebeurd is. Wordt aangeroepen
// zodra je daadwerkelijk beweegt — dobbelen (hier), of als vangnet in soloFinishTurn() voor de
// paden zonder dobbelklik (Zwaartekracht-laarzen, Noodtransport dat exact op je doel landt) — zodat
// elke beurt precies één keer energie oplevert, ook al zie je die pas ná je beweging verschijnen.
function soloRollEnergyForTurn(){
  if (soloEnergyRoll !== null) return;
  const p = solo();
  // Kortsluiting (door een ander op jou gespeeld): deze beurt geen energiesteen. Gold vroeger
  // alleen voor bots; een mens kreeg gewoon zijn steen.
  if (p.skipEnergyRoll){
    p.skipEnergyRoll = false;
    soloEnergyRoll = 0;
    soloEnergyGain = { gained: 0, wasted: 0 };
    walkLog(`<b>Kortsluiting</b>: je energiesteen telt deze beurt niet.`, null, p);
    return;
  }
  soloEnergyRoll = simRollEnergy(soloRand);
  if (p.stats) p.stats.energyRolled += soloEnergyRoll;
  soloEnergyGain = simGainEnergy(p, soloEnergyRoll);
  if (soloPendingTwin){
    soloPendingTwin = false;
    const second = simRollEnergy(soloRand);
    if (p.stats) p.stats.energyRolled += second;
    const g = simGainEnergy(p, second);
    soloEnergyGain.gained += g.gained;
    soloEnergyGain.wasted += g.wasted;
    walkLog(`<b>Dubbele steen</b>: je tweede energiesteen is een ${second}.`, null, p);
  }
  // Condensator die je vorige beurt speelde: deze steen telt dubbel. Gooi je 0, dan valt er
  // niets te verdubbelen en blijft hij staan tot een beurt waarin je wél iets gooit.
  if (p.condenserPending && soloEnergyRoll > 0){
    p.condenserPending = false;
    const bonus = simGainEnergy(p, soloEnergyRoll);
    soloEnergyGain.gained += bonus.gained;
    soloEnergyGain.wasted += bonus.wasted;
    walkLog(`Je <b>Condensator</b> gaat af: energiesteen ${soloEnergyRoll} telt dubbel → +${soloEnergyGain.gained} energie.`, null, p);
  }
}
function soloRollDice(){
  if (soloPhase !== 'rolling') return;
  if (mpIntercept('rollDice', {})) return;
  const p = solo();
  const d1 = simRollD6(soloRand, p), d2 = simRollD6(soloRand, p);
  statsRecordRoll(p, d1 + d2);
  const d3 = soloPendingBoost ? simRollD6(soloRand, p) : null;
  soloRollEnergyForTurn();
  let roll = d1 + d2 + (d3 || 0);
  const penalty = p.rollPenalty;   // onthouden in soloMove: geldt ook voor een Koerscorrectie
  if (penalty){
    const nieuw = Math.max(1, roll - penalty);
    walkLog(`<b>Stroomonderbreking</b> kost je ${roll - nieuw} stappen: ${roll} → ${nieuw}.`, null, p);
    roll = nieuw;
    p.rollPenalty = 0;
  }
  soloMove = { d1, d2, d3, roll, penalty, stepsLeft: roll, lastDir: -1, path: [p.pos] };
  diceMaybeHold();   // energiebalk wacht tot de bolletjes aankomen (96d-dice.js)
  renderWalkDice(d1, d2, soloEnergyRoll, false, d3, roll, { key: diceSoloRollKey(), flow: true });   // na de straf: toont de echte stappen
  btnWalkSoloRoll.hidden = true;
  renderWalkScore(soloPlayers, soloActiveIdx);
  soloAdvanceMovePhase();
}
if (btnWalkSoloRoll) btnWalkSoloRoll.addEventListener('click', soloRollDice);
// "Dobbelen" (energie overslaan) rolt nu in één klik i.p.v. alleen de losse rolknop te tonen
// (gebruikerswens: eerst moest je 'm daarna nog een keer aanklikken). Eigen functie i.p.v.
// hier gewoon soloProceedToRoll() + soloRollDice() na elkaar aanroepen: op een non-host
// multiplayer-client zou de eerste aanroep een intent versturen én meteen `return`en (de
// eigen mpIntercept-guard in soloProceedToRoll), waardoor de daaropvolgende soloRollDice()
// nog vóór dat intent is verwerkt op de nog-oude fase ('choose-action') zou botsen en zelf
// niks doen — dan komt er nooit een rollDice-intent bij de host terecht. Door dit als één
// eigen intent ('skipToRoll', zie MP_INTENT_HANDLERS in 99-multiplayer.js) te sturen, voert
// de host 'm straks in één keer volledig uit.
function soloSkipToRoll(){
  if (mpIntercept('skipToRoll', {})) return;
  soloProceedToRoll();
  soloRollDice();
}
if (btnWalkSoloSkip) btnWalkSoloSkip.addEventListener('click', () => {
  if (soloPhase === 'choose-action') soloSkipToRoll();
});

// Blinde Vlek: "loop door spelers heen, maar stop er niet op". Een bezet vakje mag alleen als je
// daarna nog verder kunt zonder op een pion te eindigen (zelfde regel als endBlockedSet bij de bots
// in resolveMove). Een vrij vakje is altijd veilig: loop je daarna vast, dan stop je op een vrij vakje.
// Een portaal-ingang is ook veilig: je komt uit het andere portaal, en dat werkt alleen als daar geen pion staat.
function soloBlindLegal(){
  const occ = soloOccupied();
  const memo = new Map();
  const canFinish = (k, dir, steps) => {
    if (!occ.has(k)) return true;
    if (steps <= 0) return false;
    const id = k * 100 + dir * 25 + steps;
    if (memo.has(id)) return memo.get(id);
    memo.set(id, false);
    const ok = soloLegalNextCells(soloGraph, k, dir, null)
      .some(n => n.portal !== undefined || canFinish(n.key, n.dir, steps - 1));
    memo.set(id, ok);
    return ok;
  };
  return soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, null)
    .filter(n => n.portal !== undefined || canFinish(n.key, n.dir, soloMove.stepsLeft - 1));
}
function soloAdvanceMovePhase(){
  const occ = soloOccupied();
  const blind = soloUsedCardId === 'blind';
  // stappen op (alleen mogelijk via soloStepsDone: je staat dan nog op een rooster en mag kruipen)
  const legal = soloMove.stepsLeft <= 0 ? []
    : blind ? soloBlindLegal() : soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, occ);
  soloCrawlStuck = false;
  // geen gewone stap meer, maar je staat met een schroevendraaier op een rooster: dan kun je nog
  // kruipen (of hier stoppen) — zie soloCrawlOfferHtml
  if (!legal.length && soloMove.stepsLeft >= 0 && soloCrawlExits().length){
    soloPhase = 'moving';
    soloCrawlStuck = true;
    soloClearClickable();
    soloHideStepCounter();
    renderSoloMeta(soloMove.stepsLeft);
    soloRefreshCardVault();
    return;
  }
  if (!legal.length && blind){
    // met Blinde Vlek geen enkele stap die niet op een pion eindigt: de zet stopt hier
    soloHideStepCounter();
    walkLog(`Geen vervolgstap meer mogelijk.`, null, solo());
    if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
    else soloFinishTurn(false);
    return;
  }
  if (!legal.length){
    // geen vervolgstap: ofwel een muur (echt doodlopend), ofwel puur tegenstanders in de weg
    // — in dat laatste geval mag Blinde Vlek de blokkade negeren, als je 'm hebt en nog geen
    // andere actie deze beurt hebt gebruikt
    const legalIgnoringBlock = soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, null);
    soloBlindOfferAvailable = legalIgnoringBlock.length > 0
      && solo().cards.includes('blind') && !soloCardActionUsed();
    if (soloBlindOfferAvailable){
      soloOfferBlindSpot();
      return;
    }
    soloHideStepCounter();
    const reason = legalIgnoringBlock.length ? 'liep tegen een bezette route aan' : 'doodlopend';
    walkLog(`${reason === 'doodlopend' ? 'Doodlopend' : 'Geblokkeerd door een tegenstander'} — geen vervolgstap meer mogelijk.`, null, solo());
    if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
    else soloFinishTurn(false);
    return;
  }
  soloPhase = 'moving';
  soloMarkClickable(soloGraph, legal.map(l => l.key));
  soloRenderStepCounter(legal);
  renderSoloMeta(soloMove.stepsLeft);
  // altijd-zichtbare kaartenrij (spelen/afleggen) opnieuw tekenen — dekt alle aanroepers van
  // deze functie in één keer (dobbelen, elke losse stap, ná een doelwit-kiezer/Condensator/enz.)
  soloRefreshCardVault();
}
// Blinde Vlek is puur reactief: alleen aan te bieden op het moment dat je zet daadwerkelijk
// door een tegenstander geblokkeerd wordt (net als bij de bots), dus dit is geen kaart in het
// gewone actiepaneel maar een kort ja/nee-keuzemoment middenin de zet.
function soloOfferBlindSpot(){
  soloPhase = 'blind-offer';
  soloHideStepCounter();
  soloClearClickable();
  btnWalkSoloRoll.hidden = true;
  btnWalkSoloSkip.hidden = true;
  walkLog(`Je route wordt geblokkeerd door een tegenstander.`, null, solo());
  soloRenderCardActionsPanel(
    `<div class="walk-target-picker-hint">Speel <b>Blinde Vlek</b> om bezette vakjes deze beurt te negeren?</div>` +
    `<div class="action-card-row">` +
      `<button type="button" class="action-card action-card--lg action-card--plain" data-blind="yes"><span class="action-card-name" style="margin-top:22px;">Ja, speel Blinde Vlek</span></button>` +
      `<button type="button" class="action-card action-card--lg action-card--plain" data-blind="no"><span class="action-card-name" style="margin-top:22px;">Nee</span></button>` +
    `</div>`
  );
}
// losse naamfunctie (i.p.v. inline in de listener) zodat multiplayer 'm op de host ook kan
// aanroepen als reactie op een intent van een remote speler — zie mpIntercept in 99-multiplayer.js
function soloResolveBlindOffer(yes){
  if (soloPhase !== 'blind-offer') return;
  if (mpIntercept('blindOffer', { yes })) return;
  soloClearCardActionsPanel();
  if (yes){
    useActionCard(solo(), 'blind', soloDeck);
    soloUsedCardId = 'blind';
    walkLog(`Je speelt <b>Blinde Vlek</b>: bezette vakjes tellen deze beurt niet mee.`, null, solo());
    soloPhase = 'moving';
    soloAdvanceMovePhase();   // rekent met soloBlindLegal: door pionnen heen, maar er niet op eindigen
  } else {
    walkLog(`Doodlopend — geen vervolgstap meer mogelijk.`, null, solo());
    if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
    else soloFinishTurn(false);
  }
}
if (walkCardActionsEl){
  walkCardActionsEl.addEventListener('click', (e) => {
    if (soloPhase !== 'blind-offer') return;
    const btn = e.target.closest('button[data-blind]');
    if (!btn) return;
    soloResolveBlindOffer(btn.dataset.blind === 'yes');
  });
}
// boekt de opdracht op soloTargetKey meteen af i.p.v. te wachten tot het einde van de beurt —
// de beurt stopt er niet meer voor (zie CLAUDE.md), dus met de stappen die overblijven mag je
// gewoon doorlopen. Geeft true terug als dit je 6e opdracht was (de beurt is dan meteen voorbij).
function soloBankCurrentQuest(){
  soloRollEnergyForTurn();   // vangnet: idempotent, zie de toelichting in soloFinishTurn
  const p = solo();
  const label = p.deck[p.nextIdx];
  const key = soloTargetKey;
  p.completed++;
  p.nextIdx++;
  p.doneCells.push(key);
  const div = walkCellDiv(soloGraph, key);
  div.classList.remove('walk-target');
  div.classList.add('walk-done');
  soloBankCountThisTurn++;

  if (soloBankCountThisTurn === 1){
    const rollText = soloMoveText();
    const turnNote = walkActionNote(soloUsedEnergyId) + walkCardNote(soloUsedCardId) + soloDiscardNote(soloDiscardedCardId);
    walkLog(`Beurt ${soloTurn}: <b>${rollText}</b>${walkEnergyNote(soloEnergyRoll, soloEnergyGain, p)}${turnNote} → <span class="hit">${label} ${QUEST_NAMES[label] || ''} voltooid</span> · ${p.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', p);
  } else {
    // zeldzaam: de resterende stappen na de 1e opdracht voerden toevallig ook door deze
    walkLog(`Je loopt meteen door en voltooit ook <span class="hit">${label} ${QUEST_NAMES[label] || ''}</span> — twee opdrachten in één beurt! · ${p.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', p);
  }

  if (p.cards.length < ACTION_CARD_HAND_MAX){
    const drawn = drawActionCard(soloDeck, soloRand);
    if (drawn){
      p.cards.push(drawn);
      walkLog(soloCrystalSecret(p) ? `${p.name} krijgt een kristal.` : `Je krijgt een kristal: <b>${ACTION_CARDS[drawn].name}</b> — ${ACTION_CARDS[drawn].hint}.`, null, p);
      crystalEvent(p, key, 'gain');
      soloRefreshCardVault();
    }
  } else {
    walkLog(mp.active ? `${p.name} zou een kristal krijgen, maar de kluis is al vol.` : `Je zou een kristal krijgen, maar je kluis is al vol.`, null, p);
    crystalEvent(p, key, 'full');
  }

  if (p.completed >= SIM_QUESTS_TO_WIN){
    // eigen beurten van deze speler, niet soloTurn (= alle spelers samen) — anders stond er
    // in het winscherm "in 77 beurten" terwijl de winnaar er zelf maar ±19 had gespeeld
    p.finishTurn = p.myTurn;
    soloRoundFinishers.push(p);
    walkLog(`Je hebt alle ${SIM_QUESTS_TO_WIN} opdrachten voltooid en verlaat het bord — wacht op de rest van deze ronde.`, 'hit', p);
    clearWalkTarget();
    paintWalkPawns(soloGraph, soloPlayers, p.idx);
    return true;
  }
  soloRefreshTarget();   // nieuwe doel meteen op het bord — daar loop je nu evt. mee door
  return false;
}

// beurt afronden nadat er deze beurt al minstens 1x inline gebankt is (soloBankCurrentQuest
// heeft dan al alles gelogd) — géén "onderweg naar X"-regel meer nodig, gewoon opruimen.
function soloEndMoveAlreadyBanked(){
  soloHideStepCounter();
  renderWalkScore(soloPlayers, soloActiveIdx);
  soloContinueLoop();
}

async function soloHandleMoveClick(key){
  const occ = soloOccupied();
  const legal = soloPhase === 'moving' && soloUsedCardId === 'blind'
    ? soloBlindLegal()
    : soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, occ);
  const match = legal.find(l => l.key === key);
  if (!match) return;
  if (mpIntercept('moveClick', { key })) return;
  const p = solo();
  const leaving = walkCellDiv(soloGraph, p.pos);
  leaving.style.setProperty('--pc', p.color);
  leaving.classList.add('walk-trail');
  // door een portaal: je komt uit het andere en loopt met de rest van je worp gewoon door, in elke
  // richting (instappen kost één stap). Gebruikerswens 2026-11: stoppen voelde als verloren stappen.
  if (match.portal !== undefined){
    const entry = key, exit = match.portal;
    const colorIn = Math.max(0, portalColorAt(soloGraph, entry));
    walkCellDiv(soloGraph, entry).style.setProperty('--pc', p.color);
    walkCellDiv(soloGraph, entry).classList.add('walk-trail', 'walk-jump');
    p.pos = exit;
    soloMove.lastDir = -1;
    soloMove.path.push(entry, exit);
    soloMove.viaPortal = true;
    soloMove.stepsLeft--;
    if (p.stats){ p.stats.walkSteps++; p.stats.portalJumps = (p.stats.portalJumps || 0) + 1; }
    const rest = soloMove.stepsLeft;
    walkLog(`Je stapt in het ${PORTAL_NAMES[colorIn]} portaal en komt uit bij het ${PORTAL_NAMES[colorIn ^ 1]}${rest > 0 ? ` — nog ${rest} ${rest === 1 ? 'stap' : 'stappen'}` : ''}.`, null, p);
    // sprong-animatie (zelfde opzet als kruipen, walkPortalPawn in 96-walk.js; gebruikerswens 2026-11:
    // "nu floep je ineens naar de andere kant"). De stand staat al op de uitgang (ook voor Multiplayer);
    // tijdens de animatie fase 'crawling', dus geen klikken of pijltjes.
    const runId = soloRunId;
    soloPhase = 'crawling';
    soloClearClickable();
    if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
    // Multiplayer: de gasten meteen de sprong laten zien (mpPortalJumpFxFromState), niet pas erna
    if (typeof mp !== 'undefined' && mp.active && mp.isHost && typeof mpBroadcastState === 'function') mpBroadcastState();
    await walkPortalPawn(soloGraph, soloPlayers, p.idx, entry, exit, {});
    if (runId !== soloRunId || soloPhase !== 'crawling') return;
    soloPhase = 'moving';
    paintWalkPawns(soloGraph, soloPlayers, p.idx);
    if (typeof mp !== 'undefined' && mp.active && mp.isHost && typeof mpBroadcastState === 'function') setTimeout(mpBroadcastState, 0);
    if (soloMove.stepsLeft <= 0){
      soloClearClickable();
      if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
      else soloFinishTurn(false);
    } else {
      soloAdvanceMovePhase();
    }
    return;
  }
  p.pos = key;
  soloMove.lastDir = match.dir;
  soloMove.stepsLeft--;
  soloMove.path.push(key);
  if (p.stats) p.stats.walkSteps++;
  soloCheckActionCell(p.pos, p, true);
  paintWalkPawns(soloGraph, soloPlayers, p.idx);

  if (key === soloTargetKey){
    const won = soloBankCurrentQuest();
    soloClearClickable();
    if (won){
      soloEndMoveAlreadyBanked();
    } else if (soloMove.stepsLeft <= 0){
      soloStepsDone();
    } else {
      soloAdvanceMovePhase();
    }
  } else if (soloMove.stepsLeft <= 0){
    soloStepsDone();
  } else {
    soloAdvanceMovePhase();
  }
}
// je stappen zijn op: klaar, tenzij je met een schroevendraaier op een rooster staat — kruipen kost
// geen stap, dus dat mag dan nog (zie soloCrawlOfferHtml, knop "Hier stoppen")
function soloStepsDone(){
  if (soloCrawlExits().length){ soloAdvanceMovePhase(); return; }
  soloClearClickable();
  if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
  else soloFinishTurn(false);
}

// welke kaart deze beurt is AFGELEGD i.p.v. gespeeld — zelfde badge-stijl als walkActionNote/
// walkCardNote in 96-walk.js, maar lokaal want dit is een puur-mens-mechaniek (bots leggen nooit af)
function soloDiscardNote(id){
  if (!id || !ACTION_CARDS[id]) return '';
  return ` <span class="action">🗑 ${ACTION_CARDS[id].name} afgelegd</span>`;
}

// ---------- beurt afronden ----------
function soloFinishTurn(banked){
  soloClearClickable();
  soloHideStepCounter();
  // vangnet voor een Noodtransport dat exact op je doel landt: dat pad roept soloFinishTurn()
  // aan zonder ooit langs soloRollDice() te komen, dus zonder dit zou die beurt zijn
  // energiesteen helemaal overslaan.
  soloRollEnergyForTurn();
  const p = solo();
  const { roll } = soloMove;
  const stepsUsed = soloMove.path.length - 1;
  const rollText = soloMoveText();
  // energie-actie en kaartactie zijn losse sloten en kunnen dus allebei tegelijk waar zijn deze
  // beurt — samenvoegen i.p.v. kiezen, anders verdween er stilletjes een van de twee uit de log
  // (zelfde bug als eerder gevonden en gefixt in 96-walk.js)
  const turnNote = walkActionNote(soloUsedEnergyId) + walkCardNote(soloUsedCardId) + soloDiscardNote(soloDiscardedCardId);
  const targetLabel = p.deck[p.nextIdx];

  if (banked){
    p.completed++;
    p.doneCells.push(soloTargetKey);
    clearWalkTarget();
    walkCellDiv(soloGraph, soloTargetKey).classList.add('walk-done');
    const extra = (roll && stepsUsed < roll) ? ` (na ${stepsUsed} van ${roll} stappen — de rest vervalt)` : '';
    walkLog(`Beurt ${soloTurn}: <b>${rollText}</b>${walkEnergyNote(soloEnergyRoll, soloEnergyGain, p)}${turnNote} → <span class="hit">${targetLabel} ${QUEST_NAMES[targetLabel] || ''} voltooid${extra}</span> · ${p.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', p);
    p.nextIdx++;

    if (p.cards.length < ACTION_CARD_HAND_MAX){
      const drawn = drawActionCard(soloDeck, soloRand);
      if (drawn){
        p.cards.push(drawn);
        walkLog(soloCrystalSecret(p) ? `${p.name} krijgt een kristal.` : `Je krijgt een kristal: <b>${ACTION_CARDS[drawn].name}</b> — ${ACTION_CARDS[drawn].hint}.`, null, p);
        crystalEvent(p, soloTargetKey, 'gain');
        soloRefreshCardVault();   // nieuw kristal meteen in de kluis tonen
      }
    } else {
      walkLog(mp.active ? `${p.name} zou een kristal krijgen, maar de kluis is al vol.` : `Je zou een kristal krijgen, maar je kluis is al vol.`, null, p);
      crystalEvent(p, soloTargetKey, 'full');
    }

    if (p.completed >= SIM_QUESTS_TO_WIN){
      p.finishTurn = p.myTurn;   // eigen beurten, zie soloBankCurrentQuest
      soloRoundFinishers.push(p);
      walkLog(`Je hebt alle ${SIM_QUESTS_TO_WIN} opdrachten voltooid en verlaat het bord — wacht op de rest van deze ronde.`, 'hit', p);
      paintWalkPawns(soloGraph, soloPlayers, p.idx);
      renderWalkScore(soloPlayers, soloActiveIdx);
      soloContinueLoop();
      return;
    }
  } else {
    const extra = soloMove.viaCrawl ? ' — door de luchtschacht'
      : soloMove.viaPortal ? ' — door het portaal'
      : (roll && stepsUsed < roll) ? ` — kon maar ${stepsUsed} stappen zetten (doodlopend)` : '';
    walkLog(`Beurt ${soloTurn}: <b>${rollText}</b>${walkEnergyNote(soloEnergyRoll, soloEnergyGain, p)}${turnNote} → onderweg naar ${targetLabel}${extra}`, null, p);
  }
  renderWalkScore(soloPlayers, soloActiveIdx);
  soloContinueLoop();
}

// ---------- JOUW beurt starten (interactief) ----------
function soloBeginHumanTurn(pIdx){
  soloActiveIdx = pIdx;
  soloTurn++;
  // beurtnummer van deze speler zelf (i.p.v. soloTurn, dat over ALLE spelers samen telt —
  // gebruikerswens: de "beurt"-tegel in de statushub moet je eigen beurt tonen, niet die van
  // het hele potje incl. bot-beurten ertussenin).
  statsTurnSnapshot(soloPlayers[pIdx]);   // voortgang/energie bij het begin van de beurt (grafieken)
  soloPlayers[pIdx].myTurn++;
  soloUsedEnergyId = null;
  soloUsedCardId = null;
  soloDiscardedCardId = null;
  soloTargetSwapped = false;
  soloPendingBoost = false;
  soloUsedBoots = false;      // betekent nu: deze beurt al gesprint (kaart of energie)
  soloBootsOptions = [];
  soloPortalOptions = [];
  soloPortalAim = null;
  soloDashSource = null;
  soloDashSteps = 0;
  soloUsedJump = false;
  soloActionCellDrawnThisTurn = false;
  soloBankCountThisTurn = 0;
  soloPendingTwin = false;
  soloPortalSource = null;
  soloMove = null;
  // route van je VORIGE beurt wegvegen zodra de nieuwe begint — anders bleef elke gezette stap
  // van het hele potje zichtbaar staan i.p.v. alleen de zet die je net hebt gezet
  // (gebruikerswens). Blijft dus wel gewoon staan tussen je beurten door (incl. tijdens de
  // bot-beurten ertussenin), en verdwijnt pas zodra je weer zelf gaat lopen.
  walkClearClass('walk-trail');
  walkClearClass('walk-jump');

  const p = solo();
  // --pc één keer per beurt op de hele zijkolom, zodat alle puls-animaties eronder (dobbelknop,
  // Energieactie-/Actiekaarten-vakken) automatisch de kleur van wie aan zet is overnemen —
  // custom properties erven door naar alle kinderen, dus geen losse setProperty per knop nodig.
  if (walkSideStackEl) walkSideStackEl.style.setProperty('--pc', p.color);
  // Energie wordt nu pas gegooid zodra je zelf beweegt (dobbelen, Zwaartekracht-laarzen of
  // Noodtransport) -- niet meer automatisch bij het begin van de beurt (gebruikersverzoek: "de
  // energie komt er pas bij vanaf de eerste keer dat ze dobbelen"). `null` betekent "nog niet
  // gegooid deze beurt"; de actiekeuze hierna gebeurt dus met je BESTAANDE energie van vorige
  // beurten, niet met een bonus die je nog niet hebt gezien. `soloRollEnergyForTurn()` rolt 'm
  // alsnog vlak vóór de beurt eindigt, voor de gevallen die geen "gooi de dobbelstenen"-klik
  // hebben (Zwaartekracht-laarzen, of Noodtransport dat exact op je doel landt).
  soloEnergyRoll = null;
  soloEnergyGain = { gained: 0, wasted: 0 };

  // Vergrendeling: als je vorige beurt geraakt bent, mis je nu zowel je energie- als je
  // kaartactie. soloUsedEnergyId/soloUsedCardId alvast vullen zet beide sloten dicht, dus het
  // actiepaneel en het kaartvenster melden dat vanzelf.
  soloLockedThisTurn = false;
  if (p.lockedNextTurn){
    p.lockedNextTurn = false;
    soloLockedThisTurn = true;
    soloUsedEnergyId = 'locked';
    soloUsedCardId = 'locked';
    walkLog(`Je bent <b>vergrendeld</b>: deze beurt geen energie-actie en geen kristal.`, null, p);
  }

  soloRefreshTarget();
  renderSoloDicePending();
  renderWalkScore(soloPlayers, soloActiveIdx);
  renderSoloMeta();
  paintWalkPawns(soloGraph, soloPlayers, p.idx);

  btnWalkSoloRoll.hidden = true;
  btnWalkSoloSkip.hidden = false;
  syncPulse(btnWalkSoloSkip);
  btnWalkSoloSkip.textContent = 'Dobbelen';
  soloPhase = 'choose-action';
  soloRenderActionPanel();
  soloRefreshCardVault();
}

// ---------- bot-beurt: meteen afgehandeld, geen animatie ----------
// niet-geanimeerde kopie van de bot-logica uit 96-walk.js/simulateOneGame — zelfde regels,
// alleen zonder walkTick()/walkPath()-vertragingen, want de bots hoeven niet op jou te wachten
// en jij niet op hen. Geeft een samenvatting terug (startvakje, worp, gelopen route) zodat
// soloAnimateBotTurn() de beurt daarna zichtbaar kan naspelen als die lobby-optie aan staat.
function soloResolveBotTurn(player){
  soloTurn++;
  statsTurnSnapshot(player);   // voortgang/energie bij het begin van de beurt (grafieken)
  player.myTurn++;   // eigen beurtenteller, net als bij een mens (soloBeginHumanTurn)
  soloActionCellDrawnThisTurn = false;
  const pIdx = player.idx;
  // De hele beurt (keuzes, worp, zet, kristallen, energie, opdrachten) staat in botPlanTurn en
  // botFinishTurn (95-simulate.js), gedeeld met de simulatie en Automatisch. Hier alleen nog het
  // log, de bord-effecten en wat soloAnimateBotTurn nodig heeft om de beurt na te spelen.
  // De bot vertelt niet WELKE opdracht hij heeft of wisselt: die is geheim voor de anderen.
  const ctx = { graph: soloGraph, players: soloPlayers, player, rand: soloRand, deck: soloDeck, queue: player.deck };
  const r = botPlanTurn(ctx);
  const pre = r.pre;
  for (const line of botTurnOpeningLog(player, r, false)) walkLog(line, null, player);
  let portalShot = null;   // voor het naspelen: het schot + hoe de portalen er vóór en na lagen
  if (r.portal){
    portalShot = { path: pre.shot.path, key: pre.shot.key, color: pre.shot.color, from: r.portal.placed.from,
                   before: r.portal.before, after: r.portal.after };
  }
  const preLine = botTurnPreLog(player, r, soloGraph);
  if (preLine) walkLog(preLine, null, player);
  // meteen afgehandeld (geen naspelen): portalen nu tekenen
  if (r.portal && soloBotViewSpeed === null){
    walkPaintPortals(soloGraph);
    walkPortalBurst(soloGraph, pre.shot.key, pre.shot.color, true);
  }
  for (const line of botTurnRollLog(player, r)) walkLog(line, null, player);
  if (r.portalJumps) walkLog(`${player.name} stapt door een portaal.`, null, player);

  botFinishTurn(ctx, r);
  paintWalkPawns(soloGraph, soloPlayers, pIdx);
  if (r.cellReward){
    soloActionCellDrawnThisTurn = true;
    soloShowActionCellReward(player, false, r.cellReward.key, r.cellReward);
  }
  const targetLabel = r.targetLabel, targetKey = r.targetKey;
  if (r.banked.length){
    // meestal 1 opdracht, zelden 2 (de resterende stappen na de 1e voerden toevallig ook door de 2e)
    for (const ev of r.banked) player.doneCells.push(ev.key);
    // één kristal per voltooide opdracht (al getrokken in botFinishTurn), hier alleen de animatie
    for (const ev of r.banked){
      if (ev.drawn) crystalEvent(player, ev.key, 'gain');
      else if (ev.full) crystalEvent(player, ev.key, 'full');
    }
    const chainNote = r.banked.length > 1
      ? ` en meteen ook <span class="hit">${r.banked.slice(1).map(ev => `${ev.label} ${QUEST_NAMES[ev.label] || ''}`).join(', ')}</span>`
      : '';
    walkLog(`Beurt ${soloTurn}: <b>${player.name}</b> voltooit <span class="hit">${targetLabel} ${QUEST_NAMES[targetLabel] || ''}</span>${chainNote} · ${player.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', player);
    if (player.completed >= SIM_QUESTS_TO_WIN){
      player.finishTurn = player.myTurn;   // eigen beurten, zie soloBankCurrentQuest
      soloRoundFinishers.push(player);
      walkLog(`<b>${player.name} heeft alle ${SIM_QUESTS_TO_WIN} opdrachten voltooid</b> en verlaat het bord — wacht op de rest van deze ronde.`, 'hit', player);
    }
  } else {
    walkLog(`Beurt ${soloTurn}: <b>${player.name}</b> onderweg naar ${targetLabel}${r.move.wasBlocked ? ' · liep tegen een bezette route aan' : ''}`, null, player);
  }
  renderWalkScore(soloPlayers, -1);
  return { startPos: r.startPos, d1: r.d1, d2: r.d2, d3: r.d3, roll: r.roll, energyRoll: r.energyRoll,
           targetLabel, targetKey, bank: r.bank,
           // verplaatsing vóór de worp (sprong/sprint) en de gelopen worp, los, voor het naspelen
           prePath: pre && !preIsPortal(pre) ? pre.path : null, preBanked: pre ? pre.bankedCount : 0,
           rollPath: r.rollMove ? r.rollMove.path : null, rollBanked: r.rollMove ? r.rollMove.bankedCount : 0,
           portalShot };
}
// ---------- bot-beurt zichtbaar naspelen (lobby-optie "Beurten van de bots") ----------
// soloResolveBotTurn() heeft de beurt al volledig afgehandeld; dit speelt 'm alleen nog na op
// het bord: bot oplichten in de spelersbalk, doel markeren, dobbelstenen laten rollen, pion
// stap voor stap langs de route. De logregels van die beurt worden pas getoond als de pion is
// aangekomen (anders stond "voltooit 2.x" er al terwijl hij nog liep). Geeft false terug als
// het potje ondertussen gestopt/herstart is (soloRunId veranderd).
let replayScoreBefore = null;   // gezet door soloAdvanceLoop vlak vóór soloResolveBotTurn
async function soloAnimateBotTurn(player, replay, logNodes, runId){
  const sp = WALK_SPEEDS[soloBotViewSpeed] || WALK_SPEEDS[2];
  const alive = () => runId === soloRunId;
  const pIdx = player.idx;
  const finalPos = player.pos;
  // pion tekenen, ook als de bot deze beurt binnenkwam (paintWalkPawns slaat die over)
  const paint = () => {
    paintWalkPawns(soloGraph, soloPlayers, pIdx);
    if (walkIsIn(player)){
      const el = walkCellDiv(soloGraph, player.pos);
      el.style.setProperty('--pawn', player.color);
      el.classList.add('walk-pawn', 'walk-pawn-active');
      walkPaintedPawns.push(el);
    }
  };

  soloPhase = 'bots';
  btnWalkSoloRoll.hidden = true;
  btnWalkSoloSkip.hidden = true;
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  soloHideStepCounter();
  soloRefreshCardVault();

  player.pos = replay.startPos;
  // portaalschot: eerst de portalen zoals ze vóór deze beurt lagen (bij de host liggen ze al op
  // hun nieuwe plek, bij een gast nog niet)
  if (replay.portalShot && soloGraph.portals){
    soloGraph.portals = { cells: replay.portalShot.before.cells.slice(), owner: replay.portalShot.before.owner.slice() };
    walkPaintPortals(soloGraph);
  }
  if (replay.targetKey !== undefined) markWalkTarget(soloGraph, replay.targetLabel, replay.targetKey, player.color);
  renderWalkScore(replayScoreBefore || soloPlayers, pIdx);
  renderWalkMeta({ player, turn: soloTurn });
  paint();

  // pion langs een pad; `bank.limit` is opgeteld (wat de sprint al pakte is al getoond)
  const bank = replay.bank ? { ...replay.bank, shown: 0, limit: 0 } : null;
  const othersOcc = new Set(soloPlayers.filter(q => q !== player && simOnBoard(q)).map(q => q.pos));
  const walkSeg = async (path, special, banked) => {
    if (bank) bank.limit += banked;
    for (let i = 1; i < path.length; i++){
      const leaving = walkCellDiv(soloGraph, player.pos);
      leaving.style.setProperty('--pc', player.color);
      leaving.classList.add('walk-trail');
      if (special) leaving.classList.add('walk-jump');
      const viaPortal = portalIsJump(soloGraph, path[i - 1], path[i]);
      // rooster → rooster: kruipen (losschroeven + lichtje, zie walkCrawlFx in 96-walk.js)
      if (viaPortal && grateIsCrawl(soloGraph, path[i - 1], path[i])){
        await walkCrawlPawn(soloGraph, soloPlayers, player.idx, path[i - 1], path[i], { fast: sp.stepMs < 140, activeIdx: pIdx, atExit: () => { player.pos = path[i]; } });
        if (!alive()) return false;
      } else if (viaPortal){
        // door een portaal: pion draait weg, lichtje naar het andere portaal, pion draait eruit
        await walkPortalPawn(soloGraph, soloPlayers, player.idx, path[i - 1], path[i], { fast: sp.stepMs < 140, activeIdx: pIdx, atExit: () => { player.pos = path[i]; } });
        if (!alive()) return false;
      }
      player.pos = path[i];
      walkAdvanceShownTarget(soloGraph, bank, player.pos, player.color, othersOcc, false);
      paint();
      soloReplayCrystals(replay, player.pos);
      if (!special && !viaPortal) diceProgressStep();
      await walkSleep(sp.stepMs);
      if (!alive()) return false;
    }
    return true;
  };

  // 1. sprong/sprint vóór de worp (Noodtransport of Zwaartekracht-laarzen), of het portaalschot
  if (replay.prePath && !await walkSeg(replay.prePath, true, replay.preBanked)) return false;
  if (replay.portalShot){
    const s = replay.portalShot;
    await walkPortalShotFx(soloGraph, s.path, s.color, s.from, sp.stepMs < 140);
    if (!alive()) return false;
    soloGraph.portals = { cells: s.after.cells.slice(), owner: s.after.owner.slice() };
    walkPaintPortals(soloGraph);
    walkPortalBurst(soloGraph, s.key, s.color, true);
    await walkSleep(Math.min(300, sp.stepMs * 2));
    if (!alive()) return false;
  }
  // 2. dobbelen — of niet, als de sprong/sprint de beurt al afmaakte
  if (replay.roll){
    const shakeSteps = Math.max(1, Math.round(sp.rollMs / 90));
    for (let i = 0; i < shakeSteps; i++){
      renderWalkDice(1 + Math.floor(Math.random()*6), 1 + Math.floor(Math.random()*6),
                     ENERGY_DIE_FACES[Math.floor(Math.random()*ENERGY_DIE_FACES.length)], true);
      await walkSleep(90);
      if (!alive()) return false;
    }
    renderWalkDice(replay.d1, replay.d2, replay.energyRoll, false, replay.d3, replay.roll, { key: `replay|${soloTurn}|${player.idx}|${replay.d1}${replay.d2}${replay.d3}`, spinMs: DICE_SPIN_SHORT_MS });
  } else {
    diceRenderNoRoll(replay.energyRoll);
  }
  await walkSleep(Math.min(500, sp.rollMs) + (replay.roll ? DICE_SPIN_SHORT_MS : 0));
  if (!alive()) return false;
  // 3. de worp lopen
  if (replay.rollPath && !await walkSeg(replay.rollPath, false, replay.rollBanked)) return false;
  if (replay.rollPath) diceProgressDone();
  player.pos = finalPos;
  paint();
  soloReplayCrystals(replay, null);   // wat onderweg niet langskwam alsnog
  for (const n of logNodes) walkLogEl.appendChild(n);
  walkLogEl.scrollTop = walkLogEl.scrollHeight;
  renderWalkScore(soloPlayers, pIdx);
  // even blijven staan zodat je ziet waar hij eindigde, dan pas de volgende speler
  await walkSleep(sp.rollMs);
  return alive();
}

// kristal-gebeurtenissen van een nagespeelde bot-beurt afspelen zodra de pion op dat vakje staat
// (`key` null = alles wat er nog over is). Altijd anoniem: het is nooit jouw pion.
function soloReplayCrystals(replay, key){
  if (!replay.crystals || !replay.crystals.length) return;
  const now = replay.crystals.filter(ev => key === null || ev.key === key);
  if (!now.length) return;
  replay.crystals = replay.crystals.filter(ev => !now.includes(ev));
  for (const ev of now) crystalPlay(ev);
}

// ---------- de ronde-lus: bots meteen (of zichtbaar, zie soloBotViewSpeed), mensen interactief ----------
function soloContinueLoop(){
  soloRoundPos++;
  soloAdvanceLoop();
}
function soloAdvanceLoop(){
  while (soloRoundPos < soloTurnOrder.length){
    const pIdx = soloTurnOrder[soloRoundPos];
    const player = soloPlayers[pIdx];
    if (player.rank){ soloRoundPos++; continue; }
    if (player.isHuman){
      soloBeginHumanTurn(pIdx);
      return;   // wacht op klik-interactie; soloContinueLoop() gaat verder zodra de beurt klaar is
    }
    if (soloBotViewSpeed !== null){
      // zichtbaar naspelen: logregels van deze beurt even achterhouden tot de pion er is, en
      // pas na de animatie verder met de volgende speler (of het einde van de ronde)
      const logStart = walkLogEl.children.length;
      // stand van vóór de beurt (score/energie/kaarten), zodat de spelersbalk tijdens het lopen
      // nog niet vooruitloopt op wat de pion pas bij aankomst haalt. Zelfde indexen als
      // soloPlayers, want renderWalkScore zoekt via walkScoreOrder op index.
      replayScoreBefore = soloPlayers.map(q => ({ ...q, cards: q.cards.slice() }));
      // kristallen die deze bot opraapt pas tonen als de pion er in het naspelen langskomt
      // (try/finally: gaat er iets mis, dan mag dit niet alle latere kristallen blijven vasthouden)
      crystalDeferred = [];
      let replay, deferred;
      try { replay = soloResolveBotTurn(player); }
      finally { deferred = crystalDeferred; crystalDeferred = null; }
      replay.crystals = deferred;
      const logNodes = [...walkLogEl.children].slice(logStart);
      for (const n of logNodes) n.remove();
      // multiplayer-host: dezelfde beurt naar de gasten, die 'm zelf naspelen (99-multiplayer.js)
      if (mp.active && mp.isHost) mpOnBotReplay(player, replay, logNodes);
      soloRoundPos++;
      const runId = soloRunId;
      soloAnimateBotTurn(player, replay, logNodes, runId).then(ok => {
        if (!ok || runId !== soloRunId) return;
        if (soloTurn >= SIM_MAX_TURNS) soloFinishRound();
        else soloAdvanceLoop();
      });
      return;
    }
    soloResolveBotTurn(player);
    soloRoundPos++;
    if (soloTurn >= SIM_MAX_TURNS) break;
  }
  soloFinishRound();
}
function soloFinishRound(){
  if (soloRoundFinishers.length){
    const groups = resolveRoundFinishers(soloRoundFinishers, soloFinished);
    for (const group of groups){
      if (group.length === 1){
        walkLog(`<b>${group[0].name} is binnen als ${walkRankLabel(group[0].rank)}</b>.`, 'hit', group[0]);
      } else {
        const names = group.map(p => p.name).join(' en ');
        walkLog(`<b>${names} delen de ${walkRankLabel(group[0].rank)} plaats</b> — gelijke energie (${group[0].energy}) en evenveel kristallen in de kluis (${group[0].cards.length}).`, 'hit', null);
      }
    }
    soloFinished += soloRoundFinishers.length;
    soloRoundFinishers = [];
    renderWalkScore(soloPlayers, -1);
    if (soloFinished >= soloFinishTarget){
      for (const p of soloPlayers) if (!p.rank) p.rank = soloFinished + 1;
      soloEndGame(false);
      return;
    }
  }
  if (soloTurn >= SIM_MAX_TURNS){ soloEndGame(true); return; }
  soloRoundPos = 0;
  soloAdvanceLoop();
}
