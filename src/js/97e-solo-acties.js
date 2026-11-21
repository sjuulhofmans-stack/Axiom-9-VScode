// ---------- ROOSTERS: kruipen met een schroevendraaier (zie ROOSTERS in 95-simulate.js) ----------
// Sta je tijdens je zet (ook bij de eerste stap) met een schroevendraaier op een rooster, dan staat
// in het energievak de knop "Kruip door de luchtschacht" — je mag ook gewoon verder lopen. Klik je
// erop, dan dimt het bord en lichten de vrije roosters op (schijnwerper, fase 'crawl-pick'); klik er
// één aan en de pion kruipt erheen (fase 'crawling', walkCrawlFx in 96-walk.js). Kost geen stap; je
// loopt daarna met de rest van je worp door, in elke richting. De schroevendraaier is dan op.
let soloCrawlStuck = false;   // geen gewone stap meer mogelijk, alleen nog kruipen of stoppen
function soloHasGrates(){ return !!(soloGraph && soloGraph.grates && soloGraph.grates.length); }
function soloCrawlExits(){
  const p = solo();
  if (!p || !p.screwdriver || !soloHasGrates() || !soloGraph.grateSet.has(p.pos)) return [];
  return grateExits(soloGraph, p.pos, soloOccupied());
}
const SOLO_DRIVER_SVG = crystalDriverSvg('mono');   // gekozen icoon (96c-crystals.js), in de tekstkleur
function soloCrawlOfferHtml(){
  if (soloPhase !== 'moving' || !soloMove || !soloCrawlExits().length) return '';
  const rest = soloMove.stepsLeft;
  return `<div class="crawl-offer">` +
    `<button type="button" class="energy-pick crawl-btn walk-pulse-affordable" data-crawl="go">` +
      `<span class="energy-pick-icon">${SOLO_DRIVER_SVG}</span>` +
      `<span class="energy-pick-text"><b>Kruip door de luchtschacht</b><span>kies een rooster${rest > 0 ? `, daarna nog ${rest} ${rest === 1 ? 'stap' : 'stappen'}` : ''}</span></span>` +
    `</button>` +
    (soloCrawlStuck
      ? `<button type="button" class="energy-pick crawl-btn is-plain" data-crawl="stop"><span class="energy-pick-text"><b>Hier stoppen</b><span>${rest > 0 ? 'je kunt geen gewone stap meer zetten' : 'je stappen zijn op'}</span></span></button>`
      : `<p class="hint crawl-hint">Je staat op een rooster met een schroevendraaier. Of loop gewoon verder.</p>`) +
  `</div>`;
}

function soloStartCrawlPick(){
  if (soloPhase !== 'moving') return;
  const exits = soloCrawlExits();
  if (!exits.length) return;
  if (mpIntercept('crawlStart', {})) return;
  soloPhase = 'crawl-pick';
  soloHideStepCounter();
  soloRefreshCardVault();
  soloMarkClickable(soloGraph, exits);
  walkSoloActionsEl.innerHTML =
    `<div class="crawl-offer"><p class="walk-target-picker-hint">Kies op het bord een <b>rooster</b> om uit te komen.</p>` +
    `<button type="button" class="energy-pick crawl-btn is-plain" data-crawl="cancel"><span class="energy-pick-text"><b>Toch niet</b><span>terug naar je zet</span></span></button></div>`;
}
function soloCancelCrawlPick(){
  if (soloPhase !== 'crawl-pick') return;
  if (mpIntercept('crawlCancel', {})) return;
  soloPhase = 'moving';
  soloAdvanceMovePhase();
}
function soloCrawlStop(){
  if (soloPhase !== 'moving') return;
  if (mpIntercept('crawlStop', {})) return;   // (een gast kent soloCrawlStuck niet; de host checkt hieronder)
  if (!soloCrawlStuck) return;
  soloCrawlStuck = false;
  soloClearClickable();
  soloHideStepCounter();
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
  if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
  else soloFinishTurn(false);
}
async function soloHandleCrawlPick(key){
  if (soloPhase !== 'crawl-pick') return;
  if (!soloCrawlExits().includes(key)) return;
  if (mpIntercept('crawlPick', { key })) return;
  const p = solo(), entry = p.pos, runId = soloRunId;
  soloPhase = 'crawling';
  soloClearClickable();
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
  p.screwdriver = false;
  p.grateUses = (p.grateUses || 0) + 1;
  if (p.stats) p.stats.crawls = (p.stats.crawls || 0) + 1;
  const rest = soloMove.stepsLeft;
  walkLog(`Je schroeft het rooster los en kruipt door de luchtschacht${rest > 0 ? ` — nog ${rest} ${rest === 1 ? 'stap' : 'stappen'}` : ''}.`, null, p);
  renderWalkScore(soloPlayers, soloActiveIdx);
  const leaving = walkCellDiv(soloGraph, entry);
  leaving.style.setProperty('--pc', p.color);
  leaving.classList.add('walk-trail');
  await walkCrawlPawn(soloGraph, soloPlayers, p.idx, entry, key, { atExit: () => { p.pos = key; } });
  if (runId !== soloRunId || soloPhase !== 'crawling') return;
  p.pos = key;
  soloMove.path.push(key);
  soloMove.lastDir = -1;          // uit het rooster mag je alle kanten op
  soloMove.viaCrawl = true;
  soloPhase = 'moving';
  paintWalkPawns(soloGraph, soloPlayers, p.idx);
  if (soloMove.stepsLeft <= 0){
    soloClearClickable();
    if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
    else soloFinishTurn(false);
  } else {
    soloAdvanceMovePhase();
  }
  // in Multiplayer de nieuwe stand meteen naar de gasten (de klik zelf was al eerder verwerkt)
  if (typeof mp !== 'undefined' && mp.active && mp.isHost && typeof mpBroadcastState === 'function') mpBroadcastState();
}

// ---------- Portaalkanon: richting kiezen, dan welke kleur ----------
// Energie-actie (zie PORTALEN in 95-simulate.js). Eerst een richting (knop, of klik op het vakje
// waar het portaal landt), dan welke van de vier kleuren. De keuzes staan in het actiepaneel, dat in
// multiplayer meegaat naar de gast (ownerUi.actionsHtml); de klikken lopen via mpIntercept.
function soloPortalCannonNow(){
  return soloGraph && soloGraph.portals ? portalCannonOptions(soloGraph, solo().pos, soloOccupied()) : [];
}
const SOLO_DIR_NAMES = ['Noord', 'Oost', 'Zuid', 'West'];
// source: 'energy' (Portaalkanon, al betaald) of 'card' (Portaalsleutel, wordt hier verbruikt)
function soloEnterPortalAim(source = 'energy'){
  const p = solo();
  if (source === 'card'){
    useActionCard(p, 'portalkey', soloDeck);
    soloUsedCardId = 'portalkey';
  }
  soloPortalSource = source;
  soloPortalOptions = soloPortalCannonNow();
  soloPortalAim = null;
  soloPhase = 'portal-aim';
  soloHideStepCounter();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  soloRefreshCardVault();
  soloMarkClickable(soloGraph, soloPortalOptions.map(o => o.key));
  walkLog(source === 'card'
    ? `Je speelt de <b>Portaalsleutel</b> — kies een richting, op het bord of hieronder.`
    : `Je zet het <b>Portaalkanon</b> in (−${ENERGY_ACTIONS.portal.cost}) — kies een richting, op het bord of hieronder.`, null, p);
  walkSoloActionsEl.innerHTML =
    `<p class="hint energy-pick-head">Waar schiet je het <b>portaal</b> heen?</p>` +
    `<div class="energy-pick-list is-grid">` + soloPortalOptions.map(o =>
      `<button type="button" class="energy-pick walk-pulse-affordable" data-portal-dir="${o.dir}">
        <span class="energy-pick-cost">${o.path.length - 1}</span>
        <span class="energy-pick-text"><b>${SOLO_DIR_NAMES[o.dir]}</b><span>${o.path.length - 1} vakjes ver</span></span>
      </button>`).join('') +
    `</div>`;
  for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
}
function soloHandlePortalAimClick(key){
  const opt = soloPortalOptions.find(o => o.key === key);
  if (opt) soloResolvePortalAim(opt.dir);
}
// "Blauw", "Rood", "Groen", "Geel"
function soloPortalName(color){
  const n = PORTAL_NAMES[color].replace(/e$/, '');
  return n[0].toUpperCase() + n.slice(1);
}
// wie legde dit portaal? (voor de kleurkeuze: verplaats je je eigen, dat van een ander, of een nieuw)
function soloPortalOwnerText(color){
  const owner = soloGraph.portals.owner[color];
  if (owner < 0) return 'ligt er sinds de start';
  if (owner === solo().idx) return 'heb jij gelegd';
  const q = soloPlayers[owner];
  return q ? `gelegd door ${q.name}` : 'gelegd door een ander';
}
function soloResolvePortalAim(dir){
  if (soloPhase !== 'portal-aim') return;
  const opt = soloPortalOptions.find(o => o.dir === dir);
  if (!opt) return;
  if (mpIntercept('portalAim', { dir })) return;
  soloClearClickable();
  soloPortalAim = opt;
  soloPhase = 'portal-color';
  walkSoloActionsEl.innerHTML =
    `<p class="hint energy-pick-head">Welk portaal verplaats je naar het <b>${SOLO_DIR_NAMES[dir].toLowerCase()}en</b>?</p>` +
    `<div class="energy-pick-list is-grid">` + PORTAL_NAMES.map((n, c) =>
      `<button type="button" class="energy-pick walk-pulse-affordable portal-pick ${PORTAL_CLASSES[c]}" data-portal-color="${c}" title="${soloPortalName(c)} portaal: gaat naar het ${PORTAL_NAMES[c ^ 1]}">
        <span class="energy-pick-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c3.2 0 5 3.8 5 8.5s-1.8 8.5-5 8.5-5-3.8-5-8.5 1.8-8.5 5-8.5zM12 8.5c1.2 0 2 1.6 2 3.5s-.8 3.5-2 3.5-2-1.6-2-3.5.8-3.5 2-3.5z" fill="currentColor" fill-opacity=".25"></path></svg></span>
        <span class="energy-pick-text"><b>${soloPortalName(c)}</b><span>${soloPortalOwnerText(c)}</span></span>
      </button>`).join('') +
    `</div>`;
  for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
}
function soloResolvePortalColor(color){
  if (soloPhase !== 'portal-color' || !soloPortalAim || !Number.isInteger(color) || color < 0 || color >= PORTAL_COUNT) return;
  if (mpIntercept('portalColor', { color })) return;
  const p = solo(), shot = soloPortalAim;
  const placed = portalPlace(soloGraph, shot.key, color, p.idx);
  soloPortalAim = null;
  soloPortalOptions = [];
  if (p.stats) p.stats.portalShots = (p.stats.portalShots || 0) + 1;
  walkLog(`Je schiet het ${PORTAL_NAMES[color]} portaal naar het ${SOLO_DIR_NAMES[shot.dir].toLowerCase()}en${placed.stolen ? ' — dat lag er van een ander' : ''}.`, null, p);
  // het schot is puur beeld: de stand loopt meteen door naar de worp (in multiplayer verwerkt de
  // host dit binnen het intent, een wachtende Promise zou daar buiten mpIntercept vallen)
  const graph = soloGraph;
  walkPortalShotFx(graph, shot.path, color, placed.from, false).then(() => {
    if (graph !== soloGraph) return;
    walkPaintPortals(graph);
    walkPortalBurst(graph, shot.key, color, true);
  });
  if (soloPortalSource === 'card'){
    // kristal-slot gebruikt, energie-slot nog vrij: terug naar de keuze vóór de worp (net als de laarzen)
    soloPhase = 'choose-action';
    btnWalkSoloSkip.hidden = false;
    syncPulse(btnWalkSoloSkip);
    soloRenderActionPanel();
    soloRefreshCardVault();
    renderSoloDicePending();
    renderWalkScore(soloPlayers, soloActiveIdx);
  } else {
    soloProceedToRoll();
  }
}

// ---------- actiekaartvakje (gang): loop je erover, dan trek je een beloningskaart ----------
// Net als een opdracht, maar onderbreekt de zet niet (alleen soloTargetKey doet dat) en hooguit
// 1x per beurt (soloActionCellDrawnThisTurn), ook als je onderweg meerdere van deze vakjes
// passeert. `soloGrantActionCellReward` gaat er blind van uit dat de aanroeper al vastgesteld
// heeft dat er een actiekaartvakje geraakt is — alleen het "al gehad deze beurt"-slot wordt hier
// nog getoetst. `soloCheckActionCell` is de per-stap variant (mens): checkt zelf één cel.
// `key` = het kristalvakje zelf: daar komt het kristal in de animatie vandaan (crystalEvent).
function soloGrantActionCellReward(player, isHuman, key){
  if (soloActionCellDrawnThisTurn) return;
  soloActionCellDrawnThisTurn = true;
  soloShowActionCellReward(player, isHuman, key, drawActionCellReward(player, soloDeck, soloRand));
}
// log + animatie voor een al getrokken kristalvakje-beloning (bots: getrokken in botFinishTurn)
function soloShowActionCellReward(player, isHuman, key, reward){
  if (reward.drawn){
    const name = soloCrystalSecret(player) ? '' : `: <b>${ACTION_CARDS[reward.drawn].name}</b> — ${ACTION_CARDS[reward.drawn].hint}`;
    walkLog(isHuman && !mp.active
      ? `Je loopt over een kristalvakje en raapt een kristal op${name}.`
      : `${player.name} loopt over een kristalvakje en raapt een kristal op${name}.`, null, player);
    crystalEvent(player, key, 'gain');
    if (isHuman) soloRefreshCardVault();
  } else if (reward.handFull){
    walkLog(isHuman && !mp.active ? `Je loopt over een kristalvakje, maar je kluis is al vol.` : `${player.name} loopt over een kristalvakje, maar de kluis is al vol.`, null, player);
    crystalEvent(player, key, 'full');
  }
}
function soloCheckActionCell(key, player, isHuman){
  if (soloActionCellDrawnThisTurn || !soloGraph.actionCells.has(key)) return;
  soloGrantActionCellReward(player, isHuman, key);
}
// Mag de naam van een opgeraapt kristal in het log? Niet bij een bot (je tegenstander) en niet in
// multiplayer: het log gaat daar naar iedereen, ook "Je ..."-regels van een andere speler. Wat je
// zelf opraapt zie je toch al groot binnenvliegen in je kluis.
function soloCrystalSecret(player){
  return !player.isHuman || mp.active;
}

// ---------- Zwaartekracht-laarzen: eerst rechtdoor, dan gooien ----------
// Energie-actie (5) of de gratis actiekaart — allebei vóór de worp, hooguit één sprint per
// beurt. Kies een richting (knop, of klik op het eindvakje op het bord): je schiet rechtdoor
// tot een muur, een andere pion of GRAVITY_DASH_STEPS vakjes. Kom je op je opdracht, dan telt
// die meteen en stop je daar (walkGravityDash). Daarna gooi je gewoon vanaf je nieuwe plek. De keuze staat in het
// actiepaneel (walkSoloActionsEl) en niet in het kaart-vak, want alleen dat paneel gaat in
// multiplayer mee naar de gast (ownerUi.actionsHtml in 99-multiplayer.js).
function soloTargetsRow(){
  const p = solo();
  return p.deck.slice(p.nextIdx).map(l => soloGraph.questCells[l]);
}
function soloDashOptions(){
  return gravityDashOptions(soloGraph, solo().pos, soloOccupied(), soloTargetsRow());
}
let soloDashSource = null;   // 'card' | 'energy' — waarmee de sprint van deze beurt betaald is
let soloDashSteps = 0;       // hoeveel vakjes de sprint van deze beurt opleverde (voor de logregel)
function soloEnterDashDirection(source){
  const options = soloDashOptions();
  const p = solo();
  if (!options.length){
    walkLog(`<b>Zwaartekracht-laarzen</b>: in geen enkele richting is ruimte vanaf hier.`, null, p);
    return;
  }
  // kaart: verbruikt bij het spelen, niet pas bij het kiezen — anders kon je 'm ondertussen nog
  // een keer openen. Energie: al afgeschreven door soloUseEnergyAction().
  if (source === 'card'){
    useActionCard(p, 'boots', soloDeck);
    soloUsedCardId = 'boots';
  }
  soloDashSource = source;
  soloUsedBoots = true;
  soloBootsOptions = options;
  soloPhase = 'boots-direction';
  soloHideStepCounter();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  soloRefreshCardVault();
  soloMarkClickable(soloGraph, options.map(o => o.key));
  walkLog(`Je zet <b>Zwaartekracht-laarzen</b> in${source === 'card' ? ' (kristal)' : ` (−${ENERGY_ACTIONS.gravity.cost})`} — kies een richting, op het bord of hieronder.`, null, p);
  const names = ['Noord', 'Oost', 'Zuid', 'West'];
  walkSoloActionsEl.innerHTML =
    `<p class="hint energy-pick-head">Kies je richting voor <b>Zwaartekracht-laarzen</b>:</p>` +
    `<div class="energy-pick-list is-grid">` + options.map(o =>
      `<button type="button" class="energy-pick walk-pulse-affordable" data-dash-dir="${o.dir}">
        <span class="energy-pick-cost">${o.path.length - 1}</span>
        <span class="energy-pick-text"><b>${names[o.dir]}</b><span>${o.path.length - 1} vakjes${o.wasBlocked ? ' tot een pion' : ''}${o.bankedCount ? ' — pakt je opdracht!' : ''}</span></span>
      </button>`).join('') +
    `</div>`;
  for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
}
// klik op een omrand eindvakje op het bord = die richting kiezen
function soloHandleDashCellClick(key){
  const opt = soloBootsOptions.find(o => o.key === key);
  if (opt) soloResolveBoots(opt.dir);
}
function soloResolveBoots(dir){
  if (soloPhase !== 'boots-direction') return;
  const opt = soloBootsOptions.find(o => o.dir === dir);
  if (!opt) return;
  if (mpIntercept('resolveBoots', { dir })) return;
  soloClearClickable();
  walkSoloActionsEl.innerHTML = '';
  const p = solo();
  const namen = ['noorden', 'oosten', 'zuiden', 'westen'];
  soloDashSteps = opt.path.length - 1;
  if (p.stats) p.stats.dashSteps += soloDashSteps;
  // soloBankCurrentQuest() leest soloMove voor zijn logregel — dus een "zet" van 0 worp
  soloMove = { d1: 0, d2: 0, d3: null, roll: 0, stepsLeft: 0, lastDir: -1, path: [p.pos], dash: true };
  walkLog(`<b>Zwaartekracht-laarzen</b>: ${soloDashSteps} vakjes rechtdoor naar het ${namen[dir]}.`, null, p);
  let won = false;
  for (let i = 1; i < opt.path.length; i++){
    const leaving = walkCellDiv(soloGraph, p.pos);
    leaving.style.setProperty('--pc', p.color);
    leaving.classList.add('walk-trail', 'walk-jump');
    p.pos = opt.path[i];
    soloMove.path.push(p.pos);
    soloCheckActionCell(p.pos, p, true);
    // over je opdracht: telt meteen, en je schiet gewoon door (soloTargetKey schuift mee)
    if (!won && p.pos === soloTargetKey) won = soloBankCurrentQuest();
  }
  paintWalkPawns(soloGraph, soloPlayers, p.idx);
  if (won){ soloEndMoveAlreadyBanked(); return; }   // 6e opdracht: binnen, niets meer te gooien
  if (soloDashSource === 'card'){
    // kaart-slot gebruikt, energie-slot nog vrij: terug naar de keuze vóór de worp
    soloPhase = 'choose-action';
    btnWalkSoloSkip.hidden = false;
    syncPulse(btnWalkSoloSkip);
    soloRenderActionPanel();
    soloRefreshCardVault();
    renderSoloDicePending();
  } else {
    soloProceedToRoll();
  }
  renderWalkScore(soloPlayers, soloActiveIdx);
}

// ---------- Herprioritering: eerst kijken, dan kiezen ----------
// Je hebt al betaald; nu zie je je volgende opdrachtkaart naast je huidige, met hoe ver ze
// lopen, en kies je welke je eerst doet.
function soloEnterReorderPeek(){
  const p = solo();
  const cur = p.deck[p.nextIdx], alt = p.deck[p.nextIdx + 1];
  const stamp = simBfsDistances(soloGraph, p.pos);
  const dCur = simDistLookup(stamp, soloGraph.questCells[cur]);
  const dAlt = simDistLookup(stamp, soloGraph.questCells[alt]);
  soloPhase = 'reorder-peek';
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  soloRefreshCardVault();
  walkLog(`Je zet <b>Herprioritering</b> in (−${ENERGY_ACTIONS.reorder.cost}) en bekijkt je volgende opdracht.`, null, p);
  const row = (label, d, choice, verb) =>
    `<button type="button" class="energy-pick walk-pulse-affordable" data-reorder="${choice}">
      <span class="energy-pick-cost">${d}</span>
      <span class="energy-pick-text"><b>${verb} ${QUEST_NAMES[label] || label}</b><span>${d} vakjes lopen vanaf hier</span></span>
    </button>`;
  walkSoloActionsEl.innerHTML =
    `<p class="hint energy-pick-head">Welke opdracht doe je eerst?</p>` +
    `<div class="energy-pick-list">` +
      row(cur, dCur, 'keep', 'Houd') +
      row(alt, dAlt, 'swap', 'Wissel naar') +
    `</div>`;
  for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
}
function soloResolveReorder(swap){
  if (soloPhase !== 'reorder-peek') return;
  if (mpIntercept('reorderChoice', { swap })) return;
  const p = solo();
  if (!swap){
    walkLog(`Je houdt <b>${QUEST_NAMES[p.deck[p.nextIdx]] || p.deck[p.nextIdx]}</b> als eerstvolgende opdracht.`, null, p);
  } else {
    soloUnconditionalSwap();
    soloTargetSwapped = true;
    soloRefreshTarget();
    walkLog(`Je haalt <b>${QUEST_NAMES[p.deck[p.nextIdx]] || p.deck[p.nextIdx]}</b> naar voren.`, null, p);
  }
  soloProceedToRoll();
}

// de logregel-omschrijving van je zet deze beurt: sprint/sprong + worp
function soloMoveText(){
  const parts = [];
  if (soloDashSteps) parts.push(`🥾 ${soloDashSteps} vakjes rechtdoor`);
  if (soloUsedJump) parts.push(`⚡ Noodtransport`);
  if (soloMove && soloMove.roll) parts.push(walkRollText(soloMove.d1, soloMove.d2, soloMove.d3, soloMove.roll));
  return parts.join(' + ') || '—';
}

// ---------- Noodtransport: doel kiezen ----------
function soloEnterJumpTarget(){
  soloPhase = 'jump-target';
  walkSoloActionsEl.innerHTML = '';
  soloHideStepCounter();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  // true = niet door een portaal: Noodtransport negeert portalen (net als de bot, resolveEnergyJump)
  const stamp = simBfsDistances(soloGraph, solo().pos, true);
  const occ = soloOccupied();
  const keys = [];
  for (let k = 0; k < soloGraph.N; k++){
    if (k === solo().pos || occ.has(k)) continue;
    const d = simDistLookup(stamp, k);
    if (d >= 0 && d <= ENERGY_JUMP_RANGE) keys.push(k);
  }
  soloMarkClickable(soloGraph, keys);
  walkLog(`<b>Noodtransport</b> ingezet — klik een groen omrand vakje binnen bereik (tot ${ENERGY_JUMP_RANGE} vakjes vrij) om erheen te springen.`, null, solo());
}
function soloHandleJumpClick(key){
  if (mpIntercept('jumpClick', { key })) return;
  soloClearClickable();
  soloUsedJump = true;
  const p = solo();
  const fromEl = walkCellDiv(soloGraph, p.pos);
  fromEl.style.setProperty('--pc', p.color);
  fromEl.classList.add('walk-trail', 'walk-jump');
  p.pos = key;
  const toEl = walkCellDiv(soloGraph, key);
  toEl.style.setProperty('--pc', p.color);
  toEl.classList.add('walk-trail', 'walk-jump');
  soloCheckActionCell(p.pos, p, true);
  paintWalkPawns(soloGraph, soloPlayers, p.idx);

  if (key === soloTargetKey){
    soloMove = { d1: 0, d2: 0, d3: null, roll: 0, stepsLeft: 0, lastDir: -1, path: [key] };
    soloFinishTurn(true);
  } else {
    walkLog(`Je springt met <b>Noodtransport</b> naar een nieuwe plek — niet op je doel, dus je gooit gewoon door vanaf hier.`, null, p);
    soloProceedToRoll();
  }
}

