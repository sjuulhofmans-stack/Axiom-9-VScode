// ---------- multiplayer: lobby + peer-to-peer spel (host-autoritatief) ----------
// Hergebruikt het VOLLEDIGE spelsysteem van "zelf spelen" (97-solo.js) ongewijzigd — dit
// bestand voegt er alleen een netwerklaag omheen. Eén speler (de host) is de "scheidsrechter":
// zijn browser draait de echte soloXxx-functies precies zoals in solo-modus, en zendt na elke
// wijziging een volledige state-snapshot naar iedereen. Niet-host spelers muteren nooit zelf —
// hun klikken worden onderschept door mpIntercept() (zie de guard-regel in elk van de 9
// "eigenaar-acties" in 97-solo.js) en als een intent naar de host gestuurd. De host verwerkt dat
// intent door letterlijk dezelfde functie aan te roepen die een lokale klik ook aanroept.
//
// Waarom geen lockstep/replay (elke client dezelfde acties laten naspelen)? Bijna alles in
// 97-solo.js loopt via ÉÉN seeded RNG-stroom (soloRand) die na het opzetten alleen nog op de
// host mag draaien (zie CLAUDE.md/het onderzoek hiervoor) — dus alleen de host kan de spelregels
// echt uitvoeren. Client-side hoeft dan ook niets herberekend te worden: gewoon dezelfde
// module-level variabelen overschrijven met wat de host stuurt en de bestaande render-functies
// (renderWalkScore, paintWalkPawns, renderSoloMeta, ...) opnieuw aanroepen — die zijn al een
// pure functie van die variabelen.
//
// Trystero (WebRTC, geen eigen server) wordt LAZY geladen via een dynamische import() — pas
// zodra iemand hier daadwerkelijk op klikt, niet bij het laden van de pagina. Zie mpEnsureTrystero.

const mpTabBarEl = document.querySelector('.tab-bar');
const mpChoiceEl = document.getElementById('mpChoice');
const mpHostSetupEl = document.getElementById('mpHostSetup');
const mpHostRoomEl = document.getElementById('mpHostRoom');
const mpJoinFormEl = document.getElementById('mpJoinForm');
const mpJoinWaitingEl = document.getElementById('mpJoinWaiting');
const mpStatusEl = document.getElementById('mpStatus');
const mpHostSeatsEl = document.getElementById('mpHostSeats');
const mpWaitSeatsEl = document.getElementById('mpWaitSeats');
const mpRoomCodeTextEl = document.getElementById('mpRoomCodeText');
const mpChatPanelEl = document.getElementById('mpChatPanel');
const mpChatLogEl = document.getElementById('mpChatLog');
const mpChatFormEl = document.getElementById('mpChatForm');
const mpChatInputEl = document.getElementById('mpChatInput');
const mpChatPanelGameEl = document.getElementById('mpChatPanelGame');
const mpChatLogGameEl = document.getElementById('mpChatLogGame');
const mpChatFormGameEl = document.getElementById('mpChatFormGame');
const mpChatInputGameEl = document.getElementById('mpChatInputGame');

// Vaste namespace zodat onze rooms niet botsen met andermans Trystero-apps op dezelfde
// publieke signaling-relays. Geen geheim, puur een naamruimte.
const MP_APP_ID = 'axiom9-mapgen-v1';
// Gepind op een concrete versie (niet "latest") — anders breekt hosten/joinen op een dag
// zonder dat er iets in dit project veranderd is. Bij problemen: controleer de actuele
// import-syntax op https://github.com/dmotz/trystero.
//
// Bewust de MQTT-strategie i.p.v. de standaard (Nostr): getest vlak vóór het bouwen van deze
// feature bleken alle drie de standaard Nostr-relays die het kale "trystero"-pakket gebruikt
// stuk (twee gaven een foute HTTP-status, de derde eiste proof-of-work die de library niet
// oplost) — twee losse browsers vonden elkaar daardoor nooit. Met @trystero-p2p/mqtt vonden
// twee test-peers elkaar wel meteen en kwam een bericht foutloos aan. Mocht dit ooit weer
// omslaan: dit is de enige regel die moet veranderen.
const MP_TRYSTERO_URL = 'https://esm.run/@trystero-p2p/mqtt@0.25.3';

let mp = {
  active: false,          // een MP-sessie (lobby of potje) is bezig, ongeacht rol
  phase: 'idle',           // 'idle' | 'host-setup' | 'hosting' | 'join-form' | 'joining' | 'in-game'
  isHost: false,
  myPeerId: null,
  myIdx: -1,               // index in soloPlayers zodra het potje loopt
  hostPeerId: null,         // peerId van de host — bekend bij host (=mezelf) én client (via lobby-seats)
  roomCode: null,
  room: null,
  actions: null,
  stateVersion: 0,         // host: laatst uitgezonden versie. client: laatst toegepaste versie.
  lastFingerprint: null,    // host: vingerafdruk van de laatst uitgezonden state — voor dirty-detectie
  seats: [],                // lobby-fase: [{peerId, name, isHost}], host-only bijgehouden
  totalSeats: 4,
  fillBots: true,
  broadcastTimer: null,
  lastLogCount: 0,          // host: hoeveel regels walkLogEl al is uitgezonden
  pendingName: null,         // client: eigen naam, om na elke nieuwe peer-verbinding hello te (her)sturen
  processingIntent: false,   // host: true terwijl een gevalideerd intent wordt uitgevoerd (zie mpIntercept)
};

function mpSetStatus(html, cls){
  if (!mpStatusEl) return;
  mpStatusEl.innerHTML = html ? `<span class="${cls || ''}">${html}</span>` : '';
}

function mpGenRoomCode(){
  // geen dubbelzinnige tekens (0/O, 1/I) — dit is puur een lobby-code, geen spelregel-RNG
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
function mpCleanCode(raw){
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// ---------- Trystero laden + verbinden ----------
let mpTrysteroMod = null;
async function mpEnsureTrystero(){
  if (!mpTrysteroMod) mpTrysteroMod = await import(MP_TRYSTERO_URL);
  return mpTrysteroMod;
}

async function mpConnect(code){
  const { joinRoom, selfId } = await mpEnsureTrystero();
  mp.myPeerId = selfId;
  const room = joinRoom({ appId: MP_APP_ID }, code);
  mp.room = room;
  mp.roomCode = code;
  mpRegisterActions(room);
  return room;
}

function mpRegisterActions(room){
  const names = ['hello', 'lobby', 'start', 'state', 'leave', 'intent', 'stop', 'seat', 'chat'];
  mp.actions = {};
  for (const n of names) mp.actions[n] = room.makeAction(n);

  mp.actions.hello.onMessage = (data, { peerId }) => { if (mp.isHost) mpHostOnHello(peerId, data); };
  mp.actions.lobby.onMessage = (data) => { if (!mp.isHost) mpClientOnLobby(data); };
  mp.actions.seat.onMessage = (data, { peerId }) => { if (mp.isHost) mpHostSetSeatStart(peerId, data.startLabel); };
  // chat gaat NIET via de host — Trystero verbindt alle peers rechtstreeks met elkaar (mesh),
  // dus dit bericht komt toch al bij iedereen aan; geen reden om het via de scheidsrechter te
  // laten lopen zoals de spellogica (mp.actions.intent) dat wel moet vanwege de seeded RNG.
  mp.actions.chat.onMessage = (data, { peerId }) => mpOnRemoteChat(peerId, data);
  mp.actions.start.onMessage = (data) => { if (!mp.isHost) mpClientOnStart(data); };
  mp.actions.state.onMessage = (data) => { if (!mp.isHost) mpApplyState(data); };
  mp.actions.intent.onMessage = (data, { peerId }) => { if (mp.isHost) mpHandleIntent(peerId, data); };
  mp.actions.leave.onMessage = (data, { peerId }) => { mpOnPeerLeave(peerId, true); };
  // host stopt het lopende potje bewust (zie btnMpLeaveGame) terwijl de room open blijft —
  // anders dan 'leave' verlaat niemand de room hierbij, gasten gaan terug naar de wachtkamer.
  mp.actions.stop.onMessage = () => { if (!mp.isHost) mpClientOnStop(); };

  // room.onPeerJoin vuurt pas zodra de WebRTC-datachannel naar die peer daadwerkelijk klaar is
  // (dat kan een paar seconden na joinRoom() duren, via de signaling-relay) — een 'hello' die je
  // daarvóór al verstuurt, verdwijnt dus in het niets. Zelfherstellend: (opnieuw) versturen zodra
  // er echt een verbinding tot stand komt, niet meteen na het aanroepen van joinRoom().
  room.onPeerJoin = (peerId) => {
    if (mp.isHost) mpHostOnPeerJoin(peerId);
    else if (mp.pendingName) mp.actions.hello.send({ name: mp.pendingName });
  };
  room.onPeerLeave = (peerId) => { mpOnPeerLeave(peerId, false); };
}

// ---------- host: lobby ----------
async function mpHostCreate(){
  const name = soloCleanName(document.getElementById('mpHostName').value) || 'Speler 1';
  mp.totalSeats = Math.max(2, Math.min(WALK_MAX_PLAYERS, parseInt(document.getElementById('mpHostTotal').value, 10) || 4));
  mp.fillBots = document.getElementById('mpHostFillBots').value === 'bots';
  const code = mpGenRoomCode();
  mpSetStatus('Verbinden...', '');
  try {
    await mpConnect(code);
  } catch (err){
    mpSetStatus('Kon geen verbinding maken. Controleer je internetverbinding.', 'bad');
    return;
  }
  mp.active = true;
  mp.isHost = true;
  mp.phase = 'hosting';
  mp.hostPeerId = mp.myPeerId;
  mp.seats = [{ peerId: mp.myPeerId, name, isHost: true, startLabel: SIM_START_LABELS[0] }];
  mpRoomCodeTextEl.textContent = code;
  mpHostRoomEl.hidden = false;
  if (mpChatPanelEl) mpChatPanelEl.hidden = false;
  mpSetStatus('', '');
  mpRenderHostSeats();
}
function mpHostOnHello(peerId, data){
  if (mp.seats.some(s => s.peerId === peerId)) return;
  if (mp.seats.length >= mp.totalSeats){
    mp.actions.leave.send({ reason: 'vol' }, peerId);
    return;
  }
  const name = soloCleanName(data && data.name) || `Speler ${mp.seats.length + 1}`;
  // eerste nog vrije startvakje toewijzen — met 4 labels en hoogstens 4 zitplaatsen is er
  // altijd één vrij; de speler kan 'm hierna zelf nog wisselen (zie mpHostSetSeatStart)
  const taken = new Set(mp.seats.map(s => s.startLabel));
  const startLabel = SIM_START_LABELS.find(l => !taken.has(l)) || SIM_START_LABELS[0];
  mp.seats.push({ peerId, name, isHost: false, startLabel });
  mpBroadcastLobby();
  mpRenderHostSeats();
}
function mpHostOnPeerJoin(){
  // niets te doen — we wachten op hun 'hello' met gekozen naam vóórdat we ze aan de lobby
  // toevoegen. Zie mpHostOnHello.
}
// speler (host zelf of een gast, via het 'seat'-bericht) kiest een eigen startvakje. Twee
// mensen mogen niet dezelfde plek hebben — net als in de solo-opzet (soloRenderSetupUI)
// wisselen we gewoon om met wie 'm nu heeft, in plaats van iets ingewikkelders.
function mpHostSetSeatStart(peerId, startLabel){
  if (!SIM_START_LABELS.includes(startLabel)) return;
  const seat = mp.seats.find(s => s.peerId === peerId);
  if (!seat || seat.startLabel === startLabel) return;
  const clash = mp.seats.find(s => s.peerId !== peerId && s.startLabel === startLabel);
  if (clash) clash.startLabel = seat.startLabel;
  seat.startLabel = startLabel;
  mpBroadcastLobby();
  mpRenderHostSeats();
}
function mpBroadcastLobby(){
  if (!mp.isHost || !mp.actions) return;
  mp.actions.lobby.send({ seats: mp.seats, totalSeats: mp.totalSeats, fillBots: mp.fillBots });
}
function mpRenderHostSeats(){
  if (!mpHostSeatsEl) return;
  mpHostSeatsEl.innerHTML = mp.seats.map((s, i) => mpSeatRowHtml(s, i)).join('') +
    (mp.seats.length < mp.totalSeats
      ? `<p class="hint">Wachten op ${mp.totalSeats - mp.seats.length} speler(s)${mp.fillBots ? ' (of start met bots op de rest)' : ''}...</p>`
      : '');
  const btn = document.getElementById('btnMpHostStart');
  if (btn) btn.disabled = mp.seats.length < 1 || (!mp.fillBots && mp.seats.length < mp.totalSeats);
}
function mpSeatRowHtml(seat, i){
  const you = seat.peerId === mp.myPeerId;
  const cls = you ? 'mp-seat-you' : (seat.isHost ? 'mp-seat-host' : '');
  const tag = seat.isHost ? ' · host' : '';
  // alleen je EIGEN rij krijgt een keuzemenu — andermans plek is hier puur informatief
  const startPicker = you
    ? `<select class="mp-seat-start" data-mp-start aria-label="Jouw startpositie">` +
        SIM_START_LABELS.map(l => `<option value="${l}"${l === seat.startLabel ? ' selected' : ''}>${l}</option>`).join('') +
      `</select>`
    : `<span class="mp-seat-start-badge" title="startpositie">${seat.startLabel || '?'}</span>`;
  return `<div class="walk-solo-setup-player" style="--pc:${WALK_PLAYER_COLORS[i % WALK_PLAYER_COLORS.length]}">` +
    `<span class="walk-solo-setup-dot"></span>` +
    `<span class="${cls}">${seat.name}${you ? ' (jij)' : ''}${tag}</span>` +
    startPicker +
  `</div>`;
}
// klik-afhandeling voor het keuzemenu hierboven — staat op zowel de host- als de gast-lijst
// (mpHostSeatsEl resp. mpWaitSeatsEl), maar er is altijd maar precies 1 <select> in beeld:
// je eigen rij. Host past zijn eigen zitplaats direct lokaal aan; een gast stuurt een 'seat'-
// bericht en wacht op de bijgewerkte lobby-broadcast (zie mpHostSetSeatStart hierboven).
function mpHandleSeatPickerChange(e){
  const sel = e.target.closest('[data-mp-start]');
  if (!sel) return;
  if (mp.isHost) mpHostSetSeatStart(mp.myPeerId, sel.value);
  else if (mp.actions && mp.actions.seat) mp.actions.seat.send({ startLabel: sel.value });
}
if (mpHostSeatsEl) mpHostSeatsEl.addEventListener('change', mpHandleSeatPickerChange);
if (mpWaitSeatsEl) mpWaitSeatsEl.addEventListener('change', mpHandleSeatPickerChange);

function mpHostStop(){
  mpTeardown();
  mpRenderLobby();
}

// ---------- client: lobby ----------
async function mpJoinConnect(){
  const name = soloCleanName(document.getElementById('mpJoinName').value);
  const code = mpCleanCode(document.getElementById('mpJoinCode').value);
  if (!code){ mpSetStatus('Vul een spelcode in.', 'bad'); return; }
  mpSetStatus('Verbinden...', '');
  try {
    await mpConnect(code);
  } catch (err){
    mpSetStatus('Kon geen verbinding maken. Controleer je internetverbinding.', 'bad');
    return;
  }
  mp.active = true;
  mp.isHost = false;
  mp.phase = 'joining';
  mp.pendingName = name || 'Speler';
  mp.actions.hello.send({ name: mp.pendingName });   // meteen proberen; onPeerJoin herhaalt 'm zodra de verbinding er echt is
  mpJoinWaitingEl.hidden = false;
  if (mpChatPanelEl) mpChatPanelEl.hidden = false;
  mpSetStatus('', '');
}
function mpClientOnLobby(data){
  mp.seats = data.seats;
  mp.totalSeats = data.totalSeats;
  mp.fillBots = data.fillBots;
  // de host-rij staat er altijd bij (isHost:true) — zo kent een client het host-peerId al
  // vóórdat het potje start, nodig om straks een écht vertrek van de host te herkennen
  // (zie mpOnPeerLeave) i.p.v. elke vertrekkende medespeler daarvoor aan te zien.
  const hostSeat = mp.seats.find(s => s.isHost);
  if (hostSeat) mp.hostPeerId = hostSeat.peerId;
  if (mpWaitSeatsEl) mpWaitSeatsEl.innerHTML = mp.seats.map((s, i) => mpSeatRowHtml(s, i)).join('');
}
function mpJoinLeave(){
  mpTeardown();
  mpRenderLobby();
}

// ---------- vertrek/opruimen ----------
function mpTeardown(){
  if (mp.broadcastTimer) clearInterval(mp.broadcastTimer);
  if (mp.room){
    try { if (mp.actions && mp.actions.leave) mp.actions.leave.send({}); } catch (e){}
    try { mp.room.leave(); } catch (e){}
  }
  window.mpGameActive = false;
  if (mpTabBarEl) mpTabBarEl.classList.remove('mp-locked');
  if (btnMpLeaveGame) btnMpLeaveGame.hidden = true;
  if (mpChatPanelEl) mpChatPanelEl.hidden = true;
  if (mpChatPanelGameEl) mpChatPanelGameEl.hidden = true;
  // een nieuwe room is een vers gesprek — het vorige hoort niet ineens weer op te duiken
  // zodra je een andere keer opnieuw host/join doet
  mpChatMessages = [];
  mpRenderChat();
  mp = {
    active: false, phase: 'idle', isHost: false, myPeerId: null, myIdx: -1, hostPeerId: null,
    roomCode: null, room: null, actions: null, stateVersion: 0, lastFingerprint: null, seats: [],
    totalSeats: 4, fillBots: true, broadcastTimer: null, lastLogCount: 0, pendingName: null,
    processingIntent: false,
  };
}

// Iemand viel weg (bewust vertrokken óf verbinding verloren — Trystero's onPeerLeave dekt
// beide, we kunnen dat verschil client-side niet altijd zien, en dat hoeft ook niet).
function mpOnPeerLeave(peerId, explicit){
  if (mp.phase === 'hosting' || mp.phase === 'joining'){
    // nog in de lobby: gewoon de rij schrappen
    if (mp.isHost){
      mp.seats = mp.seats.filter(s => s.peerId !== peerId);
      mpBroadcastLobby();
      mpRenderHostSeats();
    }
    return;
  }
  if (mp.phase !== 'in-game') return;
  if (mp.isHost){
    const p = soloPlayers.find(pl => pl.peerId === peerId);
    if (!p || !p.isHuman) return;
    // neem de speler over met de bestaande bot-logica — geen nieuwe spellogica nodig
    p.isHuman = false;
    p.peerId = null;
    p.strategy = ENERGY_STRATEGIES[p.idx % ENERGY_STRATEGIES.length];
    walkLog(`${p.name} heeft de verbinding verloren — wordt vanaf nu automatisch bestuurd.`, null, p);
    // als hij net zelf aan zet was (soloActiveIdx) en op interactie stond te wachten, is er
    // geen halve-beurt-hervatting: gewoon opnieuw door de lus, die ziet 'm nu als bot.
    if (soloPlayers[soloActiveIdx] === p && soloPhase !== 'game-over'){
      soloActiveIdx = -1;
      soloAdvanceLoop();
    }
    mpBroadcastState();
  } else {
    // Alleen als de vertrokken peer daadwerkelijk de host was, stopt het potje voor iedereen —
    // een gewone medespeler die wegvalt wordt al aan de hostkant (hierboven) omgezet naar een
    // bot, en die bijgewerkte staat komt via de eerstvolgende mpBroadcastState() vanzelf door.
    // (voorheen werd hier ELKE vertrekkende peer als "host weg" behandeld, want de guard keek
    // naar soloPlayers[soloActiveIdx] i.p.v. naar de meegegeven peerId.)
    if (peerId !== mp.hostPeerId) return;
    mpSetStatus('De host heeft het spel verlaten — het potje is gestopt.', 'bad');
    mpExitPlayView();
    mpTeardown();
    switchTab('multi');
    mpRenderLobby();
  }
}

// ---------- host: potje starten ----------
function mpHostStartGame(){
  const total = mp.totalSeats;
  const humans = mp.seats.slice(0, total);
  const soloSeedRand = mulberry32(Math.floor(Math.random() * 4294967296));
  // mensen kozen hun plek al in de lobby (mpHostSetSeatStart, altijd onderling uniek dankzij
  // de wissel-bij-botsing daar) — bots krijgen willekeurig wat er nog overblijft
  const takenLabels = new Set(humans.filter(Boolean).map(s => s.startLabel));
  const freeLabels = simShuffle(SIM_START_LABELS.filter(l => !takenLabels.has(l)), soloSeedRand);
  let freeIdx = 0;
  const players = [];
  for (let i = 0; i < total; i++){
    const seat = humans[i];
    const isHuman = !!seat;
    players.push({
      idx: i, isHuman,
      name: isHuman ? seat.name : `Speler ${i + 1}`,
      color: WALK_PLAYER_COLORS[i],
      deck: simShuffle(SIM_QUEST_LABELS, soloSeedRand),
      nextIdx: 0, completed: 0, energy: 0, cards: [], rank: 0, doneCells: [],
      condenserPending: false, lockedNextTurn: false, rollPenalty: 0, barrierCell: null,
      reorderBlocked: false, lastDir: -1,
      strategy: isHuman ? null : ENERGY_STRATEGIES[i % ENERGY_STRATEGIES.length],
      startLabel: isHuman ? seat.startLabel : freeLabels[freeIdx++],
      pos: null, skipEnergyRoll: false, actionUses: 0,
      peerId: isHuman ? seat.peerId : null,
    });
  }

  const reach = analyseCellReachability();
  if (reach.unreachable.length > 0){
    mpSetStatus(`Dit bord heeft ${reach.unreachable.length} onbereikbare vakjes — pas de indeling aan op tabblad "Speelbord genereren".`, 'bad');
    return;
  }
  const graph = buildSimGraph();
  const missing = [...SIM_QUEST_LABELS, ...SIM_START_LABELS].filter(l =>
    graph.questCells[l] === undefined && graph.startCells[l] === undefined);
  if (missing.length){
    mpSetStatus(`Deze vakjes ontbreken op het bord: ${missing.join(', ')}.`, 'bad');
    return;
  }
  for (const p of players) p.pos = graph.startCells[p.startLabel];

  soloGraph = graph;
  soloPlayers = players;
  soloSetupRand = soloSeedRand;
  soloRand = soloSeedRand;
  soloTurnOrder = simShuffle(players.map(p => p.idx), soloRand);
  walkScoreOrder = soloTurnOrder;
  soloFinishTarget = simFinishTarget(players.length);
  soloFinished = 0;
  soloRoundFinishers = [];
  soloRoundPos = 0;
  soloTurn = 0;
  soloDeck = buildActionDeck(soloRand);
  soloActiveIdx = -1;

  mp.phase = 'in-game';
  mp.myIdx = players.findIndex(p => p.peerId === mp.myPeerId);
  mp.stateVersion = 0;
  mp.lastLogCount = 0;

  mpEnterPlayView();
  walkLogEl.innerHTML = '';
  for (const p of players){
    const who = p.isHuman ? '(mens)' : '(bot)';
    const stratNote = p.isHuman ? '' : ` · energie: <b>${ENERGY_ACTIONS[p.strategy].name}</b>`;
    const first = p.deck[0];
    walkLog(`${p.name} ${who} start op <b>${p.startLabel}</b>${stratNote} · eerste opdracht: ${first} — ${QUEST_NAMES[first] || ''}`, null, p);
  }
  walkLog(soloPlayers.length === 2
    ? `Er wordt gespeeld tot de winnaar binnen is — de ander is dan tweede.`
    : `Er wordt doorgespeeld tot de <b>${soloFinishTarget}e</b> binnen is.`);

  mp.actions.start.send({
    layout: layout.slice(),
    players: mpPublicPlayers(soloPlayers),
    turnOrder: soloTurnOrder,
    finishTarget: soloFinishTarget,
  });

  mp.lastFingerprint = null;
  mp.broadcastTimer = setInterval(mpBroadcastTick, 200);
  soloAdvanceLoop();
  mpBroadcastState();
}

// ---------- client: potje ontvangen ----------
function mpClientOnStart(payload){
  layout = payload.layout.slice();
  soloGraph = buildSimGraph();
  // wegwerp-RNG, puur zodat toevallige UI-filters die soloRand aanraken (bv. soloCardBlockReason
  // op een Duwstoot-kaart in de eigen hand) niet crashen — het RESULTAAT wordt hier nooit
  // vertrouwd; alleen de host speelt het potje echt uit en zendt de uitkomsten.
  soloRand = mulberry32(Math.floor(Math.random() * 4294967296));
  soloPlayers = payload.players;
  soloTurnOrder = payload.turnOrder;
  walkScoreOrder = soloTurnOrder;
  soloFinishTarget = payload.finishTarget;
  soloFinished = 0;
  soloRoundFinishers = [];
  soloRoundPos = 0;
  soloTurn = 0;
  soloActiveIdx = -1;
  mp.phase = 'in-game';
  mp.myIdx = soloPlayers.findIndex(p => p.peerId === mp.myPeerId);
  mp.stateVersion = 0;
  walkLogEl.innerHTML = '';
  mpEnterPlayView();
}

// ---------- host: uitzenden ----------
function mpBroadcastTick(){
  if (!mp.isHost || mp.phase !== 'in-game') return;
  // GEEN cosmetische verberg-truc hier (eerdere versie mutéérde btnWalkSoloRoll/Skip.hidden en
  // walkSoloActionsEl.innerHTML op de host-DOM zodra een medespeler aan zet was — maar
  // mpBroadcastState() leest die ZELFDE elementen als bron voor wat naar iedereen gaat. Elke
  // volgende tick zond dan de eigen "cosmetisch verborgen" waarde van de vorige tick weer uit,
  // dus de eigenaar zelf zag zijn dobbel-/actieknoppen nooit meer verschijnen — gevonden tijdens
  // testen met twee losse browsers). mpIntercept blokkeert een klik hier toch al; het hostscherm
  // oogt tijdens andermans beurt dus soms nog even interactief, maar doet functioneel niets.
  mpRefreshCardVault();
  mpBroadcastState();
}
// ---------- publieke view: nooit verborgen informatie uitzenden ----------
// soloPlayers/soloDeck bevatten spelinterne info die geen enkele client mag kunnen aflezen:
// de volledige geschudde opdrachtvolgorde (2.1-2.9) van IEDEREEN, en de volgorde van de
// actiekaart-trekstapel. Wat WEL al publiek hoort te zijn (zie renderWalkScore in 96-walk.js,
// dat toont voor elke speler altijd al p.deck[p.nextIdx]) blijft gewoon zichtbaar: het huidige
// doel van elke speler. De rest van ieders stapel (nog te komen opdrachten) wordt hier
// vervangen door null — de array-lengte en -index blijven kloppen, dus bestaande render-code
// (renderWalkScore, de doel-marker op het bord) hoeft niet aangepast te worden.
function mpPublicPlayer(p){
  const deck = new Array(p.deck.length).fill(null);
  if (p.nextIdx < p.deck.length) deck[p.nextIdx] = p.deck[p.nextIdx];
  return { ...p, deck };
}
function mpPublicPlayers(players){ return players.map(mpPublicPlayer); }
// soloDeck.draw/.discard zijn de trekstapel/aflegstapel-VOLGORDE — client-code heeft daar
// nooit meer dan de lengte van nodig (zie soloCardBlockReason: 'de trekstapel is leeg' etc.),
// dus die volgorde/inhoud wordt hier nooit meegestuurd.
function mpPublicDeck(deck){
  return { draw: { length: deck.draw.length }, discard: { length: deck.discard.length } };
}

function mpBroadcastState(){
  if (!mp.isHost || !mp.actions || mp.phase !== 'in-game') return;
  const newLines = [...walkLogEl.children].slice(mp.lastLogCount)
    .map(el => ({ html: el.innerHTML, cls: el.className }));
  const core = {
    soloPlayers: mpPublicPlayers(soloPlayers), soloActiveIdx, soloPhase, soloTurn, soloTargetKey, soloMove,
    soloBootsOptions, soloCurrentLegalMoves, soloRoundPos, soloTurnOrder,
    soloBankCountThisTurn, soloAllowUturn, soloPendingBoost, soloUsedBoots, soloUsedJump,
    soloTargetSwapped, soloUsedEnergyId, soloUsedCardId, soloDiscardedCardId,
    soloEnergyRoll, soloEnergyGain, soloBlindOfferAvailable, soloLockedThisTurn,
    soloActionCellDrawnThisTurn, walkScoreOrder, soloDeck: mpPublicDeck(soloDeck),
    soloFinished, soloFinishTarget, soloRoundFinishers,
    ownerUi: {
      rollHidden: btnWalkSoloRoll ? btnWalkSoloRoll.hidden : true,
      skipHidden: btnWalkSoloSkip ? btnWalkSoloSkip.hidden : true,
      actionsHtml: walkSoloActionsEl ? walkSoloActionsEl.innerHTML : '',
      stepHidden: walkStepCounterEl ? walkStepCounterEl.hidden : true,
      stepDone: walkStepDoneEl ? walkStepDoneEl.textContent : '–',
      stepLeft: walkStepLeftEl ? walkStepLeftEl.textContent : '–',
      clickableKeys: walkBoardEl
        ? [...walkBoardEl.querySelectorAll('.walk-clickable')].map(el => parseInt(el.dataset.key, 10))
        : [],
    },
    statusHtml: walkStatusEl ? walkStatusEl.innerHTML : '',
  };
  // Dirty-detectie (i.p.v. stateVersion elke 200ms onvoorwaardelijk ophogen): mpHandleIntent
  // accepteert een intent van een gast alleen bij EXACT de huidige stateVersion, en negeert 'm
  // anders stilzwijgend. Bij normale netwerklatency kon een intent zo precies tussen twee
  // ticks in verspringen. Nu blijft de versie staan zolang er niets wijzigt — de tick zendt de
  // huidige state nog steeds elke 200ms uit (voor nieuwe/herverbindende peers), maar verhoogt
  // de versie alleen als er ook echt iets anders uitgaat dan de vorige keer.
  const fingerprint = JSON.stringify(core) + '|' + newLines.length;
  if (fingerprint !== mp.lastFingerprint){
    mp.stateVersion++;
    mp.lastFingerprint = fingerprint;
  }
  mp.lastLogCount = walkLogEl.children.length;
  mp.actions.state.send({ stateVersion: mp.stateVersion, ...core, newLogLines: newLines });
  if (soloPhase === 'game-over') mpOnGameOver();
}

// ---------- client: state toepassen ----------
function mpApplyState(payload){
  if (payload.stateVersion <= mp.stateVersion) return;   // verouderd/dubbel, negeren
  mp.stateVersion = payload.stateVersion;

  soloPlayers = payload.soloPlayers;
  soloActiveIdx = payload.soloActiveIdx;
  soloPhase = payload.soloPhase;
  soloTurn = payload.soloTurn;
  soloTargetKey = payload.soloTargetKey;
  soloMove = payload.soloMove;
  soloBootsOptions = payload.soloBootsOptions;
  soloCurrentLegalMoves = payload.soloCurrentLegalMoves;
  soloRoundPos = payload.soloRoundPos;
  soloTurnOrder = payload.soloTurnOrder;
  soloBankCountThisTurn = payload.soloBankCountThisTurn;
  soloAllowUturn = payload.soloAllowUturn;
  soloPendingBoost = payload.soloPendingBoost;
  soloUsedBoots = payload.soloUsedBoots;
  soloUsedJump = payload.soloUsedJump;
  soloTargetSwapped = payload.soloTargetSwapped;
  soloUsedEnergyId = payload.soloUsedEnergyId;
  soloUsedCardId = payload.soloUsedCardId;
  soloDiscardedCardId = payload.soloDiscardedCardId;
  soloEnergyRoll = payload.soloEnergyRoll;
  soloEnergyGain = payload.soloEnergyGain;
  soloBlindOfferAvailable = payload.soloBlindOfferAvailable;
  soloLockedThisTurn = payload.soloLockedThisTurn;
  soloActionCellDrawnThisTurn = payload.soloActionCellDrawnThisTurn;
  walkScoreOrder = payload.walkScoreOrder;
  soloDeck = payload.soloDeck;
  soloFinished = payload.soloFinished;
  soloFinishTarget = payload.soloFinishTarget;
  soloRoundFinishers = payload.soloRoundFinishers;

  const active = soloPlayers[soloActiveIdx];
  if (active){
    const label = active.deck[active.nextIdx];
    if (label) markWalkTarget(soloGraph, label, soloTargetKey, active.color);
    else clearWalkTarget();
  } else {
    clearWalkTarget();
  }

  paintWalkPawns(soloGraph, soloPlayers, soloActiveIdx);
  renderWalkScore(soloPlayers, soloActiveIdx);
  renderSoloMeta(soloMove ? soloMove.stepsLeft : undefined);
  mpRefreshCardVault();

  if (soloMove && soloMove.d1 !== undefined && soloPhase !== 'choose-action' && soloPhase !== 'rolling'){
    renderWalkDice(soloMove.d1, soloMove.d2, soloEnergyRoll, false, soloMove.d3);
  } else if (soloEnergyRoll !== null && soloPhase === 'rolling'){
    renderSoloDicePending();
  }

  const isMine = active && active.peerId === mp.myPeerId;
  const ui = payload.ownerUi;
  if (btnWalkSoloRoll) btnWalkSoloRoll.hidden = isMine ? ui.rollHidden : true;
  if (btnWalkSoloSkip) btnWalkSoloSkip.hidden = isMine ? ui.skipHidden : true;
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = isMine ? ui.actionsHtml : '';
  if (walkStepCounterEl) walkStepCounterEl.hidden = isMine ? ui.stepHidden : true;
  if (walkStepDoneEl) walkStepDoneEl.textContent = isMine ? ui.stepDone : '–';
  if (walkStepLeftEl) walkStepLeftEl.textContent = isMine ? ui.stepLeft : '–';
  if (isMine) soloMarkClickable(soloGraph, ui.clickableKeys); else soloClearClickable();

  if (walkStatusEl) walkStatusEl.innerHTML = payload.statusHtml || '';
  for (const line of payload.newLogLines || []){
    const div = document.createElement('div');
    div.className = line.cls || '';
    div.innerHTML = line.html;
    walkLogEl.appendChild(div);
  }
  if (payload.newLogLines && payload.newLogLines.length) walkLogEl.scrollTop = walkLogEl.scrollHeight;

  if (soloPhase === 'game-over') mpOnGameOver();
}

function mpOnGameOver(){
  if (!window.mpGameActive) return;
  window.mpGameActive = false;
  if (mpTabBarEl) mpTabBarEl.classList.remove('mp-locked');
  if (btnMpLeaveGame) btnMpLeaveGame.hidden = true;
  // de 200ms-broadcasttick tikte hierna anders onnodig door tot de host handmatig "Stop
  // hosting" deed — en mp.phase bleef op 'in-game' staan, terwijl er geen potje meer loopt.
  if (mp.broadcastTimer){ clearInterval(mp.broadcastTimer); mp.broadcastTimer = null; }
  // host: terug naar de hostkamer, zodat meteen een nieuw potje gestart kan worden met
  // dezelfde zitplaatsen. client: terug naar "wacht op de host", de verbinding blijft intact.
  mp.phase = mp.isHost ? 'hosting' : 'joining';
}

// ---------- eigen hand (kaartkluis/kaartvenster) — "wie ben ik", niet "wie is aan zet" ----------
// solo()/soloRefreshCardVault() tonen solo().cards, oftewel de hand van wie NU aan zet is — in
// multiplayer is dat niet meer per se je eigen hand. Deze varianten lezen daarom altijd van
// soloPlayers[mp.myIdx], en vervangen soloRefreshCardVault/soloRenderCardGrid zolang een
// MP-potje loopt.
function mpMe(){ return mp.myIdx >= 0 ? soloPlayers[mp.myIdx] : null; }
function mpRefreshCardVault(){
  if (!walkCardVaultEl) return;
  const me = mpMe();
  const cards = me && !me.rank ? me.cards : [];
  if (!cards.length){ walkCardVaultEl.hidden = true; return; }
  walkCardVaultEl.hidden = false;
  walkCardVaultThumbsEl.innerHTML = cards.map(id => ACTION_CARD_IMAGES[id]
    ? `<img src="${ACTION_CARD_IMAGES[id]}" alt="${ACTION_CARDS[id].name}">`
    : `<span class="walk-card-vault-blank action-card--${ACTION_CARD_TINTS[id]}" title="${ACTION_CARDS[id].name}"></span>`).join('');
  walkCardVaultCountEl.textContent = cards.length === 1 ? '1 actiekaart' : `${cards.length} actiekaarten`;
  // geen "N speelbaar"-telling zoals in solo — soloCardBlockReason() rekent tegen wie NU aan
  // zet is, niet tegen mij; klik gewoon de kluis om te bekijken (soloOpenCardPanel doet de
  // juiste eigenaar-check al, zie de guard daar).
  walkCardVaultHintEl.textContent = 'klik om te bekijken →';
}

// ---------- intercept: eigenaar-acties uit 97-solo.js routeren ----------
// Wordt aangeroepen als allereerste (of, waar een bestaande validity-check al eerder in de
// functie staat, direct daarna) regel in elk van de 9 eigenaar-acties. Retourneert true als de
// aanroeper meteen moet stoppen (lokaal niets muteren), false als hij gewoon door moet gaan
// zoals in solo-modus.
function mpIntercept(action, args){
  if (!mp.active || mp.phase !== 'in-game') return false;
  // De host die net een GEVALIDEERD intent van een medespeler verwerkt (zie mpHandleIntent) mag
  // altijd door — zonder deze vlag zou de check hieronder ("is de actieve speler wel ik?") de
  // host ook hier blokkeren, want tijdens het verwerken van andermans beurt is de actieve speler
  // per definitie niet de host zelf. Gevonden tijdens testen: zonder deze vlag deed een intent
  // van de niet-host speler letterlijk niets.
  if (mp.isHost && mp.processingIntent) return false;
  const owner = soloPlayers[soloActiveIdx];
  const ownerIsMe = !!owner && owner.peerId === mp.myPeerId;
  if (mp.isHost) return !ownerIsMe;   // eigen beurt: gewoon lokaal uitvoeren; andermans beurt: niks doen, wacht op hun intent
  if (!ownerIsMe) return true;         // niet mijn beurt: negeren
  mp.actions.intent.send({ action, args, stateVersion: mp.stateVersion });
  return true;
}

const MP_INTENT_HANDLERS = {
  rollDice: () => soloRollDice(),
  proceedToRoll: () => soloProceedToRoll(),
  skipToRoll: () => soloSkipToRoll(),
  moveClick: (a) => soloHandleMoveClick(a.key),
  useEnergy: (a) => soloUseEnergyAction(a.id),
  playCard: (a) => soloPlayCard(a.id),
  discardCard: (a) => soloDiscardCard(a.id),
  resolveTarget: (a) => soloResolveTargetCard(a.cardId, a.targetIdx),
  resolveBoots: (a) => soloResolveBoots(a.dir),
  jumpClick: (a) => soloHandleJumpClick(a.key),
  blindOffer: (a) => soloResolveBlindOffer(a.yes),
};
function mpHandleIntent(peerId, msg){
  if (!mp.isHost || mp.phase !== 'in-game') return;
  if (msg.stateVersion !== mp.stateVersion) return;   // verouderd, host is intussen verder
  const owner = soloPlayers[soloActiveIdx];
  if (!owner || owner.peerId !== peerId) return;       // niet aan zet, negeren
  const handler = MP_INTENT_HANDLERS[msg.action];
  if (!handler) return;
  mp.processingIntent = true;
  try { handler(msg.args || {}); }
  finally { mp.processingIntent = false; }
  mpBroadcastState();
  // De handler hierboven riep onderweg (via de gewone 97-solo.js-functies) soloRefreshCardVault()
  // aan, die ONVOORWAARDELIJK solo().cards toont — dat is hier de gast wiens intent net verwerkt
  // is, niet de host. Zonder deze regel zag de host tot de eerstvolgende broadcasttick (max
  // 200ms) heel even de kaartkluis van de gast in zijn eigen scherm. mpRefreshCardVault() leest
  // altijd van mpMe() en herstelt dus meteen de eigen hand van de host.
  mpRefreshCardVault();
}

// ---------- overgang naar/uit het speelscherm (hergebruikt tabblad "Stap voor stap") ----------
function mpEnterPlayView(){
  window.mpGameActive = true;
  if (mpTabBarEl) mpTabBarEl.classList.add('mp-locked');
  switchTab('walk');
  // Multiplayer heeft geen lobby-scherm nodig (dat staat al op tabblad "Multiplayer" — hosten/
  // deelnemen/spelers klaarzetten) en ook geen Pauze/Stoppen/Nieuw potje (dat is "Verlaat potje"
  // hieronder), dus meteen door naar het speelscherm zonder fade — dit IS de fade-bestemming die
  // walkFadeToPlay() ook gebruikt (#walkPlayArea), alleen ongeanimeerd want switchTab() wisselt
  // toch al in één klap van tabblad.
  if (walkLobbyEl) walkLobbyEl.hidden = true;
  if (walkPlayAreaEl) walkPlayAreaEl.hidden = false;
  walkFooterSyncVisibility();   // walkPlayAreaEl.hidden wijzigde net hierboven, niet via walkFadeSwap()
  if (walkPlayTopbarEl) walkPlayTopbarEl.hidden = true;
  if (walkModeAutoBtn) walkModeAutoBtn.hidden = true;
  if (walkModeSoloBtn) walkModeSoloBtn.hidden = true;
  if (walkAutoControlsEl) walkAutoControlsEl.hidden = true;
  if (walkSoloControlsEl) walkSoloControlsEl.hidden = true;
  if (walkSoloSetupEl) walkSoloSetupEl.hidden = true;
  if (walkSoloStartRowEl) walkSoloStartRowEl.hidden = true;
  if (walkAutoHintEl) walkAutoHintEl.hidden = true;
  if (walkSoloHintEl) walkSoloHintEl.hidden = true;
  if (walkSoloPanelEl) walkSoloPanelEl.hidden = false;
  if (walkEnergyOverviewEl) walkEnergyOverviewEl.hidden = false;
  // alle andere tabbladen zitten op slot (.mp-locked) zolang dit potje loopt — dit knopje leeft
  // BUITEN walkSoloActionsEl (dat wordt elke broadcast overschreven) en is dus altijd bereikbaar,
  // ook als het niet jouw beurt is. Zie mpLeaveGame().
  if (btnMpLeaveGame) btnMpLeaveGame.hidden = false;
  // chat verhuist niet echt (zie mpRenderChat) — hij staat hier gewoon al klaar met dezelfde
  // berichten die in de lobby ook al zichtbaar waren.
  if (mpChatPanelGameEl) mpChatPanelGameEl.hidden = false;
  mpRenderChat();
  renderWalkBoard();
}
function mpExitPlayView(){
  window.mpGameActive = false;
  if (mpTabBarEl) mpTabBarEl.classList.remove('mp-locked');
  if (btnMpLeaveGame) btnMpLeaveGame.hidden = true;
  if (mpChatPanelGameEl) mpChatPanelGameEl.hidden = true;
  if (walkModeAutoBtn) walkModeAutoBtn.hidden = false;
  if (walkModeSoloBtn) walkModeSoloBtn.hidden = false;
  // terug naar een complete, kloppende lobby (ongeanimeerd, zelfde reden als in
  // mpEnterPlayView) — mpLeaveGame() schakelt hierna toch meteen naar tabblad "Multiplayer",
  // maar mocht iemand later gewoon weer naar "Stap voor stap" klikken, dan hoort daar het
  // startscherm te staan, niet het (inmiddels gestopte) speelscherm van het vorige potje.
  // setWalkMode('auto') doet dat in één keer, inclusief alle velden die mpEnterPlayView()
  // hierboven had weggestopt (walkAutoControlsEl, walkSoloControlsEl, enz.).
  setWalkMode('auto');
}

// ---------- mid-game vertrekken (bereikbaar tijdens 'in-game', zie btnMpLeaveGame) ----------
// Host: het potje stopt voor iedereen, maar de room/lobby blijft bestaan zodat meteen een
// nieuw potje gestart kan worden (zelfde eindtoestand als mpOnGameOver, zie daar).
// Gast: verlaat de room helemaal en gaat terug naar het join-scherm — hergebruikt exact het
// pad van "host is weg" (mpOnPeerLeave) resp. de bestaande mpJoinLeave().
function mpLeaveGame(){
  if (!mp.active || mp.phase !== 'in-game') return;
  if (mp.isHost){
    if (mp.actions && mp.actions.stop) mp.actions.stop.send({});
    if (mp.broadcastTimer){ clearInterval(mp.broadcastTimer); mp.broadcastTimer = null; }
    mp.phase = 'hosting';
    mpExitPlayView();
    switchTab('multi');
    mpRenderLobby();
  } else {
    mpExitPlayView();
    mpTeardown();   // stuurt zelf een 'leave'-bericht, zie mpTeardown — host zet deze speler dan om in een bot
    switchTab('multi');
    mpRenderLobby();
  }
}
// Gast ontvangt het "host heeft het potje gestopt"-bericht: de room blijft intact (anders dan
// bij mpOnPeerLeave met een écht vertrokken host), dus gewoon terug naar de wachtkamer.
function mpClientOnStop(){
  if (mp.isHost || mp.phase !== 'in-game') return;
  mpSetStatus('De host heeft dit potje gestopt.', '');
  mpExitPlayView();
  mp.phase = 'joining';
  switchTab('multi');
  mpRenderLobby();
}

// ---------- lobby-tabblad: welk deelscherm ----------
function mpRenderLobby(){
  const show = (el, on) => { if (el) el.hidden = !on; };
  show(mpChoiceEl, mp.phase === 'idle');
  show(mpHostSetupEl, mp.phase === 'host-setup' || mp.phase === 'hosting');
  show(mpHostRoomEl, mp.phase === 'hosting');
  show(mpJoinFormEl, mp.phase === 'join-form');
  show(mpJoinWaitingEl, mp.phase === 'joining');
  show(mpChatPanelEl, mp.phase === 'hosting' || mp.phase === 'joining');
  if (mp.phase === 'hosting') mpRenderHostSeats();
}

// ---------- chat ----------
// Eén gedeelde geschiedenis (mpChatMessages) voor de hele MP-sessie, getekend in TWEE losse
// DOM-plekken (lobby-tabblad en het speelscherm) — zelfde dubbele-render-truc als
// renderWalkScore (walkScoreEl/walkScoreActiveEl in 96-walk.js). Omdat we niets verplaatsen,
// staat het gesprek al klaar in het speelscherm zodra mpEnterPlayView 'm zichtbaar maakt: er is
// dus geen aparte "overdracht" nodig bij het starten van het potje.
let mpChatMessages = [];   // { peerId, name, color, text, ts } — naam/kleur liggen vast bij ontvangst
function mpEscapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
// naam/kleur van een AFZENDER wordt hier opgezocht (mp.seats — in de lobby ken je jezelf ook
// zo, zodra het potje loopt via soloPlayers/mpMe()), NOOIT vertrouwd uit het binnengekomen
// bericht zelf — anders kan een gast zich in de chat als iemand anders voordoen. Vastgelegd
// op het moment van versturen/ontvangen (niet opnieuw opgezocht bij elke render), zodat een
// speler die later de lobby verlaat zijn eerdere berichten niet met terugwerkende kracht naar
// "Speler" laat vernoemen.
function mpChatSenderInfo(peerId){
  const i = mp.seats.findIndex(s => s.peerId === peerId);
  if (i >= 0) return { name: mp.seats[i].name, color: WALK_PLAYER_COLORS[i % WALK_PLAYER_COLORS.length] };
  const me = peerId === mp.myPeerId ? mpMe() : null;
  return { name: me ? me.name : 'Speler', color: 'var(--text-dim)' };
}
// `chant` (nummer) en `text` sluiten elkaar uit — een taunt-bericht heeft text:null en
// andersom, zie mpSendChatMessage/mpOnRemoteChat hieronder.
function mpAppendChat(peerId, text, chant){
  const info = mpChatSenderInfo(peerId);
  mpChatMessages.push({ peerId, name: info.name, color: info.color, text: text || null, chant: chant || null, ts: Date.now() });
  // simpele cap, puur zodat een heel lang potje niet oneindig DOM/geheugen blijft opstapelen
  if (mpChatMessages.length > 200) mpChatMessages.shift();
  mpRenderChat();
}
function mpRenderChat(){
  const html = mpChatMessages.map(msg => {
    const mine = msg.peerId === mp.myPeerId;
    // msg.chant is hier altijd al een gevalideerd getal (zie mpSendChatMessage/mpOnRemoteChat
    // — alleen ooit gezet als CHANT_AUDIO[n] echt bestaat), dus veilig direct te tonen.
    const body = msg.chant
      ? `<span class="mp-chant">🔊 taunt #${msg.chant}</span>`
      : `<span>${mpEscapeHtml(msg.text)}</span>`;
    return `<div class="mp-chat-msg${mine ? ' mp-chat-me' : ''}">` +
      `<b style="color:${msg.color}">${mpEscapeHtml(msg.name)}:</b>${body}` +
    `</div>`;
  }).join('');
  for (const el of [mpChatLogEl, mpChatLogGameEl]){
    if (!el) continue;
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }
}
// typ je puur een getal dat een bestaande taunt is (bv. "7"), dan wordt dat een taunt i.p.v.
// een gewoon tekstbericht — hoorbaar voor jezelf én voor iedereen anders in de room, net als
// de taunts uit het originele Age of Empires.
function mpSendChatMessage(raw){
  const trimmed = String(raw || '').trim().slice(0, 240);
  if (!trimmed || !mp.active || !mp.actions || !mp.actions.chat) return;
  const n = Number(trimmed);
  if (/^\d+$/.test(trimmed) && CHANT_AUDIO[n]){
    mpAppendChat(mp.myPeerId, null, n);
    playChant(n);
    mp.actions.chat.send({ chant: n });
    return;
  }
  mpAppendChat(mp.myPeerId, trimmed, null);
  mp.actions.chat.send({ text: trimmed });
}
// wordt voor IEDEREEN aangeroepen, niet alleen de host — zie de toelichting bij
// mp.actions.chat.onMessage in mpRegisterActions hierboven
function mpOnRemoteChat(peerId, data){
  if (!mp.active) return;
  if (data && data.chant){
    const n = Number(data.chant);
    if (!CHANT_AUDIO[n]) return;   // onbekend/verzonnen nummer van een gast — gewoon negeren
    mpAppendChat(peerId, null, n);
    playChant(n);
    return;
  }
  const text = String(data && data.text || '').trim().slice(0, 240);
  if (!text) return;
  mpAppendChat(peerId, text, null);
}
function mpWireChatForm(formEl, inputEl){
  if (!formEl || !inputEl) return;
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    mpSendChatMessage(inputEl.value);
    inputEl.value = '';
    inputEl.focus();
  });
}
mpWireChatForm(mpChatFormEl, mpChatInputEl);
mpWireChatForm(mpChatFormGameEl, mpChatInputGameEl);

// ---------- knoppen ----------
const btnMpHost = document.getElementById('btnMpHost');
const btnMpJoinShow = document.getElementById('btnMpJoinShow');
const btnMpHostCreate = document.getElementById('btnMpHostCreate');
const btnMpHostCancel = document.getElementById('btnMpHostCancel');
const btnMpCopyCode = document.getElementById('btnMpCopyCode');
const btnMpHostStart = document.getElementById('btnMpHostStart');
const btnMpHostStop = document.getElementById('btnMpHostStop');
const btnMpJoinConnect = document.getElementById('btnMpJoinConnect');
const btnMpJoinCancel = document.getElementById('btnMpJoinCancel');
const btnMpJoinLeave = document.getElementById('btnMpJoinLeave');
const btnMpLeaveGame = document.getElementById('btnMpLeaveGame');

if (btnMpLeaveGame) btnMpLeaveGame.addEventListener('click', mpLeaveGame);
if (btnMpHost) btnMpHost.addEventListener('click', () => { mp.phase = 'host-setup'; mpRenderLobby(); });
if (btnMpJoinShow) btnMpJoinShow.addEventListener('click', () => { mp.phase = 'join-form'; mpRenderLobby(); });
if (btnMpHostCancel) btnMpHostCancel.addEventListener('click', () => { mp.phase = 'idle'; mpRenderLobby(); });
if (btnMpJoinCancel) btnMpJoinCancel.addEventListener('click', () => { mp.phase = 'idle'; mpRenderLobby(); });
if (btnMpHostCreate) btnMpHostCreate.addEventListener('click', mpHostCreate);
if (btnMpJoinConnect) btnMpJoinConnect.addEventListener('click', mpJoinConnect);
if (btnMpHostStart) btnMpHostStart.addEventListener('click', mpHostStartGame);
if (btnMpHostStop) btnMpHostStop.addEventListener('click', mpHostStop);
if (btnMpJoinLeave) btnMpJoinLeave.addEventListener('click', mpJoinLeave);
if (btnMpCopyCode) btnMpCopyCode.addEventListener('click', () => {
  if (navigator.clipboard) navigator.clipboard.writeText(mp.roomCode || '');
});
