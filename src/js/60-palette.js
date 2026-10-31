// ---------- palette ----------
// Kaartjes = "Tekentafel" (gekozen variant 2 uit 4, artifact "Axiom-9 Kamerkaartjes", 2026-10):
// grote vaste naam (geen naamveld meer, de namen staan vast), de tegel op ruitjespapier en bij
// muis-erop "Bewerken" over de tegel heen. Geen nummer of positieletter meer.
const THUMB_PEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
const THUMB_LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
function renderPalette(){
  const roomsEl = document.getElementById('paletteRooms');
  const corrEl  = document.getElementById('paletteCorridors');
  roomsEl.innerHTML = ''; corrEl.innerHTML = '';
  const roomTiles = [], corridorTiles = [];
  for (let t=1; t<=20; t++) (ROOM_NAMES[t] ? roomTiles : corridorTiles).push(t);
  document.getElementById('countRooms').textContent = '(' + roomTiles.length + ')';
  document.getElementById('countCorridors').textContent = '(' + corridorTiles.length + ')';
  for (const tid of [...roomTiles, ...corridorTiles]){
    const slotIdx = layout.indexOf(tid);
    const card = document.createElement('div');
    card.className = 'tile-thumb' + (selectedSlot===slotIdx || highlightTile===tid ? ' active' : '');
    const roomName = ROOM_NAMES[tid];
    const name = document.createElement('div');
    name.className = 'thumb-name' + (roomName ? '' : ' is-corridor');
    name.textContent = roomName || ('Gang ' + tid);
    name.title = name.textContent;
    card.appendChild(name);
    const board = document.createElement('div');
    board.className = 'thumb-board';
    const editBtn = document.createElement('button');
    editBtn.className = 'thumb-edit';
    editBtn.type = 'button';
    if (tid === START_TILE){
      editBtn.disabled = true;
      editBtn.title = 'Hibernatie bevat de 4 vaste startposities en kan niet bewerkt worden';
      editBtn.innerHTML = THUMB_LOCK + '<span>Vaste tegel</span>';
    } else {
      editBtn.title = 'Tegel bewerken';
      editBtn.innerHTML = THUMB_PEN + '<span>Bewerken</span>';
      editBtn.addEventListener('click', (e)=>{ e.stopPropagation(); openTileEditor(tid); });
      editBtn.addEventListener('pointerdown', (e)=> e.stopPropagation());
    }
    editBtn.setAttribute('aria-label', editBtn.title + ': ' + name.textContent);
    const g = document.createElement('div');
    g.className = 'thumb-grid';
    for (let dr=0; dr<TILE_H; dr++){
      for (let dc=0; dc<TILE_W; dc++){
        const cell = document.createElement('div');
        const val = getDisplayValue(tid, dr, dc);
        const type = cellType(val);
        if (type) cell.className = 'thumb-cell ' + type + (type === 'walk' && roomName ? ' room-tile' : '');
        else if (patternSet.has(dr+'_'+dc)) cell.className = 'thumb-cell empty-slot';
        else cell.className = 'thumb-cell';
        g.appendChild(cell);
      }
    }
    board.append(g, editBtn);
    card.appendChild(board);
    card.addEventListener('click', ()=>{
      selectedSlot = (selectedSlot === slotIdx) ? null : slotIdx;
      highlightTile = null;
      renderBoard();
    });
    card.addEventListener('dblclick', (e)=>{ e.preventDefault(); openTileEditor(tid); });
    (ROOM_NAMES[tid] ? roomsEl : corrEl).appendChild(card);
  }
}

// ---------- opdrachtenregister ----------
// puur informatief: naam per opdracht + waar hij nu ligt, verandert mee met de indeling
function renderQuestRegister(){
  const el = document.getElementById('questRegister');
  if (!el) return;
  const countEl = document.getElementById('countQuests');
  if (countEl) countEl.textContent = '(' + Object.keys(QUEST_NAMES).length + ')';
  const rows = Object.keys(QUEST_NAMES).map(label => {
    const tid = findLabelTile(label);
    const slotIdx = tid !== null ? layout.indexOf(tid) : -1;
    const where = tid !== null && slotIdx !== -1
      ? `${ROOM_NAMES[tid] || ('Gang ' + tid)} · positie ${letterForSlot(slotIdx)}`
      : `<span class="bad">ontbreekt op het bord</span>`;
    return `<tr><td>${label}</td><td>${QUEST_NAMES[label]}</td><td>${where}</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="sim-table quest-table"><thead><tr><th>Opdracht</th><th>Naam</th><th>Ligt in</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---------- actiekaartvakjes-register ----------
// puur informatief, zelfde opzet als renderQuestRegister — elke gangtegel draagt precies 1 label
function renderActionCellRegister(){
  const el = document.getElementById('actionCellRegister');
  if (!el) return;
  const countEl = document.getElementById('countActionCells');
  if (countEl) countEl.textContent = '(' + ACTION_CELL_LABELS.length + ')';
  const rows = ACTION_CELL_LABELS.map(label => {
    const tid = findLabelTile(label);
    const slotIdx = tid !== null ? layout.indexOf(tid) : -1;
    const where = tid !== null && slotIdx !== -1
      ? `${ROOM_NAMES[tid] || ('Gang ' + tid)} · positie ${letterForSlot(slotIdx)}`
      : `<span class="bad">ontbreekt op het bord</span>`;
    return `<tr><td>${label}</td><td>${where}</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="sim-table quest-table"><thead><tr><th>Vakje</th><th>Ligt in</th></tr></thead><tbody>${rows}</tbody></table>`;
}
