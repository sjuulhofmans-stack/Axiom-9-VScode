// ---------- bordbouwer (herschreven 2026-11, na de analyse "Axiom-9 Bordanalyse") ----------
// Doel: een bord zonder dooie hoeken. Elke naad tussen twee tegels klopt (open tegen open, dicht
// tegen dicht), alle 20 tegels hangen aan elkaar, zo min mogelijk deuren wijzen het bord af, en het
// verwachte verkeer is zo gelijk mogelijk over de tegels verdeeld.
//
// Waarom herschreven (alles gemeten: 60 borden x 400 potjes met de echte simulatie):
//  1. De oude test op dode tegels telde ELK vakje met een label als "interessant", dus ook de
//     kristalvakjes (4.x). Elke gang had er zo zelf één en was nooit dood: 60 van de 60 borden
//     kregen "0 dode tegels", terwijl 35% een tegel had met <0,5% van het verkeer. Nu tellen alleen
//     opdrachten (2.x) en startvakjes (3.x) als bron/doel.
//  2. De tien keuringsregels stonden strikt op volgorde; regel 2 was een getal in de honderden en
//     vrijwel nooit gelijk, dus regel 3-10 (kamers spreiden, opdrachten uit elkaar...) deden nooit
//     mee. Nu is het ÉÉN weegscore (genScore).
//  3. Deuren die het bord af wijzen werden niet geteld: gemiddeld 7,3 doodlopende stompjes per
//     bord. Nu hooguit 1 of 3 (0 kan niet: de tegels hebben samen 63 deuren, er passen er 62).
//  4. Alleen de hoektegels werden gedraaid: 2.860 deurpatronen. Nu draait elke tegel: 57.202.
// Uitkomst van het rekenscript waar dit een overzetting van is (20 borden x 400 potjes): dode
// tegels 35% -> 0%, stompjes 7,3 -> 1, vakjes waar bijna niemand komt 92 -> 45, drukste tegel
// 8,9% -> 7,7%, potjes even lang, startposities even eerlijk.
//
// Aanpak: (a) genSearch legt met terugsporen een geldig bord (tegel + draaiing per plek) binnen een
// budget aan deuren naar buiten; (b) genAnneal schuift daarna tegels met dezelfde deurvorm van plek
// en draait 4-weg-tegels, en houdt het bord met de hoogste genScore; (c) dat een paar keer opnieuw
// (GEN_RESTARTS), beste wint. Zelfde seed = zelfde bord: alles loopt op de seeded rand, niets op de
// klok.
//
// Bekende grens (niet met de bouwer op te lossen): de twee hoekgangen (tegel 1 en 16) blijven de
// koudste tegels, rond 2,5% van het verkeer. Een hoek ligt nooit op een kortste route en er ligt
// niets om voor te komen. Alleen een opdracht op die tegels verhelpt dat (gemeten: 5,8%), en dat is
// een keuze van de maker.

const GEN_ROTS = [0, 90, 180, 270];
const GEN_DIR_BIT = { N: 1, S: 2, E: 4, W: 8 };
const GEN_BOARD_H = TILE_ROWS * TILE_H, GEN_BOARD_W = TILE_COLS * TILE_W, GEN_CELLS = GEN_BOARD_H * GEN_BOARD_W;
const GEN_RESTARTS = 8;      // zo vaak een nieuw deurpatroon proberen
const GEN_ITERS = 700;       // schuif-/draaistappen per poging
const GEN_SEARCH_STEPS = 30000;
// budget aan deuren die het bord af wijzen, om en om: een volledig open bord (1) meet het best, maar
// met één muur (3) krijgt niet elk bord dezelfde grote vorm. De score kiest (elk stompje kost punten).
const GEN_STUB_BUDGETS = [1, 3];
const GEN_STUB_ESCALATE = [5, 7, 9, 99];   // alleen nodig als de tegels in de editor veranderd zijn

// welke zijden van een plek wijzen het bord af (als bitjes)
const GEN_OFF_MASK = [];
for (let s = 0; s < 20; s++){
  let m = 0;
  for (const d of offBoardDirs(s)) m |= GEN_DIR_BIT[d];
  GEN_OFF_MASK.push(m);
}
const GEN_SLOT_OF_CELL = new Uint8Array(GEN_CELLS);
for (let k = 0; k < GEN_CELLS; k++){
  GEN_SLOT_OF_CELL[k] = Math.floor(Math.floor(k / GEN_BOARD_W) / TILE_H) * TILE_COLS + Math.floor((k % GEN_BOARD_W) / TILE_W);
}
function genPop(m){ return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1); }

// per tegel en draaiing: welke vakjes loopbaar zijn, waar de opdracht/startvakjes liggen en welke
// zijden open zijn. Elke keer opnieuw opgebouwd (goedkoop), want de tegel-editor kan alles wijzigen.
// Zelfde draairegel als getDisplayValue in 10-rules.js.
function genBuildTileTable(){
  const T = { walk: [], quests: [], starts: [], mask: [], cornerOk: [], room: [] };
  for (let tid = 1; tid <= 20; tid++){
    T.walk[tid] = []; T.quests[tid] = []; T.starts[tid] = []; T.mask[tid] = [];
    T.cornerOk[tid] = isCornerCapable(tid);
    T.room[tid] = !!ROOM_NAMES[tid];
    for (let ri = 0; ri < 4; ri++){
      const walk = new Uint8Array(64), quests = [], starts = [];
      for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++){
        let r = dr, c = dc;
        for (let i = 0; i < (4 - ri) % 4; i++){ const nr = c, nc = 7 - r; r = nr; c = nc; }
        const v = tileLookup[tid].get(r + '_' + c);
        if (v === undefined) continue;
        walk[dr * 8 + dc] = 1;
        if (typeof v === 'string'){
          if (v.startsWith('2.')) quests.push(dr * 8 + dc);
          else if (v.startsWith('3.')) starts.push(dr * 8 + dc);
        }
      }
      let m = 0;
      for (const dir in GEN_DIR_BIT){
        if (EDGE_CELLS[dir].every(([dr, dc]) => walk[dr * 8 + dc])) m |= GEN_DIR_BIT[dir];
      }
      T.walk[tid][ri] = walk; T.quests[tid][ri] = quests; T.starts[tid][ri] = starts; T.mask[tid][ri] = m;
    }
  }
  T.totalOpen = 0;
  for (let tid = 1; tid <= 20; tid++) T.totalOpen += genPop(T.mask[tid][0]);
  return T;
}

function genShuffle(a, rand){
  for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// Eén zoektocht met terugsporen, plek voor plek (rij voor rij): kies een nog vrije tegel + draaiing
// die past bij de buren erboven en links, binnen het budget aan deuren naar buiten.
// Snoeien: elke dichte naad BINNEN het bord ("muur") kost aan het eind twee deuren naar buiten
// (stompjes = totaal aantal deuren - 2 x open naden), dus een dichte zijde naar een plek die nog
// komt telt meteen mee. Zonder dat liep de zoektocht pas een rij later vast.
// Geeft { lay, ri } terug (tegel en draai-index per plek) of null.
function genSearch(T, rand, maxStubs){
  const lay = new Array(20).fill(0), ri = new Array(20).fill(0), msk = new Array(20).fill(0);
  const used = new Array(21).fill(false);
  let steps = 0, stubs = 0, walls = 0;
  const base = T.totalOpen - 2 * 31;   // stompjes bij een volledig open bord
  function connected(){
    const seen = new Array(20).fill(false); seen[0] = true;
    const stack = [0]; let n = 1;
    while (stack.length){
      const s = stack.pop(), r = Math.floor(s / TILE_COLS), c = s % TILE_COLS, m = msk[s];
      const nb = [];
      if ((m & 1) && r > 0) nb.push(s - TILE_COLS);
      if ((m & 2) && r < TILE_ROWS - 1) nb.push(s + TILE_COLS);
      if ((m & 4) && c < TILE_COLS - 1) nb.push(s + 1);
      if ((m & 8) && c > 0) nb.push(s - 1);
      for (const x of nb) if (!seen[x]){ seen[x] = true; n++; stack.push(x); }
    }
    return n === 20;
  }
  function backtrack(s){
    if (++steps > GEN_SEARCH_STEPS) return false;
    if (s === 20) return connected();
    const r = Math.floor(s / TILE_COLS), c = s % TILE_COLS;
    const off = GEN_OFF_MASK[s], isCorner = CORNER_SLOTS.includes(s), isInner = INNER_SLOTS.includes(s);
    const cands = [];
    for (let tid = 1; tid <= 20; tid++){
      if (used[tid]) continue;
      if (tid === START_TILE && !isInner) continue;
      if (isCorner && !T.cornerOk[tid]) continue;
      // per verschillende deurvorm één kandidaat; geven meerdere draaiingen dezelfde vorm (4-weg-
      // tegel), dan een willekeurige daarvan
      const order = genShuffle([0, 1, 2, 3], rand), seen = [];
      for (const q of order){
        const m = T.mask[tid][q];
        if (seen.includes(m)) continue;
        seen.push(m);
        if (isCorner && (m & off)) continue;                       // hoek: geen deur het bord af
        if (r > 0 && ((m & 1) !== 0) !== ((msk[s - TILE_COLS] & 2) !== 0)) continue;   // naad boven
        if (c > 0 && ((m & 8) !== 0) !== ((msk[s - 1] & 4) !== 0)) continue;           // naad links
        const st = genPop(m & off);
        let w = 0;
        if (r < TILE_ROWS - 1 && !(m & 2)) w++;
        if (c < TILE_COLS - 1 && !(m & 4)) w++;
        if (stubs + st > maxStubs || base + 2 * (walls + w) > maxStubs) continue;
        cands.push([tid, q, m, st, w]);
      }
    }
    genShuffle(cands, rand);
    for (const [tid, q, m, st, w] of cands){
      lay[s] = tid; ri[s] = q; msk[s] = m; used[tid] = true; stubs += st; walls += w;
      if (backtrack(s + 1)) return true;
      used[tid] = false; stubs -= st; walls -= w;
    }
    lay[s] = 0;
    return false;
  }
  return backtrack(0) ? { lay, ri, msk } : null;
}

// ---------- voorspelling van het verkeer + de weegscore ----------
// Spelers lopen van opdracht naar opdracht (en één keer van hun start naar de eerste opdracht).
// Het verwachte verkeer op een vakje = over alle paren (opdracht-opdracht samen 5/6, start-opdracht
// samen 1/6) het deel van de kortste routes dat over dat vakje loopt. Gemeten tegen de simulatie:
// samenhang 0,84 per tegel (de oude telling: 0,38), en 0,89 voor de koudste tegel van een bord.
// Schatting te hoog bij tegels die "één van meerdere even korte routes" zijn (bots kiezen er één).
const genBuf = {
  walk: new Uint8Array(GEN_CELLS), queue: new Int32Array(GEN_CELLS), cells: new Int32Array(GEN_CELLS), dist: [], sig: [],
};
function genBfs(src, dist, sig){
  const walk = genBuf.walk, queue = genBuf.queue, W = GEN_BOARD_W;
  dist.fill(-1); sig.fill(0);
  dist[src] = 0; sig[src] = 1; queue[0] = src;
  let head = 0, tail = 1;
  while (head < tail){
    const k = queue[head++], d = dist[k] + 1, c = k % W;
    for (let j = 0; j < 4; j++){
      let nk;
      if (j === 0){ nk = k - W; if (nk < 0) continue; }
      else if (j === 1){ nk = k + W; if (nk >= GEN_CELLS) continue; }
      else if (j === 2){ if (c === 0) continue; nk = k - 1; }
      else { if (c === W - 1) continue; nk = k + 1; }
      if (!walk[nk]) continue;
      if (dist[nk] === -1){ dist[nk] = d; queue[tail++] = nk; }
      if (dist[nk] === d) sig[nk] += sig[k];
    }
  }
}
// meet één bord (tegel + draai-index + deurvorm per plek). Geeft de score en de losse onderdelen.
function genEvaluate(T, lay, ri, msk){
  const walk = genBuf.walk, W = GEN_BOARD_W;
  walk.fill(0);
  const quests = [], starts = [];
  for (let s = 0; s < 20; s++){
    const tid = lay[s], q = ri[s], src = T.walk[tid][q];
    const R0 = Math.floor(s / TILE_COLS) * TILE_H, C0 = (s % TILE_COLS) * TILE_W;
    for (let i = 0; i < 64; i++) if (src[i]) walk[(R0 + (i >> 3)) * W + C0 + (i & 7)] = 1;
    for (const i of T.quests[tid][q]) quests.push((R0 + (i >> 3)) * W + C0 + (i & 7));
    for (const i of T.starts[tid][q]) starts.push((R0 + (i >> 3)) * W + C0 + (i & 7));
  }
  // alleen de loopbare vakjes aflopen (±564 van de 1280): scheelt de helft van het rekenwerk
  const cells = genBuf.cells; let nCells = 0;
  for (let k = 0; k < GEN_CELLS; k++) if (walk[k]) cells[nCells++] = k;
  const nq = quests.length, ns = starts.length, nSrc = nq + ns;
  let stubs = 0, radj = 0;
  for (let s = 0; s < 20; s++){
    stubs += genPop(msk[s] & GEN_OFF_MASK[s]);
    if (!T.room[lay[s]]) continue;
    if (s % TILE_COLS < TILE_COLS - 1 && (msk[s] & 4) && T.room[lay[s + 1]]) radj++;
    if (s + TILE_COLS < 20 && (msk[s] & 2) && T.room[lay[s + TILE_COLS]]) radj++;
  }
  if (nq < 2) return { score: -stubs, stubs, radj, share: null };   // niets te voorspellen (bewerkte tegels)
  while (genBuf.dist.length < nSrc){ genBuf.dist.push(new Int16Array(GEN_CELLS)); genBuf.sig.push(new Float64Array(GEN_CELLS)); }
  const src = quests.concat(starts);
  for (let i = 0; i < nSrc; i++) genBfs(src[i], genBuf.dist[i], genBuf.sig[i]);

  const per = new Float64Array(20);
  const W_START = 1 / 6;
  function addPair(a, b, w){
    const da = genBuf.dist[a], db = genBuf.dist[b], sa = genBuf.sig[a], sb = genBuf.sig[b];
    const d = da[src[b]];
    if (d < 0) return false;
    const f = w / sa[src[b]], from = src[a];
    for (let i = 0; i < nCells; i++){
      const k = cells[i];
      if (da[k] + db[k] !== d || k === from) continue;
      per[GEN_SLOT_OF_CELL[k]] += f * sa[k] * sb[k];
    }
    return true;
  }
  let reachable = true;
  const wq = 2 * (1 - W_START) / (nq * (nq - 1)), ws = ns ? W_START / (ns * nq) : 0;
  for (let a = 0; a < nq; a++) for (let b = a + 1; b < nq; b++) if (!addPair(a, b, wq)) reachable = false;
  for (let s = 0; s < ns; s++) for (let b = 0; b < nq; b++) if (!addPair(nq + s, b, ws)) reachable = false;
  if (!reachable) return { score: -1000 - stubs, stubs, radj, share: null };

  let tot = 0; for (let s = 0; s < 20; s++) tot += per[s];
  const share = Array.from(per, v => 100 * v / tot);
  // opdrachten even ver van elkaar (gemiddelde afstand naar de andere opdrachten: samenhang 0,86 met
  // "beurten per opdracht" in de simulatie), kortste afstand tussen twee opdrachten, starts even ver
  let qdMin = Infinity, qdMax = -Infinity, qmin = Infinity;
  for (let a = 0; a < nq; a++){
    let sum = 0;
    for (let b = 0; b < nq; b++){
      if (a === b) continue;
      const d = genBuf.dist[a][src[b]]; sum += d;
      if (d < qmin) qmin = d;
    }
    const avg = sum / (nq - 1);
    if (avg < qdMin) qdMin = avg; if (avg > qdMax) qdMax = avg;
  }
  let sdMin = Infinity, sdMax = -Infinity;
  for (let s = 0; s < ns; s++){
    let sum = 0;
    for (let b = 0; b < nq; b++) sum += genBuf.dist[nq + s][src[b]];
    const avg = sum / nq;
    if (avg < sdMin) sdMin = avg; if (avg > sdMax) sdMax = avg;
  }
  const res = { stubs, radj, share, qdSpread: qdMax - qdMin, qmin, sdSpread: ns ? sdMax - sdMin : 0 };
  res.score = genScore(res);
  return res;
}
// De weegscore (hoger = beter). De gewichten zijn die van het gemeten rekenscript — verander je er
// één, meet dan opnieuw met de simulatie (koudste tegel, drukste tegel, kamers tegen elkaar).
function genScore(f){
  const ps = f.share.slice().sort((a, b) => a - b);
  let s = 3 * ps[0] + 1.5 * ps[1];                       // de koudste twee tegels optillen
  for (const x of ps) s += 0.5 * Math.min(x, 4);          // elke tegel richting een eerlijk deel
  if (ps[19] > 9) s -= 0.25 * (ps[19] - 9);               // geen snelweg-tegel
  s -= 0.35 * f.qdSpread;                                 // opdrachten ongeveer even ver
  s -= 0.5 * f.sdSpread;                                  // startposities even eerlijk
  s -= 1.0 * f.radj;                                      // kamers niet tegen elkaar
  s += 0.15 * Math.min(f.qmin, 14);                       // opdrachten niet vlak naast elkaar
  s -= 0.6 * f.stubs;                                     // deuren die het bord af wijzen
  return s;
}

// Eén schuif-/draaistap op een kopie: twee tegels met een verwisselbare deurvorm van plek wisselen
// (elk gedraaid tot hij op de andere plek past), of een tegel anders draaien zonder dat zijn
// deurvorm verandert (4-weg-tegel). Het deurpatroon van het bord blijft dus gelijk. null = geen zet.
function genMutate(T, lay, ri, msk, rand){
  const rotsFor = (tid, m) => { const out = []; for (let q = 0; q < 4; q++) if (T.mask[tid][q] === m) out.push(q); return out; };
  if (rand() < 0.2){
    for (let tries = 0; tries < 20; tries++){
      const s = Math.floor(rand() * 20);
      const opts = rotsFor(lay[s], msk[s]).filter(q => q !== ri[s]);
      if (!opts.length) continue;
      const r2 = ri.slice(); r2[s] = opts[Math.floor(rand() * opts.length)];
      return { lay: lay.slice(), ri: r2 };
    }
    return null;
  }
  for (let tries = 0; tries < 40; tries++){
    const a = Math.floor(rand() * 20), b = Math.floor(rand() * 20);
    if (a === b) continue;
    const ta = lay[a], tb = lay[b];
    if (ta === START_TILE && !INNER_SLOTS.includes(b)) continue;
    if (tb === START_TILE && !INNER_SLOTS.includes(a)) continue;
    const ra = rotsFor(ta, msk[b]), rb = rotsFor(tb, msk[a]);
    if (!ra.length || !rb.length) continue;
    const l2 = lay.slice(), r2 = ri.slice();
    l2[a] = tb; r2[a] = rb[Math.floor(rand() * rb.length)];
    l2[b] = ta; r2[b] = ra[Math.floor(rand() * ra.length)];
    return { lay: l2, ri: r2 };
  }
  return null;
}

// alle vakjes van een indeling in één keer opzoeken (zelfde waarde als getDisplayValue, dus met de
// huidige tileRotation)
function layoutCellGrid(lay){
  const H = TILE_ROWS*TILE_H, W = TILE_COLS*TILE_W;
  const grid = new Array(H*W);
  for (let R=0; R<H; R++) for (let C=0; C<W; C++){
    grid[R*W+C] = getDisplayValue(lay[Math.floor(R/TILE_H)*TILE_COLS + Math.floor(C/TILE_W)], R%TILE_H, C%TILE_W);
  }
  return grid;
}
// hoe ver het verste loopbare vakje van de dichtstbijzijnde OPDRACHT ligt (multi-bron BFS vanaf
// alle 2.x-vakjes tegelijk). Niet meer gebruikt door de bouwer zelf; blijft als losse meting.
function questCoverageScore(lay){
  const H = TILE_ROWS*TILE_H, W = TILE_COLS*TILE_W;
  const grid = layoutCellGrid(lay);
  const dist = new Int32Array(H*W).fill(-1);
  const queue = [];
  for (let k=0; k<H*W; k++){
    const v = grid[k];
    if (typeof v === 'string' && v.startsWith('2.')){ dist[k] = 0; queue.push(k); }
  }
  if (!queue.length) return { maxDist: 0, avgDist: 0 };
  for (let qi=0; qi<queue.length; qi++){
    const k = queue[qi], R = Math.floor(k/W), C = k%W;
    for (const [dR,dC] of [[-1,0],[1,0],[0,-1],[0,1]]){
      const nR=R+dR, nC=C+dC;
      if (nR<0||nR>=H||nC<0||nC>=W) continue;
      const nk = nR*W+nC;
      if (dist[nk] !== -1 || grid[nk] === undefined) continue;
      dist[nk] = dist[k]+1;
      queue.push(nk);
    }
  }
  let maxDist = 0, sum = 0, counted = 0;
  for (let k=0; k<H*W; k++){
    const d = dist[k];
    if (d < 0) continue;
    if (d > maxDist) maxDist = d;
    sum += d; counted++;
  }
  return { maxDist, avgDist: counted ? sum/counted : 0 };
}

// Het bord is 4x5, dus geen vierkant, maar een puntspiegeling (180°) behoudt wel de vorm: elke
// tegel verhuist naar de overkant en draait 180° extra mee, zodat alle naden geldig blijven.
function applyRandomBoardFlip(lay, flip){
  if (!flip) return lay;
  const flipped = new Array(20);
  for (let i=0; i<20; i++) flipped[19-i] = lay[i];
  for (let tid=1; tid<=20; tid++) tileRotation[tid] = ((tileRotation[tid] || 0) + 180) % 360;
  return flipped;
}

// Bouwt het bord bij een seed. Rekent in brokken van 30 ms, zodat de animatie blijft lopen;
// onProgress(gedaan, totaal) na elk brok. Zet tileRotation voor ALLE tegels en geeft de indeling
// (tegel per plek) terug.
async function constrainedShuffleAsync(seedStr, onProgress){
  resetRotations();
  const seedInt = Math.floor(hashSeed(seedStr)() * 4294967296);
  const rand = mulberry32(seedInt);
  const T = genBuildTileTable();
  const CHUNK_BUDGET_MS = 30;
  const total = GEN_RESTARTS * GEN_ITERS;
  let chunkStart = performance.now();
  async function breathe(done){
    if (performance.now() - chunkStart < CHUNK_BUDGET_MS) return;
    if (onProgress) onProgress(done, total);
    await new Promise(res => setTimeout(res, 0));
    chunkStart = performance.now();
  }

  let best = null;
  for (let r = 0; r < GEN_RESTARTS; r++){
    // een geldig beginbord binnen het budget; lukt dat niet (bewerkte tegels), dan ruimer
    let cur = null;
    for (const budget of [GEN_STUB_BUDGETS[r % GEN_STUB_BUDGETS.length], ...GEN_STUB_BUDGETS, ...GEN_STUB_ESCALATE]){
      for (let t = 0; t < 2 && !cur; t++) cur = genSearch(T, rand, budget);
      if (cur) break;
    }
    if (!cur){ await breathe((r + 1) * GEN_ITERS); continue; }
    let curF = genEvaluate(T, cur.lay, cur.ri, cur.msk);
    if (!best || curF.score > best.f.score) best = { lay: cur.lay, ri: cur.ri, f: curF };
    // tegels schuiven en draaien; af en toe een slechtere stap toestaan (steeds minder), anders
    // blijft de zoektocht in het eerste het beste heuveltje hangen
    for (let it = 0; it < GEN_ITERS; it++){
      const mv = genMutate(T, cur.lay, cur.ri, cur.msk, rand);
      if (mv){
        const f = genEvaluate(T, mv.lay, mv.ri, cur.msk);
        const temp = 1.2 * (1 - it / GEN_ITERS) + 0.02;
        if (f.score >= curF.score || rand() < Math.exp((f.score - curF.score) / temp)){
          cur.lay = mv.lay; cur.ri = mv.ri; curF = f;
          if (f.score > best.f.score) best = { lay: mv.lay, ri: mv.ri, f };
        }
      }
      if ((it & 15) === 15) await breathe(r * GEN_ITERS + it + 1);
    }
  }
  if (onProgress) onProgress(total, total);

  let result;
  if (best){
    result = best.lay.slice();
    for (let s = 0; s < 20; s++) tileRotation[result[s]] = GEN_ROTS[best.ri[s]];
  } else {
    // vangnet: regelgetrouwe verdeling zonder naadgarantie (alleen als de tegels zo bewerkt zijn
    // dat er geen geldig bord meer bestaat; 80-controls.js meldt dat dan)
    const fallbackRand = mulberry32(seedInt ^ 0x1234567);
    const lay = new Array(20).fill(null);
    const used = new Set();
    const order = Array.from({length:20},(_,i)=>i).sort((a,b) => ALLOWED_TILES[a].length - ALLOWED_TILES[b].length);
    for (const slotIdx of order){
      const cands = genShuffle(ALLOWED_TILES[slotIdx].filter(t => !used.has(t)), fallbackRand);
      if (cands.length){ lay[slotIdx] = cands[0]; used.add(cands[0]); }
    }
    let leftover = Array.from({length:20},(_,i)=>i+1).filter(t => !used.has(t));
    for (let s=0; s<20; s++){
      if (lay[s] !== null) continue;
      const allowed = leftover.filter(t => canTileGoInSlot(t, s));
      const pick = allowed.length ? allowed[0] : leftover[0];
      lay[s] = pick;
      leftover = leftover.filter(t => t !== pick);
    }
    result = lay;
    applyCornerRotations(result);
  }
  return applyRandomBoardFlip(result, rand() < 0.5);
}
