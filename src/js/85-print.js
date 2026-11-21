// ---------- printbare versie van het bord: 6 A4'tjes (knop "Printen" bij de seed) ----------
// Gebruikerswens 2026-11: het bord op 6 A4'tjes printen, tegen elkaar leggen, met een plakbandje
// aan elkaar, en dan speelbaar. Zo min mogelijk inkt: zwart-wit, alleen de speciale vakjes in kleur
// (en ook dán herkenbaar aan een nummer/vorm, voor een zwart-witprinter).
//
// Opzet (zie docs/printen.md):
//   - 3 bladen naast elkaar × 2 onder elkaar, A4 STAAND. Het bord is 40 × 32 vakjes; per blad
//     13 | 14 | 13 vakjes breed en 16 hoog, zodat elke naad precies op een lijn tussen vakjes valt.
//   - Een printer kan niet tot de rand printen. Daarom: aan de zijden die tegen een ander blad
//     komen (rechts bij kolom 1 en 2, onder bij de bovenste rij) staat een KNIPLIJN precies op de
//     rand van het bord (gebruikerswens 2026-11: kniprand i.p.v. de eerdere vouwrand). Je knipt de
//     lege rand eraf en legt de knipkant op de eerste lijn van het buurblad, waarvan de lege rand
//     er gewoon onder schuift. Het bord loopt PRINT_BLEED mm voorbij de kniplijn door (het begin
//     van het buurblad), zodat een net te ruim geknipte rand geen wit kiertje geeft.
//   - Eén SVG van het hele bord in millimeters (<defs>), elk blad toont daar zijn stuk van met <use>.
//   - Bovenste bladen: kop + uitleg in de vrije ruimte boven het bord; onderste: de legenda eronder.
const PRINT_M = 8;                                // mm vanaf de papierrand die zeker geprint wordt
const PRINT_BLEED = 2.5;                          // mm bord voorbij de kniplijn (zie hierboven)
const PRINT_PAGE_W = 210, PRINT_PAGE_H = 297;
const PRINT_COLS = [13, 14, 13];                  // vakjes per blad, van links naar rechts
const PRINT_ROWS = [16, 16];                      // vakjes per blad, van boven naar beneden
const PRINT_CELL = (PRINT_PAGE_W - 2 * PRINT_M) / Math.max(...PRINT_COLS);   // ±13,86 mm
const PRINT_ROOM_FILL = '#efefef';                // kamervloer: heel lichtgrijs (weinig inkt)
const PRINT_START_FILL = '#2e9e5e';
const PRINT_CRYSTAL = '#7a3fc4';
const PRINT_GRATE = '#b06a2c';

function printEsc(s){ return String(s).replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[ch]); }

// het hele bord als SVG-groep, 1 eenheid = 1 mm, (0,0) = linksboven van het bord
function printBoardSvg(){
  const s = PRINT_CELL, H = TILE_ROWS * TILE_H, W = TILE_COLS * TILE_W;
  const type = [], room = [], label = [];
  for (let R = 0; R < H; R++){
    type.push([]); room.push([]); label.push([]);
    for (let C = 0; C < W; C++){
      const slot = Math.floor(R / TILE_H) * TILE_COLS + Math.floor(C / TILE_W);
      const tid = layout[slot];
      const v = getDisplayValue(tid, R % TILE_H, C % TILE_W);
      type[R].push(cellType(v));
      room[R].push(!!ROOM_NAMES[tid]);
      label[R].push(typeof v === 'string' ? v : '');
    }
  }
  const f = n => +n.toFixed(3);
  let cells = '', specials = '', walls = '';
  for (let R = 0; R < H; R++){
    for (let C = 0; C < W; C++){
      const t = type[R][C];
      if (!t) continue;
      const x = f(C * s), y = f(R * s), lb = label[R][C];
      // elke vloer: wit (of lichtgrijs in een kamer) met een dun grijs lijntje
      cells += `<rect x="${x}" y="${y}" width="${f(s)}" height="${f(s)}" fill="${room[R][C] ? PRINT_ROOM_FILL : '#fff'}" stroke="#8c8c8c" stroke-width=".25"/>`;
      const cx = f(x + s / 2), cy = f(y + s / 2);
      if (t === 'quest'){
        const n = lb.split('.')[1];
        specials += `<rect x="${f(x + .6)}" y="${f(y + .6)}" width="${f(s - 1.2)}" height="${f(s - 1.2)}" rx="1.2" fill="${questTint(lb)}"/>` +
          `<text x="${cx}" y="${f(cy + 2.6)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#fff">${n}</text>`;
      } else if (t === 'start'){
        const n = lb.split('.')[1];
        specials += `<rect x="${f(x + .6)}" y="${f(y + .6)}" width="${f(s - 1.2)}" height="${f(s - 1.2)}" rx="1.2" fill="${PRINT_START_FILL}"/>` +
          `<text x="${cx}" y="${f(cy + 2.2)}" text-anchor="middle" font-size="6" font-weight="700" fill="#fff">S${n}</text>`;
      } else if (t === 'actioncell'){
        // kristal: langgerekte zeshoek, alleen omlijnd + licht gevuld
        const hw = s * .26, hh = s * .38;
        const pts = [[0, -hh], [hw, -hh / 2], [hw, hh / 2], [0, hh], [-hw, hh / 2], [-hw, -hh / 2]]
          .map(([a, b]) => f(cx + a) + ',' + f(cy + b)).join(' ');
        specials += `<polygon points="${pts}" fill="#e9dcfa" stroke="${PRINT_CRYSTAL}" stroke-width=".7" stroke-linejoin="round"/>`;
      } else if (t === 'grate'){
        // rooster: koperen kadertje met drie spijlen
        const i = s * .2, w = s - 2 * i;
        let bars = '';
        for (let k = 1; k <= 3; k++) bars += `<line x1="${f(x + i + w * k / 4)}" y1="${f(y + i)}" x2="${f(x + i + w * k / 4)}" y2="${f(y + i + w)}" stroke="${PRINT_GRATE}" stroke-width=".7"/>`;
        specials += `<rect x="${f(x + i)}" y="${f(y + i)}" width="${f(w)}" height="${f(w)}" rx=".8" fill="#f6e8da" stroke="${PRINT_GRATE}" stroke-width=".8"/>` + bars;
      }
      // muren: dikke zwarte lijn waar vloer aan niets grenst (geen vloer of de rand van het bord)
      const open = (r, c) => r >= 0 && r < H && c >= 0 && c < W && !!type[r][c];
      if (!open(R - 1, C)) walls += `M${x} ${y}h${f(s)}`;
      if (!open(R + 1, C)) walls += `M${x} ${f(y + s)}h${f(s)}`;
      if (!open(R, C - 1)) walls += `M${x} ${y}v${f(s)}`;
      if (!open(R, C + 1)) walls += `M${f(x + s)} ${y}v${f(s)}`;
    }
  }
  // kamernamen linksboven in de tegel: de drie vakjes daar zijn nooit vloer (zie DATA.pattern)
  let names = '';
  for (let slot = 0; slot < 20; slot++){
    const name = ROOM_NAMES[layout[slot]];
    if (!name) continue;
    const x = (slot % TILE_COLS) * TILE_W * s, y = Math.floor(slot / TILE_COLS) * TILE_H * s;
    names += `<text x="${f(x + 1.2)}" y="${f(y + s * .62)}" font-size="3.6" font-weight="700" letter-spacing=".25" fill="#222">${printEsc(name.toUpperCase())}</text>`;
  }
  return `<g id="printBoard" font-family="Arial, Helvetica, sans-serif">${cells}${specials}` +
    `<path d="${walls}" fill="none" stroke="#111" stroke-width=".7" stroke-linecap="square"/>${names}</g>`;
}

// vrije ruimte boven (bovenste rij) of onder (onderste rij) het bord, in mm op het blad
function printLegendSvg(x, y, w){
  const s = 9;
  const row = (i, icon, text) => `<g transform="translate(${x + (i % 2) * (w / 2)} ${y + Math.floor(i / 2) * 12})">${icon(s)}` +
    `<text x="${s + 3}" y="${s / 2 + 1.5}" font-size="4">${text}</text></g>`;
  const box = (fill, txt) => n => `<rect width="${n}" height="${n}" rx="1" fill="${fill}" stroke="#8c8c8c" stroke-width=".25"/>` +
    (txt ? `<text x="${n / 2}" y="${n / 2 + 1.8}" text-anchor="middle" font-size="4.8" font-weight="700" fill="#fff">${txt}</text>` : '');
  const items = [
    row(0, box('#fff'), 'Gang'),
    row(1, box(PRINT_ROOM_FILL), 'Kamer'),
    row(2, box(PRINT_START_FILL, 'S1'), 'Startvakje (in Hibernatie)'),
    row(3, box(questTint('2.1'), '1'), 'Opdrachtvakje (nummer = opdracht)'),
    row(4, n => `<rect width="${n}" height="${n}" fill="#fff" stroke="#8c8c8c" stroke-width=".25"/><polygon points="${n / 2},1.4 ${n * .76},${n * .31} ${n * .76},${n * .69} ${n / 2},${n - 1.4} ${n * .24},${n * .69} ${n * .24},${n * .31}" fill="#e9dcfa" stroke="${PRINT_CRYSTAL}" stroke-width=".6"/>`, 'Kristalvakje (pak een kristal)'),
    row(5, n => `<rect width="${n}" height="${n}" fill="#fff" stroke="#8c8c8c" stroke-width=".25"/><rect x="1.8" y="1.8" width="${n - 3.6}" height="${n - 3.6}" rx=".6" fill="#f6e8da" stroke="${PRINT_GRATE}" stroke-width=".7"/>`, 'Roostervakje (kruipen)'),
  ];
  return items.join('');
}

function printQuestListSvg(x, y){
  return Object.keys(QUEST_NAMES).map((lb, i) => {
    const tid = findLabelTile(lb);
    const roomName = tid !== null ? (ROOM_NAMES[tid] || '') : '';
    // twee kolommen (5 + 4), anders loopt de lijst in de ±59 mm boven het bord over het bord heen
    return `<g transform="translate(${x + Math.floor(i / 5) * 95} ${y + (i % 5) * 5.6})"><rect width="4.6" height="4.6" rx=".6" fill="${questTint(lb)}"/>` +
      `<text x="2.3" y="3.5" text-anchor="middle" font-size="3.4" font-weight="700" fill="#fff">${lb.split('.')[1]}</text>` +
      `<text x="6.6" y="3.6" font-size="3.6">${printEsc(QUEST_NAMES[lb])}<tspan fill="#777"> · ${printEsc(roomName)}</tspan></text></g>`;
  }).join('');
}

function printSheetsHtml(){
  const s = PRINT_CELL, M = PRINT_M, PW = PRINT_PAGE_W, PH = PRINT_PAGE_H;
  const seed = (document.getElementById('seedInput') || {}).value || '';
  const f = n => +n.toFixed(3);
  const nCols = PRINT_COLS.length, nRows = PRINT_ROWS.length;
  let html = `<svg width="0" height="0" style="position:absolute"><defs>${printBoardSvg()}</defs></svg>`;
  let c0 = 0, r0 = 0, n = 0;
  for (let r = 0; r < nRows; r++){
    c0 = 0;
    for (let c = 0; c < nCols; c++){
      n++;
      const cw = PRINT_COLS[c] * s, ch = PRINT_ROWS[r] * s;
      // waar het bordstuk op het blad komt: tegen de kniplijn (rechts/onder) of tegen de marge
      // waar een ander blad overheen komt (links/boven)
      const cutR = c < nCols - 1, cutB = r < nRows - 1;
      const bx = c === 0 ? PW - M - cw : M;
      const by = r === 0 ? PH - M - ch : M;
      // aan een knipkant loopt het bord PRINT_BLEED mm door (het begin van het buurblad): knip je
      // net te ruim, dan valt dat strookje over hetzelfde stuk bord op het buurblad, geen wit kiertje
      const vw = cw + (cutR ? PRINT_BLEED : 0), vh = ch + (cutB ? PRINT_BLEED : 0);
      let extra = '';
      // kniplijnen: stippellijn over de hele hoogte/breedte van het blad, precies op de rand van het bord
      if (cutR) extra += `<line x1="${f(bx + cw)}" y1="${M}" x2="${f(bx + cw)}" y2="${PH - M}" stroke="#555" stroke-width=".3" stroke-dasharray="2.5 1.5"/>` +
        // tekst langs de kniplijn, net boven (bovenste rij) of net onder (onderste rij) het bord
        `<text transform="translate(${f(bx + cw - 1.5)} ${f(r === 0 ? by - 3 : by + ch + 48)}) rotate(-90)" font-size="2.8" fill="#666">✂ knip hier langs de stippellijn</text>`;
      if (cutB) extra += `<line x1="${M}" y1="${f(by + ch)}" x2="${PW - M}" y2="${f(by + ch)}" stroke="#555" stroke-width=".3" stroke-dasharray="2.5 1.5"/>`;
      // linksonder op het eerste blad is er wit naast het bord: daar het schaartje voor de onderkant
      if (cutB && c === 0) extra += `<text x="${f(bx - 2)}" y="${f(by + ch - 1.5)}" text-anchor="end" font-size="2.8" fill="#666">✂ knip</text>`;
      // bladnummer en waar hij hoort, in de vrije ruimte
      const tagY = r === 0 ? M + 6 : PH - M - 3;
      // rechts uitgelijnd blijft hij 8 mm van de kniplijn (daar staat de kniptekst)
      extra += `<text x="${c === 0 ? PW - M - 8 : M + 2}" y="${tagY}" text-anchor="${c === 0 ? 'end' : 'start'}" font-size="4" font-weight="700" fill="#555">` +
        `Blad ${n} van 6 · ${r === 0 ? 'boven' : 'onder'} ${['links', 'midden', 'rechts'][c]}</text>`;
      if (r === 0 && c === 0){
        extra += `<text x="${PW - M - 8}" y="${M + 20}" text-anchor="end" font-size="11" font-weight="700" letter-spacing="1.5">AXIOM-9</text>` +
          `<text x="${PW - M - 8}" y="${M + 27}" text-anchor="end" font-size="3.6" fill="#555">Speelbord · seed ${printEsc(seed)}</text>`;
      }
      if (r === 0 && c === 1){
        const lines = ['Zo leg je het bord:', '1. Knip elk blad rechts en/of onder af langs de stippellijn (✂).',
          '2. Leg die rand precies op de eerste lijn van het blad ernaast.', '   De lege rand van dat blad schuift eronder.',
          '3. Plak de naad met een stukje plakband.', 'Printen: A4 staand, schaal 100% (werkelijke grootte).'];
        extra += lines.map((t, i) => `<text x="${M + 2}" y="${M + 16 + i * 5.4}" font-size="${i ? 3.6 : 4.2}" font-weight="${i ? 400 : 700}" xml:space="preserve">${printEsc(t)}</text>`).join('');
      }
      if (r === 0 && c === 2) extra += `<text x="${M + 2}" y="${M + 16}" font-size="4.2" font-weight="700">Opdrachten</text>` + printQuestListSvg(M + 2, M + 20);
      if (r === nRows - 1 && c === 1) extra += printLegendSvg(M + 2, by + ch + 8, PW - 2 * M - 14);
      html += `<div class="print-sheet"><svg width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}" font-family="Arial, Helvetica, sans-serif">` +
        `<svg x="${f(bx)}" y="${f(by)}" width="${f(vw)}" height="${f(vh)}" viewBox="${f(c0 * s)} ${f(r0 * s)} ${f(vw)} ${f(vh)}" overflow="hidden"><use href="#printBoard"/></svg>` +
        extra + `</svg></div>`;
      c0 += PRINT_COLS[c];
    }
    r0 += PRINT_ROWS[r];
  }
  return html;
}

function printBoard(){
  if (typeof genRunning !== 'undefined' && genRunning) return;   // niet midden in het genereren
  let root = document.getElementById('printRoot');
  if (!root){
    root = document.createElement('div');
    root.id = 'printRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = printSheetsHtml();
  document.body.classList.add('is-printing');
  const done = () => { document.body.classList.remove('is-printing'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}
const btnPrintBoard = document.getElementById('btnPrintBoard');
if (btnPrintBoard) btnPrintBoard.addEventListener('click', printBoard);
