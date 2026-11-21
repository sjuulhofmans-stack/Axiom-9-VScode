// ---------- bord: welke vakjes zijn nu aanklikbaar ----------
let soloClickableTimer = null;
function soloClearClickable(){
  clearTimeout(soloClickableTimer);
  soloClickableTimer = null;
  if (!walkBoardEl) return;
  for (const el of walkBoardEl.querySelectorAll('.walk-clickable')){
    el.classList.remove('walk-clickable');
    delete el.dataset.key;
  }
  if (walkBoardEl.classList.contains('is-grate-pick')) walkBoardEl.classList.remove('is-grate-pick');
}
// Draaien de stenen van een verse worp nog uit, dan pas omranden zodra ze stilliggen (diceBusyMs,
// 96d-dice.js) — gebruikersmelding: je kon al lopen terwijl de dobbelanimatie nog bezig was.
function soloMarkClickable(graph, keys){
  soloClearClickable();
  const wait = diceBusyMs();
  if (wait > 0){ soloClickableTimer = setTimeout(() => soloMarkClickable(graph, keys), wait + 20); return; }
  for (const k of keys){
    const el = walkCellDiv(graph, k);
    el.classList.add('walk-clickable');
    el.dataset.key = k;
  }
  // uitgang kiezen bij het kruipen: schijnwerper op de vrije roosters (ook bij een gast, die de fase
  // uit de stand van de host krijgt)
  if (soloPhase === 'crawl-pick' && walkBoardEl) walkBoardEl.classList.add('is-grate-pick');
}

if (walkBoardEl){
  walkBoardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.walk-clickable');
    if (!el) return;
    const key = parseInt(el.dataset.key, 10);
    if (soloPhase === 'moving') soloHandleMoveClick(key);
    else if (soloPhase === 'jump-target') soloHandleJumpClick(key);
    else if (soloPhase === 'boots-direction') soloHandleDashCellClick(key);
    else if (soloPhase === 'portal-aim') soloHandlePortalAimClick(key);
    else if (soloPhase === 'crawl-pick') soloHandleCrawlPick(key);
    else if (soloPhase === 'opening-pick') soloOpeningPick(key);
  });
}

// welke vervolgstappen mag je zetten vanaf `pos`, gegeven de richting van je vorige stap
// (-1 = eerste stap van de beurt, geen beperking) — zelfde geen-U-turn-regel als resolveMove().
// `occupied` sluit vakjes uit waar een andere nog-meespelende speler op staat (blokkeren).
// Een portaal naast je is gewoon een klikbaar vakje; `portal` = waar je dan uitkomt (daarna loop je
// door, zie PORTALEN in 95-simulate.js). Bezet de uitgang of staat er een pion op een portaal,
// dan werkt het paar niet en is het een gewoon vakje.
function soloLegalNextCells(graph, pos, lastDir, occupied){
  const neigh = graph.adjKey[pos], dirs = graph.adjDir[pos];
  const out = [];
  for (let j = 0; j < neigh.length; j++){
    const d = dirs[j];
    if (lastDir !== -1 && d === (lastDir + 2) % 4) continue;
    if (occupied && occupied.has(neigh[j])) continue;
    const exit = graph.portals ? portalExitFor(graph, neigh[j], soloOccupied()) : -1;
    out.push(exit >= 0 ? { key: neigh[j], dir: d, portal: exit } : { key: neigh[j], dir: d });
  }
  return out;
}

// ---------- score/meta ----------
function renderSoloMeta(stepsLeft){
  renderWalkMeta({ player: solo(), turn: soloTurn, stepsLeft });
  soloRenderEnergyOverview();
  soloRenderStatusExtras();
}
// live tussenstand tijdens het spelen — NIET hetzelfde als p.rank (dat is de echte, definitieve
// eindstand die pas gezet wordt zodra iemand binnen is, zie stopSoloGame-omgeving verderop).
// Hergebruikt walkOrderPlayers() (96-walk.js), dezelfde sortering als de eindklassering.
function soloLiveRank(){
  const p = soloViewer();
  if (!p) return null;
  return walkOrderPlayers(soloPlayers).findIndex(q => q.idx === p.idx) + 1;
}
// Missiestrook bovenin de linkerkolom (gekozen ontwerp D uit 4, sinds 2026-10; vervangt de 3 tegels
// én de opdrachtkaart, die is voor de fysieke versie van het spel): bovenaan Beurt en Stand,
// daaronder 6 zeshoekjes aan een lijn (voltooid = groen met vinkje, de volgende in de kleur van je
// actieve opdracht) en "Opdrachten voltooid x / 6". Staat in #walkStatTiles (zelfde plek, zelfde
// moment); .walk-info-panel.is-mission verbergt dan de opdrachtkaart en #walkMeta/#walkScoreActive.
// Hangt aan renderSoloMeta zodat hij overal meeloopt waar de rest van je beurtinfo ook al opnieuw
// getekend wordt. Alleen opnieuw in de DOM als er echt iets veranderd is (zie Prestatie in CLAUDE.md).
const walkInfoPanelEl = walkStatTilesEl ? walkStatTilesEl.closest('.walk-info-panel') : null;
const SOLO_MISSION_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>';
function soloMissionHtml(p){
  const goal = SIM_QUESTS_TO_WIN;
  const done = Math.min(goal, p.completed);
  // geen pulserend "actief" vakje meer zodra je klaar bent of het potje voorbij is
  const current = (p.rank || soloPhase === 'game-over') ? null : p.deck[p.nextIdx];
  const rank = p.rank || soloLiveRank();
  // het actieve vakje (de opdracht waar je nu mee bezig bent) is groen, net als de voltooide, en
  // pulst als een sonar (gebruikerswens: niet in de kamerkleur). De ringen zitten op .mission-slot,
  // want de zeshoek zelf knipt alles buiten zijn vorm weg (clip-path).
  const hexes = Array.from({ length: goal }, (_, i) => {
    const cls = i < done ? ' is-on' : (i === done && current ? ' is-next' : '');
    return `<span class="mission-slot${cls}"><span class="mission-hex">${i < done ? SOLO_MISSION_CHECK : `<b>${i + 1}</b>`}</span></span>`;
  }).join('');
  // groene lijn van het eerste tot het laatst voltooide zeshoekje (middens liggen op (i+½)/6)
  const lineW = done > 1 ? `${((done - 1) / goal) * 100}%` : '0%';
  // volgorde (gebruikerswens): Beurt/Stand → kopje → de 6 zeshoekjes; geen los "x / 6"-getal meer.
  // Het kopje noemt de opdracht waar je mee bezig bent (= het oplichtende vakje): "Opdrachten
  // voltooid" boven een oplichtende 1 las als "1 voltooid" (gebruikersmelding).
  // na afloop (p.rank, of het potje is voorbij) geen "Bezig met …" meer; wie niet alle 6 haalde
  // krijgt het echte aantal (vroeger stond er bij een 4e plaats met 4/6 "Alle 6 voltooid")
  const over = !!p.rank || soloPhase === 'game-over';
  const caption = done >= goal
    ? `Alle ${goal} opdrachten voltooid`
    : over
      ? `<b>${done}</b> van ${goal} opdrachten voltooid`
      : `Bezig met opdracht <b>${done + 1}</b> van ${goal}`;
  return `<div class="mission-pills">` +
      `<div class="mission-pill"><span class="mission-lbl">Beurt</span><b>${p.myTurn}</b></div>` +
      `<div class="mission-pill is-me" style="--pc:${p.color}"><span class="mission-lbl">Stand</span><b>${walkRankLabel(rank)}</b><span class="mission-lbl">/ ${soloPlayers.length}</span></div>` +
    `</div>` +
    `<div class="mission-caption">${caption}</div>` +
    `<div class="mission-strip" style="--done-w:${lineW}">${hexes}</div>`;
}
function soloRenderStatusExtras(){
  const p = soloViewer();   // in Multiplayer altijd je eigen strook, ook in andermans beurt
  // tijdens het dobbelen aan het begin (soloBeginOpening) is je opdracht nog geheim — dan ook
  // geen opdrachtenoverzicht dat "Actief" bij je eerste opdracht zet
  if (!p || !walkStatTilesEl || p.questHidden){
    if (walkStatTilesEl){ walkStatTilesEl.innerHTML = ''; walkStatTilesEl.dataset.html = ''; }
    if (walkInfoPanelEl) walkInfoPanelEl.classList.remove('is-mission');
    if (walkQuestChecklistEl){ walkQuestChecklistEl.innerHTML = ''; walkQuestChecklistEl.dataset.html = ''; }
    return;
  }
  const html = soloMissionHtml(p);
  if (walkStatTilesEl.dataset.html !== html){
    walkStatTilesEl.innerHTML = html;
    walkStatTilesEl.dataset.html = html;
  }
  if (walkInfoPanelEl && !walkInfoPanelEl.classList.contains('is-mission')) walkInfoPanelEl.classList.add('is-mission');
  soloRenderQuestChecklist();
}
// opdrachtenoverzicht links van het bord: alle 9 opdrachten (2.1-2.9), altijd in dezelfde
// volgorde als QUEST_NAMES zelf — dus NIET de (geheime) volgorde van je eigen stapeltje. Dat is
// bewust: Herprioritering ruilt je huidige doel "blind" met je eerstvolgende
// opdracht (soloUnconditionalSwap), en dit overzicht mag dat geheim niet weggeven. Het toont
// alleen WAT je nog te goed hebt en WAT al klaar is, zodat je kunt inschatten of je je huidige
// doel liever houdt (gebruikerswens). Hangt aan soloRenderStatusExtras zodat hij overal meeloopt.
function soloRenderQuestChecklist(){
  if (!walkQuestChecklistEl) return;
  // De rijen worden hieronder telkens vervangen (innerHTML) — een rij waar de muis toevallig
  // net op stond, verdwijnt dan zonder dat de browser daar een mouseout voor stuurt, en zou
  // soloPeeking anders stuck op true laten staan met een spiek-markering die nooit meer weggaat.
  // Dit zet 'm meteen (niet vertraagd, zie soloPeekReset) veilig terug — geen effect als er toch
  // niet gespiekt werd; staat de muis na de render nog steeds op dezelfde plek, dan pakt de
  // eerstvolgende mousemove het spieken vanzelf weer op via de listener hieronder.
  // Sinds 2026-11 alleen opnieuw in de DOM als er echt iets veranderde (dataset.html, zoals de
  // missiestrook): vroeger bij ELKE stap, wat syncAllPulses liet lopen en spieken tijdens het lopen
  // steeds even liet wegvallen. Het terugzetten van spieken gebeurt dan ook alleen bij een echte wissel.
  const p = soloViewer();   // in Multiplayer altijd je eigen opdrachten
  if (!p){ soloPeekReset(); walkQuestChecklistEl.innerHTML = ''; walkQuestChecklistEl.dataset.html = ''; return; }
  const done = new Set(p.deck.slice(0, p.nextIdx));
  const current = (p.rank || soloPhase === 'game-over') ? null : p.deck[p.nextIdx];
  // afvinklijst met kleurstroken (gebruikerswens): geen 2.x-nummer meer, alleen naam + kamer —
  // de opdrachtkaarten krijgen later alleen nog een naam en een opdracht. Opmaak: zie het
  // CSS-blok bij .walk-quest-checklist. --pc = jouw kleur, voor de hover-rand (spieken).
  walkQuestChecklistEl.style.setProperty('--pc', p.color);
  // (de zes lampjes rechtsboven zijn weg: de voortgang staat nu in de missiestrook erboven)
  const head = `<div class="quest-check-head"><span class="quest-check-title">Opdrachten</span></div>`;
  const html = head + Object.keys(QUEST_NAMES).map(label => {
    const isDone = done.has(label);
    const isCurrent = label === current;
    const cls = 'quest-check-row' + (isDone ? ' is-done' : '') + (isCurrent ? ' is-current' : '');
    // kamernaam erbij (gebruikerswens) — zelfde opzoekmethode als de grote opdrachtkaart
    // ernaast (renderWalkQuestCard in 96-walk.js): via findLabelTile/ROOM_NAMES, verandert dus
    // automatisch mee als de indeling ooit wijzigt.
    const tid = findLabelTile(label);
    const room = tid !== null ? (ROOM_NAMES[tid] || ('Gang ' + tid)) : '—';
    const dot = isDone ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>'
      : isCurrent ? '<i></i>' : '';
    return `<div class="${cls}" style="--qtint:${questTint(label)}" data-label="${label}">` +
      `<span class="quest-check-dot">${dot}</span>` +
      `<span class="quest-check-text">` +
        `<span class="quest-check-name">${QUEST_NAMES[label]}</span>` +
        `<span class="quest-check-room">${room}</span>` +
      `</span>` +
      (isCurrent ? `<span class="quest-check-active">actief</span>` : '') +
      (!isDone && !isCurrent ? '<svg class="quest-check-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '') +
    `</div>`;
  }).join('');
  if (walkQuestChecklistEl.dataset.html === html) return;
  soloPeekReset();
  walkQuestChecklistEl.innerHTML = html;
  walkQuestChecklistEl.dataset.html = html;
}
// Los, duidelijk overzicht van je energie t.o.v. het plafond (ENERGY_MAX) — het kleine
// ⚡-badge in de spelersrij (walkScoreActive) verdwijnt daar te makkelijk tussen de rest.
// Hangt aan renderSoloMeta() (hierboven) zodat hij overal meeloopt waar de rest van je
// beurtinfo ook al opnieuw getekend wordt: bij het opzetten van de beurt, na het dobbelen
// (energiesteen) en na elke energie-actie of kaart.
// Weergave: ENERGY_MAX losse reactorcellen (gebruikerswens: "blokjes die gaaf zijn, zodat je
// echt het gevoel krijgt dat je energie opwekt"). Komt er energie bij (zelfde speler als bij de
// vorige keer tekenen), dan laden de nieuwe cellen één voor één op met een flits (.is-charging,
// oplopende vertraging); gaat er energie af, dan lopen de uitgegeven cellen leeg (.is-draining).
// Bij een andere speler (beurtwissel) gewoon zonder animatie — dat is geen opwekken.
// Hoveren over een betaalbare energie-actie licht de cellen op die hij gaat kosten (zie
// soloPreviewEnergyCost hieronder).
let soloEnergyShown = { idx: -1, energy: 0 };
// Stroomcircuit (gebruikerswens, zie het CSS-blok bij .walk-energy-cells): opladen en leeglopen
// gaan strikt één knooppunt per ENERGY_STEP_MS. Bij opladen loopt eerst de stroom over het
// leidingstukje en ploft het knooppunt ENERGY_IGNITE_MS later aan; bij leeglopen dooft het
// knooppunt en trekt de stroom zich daarna (+160 ms) terug.
const ENERGY_STEP_MS = 380;
const ENERGY_IGNITE_MS = 200;
// de knooppunten (ook gebruikt door de energiebolletjes in 96d-dice.js, die erop landen)
function walkEnergyNodes(){
  return walkEnergyCellsEl ? [...walkEnergyCellsEl.querySelectorAll('.ec-node')] : [];
}
function soloRenderEnergyOverview(){
  if (!walkEnergyOverviewEl || !walkEnergyCellsEl) return;
  const p = soloViewer();   // in Multiplayer altijd je eigen energie, ook in andermans beurt
  // diceEnergyCap: na je eigen worp telt de balk pas op als de energiebolletjes aankomen (96d-dice.js)
  const energy = p ? Math.max(0, Math.min(ENERGY_MAX, diceEnergyCap(p, p.energy))) : 0;
  const samePlayer = !!p && soloEnergyShown.idx === p.idx;
  const prev = samePlayer ? soloEnergyShown.energy : energy;
  walkEnergyOverviewEl.classList.toggle('is-full', energy >= ENERGY_MAX);
  walkEnergyValueEl.textContent = energy;
  const fresh = walkEnergyCellsEl.querySelectorAll('.ec-node').length !== ENERGY_MAX;
  if (fresh){
    walkEnergyCellsEl.innerHTML =
      Array.from({ length: ENERGY_MAX - 1 }, (_, k) => `<span class="ec-seg" style="--k:${k}"><i></i></span>`).join('') +
      '<span class="ec-track"><i></i></span>' +
      Array.from({ length: ENERGY_MAX }, () => '<span class="ec-node"><i class="ec-halo"></i><i class="ec-core"></i><i class="ec-flash"></i><i class="ec-ghost"></i><i class="ec-spend"></i></span>').join('');
  }
  // Deze functie loopt bij elke stap/klik mee (via renderSoloMeta). Is er niets veranderd, dan
  // de knooppunten met rust laten — anders werd een lopende oplaad-/ontlaadanimatie bij de eerste
  // stap meteen afgebroken (gebruikersmelding: "animatie moet gewoon helemaal afspelen").
  if (!fresh && samePlayer && energy === prev) return;
  soloEnergyShown = { idx: p ? p.idx : -1, energy };
  // de puls: het lichtpakketje loopt tot het laatste volle knooppunt, en elk knooppunt licht op
  // als het erlangs komt (tussen 8% en 55% van 2,4 s = 190 tot 1320 ms)
  walkEnergyCellsEl.classList.toggle('has-flow', energy >= 2);
  if (energy >= 2) walkEnergyCellsEl.style.setProperty('--dist', `${((energy - 1) / (ENERGY_MAX - 1) * 100).toFixed(2)}%`);
  walkEnergyNodes().forEach((node, i) => {
    node.style.setProperty('--halo', `${Math.round(190 + (energy > 1 ? i / (energy - 1) * 1130 : 0))}ms`);
    const on = i < energy;
    const charging = on && i >= prev;
    const draining = !on && i < prev;
    node.classList.toggle('is-on', on);
    node.classList.remove('will-spend');
    // Alleen de knooppunten die nu veranderen aanraken: de animatie van het vorige knooppunt loopt
    // gewoon door als het volgende energiebolletje al binnenkomt.
    if (!charging && !draining) return;
    const cls = charging ? 'is-charging' : 'is-draining';
    const had = node.classList.contains(cls);
    node.classList.remove(charging ? 'is-draining' : 'is-charging');
    // strikt na elkaar (gebruikerswens): opladen van links naar rechts, leeglopen van achteren af
    node.style.animationDelay = charging
      ? `${(i - prev) * ENERGY_STEP_MS + (i === 0 ? 0 : ENERGY_IGNITE_MS)}ms`
      : `${(prev - 1 - i) * ENERGY_STEP_MS}ms`;
    node.classList.add(cls);
    // stond de klasse er al op, dan de animatie opnieuw laten beginnen — zonder de gedwongen
    // herberekening van de opmaak (void offsetWidth), ±8 ms per keer (gemeten)
    if (had) for (const a of node.getAnimations({ subtree: true })) if (a.animationName !== 'ecHalo') a.currentTime = 0;
  });
  // leidingstukje k loopt van knooppunt k naar k+1: vol als knooppunt k+1 vol is
  walkEnergyCellsEl.querySelectorAll('.ec-seg').forEach((seg, k) => {
    const lit = k + 1 < energy;
    if (seg.classList.contains('is-lit') === lit) return;
    const to = k + 1;
    seg.firstElementChild.style.transitionDelay = !samePlayer ? '0ms'
      : lit ? `${Math.max(0, to - prev) * ENERGY_STEP_MS}ms`
      : `${Math.max(0, prev - 1 - to) * ENERGY_STEP_MS + 160}ms`;
    seg.classList.toggle('is-lit', lit);
  });
}
// Animatieklassen weg zodra de animatie klaar is (ecRing is de langste van opladen én leeglopen).
// Anders startte het opnieuw zodra de kostenpreview (.will-spend) weer verdween.
if (walkEnergyCellsEl){
  walkEnergyCellsEl.addEventListener('animationend', (e) => {
    if (e.animationName !== 'ecRing') return;
    const node = e.target.closest('.ec-node');
    if (node) node.classList.remove('is-charging', 'is-draining');
  });
}
// laatste `cost` volle knooppunten laten knipperen = wat deze actie zou kosten (null = preview weg)
function soloPreviewEnergyCost(cost){
  const energy = soloEnergyShown.energy;
  walkEnergyNodes().forEach((node, i) => {
    node.classList.toggle('will-spend', cost !== null && i < energy && i >= energy - cost);
  });
}
// De preview blijft staan zolang de muis ergens in de lijst met acties is — ook boven het
// gaatje tussen twee knoppen. Voorheen ging hij bij elk gaatje heel even uit en weer aan, en
// begon het knipperen telkens opnieuw: dat flikkerde (gebruikersmelding, vooral met een volle
// balk waar alles betaalbaar is). Uit pas bij het verlaten van de lijst, of boven een actie die
// je niet kunt betalen. Cellen die al oplichten blijven gewoon doorknipperen.
if (walkSoloActionsEl){
  walkSoloActionsEl.addEventListener('mouseover', (e) => {
    const btn = e.target.closest('button.energy-pick[data-energy]');
    if (!btn) return;   // gaatje tussen de knoppen: preview laten staan
    const act = ENERGY_ACTIONS[btn.dataset.energy];
    soloPreviewEnergyCost(act && !btn.disabled ? act.cost : null);
    soloEnergyNoteShow(btn.dataset.energy);   // uitlegvak onder de lijst
  });
  walkSoloActionsEl.addEventListener('mouseleave', () => { soloPreviewEnergyCost(null); soloEnergyNoteShow(soloEnergyNoteDefault); });
  // toetsenbord: de actie met focus staat in het uitlegvak
  walkSoloActionsEl.addEventListener('focusin', (e) => {
    const btn = e.target.closest('button.energy-pick[data-energy]');
    if (btn) soloEnergyNoteShow(btn.dataset.energy);
  });
}
function soloRefreshTarget(){
  const p = solo();
  const label = p.deck[p.nextIdx];
  soloTargetKey = soloGraph.questCells[label];   // spellogica: het doel van wie aan zet is
  soloShowTargets();
}
// Wie kijkt er naar dit scherm? In Multiplayer altijd je eigen stoel (mp.myIdx), ook als een
// ander aan zet is; lokaal gewoon wie aan zet is. Alles wat "jouw" info toont (opdrachtkaart,
// opdrachtenoverzicht, tegels linksboven, energiecellen) gebruikt deze speler — anders veranderde
// bij een medespeler het hele scherm continu mee met wat díe aan het doen was
// (gebruikersfeedback na een echt potje: "hij wil zelf beter zien wat hij zelf kan doen").
function soloViewer(){
  if (typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game' &&
      mp.myIdx >= 0 && soloPlayers[mp.myIdx]) return soloPlayers[mp.myIdx];
  return solo();
}
// Doelmarkering(en) op het bord + de opdrachtkaart in het zijpaneel. Jouw eigen doel (soloViewer)
// krijgt de gewone markering en de kaart; is er een ander aan zet, dan staat diens doel er extra
// bij als gestippelde rand in zijn kleur (.walk-target-other) — zo zie je wél waar hij heen wil,
// zonder dat je eigen opdracht verdwijnt (gebruikerswens).
function soloShowTargets(){
  if (!soloGraph) return;
  const me = soloViewer(), act = solo();
  const goalOf = (p) => p && !p.questHidden && !p.rank ? p.deck[p.nextIdx] : undefined;
  const mine = goalOf(me);
  if (mine){
    markWalkTarget(soloGraph, mine, soloGraph.questCells[mine], me.color);
    renderWalkQuestCard(mine);
  } else {
    clearWalkTarget();
  }
  walkClearClass('walk-target-other');
  const theirs = act && act !== me ? goalOf(act) : undefined;
  if (theirs !== undefined){
    const cell = walkCellDiv(soloGraph, soloGraph.questCells[theirs]);
    cell.style.setProperty('--oc', act.color);
    cell.classList.add('walk-target-other');
  }
}

// ---------- opdrachtenoverzicht: spieken door te hoveren ----------
// Hover je over een nog niet voltooide opdracht in het overzicht (soloRenderQuestChecklist),
// dan verschuift de markering op het bord ernaartoe — je eigen actieve doel verdwijnt daarbij
// even, want markWalkTarget() wist eerst elke bestaande `.walk-target` voordat hij de nieuwe
// zet (gebruikerswens: "even goed kunnen spieken welke opdracht in welke kamer zit, om de beste
// tactiek uit te rekenen"). Zodra de muis weggaat komt je échte doel terug via
// soloRefreshTarget() — dezelfde functie die ook aan het begin van je beurt de markering zet.
//
// `mouseout` op rij A en `mouseover` op rij B zijn twee LOSSE events — ook zonder tussenruimte
// tussen de rijen kan de muis daar precies tussenin een frame "nergens boven" staan. Zonder
// vertraging knipperde daardoor je eigen opdracht steeds héél even terug bij het doorbewegen
// over de lijst (gebruikersmelding: "hakkelend, springt continu terug tussen 2 opdrachten").
// soloPeekQuestEnd() wacht daarom SOLO_PEEK_END_DELAY voordat hij écht terugschakelt, en die
// wachttijd wordt geannuleerd zodra soloPeekQuest() (op eender welke rij, ook dezelfde) intussen
// opnieuw afgaat — dus alleen als de muis de hele lijst verlaat, zie je je eigen opdracht terug.
const SOLO_PEEK_END_DELAY = 120;
let soloPeeking = false;
let soloPeekEndTimer = null;
function soloPeekQuest(label){
  if (!soloGraph || !label) return;
  const key = soloGraph.questCells[label];
  if (key === undefined) return;
  if (soloPeekEndTimer){ clearTimeout(soloPeekEndTimer); soloPeekEndTimer = null; }
  const p = soloViewer();
  soloPeeking = true;
  markWalkTarget(soloGraph, label, key, p ? p.color : '#4fb8e0');
}
function soloPeekQuestEnd(){
  if (!soloPeeking || soloPeekEndTimer) return;
  soloPeekEndTimer = setTimeout(() => {
    soloPeekEndTimer = null;
    soloPeekReset();
  }, SOLO_PEEK_END_DELAY);
}
// Directe (niet-vertraagde) versie voor de plekken waar wachten niet kan: bij een her-render van
// de rijen (soloRenderQuestChecklist) of bij het stoppen van het potje (stopSoloGame) moet de
// spiek-status meteen kloppen, niet pas over SOLO_PEEK_END_DELAY ms op een DOM/potje dat er dan
// misschien al niet meer is.
function soloPeekReset(){
  if (soloPeekEndTimer){ clearTimeout(soloPeekEndTimer); soloPeekEndTimer = null; }
  if (!soloPeeking) return;
  soloPeeking = false;
  // geen lopend potje (meer): gewoon leeg laten. Anders de echte markeringen terug
  // (soloShowTargets regelt zelf een speler die al binnen is of nog geen opdracht ziet).
  if (!solo() || !soloGraph) { clearWalkTarget(); return; }
  soloShowTargets();
}
// Delegatie op de vaste containerdiv i.p.v. per rij een listener: soloRenderQuestChecklist()
// vervangt de rijen bij elke render (elke stap, elke beurt), losse listeners zouden dus telkens
// opnieuw moeten. mouseover/mouseout + relatedTarget-check is de gangbare manier om
// mouseenter/mouseleave-gedrag te delegeren (die twee bubbelen zelf niet).
if (walkQuestChecklistEl){
  walkQuestChecklistEl.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.quest-check-row:not(.is-done)');
    if (!row || row.contains(e.relatedTarget)) return;
    soloPeekQuest(row.dataset.label);
  });
  walkQuestChecklistEl.addEventListener('mouseout', (e) => {
    const row = e.target.closest('.quest-check-row:not(.is-done)');
    if (!row || row.contains(e.relatedTarget)) return;
    soloPeekQuestEnd();
  });
}

