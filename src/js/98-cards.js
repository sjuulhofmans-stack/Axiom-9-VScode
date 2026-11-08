// ---------- tabblad "Speelkaarten" ----------
// Toont het hele kaartspel op één plek: de negen opdrachtkaarten (2.1-2.9) en alle
// kristallen (de vroegere actiekaarten). Puur een overzicht — je kunt hier niets spelen, het is bedoeld
// om naast het bord te leggen en om te controleren of code en drukwerk hetzelfde zeggen.
//
// Kristallen gebruiken renderCrystal() uit 96c-crystals.js, dus die zien er hier precies zo uit
// als in de kluis tijdens het spelen.
//
// Opdrachtkaarten worden hier nagetekend. Reden: de Canva-export van de opdrachtkaarten
// is vanuit deze omgeving niet te downloaden, en een nagetekende kaart heeft bovendien
// het voordeel dat de kamernaam meeloopt met de indeling — verschuif je 2.4 naar een
// andere tegel, dan verandert de kaart mee. Zodra er wél .webp-bestanden in
// src/assets/quests/ staan (bestandsnaam = het label, dus "2.1.webp") wint die foto,
// net als bij de actiekaarten.


// De kamer waar een opdracht op ligt, opgezocht via de tegel — dus als je de indeling of
// een tegel wijzigt, klopt de kaart nog steeds. Gangen hebben geen naam in ROOM_NAMES.
function questCardRoom(label){
  const tid = findLabelTile(label);
  if (!tid) return '—';
  return ROOM_NAMES[tid] || `Gang ${tid}`;
}

function renderQuestCardFace(label){
  const img = QUEST_CARD_IMAGES[label];
  const name = QUEST_NAMES[label] || label;
  if (img) return `<img src="${img}" alt="Opdracht ${label} — ${name}">`;
  const art = QUEST_CARD_ART[label];
  return `<span class="quest-card" style="--q-tint:${art.tint}">
    <span class="quest-card-top">
      <span class="quest-card-badge">${label}</span>
      <span class="quest-card-kicker">OPDRACHT</span>
    </span>
    <span class="quest-card-title">${name}</span>
    <svg class="quest-card-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${art.icon}</svg>
    <span class="quest-card-rule"></span>
    <span class="quest-card-foot">
      <span class="quest-card-kicker">KAMER</span>
      <span class="quest-card-room">${questCardRoom(label)}</span>
    </span>
  </span>`;
}

// ---------- opbouw van het tabblad ----------
const CARDS_CATEGORY_ORDER = ['amber', 'start', 'quest', 'danger'];
const CARDS_CATEGORY_LABELS = CRYSTAL_CATS;   // Beweging, Energie, Nut, Verstoring
const cardsQuestGrid  = document.getElementById('cardsQuestGrid');
const cardsActionWrap = document.getElementById('cardsActionWrap');
const cardsZoom       = document.getElementById('cardsZoom');
const cardsZoomFace   = document.getElementById('cardsZoomFace');
const cardsZoomCap    = document.getElementById('cardsZoomCap');

// één kaart in de vitrine: de kaart zelf plus een bijschrift, aanklikbaar om te vergroten
function cardsShelfItem(face, tintClass, tintStyle, name, sub){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card-show' + (tintClass ? ' ' + tintClass : '');
  if (tintStyle) btn.style.setProperty('--card-tint', tintStyle);
  btn.innerHTML = `<span class="card-show-face">${face}</span>
    <span class="card-show-cap"><b>${name}</b><span>${sub}</span></span>`;
  btn.addEventListener('click', () => openCardsZoom(face, tintClass, tintStyle, name, sub));
  return btn;
}

function openCardsZoom(face, tintClass, tintStyle, name, sub){
  cardsZoomFace.className = 'cards-zoom-face' + (tintClass ? ' ' + tintClass : '');
  if (tintStyle) cardsZoomFace.style.setProperty('--card-tint', tintStyle);
  else cardsZoomFace.style.removeProperty('--card-tint');
  cardsZoomFace.innerHTML = face;
  cardsZoomCap.innerHTML = `<b>${name}</b><span>${sub}</span>`;
  cardsZoom.hidden = false;
}
function closeCardsZoom(){ cardsZoom.hidden = true; }

// Wordt opnieuw gedraaid zodra je het tabblad opent: de kamernaam op een opdrachtkaart
// hangt aan de tegel, en die kan intussen bewerkt of verplaatst zijn.
// uitleg boven de kristallen, uit de spelgegevens (liep anders uit de pas bij een nieuw kristal of aantal)
function cardsCrystalHintHtml(){
  const words = ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
    'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien', 'twintig'];
  const w = n => words[n] || String(n);
  const ids = ACTION_CARD_IDS;
  const total = ids.reduce((n, id) => n + actionCardCopies(id), 0);
  const counts = ids.map(id => actionCardCopies(id));
  const usual = counts.sort((a, b) => counts.filter(x => x === b).length - counts.filter(x => x === a).length)[0];
  const extra = ids.filter(id => actionCardCopies(id) !== usual).map(id => `van de ${ACTION_CARDS[id].name} <b>${w(actionCardCopies(id))}</b>`);
  return `Alle ${w(ids.length)} kristallen, gegroepeerd per soort. Van elk kristal zitten er <b>${w(usual)}</b> in de gedeelde stapel` +
    (extra.length ? `, ${extra.join(', ')}` : '') + ` (${total} kristallen); je krijgt er een zodra je een opdracht voltooit, ` +
    `of als je over het kristalvakje van een gang loopt (dat hooguit 1x per beurt), en bewaart er hoogstens ${w(ACTION_CARD_HAND_MAX)} in je kluis. ` +
    `Tik of klik een kristal aan om het groot te bekijken.`;
}
function renderCardsTab(){
  const hintEl = document.getElementById('cardsCrystalHint');
  if (hintEl) hintEl.innerHTML = cardsCrystalHintHtml();
  cardsQuestGrid.innerHTML = '';
  for (const label of QUEST_CARD_IDS){
    const tint = QUEST_CARD_ART[label].tint;
    // Het nummer staat al groot op de kaart zelf; in het bijschrift eiste "2.1 · " kostbare
    // breedte op, waardoor de naam op een telefoon middenin een woord afbrak.
    cardsQuestGrid.appendChild(cardsShelfItem(
      renderQuestCardFace(label), '', tint,
      QUEST_NAMES[label] || label,
      `${label} · kamer ${questCardRoom(label)}`,
    ));
  }

  if (cardsActionWrap.childElementCount) return;   // actiekaarten veranderen niet, één keer bouwen
  for (const cat of CARDS_CATEGORY_ORDER){
    const ids = ACTION_CARD_IDS.filter(id => ACTION_CARD_TINTS[id] === cat);
    if (!ids.length) continue;
    const head = document.createElement('h3');
    head.className = 'cards-subhead';
    head.innerHTML = `${CARDS_CATEGORY_LABELS[cat]} <span>${ids.length} ${ids.length === 1 ? 'kristal' : 'kristallen'}</span>`;
    head.style.setProperty('--card-tint', `var(--crystal-${cat})`);
    cardsActionWrap.appendChild(head);
    const grid = document.createElement('div');
    grid.className = 'cards-shelf crystal-shelf';
    for (const id of ids){
      // naam en uitleg staan al op het kristal zelf; het bijschrift zegt wannéér hij mag
      grid.appendChild(cardsShelfItem(
        renderCrystal(id), 'is-crystal', '',
        ACTION_CARDS[id].name, `${CRYSTAL_WHEN[ACTION_CARDS[id].when]} · ${actionCardCopies(id)}×`,
      ));
    }
    cardsActionWrap.appendChild(grid);
  }
}

cardsZoom.addEventListener('click', closeCardsZoom);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !cardsZoom.hidden) closeCardsZoom();
});
