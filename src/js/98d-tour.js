// ===================== RONDLEIDING OP HET BORD (knop op het tabblad Spelregels) =====================
// Gebruikerswens 2026-11: de spelregels zijn vrij theoretisch; een rondleiding over een ECHT bord
// (de kaart die nu op het tabblad Kaart ligt) waarin steeds één onderdeel in de schijnwerpers staat,
// met een kort tekstvak ernaast. Geen echt potje: per stap speelt een kleine animatie in een lus tot
// je naar de volgende stap gaat. Zie docs/rondleiding.md.
//
// Opbouw: één scherm over alles heen (#tourOverlay): links het bord (dezelfde .cell-klassen als op
// het tabblad Spelen, dus het ziet er precies zo uit), rechts het tekstvak met Vorige/Volgende.
// Schijnwerper = #tourBoard.is-spot + .tour-hi op de vakjes die meedoen (de rest dimt, alleen
// opacity). Pion = één los element dat via --c/--r over het raster schuift (transform-transitie).
// Elke stap heeft een async `play(t)` die in een lus loopt; `tourSleep` geeft false zodra je van
// stap wisselt (t = tour.token), dan stopt de lus vanzelf. Alles wat een stap op het bord zet,
// ruimt tourClearStep weer op.

const TOUR_W = TILE_COLS * TILE_W, TOUR_H = TILE_ROWS * TILE_H;
let tour = null;

function tourKey(R, C){ return R * TOUR_W + C; }
function tourRC(k){ return [Math.floor(k / TOUR_W), k % TOUR_W]; }

// ---------- het bord lezen ----------
function tourReadBoard(){
  const types = new Array(TOUR_W * TOUR_H).fill('');
  const labels = {};
  const room = new Set();
  const byType = { walk: [], quest: [], start: [], actioncell: [], grate: [] };
  for (let R = 0; R < TOUR_H; R++){
    for (let C = 0; C < TOUR_W; C++){
      const slot = Math.floor(R / TILE_H) * TILE_COLS + Math.floor(C / TILE_W);
      const tid = layout[slot];
      const v = getDisplayValue(tid, R % TILE_H, C % TILE_W);
      const t = cellType(v);
      if (!t) continue;
      const k = tourKey(R, C);
      types[k] = t;
      byType[t].push(k);
      if (typeof v === 'string') labels[v] = k;
      if (ROOM_NAMES[tid]) room.add(k);
    }
  }
  return { types, labels, room, byType };
}
function tourNeighbors(k){
  const [R, C] = tourRC(k), out = [];
  if (R > 0) out.push(k - TOUR_W);
  if (R < TOUR_H - 1) out.push(k + TOUR_W);
  if (C > 0) out.push(k - 1);
  if (C < TOUR_W - 1) out.push(k + 1);
  return out.filter(n => tour.info.types[n]);
}
// kortste paden vanaf `from` (prev = vorige vakje op de kortste route)
function tourBfs(from){
  const dist = new Int32Array(TOUR_W * TOUR_H).fill(-1), prev = new Int32Array(TOUR_W * TOUR_H).fill(-1);
  const q = [from];
  dist[from] = 0;
  for (let i = 0; i < q.length; i++){
    for (const n of tourNeighbors(q[i])) if (dist[n] < 0){ dist[n] = dist[q[i]] + 1; prev[n] = q[i]; q.push(n); }
  }
  return { dist, prev };
}
function tourPath(bfs, to){
  const p = [];
  for (let k = to; k >= 0; k = bfs.prev[k]) p.unshift(k);
  return p;
}
// een route die over `mid` loopt: `before` stappen ervoor en `after` erna, zonder U-turn
function tourRouteThrough(mid, before, after, avoid = new Set()){
  const b = tourBfs(mid);
  const cands = [];
  for (let k = 0; k < b.dist.length; k++) if (b.dist[k] === before && !avoid.has(k)) cands.push(k);
  for (const a of cands){
    const inPath = tourPath(b, a);                       // mid … a
    const firstIn = inPath[1];
    for (let k = 0; k < b.dist.length; k++){
      if (b.dist[k] !== after || avoid.has(k)) continue;
      const outPath = tourPath(b, k);                    // mid … k
      if (outPath[1] === firstIn) continue;              // zelfde kant op = U-turn
      return inPath.slice().reverse().concat(outPath.slice(1));
    }
  }
  return null;
}

// ---------- opbouw van het scherm ----------
function tourBuild(){
  const ov = document.createElement('div');
  ov.id = 'tourOverlay';
  ov.className = 'tour';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-label', 'Rondleiding op het bord');
  ov.innerHTML = `
    <div class="tour-stage"><div class="tour-board-wrap"><div id="tourBoard" class="tour-board"></div></div></div>
    <aside class="tour-card panel">
      <div class="tour-top"><span class="tour-count"></span><button type="button" class="tour-close" aria-label="Rondleiding sluiten">✕</button></div>
      <h3 class="tour-title"></h3>
      <div class="tour-body"></div>
      <div class="tour-extra"></div>
      <div class="tour-dots"></div>
      <div class="tour-nav"><button type="button" class="ghost tour-prev">Vorige</button><button type="button" class="primary tour-next">Volgende</button></div>
    </aside>`;
  document.body.appendChild(ov);
  ov.querySelector('.tour-close').addEventListener('click', tourClose);
  ov.querySelector('.tour-prev').addEventListener('click', () => tourGo(tour.step - 1));
  ov.querySelector('.tour-next').addEventListener('click', () => {
    if (tour.step >= TOUR_STEPS.length - 1){ tourClose(); if (typeof switchTab === 'function') switchTab('walk'); }
    else tourGo(tour.step + 1);
  });
  ov.querySelector('.tour-dots').addEventListener('click', (e) => {
    const d = e.target.closest('[data-step]');
    if (d) tourGo(+d.dataset.step);
  });
  document.addEventListener('keydown', (e) => {
    if (!tour || ov.hidden) return;
    if (e.key === 'Escape') tourClose();
    else if (e.key === 'ArrowRight') tourGo(tour.step + 1);
    else if (e.key === 'ArrowLeft') tourGo(tour.step - 1);
  });
  return ov;
}

function tourRenderBoard(){
  const board = tour.board;
  board.innerHTML = '';
  tour.cells = [];
  const info = tour.info;
  for (let R = 0; R < TOUR_H; R++){
    for (let C = 0; C < TOUR_W; C++){
      const k = tourKey(R, C), t = info.types[k];
      const div = document.createElement('div');
      div.className = 'cell' + (t ? ' ' + t : '') + (t === 'walk' && info.room.has(k) ? ' room-tile' : '');
      if (R % TILE_H === 0 && C % TILE_W === 0){
        const slot = Math.floor(R / TILE_H) * TILE_COLS + Math.floor(C / TILE_W);
        const name = ROOM_NAMES[layout[slot]];
        if (name){
          div.classList.add('has-badge');
          const lab = document.createElement('span');
          lab.className = 'room-label';
          lab.textContent = name;
          div.appendChild(lab);
        }
      }
      board.appendChild(div);
      tour.cells.push(div);
    }
  }
}

function tourOpen(){
  const ov = document.getElementById('tourOverlay') || tourBuild();
  tour = { step: 0, token: 0, timers: [], board: ov.querySelector('#tourBoard'), ov, info: tourReadBoard(), cells: [] };
  tourRenderBoard();
  ov.querySelector('.tour-dots').innerHTML = TOUR_STEPS.map((s, i) =>
    `<button type="button" data-step="${i}" aria-label="Stap ${i + 1}: ${s.title}"></button>`).join('');
  ov.hidden = false;
  document.body.classList.add('is-touring');
  tourGo(0);
}
function tourClose(){
  if (!tour) return;
  tourClearStep();
  tour.ov.hidden = true;
  document.body.classList.remove('is-touring');
}

// ---------- per stap ----------
function tourSleep(ms){
  const t = tour.token;
  return new Promise(res => tour.timers.push(setTimeout(() => res(tour && tour.token === t && !tour.ov.hidden), ms)));
}
function tourClearStep(){
  tour.token++;
  tour.timers.forEach(clearTimeout);
  tour.timers = [];
  tour.board.classList.remove('is-spot');
  tour.board.querySelectorAll('.tour-pawn, .tour-fx, .walk-portal').forEach(el => el.remove());
  for (const div of tour.cells) div.classList.remove('tour-hi', 'tour-trail', 'tour-done', 'tour-target', 'has-portal');
}
// schijnwerper op een lijst vakjes (null = hele bord gewoon zichtbaar)
function tourSpot(keys){
  for (const div of tour.cells) div.classList.remove('tour-hi');
  if (!keys){ tour.board.classList.remove('is-spot'); return; }
  tour.board.classList.add('is-spot');
  for (const k of keys) if (tour.cells[k]) tour.cells[k].classList.add('tour-hi');
}
function tourPawn(colorIdx, key){
  const p = document.createElement('div');
  p.className = 'tour-pawn';
  p.style.setProperty('--pc', WALK_PLAYER_COLORS[colorIdx % WALK_PLAYER_COLORS.length]);
  p.innerHTML = '<i></i>';
  tour.board.appendChild(p);
  tourMove(p, key, true);
  return p;
}
function tourMove(p, key, instant){
  const [R, C] = tourRC(key);
  if (instant){
    p.style.transition = 'none';
    p.style.setProperty('--c', C); p.style.setProperty('--r', R);
    p.getBoundingClientRect();              // nieuwe plek vastleggen vóór de transitie terugkomt (niet tijdens een potje)
    p.style.transition = '';
  } else {
    p.style.setProperty('--c', C); p.style.setProperty('--r', R);
  }
}
function tourFx(key, cls, html, keyframes, opts){
  const [R, C] = tourRC(key);
  const el = document.createElement('div');
  el.className = 'tour-fx ' + cls;
  el.style.setProperty('--c', C); el.style.setProperty('--r', R);
  el.innerHTML = html || '';
  tour.board.appendChild(el);
  const a = el.animate(keyframes, opts);
  a.onfinish = () => el.remove();
  return el;
}
function tourBurst(key, color){
  tourFx(key, 'tour-burst', '', [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(2.6)', opacity: 0 }],
    { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }).style.setProperty('--bc', color);
}
function tourPortalAt(key, red){
  const cell = tour.cells[key];
  cell.classList.add('has-portal');
  const el = document.createElement('i');
  el.className = 'walk-portal ' + (red ? 'is-red' : 'is-blue');
  el.innerHTML = '<b></b>';
  cell.appendChild(el);
}
// pion stap voor stap over een pad; spoor blijft liggen tot de lus opnieuw begint
async function tourWalk(p, path, ms = 320, onStep){
  for (let i = 1; i < path.length; i++){
    tourMove(p, path[i]);
    tour.cells[path[i - 1]].classList.add('tour-trail');
    if (onStep) onStep(path[i], i);
    if (!(await tourSleep(ms))) return false;
  }
  return true;
}
function tourClearTrail(){ for (const div of tour.cells) div.classList.remove('tour-trail', 'tour-done'); }
function tourExtra(html){ tour.ov.querySelector('.tour-extra').innerHTML = html; }
function tourDice(a, b, cls = ''){
  return `<div class="tour-dice ${cls}"><span class="rules-die">${diceDieHtml(a)}</span><span class="rules-die">${diceDieHtml(b)}</span>` +
    (a === '?' ? '' : `<b>= ${a + b} stappen</b>`) + `</div>`;
}

function tourGo(i){
  if (!tour) return;
  i = Math.max(0, Math.min(TOUR_STEPS.length - 1, i));
  tourClearStep();
  tour.step = i;
  const s = TOUR_STEPS[i], ov = tour.ov;
  ov.querySelector('.tour-count').textContent = `Stap ${i + 1} van ${TOUR_STEPS.length}`;
  ov.querySelector('.tour-title').textContent = s.title;
  ov.querySelector('.tour-body').innerHTML = typeof s.text === 'function' ? s.text() : s.text;
  tourExtra('');
  ov.querySelectorAll('.tour-dots [data-step]').forEach((d, j) => d.classList.toggle('is-on', j === i));
  ov.querySelector('.tour-prev').disabled = i === 0;
  ov.querySelector('.tour-next').textContent = i === TOUR_STEPS.length - 1 ? 'Start een potje' : 'Volgende';
  const t = tour.token;
  // pas starten als dit nog de stap is: bij snel doorklikken zou een oudere stap anders zijn eerste
  // stukje (vóór de eerste tourSleep) nog uitvoeren en daarna met het token van de nieuwe stap verder
  // slapen (gezien: de kamers van stap 1 bleven in de schijnwerper staan)
  Promise.resolve().then(() => { if (tour && tour.token === t) return s.play(t); })
    .catch(err => console.error('Rondleiding', s.title, err));
}

// ---------- de stappen ----------
const TOUR_STEPS = [
  { title: 'Welkom aan boord', text: `<p>Dit is het speelbord: een ruimteschip van <b>20 tegels</b>. Elke keer ziet het schip er anders uit.</p>
      <p>Je loopt over de vakjes, <b>recht</b> vooruit of opzij, <b>nooit schuin</b>.</p>`,
    async play(){
      const info = tour.info;
      const all = info.types.map((t, k) => t ? k : -1).filter(k => k >= 0);
      const rooms = all.filter(k => info.room.has(k)), halls = all.filter(k => !info.room.has(k));
      tourExtra('<div class="tour-chips"><span data-c="room">Kamers</span><span data-c="hall">Gangen</span></div>');
      const chips = tour.ov.querySelectorAll('.tour-chips span');
      do {
        tourSpot(null); chips.forEach(c => c.classList.remove('is-on'));
        if (!(await tourSleep(1600))) return;
        tourSpot(rooms); chips[0].classList.add('is-on'); chips[1].classList.remove('is-on');
        if (!(await tourSleep(2200))) return;
        tourSpot(halls); chips[1].classList.add('is-on'); chips[0].classList.remove('is-on');
      } while (await tourSleep(2200));
    } },

  { title: 'Wie begint?', text: `<p>Iedereen gooit met <b>2 stenen</b>. Wie het hoogst gooit, kiest als eerste een <b>startvakje</b> in Hibernatie, daarna de rest.</p>
      <p>In die volgorde speel je ook de beurten.</p>`,
    async play(){
      const starts = ['3.1', '3.2', '3.3', '3.4'].map(l => tour.info.labels[l]).filter(k => k !== undefined);
      tourSpot(starts);
      tourExtra(tourDice(5, 6));
      do {
        tour.board.querySelectorAll('.tour-pawn').forEach(el => el.remove());
        if (!(await tourSleep(700))) return;
        for (let i = 0; i < starts.length; i++){
          tourPawn(i, starts[i]);
          tourBurst(starts[i], WALK_PLAYER_COLORS[i]);
          if (!(await tourSleep(650))) return;
        }
      } while (await tourSleep(1800));
    } },

  { title: 'Je opdrachten', text: () => `<p>Op het bord liggen <b>9 opdrachtvakjes</b>, één in elke kamer.</p>
      <p>Iedereen heeft een eigen, geheime stapel opdrachten. Je ziet alleen je <b>volgende</b> opdracht: daar loop je naartoe.</p>`,
    async play(){
      const quests = tour.info.byType.quest;
      tourSpot(quests);
      let i = 0;
      do {
        quests.forEach(k => tour.cells[k].classList.remove('tour-target'));
        const k = quests[i++ % quests.length];
        tour.cells[k].classList.add('tour-target');
        const lb = Object.keys(tour.info.labels).find(l => tour.info.labels[l] === k);
        const tid = lb ? findLabelTile(lb) : null;
        tourExtra(lb ? `<div class="tour-quest" style="--qtint:${questTint(lb)}"><b>${QUEST_NAMES[lb] || ''}</b><span>in de ${tid !== null ? (ROOM_NAMES[tid] || '') : ''}</span></div>` : '');
      } while (await tourSleep(1700));
    } },

  { title: 'Dobbelen en lopen', text: `<p>Gooi <b>2 stenen</b> en loop <b>precies</b> zoveel stappen.</p>
      <p>Je mag niet omkeren in je beurt, en een vakje met een andere pion is bezet.</p>`,
    async play(){
      const from = tour.info.labels['3.1'] ?? tour.info.byType.start[0];
      const b = tourBfs(from);
      let to = -1;
      for (let k = 0; k < b.dist.length; k++) if (b.dist[k] === 7 && !tour.info.room.has(k)){ to = k; break; }
      if (to < 0) for (let k = 0; k < b.dist.length; k++) if (b.dist[k] === 7){ to = k; break; }
      if (to < 0){ tourSpot(null); return; }
      const path = tourPath(b, to);
      tourSpot(path);
      const p = tourPawn(0, from);
      do {
        tourClearTrail(); tourMove(p, from, true);
        tourExtra(tourDice('?', '?'));
        if (!(await tourSleep(900))) return;
        tourExtra(tourDice(3, 4, 'is-rolled'));
        if (!(await tourSleep(700))) return;
        if (!(await tourWalk(p, path))) return;
      } while (await tourSleep(1600));
    } },

  { title: 'Een opdracht halen', text: `<p>Kom je op je opdrachtvakje, dan heb je de opdracht. Ook als je er <b>overheen</b> loopt.</p>
      <p>Je loopt gewoon door met de rest van je worp. Daarna wordt de volgende opdracht je doel.</p>`,
    async play(){
      const q = tour.info.labels['2.1'] ?? tour.info.byType.quest[0];
      const path = tourRouteThrough(q, 3, 3) || tourRouteThrough(q, 2, 2);
      if (!path){ tourSpot([q]); return; }
      tourSpot(path);
      tour.cells[q].classList.add('tour-target');
      const p = tourPawn(0, path[0]);
      do {
        tourClearTrail(); tour.cells[q].classList.add('tour-target'); tourMove(p, path[0], true);
        tourExtra(tourDice(path.length - 1 - 2, 2, 'is-rolled'));
        if (!(await tourSleep(900))) return;
        const ok = await tourWalk(p, path, 340, (k) => {
          if (k !== q) return;
          tour.cells[q].classList.remove('tour-target');
          tour.cells[q].classList.add('tour-done');
          tourBurst(q, '#55d68a');
        });
        if (!ok) return;
      } while (await tourSleep(1600));
    } },

  { title: 'Energie', text: () => `<p>Je gooit elke beurt ook de <b>energiesteen</b> (${ENERGY_DIE_FACES.join(', ')}). Je spaart tot <b>${ENERGY_MAX}</b> energie.</p>
      <p>Wat je gooit, geef je pas <b>volgende beurt</b> uit, altijd <b>vóór</b> je dobbelt.</p>`,
    async play(){
      tourSpot([]);
      let e = 0, i = 0;
      const faces = ENERGY_DIE_FACES;
      do {
        const roll = faces[(i++ * 5 + 2) % faces.length];
        e = e + roll > ENERGY_MAX ? 0 : e + roll;
        tourExtra(`<div class="tour-energy"><span class="rules-die">${diceEnergyDieHtml(roll)}</span>` +
          `<span class="tour-meter">${Array.from({ length: ENERGY_MAX }, (_, j) => `<i class="${j < e ? 'is-on' : ''}"></i>`).join('')}</span><b>${e}</b></div>`);
      } while (await tourSleep(1500));
    } },

  { title: 'Energie uitgeven', text: `<p>Met energie koop je een <b>actie</b>, hooguit één per beurt, vóór je dobbelt.</p>
      <p>Hier: de <b>zwaartekracht-laarzen</b> schieten je eerst rechtdoor tot een muur.</p>`,
    async play(){
      const acts = Object.entries(ENERGY_ACTIONS).filter(([id]) => id !== 'none').sort((a, b) => a[1].cost - b[1].cost);
      tourExtra(`<ul class="tour-acts">${acts.map(([id, a]) => `<li${id === 'gravity' ? ' class="is-on"' : ''}><span>${a.name}</span><b>${a.cost}</b></li>`).join('')}</ul>`);
      // een gangvakje met een lange rechte lijn
      let best = null;
      for (const k of tour.info.byType.walk){
        if (tour.info.room.has(k)) continue;
        for (const d of [1, -1, TOUR_W, -TOUR_W]){
          const line = [k];
          let cur = k;
          while (line.length <= (typeof GRAVITY_DASH_STEPS !== 'undefined' ? GRAVITY_DASH_STEPS : 8)){
            const n = cur + d;
            if (Math.abs(d) === 1 && Math.floor(n / TOUR_W) !== Math.floor(cur / TOUR_W)) break;
            if (n < 0 || n >= tour.info.types.length || !tour.info.types[n]) break;
            line.push(n); cur = n;
          }
          if (!best || line.length > best.length) best = line;
        }
        if (best && best.length >= 7) break;
      }
      if (!best){ tourSpot(null); return; }
      tourSpot(best);
      const p = tourPawn(0, best[0]);
      do {
        tourClearTrail(); tourMove(p, best[0], true);
        if (!(await tourSleep(1000))) return;
        p.classList.add('is-dash');
        best.slice(0, -1).forEach(k => tour.cells[k].classList.add('tour-trail'));
        tourMove(p, best[best.length - 1]);
        if (!(await tourSleep(700))) return;
        p.classList.remove('is-dash');
        tourBurst(best[best.length - 1], WALK_PLAYER_COLORS[0]);
      } while (await tourSleep(1600));
    } },

  { title: 'Kristallen', text: () => `<p>In elke gang ligt een <b>kristalvakje</b>. Loop je eroverheen, dan krijg je een kristal: een eenmalige extra kracht.</p>
      <p>Hooguit één per beurt, en je kluis houdt er <b>${ACTION_CARD_HAND_MAX}</b>.</p>`,
    async play(){
      const cells = tour.info.byType.actioncell;
      const c = cells[0];
      const path = c !== undefined ? (tourRouteThrough(c, 2, 2) || tourRouteThrough(c, 1, 1)) : null;
      tourSpot(path ? cells.concat(path) : cells);
      if (!path) return;
      const p = tourPawn(1, path[0]);
      do {
        tourClearTrail(); tourMove(p, path[0], true);
        if (!(await tourSleep(900))) return;
        const ok = await tourWalk(p, path, 340, (k) => {
          if (k !== c) return;
          tourFx(c, 'tour-crystal', RULES_CRYSTAL, [
            { transform: 'translateY(0) scale(.6)', opacity: 0 },
            { transform: 'translateY(-60%) scale(1.4)', opacity: 1, offset: .3 },
            { transform: 'translateY(-260%) scale(1)', opacity: 0 },
          ], { duration: 1200, easing: 'ease-out' });
        });
        if (!ok) return;
      } while (await tourSleep(1500));
    } },

  { title: 'Portalen', text: `<p>Op het bord liggen een <b>blauw</b> en een <b>rood</b> portaal. Stap je erin, dan kom je uit het andere.</p>
      <p>Instappen kost één stap; daarna loop je verder met de rest van je worp.</p>`,
    async play(){
      const info = tour.info;
      const corr = info.byType.walk.filter(k => !info.room.has(k) && tourNeighbors(k).length === 2);
      let blue = -1, red = -1, best = -1;
      for (const a of corr.slice(0, 40)){
        const b = tourBfs(a);
        for (const k of corr) if (b.dist[k] > best && b.dist[k] < 30){ best = b.dist[k]; blue = a; red = k; }
        if (best >= 18) break;
      }
      if (blue < 0){ tourSpot(null); return; }
      const inPath = (() => { const b = tourBfs(blue); for (let k = 0; k < b.dist.length; k++) if (b.dist[k] === 2) return tourPath(b, k).reverse(); return [blue]; })();
      const outPath = (() => { const b = tourBfs(red); for (let k = 0; k < b.dist.length; k++) if (b.dist[k] === 2) return tourPath(b, k); return [red]; })();
      tourPortalAt(blue, false); tourPortalAt(red, true);
      tourSpot(inPath.concat(outPath));
      const p = tourPawn(2, inPath[0]);
      do {
        tourClearTrail(); tourMove(p, inPath[0], true); p.style.opacity = '';
        if (!(await tourSleep(900))) return;
        if (!(await tourWalk(p, inPath))) return;
        p.style.opacity = '0'; tourBurst(blue, '#3fa9ff');
        if (!(await tourSleep(500))) return;
        tourMove(p, red, true); p.style.opacity = ''; tourBurst(red, '#ff5d5d');
        if (!(await tourSleep(450))) return;
        if (!(await tourWalk(p, outPath))) return;
      } while (await tourSleep(1500));
    } },

  { title: 'Roosters', text: `<p>Elke gang heeft ook een <b>rooster</b>. Heb je een <b>schroevendraaier</b> (een energie-actie), dan kruip je door de luchtschacht naar een ander rooster.</p>
      <p>Kruipen kost geen stap; je loopt daarna gewoon door.</p>`,
    async play(){
      const gr = tour.info.byType.grate;
      tourSpot(gr);
      if (gr.length < 2) return;
      const g1 = gr[0];
      const b1 = tourBfs(g1);
      let g2 = gr[1];
      for (const g of gr) if (b1.dist[g] > b1.dist[g2]) g2 = g;
      const inPath = (() => { for (let k = 0; k < b1.dist.length; k++) if (b1.dist[k] === 2) return tourPath(b1, k).reverse(); return [g1]; })();
      const b2 = tourBfs(g2);
      const outPath = (() => { for (let k = 0; k < b2.dist.length; k++) if (b2.dist[k] === 2) return tourPath(b2, k); return [g2]; })();
      tourSpot(gr.concat(inPath, outPath));
      tourExtra(`<div class="tour-tool">${typeof crystalDriverSvg === 'function' ? crystalDriverSvg('color') : ''}<span>Schroevendraaier</span></div>`);
      const p = tourPawn(3, inPath[0]);
      do {
        tourClearTrail(); tourMove(p, inPath[0], true); p.style.opacity = '';
        if (!(await tourSleep(900))) return;
        if (!(await tourWalk(p, inPath))) return;
        if (!(await tourSleep(400))) return;
        p.style.opacity = '0'; tourBurst(g1, '#ff9f5c');
        if (!(await tourSleep(700))) return;
        tourMove(p, g2, true); p.style.opacity = ''; tourBurst(g2, '#ff9f5c');
        if (!(await tourSleep(450))) return;
        if (!(await tourWalk(p, outPath))) return;
      } while (await tourSleep(1500));
    } },

  { title: 'Winnen', text: () => `<p>Wie als eerste <b>${SIM_QUESTS_TO_WIN} opdrachten</b> voltooit, wint.</p>
      <p>Veel plezier! In het tabblad Spelregels staat alles nog eens precies uitgelegd.</p>`,
    async play(){
      tourSpot(null);
      let n = 0;
      do {
        n = n >= SIM_QUESTS_TO_WIN ? 0 : n + 1;
        tourExtra(`<div class="tour-win">${Array.from({ length: SIM_QUESTS_TO_WIN }, (_, j) =>
          `<span class="${j < n ? 'is-on' : ''}">${RULES_HEX}</span>`).join('')}<b>${n} / ${SIM_QUESTS_TO_WIN}</b></div>`);
      } while (await tourSleep(n >= SIM_QUESTS_TO_WIN ? 1800 : 700));
    } },
];

const btnTour = document.getElementById('btnTour');
if (btnTour) btnTour.addEventListener('click', tourOpen);
