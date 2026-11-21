// ---------- tijdens het lopen: altijd-zichtbare kaartenrij (spelen óf afleggen) ----------
// Alleen Blinde Vlek blijft puur reactief (zie soloOfferBlindSpot): die bied je pas aan op het
// moment dat je route daadwerkelijk geblokkeerd raakt. Al het andere staat gewoon in deze rij —
// de juiste beurtvolgorde is energie (vóór het dobbelen) → dobbelen → kaart spelen/afleggen
// (vóór of tijdens het stappen zetten), dus ook Boots/Stuwlading/Condensator horen pas ná de
// worp aan de beurt. Voor Condensator is dat zelfs de bedoeling: je ziet je energiesteen al
// liggen en beslist dán pas of verdubbelen de moeite waard is.
// Waarom kan deze kaart nu niet gespeeld worden? Geeft de reden terug, of null als hij wel mag.
// Eén bron voor zowel de kluis (hoeveel is er speelbaar) als het venster (waarom niet).
function soloCardBlockReason(id){
  const p = solo();
  if (!p) return 'geen actieve speler';
  // Het moment komt uit ACTION_CARDS[id].when — dezelfde bron als het label bovenin het kristal
  // (CRYSTAL_WHEN), zodat wat erop staat en wat het spel toestaat nooit uit elkaar lopen.
  const when = ACTION_CARDS[id].when;
  // midden in een keuze (richting, doelwit, opdracht, Blinde Vlek, sprongdoel): eerst die afmaken —
  // de kluis staat er nu altijd bij, dus anders stond hier misleidend "pas na het dobbelen"
  if (['boots-direction', 'target-pick', 'die-pick', 'reorder-peek', 'blind-offer', 'jump-target', 'portal-aim', 'portal-color', 'crawl-pick', 'crawling'].includes(soloPhase)) return 'maak eerst je keuze af';
  if (id === 'driver' && p.screwdriver) return 'je hebt al een schroevendraaier';
  if (id === 'driver' && !soloHasGrates()) return 'geen roosters op dit bord';
  // Blinde Vlek is puur reactief: die krijg je vanzelf aangeboden op het moment dat je zet
  // daadwerkelijk op een tegenstander stukloopt (zie soloOfferBlindSpot)
  if (when === 'auto') return 'wordt vanzelf aangeboden zodra je route geblokkeerd raakt';
  if (when === 'pre' && soloPhase !== 'choose-action') return 'alleen vóór het dobbelen';
  if (when !== 'pre' && soloPhase !== 'moving' && !(when === 'any' && soloPhase === 'choose-action')) return 'kan pas nadat je hebt gedobbeld';
  // 'start': na het gooien, maar alleen zolang je nog geen stap hebt gezet (Koerscorrectie,
  // Zelf kiezen en Zonnezeil kijken naar je worp)
  if (when === 'start' && soloMove && soloMove.stepsLeft !== soloMove.roll) return 'je bent al begonnen met lopen';
  if (soloLockedThisTurn) return 'je bent vergrendeld';
  if (soloCardActionUsed()) return 'je hebt deze beurt al een kristal gebruikt';
  // één sprint per beurt: de kaart en de energie-actie Zwaartekracht-laarzen sluiten elkaar uit
  if (id === 'boots' && soloUsedBoots) return 'je hebt deze beurt al gesprint';
  if (id === 'boots' && !soloDashOptions().length) return 'in geen enkele richting ruimte';
  if (soloPlayers.length === 1 && WALK_SOLO_NO_OPPONENT_CARDS.includes(id)) return 'geen tegenstanders in dit potje';
  if (id === 'shove' && !soloShoveTargets().length) return 'geen tegenstander naast je om weg te duwen';
  if (id === 'short' && !soloOthers().length) return 'geen tegenstanders meer over';
  if ((id === 'ration' || id === 'solar' || id === 'leak') && p.energy >= ENERGY_MAX) return 'je energie zit al vol';
  if (id === 'twin' && p.skipEnergyRoll) return 'je energiesteen is deze beurt uitgeschakeld';
  if (id === 'portalkey' && soloUsedEnergyId === 'portal') return 'je hebt deze beurt al een portaal geschoten';
  if (id === 'portalkey' && !soloPortalCannonNow().length) return 'in geen enkele richting ruimte';
  // Stuwlading (kaart) en Stuwstoot (energie) zijn allebei een gratis 3e loopsteen — samen
  // zouden ze een 4e opleveren, dus sluiten ze elkaar uit ook al zitten ze op losse sloten
  // (zelfde regel als in 95-simulate.js/96-walk.js)
  if (id === 'boostcell' && soloUsedEnergyId === 'boost') return 'je hebt deze beurt al Stuwstoot ingezet';
  if (id === 'condenser' && p.condenserPending) return 'er staat al een Condensator klaar';
  // de nieuwe hinder-kaarten hebben allemaal een geldig doelwit nodig
  if (SOLO_TARGET_PICKER_LABELS[id] && !soloTargetPickerTargets(id).length){
    if (id === 'leak') return 'niemand anders heeft energie';
    return 'geen tegenstander om dit op te spelen';
  }
  if (id === 'lockdown' && soloOthers().every(q => q.lockedNextTurn)) return 'iedereen is al vergrendeld';
  if (id === 'outage' && soloOthers().every(q => q.rollPenalty > 0)) return 'iedereen is al onderbroken';
  return null;
}
// afleggen mag met ELKE kaart in de hand (het kaart-slot is het enige dat telt, niet of de
// kaart nu nuttig is) — maar wel pas ná de worp, net als spelen
function soloCanDiscardNow(){ return soloPhase === 'moving' && !soloCardActionUsed(); }

// ---------- de kristalkluis (zijkolom) ----------
// Altijd open zolang er een potje loopt en je meedoet — ook leeg (gestippeld, met uitleg waar je
// een kristal haalt), en ook tijdens de beurt van een ander (dan gedimd). Het tekenen doet
// crystalRenderVault (96c-crystals.js); hier alleen: wiens kluis het is en waarom een kristal nu
// (niet) kan. In multiplayer neemt mpRefreshCardVault (99-multiplayer.js) dit over: daar is "mijn"
// kluis niet per se die van wie aan zet is.
function soloRefreshCardVault(){
  // het 2e "of" hoort alleen bij de keuze vóór het dobbelen (zie soloRenderActionPanel)
  if (walkOrSep2El && soloPhase !== 'choose-action') walkOrSep2El.hidden = true;
  if (soloPhase === 'moving' || soloPhase === 'rolling'){
    // tijdens je zet: het aanbod om te kruipen als je met een schroevendraaier op een rooster staat
    // (zie soloCrawlOfferHtml); anders leeg
    if (walkSoloActionsEl){
      const html = soloCrawlOfferHtml();
      // alleen opnieuw in de DOM als het echt anders is (anders begint de puls telkens opnieuw)
      // geen aanbod: de uitgegrijsde energie-acties (soloEnergyRestFill) mogen blijven staan
      if (!html){ if (walkSoloActionsEl.firstChild && !walkSoloActionsEl.querySelector('[data-rest]')) walkSoloActionsEl.innerHTML = ''; }
      else if (walkSoloActionsEl.dataset.offer !== html || !walkSoloActionsEl.querySelector('.crawl-offer')){
        walkSoloActionsEl.innerHTML = html;
        walkSoloActionsEl.dataset.offer = html;
        for (const el of walkSoloActionsEl.querySelectorAll('.walk-pulse-affordable')) syncPulse(el);
      }
    }
    soloClearCardActionsPanel();
  }
  soloEnergyRestFill();   // reden bijwerken (jouw zet ↔ beurt van een ander); doet niets als het al klopt
  if (!walkCardVaultEl) return;
  // Multiplayer: altijd je eigen kluis (mpRefreshCardVault). Hier viel een gast die een bot-beurt
  // naspeelde anders terug op de vorige speler aan zet — een andere mens, van wie hij de
  // kristallen niet mag zien (null) — en liep de kluis vast (gevonden met de host+gast-test).
  // window.mpGameActive en niet `mp`: deze functie loopt ook al tijdens het laden, vóór
  // 99-multiplayer.js `mp` heeft aangemaakt (dan brak het laden af).
  if (window.mpGameActive){ mpRefreshCardVault(); return; }
  const owner = soloVaultOwner();
  if (!owner || owner.rank || soloPhase === 'idle' || soloPhase === 'game-over'){
    walkCardVaultEl.hidden = true;
    crystalSyncStack();
    return;
  }
  walkCardVaultEl.hidden = false;
  const mine = owner === solo();
  crystalRenderVault(owner.cards, {
    reason: soloCardBlockReason,
    canDiscard: mine && soloCanDiscardNow(),
    idle: mine ? null : 'wacht op je beurt',
    tool: !!owner.screwdriver,
  });
}
// Wiens kluis staat er? Wie aan zet is als dat een mens is; anders (bots aan zet) de enige mens
// aan dit scherm, zodat je eigen kluis gewoon blijft staan. Met meerdere mensen aan één scherm
// en een bot aan zet: niemand (geen idee wiens kluis je dan wilt zien).
function soloVaultOwner(){
  const p = solo();
  if (p && p.isHuman) return p;
  const humans = soloPlayers.filter(q => q.isHuman);
  return humans.length === 1 ? humans[0] : null;
}
function soloVaultCards(){
  if (mp.active && mp.phase === 'in-game'){ const me = mpMe(); return me ? me.cards : []; }
  const o = soloVaultOwner();
  return o ? o.cards : [];
}
function soloVaultIsMyTurn(){
  const p = solo();
  if (!p) return false;
  if (mp.active && mp.phase === 'in-game') return p.peerId === mp.myPeerId;
  return !!p.isHuman;
}
if (btnCardPlay) btnCardPlay.addEventListener('click', () => {
  const id = crystalSelectedId(soloVaultCards());
  if (!id || !soloVaultIsMyTurn() || soloCardBlockReason(id)) return;
  soloPlayCard(id);
});
if (btnCardDiscard) btnCardDiscard.addEventListener('click', () => {
  const id = crystalSelectedId(soloVaultCards());
  if (!id || !soloVaultIsMyTurn() || !soloCanDiscardNow()) return;
  soloDiscardCard(id);
});

// ---------- doelwit kiezen: alle kaarten die een tegenstander aanwijzen ----------
const SOLO_TARGET_PICKER_LABELS = {
  short: 'Kortsluiting', shove: 'Duwstoot', lockdown: 'Vergrendeling', outage: 'Stroomonderbreking',
  leak: 'Energielek',
};
function soloTargetPickerTargets(cardId){
  if (cardId === 'shove') return soloShoveTargets();
  if (cardId === 'leak') return soloOthers().filter(q => q.energy > 0);
  return soloOthers();
}

// wie er nu naast je staat (voor Duwstoot — die kan alleen een AANGRENZENDE tegenstander duwen;
// de richting waarin hij vliegt wordt daarna geloot, zie shoveDestination)
// alleen tegenstanders die naast je staan én die daadwerkelijk ruimte hebben om weg te
// schuiven — iemand die meteen klem zit aanbieden zou je de kaart voor niets laten verspelen
function soloShoveTargets(){
  const me = solo();
  const neigh = new Set(soloGraph.adjKey[me.pos]);
  return soloOthers().filter(p => neigh.has(p.pos) && shoveDestination(soloGraph, soloPlayers, p, soloRand));
}
function soloEnterTargetPicker(cardId){
  const targets = soloTargetPickerTargets(cardId);
  if (!targets.length) return;
  // De kaart is gespeeld zodra je hem kiest: meteen uit de hand (en het kaart-slot van deze
  // beurt is op), niet pas na het kiezen van een doelwit — anders stond hij tijdens het kiezen
  // nog in je kluis en kon je er opnieuw op klikken, terwijl terug niet meer kan
  // (gebruikersmelding). soloResolveTargetCard verbruikt hem daarom niet nog eens.
  useActionCard(solo(), cardId, soloDeck);
  soloUsedCardId = cardId;
  soloPhase = 'target-pick';
  soloHideStepCounter();
  // deze picker kan nu ook MIDDENIN het lopen geopend worden (kaarten spelen kan tijdens je
  // stappen) — dan staan er nog groen-omrande aanklikbare vakjes op het bord van vóór deze klik;
  // die moeten weg zolang de doelwit-kiezer open staat, anders blijft de oude highlight zichtbaar
  // naast de nieuwe knoppenrij
  soloClearClickable();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  const label = SOLO_TARGET_PICKER_LABELS[cardId];
  soloRenderCardActionsPanel(
    `<div class="walk-target-picker-hint">Kies een doelwit voor <b>${label}</b>:</div>` +
    `<div class="action-card-row">` + targets.map(t =>
      `<button type="button" class="action-card action-card--lg action-card--plain" data-target="${t.idx}" style="--card-tint:${t.color}" title="${t.name}">
        <span class="action-card-name" style="margin-top:22px;">${t.name}</span>
        <span class="action-card-hint">${cardId === 'leak' ? `${t.energy} energie` : `${t.completed}/${SIM_QUESTS_TO_WIN} · ${t.energy} energie`}</span>
      </button>`
    ).join('') + `</div>`
  );
  walkCardActionsEl.dataset.pendingCard = cardId;
  soloRefreshCardVault();
  renderWalkScore(soloPlayers, soloActiveIdx);
}
if (walkCardActionsEl){
  walkCardActionsEl.addEventListener('click', (e) => {
    if (soloPhase !== 'target-pick') return;
    const btn = e.target.closest('button[data-target]');
    if (!btn) return;
    soloResolveTargetCard(walkCardActionsEl.dataset.pendingCard, parseInt(btn.dataset.target, 10));
  });
}
function soloResolveTargetCard(cardId, targetIdx){
  if (mpIntercept('resolveTarget', { cardId, targetIdx })) return;
  // de kaart is al verbruikt bij het openen van de kiezer, dus alleen afhandelen zolang die
  // kiezer echt openstaat (geen tweede keer via een dubbele klik of een laat bericht)
  if (soloPhase !== 'target-pick') return;
  soloClearCardActionsPanel();
  const p = solo();
  const victim = soloPlayers[targetIdx];
  if (cardId === 'short'){
    victim.skipEnergyRoll = true;
    walkLog(`Je speelt <b>Kortsluiting</b> op ${victim.name}: die mist zijn eerstvolgende energiesteen.`, null, p);
    soloAfterCardAction();
  } else if (cardId === 'leak'){
    const r = applyEnergyLeak(p, victim);
    walkLog(`Je speelt <b>Energielek</b> op ${victim.name}: je pakt ${r.taken} energie${r.gained < r.taken ? ` (${r.taken - r.gained} viel weg, je zat vol)` : ''} → ${p.energy}.`, null, p);
    soloRenderEnergyOverview();
    renderWalkScore(soloPlayers, soloActiveIdx);
    soloAfterCardAction();
  } else if (cardId === 'shove'){
    // richting wordt geloot, niet gekozen — zelfde berekening als de bot-AI
    const dest = shoveDestination(soloGraph, soloPlayers, victim, soloRand);
    if (dest){
      victim.pos = dest.key;
      const kompas = ['noord', 'oost', 'zuid', 'west'][dest.dir];
      walkLog(`Je speelt <b>Duwstoot</b> op ${victim.name}: die vliegt ${dest.steps} vakje${dest.steps === 1 ? '' : 's'} naar het ${kompas}.`, null, p);
    } else {
      walkLog(`Je speelt <b>Duwstoot</b> op ${victim.name}, maar die zit helemaal klem — er is geen kant op te duwen.`, null, p);
    }
    paintWalkPawns(soloGraph, soloPlayers, p.idx);
    soloAfterCardAction();
  } else if (cardId === 'lockdown'){
    victim.lockedNextTurn = true;
    walkLog(`Je speelt <b>Vergrendeling</b> op ${victim.name}: die mist zijn volgende energie- én kristalactie.`, null, p);
    soloAfterCardAction();
  } else if (cardId === 'outage'){
    victim.rollPenalty = 2;
    walkLog(`Je speelt <b>Stroomonderbreking</b> op ${victim.name}: die gooit 2 stappen minder.`, null, p);
    soloAfterCardAction();
  }
}

// ---------- Zelf kiezen: één loopsteen een waarde naar keuze geven ----------
// Kan alleen direct na de worp (when 'start'). Net als bij een doelwit is het kristal meteen
// verbruikt; daarna kies je in het kristalvak welke steen welke waarde krijgt. In multiplayer gaat
// die keuze als intent 'pickDie' naar de host (MP_INTENT_HANDLERS, 99-multiplayer.js).
function soloDieValues(){
  return soloMove.d3 !== null && soloMove.d3 !== undefined ? [soloMove.d1, soloMove.d2, soloMove.d3] : [soloMove.d1, soloMove.d2];
}
function soloEnterDiePick(){
  const p = solo();
  useActionCard(p, 'pick', soloDeck);
  soloUsedCardId = 'pick';
  soloPhase = 'die-pick';
  soloHideStepCounter();
  soloClearClickable();
  btnWalkSoloSkip.hidden = true;
  btnWalkSoloRoll.hidden = true;
  const vals = soloDieValues();
  soloRenderCardActionsPanel(
    `<div class="walk-target-picker-hint">Kies een steen en de waarde die hij krijgt:</div>` +
    vals.map((v, i) =>
      `<div class="die-pick-row"><span class="die-pick-label">Steen ${i + 1}: <b>${v}</b></span>` +
      [1, 2, 3, 4, 5, 6].map(n =>
        `<button type="button" class="die-pick-btn${n === v ? ' is-current' : ''}" data-die="${i}" data-value="${n}"${n === v ? ' disabled' : ''}>${n}</button>`).join('') +
      `</div>`).join('')
  );
  walkCardActionsEl.dataset.pendingCard = 'pick';
  soloRefreshCardVault();
  renderWalkScore(soloPlayers, soloActiveIdx);
}
if (walkCardActionsEl){
  walkCardActionsEl.addEventListener('click', (e) => {
    if (soloPhase !== 'die-pick') return;
    const btn = e.target.closest('button[data-die]');
    if (!btn || btn.disabled) return;
    soloResolveDiePick(parseInt(btn.dataset.die, 10), parseInt(btn.dataset.value, 10));
  });
}
function soloResolveDiePick(die, value){
  if (mpIntercept('pickDie', { die, value })) return;
  if (soloPhase !== 'die-pick' || !soloMove) return;
  const vals = soloDieValues();
  if (!(die >= 0 && die < vals.length) || !(value >= 1 && value <= 6)) return;
  soloClearCardActionsPanel();
  const p = solo();
  const was = vals[die];
  if (die === 0) soloMove.d1 = value; else if (die === 1) soloMove.d2 = value; else soloMove.d3 = value;
  // een Stroomonderbreking op de worp blijft gelden
  soloMove.roll = Math.max(1, soloMove.d1 + soloMove.d2 + (soloMove.d3 || 0) - (soloMove.penalty || 0));
  soloMove.stepsLeft = soloMove.roll;
  renderWalkDice(soloMove.d1, soloMove.d2, soloEnergyRoll, false, soloMove.d3, soloMove.roll, { key: diceSoloRollKey() + '|pk' + die + value, spinMs: DICE_SPIN_SHORT_MS });
  walkLog(`Je speelt <b>Zelf kiezen</b>: een ${was} wordt een ${value} → <b>${soloMove.roll}</b> stappen.`, null, p);
  soloAfterCardAction();
}

// Meestal aangeroepen tijdens het lopen// Meestal aangeroepen tijdens het lopen (ná de worp), vanuit het kaartvenster — behalve
// Noodrantsoen/Stuwlading, die mogen ook al vóór het dobbelen (zie SOLO_PRE_ROLL_CARDS), en
// worden dan hieronder als allereerste apart afgehandeld.
function soloPlayCard(id){
  if (mpIntercept('playCard', { id })) return;
  // tijdens het kiezen van een doelwit is de vorige kaart al gespeeld (kaart-slot op)
  if (soloPhase === 'target-pick') return;
  const p0 = solo();
  if (soloPhase === 'choose-action' && id === 'boots'){ soloEnterDashDirection('card'); return; }
  if (soloPhase === 'choose-action' && id === 'portalkey'){ soloEnterPortalAim('card'); return; }
  if (soloPhase === 'choose-action' && SOLO_PRE_ROLL_CARDS.includes(id)){
    // Geen soloAfterCardAction() hier — die roept soloAdvanceMovePhase() aan, wat een lopende
    // worp veronderstelt die er in choose-action nog niet is. Effect toepassen, kaart
    // verbruiken, en gewoon in choose-action blijven: je kunt hierna nog een energie-actie
    // kiezen (apart budget) en moet zelf op dobbelen klikken om verder te gaan.
    if (id === 'ration'){
      simGainEnergy(p0, 3);
      useActionCard(p0, 'ration', soloDeck);
      soloUsedCardId = 'ration';
      walkLog(`Je speelt <b>Noodrantsoen</b> vóór het dobbelen: +3 energie → ${p0.energy}.`, null, p0);
    } else if (id === 'boostcell'){
      // Zelfde mechanisme als de energie-actie Stuwstoot (soloUseEnergyAction('boost')): een
      // 3e loopsteen bij de eerstvolgende worp — soloRollDice() rolt 'm al zodra dit aan staat.
      soloPendingBoost = true;
      useActionCard(p0, 'boostcell', soloDeck);
      soloUsedCardId = 'boostcell';
      walkLog(`Je speelt <b>Stuwlading</b> vóór het dobbelen: gratis derde loopsteen bij deze worp.`, null, p0);
    } else if (id === 'twin'){
      // de tweede energiesteen rolt mee met de eerste (soloRollEnergyForTurn)
      soloPendingTwin = true;
      useActionCard(p0, 'twin', soloDeck);
      soloUsedCardId = 'twin';
      walkLog(`Je speelt <b>Dubbele steen</b>: bij deze worp gooi je 2 energiestenen.`, null, p0);
    } else if (id === 'driver'){
      p0.screwdriver = true;
      useActionCard(p0, 'driver', soloDeck);
      soloUsedCardId = 'driver';
      walkLog(`Je speelt het kristal <b>Schroevendraaier</b>: sta je op een rooster, dan kun je erin kruipen.`, null, p0);
    }
    renderSoloDicePending();
    soloRenderActionPanel();
    soloRefreshCardVault();
    renderWalkScore(soloPlayers, soloActiveIdx);
    return;
  }
  if (SOLO_TARGET_PICKER_LABELS[id]){ soloEnterTargetPicker(id); return; }
  if (id === 'pick'){ soloEnterDiePick(); return; }
  const p = solo();
  if (id === 'ration'){
    simGainEnergy(p, 3);
    useActionCard(p, 'ration', soloDeck);
    soloUsedCardId = 'ration';
    walkLog(`Je speelt <b>Noodrantsoen</b>: +3 energie → ${p.energy}.`, null, p);
    soloAfterCardAction();
  } else if (id === 'solar'){
    const g = simGainEnergy(p, solarGain(soloDieValues()));
    useActionCard(p, 'solar', soloDeck);
    soloUsedCardId = 'solar';
    walkLog(`Je speelt <b>Zonnezeil</b>: je laagste steen is een ${solarGain(soloDieValues())} → +${g.gained} energie (${p.energy}).`, null, p);
    soloRenderEnergyOverview();
    renderWalkScore(soloPlayers, soloActiveIdx);
    soloAfterCardAction();
  } else if (id === 'boostcell'){
    // Je hebt al gedobbeld (deze kaart kan pas ná de worp gespeeld worden) — dus geen 3e
    // loopsteen vóóraf zoals bij de energie-actie Stuwstoot, maar een extra worp erbovenop.
    const d3 = simRollD6(soloRand, p);
    soloMove.d3 = (soloMove.d3 || 0) + d3;
    soloMove.roll += d3;
    soloMove.stepsLeft += d3;
    useActionCard(p, 'boostcell', soloDeck);
    soloUsedCardId = 'boostcell';
    renderWalkDice(soloMove.d1, soloMove.d2, soloEnergyRoll, false, soloMove.d3, soloMove.roll, { key: diceSoloRollKey(), spinMs: DICE_SPIN_SHORT_MS });
    walkLog(`Je speelt <b>Stuwlading</b>: gratis derde loopsteen (${d3}) → ${soloMove.stepsLeft} stappen te gaan.`, null, p);
    soloAfterCardAction();
  } else if (id === 'driver'){
    // tijdens je zet: sta je al op een rooster, dan krijg je meteen de knop om te kruipen
    p.screwdriver = true;
    useActionCard(p, 'driver', soloDeck);
    soloUsedCardId = 'driver';
    walkLog(`Je speelt het kristal <b>Schroevendraaier</b>.`, null, p);
    renderWalkScore(soloPlayers, soloActiveIdx);
    soloAfterCardAction();
  } else if (id === 'condenser'){
    // een investering voor je VOLGENDE beurt: die energiesteen telt dan dubbel. Je weet dus
    // nog niet wat je gooit — anders dan bij de andere kaarten is dit een gok vooruit.
    p.condenserPending = true;
    useActionCard(p, 'condenser', soloDeck);
    soloUsedCardId = 'condenser';
    walkLog(`Je speelt <b>Condensator</b>: je energiesteen telt in je volgende beurt dubbel.`, null, p);
    renderWalkScore(soloPlayers, soloActiveIdx);
    soloAfterCardAction();
  } else if (id === 'reroll'){
    const d1 = simRollD6(soloRand, p), d2 = simRollD6(soloRand, p);
    statsRecordRoll(p, d1 + d2);
    const d3 = soloMove.d3 !== null && soloMove.d3 !== undefined ? simRollD6(soloRand, p) : null;
    // een Stroomonderbreking op de oorspronkelijke worp geldt ook voor de nieuwe
    const penalty = soloMove.penalty || 0;
    const roll = Math.max(1, d1 + d2 + (d3 || 0) - penalty);
    useActionCard(p, 'reroll', soloDeck);
    soloUsedCardId = 'reroll';
    // volledig nieuwe zet: het pad begint opnieuw vanaf waar je nu staat
    soloMove = { d1, d2, d3, roll, penalty, stepsLeft: roll, lastDir: -1, path: [p.pos] };
    renderWalkDice(d1, d2, soloEnergyRoll, false, d3, roll, { key: diceSoloRollKey() + '|re' });
    walkLog(`Je speelt <b>Koerscorrectie</b> en gooit opnieuw: <b>${roll}</b> stappen.`, null, p);
    soloAfterCardAction();
  }
}
function soloUseEnergyAction(id){
  if (mpIntercept('useEnergy', { id })) return;
  const p = solo();
  const act = ENERGY_ACTIONS[id];
  // hooguit één energie-actie per beurt, en geen als je vergrendeld bent (soloUsedEnergyId = 'locked')
  if (soloPhase !== 'choose-action' || soloEnergyActionUsed()) return;
  if (p.energy < act.cost) return;
  // de laarzen alleen als er ook echt een richting vrij is (anders betaal je voor niets)
  if (id === 'gravity' && (soloUsedBoots || !soloDashOptions().length)) return;
  if (id === 'driver' && (p.screwdriver || !soloHasGrates())) return;
  p.energy -= act.cost;
  p.actionUses = (p.actionUses || 0) + 1;   // telde vroeger alleen bij bots; nu ook voor het winscherm
  statsUseEnergy(p, id);
  soloRenderEnergyOverview();
  soloUsedEnergyId = id;
  // kosten steeds uit ENERGY_ACTIONS i.p.v. hier een getal te herhalen — dat liep bij eerdere
  // prijswijzigingen juist uit de pas met de werkelijk afgeschreven energie
  if (id === 'boost'){
    soloPendingBoost = true;
    walkLog(`Je zet <b>Stuwstoot</b> in (−${act.cost}): deze beurt met 3 loopstenen.`, null, p);
    soloProceedToRoll();
  } else if (id === 'reorder'){
    soloEnterReorderPeek();
  } else if (id === 'gravity'){
    soloEnterDashDirection('energy');
  } else if (id === 'jump'){
    soloEnterJumpTarget();
  } else if (id === 'portal'){
    soloEnterPortalAim();
  } else if (id === 'driver'){
    // zie ROOSTERS in 95-simulate.js: je houdt hem tot je kruipt; daarna gooi je gewoon
    p.screwdriver = true;
    walkLog(`Je koopt een <b>schroevendraaier</b> (−${act.cost}). Sta je op een rooster, dan kun je erin kruipen.`, null, p);
    renderWalkScore(soloPlayers, soloActiveIdx);
    soloProceedToRoll();
  }
}

