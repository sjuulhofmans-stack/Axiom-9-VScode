// ---------- actiepaneel (begin van de beurt) ----------
function renderEnergySoloButton(id, disabled, reason){
  const act = ENERGY_ACTIONS[id];
  // GEEN title (gebruikerswens 2026-11): die gaf een tekstblokje naast de muis met dezelfde uitleg die
  // al onderin het uitlegvak staat. Alleen voor schermlezers, als aria-label.
  const title = reason ? `${act.name} — ${reason}` : `${act.name} (${act.cost} energie) — ${act.note || act.hint}`;
  // puls per knop, niet op de hele kolom (gebruikerswens) — alleen de acties die je NU echt
  // kunt kiezen knipperen; `disabled` dekt zowel te weinig energie als een geblokkeerde
  // combinatie (bv. boostcellUsed). Doordat deze knoppen zelf verdwijnen zodra je dobbelt of
  // een energie-actie gebruikt (walkSoloActionsEl wordt dan leeggemaakt, zie
  // soloRefreshCardVault), stopt de puls vanzelf mee i.p.v. te blijven hangen op een dan lege
  // container.
  const pulse = !disabled && !soloEnergyActionUsed();
  // Bewust GEEN .action-card hier: dat kaartje is 108px breed en met z'n drieën passen ze niet
  // in de 300px-zijkolom — de derde viel op een tweede rij, en dwong je ze smaller te maken,
  // brak "HERPRIORITERING" middenin het woord af. Als volle-breedte-rij is er ruimte zat voor
  // de naam én de uitleg op één regel.
  // icoonrij (gebruikerswens, ontwerp C): symbool, naam + uitleg, prijs groot rechts. Te weinig
  // energie: in de uitlegregel hoeveel je nog mist
  const short = Math.max(0, act.cost - solo().energy);
  const sub = reason || (short > 0 ? `nog ${short} energie nodig` : act.hint);
  return `<button type="button" class="energy-pick${disabled ? ' is-disabled' : ''}${pulse ? ' walk-pulse-affordable' : ''}" data-energy="${id}"${disabled ? ' disabled' : ''} aria-label="${title}">
    <span class="energy-pick-icon">${id === 'driver' ? crystalDriverSvg('mono') : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ENERGY_ACTION_ICONS[id] || ''}"></path></svg>`}</span>
    <span class="energy-pick-text">
      <b>${act.name}</b>
      <span>${sub}</span>
    </span>
    <span class="energy-pick-price">${act.cost}<svg viewBox="0 0 14 24" aria-hidden="true"><path d="M9.4 .8 1.6 13.4h4.3L4.6 23.2l7.8-13h-4.5z"></path></svg></span>
  </button>`;
}
// symbolen van de energie-acties (lijntekeningen, 24×24): Stuwstoot = dubbele pijl omhoog (extra
// steen = extra vaart), Herprioritering = wisselpijlen, laarzen = sprint rechtdoor, Noodtransport
// = sprong in een boog
const ENERGY_ACTION_ICONS = {
  boost: 'M5 13l7-7 7 7M5 19l7-7 7 7',
  reorder: 'M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  gravity: 'M3 8h6M2 12h7M3 16h6M12 12h9M17 8l4 4-4 4',
  jump: 'M4 18c2.5-9 13.5-9 16 0M16 15.5l4 2.5 1.5-4.5M4 18h3',
  // portaalkanon: twee ovale portalen met een schot ertussen
  portal: 'M6.5 6c2 0 3 2.7 3 6s-1 6-3 6-3-2.7-3-6 1-6 3-6zM17.5 6c2 0 3 2.7 3 6s-1 6-3 6-3-2.7-3-6 1-6 3-6zM9.5 12h5M12.5 10l2 2-2 2',
  // schroevendraaier (gekozen icoon A): handvat linksonder, schacht schuin omhoog
  driver: 'M3.5 17.5l3.5-3.5 3 3-3.5 3.5zM8.5 15.5L18.5 5.5M18.5 5.5l2-2',
};
// De 'choose-action'-fase toont ALLEEN de energie-acties — die moet je immers vóór het dobbelen
// inzetten. De meeste kaarten spelen/afleggen kan pas ná het dobbelen, vóór of tijdens het
// stappen zetten (via het kaartvenster, zie hieronder) — behalve Noodrantsoen/Stuwlading, die
// mogen ook al hier (zie SOLO_PRE_ROLL_CARDS/soloCardBlockReason), maar die tonen we via de
// kaartkluis (#walkCardVault) net als anders, niet in dit energiepaneel.
// ---------- uitlegvak onder de energie-acties ----------
// Toont de uitleg van de actie waar je muis (of toetsenbordfocus) op staat; anders die van de eerste
// actie die je nu kunt kiezen. Bovenin: naam + wat het met je energie doet (of waarom het niet kan).
// De rijen zelf tonen alleen icoon, naam en prijs. `var` (geen let): soloRenderActionPanel kan al
// tijdens het laden lopen, vóór deze regels.
var soloEnergyNotes = {};          // id -> { reason, energy } van de laatste keer tekenen
var soloEnergyNoteDefault = null;  // wat er staat zonder muis erop (null = je kunt niets)
var soloEnergyNoteShown;           // wat er nu staat (om niets opnieuw te zetten als het gelijk is)
function soloEnergyNoteHtml(id){
  if (id === 'rest' && soloEnergyRestNote) return soloEnergyRestNote;
  if (!id || !ENERGY_ACTIONS[id] || !soloEnergyNotes[id]){
    return `<div class="energy-note-head"><b>Te weinig energie</b></div>` +
      `<p>Je kunt deze beurt geen actie betalen. Gooi gewoon: wat de energiesteen geeft, kun je volgende beurt uitgeven.</p>`;
  }
  const act = ENERGY_ACTIONS[id], info = soloEnergyNotes[id];
  const short = act.cost - info.energy;
  const state = info.reason ? `<span class="is-no">${info.reason}</span>`
    : short > 0 ? `<span class="is-no">nog ${short} energie nodig</span>`
    : `<span>${act.cost} energie · houdt ${info.energy - act.cost} over</span>`;
  const text = (typeof RULES_ENERGY_TEXT !== 'undefined' && RULES_ENERGY_TEXT[id]) || act.note || act.hint;
  return `<div class="energy-note-head"><b>${act.name}</b>${state}</div><p>${text}</p>`;
}
function soloEnergyNoteMark(id){
  if (!walkSoloActionsEl) return;
  for (const b of walkSoloActionsEl.querySelectorAll('.is-energy > .energy-pick')){
    const on = b.dataset.energy === id;
    if (b.classList.contains('is-noted') !== on) b.classList.toggle('is-noted', on);
  }
}
function soloEnergyNoteShow(id){
  const box = walkSoloActionsEl && walkSoloActionsEl.querySelector('.energy-note');
  if (!box || id === soloEnergyNoteShown) return;
  soloEnergyNoteShown = id;
  box.innerHTML = soloEnergyNoteHtml(id);
  soloEnergyNoteMark(id);
}
function soloRenderActionPanel(){
  if (!walkSoloActionsEl) return;
  const p = solo();
  // Stuwlading (kaart) kan nu ook al vóór het dobbelen gespeeld zijn — sluit Stuwstoot dan uit,
  // spiegel van de check aan de kaart-kant in soloCardBlockReason (allebei een gratis 3e steen).
  const boostcellUsed = soloUsedCardId === 'boostcell';
  // volgorde oplopend op kosten (gebruikerswens: de goedkoopste actie bovenaan)
  const ids = ['boost', 'reorder', 'gravity', 'portal', 'driver', 'jump'].sort((a, b) => ENERGY_ACTIONS[a].cost - ENERGY_ACTIONS[b].cost);
  // waarom kan een actie nu niet (naast te weinig energie)? Zelfde paren als in de simulatie:
  // Stuwlading/Stuwstoot en de laarzen-kaart/-actie sluiten elkaar uit.
  const blockReason = (id) => {
    // Vergrendeling (soloBeginHumanTurn zet soloUsedEnergyId = 'locked'): deze beurt geen enkele energie-actie
    if (soloLockedThisTurn) return 'je bent vergrendeld';
    if (id === 'boost' && boostcellUsed) return 'je hebt deze beurt al Stuwlading gespeeld';
    if (id === 'gravity' && soloUsedBoots) return 'je hebt deze beurt al gesprint';
    if (id === 'gravity' && !soloDashOptions().length) return 'in geen enkele richting ruimte';
    if (id === 'portal' && soloUsedCardId === 'portalkey') return 'je hebt deze beurt al een portaal geschoten';
    if (id === 'portal' && !soloPortalCannonNow().length) return 'in geen enkele richting ruimte';
    if (id === 'driver' && p.screwdriver) return 'je hebt al een schroevendraaier';
    if (id === 'driver' && !soloHasGrates()) return 'geen roosters op dit bord';
    return undefined;
  };
  const locked = (id) => p.energy < ENERGY_ACTIONS[id].cost || !!blockReason(id);
  const energyBtns = ids.map(id => renderEnergySoloButton(id, locked(id), blockReason(id))).join('');
  // Kun je er geen enkele betalen, zeg dat dan met zoveel woorden — uitgegrijsde rijen
  // zien er anders uit alsof het paneel stuk is. Staat sinds 2026-11 in het uitlegvak (als er
  // geen muis op een actie staat), niet meer als losse regel onder de lijst.
  const allLocked = ids.every(id => locked(id));
  // het uitlegvak (gekozen 2026-11: "staande meter" + "uitlegvak", artifact "Axiom-9 Energie en
  // kluis"): per actie wat er in het vak komt; standaard de eerste die je nu kunt kiezen
  soloEnergyNotes = {};
  for (const id of ids) soloEnergyNotes[id] = { reason: blockReason(id), energy: p.energy };
  soloEnergyNoteDefault = allLocked ? null : ids.find(id => !locked(id));
  // onder elkaar (gebruikerswens: de 2x2-tegels stonden scheef), met het uitlegvak eronder
  walkSoloActionsEl.innerHTML = `<div class="energy-pick-list is-actions is-energy">${energyBtns}</div>` +
    `<div class="energy-note" aria-live="polite">${soloEnergyNoteHtml(soloEnergyNoteDefault)}</div>`;
  soloEnergyNoteShown = soloEnergyNoteDefault;
  soloEnergyNoteMark(soloEnergyNoteDefault);
  // net aangemaakte knoppen beginnen anders allemaal weer bij 0 — zie PULSE_EPOCH hierboven.
  for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
  // 2e "of": alleen zichtbaar zolang je vóór het dobbelen zit én Noodrantsoen/Stuwlading nu
  // speelbaar is (dezelfde bron als de kaartkluis-puls, maar dan specifiek voor dit moment)
  if (walkOrSep2El){
    const preRollPlayable = soloPhase === 'choose-action' &&
      p.cards.some(id => SOLO_PRE_ROLL_CARDS.includes(id) && !soloCardBlockReason(id));
    walkOrSep2El.hidden = !preRollPlayable;
  }
}
if (walkSoloActionsEl){
  walkSoloActionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button.energy-pick');
    if (!btn || btn.disabled || btn.classList.contains('is-disabled')) return;
    // dit paneel toont per fase iets anders: de energie-acties, de laarzen-richtingen of de
    // Herprioritering-keuze
    if (soloPhase === 'choose-action' && btn.dataset.energy) soloUseEnergyAction(btn.dataset.energy);
    else if (soloPhase === 'boots-direction' && btn.dataset.dashDir !== undefined) soloResolveBoots(parseInt(btn.dataset.dashDir, 10));
    else if (soloPhase === 'portal-aim' && btn.dataset.portalDir !== undefined) soloResolvePortalAim(parseInt(btn.dataset.portalDir, 10));
    else if (soloPhase === 'portal-color' && btn.dataset.portalColor !== undefined) soloResolvePortalColor(parseInt(btn.dataset.portalColor, 10));
    else if (soloPhase === 'reorder-peek' && btn.dataset.reorder) soloResolveReorder(btn.dataset.reorder === 'swap');
    else if (soloPhase === 'moving' && btn.dataset.crawl === 'go') soloStartCrawlPick();
    else if (soloPhase === 'moving' && btn.dataset.crawl === 'stop') soloCrawlStop();
    else if (soloPhase === 'crawl-pick' && btn.dataset.crawl === 'cancel') soloCancelCrawlPick();
  });
}

// ---------- energie-acties BLIJVEN STAAN (gebruikerswens 2026-11: "gaan weg als je dobbelt") ----------
// Overal waar het energievak leeg werd (na de worp, tijdens het lopen, beurten van bots, na een keuze)
// komt nu dezelfde lijst terug, uitgegrijsd met de reden ("kies je vóór het dobbelen" / "niet jouw
// beurt") en het uitlegvak eronder; muis op een actie = zijn uitleg, net als vóór de worp. Een echte
// keuze (laarzen-richting, kruipen, portaalkleur …) komt gewoon in de plaats ervan. Eén plek regelt
// het: een MutationObserver vult het vak zodra het leeg raakt, en soloEnergyRestFill() werkt het bij
// als de reden verandert. Herkenbaar aan [data-rest]; in Multiplayer gaat die NIET mee naar de gast
// (mpBroadcastState stuurt dan ''), elke gast vult zijn eigen vak. Tijdens andermans beurt in
// Multiplayer blijft het vak verborgen (.mp-not-my-turn: "X is aan zet").
var soloEnergyRestNote = '';
function soloEnergyRestState(){
  if (!walkSoloActionsEl || !soloPlayers || !soloPlayers.length) return null;
  if (soloPhase === 'idle' || soloPhase === 'game-over' || soloPhase === 'choose-action' || /^opening/.test(soloPhase)) return null;
  const active = solo();
  if (!active) return null;
  const mine = typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game'
    ? !!active && active.idx === mp.myIdx
    : !!active && !!active.isHuman;
  if (!soloPlayers.some(p => p.isHuman)) return null;   // Bots spelen: geen energievak
  return mine
    ? { key: 'own', reason: 'kies je vóór het dobbelen', head: 'Na de worp',
        text: 'Een energie-actie kies je vóór je gooit. Volgende beurt kun je weer kiezen.' }
    : { key: 'other', reason: 'niet jouw beurt', head: 'Niet jouw beurt',
        text: 'Aan het begin van je volgende beurt, vóór je gooit, kun je weer een energie-actie kiezen.' };
}
function soloEnergyRestFill(){
  const st = soloEnergyRestState();
  if (!st) return;
  const el = walkSoloActionsEl;
  const rest = el.firstElementChild && el.firstElementChild.dataset.rest !== undefined ? el.firstElementChild : null;
  if (el.firstChild && !rest) return;                        // er staat een echte keuze
  if (rest && rest.dataset.rest === st.key) return;          // staat er al zo
  const ids = ['boost', 'reorder', 'gravity', 'portal', 'driver', 'jump'].sort((a, b) => ENERGY_ACTIONS[a].cost - ENERGY_ACTIONS[b].cost);
  soloEnergyNotes = {};
  for (const id of ids) soloEnergyNotes[id] = { reason: st.reason, energy: 0 };
  soloEnergyRestNote = `<div class="energy-note-head"><b>${st.head}</b></div><p>${st.text}</p>`;
  soloEnergyNoteDefault = 'rest';
  el.innerHTML = `<div class="energy-rest" data-rest="${st.key}" hidden></div>` +
    `<div class="energy-pick-list is-actions is-energy">${ids.map(id => renderEnergySoloButton(id, true, st.reason)).join('')}</div>` +
    `<div class="energy-note" aria-live="polite">${soloEnergyNoteHtml('rest')}</div>`;
  soloEnergyNoteShown = 'rest';
}
if (walkSoloActionsEl){
  // leeg geraakt → in dezelfde taak (vóór het tekenen) de lijst terug, dus niets knippert
  new MutationObserver(() => { if (!walkSoloActionsEl.firstChild) soloEnergyRestFill(); })
    .observe(walkSoloActionsEl, { childList: true });
}


function soloUnconditionalSwap(){
  const p = solo();
  const cur = p.deck[p.nextIdx];
  const alt = p.deck[p.nextIdx + 1];
  p.deck[p.nextIdx] = alt;
  p.deck[p.nextIdx + 1] = cur;
}

// Beurtvolgorde: energie (vóór het dobbelen, direct ingezet) → dobbelen → kaart spelen/afleggen
// (vóór of tijdens het stappen zetten), hooguit 1 kaart per beurt. Er is dus geen apart moment
// vóór de worp om een kaart te spelen — ook Zwaartekracht-laarzen en Stuwlading niet, die komen
// hieronder gewoon voor in het kaartvenster tijdens het lopen (soloRefreshCardVault).
// Routeert een gespeelde/afgelegde kaart naar de vervolgstap: er is op dit punt altijd al
// gedobbeld (kaarten spelen kan pas ná de worp), dus de bewegingsfase wordt herberekend — bv. na
// Duwstoot verschuift een blokkade, na Stuwlading of Zelf kiezen is er een ander aantal stappen.
function soloAfterCardAction(){
  soloAdvanceMovePhase();
}
function soloDiscardCard(id){
  if (soloCardActionUsed()) return;
  if (mpIntercept('discardCard', { id })) return;
  const p = solo();
  useActionCard(p, id, soloDeck);
  // useActionCard telt elke kaart als "gespeeld" — deze is afgelegd
  if (p.stats){
    p.stats.cardsPlayed--; p.stats.cardsDiscarded++;
    if (p.stats.cardUse && p.stats.cardUse[id]) p.stats.cardUse[id]--;
  }
  soloDiscardedCardId = id;
  walkLog(`Je legt <b>${ACTION_CARDS[id].name}</b> af.`, null, p);
  soloAfterCardAction();
}
