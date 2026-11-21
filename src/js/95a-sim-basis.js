// ---------- spelsimulatie ----------
// Duizenden potjes doorrekenen op de HUIDIGE indeling (layout + tileRotation) om
// speelduur en eerlijkheid per startpositie te meten. Regels: 2xD6 = exact aantal
// stappen, geen U-turn, bezette vakjes blokkeren. Land je onderweg op je eigen
// opdrachtvakje, dan loop je met de resterende stappen gewoon door (de beurt stopt er
// niet meer voor) — voert de rest toevallig ook door de VOLGENDE opdracht, dan pak je
// die in dezelfde beurt meteen mee (zeldzaam, zie resolveMove/pickEnd). Elke speler
// heeft een eigen geschud stapeltje opdrachten 1-9 (labels 2.1..2.9); wie als eerste
// 6 opdrachten voltooit wint.
//
// Er wordt DOORGESPEELD na de winnaar, om ook plaats 2 en 3 uit te spelen. Wie binnen
// is stopt met spelen en verdwijnt van het bord (blokkeert dus ook niemand meer). Zodra
// de nummer 3 binnen is stopt het potje: de laatste speler is dan automatisch vierde en
// er valt niets meer te beslissen.
//
// Plaatsen worden pas toegekend nadat de HELE ronde is afgemaakt (iedereen die nog mag
// spelen krijgt zijn beurt), niet zodra iemand toevallig als eerste in de beurtvolgorde
// zijn 6e opdracht haalt — zie resolveRoundFinishers() hieronder. Wie in dezelfde ronde
// finisht deelt een plaats bij gelijke stand (zelfde energie ÉN evenveel actiekaarten in
// de hand); anders beslist de meeste energie, dan de meeste actiekaarten.
//
// Cellen worden als vlakke index (R*W+C) gebruikt en de buren-adjacency wordt één
// keer per run vooraf berekend (niet per stap opnieuw) — dat is waar bij duizenden
// potjes de tijd in gaat zitten, dus dat blijft hier bewust plat en allocatie-arm.
const SIM_MAX_TURNS = 900;
const SIM_QUESTS_TO_WIN = 6;
const SIM_START_LABELS = ['3.1', '3.2', '3.3', '3.4'];
// zoveel spelers moeten binnen zijn voordat het potje klaar is; de rest ligt daarmee vast.
// Bij 4 spelers dus 3. Ook bruikbaar voor de kleinere bezettingen van "stap voor stap":
// met 2 spelers is de nummer 2 al bekend zodra de winnaar binnen is.
function simFinishTarget(playerCount){ return Math.max(1, playerCount - 1); }
// Staat deze speler nog op het bord? `rank` alleen is niet genoeg: wie deze ronde zijn 6e
// opdracht haalt krijgt zijn rank pas aan het EIND van de ronde (resolveRoundFinishers), maar
// heeft het bord dan al verlaten — hij mag niets meer blokkeren en geen doelwit meer zijn van
// hinderkaarten (gemeten: anders ging ~3% van de hinderkaarten naar zo'n al-binnen speler).
function simOnBoard(p){ return !p.rank && p.completed < SIM_QUESTS_TO_WIN; }

// ---------- begin van een potje: dobbelen wie begint, daarna startposities kiezen ----------
// (Zelf spelen, Multiplayer en Automatisch; de batch-simulatie hieronder houdt vaste
// startposities, want die meet juist de eerlijkheid PER startpositie.)
// De volgorde wordt bijgehouden als "emmers" van spelers die (nog) gelijk staan, van hoog naar
// laag: [[a], [b, c], [d]] = a is 1e, b en c delen nog plek 2-3, d is 4e. In het begin zit
// iedereen in één emmer. De bovenste emmer met meer dan één speler moet (opnieuw) dobbelen;
// daarna splitst openingSplitBucket() hem op de worpen. Klaar zodra elke emmer 1 speler heeft.
function openingNextGroup(buckets){ return buckets.find(b => b.length > 1) || null; }
function openingOrder(buckets){ return buckets.flat(); }
// `rolls`: { [playerIdx]: [d1, d2] } voor iedereen in `bucket`. Hoogste som eerst; gelijke sommen
// blijven samen in één emmer (en dobbelen dus opnieuw), in hun oorspronkelijke volgorde.
function openingSplitBucket(bucket, rolls){
  const sum = i => rolls[i][0] + rolls[i][1];
  const sorted = bucket.slice().sort((a, b) => sum(b) - sum(a));
  const out = [];
  for (const i of sorted){
    const last = out[out.length - 1];
    if (last && sum(last[0]) === sum(i)) last.push(i); else out.push([i]);
  }
  return out;
}
// Bot kiest de vrije startpositie met de kortste looproute naar zijn eerste opdracht.
function botPickStartLabel(graph, player, freeLabels){
  const target = graph.questCells[player.deck[player.nextIdx]];
  const stamp = simBfsDistances(graph, target);
  let best = freeLabels[0], bestD = Infinity;
  for (const l of freeLabels){
    const d = simDistLookup(stamp, graph.startCells[l]);
    if (d >= 0 && d < bestD){ bestD = d; best = l; }
  }
  return best;
}

// ---------- gelijke stand: de ronde wordt afgemaakt vóórdat een plaats vaststaat ----------
// Vroeger kreeg de eerste speler die zijn 6e opdracht voltooide meteen rank 1, en werd het
// potje meteen beëindigd zodra genoeg spelers binnen waren — puur op basis van wie toevallig
// EERDER in de beurtvolgorde zat. Gemeten: de speler die als eerste aan zet is wint daardoor
// systematisch vaker (29,6% tegen 20,5% voor de laatste, over 8000 potjes) — geen speleigenschap,
// een artefact van de beurtvolgorde. Nu wordt éérst de HELE ronde afgemaakt (iedereen die nog
// mag spelen krijgt zijn beurt), en pas daarna worden de plekken van iedereen die deze ronde
// finishte in één keer verdeeld: bij gelijke stand (zelfde energie ÉN evenveel actiekaarten in de
// hand) delen ze de plaats, in plaats van dat beurtvolgorde de doorslag geeft.
//
// `alreadyFinished` = hoeveel spelers vóór deze ronde al een rank hadden. Kent aan elke speler in
// `finishers` een `rank` (skip-stijl bij een tie: 1,1,3 bij een 2-weg tie op de 1e plek) en
// `rankShare` (grootte van de tie-groep, voor eerlijke credit in de statistieken) toe.
// Geeft de tie-groepen terug (voor logging in 96-walk.js), gesorteerd van beste naar slechtste.
function resolveRoundFinishers(finishers, alreadyFinished){
  const sorted = finishers.slice().sort((a, b) => (b.energy - a.energy) || (b.cards.length - a.cards.length));
  const groups = [];
  for (const p of sorted){
    const last = groups[groups.length - 1];
    if (last && last[0].energy === p.energy && last[0].cards.length === p.cards.length) last.push(p);
    else groups.push([p]);
  }
  let rank = alreadyFinished + 1;
  for (const group of groups){
    for (const p of group){ p.rank = rank; p.rankShare = group.length; }
    rank += group.length;
  }
  return groups;
}
// welk deel van een tie-groep (grootte `groupSize`, begint op `startRank`) binnen rank <= threshold
// valt — bv. een 2-weg tie op de 1e/2e plek telt voor precies de helft mee als "gewonnen" (T=1)
// maar volledig als "top 2" (T=2). Voor een niet-gedeelde plek (groupSize 1) reduceert dit gewoon
// tot de vertrouwde 0-of-1 boolean-achtige uitkomst.
function rankOverlapFraction(startRank, groupSize, threshold){
  const endRank = startRank + groupSize - 1;
  const overlap = Math.max(0, Math.min(endRank, threshold) - startRank + 1);
  return overlap / groupSize;
}
const SIM_QUEST_LABELS = ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8','2.9'];
const SIM_HISTOGRAM_BINS = 12;

