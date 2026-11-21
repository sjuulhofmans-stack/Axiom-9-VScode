// ---------- ROOSTERS: de 6e energie-actie "Schroevendraaier" (2026-11) ----------
// Gekozen door de maker na de meting in artifact "Axiom-9 Roosters" (35 varianten × 8.000 potjes):
//   - Elke gangtegel heeft één roostervakje (labels 5.1–5.10 in tiles.json, verplaatsbaar in de
//     tegel-editor; nooit tegen het kristalvakje, ook niet schuin). Een portaal ligt nooit op een rooster.
//   - Schroevendraaier: energie-actie (5) vóór de worp, of het kristal Schroevendraaier. Je kunt er
//     één tegelijk hebben; iedereen ziet dat je hem hebt (player.screwdriver).
//   - Sta je met een schroevendraaier op een rooster (ook aan het begin of midden in je zet), dan MAG
//     je erin kruipen. Kost geen stap. Je komt uit bij een rooster naar keuze waar geen pion op staat
//     en loopt met de rest van je worp door, in elke richting (net als bij een portaal). Daarna is de
//     schroevendraaier op.
//   - Laarzen, Noodtransport en Duwstoot negeren roosters (je kunt er wel op terechtkomen).
// Gemeten (2 portalen, Portaalkanon 5, schroevendraaier 5, 2 kristallen): 66,6 beurten (met 4 portalen
// zonder roosters 64,6), 5,5 keer kruipen per potje, startposities 24,6–25,4%, 0 vastgelopen.
// Stuwstoot 17% en Noodtransport 32,5% (keuze van de maker: zo laten; zie CLAUDE.md voor de meting).
// Techniek: alleen resolveMove (DP met "heeft nog een schroevendraaier" als extra toestand, zie
// resolveMoveCrawl) en de stappen van de mens (97-solo.js) kennen kruipen. In een pad staat een
// kruipsprong als twee roostervakjes na elkaar die niet naast elkaar liggen (grateIsCrawl).
// Een bot koopt als het hem minstens GRATE_BOT_MIN_GAIN stappen scheelt naar zijn opdracht.
const GRATE_BOT_MIN_GAIN = 6;
// is de stap a → b een kruipsprong (rooster naar rooster, niet naast elkaar)?
function grateIsCrawl(graph, a, b){
  return !!graph.grateSet && graph.grateSet.has(a) && graph.grateSet.has(b) && portalIsJump(graph, a, b);
}
function pathGrateJumps(graph, path){
  let n = 0;
  for (let i = 1; i < path.length; i++) if (grateIsCrawl(graph, path[i - 1], path[i])) n++;
  return n;
}
// vrije uitgangen vanaf rooster `from` (geen pion erop)
function grateExits(graph, from, occupied){
  return graph.grates ? graph.grates.filter(g => g !== from && !(occupied && occupied.has(g))) : [];
}
// Hoeveel stappen scheelt een schroevendraaier naar `targetKey`? Lopen naar het dichtste rooster en
// eruit bij het rooster het dichtst bij het doel (graph.grateDist), tegenover gewoon lopen.
function grateGain(graph, pos, targetKey){
  if (!graph.grateDist || targetKey === undefined) return -99;
  const d = simDistLookup(simBfsDistances(graph, targetKey), pos);
  if (d < 0) return -99;
  return d - (graph.grateDist[pos] + graph.grateDist[targetKey]);
}
// Wil een bot deze beurt een schroevendraaier kopen? Eén keer per beurt uitgerekend.
function botDriverWanted(graph, player){
  if (!graph.grates || !graph.grates.length || player.screwdriver || player.noGrate) return false;
  if (player.energy < ENERGY_ACTIONS.driver.cost) return false;
  const deck = player.order || player.deck;
  const label = deck && deck[player.nextIdx];
  if (!label) return false;
  const key = `${player.ownTurns || 0}/${player.myTurn || 0}/${player.pos}/${player.nextIdx}`;
  if (player._driverKey !== key){
    player._driverKey = key;
    player._driverGain = grateGain(graph, player.pos, graph.questCells[label]);
  }
  return player._driverGain >= GRATE_BOT_MIN_GAIN;
}

