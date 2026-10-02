// ---------- stap voor stap: zelf spelen (1 t/m 4 spelers, mix van mens/bot) ----------
// Jij dobbelt zelf, kiest zelf elke stap een aangrenzend vakje, en zet zelf een energie-actie
// of handkaart in. Hergebruikt dezelfde spelregels als de batch/auto-modus (resolveMove,
// ENERGY_ACTIONS, ACTION_CARDS, buildActionDeck, resolveRoundFinishers), maar zonder bot-AI
// voor JOUW beurten — de bot-beurten (als je die toevoegt) worden wél automatisch en meteen
// afgehandeld (`soloResolveBotTurn`, een niet-geanimeerde kopie van de bot-logica uit
// 96-walk.js), zodat jij niet op ze hoeft te wachten.
//
// Met 1 speler (geen bots) is er niemand die je blokkeert, en hebben Kortsluiting, Blinde Vlek,
// Duwstoot en Prioriteitspas allemaal een tegenstander nodig — die staan dan uit, net als
// Prioriteitspas ook in de bot-simulatie geen effect heeft. Zodra er wél andere spelers zijn
// (mens of bot) blokkeren jullie elkaars vakjes net als in "Automatisch", en werken die vier
// kaarten ook — met een doelwit dat JIJ zelf kiest via een klein keuzepaneel.
const WALK_SOLO_NO_OPPONENT_CARDS = ['short', 'blind', 'shove', 'scan',
  'lockdown', 'outage', 'barrier', 'recoil', 'jam'];

// Noodrantsoen (+3 energie) en Stuwlading (gratis 3e loopsteen) mag je OOK al vóór het
// dobbelen spelen, naast hun bestaande moment tijdens het lopen — net als een energie-actie
// (gebruikerswens). Zwaartekracht-laarzen (de gratis versie van de energie-actie: eerst
// rechtdoor, dan gooien) mag je ALLEEN vóór het dobbelen spelen. Alle andere kaarten blijven
// alleen tijdens 'moving' speelbaar; zie soloCardBlockReason/soloPlayCard hieronder.
const SOLO_PRE_ROLL_CARDS = ['ration', 'boostcell', 'boots'];

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
const walkSoloPlayersSel = document.getElementById('walkSoloPlayers');
const walkSoloBotsSel = document.getElementById('walkSoloBots');
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
const walkCardVaultEl = document.getElementById('walkCardVault');
const walkCardVaultThumbsEl = document.getElementById('walkCardVaultThumbs');
const walkCardVaultCountEl = document.getElementById('walkCardVaultCount');
const walkCardVaultHintEl = document.getElementById('walkCardVaultHint');
const walkCardActionsEl = document.getElementById('walkCardActions');
const cardOverlayEl = document.getElementById('cardOverlay');
const cardGridEl = document.getElementById('cardGrid');
const cardPanelHintEl = document.getElementById('cardPanelHint');
const cardPanelClose = document.getElementById('cardPanelClose');
const btnCardPlay = document.getElementById('btnCardPlay');
const btnCardDiscard = document.getElementById('btnCardDiscard');
const btnCardCancel = document.getElementById('btnCardCancel');
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
const PULSE_DURATION_MS = 1900;   // moet gelijk blijven aan axPulse/walkRoomPulse in styles.css
// ecellSpend: het knipperen van de energiecellen die een actie gaat kosten — ook op één ritme,
// anders knipperen net bijgekomen cellen uit de pas met de rest
const PULSE_ANIMATIONS = new Set(['axPulse', 'axPulseBtn', 'walkRoomPulse', 'ecellSpend']);
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

function soloSyncBotOptions(){
  if (!walkSoloPlayersSel || !walkSoloBotsSel) return;
  const total = Math.max(1, Math.min(WALK_MAX_PLAYERS, parseInt(walkSoloPlayersSel.value, 10) || 1));
  const maxBots = Math.max(0, total - 1);
  const prev = parseInt(walkSoloBotsSel.value, 10);
  const opts = [];
  for (let b = 0; b <= maxBots; b++){
    opts.push(`<option value="${b}">${b === 0 ? 'geen bots' : b + (b === 1 ? ' bot' : ' bots')}</option>`);
  }
  walkSoloBotsSel.innerHTML = opts.join('');
  // standaard: alle overige plekken zijn bots (dus "speel tegen bots") — lager zetten geeft
  // plek aan medespelers op hetzelfde scherm ("1 tegen 1 tegen een vriend" = 2 spelers, 0 bots)
  walkSoloBotsSel.value = Number.isFinite(prev) && prev <= maxBots ? String(prev) : String(maxBots);
}

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
  const total = Math.max(1, Math.min(WALK_MAX_PLAYERS, parseInt(walkSoloPlayersSel ? walkSoloPlayersSel.value : '1', 10) || 1));
  const bots = Math.max(0, Math.min(total - 1, parseInt(walkSoloBotsSel ? walkSoloBotsSel.value : '0', 10) || 0));
  const humanCount = total - bots;

  soloSetupRand = mulberry32(Math.floor(Math.random() * 4294967296));
  soloSetupPlayers = [];
  for (let i = 0; i < total; i++){
    const isHuman = i < humanCount;   // eerste plekken zijn mens, de rest bot
    soloSetupPlayers.push({
      idx: i,
      isHuman,
      name: isHuman ? soloSeatName(i) : `Speler ${i + 1}`,
      color: WALK_PLAYER_COLORS[i],
      deck: simShuffle(SIM_QUEST_LABELS, soloSetupRand),
      nextIdx: 0, completed: 0, myTurn: 0, energy: 0, cards: [], rank: 0, doneCells: [], condenserPending: false,
      lockedNextTurn: false, rollPenalty: 0, barrierCell: null, reorderBlocked: false, lastDir: -1,
      strategy: isHuman ? null : ENERGY_STRATEGIES[i % ENERGY_STRATEGIES.length],
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
  const botViewField = walkSoloBotViewSel && walkSoloBotViewSel.closest('.field');
  if (botViewField) botViewField.hidden = bots === 0;
}

function soloRenderSetupUI(){
  if (!walkSoloSetupEl) return;
  const humans = soloSetupHumans();
  if (!humans.length){
    walkSoloSetupEl.innerHTML = '';
    if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = true;
    return;
  }
  // Twee kolommen (zie .walk-solo-setup in styles.css) i.p.v. alles onder elkaar — nieuwe
  // spelers komen zo naast elkaar te staan, niet eronder, en de lobby-kolom verspringt daardoor
  // hooguit één keer (bij de 3e speler) i.p.v. bij elke speler opnieuw (gebruikerswens).
  // Alleen de speler en zijn naam: startpositie en eerste opdracht komen pas aan het begin van
  // het potje (soloBeginOpening) — in de lobby kon je toch niet zien waar die kamer ligt.
  walkSoloSetupEl.innerHTML = humans.map(p =>
    `<div class="walk-solo-setup-player" style="--pc:${p.color}">` +
      `<span class="walk-solo-setup-row1">` +
        `<span class="walk-solo-setup-dot"></span>` +
        `<input type="text" class="walk-solo-setup-input" data-name-seat="${p.idx}"` +
          ` value="${soloCustomNames[p.idx] || ''}" maxlength="18" spellcheck="false"` +
          ` placeholder="Speler ${p.idx + 1}" aria-label="Naam van speler ${p.idx + 1}">` +
      `</span>` +
    `</div>`
  ).join('');
  if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = false;
}
if (walkSoloSetupEl){
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
if (walkSoloPlayersSel) walkSoloPlayersSel.addEventListener('change', () => { soloSyncBotOptions(); soloRebuildSetup(); });
if (walkSoloBotsSel) walkSoloBotsSel.addEventListener('change', soloRebuildSetup);

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
// 'rolling' | 'moving' | 'boots-direction' | 'reorder-peek' | 'jump-target' | 'game-over'
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
let soloTargetSwapped = false;  // Herkalibratie (kaart) en Herprioritering (energie) doen dezelfde
                                 // doelwissel — zodra de een 'm deze beurt al deed, blokkeert dit de ander
let soloPendingBoost = false;   // Stuwstoot/Stuwlading: deze beurt een 3e loopsteen
let soloUsedBoots = false;
let soloAllowUturn = false;   // Snelroute: geen-U-turn-regel geldt deze beurt niet voor jou
let soloLockedThisTurn = false; // Vergrendeling: deze beurt geen energie- en kaartactie
let soloUsedJump = false;
let soloActionCellDrawnThisTurn = false;  // hooguit 1 beloningskaart per beurt via een actiekaartvakje
// hoeveel opdrachten deze beurt al onderweg gebankt zijn (normaal 0 of 1, zelden 2 — zie
// soloBankCurrentQuest): de beurt stopt er niet meer voor, dus dit bepaalt straks alleen nog of
// het einde van de beurt "onderweg naar X" moet loggen of gewoon stil mag afronden
let soloBankCountThisTurn = 0;
let soloBootsOptions = [];
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
  const occ = new Set(soloOthers().map(p => p.pos));
  // Noodbarrière die tegen JOU is ingezet: telt deze beurt als een bezet vakje
  const me = solo();
  if (me && me.barrierCell !== null) occ.add(me.barrierCell);
  return occ;
}

// ---------- modus wisselen ----------
// Drie modi sinds multiplayer geen eigen tabblad meer heeft, maar een derde knop hier
// (gebruikerswens) — mode is 'auto' | 'solo' | 'multi'. Let op bij toekomstige aanpassingen:
// met drie modi is "niet auto" niet meer hetzelfde als "solo" — regels die specifiek de
// solo-opzet-UI aan/uit zetten moeten dus op `!isSolo` testen, niet op `isAuto`/`!isAuto`
// (dat ging hier eerder mis: de solo-knoppenrij en "Start spel" bleven staan zodra multiplayer
// als derde modus werd toegevoegd, vóórdat dat hier werd rechtgezet).
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
}

// ---------- bord: welke vakjes zijn nu aanklikbaar ----------
function soloClearClickable(){
  if (!walkBoardEl) return;
  for (const el of walkBoardEl.querySelectorAll('.walk-clickable')){
    el.classList.remove('walk-clickable');
    delete el.dataset.key;
  }
}
function soloMarkClickable(graph, keys){
  soloClearClickable();
  for (const k of keys){
    const el = walkCellDiv(graph, k);
    el.classList.add('walk-clickable');
    el.dataset.key = k;
  }
}

if (walkBoardEl){
  walkBoardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.walk-clickable');
    if (!el) return;
    const key = parseInt(el.dataset.key, 10);
    if (soloPhase === 'moving') soloHandleMoveClick(key);
    else if (soloPhase === 'jump-target') soloHandleJumpClick(key);
    else if (soloPhase === 'boots-direction') soloHandleDashCellClick(key);
    else if (soloPhase === 'opening-pick') soloOpeningPick(key);
  });
}

// welke vervolgstappen mag je zetten vanaf `pos`, gegeven de richting van je vorige stap
// (-1 = eerste stap van de beurt, geen beperking) — zelfde geen-U-turn-regel als resolveMove().
// `occupied` sluit vakjes uit waar een andere nog-meespelende speler op staat (blokkeren).
function soloLegalNextCells(graph, pos, lastDir, occupied){
  const neigh = graph.adjKey[pos], dirs = graph.adjDir[pos];
  const out = [];
  for (let j = 0; j < neigh.length; j++){
    const d = dirs[j];
    if (!soloAllowUturn && lastDir !== -1 && d === (lastDir + 2) % 4) continue;
    if (occupied && occupied.has(neigh[j])) continue;
    out.push({ key: neigh[j], dir: d });
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
  const p = solo();
  if (!p) return null;
  return walkOrderPlayers(soloPlayers).findIndex(q => q.idx === p.idx) + 1;
}
// 3 kleine tegels bovenin het Spelerstatus-vakje. Hangt aan renderSoloMeta zodat hij overal
// meeloopt waar de rest van je beurtinfo ook al opnieuw getekend wordt.
function soloRenderStatusExtras(){
  const p = solo();
  // tijdens het dobbelen aan het begin (soloBeginOpening) is je opdracht nog geheim — dan ook
  // geen opdrachtenoverzicht dat "Actief" bij je eerste opdracht zet
  if (!p || !walkStatTilesEl || p.questHidden){
    if (walkStatTilesEl) walkStatTilesEl.innerHTML = '';
    if (walkQuestChecklistEl) walkQuestChecklistEl.innerHTML = '';
    return;
  }
  const rank = soloLiveRank();
  walkStatTilesEl.innerHTML =
    `<div class="walk-stat-tile"><span class="walk-stat-tile-num">${p.completed}/${SIM_QUESTS_TO_WIN}</span><span class="walk-stat-tile-lbl">voltooid</span></div>` +
    `<div class="walk-stat-tile"><span class="walk-stat-tile-num">${p.myTurn}</span><span class="walk-stat-tile-lbl">beurt</span></div>` +
    `<div class="walk-stat-tile"><span class="walk-stat-tile-num">${walkRankLabel(rank)}</span><span class="walk-stat-tile-lbl">positie</span></div>`;
  soloRenderQuestChecklist();
}
// opdrachtenoverzicht links van het bord: alle 9 opdrachten (2.1-2.9), altijd in dezelfde
// volgorde als QUEST_NAMES zelf — dus NIET de (geheime) volgorde van je eigen stapeltje. Dat is
// bewust: Herprioritering/Herkalibratie ruilen je huidige doel "blind" met je eerstvolgende
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
  soloPeekReset();
  const p = solo();
  if (!p){ walkQuestChecklistEl.innerHTML = ''; return; }
  const done = new Set(p.deck.slice(0, p.nextIdx));
  const current = p.rank ? null : p.deck[p.nextIdx];
  walkQuestChecklistEl.innerHTML = Object.keys(QUEST_NAMES).map(label => {
    const isDone = done.has(label);
    const isCurrent = label === current;
    const cls = 'quest-check-row' + (isDone ? ' is-done' : '') + (isCurrent ? ' is-current' : '');
    const style = isCurrent ? ` style="--qtint:${questTint(label)}"` : '';
    // kamernaam erbij (gebruikerswens) — zelfde opzoekmethode als de grote opdrachtkaart
    // ernaast (renderWalkQuestCard in 96-walk.js): via findLabelTile/ROOM_NAMES, verandert dus
    // automatisch mee als de indeling ooit wijzigt.
    const tid = findLabelTile(label);
    const room = tid !== null ? (ROOM_NAMES[tid] || ('Gang ' + tid)) : '—';
    return `<div class="${cls}"${style} data-label="${label}">` +
      `<span class="quest-check-label">${label}</span>` +
      `<span class="quest-check-text">` +
        `<span class="quest-check-name">${QUEST_NAMES[label]}</span>` +
        `<span class="quest-check-room">${room}</span>` +
      `</span>` +
      (isDone ? `<span class="quest-check-done">✓ Voltooid!</span>` : '') +
      (isCurrent ? `<span class="quest-check-active">Actief</span>` : '') +
    `</div>`;
  }).join('');
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
const ENERGY_CELL_CHARGE_MS = 520;   // = duur van ecellCharge in styles.css
const ENERGY_CELL_DRAIN_MS = 380;    // = duur van ecellDrain in styles.css
function soloRenderEnergyOverview(){
  if (!walkEnergyOverviewEl || !walkEnergyCellsEl) return;
  const p = solo();
  const energy = p ? Math.max(0, Math.min(ENERGY_MAX, p.energy)) : 0;
  const samePlayer = !!p && soloEnergyShown.idx === p.idx;
  const prev = samePlayer ? soloEnergyShown.energy : energy;
  walkEnergyOverviewEl.classList.toggle('is-full', energy >= ENERGY_MAX);
  walkEnergyValueEl.textContent = energy;
  const fresh = walkEnergyCellsEl.children.length !== ENERGY_MAX;
  if (fresh){
    walkEnergyCellsEl.innerHTML = Array.from({ length: ENERGY_MAX }, () => '<span class="ecell"><i></i></span>').join('');
  }
  // Deze functie loopt bij elke stap/klik mee (via renderSoloMeta). Is er niets veranderd, dan
  // de cellen met rust laten — anders werd een lopende oplaad-/ontlaadanimatie bij de eerste
  // stap meteen afgebroken (gebruikersmelding: "animatie moet gewoon helemaal afspelen").
  if (!fresh && samePlayer && energy === prev) return;
  soloEnergyShown = { idx: p ? p.idx : -1, energy };
  [...walkEnergyCellsEl.children].forEach((cell, i) => {
    const on = i < energy;
    const charging = on && i >= prev;
    const draining = !on && i < prev;
    cell.classList.toggle('is-on', on);
    cell.classList.remove('is-charging', 'is-draining', 'will-spend');
    if (charging || draining){
      void cell.offsetWidth;   // animatie opnieuw laten starten, ook als de klasse er net al op zat
      // strikt na elkaar (gebruikerswens): opladen van links naar rechts, de volgende cel pas als
      // de vorige vol is; uitgeven in omgekeerde volgorde, de laatste cel eerst. Duur gelijk aan
      // ecellCharge/ecellDrain in styles.css.
      cell.style.animationDelay = charging
        ? `${(i - prev) * ENERGY_CELL_CHARGE_MS}ms`
        : `${(prev - 1 - i) * ENERGY_CELL_DRAIN_MS}ms`;
      cell.classList.add(charging ? 'is-charging' : 'is-draining');
    }
  });
}
// Animatieklassen weg zodra de animatie klaar is. Anders bleef bv. .is-charging op de laatst
// opgeladen cel staan, en startte het opladen opnieuw zodra de kostenpreview (.will-spend, die
// tijdelijk een andere animatie op dezelfde cel zet) weer verdween (gebruikersmelding: "het
// laatste blokje gaat ineens opnieuw aan"). ecellFlash is de langste van de oplaadanimaties.
if (walkEnergyCellsEl){
  walkEnergyCellsEl.addEventListener('animationend', (e) => {
    const cell = e.target.closest('.ecell');
    if (!cell) return;
    if (e.animationName === 'ecellFlash') cell.classList.remove('is-charging');
    if (e.animationName === 'ecellDrain') cell.classList.remove('is-draining');
  });
}
// laatste `cost` gevulde cellen oplichten = wat deze actie zou kosten (null = preview weg)
function soloPreviewEnergyCost(cost){
  if (!walkEnergyCellsEl) return;
  const energy = soloEnergyShown.energy;
  [...walkEnergyCellsEl.children].forEach((cell, i) => {
    cell.classList.toggle('will-spend', cost !== null && i < energy && i >= energy - cost);
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
  });
  walkSoloActionsEl.addEventListener('mouseleave', () => soloPreviewEnergyCost(null));
}
function soloRefreshTarget(){
  const p = solo();
  const label = p.deck[p.nextIdx];
  soloTargetKey = soloGraph.questCells[label];
  markWalkTarget(soloGraph, label, soloTargetKey, p.color);
  renderWalkQuestCard(label);
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
  const p = solo();
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
  const p = solo();
  // geen lopend potje (meer) of niemand aan zet: gewoon leeg laten i.p.v. soloRefreshTarget()
  // aanroepen, die anders op p.deck[p.nextIdx] van een niet-bestaande speler zou struikelen.
  if (!p || !soloGraph || p.rank) { clearWalkTarget(); return; }
  soloRefreshTarget();
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

// ---------- actiepaneel (begin van de beurt) ----------
function renderEnergySoloButton(id, disabled, reason){
  const act = ENERGY_ACTIONS[id];
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
  return `<button type="button" class="energy-pick${disabled ? ' is-disabled' : ''}${pulse ? ' walk-pulse-affordable' : ''}" data-energy="${id}"${disabled ? ' disabled' : ''} title="${title}">
    <span class="energy-pick-cost">⚡${act.cost}</span>
    <span class="energy-pick-text">
      <b>${act.name}</b>
      <span>${reason || act.hint}</span>
    </span>
  </button>`;
}
// De 'choose-action'-fase toont ALLEEN de energie-acties — die moet je immers vóór het dobbelen
// inzetten. De meeste kaarten spelen/afleggen kan pas ná het dobbelen, vóór of tijdens het
// stappen zetten (via het kaartvenster, zie hieronder) — behalve Noodrantsoen/Stuwlading, die
// mogen ook al hier (zie SOLO_PRE_ROLL_CARDS/soloCardBlockReason), maar die tonen we via de
// kaartkluis (#walkCardVault) net als anders, niet in dit energiepaneel.
function soloRenderActionPanel(){
  if (!walkSoloActionsEl) return;
  const p = solo();
  // Stuwlading (kaart) kan nu ook al vóór het dobbelen gespeeld zijn — sluit Stuwstoot dan uit,
  // spiegel van de check aan de kaart-kant in soloCardBlockReason (allebei een gratis 3e steen).
  const boostcellUsed = soloUsedCardId === 'boostcell';
  // volgorde oplopend op kosten (gebruikerswens: de goedkoopste actie bovenaan)
  const ids = ['boost', 'reorder', 'gravity', 'jump'].sort((a, b) => ENERGY_ACTIONS[a].cost - ENERGY_ACTIONS[b].cost);
  // waarom kan een actie nu niet (naast te weinig energie)? Zelfde paren als in de simulatie:
  // Stuwlading/Stuwstoot en de laarzen-kaart/-actie sluiten elkaar uit.
  const blockReason = (id) => {
    if (id === 'boost' && boostcellUsed) return 'je hebt deze beurt al Stuwlading gespeeld';
    if (id === 'gravity' && soloUsedBoots) return 'je hebt deze beurt al gesprint';
    if (id === 'gravity' && !soloDashOptions().length) return 'in geen enkele richting ruimte';
    return undefined;
  };
  const locked = (id) => p.energy < ENERGY_ACTIONS[id].cost || !!blockReason(id);
  const energyBtns = ids.map(id => renderEnergySoloButton(id, locked(id), blockReason(id))).join('');
  // Kun je er geen enkele betalen, zeg dat dan met zoveel woorden — uitgegrijsde rijen
  // zien er anders uit alsof het paneel stuk is. Bewust één korte regel: met 4 acties paste de
  // oude zin van twee regels niet meer in het vaste vak (.walk-solo-panel) en moest je scrollen
  // bij 0–3 energie, dus bijna elke beurt aan het begin van een potje (gebruikersmelding).
  const allLocked = ids.every(locked);
  const note = allLocked
    ? `<p class="hint energy-pick-none">Te weinig energie voor een actie — gooi gewoon.</p>`
    : '';
  walkSoloActionsEl.innerHTML = `<div class="energy-pick-list">${energyBtns}</div>${note}`;
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
    else if (soloPhase === 'reorder-peek' && btn.dataset.reorder) soloResolveReorder(btn.dataset.reorder === 'swap');
  });
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
// Duwstoot verschuift een blokkade, na Herkalibratie verandert het doel, na Stuwlading is er
// extra stepsLeft.
function soloAfterCardAction(){
  soloAdvanceMovePhase();
}
function soloDiscardCard(id){
  if (soloCardActionUsed()) return;
  if (mpIntercept('discardCard', { id })) return;
  const p = solo();
  useActionCard(p, id, soloDeck);
  // useActionCard telt elke kaart als "gespeeld" — deze is afgelegd
  if (p.stats){ p.stats.cardsPlayed--; p.stats.cardsDiscarded++; }
  soloDiscardedCardId = id;
  walkLog(`Je legt <b>${ACTION_CARDS[id].name}</b> af.`, null, p);
  soloAfterCardAction();
}
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
  // Noodrantsoen/Stuwlading mogen ook al vóór het dobbelen (choose-action) — net als een
  // energie-actie. Alle andere kaarten blijven alleen tijdens het lopen speelbaar.
  const preRollOk = soloPhase === 'choose-action' && SOLO_PRE_ROLL_CARDS.includes(id);
  if (id === 'boots' && soloPhase !== 'choose-action') return 'alleen vóór het dobbelen';
  if (soloPhase !== 'moving' && !preRollOk) return 'kan pas nadat je hebt gedobbeld';
  if (soloCardActionUsed()) return 'je hebt deze beurt al een kaart gebruikt';
  // één sprint per beurt: de kaart en de energie-actie Zwaartekracht-laarzen sluiten elkaar uit
  if (id === 'boots' && soloUsedBoots) return 'je hebt deze beurt al gesprint';
  if (id === 'boots' && !soloDashOptions().length) return 'in geen enkele richting ruimte';
  // Blinde Vlek is puur reactief: die krijg je vanzelf aangeboden op het moment dat je zet
  // daadwerkelijk op een tegenstander stukloopt (zie soloOfferBlindSpot)
  if (id === 'blind') return 'wordt vanzelf aangeboden zodra je route geblokkeerd raakt';
  if (soloPlayers.length === 1 && WALK_SOLO_NO_OPPONENT_CARDS.includes(id)) return 'geen tegenstanders in dit potje';
  if (id === 'shove' && !soloShoveTargets().length) return 'geen tegenstander naast je om weg te duwen';
  if ((id === 'scan' || id === 'short') && !soloOthers().length) return 'geen tegenstanders meer over';
  if (id === 'ration' && p.energy >= ENERGY_MAX) return 'je energie zit al vol';
  if (id === 'recal' && soloTargetSwapped) return 'je doel is deze beurt al gewisseld';
  // Stuwlading (kaart) en Stuwstoot (energie) zijn allebei een gratis 3e loopsteen — samen
  // zouden ze een 4e opleveren, dus sluiten ze elkaar uit ook al zitten ze op losse sloten
  // (zelfde regel als in 95-simulate.js/96-walk.js)
  if (id === 'boostcell' && soloUsedEnergyId === 'boost') return 'je hebt deze beurt al Stuwstoot ingezet';
  if (id === 'condenser' && p.condenserPending) return 'er staat al een Condensator klaar';
  // "Gooi je worp opnieuw" kan alleen zolang je nog geen stap hebt gezet
  if (id === 'reroll' && soloMove && soloMove.stepsLeft !== soloMove.roll) return 'je bent al begonnen met lopen';
  // de nieuwe hinder-kaarten hebben allemaal een geldig doelwit nodig
  if (SOLO_TARGET_PICKER_LABELS[id] && !soloTargetPickerTargets(id).length){
    if (id === 'recoil') return 'geen tegenstander naast je die net gelopen heeft';
    if (id === 'barrier') return 'geen vrij vakje naast een tegenstander';
    return 'geen tegenstander om dit op te spelen';
  }
  if (id === 'lockdown' && soloOthers().every(q => q.lockedNextTurn)) return 'iedereen is al vergrendeld';
  if (id === 'outage' && soloOthers().every(q => q.rollPenalty > 0)) return 'iedereen is al onderbroken';
  if (id === 'jam' && soloOthers().every(q => q.reorderBlocked)) return 'iedereen is al gestoord';
  if (id === 'trade' && !soloDeck.discard.length) return 'de aflegstapel is leeg';
  if (id === 'peek' && !soloDeck.draw.length) return 'de trekstapel is leeg';
  // Snelroute grijpt op je eigen worp in, dus alleen zolang je nog niet gelopen hebt
  if (id === 'fastlane' && soloMove && soloMove.stepsLeft !== soloMove.roll) return 'je bent al begonnen met lopen';
  return null;
}
// afleggen mag met ELKE kaart in de hand (het kaart-slot is het enige dat telt, niet of de
// kaart nu nuttig is) — maar wel pas ná de worp, net als spelen
function soloCanDiscardNow(){ return soloPhase === 'moving' && !soloCardActionUsed(); }

// ---------- de kaartkluis onder de dobbelstenen ----------
function soloRefreshCardVault(){
  // de kaarten wonen nu in het venster; deze strook is alleen nog voor energie-acties.
  // walkCardActionsEl (vervolgkeuze van een gespeelde kaart) is een apart vakje bij de
  // kaartkluis hieronder, maar deelt dezelfde opruim-voorwaarde als vangnet voor het geval een
  // aanroeper 'm zelf niet al expliciet leegde.
  if (soloPhase === 'moving' || soloPhase === 'rolling'){
    if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
    soloClearCardActionsPanel();
  }
  if (!walkCardVaultEl) return;
  const p = solo();
  const cards = p && !p.rank ? p.cards : [];
  if (!cards.length || soloPhase === 'idle' || soloPhase === 'game-over'){
    walkCardVaultEl.hidden = true;
    if (cardOverlayEl && !cardOverlayEl.hidden) soloCloseCardPanel();
    return;
  }
  walkCardVaultEl.hidden = false;
  walkCardVaultThumbsEl.innerHTML = cards.map(id => ACTION_CARD_IMAGES[id]
    ? `<img src="${ACTION_CARD_IMAGES[id]}" alt="${ACTION_CARDS[id].name}">`
    : `<span class="walk-card-vault-blank action-card--${ACTION_CARD_TINTS[id]}" title="${ACTION_CARDS[id].name}"></span>`).join('');
  walkCardVaultCountEl.textContent = cards.length === 1 ? '1 actiekaart' : `${cards.length} actiekaarten`;
  const playable = cards.filter(id => !soloCardBlockReason(id)).length;
  walkCardVaultHintEl.textContent = playable
    ? `${playable} speelbaar — klik om te bekijken →`
    : 'geen speelbaar op dit moment — klik om te bekijken →';
  walkCardVaultEl.classList.toggle('walk-pulse-affordable', playable > 0);
  if (playable > 0) syncPulse(walkCardVaultEl);
  if (cardOverlayEl && !cardOverlayEl.hidden) soloRenderCardGrid();
}

// ---------- het kaartvenster ----------
let soloSelectedCard = null;

function soloOpenCardPanel(){
  // solo() ("wie is aan zet") is in multiplayer niet per se "ik" — dit paneel speelt/legt af
  // via solo(), dus buiten je eigen beurt zou het hier andermans hand tonen. Alleen openen als
  // het echt mijn beurt is (dan is solo() toch al gelijk aan mezelf, dus de rest hieronder
  // blijft ongewijzigd bruikbaar); de kaartkluis zelf (mpRefreshCardVault) toont je hand sowieso
  // altijd, ook buiten je beurt — alleen dit interactieve spelen/afleggen-paneel niet.
  if (mp.active && mp.phase === 'in-game'){
    const owner = soloPlayers[soloActiveIdx];
    if (!owner || owner.peerId !== mp.myPeerId) return;
  }
  const p = solo();
  if (!p || !p.cards.length || !cardOverlayEl) return;
  soloSelectedCard = null;
  cardOverlayEl.hidden = false;
  soloRenderCardGrid();
}
function soloCloseCardPanel(){
  if (!cardOverlayEl) return;
  cardOverlayEl.hidden = true;
  soloSelectedCard = null;
}
function soloRenderCardGrid(){
  const p = solo();
  if (!p || !p.cards.length){ soloCloseCardPanel(); return; }
  if (soloSelectedCard && !p.cards.includes(soloSelectedCard)) soloSelectedCard = null;

  cardGridEl.innerHTML = p.cards.map(id => {
    const reason = soloCardBlockReason(id);
    const cls = `card-pick action-card--${ACTION_CARD_TINTS[id]}`
      + (soloSelectedCard === id ? ' is-selected' : '')
      + (reason ? ' is-locked' : '');
    return `<button type="button" class="${cls}" data-pick="${id}" title="${ACTION_CARDS[id].name} — ${ACTION_CARDS[id].hint}">
      ${renderPrintedCardFace(id)}
      ${reason ? `<span class="card-pick-reason">${reason}</span>` : ''}
    </button>`;
  }).join('');

  const blocked = soloSelectedCard ? soloCardBlockReason(soloSelectedCard) : 'niets geselecteerd';
  btnCardPlay.disabled = !!blocked;
  btnCardDiscard.disabled = !soloSelectedCard || !soloCanDiscardNow();
  cardPanelHintEl.textContent =
    soloPhase === 'moving' ? (soloCardActionUsed()
      ? 'Je hebt deze beurt al een kaart gebruikt.'
      : 'Kies één kaart. Per beurt mag je er hooguit één spelen of afleggen.')
    : soloPhase === 'choose-action' ? (soloCardActionUsed()
      ? 'Je hebt deze beurt al een kaart gebruikt.'
      : 'Vóór het dobbelen kun je alleen Noodrantsoen of Stuwlading spelen — de rest kan pas nadat je hebt gedobbeld. Afleggen kan ook nog niet.')
    : 'Je kunt pas een kaart spelen of afleggen nadat je hebt gedobbeld.';
}
if (cardGridEl){
  cardGridEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-pick]');
    if (!btn) return;
    // ook een niet-speelbare kaart mag je selecteren — afleggen kan namelijk altijd
    soloSelectedCard = soloSelectedCard === btn.dataset.pick ? null : btn.dataset.pick;
    soloRenderCardGrid();
  });
}
if (btnCardPlay) btnCardPlay.addEventListener('click', () => {
  const id = soloSelectedCard;
  if (!id || soloCardBlockReason(id)) return;
  soloCloseCardPanel();          // eerst sluiten: sommige kaarten openen zelf een keuzepaneel
  soloPlayCard(id);
});
if (btnCardDiscard) btnCardDiscard.addEventListener('click', () => {
  const id = soloSelectedCard;
  if (!id || !soloCanDiscardNow()) return;
  soloCloseCardPanel();
  soloDiscardCard(id);
});
if (btnCardCancel) btnCardCancel.addEventListener('click', soloCloseCardPanel);
if (cardPanelClose) cardPanelClose.addEventListener('click', soloCloseCardPanel);
if (walkCardVaultEl) walkCardVaultEl.addEventListener('click', soloOpenCardPanel);
if (cardOverlayEl) cardOverlayEl.addEventListener('click', (e) => {
  if (e.target === cardOverlayEl) soloCloseCardPanel();   // klik naast het venster sluit het
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && cardOverlayEl && !cardOverlayEl.hidden) soloCloseCardPanel();
});

// ---------- doelwit kiezen: alle kaarten die een tegenstander aanwijzen ----------
const SOLO_TARGET_PICKER_LABELS = {
  short: 'Kortsluiting', shove: 'Duwstoot', scan: 'Prioriteitspas',
  lockdown: 'Vergrendeling', outage: 'Stroomonderbreking', barrier: 'Noodbarrière',
  recoil: 'Terugtrekbevel', jam: 'Signaalstoring',
};
function soloBarrierTargets(){
  const occNow = soloOccupied();
  return soloOthers().filter(p => soloGraph.adjKey[p.pos].some(k => !occNow.has(k) && k !== solo().pos));
}
// Terugtrekbevel duwt ACHTERUIT langs victim.lastDir (max 2 stappen, stopt bij bezetting) —
// dat is een andere richting/bestemming dan Duwstoot (vooruit, willekeurige richting). Gedeeld
// door de doelwit-kiezer hieronder (welke aangrenzende spelers hébben er ruimte om terug te
// gaan?) en de daadwerkelijke uitvoering in soloResolveTargetCard, zodat beide nooit uit de pas
// kunnen lopen. `extraCell` is de cel van de speler die de kaart speelt: die telt ook als bezet
// (dezelfde regel als de oorspronkelijke inline versie hieronder had).
function soloRecoilSteps(victim, extraCell){
  if (victim.lastDir === -1) return { steps: 0, toKey: victim.pos };
  const revDir = (victim.lastDir + 2) % 4;
  const occNow = soloOccupied();
  if (extraCell !== undefined) occNow.add(extraCell);
  let cur = victim.pos, steps = 0;
  for (let s = 0; s < 2; s++){
    const dirs = soloGraph.adjDir[cur], keys = soloGraph.adjKey[cur];
    let nextKey = -1;
    for (let j = 0; j < dirs.length; j++) if (dirs[j] === revDir){ nextKey = keys[j]; break; }
    if (nextKey === -1 || occNow.has(nextKey)) break;
    cur = nextKey; steps++;
  }
  return { steps, toKey: cur };
}
function soloRecoilTargets(){
  const p = solo();
  const neigh = new Set(soloGraph.adjKey[p.pos]);
  return soloOthers().filter(v => neigh.has(v.pos) && v.lastDir !== -1 && soloRecoilSteps(v, p.pos).steps > 0);
}
function soloTargetPickerTargets(cardId){
  if (cardId === 'shove') return soloShoveTargets();
  if (cardId === 'recoil') return soloRecoilTargets();
  if (cardId === 'barrier') return soloBarrierTargets();
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
  if (cardOverlayEl && !cardOverlayEl.hidden) soloCloseCardPanel();
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
        <span class="action-card-hint">${t.startLabel} · ${t.completed}/${SIM_QUESTS_TO_WIN}</span>
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
  } else if (cardId === 'scan'){
    const label = victim.deck[victim.nextIdx];
    walkLog(`Je speelt <b>Prioriteitspas</b>: ${victim.name}'s volgende opdracht is <b>${label} — ${QUEST_NAMES[label] || ''}</b>.`, null, p);
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
    walkLog(`Je speelt <b>Vergrendeling</b> op ${victim.name}: die mist zijn volgende energie- én kaartactie.`, null, p);
    soloAfterCardAction();
  } else if (cardId === 'outage'){
    victim.rollPenalty = 2;
    walkLog(`Je speelt <b>Stroomonderbreking</b> op ${victim.name}: die gooit 2 stappen minder.`, null, p);
    soloAfterCardAction();
  } else if (cardId === 'barrier'){
    const occNow = soloOccupied(); occNow.add(p.pos);
    const spot = soloGraph.adjKey[victim.pos].find(k => !occNow.has(k));
    if (spot !== undefined){
      victim.barrierCell = spot;
      walkLog(`Je speelt <b>Noodbarrière</b> naast ${victim.name}.`, null, p);
    } else {
      walkLog(`Je speelt <b>Noodbarrière</b>, maar er was geen lege plek naast ${victim.name}.`, null, p);
    }
    soloAfterCardAction();
  } else if (cardId === 'recoil'){
    const { steps, toKey } = soloRecoilSteps(victim, p.pos);
    if (steps > 0){
      victim.pos = toKey;
      walkLog(`Je speelt <b>Terugtrekbevel</b> op ${victim.name} en duwt die ${steps} vakje(s) terug.`, null, p);
    } else {
      walkLog(`Je speelt <b>Terugtrekbevel</b> op ${victim.name}, maar er was geen ruimte om terug te duwen.`, null, p);
    }
    paintWalkPawns(soloGraph, soloPlayers, p.idx);
    soloAfterCardAction();
  } else if (cardId === 'jam'){
    victim.reorderBlocked = true;
    walkLog(`Je speelt <b>Signaalstoring</b> op ${victim.name}: diens eerstvolgende doelwissel mislukt.`, null, p);
    soloAfterCardAction();
  }
}

// Meestal aangeroepen tijdens het lopen (ná de worp), vanuit het kaartvenster — behalve
// Noodrantsoen/Stuwlading, die mogen ook al vóór het dobbelen (zie SOLO_PRE_ROLL_CARDS), en
// worden dan hieronder als allereerste apart afgehandeld.
function soloPlayCard(id){
  if (mpIntercept('playCard', { id })) return;
  // tijdens het kiezen van een doelwit is de vorige kaart al gespeeld (kaart-slot op)
  if (soloPhase === 'target-pick') return;
  const p0 = solo();
  if (soloPhase === 'choose-action' && id === 'boots'){ soloEnterDashDirection('card'); return; }
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
    }
    renderSoloDicePending();
    soloRenderActionPanel();
    soloRefreshCardVault();
    renderWalkScore(soloPlayers, soloActiveIdx);
    return;
  }
  if (SOLO_TARGET_PICKER_LABELS[id]){ soloEnterTargetPicker(id); return; }
  const p = solo();
  if (id === 'ration'){
    simGainEnergy(p, 3);
    useActionCard(p, 'ration', soloDeck);
    soloUsedCardId = 'ration';
    walkLog(`Je speelt <b>Noodrantsoen</b>: +3 energie → ${p.energy}.`, null, p);
    soloAfterCardAction();
  } else if (id === 'recal'){
    // Herkalibratie en Herprioritering doen dezelfde doelwissel — is die deze beurt al gebeurd
    // (via de ander), dan blijft deze kaart in de hand
    if (soloTargetSwapped) return;
    soloUnconditionalSwap();
    useActionCard(p, 'recal', soloDeck);
    soloUsedCardId = 'recal';
    soloTargetSwapped = true;
    soloRefreshTarget();
    walkLog(`Je speelt <b>Herkalibratie</b>: nieuw doel ${p.deck[p.nextIdx]}.`, null, p);
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
    renderWalkDice(soloMove.d1, soloMove.d2, soloEnergyRoll, false, soloMove.d3, soloMove.roll);
    walkLog(`Je speelt <b>Stuwlading</b>: gratis derde loopsteen (${d3}) → ${soloMove.stepsLeft} stappen te gaan.`, null, p);
    soloAfterCardAction();
  } else if (id === 'fastlane'){
    soloAllowUturn = true;
    useActionCard(p, 'fastlane', soloDeck);
    soloUsedCardId = 'fastlane';
    walkLog(`Je speelt <b>Snelroute</b>: de geen-U-turn-regel geldt deze beurt niet voor jou.`, null, p);
    soloAfterCardAction();
  } else if (id === 'trade'){
    // ruil de kaart die je NIET speelde tegen de bovenste aflegkaart
    const other = p.cards.find(c => c !== 'trade');
    useActionCard(p, 'trade', soloDeck);
    soloUsedCardId = 'trade';
    if (other && soloDeck.discard.length){
      const gekregen = soloDeck.discard[soloDeck.discard.length - 1];
      performCardTrade(p, other, soloDeck);
      walkLog(`Je speelt <b>Kaartenruil</b>: ${ACTION_CARDS[other].name} eruit, <b>${ACTION_CARDS[gekregen].name}</b> erin.`, null, p);
    } else {
      walkLog(`Je speelt <b>Kaartenruil</b>, maar er is niets om te ruilen.`, null, p);
    }
    soloAfterCardAction();
  } else if (id === 'peek'){
    performPeekReorder(soloDeck);
    useActionCard(p, 'peek', soloDeck);
    soloUsedCardId = 'peek';
    walkLog(`Je speelt <b>Herinnering</b>: de bovenste kaarten van de trekstapel zijn herschikt.`, null, p);
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
    const d3 = soloMove.d3 !== null && soloMove.d3 !== undefined ? simRollD6(soloRand, p) : null;
    // een Stroomonderbreking op de oorspronkelijke worp geldt ook voor de nieuwe
    const penalty = soloMove.penalty || 0;
    const roll = Math.max(1, d1 + d2 + (d3 || 0) - penalty);
    useActionCard(p, 'reroll', soloDeck);
    soloUsedCardId = 'reroll';
    // volledig nieuwe zet: het pad begint opnieuw vanaf waar je nu staat
    soloMove = { d1, d2, d3, roll, penalty, stepsLeft: roll, lastDir: -1, path: [p.pos] };
    renderWalkDice(d1, d2, soloEnergyRoll, false, d3, roll);
    walkLog(`Je speelt <b>Koerscorrectie</b> en gooit opnieuw: <b>${roll}</b> stappen.`, null, p);
    soloAfterCardAction();
  }
}
function soloUseEnergyAction(id){
  if (mpIntercept('useEnergy', { id })) return;
  const p = solo();
  const act = ENERGY_ACTIONS[id];
  if (p.energy < act.cost) return;
  // de laarzen alleen als er ook echt een richting vrij is (anders betaal je voor niets)
  if (id === 'gravity' && (soloUsedBoots || !soloDashOptions().length)) return;
  p.energy -= act.cost;
  p.actionUses = (p.actionUses || 0) + 1;   // telde vroeger alleen bij bots; nu ook voor het winscherm
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
  }
}

// ---------- actiekaartvakje (gang): loop je erover, dan trek je een beloningskaart ----------
// Net als een opdracht, maar onderbreekt de zet niet (alleen soloTargetKey doet dat) en hooguit
// 1x per beurt (soloActionCellDrawnThisTurn), ook als je onderweg meerdere van deze vakjes
// passeert. `soloGrantActionCellReward` gaat er blind van uit dat de aanroeper al vastgesteld
// heeft dat er een actiekaartvakje geraakt is — alleen het "al gehad deze beurt"-slot wordt hier
// nog getoetst. `soloCheckActionCell` is de per-stap variant (mens): checkt zelf één cel.
function soloGrantActionCellReward(player, isHuman){
  if (soloActionCellDrawnThisTurn) return;
  soloActionCellDrawnThisTurn = true;
  const reward = drawActionCellReward(player, soloDeck, soloRand);
  if (reward.drawn){
    const msg = isHuman
      ? `Je loopt over een actiekaartvakje en trekt een beloningskaart: <b>${ACTION_CARDS[reward.drawn].name}</b> — ${ACTION_CARDS[reward.drawn].hint}.`
      : `${player.name} loopt over een actiekaartvakje en trekt een beloningskaart: <b>${ACTION_CARDS[reward.drawn].name}</b> — ${ACTION_CARDS[reward.drawn].hint}.`;
    walkLog(msg, null, player);
    if (isHuman) soloRefreshCardVault();
  } else if (reward.handFull){
    walkLog(isHuman ? `Je loopt over een actiekaartvakje, maar je hand is al vol.` : `${player.name} loopt over een actiekaartvakje, maar de hand is al vol.`, null, player);
  }
}
function soloCheckActionCell(key, player, isHuman){
  if (soloActionCellDrawnThisTurn || !soloGraph.actionCells.has(key)) return;
  soloGrantActionCellReward(player, isHuman);
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
  walkLog(`Je zet <b>Zwaartekracht-laarzen</b> in${source === 'card' ? ' (kaart)' : ` (−${ENERGY_ACTIONS.gravity.cost})`} — kies een richting, op het bord of hieronder.`, null, p);
  const names = ['Noord', 'Oost', 'Zuid', 'West'];
  walkSoloActionsEl.innerHTML =
    `<p class="hint energy-pick-head">Kies je richting voor <b>Zwaartekracht-laarzen</b>:</p>` +
    `<div class="energy-pick-list">` + options.map(o =>
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
  p.lastDir = dir;   // Terugtrekbevel duwt je langs deze richting terug
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
// lopen, en kies je welke je eerst doet. Signaalstoring (een tegenstander speelde 'm op jou)
// laat een gekozen wissel alsnog mislukken.
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
      <span class="energy-pick-text"><b>${verb} ${label} · ${QUEST_NAMES[label] || ''}</b><span>${d} vakjes lopen vanaf hier</span></span>
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
    walkLog(`Je houdt ${p.deck[p.nextIdx]} als eerstvolgende opdracht.`, null, p);
  } else if (p.reorderBlocked){
    p.reorderBlocked = false;
    walkLog(`Je wissel wordt gesaboteerd door <b>Signaalstoring</b> — je houdt ${p.deck[p.nextIdx]}.`, null, p);
  } else {
    soloUnconditionalSwap();
    soloTargetSwapped = true;
    soloRefreshTarget();
    walkLog(`Je haalt ${p.deck[p.nextIdx]} naar voren.`, null, p);
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
  const stamp = simBfsDistances(soloGraph, solo().pos);
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

// ---------- dobbelen + lopen ----------
function renderSoloDicePending(){
  const e = soloEnergyRoll;
  const energyHtml = e === null
    ? energyDieHtml(null, false) + `<span class="walk-die-sum energy">energie bij het gooien</span>`
    : energyDieHtml(e, false) + `<span class="walk-die-sum energy">+${e} energie</span>`;
  // walk-die-pending: langzame op-en-neer-animatie zolang je nog niet hebt gedobbeld
  // (gebruikersverzoek) — verdwijnt vanzelf zodra renderWalkDice() straks de echte worp tekent.
  // Een 3e vraagteken-dobbelsteen zodra Stuwstoot/Stuwlading is ingezet (soloPendingBoost):
  // die 3e loopsteen is dan al zeker, dus mag je 'm nu al zien staan i.p.v. pas na het
  // dobbelen (gebruikerswens).
  const pendingDice = soloPendingBoost
    ? `<span class="walk-die walk-die-pending">?</span><span class="walk-die walk-die-pending">?</span><span class="walk-die walk-die-pending">?</span>`
    : `<span class="walk-die walk-die-pending">?</span><span class="walk-die walk-die-pending">?</span>`;
  walkDiceEl.innerHTML =
    `<span class="walk-dice-row">${pendingDice}</span>` +
    `<span class="walk-dice-row">${energyHtml}</span>`;
}
// `soloCurrentLegalMoves` voedt niet alleen deze teller maar ook de pijltjestoetsen
// hieronder — bewegen zelf gaat via een klik op een omrand bordvakje (.walk-clickable) of
// via die pijltjestoetsen, dit is puur de "gezet/nog"-teller ernaast.
function soloRenderStepCounter(legal){
  soloCurrentLegalMoves = legal;
  if (walkStepCounterEl) walkStepCounterEl.hidden = false;
  if (walkStepDoneEl) walkStepDoneEl.textContent = soloMove.path.length - 1;
  if (walkStepLeftEl) walkStepLeftEl.textContent = soloMove.stepsLeft;
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
  if (soloPhase !== 'moving') return;
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
  soloEnergyRoll = simRollEnergy(soloRand);
  if (p.stats) p.stats.energyRolled += soloEnergyRoll;
  soloEnergyGain = simGainEnergy(p, soloEnergyRoll);
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
  renderWalkDice(d1, d2, soloEnergyRoll, false, d3, roll);   // na de straf: toont de echte stappen
  soloMove = { d1, d2, d3, roll, penalty, stepsLeft: roll, lastDir: -1, path: [p.pos] };
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

function soloAdvanceMovePhase(){
  const occ = soloOccupied();
  const legal = soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, occ);
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
    const legal = soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, null);
    soloMarkClickable(soloGraph, legal.map(l => l.key));
    soloRenderStepCounter(legal);
    renderSoloMeta(soloMove.stepsLeft);
    soloRefreshCardVault();   // cardActionUsed is nu true (blind gespeeld), dus niets meer speelbaar
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
      walkLog(`Je trekt een beloningskaart: <b>${ACTION_CARDS[drawn].name}</b> — ${ACTION_CARDS[drawn].hint}.`, null, p);
      soloRefreshCardVault();
    }
  } else {
    walkLog(`Je zou een kaart trekken, maar je hand is al vol.`, null, p);
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
  if (solo()) solo().barrierCell = null;
  renderWalkScore(soloPlayers, soloActiveIdx);
  soloContinueLoop();
}

function soloHandleMoveClick(key){
  const occ = soloOccupied();
  const legal = soloLegalNextCells(soloGraph, solo().pos, soloMove.lastDir, soloPhase === 'moving' && soloUsedCardId === 'blind' ? null : occ);
  const match = legal.find(l => l.key === key);
  if (!match) return;
  if (mpIntercept('moveClick', { key })) return;
  const p = solo();
  const leaving = walkCellDiv(soloGraph, p.pos);
  leaving.style.setProperty('--pc', p.color);
  leaving.classList.add('walk-trail');
  p.pos = key;
  soloMove.lastDir = match.dir;
  solo().lastDir = match.dir;   // Terugtrekbevel duwt je langs deze richting terug
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
      soloEndMoveAlreadyBanked();
    } else {
      soloAdvanceMovePhase();
    }
  } else if (soloMove.stepsLeft <= 0){
    soloClearClickable();
    if (soloBankCountThisTurn > 0) soloEndMoveAlreadyBanked();
    else soloFinishTurn(false);
  } else {
    soloAdvanceMovePhase();
  }
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
  // Noodbarrière gold precies voor deze ene beurt en verdwijnt nu, of je er nu tegenaan liep of niet
  if (solo()) solo().barrierCell = null;
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
        walkLog(`Je trekt een beloningskaart: <b>${ACTION_CARDS[drawn].name}</b> — ${ACTION_CARDS[drawn].hint}.`, null, p);
        soloRefreshCardVault();   // nieuwe kaart meteen in de kluis tonen
      }
    } else {
      walkLog(`Je zou een kaart trekken, maar je hand is al vol.`, null, p);
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
    const extra = (roll && stepsUsed < roll) ? ` — kon maar ${stepsUsed} stappen zetten (doodlopend)` : '';
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
  soloPlayers[pIdx].myTurn++;
  soloUsedEnergyId = null;
  soloUsedCardId = null;
  soloDiscardedCardId = null;
  soloTargetSwapped = false;
  soloPendingBoost = false;
  soloUsedBoots = false;      // betekent nu: deze beurt al gesprint (kaart of energie)
  soloBootsOptions = [];
  soloDashSource = null;
  soloDashSteps = 0;
  soloUsedJump = false;
  soloActionCellDrawnThisTurn = false;
  soloBankCountThisTurn = 0;
  soloAllowUturn = false;
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
    walkLog(`Je bent <b>vergrendeld</b>: deze beurt geen energie-actie en geen actiekaart.`, null, p);
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
  player.myTurn++;   // eigen beurtenteller, net als bij een mens (soloBeginHumanTurn)
  soloActionCellDrawnThisTurn = false;
  const pIdx = player.idx;
  const startPos = player.pos;
  // Energie-acties en kaarten hebben ELK hun eigen actie-slot per beurt (max 1 van elk) —
  // zelfde opzet als simulateOneGame() in 95-simulate.js, zie de uitgebreide toelichting daar
  // voor de drie paren (Stuwlading/Stuwstoot, Herkalibratie/Herprioritering, Blinde Vlek/
  // Noodtransport) die elkaar nog wél uitsluiten binnen hún ene bewegingsmoment.
  let energyActionUsed = false;
  let cardActionUsed = false;
  if (player.lockedNextTurn){
    player.lockedNextTurn = false;
    energyActionUsed = true;
    cardActionUsed = true;
    walkLog(`${player.name} is <b>vergrendeld</b> en slaat zijn energie- en kaartactie over.`, null, player);
  }

  // energiesteen rolt mee, maar telt pas na de zet bij (zelfde tijdsregels als de mens en
  // simulateOneGame — wat je nu gooit geef je pas volgende beurt uit)
  let energyRoll = 0, pendingEnergy = 0;
  if (player.skipEnergyRoll){ player.skipEnergyRoll = false; }
  else {
    energyRoll = simRollEnergy(soloRand);
    pendingEnergy = energyRoll;
    player.stats.energyRolled += energyRoll;
    // vorige beurt een Condensator gespeeld: deze steen telt dubbel (zie simulateOneGame)
    if (player.condenserPending){
      player.condenserPending = false;
      pendingEnergy += energyRoll;
      walkLog(`${player.name} verzilvert de <b>Condensator</b>: energiesteen ${energyRoll} telt dubbel.`, null, player);
    }
  }

  // de Condensator wordt klaargezet voor de VOLGENDE beurt
  if (!cardActionUsed && player.cards.includes('condenser') && !player.condenserPending && player.energy < ENERGY_MAX){
    player.condenserPending = true;
    useActionCard(player, 'condenser', soloDeck);
    cardActionUsed = true;
  }
  if (!cardActionUsed && player.cards.includes('short')){
    const victim = pickShortCircuitTarget(soloPlayers, pIdx, soloRand);
    if (victim){
      victim.skipEnergyRoll = true;
      useActionCard(player, 'short', soloDeck);
      cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Kortsluiting</b> op ${victim.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('ration') && player.energy < ENERGY_MAX){
    simGainEnergy(player, 3);
    useActionCard(player, 'ration', soloDeck);
    cardActionUsed = true;
  }
  if (!cardActionUsed && player.cards.includes('lockdown')){
    const victim = pickLeaderTarget(soloPlayers, pIdx, q => q.lockedNextTurn, soloRand);
    if (victim){
      victim.lockedNextTurn = true;
      useActionCard(player, 'lockdown', soloDeck); cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Vergrendeling</b> op ${victim.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('outage')){
    const victim = pickLeaderTarget(soloPlayers, pIdx, q => q.rollPenalty > 0, soloRand);
    if (victim){
      victim.rollPenalty = 2;
      useActionCard(player, 'outage', soloDeck); cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Stroomonderbreking</b> op ${victim.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('barrier')){
    const occNow = new Set(soloPlayers.filter(simOnBoard).map(q => q.pos));
    const target = pickBarrierTarget(soloGraph, soloPlayers, occNow, pIdx, soloRand);
    if (target){
      target.player.barrierCell = target.cell;
      useActionCard(player, 'barrier', soloDeck); cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Noodbarrière</b> naast ${target.player.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('jam')){
    const victim = pickLeaderTarget(soloPlayers, pIdx, q => q.reorderBlocked, soloRand);
    if (victim){
      victim.reorderBlocked = true;
      useActionCard(player, 'jam', soloDeck); cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Signaalstoring</b> op ${victim.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('trade') && player.cards.includes('scan') && soloDeck.discard.length){
    performCardTrade(player, 'scan', soloDeck);
    useActionCard(player, 'trade', soloDeck); cardActionUsed = true;
  }
  if (!cardActionUsed && player.cards.includes('peek') && soloDeck.draw.length){
    performPeekReorder(soloDeck);
    useActionCard(player, 'peek', soloDeck); cardActionUsed = true;
  }

  let targetLabel = player.deck[player.nextIdx];
  let targetSwapped = false;
  // energyReorderTarget() leest/schrijft player.order — de batch-speler heet zijn stapel zo,
  // maar hier (net als in 96-walk.js) heet 'ie deck. Een shim die naar dezelfde array wijst
  // (geen kopie) laat de swap gewoon doorwerken op player.deck. Zie de kanttekening bij
  // pickShoveMove hierboven — dit is precies de val die daar staat beschreven.
  const shim = { order: player.deck, nextIdx: player.nextIdx };
  if (!cardActionUsed && player.cards.includes('recal')){
    const swapped = energyReorderTarget(soloGraph, shim, player.pos);
    if (swapped !== null){ targetLabel = swapped; useActionCard(player, 'recal', soloDeck); cardActionUsed = true; targetSwapped = true; }
  }
  if (!cardActionUsed && player.cards.includes('shove')){
    const shove = pickShoveMove(soloGraph, soloPlayers, pIdx, soloRand);
    if (shove){
      shove.player.pos = shove.toKey;
      useActionCard(player, 'shove', soloDeck);
      cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Duwstoot</b> op ${shove.player.name}.`, null, player);
    }
  }
  if (!cardActionUsed && player.cards.includes('recoil')){
    const occNow = new Set(soloPlayers.filter(simOnBoard).map(q => q.pos));
    const push = pickRecoilMove(soloGraph, soloPlayers, occNow, pIdx);
    if (push){
      push.player.pos = push.toKey;
      useActionCard(player, 'recoil', soloDeck); cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Terugtrekbevel</b> op ${push.player.name}.`, null, player);
    }
  }
  // Herprioritering: betalen, volgende kaart bekijken, wisselen als die dichterbij ligt (zie
  // botWantsReorderPeek in 95-simulate.js). De bot vertelt niet WELKE kaart hij zag — die is
  // voor de andere spelers net zo geheim als in het echt.
  if (!targetSwapped && !energyActionUsed && player.strategy === 'reorder' && player.energy >= ENERGY_ACTIONS.reorder.cost
      && botWantsReorderPeek(soloGraph, shim, player.pos)){
    player.energy -= ENERGY_ACTIONS.reorder.cost; player.actionUses++; energyActionUsed = true;
    const swapped = energyReorderTarget(soloGraph, shim, player.pos);
    if (swapped === null){
      walkLog(`${player.name} bekijkt met <b>Herprioritering</b> zijn volgende opdracht en houdt zijn huidige.`, null, player);
    } else if (player.reorderBlocked){
      player.reorderBlocked = false; applyReorderSwap(shim);
      walkLog(`${player.name}'s Herprioritering wordt gesaboteerd door <b>Signaalstoring</b>.`, null, player);
    } else {
      targetLabel = swapped;
      walkLog(`${player.name} wisselt met <b>Herprioritering</b> van opdracht.`, null, player);
    }
  }
  const targetKey = soloGraph.questCells[targetLabel];
  // volledige rij nog te halen opdrachtvakjes, te beginnen bij het huidige doel — zie de
  // toelichting bij `targets` in simulateOneGame() (95-simulate.js)
  const targets = [];
  for (let i = player.nextIdx; i < player.deck.length; i++) targets.push(soloGraph.questCells[player.deck[i]]);

  const occupied = new Set();
  for (const other of soloPlayers) if (other.idx !== pIdx && simOnBoard(other)) occupied.add(other.pos);
  if (player.barrierCell !== null){ occupied.add(player.barrierCell); player.barrierCell = null; }

  // Vóór de worp: Noodtransport of Zwaartekracht-laarzen (energie of de gratis kaart) — dezelfde
  // keuze als in simulateOneGame (botPreRollMove in 95-simulate.js). Daarna gooit de bot vanaf
  // zijn nieuwe plek; een sprong precies op de opdracht beëindigt de beurt. d1/d2/d3 en de twee
  // losse paden worden bewaard voor het zichtbaar naspelen (soloAnimateBotTurn).
  let move, roll = 0, d1 = 0, d2 = 0, d3 = null, allowUturn = false, rollPenalty = 0, rollMove = null;
  const pre = botPreRollMove(soloGraph, player, occupied, targets, !energyActionUsed, !cardActionUsed);
  if (pre){
    if (pre.kind === 'bootsCard'){
      useActionCard(player, 'boots', soloDeck); cardActionUsed = true;
    } else {
      player.energy -= ENERGY_ACTIONS[pre.kind].cost; player.actionUses++; energyActionUsed = true;
    }
    walkLog(pre.kind === 'jump'
      ? `${player.name} springt met <b>Noodtransport</b> ${pre.path.length - 1} vakjes${pre.endsTurn ? ', precies op zijn opdracht' : ''}.`
      : `${player.name} schiet met <b>Zwaartekracht-laarzen</b>${pre.kind === 'bootsCard' ? ' (kaart)' : ''} ${pre.path.length - 1} vakjes rechtdoor.`, null, player);
  }
  const rollFrom = pre ? pre.key : player.pos;
  const rollTargets = pre ? targets.slice(pre.bankedCount) : targets;
  if (pre && (pre.endsTurn || player.completed + pre.bankedCount >= SIM_QUESTS_TO_WIN)){
    move = { key: pre.key, path: pre.path, stepsUsed: pre.path.length - 1, bankedCount: pre.bankedCount,
             bankedQuest: pre.bankedCount > 0, wasBlocked: pre.wasBlocked };
  } else {
    let dice = 2;
    d1 = simRollD6(soloRand, player); d2 = simRollD6(soloRand, player);
    roll = d1 + d2;
    if (!cardActionUsed && player.cards.includes('boostcell')){
      d3 = simRollD6(soloRand, player); roll += d3; dice = 3; useActionCard(player, 'boostcell', soloDeck); cardActionUsed = true;
    } else if (!energyActionUsed && player.strategy === 'boost' && player.energy >= ENERGY_ACTIONS.boost.cost){
      d3 = simRollD6(soloRand, player); roll += d3; dice = 3; player.energy -= ENERGY_ACTIONS.boost.cost; player.actionUses++; energyActionUsed = true;
    }
    if (player.rollPenalty){ rollPenalty = player.rollPenalty; roll = Math.max(1, roll - rollPenalty); player.rollPenalty = 0; }
    if (!cardActionUsed && player.cards.includes('fastlane')){
      allowUturn = true;
      useActionCard(player, 'fastlane', soloDeck); cardActionUsed = true;
    }
    rollMove = resolveMove(soloGraph, rollFrom, roll, occupied, rollTargets, soloRand, undefined, allowUturn);
    // Koerscorrectie: tegenvallende worp overdoen (zie simulateOneGame voor de drempel)
    if (!rollMove.bankedQuest && !cardActionUsed && player.cards.includes('reroll') && roll < dice * 3.5){
      d1 = simRollD6(soloRand, player); d2 = simRollD6(soloRand, player);
      if (dice === 3) d3 = simRollD6(soloRand, player);
      roll = d1 + d2 + (dice === 3 ? d3 : 0);
      if (rollPenalty) roll = Math.max(1, roll - rollPenalty);   // Stroomonderbreking blijft gelden
      useActionCard(player, 'reroll', soloDeck);
      cardActionUsed = true;
      walkLog(`${player.name} gebruikt <b>Koerscorrectie</b> en gooit opnieuw: ${roll}.`, null, player);
      rollMove = resolveMove(soloGraph, rollFrom, roll, occupied, rollTargets, soloRand, undefined, allowUturn);
    }
    // Blinde Vlek: geblokkeerde worp opnieuw uitrekenen, door tegenstanders heen
    if (!rollMove.bankedQuest && !cardActionUsed && player.cards.includes('blind') && rollMove.wasBlocked){
      const retry = resolveMove(soloGraph, rollFrom, roll, SIM_EMPTY_SET, rollTargets, soloRand, occupied, allowUturn);
      if (retry && retry.key !== rollMove.key){ rollMove = retry; useActionCard(player, 'blind', soloDeck); cardActionUsed = true; }
    }
    move = mergePreRollMove(pre, rollMove);
  }
  if (pre && pre.kind !== 'jump') player.stats.dashSteps += pre.path.length - 1;
  if (rollMove) player.stats.walkSteps += rollMove.path.length - 1;
  const stepDir = lastStepDirection(soloGraph, move.path);
  if (stepDir !== -1) player.lastDir = stepDir;

  player.pos = move.key;
  paintWalkPawns(soloGraph, soloPlayers, pIdx);
  if (pathHasActionCell(soloGraph, move.path)) soloGrantActionCellReward(player, false);
  // de energiesteen van deze beurt telt nu pas bij: volgende beurt uit te geven
  if (pendingEnergy) simGainEnergy(player, pendingEnergy);
  // voor soloAnimateBotTurn: welke opdrachten deze zet pakt, zodat het naspelen het doel al
  // doorschuift zodra de pion erop stapt (walkAdvanceShownTarget, 96-walk.js)
  const bank = { seq: player.deck.slice(player.nextIdx), completed: player.completed };

  if (move.bankedQuest){
    // meestal 1 opdracht, zelden 2 (de resterende stappen na de 1e voerden toevallig ook door
    // de 2e) — zie resolveMove in 95-simulate.js.
    const bankedLabels = [];
    for (let i = player.nextIdx, n = 0; n < move.bankedCount; i++, n++) bankedLabels.push(player.deck[i]);
    player.doneCells.push(targetKey);
    for (let i = 1; i < bankedLabels.length; i++) player.doneCells.push(soloGraph.questCells[bankedLabels[i]]);
    player.completed += bankedLabels.length;
    player.nextIdx += bankedLabels.length;
    if (player.cards.length < ACTION_CARD_HAND_MAX){
      const drawn = drawActionCard(soloDeck, soloRand);
      if (drawn) player.cards.push(drawn);
    }
    const chainNote = bankedLabels.length > 1
      ? ` en meteen ook <span class="hit">${bankedLabels.slice(1).map(l => `${l} ${QUEST_NAMES[l] || ''}`).join(', ')}</span>`
      : '';
    walkLog(`Beurt ${soloTurn}: <b>${player.name}</b> voltooit <span class="hit">${targetLabel} ${QUEST_NAMES[targetLabel] || ''}</span>${chainNote} · ${player.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', player);
    if (player.completed >= SIM_QUESTS_TO_WIN){
      player.finishTurn = player.myTurn;   // eigen beurten, zie soloBankCurrentQuest
      soloRoundFinishers.push(player);
      walkLog(`<b>${player.name} heeft alle ${SIM_QUESTS_TO_WIN} opdrachten voltooid</b> en verlaat het bord — wacht op de rest van deze ronde.`, 'hit', player);
    }
  } else {
    walkLog(`Beurt ${soloTurn}: <b>${player.name}</b> onderweg naar ${targetLabel}${move.wasBlocked ? ' · liep tegen een bezette route aan' : ''}`, null, player);
  }
  renderWalkScore(soloPlayers, -1);
  return { startPos, d1, d2, d3, roll, energyRoll, targetLabel, targetKey, bank,
           // verplaatsing vóór de worp (sprong/sprint) en de gelopen worp, los, voor het naspelen
           prePath: pre ? pre.path : null, preBanked: pre ? pre.bankedCount : 0,
           rollPath: rollMove ? rollMove.path : null, rollBanked: rollMove ? rollMove.bankedCount : 0 };
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
      player.pos = path[i];
      walkAdvanceShownTarget(soloGraph, bank, player.pos, player.color, othersOcc, false);
      paint();
      await walkSleep(sp.stepMs);
      if (!alive()) return false;
    }
    return true;
  };

  // 1. sprong/sprint vóór de worp (Noodtransport of Zwaartekracht-laarzen)
  if (replay.prePath && !await walkSeg(replay.prePath, true, replay.preBanked)) return false;
  // 2. dobbelen — of niet, als de sprong/sprint de beurt al afmaakte
  if (replay.roll){
    const shakeSteps = Math.max(1, Math.round(sp.rollMs / 90));
    for (let i = 0; i < shakeSteps; i++){
      renderWalkDice(1 + Math.floor(Math.random()*6), 1 + Math.floor(Math.random()*6),
                     ENERGY_DIE_FACES[Math.floor(Math.random()*ENERGY_DIE_FACES.length)], true);
      await walkSleep(90);
      if (!alive()) return false;
    }
    renderWalkDice(replay.d1, replay.d2, replay.energyRoll, false, replay.d3, replay.roll);
  } else {
    walkDiceEl.innerHTML =
      `<span class="walk-dice-row"><span class="walk-die-sum">geen worp nodig</span></span>` +
      `<span class="walk-dice-row">${energyDieHtml(replay.energyRoll, false)}<span class="walk-die-sum energy">+${replay.energyRoll} energie</span></span>`;
  }
  await walkSleep(Math.min(500, sp.rollMs));
  if (!alive()) return false;
  // 3. de worp lopen
  if (replay.rollPath && !await walkSeg(replay.rollPath, false, replay.rollBanked)) return false;
  player.pos = finalPos;
  paint();
  for (const n of logNodes) walkLogEl.appendChild(n);
  walkLogEl.scrollTop = walkLogEl.scrollHeight;
  renderWalkScore(soloPlayers, pIdx);
  // even blijven staan zodat je ziet waar hij eindigde, dan pas de volgende speler
  await walkSleep(sp.rollMs);
  return alive();
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
      const replay = soloResolveBotTurn(player);
      const logNodes = [...walkLogEl.children].slice(logStart);
      for (const n of logNodes) n.remove();
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
        walkLog(`<b>${names} delen de ${walkRankLabel(group[0].rank)} plaats</b> — gelijke energie (${group[0].energy}) en evenveel actiekaarten in de hand (${group[0].cards.length}).`, 'hit', null);
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
// ---------- eindscherm (na afloop, gebruikerswens: groot venster i.p.v. het kleine
// #walkStatus-regeltje alleen) ----------
// Zelfde grootte/rand als het bord (.walk-endgame in styles.css) en vervangt het zichtbaar
// zolang het open staat; "Toon kaart" (soloEndgameShowMap) verbergt 'm weer, het bord staat er
// dan gewoon nog onder, en "Toon uitslag" op dezelfde plek (#btnWalkEndgameShowResult) haalt 'm
// terug (gebruikersmelding: je kon niet meer terug naar het winscherm).
// Onder de titel staat het klassement 1 t/m 4 (soloEndgameRankingHtml), bij meer dan 1 speler.
// Ook gebruikt door modus Automatisch (96-walk.js), die zijn eigen `players` meegeeft en geen
// "jij" kent (`isMe` geeft daar altijd false).
function soloShowEndgame(trophy, title, sub, players = soloPlayers, isMe = soloIsMe){
  if (!walkEndgameEl || !walkEndgameCardEl) return;
  // bewaard voor de knop "Statistieken" (en "Terug naar de uitslag") hieronder
  soloEndgameView = { trophy, title, sub, players, isMe };
  // de dobbelstenen van de laatste beurt horen niet meer naast het winscherm (gebruikerswens)
  if (walkDiceEl) walkDiceEl.innerHTML = '';
  soloHideStepCounter();
  soloRenderEndgameResult();
  soloReopenEndgame();
}
let soloEndgameView = null;
// Embleem boven de titel i.p.v. de cartoonachtige 🏆-emoji (gebruikerswens): een zeshoekig
// insigne met een vierpuntige ster, in lijnen in de kleur van de winnaar (--pc). Bij een
// afgekapt potje dezelfde zeshoek, maar met een zandloper en grijs.
function soloEndgameEmblem(stuck){
  const hex = (r) => [0, 1, 2, 3, 4, 5].map(i => {
    const a = Math.PI / 3 * i - Math.PI / 2;
    return `${(40 + r * Math.cos(a)).toFixed(1)},${(40 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const core = stuck
    ? `<path d="M28 24h24M28 56h24M30 24c0 10 20 10 20 16s-20 6-20 16M50 24c0 10-20 10-20 16s20 6 20 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M40 18 L44.5 35.5 L62 40 L44.5 44.5 L40 62 L35.5 44.5 L18 40 L35.5 35.5 Z" fill="currentColor" fill-opacity=".9"/>` +
      `<path d="M40 30 L42 38 L50 40 L42 42 L40 50 L38 42 L30 40 L38 38 Z" fill="#fff" fill-opacity=".85"/>`;
  return `<svg viewBox="0 0 80 80" width="76" height="76" aria-hidden="true">` +
    `<polygon points="${hex(37)}" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="2"/>` +
    `<polygon points="${hex(30)}" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1" stroke-dasharray="3 4"/>` +
    core + `</svg>`;
}
function soloRenderEndgameResult(){
  const v = soloEndgameView;
  if (!v) return;
  const winner = v.players.find(p => p.rank === 1);
  const color = v.trophy === '⏳' || !winner ? 'var(--text-dim)' : winner.color;
  walkEndgameCardEl.innerHTML =
    `<span class="walk-endgame-trophy" style="--pc:${color}">${soloEndgameEmblem(v.trophy === '⏳')}</span>` +
    `<span class="walk-endgame-title">${v.title}</span>` +
    (v.sub ? `<span class="walk-endgame-sub">${v.sub}</span>` : '') +
    (v.players.length > 1 ? soloEndgameRankingHtml(v.players, v.isMe) : '') +
    (v.players.some(p => p.stats)
      ? `<button type="button" class="ghost walk-endgame-stats-btn" data-endgame-stats>Statistieken</button>` : '');
}
// ---------- statistieken per speler (pop-up via de knop op het winscherm) ----------
// De tellers zelf lopen tijdens het spel mee (newPlayerStats in 95-simulate.js); wat af te leiden
// is wordt hier pas uitgerekend. Elke categorie is een eigen tabel (hoogstens 3 naast elkaar,
// zie .walk-stats-cats in styles.css). `best`: 'max' of 'min' — die waarde wordt in de rij
// uitgelicht (alleen bij meer dan één speler).
const turnsOf = p => p.myTurn || p.ownTurns || 0;
const perOf = (a, b) => b ? a / b : 0;
const SOLO_STATS_GROUPS = [
  { title: 'Algemeen', rows: [
    { label: 'Opdrachten voltooid', best: 'max', get: p => p.completed, fmt: v => `${v}/${SIM_QUESTS_TO_WIN}` },
    { label: 'Beurten gespeeld', get: turnsOf },
    { label: 'Beurten per opdracht', best: 'min', get: p => perOf(turnsOf(p), p.completed), fmt: v => v ? nl(v, 1) : '—' },
  ]},
  { title: 'Dobbelstenen', rows: [
    { label: 'Loopstenen gegooid', get: p => p.stats.dice },
    { label: 'Ogen gegooid', best: 'max', get: p => p.stats.pips },
    { label: 'Gemiddeld per steen', best: 'max', get: p => perOf(p.stats.pips, p.stats.dice), fmt: v => nl(v, 2) },
    { label: 'Ogen per beurt', best: 'max', get: p => perOf(p.stats.pips, turnsOf(p)), fmt: v => nl(v, 1) },
  ]},
  { title: 'Verplaatsing', rows: [
    { label: 'Vakjes gelopen', best: 'max', get: p => p.stats.walkSteps },
    { label: 'Vakjes gesprint (laarzen)', best: 'max', get: p => p.stats.dashSteps },
    { label: 'Totaal verplaatst', best: 'max', get: p => p.stats.walkSteps + p.stats.dashSteps },
    { label: 'Vakjes per beurt', best: 'max', get: p => perOf(p.stats.walkSteps + p.stats.dashSteps, turnsOf(p)), fmt: v => nl(v, 1) },
  ]},
  { title: 'Energie', rows: [
    { label: 'Gedobbeld (energiesteen)', best: 'max', get: p => p.stats.energyRolled },
    { label: 'Erbij (ook via kaarten)', best: 'max', get: p => p.stats.energyGained },
    { label: 'Verloren (voorraad vol)', best: 'min', get: p => p.stats.energyWasted },
    { label: 'Over aan het eind', get: p => p.energy },
  ]},
  { title: 'Energie-acties', rows: [
    { label: 'Ingezet', best: 'max', get: p => p.actionUses || 0 },
    { label: 'Energie verbruikt', best: 'max', get: p => p.stats.energyGained - p.energy },
    { label: 'Gemiddeld per actie', get: p => perOf(p.stats.energyGained - p.energy, p.actionUses || 0), fmt: v => v ? nl(v, 1) : '—' },
  ]},
  { title: 'Actiekaarten', rows: [
    { label: 'Getrokken', best: 'max', get: p => p.stats.cardsPlayed + p.stats.cardsDiscarded + p.cards.length },
    { label: 'Gespeeld', best: 'max', get: p => p.stats.cardsPlayed },
    { label: 'Afgelegd', get: p => p.stats.cardsDiscarded },
    { label: 'Nog in de hand', get: p => p.cards.length },
  ]},
];
const walkStatsOverlayEl = document.getElementById('walkStatsOverlay');
const walkStatsBodyEl = document.getElementById('walkStatsBody');
function soloOpenStats(){
  const v = soloEndgameView;
  if (!v || !walkStatsOverlayEl) return;
  const players = walkOrderPlayers(v.players).filter(p => p.stats);
  const n = players.length;
  // bovenaan: elke speler een eigen kolom, in volgorde van het klassement
  // alleen eindstand, naam en of het een bot is (gebruikerswens: start/opdrachten/binnen hoeven niet)
  const cards = players.map(p => {
    const who = p.isHuman ? (v.isMe(p) ? 'jij' : 'mens') : 'bot';
    return `<div class="walk-stats-player" style="--pc:${p.color}">` +
      `<span class="walk-stats-player-place">${p.rank ? walkRankLabel(p.rank) : '—'}</span>` +
      `<b class="walk-stats-player-name">${p.name}</b>` +
      `<span class="walk-stats-player-who">${who}</span>` +
    `</div>`;
  }).join('');
  // per categorie een tabel met vakjes; kolomkop = kleurstip + plaats (zelfde als de spelerkaart
  // erboven — een naam paste niet in de smalle kolom), de naam staat in de tooltip
  const head = `<thead><tr><th class="walk-stats-corner"></th>${players.map(p =>
    `<th style="--pc:${p.color};color:var(--pc)" title="${p.name}">${p.rank ? walkRankLabel(p.rank) : '–'}</th>`).join('')}</tr></thead>`;
  const tables = SOLO_STATS_GROUPS.map(g => {
    const body = g.rows.map(r => {
      const vals = players.map(r.get);
      const pick = r.best === 'min' ? Math.min(...vals) : Math.max(...vals);
      const fmt = r.fmt || (x => String(x));
      const lit = x => r.best && n > 1 && x === pick && !vals.every(y => y === pick);
      return `<tr><th>${r.label}</th>${vals.map(x => `<td${lit(x) ? ' class="is-best"' : ''}>${fmt(x)}</td>`).join('')}</tr>`;
    }).join('');
    return `<section class="walk-stats-cat"><h3>${g.title}</h3><table class="walk-stats-table">${head}<tbody>${body}</tbody></table></section>`;
  }).join('');
  walkStatsBodyEl.innerHTML =
    `<div class="walk-stats-players" style="--n:${n}">${cards}</div>` +
    `<div class="walk-stats-cats">${tables}</div>` +
    `<p class="walk-stats-foot">Oranje = beste in die rij. Ogen tellen alleen de loopstenen tijdens het spel, niet het dobbelen wie begint.</p>`;
  walkStatsOverlayEl.hidden = false;
}
// zelf opzoeken i.p.v. walkStatsOverlayEl: soloHideEndgame() roept dit aan en kan al tijdens
// het laden lopen, vóórdat die const hierboven bestaat
function soloCloseStats(){ const el = document.getElementById('walkStatsOverlay'); if (el) el.hidden = true; }
if (walkEndgameCardEl){
  walkEndgameCardEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-endgame-stats]')) soloOpenStats();
  });
}
if (walkStatsOverlayEl){
  document.getElementById('walkStatsClose').addEventListener('click', soloCloseStats);
  walkStatsOverlayEl.addEventListener('click', (e) => { if (e.target === walkStatsOverlayEl) soloCloseStats(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !walkStatsOverlayEl.hidden) soloCloseStats(); });
}
// eindklassering als lijstje: plaats, kleurstip, naam, voortgang. Volgorde uit
// walkOrderPlayers() (96-walk.js); gedeelde plaatsen krijgen hetzelfde nummer.
function soloEndgameRankingHtml(players = soloPlayers, isMe = soloIsMe){
  // Drie kolommen: plaats en naam in de spelerskleur, rechts de voltooide opdrachten. Geen
  // medailles/kleurstippen/"binnen"-status meer (gebruikerswens: te druk); de rest staat in
  // de statistieken.
  const head = `<li class="walk-rank-head"><span>Plaats</span><span>Speler</span>` +
    `<span class="walk-rank-score">Opdrachten voltooid</span></li>`;
  const rows = walkOrderPlayers(players).map(p => {
    const place = p.rank ? `${p.rank}e` : '—';
    const you = isMe(p) ? '<span class="you">jij</span>' : '';
    return `<li class="walk-rank-row" style="--pc:${p.color}">` +
      `<span class="walk-rank-pos">${place}</span>` +
      `<span class="walk-rank-name">${p.name}${you}</span>` +
      `<span class="walk-rank-score">${p.completed}/${SIM_QUESTS_TO_WIN}</span>` +
    `</li>`;
  });
  return `<ol class="walk-rank-list">${head}${rows.join('')}</ol>`;
}
function soloReopenEndgame(){
  if (!walkEndgameEl) return;
  walkEndgameEl.hidden = false;
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = true;
  soloStartConfetti();
}
// "Toon kaart": winscherm weg, knop om 'm terug te halen erbij
function soloEndgameShowMap(){
  soloHideEndgame();
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = false;
}
// helemaal weg (nieuw potje/stoppen): ook geen "Toon uitslag" meer
function soloHideEndgame(){
  if (walkEndgameEl) walkEndgameEl.hidden = true;
  soloCloseStats();   // statistieken-pop-up van het vorige potje hoort ook dicht
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = true;
  soloStopConfetti();
}
if (btnWalkEndgameShowMap) btnWalkEndgameShowMap.addEventListener('click', soloEndgameShowMap);
if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.addEventListener('click', soloReopenEndgame);

// Feestelijke ruimtescène op een <canvas> i.p.v. een library — puur decoratief, dus geen
// dependency waard. Zit qua z-index ONDER .walk-endgame-card (zie styles.css), dus komt daar
// nooit overheen (gebruikerswens), zonder dat er iets uitgeknipt hoeft te worden.
// Vroeger gewone gekleurde papiertjes; nu "ruimteachtig, futuristisch, duister, maar toch winst"
// (gebruikerswens): een diepzwarte achtergrond met een nevelgloed in de kleur van de winnaar,
// een sterrenveld dat langzaam op je af vliegt (warp), energieringen die vanuit het midden
// uitdijen, af en toe een vuurwerk van gloeiende vonken, en zwevende lichtgevende scherfjes.
// Gloed via 'lighter' (optellend licht) i.p.v. shadowBlur — dat laatste is per deeltje traag.
let soloConfettiRAF = null;
let soloConfettiResizeHandler = null;
function soloStartConfetti(){
  const canvas = walkEndgameConfettiEl;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  soloStopConfetti();   // vangnet: nooit twee lussen tegelijk als dit ooit dubbel aangeroepen wordt
  const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
  resize();
  soloConfettiResizeHandler = resize;
  window.addEventListener('resize', soloConfettiResizeHandler);

  // spelers van het winscherm zelf (Automatisch heeft een eigen lijst, niet soloPlayers)
  const winner = ((soloEndgameView && soloEndgameView.players) || soloPlayers || []).find(p => p.rank === 1);
  const hero = (winner && winner.color) || '#ffd23d';
  const palette = [hero, hero, '#4fb8e0', '#ffd23d', '#b98cff'];
  const pick = () => palette[Math.floor(Math.random() * palette.length)];
  const W = () => canvas.width, H = () => canvas.height;
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  };

  // sterren: positie t.o.v. het midden, vliegen naar buiten met een snelheid die meegroeit met
  // de afstand (perspectief); te ver weg → opnieuw vlak bij het midden
  const newStar = (anywhere) => {
    const a = Math.random() * Math.PI * 2;
    const maxR = Math.hypot(W(), H()) / 2;
    const r = anywhere ? Math.random() * maxR : 4 + Math.random() * 40;
    return { a, r, z: 0.25 + Math.random() * 0.75, tw: Math.random() * Math.PI * 2 };
  };
  const stars = Array.from({ length: 170 }, () => newStar(true));
  const newShard = (anywhere) => ({
    x: Math.random() * W(), y: anywhere ? Math.random() * H() : -14,
    vy: 0.25 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3,
    rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.03,
    s: 4 + Math.random() * 5, color: pick(), ph: Math.random() * Math.PI * 2,
  });
  const shards = Array.from({ length: 34 }, () => newShard(true));
  const sparks = [];
  const rings = [];
  let t = 0, nextBurst = 20, nextRing = 0;

  function burst(){
    const x = W() * (0.12 + Math.random() * 0.76);
    const y = H() * (0.12 + Math.random() * 0.6);
    const color = pick(), n = 46 + Math.floor(Math.random() * 20);
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const sp = 2 + Math.random() * 2.6;
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 60 + Math.random() * 40, color });
    }
  }

  function frame(){
    t++;
    const w = W(), h = H(), cx = w / 2, cy = h / 2;
    ctx.globalCompositeOperation = 'source-over';
    // diepe ruimte + nevel in de winnaarskleur
    ctx.fillStyle = '#03050b';
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.5 + 0.5 * Math.sin(t / 90);
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    g.addColorStop(0, rgba(hero, 0.20 + 0.06 * pulse));
    g.addColorStop(0.45, rgba(hero, 0.06));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.15, h * 0.85, 0, w * 0.15, h * 0.85, w * 0.5);
    g.addColorStop(0, 'rgba(79,184,224,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.88, h * 0.12, 0, w * 0.88, h * 0.12, w * 0.45);
    g.addColorStop(0, 'rgba(185,140,255,0.09)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    // warp-sterren
    const maxR = Math.hypot(w, h) / 2 + 20;
    for (const s of stars){
      const prevR = s.r;
      s.r += (0.15 + s.r * 0.006) * s.z;
      s.tw += 0.05;
      if (s.r > maxR){ Object.assign(s, newStar(false)); continue; }
      const cos = Math.cos(s.a), sin = Math.sin(s.a);
      const fade = Math.min(1, s.r / 80);
      const alpha = (0.35 + 0.45 * s.z + 0.2 * Math.sin(s.tw)) * fade;
      const tail = Math.max(1, (s.r - prevR) * 6);
      ctx.strokeStyle = `rgba(210,230,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.6 + s.z * 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + cos * (s.r - tail), cy + sin * (s.r - tail));
      ctx.lineTo(cx + cos * s.r, cy + sin * s.r);
      ctx.stroke();
    }

    // energieringen vanuit het midden
    if (t >= nextRing){ rings.push({ r: 30, a: 0.55 }); nextRing = t + 150; }
    for (let i = rings.length - 1; i >= 0; i--){
      const r = rings[i];
      r.r += 1.6; r.a *= 0.988;
      if (r.a < 0.02 || r.r > maxR){ rings.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(hero, r.a * 0.35); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(hero, r.a); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
    }

    // vuurwerk van vonken
    if (t >= nextBurst){ burst(); nextBurst = t + 70 + Math.floor(Math.random() * 60); }
    for (let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.px = p.x; p.py = p.y;
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.025;
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.life > p.max){ sparks.splice(i, 1); continue; }
      const a = Math.pow(1 - p.life / p.max, 0.6);
      ctx.strokeStyle = rgba(p.color, a); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 5, p.py - p.vy * 5); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = rgba(p.color, a * 0.35);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // zwevende scherfjes (ruiten met een gloeiende rand)
    for (const s of shards){
      s.x += s.vx; s.y += s.vy; s.rot += s.vr; s.ph += 0.04;
      if (s.y > h + 14) Object.assign(s, newShard(false));
      const a = 0.45 + 0.35 * Math.sin(s.ph);
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.beginPath();
      ctx.moveTo(0, -s.s * 1.6); ctx.lineTo(s.s * 0.7, 0); ctx.lineTo(0, s.s * 1.6); ctx.lineTo(-s.s * 0.7, 0); ctx.closePath();
      ctx.fillStyle = rgba(s.color, a * 0.18); ctx.fill();
      ctx.strokeStyle = rgba(s.color, a * 0.3); ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = rgba(s.color, a); ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }
    soloConfettiRAF = requestAnimationFrame(frame);
  }
  frame();
}
function soloStopConfetti(){
  if (soloConfettiRAF) cancelAnimationFrame(soloConfettiRAF);
  soloConfettiRAF = null;
  if (soloConfettiResizeHandler) window.removeEventListener('resize', soloConfettiResizeHandler);
  soloConfettiResizeHandler = null;
  const canvas = walkEndgameConfettiEl;
  if (canvas){ const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// "Ben ik dit?" voor het winscherm. Multiplayer (spelers hebben daar een peerId-veld): alleen
// je eigen stoel (mp.myIdx). Lokaal: alleen als er precies één mens meespeelt — met meerdere
// mensen op één scherm is "jij" dubbelzinnig, dan gewoon de naam. Voorheen gold elke mens als
// "jij", dus bij Multiplayer las iedereen "Jij wint!" als een andere mens won.
function soloIsMe(p){
  if (soloPlayers.some(q => q.peerId !== undefined)) return typeof mp !== 'undefined' && p.idx === mp.myIdx;
  return p.isHuman && soloPlayers.filter(q => q.isHuman).length === 1;
}
// titel/ondertitel voor het winscherm aan het einde van een potje — gedeeld door de host/lokaal
// (soloEndGame) en een multiplayer-gast (mpApplyState in 99-multiplayer.js), die alleen de
// gedeelde stand binnenkrijgt maar hetzelfde winscherm moet zien. Geen statusregel met
// eindklassering in de linkerkolom meer (gebruikerswens: lelijk) — die staat in het winscherm.
function soloEndgameTexts(stuck){
  const nameOf = p => soloIsMe(p) ? 'jij' : p.name;
  if (stuck){
    return { trophy: '⏳', title: 'Afgekapt', sub: `niet iedereen was binnen na ${SIM_MAX_TURNS} beurten` };
  }
  if (soloPlayers.length === 1){
    return { trophy: '🏆', title: 'Je wint!', sub: '' };
  }
  // geen "vanaf 3.1 in 23 beurten" meer onder de titel (gebruikerswens: startplek boeit niemand,
  // het aantal beurten staat in de statistieken)
  const winners = soloPlayers.filter(p => p.rank === 1);
  const w = winners[0];
  const title = winners.length === 1 ? (soloIsMe(w) ? 'Jij wint!' : `${w.name} wint!`) : 'Gedeelde winst!';
  const sub = winners.length === 1
    ? ''
    : `${winners.map(nameOf).join(' en ')} — gelijke energie en actiekaarten`;
  return { trophy: '🏆', title, sub };
}
function soloEndGame(stuck){
  soloPhase = 'game-over';
  soloRefreshCardVault();
  clearWalkTarget();
  walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  btnWalkSoloRoll.hidden = true;
  btnWalkSoloSkip.hidden = true;
  renderWalkScore(soloPlayers, -1);
  if (walkMetaEl) walkMetaEl.innerHTML = '';
  const t = soloEndgameTexts(stuck);
  // leeg — ook voor multiplayer-gasten, die #walkStatus van de host overnemen (mpApplyState)
  walkStatusEl.innerHTML = '';
  soloShowEndgame(t.trophy, t.title, t.sub);
  btnWalkSoloStart.disabled = false;
  if (walkSoloPlayersSel) walkSoloPlayersSel.disabled = false;
  if (walkSoloBotsSel) walkSoloBotsSel.disabled = false;
  for (const sel of walkSoloSetupEl ? walkSoloSetupEl.querySelectorAll('select') : []) sel.disabled = false;
}

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
    walkClearClass('walk-start-glow');
    renderOpeningPanel(soloPlayers, op, { canRoll: mine && op.rolling === soloActiveIdx, shaking: !!op.shaking });
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
  if (soloPhase !== 'opening-roll' || !soloOpening) return;
  if (mpIntercept('openingRoll', {})) return;
  const p = soloPlayers[soloActiveIdx];
  if (!p || !p.isHuman) return;
  soloOpeningDoRoll(soloActiveIdx);
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
    soloOpeningLater(1100, soloOpeningStep);   // even laten zien wie er bovenaan staat
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
  const p = soloPlayers[idx];
  p.startLabel = label;
  p.pos = soloGraph.startCells[label];
  op.picks[idx] = label;
  op.pickPos++;
  const first = p.deck[p.nextIdx];
  walkLog(`${p.name} kiest startpositie <b>${label}</b> — eerste opdracht ${first} ${QUEST_NAMES[first] || ''}.`, null, p);
  soloClearClickable();
  paintWalkPawns(soloGraph, soloPlayers, idx);
  soloOpeningStep();
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
    const stratNote = p.isHuman ? '' : ` · energie: <b>${ENERGY_ACTIONS[p.strategy].name}</b>`;
    const first = p.deck[0];
    walkLog(`${p.name} ${who} start op <b>${p.startLabel}</b>${stratNote} · eerste opdracht: ${first} — ${QUEST_NAMES[first] || ''}`, null, p);
  }
  walkLog(`Elke voltooide opdracht levert een beloningskaart op van een gedeelde stapel — net als het actiekaartvakje in elke gang (zet stopt er niet voor, hooguit 1x per beurt) — max ${ACTION_CARD_HAND_MAX} kaarten in de hand.`);
  if (soloPlayers.length > 1){
    walkLog(`Beurtvolgorde: ${soloTurnOrder.map(i => soloPlayers[i].name).join(' → ')}.`);
    walkLog(soloPlayers.length === 2
      ? `Er wordt gespeeld tot de winnaar binnen is — de ander is dan tweede.`
      : `Er wordt doorgespeeld tot de <b>${soloFinishTarget}e</b> binnen is; de laatste speler is dan automatisch ${soloPlayers.length}e.`);
  } else {
    walkLog(`Solo potje: niemand blokkeert je. Kortsluiting, Duwstoot, Blinde Vlek en Prioriteitspas hebben een tegenstander nodig en doen hier dus niets als je ze trekt.`);
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
  if (walkSoloControlsEl) walkSoloControlsEl.hidden = false;
  if (walkSoloHintEl) walkSoloHintEl.hidden = false;
  if (walkStatTilesEl) walkStatTilesEl.innerHTML = '';
  if (walkQuestChecklistEl) walkQuestChecklistEl.innerHTML = '';
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  if (btnWalkSoloRoll) btnWalkSoloRoll.hidden = true;
  if (btnWalkSoloSkip) btnWalkSoloSkip.hidden = true;
  if (btnWalkSoloStart) btnWalkSoloStart.disabled = false;
  if (btnWalkSoloReset) btnWalkSoloReset.disabled = true;
  if (walkSoloPlayersSel) walkSoloPlayersSel.disabled = false;
  if (walkSoloBotsSel) walkSoloBotsSel.disabled = false;
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

  if (walkSoloPlayersSel) walkSoloPlayersSel.disabled = true;
  if (walkSoloBotsSel) walkSoloBotsSel.disabled = true;
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
  soloRebuildSetup();
  walkFadeToLobby();
}
// Klikken opent nu eerst een bevestiging i.p.v. meteen te resetten — de knop staat in de
// tabbladenbalk, vlak boven de rest van de pagina, en een misklik (bv. net naast de dobbelknop
// op een telefoon) gooide zonder dit een lopend potje weg zonder enige kans om terug te
// krabbelen (gebruikersmelding). Klik naast het paneel of Escape = annuleren, net als de
// andere overlays (zie cardOverlayEl/editorOverlay elders in dit bestand resp. 90-editor.js).
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

// "Automatisch" is de standaard-actieve tab (zie de HTML), maar zonder deze aanroep bleef de
// solo-opzet-UI (spelerskeuze + "Potje starten"/"Nieuw potje") gewoon zichtbaar bij het laden
// van de pagina — soloRebuildSetup() vult en toont 'm namelijk onvoorwaardelijk, ongeacht welke
// tab actief is. setWalkMode('auto') zet alle mode-afhankelijke zichtbaarheid meteen goed (en
// bouwt de solo-spelerobjecten pas op zodra je écht naar "Zelf spelen" wisselt).
soloSyncBotOptions();
setWalkMode('auto');
