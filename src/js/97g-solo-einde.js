// ---------- eindscherm (na afloop, gebruikerswens: groot venster i.p.v. het kleine
// #walkStatus-regeltje alleen) ----------
// Zelfde grootte/rand als het bord (.walk-endgame in styles.css) en vervangt het zichtbaar
// zolang het open staat; "Toon kaart" (soloEndgameShowMap) verbergt 'm weer, het bord staat er
// dan gewoon nog onder, en "Toon uitslag" op dezelfde plek (#btnWalkEndgameShowResult) haalt 'm
// terug (gebruikersmelding: je kon niet meer terug naar het winscherm).
// Onder de titel staat het klassement 1 t/m 4 (soloEndgameRankingHtml), bij meer dan 1 speler.
// Ook gebruikt door modus Automatisch (96-walk.js), die zijn eigen `players` meegeeft en geen
// "jij" kent (`isMe` geeft daar altijd false).
function soloShowEndgame(trophy, title, sub, players = soloPlayers, isMe = soloIsMe){
  if (!walkEndgameEl || !walkEndgameCardEl) return;
  // bewaard voor de knop "Statistieken" (en "Terug naar de uitslag") hieronder
  soloEndgameView = { trophy, title, sub, players, isMe };
  // de dobbelstenen van de laatste beurt horen niet meer naast het winscherm (gebruikerswens)
  if (walkDiceEl) walkDiceEl.innerHTML = '';
  soloHideStepCounter();
  // en ook het vak eromheen, het energievak en het opdrachtenoverzicht niet (gebruikersmelding:
  // die bleven na afloop staan). Blijft zo bij "Toon kaart"; pas soloHideEndgame() haalt het weg.
  soloSetGameOverView(true);
  soloRenderEndgameResult();
  soloReopenEndgame();
}
let soloEndgameView = null;
// Embleem boven de titel i.p.v. de cartoonachtige 🏆-emoji (gebruikerswens): een zeshoekig
// insigne met een vierpuntige ster, in lijnen in de kleur van de winnaar (--pc). Bij een
// afgekapt potje dezelfde zeshoek, maar met een zandloper en grijs.
function soloEndgameEmblem(stuck){
  const hex = (r) => [0, 1, 2, 3, 4, 5].map(i => {
    const a = Math.PI / 3 * i - Math.PI / 2;
    return `${(40 + r * Math.cos(a)).toFixed(1)},${(40 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  const core = stuck
    ? `<path d="M28 24h24M28 56h24M30 24c0 10 20 10 20 16s-20 6-20 16M50 24c0 10-20 10-20 16s20 6 20 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
    : `<path d="M40 18 L44.5 35.5 L62 40 L44.5 44.5 L40 62 L35.5 44.5 L18 40 L35.5 35.5 Z" fill="currentColor" fill-opacity=".9"/>` +
      `<path d="M40 30 L42 38 L50 40 L42 42 L40 50 L38 42 L30 40 L38 38 Z" fill="#fff" fill-opacity=".85"/>`;
  return `<svg viewBox="0 0 80 80" width="76" height="76" aria-hidden="true">` +
    `<polygon points="${hex(37)}" fill="currentColor" fill-opacity=".08" stroke="currentColor" stroke-width="2"/>` +
    `<polygon points="${hex(30)}" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1" stroke-dasharray="3 4"/>` +
    core + `</svg>`;
}
function soloRenderEndgameResult(){
  const v = soloEndgameView;
  if (!v) return;
  const winner = v.players.find(p => p.rank === 1);
  const color = v.trophy === '⏳' || !winner ? 'var(--text-dim)' : winner.color;
  walkEndgameCardEl.innerHTML =
    `<span class="walk-endgame-trophy" style="--pc:${color}">${soloEndgameEmblem(v.trophy === '⏳')}</span>` +
    `<span class="walk-endgame-title">${v.title}</span>` +
    (v.sub ? `<span class="walk-endgame-sub">${v.sub}</span>` : '') +
    (v.players.length > 1 ? soloEndgameRankingHtml(v.players, v.isMe) : '') +
    `<div class="walk-endgame-btns">` +
    (v.players.some(p => p.stats)
      ? `<button type="button" class="ghost walk-endgame-stats-btn" data-endgame-stats>Statistieken</button>` : '') +
    // sinds de kop tijdens een potje weg is (2026-11) zit "Terug naar lobby" in het uitschuifmenu;
    // na afloop staat hij ook hier, zodat je hem niet hoeft te zoeken
    `<button type="button" class="ghost walk-endgame-stats-btn" data-endgame-lobby>Terug naar lobby</button>` +
    `</div>`;
}
// Bots spelen → "Stoppen" (heet dan al Terug naar lobby), Multiplayer → "Verlaat potje",
// Zelf spelen → zelfde als Nieuw potje (zonder bevestiging: het potje is toch al af)
function soloEndgameToLobby(){
  if (window.mpGameActive && btnMpLeaveGame && !btnMpLeaveGame.hidden) btnMpLeaveGame.click();
  else if (btnWalkStop && !btnWalkStop.hidden) btnWalkStop.click();
  else walkResetConfirmedReset();
}
// ---------- statistieken per speler (pop-up via de knop op het winscherm) ----------
// De tellers zelf lopen tijdens het spel mee (newPlayerStats in 95-simulate.js); wat af te leiden
// is wordt hier pas uitgerekend. Elke categorie is een eigen tabel (hoogstens 3 naast elkaar,
// zie .walk-stats-cats in styles.css). `best`: 'max' of 'min' — die waarde wordt in de rij
// uitgelicht (alleen bij meer dan één speler).
const turnsOf = p => p.myTurn || p.ownTurns || 0;
const perOf = (a, b) => b ? a / b : 0;
const SOLO_STATS_GROUPS = [
  { title: 'Algemeen', rows: [
    { label: 'Opdrachten voltooid', best: 'max', get: p => p.completed, fmt: v => `${v}/${SIM_QUESTS_TO_WIN}` },
    { label: 'Beurten gespeeld', get: turnsOf },
    { label: 'Beurten per opdracht', best: 'min', get: p => perOf(turnsOf(p), p.completed), fmt: v => v ? nl(v, 1) : '—' },
  ]},
  { title: 'Dobbelstenen', rows: [
    { label: 'Loopstenen gegooid', get: p => p.stats.dice },
    { label: 'Ogen gegooid', best: 'max', get: p => p.stats.pips },
    { label: 'Gemiddeld per steen', best: 'max', get: p => perOf(p.stats.pips, p.stats.dice), fmt: v => nl(v, 2) },
    { label: 'Ogen per beurt', best: 'max', get: p => perOf(p.stats.pips, turnsOf(p)), fmt: v => nl(v, 1) },
  ]},
  { title: 'Verplaatsing', rows: [
    { label: 'Vakjes gelopen', best: 'max', get: p => p.stats.walkSteps },
    { label: 'Vakjes gesprint (laarzen)', best: 'max', get: p => p.stats.dashSteps },
    { label: 'Totaal verplaatst', best: 'max', get: p => p.stats.walkSteps + p.stats.dashSteps },
    { label: 'Vakjes per beurt', best: 'max', get: p => perOf(p.stats.walkSteps + p.stats.dashSteps, turnsOf(p)), fmt: v => nl(v, 1) },
  ]},
  { title: 'Energie', rows: [
    { label: 'Gedobbeld (energiesteen)', best: 'max', get: p => p.stats.energyRolled },
    { label: 'Erbij (ook via kristallen)', best: 'max', get: p => p.stats.energyGained },
    { label: 'Verloren (voorraad vol)', best: 'min', get: p => p.stats.energyWasted },
    { label: 'Over aan het eind', get: p => p.energy },
  ]},
  { title: 'Energie-acties', rows: [
    { label: 'Ingezet', best: 'max', get: p => p.actionUses || 0 },
    { label: 'Energie verbruikt', best: 'max', get: p => p.stats.energySpent || 0 },
    { label: 'Gemiddeld per actie', get: p => perOf(p.stats.energySpent || 0, p.actionUses || 0), fmt: v => v ? nl(v, 1) : '—' },
    // één rij (de groep blijft zo 4 hoog, net als de rest: de pop-up past zonder scrollen)
    { label: 'Portalen geschoten / door gestapt', get: p => (p.stats.portalShots || 0) * 1000 + (p.stats.portalJumps || 0),
      fmt: v => `${Math.floor(v / 1000)} / ${v % 1000}` },
  ]},
  { title: 'Kristallen', rows: [
    { label: 'Opgeraapt', best: 'max', get: p => p.stats.cardsPlayed + p.stats.cardsDiscarded + p.cards.length },
    { label: 'Gebruikt', best: 'max', get: p => p.stats.cardsPlayed },
    { label: 'Afgelegd', get: p => p.stats.cardsDiscarded },
    { label: 'Nog in de kluis', get: p => p.cards.length },
  ]},
];
const walkStatsOverlayEl = document.getElementById('walkStatsOverlay');
const walkStatsBodyEl = document.getElementById('walkStatsBody');
function soloOpenStats(){
  const v = soloEndgameView;
  if (!v || !walkStatsOverlayEl) return;
  const players = walkOrderPlayers(v.players).filter(p => p.stats);
  const n = players.length;
  // bovenaan: elke speler een eigen kolom, in volgorde van het klassement
  // alleen eindstand, naam en of het een bot is (gebruikerswens: start/opdrachten/binnen hoeven niet)
  const cards = players.map(p => {
    const who = p.isHuman ? (v.isMe(p) ? 'jij' : 'mens') : 'bot';
    return `<div class="walk-stats-player" style="--pc:${p.color}">` +
      `<span class="walk-stats-player-place">${p.rank ? walkRankLabel(p.rank) : '—'}</span>` +
      `<b class="walk-stats-player-name">${p.name}</b>` +
      `<span class="walk-stats-player-who">${who}</span>` +
    `</div>`;
  }).join('');
  // per categorie een tabel met vakjes; kolomkop = kleurstip + plaats (zelfde als de spelerkaart
  // erboven — een naam paste niet in de smalle kolom), de naam staat in de tooltip
  const head = `<thead><tr><th class="walk-stats-corner"></th>${players.map(p =>
    `<th style="--pc:${p.color};color:var(--pc)" title="${p.name}">${p.rank ? walkRankLabel(p.rank) : '–'}</th>`).join('')}</tr></thead>`;
  const tables = SOLO_STATS_GROUPS.map(g => {
    const body = g.rows.map(r => {
      const vals = players.map(r.get);
      const pick = r.best === 'min' ? Math.min(...vals) : Math.max(...vals);
      const fmt = r.fmt || (x => String(x));
      const lit = x => r.best && n > 1 && x === pick && !vals.every(y => y === pick);
      return `<tr><th>${r.label}</th>${vals.map(x => `<td${lit(x) ? ' class="is-best"' : ''}>${fmt(x)}</td>`).join('')}</tr>`;
    }).join('');
    return `<section class="walk-stats-cat"><h3>${g.title}</h3><table class="walk-stats-table">${head}<tbody>${body}</tbody></table></section>`;
  }).join('');
  // twee weergaven: de tabellen (zoals altijd) en grafieken (gebruikerswens: "meer graphs");
  // wisselen met de knoppen, onthouden zolang de pagina openstaat
  const view = soloStatsView;
  walkStatsBodyEl.innerHTML =
    `<div class="walk-stats-players" style="--n:${n}">${cards}</div>` +
    `<div class="walk-stats-switch" role="tablist">` +
      `<button type="button" class="walk-stats-tab${view === 'tables' ? ' active' : ''}" data-stats-view="tables">Tabellen</button>` +
      `<button type="button" class="walk-stats-tab${view === 'charts' ? ' active' : ''}" data-stats-view="charts">Grafieken</button>` +
    `</div>` +
    (view === 'charts'
      ? soloStatsChartsHtml(players)
      : `<div class="walk-stats-cats">${tables}</div>` +
        `<p class="walk-stats-foot">Oranje = beste in die rij. Ogen tellen alleen de loopstenen tijdens het spel, niet het dobbelen wie begint.</p>`);
  walkStatsOverlayEl.hidden = false;
}
let soloStatsView = 'tables';
if (walkStatsBodyEl){
  walkStatsBodyEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-stats-view]');
    if (!b) return;
    soloStatsView = b.dataset.statsView;
    soloOpenStats();
  });
}

// ---------- grafieken in de statistieken (SVG, met de hand getekend: geen library nodig) ----------
// Gegevens komen uit newPlayerStats (95-simulate.js): hist (stand bij het begin van elke eigen
// beurt), rolls (som van de 2 loopstenen), energyUse en cardUse, plus walkSteps/dashSteps.
const STATS_ENERGY_COLORS = { boost: '#ffb545', reorder: '#4fb8e0', gravity: '#b98cff', portal: '#ff6b5d', jump: '#55d68a' };
// genoeg verschillende tinten voor alle kristallen (15 soorten; met 8 deelden sommige een kleur)
const STATS_CARD_PALETTE = ['#4fb8e0', '#ffb545', '#b98cff', '#55d68a', '#ff7a45', '#ff4fd8', '#e6e15a', '#8fa3b8',
  '#2f7fff', '#c46b2b', '#7a5cff', '#1fb39a', '#ff9db0', '#a3d65c', '#d4a4ff', '#5ad1e6', '#b8865a', '#e85d5d'];
function statsEsc(s){ return String(s).replace(/[<>&"]/g, ''); }
// lijngrafiek: series = [{color, points:[[x,y],...], name}], yMax vast (6 opdrachten / 10 energie)
function statsLineChart(series, { yMax, yLabel, step }){
  const W = 520, H = 216, L = 34, R = 10, T = 22, B = 40;
  const xMax = Math.max(1, ...series.map(s => s.points.length ? s.points[s.points.length - 1][0] : 1));
  const X = x => L + (x / xMax) * (W - L - R), Y = y => T + (1 - y / yMax) * (H - T - B);
  let g = '';
  for (let y = 0; y <= yMax; y += (yMax > 6 ? 2 : 1)){
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" class="sc-grid"/>` +
         `<text x="${L - 6}" y="${Y(y) + 4}" class="sc-ax" text-anchor="end">${y}</text>`;
  }
  const xStep = Math.max(1, Math.ceil(xMax / 10));
  for (let x = 0; x <= xMax; x += xStep) g += `<text x="${X(x)}" y="${H - 22}" class="sc-ax" text-anchor="middle">${x}</text>`;
  // asnamen buiten de getallen: links boven de y-as, onder het midden van de x-as
  g += `<text x="${(L + W - R) / 2}" y="${H - 3}" class="sc-ax sc-ax-name" text-anchor="middle">beurt</text>`;
  g += `<text x="${L - 6}" y="10" class="sc-ax sc-ax-name" text-anchor="start">${yLabel}</text>`;
  const lines = series.map(s => {
    if (!s.points.length) return '';
    let d = '';
    s.points.forEach(([x, y], i) => {
      if (i === 0) d += `M${X(x)},${Y(y)}`;
      else if (step){ d += `H${X(x)}V${Y(y)}`; }
      else d += `L${X(x)},${Y(y)}`;
    });
    const [lx, ly] = s.points[s.points.length - 1];
    return `<path d="${d}" class="sc-line" style="stroke:${s.color}"/>` +
           `<circle cx="${X(lx)}" cy="${Y(ly)}" r="3.5" style="fill:${s.color}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="sc-svg" role="img">${g}${lines}</svg>`;
}
function statsSeries(players, idx){
  // stand bij het begin van elke beurt, plus de eindstand als laatste punt
  return players.map(p => {
    const hist = (p.stats.hist || []).map((h, i) => [i, h[idx]]);
    hist.push([hist.length, idx === 0 ? p.completed : p.energy]);
    return { color: p.color, name: p.name, points: hist };
  });
}
function statsDiceChart(players){
  const W = 520, H = 216, L = 34, R = 10, T = 22, B = 40;
  const sums = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const yMax = Math.max(1, ...players.flatMap(p => sums.map(s => (p.stats.rolls || [])[s] || 0)));
  const gw = (W - L - R) / sums.length, bw = Math.max(2, (gw - 6) / players.length);
  const Y = y => T + (1 - y / yMax) * (H - T - B);
  let g = '';
  const yStep = Math.max(1, Math.ceil(yMax / 5));
  for (let y = 0; y <= yMax; y += yStep){
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" class="sc-grid"/>` +
         `<text x="${L - 6}" y="${Y(y) + 4}" class="sc-ax" text-anchor="end">${y}</text>`;
  }
  sums.forEach((s, i) => {
    const x0 = L + i * gw + 3;
    g += `<text x="${x0 + (gw - 6) / 2}" y="${H - 22}" class="sc-ax" text-anchor="middle">${s}</text>`;
    players.forEach((p, j) => {
      const v = (p.stats.rolls || [])[s] || 0;
      if (!v) return;
      g += `<rect x="${x0 + j * bw}" y="${Y(v)}" width="${Math.max(1, bw - 1)}" height="${Y(0) - Y(v)}" rx="1.5" style="fill:${p.color}"><title>${statsEsc(p.name)}: ${v}× ${s}</title></rect>`;
    });
  });
  g += `<text x="${L - 6}" y="10" class="sc-ax sc-ax-name" text-anchor="start">keer</text>`;
  g += `<text x="${(L + W - R) / 2}" y="${H - 3}" class="sc-ax sc-ax-name" text-anchor="middle">som van de worp</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="sc-svg" role="img">${g}</svg>`;
}
// per speler gestapelde balkjes: energie-acties, gespeelde kaarten, gelopen vs gesprint
function statsMixHtml(players){
  const bar = (parts) => {
    const total = parts.reduce((a, p) => a + p.v, 0);
    if (!total) return `<span class="sc-bar sc-bar-empty">—</span>`;
    return `<span class="sc-bar">${parts.filter(p => p.v).map(p =>
      `<span style="flex:${p.v};background:${p.c}" title="${statsEsc(p.label)}: ${p.v}">${p.v}</span>`).join('')}</span>`;
  };
  const usedCards = [...new Set(players.flatMap(p => Object.keys(p.stats.cardUse || {}).filter(id => p.stats.cardUse[id] > 0)))];
  const cardColor = id => STATS_CARD_PALETTE[usedCards.indexOf(id) % STATS_CARD_PALETTE.length];
  const rows = players.map(p => {
    const eu = p.stats.energyUse || {}, cu = p.stats.cardUse || {};
    return `<div class="sc-mix-player" style="--pc:${p.color}"><b>${statsEsc(p.name)}</b>` +
      `<span class="sc-mix-lbl">Energie</span>${bar(Object.keys(STATS_ENERGY_COLORS).map(k => ({ v: eu[k] || 0, c: STATS_ENERGY_COLORS[k], label: ENERGY_ACTIONS[k].name })))}` +
      `<span class="sc-mix-lbl">Kristallen</span>${bar(usedCards.map(id => ({ v: cu[id] || 0, c: cardColor(id), label: ACTION_CARDS[id].name })))}` +
      `<span class="sc-mix-lbl">Vakjes</span>${bar([{ v: p.stats.walkSteps, c: '#8fa3b8', label: 'gelopen' }, { v: p.stats.dashSteps, c: '#b98cff', label: 'gesprint' }])}` +
    `</div>`;
  }).join('');
  const legend = (items) => items.map(([c, t]) => `<span class="sc-key"><i style="background:${c}"></i>${t}</span>`).join('');
  return `<div class="sc-mix">${rows}</div>` +
    `<div class="sc-legend">${legend(Object.keys(STATS_ENERGY_COLORS).map(k => [STATS_ENERGY_COLORS[k], ENERGY_ACTIONS[k].name]))}</div>` +
    (usedCards.length ? `<div class="sc-legend">${legend(usedCards.map(id => [cardColor(id), ACTION_CARDS[id].name]))}</div>` : '') +
    `<div class="sc-legend">${legend([['#8fa3b8', 'gelopen'], ['#b98cff', 'gesprint (laarzen)']])}</div>`;
}
function soloStatsChartsHtml(players){
  const legend = `<div class="sc-legend sc-legend-players">${players.map(p =>
    `<span class="sc-key"><i style="background:${p.color}"></i>${statsEsc(p.name)}</span>`).join('')}</div>`;
  const avg = p => { const r = p.stats.rolls || []; let n = 0, s = 0; for (let k = 2; k <= 12; k++){ n += r[k] || 0; s += (r[k] || 0) * k; } return n ? nl(s / n, 1) : '—'; };
  return `<div class="sc-grid-wrap">` +
    `<section class="sc-card"><h3>Voortgang per beurt</h3>${statsLineChart(statsSeries(players, 0), { yMax: SIM_QUESTS_TO_WIN, yLabel: 'opdrachten', step: true })}${legend}</section>` +
    `<section class="sc-card"><h3>Energie per beurt</h3>${statsLineChart(statsSeries(players, 1), { yMax: ENERGY_MAX, yLabel: 'energie', step: false })}${legend}</section>` +
    `<section class="sc-card"><h3>Worpen-verdeling <span>(som van 2 loopstenen · gemiddeld 7)</span></h3>${statsDiceChart(players)}` +
      `<div class="sc-legend sc-legend-players">${players.map(p => `<span class="sc-key"><i style="background:${p.color}"></i>${statsEsc(p.name)} · gem. ${avg(p)}</span>`).join('')}</div></section>` +
    `<section class="sc-card"><h3>Acties, kristallen en verplaatsing</h3>${statsMixHtml(players)}</section>` +
  `</div>`;
}
// zelf opzoeken i.p.v. walkStatsOverlayEl: soloHideEndgame() roept dit aan en kan al tijdens
// het laden lopen, vóórdat die const hierboven bestaat
function soloCloseStats(){ const el = document.getElementById('walkStatsOverlay'); if (el) el.hidden = true; }
if (walkEndgameCardEl){
  walkEndgameCardEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-endgame-stats]')) soloOpenStats();
    else if (e.target.closest('[data-endgame-lobby]')) soloEndgameToLobby();
  });
}
if (walkStatsOverlayEl){
  document.getElementById('walkStatsClose').addEventListener('click', soloCloseStats);
  walkStatsOverlayEl.addEventListener('click', (e) => { if (e.target === walkStatsOverlayEl) soloCloseStats(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !walkStatsOverlayEl.hidden) soloCloseStats(); });
}
// eindklassering als lijstje: plaats, kleurstip, naam, voortgang. Volgorde uit
// walkOrderPlayers() (96-walk.js); gedeelde plaatsen krijgen hetzelfde nummer.
function soloEndgameRankingHtml(players = soloPlayers, isMe = soloIsMe){
  // Drie kolommen: plaats en naam in de spelerskleur, rechts de voltooide opdrachten. Geen
  // medailles/kleurstippen/"binnen"-status meer (gebruikerswens: te druk); de rest staat in
  // de statistieken.
  const head = `<li class="walk-rank-head"><span>Plaats</span><span>Speler</span>` +
    `<span class="walk-rank-score">Opdrachten voltooid</span></li>`;
  const rows = walkOrderPlayers(players).map(p => {
    const place = p.rank ? `${p.rank}e` : '—';
    const you = isMe(p) ? '<span class="you">jij</span>' : '';
    return `<li class="walk-rank-row" style="--pc:${p.color}">` +
      `<span class="walk-rank-pos">${place}</span>` +
      `<span class="walk-rank-name">${p.name}${you}</span>` +
      `<span class="walk-rank-score">${p.completed}/${SIM_QUESTS_TO_WIN}</span>` +
    `</li>`;
  });
  return `<ol class="walk-rank-list">${head}${rows.join('')}</ol>`;
}
function soloReopenEndgame(){
  if (!walkEndgameEl) return;
  walkEndgameEl.hidden = false;
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = true;
  soloStartConfetti();
}
// "Toon kaart": winscherm weg, knop om 'm terug te halen erbij
function soloEndgameShowMap(){
  soloHideEndgame();
  soloSetGameOverView(true);   // het potje is nog steeds afgelopen: zijkolom blijft leeg
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = false;
}
// .is-game-over (styles.css): zijkolom (dobbelen/energie/kluis) en opdrachtenoverzicht weg
const walkPlayLayoutEl = document.querySelector('.walk-play-layout');
function soloSetGameOverView(on){
  if (walkPlayLayoutEl && walkPlayLayoutEl.classList.contains('is-game-over') !== on) walkPlayLayoutEl.classList.toggle('is-game-over', on);
}
// helemaal weg (nieuw potje/stoppen): ook geen "Toon uitslag" meer
function soloHideEndgame(){
  if (walkEndgameEl) walkEndgameEl.hidden = true;
  soloSetGameOverView(false);
  soloCloseStats();   // statistieken-pop-up van het vorige potje hoort ook dicht
  if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.hidden = true;
  soloStopConfetti();
}
if (btnWalkEndgameShowMap) btnWalkEndgameShowMap.addEventListener('click', soloEndgameShowMap);
if (btnWalkEndgameShowResult) btnWalkEndgameShowResult.addEventListener('click', soloReopenEndgame);

// Feestelijke ruimtescène op een <canvas> i.p.v. een library — puur decoratief, dus geen
// dependency waard. Zit qua z-index ONDER .walk-endgame-card (zie styles.css), dus komt daar
// nooit overheen (gebruikerswens), zonder dat er iets uitgeknipt hoeft te worden.
// Vroeger gewone gekleurde papiertjes; nu "ruimteachtig, futuristisch, duister, maar toch winst"
// (gebruikerswens): een diepzwarte achtergrond met een nevelgloed in de kleur van de winnaar,
// een sterrenveld dat langzaam op je af vliegt (warp), energieringen die vanuit het midden
// uitdijen, af en toe een vuurwerk van gloeiende vonken, en zwevende lichtgevende scherfjes.
// Gloed via 'lighter' (optellend licht) i.p.v. shadowBlur — dat laatste is per deeltje traag.
let soloConfettiRAF = null;
let soloConfettiResizeHandler = null;
function soloStartConfetti(){
  const canvas = walkEndgameConfettiEl;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  soloStopConfetti();   // vangnet: nooit twee lussen tegelijk als dit ooit dubbel aangeroepen wordt
  const resize = () => { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; };
  resize();
  soloConfettiResizeHandler = resize;
  window.addEventListener('resize', soloConfettiResizeHandler);

  // spelers van het winscherm zelf (Automatisch heeft een eigen lijst, niet soloPlayers)
  const winner = ((soloEndgameView && soloEndgameView.players) || soloPlayers || []).find(p => p.rank === 1);
  const hero = (winner && winner.color) || '#ffd23d';
  const palette = [hero, hero, '#4fb8e0', '#ffd23d', '#b98cff'];
  const pick = () => palette[Math.floor(Math.random() * palette.length)];
  const W = () => canvas.width, H = () => canvas.height;
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  };

  // sterren: positie t.o.v. het midden, vliegen naar buiten met een snelheid die meegroeit met
  // de afstand (perspectief); te ver weg → opnieuw vlak bij het midden
  const newStar = (anywhere) => {
    const a = Math.random() * Math.PI * 2;
    const maxR = Math.hypot(W(), H()) / 2;
    const r = anywhere ? Math.random() * maxR : 4 + Math.random() * 40;
    return { a, r, z: 0.25 + Math.random() * 0.75, tw: Math.random() * Math.PI * 2 };
  };
  const stars = Array.from({ length: 170 }, () => newStar(true));
  const newShard = (anywhere) => ({
    x: Math.random() * W(), y: anywhere ? Math.random() * H() : -14,
    vy: 0.25 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3,
    rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.03,
    s: 4 + Math.random() * 5, color: pick(), ph: Math.random() * Math.PI * 2,
  });
  const shards = Array.from({ length: 34 }, () => newShard(true));
  const sparks = [];
  const rings = [];
  let t = 0, nextBurst = 20, nextRing = 0;

  function burst(){
    const x = W() * (0.12 + Math.random() * 0.76);
    const y = H() * (0.12 + Math.random() * 0.6);
    const color = pick(), n = 46 + Math.floor(Math.random() * 20);
    for (let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const sp = 2 + Math.random() * 2.6;
      sparks.push({ x, y, px: x, py: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 60 + Math.random() * 40, color });
    }
  }

  function frame(){
    t++;
    const w = W(), h = H(), cx = w / 2, cy = h / 2;
    ctx.globalCompositeOperation = 'source-over';
    // diepe ruimte + nevel in de winnaarskleur
    ctx.fillStyle = '#03050b';
    ctx.fillRect(0, 0, w, h);
    const pulse = 0.5 + 0.5 * Math.sin(t / 90);
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
    g.addColorStop(0, rgba(hero, 0.20 + 0.06 * pulse));
    g.addColorStop(0.45, rgba(hero, 0.06));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.15, h * 0.85, 0, w * 0.15, h * 0.85, w * 0.5);
    g.addColorStop(0, 'rgba(79,184,224,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.88, h * 0.12, 0, w * 0.88, h * 0.12, w * 0.45);
    g.addColorStop(0, 'rgba(185,140,255,0.09)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    // warp-sterren
    const maxR = Math.hypot(w, h) / 2 + 20;
    for (const s of stars){
      const prevR = s.r;
      s.r += (0.15 + s.r * 0.006) * s.z;
      s.tw += 0.05;
      if (s.r > maxR){ Object.assign(s, newStar(false)); continue; }
      const cos = Math.cos(s.a), sin = Math.sin(s.a);
      const fade = Math.min(1, s.r / 80);
      const alpha = (0.35 + 0.45 * s.z + 0.2 * Math.sin(s.tw)) * fade;
      const tail = Math.max(1, (s.r - prevR) * 6);
      ctx.strokeStyle = `rgba(210,230,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.6 + s.z * 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + cos * (s.r - tail), cy + sin * (s.r - tail));
      ctx.lineTo(cx + cos * s.r, cy + sin * s.r);
      ctx.stroke();
    }

    // energieringen vanuit het midden
    if (t >= nextRing){ rings.push({ r: 30, a: 0.55 }); nextRing = t + 150; }
    for (let i = rings.length - 1; i >= 0; i--){
      const r = rings[i];
      r.r += 1.6; r.a *= 0.988;
      if (r.a < 0.02 || r.r > maxR){ rings.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(hero, r.a * 0.35); ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(hero, r.a); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2); ctx.stroke();
    }

    // vuurwerk van vonken
    if (t >= nextBurst){ burst(); nextBurst = t + 70 + Math.floor(Math.random() * 60); }
    for (let i = sparks.length - 1; i >= 0; i--){
      const p = sparks[i];
      p.px = p.x; p.py = p.y;
      p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.025;
      p.x += p.vx; p.y += p.vy; p.life++;
      if (p.life > p.max){ sparks.splice(i, 1); continue; }
      const a = Math.pow(1 - p.life / p.max, 0.6);
      ctx.strokeStyle = rgba(p.color, a); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.px - p.vx * 5, p.py - p.vy * 5); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.fillStyle = rgba(p.color, a * 0.35);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // zwevende scherfjes (ruiten met een gloeiende rand)
    for (const s of shards){
      s.x += s.vx; s.y += s.vy; s.rot += s.vr; s.ph += 0.04;
      if (s.y > h + 14) Object.assign(s, newShard(false));
      const a = 0.45 + 0.35 * Math.sin(s.ph);
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.beginPath();
      ctx.moveTo(0, -s.s * 1.6); ctx.lineTo(s.s * 0.7, 0); ctx.lineTo(0, s.s * 1.6); ctx.lineTo(-s.s * 0.7, 0); ctx.closePath();
      ctx.fillStyle = rgba(s.color, a * 0.18); ctx.fill();
      ctx.strokeStyle = rgba(s.color, a * 0.3); ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = rgba(s.color, a); ctx.lineWidth = 1.1; ctx.stroke();
      ctx.restore();
    }
    soloConfettiRAF = requestAnimationFrame(frame);
  }
  frame();
}
function soloStopConfetti(){
  if (soloConfettiRAF) cancelAnimationFrame(soloConfettiRAF);
  soloConfettiRAF = null;
  if (soloConfettiResizeHandler) window.removeEventListener('resize', soloConfettiResizeHandler);
  soloConfettiResizeHandler = null;
  const canvas = walkEndgameConfettiEl;
  if (canvas){ const ctx = canvas.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// "Ben ik dit?" voor het winscherm. Multiplayer (spelers hebben daar een peerId-veld): alleen
// je eigen stoel (mp.myIdx). Lokaal: alleen als er precies één mens meespeelt — met meerdere
// mensen op één scherm is "jij" dubbelzinnig, dan gewoon de naam. Voorheen gold elke mens als
// "jij", dus bij Multiplayer las iedereen "Jij wint!" als een andere mens won.
function soloIsMe(p){
  if (soloPlayers.some(q => q.peerId !== undefined)) return typeof mp !== 'undefined' && p.idx === mp.myIdx;
  return p.isHuman && soloPlayers.filter(q => q.isHuman).length === 1;
}
// titel/ondertitel voor het winscherm aan het einde van een potje — gedeeld door de host/lokaal
// (soloEndGame) en een multiplayer-gast (mpApplyState in 99-multiplayer.js), die alleen de
// gedeelde stand binnenkrijgt maar hetzelfde winscherm moet zien. Geen statusregel met
// eindklassering in de linkerkolom meer (gebruikerswens: lelijk) — die staat in het winscherm.
function soloEndgameTexts(stuck){
  const nameOf = p => soloIsMe(p) ? 'jij' : p.name;
  if (stuck){
    return { trophy: '⏳', title: 'Afgekapt', sub: `niet iedereen was binnen na ${SIM_MAX_TURNS} beurten` };
  }
  if (soloPlayers.length === 1){
    return { trophy: '🏆', title: 'Je wint!', sub: '' };
  }
  // geen "vanaf 3.1 in 23 beurten" meer onder de titel (gebruikerswens: startplek boeit niemand,
  // het aantal beurten staat in de statistieken)
  const winners = soloPlayers.filter(p => p.rank === 1);
  const w = winners[0];
  const title = winners.length === 1 ? (soloIsMe(w) ? 'Jij wint!' : `${w.name} wint!`) : 'Gedeelde winst!';
  const sub = winners.length === 1
    ? ''
    : `${winners.map(nameOf).join(' en ')} — gelijke energie en kristallen`;
  return { trophy: '🏆', title, sub };
}
function soloEndGame(stuck){
  soloPhase = 'game-over';
  soloRefreshCardVault();
  clearWalkTarget();
  walkSoloActionsEl.innerHTML = '';
  soloClearCardActionsPanel();
  btnWalkSoloRoll.hidden = true;
  btnWalkSoloSkip.hidden = true;
  renderWalkScore(soloPlayers, -1);
  soloRenderStatusExtras();   // missiestrook: geen "Bezig met …" en geen puls meer na afloop
  if (walkMetaEl) walkMetaEl.innerHTML = '';
  const t = soloEndgameTexts(stuck);
  // leeg — ook voor multiplayer-gasten, die #walkStatus van de host overnemen (mpApplyState)
  walkStatusEl.innerHTML = '';
  soloShowEndgame(t.trophy, t.title, t.sub);
  btnWalkSoloStart.disabled = false;
  for (const sel of walkSoloSetupEl ? walkSoloSetupEl.querySelectorAll('select') : []) sel.disabled = false;
}

