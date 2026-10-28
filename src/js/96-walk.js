// ---------- stap voor stap: 1 t/m 4 spelers, zichtbaar over het bord ----------
// Speelt EEN potje op de huidige indeling en toont elke stap. Hergebruikt de engine uit
// 95-simulate.js (buildSimGraph + resolveMove), zodat de regels hier per definitie dezelfde
// zijn als in de batch-simulatie: 2xD6 = exact aantal stappen, geen U-turn, bezette vakjes
// blokkeren, en raak je onderweg je eigen opdrachtvakje, dan loop je met de resterende
// stappen gewoon door (zie resolveMove) — voert de rest toevallig ook door de volgende
// opdracht, dan pak je die in dezelfde beurt meteen mee.
// Met meerdere spelers is de "bezette vakjes"-set precies de posities van de andere pionnen
// die nog meespelen, net als in simulateOneGame(); met één speler is die set leeg.
//
// Er wordt doorgespeeld na de winnaar: wie binnen is verlaat het bord en het potje loopt
// door tot simFinishTarget() spelers binnen zijn (bij 4 spelers de nummer 3, want dan is de
// vierde plaats al beslist).

// tempo-standen voor de schuifregelaar: ms per gezette stap
const WALK_SPEEDS = [
  { label: 'heel langzaam', stepMs: 620, rollMs: 900 },
  { label: 'langzaam',      stepMs: 320, rollMs: 700 },
  { label: 'normaal',       stepMs: 170, rollMs: 520 },
  { label: 'snel',          stepMs:  70, rollMs: 300 },
  { label: 'razendsnel',    stepMs:  18, rollMs: 120 },
];

// Kleur per speler. Bewust weg van de bordkleuren die er tegelijk op liggen: blauw (opdracht),
// groen (start) en amber (naadmarkering) zijn daarom niet gebruikt.
const WALK_PLAYER_COLORS = ['#ff4fd8', '#ffd23d', '#7c5cff', '#ff7a45'];
const WALK_MAX_PLAYERS = SIM_START_LABELS.length;

// Bots krijgen altijd een toffe naam i.p.v. "Speler N" (gebruikerswens), in het thema van het
// bevoorradingsschip. Puur cosmetisch: gekozen met Math.random, los van de seed van het potje.
// Max. 18 tekens (zelfde grens als soloCleanName in 97-solo.js). Gebruikt door Automatisch,
// Zelf spelen en Multiplayer.
const BOT_NAMES = [
  'Kapitein Nova', 'Sergeant Flux', 'Commander Orion', 'Majoor Quasar', 'Luitenant Ion',
  'Admiraal Zenith', 'Pilot Nebula', 'Korporaal Rax', 'Sergeant Plasma', 'Kapitein Kobalt',
  'Unit K-9', 'Echo-7', 'Droid ZX-4', 'Mecha-Mira', 'Cyber-Sjef', 'Raket-Rita', 'Orbit-Otto',
  'Kernel Kees', 'Astro-Ad', 'Turbo-Tess', 'Specter', 'Titan', 'Vortex', 'Glitch', 'Nyx',
  'Bolt', 'Rogue', 'Havik', 'Comet', 'Ironclad',
];
// `count` unieke botnamen, nooit gelijk aan een naam in `taken` (hoofdletters/spaties tellen niet)
function pickBotNames(count, taken = []){
  const key = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const used = new Set(taken.map(key));
  const pool = BOT_NAMES.filter(n => !used.has(key(n)));
  for (let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = pool.slice(0, count);
  for (let n = 1; out.length < count; n++) if (!used.has(key(`Bot ${n}`))) out.push(`Bot ${n}`);   // vangnet
  return out;
}

const walkBoardEl = document.getElementById('walkBoard');
const walkPlayersSel = document.getElementById('walkPlayers');
const walkEnergyModeEl = document.getElementById('walkEnergyMode');
const walkSpeedEl = document.getElementById('walkSpeed');
const walkSpeedLabelEl = document.getElementById('walkSpeedLabel');
const walkDiceEl = document.getElementById('walkDice');
const walkMetaEl = document.getElementById('walkMeta');
const walkScoreEl = document.getElementById('walkScore');
const walkScoreActiveEl = document.getElementById('walkScoreActive');
const walkStatusEl = document.getElementById('walkStatus');
const walkLogEl = document.getElementById('walkLog');
const walkLegendEl = document.getElementById('walkLegend');
const btnWalkToggleLegend = document.getElementById('btnWalkToggleLegend');
const btnWalkToggleLog = document.getElementById('btnWalkToggleLog');
const walkPanelEl = document.getElementById('tabWalk');
const walkPausedFlagEl = document.getElementById('walkPausedFlag');
const btnWalkStart = document.getElementById('btnWalkStart');
const btnWalkPause = document.getElementById('btnWalkPause');
const btnWalkStop = document.getElementById('btnWalkStop');
const walkLobbyEl = document.getElementById('walkLobby');
const walkPlayAreaEl = document.getElementById('walkPlayArea');
const walkLobbyStatusEl = document.getElementById('walkLobbyStatus');
// Verborg vroeger de voettekst tijdens het spelen; die voettekst is helemaal weg
// (gebruikerswens), maar de naam blijft omdat walkFadeSwap() hieronder en switchTab()/
// mpEnterPlayView()/mpExitPlayView() (80-controls.js resp. 99-multiplayer.js) dit op precies de
// juiste momenten aanroepen om Pauze/Stoppen bij te werken.
function walkFooterSyncVisibility(){
  walkPauseStopSyncVisibility();
}

// Pauze/Stoppen staan rechtsboven in de globale tabbladenbalk (index.html, .tab-bar-actions),
// die anders dan #tabWalk niet vanzelf meeverbergt — dus zelf bijhouden: alleen op dit
// tabblad, alleen in modus Automatisch, alleen terwijl het speelscherm in beeld is.
function walkPauseStopSyncVisibility(){
  const onWalkTab = !!walkPanelEl && !walkPanelEl.hidden;
  const playing = !!walkPlayAreaEl && !walkPlayAreaEl.hidden;
  const autoBtn = document.getElementById('walkModeAuto');
  const isAuto = !!autoBtn && autoBtn.classList.contains('active') && !window.mpGameActive;
  const show = onWalkTab && playing && isAuto;
  if (btnWalkPause) btnWalkPause.hidden = !show;
  if (btnWalkStop) btnWalkStop.hidden = !show;
  const tempo = document.getElementById('walkSpeedPlayWrap');
  if (tempo) tempo.hidden = !show;
  // speelweergave over het hele scherm (alle modi): kop wordt een smalle balk, tabbladen in het
  // uitschuifmenu, bord zo groot als past — zie body.is-playing in styles.css
  const inGame = onWalkTab && playing;
  document.body.classList.toggle('is-playing', inGame);
  document.body.classList.toggle('is-mp-game', inGame && !!window.mpGameActive);
  if (!inGame) playMenuSetOpen(false);
  // "Nieuw potje" (Zelf spelen) hangt van dezelfde momenten af (alleen tijdens het speelscherm)
  walkSoloResetSyncVisibility();
}

// ---------- lobby: nieuw startscherm vóór je gaat spelen (gebruikerswens) ----------
// Eén gecentreerde kolom met alle instellingen en onderaan "Start spel" (zie index.html,
// #walkLobby). #walkLobby en #walkPlayArea zitten sámen in één vast #walkPanel (.panel) —
// dat paneel zelf verdwijnt nooit, alleen de inhoud van de twee erbinnen wisselt. Dat
// wisselen is een ECHTE crossfade: de lobby faadt uit terwijl het speelscherm er TEGELIJK
// overheen infaadt (#walkPanel staat op display:grid met beide kinderen op dezelfde
// grid-cel, zie styles.css) — geen moment waarop je een lege/transparante kolom ziet (dat
// gaf eerder de indruk dat "de hele kolom verdwijnt en komt terug", gebruikersmelding), en
// ook geen kaal instant-omschakelmoment (latere gebruikersmelding: "BOEM ineens in beeld").
// "Stoppen"/"Nieuw potje" wisselen met dezelfde walkFadeToLobby() terug — zie de
// btnWalkStop-listener hieronder resp. #btnWalkSoloReset in 97-solo.js. 99-multiplayer.js
// wisselt zelf nog rechtstreeks (ongeanimeerd) omdat switchTab() daar toch al in één klap
// van tabblad wisselt.
// Na "Start spel" speelt eerst de startanimatie (96b-intro.js) als die aan staat — zie
// walkTryStart() hieronder.
const WALK_FADE_MS = 350;   // moet gelijk blijven aan .walk-fade's transition-duur in styles.css
// lobby → potje (zonder startanimatie) rustiger dan de rest (gebruikerswens): 0,9 s, als inline
// transition-duur op beide vakken zolang de wissel loopt
const WALK_FADE_PLAY_MS = 900;
function walkFadeSwap(hideEl, showEl, ms = WALK_FADE_MS){
  if (!hideEl || !showEl){ if (hideEl) hideEl.hidden = true; if (showEl) showEl.hidden = false; return; }
  const dur = ms === WALK_FADE_MS ? '' : `${ms}ms`;
  hideEl.style.transitionDuration = dur;
  showEl.style.transitionDuration = dur;
  // showEl start onzichtbaar (nog vóór het `hidden` weggaat, anders is er niets om vanaf te
  // animeren) en een reflow ertussen dwingt de browser die starttoestand ook echt te
  // registreren — anders springt hij meteen naar opacity 1 in plaats van te transitionen.
  showEl.classList.add('walk-fade-hidden');
  showEl.hidden = false;
  void showEl.offsetWidth;
  // beide klassewissels in dezelfde tick: hideEl fadet 1→0, showEl fadet tegelijk 0→1 — een
  // echte crossfade, niet twee na elkaar (dat gaf eerder alsnog een leeg tussenmoment).
  hideEl.classList.add('walk-fade-hidden');
  showEl.classList.remove('walk-fade-hidden');
  walkFooterSyncVisibility();   // meteen bij het tonen van het speelscherm verdwijnt de footer
  setTimeout(() => {
    hideEl.hidden = true;
    hideEl.classList.remove('walk-fade-hidden');
    hideEl.style.transitionDuration = '';
    showEl.style.transitionDuration = '';
    walkFooterSyncVisibility();   // en komt pas terug zodra je weer echt (en helemaal) in de lobby staat
  }, ms);
}
function walkFadeToPlay(){ walkFadeSwap(walkLobbyEl, walkPlayAreaEl, WALK_FADE_PLAY_MS); }
function walkFadeToLobby(){ walkFadeSwap(walkPlayAreaEl, walkLobbyEl); }

// Dezelfde controle als runWalkSimulation()/startSoloGame() zelf al doen, maar dan VOORDAT we
// naar het speelscherm faden — anders zag je eerst een leeg bord en pas daaronder de
// foutmelding (die normaal in #walkStatus staat, binnenin het speelscherm).
function walkLobbyValidate(){
  const reach = analyseCellReachability();
  if (reach.unreachable.length > 0){
    return `Dit bord heeft ${reach.unreachable.length} onbereikbare vakjes — pas de indeling aan voordat je speelt.`;
  }
  const graph = buildSimGraph();
  const missing = [...SIM_QUEST_LABELS, ...SIM_START_LABELS].filter(l =>
    graph.questCells[l] === undefined && graph.startCells[l] === undefined);
  if (missing.length){
    return `Deze vakjes ontbreken op het bord: ${missing.join(', ')}.`;
  }
  return null;
}
function walkTryStart(startFn){
  const err = walkLobbyValidate();
  if (walkLobbyStatusEl) walkLobbyStatusEl.innerHTML = err ? `<span class="bad">✕ ${err}</span>` : '';
  if (err) return;
  // startanimatie (aftellen + hyperjump, 96b-intro.js) als die in de lobby aan staat. Daarna
  // meteen (achter het nog zwarte scherm) naar het speelscherm wisselen, zonder crossfade —
  // anders schemerde de lobby nog door terwijl de animatie wegfaadde.
  if (introEnabled()){
    if (!introRunning) playStartIntro(() => {
      if (walkLobbyEl) walkLobbyEl.hidden = true;
      if (walkPlayAreaEl){ walkPlayAreaEl.classList.remove('walk-fade-hidden'); walkPlayAreaEl.hidden = false; }
      walkFooterSyncVisibility();
      startFn();
    });
  } else {
    walkFadeToPlay();
    startFn();
  }
}

let walkCellEls = null;      // [R][C] -> div, pas opgebouwd bij het eerste gebruik
const walkRoomLabelEls = []; // per slot: de kamernaam-overlay op de linkerbovenhoek van de tegel
let walkRunId = 0;           // elke nieuwe run verhoogt dit; een lopende run stopt zodra hij afwijkt
let walkRunning = false;
let walkPaused = false;
let walkPauseWaiters = [];   // resolvers van de stappen die nu op "hervat" staan te wachten
let walkPaintedPawns = [];   // cellen waar nu een pion op staat, zodat we ze gericht kunnen wissen

function walkSpeed(){ return WALK_SPEEDS[parseInt(walkSpeedEl.value, 10)] || WALK_SPEEDS[2]; }
function walkSleep(ms){ return new Promise(res => setTimeout(res, ms)); }

// De lus wacht op precies twee dingen: de tempo-vertraging en (als er gepauzeerd is) de
// pauze-poort. Alles wat wacht loopt via walkTick(), zodat er geen plek in de lus overblijft
// die tijdens een pauze tóch doorloopt.
function walkPauseGate(){
  if (!walkPaused) return Promise.resolve();
  return new Promise(res => walkPauseWaiters.push(res));
}
async function walkTick(ms){
  await walkSleep(ms);
  await walkPauseGate();
}
function setWalkPaused(on){
  walkPaused = on && walkRunning;
  if (!walkPaused){
    // iedereen die vasthing loslaten; wie inmiddels tot een gestopte run behoort,
    // valt daarna vanzelf op zijn eigen runId-controle af
    const waiters = walkPauseWaiters;
    walkPauseWaiters = [];
    for (const res of waiters) res();
  }
  // Geen ⏸/▶ meer: die vallen op systemen zonder emoji-font terug op een leeg blokje (▪),
  // en het woord zelf zegt precies hetzelfde.
  if (btnWalkPause) btnWalkPause.textContent = walkPaused ? 'Hervatten' : 'Pauze';
  if (walkPausedFlagEl) walkPausedFlagEl.hidden = !walkPaused;
  // CSS-animaties (rollende dobbelsteen, kloppend doelvakje) horen ook stil te staan
  if (walkPanelEl) walkPanelEl.classList.toggle('walk-is-paused', walkPaused);
  dicePause(walkPaused);   // de dobbelstenen zijn browser-animaties, die pauzeren apart (96d-dice.js)
}

function walkPlayerCount(){
  const n = parseInt(walkPlayersSel ? walkPlayersSel.value : '1', 10);
  return Number.isFinite(n) ? Math.max(1, Math.min(WALK_MAX_PLAYERS, n)) : 1;
}

// ---------- bord ----------
function buildWalkBoard(){
  walkBoardEl.innerHTML = '';
  walkRoomRingEl = null;      // hing onder het bord en is met de innerHTML meegewist
  walkRoomLabelEls.length = 0;
  const els = [];
  for (let R = 0; R < TILE_ROWS*TILE_H; R++){
    els.push([]);
    for (let C = 0; C < TILE_COLS*TILE_W; C++){
      const dr = R % TILE_H, dc = C % TILE_W;
      const div = document.createElement('div');
      div.className = 'cell';
      // kamernaam-overlay op de linkerbovenhoek van elke tegel, zelfde opzet als het
      // hoofdbord (roomLabelEls in 40-board.js) maar zonder letterbadge — hier is er
      // geen tegel-editor die de letter nodig heeft.
      if (dr === 0 && dc === 0){
        const slotIdx = Math.floor(R/TILE_H)*TILE_COLS + Math.floor(C/TILE_W);
        const roomLabel = document.createElement('span');
        roomLabel.className = 'room-label';
        div.classList.add('has-badge');
        div.appendChild(roomLabel);
        walkRoomLabelEls[slotIdx] = roomLabel;
      }
      walkBoardEl.appendChild(div);
      els[R].push(div);
    }
  }
  return els;
}

// tekent de huidige indeling; wist alle loop-markeringen (klassen én de per-speler
// kleurvariabelen die we inline op de cellen zetten)
function renderWalkBoard(){
  if (!walkBoardEl) return;
  if (!walkCellEls) walkCellEls = buildWalkBoard();
  // het bord wordt hier van nul opgebouwd; alleen aangeroepen buiten een lopend potje om
  clearWalkTarget();
  walkClearPortals();
  walkScoreOrder = null;
  walkPaintedPawns = [];
  for (let R = 0; R < TILE_ROWS*TILE_H; R++){
    for (let C = 0; C < TILE_COLS*TILE_W; C++){
      const dr = R % TILE_H, dc = C % TILE_W;
      const slotI = Math.floor(R/TILE_H), slotJ = Math.floor(C/TILE_W);
      const slotIdx = slotI*TILE_COLS + slotJ;
      const tileId = layout[slotIdx];
      const val = getDisplayValue(tileId, dr, dc);
      const div = walkCellEls[R][C];
      // className wordt hier volledig herschreven (ipv classList.remove), dus de vaste
      // tegelrand + kamernaam-anker (uit buildWalkBoard) moeten elke render terugkomen.
      let cls = 'cell';
      if (dc === TILE_W-1) cls += ' walk-tile-edge-r';
      if (dr === TILE_H-1) cls += ' walk-tile-edge-b';
      if (dc === 0 && slotJ === 0) cls += ' walk-tile-edge-l';
      if (dr === 0 && slotI === 0) cls += ' walk-tile-edge-t';
      if (dr === 0 && dc === 0) cls += ' has-badge';
      div.className = cls;
      div.style.cssText = '';
      div.title = '';
      const type = cellType(val);
      if (type){
        div.classList.add(type);
        if (type === 'walk' && ROOM_NAMES[tileId]) div.classList.add('room-tile');
        // hover-tooltip op opdracht- en actiekaartvakjes (gebruikerswens) — native title i.p.v.
        // een eigen popup-component, want dat idioom gebruikt de rest van de app ook al overal
        // (energie-acties, tegel-editor, enz.).
        if (type === 'quest'){
          const room = ROOM_NAMES[tileId] || ('Gang ' + tileId);
          div.title = `${val} · ${QUEST_NAMES[val] || val} — ${room}`;
        } else if (type === 'actioncell'){
          div.title = 'Extra kristal';
        }
      } else if (patternSet.has(dr+'_'+dc)){
        div.classList.add('empty-slot');
      }
    }
  }

  // kamernaam-tekst per tegel; alleen kamertegels hebben een naam (ROOM_NAMES), gangen
  // laten de overlay leeg staan
  for (let slotIdx=0; slotIdx<20; slotIdx++){
    const roomName = ROOM_NAMES[layout[slotIdx]];
    if (walkRoomLabelEls[slotIdx]) walkRoomLabelEls[slotIdx].textContent = roomName || '';
  }
}

function walkCellDiv(graph, key){
  return walkCellEls[Math.floor(key / graph.W)][key % graph.W];
}

// ---------- portalen op het bord (zie PORTALEN in 95-simulate.js) ----------
// Twee vaste elementjes (blauw, rood) die als kind in het vakje van hun portaal hangen; verplaatsen
// = ander vakje. Alles beweegt alleen in transform/opacity (Prestatie in CLAUDE.md), en er wordt
// niets opgemeten: het schot is een lichtje dat vakje voor vakje over de vlucht springt.
const walkPortalEls = [null, null];
function walkPortalEl(color){
  if (!walkPortalEls[color]){
    const el = document.createElement('i');
    el.className = 'walk-portal ' + (color ? 'is-red' : 'is-blue');
    el.innerHTML = '<b></b>';
    el.title = color ? 'Rood portaal' : 'Blauw portaal';
    walkPortalEls[color] = el;
  }
  return walkPortalEls[color];
}
function walkPaintPortals(graph){
  const P = graph && graph.portals;
  for (let color = 0; color < 2; color++){
    const el = walkPortalEl(color);
    const key = P ? P.cells[color] : -1;
    const old = el.parentNode;
    if (key < 0 || key === undefined){
      if (old){ old.classList.remove('has-portal'); el.remove(); }
      continue;
    }
    const cell = walkCellDiv(graph, key);
    if (old === cell) continue;
    if (old && !old.querySelector('.walk-portal:not(.is-' + (color ? 'red' : 'blue') + ')')) old.classList.remove('has-portal');
    cell.classList.add('has-portal');
    cell.appendChild(el);
  }
}
function walkClearPortals(){
  for (const el of walkPortalEls){
    if (el && el.parentNode){ el.parentNode.classList.remove('has-portal'); el.remove(); }
  }
}
// kort effectje in een vakje (wordt na afloop weer weggehaald)
function walkPortalBurst(graph, key, color, big){
  const cell = walkCellDiv(graph, key);
  const fx = document.createElement('i');
  fx.className = 'walk-portal-burst ' + (color ? 'is-red' : 'is-blue');
  cell.classList.add('has-portal-fx');
  cell.appendChild(fx);
  const a = fx.animate([
    { transform: 'scale(.3)', opacity: 1 },
    { transform: `scale(${big ? 3.2 : 2.2})`, opacity: 0 },
  ], { duration: big ? 520 : 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
  a.onfinish = () => { fx.remove(); if (!cell.querySelector('.walk-portal-burst')) cell.classList.remove('has-portal-fx'); };
}
// Het schot = een KOMEET (gekozen variant 6 uit 10, 2026-10, bewust langzaam: "zodat je echt goed
// ziet wat er gebeurt"). Volgorde: het oude portaal van die kleur krimpt weg, dan vliegt een
// lichtbol met een staart van lichtjes in een rechte lijn van de schutter naar de muur, en daar
// slaan twee schokgolven uit en ploft het portaal open (de aanroeper tekent het daarna met
// walkPaintPortals; de pop-animatie zit hier). Niets wordt opgemeten (Prestatie in CLAUDE.md):
// elk lichtje is zo groot als een vakje en schuift in procenten van zichzelf, plus 1px tussenruimte
// per vakje (#walkBoard gap). Geeft een Promise die klaar is op het moment van de inslag.
const PORTAL_COMET_MS_PER_CELL = 130;   // vliegtijd per vakje (gebruikerswens: "een stuk langzamer")
const PORTAL_COMET_TAIL = 6;            // lichtjes in de staart
function walkPortalShotFx(graph, path, color, fromKey, fast){
  return new Promise(resolve => {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!path || path.length < 2 || reduced || typeof Element.prototype.animate !== 'function'){ resolve(); return; }
    const speed = fast ? 0.45 : 1;
    const ring = walkPortalEl(color);
    // 1. het oude portaal krimpt weg (blijft weg tot het op zijn nieuwe plek getekend is)
    const shrinkMs = Math.round(380 * speed);
    const shrink = ring.parentNode ? ring.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0)', opacity: 0 }],
      { duration: shrinkMs, easing: 'ease-in', fill: 'forwards' }) : null;
    if (fromKey >= 0 && fromKey !== undefined) walkPortalBurst(graph, fromKey, color, false);
    // 2. de komeet: kop + staart, elk lichtje vertrekt iets later over dezelfde lijn
    const from = path[0], to = path[path.length - 1];
    const dc = (to % graph.W) - (from % graph.W), dr = Math.floor(to / graph.W) - Math.floor(from / graph.W);
    const cells = Math.abs(dc) + Math.abs(dr);
    const flyMs = Math.round(Math.max(700, Math.min(1700, cells * PORTAL_COMET_MS_PER_CELL)) * speed);
    const tailGap = Math.round(60 * speed);
    const startAt = Math.round(shrinkMs * 0.6);
    const start = walkCellDiv(graph, from);
    start.classList.add('has-portal-fx');
    const tr = (f, s) => `translate(calc(${dc * f * 100}% + ${dc * f}px), calc(${dr * f * 100}% + ${dr * f}px)) scale(${s})`;
    const lights = [];
    for (let k = 0; k <= PORTAL_COMET_TAIL; k++){
      const el = document.createElement('i');
      el.className = 'walk-portal-comet' + (k ? ' is-tail' : '') + (color ? ' is-red' : '');
      start.appendChild(el);
      lights.push(el);
      const s = k ? 0.95 - k * 0.1 : 1.25, o = k ? 0.8 - k * 0.1 : 1;
      el.animate([
        { transform: tr(0, s * 0.4), opacity: 0 },
        { transform: tr(0.06, s), opacity: o, offset: 0.08 },
        { transform: tr(1, s), opacity: o, offset: 0.96 },
        { transform: tr(1, s * 0.6), opacity: 0 },
      ], { duration: flyMs, delay: startAt + k * tailGap, easing: 'cubic-bezier(.35,.05,.45,1)', fill: 'both' });
    }
    const cleanup = () => {
      for (const el of lights) el.remove();
      if (!start.querySelector('.walk-portal-comet, .walk-portal-burst')) start.classList.remove('has-portal-fx');
    };
    // 3. inslag: schokgolven en het portaal ploft open (na de kop, de staart dooft vanzelf uit)
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      walkPortalBurst(graph, to, color, true);
      setTimeout(() => walkPortalBurst(graph, to, color, true), Math.round(140 * speed));
      if (shrink) shrink.cancel();
      // de aanroeper zet het portaal nu op zijn nieuwe plek; in het volgende beeldje ploft het open
      requestAnimationFrame(() => ring.animate([
        { transform: 'scale(0)', opacity: 0 },
        { transform: 'scale(1.35)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: Math.round(460 * speed), easing: 'ease-out' }));
      setTimeout(cleanup, PORTAL_COMET_TAIL * tailGap + 200);
      resolve();
    };
    setTimeout(land, startAt + flyMs);
  });
}
// door een portaal gestapt: flits bij de ingang en bij de uitgang
function walkPortalJumpFx(graph, entry, exit){
  const P = graph.portals;
  const colorOf = k => P && P.cells[1] === k ? 1 : 0;
  walkPortalBurst(graph, entry, colorOf(entry), false);
  walkPortalBurst(graph, exit, colorOf(exit), true);
}
// logregel voor een schot
function walkPortalShotText(name, shot, stolen){
  const namen = ['noorden', 'oosten', 'zuiden', 'westen'];
  return `${name} schiet met het <b>Portaalkanon</b> het ${PORTAL_NAMES[shot.color]} portaal naar het ${namen[shot.dir]}${stolen ? ' — dat lag er van een ander' : ''}.`;
}

// ---------- doel aanwijzen ----------
// Eén plek voor alle drie de aanwijzingen, zodat ze altijd dezelfde kleur dragen: het
// opdrachtvakje zelf, een rand om de kamer waar het in ligt, en de kaart in het zijpaneel.
// De kleur komt uit QUEST_CARD_ART (05-card-art.js) — dezelfde als op het tabblad Kaarten.
function questTint(label){
  const art = QUEST_CARD_ART[label];
  return art ? art.tint : '#4fb8e0';
}
const walkQuestCardEl = document.getElementById('walkQuestCard');
let walkRoomRingEl = null;

function walkRoomRing(){
  if (!walkRoomRingEl){
    walkRoomRingEl = document.createElement('div');
    walkRoomRingEl.className = 'walk-room-ring';
    walkRoomRingEl.hidden = true;
    walkBoardEl.appendChild(walkRoomRingEl);
  }
  return walkRoomRingEl;
}

// Zet de markering op het doel van wie aan zet is. `playerColor` blijft de rand van het
// vakje zelf (wie er heen moet), de opdrachtkleur wordt de gloed en de kamerrand.
// Ververst BEWUST niet de grote opdrachtkaart in het zijpaneel (renderWalkQuestCard) — deze
// functie wordt ook gebruikt om te "spieken" door over het opdrachtenoverzicht te hoveren
// (soloPeekQuest, 97-solo.js), en dat mag alleen de markering op het bord verplaatsen, niet je
// eigen actieve opdracht in het zijpaneel vervangen door de opdracht waar je toevallig overheen
// hovert (gebruikersmelding). De écht-actieve aanroepen (96-walk.js hieronder,
// soloRefreshTarget/99-multiplayer.js) roepen renderWalkQuestCard() daarom zelf apart aan.
function markWalkTarget(graph, label, key, playerColor){
  walkClearClass('walk-target');
  const tint = questTint(label);

  const cell = walkCellDiv(graph, key);
  cell.style.setProperty('--pc', playerColor);
  cell.style.setProperty('--qtint', tint);
  cell.classList.add('walk-target');

  // rand om de hele tegel waar het opdrachtvakje in ligt
  const ring = walkRoomRing();
  const R = Math.floor(key / graph.W), C = key % graph.W;
  ring.style.setProperty('--rr', Math.floor(R / TILE_H));
  ring.style.setProperty('--rc', Math.floor(C / TILE_W));
  ring.style.setProperty('--qtint', tint);
  ring.hidden = false;
}

// Tijdens het naspelen van een zet: stapt de pion op het opdrachtvakje dat deze zet pakt, dan
// schuift de markering METEEN door naar de volgende opdracht. De rekenkern (resolveMove) laat de
// pion na een opdracht al met de rest van de worp doorlopen, maar het bord bleef de hele zet de
// oude opdracht aanwijzen — dat zag eruit alsof bots precies op het vakje wilden eindigen
// (gebruikersmelding). `bank`: { seq: nog te halen labels vanaf het huidige doel, completed:
// voltooid vóór deze zet, limit: hoeveel opdrachten deze zet pakt, shown: al getoond }.
// `occupied`: vakjes van andere pionnen — daar pakt Blinde Vlek de opdracht niet (zie resolveMove).
function walkAdvanceShownTarget(graph, bank, pos, color, occupied, updateCard){
  if (!bank || bank.shown >= bank.limit) return;
  const label = bank.seq[bank.shown];
  if (graph.questCells[label] !== pos || (occupied && occupied.has(pos))) return;
  bank.shown++;
  walkCellDiv(graph, pos).classList.add('walk-done');
  const next = bank.seq[bank.shown];
  if (bank.completed + bank.shown >= SIM_QUESTS_TO_WIN || next === undefined){
    clearWalkTarget();
    return;
  }
  markWalkTarget(graph, next, graph.questCells[next], color);
  if (updateCard) renderWalkQuestCard(next);
}

function clearWalkTarget(){
  walkClearClass('walk-target');
  if (walkRoomRingEl) walkRoomRingEl.hidden = true;
  if (walkQuestCardEl) walkQuestCardEl.innerHTML = '';
}

// de actieve opdrachtkaart in het zijpaneel, in dezelfde opmaak als het tabblad Kaarten
function renderWalkQuestCard(label){
  if (!walkQuestCardEl) return;
  if (!label){ walkQuestCardEl.innerHTML = ''; return; }
  const tid = findLabelTile(label);
  // geen positieletter (bv. "positie B") meer hier: die kun je toch niet op het bord zien,
  // alleen de kamernaam is bruikbare info (gebruikerswens).
  const waar = tid !== null ? (ROOM_NAMES[tid] || ('Gang ' + tid)) : '—';
  walkQuestCardEl.style.setProperty('--qtint', questTint(label));
  walkQuestCardEl.innerHTML =
    `<span class="walk-quest-card-face">${renderQuestCardFace(label)}</span>` +
    `<span class="walk-quest-card-text">` +
      `<span class="lbl">Actieve opdracht</span>` +
      `<b>${label} · ${QUEST_NAMES[label] || label}</b>` +
      `<span class="sub">${waar}</span>` +
    `</span>`;
  // klikbaar: dezelfde uitvergroting als het tabblad "Speelkaarten" (openCardsZoom, 98-cards.js)
  walkQuestCardEl.onclick = () => openCardsZoom(
    renderQuestCardFace(label), '', questTint(label), QUEST_NAMES[label] || label, waar,
  );
}
function walkClearClass(cls){
  for (const el of walkBoardEl.querySelectorAll('.' + cls)) el.classList.remove(cls);
}

// ---------- begin van een potje: dobbelen wie begint, dan startposities kiezen ----------
// Gedeeld door Automatisch (walkRunOpening hieronder) en Zelf spelen/Multiplayer
// (soloBeginOpening in 97-solo.js). Zolang dit loopt is de rechterkolom één groot paneel
// (#walkOpeningPanel, .walk-side-stack.is-opening in styles.css) i.p.v. dobbelen/energie/kaarten.
// `op` is de stand van die fase (puur data, gaat in Multiplayer ook zo naar de gasten):
//   { stage: 'roll' | 'pick', buckets (zie openingSplitBucket, 95-simulate.js),
//     group: wie er nu (opnieuw) dobbelt, rolls: worpen van deze dobbelronde, last: laatste worp
//     per speler (voor de weergave), rolling: wie nu moet gooien, note: laatste melding,
//     order: kiesvolgorde (= beurtvolgorde), pickPos: wie er nu kiest, picks: gekozen labels }
const walkOpeningPanelEl = document.getElementById('walkOpeningPanel');
function walkNewOpening(players){
  return { stage: 'roll', buckets: [players.map(p => p.idx)], group: null, rolls: {}, last: {},
           rolling: null, shaking: false, round: 0, note: '', order: [], pickPos: 0, picks: {} };
}
function walkSetOpeningMode(on){
  const stack = document.getElementById('walkSideStack');
  if (stack) stack.classList.toggle('is-opening', on);
  // ook het infovak links (wie er aan zet is, beurt): staat al in de spelersbalk boven het bord
  // (gebruikersmelding) — zie .walk-info-panel.is-opening in styles.css
  const info = document.querySelector('.walk-info-panel');
  if (info) info.classList.toggle('is-opening', on);
  if (walkOpeningPanelEl){
    walkOpeningPanelEl.hidden = !on;
    if (!on){ walkOpeningPanelEl.innerHTML = ''; walkOpeningPanelEl.dataset.html = ''; }
  }
  if (!on) walkClearStartGlow();
}
// de nog vrije startvakjes laten gloeien in de kleur van wie er nu kiest
// Schijnwerper (gekozen ontwerp C, met de draaiende ring van D; 2026-10): de rest van het bord
// wordt donker, alleen de tegel met de startvakjes (Hibernatie) blijft licht — en het doel van wie
// kiest (.walk-target), want daar kies je je startvak op. De vrije startvakjes krijgen de kleur
// van wie kiest, een draaiende ring van rondjes en een dobberend pijltje (styles.css,
// .cell.walk-start-glow). Kiezen kan alleen nog op het bord (de 3.x-knoppen zijn weg).
function walkGlowStarts(graph, labels, color){
  walkClearStartGlow();
  if (!labels.length) return;
  const blocks = new Set();
  for (const l of labels){
    const key = graph.startCells[l];
    const el = walkCellDiv(graph, key);
    el.style.setProperty('--pc', color);
    el.classList.add('walk-start-glow');
    blocks.add(`${Math.floor(Math.floor(key / graph.W) / 8)},${Math.floor((key % graph.W) / 8)}`);
  }
  for (const b of blocks){
    const [tr, tc] = b.split(',').map(Number);
    for (let r = tr * 8; r < tr * 8 + 8; r++){
      const row = walkCellEls[r];
      if (!row) continue;
      for (let c = tc * 8; c < tc * 8 + 8; c++) if (row[c]) row[c].classList.add('walk-spot');
    }
  }
  walkBoardEl.classList.add('is-start-pick');
}
function walkClearStartGlow(){
  if (!walkBoardEl) return;
  walkClearClass('walk-start-glow');
  walkClearClass('walk-spot');
  walkBoardEl.classList.remove('is-start-pick');
}
// ---------- komeet: de pion vliegt naar zijn startvak (gekozen variant A, 2026-10) ----------
// Gebruikerswens: niet meer "BOEM, daar staat je pion", maar een vlucht. De pion vertrekt bij het
// bolletje van die speler in het kiespaneel, schiet in een boog (met een staart van lichtjes) over
// het bord naar het gekozen startvak en landt met twee schokgolven in zijn kleur. Zolang hij
// vliegt, staat hij nog niet op het bord (walkFlyingIdx, zie paintWalkPawns) en wacht het spel met
// de volgende speler (de belofte lost op bij de landing). Gebruikt door Zelf spelen
// (soloOpeningDoPick), Multiplayer-gasten (mpApplyState) en Automatisch (walkRunOpening).
// Eén keer meten aan het begin (geen herberekening tijdens de vlucht), daarna alleen transform/opacity.
const WALK_COMET_MS = 950;
const walkFlyingIdx = new Set();
function walkCometToStart(graph, player, key){
  return new Promise(resolve => {
    const target = graph && key !== null && key !== undefined ? walkCellDiv(graph, key) : null;
    const fromEl = walkOpeningPanelEl && walkOpeningPanelEl.querySelector(`.walk-opening-row[data-pi="${player.idx}"] .walk-opening-dot`);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!target || !fromEl || reduced || typeof Element.prototype.animate !== 'function'){ resolve(); return; }
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (!a.width || !b.width){ resolve(); return; }
    target.classList.remove('walk-start-glow');
    const from = [a.left + a.width / 2, a.top + a.height / 2], to = [b.left + b.width / 2, b.top + b.height / 2];
    const size = Math.max(10, b.width * 0.9);
    const layer = document.createElement('div');
    layer.className = 'walk-comet-layer';
    layer.style.setProperty('--pc', player.color);
    layer.style.setProperty('--sz', `${size}px`);
    document.body.appendChild(layer);
    const mk = (cls, x, y) => {
      const e = document.createElement('span');
      e.className = cls;
      e.style.left = `${x}px`; e.style.top = `${y}px`;
      layer.appendChild(e);
      return e;
    };
    fromEl.style.opacity = '0';
    // boog: kwadratische bezier met het hoogste punt ruim boven start en doel
    const ctl = [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - 170];
    const N = 30;
    const pts = Array.from({ length: N + 1 }, (_, i) => {
      const t = i / N, u = 1 - t;
      return [u * u * from[0] + 2 * u * t * ctl[0] + t * t * to[0], u * u * from[1] + 2 * u * t * ctl[1] + t * t * to[1]];
    });
    const pawn = mk('walk-comet-pawn', 0, 0);
    const fly = pawn.animate(pts.map(([x, y], i) => ({ transform: `translate(${x}px,${y}px) scale(${1 + Math.sin(i / N * Math.PI) * 0.7})` })),
      { duration: WALK_COMET_MS, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
    // staart: een lichtje per beeldje op de plek waar de pion nu ongeveer is
    const t0 = performance.now();
    const tick = () => {
      const p = (performance.now() - t0) / WALK_COMET_MS;
      if (p >= 1 || !layer.isConnected) return;
      const [x, y] = pts[Math.min(N, Math.round(p * N))];
      const tr = mk('walk-comet-trail', x, y);
      tr.animate([{ opacity: 0.8, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.2)' }], { duration: 420, fill: 'forwards' })
        .onfinish = () => tr.remove();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      pawn.remove();
      fromEl.style.opacity = '';
      for (const [delay, scale] of [[0, 4], [120, 6]]){
        const r = mk('walk-comet-ring', to[0], to[1]);
        r.animate([{ transform: 'scale(.6)', opacity: 1 }, { transform: `scale(${scale})`, opacity: 0 }],
          { duration: 650, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      }
      setTimeout(() => layer.remove(), 900);
      resolve();
    };
    fly.onfinish = land;
    setTimeout(land, WALK_COMET_MS + 400);   // vangnet als het tabblad op de achtergrond stond
  });
}

// "Jouw eerste opdracht: <naam> — <kamer>" in het kiespaneel, in de kleur van die opdracht
function walkOpeningGoalHtml(p){
  const label = p && !p.questHidden ? p.deck[p.nextIdx] : null;
  if (!label || !QUEST_NAMES[label]) return '';
  const tid = findLabelTile(label);
  const room = tid !== null ? (ROOM_NAMES[tid] || ('Gang ' + tid)) : '';
  return `<div class="walk-opening-goal" style="--qtint:${questTint(label)}">` +
    `<span class="walk-opening-goal-lbl">Jouw eerste opdracht</span>` +
    `<b>${QUEST_NAMES[label]}</b>${room ? `<span class="walk-opening-goal-room">in de ${room}</span>` : ''}</div>`;
}
function walkOpeningFreeLabels(players){
  return SIM_START_LABELS.filter(l => !players.some(p => p.startLabel === l));
}
// melding na een volledige dobbelronde: wie staat bovenaan, en moet er nog iemand opnieuw?
function walkOpeningNote(players, buckets){
  const names = ids => ids.map(i => `<b>${players[i].name}</b>`).join(' en ');
  const top = buckets[0];
  if (top.length > 1) return `Gelijk op de hoogste worp — ${names(top)} gooien opnieuw.`;
  const next = openingNextGroup(buckets);
  if (!next) return `${names(top)} begint! De volgorde staat vast.`;
  let place = 1;
  for (const b of buckets){ if (b === next) break; place += b.length; }
  return `${names(top)} begint. Gelijk voor plek ${place} — ${names(next)} gooien opnieuw.`;
}
// `opts`: { canRoll, canPick (de kijker mag nu zelf), shaking (wie aan de beurt is gooit nu) }
function renderOpeningPanel(players, op, opts = {}){
  if (!walkOpeningPanelEl || !op) return;
  // Elke speler heeft vaste plekken voor twee stenen en de som, ook als er (nog) niets staat:
  // zo verspringen de stenen niet meer als de tekst ernaast verandert (gebruikersmelding). Het
  // draaien (wiebelen → rollen → uitrollen) zit in openingDiceSet (96d-dice.js); de steen staat
  // daarvoor in een eigen omhulsel met data-od="speler-steen".
  const die = (i, k, face, cls = '') => `<span class="walk-opening-die" data-od="${i}-${k}">${diceDieHtml(face, 'is-op' + cls)}</span>`;
  const spin = [];   // [speler, toestand, worp] — pas toepassen als het paneel getekend is
  // data-pi: welke speler, zodat openingShuffle de rijen kan volgen als de volgorde verandert
  const row = (i, placeHtml, right, cls) =>
    `<li class="walk-opening-row${cls}" data-pi="${i}" style="--pc:${players[i].color}">` +
      `<span class="walk-opening-place">${placeHtml}</span>` +
      `<span class="walk-opening-dot"></span>` +
      `<span class="walk-opening-name">${players[i].name}</span>${right}</li>`;
  // de stenen + som van één speler. Aan de beurt: rollen als er gegooid wordt, anders (wachten op
  // de klik) "?"-stenen die zachtjes om hun as wiebelen; gegooid: de worp (blijft ook tijdens het
  // kiezen staan, gebruikerswens); nog niet aan de beurt: vage "?"-stenen op hun plek
  const diceHtml = (i, up, shaking) => {
    const r = op.last[i];
    let dice, sum = '';
    if (up && shaking){ dice = die(i, 0, 1) + die(i, 1, 1); spin.push([i, 'spin']); }
    else if (up){ dice = die(i, 0, '?') + die(i, 1, '?'); spin.push([i, 'wiggle']); }
    else if (r){ dice = die(i, 0, r[0]) + die(i, 1, r[1]); sum = r[0] + r[1]; spin.push([i, 'result', r]); }
    else { dice = die(i, 0, '?', ' is-idle') + die(i, 1, '?', ' is-idle'); spin.push([i, 'rest']); }
    return `<span class="walk-opening-dice">${dice}<span class="walk-opening-sum">${sum}</span></span>`;
  };
  let html;
  if (op.stage === 'roll'){
    let place = 1;
    const rows = [];
    for (const b of op.buckets){
      for (const i of b){
        const up = op.rolling === i;
        const r = op.last[i];
        const dice = diceHtml(i, up, opts.shaking);
        // "gelijk" pas als de dobbelronde van deze groep klaar is: tijdens de ronde zit iedereen
        // die nog moet gooien ook in dezelfde emmer, dus wie al gooide is dan nog niet gelijk
        // (gebruikersmelding: de eerste gooier kreeg meteen "gelijk"). Via includes i.p.v.
        // op.group === b, omdat soloOpening in Multiplayer als kopie (JSON) binnenkomt.
        const rolledThisRound = op.group && op.group.includes(i) && op.rolls && (i in op.rolls);
        const chip = up ? `<span class="walk-opening-chip up">gooit</span>`
          : b.length > 1 && r && !rolledThisRound ? `<span class="walk-opening-chip tie">gelijk</span>`
          : '';
        rows.push(row(i, b.length === 1 && r ? `${place}e` : '–', dice + chip, up ? ' is-up' : ''));
      }
      place += b.length;
    }
    const up = op.rolling !== null && op.rolling !== undefined ? players[op.rolling] : null;
    const action = opts.canRoll
      ? `<p class="walk-opening-turn"><b>${up.name}</b>, jij bent aan de beurt.</p>` +
        `<button type="button" class="primary walk-opening-btn walk-pulse-affordable" data-opening-roll>🎲 Gooi de dobbelstenen</button>`
      : up ? `<p class="walk-opening-turn"><b>${up.name}</b> gooit…</p>` : '';
    html =
      `<h3 class="walk-opening-title">Wie begint?</h3>` +
      `<p class="walk-opening-sub">Iedereen gooit met 2 dobbelstenen. Wie het hoogst gooit kiest als eerste een startpositie en begint het spel; daarna gaat het aflopend. Bij gelijke worp gooien alleen die spelers opnieuw.</p>` +
      `<ol class="walk-opening-list">${rows.join('')}</ol>` +
      (op.note ? `<p class="walk-opening-note">${op.note}</p>` : '') +
      `<div class="walk-opening-action">${action}</div>`;
  } else {
    // zelfde rijen als bij het dobbelen (zelfde volgorde, zelfde maat, de worp blijft staan),
    // zodat het paneel niet ineens verandert (gebruikersmelding); alleen het tabje op de rand
    // wordt "kiest nu" of het gekozen startvakje
    const rows = op.order.map((i, k) => {
      const picked = op.picks[i];
      const now = k === op.pickPos && !picked;
      // geen 3.x-label meer (zegt de speler niets, gebruikersmelding): de pion staat al op het bord
      const chip = picked ? `<span class="walk-opening-chip start">gekozen</span>`
        : now ? `<span class="walk-opening-chip up">kiest nu</span>` : '';
      return row(i, `${k + 1}e`, diceHtml(i, false, false) + chip, now ? ' is-up' : '');
    });
    const chooser = players[op.order[op.pickPos]];
    const free = opts.freeLabels || [];
    const action = !chooser ? ''
      : op.picks[chooser.idx]
        ? `<p class="walk-opening-turn"><b>${chooser.name}</b> heeft gekozen.</p>`
      : opts.canPick
        // alleen nog kiezen op het bord (gebruikerswens: de 3.x-knoppen hadden geen meerwaarde);
        // je eerste opdracht staat er met naam en kamer bij (gebruikersmelding: in Multiplayer zag
        // je niet goed wat je eerste opdracht was, dus ook niet welk startvak het handigst is)
        ? walkOpeningGoalHtml(chooser) +
          `<p class="walk-opening-turn walk-opening-howto"><b>${chooser.name}</b>, kies een startvak dicht bij je opdracht: klik op een <b>oplichtend startvak</b> in de Hibernatie-kamer.</p>`
        : `<p class="walk-opening-turn"><b>${chooser.name}</b> kiest een startpositie…</p>`;
    html =
      `<h3 class="walk-opening-title">Startpositie kiezen</h3>` +
      `<p class="walk-opening-sub">In deze volgorde kiest iedereen een startvakje — dit is meteen ook de beurtvolgorde. Wie kiest ziet pas nu zijn eerste opdracht; de gloeiende vakjes zijn nog vrij.</p>` +
      `<ol class="walk-opening-list">${rows.join('')}</ol>` +
      `<div class="walk-opening-action">${action}</div>`;
  }
  // alleen vervangen als er echt iets veranderd is: in Multiplayer komt dezelfde stand vaak
  // opnieuw binnen, en een knop die tussen indrukken en loslaten vervangen wordt slikt de klik in
  if (walkOpeningPanelEl.dataset.html !== html){
    // waar staat elke rij nu (mét een eventuele lopende schuif-animatie)? Zie openingShuffle.
    const before = new Map([...walkOpeningPanelEl.querySelectorAll('.walk-opening-row[data-pi]')]
      .map(li => [li.dataset.pi, li.getBoundingClientRect().top]));
    walkOpeningPanelEl.dataset.html = html;
    walkOpeningPanelEl.innerHTML = html;
    for (const [i, mode, r] of spin) openingDiceSet(i, mode, r);
    openingShuffle(before);
    return;
  }
  for (const [i, mode, r] of spin) openingDiceSet(i, mode, r);
}

// Verandert de volgorde (na een dobbelronde: hoogste worp bovenaan), dan schuiven de rijen langs
// elkaar heen naar hun nieuwe plek i.p.v. te verspringen (gebruikerswens). Eerst wachten tot de
// stenen stilliggen (je ziet de worp eerst op de oude plek), dan rustig schuiven: wie omhoog gaat
// wijkt naar rechts uit en ligt bovenop, wie zakt naar links, zodat ze elkaar zichtbaar passeren.
// Alleen transform (FLIP: de rij staat al op zijn nieuwe plek en start verschoven naar de oude).
const OPENING_SHUFFLE_MS = 1300, OPENING_SHUFFLE_PAUSE_MS = 450;
let openingShuffleEnd = 0;   // document.timeline-tijd waarop het schuiven klaar is
function openingShuffle(before){
  if (!before.size || crystalReduceMotion()) return;
  const now = document.timeline.currentTime;
  let moved = false;
  const rows = [...walkOpeningPanelEl.querySelectorAll('.walk-opening-row[data-pi]')];
  const moves = rows.map(li => {
    const prev = before.get(li.dataset.pi);
    return prev === undefined ? 0 : prev - li.getBoundingClientRect().top;
  });
  if (moves.every(dy => Math.abs(dy) < 1)) return;
  const delay = openingDiceBusyMs() + OPENING_SHUFFLE_PAUSE_MS;
  rows.forEach((li, k) => {
    const dy = moves[k];
    if (Math.abs(dy) < 1) return;
    moved = true;
    const up = dy > 0, side = up ? 22 : -22;
    li.style.zIndex = up ? 3 : 2;
    li.animate([
      { transform: `translateY(${dy}px)` },
      { transform: `translate(${side}px, ${dy * .5}px) scale(${up ? 1.03 : .98})`, offset: .45 },
      { transform: 'none' },
    ], { duration: OPENING_SHUFFLE_MS, delay, easing: 'ease-in-out', fill: 'backwards' });
  });
  if (moved) openingShuffleEnd = now + delay + OPENING_SHUFFLE_MS;
}
// hoe lang (ms) zijn de stenen en het schuiven nog bezig? Het potje wacht daarop voordat het
// verder gaat (soloOpeningDoRoll in 97-solo.js, walkRunOpening hieronder)
function openingBusyMs(){
  return Math.max(0, openingDiceBusyMs(), openingShuffleEnd - document.timeline.currentTime);
}

// Automatisch: dezelfde fase, maar alles bots en zichtbaar in het ingestelde tempo. Geeft de
// beurtvolgorde terug, of null als het potje intussen gestopt is.
async function walkRunOpening(graph, players, rand, aborted){
  const op = walkNewOpening(players);
  walkSetOpeningMode(true);
  const pause = mult => walkTick(walkSpeed().rollMs * mult);
  for (const p of players) p.questHidden = true;
  renderWalkScore(players, -1);
  if (players.length > 1){
    walkLog(`<b>Wie begint?</b> Iedereen gooit met 2 dobbelstenen; de hoogste kiest als eerste een startpositie en begint.`);
    let round = 0;
    for (let group; (group = openingNextGroup(op.buckets)); ){
      round++;
      op.group = group;
      op.rolls = {};
      for (const i of group){
        op.rolling = i;
        renderOpeningPanel(players, op, { shaking: true });
        await pause(1.2);
        if (aborted()) return null;
        const r = [simRollD6(rand), simRollD6(rand)];
        op.rolls[i] = r;
        op.last[i] = r;
        op.rolling = null;
        walkLog(`${players[i].name} gooit ${r[0]}+${r[1]} = <b>${r[0] + r[1]}</b>${round > 1 ? ' (opnieuw)' : ''}.`, null, players[i]);
        renderOpeningPanel(players, op);
        await pause(0.6);
        if (aborted()) return null;
      }
      op.buckets.splice(op.buckets.indexOf(group), 1, ...openingSplitBucket(group, op.rolls));
      op.group = null;
      op.note = walkOpeningNote(players, op.buckets);
      walkLog(op.note);
      renderOpeningPanel(players, op);
      // wachten tot de rijen naar hun nieuwe plek geschoven zijn (openingShuffle)
      await walkTick(Math.max(walkSpeed().rollMs, openingBusyMs() + 400));
      if (aborted()) return null;
    }
  }
  op.stage = 'pick';
  op.order = openingOrder(op.buckets);
  for (let k = 0; k < op.order.length; k++){
    op.pickPos = k;
    const p = players[op.order[k]];
    p.questHidden = false;
    const label = p.deck[p.nextIdx];
    const free = walkOpeningFreeLabels(players);
    markWalkTarget(graph, label, graph.questCells[label], p.color);
    renderWalkQuestCard(label);
    walkGlowStarts(graph, free, p.color);
    renderWalkScore(players, p.idx);
    renderOpeningPanel(players, op, { freeLabels: free });
    await pause(1.6);
    if (aborted()) return null;
    const choice = botPickStartLabel(graph, p, free);
    p.startLabel = choice;
    p.pos = graph.startCells[choice];
    op.picks[p.idx] = choice;
    walkLog(`${p.name} kiest startpositie <b>${choice}</b> — eerste opdracht ${label} ${QUEST_NAMES[label] || ''}.`, null, p);
    // komeet naar het startvak; de pion staat pas op het bord als hij geland is
    walkFlyingIdx.add(p.idx);
    await walkCometToStart(graph, p, p.pos);
    walkFlyingIdx.delete(p.idx);
    if (aborted()) return null;
    paintWalkPawns(graph, players, p.idx);
    renderOpeningPanel(players, op, { freeLabels: walkOpeningFreeLabels(players) });
    await pause(0.4);
    if (aborted()) return null;
  }
  clearWalkTarget();
  walkSetOpeningMode(false);
  return op.order;
}

// alle pionnen opnieuw zetten. Gericht wissen via de vorige posities i.p.v. een
// querySelectorAll over 1280 cellen, want dit draait bij het hoogste tempo elke 18 ms.
function paintWalkPawns(graph, players, activeIdx){
  for (const el of walkPaintedPawns) el.classList.remove('walk-pawn', 'walk-pawn-active');
  walkPaintedPawns = [];
  for (const p of players){
    if (walkIsIn(p)) continue;   // binnen: pion is van het bord
    if (p.pos === null || p.pos === undefined) continue;   // nog geen startpositie gekozen (zie renderOpeningPanel)
    if (walkFlyingIdx.has(p.idx)) continue;   // vliegt nog naar zijn startvak (walkCometToStart)
    const el = walkCellDiv(graph, p.pos);
    el.style.setProperty('--pawn', p.color);
    el.classList.add('walk-pawn');
    if (p.idx === activeIdx) el.classList.add('walk-pawn-active');
    walkPaintedPawns.push(el);
  }
}

// ---------- HUD ----------
// twee loopstenen plus de energiesteen; `e` is de energiekant (0 = niks). `boost` is de
// derde loopsteen van de Stuwstoot, of null als die actie niet is ingezet.
// De energiesteen toont naast het cijfer een bliksemschichtje. Alleen de kleur was te weinig
// onderscheid met de loopstenen — zeker bij de "0"-kant, die eerder een streepje liet zien en
// daardoor als "geen steen" las in plaats van "een steen die 0 opleverde". `value` is null
// zolang er nog niet gegooid is.
// (de energiesteen zelf tekent diceEnergyDieHtml in 96d-dice.js)

// `total` (optioneel): het aantal stappen dat echt gelopen mag worden, als dat afwijkt van de
// som van de stenen — Stroomonderbreking trekt er 2 vanaf. Zonder dit stond er "= 9 stappen"
// terwijl je er 7 mocht zetten (alleen het logboek noemde de straf).
// Het tekenen zelf (ruimte-stenen, draaien, teller, energiebolletjes) zit in 96d-dice.js.
// opts.key  maakt de worp uniek: dezelfde worp nog eens tekenen laat hem niet opnieuw draaien
// opts.spinMs  hoe lang uitdraaien; opts.flow  energiebolletjes naar je balk (eigen worp)
function renderWalkDice(a, b, e, rolling, boost, total, opts = {}){
  const d = boost ? [a, b, boost] : [a, b];
  if (rolling){ diceRenderTumble(d.length); return; }
  diceRenderRoll(d, e, total, opts.key || `${d.join(',')}|${e}|${total}`, opts);
}

// Het huidige doel zelf staat al op de opdrachtkaart erboven (renderWalkQuestCard) — hier
// dus geen "Doel: …"-regel meer, dat was een letterlijk duplicaat. Alleen de eindstand
// (binnen/verloren) staat nergens anders, dus die regel blijft.
function renderWalkMeta({ player, turn, stepsLeft }){
  if (!player){ walkMetaEl.innerHTML = ''; return; }
  const rankLine = player.rank
    ? walkIsIn(player)
      ? `<span class="hit">Binnen als ${walkRankLabel(player.rank)}</span>`
      : `<span class="lost">Verloren — ${walkRankLabel(player.rank)}</span>`
    : '';
  walkMetaEl.innerHTML =
    `<span>Beurt <b>${turn}</b> · aan zet: <b class="walk-active-name" style="--pc:${player.color}">${player.name}</b>${player.startLabel ? ` (start ${player.startLabel})` : ''}</span>` +
    rankLine +
    `<span>Voltooid: <b>${player.completed}</b> / ${SIM_QUESTS_TO_WIN}${stepsLeft !== undefined ? ` · nog <b>${stepsLeft}</b> stap(pen)` : ''}</span>`;
}

// stand van alle spelers naast elkaar — met meerdere pionnen op het bord is dit de plek
// waar je ziet wie waar naartoe wil en wie voorstaat
function walkRankLabel(rank){ return rank ? `${rank}e` : '—'; }

// wat de energiesteen deze beurt opleverde; meldt ook wanneer het plafond energie opslokt,
// want dat is precies het cijfer waar de kosten van een toekomstige actie op afgestemd worden
function walkRollText(d1, d2, d3, roll){
  return d3 ? `${d1}+${d2}+${d3}=${roll}` : `${d1}+${d2}=${roll}`;
}
// welke energie-actie deze beurt is ingezet
// `!ENERGY_ACTIONS[id]` vangt ook soloUsedEnergyId === 'locked' (97-solo.js,
// soloBeginHumanTurn): dat is een sentinel om het actiepaneel dicht te zetten bij
// Vergrendeling, geen echte ENERGY_ACTIONS-id — zonder deze guard crashte
// soloFinishTurn() hier met "Cannot read properties of undefined (reading 'name')",
// wat de beurt nooit liet afronden en het spel op dat moment liet vastlopen.
function walkActionNote(id){
  if (!id || !ENERGY_ACTIONS[id]) return '';
  const act = ENERGY_ACTIONS[id];
  return ` <span class="action">▸ ${act.name} (−${act.cost})</span>`;
}
// welke beloningskaart deze beurt is gespeeld — zelfde 'locked'-sentinel-val als hierboven
// (soloUsedCardId), vandaar dezelfde guard.
function walkCardNote(id){
  if (!id || !ACTION_CARDS[id]) return '';
  return ` <span class="action">💎 ${ACTION_CARDS[id].name}</span>`;
}
function walkEnergyNote(roll, gain, player){
  if (roll === 0) return ` <span class="energy">⚡0</span>`;
  if (gain.gained === 0) return ` <span class="energy">⚡vol — ${roll} verloren</span>`;
  const lost = gain.wasted ? `, ${gain.wasted} verloren` : '';
  return ` <span class="energy">⚡+${gain.gained} → ${player.energy}${lost}</span>`;
}
// Alleen wie zijn 6 opdrachten rond heeft is écht binnen en verlaat het bord. De laatste
// speler krijgt zijn plaats toebedeeld omdat het potje stopt, niet omdat hij binnenkwam.
function walkIsIn(p){ return p.completed >= SIM_QUESTS_TO_WIN; }

// boven het bord staan de ANDERE spelers (#walkScore), in het paneel rechts staat ALLEEN wie
// aan zet is (#walkScoreActive, gebruikersverzoek) — beide krijgen dezelfde volledige lijst,
// gefilterd via CSS op de `.active`-klasse (`#walkScore .walk-player.active{display:none}` en
// omgekeerd voor `#walkScoreActive`), zodat er maar één render-pad nodig is
// De balk staat in BEURTvolgorde, niet op spelersnummer: dan loopt het rijtje van boven naar
// beneden mee met wie er aan de beurt is, in plaats van door elkaar te springen. Wordt per
// potje gezet (beide modi loten de volgorde) en op null gezet zodra er geen potje loopt.
let walkScoreOrder = null;
function renderWalkScore(players, activeIdx){
  if (!walkScoreEl && !walkScoreActiveEl) return;
  const ordered = walkScoreOrder
    ? walkScoreOrder.map(i => players[i]).filter(Boolean)
    : players;
  // Eén strakke regel per speler (gebruikerswens: "te veel rotzooi"): links de naam, groot, met
  // een klein label (aan zet / eindplaats); rechts drie vaste blokjes met een omschrijving erbij —
  // opdrachten voltooid, energie en het aantal actiekaarten. Géén huidige opdracht en géén
  // energie-strategie meer (stond er eerst wel). Alle spelers blijven op dezelfde plek staan;
  // alleen het vak van wie aan zet is licht op.
  const html = ordered.map(p => {
    const cls = 'walk-player' + (p.idx === activeIdx ? ' active' : '') + (p.rank ? ' done' : '');
    const tag = p.rank
      ? `<span class="walk-player-tag ${walkIsIn(p) ? 'hit' : 'lost'}">${walkRankLabel(p.rank)}</span>`
      : `<span class="walk-player-tag turn" aria-hidden="true">aan zet</span>`;
    const me = p.isHuman && typeof soloIsMe === 'function' && soloIsMe(p)
      ? `<span class="walk-player-me">jij</span>` : '';
    const stat = (label, value, extra) =>
      `<span class="walk-player-stat${extra || ''}"><span class="lbl">${label}</span><b>${value}</b></span>`;
    return `<div class="${cls}" style="--pc:${p.color}"${p.idx === activeIdx ? ' aria-current="true"' : ''}>` +
      `<span class="walk-player-who">` +
        `<span class="walk-player-dot"></span>` +
        `<span class="walk-player-name" title="${p.name}">${p.name}</span>` + me + tag +
      `</span>` +
      `<span class="walk-player-stats">` +
        // lang label op een breed scherm, kort ("Voltooid") waar het anders niet op één regel past
        stat('<span class="lbl-long">Opdrachten voltooid</span><span class="lbl-short">Voltooid</span>', `${p.completed}/${SIM_QUESTS_TO_WIN}`, ' quests') +
        stat('Energie', `⚡${p.energy}`, p.energy >= ENERGY_MAX ? ' energy full' : ' energy') +
        // drie zeshoekjes i.p.v. een getal: bij jezelf in de kleur van de soort, bij een ander
        // zilver (je ziet dát iemand kristallen heeft, niet wélke) — crystalPipsHtml, 96c-crystals.js
        stat('<span class="lbl-long">Kristallen</span><span class="lbl-short">Kristal</span>', crystalPipsHtml(p, crystalIsMe(p)), ' crystals') +
      `</span>` +
    `</div>`;
  }).join('');
  if (walkScoreEl) walkScoreEl.innerHTML = html;
  if (walkScoreActiveEl) walkScoreActiveEl.innerHTML = html;
}

function walkLog(html, cls, player){
  const div = document.createElement('div');
  if (cls) div.className = cls;
  const dot = player ? `<i class="walk-log-dot" style="--pc:${player.color}"></i>` : '';
  div.innerHTML = dot + html;
  walkLogEl.appendChild(div);
  walkLogEl.scrollTop = walkLogEl.scrollHeight;
}

// Legenda en logboek staan standaard dicht — allebei onbegrensd in hoogte (het logboek groeit
// de hele sessie door) en dat was precies waarom "Stap voor stap" niet meer op één pagina paste
// zonder scrollen (gebruikersmelding). Zelf aan/uit te zetten met deze twee knoppen; niets
// hiervan onthoudt zich tussen bezoeken — bij een herlaad staan ze weer dicht.
function walkToggleExtra(btn, panel, label){
  if (!btn || !panel) return;
  const show = panel.hidden;   // stond dicht -> we gaan 'm nu juist tonen
  panel.hidden = !show;
  btn.setAttribute('aria-pressed', String(show));
  btn.classList.toggle('active', show);
  btn.textContent = (show ? 'Verberg ' : 'Toon ') + label;
  if (show && panel === walkLogEl) walkLogEl.scrollTop = walkLogEl.scrollHeight;
}
if (btnWalkToggleLegend) btnWalkToggleLegend.addEventListener('click', () => walkToggleExtra(btnWalkToggleLegend, walkLegendEl, 'legenda'));
if (btnWalkToggleLog) btnWalkToggleLog.addEventListener('click', () => walkToggleExtra(btnWalkToggleLog, walkLogEl, 'log'));

// ---------- besturing ----------
function setWalkRunning(on){
  walkRunning = on;
  if (!on) setWalkPaused(false);   // een gestopte run mag niet gepauzeerd blijven hangen
  if (!btnWalkStart) return;
  btnWalkStart.disabled = on;
  btnWalkStop.disabled = !on;
  if (on) btnWalkStop.textContent = 'Stoppen';
  if (btnWalkPause) btnWalkPause.disabled = !on;
  if (walkPlayersSel) walkPlayersSel.disabled = on;
  if (walkEnergyModeEl) walkEnergyModeEl.disabled = on;
}

// wordt ook aangeroepen zodra de indeling wijzigt (via clearSimResults in 95-simulate.js),
// want een lopende pion hoort niet op een bord dat onder hem vandaan verandert
function stopWalkSimulation(){
  walkRunId++;
  diceReset();
  crystalResetVault();    // lopende kristal-animaties en zeshoekjes-tellers weg
  setWalkRunning(false);
  soloHideEndgame();      // winscherm van een uitgespeeld potje (97-solo.js) hoort hier ook weg
  clearWalkTarget();      // anders blijft "Nu op zoek naar …" staan bij een stilgezet potje
  walkSetOpeningMode(false);   // gestopt tijdens het dobbelen/kiezen aan het begin
}

// sorteervolgorde voor een standenlijst: eerst wie al binnen is (op volgorde van binnenkomst,
// p.rank), daarna de rest op aantal voltooide opdrachten — gedeeld tussen de eindklassering
// in het winscherm (soloEndgameRankingHtml) en een eventuele LIVE rang tijdens het spelen (zie
// soloLiveRank in 97-solo.js; die slaat het resultaat expliciet NIET op in p.rank, dat veld is
// voor de eindstand).
function walkOrderPlayers(players){
  return players.slice().sort((a, b) => (a.rank || 99) - (b.rank || 99) || b.completed - a.completed);
}

async function runWalkSimulation(){
  const runId = ++walkRunId;
  const aborted = () => runId !== walkRunId;
  setWalkRunning(true);
  setWalkPaused(false);        // een nieuwe run begint nooit gepauzeerd
  soloHideEndgame();           // winscherm van het vorige potje weg
  crystalResetVault();
  walkLogEl.innerHTML = '';
  walkStatusEl.innerHTML = '';

  const reach = analyseCellReachability();
  if (reach.unreachable.length > 0){
    walkStatusEl.innerHTML = `<span class="bad">✕ Dit bord heeft ${reach.unreachable.length} onbereikbare vakjes — pas de indeling aan voordat je simuleert.</span>`;
    setWalkRunning(false);
    return;
  }

  renderWalkBoard();
  const graph = buildSimGraph();

  const missing = [...SIM_QUEST_LABELS, ...SIM_START_LABELS].filter(l =>
    graph.questCells[l] === undefined && graph.startCells[l] === undefined);
  if (missing.length){
    walkStatusEl.innerHTML = `<span class="bad">✕ Deze vakjes ontbreken op het bord: ${missing.join(', ')}.</span>`;
    setWalkRunning(false);
    return;
  }

  const rand = mulberry32(Math.floor(Math.random() * 4294967296));
  const playerCount = walkPlayerCount();

  // geen startpositie vooraf: die kiezen de bots straks zelf, in de volgorde van de worp
  // (walkRunOpening hierboven)
  const botNames = pickBotNames(playerCount);   // in Automatisch zijn het allemaal bots
  const players = Array.from({ length: playerCount }, (_, i) => ({
    idx: i,
    name: botNames[i],
    color: WALK_PLAYER_COLORS[i],
    startLabel: null,
    pos: null,
    questHidden: true,
    stats: newPlayerStats(),   // voor de knop "Statistieken" op het winscherm
    deck: simShuffle(SIM_QUEST_LABELS, rand),
    nextIdx: 0,
    completed: 0,
    energy: 0,
    // "mix" geeft speler 1 t/m 4 elk een andere strategie, zodat je ze naast elkaar ziet
    strategy: walkEnergyModeEl && walkEnergyModeEl.value !== 'mix'
      ? walkEnergyModeEl.value
      : ENERGY_STRATEGIES[i % ENERGY_STRATEGIES.length],
    actionUses: 0,
    cards: [],               // beloningskaarten in de hand (max ACTION_CARD_HAND_MAX)
    skipEnergyRoll: false,   // getroffen door Kortsluiting: mist de eerstvolgende energiesteen
    condenserPending: false, // Condensator gespeeld: de VOLGENDE energiesteen telt dubbel
    lockedNextTurn: false,   // getroffen door Vergrendeling: mist volgende beurt energie- én kaartslot
    rollPenalty: 0,          // getroffen door Stroomonderbreking: -N stappen op de eerstvolgende worp
    rank: 0,                // 0 = nog aan het spelen; 1..4 = binnengekomen op die plaats
    doneCells: [],          // opdrachtvakjes die DEZE speler al gehad heeft
  }));
  walkScoreOrder = players.map(p => p.idx);
  const finishTarget = simFinishTarget(playerCount);
  const deck = buildActionDeck(rand);   // één gedeelde stapel voor dit potje
  portalSetup(graph, rand);             // twee portalen liggen al bij de start
  walkPaintPortals(graph);

  // eerst dobbelen wie begint, dan kiest iedereen in die volgorde een startpositie — die volgorde
  // is meteen de beurtvolgorde van het potje
  const turnOrder = await walkRunOpening(graph, players, rand, aborted);
  if (!turnOrder) return;
  walkScoreOrder = turnOrder;

  for (const p of players){
    walkLog(`${p.name} start op <b>${p.startLabel}</b> · energie: <b>${energyStrategyName(p.strategy)}</b> · stapel: ${p.deck.slice(0, SIM_QUESTS_TO_WIN).join(' → ')} …`, null, p);
  }
  walkLog(`Elke voltooide opdracht levert een kristal op uit een gedeelde stapel — net als het kristalvakje in elke gang (zet stopt er niet voor, hooguit 1x per beurt) — max ${ACTION_CARD_HAND_MAX} kristallen in de kluis.`);
  if (playerCount > 1){
    walkLog(`Beurtvolgorde: ${turnOrder.map(i => players[i].name).join(' → ')}.`);
    walkLog(playerCount === 2
      ? `Er wordt gespeeld tot de winnaar binnen is — de ander is dan tweede.`
      : `Er wordt doorgespeeld tot de <b>${finishTarget}e</b> binnen is; de laatste speler is dan automatisch ${playerCount}e.`);
  }

  renderWalkScore(players, turnOrder[0]);
  renderWalkMeta({ player: players[turnOrder[0]], turn: 0 });
  paintWalkPawns(graph, players, turnOrder[0]);

  let turn = 0;
  let finished = 0;
  let gameOver = false;

  while (turn < SIM_MAX_TURNS && !gameOver){
    const roundFinishers = [];   // spelers die deze ronde hun 6e opdracht voltooien
    let hitTurnCap = false;
    for (const pIdx of turnOrder){
      if (turn >= SIM_MAX_TURNS){ hitTurnCap = true; break; }
      if (aborted()) return;

      const player = players[pIdx];
      if (player.rank) continue;   // binnen: speelt niet meer mee
      turn++;
      statsTurnSnapshot(player);   // voortgang/energie bij het begin van de beurt (grafieken)
      player.ownTurns = (player.ownTurns || 0) + 1;   // eigen beurten, voor "wint in N beurten"
      // Energie-acties en kaarten hebben ELK hun eigen actie-slot per beurt (max 1 van elk) —
      // zelfde opzet als simulateOneGame() in 95-simulate.js, zie de uitgebreide toelichting
      // daar voor de paren (Stuwlading/Stuwstoot, laarzen, Portaalsleutel/Portaalkanon) die
      // elkaar nog wél uitsluiten binnen hún ene bewegingsmoment.
      let energyActionUsed = false;   // hooguit 1 energie-actie per beurt
      let cardActionUsed = false;     // hooguit 1 kaart spelen per beurt
      let actionCellDrawnThisTurn = false;   // hooguit 1 beloningskaart per beurt via een actiekaartvakje
      // Vergrendeling: vorige beurt geraakt betekent dat je NU zowel je energie- als je
      // kaartslot mist; beide sloten op "gebruikt" zetten blokkeert vanzelf alles hieronder.
      if (player.lockedNextTurn){
        player.lockedNextTurn = false;
        energyActionUsed = true;
        cardActionUsed = true;
        walkLog(`${player.name} is <b>vergrendeld</b> en slaat zijn energie- en kristalactie over.`, null, player);
      }
      let usedEnergyAction = null; // id uit ENERGY_ACTIONS, voor de logregel
      let usedCardId = null;       // id uit ACTION_CARDS, voor de logregel

      // energiesteen rolt mee (tenzij Kortsluiting die deze beurt blokkeert), maar telt pas aan
      // het eind van de beurt bij — wat je nu gooit geef je pas volgende beurt uit, zelfde
      // tijdsregels als simulateOneGame() en de mens (zie bovenaan 95-simulate.js)
      let energyRoll = 0, pendingEnergy = 0;
      if (player.skipEnergyRoll){
        player.skipEnergyRoll = false;
      } else {
        energyRoll = simRollEnergy(rand);
        pendingEnergy = energyRoll;
        player.stats.energyRolled += energyRoll;
        // vorige beurt een Condensator gespeeld: deze steen telt dubbel (zie simulateOneGame)
        if (player.condenserPending){
          player.condenserPending = false;
          pendingEnergy += energyRoll;
          walkLog(`${player.name} verzilvert de <b>Condensator</b>: energiesteen ${energyRoll} telt dubbel.`, null, player);
        }
      }

      // fase 1: kaarten rond de energiefase; de Condensator wordt klaargezet voor de VOLGENDE beurt
      if (!cardActionUsed && player.cards.includes('condenser') && !player.condenserPending && player.energy < ENERGY_MAX){
        player.condenserPending = true;
        useActionCard(player, 'condenser', deck);
        cardActionUsed = true; usedCardId = 'condenser';
      }
      if (!cardActionUsed && player.cards.includes('short')){
        const victim = pickShortCircuitTarget(players, pIdx, rand);
        if (victim){
          victim.skipEnergyRoll = true;
          useActionCard(player, 'short', deck);
          cardActionUsed = true; usedCardId = 'short';
        }
      }
      // Energielek: alleen als er bij een ander genoeg te halen valt (zie simulateOneGame)
      if (!cardActionUsed && player.cards.includes('leak') && player.energy < ENERGY_MAX){
        const victim = pickEnergyLeakTarget(players, pIdx, rand);
        if (victim && victim.energy >= ENERGY_LEAK_AMOUNT){
          const r = applyEnergyLeak(player, victim);
          useActionCard(player, 'leak', deck);
          cardActionUsed = true; usedCardId = 'leak';
          walkLog(`${player.name} gebruikt <b>Energielek</b> en pakt ${r.taken} energie van ${victim.name}.`, null, player);
        }
      }
      // Dubbele steen: een tweede energiesteen, telt net als de eerste pas na de zet
      if (!cardActionUsed && player.cards.includes('twin') && botWantsTwinEnergy(player, pendingEnergy)){
        const second = simRollEnergy(rand);
        pendingEnergy += second;
        player.stats.energyRolled += second;
        useActionCard(player, 'twin', deck);
        cardActionUsed = true; usedCardId = 'twin';
        walkLog(`${player.name} gooit met <b>Dubbele steen</b> een tweede energiesteen: ${second}.`, null, player);
      }
      if (!cardActionUsed && player.cards.includes('ration') && player.energy < ENERGY_MAX){
        simGainEnergy(player, 3);
        useActionCard(player, 'ration', deck);
        cardActionUsed = true; usedCardId = 'ration';
      }

      if (!cardActionUsed && player.cards.includes('lockdown')){
        const victim = pickLeaderTarget(players, pIdx, p => p.lockedNextTurn, rand);
        if (victim){
          victim.lockedNextTurn = true;
          useActionCard(player, 'lockdown', deck);
          cardActionUsed = true; usedCardId = 'lockdown';
          walkLog(`${player.name} gebruikt <b>Vergrendeling</b> op ${victim.name}.`, null, player);
        }
      }
      if (!cardActionUsed && player.cards.includes('outage')){
        const victim = pickLeaderTarget(players, pIdx, p => p.rollPenalty > 0, rand);
        if (victim){
          victim.rollPenalty = 2;
          useActionCard(player, 'outage', deck);
          cardActionUsed = true; usedCardId = 'outage';
          walkLog(`${player.name} gebruikt <b>Stroomonderbreking</b> op ${victim.name}.`, null, player);
        }
      }
      // fase 2: doel bepalen — Herprioritering (energie, betaald) kan je doel wisselen; Duwstoot
      // verplaatst een tegenstander, niet jezelf
      let targetLabel = player.deck[player.nextIdx];
      const shim = { order: player.deck, nextIdx: player.nextIdx };  // energyReorderTarget() werkt op `order`
      if (!cardActionUsed && player.cards.includes('shove')){
        const shove = pickShoveMove(graph, players, pIdx, rand);
        if (shove){
          shove.player.pos = shove.toKey;
          useActionCard(player, 'shove', deck);
          cardActionUsed = true; usedCardId = 'shove';
          walkLog(`${player.name} gebruikt <b>Duwstoot</b> op ${shove.player.name}.`, null, player);
        }
      }
      // Herprioritering: betalen, volgende kaart bekijken, wisselen als die dichterbij ligt
      // (zie botWantsReorderPeek in 95-simulate.js) — ook betaald als wisselen niets oplevert
      if (!energyActionUsed && botStrategyNow(graph, player) === 'reorder' && player.energy >= ENERGY_ACTIONS.reorder.cost
          && botWantsReorderPeek(graph, shim, player.pos)){
        player.energy -= ENERGY_ACTIONS.reorder.cost;
        player.actionUses++;
        energyActionUsed = true; usedEnergyAction = 'reorder';
        statsUseEnergy(player, 'reorder');
        const before = player.deck[player.nextIdx];
        const swapped = energyReorderTarget(graph, shim, player.pos);
        if (swapped === null){
          walkLog(`${player.name} bekijkt met <b>Herprioritering</b> zijn volgende opdracht en houdt ${before}.`, null, player);
        } else {
          targetLabel = swapped;
          walkLog(`${player.name} haalt met <b>Herprioritering</b> ${swapped} naar voren (was ${before}).`, null, player);
        }
      }
      const targetKey = graph.questCells[targetLabel];
      // volledige rij nog te halen opdrachtvakjes, te beginnen bij het huidige doel — zie de
      // toelichting bij `targets` in simulateOneGame() (95-simulate.js)
      const targets = [];
      for (let i = player.nextIdx; i < player.deck.length; i++) targets.push(graph.questCells[player.deck[i]]);

      // bord klaarzetten voor deze beurt: eigen voortgang, eigen doel, alle pionnen (ook een
      // net geduwde tegenstander staat hier al op zijn nieuwe plek)
      walkClearClass('walk-trail');
      walkClearClass('walk-done');
      for (const k of player.doneCells) walkCellDiv(graph, k).classList.add('walk-done');
      const targetDiv = walkCellDiv(graph, targetKey);
      markWalkTarget(graph, targetLabel, targetKey, player.color);
      renderWalkQuestCard(targetLabel);
      paintWalkPawns(graph, players, pIdx);
      renderWalkScore(players, pIdx);
      renderWalkMeta({ player, turn });

      // pion langs een pad laten lopen; `special` markeert een niet-gewone verplaatsing
      // (Noodtransport, Zwaartekracht-laarzen) met een ander spoor. `bank.limit` zegt hoeveel
      // opdrachten dit pad pakt (zie walkAdvanceShownTarget).
      const bank = { seq: player.deck.slice(player.nextIdx), completed: player.completed, limit: 0, shown: 0 };
      async function walkPath(path, special){
        for (let i = 1; i < path.length; i++){
          if (aborted()) return false;
          const leaving = walkCellDiv(graph, player.pos);
          leaving.style.setProperty('--pc', player.color);
          leaving.classList.add('walk-trail');
          if (special) leaving.classList.add('walk-jump');
          // door een portaal (twee vakjes die niet naast elkaar liggen): flits, geen stap op de teller
          const viaPortal = portalIsJump(graph, path[i - 1], path[i]);
          if (viaPortal) walkPortalJumpFx(graph, path[i - 1], path[i]);
          player.pos = path[i];
          walkAdvanceShownTarget(graph, bank, player.pos, player.color, occupiedNow(), true);
          // actiekaartvakje (gang): onderbreekt de zet niet, levert hooguit 1x per beurt een
          // beloningskaart op — ook als je onderweg meerdere van deze vakjes passeert
          if (!actionCellDrawnThisTurn && graph.actionCells.has(player.pos)){
            actionCellDrawnThisTurn = true;
            const reward = drawActionCellReward(player, deck, rand);
            if (reward.drawn){
              walkLog(`${player.name} loopt over een kristalvakje en raapt een kristal op: <b>${ACTION_CARDS[reward.drawn].name}</b> — ${ACTION_CARDS[reward.drawn].hint}.`, null, player);
            } else if (reward.handFull){
              walkLog(`${player.name} loopt over een kristalvakje, maar de kluis is al vol.`, null, player);
            }
            if (reward.drawn || reward.handFull) crystalFxAnon(player.pos, player, !reward.drawn, walkSpeed().stepMs < 140, graph);
          }
          paintWalkPawns(graph, players, pIdx);
          if (!special && !viaPortal) diceProgressStep();
          renderWalkMeta({ player, turn, stepsLeft: path.length - 1 - i });
          await walkTick(walkSpeed().stepMs * (viaPortal ? 2 : 1));
        }
        return true;
      }

      const occupiedNow = () => {
        const occ = new Set();
        for (const other of players) if (other.idx !== pIdx && !walkIsIn(other)) occ.add(other.pos);
        return occ;
      };

      // fase 3: vóór de worp — Noodtransport of Zwaartekracht-laarzen (energie-actie of de gratis
      // kaart), dezelfde keuze als in simulateOneGame (botPreRollMove in 95-simulate.js). Die
      // verplaatsing wordt eerst afgespeeld; een sprong die precies op de opdracht landt
      // beëindigt de beurt, anders gooit de speler daarna vanaf zijn nieuwe plek.
      let move, d1 = 0, d2 = 0, d3 = null, roll = 0, rollPenalty = 0;
      const pre = botPreRollMove(graph, player, occupiedNow(), targets, !energyActionUsed, !cardActionUsed);
      if (pre){
        const namen = ['noorden', 'oosten', 'zuiden', 'westen'];
        if (pre.kind === 'bootsCard' || pre.kind === 'portalCard'){
          usedCardId = pre.kind === 'bootsCard' ? 'boots' : 'portalkey';
          useActionCard(player, usedCardId, deck);
          cardActionUsed = true;
        } else {
          player.energy -= ENERGY_ACTIONS[pre.kind].cost;
          player.actionUses++;
          energyActionUsed = true; usedEnergyAction = pre.kind;
          statsUseEnergy(player, pre.kind);
        }
        if (preIsPortal(pre)){
          const placed = portalPlace(graph, pre.shot.key, pre.shot.color, pIdx);
          walkLog(walkPortalShotText(player.name, pre.shot, placed.stolen), null, player);
          await walkPortalShotFx(graph, pre.shot.path, pre.shot.color, placed.from, walkSpeed().stepMs < 140);
          if (aborted()) return;
          walkPaintPortals(graph);
          walkPortalBurst(graph, pre.shot.key, pre.shot.color, true);
        } else if (pre.kind === 'jump'){
          walkLog(`${player.name} springt met <b>Noodtransport</b> ${pre.path.length - 1} vakjes${pre.endsTurn ? ', precies op zijn opdracht' : ''}.`, null, player);
        } else {
          const dir = lastStepDirection(graph, pre.path);
          walkLog(`${player.name} schiet met <b>Zwaartekracht-laarzen</b>${pre.kind === 'bootsCard' ? ' (kristal)' : ''} ${pre.path.length - 1} vakjes rechtdoor naar het ${namen[dir] || ''}.`, null, player);
        }
        bank.limit = pre.bankedCount;
        if (!await walkPath(pre.path, true)) return;
        if (pre.kind !== 'jump' && !preIsPortal(pre)) player.stats.dashSteps += pre.path.length - 1;
      }
      const rollTargets = pre ? targets.slice(pre.bankedCount) : targets;
      if (pre && (pre.endsTurn || player.completed + pre.bankedCount >= SIM_QUESTS_TO_WIN)){
        move = { key: pre.key, path: pre.path, stepsUsed: pre.path.length - 1, bankedCount: pre.bankedCount,
                 bankedQuest: pre.bankedCount > 0, wasBlocked: pre.wasBlocked, teleported: pre.kind === 'jump' };
        // geen worp meer: alleen de energiesteen tonen
        diceRenderNoRoll(energyRoll);
      } else {
        // fase 4: dobbelen — even laten rollen zodat je het ziet gebeuren. Geteld in stappen en
        // niet op de klok, anders is de worp na een pauze meteen "uitgerold".
        const shakeSteps = Math.round(walkSpeed().rollMs / 90);
        for (let i = 0; i < shakeSteps; i++){
          if (aborted()) return;
          renderWalkDice(1 + Math.floor(Math.random()*6), 1 + Math.floor(Math.random()*6),
                         ENERGY_DIE_FACES[Math.floor(Math.random()*ENERGY_DIE_FACES.length)], true);
          await walkTick(90);
        }
        if (aborted()) return;
        // loopstenen met Stuwlading (kaart) of Stuwstoot (energie) als derde steen — die twee
        // doen hetzelfde en blijven daarom via else-if elkaar uitsluiten
        d1 = simRollD6(rand, player); d2 = simRollD6(rand, player);
        statsRecordRoll(player, d1 + d2);
        if (!cardActionUsed && player.cards.includes('boostcell')){
          d3 = simRollD6(rand, player);
          useActionCard(player, 'boostcell', deck);
          cardActionUsed = true; usedCardId = 'boostcell';
        } else if (!energyActionUsed && botStrategyNow(graph, player) === 'boost' && player.energy >= ENERGY_ACTIONS.boost.cost){
          d3 = simRollD6(rand, player);
          player.energy -= ENERGY_ACTIONS.boost.cost;
          player.actionUses++;
          energyActionUsed = true; usedEnergyAction = 'boost';
          statsUseEnergy(player, 'boost');
        }
        roll = d1 + d2 + (d3 || 0);
        if (player.rollPenalty){
          rollPenalty = player.rollPenalty;
          roll = Math.max(1, roll - rollPenalty);
          player.rollPenalty = 0;
          walkLog(`${player.name} verliest ${rollPenalty} stappen door <b>Stroomonderbreking</b> → ${roll}.`, null, player);
        }
        renderWalkDice(d1, d2, energyRoll, false, d3, roll, { key: `auto|${turn}|${pIdx}|${d1}${d2}${d3}`, spinMs: walkSpeed().stepMs < 140 ? 0 : DICE_SPIN_SHORT_MS });
        if (aborted()) return;
        await walkTick(Math.min(500, walkSpeed().rollMs) + (walkSpeed().stepMs < 140 ? 0 : DICE_SPIN_SHORT_MS));
        if (aborted()) return;

        let rollMove = resolveMove(graph, player.pos, roll, occupiedNow(), rollTargets, rand);
        // Zelf kiezen: één steen een andere waarde geven als dat duidelijk beter uitkomt (zie
        // botPickDieValue in 95-simulate.js)
        if (!rollMove.bankedQuest && !cardActionUsed && player.cards.includes('pick')){
          const vals = d3 ? [d1, d2, d3] : [d1, d2];
          const pk = botPickDieValue(graph, player.pos, vals, rollPenalty, occupiedNow(), rollTargets, rand, rollMove);
          if (pk){
            const was = vals[pk.idx];
            if (pk.idx === 0) d1 = pk.value; else if (pk.idx === 1) d2 = pk.value; else d3 = pk.value;
            roll = pk.roll;
            rollMove = pk.move;
            useActionCard(player, 'pick', deck);
            cardActionUsed = true; usedCardId = 'pick';
            walkLog(`${player.name} gebruikt <b>Zelf kiezen</b>: een ${was} wordt een ${pk.value} → ${roll} stappen.`, null, player);
            renderWalkDice(d1, d2, energyRoll, false, d3, roll, { key: `auto|${turn}|${pIdx}|pk|${d1}${d2}${d3}`, spinMs: 0 });
            if (aborted()) return;
            await walkTick(Math.min(500, walkSpeed().rollMs));
            if (aborted()) return;
          }
        }
        // Koerscorrectie: tegenvallende worp overdoen (zie simulateOneGame voor de drempel)
        const dice = d3 ? 3 : 2;
        if (!rollMove.bankedQuest && !cardActionUsed && player.cards.includes('reroll') && roll < dice * 3.5){
          d1 = simRollD6(rand, player); d2 = simRollD6(rand, player);
          statsRecordRoll(player, d1 + d2);
          if (d3) d3 = simRollD6(rand, player);
          roll = d1 + d2 + (d3 || 0);
          // Stroomonderbreking geldt ook voor de nieuwe worp (zie simulateOneGame)
          if (rollPenalty) roll = Math.max(1, roll - rollPenalty);
          useActionCard(player, 'reroll', deck);
          cardActionUsed = true; usedCardId = 'reroll';
          renderWalkDice(d1, d2, energyRoll, false, d3, roll, { key: `auto|${turn}|${pIdx}|re|${d1}${d2}${d3}`, spinMs: walkSpeed().stepMs < 140 ? 0 : DICE_SPIN_SHORT_MS });
          if (aborted()) return;
          await walkTick(Math.min(500, walkSpeed().rollMs) + (walkSpeed().stepMs < 140 ? 0 : DICE_SPIN_SHORT_MS));
          if (aborted()) return;
          rollMove = resolveMove(graph, player.pos, roll, occupiedNow(), rollTargets, rand);
        }
        // Zonnezeil: energie gelijk aan de laagste loopsteen, als er ruimte is
        if (!cardActionUsed && player.cards.includes('solar') && player.energy + pendingEnergy < ENERGY_MAX){
          const g = simGainEnergy(player, solarGain(d3 ? [d1, d2, d3] : [d1, d2]));
          useActionCard(player, 'solar', deck);
          cardActionUsed = true; usedCardId = 'solar';
          walkLog(`${player.name} gebruikt <b>Zonnezeil</b>: +${g.gained} energie.`, null, player);
        }
        // fase 5: Blinde Vlek (kaart) rekent een geblokkeerde worp opnieuw uit, door
        // tegenstanders heen maar niet erop eindigend (zie simulateOneGame)
        if (!rollMove.bankedQuest && !cardActionUsed && player.cards.includes('blind') && rollMove.wasBlocked){
          const retry = resolveMove(graph, player.pos, roll, SIM_EMPTY_SET, rollTargets, rand, occupiedNow());
          if (retry && retry.key !== rollMove.key){
            rollMove = retry;
            useActionCard(player, 'blind', deck);
            cardActionUsed = true; usedCardId = 'blind';
          }
        }
        // opgeteld: wat de sprint vóór de worp al pakte is al getoond (bank.shown)
        bank.limit = (pre ? pre.bankedCount : 0) + rollMove.bankedCount;
        if (!await walkPath(rollMove.path, false)) return;
        diceProgressDone();
        player.stats.walkSteps += rollMove.path.length - 1 - pathPortalJumps(graph, rollMove.path);
        move = mergePreRollMove(pre, rollMove);
      }
      // de energiesteen van deze beurt telt nu pas bij: volgende beurt uit te geven
      const energyGain = pendingEnergy ? simGainEnergy(player, pendingEnergy) : { gained: 0, wasted: 0 };

      const preNote = !pre ? '' : pre.kind === 'jump' ? '⚡ sprong + ' : preIsPortal(pre) ? '◎ portaal + ' : '🥾 sprint + ';
      const rollText = roll ? preNote + walkRollText(d1, d2, d3, roll)
        : pre.kind === 'jump' ? '⚡ Noodtransport' : `🥾 ${pre.path.length - 1} vakjes rechtdoor`;
      // beide kunnen nu tegelijk waar zijn (energie-actie EN kaart zijn losse sloten per beurt),
      // dus samenvoegen i.p.v. kiezen — anders verdween een gespeelde kaart stilletjes uit de log
      // zodra er in dezelfde beurt ook een energie-actie was ingezet
      const turnNote = walkActionNote(usedEnergyAction) + walkCardNote(usedCardId);

      if (move.bankedQuest){
        // meestal 1 opdracht, zelden 2 (de resterende stappen na de 1e voerden toevallig ook
        // door de 2e) — zie resolveMove in 95-simulate.js. `targetLabel`/`targetKey`/`targetDiv`
        // horen al bij de EERSTE (die stond immers al als doel op het bord vóór deze beurt);
        // eventuele volgende gebankte opdrachten deze beurt lezen we vers uit player.deck.
        const bankedLabels = [];
        for (let i = player.nextIdx, n = 0; n < move.bankedCount; i++, n++) bankedLabels.push(player.deck[i]);
        player.doneCells.push(targetKey);
        targetDiv.classList.remove('walk-target');
        targetDiv.classList.add('walk-done');
        for (let i = 1; i < bankedLabels.length; i++){
          const k = graph.questCells[bankedLabels[i]];
          player.doneCells.push(k);
          const div = walkCellDiv(graph, k);
          div.classList.remove('walk-target');
          div.classList.add('walk-done');
        }
        player.completed += bankedLabels.length;
        player.nextIdx += bankedLabels.length;

        const deadEnd = (roll && move.stepsUsed < roll) ? ` (kwam daarna vast te zitten na ${move.stepsUsed} van ${roll} stappen)` : '';
        const chainNote = bankedLabels.length > 1
          ? ` — en loopt meteen door naar <span class="hit">${bankedLabels.slice(1).map(l => `${l} ${QUEST_NAMES[l] || ''}`).join(', ')}</span>: twee opdrachten in één beurt!`
          : '';
        walkLog(`Beurt ${turn}: <b>${rollText}</b>${walkEnergyNote(energyRoll, energyGain, player)}${turnNote} → <span class="hit">${targetLabel} ${QUEST_NAMES[targetLabel] || ''} voltooid</span>${chainNote}${deadEnd} · ${player.completed}/${SIM_QUESTS_TO_WIN}`, 'hit', player);

        for (let n = 0; n < bankedLabels.length; n++){
          if (player.cards.length < ACTION_CARD_HAND_MAX){
            const drawn = drawActionCard(deck, rand);
            if (drawn){
              player.cards.push(drawn);
              walkLog(`${player.name} krijgt een kristal: <b>${ACTION_CARDS[drawn].name}</b> — ${ACTION_CARDS[drawn].hint}.`, null, player);
              crystalFxAnon(player.pos, player, false, walkSpeed().stepMs < 140, graph);
            }
          } else {
            walkLog(`${player.name} zou een kristal krijgen, maar de kluis is al vol.`, null, player);
            crystalFxAnon(player.pos, player, true, walkSpeed().stepMs < 140, graph);
          }
        }

        if (player.completed >= SIM_QUESTS_TO_WIN){
          // rank wordt NIET meteen toegekend — pas ná deze hele ronde (zie resolveRoundFinishers
          // in 95-simulate.js), zodat wie later in de beurtvolgorde zit deze ronde nog evenveel
          // kans krijgt om ook zijn 6e opdracht te halen, i.p.v. dat beurtvolgorde de plaats bepaalt
          // eigen beurten van deze speler (niet `turn`, dat telt alle spelers samen)
          player.finishTurn = player.ownTurns;
          clearWalkTarget();
          walkLog(`${player.name} heeft alle ${SIM_QUESTS_TO_WIN} opdrachten voltooid (beurt ${turn}) en verlaat het bord — wacht op de rest van deze ronde.`, 'hit', player);
          roundFinishers.push(player);
          paintWalkPawns(graph, players, pIdx);
        }
      } else {
        const blocked = move.wasBlocked ? ' · liep onderweg tegen een bezette route aan' : '';
        const extra = (roll && move.stepsUsed < roll) ? ` — kon maar ${move.stepsUsed} stappen zetten (doodlopend)` : '';
        walkLog(`Beurt ${turn}: <b>${rollText}</b>${walkEnergyNote(energyRoll, energyGain, player)}${turnNote} → onderweg naar ${targetLabel}${extra}${blocked}`, null, player);
      }
      renderWalkScore(players, pIdx);
      renderWalkMeta({ player, turn });
    }

    if (aborted()) return;
    if (roundFinishers.length){
      const groups = resolveRoundFinishers(roundFinishers, finished);
      for (const group of groups){
        if (group.length === 1){
          walkLog(`<b>${group[0].name} is binnen als ${walkRankLabel(group[0].rank)}</b>.`, 'hit', group[0]);
        } else {
          const names = group.map(p => p.name).join(' en ');
          walkLog(`<b>${names} delen de ${walkRankLabel(group[0].rank)} plaats</b> — gelijke energie (${group[0].energy}) en evenveel kristallen in de kluis (${group[0].cards.length}).`, 'hit', null);
        }
      }
      finished += roundFinishers.length;
      renderWalkScore(players, turnOrder[0]);
      if (finished >= finishTarget){
        // de achterblijver(s) kunnen niets meer bereiken: plaats staat vast
        for (const p of players) if (!p.rank) p.rank = finished + 1;
        gameOver = true;
      }
    }
    if (hitTurnCap) break;
  }

  if (aborted()) return;
  clearWalkTarget();
  walkClearClass('walk-trail');
  renderWalkScore(players, -1);
  // linkerkolom helemaal leeg -> .walk-info-panel verbergt zichzelf (styles.css, :has(...:empty));
  // de spelersbalk boven het bord (#walkScore) blijft gewoon staan
  if (walkScoreActiveEl) walkScoreActiveEl.innerHTML = '';
  if (walkMetaEl) walkMetaEl.innerHTML = '';
  // Uitslag in hetzelfde winscherm als Zelf spelen (soloShowEndgame, 97-solo.js) — vroeger stond
  // hier een statusregel met de eindklassering in de smalle linkerkolom (gebruikersmelding: lelijk).
  // Het winscherm zegt alles al, dus #walkStatus blijft leeg.
  walkStatusEl.innerHTML = '';
  const winners = players.filter(p => p.rank === 1);
  const notMe = () => false;   // alleen bots: niemand is "jij"
  if (gameOver && winners.length){
    const w = winners[0];
    const title = winners.length === 1 ? `${w.name} wint!` : 'Gedeelde winst!';
    const sub = winners.length === 1
      ? ''   // geen startplek/beurten meer, zie soloEndgameTexts (97-solo.js)
      : `${winners.map(p => p.name).join(' en ')} — gelijke energie en kristallen`;
    soloShowEndgame('🏆', title, sub, players, notMe);
  } else {
    soloShowEndgame('⏳', 'Afgekapt', `niet iedereen was binnen na ${SIM_MAX_TURNS} beurten`, players, notMe);
  }
  setWalkRunning(false);
  // "Stoppen" was na afloop grijs, waardoor je niet meer terug kon naar de lobby. Zelfde knop,
  // zelfde handler (stopWalkSimulation + walkFadeToLobby); setWalkRunning(true) zet de tekst terug.
  if (btnWalkStop){ btnWalkStop.disabled = false; btnWalkStop.textContent = 'Terug naar lobby'; }
}

if (btnWalkStart) btnWalkStart.addEventListener('click', () => walkTryStart(runWalkSimulation));
if (btnWalkPause) btnWalkPause.addEventListener('click', () => setWalkPaused(!walkPaused));
if (btnWalkStop) btnWalkStop.addEventListener('click', () => { stopWalkSimulation(); walkFadeToLobby(); });
// Twee tempo-schuiven die hetzelfde tempo regelen: #walkSpeed in de lobby (vooraf instellen) en
// #walkSpeedPlay rechtsboven in de tabbladenbalk (tijdens het lopen — de lobby is dan weg,
// gebruikersmelding "tempo tijdens het lopen aanpassen kan nergens"). walkSpeed() leest altijd
// #walkSpeed; de andere wordt gewoon meegezet.
const walkSpeedPlayEl = document.getElementById('walkSpeedPlay');
if (walkSpeedEl){
  const syncSpeed = (from) => {
    if (walkSpeedPlayEl){
      if (from === walkSpeedPlayEl) walkSpeedEl.value = walkSpeedPlayEl.value;
      else walkSpeedPlayEl.value = walkSpeedEl.value;
      walkSpeedPlayEl.title = 'Tempo: ' + walkSpeed().label;
    }
    walkSpeedLabelEl.textContent = walkSpeed().label;
    if (walkSpeedEl.segRender) walkSpeedEl.segRender();   // schuifrail in de lobby (80-controls.js)
  };
  walkSpeedEl.addEventListener('input', () => syncSpeed(walkSpeedEl));
  if (walkSpeedPlayEl) walkSpeedPlayEl.addEventListener('input', () => syncSpeed(walkSpeedPlayEl));
  syncSpeed(walkSpeedEl);
}
// "Energie-inzet": naam en prijs uit ENERGY_ACTIONS, zodat de lijst nooit een oude prijs toont
if (walkEnergyModeEl){
  for (const opt of walkEnergyModeEl.options){
    const act = ENERGY_ACTIONS[opt.value];
    if (act && opt.value !== 'none'){
      // schuifrail: naam op de rail, prijs met een bliksempje erachter (segmentSelect, 80-controls.js)
      opt.dataset.short = act.name;
      opt.dataset.cost = act.cost;
      opt.textContent = `alleen ${act.name} (${act.cost})`;
    }
  }
}
