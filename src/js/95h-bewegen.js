// Bordgrootte ligt vast (4x8 rijen, 5x8 kolommen); de dedup-buffer hieronder wordt
// EENMALIG aangemaakt en over duizenden potjes heen hergebruikt via een oplopend
// "stempel"-getal in plaats van steeds nieuwe typed arrays te alloceren — dat
// alloceren bleek in de praktijk de grootste tijdvreter bij een grote batch. Het
// pad per beurt (voor de drukte-heatmap) wordt WEL per aanroep vers opgebouwd
// (kleine, kortlevende arrays) omdat eenzelfde (cel,richting) binnen één beurt op
// meerdere staplagen kan voorkomen — een gedeelde buffer zou daar de verkeerde
// voorganger onthouden en het teruggereconstrueerde pad corrumperen.
const SIM_N = TILE_ROWS * TILE_H * TILE_COLS * TILE_W;
// bovengrens op hoeveel opdrachten je in ÉÉN beurt achter elkaar kunt pakken (zie resolveMove) —
// nooit meer dan de 9 labels in een stapeltje, ruim genoeg boven wat één worp ooit haalt
const SIM_CHAIN_CAP = 10;
// richting 4 = "net uit een portaal gekomen": dan mag je alle kanten op (zie resolveMove)
const SIM_DIR_FREE = 4;
const simDpStamp = new Int32Array(SIM_N * 5 * SIM_CHAIN_CAP);
let simDpStampCounter = 0;
const simBfsDist = new Int32Array(SIM_N);
const simBfsStampArr = new Int32Array(SIM_N);
let simBfsStampCounter = 0;

function buildSimGraph(){
  const H = TILE_ROWS * TILE_H, W = TILE_COLS * TILE_W, N = H * W;
  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1]; // 0=N,1=O,2=Z,3=W; tegenoverstelde = (d+2)%4
  const labelAt = new Array(N);
  for (let R = 0; R < H; R++){
    for (let C = 0; C < W; C++){
      const dr = R % TILE_H, dc = C % TILE_W;
      const slotIdx = Math.floor(R / TILE_H) * TILE_COLS + Math.floor(C / TILE_W);
      labelAt[R * W + C] = getDisplayValue(layout[slotIdx], dr, dc);
    }
  }
  const adjKey = new Array(N), adjDir = new Array(N);
  for (let R = 0; R < H; R++){
    for (let C = 0; C < W; C++){
      const k = R * W + C;
      if (labelAt[k] === undefined) continue;
      const ks = [], ds = [];
      for (let d = 0; d < 4; d++){
        const nR = R + DR[d], nC = C + DC[d];
        if (nR < 0 || nR >= H || nC < 0 || nC >= W) continue;
        const nk = nR * W + nC;
        if (labelAt[nk] === undefined) continue;
        ks.push(nk); ds.push(d);
      }
      adjKey[k] = ks; adjDir[k] = ds;
    }
  }
  const questCells = {}, startCells = {}, actionCells = new Set(), grates = [];
  for (let k = 0; k < N; k++){
    const v = labelAt[k];
    if (typeof v !== 'string') continue;
    if (v.startsWith('2.')) questCells[v] = k;
    else if (v.startsWith('3.')) startCells[v] = k;
    else if (v.startsWith('4.')) actionCells.add(k);
    else if (v.startsWith('5.')) grates.push(k);
  }
  // roosters (zie ROOSTERS): de vakjes, en per vakje de afstand tot het dichtste rooster (voor de bots)
  const grateDist = new Int16Array(N).fill(-1);
  const q = grates.slice();
  for (const g of grates) grateDist[g] = 0;
  for (let qi = 0; qi < q.length; qi++){
    const c = q[qi], nb = adjKey[c] || [];
    for (let j = 0; j < nb.length; j++){ const n = nb[j]; if (grateDist[n] === -1){ grateDist[n] = grateDist[c] + 1; q.push(n); } }
  }
  return { H, W, N, adjKey, adjDir, questCells, startCells, actionCells, grates, grateSet: new Set(grates), grateDist: grates.length ? grateDist : null };
}

// zuivere topologische afstand vanaf één cel (negeert bezetting/U-turn) — dient als
// heuristiek om onder de DP-bereikbare eindcellen de beste te kiezen. Schrijft in de
// gedeelde simBfsDist/simBfsStampArr-buffers; geeft het stempel terug waarmee de
// caller via simDistLookup() alleen de cellen leest die in DEZE aanroep bezocht zijn.
// Portalen (graph.portals): de twee vakjes van een paar tellen als één vakje — instappen in het ene
// is aankomen bij het andere. `noPortal` = gewone afstand (Noodtransport gaat niet door een portaal).
function simBfsDistances(graph, fromKey, noPortal){
  simBfsStampCounter++;
  const stamp = simBfsStampCounter;
  const { adjKey } = graph;
  const P = !noPortal && graph.portals;
  const pc = P ? P.cells : null;
  simBfsStampArr[fromKey] = stamp;
  simBfsDist[fromKey] = 0;
  const queue = [fromKey];
  // de partner meteen erachter, met dezelfde afstand (zo blijft de wachtrij op volgorde)
  const link = (k, d) => {
    const c = pc.indexOf(k);
    if (c < 0) return;
    const o = pc[c ^ 1];
    if (o < 0 || simBfsStampArr[o] === stamp) return;
    simBfsStampArr[o] = stamp; simBfsDist[o] = d; queue.push(o);
  };
  if (pc) link(fromKey, 0);
  let qi = 0;
  while (qi < queue.length){
    const ck = queue[qi++];
    const d = simBfsDist[ck];
    const neigh = adjKey[ck];
    for (let j = 0; j < neigh.length; j++){
      const nk = neigh[j];
      if (simBfsStampArr[nk] === stamp) continue;
      simBfsStampArr[nk] = stamp;
      simBfsDist[nk] = d + 1;
      queue.push(nk);
      if (pc) link(nk, d + 1);
    }
  }
  return stamp;
}
function simDistLookup(stamp, cellKey){
  return simBfsStampArr[cellKey] === stamp ? simBfsDist[cellKey] : -1;
}

// hoeveel tegenstanders staan direct naast een cel — goedkope proxy voor "hindert een
// tegenstander" (die zou er anders zijn volgende beurt langs willen). Geen rule dat
// blokkeren moet, maar tie-break onder anders gelijkwaardige eindcellen.
function computeHinderScores(graph, candidateKeys, occupiedSet){
  const { adjKey } = graph;
  const scores = new Map();
  for (const ck of candidateKeys){
    let score = 0;
    const neigh = adjKey[ck];
    for (let j = 0; j < neigh.length; j++) if (occupiedSet.has(neigh[j])) score++;
    scores.set(ck, score);
  }
  return scores;
}

// loopt van laag `step`, index `idx` terug naar laag 0 en geeft het afgelegde pad
// (cel-indices, start eerst) — voor de drukte-heatmap en de animatie. `layersVia` (optioneel): het
// portaal waar je in die stap instapte (-1 = gewone stap); het pad krijgt dan ingang én uitgang.
function backtrackLayers(layersKeys, layersParent, step, idx, layersVia){
  const path = [];
  let s = step, i = idx;
  while (true){
    path.push(layersKeys[s][i]);
    if (layersVia && s > 0 && layersVia[s][i] >= 0) path.push(layersVia[s][i]);
    if (s === 0) break;
    i = layersParent[s][i];
    s--;
  }
  path.reverse();
  return path;
}

// kiest, tussen meerdere even geldige eindcellen, EERST de meeste in deze beurt geraakte
// opdrachten (bankedCount — zie resolveMove: je loopt na een opdracht door, dus een tweede kan
// in dezelfde beurt vallen als de resterende stappen daar toevallig doorheen voeren), en
// binnen die groep de kortste afstand tot het eerstvolgende nog openstaande doel, dan de
// hinder-score als tie-break en tot slot willekeur.
function pickEnd(graph, layersKeys, layersParent, layersBanked, step, targets, occupiedSet, rand, stepsUsed, endBlockedSet, layersVia){
  const keys = layersKeys[step], bankedArr = layersBanked[step];
  // Per eindvakje de toestand met de MEESTE gepakte opdrachten onthouden. Hetzelfde vakje komt
  // vaak meerdere keren voor in een laag (andere binnenkomstrichting, wel/niet langs de opdracht).
  // Vroeger telde alleen de EERST gevonden toestand — was dat een route die de opdracht miste, dan
  // viel het vakje af als "geen opdracht", ook al kon je er via de opdracht óók komen. Vakjes ná
  // de opdracht vielen daardoor vaak weg en het opdrachtvakje zelf bleef over: bots eindigden
  // ~36% van de keren precies óp de opdracht i.p.v. door te lopen naar de volgende (gemeten).
  const bestIndex = new Map();
  for (let i = 0; i < keys.length; i++){
    const prev = bestIndex.get(keys[i]);
    if (prev === undefined || bankedArr[i] > bankedArr[prev]) bestIndex.set(keys[i], i);
  }
  let uniqueKeys = Array.from(bestIndex.keys());
  // Blinde Vlek: je mag DOOR een bezet vakje lopen, maar er niet op eindigen. De bezette
  // vakjes zijn dan uit occupiedSet gehaald (zodat de route erlangs mag) en zitten hier in
  // endBlockedSet. Blijft er geen vrij eindvakje over, dan levert deze zet niets op —
  // null, waarna de aanroeper terugvalt op de gewone (wel-blokkerende) zet.
  if (endBlockedSet){
    const free = uniqueKeys.filter(k => !endBlockedSet.has(k));
    if (!free.length) return null;
    uniqueKeys = free;
  }

  let maxBanked = 0;
  for (const k of uniqueKeys) maxBanked = Math.max(maxBanked, bankedArr[bestIndex.get(k)]);
  uniqueKeys = uniqueKeys.filter(k => bankedArr[bestIndex.get(k)] === maxBanked);

  let chosenKey;
  if (uniqueKeys.length === 1){
    chosenKey = uniqueKeys[0];
  } else {
    const nextTarget = maxBanked < targets.length ? targets[maxBanked] : null;
    let closest = uniqueKeys;
    if (nextTarget !== null){
      const stamp = simBfsDistances(graph, nextTarget);
      let minD = Infinity;
      for (const k of uniqueKeys){ const d = simDistLookup(stamp, k); if (d !== -1 && d < minD) minD = d; }
      closest = uniqueKeys.filter(k => simDistLookup(stamp, k) === minD);
    }
    if (closest.length > 1){
      const hinderScores = computeHinderScores(graph, closest, occupiedSet);
      let maxH = -1;
      for (const k of closest) maxH = Math.max(maxH, hinderScores.get(k));
      closest = closest.filter(k => hinderScores.get(k) === maxH);
    }
    chosenKey = closest[Math.floor(rand() * closest.length)];
  }
  const path = backtrackLayers(layersKeys, layersParent, step, bestIndex.get(chosenKey), layersVia);
  return { key: chosenKey, stepsUsed, bankedCount: maxBanked, bankedQuest: maxBanked > 0, path };
}

// lost één beurt op: DP over (cel, binnenkomstrichting, aantal-deze-beurt-al-geraakte-
// opdrachten) per stap, t/m de geworpen som. Houdt alle lagen bij (klein: <=18 stappen, elk
// een paar honderd toestanden) zodat het uiteindelijk gekozen pad achteraf teruggelezen kan
// worden voor de heatmap.
// `targets` is de rij opdrachtvakjes (celsleutels) die deze speler nog moet halen, te beginnen
// bij zijn HUIDIGE doel (targets[0] = het vroegere `targetKey`). Raakt het pad targets[0], dan
// stopt de beurt niet meer meteen (zie CLAUDE.md) — de resterende stappen lopen gewoon door,
// nu getoetst aan targets[1]. Zo kun je in dezelfde beurt zelfs een 2e opdracht pakken als de
// route daar toevallig doorheen komt; `bankedCount` in het resultaat zegt hoeveel dat er waren
// (vrijwel altijd 0 of 1).
// `endBlockedSet` (optioneel) is de verzameling vakjes waar je wel DOORHEEN mag maar niet op
// mag EINDIGEN — alleen gebruikt door Blinde Vlek. Geeft null terug als er met die beperking
// geen zet mogelijk is.
// `crawl` (optioneel): de speler heeft een schroevendraaier — dan rekent resolveMoveCrawl ook de
// kruipsprongen mee (zie ROOSTERS). Zonder schroevendraaier verandert hier niets.
function resolveMove(graph, startKey, steps, occupiedSet, targets, rand, endBlockedSet, crawl){
  if (crawl && graph.grates && graph.grates.length) return resolveMoveCrawl(graph, startKey, steps, occupiedSet, targets, rand, endBlockedSet);
  const { adjKey, adjDir } = graph;
  const layersKeys = [[startKey]], layersDirs = [[-1]], layersParent = [[]], layersBanked = [[0]], layersVia = [[-1]];
  let wasBlocked = false;
  // Portalen: stap je in een portaal, dan kom je uit zijn partner en loop je met de rest van je worp
  // gewoon door (zie het blok PORTALEN). Instappen kost één stap; vanaf de uitgang mag je alle
  // kanten op (richting SIM_DIR_FREE). In de laag staat de uitgang, in layersVia de ingang.
  const P = graph.portals;
  const portalLive = !!(P && P.cells.some(c => c >= 0));
  let lastStep = steps;

  for (let step = 1; step <= steps; step++){
    simDpStampCounter++;
    const stamp = simDpStampCounter;
    const prevKeys = layersKeys[step - 1], prevDirs = layersDirs[step - 1], prevBanked = layersBanked[step - 1];
    const nextKeys = [], nextDirs = [], nextParent = [], nextBanked = [], nextVia = [];
    for (let i = 0; i < prevKeys.length; i++){
      const ck = prevKeys[i], cd = prevDirs[i], banked = prevBanked[i];
      const neigh = adjKey[ck], dirs = adjDir[ck];
      for (let j = 0; j < neigh.length; j++){
        const d = dirs[j];
        if (cd !== -1 && cd !== SIM_DIR_FREE && d === (cd + 2) % 4) continue; // geen U-turn
        const nk = neigh[j];
        if (occupiedSet.has(nk)){ wasBlocked = true; continue; } // bezet vakje blokkeert
        // eerstvolgende nog openstaande opdracht geraakt: telt mee, maar de beurt loopt door met
        // de resterende stappen (getoetst aan de opdracht daarna) — geen vroegtijdige return meer.
        // staat er met Blinde Vlek een tegenstander op dat vakje, dan mag je er wel overheen lopen
        // maar hem niet pakken, dus telt dat hier niet als bank-moment
        let newBanked = banked;
        if (banked < targets.length && nk === targets[banked] && !(endBlockedSet && endBlockedSet.has(nk))){
          newBanked = banked + 1;
        }
        let to = nk, toDir = d, via = -1;
        if (portalLive){
          const exit = portalExitFor(graph, nk, occupiedSet, endBlockedSet);
          if (exit >= 0){ to = exit; toDir = SIM_DIR_FREE; via = nk; }
        }
        const stateIdx = (to * 5 + toDir) * SIM_CHAIN_CAP + newBanked;
        if (simDpStamp[stateIdx] === stamp) continue;
        simDpStamp[stateIdx] = stamp;
        nextKeys.push(to); nextDirs.push(toDir); nextParent.push(i); nextBanked.push(newBanked); nextVia.push(via);
      }
    }
    if (nextKeys.length === 0){
      // doodlopend voordat de worp op is: stop op de laatst haalbare laag
      lastStep = step - 1;
      break;
    }
    layersKeys.push(nextKeys); layersDirs.push(nextDirs); layersParent.push(nextParent); layersBanked.push(nextBanked); layersVia.push(nextVia);
  }
  const move = pickEnd(graph, layersKeys, layersParent, layersBanked, lastStep, targets, occupiedSet, rand, lastStep, endBlockedSet, layersVia);
  if (!move) return null;
  move.wasBlocked = wasBlocked;
  return move;
}

// Zelfde zet als resolveMove, maar met een schroevendraaier op zak. Toestand = (vakje, richting,
// gepakte opdrachten, schroevendraaier nog over). Sta je met hem op een rooster (aan het begin of na
// een stap), dan kun je zonder stap naar elk vrij rooster; daarna mag je alle kanten op
// (SIM_DIR_FREE) en is hij op. Eindvakje: eerst de meeste opdrachten, dan het dichtst bij het
// volgende doel — waarbij een schroevendraaier die je nog hebt meetelt als hij later een kortere
// route geeft (graph.grateDist), en bij gelijke stand liever bewaren. `usedSd` in het resultaat zegt
// of er gekropen is. Overgenomen uit het meetscript van de analyse (zelfde uitkomsten).
const simCrawlStamp = new Int32Array(SIM_N * 5 * SIM_CHAIN_CAP * 2);
let simCrawlStampCounter = 0;
function resolveMoveCrawl(graph, startKey, steps, occupiedSet, targets, rand, endBlockedSet){
  const { adjKey, adjDir } = graph;
  const P = graph.portals;
  const portalLive = !!(P && P.cells.some(c => c >= 0));
  const mk = () => ({ k: [], d: [], b: [], s: [], p: [], via: [], crawl: [] });
  const L = [mk()];
  let wasBlocked = false, stamp = ++simCrawlStampCounter;
  const push = (lay, k, d, b, s, p, via, crawl) => {
    const idx = ((k * 5 + d) * SIM_CHAIN_CAP + b) * 2 + s;
    if (simCrawlStamp[idx] === stamp) return -1;
    simCrawlStamp[idx] = stamp;
    lay.k.push(k); lay.d.push(d); lay.b.push(b); lay.s.push(s); lay.p.push(p); lay.via.push(via); lay.crawl.push(crawl);
    return lay.k.length - 1;
  };
  // vanaf een rooster: naar elk vrij rooster, zonder stap
  const expand = (lay, i) => {
    const k = lay.k[i];
    for (let gi = 0; gi < graph.grates.length; gi++){
      const g = graph.grates[gi];
      if (g === k || occupiedSet.has(g) || (endBlockedSet && endBlockedSet.has(g))) continue;
      push(lay, g, SIM_DIR_FREE, lay.b[i], 0, i, -1, 1);
    }
  };
  { const l0 = L[0]; l0.k.push(startKey); l0.d.push(-1); l0.b.push(0); l0.s.push(1); l0.p.push(-1); l0.via.push(-1); l0.crawl.push(0);
    if (graph.grateSet.has(startKey)) expand(l0, 0); }
  let lastStep = steps;
  for (let step = 1; step <= steps; step++){
    stamp = ++simCrawlStampCounter;
    const prev = L[step - 1], next = mk();
    for (let i = 0; i < prev.k.length; i++){
      const ck = prev.k[i], cd = prev.d[i], banked = prev.b[i], sd = prev.s[i];
      const neigh = adjKey[ck], dirs = adjDir[ck];
      for (let j = 0; j < neigh.length; j++){
        const d = dirs[j];
        if (cd !== -1 && cd !== SIM_DIR_FREE && d === (cd + 2) % 4) continue;   // geen U-turn
        const nk = neigh[j];
        if (occupiedSet.has(nk)){ wasBlocked = true; continue; }
        let nb = banked;
        if (banked < targets.length && nk === targets[banked] && !(endBlockedSet && endBlockedSet.has(nk))) nb = banked + 1;
        let to = nk, toDir = d, via = -1;
        if (portalLive){
          const exit = portalExitFor(graph, nk, occupiedSet, endBlockedSet);
          if (exit >= 0){ to = exit; toDir = SIM_DIR_FREE; via = nk; }
        }
        const idx = push(next, to, toDir, nb, sd, i, via, 0);
        if (idx >= 0 && sd && graph.grateSet.has(to)) expand(next, idx);
      }
    }
    if (next.k.length === 0){ lastStep = step - 1; break; }
    L.push(next);
  }
  // eindvakje kiezen
  const lay = L[lastStep];
  let maxB = -1;
  for (let i = 0; i < lay.k.length; i++){
    if (endBlockedSet && endBlockedSet.has(lay.k[i])) continue;
    if (lay.b[i] > maxB) maxB = lay.b[i];
  }
  if (maxB < 0) return null;   // Blinde Vlek zonder vrij eindvakje (zie resolveMove)
  const seen = new Map();      // vakje*2 + schroevendraaier -> eerste index
  for (let i = 0; i < lay.k.length; i++){
    if (lay.b[i] !== maxB || (endBlockedSet && endBlockedSet.has(lay.k[i]))) continue;
    const id = lay.k[i] * 2 + lay.s[i];
    if (!seen.has(id)) seen.set(id, i);
  }
  const cands = Array.from(seen.values());
  const nextTarget = maxB < targets.length ? targets[maxB] : null;
  let chosen;
  if (nextTarget === null){
    const kept = cands.filter(i => lay.s[i]);
    const pool = kept.length ? kept : cands;
    chosen = pool[Math.floor(rand() * pool.length)];
  } else {
    const st = simBfsDistances(graph, nextTarget);
    const gT = graph.grateDist ? graph.grateDist[nextTarget] : 0;
    let bestScore = Infinity, pool = [];
    for (const i of cands){
      let d = simDistLookup(st, lay.k[i]); if (d < 0) d = 9999;
      let score;
      if (lay.s[i]){ const v = graph.grateDist[lay.k[i]] + gT; score = v < d ? v * 4 + 2 : d * 4; }
      else score = d * 4 + 1;
      if (score < bestScore){ bestScore = score; pool = [i]; }
      else if (score === bestScore) pool.push(i);
    }
    if (pool.length > 1){
      let maxH = -1, p2 = [];
      for (const i of pool){
        let h = 0; const nb = adjKey[lay.k[i]];
        for (let j = 0; j < nb.length; j++) if (occupiedSet.has(nb[j])) h++;
        if (h > maxH){ maxH = h; p2 = [i]; } else if (h === maxH) p2.push(i);
      }
      pool = p2;
    }
    chosen = pool[Math.floor(rand() * pool.length)];
  }
  // pad teruglezen (een kruipsprong blijft in dezelfde laag; een portaal zet ingang én uitgang erin)
  const path = []; let s = lastStep, i = chosen, usedSd = false;
  while (true){
    const l = L[s];
    path.push(l.k[i]);
    if (l.crawl[i]){ usedSd = true; i = l.p[i]; continue; }
    if (s > 0 && l.via[i] >= 0) path.push(l.via[i]);
    if (s === 0) break;
    i = l.p[i]; s--;
  }
  path.reverse();
  return { key: lay.k[chosen], stepsUsed: lastStep, bankedCount: maxB, bankedQuest: maxB > 0, path, wasBlocked, usedSd };
}

function simShuffle(arr, rand){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// `player` (optioneel): telt de worp mee in zijn statistieken (zie newPlayerStats). Alleen
// meegegeven voor de loopstenen tijdens het spel, niet bij het dobbelen wie begint.
function simRollD6(rand, player){
  const v = 1 + Math.floor(rand() * 6);
  if (player && player.stats){ player.stats.dice++; player.stats.pips += v; }
  return v;
}

