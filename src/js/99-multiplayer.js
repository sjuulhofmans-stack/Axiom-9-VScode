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
const mpHostFormEl = document.getElementById('mpHostForm');
const mpHostRoomEl = document.getElementById('mpHostRoom');
const mpJoinFormEl = document.getElementById('mpJoinForm');
const mpJoinWaitingEl = document.getElementById('mpJoinWaiting');
const mpStatusEl = document.getElementById('mpStatus');
const mpHostSeatsEl = document.getElementById('mpHostSeats');
const mpWaitSeatsEl = document.getElementById('mpWaitSeats');
const mpRoomCodeTextEl = document.getElementById('mpRoomCodeText');
// mpChatPanelEl staat NIET hier maar in het const-blok van 97-solo.js — setWalkMode() daar
// leest 'm ook tijdens de allereerste, synchrone setWalkMode('auto')-aanroep bij het laden van
// de pagina (nog vóór dit bestand is uitgevoerd), en zou anders op een TDZ ReferenceError
// stuiten ("Cannot access before initialization"). Zie de toelichting daar.
const mpChatLogEl = document.getElementById('mpChatLog');
const mpChatFormEl = document.getElementById('mpChatForm');
const mpChatInputEl = document.getElementById('mpChatInput');
const mpChatPanelGameEl = document.getElementById('mpChatPanelGame');
const mpChatLogGameEl = document.getElementById('mpChatLogGame');
const mpChatFormGameEl = document.getElementById('mpChatFormGame');
const mpChatInputGameEl = document.getElementById('mpChatInputGame');

// ---------- easter egg: typ "bigdaddy" in de chat (gebruikerswens) ----------
// Zelfde plek/patroon als build_chants() in build.py voor de taunt-mp3's — alleen dan één
// losse afbeelding i.p.v. een genummerde map. src/assets/bigdaddy.b64 is een auto uit een Age
// of Empires-screenshot, met de grasachtergrond eruit geknipt (zie het bouwscript dat dat
// eenmalig deed — de PNG zelf staat al met transparantie in het bestand).
const BIGDADDY_IMG = 'data:image/png;base64,{{BIGDADDY}}';

// Rijdt van linksboven het scherm naar rechts (zie .bigdaddy-car/@keyframes bigDaddyDrive in
// styles.css) — position:fixed op <body>, dus zichtbaar ongeacht welk tabblad open staat.
// Ruimt zichzelf op zodra de animatie afloopt, geen aparte cleanup-timer nodig.
function mpSpawnBigDaddyCar(){
  const img = document.createElement('img');
  img.src = BIGDADDY_IMG;
  img.alt = '';
  img.className = 'bigdaddy-car';
  img.addEventListener('animationend', () => img.remove());
  document.body.appendChild(img);
}

// Puur synthetisch (Web Audio API, geen los geluidsbestand nodig): een paar snelle "crank"-
// schokjes van gefilterde ruis voor de startmotor, gevolgd door een oscillator die optoert en
// vervolgens naar een licht zwevend stationair toerental zakt — twee lichtjes ontstemde
// zaagtandtonen samen geven dat "putt-putt"-motorgeluid i.p.v. één steriele toon. Faalt een
// browser hier stil op (bv. geen AudioContext, of het geluid staat uit) dan speelt de auto
// gewoon geluidloos — dat is geen reden om de rest van de easter egg te laten mislukken.
function mpPlayEngineStart(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);

    const noiseBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.4), ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    for (const dt of [0, 0.09, 0.18, 0.27]){
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass'; bandpass.frequency.value = 220; bandpass.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dt + 0.07);
      src.connect(bandpass).connect(g).connect(master);
      src.start(t0 + dt); src.stop(t0 + dt + 0.08);
    }

    const revStart = t0 + 0.35;
    for (const detune of [0, 3]){   // twee stemmen, 3 cent uit elkaar — lichte zweving
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(60, revStart);
      osc.frequency.linearRampToValueAtTime(160, revStart + 0.35);
      osc.frequency.linearRampToValueAtTime(95, revStart + 0.9);
      osc.frequency.linearRampToValueAtTime(100, revStart + 2.6);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0, revStart);
      oscGain.gain.linearRampToValueAtTime(detune ? 0.25 : 0.5, revStart + 0.1);
      oscGain.gain.setValueAtTime(detune ? 0.25 : 0.5, revStart + 2.2);
      oscGain.gain.linearRampToValueAtTime(0, revStart + 2.8);
      osc.connect(oscGain).connect(master);
      osc.start(revStart); osc.stop(revStart + 2.9);
    }

    setTimeout(() => { try { ctx.close(); } catch (e){} }, 3500);
  } catch (e){}
}

// Eén plek voor "trigger de easter egg" — aangeroepen zowel bij het eigen bericht (meteen) als
// bij een binnenkomend bericht van een ander (mpOnRemoteChat) of eender wie in de chat.
function mpTriggerBigDaddy(){
  mpSpawnBigDaddyCar();
  mpPlayEngineStart();
}

// ---------- easter egg: typ "paintracer" in de chat (gebruikerswens) ----------
// Zelfde patroon als BIGDADDY_IMG hierboven (optioneel, zie read_optional_b64 in build.py:
// ontbreekt een bestand, dan blijft dat plaatje een lege data-URI en tekent de browser
// simpelweg niets — de rest van de app blijft gewoon werken), maar nu TWEE lagen i.p.v. één
// vlakke afbeelding: de carrosserie (wielen eruit gegumd) en één los wiel, dat twee keer wordt
// hergebruikt en zelf ronddraait (zie .partycar-body/.partycar-wheel/@keyframes partycarSpin
// in styles.css voor waarom dat met één platte <img> niet kan — gebruikerswens "wielen moeten
// draaien").
const PARTYCAR_BODY_IMG = 'data:image/png;base64,{{PARTYCAR_BODY}}';
const PARTYCAR_WHEEL_IMG = 'data:image/png;base64,{{PARTYCAR_WHEEL}}';
// Het geluid hergebruikt de BESTAANDE taunt-infrastructuur (06-chants.js/build_chants() in
// build.py) i.p.v. een eigen mechanisme: playChant() zoekt toch al op in CHANT_AUDIO, en die
// tabel accepteert sinds build_chants() nu ook namen (niet alleen taunt-nummers) gewoon de
// sleutel 'paintracer' — zet src/assets/chants/paintracer.mp3 (of .ogg/.wav) neer en het
// geluid speelt vanzelf mee, zonder dat hier iets aan hoeft te veranderen. playChant() geeft
// tegenwoordig het Audio-element terug (i.p.v. alleen true/false), zodat mpTriggerPaintracer
// hieronder het weer kan stoppen zodra de laatste rit voorbij is (gebruikerswens).
const PARTYCAR_PASSES = 4;   // 1x + "nog 3 keer" (gebruikerswens), zie mpSpawnPartycar

// Rijdt van links naar rechts met een op-en-neer-wiebel (partycarDrive + partycarBob, samen op
// de omhullende .partycar-car-div in styles.css — zie de toelichting daar) en herhaalt zichzelf
// na aankomst nog PARTYCAR_PASSES-1 keer, telkens op een nieuwe, willekeurige hoogte ("op een
// andere locatie", gebruikerswens) — vandaar dat dit een nieuw element per rit spawnt i.p.v.
// één keer een CSS-animatie te laten loopen: alleen zo verspringt de hoogte ook echt bij elke
// doorgang. `audio` reist mee door de recursie zodat alleen de ALLERLAATSTE rit 'm stopt, niet
// elke tussenliggende. `e.animationName`-check negeert de partycarBob/-Spin-tikken (die zijn
// `infinite` en vuren sowieso nooit een animationend, maar expliciet checken is duidelijker dan
// op die aanname leunen).
function mpSpawnPartycar(passesLeft, audio){
  const wrap = document.createElement('div');
  wrap.className = 'partycar-car';
  wrap.style.top = `${20 + Math.random() * 55}%`;
  wrap.innerHTML =
    `<img class="partycar-body" src="${PARTYCAR_BODY_IMG}" alt="">` +
    `<img class="partycar-wheel" src="${PARTYCAR_WHEEL_IMG}" alt="">` +
    `<img class="partycar-wheel is-rear" src="${PARTYCAR_WHEEL_IMG}" alt="">`;
  wrap.addEventListener('animationend', (e) => {
    if (e.animationName !== 'partycarDrive') return;
    wrap.remove();
    if (passesLeft > 1){
      mpSpawnPartycar(passesLeft - 1, audio);
    } else if (audio){
      try { audio.pause(); audio.currentTime = 0; } catch (err){}
    }
  });
  document.body.appendChild(wrap);
}
function mpTriggerPaintracer(){
  const audio = playChant('paintracer');   // null als het bestand (nog) ontbreekt
  mpSpawnPartycar(PARTYCAR_PASSES, audio);
}

// ---------- easter egg: typ "kaboem" in de chat (gebruikerswens) ----------
// Zelfde OPTIONELE-asset-patroon als BIGDADDY_IMG/PARTYCAR_*_IMG hierboven — ontbreekt
// src/assets/kaboem.b64, dan blijft dit een lege data-URI en doet de easter egg simpelweg
// niets zichtbaars (het geluid speelt dan nog wel, want dat hangt er niet van af).
const KABOEM_IMG = 'data:image/png;base64,{{KABOEM}}';
const KABOEM_COUNTDOWN_MS = 5000;   // "een timergeluid van 5 seconden" (gebruikerswens)

// Drie fases: plaatje tonen + 5s aftellen (mpPlayKaboemTimer), dan ontploffen (mpExplodeImage +
// mpPlayExplosionBoom), dan de gedimde achtergrond laten wegfaden. `img` blijft na het
// onzichtbaar maken gewoon bestaan als losstaand element — drawImage() in mpExplodeImage heeft
// alleen een GELADEN <img> nodig, niet eentje die nog in de DOM zit.
function mpTriggerKaboem(){
  const overlay = document.createElement('div');
  overlay.className = 'kaboem-overlay';
  const img = document.createElement('img');
  img.className = 'kaboem-img';
  img.src = KABOEM_IMG;
  img.alt = '';
  overlay.appendChild(img);
  document.body.appendChild(overlay);

  mpPlayKaboemTimer();

  setTimeout(() => {
    img.style.visibility = 'hidden';
    mpPlayExplosionBoom();
    mpExplodeImage(img, () => {
      overlay.classList.add('kaboem-fade-out');
      setTimeout(() => overlay.remove(), 500);
    });
  }, KABOEM_COUNTDOWN_MS);
}

// Vijf korte "ticks", oplopend in toonhoogte (bouwt spanning op), precies over de 5 seconden
// verdeeld — allemaal vooraf ingepland op ÉÉN AudioContext-klok i.p.v. met setInterval om ze
// één voor één te starten, want dat laatste kan wegdriften t.o.v. de (wél exacte) setTimeout
// hierboven die de explosie zelf op precies 5000ms triggert.
function mpPlayKaboemTimer(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime;
    for (let i = 0; i < 5; i++){
      const at = t0 + i;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 820 + i * 60;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.25, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
      osc.connect(g).connect(ctx.destination);
      osc.start(at); osc.stop(at + 0.1);
    }
    setTimeout(() => { try { ctx.close(); } catch (e){} }, 5300);
  } catch (e){}
}

// Puur synthetisch (zelfde aanpak als mpPlayEngineStart hierboven): een sub-bass "thud" die
// snel in toonhoogte zakt, plus een ruisknal door een lowpass-filter dat dichtklapt — samen
// geven die de klassieke "boem" (lage dreun + krakende knal), zonder dat er een los
// geluidsbestand voor nodig is.
function mpPlayExplosionBoom(){
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, t0);
    thud.frequency.exponentialRampToValueAtTime(35, t0 + 0.35);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(1, t0);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    thud.connect(thudGain).connect(master);
    thud.start(t0); thud.stop(t0 + 1);

    const noiseBuf = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.8), ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4000, t0);
    lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.7);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.8);
    noise.connect(lp).connect(noiseGain).connect(master);
    noise.start(t0); noise.stop(t0 + 0.8);

    setTimeout(() => { try { ctx.close(); } catch (e){} }, 1500);
  } catch (e){}
}

// Knipt de afbeelding in een raster van stukjes en laat ze met zwaartekracht + rotatie vanuit
// het midden uiteenspatten, getekend op een los canvas boven alles — CSS kan een <img> niet in
// scherven knippen die onafhankelijk van elkaar bewegen, canvas wel (elk stukje is gewoon een
// eigen drawImage() met een eigen stukje van de bron als "source rect"). Roept `onDone` aan
// zodra alle stukjes weggefaded zijn, zodat de overlay daarna pas zelf opruimt.
function mpExplodeImage(imgEl, onDone){
  if (!imgEl.complete || !imgEl.naturalWidth){ if (onDone) onDone(); return; }
  const rect = imgEl.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.className = 'kaboem-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const cols = 6, rows = 9;
  const pieceW = rect.width / cols, pieceH = rect.height / rows;
  const srcPieceW = imgEl.naturalWidth / cols, srcPieceH = imgEl.naturalHeight / rows;
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

  const pieces = [];
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const px = rect.left + c * pieceW + pieceW / 2;
      const py = rect.top + r * pieceH + pieceH / 2;
      const dx = px - cx, dy = py - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 240 + Math.random() * 260;
      pieces.push({
        sx: c * srcPieceW, sy: r * srcPieceH, sw: srcPieceW, sh: srcPieceH,
        x: px, y: py,
        vx: (dx / dist) * speed + (Math.random() - 0.5) * 120,
        vy: (dy / dist) * speed + (Math.random() - 0.5) * 120 - 140,   // lichte knal omhoog
        rot: 0, vrot: (Math.random() - 0.5) * 8,
      });
    }
  }

  const duration = 1.3;   // seconden tot alle stukjes helemaal vervaagd zijn
  let last = null, start = null;
  function frame(ts){
    if (start === null) start = ts;
    const dt = Math.min(0.05, last === null ? 0 : (ts - last) / 1000);
    last = ts;
    const elapsed = (ts - start) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = Math.max(0, 1 - elapsed / duration);
    for (const p of pieces){
      p.vy += 700 * dt;   // zwaartekracht
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(imgEl, p.sx, p.sy, p.sw, p.sh, -pieceW / 2, -pieceH / 2, pieceW, pieceH);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else { canvas.remove(); if (onDone) onDone(); }
  }
  requestAnimationFrame(frame);
}

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
  const names = ['hello', 'lobby', 'start', 'state', 'leave', 'intent', 'stop', 'chat', 'intro', 'botturn', 'avatar'];
  mp.actions = {};
  for (const n of names) mp.actions[n] = room.makeAction(n);

  mp.actions.hello.onMessage = (data, { peerId }) => { if (mp.isHost) mpHostOnHello(peerId, data); };
  mp.actions.lobby.onMessage = (data) => { if (!mp.isHost) mpClientOnLobby(data); };
  // chat gaat NIET via de host — Trystero verbindt alle peers rechtstreeks met elkaar (mesh),
  // dus dit bericht komt toch al bij iedereen aan; geen reden om het via de scheidsrechter te
  // laten lopen zoals de spellogica (mp.actions.intent) dat wel moet vanwege de seeded RNG.
  mp.actions.chat.onMessage = (data, { peerId }) => mpOnRemoteChat(peerId, data);
  mp.actions.start.onMessage = (data) => { if (!mp.isHost) mpClientOnStart(data); };
  mp.actions.state.onMessage = (data) => { if (!mp.isHost) mpApplyState(data); };
  mp.actions.botturn.onMessage = (data) => { if (!mp.isHost && mp.phase === 'in-game') mpClientOnBotTurn(data); };
  // een gast koos een (andere) avatar in de lobby: de host zet 'm bij zijn plek en stuurt de lijst rond
  mp.actions.avatar.onMessage = (data, { peerId }) => {
    if (!mp.isHost) return;
    const seat = mp.seats.find(s => s.peerId === peerId);
    if (!seat) return;
    seat.avatar = avatarClean(data && data.avatar);
    mpBroadcastLobby();
    mpRenderHostSeats();
  };
  mp.actions.intent.onMessage = (data, { peerId }) => { if (mp.isHost) mpHandleIntent(peerId, data); };
  mp.actions.leave.onMessage = (data, { peerId }) => {
    // een 'leave' MET reden is een weigering van de host aan ons (naam bezet / kamer vol) —
    // alleen de host stuurt die, en alleen zolang wij nog aan het aanmelden zijn
    if (!mp.isHost && mp.phase === 'joining' && data && data.reason){ mpJoinRejected(data); return; }
    mpOnPeerLeave(peerId, true);
  };
  // host stopt het lopende potje bewust (zie btnMpLeaveGame) terwijl de room open blijft —
  // anders dan 'leave' verlaat niemand de room hierbij, gasten gaan terug naar de wachtkamer.
  mp.actions.stop.onMessage = () => { if (!mp.isHost) mpClientOnStop(); };
  // de host start het potje met de startanimatie (96b-intro.js): iedereen speelt hem tegelijk
  // af; het potje zelf ('start') komt pas zodra de animatie bij de host klaar is
  mp.actions.intro.onMessage = () => { if (!mp.isHost && mp.phase === 'joining') playStartIntro(() => {}); };

  // room.onPeerJoin vuurt pas zodra de WebRTC-datachannel naar die peer daadwerkelijk klaar is
  // (dat kan een paar seconden na joinRoom() duren, via de signaling-relay) — een 'hello' die je
  // daarvóór al verstuurt, verdwijnt dus in het niets. Zelfherstellend: (opnieuw) versturen zodra
  // er echt een verbinding tot stand komt, niet meteen na het aanroepen van joinRoom().
  room.onPeerJoin = (peerId) => {
    if (mp.room !== room) return;   // oude room van een herverbinding (mpJoinReconnect)
    if (mp.isHost) mpHostOnPeerJoin(peerId);
    else if (mp.pendingName !== null) mp.actions.hello.send(mpHelloPayload());
  };
  room.onPeerLeave = (peerId) => { if (mp.room === room) mpOnPeerLeave(peerId, false); };
}

// ---------- host: lobby ----------
async function mpHostCreate(){
  // Naam is verplicht (gebruikerswens) — voorheen viel een leeg veld stil terug op "Speler 1",
  // waardoor medespelers je nooit bij je eigen naam zagen. Rood veld + foutmelding, zelfde
  // patroon als de spelcode-check in mpJoinConnect() hieronder (mpSetStatus(..., 'bad')), plus
  // .mp-field-invalid (styles.css) voor de rode rand rond het veld zelf.
  const nameInput = document.getElementById('mpHostName');
  const name = soloCleanName(nameInput.value);
  if (!name){
    nameInput.classList.add('mp-field-invalid');
    mpSetStatus('Vul eerst je naam in.', 'bad');
    nameInput.focus();
    return;
  }
  nameInput.classList.remove('mp-field-invalid');
  mp.totalSeats = Math.max(2, Math.min(WALK_MAX_PLAYERS, parseInt(document.getElementById('mpHostTotal').value, 10) || 4));
  mp.fillBots = document.getElementById('mpHostFillBots').value === 'bots';
  const botView = document.getElementById('mpHostBotView');
  mp.botViewSpeed = !botView || botView.value === 'instant' ? null : (parseInt(botView.value, 10) || 2);
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
  mp.seats = [{ peerId: mp.myPeerId, name, isHost: true, avatar: avatarMine }];
  mpRoomCodeTextEl.textContent = code;
  // rechtstreekse DOM-aanpassing i.p.v. de volledige mpRenderLobby() — vandaar dat #mpHostForm
  // (naam/spelersaantal/bots + Aanmaken/Terug, geen functie meer zodra de kamer bestaat) hier
  // ook expliciet mee moet, anders blijft-ie hangen boven #mpHostRoom en duwt "Spel starten"/
  // "Spel afbreken" straks onder de rand van de niet-scrollende infokolom uit
  // (gebruikersmelding: "niet te zien en te lezen").
  if (mpHostFormEl) mpHostFormEl.hidden = true;
  mpHostRoomEl.hidden = false;
  mpShowRoomCols(true);
  mpSetStatus('', '');
  mpRenderHostSeats();
}
// vergelijkingssleutel voor namen: hoofdletterongevoelig, spaties genormaliseerd
function mpNameKey(name){ return soloCleanName(name || '').toLowerCase(); }
function mpHostOnHello(peerId, data){
  // al binnen (herhaalde 'hello' van mpJoinWatchdog): kennelijk mist hij de lijst nog — stuur 'm opnieuw
  if (mp.seats.some(s => s.peerId === peerId)){ mpHostOnPeerJoin(peerId); return; }
  if (mp.seats.length >= mp.totalSeats){
    mp.actions.leave.send({ reason: 'vol' }, peerId);
    return;
  }
  // Naam moet uniek zijn in de kamer (gebruikerswens) — hoofdletters en spaties tellen niet,
  // "Anna" en " anna " zijn dus dezelfde. Wie een bezette naam kiest wordt geweigerd en kiest
  // aan zijn kant een andere (zie mpJoinRejected). Geen naam ingevuld: de host kiest zelf een
  // vrije "Speler N", zodat twee lege namen elkaar niet blokkeren.
  const taken = new Set(mp.seats.map(s => mpNameKey(s.name)));
  let name = soloCleanName((data && data.name) || '');
  if (name && taken.has(mpNameKey(name))){
    mp.actions.leave.send({ reason: 'naam', name }, peerId);
    return;
  }
  if (!name){
    for (let n = mp.seats.length + 1; ; n++){
      if (!taken.has(mpNameKey(`Speler ${n}`))){ name = `Speler ${n}`; break; }
    }
  }
  // geen startpositie in de lobby: die kiest iedereen pas aan het begin van het potje, in de
  // volgorde van de worp (soloBeginOpening in 97-solo.js)
  mp.seats.push({ peerId, name, isHost: false, avatar: avatarClean(data && data.avatar) });
  mpBroadcastLobby();
  mpRenderHostSeats();
}
function mpHostOnPeerJoin(peerId){
  // we wachten op hun 'hello' met gekozen naam vóórdat we ze aan de lobby toevoegen (zie
  // mpHostOnHello) — maar de huidige spelerslijst krijgen ze meteen, zodat een gast direct
  // weet dat de verbinding met de host er is (mp.gotLobby, zie mpJoinWatchdog)
  if (mp.phase === 'hosting' && mp.actions)
    mp.actions.lobby.send({ seats: mp.seats, totalSeats: mp.totalSeats, fillBots: mp.fillBots }, peerId);
}
function mpBroadcastLobby(){
  if (!mp.isHost || !mp.actions) return;
  mp.actions.lobby.send({ seats: mp.seats, totalSeats: mp.totalSeats, fillBots: mp.fillBots });
}
// ---------- avatars in de kamer (tekeningen + editor: 98b-avatar.js) ----------
function mpHelloPayload(){ return { name: mp.pendingName, avatar: avatarMine }; }
function mpRenderAvatarRow(){
  const el = document.getElementById('mpAvatarRow');
  if (el) el.innerHTML = avatarRowHtml(mp.seats || [], mp.totalSeats, mp.myPeerId);
}
// de middelste (avatars + chat) en rechter (editor) kolom horen alleen bij een bestaande kamer
function mpShowRoomCols(on){
  if (mpChatPanelEl) mpChatPanelEl.hidden = !on;
  const mid = document.getElementById('mpMidCol'), ed = document.getElementById('mpAvatarEditor');
  if (mid) mid.hidden = !on;
  if (ed) ed.hidden = !on;
  if (on){ mpRenderAvatarRow(); avatarRenderEditor(); }
}
// aangeroepen door avatarSetMine (98b-avatar.js) zodra je in de editor iets kiest
function mpOnMyAvatarChanged(){
  if (!mp.active || !mp.actions) return;
  const seat = mp.seats.find(s => s.peerId === mp.myPeerId);
  if (mp.isHost){
    if (seat) seat.avatar = avatarMine;
    mpBroadcastLobby();
    mpRenderHostSeats();
  } else {
    if (seat){ seat.avatar = avatarMine; mpRenderAvatarRow(); }   // meteen zichtbaar, de host bevestigt
    try { mp.actions.avatar.send({ avatar: avatarMine }); } catch (e){}
  }
}

function mpRenderHostSeats(){
  if (!mpHostSeatsEl) return;
  mpSetSeatsHtml(mpHostSeatsEl, mpSeatRowsHtml(mp.seats, mp.totalSeats));
  mpRenderAvatarRow();
  const btn = document.getElementById('btnMpHostStart');
  if (btn) btn.disabled = mp.seats.length < 1 || (!mp.fillBots && mp.seats.length < mp.totalSeats);
}
// Eén vak per plek in de kamer (gebruikerswens: je moet zien voor hoeveel spelers het potje
// is): bezette plek = naam (+ "Host" rechts), lege plek = "Wachten op speler" waarvan de letters
// één voor één van links naar rechts uit- en weer infaden. Host en gasten zien precies hetzelfde.
function mpSeatRowsHtml(seats, total){
  const rows = [];
  for (let i = 0; i < Math.max(total || 0, seats.length); i++){
    const seat = seats[i];
    const color = WALK_PLAYER_COLORS[i % WALK_PLAYER_COLORS.length];
    if (seat){
      const you = seat.peerId === mp.myPeerId;
      rows.push(`<div class="mp-seat" style="--pc:${color}">` +
        `<span class="mp-seat-dot"></span>` +
        `<span class="mp-seat-name">${seat.name}${you ? ' <i>(jij)</i>' : ''}</span>` +
        (seat.isHost ? `<span class="mp-seat-tag">Host</span>` : '') +
      `</div>`);
    } else {
      rows.push(`<div class="mp-seat is-empty" style="--pc:${color}">` +
        `<span class="mp-seat-dot"></span><span class="mp-seat-name">${mpWaveText('Wachten op speler')}</span></div>`);
    }
  }
  return rows.join('');
}
// alleen herschrijven als er echt iets aan de plekken verandert — anders begon de golf van
// "Wachten op speler" opnieuw bij elke lobby-update (bv. iemand kiest een andere avatar)
function mpSetSeatsHtml(el, html){
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}
// tekst als losse letters met een oplopende vertraging (.mp-wave in styles.css)
function mpWaveText(text){
  return `<span class="mp-wave">${[...text].map((ch, k) =>
    `<i style="--k:${k}">${ch === ' ' ? '&nbsp;' : ch}</i>`).join('')}</span>`;
}

// ---------- statusbalk onderaan de wachtkamer van een gast ----------
// Niet vol → "Wachten op spelers" (golvend). Vol → "Host moet het spel starten". Start de host
// na 10 s nog steeds niet, dan wordt de balk klikbaar: "Stuur host herinnering" → taunt 14 voor
// iedereen (via de chat, mpSendChatMessage), daarna 5 s afkoelen met aftellen in de balk.
const MP_REMIND_AFTER_MS = 10000, MP_REMIND_COOLDOWN_MS = 5000;
let mpFullSince = null, mpRemindReadyAt = 0, mpWaitTimer = null;
function mpUpdateWaitStatus(){
  const el = document.getElementById('mpWaitStatus');
  if (!el) return;
  if (mp.phase !== 'joining'){ clearInterval(mpWaitTimer); mpWaitTimer = null; mpFullSince = null; return; }
  // (weer) in de wachtkamer, bv. na een potje: de klok loopt vanzelf opnieuw
  if (!mpWaitTimer) mpWaitTimer = setInterval(mpUpdateWaitStatus, 250);
  mpJoinWatchdog();
  const seated = mp.seats.some(s => s.peerId === mp.myPeerId);
  const full = mp.totalSeats > 0 && mp.seats.length >= mp.totalSeats;
  const now = Date.now();
  let state, html, ready = false;
  if (!seated){
    mpFullSince = null;
    state = 'connecting'; html = mpWaveText('Verbinden met de host…');
  } else if (!full){
    mpFullSince = null;
    state = 'waiting'; html = mpWaveText('Wachten op spelers');
  } else {
    if (mpFullSince === null) mpFullSince = now;
    if (now - mpFullSince < MP_REMIND_AFTER_MS){
      state = 'full'; html = 'Host moet het spel starten';
    } else if (now < mpRemindReadyAt){
      const s = Math.ceil((mpRemindReadyAt - now) / 1000);
      state = 'cool' + s; html = `Herinnering verstuurd — opnieuw over ${s} s`;
    } else {
      state = 'ready'; html = '🔔 Stuur host herinnering'; ready = true;
    }
  }
  // alleen herschrijven als er iets verandert, anders begint de golf telkens opnieuw
  if (el.dataset.state !== state){ el.dataset.state = state; el.innerHTML = html; }
  el.disabled = !ready;
  el.classList.toggle('is-ready', ready);
}
function mpStartWaitTimer(){
  clearInterval(mpWaitTimer); mpWaitTimer = null;
  mpFullSince = null; mpRemindReadyAt = 0;
  mpUpdateWaitStatus();   // start zelf de klok (zie hierboven)
}

// ---------- gast: verbinding met de host bewaken ----------
// Gebruikersmelding: bij 4 tabs (host + 3 gasten) kwam de laatste gast wel in de wachtkamer,
// maar zag niemand en niemand zag hem — de WebRTC-verbinding met de host kwam nooit tot stand
// (of zijn 'hello' ging verloren), en dan gebeurde er nooit meer iets. Nu: zolang we niet in de
// spelerslijst staan elke 2 s opnieuw 'hello'; en hebben we na 12 s nog nooit iets van de host
// gehoord (geen 'lobby'), dan verlaten we de room en verbinden opnieuw.
const MP_HELLO_RETRY_MS = 2000, MP_RECONNECT_AFTER_MS = 12000;
function mpJoinWatchdog(){
  if (mp.phase !== 'joining' || !mp.actions || mp.reconnecting) return;
  if (mp.seats.some(s => s.peerId === mp.myPeerId)) return;
  const now = Date.now();
  if (!mp.gotLobby && now - (mp.connectAt || now) > MP_RECONNECT_AFTER_MS){ mpJoinReconnect(); return; }
  if (now - (mp.helloAt || 0) > MP_HELLO_RETRY_MS){
    mp.helloAt = now;
    try { mp.actions.hello.send(mpHelloPayload()); } catch (e){}
  }
}
async function mpJoinReconnect(){
  const session = mp, code = mp.roomCode;
  session.reconnecting = true;
  try { session.room.leave(); } catch (e){}
  try { await mpConnect(code); } catch (e){}
  if (mp !== session || mp.phase !== 'joining'){
    // intussen zelf vertrokken (mpTeardown maakte een nieuw mp-object): die verse room weer dicht
    try { if (mp.room) mp.room.leave(); } catch (e){}
    mp.room = null; mp.actions = null; mp.roomCode = null;
    return;
  }
  session.reconnecting = false;
  session.connectAt = Date.now();
  session.helloAt = 0;
  mpJoinWatchdog();
}
{
  const el = document.getElementById('mpWaitStatus');
  if (el) el.addEventListener('click', () => {
    if (el.disabled || mp.phase !== 'joining') return;
    mpSendChatMessage('14');   // taunt 14, hoorbaar voor iedereen in de kamer
    mpRemindReadyAt = Date.now() + MP_REMIND_COOLDOWN_MS;
    mpUpdateWaitStatus();
  });
}

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
  // leeg mag: de host kiest dan zelf een vrije "Speler N" (zie mpHostOnHello) — voorheen werd
  // dat hier "Speler", waardoor een tweede gast zonder naam als dubbele naam geweigerd zou worden
  mp.pendingName = name;
  mp.connectAt = mp.helloAt = Date.now(); mp.gotLobby = false;
  mp.actions.hello.send(mpHelloPayload());   // meteen proberen; onPeerJoin herhaalt 'm zodra de verbinding er echt is
  mpRenderLobby();   // keuze + formulier weg, wachtkamer + chat erbij
  mpSetStatus('', '');
  const codeEl = document.getElementById('mpWaitCodeText');
  if (codeEl) codeEl.textContent = code;
  if (mpWaitSeatsEl) mpSetSeatsHtml(mpWaitSeatsEl, '');
  mpStartWaitTimer();
}
function mpClientOnLobby(data){
  mp.gotLobby = true;
  mp.seats = data.seats;
  mp.totalSeats = data.totalSeats;
  mp.fillBots = data.fillBots;
  // de host-rij staat er altijd bij (isHost:true) — zo kent een client het host-peerId al
  // vóórdat het potje start, nodig om straks een écht vertrek van de host te herkennen
  // (zie mpOnPeerLeave) i.p.v. elke vertrekkende medespeler daarvoor aan te zien.
  const hostSeat = mp.seats.find(s => s.isHost);
  if (hostSeat) mp.hostPeerId = hostSeat.peerId;
  if (mpWaitSeatsEl) mpSetSeatsHtml(mpWaitSeatsEl, mpSeatRowsHtml(mp.seats, mp.totalSeats));
  mpRenderAvatarRow();
  mpUpdateWaitStatus();
}
function mpJoinLeave(){
  mpTeardown();
  mpRenderLobby();
}
// De host weigerde ons (zie mpHostOnHello): verbinding netjes verbreken en terug naar het
// deelnameformulier, met de spelcode nog ingevuld. Voorheen werd een weigering ('vol') hier
// genegeerd en bleef je eindeloos op "wachten op de host" staan.
function mpJoinRejected(data){
  mpTeardown();
  mp.phase = 'join-form';
  mpRenderLobby();
  const nameInput = document.getElementById('mpJoinName');
  if (data.reason === 'naam'){
    mpSetStatus(`De naam "${mpEscapeHtml(data.name || '')}" is al bezet in deze kamer — kies een andere naam.`, 'bad');
    if (nameInput){ nameInput.classList.add('mp-field-invalid'); nameInput.focus(); nameInput.select(); }
  } else if (data.reason === 'vol'){
    mpSetStatus('Deze kamer is al vol.', 'bad');
  } else {
    mpSetStatus('De host heeft je niet toegelaten.', 'bad');
  }
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
  mpShowRoomCols(false);
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
    p.strategy = 'smart';   // zelfde slimme bot als de andere bots in het potje
    walkLog(`${p.name} heeft de verbinding verloren — wordt vanaf nu automatisch bestuurd.`, null, p);
    // als hij net zelf aan zet was (soloActiveIdx) en op interactie stond te wachten, is er
    // geen halve-beurt-hervatting: gewoon opnieuw door de lus, die ziet 'm nu als bot.
    if (soloPlayers[soloActiveIdx] === p && soloPhase !== 'game-over'){
      if (soloOpening){
        // weg tijdens het dobbelen/kiezen aan het begin: dezelfde stap opnieuw, nu als bot
        soloOpeningStep();
      } else {
        soloActiveIdx = -1;
        soloAdvanceLoop();
      }
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
    // geen switchTab meer nodig — multiplayer heeft geen eigen tabblad, je zit al op "Zelf
    // spelen" (mpExitPlayView() zet die modus daar via setWalkMode('multi') ook meteen goed)
    mpExitPlayView();
    mpTeardown();
    mpRenderLobby();
  }
}

// ---------- host: potje starten ----------
// knop "Spel starten": eerst (als die aan staat) de startanimatie bij iedereen, dan pas het potje.
// Het bord eerst controleren, anders zag je de hele animatie en daarna pas de foutmelding.
function mpHostStartClick(){
  if (introRunning) return;
  const err = walkLobbyValidate();
  if (err){ mpSetStatus(err, 'bad'); return; }
  if (introEnabled()){
    if (mp.actions && mp.actions.intro) mp.actions.intro.send({});
    // alleen starten als de kamer er na de animatie nog is (niet intussen afgebroken)
    playStartIntro(() => { if (mp.isHost && mp.phase === 'hosting') mpHostStartGame(); });
  } else {
    mpHostStartGame();
  }
}
function mpHostStartGame(){
  const total = mp.totalSeats;
  const humans = mp.seats.slice(0, total);
  const soloSeedRand = mulberry32(Math.floor(Math.random() * 4294967296));
  const players = [];
  // bots krijgen een toffe naam (pickBotNames, 96-walk.js) — nooit hetzelfde als een mens in de
  // kamer, anders stonden er twee spelers met dezelfde naam in het potje
  const botNames = pickBotNames(Math.max(0, total - humans.length), humans.map(s => s.name));
  const botName = (i) => botNames[i - humans.length];
  for (let i = 0; i < total; i++){
    const seat = humans[i];
    const isHuman = !!seat;
    players.push({
      idx: i, isHuman,
      name: isHuman ? seat.name : botName(i),
      color: WALK_PLAYER_COLORS[i],
      deck: simShuffle(SIM_QUEST_LABELS, soloSeedRand),
      // myTurn: eigen beurtenteller (zie soloBeginHumanTurn/soloResolveBotTurn) — ontbrak hier,
      // waardoor "beurt" en "wint in N beurten" in multiplayer NaN werden
      nextIdx: 0, completed: 0, myTurn: 0, energy: 0, cards: [], rank: 0, doneCells: [],
      condenserPending: false, lockedNextTurn: false, rollPenalty: 0, barrierCell: null,
      reorderBlocked: false, lastDir: -1,
      // bots denken zelf na welke energie-actie nu slim is, of sparen (botStrategyNow, 95-simulate.js)
      strategy: isHuman ? null : 'smart',
      // startpositie en beurtvolgorde volgen uit het dobbelen aan het begin (soloBeginOpening);
      // tot je mag kiezen is je opdracht geheim, ook in wat er naar de anderen gaat (mpPublicPlayer)
      startLabel: null, questHidden: true,
      pos: null, skipEnergyRoll: false, actionUses: 0,
      stats: newPlayerStats(),   // voor de knop "Statistieken" op het winscherm (gaat mee naar de gasten)
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
  soloGraph = graph;
  // lobby-keuze "Beurten van de bots" (mpHostBotView); gasten spelen die beurten na via mpOnBotReplay
  soloBotViewSpeed = mp.botViewSpeed === undefined ? null : mp.botViewSpeed;
  soloPlayers = players;
  soloSetupRand = soloSeedRand;
  soloRand = soloSeedRand;
  soloTurnOrder = players.map(p => p.idx);   // voorlopig; soloFinishOpening zet de echte volgorde
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
  // de "X start op …"-regels volgen pas na het kiezen (soloLogGameStart, via soloFinishOpening)

  mp.actions.start.send({
    layout: layout.slice(),
    players: mpPublicPlayers(soloPlayers),
    turnOrder: soloTurnOrder,
    finishTarget: soloFinishTarget,
  });

  mp.lastFingerprint = null;
  mp.broadcastTimer = setInterval(mpBroadcastTick, 200);
  soloBeginOpening();   // eerst dobbelen wie begint + startposities kiezen, daarna het potje zelf
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
  mpSyncTurnOwner();
}
// Is een ander aan zet, dan hoort je eigen scherm geen dobbelknop/energie-acties/klikbare
// vakjes te tonen (gebruikersmelding: "je ziet dat je kan dobbelen terwijl je niet aan de beurt
// bent"). Bij de host stonden die er wél: zijn DOM is de bron die naar de gast gaat
// (mpBroadcastState leest .hidden/innerHTML), dus daar mogen we niets aan veranderen — vandaar
// alleen een klasse op het speelscherm die het met CSS verbergt (.mp-not-my-turn in styles.css),
// en een rustige melding wie er aan zet is. Geldt voor host én gast.
function mpSyncTurnOwner(){
  const area = walkPlayAreaEl, note = document.getElementById('mpWaitTurn');
  const active = soloPlayers && soloPlayers[mpReplayIdx >= 0 ? mpReplayIdx : soloActiveIdx];
  const inGame = mp.active && mp.phase === 'in-game' && soloPhase !== 'game-over' && !soloOpening;
  const notMine = inGame && !!active && active.peerId !== mp.myPeerId;
  if (area) area.classList.toggle('mp-not-my-turn', notMine);
  if (note){
    note.hidden = !notMine;
    if (notMine){
      note.style.setProperty('--pc', active.color);
      note.innerHTML = `<b>${active.name}</b> is aan zet${active.isHuman ? '' : ' (bot)'} — even wachten…`;
    }
  }
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
  // questHidden: tijdens het dobbelen aan het begin is zelfs je huidige doel nog geheim
  // (soloBeginOpening in 97-solo.js) — dan gaat er helemaal niets van je stapel mee
  if (p.nextIdx < p.deck.length && !p.questHidden) deck[p.nextIdx] = p.deck[p.nextIdx];
  return { ...p, deck };
}
function mpPublicPlayers(players){ return players.map(mpPublicPlayer); }
// soloDeck.draw/.discard zijn de trekstapel/aflegstapel-VOLGORDE — client-code heeft daar
// nooit meer dan de lengte van nodig (zie soloCardBlockReason: 'de trekstapel is leeg' etc.),
// dus die volgorde/inhoud wordt hier nooit meegestuurd.
function mpPublicDeck(deck){
  return { draw: { length: deck.draw.length }, discard: { length: deck.discard.length } };
}

// ---------- bot-beurten zichtbaar naspelen (lobby-keuze "Beurten van de bots") ----------
// De host speelt een bot-beurt af met soloAnimateBotTurn (97-solo.js). Gewoon de stand elke
// 200 ms uitzenden zou de pion bij de gasten met horten en stoten laten verspringen, en de
// score/log alvast op het eindresultaat zetten. Daarom: tijdens 'bots' zendt de host géén stand
// (zie mpBroadcastState) maar één 'botturn'-bericht per beurt, en elke gast speelt diezelfde
// animatie zelf af. De logregels van die beurt gaan mee in dat bericht en worden bij de host
// gemarkeerd (data-mp-sent), zodat de eerstvolgende gewone uitzending ze niet nog eens stuurt.
let mpReplayIdx = -1;          // wie er nu (bot) zichtbaar loopt — voor de "X is aan zet"-melding
let mpGuestReplay = null;      // gast: { runId, logNodes, done }
let mpTrailClearedTurn = -1;
function mpOnBotReplay(player, replay, logNodes){
  // logregels van vlak daarvoor (bv. het einde van de beurt van een mens) zijn nog niet
  // uitgezonden — er zat geen tick tussen — dus die gaan hier eerst mee, in de goede volgorde
  const pending = [...walkLogEl.children].slice(mp.lastLogCount).filter(el => !el.dataset.mpSent);
  for (const n of pending) n.dataset.mpSent = '1';
  for (const n of logNodes) n.dataset.mpSent = '1';
  mpReplayIdx = player.idx;
  mpSyncTurnOwner();
  if (!mp.actions || !mp.actions.botturn) return;
  // alleen de opdrachten die deze beurt echt gehaald worden + de volgende (die wordt toch het
  // nieuwe, publieke doel) — de rest van de stapel van de bot blijft geheim, net als in mpPublicPlayer
  let r = replay;
  if (replay.bank && replay.bank.seq){
    const keep = (replay.preBanked || 0) + (replay.rollBanked || 0) + 1;
    r = { ...replay, bank: { ...replay.bank, seq: replay.bank.seq.slice(0, keep) } };
  }
  mp.actions.botturn.send({
    idx: player.idx, replay: r, speed: soloBotViewSpeed, turn: soloTurn,
    before: mpPublicPlayers(replayScoreBefore || soloPlayers),
    after: mpPublicPlayers(soloPlayers),
    logsBefore: pending.map(el => ({ html: el.innerHTML, cls: el.className })),
    logs: logNodes.map(el => ({ html: el.innerHTML, cls: el.className })),
  });
}
function mpClientOnBotTurn(data){
  mpGuestFinishReplay();   // vorige nog bezig (kleine vertraging)? die meteen afronden
  soloPlayers = data.after;
  soloTurn = data.turn;
  soloBotViewSpeed = data.speed;
  replayScoreBefore = data.before;
  const player = soloPlayers[data.idx];
  if (!player) return;
  const mkLine = line => {
    const div = document.createElement('div');
    div.className = line.cls || '';
    div.innerHTML = line.html;
    return div;
  };
  for (const line of data.logsBefore || []) walkLogEl.appendChild(mkLine(line));
  const logNodes = (data.logs || []).map(mkLine);
  // begint de eerste bot-beurt meteen na het kiezen van de startposities, dan zat daar geen
  // uitzending tussen en stond bij de gast het kiespaneel nog open
  if (soloOpening){ soloOpening = null; walkSetOpeningMode(false); }
  soloRunId++;
  const job = { runId: soloRunId, logNodes, done: false };
  mpGuestReplay = job;
  mpReplayIdx = data.idx;
  mpSyncTurnOwner();
  soloAnimateBotTurn(player, data.replay, logNodes, job.runId).then(() => {
    job.done = true;   // logregels heeft soloAnimateBotTurn zelf al toegevoegd
    if (mpGuestReplay === job) mpGuestReplay = null;
    // het naspelen wiste/verving de opdrachtkaart in het zijpaneel — dat is altijd de jouwe
    const me = mpMe();
    if (me && !me.questHidden && !me.rank) renderWalkQuestCard(me.deck[me.nextIdx]);
  });
  // soloAnimateBotTurn toont de hand van "wie aan zet is" — in multiplayer altijd je eigen hand
  mpRefreshCardVault();
}
// een lopende naspeel-animatie bij de gast afbreken, maar zijn logregels niet kwijtraken
function mpGuestFinishReplay(){
  const job = mpGuestReplay;
  mpGuestReplay = null;
  if (!job || job.done) return;
  job.done = true;
  if (job.runId === soloRunId) soloRunId++;
  for (const n of job.logNodes) if (!n.parentNode) walkLogEl.appendChild(n);
  walkLogEl.scrollTop = walkLogEl.scrollHeight;
}

function mpBroadcastState(){
  if (!mp.isHost || !mp.actions || mp.phase !== 'in-game') return;
  // bot-beurt wordt zichtbaar afgespeeld: de gasten krijgen die via 'botturn' (mpOnBotReplay)
  if (soloPhase === 'bots') return;
  mpReplayIdx = -1;
  const newLines = [...walkLogEl.children].slice(mp.lastLogCount)
    .filter(el => !el.dataset.mpSent)
    .map(el => ({ html: el.innerHTML, cls: el.className }));
  const core = {
    soloPlayers: mpPublicPlayers(soloPlayers), soloActiveIdx, soloPhase, soloTurn, soloTargetKey, soloMove,
    soloBootsOptions, soloCurrentLegalMoves, soloRoundPos, soloTurnOrder,
    soloBankCountThisTurn, soloAllowUturn, soloPendingBoost, soloUsedBoots, soloUsedJump,
    soloTargetSwapped, soloUsedEnergyId, soloUsedCardId, soloDiscardedCardId,
    soloEnergyRoll, soloEnergyGain, soloBlindOfferAvailable, soloLockedThisTurn,
    soloActionCellDrawnThisTurn, walkScoreOrder, soloDeck: mpPublicDeck(soloDeck),
    soloFinished, soloFinishTarget, soloRoundFinishers,
    soloOpening,   // dobbelen wie begint/startposities kiezen — puur publieke info (worpen, keuzes)
    ownerUi: {
      rollHidden: btnWalkSoloRoll ? btnWalkSoloRoll.hidden : true,
      skipHidden: btnWalkSoloSkip ? btnWalkSoloSkip.hidden : true,
      actionsHtml: walkSoloActionsEl ? walkSoloActionsEl.innerHTML : '',
      // vervolgkeuze van een gespeelde kaart (doelwit van een hinderkaart, het Blinde-Vlek-
      // aanbod) staat in een apart vak bij de kaartkluis — ging vroeger niet mee, waardoor een
      // gast die keuzes nooit te zien kreeg en zijn beurt vastliep
      cardActionsHtml: walkCardActionsEl ? walkCardActionsEl.innerHTML : '',
      pendingCard: walkCardActionsEl ? (walkCardActionsEl.dataset.pendingCard || '') : '',
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
  // de bots zijn klaar (de host zendt weer): een eventueel nog lopende naspeel-animatie afronden
  mpGuestFinishReplay();
  mpReplayIdx = -1;
  // sporen van de nagespeelde bot-beurten weg zodra er een nieuwe mensen-beurt begint — net als
  // bij de host (soloBeginHumanTurn)
  if (payload.soloPhase === 'choose-action' && payload.soloTurn !== mpTrailClearedTurn){
    mpTrailClearedTurn = payload.soloTurn;
    walkClearClass('walk-trail');
    walkClearClass('walk-jump');
  }

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
  soloOpening = payload.soloOpening || null;
  const opening = !!soloOpening;
  walkSetOpeningMode(opening);

  const active = soloPlayers[soloActiveIdx];
  // jouw eigen doel + opdrachtkaart, en dat van wie aan zet is er gestippeld bij (soloShowTargets
  // in 97-solo.js); geheime opdrachten (dobbelen wie begint) tonen ze vanzelf nog niet
  soloShowTargets();

  paintWalkPawns(soloGraph, soloPlayers, soloActiveIdx);
  renderWalkScore(soloPlayers, soloActiveIdx);
  renderSoloMeta(soloMove ? soloMove.stepsLeft : undefined);
  mpRefreshCardVault();

  // na afloop geen dobbelstenen meer naast het winscherm (zie soloShowEndgame)
  if (soloPhase === 'game-over'){
    if (walkDiceEl) walkDiceEl.innerHTML = '';
  } else if (soloMove && soloMove.d1 !== undefined && soloPhase !== 'choose-action' && soloPhase !== 'rolling'){
    renderWalkDice(soloMove.d1, soloMove.d2, soloEnergyRoll, false, soloMove.d3, soloMove.roll);
  } else if (soloEnergyRoll !== null && soloPhase === 'rolling'){
    renderSoloDicePending();
  }

  const isMine = active && active.peerId === mp.myPeerId;
  const ui = payload.ownerUi;
  if (btnWalkSoloRoll) btnWalkSoloRoll.hidden = isMine ? ui.rollHidden : true;
  if (btnWalkSoloSkip) btnWalkSoloSkip.hidden = isMine ? ui.skipHidden : true;
  if (walkSoloActionsEl) walkSoloActionsEl.innerHTML = isMine ? ui.actionsHtml : '';
  if (walkCardActionsEl){
    const html = isMine ? (ui.cardActionsHtml || '') : '';
    walkCardActionsEl.innerHTML = html;
    walkCardActionsEl.classList.toggle('walk-pulse-affordable', !!html);
    // soloResolveTargetCard leest welke kaart er gespeeld wordt uit dit data-attribuut
    walkCardActionsEl.dataset.pendingCard = isMine ? (ui.pendingCard || '') : '';
  }
  if (walkStepCounterEl) walkStepCounterEl.hidden = isMine ? ui.stepHidden : true;
  if (walkStepDoneEl) walkStepDoneEl.textContent = isMine ? ui.stepDone : '–';
  if (walkStepLeftEl) walkStepLeftEl.textContent = isMine ? ui.stepLeft : '–';
  if (isMine) soloMarkClickable(soloGraph, ui.clickableKeys); else soloClearClickable();
  // het grote dobbel-/kiespaneel tekent elke gast zelf uit de gedeelde stand (met zijn eigen
  // "mag ik nu?"-check), zodat de knoppen erin bij de juiste speler staan
  if (opening){
    if (active && walkSideStackEl) walkSideStackEl.style.setProperty('--pc', active.color);
    soloRenderOpening();
  }

  if (walkStatusEl) walkStatusEl.innerHTML = payload.statusHtml || '';
  for (const line of payload.newLogLines || []){
    const div = document.createElement('div');
    div.className = line.cls || '';
    div.innerHTML = line.html;
    walkLogEl.appendChild(div);
  }
  if (payload.newLogLines && payload.newLogLines.length) walkLogEl.scrollTop = walkLogEl.scrollHeight;

  mpSyncTurnOwner();
  if (soloPhase === 'game-over') mpOnGameOver();
}

function mpOnGameOver(){
  if (!window.mpGameActive) return;
  window.mpGameActive = false;
  if (mpTabBarEl) mpTabBarEl.classList.remove('mp-locked');
  // Knop blijft staan als "Terug naar lobby" — voorheen verdween hij hier en was er na afloop
  // geen weg meer terug naar de kamer (zie mpLeaveGame, mp.gameOverView).
  mp.gameOverView = true;
  if (btnMpLeaveGame){ btnMpLeaveGame.textContent = 'Terug naar lobby'; btnMpLeaveGame.hidden = false; }
  // de host kreeg het winscherm al via soloEndGame(); een gast krijgt alleen de gedeelde stand
  // binnen, dus die bouwt hetzelfde winscherm (met klassement) hier zelf op
  if (!mp.isHost){
    const t = soloEndgameTexts(!soloPlayers.some(p => p.rank === 1));
    soloShowEndgame(t.trophy, t.title, t.sub);
  }
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
  walkCardVaultCountEl.textContent = cards.length === 1 ? '1 kristal' : `${cards.length} kristallen`;
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
  reorderChoice: (a) => soloResolveReorder(!!a.swap),
  jumpClick: (a) => soloHandleJumpClick(a.key),
  blindOffer: (a) => soloResolveBlindOffer(a.yes),
  openingRoll: () => soloOpeningRoll(),
  openingPick: (a) => soloOpeningPick(a.key),
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
  switchTab('multi');   // het speelscherm hoort bij het tabblad Multiplayer
  // Multiplayer heeft geen apart lobby-scherm meer nodig (dat is de modus "Multiplayer" hier
  // binnen #walkLobby — hosten/deelnemen/spelers klaarzetten) en ook geen Pauze/Stoppen/Nieuw
  // potje (dat is "Verlaat potje" hieronder), dus meteen door naar het speelscherm zonder fade
  // — dit IS de fade-bestemming die walkFadeToPlay() ook gebruikt (#walkPlayArea), alleen
  // ongeanimeerd want switchTab() wisselt toch al in één klap van tabblad.
  if (walkLobbyEl) walkLobbyEl.hidden = true;
  if (walkPlayAreaEl) walkPlayAreaEl.hidden = false;
  walkFooterSyncVisibility();   // walkPlayAreaEl.hidden wijzigde net hierboven, niet via walkFadeSwap()
  if (walkModeAutoBtn) walkModeAutoBtn.hidden = true;
  if (walkModeSoloBtn) walkModeSoloBtn.hidden = true;
  if (walkModeMultiBtn) walkModeMultiBtn.hidden = true;
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
  mp.gameOverView = false;
  if (btnMpLeaveGame){ btnMpLeaveGame.textContent = 'Verlaat potje'; btnMpLeaveGame.hidden = false; }
  soloHideEndgame();   // winscherm van een vorig potje weg
  // chat verhuist niet echt (zie mpRenderChat) — hij staat hier gewoon al klaar met dezelfde
  // berichten die in de lobby ook al zichtbaar waren.
  if (mpChatPanelGameEl) mpChatPanelGameEl.hidden = false;
  mpRenderChat();
  renderWalkBoard();
}
function mpExitPlayView(){
  window.mpGameActive = false;
  mp.gameOverView = false;
  if (walkPlayAreaEl) walkPlayAreaEl.classList.remove('mp-not-my-turn');
  const waitNote = document.getElementById('mpWaitTurn');
  if (waitNote) waitNote.hidden = true;
  if (mpTabBarEl) mpTabBarEl.classList.remove('mp-locked');
  if (btnMpLeaveGame) btnMpLeaveGame.hidden = true;
  if (mpChatPanelGameEl) mpChatPanelGameEl.hidden = true;
  if (walkModeAutoBtn) walkModeAutoBtn.hidden = false;
  if (walkModeSoloBtn) walkModeSoloBtn.hidden = false;
  if (walkModeMultiBtn) walkModeMultiBtn.hidden = false;
  // terug naar een complete, kloppende multiplayer-LOBBY (ongeanimeerd, zelfde reden als in
  // mpEnterPlayView) — dus setWalkMode('multi'), niet 'auto': multiplayer heeft geen eigen
  // tabblad meer om naartoe te wisselen (zie de mpRenderLobby()-aanroepen die na deze functie
  // volgen bij elke aanroeper), dus dit moet zelf meteen de juiste modus-sectie terugzetten,
  // inclusief alle velden die mpEnterPlayView() hierboven had weggestopt (walkAutoControlsEl,
  // walkSoloControlsEl, enz.) — precies zoals setWalkMode('auto') dat vroeger voor de losse
  // multiplayer-tab deed.
  setWalkMode('multi');
}

// ---------- mid-game vertrekken (bereikbaar tijdens 'in-game', zie btnMpLeaveGame) ----------
// Host: het potje stopt voor iedereen, maar de room/lobby blijft bestaan zodat meteen een
// nieuw potje gestart kan worden (zelfde eindtoestand als mpOnGameOver, zie daar).
// Gast: verlaat de room helemaal en gaat terug naar het join-scherm — hergebruikt exact het
// pad van "host is weg" (mpOnPeerLeave) resp. de bestaande mpJoinLeave().
function mpLeaveGame(){
  // na afloop ("Terug naar lobby", zie mpOnGameOver): de kamer/verbinding blijft gewoon
  // bestaan, alleen het speelscherm dicht — host ziet zijn hostkamer, gast wacht op de host
  if (mp.active && mp.gameOverView){
    mpExitPlayView();
    mpRenderLobby();
    return;
  }
  if (!mp.active || mp.phase !== 'in-game') return;
  // geen switchTab meer nodig hieronder — multiplayer heeft geen eigen tabblad, je blijft
  // gewoon op "Zelf spelen" (mpExitPlayView() zet de modus daar via setWalkMode('multi') zelf
  // al terug op de lobby).
  if (mp.isHost){
    if (mp.actions && mp.actions.stop) mp.actions.stop.send({});
    if (mp.broadcastTimer){ clearInterval(mp.broadcastTimer); mp.broadcastTimer = null; }
    mp.phase = 'hosting';
    mpExitPlayView();
    mpRenderLobby();
  } else {
    mpExitPlayView();
    mpTeardown();   // stuurt zelf een 'leave'-bericht, zie mpTeardown — host zet deze speler dan om in een bot
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
  mpRenderLobby();
}

// ---------- lobby-tabblad: welk deelscherm ----------
function mpRenderLobby(){
  const show = (el, on) => { if (el) el.hidden = !on; };
  // keuzescherm = "Spel hosten" + lijn + meteen het deelnameformulier (ook na een geweigerde
  // naam, fase 'join-form': dan staat het rode naamveld gewoon in hetzelfde scherm)
  const choosing = mp.phase === 'idle' || mp.phase === 'join-form';
  show(mpChoiceEl, choosing);
  show(mpHostSetupEl, mp.phase === 'host-setup' || mp.phase === 'hosting');
  // #mpHostForm (naam/spelersaantal/bot-keuze + Aanmaken/Terug) hoort alleen bij het INSTELLEN
  // van een kamer — eenmaal aan het hosten heeft dat formulier geen functie meer en verdween
  // #mpHostRoom (de kamercode + spelers + Start/Afbreken) er anders onder, want .mp-room-info
  // scrollt bewust niet mee (gebruikersmelding: "2 knoppen linksonder niet te zien").
  show(mpHostFormEl, mp.phase === 'host-setup');
  show(mpHostRoomEl, mp.phase === 'hosting');
  show(mpJoinFormEl, choosing);
  show(mpJoinWaitingEl, mp.phase === 'joining');
  mpShowRoomCols(mp.phase === 'hosting' || mp.phase === 'joining');
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
// `chant` (nummer), `egg` (naam van het easter-eggetje: 'bigdaddy'/'paintracer') en `text`
// sluiten elkaar uit — zie mpSendChatMessage/mpOnRemoteChat hieronder, die zetten er nooit meer
// dan één van.
const MP_EGG_LABELS = { bigdaddy: '🚗 Big Daddy!', paintracer: '🏎️ Paintracer!', kaboem: '💥 Kaboem!' };
function mpAppendChat(peerId, text, chant, egg){
  const info = mpChatSenderInfo(peerId);
  mpChatMessages.push({ peerId, name: info.name, color: info.color, text: text || null, chant: chant || null, egg: egg || null, ts: Date.now() });
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
      : msg.egg
        ? `<span class="mp-egg">${MP_EGG_LABELS[msg.egg] || msg.egg}</span>`
        : `<span>${mpEscapeHtml(msg.text)}</span>`;
    return `<div class="mp-chat-msg${mine ? ' mp-chat-me' : ''}">` +
      `<b style="color:${msg.color}" title="${mpEscapeHtml(msg.name)}">${mpEscapeHtml(msg.name)}</b>${body}` +
    `</div>`;
  }).join('');
  for (const el of [mpChatLogEl, mpChatLogGameEl]){
    if (!el) continue;
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  }
}
// Eén trefwoord -> welke easter egg — houdt mpSendChatMessage/mpOnRemoteChat hieronder kort,
// nieuwe eastereggetjes toevoegen is dan alleen deze tabel + de trigger-functie zelf.
const MP_EGG_TRIGGERS = { bigdaddy: mpTriggerBigDaddy, paintracer: mpTriggerPaintracer, kaboem: mpTriggerKaboem };
// typ je puur een getal dat een bestaande taunt is (bv. "7"), dan wordt dat een taunt i.p.v.
// een gewoon tekstbericht — hoorbaar voor jezelf én voor iedereen anders in de room, net als
// de taunts uit het originele Age of Empires. Een easter-eggetje uit MP_EGG_TRIGGERS werkt
// ZONDER actieve room — daarvoor eerst gecontroleerd, vóór de `!mp.active`-guard die de rest
// van deze functie (taunts, gewone berichten) wél nodig heeft om ergens heen te sturen.
function mpSendChatMessage(raw){
  const trimmed = String(raw || '').trim().slice(0, 240);
  if (!trimmed) return;
  const eggName = trimmed.toLowerCase();
  if (MP_EGG_TRIGGERS[eggName]){
    MP_EGG_TRIGGERS[eggName]();
    if (mp.active && mp.actions && mp.actions.chat){
      mpAppendChat(mp.myPeerId, null, null, eggName);
      mp.actions.chat.send({ egg: eggName });
    }
    return;
  }
  if (!mp.active || !mp.actions || !mp.actions.chat) return;
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
  if (data && MP_EGG_TRIGGERS[data.egg]){
    mpAppendChat(peerId, null, null, data.egg);
    MP_EGG_TRIGGERS[data.egg]();
    return;
  }
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
// rode rand (mpHostCreate hierboven) verdwijnt weer zodra je zelf iets invult — geen reden om
// 'm te laten staan tot de volgende klik op "Aanmaken".
const mpHostNameFieldEl = document.getElementById('mpHostName');
if (mpHostNameFieldEl) mpHostNameFieldEl.addEventListener('input', () => {
  if (soloCleanName(mpHostNameFieldEl.value)) mpHostNameFieldEl.classList.remove('mp-field-invalid');
});
// zelfde voor het naamveld bij deelnemen (rood na "naam al bezet", zie mpJoinRejected)
const mpJoinNameFieldEl = document.getElementById('mpJoinName');
if (mpJoinNameFieldEl) mpJoinNameFieldEl.addEventListener('input', () => mpJoinNameFieldEl.classList.remove('mp-field-invalid'));
if (btnMpJoinConnect) btnMpJoinConnect.addEventListener('click', mpJoinConnect);
if (btnMpHostStart) btnMpHostStart.addEventListener('click', mpHostStartClick);
if (btnMpHostStop) btnMpHostStop.addEventListener('click', mpHostStop);
if (btnMpJoinLeave) btnMpJoinLeave.addEventListener('click', mpJoinLeave);
if (btnMpCopyCode) btnMpCopyCode.addEventListener('click', () => {
  if (navigator.clipboard) navigator.clipboard.writeText(mp.roomCode || '');
});
// zelfde kopieerknop in de wachtkamer van een gast
{
  const b = document.getElementById('btnMpCopyCodeGuest');
  if (b) b.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(mp.roomCode || ''); });
}
