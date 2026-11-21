// ---------- PORTALEN: de 5e energie-actie "Portaalkanon" (2026-10) ----------
// Er liggen altijd vier portalen op het bord, in twee paren: blauw (0) ↔ rood (1) en groen (2) ↔
// geel (3), gedeeld door alle
// spelers. Bij de start liggen ze al, op twee willekeurige gewone vakjes die minstens
// PORTAL_START_MIN_DIST stappen uit elkaar liggen: met maar één portaal gebeurt er niets, dus wie
// als eerste een portaal legde zou anders voor niets betalen.
// Regels (gekozen na de analyse "Axiom-9 Portalen": 44 varianten × 10.000 potjes):
//   - Portaalkanon (energie-actie, vóór de worp): kies een richting; het portaal vliegt rechtdoor
//     tot de muur of tot vóór een pion en landt op het verste gewone vakje van die lijn (nooit op
//     een opdracht-, start- of kristalvakje, nooit op het andere portaal). Kies dan welke kleur je
//     verplaatst; de andere blijft liggen, ook als een ander hem legde ("stelen").
//   - Stap je bij een gewone worp in een portaal, dan kom je uit het andere en LOOP JE DOOR met de
//     rest van de worp, in elke richting (instappen kost één stap). Gebruikerswens 2026-11: stoppen
//     voelde als verloren stappen. Tot dan stopte de zet in het portaal, omdat de analyse doorlopen
//     te sterk vond (potjes 6–11% korter, tot 10% van de opdrachten via een portaal; stoppen: 2–4%
//     korter, 3–4%) — zie de meting na deze wijziging in CLAUDE.md.
//   - Staat er een andere pion op een van de twee portalen, dan werkt het paar niet en is het
//     andere portaalvakje een gewoon vakje.
//   - Noodtransport, de laarzen en de duwkaarten negeren portalen (je gaat er gewoon overheen).
// Prijs 7: zolang iedereen het mag (zoals in het echte spel) is het een extra uitgave voor wie
// energie over heeft. Bij 5 werd Noodtransport (de spaarder) 28%; bij 7 liggen de andere vier
// acties tussen 23,4 en 26,3% (4 borden × 10.000 potjes, alle bots mogen schieten).
// Nagemeten na het inbouwen (deze code, 4 borden × 10.000), Stuwstoot / Herpr. / laarzen / Noodtr.:
//   zonder portaal  24,7 / 23,8 / 25,8 / 25,6   85,8 beurten
//   prijs 6         22,9 / 25,3 / 23,6 / 28,1   Noodtransport (de spaarder) te sterk
//   prijs 7         23,8 / 25,2 / 24,7 / 26,4   82,9 beurten (−3,4%)  ← gekozen
//   prijs 8         23,7 / 24,9 / 24,9 / 26,5   maar dan schiet de Slim-bot nog maar 0,6× per potje
// Slim-bots bij 7: 1,1 schot per potje; een Slim-bot zonder portaal wint 24,7% tegen drie mét.
// Techniek: de buurlijst (adjKey) blijft het gewone bord. Alleen resolveMove (sprong + doorlopen),
// simBfsDistances (A en B zijn één vakje voor de afstand) en de stappen van de mens
// (soloLegalNextCells in 97-solo.js) kijken naar graph.portals — zo gaan sprongen, sprints en
// duwkaarten vanzelf niet door een portaal.
const PORTAL_START_MIN_DIST = 16;
// Twee portaalparen (gebruikerswens 2026-11: "voelt telkens veel te ver weg"): blauw-rood (0, 1) en
// groen-geel (2, 3). Elk portaal gaat naar zijn partner, `c ^ 1`. Bij de start ligt geen portaal
// dichter dan PORTAL_START_SPREAD bij een portaal van het andere paar, zodat ze over het bord
// verspreid liggen.
const PORTAL_START_SPREAD = 6;
// Een bot schiet alleen als het hem minstens zoveel stappen scheelt naar zijn huidige opdracht
// (gemeten: dan levert een schot gemiddeld ±14 stappen op)
const PORTAL_BOT_MIN_GAIN = 6;
// Sinds de roosters (2026-11, keuze van de maker) weer één paar: blauw ↔ rood. Het tweede paar
// (groen ↔ geel) kan terug door hier 'groene', 'gele' / 'is-green', 'is-yellow' toe te voegen; de rest
// van de code werkt met PORTAL_COUNT.
const PORTAL_NAMES = ['blauwe', 'rode'];
// klasse per kleur op het bord (opmaak: blok PORTALEN onderaan styles.css)
const PORTAL_CLASSES = ['is-blue', 'is-red'];
const PORTAL_COUNT = PORTAL_NAMES.length;
// zet graph.portals = { cells: [blauw, rood, groen, geel], owner: [-1, -1, -1, -1] } voor een nieuw potje
function portalSetup(graph, rand){
  const normal = portalNormalCells(graph);
  const cells = [];
  for (let pair = 0; pair < PORTAL_COUNT / 2; pair++){
    // vakjes die ver genoeg van de al gelegde portalen liggen (lukt dat niet, dan zonder die eis)
    const spreadD = cells.map(c => portalBaseBfs(graph, c));
    const spread = normal.filter(k => spreadD.every(d => d[k] >= PORTAL_START_SPREAD));
    const pool = spread.length >= 2 ? spread : normal.filter(k => !cells.includes(k));
    let a = -1, b = -1;
    for (let t = 0; t < 400 && b < 0; t++){
      a = pool[Math.floor(rand() * pool.length)];
      const d = portalBaseBfs(graph, a);
      const far = pool.filter(k => d[k] >= PORTAL_START_MIN_DIST);
      if (far.length) b = far[Math.floor(rand() * far.length)];
    }
    cells.push(a, b);
  }
  graph.portals = { cells, owner: cells.map(() => -1) };
  return graph.portals;
}
// mag hier een portaal liggen? gewone, loopbare vakjes zonder label
function portalCellAllowed(graph, k){
  if (k < 0 || !graph.adjKey[k]) return false;
  if (graph.actionCells.has(k)) return false;
  if (!graph._portalSpecial){
    // ook nooit op een rooster (spelregel van de maker, zie ROOSTERS)
    graph._portalSpecial = new Set([...Object.values(graph.questCells), ...Object.values(graph.startCells), ...(graph.grates || [])]);
  }
  return !graph._portalSpecial.has(k);
}
function portalNormalCells(graph){
  const out = [];
  for (let k = 0; k < graph.N; k++) if (portalCellAllowed(graph, k)) out.push(k);
  return out;
}
// eigen BFS over het gewone bord (eigen array, raakt de gedeelde simBfs-buffers niet)
function portalBaseBfs(graph, from){
  const d = new Int16Array(graph.N).fill(-1);
  d[from] = 0;
  const q = [from];
  for (let qi = 0; qi < q.length; qi++){
    const c = q[qi], nb = graph.adjKey[c];
    for (let j = 0; j < nb.length; j++){ const n = nb[j]; if (d[n] === -1){ d[n] = d[c] + 1; q.push(n); } }
  }
  return d;
}
// Stap je op vakje `k`: kom je dan uit een portaal, en waar? Geeft de partner terug, of -1 (geen
// portaal, de partner ligt er nog niet, of er staat een pion op een van de twee).
// `occ` en `occ2` zijn bezette vakjes (occ2 = Blinde Vlek: wel doorheen, niet op eindigen).
function portalExitFor(graph, k, occ, occ2){
  const P = graph.portals;
  if (!P) return -1;
  const c = P.cells.indexOf(k);
  if (c < 0) return -1;
  const o = P.cells[c ^ 1];
  if (o < 0) return -1;
  if (occ && (occ.has(k) || occ.has(o))) return -1;
  if (occ2 && (occ2.has(k) || occ2.has(o))) return -1;
  return o;
}
// welke kleur (index in P.cells) ligt er op vakje `k`, of -1
function portalColorAt(graph, k){
  return graph.portals ? graph.portals.cells.indexOf(k) : -1;
}
// Portaalkanon: per richting waar het portaal landt — rechtdoor over het gewone bord tot een muur
// of vóór een pion, op het verste vakje waar een portaal mag liggen. `path` = de vlucht.
function portalCannonOptions(graph, fromKey, occupied){
  const P = graph.portals, out = [];
  for (let dir = 0; dir < 4; dir++){
    let cur = fromKey, land = -1, landAt = 0;
    const path = [fromKey];
    while (true){
      const nb = graph.adjKey[cur], ds = graph.adjDir[cur];
      let nx = -1;
      for (let j = 0; j < ds.length; j++) if (ds[j] === dir){ nx = nb[j]; break; }
      if (nx === -1 || (occupied && occupied.has(nx))) break;
      cur = nx; path.push(cur);
      if (portalCellAllowed(graph, cur) && !(P && P.cells.includes(cur))){ land = cur; landAt = path.length; }
    }
    if (land >= 0) out.push({ dir, key: land, path: path.slice(0, landAt) });
  }
  return out;
}
// legt portaal `color` (0 blauw, 1 rood) op `key`; zegt of je er een van een ander verplaatste
function portalPlace(graph, key, color, ownerIdx){
  const P = graph.portals;
  const prevOwner = P.owner[color];
  const from = P.cells[color];
  P.cells[color] = key;
  P.owner[color] = ownerIdx;
  return { from, stolen: prevOwner >= 0 && prevOwner !== ownerIdx };
}
// Bot: het beste schot (richting + kleur) voor zijn huidige opdracht, of null. Via een paar (a, b)
// is de afstand min(d(jij,a) + d(b,doel), d(jij,b) + d(a,doel)), over het gewone bord; met twee
// paren telt het beste paar (de bot rekent niet met twee sprongen achter elkaar).
function botPortalShot(graph, player, occupied, targets){
  const P = graph.portals, t = targets && targets[0];
  if (!P || t === undefined) return null;
  const opts = portalCannonOptions(graph, player.pos, occupied);
  if (!opts.length) return null;
  const dS = portalBaseBfs(graph, player.pos), dT = portalBaseBfs(graph, t);
  const far = 1e9;
  const via = (a, b) => (a < 0 || b < 0 || dS[a] < 0 || dT[b] < 0 || dS[b] < 0 || dT[a] < 0
    || (occupied && (occupied.has(a) || occupied.has(b)))) ? far
    : Math.min(dS[a] + dT[b], dS[b] + dT[a]);
  const direct = dS[t] < 0 ? far : dS[t];
  // beste route via een paar, met portaal `c` eventueel vervangen door vakje `key`
  const bestVia = (c, key) => {
    let m = far;
    for (let q = 0; q < P.cells.length; q += 2){
      const a = q === c ? key : P.cells[q], b = q + 1 === c ? key : P.cells[q + 1];
      m = Math.min(m, via(a, b));
    }
    return m;
  };
  const dNow = Math.min(direct, bestVia(-1, -1));
  let best = null;
  for (const o of opts){
    for (let color = 0; color < P.cells.length; color++){
      const keep = P.cells[color ^ 1];
      if (keep < 0 || (occupied && occupied.has(keep))) continue;
      const gain = dNow - Math.min(direct, bestVia(color, o.key));
      if (!best || gain > best.gain) best = { dir: o.dir, key: o.key, path: o.path, color, gain };
    }
  }
  return best && best.gain >= PORTAL_BOT_MIN_GAIN ? best : null;
}
// Hoeveel portaalsprongen zitten er in een pad? Twee opeenvolgende vakjes die niet naast elkaar
// liggen = door een portaal. Voor de statistiek en de animatie.
function pathPortalJumps(graph, path){
  let n = 0;
  // een kruipsprong (rooster → rooster, zie ROOSTERS) is geen portaalsprong
  for (let i = 1; i < path.length; i++) if (portalIsJump(graph, path[i - 1], path[i]) && !grateIsCrawl(graph, path[i - 1], path[i])) n++;
  return n;
}
function portalIsJump(graph, a, b){
  return Math.abs(Math.floor(a / graph.W) - Math.floor(b / graph.W)) + Math.abs(a % graph.W - b % graph.W) > 1;
}
// Wil een bot deze beurt een portaal schieten? Ook bots met een vaste strategie doen het als het
// loont: in het echte spel mag iedereen elke energie-actie kiezen. Eén keer per beurt uitgerekend.
function botPortalWanted(graph, player){
  if (!graph.portals || player.noPortal || player.energy < ENERGY_ACTIONS.portal.cost) return false;
  const key = `${player.ownTurns || 0}/${player.myTurn || 0}/${player.pos}/${player.energy}/${player.nextIdx}`;
  if (player._portalKey !== key){
    player._portalKey = key;
    const deck = player.order || player.deck;
    const targets = [];
    for (let i = player.nextIdx; i < deck.length; i++) if (deck[i] != null) targets.push(graph.questCells[deck[i]]);
    const shot = botPortalShot(graph, player, null, targets);
    player._portalWant = !!shot;
    player._portalGain = shot ? shot.gain : 0;   // voor de afweging tegen de schroevendraaier
  }
  return player._portalWant;
}

