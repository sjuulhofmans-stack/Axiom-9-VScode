// ---------- slepen om te verwisselen ----------
// Opzet "Plaats maken" (gekozen variant 2 uit 4, artifact "Axiom-9 Tegels verschuiven", 2026-11):
//   klik       = selecteren: één kader om de hele tegel (mapRing in 40-board.js)
//   oppakken   = de tegel komt los als een zwevende kopie (.tile-float): iets groter, schaduw
//                eronder, en hij volgt de muis; zijn eigen plek blijft leeg met een gestippeld kader
//   slepen     = de kopie kantelt mee met de beweging; de tegel waar je boven hangt schuift alvast
//                naar de vrijgekomen plek (ook een kopie), dus je ziet de ruil vóór je loslaat.
//                Mag de ruil niet, dan blijft die tegel liggen en is het kader rood
//   loslaten   = de tegel zakt met een klein veertje op zijn plek
// Het bord is één raster van losse vakjes, geen losse tegels: daarom bewegen er kopieën en zijn de
// echte vakjes van die tegelplek zolang onzichtbaar (.slot-lifted). Tijdens het slepen wordt het
// bord NIET opnieuw getekend (renderBoard rekent ook de bereikbaarheid en het register door: dat
// was de hapering, gebruikersmelding 2026-11); alleen transform/opacity bewegen. Pas bij het
// loslaten wordt er één keer getekend.
const dragState = { from: null, over: null, moved: false, pointerId: null };
const DRAG_THRESHOLD = 5; // pixels voordat het een sleep wordt in plaats van een klik
const MAP_CLONE_CLASSES = ['walk', 'quest', 'start', 'actioncell', 'empty-slot', 'room-tile', 'unreachable'];
const MAP_GLIDE_MS = 260, MAP_DROP_MS = 180;
let dragFx = null;   // alles van de lopende sleep: maten, de zwevende kopie en de uitgeweken tegels

function mapSlotCells(slot){
  const i = Math.floor(slot / TILE_COLS), j = slot % TILE_COLS, out = [];
  for (let dr = 0; dr < TILE_H; dr++) for (let dc = 0; dc < TILE_W; dc++) out.push(cellEls[i * TILE_H + dr][j * TILE_W + dc]);
  return out;
}
function mapSlotHide(slot, on){ for (const c of mapSlotCells(slot)) c.classList.toggle('slot-lifted', on); }
// kopie van de tegel op een plek, als los blokje boven het bord
function mapTileClone(slot, cls){
  const el = document.createElement('div');
  el.className = 'tile-float ' + cls;
  const inner = document.createElement('div');
  inner.className = 'tile-float-in';
  mapSlotCells(slot).forEach((src, k) => {
    const c = document.createElement('div');
    c.className = 'cell';
    for (const t of MAP_CLONE_CLASSES) if (src.classList.contains(t)) c.classList.add(t);
    if (k === 0){
      const lab = src.querySelector('.room-label');
      if (lab && lab.textContent){ c.classList.add('has-badge'); c.appendChild(lab.cloneNode(true)); }
    }
    inner.appendChild(c);
  });
  el.appendChild(inner);
  boardEl.appendChild(el);
  return el;
}
function mapFloatTo(el, slot, pitch){
  el.style.transform = `translate(${(slot % TILE_COLS) * pitch}px, ${Math.floor(slot / TILE_COLS) * pitch}px)`;
}
// welke tegelplek ligt onder dit punt? Uitgerekend uit de maten van het bord: de vakjes van een
// opgetilde tegel zijn onzichtbaar en vangen dus geen muis
function slotFromPoint(x, y){
  if (!dragFx) return null;
  const r = boardEl.getBoundingClientRect();
  const c = Math.floor((x - r.left) / dragFx.pitch), row = Math.floor((y - r.top) / dragFx.pitch);
  if (c < 0 || c >= TILE_COLS || row < 0 || row >= TILE_ROWS) return null;
  return row * TILE_COLS + c;
}
// alles van een sleep opruimen: kopieën weg, echte vakjes weer zichtbaar
function mapDragCleanup(f){
  if (!f || f.done) return;
  f.done = true;
  cancelAnimationFrame(f.raf);
  clearTimeout(f.timer);
  f.el.remove();
  mapSlotHide(f.from, false);
  for (const [slot, g] of f.ghosts){ clearTimeout(g._t); g.remove(); mapSlotHide(slot, false); }
  f.ghosts.clear();
}
function mapDragStart(){
  const from = dragState.from;
  const r = boardEl.getBoundingClientRect();
  const pitch = cellEls[0][TILE_W].getBoundingClientRect().left - cellEls[0][0].getBoundingClientRect().left;
  const x0 = (from % TILE_COLS) * pitch, y0 = Math.floor(from / TILE_COLS) * pitch;
  dragFx = {
    from, pitch, ghosts: new Map(), tilt: 0, raf: 0, timer: 0, done: false,
    gx: dragState.startX - r.left - x0, gy: dragState.startY - r.top - y0,   // waar je de tegel vastpakte
    x: x0, y: y0, tx: x0, ty: y0,
    maxX: (TILE_COLS - 1) * pitch, maxY: (TILE_ROWS - 1) * pitch,
  };
  const f = dragFx;
  f.el = mapTileClone(from, 'is-drag');
  f.inner = f.el.firstChild;
  mapFloatTo(f.el, from, pitch);
  mapSlotHide(from, true);
  boardEl.classList.add('dragging');
  mapRing('sel', null);
  mapRing('home', from, '#8794a3');
  requestAnimationFrame(() => { if (!f.done) f.el.classList.add('is-lift'); });
  f.raf = requestAnimationFrame(mapDragFrame);
}
// elk beeldje: de kopie naar de muis, en een kanteling die meegaat met de snelheid
function mapDragFrame(){
  const f = dragFx;
  if (!f || f.done) return;
  const v = Math.max(-7, Math.min(7, (f.tx - f.x) * 0.55));
  f.tilt += (v - f.tilt) * 0.25;
  f.x = f.tx; f.y = f.ty;
  f.el.style.transform = `translate(${f.x.toFixed(1)}px, ${f.y.toFixed(1)}px)`;
  f.inner.style.setProperty('--tilt', f.tilt.toFixed(2) + 'deg');
  f.raf = requestAnimationFrame(mapDragFrame);
}
// de tegel op `slot` wijkt uit naar de plek van de opgepakte tegel
function mapGhostAway(slot){
  const f = dragFx;
  let g = f.ghosts.get(slot);
  if (!g){
    g = mapTileClone(slot, 'is-ghost');
    mapFloatTo(g, slot, f.pitch);
    f.ghosts.set(slot, g);
    mapSlotHide(slot, true);
    void g.offsetWidth;   // beginstand vastleggen, anders glijdt hij niet maar springt hij
  }
  clearTimeout(g._t);
  mapFloatTo(g, f.from, f.pitch);
}
// ... en weer terug naar zijn eigen plek; daarna is het gewoon weer de echte tegel
function mapGhostHome(f, slot){
  const g = f.ghosts.get(slot);
  if (!g) return;
  mapFloatTo(g, slot, f.pitch);
  clearTimeout(g._t);
  g._t = setTimeout(() => {
    if (f.done || f.ghosts.get(slot) !== g) return;
    g.remove(); f.ghosts.delete(slot); mapSlotHide(slot, false);
  }, MAP_GLIDE_MS + 40);
}
function mapDragOver(slot){
  const f = dragFx, prev = dragState.over;
  if (slot === prev) return;
  dragState.over = slot;
  if (prev !== null && prev !== f.from) mapGhostHome(f, prev);
  if (slot !== null && slot !== f.from){
    const ok = swapAllowed(f.from, slot);
    mapRing('over', slot, ok ? '#55d68a' : '#ff5d5d');
    if (ok) mapGhostAway(slot);
  } else {
    mapRing('over', null);
  }
}

function onCellPointerDown(e){
  if (e.button !== undefined && e.button !== 0) return;
  if (dragState.from !== null && e.pointerId !== dragState.pointerId) return;
  const slotIdx = parseInt(e.currentTarget.dataset.slot, 10);
  dragState.from = slotIdx;
  dragState.over = slotIdx;
  dragState.moved = false;
  dragState.pointerId = e.pointerId;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
}

function onPointerMove(e){
  if (dragState.from === null || e.pointerId !== dragState.pointerId) return;
  if (!dragState.moved){
    const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (typeof genRunning !== 'undefined' && genRunning) return;   // niet slepen tijdens het genereren
    dragState.moved = true;
    mapDragCleanup(dragFx);   // een vorige sleep die nog uitgleed
    mapDragStart();
  }
  e.preventDefault();
  const f = dragFx, r = boardEl.getBoundingClientRect();
  f.tx = Math.max(0, Math.min(f.maxX, e.clientX - r.left - f.gx));
  f.ty = Math.max(0, Math.min(f.maxY, e.clientY - r.top - f.gy));
  mapDragOver(slotFromPoint(e.clientX, e.clientY));
}

// einde van een sleep. swap = mag de ruil doorgaan (bij afbreken niet)
function mapDragEnd(swap){
  const f = dragFx, from = dragState.from, over = dragState.over;
  const wasDrag = dragState.moved;
  dragState.from = null; dragState.over = null; dragState.moved = false; dragState.pointerId = null;
  boardEl.classList.remove('dragging');
  if (!wasDrag || !f){
    // gewone klik: alleen selecteren / deselecteren
    if (swap) selectedSlot = (selectedSlot === from) ? null : from;
    renderBoard();
    return;
  }
  dragFx = null;
  cancelAnimationFrame(f.raf);
  mapRing('home', null); mapRing('over', null);
  const ok = swap && over !== null && over !== from && trySwap(from, over) === true;
  selectedSlot = ok ? over : from;
  // de opgepakte tegel zakt op zijn plek, de rest gaat naar huis
  f.el.classList.remove('is-drag', 'is-lift');
  f.el.classList.add('is-dropping');
  f.inner.style.removeProperty('--tilt');
  mapFloatTo(f.el, ok ? over : from, f.pitch);
  for (const slot of [...f.ghosts.keys()]) if (!(ok && slot === over)) mapGhostHome(f, slot);
  if (ok && !f.ghosts.has(over)){
    // de andere tegel was nog niet uitgeweken (heel snel losgelaten): alsnog laten glijden
    dragFx = f; mapGhostAway(over); dragFx = null;
  }
  if (ok) f.inner.animate(
    [{ transform: 'scale(1.09)' }, { transform: 'scale(.96)', offset: .55 }, { transform: 'scale(1.02)', offset: .8 }, { transform: 'scale(1)' }],
    { duration: 380, easing: 'ease-out' });
  renderBoard();   // één keer; de vakjes onder de kopieën blijven nog even onzichtbaar
  f.timer = setTimeout(() => mapDragCleanup(f), 400);
}

function onPointerUp(e){
  if (dragState.from === null || e.pointerId !== dragState.pointerId) return;
  if (dragState.moved && dragFx) mapDragOver(slotFromPoint(e.clientX, e.clientY));
  mapDragEnd(true);
}

document.addEventListener('pointermove', onPointerMove, { passive:false });
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('pointercancel', ()=>{
  if (dragState.from === null) return;
  mapDragEnd(false);
});

// ---------- hover-tip: naam naast de cursor voor opdracht-, actiekaart- en startvakjes ----------
// Alleen deze drie soorten hebben een naam die de moeite waard is om los te tonen; gewone
// loopvakjes en lege vakjes leveren niets op (hoverTipInfo geeft dan null en het tipje blijft weg).
const hoverTipEl = document.createElement('div');
hoverTipEl.className = 'cell-hover-tip';
hoverTipEl.hidden = true;
document.body.appendChild(hoverTipEl);

function hoverTipInfo(tileId, dr, dc){
  const val = getDisplayValue(tileId, dr, dc);
  if (typeof val !== 'string') return null;
  if (val.startsWith('2.')) return { text: `${QUEST_NAMES[val] || 'Opdracht'} (${val})`, kind: 'quest' };
  if (val.startsWith('3.')) return { text: `Startpositie ${val}`, kind: 'start' };
  if (val.startsWith('4.')) return { text: `Kristalvakje ${val}`, kind: 'actioncell' };
  return null;
}

function hideHoverTip(){ hoverTipEl.hidden = true; }

function updateHoverTip(e){
  // tijdens slepen wijst het kader al genoeg aan; een naam-tipje erbovenop is dan alleen ruis
  if (dragState.from !== null){ hideHoverTip(); return; }
  const hit = e.target.closest ? e.target.closest('.slot-hit') : null;
  const info = hit
    ? hoverTipInfo(layout[parseInt(hit.dataset.slot, 10)], parseInt(hit.dataset.dr, 10), parseInt(hit.dataset.dc, 10))
    : null;
  if (!info){ hideHoverTip(); return; }
  hoverTipEl.textContent = info.text;
  hoverTipEl.className = 'cell-hover-tip ' + info.kind;
  hoverTipEl.hidden = false;
  const margin = 16;
  let x = e.clientX + margin, y = e.clientY + margin;
  const rect = hoverTipEl.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 4) x = e.clientX - rect.width - margin;
  if (y + rect.height > window.innerHeight - 4) y = e.clientY - rect.height - margin;
  hoverTipEl.style.left = x + 'px';
  hoverTipEl.style.top = y + 'px';
}

boardEl.addEventListener('pointermove', (e)=>{
  // op touch bestaat "hoveren" niet echt en zou het tipje alleen in de weg zitten tijdens slepen
  if (e.pointerType && e.pointerType !== 'mouse') return;
  updateHoverTip(e);
});
boardEl.addEventListener('pointerleave', hideHoverTip);
