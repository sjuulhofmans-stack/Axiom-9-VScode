// ---------- kader rondom een hele tegel (8x8) ----------
// Eén los blokje boven het raster per soort kader, hetzelfde kader als om de opdrachtkamer tijdens
// een potje (.walk-room-ring in styles.css; gebruikerswens 2026-11: "hetzelfde als een kamer die
// opgelicht staat bij het spelen"). Vroeger kregen 28 losse randvakjes elk een eigen schaduw.
//   'sel'  = de geselecteerde tegel (amber, pulst zacht)
//   'home' = de plek waar een opgepakte tegel vandaan komt (gestippeld)
//   'over' = de plek waar je boven hangt tijdens het slepen (groen = mag, rood = mag niet)
const mapRings = {};
function mapRing(kind, slot, color){
  let el = mapRings[kind];
  if (!el){
    el = document.createElement('div');
    el.className = 'walk-room-ring map-ring is-' + kind;
    el.hidden = true;
    boardEl.appendChild(el);
    mapRings[kind] = el;
  }
  if (slot === null || slot === undefined){ el.hidden = true; return; }
  el.style.setProperty('--rc', slot % TILE_COLS);
  el.style.setProperty('--rr', Math.floor(slot / TILE_COLS));
  if (color) el.style.setProperty('--qtint', color);
  el.hidden = false;
}

// ---------- board rendering ----------
const roomLabelEls = [];
function buildBoardSkeleton(){
  boardEl.innerHTML = '';
  roomLabelEls.length = 0;
  const cellEls = [];
  for (let R=0; R<TILE_ROWS*TILE_H; R++){
    cellEls.push([]);
    for (let C=0; C<TILE_COLS*TILE_W; C++){
      const dr = R % TILE_H, dc = C % TILE_W;
      const slotI = Math.floor(R/TILE_H), slotJ = Math.floor(C/TILE_W);
      const slotIdx = slotI*TILE_COLS + slotJ;
      const div = document.createElement('div');
      div.className = 'cell slot-hit';
      div.dataset.slot = slotIdx;
      div.dataset.dr = dr; div.dataset.dc = dc;
      div.addEventListener('pointerdown', onCellPointerDown);
      if (dc === TILE_W-1) div.classList.add('tile-edge-r');
      if (dr === TILE_H-1) div.classList.add('tile-edge-b');
      // linker-/bovenrand komt normaal van de buurtegel (diens rechter-/onderrand op dezelfde
      // pixel); alleen de buitenste rand van het hele bord heeft geen buur die dat overneemt
      if (dc === 0 && slotJ === 0) div.classList.add('tile-edge-l');
      if (dr === 0 && slotI === 0) div.classList.add('tile-edge-t');
      // letterbadge + kamernaam-overlay op de echte linkerbovenhoek van de tegel (lokaal 0,0) —
      // geen patroon-cel, dus nooit overlap met een loopbaar/opdracht/start-vakje. De overlay
      // hangt aan diezelfde cel (net als de badge) zodat hij exact over de 8x8 tegel valt en
      // meeverhuist bij een wissel, zonder losse grid-plaatsing die per browser kan afwijken.
      if (dr === 0 && dc === 0){
        const badge = document.createElement('span');
        badge.className = 'letter-badge';
        if (slotCategory(slotIdx) === 'corner') badge.classList.add('corner');
        if (slotCategory(slotIdx) === 'inner') badge.classList.add('inner');
        badge.textContent = letterForSlot(slotIdx);
        div.classList.add('has-badge');
        div.appendChild(badge);

        const roomLabel = document.createElement('span');
        roomLabel.className = 'room-label';
        div.appendChild(roomLabel);
        roomLabelEls[slotIdx] = roomLabel;
      }
      boardEl.appendChild(div);
      cellEls[R].push(div);
    }
  }
  return cellEls;
}
let cellEls = buildBoardSkeleton();

function renderBoard(){
  for (let R=0; R<TILE_ROWS*TILE_H; R++){
    for (let C=0; C<TILE_COLS*TILE_W; C++) cellEls[R][C].classList.remove('unreachable');
  }
  for (let R=0; R<TILE_ROWS*TILE_H; R++){
    for (let C=0; C<TILE_COLS*TILE_W; C++){
      const dr = R % TILE_H, dc = C % TILE_W;
      const slotI = Math.floor(R/TILE_H), slotJ = Math.floor(C/TILE_W);
      const slotIdx = slotI*TILE_COLS + slotJ;
      const tileId = layout[slotIdx];
      const val = getDisplayValue(tileId, dr, dc);
      const div = cellEls[R][C];
      div.classList.remove('walk','quest','start','actioncell','empty-slot','slot-hover','seam-open','seam-broken','room-tile');
      const type = cellType(val);
      if (type){
        div.classList.add(type);
        if (type === 'walk' && ROOM_NAMES[tileId]) div.classList.add('room-tile');
      }
      else if (patternSet.has(dr+'_'+dc)){ div.classList.add('empty-slot'); }
      if (highlightTile !== null && tileId === highlightTile) div.classList.add('slot-hover');
    }
  }

  // kamernaam-overlay: alleen tekst voor slots met een kamertegel erop
  for (let slotIdx=0; slotIdx<20; slotIdx++){
    const roomName = ROOM_NAMES[layout[slotIdx]];
    roomLabelEls[slotIdx].textContent = roomName || '';
  }

  const reach = analyseCellReachability();
  for (const [R,C] of reach.unreachable) cellEls[R][C].classList.add('unreachable');

  // kader om de geselecteerde tegel; tijdens het slepen regelt 50-interaction.js de kaders zelf
  mapRing('sel', dragState.from === null ? selectedSlot : null, '#ffb545');
  layoutCodeEl.textContent = layout.join(',');

  // naad-markeringen
  const conn = computeConnectivity();
  for (const seam of conn.seams){
    if (seam.connected){
      for (const [R,C] of edgeGlobalCells(seam.idx, seam.dir)) cellEls[R][C].classList.add('seam-open');
      for (const [R,C] of edgeGlobalCells(seam.nIdx, OPPOSITE[seam.dir])) cellEls[R][C].classList.add('seam-open');
    } else {
      if (seam.openA) for (const [R,C] of edgeGlobalCells(seam.idx, seam.dir)) cellEls[R][C].classList.add('seam-broken');
      if (seam.openB) for (const [R,C] of edgeGlobalCells(seam.nIdx, OPPOSITE[seam.dir])) cellEls[R][C].classList.add('seam-broken');
    }
  }

  // (de verborgen statusregel #connStatus, #reachStatus en de opdracht-/kristalvakregisters zijn
  // weg: die stonden niet meer op de pagina. De enige aanwijzing is nu het bord zelf: rode naden en
  // roze omrande onbereikbare vakjes, zie CLAUDE.md "Controleren of het nog werkt" punt 2.)
  renderSelectedBox();
  renderPalette();
}

function renderSelectedBox(){
  const box = document.getElementById('selectedBox');
  if (selectedSlot === null){
    box.innerHTML = 'Geen selectie — klik een tegel op het bord of in het register';
    const bL = document.getElementById('btnRotL'), bR = document.getElementById('btnRotR');
    if (bL) bL.disabled = true;
    if (bR) bR.disabled = true;
    return;
  }
  const tid = layout[selectedSlot];
  const locked = isCornerTile(tid);
  const roomName = ROOM_NAMES[tid];
  let tags = '';
  if (locked) tags += `<span class="tag corner">hoektegel — vast</span>`;
  if (tid === START_TILE) tags += `<span class="tag startroom">startpositie-tegel</span>`;
  const rot = tileRotation[tid] || 0;
  box.innerHTML =
    `<span class="sel-main">` +
      `<b class="sel-name ${roomName ? 'room' : 'corridor'}">${roomName || ('Gang ' + tid)}</b>` +
      `<span class="sel-sub">Tegel #${tid} · positie ${letterForSlot(selectedSlot)}${rot ? ' · ' + rot + '°' : ''}</span>` +
    `</span><span>${tags}</span>`;
  const btnL = document.getElementById('btnRotL'), btnR = document.getElementById('btnRotR');
  if (btnL) btnL.disabled = false;
  if (btnR) btnR.disabled = false;
}

// Een hoek-geschikte tegel die op een hoek belandt, draait bij het wisselen meteen in de enige stand
// die daar past (vroeger zei de melding "probeer eerst te draaien", maar op een hoek kún je niet
// draaien: twee hoektegels verwisselen ging dus nooit). swapAllowed rekent met die stand (en zet
// alles terug); trySwap zet hem echt.
function swapAutoTurn(tid, slot){
  if (slotCategory(slot) === 'corner' && isCornerCapable(tid)) tileRotation[tid] = requiredCornerRotation(tid, slot);
}
function swapAllowed(slotA, slotB){
  const tileA = layout[slotA], tileB = layout[slotB];
  const ra = tileRotation[tileA], rb = tileRotation[tileB];
  swapAutoTurn(tileA, slotB); swapAutoTurn(tileB, slotA);
  const ok = canTileGoInSlotNow(tileA, slotB) && canTileGoInSlotNow(tileB, slotA);
  tileRotation[tileA] = ra; tileRotation[tileB] = rb;
  return ok;
}

// blokkeert een swap puur vanwege de HUIDIGE stand van de tegel (niet het tegeltype/de
// slot-restrictie zelf), en zou een andere rotatie wél passen? Alleen relevant voor hoeken:
// dat is de enige plek waar canTileGoInSlotNow ook naar de actuele oriëntatie kijkt.
function fixableByRotation(tid, slotIdx){
  if (slotCategory(slotIdx) !== 'corner' || !isCornerCapable(tid)) return false;
  if (canTileGoInSlotNow(tid, slotIdx)) return false;
  const saved = tileRotation[tid];
  for (const rot of [0, 90, 180, 270]){
    tileRotation[tid] = rot;
    if (canTileGoInSlotNow(tid, slotIdx)){ tileRotation[tid] = saved; return true; }
  }
  tileRotation[tid] = saved;
  return false;
}

function trySwap(slotA, slotB){
  if (typeof genRunning !== 'undefined' && genRunning) return;   // niet tijdens het genereren, zie tryRotate
  const tileA = layout[slotA], tileB = layout[slotB];
  if (!swapAllowed(slotA, slotB)){
    if (fixableByRotation(tileA, slotB) || fixableByRotation(tileB, slotA)){
      swapHint.innerHTML = `<span style="color:var(--danger)">Deze tegel past hier niet in de huidige stand — probeer eerst te draaien.</span>`;
    } else {
      swapHint.innerHTML = `<span style="color:var(--danger)">Kan niet verwisselen — tegel #${tileA} of #${tileB} mag daar niet liggen. Op een hoek mag geen doorgang het bord af wijzen, en de starttegel (#${START_TILE}) hoort binnenin op G/H/I/L/M/N.</span>`;
    }
    return false;
  }
  clearSimResults();
  swapAutoTurn(tileA, slotB); swapAutoTurn(tileB, slotA);
  [layout[slotA], layout[slotB]] = [layout[slotB], layout[slotA]];
  swapHint.textContent = '';   // geen tekst onder de knoppen bij succes (gebruikerswens), alleen bij fouten
  return true;
}
