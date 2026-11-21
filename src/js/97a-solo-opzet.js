// ---------- stap voor stap: zelf spelen (1 t/m 4 spelers, mix van mens/bot) ----------
// Jij dobbelt zelf, kiest zelf elke stap een aangrenzend vakje, en zet zelf een energie-actie
// of handkaart in. Hergebruikt dezelfde spelregels als de batch/auto-modus (resolveMove,
// ENERGY_ACTIONS, ACTION_CARDS, buildActionDeck, resolveRoundFinishers), maar zonder bot-AI
// voor JOUW beurten — de bot-beurten (als je die toevoegt) worden wél automatisch en meteen
// afgehandeld (`soloResolveBotTurn`, via de gedeelde botPlanTurn/botFinishTurn uit
// 95-simulate.js), zodat jij niet op ze hoeft te wachten.
//
// Met 1 speler (geen bots) is er niemand die je blokkeert, en hebben Kortsluiting, Blinde Vlek,
// Duwstoot, Vergrendeling, Stroomonderbreking en Energielek een tegenstander nodig — die staan
// dan uit. Zodra er wél andere spelers zijn (mens of bot) blokkeren jullie elkaars vakjes net als
// in "Automatisch", en werken die kristallen ook — met een doelwit dat JIJ zelf kiest.
const WALK_SOLO_NO_OPPONENT_CARDS = ['short', 'blind', 'shove', 'lockdown', 'outage', 'leak'];

// Welke kristallen al vóór het dobbelen mogen, volgt uit ACTION_CARDS[id].when (95-simulate.js):
// 'pre' (alleen vóór het dobbelen: Zwaartekracht-laarzen) en 'any' (vóór het dobbelen óf tijdens
// je zet: Noodrantsoen, Stuwlading). Al het andere pas na de worp — zie soloCardBlockReason.
const SOLO_PRE_ROLL_CARDS = ACTION_CARD_IDS.filter(id => ACTION_CARDS[id].when === 'pre' || ACTION_CARDS[id].when === 'any');

const walkModeAutoBtn = document.getElementById('walkModeAuto');
const walkModeSoloBtn = document.getElementById('walkModeSolo');
const walkModeMultiBtn = document.getElementById('walkModeMulti');
const walkAutoControlsEl = document.getElementById('walkAutoControls');
const walkSoloControlsEl = document.getElementById('walkSoloControls');
const walkMultiControlsEl = document.getElementById('walkMultiControls');
const walkSoloHintEl = document.getElementById('walkSoloHint');
const walkAutoHintEl = document.getElementById('walkAutoHint');
const walkMultiHintEl = document.getElementById('walkMultiHint');
// Hoort inhoudelijk bij 99-multiplayer.js (zie de andere mpXxxEl-consts daar), maar moet HIER
// staan: setWalkMode() hieronder leest 'm ook tijdens de allereerste, synchrone
// setWalkMode('auto')-aanroep bij het laden van de pagina — dat gebeurt vóór 99-multiplayer.js
// is uitgevoerd, dus een const daar zou op dat moment nog in zijn temporal dead zone zitten
// ("Cannot access 'mpChatPanelEl' before initialization").
const mpChatPanelEl = document.getElementById('mpChatPanel');
const walkSoloBotViewSel = document.getElementById('walkSoloBotView');
const walkSoloSetupEl = document.getElementById('walkSoloSetupPlayers');
const walkSoloStartRowEl = document.getElementById('walkSoloStartRow');
const btnWalkSoloStart = document.getElementById('btnWalkSoloStart');
const btnWalkSoloReset = document.getElementById('btnWalkSoloReset');
const walkResetConfirmEl = document.getElementById('walkResetConfirm');
const btnWalkResetConfirmYes = document.getElementById('btnWalkResetConfirmYes');
const btnWalkResetConfirmCancel = document.getElementById('btnWalkResetConfirmCancel');
const walkSoloPanelEl = document.getElementById('walkSoloPanel');
const walkSoloActionsEl = document.getElementById('walkSoloActions');
const btnWalkSoloRoll = document.getElementById('btnWalkSoloRoll');
const btnWalkSoloSkip = document.getElementById('btnWalkSoloSkip');
const walkEnergyOverviewEl = document.getElementById('walkEnergyOverview');
const walkEnergyValueEl = document.getElementById('walkEnergyValue');
const walkEnergyCellsEl = document.getElementById('walkEnergyCells');
// de kristalkluis (zie crystalRenderVault in 96c-crystals.js)
const walkCardVaultEl = document.getElementById('walkCardVault');
const walkCardActionsEl = document.getElementById('walkCardActions');
const btnCardPlay = document.getElementById('btnCardPlay');
const btnCardDiscard = document.getElementById('btnCardDiscard');
const walkStepCounterEl = document.getElementById('walkStepCounter');
const walkStepDoneEl = document.getElementById('walkStepDone');
const walkStepLeftEl = document.getElementById('walkStepLeft');
const walkSideStackEl = document.getElementById('walkSideStack');
const walkOrSep1El = document.getElementById('walkOrSep1');
const walkOrSep2El = document.getElementById('walkOrSep2');
const walkStatTilesEl = document.getElementById('walkStatTiles');
const walkQuestChecklistEl = document.getElementById('walkQuestChecklist');
const walkEndgameEl = document.getElementById('walkEndgame');
const walkEndgameCardEl = document.getElementById('walkEndgameCard');
const walkEndgameConfettiEl = document.getElementById('walkEndgameConfetti');
const btnWalkEndgameShowMap = document.getElementById('btnWalkEndgameShowMap');
const btnWalkEndgameShowResult = document.getElementById('btnWalkEndgameShowResult');

// Dobbelknop, energieacties, kaartkluis, startvakjes, opdrachtvakje en kamerkader pulsen allemaal
// met dezelfde animatie (axPulse / walkRoomPulse in styles.css, beide 1,9s), maar zijn losse
// DOM-elementen die op verschillende momenten pulsend worden (de energieknoppen worden zelfs bij
// elke render opnieuw aangemaakt). Een CSS-animatie begint op het moment dat hij ontstaat, dus
// zonder correctie pulst alles door elkaar heen i.p.v. tegelijk (gebruikerswens). syncAllPulses()
// zet de starttijd van ELKE lopende puls op hetzelfde vaste punt van de tijdlijn (0), zodat ze
// allemaal in dezelfde fase zitten. Een MutationObserver op #tabWalk roept dat aan zodra er iets
// verandert (klasse erbij, knoppen opnieuw getekend) — ook voor elementen uit 96-walk.js, die
// zelf niets van deze synchronisatie hoeven te weten. Gepauzeerde animaties (Pauze in
// Automatisch) blijven met rust: starttijd zetten zou ze weer laten lopen.
// (de pulsduur zelf staat als DICE_PULSE_MS in 96d-dice.js: 1,9 s, gelijk aan axPulse/walkRoomPulse in styles.css)
// ecSpend: het knipperen van de knooppunten die een actie gaat kosten — ook op één ritme,
// anders knipperen net bijgekomen knooppunten uit de pas met de rest
// crystalPulse: het gekozen kristal in de kluis (zeshoek-versie van axPulseBtn)
// ecHalo/ecPacket: de puls in de energiebalk (lichtpakketje + oplichtende knooppunten), ecSpend:
// de kostenpreview — allemaal op hetzelfde ritme, ook knooppunten die net vol zijn geworden
const PULSE_ANIMATIONS = new Set(['axPulse', 'axPulseBtn', 'walkRoomPulse', 'ecSpend', 'ecHalo', 'ecPacket', 'crystalPulse']);
let pulseSyncQueued = false;
function syncAllPulses(){
  pulseSyncQueued = false;
  if (typeof document.getAnimations !== 'function') return;
  for (const anim of document.getAnimations()){
    if (!PULSE_ANIMATIONS.has(anim.animationName)) continue;
    if (anim.playState !== 'running' || anim.startTime === 0) continue;
    anim.startTime = 0;
  }
}
function syncPulse(){
  if (pulseSyncQueued) return;
  pulseSyncQueued = true;
  requestAnimationFrame(syncAllPulses);
}
{
  const tabWalkEl = document.getElementById('tabWalk');
  if (tabWalkEl) new MutationObserver(() => syncPulse())
    .observe(tabWalkEl, {subtree:true, childList:true, attributes:true, attributeFilter:['class', 'hidden']});
}

// ---------- vervolgkeuze van een gespeelde actiekaart (doelwit/richting/Blinde-Vlek-aanbod) ----------
// Hoort bij de kaart die je net speelde, dus eigen vakje bij de kaartkluis i.p.v. de
// energiekolom hierboven (gebruikerswens: "die keuze moet in de kolom van de actiekaart komen
// te staan"). Pulst ook, zodat duidelijk is dat er nu iets van je gevraagd wordt.
function soloRenderCardActionsPanel(html){
  if (!walkCardActionsEl) return;
  walkCardActionsEl.innerHTML = html;
  walkCardActionsEl.classList.add('walk-pulse-affordable');
  syncPulse(walkCardActionsEl);
}
function soloClearCardActionsPanel(){
  if (!walkCardActionsEl) return;
  walkCardActionsEl.innerHTML = '';
  walkCardActionsEl.classList.remove('walk-pulse-affordable');
}

let soloGraph = null;
let soloDeck = null;         // gedeelde actiekaart-stapel voor dit potje
let soloRand = null;
let soloTurn = 0;            // totaal aantal beurten in dit potje, over alle spelers samen

// ---------- opzet: aantal spelers/bots kiezen, per mens een startpositie + voorproefje ----------
let soloSetupRand = null;
let soloSetupPlayers = [];   // { idx, isHuman, name, color, deck, startLabel, strategy, ... }

function soloSetupHumans(){ return soloSetupPlayers.filter(p => p.isHuman); }

// Bemanningslijst (gekozen ontwerp "B", vervangt de keuzelijsten Aantal spelers/Aantal bots):
// eerst de mensen (plek 1 = jij), dan de bots. "+ Speler" voegt een mens toe ná de laatste mens,
// "+ Bot" een bot achteraan, ✕ haalt precies die plek weg. Standaard: jij tegen 3 bots.
let soloHumanCount = 1;
let soloBotCount = WALK_MAX_PLAYERS - 1;
// botnamen blijven staan als je iemand toevoegt of weghaalt (anders kreeg elke bot bij elke klik
// een nieuwe naam); alleen een nieuwe bot krijgt een nieuwe naam (pickBotNames, 96-walk.js)
let soloBotNames = [];

// Zelf ingevulde namen, per spelersplek. Ze staan bewust NIET in het spelerobject: dat wordt
// bij elke wijziging van het aantal spelers opnieuw opgebouwd, en dan zou je je naam telkens
// kwijt zijn. Leeg = automatisch "Speler N".
const soloCustomNames = {};
// Een naam gaat via innerHTML het log, de spelersbalk en een enkele title= in. In plaats van
// op tien plekken te ontsnappen, gooien we de tekens er hier meteen uit — voor een spelersnaam
// mis je er niets aan en er kan zo niets stuk.
function soloCleanName(raw){
  return String(raw).replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}
function soloSeatName(idx){
  return soloCustomNames[idx] || `Speler ${idx + 1}`;
}

function soloRebuildSetup(){
  stopSoloGame();
  soloHumanCount = Math.max(1, Math.min(WALK_MAX_PLAYERS, soloHumanCount));
  soloBotCount = Math.max(0, Math.min(WALK_MAX_PLAYERS - soloHumanCount, soloBotCount));
  const humanCount = soloHumanCount;
  const bots = soloBotCount;
  const total = humanCount + bots;

  soloSetupRand = mulberry32(Math.floor(Math.random() * 4294967296));
  soloSetupPlayers = [];
  // bots een toffe naam (pickBotNames, 96-walk.js) — nooit gelijk aan een mens aan tafel; wie er
  // al zat houdt zijn naam
  soloBotNames = soloBotNames.slice(0, bots);
  if (soloBotNames.length < bots){
    const taken = Array.from({ length: humanCount }, (_, i) => soloSeatName(i)).concat(soloBotNames);
    soloBotNames = soloBotNames.concat(pickBotNames(bots - soloBotNames.length, taken));
  }
  const botNames = soloBotNames;
  for (let i = 0; i < total; i++){
    const isHuman = i < humanCount;   // eerste plekken zijn mens, de rest bot
    soloSetupPlayers.push({
      idx: i,
      isHuman,
      name: isHuman ? soloSeatName(i) : botNames[i - humanCount],
      color: WALK_PLAYER_COLORS[i],
      deck: simShuffle(SIM_QUEST_LABELS, soloSetupRand),
      nextIdx: 0, completed: 0, myTurn: 0, energy: 0, cards: [], rank: 0, doneCells: [], condenserPending: false,
      lockedNextTurn: false, rollPenalty: 0,
      // bots denken zelf na welke energie-actie nu slim is, of sparen (botStrategyNow, 95-simulate.js)
      strategy: isHuman ? null : 'smart',
      // startpositie kiest iedereen pas aan het begin van het potje, in de volgorde van de worp
      // (soloBeginOpening) — in de lobby is nog niet te zien waar je opdracht ligt
      startLabel: null,
      pos: null,
      questHidden: true,
      stats: newPlayerStats(),   // voor de knop "Statistieken" op het winscherm
      skipEnergyRoll: false, actionUses: 0,
    });
  }
  soloRenderSetupUI();
  // "Beurten van de bots" heeft zonder bots niets te doen
  // Zonder bots niet verbergen maar uitzetten (gedimd): verbergen liet de rest van de lobby
  // 72px verspringen bij het wisselen van het aantal spelers (gebruikersmelding: "floept")
  const botViewField = walkSoloBotViewSel && walkSoloBotViewSel.closest('.field');
  if (botViewField){
    botViewField.hidden = false;
    botViewField.classList.toggle('is-disabled', bots === 0);
    walkSoloBotViewSel.disabled = bots === 0;
  }
  lobbyRenderSummary();
}

function soloRenderSetupUI(){
  if (!walkSoloSetupEl) return;
  const humans = soloSetupHumans();
  if (!humans.length){
    walkSoloSetupEl.innerHTML = '';
    if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = true;
    return;
  }
  // Bemanningslijst: altijd 4 rijen hoog (lege plekken als gestippelde rij, waarvan alleen de
  // eerste "nog N plekken vrij" zegt), zodat de lobby niet verspringt bij toevoegen/weghalen.
  // Mens = naamvak + "jij"/"speler"; bot = alleen de naam met het woordje "bot" erachter
  // (gebruikerswens). Startpositie en eerste opdracht komen pas aan het begin van het potje.
  // Elke rij = vijf vaste vakjes (gebruikerswens, zie .crew-row in styles.css): nummer, bolletje,
  // naamvak (bij een bot een vak van dezelfde maat met zijn naam, niet te wijzigen), rolvak
  // (jij/speler/bot, overal even breed) en verwijdervak (bij jou uitgezet, maar wel op zijn plek).
  const rows = soloSetupPlayers.map(p => {
    const name = p.isHuman
      ? `<input type="text" class="walk-solo-setup-input" data-name-seat="${p.idx}"` +
          ` value="${soloCustomNames[p.idx] || ''}" maxlength="18" spellcheck="false"` +
          ` placeholder="Speler ${p.idx + 1}" aria-label="Naam van speler ${p.idx + 1}">`
      : `<span class="crew-bot-name" title="${p.name}">${p.name}</span>`;
    const role = !p.isHuman ? 'bot' : p.idx === 0 ? 'jij' : 'speler';
    return `<div class="crew-row" style="--pc:${p.color}">` +
      `<span class="crew-num">${p.idx + 1}</span>` +
      `<span class="crew-dot"></span>` +
      name +
      `<span class="crew-role is-${role}">${role}</span>` +
      (p.idx === 0
        ? `<button type="button" class="crew-del" disabled aria-label="Jij kunt niet weg" title="Jij blijft altijd aan boord">✕</button>`
        : `<button type="button" class="crew-del" data-crew-del="${p.idx}" aria-label="${p.name} weghalen" title="Weghalen">✕</button>`) +
    `</div>`;
  });
  const free = WALK_MAX_PLAYERS - soloSetupPlayers.length;
  for (let i = 0; i < free; i++){
    rows.push(i === 0
      ? `<div class="crew-row is-free">nog ${free === 1 ? '1 plek' : free + ' plekken'} vrij</div>`
      : `<div class="crew-row is-free is-blank" aria-hidden="true"></div>`);
  }
  const full = free === 0;
  walkSoloSetupEl.innerHTML =
    `<div class="crew-list">${rows.join('')}</div>` +
    `<div class="crew-add">` +
      `<button type="button" class="ghost" data-crew-add="human"${full ? ' disabled' : ''}>+ Speler</button>` +
      `<button type="button" class="ghost" data-crew-add="bot"${full ? ' disabled' : ''}>+ Bot</button>` +
    `</div>`;
  if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = false;
}
// ✕ bij een plek: precies die speler/bot eruit. Namen van de mensen erna schuiven een plek op,
// zodat iedereen zijn eigen naam houdt.
function soloCrewRemove(idx){
  if (idx <= 0) return;   // plek 1 ben jij
  if (idx < soloHumanCount){
    for (let i = idx; i < soloHumanCount - 1; i++){
      if (soloCustomNames[i + 1]) soloCustomNames[i] = soloCustomNames[i + 1]; else delete soloCustomNames[i];
    }
    delete soloCustomNames[soloHumanCount - 1];
    soloHumanCount--;
  } else {
    soloBotNames.splice(idx - soloHumanCount, 1);
    soloBotCount--;
  }
  soloRebuildSetup();
}
function soloCrewAdd(kind){
  if (soloHumanCount + soloBotCount >= WALK_MAX_PLAYERS) return;
  if (kind === 'human') soloHumanCount++; else soloBotCount++;
  soloRebuildSetup();
  // meteen in het naamvak van de nieuwe speler, zodat je kunt typen
  if (kind === 'human' && walkSoloSetupEl){
    const veld = walkSoloSetupEl.querySelector(`input[data-name-seat="${soloHumanCount - 1}"]`);
    if (veld) veld.focus();
  }
}
if (walkSoloSetupEl){
  walkSoloSetupEl.addEventListener('click', (e) => {
    const del = e.target.closest('[data-crew-del]');
    if (del){ soloCrewRemove(parseInt(del.dataset.crewDel, 10)); return; }
    const add = e.target.closest('[data-crew-add]');
    if (add && !add.disabled) soloCrewAdd(add.dataset.crewAdd);
  });
  // Bewust op 'input' en zónder de opzet opnieuw te tekenen: dat zou bij elke toetsaanslag
  // de focus uit het veld halen.
  walkSoloSetupEl.addEventListener('input', (e) => {
    const veld = e.target.closest('input[data-name-seat]');
    if (!veld) return;
    const seat = parseInt(veld.dataset.nameSeat, 10);
    const p = soloSetupPlayers[seat];
    if (!p) return;
    const schoon = soloCleanName(veld.value);
    if (schoon) soloCustomNames[seat] = schoon; else delete soloCustomNames[seat];
    p.name = soloSeatName(seat);
  });
}

// ---------- het lopende potje ----------
let soloPlayers = [];
let soloTurnOrder = [];
let soloRoundPos = 0;         // positie binnen soloTurnOrder van de HUIDIGE ronde
let soloRoundFinishers = [];  // spelers die deze ronde hun 6e opdracht voltooien
let soloFinished = 0;
let soloFinishTarget = 1;
let soloActiveIdx = -1;       // wie van soloPlayers nu interactief aan zet is (mens)
let soloTargetKey = null;
// 'idle' | 'choose-action' | 'target-pick' | 'blind-offer' |
// 'rolling' | 'moving' | 'boots-direction' | 'reorder-peek' | 'jump-target' | 'portal-aim' |
// 'portal-color' | 'game-over'
// Beurtvolgorde: 'choose-action' = energie-actie kiezen (of overslaan) — vóór het dobbelen, direct
// ingezet. Dan 'rolling' = dobbelen. Dan 'moving' = stappen zetten; kaarten spelen/afleggen kan op
// elk moment tijdens 'moving' (via de kaartkluis, zie soloRefreshCardVault), vóór of tussen de stappen door, hooguit
// 1 kaart per beurt — er is dus geen aparte fase vóór de worp om een kaart te spelen.
// + 'bots' = een bot-beurt wordt zichtbaar afgespeeld (soloAnimateBotTurn), niets klikbaar
let soloPhase = 'idle';
let soloRunId = 0;
// Lobby-optie "Beurten van de bots": null = meteen doorspelen (zoals altijd), anders een
// index in WALK_SPEEDS en wordt elke bot-beurt zichtbaar afgespeeld. Vastgezet bij
// startSoloGame(); multiplayer zet 'm zelf op null (gasten zien alleen de gedeelde staat).
let soloBotViewSpeed = null;
let soloMove = null;            // { d1, d2, d3, roll, stepsLeft, lastDir, path }
let soloEnergyRoll = 0;
let soloEnergyGain = { gained: 0, wasted: 0 };
let soloUsedEnergyId = null;    // id uit ENERGY_ACTIONS, voor de logregel
let soloUsedCardId = null;      // id uit ACTION_CARDS (GESPEELD), voor de logregel
let soloDiscardedCardId = null; // id uit ACTION_CARDS (AFGELEGD i.p.v. gespeeld), voor de logregel
let soloTargetSwapped = false;  // Herprioritering wisselde deze beurt je doel
let soloPendingBoost = false;   // Stuwstoot/Stuwlading: deze beurt een 3e loopsteen
let soloUsedBoots = false;
let soloPendingTwin = false;  // Dubbele steen: deze beurt een tweede energiesteen
let soloPortalSource = null;  // 'card' | 'energy' — Portaalsleutel of Portaalkanon (zie soloEnterPortalAim)
let soloLockedThisTurn = false; // Vergrendeling: deze beurt geen energie- en kaartactie
let soloUsedJump = false;
let soloActionCellDrawnThisTurn = false;  // hooguit 1 beloningskaart per beurt via een actiekaartvakje
// hoeveel opdrachten deze beurt al onderweg gebankt zijn (normaal 0 of 1, zelden 2 — zie
// soloBankCurrentQuest): de beurt stopt er niet meer voor, dus dit bepaalt straks alleen nog of
// het einde van de beurt "onderweg naar X" moet loggen of gewoon stil mag afronden
let soloBankCountThisTurn = 0;
let soloBootsOptions = [];
let soloPortalOptions = [];      // Portaalkanon: { dir, key, path }[] (fase 'portal-aim')
let soloPortalAim = null;        // gekozen richting, wacht op de kleur (fase 'portal-color')
let soloCurrentLegalMoves = [];  // { key, dir }[] — de opties die het richtingskruis nu toont
let soloBlindOfferAvailable = false; // deze stap geblokkeerd door een tegenstander + Blinde Vlek in de hand

function solo(){ return soloPlayers[soloActiveIdx]; }
// Energie-actie en kaartactie zijn TWEE LOSSE sloten per beurt (max 1 van elk) — een kaart
// AFLEGGEN gebruikt hetzelfde kaart-slot als een kaart SPELEN, dus telt ook mee.
function soloEnergyActionUsed(){ return !!soloUsedEnergyId; }
function soloCardActionUsed(){ return !!(soloUsedCardId || soloDiscardedCardId); }
// alle andere spelers die nog meespelen — voor blokkeren en doelwit-keuzes. simOnBoard() i.p.v.
// alleen !p.rank: wie deze ronde al binnenkwam heeft nog geen rank, maar staat niet meer op het bord.
function soloOthers(){ return soloPlayers.filter(p => p.idx !== soloActiveIdx && simOnBoard(p)); }
function soloOccupied(){
  return new Set(soloOthers().map(p => p.pos));
}

// ---------- modus wisselen ----------
// Drie modi sinds multiplayer geen eigen tabblad meer heeft, maar een derde knop hier
// (gebruikerswens) — mode is 'auto' | 'solo' | 'multi'. Let op bij toekomstige aanpassingen:
// met drie modi is "niet auto" niet meer hetzelfde als "solo" — regels die specifiek de
// solo-opzet-UI aan/uit zetten moeten dus op `!isSolo` testen, niet op `isAuto`/`!isAuto`
// (dat ging hier eerder mis: de solo-knoppenrij en "Start spel" bleven staan zodra multiplayer
// als derde modus werd toegevoegd, vóórdat dat hier werd rechtgezet).
// ---------- lobby "Drie kaarten" (gekozen variant 6, artifact "Axiom-9 Lobby-eenheid", 2026-11) ----------
// Elk lobbyscherm (.lobby-cards: Automatisch, Zelf spelen, Spel hosten, Deelnemen) heeft een
// Vertrek-kaart met lege plekken voor de foutregel en het vinkje "Startanimatie tonen". Er is maar
// één vinkje (#walkIntroToggle) en één foutregel per soort (#walkLobbyStatus voor Spelen, #mpStatus
// voor Multiplayer); die verhuizen hier naar het scherm dat nu zichtbaar is. In de multiplayer-kamer
// gaat #mpStatus terug naar de knoppen linksonder (.mp-room-info).
function lobbyPlaceFoot(){
  const toggle = document.getElementById('walkIntroToggle');
  const intro = toggle && toggle.closest('.walk-intro-toggle');
  const walkStatus = document.getElementById('walkLobbyStatus');
  const mpStatus = document.getElementById('mpStatus');
  // alleen "hidden" BINNEN de lobby telt: bij het laden is het hele tabblad nog verborgen, en dan
  // bleef het vinkje onder de kaarten staan (kaarten 38px lager tot je een keer van tabblad wisselde)
  const shown = el => { for (let n = el; n && n.id !== 'walkLobby'; n = n.parentElement) if (n.hidden) return false; return true; };
  const screen = [...document.querySelectorAll('#walkLobby .lobby-cards')].find(shown);
  if (screen){
    const introSlot = screen.querySelector('.lobby-intro-slot');
    if (intro && introSlot && !introSlot.children.length) introSlot.append(intro);
    const statusSlot = screen.querySelector('.lobby-status-slot');
    const st = screen.dataset.mp ? mpStatus : walkStatus;
    if (st && statusSlot && st.parentNode !== statusSlot) statusSlot.append(st);
  }
  const layout = document.getElementById('mpRoomLayout');
  const info = layout && layout.querySelector('.mp-room-info');
  if (mpStatus && info && layout.classList.contains('is-room') && mpStatus.parentNode !== info) info.append(mpStatus);
}
// samenvatting in de Vertrek-kaart + de bots "aan boord" bij Automatisch
function lobbyOptText(id){
  const sel = document.getElementById(id);
  if (!sel) return '';
  if (sel.type === 'range') return ((sel.dataset.labels || '').split('|')[parseInt(sel.value, 10) - Number(sel.min || 0)]) || '';
  const o = sel.options[sel.selectedIndex];
  return o ? (o.dataset.short || o.textContent.trim()) : '';
}
function lobbySumHtml(rows){
  return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function lobbyRenderSummary(){
  const set = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
  const n = parseInt(walkPlayersSel ? walkPlayersSel.value : '4', 10) || 4;
  set('walkAutoSummary', lobbySumHtml([
    ['Modus', 'Bots spelen'], ['Spelers', n === 1 ? '1 bot' : `${n} bots`],
    ['Energie', lobbyOptText('walkEnergyMode')], ['Tempo', lobbyOptText('walkSpeed')],
  ]));
  // Bots aan boord bij Automatisch: PRECIES dezelfde bemanningslijst als Zelf spelen (gebruikerswens
  // 2026-11): vijf vaste vakjes per rij, ✕ per bot, onderaan "+ Speler" (hier altijd uit: in
  // Automatisch spelen alleen bots) en "+ Bot". De namen blijven staan en worden bij de start gebruikt.
  walkAutoBotNames = walkAutoBotNames.slice(0, n);
  if (walkAutoBotNames.length < n) walkAutoBotNames = walkAutoBotNames.concat(pickBotNames(n - walkAutoBotNames.length, walkAutoBotNames));
  const crew = walkAutoBotNames.map((name, i) =>
    `<div class="crew-row" style="--pc:${WALK_PLAYER_COLORS[i]}"><span class="crew-num">${i + 1}</span><span class="crew-dot"></span>` +
    `<span class="crew-bot-name" title="${name}">${name}</span><span class="crew-role is-bot">bot</span>` +
    (n <= 1
      ? `<button type="button" class="crew-del" disabled aria-label="Er moet minstens één bot spelen" title="Er moet minstens één bot spelen">✕</button>`
      : `<button type="button" class="crew-del" data-auto-del="${i}" aria-label="${name} weghalen" title="Weghalen">✕</button>`) +
    `</div>`);
  const free = WALK_MAX_PLAYERS - n;
  for (let i = 0; i < free; i++){
    crew.push(i === 0
      ? `<div class="crew-row is-free">nog ${free === 1 ? '1 plek' : free + ' plekken'} vrij</div>`
      : `<div class="crew-row is-free is-blank" aria-hidden="true"></div>`);
  }
  set('walkAutoCrew',
    `<div class="crew-list">${crew.join('')}</div>` +
    `<div class="crew-add">` +
      `<button type="button" class="ghost" disabled title="Bij Bots spelen doen alleen bots mee — zelf meedoen kan bij Zelf spelen">+ Speler</button>` +
      `<button type="button" class="ghost" data-auto-add="bot"${free === 0 ? ' disabled' : ''}>+ Bot</button>` +
    `</div>`);
  const humans = soloHumanCount, bots = soloBotCount;
  const who = (humans === 1 ? 'Jij' : `${humans} spelers`) + (bots ? ` + ${bots} bot${bots === 1 ? '' : 's'}` : '');
  set('walkSoloSummary', lobbySumHtml([
    ['Modus', 'Zelf spelen'], ['Spelers', who],
    ['Bots', bots ? lobbyOptText('walkSoloBotView') : 'geen bots'],
  ]));
  set('mpHostSummary', lobbySumHtml([
    ['Modus', 'Spel hosten'], ['Plekken', lobbyOptText('mpHostTotal')],
    ['Lege plekken', lobbyOptText('mpHostFillBots')], ['Bots', lobbyOptText('mpHostBotView')],
  ]));
}
['walkPlayers', 'walkEnergyMode', 'walkSoloBotView', 'mpHostTotal', 'mpHostFillBots', 'mpHostBotView'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', lobbyRenderSummary);
});
if (walkSpeedEl) walkSpeedEl.addEventListener('input', lobbyRenderSummary);
// ✕ / + Bot in de bemanningslijst van Automatisch: zet het verborgen #walkPlayers en laat de
// gewone 'change' de rest bijwerken (samenvatting, lijst)
function walkAutoSetCount(n){
  if (!walkPlayersSel || walkPlayersSel.disabled) return;
  walkPlayersSel.value = String(Math.max(1, Math.min(WALK_MAX_PLAYERS, n)));
  walkPlayersSel.dispatchEvent(new Event('change', { bubbles: true }));
}
const walkAutoCrewEl = document.getElementById('walkAutoCrew');
if (walkAutoCrewEl){
  walkAutoCrewEl.addEventListener('click', (e) => {
    const del = e.target.closest('[data-auto-del]');
    if (del && !del.disabled){
      walkAutoBotNames.splice(parseInt(del.dataset.autoDel, 10), 1);   // precies die bot eruit, de rest houdt zijn naam
      walkAutoSetCount(walkAutoBotNames.length);
      return;
    }
    const add = e.target.closest('[data-auto-add]');
    if (add && !add.disabled) walkAutoSetCount(parseInt(walkPlayersSel.value, 10) + 1);
  });
}
function setWalkMode(mode){
  stopWalkSimulation();
  stopSoloGame();
  const isAuto = mode === 'auto';
  const isSolo = mode === 'solo';
  const isMulti = mode === 'multi';
  if (walkModeAutoBtn){ walkModeAutoBtn.classList.toggle('active', isAuto); walkModeAutoBtn.setAttribute('aria-selected', String(isAuto)); }
  if (walkModeSoloBtn){ walkModeSoloBtn.classList.toggle('active', isSolo); walkModeSoloBtn.setAttribute('aria-selected', String(isSolo)); }
  if (walkModeMultiBtn){ walkModeMultiBtn.classList.toggle('active', isMulti); walkModeMultiBtn.setAttribute('aria-selected', String(isMulti)); }
  if (walkAutoControlsEl) walkAutoControlsEl.hidden = !isAuto;
  if (walkSoloControlsEl) walkSoloControlsEl.hidden = !isSolo;
  if (walkSoloSetupEl) walkSoloSetupEl.hidden = !isSolo;
  if (walkMultiControlsEl) walkMultiControlsEl.hidden = !isMulti;
  if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = true;
  if (walkAutoHintEl) walkAutoHintEl.hidden = !isAuto;
  if (walkSoloHintEl) walkSoloHintEl.hidden = !isSolo;
  if (walkMultiHintEl) walkMultiHintEl.hidden = !isMulti;
  // de twee "Start spel"-knoppen in de lobby (index.html, #walkLobby) — telkens maar één
  // zichtbaar, net als de instellingen erboven. Multiplayer heeft geen "Start spel"-knop:
  // die start via "Aanmaken"/"Verbinden" in #walkMultiControls zelf.
  if (btnWalkStart) btnWalkStart.hidden = !isAuto;
  // "Nieuw potje" (Zelf spelen) en Pauze/Stoppen (Automatisch) staan rechtsboven in de
  // tabbladenbalk; hun zichtbaarheid hangt van de modus af. Pauze/Stoppen worden verderop
  // bijgewerkt via walkFooterSyncVisibility() → walkPauseStopSyncVisibility() (96-walk.js).
  walkSoloResetSyncVisibility();
  if (walkLobbyStatusEl) walkLobbyStatusEl.innerHTML = '';
  // setWalkMode() is alleen bereikbaar terwijl de lobby al in beeld is (de modusknoppen zitten
  // erin) of net ná een multiplayer-potje (mpExitPlayView roept setWalkMode('multi') aan om
  // terug te keren naar de multiplayer-lobby, niet naar Automatisch) — dus altijd (opnieuw)
  // naar de lobby klappen kan hier geen kwaad, en repareert meteen de speelscherm-
  // zichtbaarheid die mpEnterPlayView() had omgezet.
  if (walkPlayAreaEl) walkPlayAreaEl.hidden = true;
  if (walkLobbyEl) walkLobbyEl.hidden = false;
  walkFooterSyncVisibility();   // walkPlayAreaEl.hidden wijzigde net hierboven, niet via walkFadeSwap()
  if (walkSoloPanelEl) walkSoloPanelEl.hidden = true;
  if (btnWalkSoloRoll) btnWalkSoloRoll.hidden = true;
  if (btnWalkSoloSkip) btnWalkSoloSkip.hidden = true;
  renderWalkBoard();
  if (walkDiceEl) walkDiceEl.innerHTML = '';
  if (walkMetaEl) walkMetaEl.innerHTML = '';
  if (walkScoreEl) walkScoreEl.innerHTML = '';
  if (walkScoreActiveEl) walkScoreActiveEl.innerHTML = '';
  if (walkStatusEl) walkStatusEl.innerHTML = '';
  if (walkLogEl) walkLogEl.innerHTML = '';
  if (isSolo) soloRebuildSetup();
  // #mpChatPanel's EIGEN hidden-attribuut (niet zichtbaarheid via een verborgen voorouder!)
  // bepaalt via :has() in styles.css of .walk-lobby-col verbreedt naar 1160px, de 2-koloms
  // indeling aangaat en #walkMultiHint verbergt. mpRenderLobby() (99-multiplayer.js) zet dat
  // attribuut alleen aan/uit op basis van mp.phase — die blijft "hosting"/"joining" ook als je
  // hierboven naar Automatisch/Zelf spelen wisselt (een lopende kamer overleeft dat bewust).
  // Zonder deze regel bleef #mpChatPanel dus "niet hidden" staan (alleen onzichtbaar doordat
  // de hele #walkMultiControls om 'm heen hidden is), en dachten die :has()-regels nog steeds
  // dat er chat te zien was — de kolom (en dus de modusknoppen erboven) bleef dan breed staan,
  // ook in Automatisch/Zelf spelen (gebruikersmelding: "de knoppen blijven zo lang"). Hier dus
  // expliciet dicht zodra je NIET in Multiplayer zit; mpRenderLobby() hieronder zet 'm gewoon
  // weer open zodra je terugkeert naar een kamer die nog loopt.
  if (!isMulti && mpChatPanelEl) mpChatPanelEl.hidden = true;
  // toont het juiste deelscherm (kiezen/hosten/deelnemen/wachten) op basis van mp.phase, dat
  // zelf ongemoeid blijft — een lopende kamer overleeft dus het heen-en-weer schakelen tussen
  // modi. mpRenderLobby() staat in 99-multiplayer.js, dat na dit bestand wordt samengevoegd;
  // veilig omdat functiedeclaraties over het hele script heen gehoist worden en setWalkMode()
  // pas ten tijde van een klik wordt aangeroepen, niet tijdens het laden.
  if (isMulti) mpRenderLobby();
  lobbyRenderSummary();
  lobbyPlaceFoot();
}

