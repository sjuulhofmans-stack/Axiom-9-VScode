// ---------- avatars (Multiplayer-lobby) ----------
// Gebruikerswens: in de kamer staan boven de chat 4 vierkante vakjes met het hoofd van een
// ruimtepoppetje per speler; rechts een editor met twee tabbladen: Karakter (5 stuks) en
// Accessoires (5 brillen + 5 hoedjes, pas te kiezen als je een karakter hebt). Een gekozen item
// staat meteen op je avatar. Alles is platte SVG in een vak van 100×100 (geen verlopen/ids, zodat
// tientallen kopieën op één pagina elkaar nooit storen). Alle hoofden hebben de ogen op dezelfde
// plek (40,54) en (60,54) en de bovenkant van het hoofd rond y=26, zodat elke bril en elk hoedje
// op elk karakter past.
//
// Een avatar is { c, g, h }: index in AVATAR_CHARS, AVATAR_GLASSES (-1 = geen) en AVATAR_HATS
// (-1 = geen). Gaat mee in de lobby-zitplaatsen (mp.seats[i].avatar, zie 99-multiplayer.js) en
// wordt per browser onthouden (localStorage, alleen voor het gemak).

function avatarStarPts(cx, cy, R, r){
  const pts = [];
  for (let i = 0; i < 10; i++){
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// kraag van het ruimtepak onder elk hoofd (kleur per karakter)
const avatarCollar = (suit, stripe, neck) =>
  `<rect x="43" y="74" width="14" height="12" fill="${neck}"/>` +
  `<path d="M24 100 Q24 83 50 83 Q76 83 76 100 Z" fill="${suit}"/>` +
  `<path d="M27 95 Q50 85 73 95" stroke="${stripe}" stroke-width="3" fill="none"/>`;

const AVATAR_CHARS = [
  { name: 'Kadet', svg:
    avatarCollar('#dfe6ee', '#ff8a3d', '#e2b48c') +
    `<ellipse cx="27" cy="56" rx="4" ry="6" fill="#e9b98f"/><ellipse cx="73" cy="56" rx="4" ry="6" fill="#e9b98f"/>` +
    `<ellipse cx="50" cy="54" rx="23" ry="26" fill="#f1c7a0"/>` +
    `<path d="M27 50 Q25 26 50 26 Q75 26 73 50 Q70 36 58 34 Q50 40 40 35 Q30 38 27 50Z" fill="#5a3825"/>` +
    `<path d="M35 47 Q40 45 44 47 M56 47 Q60 45 65 47" stroke="#5a3825" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/><ellipse cx="60" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/>` +
    `<circle cx="41" cy="52.8" r="1" fill="#fff"/><circle cx="61" cy="52.8" r="1" fill="#fff"/>` +
    `<circle cx="34" cy="63" r="3" fill="#f39a8a" opacity=".45"/><circle cx="66" cy="63" r="3" fill="#f39a8a" opacity=".45"/>` +
    `<path d="M43 67 Q50 72 57 67" stroke="#8a4a3a" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  { name: 'Zorp', svg:
    avatarCollar('#6c5ce7', '#a29bfe', '#79cc5f') +
    `<path d="M50 23 C73 23 80 37 78 50 C76 66 62 82 50 82 C38 82 24 66 22 50 C20 37 27 23 50 23Z" fill="#8be06f"/>` +
    `<circle cx="36" cy="34" r="2.5" fill="#6fc55a"/><circle cx="62" cy="31" r="3.5" fill="#6fc55a"/><circle cx="68" cy="40" r="2" fill="#6fc55a"/>` +
    `<ellipse cx="39" cy="54" rx="8" ry="5.5" transform="rotate(25 39 54)" fill="#111"/>` +
    `<ellipse cx="61" cy="54" rx="8" ry="5.5" transform="rotate(-25 61 54)" fill="#111"/>` +
    `<circle cx="37" cy="52" r="1.6" fill="#fff"/><circle cx="59" cy="52" r="1.6" fill="#fff"/>` +
    `<circle cx="48" cy="65" r=".9" fill="#2f6b25"/><circle cx="52" cy="65" r=".9" fill="#2f6b25"/>` +
    `<path d="M45 72 Q50 75 55 72" stroke="#2f6b25" stroke-width="1.8" fill="none" stroke-linecap="round"/>` },
  { name: 'B-0T', svg:
    avatarCollar('#4b5563', '#4ff0ff', '#7d8a98') +
    `<rect x="21" y="46" width="7" height="16" rx="2" fill="#6b7785"/><rect x="72" y="46" width="7" height="16" rx="2" fill="#6b7785"/>` +
    `<rect x="27" y="27" width="46" height="52" rx="9" fill="#a9b6c4"/>` +
    `<rect x="31" y="30" width="38" height="5" rx="2.5" fill="#c8d3de"/>` +
    `<circle cx="32" cy="74" r="1.6" fill="#7d8a98"/><circle cx="68" cy="74" r="1.6" fill="#7d8a98"/>` +
    `<circle cx="40" cy="54" r="6.5" fill="#0d2a33"/><circle cx="60" cy="54" r="6.5" fill="#0d2a33"/>` +
    `<circle cx="40" cy="54" r="3.8" fill="#4ff0ff"/><circle cx="60" cy="54" r="3.8" fill="#4ff0ff"/>` +
    `<rect x="38" y="66" width="24" height="7" rx="2" fill="#3b4652"/>` +
    `<path d="M43 66 V73 M48 66 V73 M53 66 V73 M58 66 V73" stroke="#a9b6c4" stroke-width="1.2"/>` },
  { name: 'Nebula', svg:
    avatarCollar('#1f2a44', '#ffd166', '#7a70e0') +
    `<path d="M29 52 L13 38 L22 64 Z" fill="#6f66d8"/><path d="M71 52 L87 38 L78 64 Z" fill="#6f66d8"/>` +
    `<ellipse cx="50" cy="54" rx="22" ry="26" fill="#8f86f5"/>` +
    `<path d="M29 46 Q32 25 52 26 Q71 27 72 46 Q62 34 50 37 Q39 33 29 46Z" fill="#e8f1ff"/>` +
    `<path d="M50 38 L53.5 42.5 L50 47 L46.5 42.5Z" fill="#ffd166"/>` +
    `<ellipse cx="40" cy="54" rx="4.4" ry="3.6" fill="#ffe066"/><ellipse cx="60" cy="54" rx="4.4" ry="3.6" fill="#ffe066"/>` +
    `<rect x="39.4" y="51" width="1.3" height="6" rx=".6" fill="#222"/><rect x="59.4" y="51" width="1.3" height="6" rx=".6" fill="#222"/>` +
    `<path d="M44 69 Q50 71 56 69" stroke="#4a3fb0" stroke-width="1.8" fill="none" stroke-linecap="round"/>` },
  { name: 'Cyborg', svg:
    avatarCollar('#2b2f36', '#ff3b3b', '#b97f5a') +
    `<ellipse cx="27" cy="56" rx="4" ry="6" fill="#b97f5a"/>` +
    `<ellipse cx="50" cy="54" rx="23" ry="26" fill="#c98e66"/>` +
    `<path d="M27.5 47 Q27 27 50 27 Q73 27 72.5 47 Q60 38 50 38 Q40 38 27.5 47Z" fill="#2b2b2b"/>` +
    `<path d="M51 30 Q72 31 73 54 Q72 75 52 80 Z" fill="#8e9aa8"/>` +
    `<rect x="73" y="50" width="5" height="12" rx="1.5" fill="#6b7785"/>` +
    `<circle cx="66" cy="40" r="1.3" fill="#5d6875"/><circle cx="68" cy="68" r="1.3" fill="#5d6875"/><circle cx="56" cy="75" r="1.3" fill="#5d6875"/>` +
    `<circle cx="60" cy="54" r="6" fill="#3a3f47"/><circle cx="60" cy="54" r="3.6" fill="#ff3b3b"/><circle cx="60" cy="54" r="1.4" fill="#ffd0d0"/>` +
    `<path d="M35 47 Q40 45 44 47" stroke="#2b2b2b" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="40" cy="54" rx="3" ry="3.4" fill="#2a1f1a"/><circle cx="41" cy="52.8" r="1" fill="#fff"/>` +
    `<path d="M42 69 L56 69" stroke="#7a4a35" stroke-width="2" stroke-linecap="round"/>` },
];

// box = uitsnede (viewBox) waarmee het item los als plaatje in de editor staat
const AVATAR_GLASSES = [
  { name: 'Vizier', box: '22 40 56 28', svg:
    `<rect x="26" y="46" width="48" height="15" rx="7.5" fill="#4ff0ff" fill-opacity=".55" stroke="#1d8fa8" stroke-width="2"/>` +
    `<path d="M31 50 L45 50" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round"/>` },
  { name: 'Pilotenbril', box: '22 40 56 28', svg:
    `<path d="M23 54 L31 54 M69 54 L77 54" stroke="#5a3a22" stroke-width="4"/>` +
    `<circle cx="40" cy="54" r="8.5" fill="#7fd6ff" fill-opacity=".45" stroke="#c9963a" stroke-width="3"/>` +
    `<circle cx="60" cy="54" r="8.5" fill="#7fd6ff" fill-opacity=".45" stroke="#c9963a" stroke-width="3"/>` +
    `<path d="M48 53 Q50 50.5 52 53" stroke="#c9963a" stroke-width="2.5" fill="none"/>` +
    `<path d="M36 50 L39 48 M56 50 L59 48" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` },
  { name: 'Sterrenbril', box: '22 40 56 28', svg:
    `<path d="M29 52 L25 50 M71 52 L75 50" stroke="#ff5fd2" stroke-width="2" stroke-linecap="round"/>` +
    `<polygon points="${avatarStarPts(40, 54.5, 11, 5)}" fill="#ff5fd2" fill-opacity=".85" stroke="#ffe1f6" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polygon points="${avatarStarPts(60, 54.5, 11, 5)}" fill="#ff5fd2" fill-opacity=".85" stroke="#ffe1f6" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M47 53 Q50 51 53 53" stroke="#ffe1f6" stroke-width="1.6" fill="none"/>` },
  { name: 'Scanner', box: '22 34 62 34', svg:
    `<path d="M68 53 L77 51 L82 40" stroke="#d8dee6" stroke-width="2.2" fill="none" stroke-linejoin="round"/>` +
    `<circle cx="82" cy="38.5" r="2.4" fill="#ff3355"/>` +
    `<circle cx="60" cy="54" r="8.5" fill="#ff3355" fill-opacity=".55" stroke="#d8dee6" stroke-width="2.6"/>` +
    `<path d="M60 48 V60 M54 54 H66" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>` },
  { name: 'Neonbril', box: '22 40 56 28', svg:
    `<path d="M26 51 L28 49 M74 51 L72 49" stroke="#39ff88" stroke-width="2"/>` +
    `<path d="M28 49 L48 49 L46 60 L31 60 Z" fill="#111" stroke="#39ff88" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M52 49 L72 49 L69 60 L54 60 Z" fill="#111" stroke="#39ff88" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M48 51 L52 51" stroke="#39ff88" stroke-width="2"/>` +
    `<path d="M32 52 L38 52" stroke="#39ff88" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>` },
];

const AVATAR_HATS = [
  { name: 'Ruimtehelm', box: '0 0 100 100', svg:
    `<circle cx="50" cy="55" r="40" fill="#bfefff" fill-opacity=".13" stroke="#cfefff" stroke-width="2.5"/>` +
    `<path d="M24 34 Q32 21 45 17" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-opacity=".75"/>` +
    `<path d="M72 82 Q78 76 81 69" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" stroke-opacity=".4"/>` +
    `<rect x="22" y="87" width="56" height="9" rx="4" fill="#9aa7b5" stroke="#6b7785" stroke-width="1.5"/>` },
  { name: 'Antennes', box: '18 2 64 44', svg:
    `<path d="M37 31 Q32 18 29 10 M63 31 Q68 18 71 10" stroke="#444c58" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="29" cy="9" r="4.2" fill="#7dff6a" stroke="#3fae36" stroke-width="1.2"/>` +
    `<circle cx="71" cy="9" r="4.2" fill="#7dff6a" stroke="#3fae36" stroke-width="1.2"/>` +
    `<path d="M27 41 Q50 22 73 41" stroke="#444c58" stroke-width="5" fill="none" stroke-linecap="round"/>` },
  { name: 'Kapiteinspet', box: '20 10 60 40', svg:
    `<path d="M26 38 Q26 17 50 17 Q74 17 74 38 Z" fill="#1f3a6b"/>` +
    `<rect x="25" y="34" width="50" height="6" rx="2" fill="#d4a63a"/>` +
    `<path d="M29 40 Q50 50 71 40 Q50 45 29 40Z" fill="#11213f"/>` +
    `<polygon points="${avatarStarPts(50, 26.5, 6.5, 2.8)}" fill="#ffd23f"/>` },
  { name: 'Mini-UFO', box: '26 0 48 38', svg:
    `<path d="M42 21 L35 34 L65 34 L58 21Z" fill="#9dff8a" fill-opacity=".28"/>` +
    `<path d="M41 17 Q50 3 59 17Z" fill="#9fe6ff" fill-opacity=".85" stroke="#cfefff" stroke-width="1"/>` +
    `<ellipse cx="50" cy="18" rx="17" ry="5" fill="#8e9aa8" stroke="#5d6875" stroke-width="1.5"/>` +
    `<circle cx="39" cy="18.5" r="1.4" fill="#ffd23f"/><circle cx="46" cy="19.5" r="1.4" fill="#ffd23f"/>` +
    `<circle cx="54" cy="19.5" r="1.4" fill="#ffd23f"/><circle cx="61" cy="18.5" r="1.4" fill="#ffd23f"/>` },
  { name: 'Saturnus', box: '26 2 48 34', svg:
    `<circle cx="50" cy="18" r="10" fill="#f0a35e"/>` +
    `<path d="M41 15 Q50 18 59 15 M41.5 21 Q50 23.5 58.5 21" stroke="#d9823f" stroke-width="1.8" fill="none"/>` +
    `<ellipse cx="50" cy="19" rx="20" ry="5" fill="none" stroke="#ffe2a8" stroke-width="2.6" transform="rotate(-12 50 19)"/>` },
];

function avatarClean(av){
  if (!av || typeof av !== 'object') return null;
  const ok = (v, list, allowNone) => Number.isInteger(v) && v >= (allowNone ? -1 : 0) && v < list.length;
  if (!ok(av.c, AVATAR_CHARS, false)) return null;
  return { c: av.c, g: ok(av.g, AVATAR_GLASSES, true) ? av.g : -1, h: ok(av.h, AVATAR_HATS, true) ? av.h : -1 };
}
function avatarSvg(av){
  av = avatarClean(av);
  if (!av) return '';
  return `<svg class="av-svg" viewBox="0 0 100 100" aria-hidden="true">` +
    AVATAR_CHARS[av.c].svg +
    (av.g >= 0 ? AVATAR_GLASSES[av.g].svg : '') +
    (av.h >= 0 ? AVATAR_HATS[av.h].svg : '') +
  `</svg>`;
}
function avatarItemSvg(item){
  return `<svg class="av-svg" viewBox="${item.box || '0 0 100 100'}" aria-hidden="true">${item.svg}</svg>`;
}

// ---------- mijn avatar (per browser onthouden) ----------
const AVATAR_STORE_KEY = 'axiom9-avatar';
let avatarMine = null;
try { avatarMine = avatarClean(JSON.parse(localStorage.getItem(AVATAR_STORE_KEY) || 'null')); } catch (e){ avatarMine = null; }
let avatarTab = 'char';
function avatarSetMine(av){
  avatarMine = avatarClean(av);
  try { localStorage.setItem(AVATAR_STORE_KEY, JSON.stringify(avatarMine)); } catch (e){}
  avatarRenderEditor();
  // 99-multiplayer.js: naar de host/iedereen in de kamer
  if (typeof mpOnMyAvatarChanged === 'function') mpOnMyAvatarChanged();
}

// ---------- de editor (rechterkolom in de kamer) ----------
function avatarRenderEditor(){
  const tabsEl = document.getElementById('mpAvatarTabs');
  const gridEl = document.getElementById('mpAvatarGrid');
  if (!tabsEl || !gridEl) return;
  const hasChar = !!avatarMine;
  if (!hasChar) avatarTab = 'char';
  for (const b of tabsEl.querySelectorAll('[data-av-tab]')){
    b.classList.toggle('active', b.dataset.avTab === avatarTab);
    if (b.dataset.avTab === 'items'){
      b.classList.toggle('is-locked', !hasChar);
      b.title = hasChar ? '' : 'Kies eerst een karakter';
    }
  }
  const btn = (kind, i, item, on, svg) =>
    `<button type="button" class="av-pick${on ? ' is-on' : ''}" data-av-kind="${kind}" data-av-i="${i}"` +
    ` title="${item.name}" aria-label="${item.name}" aria-pressed="${on}">${svg}</button>`;
  if (avatarTab === 'char'){
    gridEl.className = 'av-grid av-grid-chars';
    gridEl.innerHTML = AVATAR_CHARS.map((ch, i) =>
      btn('c', i, ch, hasChar && avatarMine.c === i, avatarSvg({ c: i, g: -1, h: -1 }))).join('');
  } else {
    gridEl.className = 'av-grid av-grid-items';
    gridEl.innerHTML =
      `<div class="av-row">${AVATAR_GLASSES.map((g, i) => btn('g', i, g, avatarMine.g === i, avatarItemSvg(g))).join('')}</div>` +
      `<div class="av-row">${AVATAR_HATS.map((h, i) => btn('h', i, h, avatarMine.h === i, avatarItemSvg(h))).join('')}</div>`;
  }
}
{
  const tabsEl = document.getElementById('mpAvatarTabs');
  const gridEl = document.getElementById('mpAvatarGrid');
  if (tabsEl) tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-av-tab]');
    if (!b) return;
    if (b.dataset.avTab === 'items' && !avatarMine){
      // even laten zien waarom het niet kan: de karakters lichten op
      if (gridEl){ gridEl.classList.remove('av-nudge'); void gridEl.offsetWidth; gridEl.classList.add('av-nudge'); }
      return;
    }
    avatarTab = b.dataset.avTab;
    avatarRenderEditor();
  });
  if (gridEl) gridEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-av-kind]');
    if (!b) return;
    const i = parseInt(b.dataset.avI, 10);
    const kind = b.dataset.avKind;
    if (kind === 'c'){
      // ander karakter: brillen en hoedjes blijven gewoon op
      avatarSetMine({ c: i, g: avatarMine ? avatarMine.g : -1, h: avatarMine ? avatarMine.h : -1 });
    } else if (avatarMine){
      // nog eens klikken op wat je al op hebt = weer af
      const next = { ...avatarMine };
      next[kind] = next[kind] === i ? -1 : i;
      avatarSetMine(next);
    }
  });
  avatarRenderEditor();
}

// ---------- de 4 vakjes boven de chat ----------
// seats = mp.seats (naam, peerId, avatar); altijd 4 vakjes, plekken voorbij het spelersaantal
// van de kamer blijven leeg en gedimd
function avatarRowHtml(seats, total, myPeerId){
  let html = '';
  for (let i = 0; i < 4; i++){
    const seat = seats[i];
    const color = WALK_PLAYER_COLORS[i % WALK_PLAYER_COLORS.length];
    if (!seat){
      html += `<div class="mp-avatar is-empty${i >= total ? ' is-unused' : ''}" style="--pc:${color}"></div>`;
      continue;
    }
    const svg = avatarSvg(seat.avatar);
    const you = seat.peerId === myPeerId;
    html += `<div class="mp-avatar${you ? ' is-you' : ''}" style="--pc:${color}">` +
      (svg || `<span class="mp-avatar-none">${you ? 'Kies rechts<br>een karakter' : 'Nog geen<br>avatar'}</span>`) +
      `<span class="mp-avatar-name">${mpEscapeHtml(seat.name)}</span></div>`;
  }
  return html;
}
