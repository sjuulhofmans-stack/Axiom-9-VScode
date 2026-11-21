// ---------- uitslag als "stoplicht-kaarten" (gekozen variant A uit 4, artifact "Axiom-9 Simulatie-uitslag", 2026-11) ----------
// Onder de oordeelsbalk staan per onderwerp twee even brede kaarten naast elkaar (.sim-row, 1 kolom op
// een smal scherm). Elke kaart heeft dezelfde opbouw: titel + oordeel (in orde / let op / probleem /
// ter info), één groot getal met een korte regel, één zin, één diagram, en de volledige tabel + uitleg
// achter "Details". Elke kaart klapt los in (pijltje rechtsboven): dan blijven titel en groot getal
// staan, en de buurkaart in de rij blijft even hoog. Diagrammen zijn kleine inline SVG's met vaste
// maten (niets opmeten), dus geen herverdeling meer bij in-/uitklappen (layoutSimSections is weg).
const SIM_COL = { blue: '#4fb8e0', green: '#55d68a', amber: '#ffb545', red: '#ff5d5d', violet: '#b57bef', dim: '#4a5a6b', track: '#1c2530' };
const SIM_START_COLORS = ['#ff4fd8', '#ffd23d', '#7c5cff', '#ff7a45'];
const SIM_TINT_COLORS = { amber: SIM_COL.amber, start: SIM_COL.green, quest: SIM_COL.blue, danger: SIM_COL.red };
const SIM_STATE_LABEL = { ok: 'in orde', warn: 'let op', bad: 'probleem', info: 'ter info' };

// ring in stukken; `center`/`sub` in het gat
function simDonut(segs, { size = 120, w = 18, center = '', sub = '' } = {}){
  const r = (size - w) / 2, C = 2 * Math.PI * r, tot = segs.reduce((a, s) => a + s.v, 0) || 1, h = size / 2;
  let off = 0, arcs = '';
  for (const s of segs){
    const len = s.v / tot * C;
    arcs += `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${s.c}" stroke-width="${w}" stroke-dasharray="${Math.max(0, len - 1.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${h} ${h})"><title>${s.label}: ${nl(s.v, 1)}%</title></circle>`;
    off += len;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${SIM_COL.track}" stroke-width="${w}"/>${arcs}` +
    `<text x="50%" y="${sub ? '49%' : '55%'}" text-anchor="middle" class="sim-svg-big" style="font-size:${size * .2}px">${center}</text>` +
    (sub ? `<text x="50%" y="66%" text-anchor="middle" style="font-size:${size * .09}px">${sub}</text>` : '') + `</svg>`;
}
// liggende balken; `ref` = stippellijn, `band` = groene zone
function simHBars(items, { max, ref, band, fmt = v => nl(v, 1) + '%', w = 320, lw = 112 } = {}){
  const rh = 22, H = items.length * rh + (ref != null ? 18 : 4), x0 = lw, x1 = w - 48;
  const X = v => x0 + (x1 - x0) * Math.max(0, Math.min(1, v / max));
  let s = '';
  if (band) s += `<rect x="${X(band[0])}" y="0" width="${X(band[1]) - X(band[0])}" height="${items.length * rh + 4}" fill="rgba(85,214,138,.12)"/>`;
  items.forEach((it, i) => {
    const y = i * rh + 4;
    s += `<text x="${x0 - 8}" y="${y + 12}" text-anchor="end" class="sim-svg-tv">${it.label}</text>` +
      `<rect x="${x0}" y="${y + 2}" width="${x1 - x0}" height="12" rx="3" fill="${SIM_COL.track}"/>` +
      `<rect x="${x0}" y="${y + 2}" width="${Math.max(2, X(it.v) - x0)}" height="12" rx="3" fill="${it.c || SIM_COL.blue}"/>` +
      `<text x="${x1 + 6}" y="${y + 12}" class="sim-svg-tv">${fmt(it.v)}</text>`;
  });
  if (ref != null){
    const bottom = items.length * rh + 4;
    s += `<line x1="${X(ref)}" x2="${X(ref)}" y1="0" y2="${bottom}" stroke="#eef4fa" stroke-dasharray="3 3" opacity=".7"/>` +
      `<text x="${X(ref)}" y="${H - 2}" text-anchor="middle">${fmt(ref)}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${H}" width="${w}" role="img">${s}</svg>`;
}
// staande staafjes (verdeling); `hi` = index die amber wordt
function simColumns(vals, labels, { w = 320, h = 110, color = SIM_COL.blue, hi = -1, tips } = {}){
  const n = vals.length, max = Math.max(...vals) || 1, bw = (w - 10) / n;
  let s = '';
  vals.forEach((v, i) => {
    const bh = (h - 22) * v / max, x = 5 + i * bw;
    s += `<rect x="${x + 2}" y="${h - 16 - bh}" width="${Math.max(1, bw - 4)}" height="${Math.max(0, bh)}" rx="2" fill="${i === hi ? SIM_COL.amber : color}"><title>${tips ? tips[i] : labels[i] + ': ' + nl(v, 1) + '%'}</title></rect>`;
    if (labels[i] !== '') s += `<text x="${x + bw / 2}" y="${h - 3}" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img">${s}</svg>`;
}
// één gestapelde balk
function simStack(segs, { w = 320 } = {}){
  let x = 0, s = '';
  const tot = segs.reduce((a, b) => a + b.v, 0) || 1;
  for (const g of segs){
    const ww = g.v / tot * w;
    s += `<rect x="${x}" y="0" width="${Math.max(0, ww - 2)}" height="18" rx="3" fill="${g.c}"><title>${g.label}: ${nl(g.v, 1)}%</title></rect>`;
    x += ww;
  }
  return `<svg viewBox="0 0 ${w} 18" width="${w}" role="img">${s}</svg>`;
}
// stippen op een as 15–35% met een groene zone (kristallen)
function simDots(items, { band, min = 15, max = 35, w = 320 } = {}){
  const x0 = 14, x1 = w - 14, X = v => x0 + (x1 - x0) * (Math.max(min, Math.min(max, v)) - min) / (max - min), H = 70;
  let s = `<rect x="${X(band[0])}" y="8" width="${X(band[1]) - X(band[0])}" height="40" fill="rgba(85,214,138,.12)"/>` +
    `<line x1="${X(25)}" x2="${X(25)}" y1="6" y2="50" stroke="#eef4fa" stroke-dasharray="3 3" opacity=".6"/>`;
  items.forEach((it, i) => {
    s += `<circle cx="${X(it.v)}" cy="${16 + (i % 4) * 9}" r="5" fill="${it.c}" stroke="#0b0f14" stroke-width="1.5"><title>${it.label}: ${nl(it.v, 1)}%</title></circle>`;
  });
  for (let t = min; t <= max; t += 5) s += `<text x="${X(t)}" y="${H - 4}" text-anchor="middle">${t}%</text>`;
  return `<svg viewBox="0 0 ${w} ${H}" width="${w}" role="img">${s}</svg>`;
}
// startposities × eindplaats, kleur = afwijking van 25%
function simRankGrid(labels, ranks){
  const cell = 46, s = [];
  ['1e', '2e', '3e', '4e'].forEach((t, j) => s.push(`<text x="${52 + j * cell + cell / 2}" y="12" text-anchor="middle">${t}</text>`));
  labels.forEach((lbl, i) => {
    s.push(`<text x="40" y="${37 + i * 30}" text-anchor="end" class="sim-svg-tv">${lbl}</text>`);
    ranks[i].forEach((v, j) => {
      const dev = v - 25, a = Math.min(1, Math.abs(dev) / 3);
      const col = dev >= 0 ? `rgba(79,184,224,${.15 + a * .6})` : `rgba(255,181,69,${.15 + a * .6})`;
      s.push(`<rect x="${52 + j * cell + 2}" y="${20 + i * 30}" width="${cell - 4}" height="26" rx="4" fill="${col}"/>` +
        `<text x="${52 + j * cell + cell / 2}" y="${37 + i * 30}" text-anchor="middle" class="sim-svg-tv">${nl(v, 0)}%</text>`);
    });
  });
  return `<svg viewBox="0 0 240 ${24 + labels.length * 30}" width="240" role="img">${s.join('')}</svg>`;
}
const simLegend = items => `<div class="sim-legend">${items.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('')}</div>`;
const simMinis = arr => `<div class="sim-minis">${arr.map(([v, t]) => `<div class="sim-mini"><b>${v}</b><span>${t}</span></div>`).join('')}</div>`;
const simChart = svg => `<div class="sim-chart">${svg}</div>`;
const simSplit = (a, b) => `<div class="sim-split">${a}<div class="sim-split-side">${b}</div></div>`;

// één kaart. `st` = 'ok' | 'warn' | 'bad' | 'info'; `wide` = over beide kolommen (warmtekaart)
function simCard({ id, title, st, big, bl, line, chart, details, wide = false }){
  return `<article class="sim-card is-${st}${wide ? ' is-wide' : ''}" data-id="${id}">` +
    `<div class="sim-card-head"><h3>${title}</h3><span class="sim-chip">${SIM_STATE_LABEL[st]}</span>` +
    `<button type="button" class="sim-card-toggle" aria-expanded="true" aria-label="${title} in- of uitklappen">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></div>` +
    (big != null ? `<div class="sim-card-headline"><span class="big">${big}</span><span class="bl">${bl || ''}</span></div>` : '') +
    `<div class="sim-card-body">${line ? `<p class="sim-card-line">${line}</p>` : ''}${chart || ''}` +
    (details ? `<details class="sim-more"><summary>Details</summary>${details}</details>` : '') +
    `</div></article>`;
}
// rij van twee kaarten (of één brede)
const simRow = cards => `<div class="sim-row">${cards.join('')}</div>`;

// de 5 tegels met het minste verkeer (genormaliseerd per vakje, zodat grote en kleine tegels
// eerlijk vergeleken worden) — dit zijn de "lussen waar geen enkele speler komt" uit de heatmap,
// nu met naam, positie en hoe ver ze van een opdracht liggen.
function coldZoneRows(graph, heatmap){
  const { H, W } = graph;
  const questDist = computeQuestDistances(graph);
  const visitsPerSlot = new Array(20).fill(0);
  const cellsPerSlot = new Array(20).fill(0);
  const maxQuestDistPerSlot = new Array(20).fill(0);
  for (let R = 0; R < H; R++){
    for (let C = 0; C < W; C++){
      const k = R * W + C;
      if (graph.adjKey[k] === undefined) continue;
      const slotIdx = Math.floor(R / TILE_H) * TILE_COLS + Math.floor(C / TILE_W);
      visitsPerSlot[slotIdx] += heatmap[k];
      cellsPerSlot[slotIdx]++;
      if (questDist[k] > maxQuestDistPerSlot[slotIdx]) maxQuestDistPerSlot[slotIdx] = questDist[k];
    }
  }
  const totalVisits = visitsPerSlot.reduce((a, b) => a + b, 0);
  const rows = [];
  for (let slotIdx = 0; slotIdx < 20; slotIdx++){
    if (cellsPerSlot[slotIdx] === 0) continue;
    rows.push({
      slotIdx,
      tid: layout[slotIdx],
      share: totalVisits ? (visitsPerSlot[slotIdx] / totalVisits * 100) : 0,
      avgPerCell: visitsPerSlot[slotIdx] / cellsPerSlot[slotIdx],
      questDist: maxQuestDistPerSlot[slotIdx],
    });
  }
  rows.sort((a, b) => a.avgPerCell - b.avgPerCell);
  return rows;
}

// drempels voor het oordeel "Dode tegels" (aandeel van al het verkeer; gemiddeld is 5% per tegel)
const SIM_DEAD_TILE_SHARE = 0.5;   // daaronder: dood (rood)
const SIM_WEAK_TILE_SHARE = 1.0;   // daaronder: erg stil (oranje)
function renderColdZones(graph, heatmap){
  const rows = coldZoneRows(graph, heatmap);
  // gesorteerd op de kolom die er staat (aandeel verkeer); vroeger op bezoeken per vakje, waardoor
  // de tabel ongesorteerd leek (0,1 · 0,1 · 2,9 · 3,7 · 3,0)
  const tableRows = rows.slice().sort((a, b) => a.share - b.share).slice(0, 5).map(r => {
    const name = ROOM_NAMES[r.tid] || ('Gang ' + r.tid);
    return `<tr><td>${letterForSlot(r.slotIdx)} — ${name}</td><td class="num">${nl(r.share, 1)}%</td><td class="num">${r.questDist}</td></tr>`;
  }).join('');
  return `<table class="sim-table"><thead><tr><th>Tegel</th><th>Aandeel verkeer</th><th>Verste vakje tot opdracht</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

function renderHeatmap(graph, heatmap){
  const { H, W } = graph;
  let maxCount = 0;
  for (let k = 0; k < heatmap.length; k++) if (heatmap[k] > maxCount) maxCount = heatmap[k];
  const questAt = new Set(Object.values(graph.questCells));
  const startAt = new Set(Object.values(graph.startCells));

  const cells = new Array(H * W);
  for (let R = 0; R < H; R++){
    for (let C = 0; C < W; C++){
      const k = R * W + C;
      const neigh = graph.adjKey[k];
      if (neigh === undefined){ cells[k] = `<div class="sim-heat-cell off"></div>`; continue; }
      const count = heatmap[k];
      const t = maxCount ? Math.sqrt(count / maxCount) : 0;
      const cls = questAt.has(k) ? ' quest' : startAt.has(k) ? ' start' : '';
      cells[k] = `<div class="sim-heat-cell${cls}" style="background:${heatColor(t)}" title="${count} bezoeken"></div>`;
    }
  }
  return `
    <div class="sim-heat-outer">
      <div class="sim-heat-grid" style="grid-template-columns:repeat(${W}, var(--hcell)); grid-template-rows:repeat(${H}, var(--hcell));">${cells.join('')}</div>
    </div>
    <div class="sim-heat-legend">
      <span>weinig verkeer</span>
      <span class="sim-heat-scale"></span>
      <span>veel verkeer</span>
      <span class="sim-heat-key"><i class="sim-heat-swatch quest"></i>opdrachtvakje</span>
      <span class="sim-heat-key"><i class="sim-heat-swatch start"></i>startpositie</span>
    </div>`;
}

function renderSimResults({ n, stuckCount, startWins, startTurnsSum, startRanks, strategyStats, seatWins, gameLengths, questStats, extra, graph, heatmap, elapsedMs }){
  simHasRun = true;   // vanaf nu een waarschuwing als de indeling verandert (clearSimResults)
  const played = n - stuckCount;

  const startPcts = SIM_START_LABELS.map(lbl => played ? (startWins[lbl] / played * 100) : 0);
  const spread = startPcts.length ? Math.max(...startPcts) - Math.min(...startPcts) : 0;
  const avgMoe = startPcts.length
    ? SIM_START_LABELS.reduce((s, lbl) => s + simMarginOfError(startWins[lbl], played), 0) / SIM_START_LABELS.length
    : 0;
  const withinNoise = spread <= 2 * avgMoe;
  const verdict = played === 0 ? '—'
    : withinNoise ? `<span class="ok">binnen foutmarge — geen aantoonbaar verschil</span>`
    : `<span class="bad">verschil groter dan de foutmarge — waarschijnlijk een echte scheefheid</span>`;

  const rows = SIM_START_LABELS.map(lbl => {
    const wins = startWins[lbl];
    const pct = played ? (wins / played * 100) : 0;
    const moe = simMarginOfError(wins, played);
    const avgTurns = wins ? (startTurnsSum[lbl] / wins) : null;
    return `<tr><td>${lbl}</td><td class="num">${nl(pct, 1)}% ± ${nl(moe, 1)}</td><td class="num">${avgTurns !== null ? nl(avgTurns, 1) : '—'}</td></tr>`;
  }).join('');
  const seatRows = seatWins.map((w, i) => {
    const pct = played ? (w / played * 100) : 0;
    return `<tr><td>${i + 1}e aan zet</td><td class="num">${nl(pct, 1)}%</td></tr>`;
  }).join('');
  const questRows = SIM_QUEST_LABELS.map(lbl => {
    const qs = questStats[lbl];
    const avg = qs.count ? (qs.turns / qs.count) : null;
    return `<tr><td>${lbl} — ${QUEST_NAMES[lbl]}</td><td class="num">${avg !== null ? nl(avg, 1) : '—'}</td><td class="num">${qs.count}</td></tr>`;
  }).join('');

  const sorted = gameLengths.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sorted.length ? sum / sorted.length : 0;
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const min = sorted.length ? sorted[0] : 0;
  const max = sorted.length ? sorted[sorted.length - 1] : 0;

  const blockedPct = extra.totalTurns ? (extra.blockedTurns / extra.totalTurns * 100) : 0;
  const avgGap = extra.winGapCount ? (extra.winGapSum / extra.winGapCount) : 0;
  const nailBiterPct = extra.winGapCount ? (extra.nailBiters / extra.winGapCount * 100) : 0;

  // geen regel "N potjes gesimuleerd op indeling …" meer (gebruikerswens); alleen als er potjes
  // vastliepen een korte uitleg dat die niet meetellen
  let html = stuckCount
    ? `<p class="hint"><span style="color:var(--danger)">${stuckCount} vastgelopen</span> (afgekapt na ${SIM_MAX_TURNS} beurten, niet meegeteld in de percentages).</p>`
    : '';

  // De kaarten hieronder zijn het bewijsmateriaal; deze vier vakjes beantwoorden de
  // vraag waar je de simulatie eigenlijk voor draait — is dit bord goed genoeg om te spelen?
  // "Dode tegels": niet alleen 0% telt. Een tegel met minder dan SIM_DEAD_TILE_SHARE% van het verkeer
  // (gemiddeld is 5% per tegel) is in de praktijk ook dood — vroeger stond er groen "geen" bij 0,1%.
  const coldRows = coldZoneRows(graph, heatmap).slice().sort((a, b) => a.share - b.share);
  const coldest = coldRows[0];
  const deadTiles = coldRows.filter(r => r.share < SIM_DEAD_TILE_SHARE).length;
  const weakTiles = coldRows.filter(r => r.share < SIM_WEAK_TILE_SHARE).length;
  const tileName = r => `${letterForSlot(r.slotIdx)} · ${ROOM_NAMES[r.tid] || ('Gang ' + r.tid)}`;
  const verdictItem = (state, label, value, sub) =>
    `<div class="sim-verdict-item ${state}"><span class="lbl">${label}</span><span class="val">${value}</span><span class="sub">${sub}</span></div>`;
  html += `<div class="sim-verdict">` +
    verdictItem(played === 0 ? 'warn' : withinNoise ? 'ok' : 'bad',
      'Eerlijk?',
      played === 0 ? 'geen data' : withinNoise ? 'ja' : 'nee',
      played === 0 ? 'geen enkel potje uitgespeeld'
        : `startposities lopen ${nl(spread, 1)} procentpunt uiteen, foutmarge ±${nl(avgMoe, 1)}`) +
    verdictItem(stuckCount === 0 ? 'ok' : 'bad',
      'Vastgelopen',
      stuckCount === 0 ? 'geen' : `${stuckCount}×`,
      stuckCount === 0 ? `alle ${played} potjes speelden uit` : `afgekapt na ${SIM_MAX_TURNS} beurten`) +
    verdictItem(!coldest ? 'warn' : deadTiles ? 'bad' : weakTiles ? 'warn' : 'ok',
      'Dode tegels',
      !coldest ? '—' : deadTiles ? `${deadTiles}` : weakTiles ? `${weakTiles} stil` : 'geen',
      coldest ? `stilste tegel: ${tileName(coldest)} met ${nl(coldest.share, 1)}% van het verkeer` : '—') +
    verdictItem('ok', 'Speelduur', `${Math.round(avg)} beurten`,
      `alle spelers samen — ${nl(avg / SIM_START_LABELS.length, 1)} beurten per speler · mediaan ${median} · min ${min} · max ${max}`) +
    `</div>`;

  const pctOf = (a, b) => b ? a / b * 100 : 0;
  const spelers = SIM_START_LABELS.length;
  // percentage met een klein balkje erachter (schaal: `max` = volle breedte)
  const barCell = (pct, max) =>
    `<td class="num sim-bar-cell"><span class="sim-bar" style="--w:${max ? Math.min(100, pct / max * 100).toFixed(1) : 0}"></span>${nl(pct, 1)}%</td>`;
  const tbl = (head, body) => `<table class="sim-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  const cards = {};

  // ---------- Eerlijkheid ----------
  cards.start = simCard({ id: 'start', title: 'Startposities', st: played === 0 ? 'warn' : withinNoise ? 'ok' : 'bad',
    big: `${nl(spread, 1)} pt`, bl: `verschil tussen beste en slechtste startplek, foutmarge ±${nl(avgMoe, 1)}`,
    line: withinNoise ? 'Elke startplek wint ongeveer een kwart van de potjes.' : 'Eén startplek wint duidelijk vaker dan de foutmarge verklaart.',
    chart: simSplit(simDonut(SIM_START_LABELS.map((l, i) => ({ v: startPcts[i], c: SIM_START_COLORS[i], label: l })), { center: '25%', sub: 'eerlijk' }),
      simLegend(SIM_START_LABELS.map((l, i) => [SIM_START_COLORS[i], `${l} · ${nl(startPcts[i], 1)}%`]))),
    details: tbl('<th>Startpositie</th><th>Winst% (±95%-marge)</th><th>Gem. beurten tot winst</th>', rows) +
      `<p class="hint">Balans: ${verdict} (spreiding <b>${nl(spread, 1)}</b> procentpunt, gem. foutmarge ±<b>${nl(avgMoe, 1)}</b>).</p>` });

  // Er wordt doorgespeeld tot de nummer 3 binnen is, dus van elk potje ligt de hele klassering
  // vast. Alleen naar winst kijken verbergt een startpositie die zelden wint maar wel structureel
  // derde of vierde wordt.
  const seatPcts = seatWins.map(w => played ? w / played * 100 : 0);
  const seatSpread = Math.max(...seatPcts) - Math.min(...seatPcts);
  const rankPcts = SIM_START_LABELS.map(lbl => {
    const counts = startRanks[lbl], total = counts.reduce((a, b) => a + b, 0);
    return counts.map(c => total ? c / total * 100 : 0);
  });
  const rankRows = SIM_START_LABELS.map((lbl, i) => {
    const counts = startRanks[lbl], total = counts.reduce((a, b) => a + b, 0);
    const avgRank = total ? counts.reduce((s, c, j) => s + c * (j + 1), 0) / total : 0;
    return `<tr><td>${lbl}</td>${rankPcts[i].map(p => `<td class="num">${nl(p, 1)}%</td>`).join('')}<td class="num">${nl(avgRank, 2)}</td></tr>`;
  }).join('');
  cards.seat = simCard({ id: 'seat', title: 'Beurtvolgorde en eindplaats', st: played === 0 ? 'warn' : seatSpread <= 3 ? 'ok' : 'warn',
    big: `${nl(seatSpread, 1)} pt`, bl: 'verschil tussen de beste en slechtste plek in de beurtvolgorde',
    line: seatSpread <= 3 ? 'Wie het eerst mag gooien heeft nauwelijks voordeel.' : 'De beurtvolgorde maakt merkbaar verschil.',
    chart: simChart(simHBars(seatPcts.map((v, i) => ({ label: `${i + 1}e aan zet`, v })), { max: 35, ref: 25, w: 320, lw: 96 })) +
      simChart(simRankGrid(SIM_START_LABELS, rankPcts)),
    details: tbl('<th>Startpositie</th><th>1e</th><th>2e</th><th>3e</th><th>4e</th><th>Gem. plaats</th>', rankRows) +
      `<p class="hint">Er wordt doorgespeeld tot de <b>nummer 3</b> binnen is; de laatste speler is dan automatisch vierde. Bij een eerlijk bord ligt elke kolom rond de 25% en de gemiddelde plaats rond de 2,50.</p>` +
      tbl('<th>Beurtvolgorde</th><th>Winst%</th>', seatRows) });

  // ---------- Tempo en spanning ----------
  // `gameLengths` telt de beurten van ALLE spelers bij elkaar op — dat is de lengte van het potje.
  // Delen door het aantal spelers geeft hoe vaak één speler aan de beurt komt.
  const duurRij = (label, totaal) =>
    `<tr><td>${label}</td><td class="num">${nl(totaal, Number.isInteger(totaal) ? 0 : 1)}</td><td class="num">${nl(totaal / spelers, 1)}</td></tr>`;
  cards.len = simCard({ id: 'len', title: 'Speelduur', st: 'info',
    big: `${Math.round(avg)} beurten`, bl: `${nl(avg / spelers, 1)} per speler`,
    line: 'Van de eerste worp tot de nummer 3 binnen is.',
    chart: renderHistogram(gameLengths) + simMinis([[min, 'kortste'], [median, 'mediaan'], [max, 'langste']]),
    details: tbl('<th>Speelduur</th><th>Beurten totaal</th><th>Per speler</th>',
      duurRij('Gemiddeld', avg) + duurRij('Mediaan', median) + duurRij('Kortste potje', min) + duurRij('Langste potje', max)) +
      `<p class="hint">De linkerkolom is het hele potje, de rechter hoe vaak één speler aan de beurt komt (${spelers} spelers, om de beurt).</p>` });

  cards.tension = simCard({ id: 'tension', title: 'Spanning', st: nailBiterPct >= 60 ? 'ok' : 'warn',
    big: `${nl(nailBiterPct, 0)}%`, bl: 'van de potjes beslist met 1 opdracht verschil',
    line: nailBiterPct >= 60 ? 'Bijna elk potje is spannend tot het eind.' : 'Veel potjes worden met ruime voorsprong gewonnen.',
    chart: simSplit(simDonut([{ v: nailBiterPct, c: SIM_COL.green, label: '1 verschil' }, { v: 100 - nailBiterPct, c: SIM_COL.dim, label: 'meer verschil' }], { center: nl(nailBiterPct, 0) + '%', sub: 'nek-aan-nek' }),
      simMinis([[nl(avgGap, 1), 'achterstand nr. 2'], [nl(blockedPct, 0) + '%', 'beurten met blokkade'], [stuckCount, 'vastgelopen']])),
    details: tbl('<th>Meetpunt</th><th>Waarde</th>',
      `<tr><td>Nummer 2 achter bij winst</td><td class="num">${nl(avgGap, 1)} opdr.</td></tr>` +
      `<tr><td>Beslist met 1 opdracht verschil</td><td class="num">${nl(nailBiterPct, 1)}%</td></tr>` +
      `<tr><td>Beurten met een bezet vakje op de route</td><td class="num">${nl(blockedPct, 1)}%</td></tr>`) +
      `<p class="hint">"Blokkade": een speler kwam ergens in zijn zoektocht naar de beste route een bezet vakje tegen (niet per se op de uiteindelijk gekozen route).</p>` });

  // ---------- Geluk ----------
  const cbN = extra.comebackGames;
  const cbPct = (i) => cbN ? extra.comebackHist[i] / cbN * 100 : 0;
  const cbMax = Math.max(...[0, 1, 2, 3].map(cbPct));
  const notLeader = 100 - cbPct(0);
  const cbRows = [['Stond voor (of gedeeld)', 0], ['1 opdracht achter', 1], ['2 opdrachten achter', 2], ['3 of meer achter', 3]]
    .map(([label, i]) => `<tr><td>${label}</td>${barCell(cbPct(i), cbMax)}</tr>`).join('');
  const cbCols = [SIM_COL.blue, SIM_COL.green, SIM_COL.amber, SIM_COL.red];
  const cbLabels = ['stond voor', '1 achter', '2 achter', '3+ achter'];
  cards.comeback = simCard({ id: 'comeback', title: 'Kan de achterste terugkomen?', st: notLeader >= 30 ? 'ok' : 'warn',
    big: `${nl(notLeader, 0)}%`, bl: 'van de winnaars stond halverwege níet voor',
    line: notLeader >= 30 ? 'Achterstaan halverwege is geen verloren potje.' : 'Wie halverwege voorstaat, wint meestal ook.',
    chart: simChart(simStack(cbLabels.map((label, i) => ({ v: cbPct(i), c: cbCols[i], label })))) +
      simLegend(cbLabels.map((t, i) => [cbCols[i], `${t} ${nl(cbPct(i), i === 3 ? 1 : 0)}%`])),
    details: tbl('<th>Winnaar halverwege</th><th>Potjes</th>', cbRows) +
      `<p class="hint">Halverwege is het eind van de ronde waarin de eerste speler zijn ${SIM_QUESTS_TO_WIN / 2}e opdracht haalt. Hoe ver lag de latere winnaar toen achter op de koploper?</p>` });

  const sh = extra.searchHist;
  const shTotal = sh.reduce((a, b) => a + b, 0);
  const shSum = (from, to) => { let s = 0; for (let i = from; i <= Math.min(to, SIM_SEARCH_HIST_MAX); i++) s += sh[i]; return s; };
  const shAvg = shTotal ? sh.reduce((s, c, i) => s + c * i, 0) / shTotal : 0;
  const shBuckets = [['1', 1, 1], ['2', 2, 2], ['3', 3, 3], ['4–5', 4, 5], ['6–7', 6, 7],
    [`${SIM_LONG_SEARCH}–${SIM_SEARCH_HIST_MAX - 1}`, SIM_LONG_SEARCH, SIM_SEARCH_HIST_MAX - 1],
    [`${SIM_SEARCH_HIST_MAX}+`, SIM_SEARCH_HIST_MAX, SIM_SEARCH_HIST_MAX]];
  const shPcts = shBuckets.map(([, a, b]) => shTotal ? shSum(a, b) / shTotal * 100 : 0);
  const shMax = Math.max(...shPcts);
  const shRows = shBuckets.map(([label], i) => `<tr><td>${label} beurt${label === '1' ? '' : 'en'}</td>${barCell(shPcts[i], shMax)}</tr>`).join('');
  const longPct = played ? extra.gamesWithLongSearch / played * 100 : 0;
  cards.search = simCard({ id: 'search', title: 'Pech-reeksen', st: longPct <= 25 ? 'ok' : 'warn',
    big: `${nl(shAvg, 1)} beurten`, bl: 'gemiddeld achter één opdracht aan',
    line: `In ${nl(longPct, 0)}% van de potjes zat iemand ${SIM_LONG_SEARCH} beurten of langer achter één opdracht aan.`,
    chart: simChart(simColumns(shPcts, shBuckets.map(b => b[0]), { color: SIM_COL.violet, hi: 5 })) +
      simMinis([[extra.longestSearch, 'langste zoektocht'], [nl(longPct, 0) + '%', `potjes met ${SIM_LONG_SEARCH}+`], [nl(shAvg, 1), 'gemiddeld']]),
    details: tbl('<th>Zoektocht duurde</th><th>Opdrachten</th>', shRows) +
      `<p class="hint">Hoeveel eigen beurten zat een speler achter één opdracht aan, tot hij 'm had? Zo'n lange reeks voelt aan tafel als pech, ook als het gemiddelde klopt.</p>` });

  // ---------- Energie ----------
  // Welke actie wint? Elk potje heeft precies één speler per strategie, willekeurig over de
  // startposities verdeeld, dus dit is een zuiver onderling toernooi.
  const stratWin = ENERGY_STRATEGIES.map(id => { const s = strategyStats[id]; return s.games ? s.wins / s.games * 100 : 0; });
  const stratMin = Math.min(...stratWin), stratMax = Math.max(...stratWin);
  const stratRows = ENERGY_STRATEGIES.map(id => {
    const s = strategyStats[id];
    const act = ENERGY_ACTIONS[id];
    const winPct = s.games ? (s.wins / s.games * 100) : 0;
    const moe = simMarginOfError(s.wins, s.games);
    const top2Pct = s.games ? (s.top2 / s.games * 100) : 0;
    const avgRank = s.games ? (s.rankSum / s.games) : 0;
    const usesPerGame = s.games ? (s.uses / s.games) : 0;
    const cost = act.cost ? `${act.cost} energie` : '—';
    return `<tr><td>${act.name} <span class="sub">(${cost})</span></td>` +
      `<td class="num">${nl(winPct, 1)}% ± ${nl(moe, 1)}</td>` +
      `<td class="num">${nl(top2Pct, 1)}%</td>` +
      `<td class="num">${nl(avgRank, 2)}</td>` +
      `<td class="num">${nl(usesPerGame, 1)}</td></tr>`;
  }).join('');
  const stratCols = [SIM_COL.amber, SIM_COL.blue, SIM_COL.violet, SIM_COL.green];
  cards.strat = simCard({ id: 'strat', title: 'Welke energie-actie wint?',
    st: stratMin >= 23 && stratMax <= 27 ? 'ok' : stratMin >= 21 && stratMax <= 29 ? 'warn' : 'bad',
    big: `${nl(stratMin, 1)}–${nl(stratMax, 1)}%`, bl: `winstkans van de ${ENERGY_STRATEGIES.length} strategieën, doel 23–27%`,
    line: 'Elke bot speelt één vaste strategie; het Portaalkanon mag iedereen erbij.',
    chart: simChart(simHBars(ENERGY_STRATEGIES.map((id, i) => ({ label: ENERGY_ACTIONS[id].name.replace('Zwaartekracht-', ''), v: stratWin[i], c: stratCols[i % stratCols.length] })),
      { max: 35, ref: 25, band: [23, 27], w: 320, lw: 110 })),
    details: tbl('<th>Strategie</th><th>Winst% (±95%-marge)</th><th>Top 2</th><th>Gem. plaats</th><th>Keer ingezet <span class="sub">(incl. portaalschoten)</span></th>', stratRows) +
      `<p class="hint">4 spelers, ${ENERGY_STRATEGIES.length} strategieën — elk potje speelt elke strategie één keer, geloot over de startposities. Bots spelen met dezelfde tijdsregels als jij: een energie-actie kies je vóór de worp, en de energiesteen van deze beurt geef je pas volgende beurt uit. Herprioritering zet een bot in als zijn opdracht verder dan ${REORDER_PEEK_THRESHOLD} vakjes weg ligt, de laarzen als een rechte lijn hem dichter bij zijn doel brengt, en Noodtransport als zijn doel verder dan ${JUMP_BOT_MIN_DIST} vakjes weg ligt. Bij gelijkwaardige strategieën staat iedereen op 25% winst en gemiddelde plaats 2,50.</p>` });

  const energyTurns = extra.energyLevels.reduce((a, b) => a + b, 0);
  const energyAvg = energyTurns ? extra.energyLevels.reduce((s, c, lvl) => s + c * lvl, 0) / energyTurns : 0;
  const energyAtCap = energyTurns ? (extra.energyLevels[ENERGY_MAX] / energyTurns * 100) : 0;
  const energyWastePct = extra.energyRolled ? (extra.energyWasted / extra.energyRolled * 100) : 0;
  const energyPerTurn = energyTurns ? (extra.energyRolled / energyTurns) : 0;
  // kans dat je aan het begin van een beurt minstens N energie hebt = kans dat je een actie van N kunt betalen
  let atLeast = 0;
  const affordRows = [];
  for (let lvl = ENERGY_MAX; lvl >= 1; lvl--){
    atLeast += extra.energyLevels[lvl];
    affordRows.unshift(`<tr><td>${lvl} energie</td><td class="num">${energyTurns ? nl((atLeast / energyTurns * 100), 1) : '0,0'}%</td></tr>`);
  }
  const levelPcts = Array.from(extra.energyLevels, c => energyTurns ? c / energyTurns * 100 : 0);
  cards.energy = simCard({ id: 'energy', title: 'Energievoorraad', st: energyWastePct <= 5 ? 'ok' : 'warn',
    big: nl(energyAvg, 1), bl: `energie gemiddeld op zak (plafond ${ENERGY_MAX})`,
    line: energyWastePct <= 5 ? 'Er gaat bijna niets verloren tegen het plafond.' : 'Er gaat veel energie verloren tegen het plafond.',
    chart: simChart(simColumns(levelPcts, levelPcts.map((_, i) => i % 2 === 0 ? String(i) : ''),
      { color: SIM_COL.green, hi: ENERGY_MAX, tips: levelPcts.map((p, i) => `${i} energie: ${nl(p, 1)}% van de beurten`) })) +
      simMinis([[nl(energyAtCap, 1) + '%', 'beurten op het plafond'], [nl(energyWastePct, 1) + '%', 'energie verloren'], [nl(energyPerTurn, 2), 'per beurt gegooid']]),
    details: tbl("<th>Kosten van een actie</th><th>Beurten waarin je 'm kunt betalen</th>", affordRows.join('')) +
      `<p class="hint">De energiesteen (<b>${ENERGY_DIE_FACES.map(f => f || '–').join(' ')}</b>) rolt elke beurt mee; wat je gooit kun je pas volgende beurt uitgeven. Cijfers over de ${ENERGY_STRATEGIES.length} bot-strategieën samen. Het diagram is de verdeling van de voorraad over alle beurten (0 links, ${ENERGY_MAX} rechts).</p>` });

  // ---------- Acties en portalen ----------
  const yieldText = (id, st) => {
    if (!st.uses) return '—';
    if (id === 'boost') return `+${nl(st.steps / st.uses, 1)} stappen (3e steen)`;
    if (id === 'reorder') return `wisselt in ${nl(pctOf(st.swaps, st.uses), 0)}% · scheelt dan gem. ${nl(st.swaps ? st.saved / st.swaps : 0, 1)} vakjes`;
    if (id === 'gravity') return `gem. ${nl(st.steps / st.uses, 1)} vakjes rechtdoor · ${nl(pctOf(st.direct, st.uses), 0)}% pakt meteen de opdracht`;
    if (id === 'jump') return `gem. ${nl(st.steps / st.uses, 1)} vakjes gesprongen · ${nl(pctOf(st.direct, st.uses), 0)}% landt precies op de opdracht`;
    if (id === 'portal') return 'elke bot schiet als het hem ≥' + PORTAL_BOT_MIN_GAIN + ' stappen scheelt';
    return '—';
  };
  const yieldIds = [...ENERGY_STRATEGIES, 'portal'].filter(id => extra.energyStats[id]);
  const noActionPct = pctOf(extra.noEnergyBanked, extra.noEnergyTurns);
  const yieldRows = yieldIds.map(id => {
    const st = extra.energyStats[id];
    return `<tr><td>${ENERGY_ACTIONS[id].name}<span class="sub">${yieldText(id, st)}</span></td>` +
      `<td class="num">${nl(played ? st.uses / played : 0, 1)}</td>` +
      `<td class="num">${nl(pctOf(st.banked, st.uses), 0)}%</td></tr>`;
  }).join('') +
    `<tr><td>Geen energie-actie<span class="sub">ter vergelijking: een beurt zonder actie</span></td><td class="num">—</td>` +
    `<td class="num">${nl(noActionPct, 0)}%</td></tr>`;
  cards.yield = simCard({ id: 'yield', title: 'Wat levert een actie op?', st: 'info',
    big: `${nl(noActionPct, 0)}%`, bl: 'kans op een opdracht in een beurt zónder actie',
    line: 'Hoe vaak een bot in de beurt van de actie een opdracht pakt. Groen = beter dan zonder actie.',
    chart: simChart(simHBars(yieldIds.map(id => {
      const st = extra.energyStats[id], v = pctOf(st.banked, st.uses);
      return { label: ENERGY_ACTIONS[id].name.replace('Zwaartekracht-', ''), v, c: v > noActionPct ? SIM_COL.green : SIM_COL.dim };
    }), { max: 70, ref: noActionPct, w: 320, lw: 110, fmt: v => nl(v, 0) + '%' })),
    // over de volle breedte: zo blijven alle andere rijen paren (sinds de kaart Roosters, 2026-11)
    details: tbl('<th>Actie</th><th>Per potje</th><th>Opdracht gehaald</th>', yieldRows), wide: true });

  // De vier meetpunten uit de analyse "Axiom-9 Portalen". De grens voor opdrachten via een portaal
  // was 5%; sinds de twee paren + kanon voor 5 (gebruikerswens 2026-11: portalen moeten meer
  // gebruikt worden, gemeten ±24%) is hij 30%.
  const pt = extra.portal;
  if (pt){
    const okTag = (ok, warn) => ok ? '<span class="ok">✓ goed</span>' : warn ? '<span style="color:var(--amber)">≈ randgeval</span>' : '<span class="bad">✕ buiten de grens</span>';
    const questPct = pctOf(pt.jumpQuests, pt.quests);
    const topPct = pctOf(pt.topWins, pt.topGames);
    const stealPct = pctOf(pt.steals, pt.shots);
    const otherPct = pctOf(pt.jumpsOther, pt.jumps);
    const ptRows = [
      ['Portaalschoten per potje', nl(played ? pt.shots / played : 0, 1), `waarvan <b>${nl(stealPct, 0)}%</b> een portaal van een ander verplaatst ("stelen")`, ''],
      ['Portaalsprongen per potje', nl(played ? pt.jumps / played : 0, 1), `<b>${nl(otherPct, 0)}%</b> door iemand die geen van beide portalen legde`, ''],
      ['Opdrachten in een beurt met een portaalsprong', nl(questPct, 1) + '%', 'grens: hooguit 30% (40% = randgeval)', okTag(questPct <= 30, questPct <= 40)],
      ['Meeste teleporteerder wint', nl(topPct, 1) + '%', `grens: hooguit 30% (35% = randgeval) · ${pt.topGames} potjes met één duidelijke koploper in sprongen`, okTag(topPct <= 30, topPct <= 35)],
    ].map(([label, val, sub, tag]) => `<tr><td>${label}<span class="sub">${sub}</span></td><td class="num">${val}</td><td>${tag}</td></tr>`).join('');
    const ptSt = questPct <= 30 && topPct <= 30 ? 'ok' : questPct <= 40 && topPct <= 35 ? 'warn' : 'bad';
    cards.portal = simCard({ id: 'portal', title: 'Portalen', st: ptSt,
      big: `${nl(questPct, 1)}%`, bl: 'van de opdrachten in een beurt met een portaalsprong (grens 30%)',
      line: ptSt === 'ok' ? 'Portalen helpen, maar beslissen het potje niet.' : 'Portalen wegen zwaarder dan de vooraf gezette grens.',
      chart: simSplit(simDonut([{ v: stealPct, c: SIM_COL.red, label: 'gestolen' }, { v: 100 - stealPct, c: SIM_COL.blue, label: 'eigen of nieuw' }], { center: nl(stealPct, 0) + '%', sub: 'gestolen' }),
        simMinis([[nl(played ? pt.shots / played : 0, 1), 'schoten per potje'], [nl(played ? pt.jumps / played : 0, 1), 'sprongen per potje'], [nl(topPct, 0) + '%', 'meeste springer wint']])),
      details: tbl('<th>Meetpunt</th><th>Waarde</th><th>Oordeel</th>', ptRows) +
        `<p class="hint">Bij de start liggen er ${PORTAL_COUNT / 2 === 1 ? 'een blauw en een rood portaal' : `${PORTAL_COUNT / 2} portaalparen`}, minstens ${PORTAL_START_MIN_DIST} stappen uit elkaar. Met het <b>Portaalkanon</b> (${ENERGY_ACTIONS.portal.cost} energie) schiet een speler er een naar de muur; stap je in een portaal, dan kom je uit het andere en loop je door met de rest van je worp. Elke bot schiet als het hem minstens ${PORTAL_BOT_MIN_GAIN} stappen scheelt.</p>` });
  }

  // ---------- Roosters (zie ROOSTERS) ----------
  // Grenzen zoals bij de portalen: wie het vaakst kruipt mag niet te vaak winnen (≤30%), en kruipen
  // mag niet te veel opdrachten beslissen (≤10%; gemeten bij het inbouwen ±2%).
  const gr = extra.grate;
  if (gr && graph.grates && graph.grates.length){
    const okTag = (ok, warn) => ok ? '<span class="ok">✓ goed</span>' : warn ? '<span style="color:var(--amber)">≈ randgeval</span>' : '<span class="bad">✕ buiten de grens</span>';
    const per = v => nl(played ? v / played : 0, 1);
    const got = gr.buys + gr.cardBuys;
    const usedPct = pctOf(gr.uses, got);
    const gQuestPct = pctOf(gr.useQuests, pt ? pt.quests : 0);
    const gTopPct = pctOf(gr.topWins, gr.topGames);
    const grRows = [
      ['Schroevendraaiers gekocht per potje', per(gr.buys), `voor ${ENERGY_ACTIONS.driver.cost} energie`, ''],
      ['Als kristal gespeeld per potje', per(gr.cardBuys), `${actionCardCopies('driver')} in de stapel`, ''],
      ['Keer gekropen per potje', per(gr.uses), `<b>${nl(usedPct, 0)}%</b> van de schroevendraaiers is gebruikt`, ''],
      ['Opdrachten in een beurt met kruipen', nl(gQuestPct, 1) + '%', 'grens: hooguit 10% (15% = randgeval)', okTag(gQuestPct <= 10, gQuestPct <= 15)],
      ['Meeste kruiper wint', nl(gTopPct, 1) + '%', `grens: hooguit 30% (35% = randgeval) · ${gr.topGames} potjes met één duidelijke koploper`, okTag(gTopPct <= 30, gTopPct <= 35)],
    ].map(([label, val, sub, tag]) => `<tr><td>${label}<span class="sub">${sub}</span></td><td class="num">${val}</td><td>${tag}</td></tr>`).join('');
    const grSt = gQuestPct <= 10 && gTopPct <= 30 ? 'ok' : gQuestPct <= 15 && gTopPct <= 35 ? 'warn' : 'bad';
    cards.grate = simCard({ id: 'grate', title: 'Roosters', st: grSt,
      big: per(gr.uses), bl: 'keer gekropen per potje (door alle spelers samen)',
      line: grSt === 'ok' ? 'De luchtschacht is een snelle route, maar beslist het potje niet.' : 'Kruipen weegt zwaarder dan de vooraf gezette grens.',
      chart: simSplit(simDonut([{ v: usedPct, c: '#e0915c', label: 'gebruikt' }, { v: 100 - usedPct, c: SIM_COL.dim, label: 'niet gebruikt' }], { center: nl(usedPct, 0) + '%', sub: 'gebruikt' }),
        simMinis([[per(gr.buys), 'gekocht per potje'], [per(gr.cardBuys), 'als kristal'], [nl(gTopPct, 0) + '%', 'meeste kruiper wint']])),
      details: tbl('<th>Meetpunt</th><th>Waarde</th><th>Oordeel</th>', grRows) +
        `<p class="hint">Elke gang heeft een rooster (${graph.grates.length} op dit bord). Met een <b>schroevendraaier</b> (${ENERGY_ACTIONS.driver.cost} energie of het kristal) kruip je zonder stap van rooster naar rooster en loop je met de rest van je worp door; daarna is hij op. Een bot koopt er een als het hem minstens ${GRATE_BOT_MIN_GAIN} stappen scheelt.</p>` });
  }

  // ---------- Kristallen ----------
  // Winst% van wie het kristal speelde: 25% is gemiddeld (4 spelers). Boven 31% = verdacht sterk,
  // onder 19% = zwak. Wie vooraan ligt krijgt vaker kristallen, dus het gaat om de uitschieters.
  const cardWinPct = id => { const w = extra.cardWin[id]; return w.games ? w.wins / w.games * 100 : null; };
  const cardRows = ACTION_CARD_IDS.map(id => {
    const act = ACTION_CARDS[id];
    const perGame = played ? (extra.cardUses[id] / played) : 0;
    const winPct = cardWinPct(id);
    const tag = winPct === null ? '—' : winPct > 31 ? '<span class="bad">✕ te sterk</span>'
      : winPct < 19 ? '<span style="color:var(--amber)">≈ zwak</span>' : '<span class="ok">✓ in balans</span>';
    return `<tr><td>${act.name} <span class="sub">${act.hint}</span></td><td class="num">${nl(perGame, 2)}</td><td class="num">${winPct !== null ? nl(winPct, 1) + '%' : '—'}</td><td>${tag}</td></tr>`;
  }).join('');
  const playedCards = ACTION_CARD_IDS.filter(id => cardWinPct(id) !== null);
  const cwVals = playedCards.map(cardWinPct);
  const cardMin = cwVals.length ? Math.min(...cwVals) : 0, cardMax = cwVals.length ? Math.max(...cwVals) : 0;
  cards.cardwin = simCard({ id: 'cardwin', title: 'Wie wint met welk kristal?',
    st: !cwVals.length ? 'warn' : cardMin >= 19 && cardMax <= 31 ? 'ok' : cardMax > 31 ? 'bad' : 'warn',
    big: `${nl(cardMin, 1)}–${nl(cardMax, 1)}%`, bl: 'winstkans van wie het kristal speelde, grens 19–31%',
    line: cardMin >= 19 && cardMax <= 31 ? 'Geen kristal is te sterk of te zwak.' : cardMax > 31 ? 'Er is een kristal dat te sterk lijkt.' : 'Er is een kristal dat zwak lijkt.',
    chart: simChart(simDots(playedCards.map(id => ({ label: ACTION_CARDS[id].name, v: cardWinPct(id), c: SIM_TINT_COLORS[ACTION_CARD_TINTS[id]] || SIM_COL.blue })), { band: [19, 31] })) +
      simLegend(Object.entries(CRYSTAL_CATS).map(([tint, name]) => [SIM_TINT_COLORS[tint], name.toLowerCase()])),
    details: tbl('<th>Kristal</th><th>Keer gebruikt per potje</th><th>Wint wie hem speelt</th><th>Oordeel</th>', cardRows) +
      `<p class="hint">"Wint wie hem speelt": van de spelers die dit kristal in een potje minstens één keer gebruikten, het deel dat dat potje won. Gemiddeld is 25%; iets erboven is normaal, want wie vooroploopt krijgt vaker kristallen.</p>` });

  const drawsPerGame = played ? (extra.cardDraws / played) : 0;
  const handFullPct = extra.cardDraws + extra.handFullOnBank
    ? (extra.handFullOnBank / (extra.cardDraws + extra.handFullOnBank) * 100) : 0;
  const actionCellDrawsPerGame = played ? (extra.actionCellDraws / played) : 0;
  const actionCellHandFullPct = extra.actionCellDraws + extra.handFullOnActionCell
    ? (extra.handFullOnActionCell / (extra.actionCellDraws + extra.handFullOnActionCell) * 100) : 0;
  const deckSize = ACTION_CARD_IDS.reduce((n, id) => n + actionCardCopies(id), 0);
  const totalDraws = drawsPerGame + actionCellDrawsPerGame;
  const viaQuestPct = totalDraws ? drawsPerGame / totalDraws * 100 : 0;
  const topUsed = ACTION_CARD_IDS.slice().sort((a, b) => extra.cardUses[b] - extra.cardUses[a]).slice(0, 6);
  const topMax = Math.max(0.5, ...topUsed.map(id => played ? extra.cardUses[id] / played : 0));
  cards.carduse = simCard({ id: 'carduse', title: 'Gebruik en kluis', st: Math.max(handFullPct, actionCellHandFullPct) <= 5 ? 'ok' : 'warn',
    big: nl(totalDraws, 1), bl: 'kristallen gekregen per potje (alle spelers samen)',
    line: `De kluis was vol bij ${nl(handFullPct, 1)}% van de kansen via een opdracht en ${nl(actionCellHandFullPct, 1)}% via een kristalvakje.`,
    chart: simSplit(simDonut([{ v: viaQuestPct, c: SIM_COL.blue, label: 'via opdrachten' }, { v: 100 - viaQuestPct, c: SIM_COL.violet, label: 'via kristalvakjes' }], { center: nl(viaQuestPct, 0) + '%', sub: 'via opdracht', size: 96, w: 15 }),
      simHBars(topUsed.map(id => ({ label: ACTION_CARDS[id].name.replace('Zwaartekracht-', ''), v: played ? extra.cardUses[id] / played : 0, c: SIM_TINT_COLORS[ACTION_CARD_TINTS[id]] })),
        { max: topMax, w: 260, lw: 118, fmt: v => nl(v, 1) })),
    details: tbl('<th>Bron</th><th>Per potje</th><th>Kluis vol</th>',
      `<tr><td>Opdracht voltooid</td><td class="num">${nl(drawsPerGame, 1)}</td><td class="num">${nl(handFullPct, 1)}%</td></tr>` +
      `<tr><td>Kristalvakje in een gang</td><td class="num">${nl(actionCellDrawsPerGame, 1)}</td><td class="num">${nl(actionCellHandFullPct, 1)}%</td></tr>`) +
      `<p class="hint">Gedeelde stapel van ${deckSize} (${ACTION_CARD_IDS.length} soorten, van elk 2, Portaalsleutel ${actionCardCopies('portalkey')}), kluis max ${ACTION_CARD_HAND_MAX}. Een kristalvakje levert hooguit 1 kristal per beurt op en stopt je zet niet. Het balkdiagram toont de 6 meest gebruikte kristallen (keer per potje).</p>` });

  // ---------- Bord ----------
  const questAvg = SIM_QUEST_LABELS.map(lbl => { const qs = questStats[lbl]; return qs.count ? qs.turns / qs.count : null; });
  const qVals = questAvg.filter(v => v !== null);
  const questSpread = qVals.length ? Math.max(...qVals) - Math.min(...qVals) : 0;
  cards.quests = simCard({ id: 'quests', title: 'Opdrachtvakjes', st: questSpread <= 1.5 ? 'ok' : 'warn',
    big: `${nl(questSpread, 1)} beurten`, bl: 'verschil tussen de makkelijkste en moeilijkste opdracht',
    line: questSpread <= 1.5 ? 'Geen opdracht ligt echt afgelegen.' : 'Eén of meer opdrachten liggen duidelijk afgelegen.',
    chart: simChart(simHBars(SIM_QUEST_LABELS.map((lbl, i) => ({ label: QUEST_NAMES[lbl], v: questAvg[i] || 0 })),
      { max: Math.max(6, Math.ceil(Math.max(0, ...qVals))), w: 320, lw: 130, fmt: v => nl(v, 1) })),
    details: tbl('<th>Opdracht</th><th>Gem. beurten om te bereiken</th><th>Keer bereikt</th>', questRows) +
      `<p class="hint">Hoe hoger het gemiddelde, hoe afgelegener dat opdrachtvakje ligt vanaf waar spelers 'm meestal moeten benaderen.</p>` });

  const cold5 = coldRows.slice(0, 5);
  cards.cold = simCard({ id: 'cold', title: 'Koudste tegels',
    st: !coldest ? 'warn' : deadTiles ? 'bad' : weakTiles ? 'warn' : 'ok',
    big: coldest ? `${nl(coldest.share, 1)}%` : '—', bl: coldest ? `van het verkeer op de stilste tegel (${tileName(coldest)})` : '',
    line: deadTiles ? 'Er is een dode tegel: daar komt (bijna) niemand.' : weakTiles ? 'Geen dode tegel, maar de stilste krijgt erg weinig bezoek.' : 'Geen dode tegel; elke tegel krijgt verkeer.',
    chart: simChart(simHBars(cold5.map(r => ({ label: tileName(r), v: r.share, c: r.share < SIM_DEAD_TILE_SHARE ? SIM_COL.red : r.share < SIM_WEAK_TILE_SHARE ? SIM_COL.amber : SIM_COL.blue })),
      { max: Math.max(5, Math.ceil(Math.max(0, ...cold5.map(r => r.share)))), w: 320, lw: 130 })),
    details: renderColdZones(graph, heatmap) +
      `<p class="hint">De kandidaten voor een "lus zonder opdracht waar niemand komt". Gemiddeld krijgt een tegel 5% van het verkeer; onder ${nl(SIM_DEAD_TILE_SHARE, 1)}% telt hij als dood.</p>` });

  cards.heat = simCard({ id: 'heat', title: 'Drukte op het bord', st: 'info', wide: true,
    line: `Hoe vaak elk vakje betreden werd over alle ${played} meegetelde potjes — laat drukke gangen en nauwelijks gebruikte hoekjes zien.`,
    chart: renderHeatmap(graph, heatmap) });

  // ---------- rijen ----------
  const rowsOf = [
    [cards.start, cards.seat],
    [cards.len, cards.tension],
    [cards.comeback, cards.search],
    [cards.strat, cards.energy],
    [cards.yield],
    [cards.portal, cards.grate],
    [cards.cardwin, cards.carduse],
    [cards.quests, cards.cold],
    [cards.heat],
  ];
  html += `<div class="sim-expand-row"><button type="button" class="small ghost" id="btnSimExpand" aria-expanded="true">Alle kaarten inklappen</button></div>`;
  html += `<div class="sim-rows">${rowsOf.map(r => simRow(r.filter(Boolean))).join('')}</div>`;
  simResultsEl.innerHTML = html;

  // in-/uitklappen: per kaart (pijltje) of alles tegelijk
  const setCard = (card, open) => {
    card.classList.toggle('is-collapsed', !open);
    const b = card.querySelector('.sim-card-toggle');
    if (b) b.setAttribute('aria-expanded', String(open));
  };
  simResultsEl.querySelectorAll('.sim-card-toggle').forEach(b => b.addEventListener('click', () => {
    const card = b.closest('.sim-card');
    setCard(card, card.classList.contains('is-collapsed'));
  }));
  const expandBtn = document.getElementById('btnSimExpand');
  expandBtn.addEventListener('click', () => {
    const open = expandBtn.getAttribute('aria-expanded') !== 'true';
    simResultsEl.querySelectorAll('.sim-card').forEach(c => setCard(c, open));
    expandBtn.setAttribute('aria-expanded', String(open));
    expandBtn.textContent = open ? 'Alle kaarten inklappen' : 'Alle kaarten uitklappen';
  });
  simStatusEl.innerHTML = '';   // geen "✓ Klaar in … seconden" meer (gebruikerswens)
}

// na hoeveel potjes we de klok checken. Was 64 ("klok-uitlezen kost ook tijd"), maar één potje
// duurt al gauw 5-20 ms, dus een brok liep dan vaak 0,3-1 s door i.p.v. 30 ms — de browser kreeg
// al die tijd geen beeldje, en de voortgangsring kon zijn animatie niet eens starten (begon zo
// steeds opnieuw vanaf 0). performance.now() kost een fractie van een microseconde: elk potje dus.
const SIM_PROGRESS_CHECK_EVERY = 1;
// hoe lang een brok werk maximaal ononderbroken doorrekent voordat we een frame teruggeven
// aan de browser — 30ms geeft de voortgangsbalk een vloeiende, ~30fps-achtige update zonder
// dat de duizenden setTimeout-overgangen zelf noemenswaardige tijd kosten
const SIM_CHUNK_BUDGET_MS = 30;

function updateSimProgress(done, n, elapsedMs){
  if (!simLoader) return;
  simLoader.progress(done, n, elapsedMs);
  if (simStream && n) simStream.progress(done / n);
  if (simLoaderCountEl) simLoaderCountEl.textContent =
    `${done.toLocaleString('nl-NL')} / ${n.toLocaleString('nl-NL')} potjes`;
}

function runSimulationBatch(){
  if (simRunning) return;   // een dubbele klik mag geen tweede reeks potjes tegelijk starten

  // tijdens het genereren is er nog geen (geldig) bord — de bereikbaarheidscheck hieronder gaf dan
  // een verwarrende "26 onbereikbare vakjes" (gebruikersmelding)
  if (genRunning){
    simStatusEl.innerHTML = `<span class="bad sim-stopped">✕ De map wordt nog gegenereerd — wacht tot hij klaar is en probeer het dan opnieuw.</span>`;
    simResultsEl.innerHTML = '';
    return;
  }

  const reach = analyseCellReachability();
  if (reach.unreachable.length > 0){
    simStatusEl.innerHTML = `<span class="bad sim-stopped">✕ Dit bord heeft ${reach.unreachable.length} onbereikbare vakjes (roze omrand op de kaart) — pas de indeling aan voordat je simuleert.</span>`;
    simResultsEl.innerHTML = '';
    return;
  }

  // de tegel-editor staat toe dat een 2.x/3.x-label per ongeluk ontbreekt of dubbel
  // voorkomt; zonder deze check crasht de simulatie stil in de achtergrond en blijft
  // de knop voor altijd op "Simuleren…" hangen.
  const graphCheck = buildSimGraph();
  const missing = [...SIM_QUEST_LABELS, ...SIM_START_LABELS].filter(lbl =>
    graphCheck.questCells[lbl] === undefined && graphCheck.startCells[lbl] === undefined);
  if (missing.length){
    simStatusEl.innerHTML = `<span class="bad sim-stopped">✕ Deze vakjes ontbreken op het bord: ${missing.join(', ')} — zet ze terug via de tegel-editor voordat je simuleert.</span>`;
    simResultsEl.innerHTML = '';
    return;
  }

  const n = simCountClamp(parseInt(simCountEl.value, 10));
  simCountSet(n);

  simRunning = true;
  simDone = 0; simTotal = n;
  const runId = ++simRunId;   // deze run herkennen als "nog geldig" bij elke terugkeer naar de browser
  btnSimulate.disabled = true;
  simStatusEl.innerHTML = '';
  simResultsEl.innerHTML = '';
  showSimLoader();
  if (simLoaderCountEl) simLoaderCountEl.textContent = `0 / ${n.toLocaleString('nl-NL')} potjes`;
  const tShown = performance.now();

  // het vakje moet minstens één frame zichtbaar zijn vóórdat het (blokkerende) rekenwerk per
  // brok begint, anders begint het infaden pas na het eerste brok
  setTimeout(async () => {
    try {
      const graph = buildSimGraph();
      const rand = mulberry32(Math.floor(Math.random() * 4294967296));
      const t0 = performance.now();

      const startWins = {}, startTurnsSum = {}, startRanks = {};
      for (const lbl of SIM_START_LABELS){
        startWins[lbl] = 0;
        startTurnsSum[lbl] = 0;
        startRanks[lbl] = [0, 0, 0, 0];   // hoe vaak deze startpositie 1e/2e/3e/4e werd
      }
      const questStats = {};
      for (const lbl of SIM_QUEST_LABELS) questStats[lbl] = { turns: 0, count: 0 };
      const strategyStats = {};
      for (const id of ENERGY_STRATEGIES) strategyStats[id] = { games: 0, wins: 0, top2: 0, rankSum: 0, uses: 0 };
      const seatWins = [0, 0, 0, 0];
      const gameLengths = [];
      const heatmap = new Int32Array(graph.N);
      const cardUses = {}, cardWin = {};
      for (const id of ACTION_CARD_IDS){ cardUses[id] = 0; cardWin[id] = { games: 0, wins: 0 }; }
      const extra = {
        totalTurns: 0, blockedTurns: 0, winGapSum: 0, winGapCount: 0, nailBiters: 0,
        energyRolled: 0, energyWasted: 0,
        energyLevels: new Int32Array(ENERGY_MAX + 1),   // hoe vaak stond een speler op N energie
        cardDraws: 0, handFullOnBank: 0, cardUses, cardWin,
        actionCellDraws: 0, handFullOnActionCell: 0,
        // "Wat levert een energie-actie op?" — per actie: keer ingezet, beurten met een gehaalde
        // opdracht, verplaatste vakjes (sprint/sprong) of extra steen (Stuwstoot), direct op de
        // opdracht geland, en bij Herprioritering: keer gewisseld + vakjes gescheeld
        // ('portal' erbij: geen vaste strategie, maar elke bot mag schieten — zie botPortalWanted)
        energyStats: Object.fromEntries([...ENERGY_STRATEGIES, 'portal'].map(id =>
          [id, { uses: 0, banked: 0, steps: 0, direct: 0, swaps: 0, saved: 0 }])),
        noEnergyTurns: 0, noEnergyBanked: 0,
        // "Pech-reeksen" en "Kan de achterste nog terugkomen?"
        searchHist: new Float64Array(SIM_SEARCH_HIST_MAX + 1), longestSearch: 0, gamesWithLongSearch: 0,
        comebackHist: [0, 0, 0, 0], comebackGames: 0,
        // "Portalen": schoten, gestolen, sprongen (door een ander), opdrachten in een beurt met
        // een sprong, en hoe vaak de speler met de meeste sprongen won
        portal: { shots: 0, steals: 0, jumps: 0, jumpsOther: 0, jumpQuests: 0, quests: 0, topGames: 0, topWins: 0 },
        // "Roosters": schroevendraaiers gekocht (energie) / als kristal gespeeld, keer gekropen,
        // opdrachten in een beurt met een kruipsprong, en of de speler die het meest kroop won
        grate: { buys: 0, cardBuys: 0, uses: 0, useQuests: 0, topGames: 0, topWins: 0 },
      };
      let stuckCount = 0;

      // in brokken doorrekenen i.p.v. één ononderbroken lus: na elk brok geven we de
      // controle terug aan de browser (await setTimeout) zodat die de voortgangsbalk kan
      // schilderen. Zonder dit zou de hele simulatie de pagina bevriezen tot ze klaar is.
      let i = 0;
      while (i < n){
        const chunkStart = performance.now();
        while (i < n){
          const result = simulateOneGame(graph, rand, heatmap, questStats, extra);
          i++;
          if (result.stuck){ stuckCount++; }
          else {
            // p.rankShare > 1 betekent dat deze speler een plaats DEELT met andere spelers
            // (gelijke energie én evenveel actiekaarten aan het eind van de ronde waarin ze
            // finishten) — dan krijgt iedereen in die tie-groep een eerlijk (fractioneel) deel
            // van de credit i.p.v. dat er willekeurig één "de" winnaar wordt aangewezen.
            // rankOverlapFraction reduceert bij een niet-gedeelde plek (rankShare 1) gewoon tot
            // de vertrouwde 0-of-1 uitkomst, dus dit is puur een uitbreiding, geen gedragswijziging
            // voor de (verreweg meeste) potjes zonder tie.
            for (const p of result.players){
              const k = p.rankShare || 1;
              for (let r = p.rank; r < p.rank + k; r++) startRanks[p.startLabel][r - 1] += 1 / k;
              const st = strategyStats[p.strategy];
              st.games++;
              st.rankSum += p.rank + (k - 1) / 2;
              st.uses += p.actionUses;
              st.wins += rankOverlapFraction(p.rank, k, 1);
              st.top2 += rankOverlapFraction(p.rank, k, 2);
              const winFrac = rankOverlapFraction(p.rank, k, 1);
              if (winFrac > 0){
                startWins[p.startLabel] += winFrac;
                startTurnsSum[p.startLabel] += p.finishTurn * winFrac;
                seatWins[p.seat] += winFrac;
              }
            }
            gameLengths.push(result.turns);
          }
          if (i % SIM_PROGRESS_CHECK_EVERY === 0 && performance.now() - chunkStart > SIM_CHUNK_BUDGET_MS) break;
        }
        // het bord kan gewijzigd zijn terwijl deze reeks nog bezig was (dat kon voorheen niet
        // — de pagina was dan bevroren — maar nu de simulatie in brokken loopt wel). Een
        // verouderde run mag de nieuwere "indeling gewijzigd"-melding niet overschrijven.
        if (runId !== simRunId) return;
        simDone = i;
        updateSimProgress(i, n, performance.now() - t0);
        if (i < n) await new Promise(res => setTimeout(res, 0));
      }
      if (runId !== simRunId) return;

      const elapsedMs = performance.now() - t0;
      // de ring vol laten gloeien en even laten staan, en het vakje minstens helemaal laten infaden;
      // dan de uitslag (nog onzichtbaar) opbouwen, en pas daarna overfaden
      simLoader && simLoader.complete();
      if (simStream) simStream.complete();
      await new Promise(res => setTimeout(res,
        Math.max(SIM_STREAM_DONE_MS, GEN_FADE_MS - (performance.now() - tShown))));
      if (runId !== simRunId) return;
      renderSimResults({ n, stuckCount, startWins, startTurnsSum, startRanks, strategyStats, seatWins, gameLengths, questStats, extra, graph, heatmap, elapsedMs });
      await genNextFrames(2);
      if (runId !== simRunId) return;
      hideSimLoader();   // vakje faadt uit, uitslag faadt in
    } catch (err){
      if (runId === simRunId){
        simStatusEl.innerHTML = `<span class="bad">✕ Simulatie mislukt: ${err.message}</span>`;
        hideSimLoader();
      }
    } finally {
      if (runId === simRunId){
        simRunning = false;
        btnSimulate.disabled = false;
      }
    }
  }, 20);
}

if (btnSimulate) btnSimulate.addEventListener('click', runSimulationBatch);
