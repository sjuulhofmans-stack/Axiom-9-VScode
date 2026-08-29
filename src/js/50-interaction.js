// ---------- slepen om te verwisselen ----------
const dragState = { from: null, over: null, moved: false, pointerId: null };
const DRAG_THRESHOLD = 5; // pixels voordat het een sleep wordt in plaats van een klik

function slotFromPoint(x, y){
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const hit = el.closest ? el.closest('.slot-hit') : null;
  if (!hit || hit.dataset.slot === undefined) return null;
  return parseInt(hit.dataset.slot, 10);
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
  boardEl.classList.add('dragging');
  renderBoard();
}

function onPointerMove(e){
  if (dragState.from === null || e.pointerId !== dragState.pointerId) return;
  if (!dragState.moved){
    const dx = e.clientX - dragState.startX, dy = e.clientY - dragState.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.moved = true;
  }
  e.preventDefault();
  const over = slotFromPoint(e.clientX, e.clientY);
  if (over !== dragState.over){
    dragState.over = over;
    renderBoard();
  }
}

function onPointerUp(e){
  if (dragState.from === null || e.pointerId !== dragState.pointerId) return;
  const from = dragState.from;
  const over = dragState.moved ? slotFromPoint(e.clientX, e.clientY) : null;
  const wasDrag = dragState.moved;
  dragState.from = null; dragState.over = null; dragState.moved = false; dragState.pointerId = null;
  boardEl.classList.remove('dragging');

  if (wasDrag){
    if (over !== null && over !== from){
      if (trySwap(from, over)) selectedSlot = over;
      else selectedSlot = from;
    } else {
      selectedSlot = from;
    }
  } else {
    // gewone klik: alleen selecteren / deselecteren
    selectedSlot = (selectedSlot === from) ? null : from;
  }
  renderBoard();
}

document.addEventListener('pointermove', onPointerMove, { passive:false });
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('pointercancel', ()=>{
  if (dragState.from === null) return;
  dragState.from = null; dragState.over = null; dragState.moved = false; dragState.pointerId = null;
  boardEl.classList.remove('dragging');
  renderBoard();
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
  if (val.startsWith('4.')) return { text: `Actiekaartvakje ${val}`, kind: 'actioncell' };
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
