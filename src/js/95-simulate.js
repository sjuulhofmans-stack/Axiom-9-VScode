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

// ---------- energie ----------
// Naast de twee loopstenen rolt elke beurt een derde, zeszijdige steen mee: één kant niks,
// twee kanten 1, twee kanten 2 en één kant 3 — gemiddeld 1,5 energie per beurt. Wat je hebt
// stapelt tot ENERGY_MAX; alles daarboven gaat verloren.
//
// TIJDSREGELS (gelden voor mens én bot, in alle drie de spelmodi):
//   - Een energie-actie kies je VÓÓR je gooit, hooguit één per beurt.
//   - De energiesteen rolt mee met je loopstenen; wat hij oplevert kun je pas VOLGENDE beurt
//     uitgeven. Bots deden vroeger anders (eerst bijtellen, dan meteen uitgeven, en
//     Noodtransport pas ná de worp) — dat maakte de simulatie te gunstig en is rechtgezet.
//
// Vier acties, elk op een eigen as — verder gooien, een ander doel, rechtdoor schieten, vrij
// springen — zodat de keuze van de situatie afhangt en niet van een rekensom:
//
//   4  Stuwstoot              gooi met 3 loopstenen in plaats van 2
//   4  Herprioritering        bekijk je volgende opdrachtkaart en kies of je wisselt
//   5  Zwaartekracht-laarzen  eerst tot 8 vakjes rechtdoor (tot een muur/pion/je opdracht), dan gooien
//  10  Noodtransport          eerst vrij springen tot 11 vakjes, dan gooien
//   7  Portaalkanon           schiet het blauwe of rode portaal rechtdoor tot de muur, dan gooien
//                             (5e actie, 2026-10; zie het blok PORTALEN verderop)
//
// Controlemeting na de laatste twee bijstellingen (Noodtransport 13 → 11, laarzen stoppen op je
// opdracht), 4 borden × 4000 potjes: 24,8 / 24,6 / 25,5 / 25,1 (±0,7), 0 vastgelopen.
//
// Gemeten (2026-10, 6000 potjes met simulateOneGame hieronder, 4 bots met elk één vaste
// strategie, deze tijdsregels): winst% 23,7 / 26,0 / 24,6 / 25,7 — 25% is eerlijk; 2,7% van de
// gegooide energie gaat verloren tegen het plafond. Het oude stelsel (Stuwstoot 3, Herprioritering
// blind voor 2, geen laarzen) gaf 28,5 / 18,9 / – / 27,6 en verloor 22%. Prijs-sweep:
//   Stuwstoot 3, Herpr. 3 → 29,4 / 25,3 / 21,0 / 24,4   (Stuwstoot te sterk, laarzen te zwak)
//   Stuwstoot 4, Herpr. 3 → 24,1 / 27,5 / 22,6 / 25,7
//   Stuwstoot 4, Herpr. 4 → 23,7 / 26,0 / 24,6 / 25,7   ← gekozen
// Afgewezen na meting, niet opnieuw voorstellen:
//   - rijkere energiesteen (gem. 1,67–2,0): meer verlies, grotere verschillen, potje nauwelijks korter
//   - plafond 15: maakt vooral Noodtransport sterker; met dit stelsel gaat er toch al bijna niets verloren
//   - laarzen die je worp VERVANGEN: 7–8% winst, slechter dan nooit energie uitgeven (9%)
//   - laarzen voor 8 energie: 14%. Voor 4: 27%. 5 is het kantelpunt.
//   - Bijsturen (+1/+2 stappen), Dubbelworp, Sabotage (koploper −2), energie → actiekaart: alle
//     vier 10–18% als je ze vóór de worp moet kiezen
//   - "negeer de geen-U-turn-regel": met die regel bereik je op elk aantal stappen exact dezelfde
//     vakjes als zonder (verhouding 1,000 over 180 startposities)
const ENERGY_DIE_FACES = [0, 1, 1, 2, 2, 3];
const ENERGY_MAX = 10;
// gedeelde lege verzameling voor "niets blokkeert de route" (Blinde Vlek) — scheelt een
// nieuwe Set per beurt in een lus die miljoenen keren draait
const SIM_EMPTY_SET = new Set();
// Afstemknop: het bereik van het Noodtransport. Bewust `let`, zodat je 'm vanuit de console
// kunt doorrekenen zonder te herbouwen. 13 is niet gegokt maar gemeten — winst% van
// (Stuwstoot / Herprioritering / Noodtransport) over 5000 potjes per stand, zelfde
// toevalsstroom per bereik:
//   10 → 32,4 / 33,9 / 27,1   het transport is duidelijk te zwak
//   12 → 32,1 / 31,1 / 30,5
//   13 → 32,4 / 29,3 / 33,2   de duurste actie wipt er net overheen
//   14 → 30,1 / 29,6 / 34,1
//   16 → 29,0 / 29,1 / 36,6   het transport begint te overheersen
// Op 10 stappen is de actie 1,0 stap per energie waard tegen 1,17 voor de Stuwstoot; pas
// rond 13 haalt hij de andere twee in. Verzet je dit getal, draai de sweep opnieuw.
// (Die sweep is nog van vóór de tijdsregels hierboven.) Met de huidige vier acties opnieuw
// gemeten over 4 borden × 4000 potjes (standaard + zwart-nova-7, koud-sein-42, stil-baan-15),
// winst% Stuwstoot / Herprioritering / Laarzen / Noodtransport, ±0,7:
//   13 → 24,0 / 24,1 / 24,6 / 27,3   Noodtransport op elk van de 4 borden te sterk (26,6–28,3)
//   12 → 23,9 / 24,6 / 24,8 / 26,7
//   11 → 25,1 / 24,3 / 25,2 / 25,4   ← gekozen
// (Op alleen het standaardbord leek 13 in balans; over meer borden niet.)
let ENERGY_JUMP_RANGE = 11;
// Bot springt alleen als zijn doel verder weg ligt dan dit — dichterbij haalt een gewone worp
// het meestal toch, en dan is je hele voorraad weg voor niets.
const JUMP_BOT_MIN_DIST = 6;

// Herprioritering: betaal, BEKIJK je volgende opdrachtkaart en kies of je wisselt — je betaalt
// ook als je besluit niet te wisselen. Vroeger was het een blinde wissel voor 2 energie: dat
// scoorde 18,9% (blind wisselen is alleen de moeite waard als je ver weg staat, dus de bot deed
// het maar 2,4× per potje en zat de rest van de tijd vol). Met eerst kijken voor 4 energie: 26,0%
// (zie de prijs-sweep bovenaan). De bot kijkt als hij verder dan REORDER_PEEK_THRESHOLD van zijn
// huidige doel staat; een drempel van 8 of 16 maakte in de metingen weinig uit (±1–2%).
const REORDER_PEEK_THRESHOLD = 12;

// Zwaartekracht-laarzen (energie-actie én actiekaart, de kaart is de gratis versie — zelfde
// paar als Stuwstoot/Stuwlading): kies een richting en schiet rechtdoor tot een muur, een
// andere pion of GRAVITY_DASH_STEPS vakjes. Kom je onderweg op je opdracht, dan telt die en
// STOP je daar (spelregel van de maker — anders dan bij een worp, waar je wel doorloopt).
// Daarna gooi je gewoon vanaf je nieuwe plek.
// Vanaf 53% van de loopbare vakjes kun je in de beste richting echt 8 ver; gemiddeld levert een
// ingezette sprint 4,5 vakjes richting je doel op.
const GRAVITY_DASH_STEPS = 8;
// hoe ver Duwstoot een tegenstander wegduwt (zie shoveDestination); staat hier omdat de tekst op
// het kristal (ACTION_CARDS.shove.text) hem bij het laden al nodig heeft
const SHOVE_DISTANCE = 4;
// hoeveel energie Energielek van een tegenstander afpakt (ACTION_CARDS.leak.text gebruikt hem al)
const ENERGY_LEAK_AMOUNT = 2;

// `hint` staat OP het kaartje en moet daarom kort blijven — het kaartje is 108px breed en
// een langere zin duwde de titel er eerder letterlijk uit. De strategische toelichting hoort
// in `note`, die alleen in de tooltip terechtkomt (zie renderEnergySoloButton in 97-solo.js).
const ENERGY_ACTIONS = {
  boost:   { cost: 4,  name: 'Stuwstoot',       hint: 'gooi met 3 loopstenen',
             note: 'Een derde loopsteen erbij, dus gemiddeld 3,5 stappen extra deze beurt.' },
  reorder: { cost: 4,  name: 'Herprioritering', hint: 'bekijk je volgende opdracht en kies',
             note: 'Je ziet eerst je volgende opdrachtkaart en kiest dan of je die naar voren haalt. Je betaalt ook als je niet wisselt.' },
  gravity: { cost: 5,  name: 'Zwaartekracht-laarzen', hint: `eerst ${GRAVITY_DASH_STEPS} vakjes rechtdoor, dan gooien`,
             note: `Kies een richting: je schiet rechtdoor tot een muur of pion, hooguit ${GRAVITY_DASH_STEPS} vakjes. Kom je op je opdracht, dan telt die en stop je daar. Daarna gooi je gewoon vanaf je nieuwe plek.` },
  jump:    { cost: 10, name: 'Noodtransport',   hint: `spring vrij tot ${ENERGY_JUMP_RANGE} vakjes, dan gooien`,
             note: 'Geen geen-U-turn-regel en je springt over pionnen heen. Land je op je opdracht, dan is je beurt klaar; anders gooi je daarna gewoon vanaf je nieuwe plek. Kost je hele voorraad.' },
  portal:  { cost: 7,  name: 'Portaalkanon',    hint: 'schiet een portaal tot de muur, dan gooien',
             note: 'Kies een richting: het portaal vliegt rechtdoor tot de muur of tot vóór een pion. Daarna kies je of je het blauwe of het rode verplaatst. Stapt iemand in een portaal, dan komt hij uit het andere en stopt zijn zet daar. Staat er een pion op een portaal, dan werkt het paar niet.' },
  none:    { cost: 0,  name: 'Geen energie',    hint: 'spaart, geeft nooit uit',
             note: 'Doet niets — de handmatige "overslaan"-keuze voor de mens. Zit niet in de bot-strategieën: een speler die een heel potje nooit energie uitgeeft komt in de praktijk niet voor, dus die zou de simulatiecijfers (met name het plafondverlies) alleen maar vertekenen.' },
};
// Elke speler krijgt er per potje één, geloot over de startposities zodat de strategie nooit
// samenvalt met een bepaalde startpositie. `none` zit hier bewust niet bij — dat was puur een
// ijkpunt en geen speler speelt in het echt een heel potje nooit energie uit; meemeten trok het
// gemiddelde en het plafondverlies (aandeel "10 energie") kunstmatig omhoog. Vier strategieën op
// vier spelers: elk potje speelt elke strategie precies één keer.
const ENERGY_STRATEGIES = ['boost', 'reorder', 'gravity', 'jump'];
// Kiest 4 strategieën (één per speler). Bij 4+ strategieën elk hooguit één keer, in geloote
// volgorde; zijn het er minder dan 4 (bv. tijdens het afstemmen met een kleinere set), dan
// worden er willekeurig aangevuld zodat de dubbele bezetting niet aan een vaste startpositie kleeft.
function pickEnergyStrategies(rand){
  if (ENERGY_STRATEGIES.length >= 4) return simShuffle(ENERGY_STRATEGIES, rand).slice(0, 4);
  const pool = ENERGY_STRATEGIES.slice();
  while (pool.length < 4) pool.push(ENERGY_STRATEGIES[Math.floor(rand() * ENERGY_STRATEGIES.length)]);
  return simShuffle(pool, rand);
}

// Vrije verplaatsing van maximaal `range` vakjes: geen dobbelsteen, geen geen-U-turn-regel,
// je springt over bezette vakjes heen. Gaat recht op het doel af als dat binnen bereik ligt en
// kiest anders het bereikbare vakje dat het dichtst bij het doel ligt. Landen op een vakje uit
// `occupiedSet` mag NIET (net als bij de mens, zie soloEnterJumpTarget in 97-solo.js) — vroeger
// wel, en dan stonden er twee pionnen op één vakje (±1 op de 11 sprongen in de simulatie).
function resolveEnergyJump(graph, fromKey, range, targetKey, occupiedSet){
  // 1. alles binnen bereik verzamelen. Dit moet compleet zijn vóór de tweede BFS, want die
  //    overschrijft de gedeelde afstandsbuffer.
  const stampFrom = simBfsDistances(graph, fromKey, true);   // niet door een portaal
  const near = new Map();
  for (let k = 0; k < graph.N; k++){
    const d = simDistLookup(stampFrom, k);
    if (d >= 0 && d <= range) near.set(k, d);
  }
  // 2. doel binnen bereik? dan er meteen heen — anders zo dicht mogelijk erbij
  let dest = null;
  if (near.has(targetKey) && !occupiedSet.has(targetKey)){
    dest = targetKey;
  } else {
    const stampTarget = simBfsDistances(graph, targetKey, true);
    let best = Infinity;
    for (const k of near.keys()){
      if (occupiedSet.has(k)) continue;
      const d = simDistLookup(stampTarget, k);
      if (d >= 0 && d < best){ best = d; dest = k; }
    }
  }
  if (dest === null || dest === fromKey) return null;
  // 3. pad terugzoeken via de afstanden uit stap 1 (voor de drukte-heatmap en de animatie)
  const path = [dest];
  let cur = dest;
  while (cur !== fromKey){
    const d = near.get(cur);
    const neigh = graph.adjKey[cur];
    let prev = -1;
    for (let j = 0; j < neigh.length; j++) if (near.get(neigh[j]) === d - 1){ prev = neigh[j]; break; }
    if (prev === -1) break;
    path.push(prev);
    cur = prev;
  }
  path.reverse();
  return { key: dest, path, banked: dest === targetKey };
}

// Wisselt alleen als de volgende opdracht in je stapel AANTOONBAAR dichterbij ligt dan de
// huidige. Dat mag, want bij Herprioritering bekijk je eerst je volgende kaart (zie botWantsReorderPeek).
function energyReorderTarget(graph, player, fromKey){
  const curLabel = player.order[player.nextIdx];
  const altLabel = player.order[player.nextIdx + 1];
  if (altLabel === undefined) return null;
  const stamp = simBfsDistances(graph, fromKey);
  const dCur = simDistLookup(stamp, graph.questCells[curLabel]);
  const dAlt = simDistLookup(stamp, graph.questCells[altLabel]);
  if (dCur < 0 || dAlt < 0 || dAlt >= dCur) return null;
  player.order[player.nextIdx] = altLabel;
  player.order[player.nextIdx + 1] = curLabel;
  return altLabel;
}

// Zet een bot Herprioritering in? Hij weet vóóraf alleen hoe ver zijn huidige opdracht is (dat
// vakje ligt open op het bord) — pas NA betalen ziet hij de volgende kaart en beslist hij met
// energyReorderTarget of wisselen loont. Dus: betalen zodra hij ver weg staat, ook als de wissel
// daarna niets blijkt op te leveren (precies zoals een mens aan tafel).
function botWantsReorderPeek(graph, player, fromKey){
  if (player.order[player.nextIdx + 1] === undefined) return false;
  const stamp = simBfsDistances(graph, fromKey);
  const dCur = simDistLookup(stamp, graph.questCells[player.order[player.nextIdx]]);
  return dCur > REORDER_PEEK_THRESHOLD;
}

// ---------- PORTALEN: de 5e energie-actie "Portaalkanon" (2026-10) ----------
// Er liggen altijd twee portalen op het bord, een blauwe (0) en een rode (1), gedeeld door alle
// spelers. Bij de start liggen ze al, op twee willekeurige gewone vakjes die minstens
// PORTAL_START_MIN_DIST stappen uit elkaar liggen: met maar één portaal gebeurt er niets, dus wie
// als eerste een portaal legde zou anders voor niets betalen.
// Regels (gekozen na de analyse "Axiom-9 Portalen": 44 varianten × 10.000 potjes):
//   - Portaalkanon (energie-actie, vóór de worp): kies een richting; het portaal vliegt rechtdoor
//     tot de muur of tot vóór een pion en landt op het verste gewone vakje van die lijn (nooit op
//     een opdracht-, start- of kristalvakje, nooit op het andere portaal). Kies dan welke kleur je
//     verplaatst; de andere blijft liggen, ook als een ander hem legde ("stelen").
//   - Stap je bij een gewone worp in een portaal, dan kom je uit het andere en STOPT je zet daar.
//     Instappen kost één stap, de rest van de worp vervalt. Doorlopen bleek te sterk: potjes 6–11%
//     korter en tot 10% van de opdrachten via een portaal (stoppen: 2–4% korter, 3–4%).
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
// Techniek: de buurlijst (adjKey) blijft het gewone bord. Alleen resolveMove (de stop-regel),
// simBfsDistances (A en B zijn één vakje voor de afstand) en de stappen van de mens
// (soloLegalNextCells in 97-solo.js) kijken naar graph.portals — zo gaan sprongen, sprints en
// duwkaarten vanzelf niet door een portaal.
const PORTAL_START_MIN_DIST = 16;
// Een bot schiet alleen als het hem minstens zoveel stappen scheelt naar zijn huidige opdracht
// (gemeten: dan levert een schot gemiddeld ±14 stappen op)
const PORTAL_BOT_MIN_GAIN = 6;
const PORTAL_NAMES = ['blauwe', 'rode'];
// zet graph.portals = { cells: [blauw, rood], owner: [-1, -1] } voor een nieuw potje
function portalSetup(graph, rand){
  const normal = portalNormalCells(graph);
  let a = -1, b = -1;
  for (let t = 0; t < 400 && b < 0; t++){
    a = normal[Math.floor(rand() * normal.length)];
    const d = portalBaseBfs(graph, a);
    const far = normal.filter(k => d[k] >= PORTAL_START_MIN_DIST);
    if (far.length) b = far[Math.floor(rand() * far.length)];
  }
  graph.portals = { cells: [a, b], owner: [-1, -1] };
  return graph.portals;
}
// mag hier een portaal liggen? gewone, loopbare vakjes zonder label
function portalCellAllowed(graph, k){
  if (k < 0 || !graph.adjKey[k]) return false;
  if (graph.actionCells.has(k)) return false;
  if (!graph._portalSpecial){
    graph._portalSpecial = new Set([...Object.values(graph.questCells), ...Object.values(graph.startCells)]);
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
// Stap je op vakje `k`: kom je dan uit een portaal, en waar? Geeft het andere portaal terug, of
// -1 (geen portaal, het andere ligt er nog niet, of er staat een pion op een van de twee).
// `occ` en `occ2` zijn bezette vakjes (occ2 = Blinde Vlek: wel doorheen, niet op eindigen).
function portalExitFor(graph, k, occ, occ2){
  const P = graph.portals;
  if (!P) return -1;
  const a = P.cells[0], b = P.cells[1];
  if (a < 0 || b < 0 || (k !== a && k !== b)) return -1;
  if (occ && (occ.has(a) || occ.has(b))) return -1;
  if (occ2 && (occ2.has(a) || occ2.has(b))) return -1;
  return k === a ? b : a;
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
// is de afstand min(d(jij,a) + d(b,doel), d(jij,b) + d(a,doel)), over het gewone bord.
function botPortalShot(graph, player, occupied, targets){
  const P = graph.portals, t = targets && targets[0];
  if (!P || t === undefined) return null;
  const opts = portalCannonOptions(graph, player.pos, occupied);
  if (!opts.length) return null;
  const dS = portalBaseBfs(graph, player.pos), dT = portalBaseBfs(graph, t);
  const far = 1e9;
  const via = (a, b) => (a < 0 || b < 0 || dS[a] < 0 || dT[b] < 0 || dS[b] < 0 || dT[a] < 0) ? far
    : Math.min(dS[a] + dT[b], dS[b] + dT[a]);
  const pa = P.cells[0], pb = P.cells[1];
  const direct = dS[t] < 0 ? far : dS[t];
  const blocked = occupied && (occupied.has(pa) || occupied.has(pb));
  const dNow = Math.min(direct, blocked ? far : via(pa, pb));
  let best = null;
  for (const o of opts){
    for (let color = 0; color < 2; color++){
      const keep = P.cells[1 - color];
      if (keep < 0 || (occupied && occupied.has(keep))) continue;
      const gain = dNow - Math.min(direct, via(o.key, keep));
      if (!best || gain > best.gain) best = { dir: o.dir, key: o.key, path: o.path, color, gain };
    }
  }
  return best && best.gain >= PORTAL_BOT_MIN_GAIN ? best : null;
}
// Hoeveel portaalsprongen zitten er in een pad? Twee opeenvolgende vakjes die niet naast elkaar
// liggen = door een portaal. Voor de statistiek en de animatie.
function pathPortalJumps(graph, path){
  let n = 0;
  for (let i = 1; i < path.length; i++) if (portalIsJump(graph, path[i - 1], path[i])) n++;
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
    player._portalWant = !!botPortalShot(graph, player, null, targets);
  }
  return player._portalWant;
}

// ---------- strategie "Slim": de bot kiest elke beurt zelf ----------
// Gebruikerswens: niet één vaste energie-actie per bot, maar een bot die nadenkt of hij nu iets
// uitgeeft of spaart. Aan het begin van elke eigen beurt kiest hij één actie (of geen) en speelt
// hij die beurt alsof dat zijn strategie is — zo blijft alle bestaande bot-code (botPreRollMove,
// de Herprioritering- en Stuwstoot-checks in alle modi) gewoon werken via botStrategyNow().
// Overwegingen, in deze volgorde:
//  1. Noodtransport als hij 10 energie heeft en zijn opdracht verder dan JUMP_BOT_MIN_DIST weg is.
//  2. Zwaartekracht-laarzen als een sprint hem flink (≥5 vakjes) dichterbij brengt of op zijn
//     opdracht zet.
//  3. Sparen voor die sprong: ver weg (>12) en al 7–9 energie → nu niets uitgeven.
//  4. Stuwstoot als de opdracht 8–14 stappen weg is (daar maakt een 3e steen het meeste uit).
//  5. Herprioritering als de opdracht heel ver weg is (>14) — misschien ligt de volgende dichterbij.
//  6. Bijna vol (≥9): toch iets uitgeven, anders gaat de energiesteen van de volgende beurt verloren.
// Zit bewust NIET in ENERGY_STRATEGIES (de batch-simulatie meet de vaste strategieën tegen
// elkaar); te kiezen bij Automatisch → Energie-inzet → "iedereen slim".
function botStrategyNow(graph, player){
  // vaste strategie: wel een portaal als dat loont ("niemand geeft uit" blijft niets uitgeven)
  if (player.strategy !== 'smart') return player.strategy !== 'none' && botPortalWanted(graph, player) ? 'portal' : player.strategy;
  const turnKey = `${player.ownTurns || 0}/${player.myTurn || 0}`;
  if (player._smartKey !== turnKey){
    player._smartKey = turnKey;
    player._smartPick = botSmartPick(graph, player);
  }
  return player._smartPick;
}
function botSmartPick(graph, player){
  const deck = player.order || player.deck;
  const label = deck && deck[player.nextIdx];
  if (!label) return null;
  const targetKey = graph.questCells[label];
  const E = player.energy;
  // let op: simBfsDistances deelt één buffer, dus elke afstand meteen uitlezen
  const d = simDistLookup(simBfsDistances(graph, targetKey), player.pos);
  if (d <= 0) return null;
  if (E >= ENERGY_ACTIONS.jump.cost && d > JUMP_BOT_MIN_DIST) return 'jump';
  let dashGain = 0;
  if (E >= ENERGY_ACTIONS.gravity.cost){
    const targets = [];
    for (let i = player.nextIdx; i < deck.length; i++) if (deck[i] != null) targets.push(graph.questCells[deck[i]]);
    const dash = botPickGravityDash(graph, player.pos, new Set(), targets);
    if (dash){
      dashGain = dash.bankedCount > 0 ? d
        : d - simDistLookup(simBfsDistances(graph, targetKey), dash.key);
    }
  }
  // portaal: alleen als het meer oplevert dan een sprint (en de drempel van botPortalShot haalt)
  if (E >= ENERGY_ACTIONS.portal.cost && !player.noPortal && graph.portals){
    const targets = [];
    for (let i = player.nextIdx; i < deck.length; i++) if (deck[i] != null) targets.push(graph.questCells[deck[i]]);
    const shot = botPortalShot(graph, player, null, targets);
    if (shot && shot.gain > dashGain) return 'portal';
  }
  if (dashGain >= 5) return 'gravity';
  const saving = d > 12 && E >= 7 && E < ENERGY_ACTIONS.jump.cost;
  if (!saving && E >= ENERGY_ACTIONS.boost.cost && d >= 8 && d <= 14) return 'boost';
  if (!saving && E >= ENERGY_ACTIONS.reorder.cost && d > 14 && deck[player.nextIdx + 1] != null) return 'reorder';
  if (E >= ENERGY_MAX - 1){
    if (dashGain >= 2) return 'gravity';
    if (d > 7) return 'boost';
  }
  return null;
}
// naam van een (bot-)strategie voor in het log; "smart" staat niet in ENERGY_ACTIONS
function energyStrategyName(id){
  if (id === 'smart') return 'Slim (kiest zelf)';
  return ENERGY_ACTIONS[id] ? ENERGY_ACTIONS[id].name : '—';
}

// ---------- beloningskaarten ----------
// Wie een opdracht bereikt trekt een kaart van een gedeelde, gesloten stapel (2 exemplaren
// van elk type in ACTION_CARDS, Portaalsleutel 5 — nu 15 typen, dus 33 kaarten; zie
// ACTION_CARD_COPIES en buildActionDeck) — net als het actiekaartvakje in elke gangtegel, dat
// dezelfde beloning geeft zonder de zet te onderbreken (zie ACTION_CELL_LABELS/actionCells).
// Je mag maximaal ACTION_CARD_HAND_MAX kaarten tegelijk vasthouden; sta je daar al op, dan
// trek je niet (de kaart blijft liggen). Gebruikte kaarten gaan op de aflegstapel;
// is de trekstapel leeg, dan wordt de aflegstapel geschud en dient weer als trekstapel. De
// opdrachtkaarten blijven gewoon staan — je moet nog steeds je 6 opdrachten voltooien, de
// kaarten zijn een bonus onderweg, geen vervanging.
//
// Een kaart spelen en een energie-actie inzetten zijn TWEE LOSSE sloten per beurt (max 1 van
// elk) — vroeger deelden ze één gezamenlijk slot. Zie de uitgebreide toelichting bij
// `energyActionUsed`/`cardActionUsed` in simulateOneGame() voor de drie paren (Stuwlading/
// Stuwstoot, laarzen-kristal/laarzen, Portaalsleutel/Portaalkanon) die elkaar nog wél
// uitsluiten omdat ze hetzelfde mechanische effect hebben. Binnen het kaart-slot is de
// voorrangsvolgorde: eerst de energie-kaarten (ze horen bij de worp die net gevallen is), dan de
// hinderkaarten, dan de bewegingskaarten, dan de kaarten op de worp zelf (Zelf kiezen,
// Koerscorrectie, Zonnezeil) en als laatste de reactieve kaart (Blinde Vlek, die pas afgaat als
// je route daadwerkelijk geblokkeerd raakt).
// Op het scherm heten deze "kristallen" (zie CLAUDE.md); de code-namen bleven ACTION_CARDS e.d.
// Per kristal:
//   name — naam op het kristal en in het log
//   hint — korte omschrijving voor in logregels ("… — hint.")
//   text — de zin OP het kristal: hooguit ±8 woorden, met hoofdletter, zonder punt
//   when — WANNEER je hem mag gebruiken. Dit is de énige bron: het label bovenin het kristal
//          (CRYSTAL_WHEN) én de spelregel in soloCardBlockReason (97-solo.js) lezen allebei dit
//          veld, zodat tekst en regel nooit meer uit elkaar lopen (dat gebeurde met de oude
//          Canva-plaatjes wel: "10 stappen" op de kaart, 8 in het spel).
//          'pre'   alleen vóór het dobbelen
//          'any'   vóór het dobbelen of tijdens je zet
//          'start' na het gooien, zolang je nog geen stap hebt gezet
//          'post'  tijdens je zet (na het gooien)
//          'auto'  nooit zelf; wordt aangeboden als het kan (Blinde Vlek)
// Hoeveel er van elk in de stapel zitten staat in ACTION_CARD_COPIES (standaard 2).
// De soort (kleur) staat in ACTION_CARD_TINTS hieronder, het icoon in ACTION_CARD_ICONS.
// Nieuw kristal? Eén regel hier + een tint + een icoon — vorm, kluis, vitrine en animaties volgen vanzelf.
const ACTION_CARDS = {
  // gratis versie van de energie-actie Zwaartekracht-laarzen (zelfde paar als Stuwlading/Stuwstoot)
  boots:     { name: 'Zwaartekracht-laarzen', when: 'pre',   text: `Sprint ${GRAVITY_DASH_STEPS} vakjes rechtdoor, dan gooi je`, hint: `gratis: eerst ${GRAVITY_DASH_STEPS} vakjes rechtdoor, dan gooien` },
  ration:    { name: 'Noodrantsoen',          when: 'any',   text: 'Krijg direct 3 energie',                  hint: '+3 energie direct' },
  short:     { name: 'Kortsluiting',          when: 'post',  text: 'Een tegenstander krijgt geen energie',    hint: 'tegenstander mist zijn energiesteen' },
  blind:     { name: 'Blinde Vlek',           when: 'auto',  text: 'Loop door spelers heen, maar stop er niet op', hint: 'loop door tegenstanders heen — eindig er niet op' },
  shove:     { name: 'Duwstoot',              when: 'post',  text: `Duw een speler naast je ${SHOVE_DISTANCE} vakjes weg`, hint: 'duw een naastgelegen tegenstander weg' },
  boostcell: { name: 'Stuwlading',            when: 'any',   text: 'Gooi deze beurt met 3 loopstenen',        hint: 'gratis derde loopsteen' },
  condenser: { name: 'Condensator',           when: 'post',  text: 'Volgende beurt telt je energiesteen dubbel', hint: 'je energiesteen telt in je volgende beurt dubbel' },
  reroll:    { name: 'Koerscorrectie',        when: 'start', text: 'Gooi je worp opnieuw',                    hint: 'gooi je worp opnieuw' },
  lockdown:  { name: 'Vergrendeling',         when: 'post',  text: 'Een tegenstander mag niets inzetten',     hint: 'tegenstander mist energie- én kristalactie' },
  outage:    { name: 'Stroomonderbreking',    when: 'post',  text: 'Een tegenstander loopt 2 stappen minder', hint: 'tegenstander gooit 2 stappen minder' },
  // ---- nieuw in 2026-10 (vervangen Snelroute, Herkalibratie, Kristalruil, Vooruitblik,
  //      Prioriteitspas, Noodbarrière, Terugtrekbevel en Signaalstoring) ----
  leak:      { name: 'Energielek',            when: 'post',  text: `Pak ${ENERGY_LEAK_AMOUNT} energie van een tegenstander`, hint: `pakt ${ENERGY_LEAK_AMOUNT} energie van een tegenstander` },
  twin:      { name: 'Dubbele steen',         when: 'pre',   text: 'Gooi deze beurt 2 energiestenen',         hint: 'een tweede energiesteen bij deze worp' },
  solar:     { name: 'Zonnezeil',             when: 'start', text: 'Krijg energie gelijk aan je laagste loopsteen', hint: 'energie gelijk aan je laagste loopsteen' },
  // gratis versie van de energie-actie Portaalkanon (zelfde paar als de laarzen)
  portalkey: { name: 'Portaalsleutel',        when: 'pre',   text: 'Verplaats gratis een portaal, dan gooi je', hint: 'gratis Portaalkanon' },
  pick:      { name: 'Zelf kiezen',           when: 'start', text: 'Geef één loopsteen een waarde naar keuze', hint: 'kies zelf de waarde van één loopsteen' },
};
// Hoeveel exemplaren van een kristal er in de stapel zitten; niet genoemd = 2 (zie buildActionDeck).
const ACTION_CARD_COPIES = { portalkey: 5 };
function actionCardCopies(id){ return ACTION_CARD_COPIES[id] || 2; }
// label bovenin het kristal, per `when`
const CRYSTAL_WHEN = { pre: 'Vóór je gooit', any: 'Vóór of na', start: 'Direct na worp', post: 'Na je worp', auto: 'Vanzelf' };
// soort onderin het kristal, per ACTION_CARD_TINTS-waarde
const CRYSTAL_CATS = { amber: 'Beweging', start: 'Energie', quest: 'Nut', danger: 'Verstoring' };
const ACTION_CARD_IDS = Object.keys(ACTION_CARDS);
const ACTION_CARD_HAND_MAX = 3;

// ---------- kaart-illustraties ----------
// Geen losse plaatjes (dat blaast het éénbestands-HTML op) — elke kaart is een klein
// lijntekening-icoon in inline SVG, opgebouwd uit dezelfde stroke-taal als de rest van de
// HUD (currentColor, ronde lijnuiteinden). `tint` groepeert de kaarten thematisch in de
// bestaande kleurtaal: amber = beweging, groen = energie, blauw = nut/utility,
// rood = verstoring.
const ACTION_CARD_TINTS = {
  boots: 'amber', boostcell: 'amber', reroll: 'amber',
  ration: 'start', condenser: 'start', leak: 'start', twin: 'start', solar: 'start',
  blind: 'quest', portalkey: 'quest', pick: 'quest',
  short: 'danger', shove: 'danger', lockdown: 'danger', outage: 'danger',
};
const ACTION_CARD_ICONS = {
  boots: `<path d="M14 34 L14 18 Q14 14 18 14 L22 14 L22 24 L30 24 Q34 24 34 28 L34 34 Z"/>
    <line x1="6" y1="16" x2="12" y2="16"/><line x1="4" y1="22" x2="11" y2="22"/><line x1="6" y1="28" x2="12" y2="28"/>`,
  ration: `<rect x="14" y="12" width="20" height="26" rx="3"/>
    <rect x="20" y="7" width="8" height="5" rx="1" fill="currentColor" stroke="none"/>
    <path d="M26 18 L20 27 L24 27 L22 34 L30 24 L25 24 Z" fill="currentColor" stroke="none"/>`,
  short: `<path d="M8 24 L20 24 L16 16 L28 16"/><path d="M28 16 L24 32 L40 22"/>
    <circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/>
    <line x1="30" y1="12" x2="34" y2="8"/><line x1="35" y1="18" x2="40" y2="16"/><line x1="32" y1="27" x2="37" y2="31"/>`,
  blind: `<path d="M5 24 Q24 9 43 24 Q24 39 5 24 Z"/><circle cx="24" cy="24" r="6"/>
    <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none"/>
    <line x1="4" y1="20.5" x2="44" y2="20.5" stroke-dasharray="2.5 3"/>
    <line x1="4" y1="27.5" x2="44" y2="27.5" stroke-dasharray="2.5 3"/>`,
  shove: `<circle cx="32" cy="24" r="7.5"/><line x1="5" y1="24" x2="20" y2="24"/><path d="M14 17.5 L20.5 24 L14 30.5"/>`,
  boostcell: `<rect x="5" y="30" width="10" height="10" rx="2"/><circle cx="10" cy="35" r="1.3" fill="currentColor" stroke="none"/>
    <rect x="19" y="19" width="10" height="10" rx="2"/>
    <circle cx="22" cy="22" r="1.1" fill="currentColor" stroke="none"/><circle cx="26" cy="26" r="1.1" fill="currentColor" stroke="none"/>
    <rect x="33" y="8" width="10" height="10" rx="2"/>
    <circle cx="36" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="40" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="36" cy="15" r="1" fill="currentColor" stroke="none"/>`,
  // condensator: twee platen met een aansluiting links/rechts en een vonk in de spleet
  condenser: `<line x1="18" y1="13" x2="18" y2="35"/><line x1="30" y1="13" x2="30" y2="35"/>
    <line x1="5" y1="24" x2="18" y2="24"/><line x1="30" y1="24" x2="43" y2="24"/>
    <path d="M26.5 16 L21 24.5 L25 24.5 L21.5 32" fill="none"/>`,
  // koerscorrectie: een loopsteen met twee cirkelpijlen eromheen (opnieuw gooien)
  reroll: `<rect x="17" y="17" width="16" height="16" rx="3"/>
    <circle cx="22" cy="22" r="1.5" fill="currentColor" stroke="none"/><circle cx="28" cy="28" r="1.5" fill="currentColor" stroke="none"/>
    <path d="M11 21 A15 15 0 0 1 34 10"/><path d="M34 10 L29 9.5 M34 10 L33 14.5"/>
    <path d="M37 27 A15 15 0 0 1 14 38"/><path d="M14 38 L19 38.5 M14 38 L15 33.5"/>`,
  lockdown: `<rect x="14" y="22" width="20" height="16" rx="2"/><path d="M18 22 L18 15 A6 6 0 0 1 30 15 L30 22"/>
    <circle cx="24" cy="29" r="2" fill="currentColor" stroke="none"/><line x1="24" y1="31" x2="24" y2="34"/>`,
  outage: `<path d="M26 6 L14 26 L22 26 L18 42 L34 20 L26 20 Z"/><line x1="8" y1="8" x2="40" y2="40"/>`,
  // energielek: een pijl die energie een accu in trekt
  leak: `<rect x="22" y="14" width="20" height="20" rx="3"/><rect x="42" y="20" width="3" height="8" rx="1" fill="currentColor" stroke="none"/>
    <path d="M33 17 L28 25 L32 25 L30 31" fill="none"/>
    <line x1="4" y1="24" x2="17" y2="24"/><path d="M12 19 L17 24 L12 29"/>`,
  // dubbele steen: twee energiestenen met elk een bliksem
  twin: `<rect x="5" y="12" width="19" height="19" rx="3"/><rect x="24" y="19" width="19" height="19" rx="3"/>
    <path d="M16 15 L11.5 22 L15 22 L13 28" fill="none"/><path d="M35 22 L30.5 29 L34 29 L32 35" fill="none"/>`,
  // zonnezeil: een zon boven een loopsteen
  solar: `<circle cx="16" cy="15" r="5.5"/>
    <line x1="16" y1="3" x2="16" y2="6"/><line x1="16" y1="24" x2="16" y2="27"/><line x1="4" y1="15" x2="7" y2="15"/><line x1="25" y1="15" x2="28" y2="15"/>
    <line x1="7.5" y1="6.5" x2="9.6" y2="8.6"/><line x1="22.4" y1="21.4" x2="24.5" y2="23.5"/><line x1="7.5" y1="23.5" x2="9.6" y2="21.4"/><line x1="22.4" y1="8.6" x2="24.5" y2="6.5"/>
    <rect x="26" y="26" width="17" height="17" rx="3"/><circle cx="34.5" cy="34.5" r="1.7" fill="currentColor" stroke="none"/>`,
  // portaalsleutel: een sleutel waarvan de kop een portaalring is
  portalkey: `<ellipse cx="14" cy="24" rx="8" ry="10"/><ellipse cx="14" cy="24" rx="3.5" ry="5"/>
    <line x1="22" y1="24" x2="43" y2="24"/><line x1="36" y1="24" x2="36" y2="31"/><line x1="42" y1="24" x2="42" y2="30"/>`,
  // zelf kiezen: een loopsteen met een pijltje omhoog en omlaag ernaast
  pick: `<rect x="7" y="12" width="24" height="24" rx="4"/>
    <circle cx="13.5" cy="18.5" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="24" r="1.7" fill="currentColor" stroke="none"/><circle cx="24.5" cy="29.5" r="1.7" fill="currentColor" stroke="none"/>
    <path d="M36 17 L40 12 L44 17"/><path d="M36 31 L40 36 L44 31"/>`,
};

// Het kristal zelf (zeshoek met moment, icoon, naam, uitleg en soort) tekent renderCrystal() in
// 96c-crystals.js — één tekenfunctie voor de kluis, de vitrine (Speelkaarten) en de animaties.

function buildActionDeck(rand){
  const cards = [];
  for (const id of ACTION_CARD_IDS) for (let n = 0; n < actionCardCopies(id); n++) cards.push(id);
  return { draw: simShuffle(cards, rand), discard: [] };
}
function drawActionCard(deck, rand){
  if (deck.draw.length === 0){
    if (deck.discard.length === 0) return null;
    deck.draw = simShuffle(deck.discard, rand);
    deck.discard = [];
  }
  return deck.draw.pop();
}
// beloning voor het lopen over een actiekaartvakje (gangtegels) tijdens de beurt — mechanisch
// hetzelfde als een opdracht-beloning (kaart trekken, tenzij de hand al vol is), maar de
// aanroeper bepaalt zelf (per beurt, per spelmodus) of dit al is gebeurd: anders dan een
// opdracht onderbreekt dit vakje de zet niet, dus je kunt er in principe meerdere per beurt
// passeren — precies waarom er hooguit 1x per beurt beloond wordt.
function drawActionCellReward(player, deck, rand){
  if (player.cards.length >= ACTION_CARD_HAND_MAX) return { drawn: null, handFull: true };
  const drawn = drawActionCard(deck, rand);
  if (drawn) player.cards.push(drawn);
  return { drawn, handFull: false };
}
// heeft dit (net gelopen) pad-segment een actiekaartvakje geraakt? `path[0]` is de cel waar je
// AL stond bij het begin van dit segment, dus die telt niet mee — alleen cellen die je deze
// beurt daadwerkelijk BETREDEN hebt.
function pathHasActionCell(graph, path){
  for (let i = 1; i < path.length; i++) if (graph.actionCells.has(path[i])) return true;
  return false;
}
// welk kristalvakje werd als eerste betreden (voor de animatie: daar komt het kristal vandaan)
function pathFirstActionCell(graph, path){
  for (let i = 1; i < path.length; i++) if (graph.actionCells.has(path[i])) return path[i];
  return undefined;
}
// verwijdert een kaart uit de hand van een speler en legt hem af. `extra` is optioneel —
// "stap voor stap" telt niets bij, alleen de batch-simulatie.
function useActionCard(player, id, deck, extra){
  const i = player.cards.indexOf(id);
  if (i === -1) return;
  player.cards.splice(i, 1);
  deck.discard.push(id);
  if (extra){
    extra.cardUses[id]++;
    (player.playedKinds || (player.playedKinds = new Set())).add(id);   // voor "Wint wie hem speelt?"
  }
  if (player.stats){   // afleggen corrigeert dit (soloDiscardCard)
    player.stats.cardsPlayed++;
    if (player.stats.cardUse) player.stats.cardUse[id] = (player.stats.cardUse[id] || 0) + 1;
  }
}

// Loopt vanaf `fromKey` een vaste richting `dir` uit tot `maxSteps`, geen bochten. Stopt bij
// een muur of een bezet vakje; `bankedAt` is de padindex waarop het doel geraakt werd (-1 als
// niet), en dan stopt hij daar ook. Gebruikt door Duwstoot (shoveDestination); de laarzen
// hebben hun eigen walkGravityDash (vaste lengte GRAVITY_DASH_STEPS, rij opdrachten).
function walkStraightLine(graph, fromKey, dir, maxSteps, occupied, targetKey){
  const { adjKey, adjDir } = graph;
  let cur = fromKey;
  const path = [cur];
  let wasBlocked = false;
  let bankedAt = -1;
  for (let s = 0; s < maxSteps; s++){
    const neigh = adjKey[cur], dirs = adjDir[cur];
    let next = -1;
    for (let j = 0; j < dirs.length; j++) if (dirs[j] === dir){ next = neigh[j]; break; }
    if (next === -1) break;           // muur: deze richting stopt hier
    if (occupied.has(next)){ wasBlocked = true; break; }
    cur = next;
    path.push(cur);
    if (targetKey !== undefined && cur === targetKey){ bankedAt = path.length - 1; break; }
  }
  return { path, wasBlocked, bankedAt };
}
// ---------- Zwaartekracht-laarzen (energie-actie én kaart): eerst rechtdoor, dan gooien ----------
// Eén richting uitlopen: rechtdoor tot een muur, een bezet vakje of GRAVITY_DASH_STEPS vakjes.
// Kom je onderweg op je opdracht (`targets[0]` — `targets` is de rij nog te halen
// opdrachtvakjes vanaf het huidige doel, zoals bij resolveMove), dan telt die in `bankedCount`
// en STOPT de sprint daar (spelregel van de maker; anders dan bij een worp). Je gooit daarna
// gewoon vanaf het opdrachtvakje, richting de volgende opdracht. Een sprint pakt dus hooguit 1.
function walkGravityDash(graph, fromKey, dir, occupied, targets){
  const { adjKey, adjDir } = graph;
  let cur = fromKey, banked = 0, wasBlocked = false;
  const path = [cur];
  for (let s = 0; s < GRAVITY_DASH_STEPS; s++){
    const neigh = adjKey[cur], dirs = adjDir[cur];
    let next = -1;
    for (let j = 0; j < dirs.length; j++) if (dirs[j] === dir){ next = neigh[j]; break; }
    if (next === -1) break;                                  // muur: hier houdt het op
    if (occupied.has(next)){ wasBlocked = true; break; }      // andere pion: ook
    cur = next;
    path.push(cur);
    if (targets && targets.length && cur === targets[0]){ banked = 1; break; }   // op je opdracht: stop
  }
  return { dir, path, key: cur, bankedCount: banked, wasBlocked };
}
// Alle (tot 4) richtingen waarin je minstens één vakje opschiet — de mens kiest hieruit.
function gravityDashOptions(graph, fromKey, occupied, targets){
  const options = [];
  for (let d = 0; d < 4; d++){
    const line = walkGravityDash(graph, fromKey, d, occupied, targets);
    if (line.path.length > 1) options.push(line);
  }
  return options;
}
// Bot-keuze: liefst een richting die een opdracht pakt; anders de richting die het dichtst bij
// het (eerstvolgende open) doel eindigt — en alleen als dat ook echt dichterbij is dan waar hij
// nu staat (anders laat hij de laarzen liggen en gooit hij gewoon).
function botPickGravityDash(graph, fromKey, occupied, targets){
  const options = gravityDashOptions(graph, fromKey, occupied, targets);
  if (!options.length || !targets.length) return null;
  const maxBanked = Math.max(...options.map(o => o.bankedCount));
  const pool = options.filter(o => o.bankedCount === maxBanked);
  const nextTarget = targets[maxBanked];
  if (nextTarget === undefined) return pool[0];              // haalt al zijn laatste opdracht
  const stamp = simBfsDistances(graph, nextTarget);
  let best = null, bestD = Infinity;
  for (const o of pool){
    const d = simDistLookup(stamp, o.key);
    if (d >= 0 && d < bestD){ bestD = d; best = o; }
  }
  if (!best) return null;
  if (maxBanked === 0){
    const dNow = simDistLookup(stamp, fromKey);
    if (dNow >= 0 && bestD >= dNow) return null;
  }
  return best;
}

// Gedeelde bot-beslissing VÓÓR de worp, voor alle drie de spelmodi (simulatie, Automatisch,
// bot-beurten in Zelf spelen), zodat die nooit uit elkaar lopen. Volgorde: Noodtransport
// (alleen de jump-strategie), dan de laarzen — de kaart (gratis) gaat voor de energie-actie en
// ze sluiten elkaar uit, één sprint per beurt. Betaalt/verbruikt NIETS: de aanroeper doet dat
// (en logt/animeert op zijn eigen manier). Geeft null of een verplaatsing terug:
//   { kind: 'portalCard' | 'portal' | 'jump' | 'bootsCard' | 'gravity', path, key, bankedCount, wasBlocked, endsTurn }
// 'portalCard' en 'portal' hebben ook `shot` (zie preIsPortal).
// `endsTurn`: Noodtransport dat precies op je opdracht landt beëindigt je beurt (zoals bij de
// mens, soloHandleJumpClick); een sprint niet, die gooit gewoon door.
function botPreRollMove(graph, player, occupied, targets, canEnergy, canCard){
  const targetKey = targets[0];
  if (targetKey === undefined) return null;
  // Portaalsleutel (gratis kristal) gaat voor het betaalde Portaalkanon; één schot per beurt
  if (canCard && player.cards.includes('portalkey') && graph.portals){
    const shot = botPortalShot(graph, player, occupied, targets);
    if (shot) return { kind: 'portalCard', shot, path: [player.pos], key: player.pos, bankedCount: 0, wasBlocked: false, endsTurn: false };
  }
  // Portaalkanon: geen verplaatsing (pad = alleen je eigen vakje), wel een schot. De aanroeper
  // betaalt en legt het portaal (portalPlace) vóórdat hij de worp uitrekent.
  if (canEnergy && botStrategyNow(graph, player) === 'portal' && player.energy >= ENERGY_ACTIONS.portal.cost){
    const shot = botPortalShot(graph, player, occupied, targets);
    if (shot) return { kind: 'portal', shot, path: [player.pos], key: player.pos, bankedCount: 0, wasBlocked: false, endsTurn: false };
  }
  if (canEnergy && botStrategyNow(graph, player) === 'jump' && player.energy >= ENERGY_ACTIONS.jump.cost){
    const stamp = simBfsDistances(graph, targetKey);
    if (simDistLookup(stamp, player.pos) > JUMP_BOT_MIN_DIST){
      const jump = resolveEnergyJump(graph, player.pos, ENERGY_JUMP_RANGE, targetKey, occupied);
      if (jump) return { kind: 'jump', path: jump.path, key: jump.key, bankedCount: jump.banked ? 1 : 0,
                         wasBlocked: false, endsTurn: jump.banked };
    }
  }
  const card = canCard && player.cards.includes('boots');
  const energy = canEnergy && botStrategyNow(graph, player) === 'gravity' && player.energy >= ENERGY_ACTIONS.gravity.cost;
  if (card || energy){
    const dash = botPickGravityDash(graph, player.pos, occupied, targets);
    if (dash) return { kind: card ? 'bootsCard' : 'gravity', path: dash.path, key: dash.key,
                       bankedCount: dash.bankedCount, wasBlocked: dash.wasBlocked, endsTurn: false };
  }
  return null;
}
// is deze keuze vóór de worp een portaalschot (kristal of energie)?
function preIsPortal(pre){ return !!pre && (pre.kind === 'portal' || pre.kind === 'portalCard'); }
// Plakt een verplaatsing vóór de worp (`pre`) en de daaropvolgende worp-zet (`move`, berekend
// vanaf pre.key met de opdrachten die pre nog niet pakte) aan elkaar tot één zet.
function mergePreRollMove(pre, move){
  if (!pre) return move;
  const bankedCount = pre.bankedCount + move.bankedCount;
  return { ...move, path: pre.path.concat(move.path.slice(1)), bankedCount, bankedQuest: bankedCount > 0,
           wasBlocked: pre.wasBlocked || move.wasBlocked };
}

// Kiest de koploper onder de tegenstanders die nog niet door DEZE kaart geraakt zijn.
// Bij een gelijke stand wordt er eerlijk geloot (reservoir sampling) i.p.v. altijd de
// eerstgevondene te pakken — dat laatste benadeelde startpositie 3.1 stelselmatig.
function pickLeaderTarget(players, selfIdx, alreadyAffected, rand){
  let best = null, bestCount = -1, ties = 0;
  for (const p of players){
    if (p.idx === selfIdx || !simOnBoard(p) || alreadyAffected(p)) continue;
    if (p.completed > bestCount){ best = p; bestCount = p.completed; ties = 1; }
    else if (p.completed === bestCount){ ties++; if (rand() < 1 / ties) best = p; }
  }
  return best;
}

function lastStepDirection(graph, path){
  if (!path || path.length < 2) return -1;
  const from = path[path.length - 2], to = path[path.length - 1];
  const neigh = graph.adjKey[from], dirs = graph.adjDir[from];
  for (let j = 0; j < neigh.length; j++) if (neigh[j] === to) return dirs[j];
  return -1;
}

// Kortsluiting: raakt de speler die op dit moment de meeste opdrachten heeft (bij gelijke
// stand de eerste in spelervolgorde), voor zover die nog meespeelt en niet al geraakt is.
function pickShortCircuitTarget(players, selfIdx, rand){
  return pickLeaderTarget(players, selfIdx, p => p.skipEnergyRoll, rand);
}

// ---------- de kristallen van 2026-10: gedeeld door simulatie, Automatisch en Zelf spelen ----------
// Energielek: de tegenstander met de meeste energie (gelijk = geloot), die er nog op het bord staat.
function pickEnergyLeakTarget(players, selfIdx, rand){
  let best = null, bestE = 0, ties = 0;
  for (const p of players){
    if (p.idx === selfIdx || !simOnBoard(p) || p.energy <= 0) continue;
    if (p.energy > bestE){ best = p; bestE = p.energy; ties = 1; }
    else if (p.energy === bestE){ ties++; if (rand() < 1 / ties) best = p; }
  }
  return best;
}
// pakt hooguit ENERGY_LEAK_AMOUNT energie af; boven het plafond valt het weg (net als elke winst)
function applyEnergyLeak(thief, victim){
  const taken = Math.min(ENERGY_LEAK_AMOUNT, victim.energy);
  victim.energy -= taken;
  const gain = simGainEnergy(thief, taken);
  return { taken, gained: gain.gained };
}
// Dubbele steen: een bot speelt hem als de tweede energiesteen niet tegen het plafond wegvalt
// (`pending` = wat hij deze beurt al gooide en nog bij krijgt) en zijn steen niet uitgeschakeld is.
function botWantsTwinEnergy(player, pending){
  return !player.skipEnergyRoll && player.energy + (pending || 0) + 3 <= ENERGY_MAX;
}
// Zonnezeil: energie gelijk aan de laagste loopsteen (2 of 3 stenen)
function solarGain(dieVals){ return dieVals.length ? Math.min(...dieVals) : 0; }
// Hoe goed is een zet voor de bot? Eerst het aantal gepakte opdrachten, dan hoe dicht hij bij
// de volgende uitkomt. Gebruikt door Zelf kiezen (botPickDieValue).
function botMoveScore(graph, move, targets){
  const b = move.bankedCount || 0;
  const next = targets[b];
  if (next === undefined) return (b + 1) * 1000;            // alles gehaald
  const d = simDistLookup(simBfsDistances(graph, next), move.key);
  return b * 1000 - (d >= 0 ? d : 999);
}
// Zelf kiezen: probeer elke steen op elke andere waarde en neem de beste zet. Alleen als dat
// duidelijk beter is dan de huidige zet (een opdracht erbij, of minstens 2 vakjes dichterbij);
// anders null en houdt de bot het kristal. `penalty` = Stroomonderbreking (geldt ook voor de nieuwe worp).
function botPickDieValue(graph, fromKey, dieVals, penalty, occupied, targets, rand, current){
  const base = dieVals.reduce((a, b) => a + b, 0);
  let best = null, bestScore = botMoveScore(graph, current, targets) + 1;
  const tried = new Set();
  for (let i = 0; i < dieVals.length; i++){
    for (let v = 1; v <= 6; v++){
      if (v === dieVals[i]) continue;
      const roll = Math.max(1, base - dieVals[i] + v - (penalty || 0));
      if (tried.has(roll)) continue;             // zelfde aantal stappen = zelfde zet
      tried.add(roll);
      const move = resolveMove(graph, fromKey, roll, occupied, targets, rand);
      const s = botMoveScore(graph, move, targets);
      if (s > bestScore){ bestScore = s; best = { idx: i, value: v, roll, move }; }
    }
  }
  return best;
}

// Duwstoot: onder de tegenstanders die nu aan mij grenzen, kies de zet die hun afstand tot
// hún eigen doel het meest vergroot — en alleen toepassen als dat ook echt iets oplevert.
// Duwstoot duwt een AANGRENZENDE tegenstander SHOVE_DISTANCE vakjes ver in een WILLEKEURIGE
// richting — eerder stoppend bij een muur of een andere speler. Je kiest dus alleen wie je
// duwt, niet waarheen: waar hij belandt is een gok.
// (SHOVE_DISTANCE staat bovenin, bij GRAVITY_DASH_STEPS: ACTION_CARDS gebruikt hem al bij het laden)
// Waar komt `target` terecht? Geeft { key, steps, dir } terug, of null als hij in geen enkele
// richting ook maar één stap kan zetten (helemaal klem).
// Er wordt geloot onder de richtingen waarin hij DAADWERKELIJK kan bewegen: een richting
// uitloten die meteen tegen een muur loopt zou de kaart geregeld helemaal niets laten doen,
// en dat is zonde van een kaart die je met een voltooide opdracht hebt verdiend.
function shoveDestination(graph, players, target, rand){
  const blocked = new Set();
  for (const p of players) if (simOnBoard(p) && p !== target) blocked.add(p.pos);
  const options = [];
  for (let d = 0; d < 4; d++){
    const line = walkStraightLine(graph, target.pos, d, SHOVE_DISTANCE, blocked);
    const steps = line.path.length - 1;
    if (steps > 0) options.push({ key: line.path[steps], steps, dir: d });
  }
  if (!options.length) return null;
  return options[Math.floor(rand() * options.length)];
}
// Welke aangrenzende tegenstander duw je? De richting is toch willekeurig, dus er valt niets
// te optimaliseren aan de bestemming — een bot pakt daarom de koploper onder zijn buren
// (bij gelijke stand eerlijk geloot, zelfde aanpak als pickShortCircuitTarget).
function pickShoveMove(graph, players, selfIdx, rand){
  const self = players[selfIdx];
  let target = null, bestCount = -1, ties = 0;
  for (const nk of graph.adjKey[self.pos]){
    const p = players.find(q => simOnBoard(q) && q.idx !== selfIdx && q.pos === nk);
    if (!p) continue;
    if (p.completed > bestCount){ target = p; bestCount = p.completed; ties = 1; }
    else if (p.completed === bestCount){ ties++; if (rand() < 1 / ties) target = p; }
  }
  if (!target) return null;
  const dest = shoveDestination(graph, players, target, rand);
  return dest ? { player: target, toKey: dest.key, steps: dest.steps } : null;
}

function simRollEnergy(rand){
  return ENERGY_DIE_FACES[Math.floor(rand() * ENERGY_DIE_FACES.length)];
}
// schrijft de winst bij tot het plafond en geeft terug wat er daadwerkelijk bijkwam en wat
// er door het plafond verloren ging
function simGainEnergy(player, roll){
  const before = player.energy;
  player.energy = Math.min(ENERGY_MAX, before + roll);
  const gained = player.energy - before;
  if (player.stats){ player.stats.energyGained += gained; player.stats.energyWasted += roll - gained; }
  return { gained, wasted: roll - gained };
}

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
const simDpStamp = new Int32Array(SIM_N * 4 * SIM_CHAIN_CAP);
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
  const questCells = {}, startCells = {}, actionCells = new Set();
  for (let k = 0; k < N; k++){
    const v = labelAt[k];
    if (typeof v !== 'string') continue;
    if (v.startsWith('2.')) questCells[v] = k;
    else if (v.startsWith('3.')) startCells[v] = k;
    else if (v.startsWith('4.')) actionCells.add(k);
  }
  return { H, W, N, adjKey, adjDir, questCells, startCells, actionCells };
}

// zuivere topologische afstand vanaf één cel (negeert bezetting/U-turn) — dient als
// heuristiek om onder de DP-bereikbare eindcellen de beste te kiezen. Schrijft in de
// gedeelde simBfsDist/simBfsStampArr-buffers; geeft het stempel terug waarmee de
// caller via simDistLookup() alleen de cellen leest die in DEZE aanroep bezocht zijn.
// Portalen (graph.portals): de twee portaalvakjes tellen als één vakje — instappen in het ene is
// aankomen bij het andere. `noPortal` = gewone afstand (Noodtransport gaat niet door een portaal).
function simBfsDistances(graph, fromKey, noPortal){
  simBfsStampCounter++;
  const stamp = simBfsStampCounter;
  const { adjKey } = graph;
  const P = !noPortal && graph.portals;
  const pa = P ? P.cells[0] : -1, pb = P && pa >= 0 ? P.cells[1] : -1;
  simBfsStampArr[fromKey] = stamp;
  simBfsDist[fromKey] = 0;
  const queue = [fromKey];
  // het andere portaal meteen erachter, met dezelfde afstand (zo blijft de wachtrij op volgorde)
  const link = (k, d) => {
    if (pb < 0 || (k !== pa && k !== pb)) return;
    const o = k === pa ? pb : pa;
    if (simBfsStampArr[o] === stamp) return;
    simBfsStampArr[o] = stamp; simBfsDist[o] = d; queue.push(o);
  };
  link(fromKey, 0);
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
      if (pb >= 0) link(nk, d + 1);
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
// (cel-indices, start eerst) — voor de drukte-heatmap.
function backtrackLayers(layersKeys, layersParent, step, idx){
  const path = [];
  let s = step, i = idx;
  while (true){
    path.push(layersKeys[s][i]);
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
function pickEnd(graph, layersKeys, layersParent, layersBanked, step, targets, occupiedSet, rand, stepsUsed, endBlockedSet){
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
  const path = backtrackLayers(layersKeys, layersParent, step, bestIndex.get(chosenKey));
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
function resolveMove(graph, startKey, steps, occupiedSet, targets, rand, endBlockedSet){
  const { adjKey, adjDir } = graph;
  const layersKeys = [[startKey]], layersDirs = [[-1]], layersParent = [[]], layersBanked = [[0]];
  let wasBlocked = false;
  // Portalen: stap je in een portaal, dan kom je uit het andere en eindigt je zet daar (zie het
  // blok PORTALEN). Die eindes lopen niet mee in de lagen maar worden apart verzameld en aan het
  // eind vergeleken met het beste gewone eindvakje.
  const P = graph.portals;
  const portalLive = !!(P && P.cells[0] >= 0 && P.cells[1] >= 0);
  const portalEnds = [];
  let lastStep = steps;

  for (let step = 1; step <= steps; step++){
    simDpStampCounter++;
    const stamp = simDpStampCounter;
    const prevKeys = layersKeys[step - 1], prevDirs = layersDirs[step - 1], prevBanked = layersBanked[step - 1];
    const nextKeys = [], nextDirs = [], nextParent = [], nextBanked = [];
    for (let i = 0; i < prevKeys.length; i++){
      const ck = prevKeys[i], cd = prevDirs[i], banked = prevBanked[i];
      const neigh = adjKey[ck], dirs = adjDir[ck];
      for (let j = 0; j < neigh.length; j++){
        const d = dirs[j];
        if (cd !== -1 && d === (cd + 2) % 4) continue; // geen U-turn
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
        if (portalLive){
          const exit = portalExitFor(graph, nk, occupiedSet, endBlockedSet);
          if (exit >= 0){
            portalEnds.push({ step, i, entry: nk, key: exit, banked: newBanked });
            continue;
          }
        }
        const stateIdx = (nk * 4 + d) * SIM_CHAIN_CAP + newBanked;
        if (simDpStamp[stateIdx] === stamp) continue;
        simDpStamp[stateIdx] = stamp;
        nextKeys.push(nk); nextDirs.push(d); nextParent.push(i); nextBanked.push(newBanked);
      }
    }
    if (nextKeys.length === 0){
      // doodlopend voordat de worp op is: stop op de laatst haalbare laag
      lastStep = step - 1;
      break;
    }
    layersKeys.push(nextKeys); layersDirs.push(nextDirs); layersParent.push(nextParent); layersBanked.push(nextBanked);
  }
  let move = pickEnd(graph, layersKeys, layersParent, layersBanked, lastStep, targets, occupiedSet, rand, lastStep, endBlockedSet);
  if (portalEnds.length){
    const via = pickPortalEnd(graph, portalEnds, move, targets, layersKeys, layersParent);
    if (via) move = via;
  }
  if (!move) return null;
  move.wasBlocked = wasBlocked;
  return move;
}
// Beste einde via een portaal, als dat beter is dan het gewone einde `move`: eerst de meeste
// gepakte opdrachten, dan het dichtst bij de volgende opdracht. Bij gelijkspel wint het gewone
// einde. Het pad bevat het portaal waar je instapt én waar je uitkomt (voor de animatie).
function pickPortalEnd(graph, ends, move, targets, layersKeys, layersParent){
  let best = -1;
  for (const e of ends) if (e.banked > best) best = e.banked;
  const mb = move ? move.bankedCount : -1;
  if (best < mb) return null;
  const pool = ends.filter(e => e.banked === best);
  let pick = null;
  const next = best < targets.length ? targets[best] : null;
  if (next === null){
    if (best > mb) pick = pool[0];
  } else {
    const stamp = simBfsDistances(graph, next);
    let bd = Infinity;
    for (const e of pool){ const d = simDistLookup(stamp, e.key); if (d >= 0 && d < bd){ bd = d; pick = e; } }
    if (pick && best === mb && move){
      const dm = simDistLookup(stamp, move.key);
      if (dm >= 0 && dm <= bd) pick = null;
    }
  }
  if (!pick) return null;
  const path = backtrackLayers(layersKeys, layersParent, pick.step - 1, pick.i).concat([pick.entry, pick.key]);
  return { key: pick.key, stepsUsed: pick.step, bankedCount: pick.banked, bankedQuest: pick.banked > 0, path, viaPortal: true };
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

// ---------- statistieken per speler (knop "Statistieken" op het winscherm) ----------
// Alleen Zelf spelen, Multiplayer en Automatisch geven spelers een `stats`-object; de batch-
// simulatie niet, dus de tellers in simRollD6/simGainEnergy/useActionCard kosten daar niets.
// Bewust zo weinig mogelijk losse tellers: wat af te leiden is (energie verbruikt, kaarten
// getrokken) wordt pas op het winscherm uitgerekend (playerStatsRows in 96-walk.js), zodat er
// geen code-pad is dat vergeet mee te tellen.
function newPlayerStats(){
  return {
    dice: 0, pips: 0,              // loopstenen gegooid en hun ogen (incl. Stuwstoot/-lading, Koerscorrectie)
    energyRolled: 0,               // ogen van de energiesteen
    energyGained: 0,               // energie erbij, alle bronnen (steen, Condensator, Noodrantsoen)
    energyWasted: 0,               // verloren omdat je al op het plafond zat
    cardsPlayed: 0, cardsDiscarded: 0,
    walkSteps: 0,                  // vakjes gelopen met de worp
    dashSteps: 0,                  // vakjes gesprint met de Zwaartekracht-laarzen
    portalShots: 0,                // portalen geschoten met het Portaalkanon
    portalJumps: 0,                // keer door een portaal gestapt (eigen of van een ander)
    // voor de grafieken in de statistieken-pop-up (soloRenderStatsCharts, 97-solo.js):
    hist: [],                      // per eigen beurt [opdrachten voltooid, energie] bij het BEGIN, + eindstand
    rolls: Array(13).fill(0),      // hoe vaak de 2 loopstenen samen 2..12 gooiden (index = som)
    energyUse: {},                 // energie-actie-id → keer ingezet
    cardUse: {},                   // actiekaart-id → keer gespeeld
  };
}
// kleine tellers voor die grafieken; doen niets bij spelers zonder `stats` (batch-simulatie)
function statsTurnSnapshot(player){
  if (player && player.stats && player.stats.hist) player.stats.hist.push([player.completed, player.energy]);
}
function statsRecordRoll(player, sum){
  if (player && player.stats && player.stats.rolls && sum >= 2 && sum <= 12) player.stats.rolls[sum]++;
}
function statsUseEnergy(player, kind){
  if (player && player.stats && player.stats.energyUse) player.stats.energyUse[kind] = (player.stats.energyUse[kind] || 0) + 1;
}

// "Pech-reeksen": zoektochten van 12 beurten of langer komen in één bak
const SIM_SEARCH_HIST_MAX = 12;
// een zoektocht vanaf zoveel beurten telt als "pech" (zie Pech-reeksen in de uitslag)
const SIM_LONG_SEARCH = 8;
// aan het eind van een uitgespeeld potje: achterstand van de winnaar halverwege, en of er een
// lange pech-reeks in zat. Gedeelde winst telt per winnaar naar rato mee.
function recordGameEndStats(players, halfway, extra){
  if (halfway){
    const lead = Math.max(...halfway);
    const winners = players.filter(p => p.rank === 1);
    for (const w of winners) extra.comebackHist[Math.min(lead - halfway[w.idx], 3)] += 1 / winners.length;
    extra.comebackGames++;
  }
  if (players.some(p => p.longestSearch >= SIM_LONG_SEARCH)) extra.gamesWithLongSearch++;
  // per kristal: hoe vaak won een speler die hem dit potje minstens één keer speelde?
  for (const p of players){
    if (!p.playedKinds) continue;
    const won = rankOverlapFraction(p.rank, p.rankShare || 1, 1);
    for (const id of p.playedKinds){ extra.cardWin[id].games++; extra.cardWin[id].wins += won; }
  }
}

// speelt één potje; telt onderweg mee in `heatmap` (bezoeken per cel), `questStats`
// (hoe lang duurde het om elk opdrachtvakje te bereiken) en `extra` (blokkeren,
// voorsprong bij winst) — allemaal gedeeld over de hele batch, dus geen allocatie
// per potje nodig.
function simulateOneGame(graph, rand, heatmap, questStats, extra){
  const players = SIM_START_LABELS.map((label, idx) => ({
    idx,
    startLabel: label,
    pos: graph.startCells[label],
    order: simShuffle(SIM_QUEST_LABELS, rand),
    nextIdx: 0,
    completed: 0,
    turnsOnTarget: 0,
    longestSearch: 0,      // langste zoektocht naar één opdracht (beurten), voor "Pech-reeksen"
    energy: 0,
    strategy: 'none',
    actionUses: 0,
    cards: [],             // beloningskaarten in de hand (max ACTION_CARD_HAND_MAX)
    skipEnergyRoll: false, // getroffen door Kortsluiting: mist de eerstvolgende energiesteen
    condenserPending: false, // Condensator gespeeld: de VOLGENDE energiesteen telt dubbel
    lockedNextTurn: false, // getroffen door Vergrendeling: mist volgende beurt energie- én kaartslot
    rollPenalty: 0,        // getroffen door Stroomonderbreking: -N stappen op de eerstvolgende worp
    rank: 0,       // 0 = nog aan het spelen; 1..4 = binnengekomen op die plaats
    finishTurn: 0, // beurtnummer waarop deze speler binnenkwam
  }));
  const turnOrder = simShuffle([0, 1, 2, 3], rand);
  for (let s = 0; s < turnOrder.length; s++) players[turnOrder[s]].seat = s;
  // strategieën loten, zodat "welke actie wint" niet vervuild wordt door de startpositie
  const strategies = pickEnergyStrategies(rand);
  for (let i = 0; i < players.length; i++) players[i].strategy = strategies[i];
  const deck = buildActionDeck(rand);   // één gedeelde stapel voor het hele potje
  portalSetup(graph, rand);             // twee portalen liggen al bij de start (zie PORTALEN)
  const portalJumpsBy = [0, 0, 0, 0];   // portaalsprongen per speler, voor "meeste teleporteerder wint"

  const finishTarget = simFinishTarget(players.length);
  let finished = 0;
  let turnCount = 0;
  let halfway = null;   // stand (opdrachten per speler) halverwege, zie het eind van elke ronde

  while (turnCount < SIM_MAX_TURNS){
    const roundFinishers = [];   // spelers die deze ronde hun 6e opdracht voltooien
    let hitTurnCap = false;
    for (const pIdx of turnOrder){
      const player = players[pIdx];
      if (player.rank) continue;   // binnen: speelt niet meer mee en staat niemand in de weg
      turnCount++;
      player.ownTurns = (player.ownTurns || 0) + 1;   // per-beurt-keuzes van de bot (botPortalWanted)
      // Energie-acties en kaarten hebben ELK hun eigen actie-slot per beurt (max 1 van elk) —
      // vroeger deelden ze één gezamenlijk slot ("hooguit 1 actie per beurt, kaart of energie").
      // Drie kristallen zijn een GRATIS variant van een energie-actie (Stuwlading↔Stuwstoot:
      // allebei een 3e loopsteen; laarzen-kristal↔laarzen: één sprint; Portaalsleutel↔Portaalkanon:
      // één portaalschot) — die blijven elkaar binnen hún ene moment uitsluiten (kristal gaat voor,
      // is gratis), ook al staan ze op verschillende sloten.
      let energyActionUsed = false;   // hooguit 1 energie-actie per beurt
      let energyUsedId = null;        // welke energie-actie deze beurt (voor de statistiek)
      let cardActionUsed = false;     // hooguit 1 kaart spelen per beurt
      let actionCellCrossed = false;  // hooguit 1 beloningskaart per beurt via een actiekaartvakje
      // Vergrendeling: geraakt in een vorige beurt betekent dat je NU zowel je energie- als je
      // kaartslot mist. Beide sloten meteen op "gebruikt" zetten blokkeert vanzelf elke
      // `!energyActionUsed`/`!cardActionUsed`-check hieronder — geen aparte if-ketting nodig.
      if (player.lockedNextTurn){
        player.lockedNextTurn = false;
        energyActionUsed = true;
        cardActionUsed = true;
      }

      // 1. energiesteen rolt mee met de loopstenen (tenzij Kortsluiting die deze beurt blokkeert),
      //    maar telt pas AAN HET EIND van de beurt bij — wat je nu gooit, geef je pas volgende
      //    beurt uit (zie de tijdsregels bovenaan). `pendingEnergy` wordt na de zet bijgeschreven.
      //    Het niveau hieronder is dus precies wat deze speler deze beurt kan inzetten.
      let energyRoll = 0, pendingEnergy = 0;
      if (player.skipEnergyRoll){
        player.skipEnergyRoll = false;
      } else {
        energyRoll = simRollEnergy(rand);
        pendingEnergy = energyRoll;
        // Condensator die vorige beurt gespeeld is: deze steen telt dubbel. Rolt de speler deze
        // beurt helemaal niet (Kortsluiting), dan blijft de Condensator staan voor de
        // eerstvolgende beurt waarin hij wél gooit — er valt nu immers niets te verdubbelen.
        if (player.condenserPending){
          player.condenserPending = false;
          pendingEnergy += energyRoll;
        }
      }
      extra.energyRolled += pendingEnergy;
      extra.energyLevels[player.energy]++;

      // 1b. kaarten die bij de energiefase horen: Kortsluiting raakt de leider, Noodrantsoen
      //     vult aan, en de Condensator wordt klaargezet voor je VOLGENDE beurt.
      // Die laatste is dus een investering: je weet nog niet wat je dan gooit. Een bot zet 'm
      // in zodra er ruimte is om te groeien en er nog geen andere klaarstaat.
      if (!cardActionUsed && player.cards.includes('condenser') && !player.condenserPending && player.energy < ENERGY_MAX){
        player.condenserPending = true;
        useActionCard(player, 'condenser', deck, extra);
        cardActionUsed = true;
      }
      if (!cardActionUsed && player.cards.includes('short')){
        const victim = pickShortCircuitTarget(players, pIdx, rand);
        if (victim){
          victim.skipEnergyRoll = true;
          useActionCard(player, 'short', deck, extra);
          cardActionUsed = true;
        }
      }
      // Energielek: alleen als er bij een ander minstens 2 te halen valt en er bij jezelf ruimte is
      if (!cardActionUsed && player.cards.includes('leak') && player.energy < ENERGY_MAX){
        const victim = pickEnergyLeakTarget(players, pIdx, rand);
        if (victim && victim.energy >= ENERGY_LEAK_AMOUNT){
          applyEnergyLeak(player, victim);
          useActionCard(player, 'leak', deck, extra);
          cardActionUsed = true;
        }
      }
      // Dubbele steen (vóór de worp): een tweede energiesteen, telt net als de eerste pas na de zet
      if (!cardActionUsed && player.cards.includes('twin') && botWantsTwinEnergy(player, pendingEnergy)){
        const second = simRollEnergy(rand);
        pendingEnergy += second;
        extra.energyRolled += second;
        useActionCard(player, 'twin', deck, extra);
        cardActionUsed = true;
      }
      if (!cardActionUsed && player.cards.includes('ration') && player.energy < ENERGY_MAX){
        simGainEnergy(player, 3);
        useActionCard(player, 'ration', deck, extra);
        cardActionUsed = true;
      }

      // 1c. hinder-kaarten die een tegenstander raken zonder dat de eigen worp of het eigen doel
      //     verandert: Vergrendeling/Stroomonderbreking pakken de koploper (zelfde eerlijke
      //     heuristiek als Kortsluiting). Duwstoot staat verderop: die vereist een AANGRENZENDE tegenstander.
      if (!cardActionUsed && player.cards.includes('lockdown')){
        const victim = pickLeaderTarget(players, pIdx, p => p.lockedNextTurn, rand);
        if (victim){
          victim.lockedNextTurn = true;
          useActionCard(player, 'lockdown', deck, extra);
          cardActionUsed = true;
        }
      }
      if (!cardActionUsed && player.cards.includes('outage')){
        const victim = pickLeaderTarget(players, pIdx, p => p.rollPenalty > 0, rand);
        if (victim){
          victim.rollPenalty = 2;
          useActionCard(player, 'outage', deck, extra);
          cardActionUsed = true;
        }
      }
      // 2. doel bepalen: Herprioritering (betaald, energie) kan je doel wisselen
      let targetLabel = player.order[player.nextIdx];
      if (!cardActionUsed && player.cards.includes('shove')){
        const shove = pickShoveMove(graph, players, pIdx, rand);
        if (shove){
          shove.player.pos = shove.toKey;
          useActionCard(player, 'shove', deck, extra);
          cardActionUsed = true;
        }
      }
      // Herprioritering: betalen, volgende kaart bekijken, wisselen als die dichterbij ligt.
      // Je betaalt ook als wisselen niets oplevert (zie botWantsReorderPeek).
      if (!energyActionUsed && botStrategyNow(graph, player) === 'reorder' && player.energy >= ENERGY_ACTIONS.reorder.cost
          && botWantsReorderPeek(graph, player, player.pos)){
        player.energy -= ENERGY_ACTIONS.reorder.cost;
        player.actionUses++;
        energyActionUsed = true;
        energyUsedId = 'reorder';
        const swapped = energyReorderTarget(graph, player, player.pos);
        if (swapped !== null){
          // voor "Wat levert een energie-actie op?": hoeveel vakjes scheelt de wissel?
          const stamp = simBfsDistances(graph, player.pos);
          const st = extra.energyStats.reorder;
          st.swaps++;
          st.saved += simDistLookup(stamp, graph.questCells[targetLabel]) - simDistLookup(stamp, graph.questCells[swapped]);
          targetLabel = swapped;
        }
      }
      const targetKey = graph.questCells[targetLabel];
      // volledige rij nog te halen opdrachtvakjes, te beginnen bij het huidige doel — resolveMove
      // loopt na targets[0] door en toetst de resterende stappen meteen aan targets[1], enz.,
      // zodat je zelden maar soms wél een 2e opdracht in dezelfde beurt kunt pakken
      const targets = [];
      for (let i = player.nextIdx; i < player.order.length; i++) targets.push(graph.questCells[player.order[i]]);

      const occupied = new Set();
      for (let j = 0; j < 4; j++) if (j !== pIdx && simOnBoard(players[j])) occupied.add(players[j].pos);

      // 3. vóór de worp: Noodtransport of Zwaartekracht-laarzen (de energie-actie of de gratis
      //    kaart) — de keuze zit in botPreRollMove(), gedeeld met 96-walk.js en 97-solo.js. Een
      //    sprong die precies op je opdracht landt beëindigt je beurt; anders gooi je daarna
      //    gewoon vanaf je nieuwe plek, met de opdrachten die de verplaatsing nog niet pakte. Haalt
      //    een sprint je 6e opdracht, dan ben je binnen en valt er niets meer te gooien.
      let move, roll = 0, rollPenalty = 0;
      const pre = botPreRollMove(graph, player, occupied, targets, !energyActionUsed, !cardActionUsed);
      if (pre){
        if (pre.kind === 'bootsCard' || pre.kind === 'portalCard'){
          useActionCard(player, pre.kind === 'bootsCard' ? 'boots' : 'portalkey', deck, extra);
          cardActionUsed = true;
          if (pre.kind === 'portalCard'){
            const placed = portalPlace(graph, pre.shot.key, pre.shot.color, pIdx);
            if (extra.portal){ extra.portal.shots++; if (placed.stolen) extra.portal.steals++; }
          }
        } else {
          player.energy -= ENERGY_ACTIONS[pre.kind].cost;
          player.actionUses++;
          energyActionUsed = true;
          energyUsedId = pre.kind;
          const st = extra.energyStats[pre.kind];
          if (st){
            st.steps += pre.path.length - 1;
            if (pre.bankedCount) st.direct++;
          }
          if (pre.kind === 'portal'){
            const placed = portalPlace(graph, pre.shot.key, pre.shot.color, pIdx);
            if (extra.portal){ extra.portal.shots++; if (placed.stolen) extra.portal.steals++; }
          }
        }
      }
      const rollFrom = pre ? pre.key : player.pos;
      const rollTargets = pre ? targets.slice(pre.bankedCount) : targets;
      if (pre && (pre.endsTurn || player.completed + pre.bankedCount >= SIM_QUESTS_TO_WIN)){
        move = { key: pre.key, path: pre.path, stepsUsed: pre.path.length - 1, bankedCount: pre.bankedCount,
                 bankedQuest: pre.bankedCount > 0, wasBlocked: pre.wasBlocked, teleported: pre.kind === 'jump' };
      } else {
        // 4. de worp: loopstenen, met Stuwlading (kaart) of Stuwstoot (energie) als derde steen —
        //    die twee doen hetzelfde (een 3e loopsteen) en blijven via else-if elkaar uitsluiten.
        //    Stroomonderbreking trekt er ná alle stenen 2 stappen af (minimaal 1 blijft over).
        //    De losse stenen staan in `dieVals` (Zelf kiezen en Zonnezeil kijken per steen).
        const dieVals = [simRollD6(rand), simRollD6(rand)];
        if (!cardActionUsed && player.cards.includes('boostcell')){
          dieVals.push(simRollD6(rand));
          useActionCard(player, 'boostcell', deck, extra);
          cardActionUsed = true;
        } else if (!energyActionUsed && botStrategyNow(graph, player) === 'boost' && player.energy >= ENERGY_ACTIONS.boost.cost){
          const extraDie = simRollD6(rand);
          dieVals.push(extraDie);
          player.energy -= ENERGY_ACTIONS.boost.cost;
          player.actionUses++;
          energyActionUsed = true;
          energyUsedId = 'boost';
          extra.energyStats.boost.steps += extraDie;
        }
        const dice = dieVals.length;
        roll = dieVals.reduce((a, b) => a + b, 0);
        if (player.rollPenalty){
          rollPenalty = player.rollPenalty;
          roll = Math.max(1, roll - rollPenalty);
          player.rollPenalty = 0;
        }
        move = resolveMove(graph, rollFrom, roll, occupied, rollTargets, rand);
        // Zelf kiezen: één steen een andere waarde geven als dat een opdracht of duidelijk winst oplevert
        if (!move.bankedQuest && !cardActionUsed && player.cards.includes('pick')){
          const pk = botPickDieValue(graph, rollFrom, dieVals, rollPenalty, occupied, rollTargets, rand, move);
          if (pk){
            dieVals[pk.idx] = pk.value;
            roll = pk.roll;
            move = pk.move;
            useActionCard(player, 'pick', deck, extra);
            cardActionUsed = true;
          }
        }
        // Koerscorrectie: een tegenvallende worp overdoen. Alleen zinvol als deze worp de
        // opdracht niet al pakt, en alleen onder de verwachtingswaarde (3,5 per steen) — dan
        // is opnieuw gooien in verwachting winst. De nieuwe worp telt, ook als die slechter is.
        // Een Stroomonderbreking geldt ook voor de nieuwe worp — anders wiste Koerscorrectie
        // die straf stilletjes uit.
        if (!move.bankedQuest && !cardActionUsed && player.cards.includes('reroll') && roll < dice * 3.5){
          for (let d = 0; d < dice; d++) dieVals[d] = simRollD6(rand);
          roll = dieVals.reduce((a, b) => a + b, 0);
          if (rollPenalty) roll = Math.max(1, roll - rollPenalty);
          useActionCard(player, 'reroll', deck, extra);
          cardActionUsed = true;
          move = resolveMove(graph, rollFrom, roll, occupied, rollTargets, rand);
        }
        // Zonnezeil (direct na de worp): energie gelijk aan de laagste steen, als er ruimte is
        if (!cardActionUsed && player.cards.includes('solar') && player.energy + pendingEnergy < ENERGY_MAX){
          extra.energyWasted += simGainEnergy(player, solarGain(dieVals)).wasted;
          useActionCard(player, 'solar', deck, extra);
          cardActionUsed = true;
        }
        // 5. Blinde Vlek (kaart) lost een blokkade op door de worp opnieuw uit te rekenen vanaf
        //    dezelfde plek, door tegenstanders heen (maar er niet op eindigen) — levert dat geen
        //    enkel vrij eindvakje op, dan geeft resolveMove null terug en blijft de gewone,
        //    geblokkeerde zet staan.
        if (!move.bankedQuest && !cardActionUsed && player.cards.includes('blind') && move.wasBlocked){
          const retry = resolveMove(graph, rollFrom, roll, SIM_EMPTY_SET, rollTargets, rand, occupied);
          if (retry && retry.key !== move.key){
            move = retry;
            useActionCard(player, 'blind', deck, extra);
            cardActionUsed = true;
          }
        }
        move = mergePreRollMove(pre, move);
      }
      // de energiesteen van deze beurt telt nu pas bij (zie stap 1): volgende beurt uit te geven
      if (pendingEnergy) extra.energyWasted += simGainEnergy(player, pendingEnergy).wasted;

      player.pos = move.key;
      player.turnsOnTarget++;
      extra.totalTurns++;
      if (move.wasBlocked) extra.blockedTurns++;
      for (let p = 1; p < move.path.length; p++) heatmap[move.path[p]]++;
      if (pathHasActionCell(graph, move.path)) actionCellCrossed = true;
      // "Wat levert een energie-actie op?": haalde deze beurt een opdracht, mét of zonder actie
      // portalen: sprongen tellen, en wie er gebruik van maakt (eigen portaal of dat van een ander)
      if (extra.portal){
        const jumps = pathPortalJumps(graph, move.path);
        extra.portal.quests += move.bankedCount;
        if (jumps){
          const P = graph.portals, own = P.owner[0] === pIdx || P.owner[1] === pIdx;
          extra.portal.jumps += jumps;
          if (!own) extra.portal.jumpsOther += jumps;
          extra.portal.jumpQuests += move.bankedCount;
          portalJumpsBy[pIdx] += jumps;
        }
      }
      if (energyUsedId){
        const st = extra.energyStats[energyUsedId];
        if (st){
          st.uses++;
          if (move.bankedQuest) st.banked++;
        }
      } else {
        extra.noEnergyTurns++;
        if (move.bankedQuest) extra.noEnergyBanked++;
      }

      // actiekaartvakje (gang): levert een kaart op net als een opdracht, maar onderbreekt de
      // zet niet en levert hooguit 1x per beurt op, ook als je onderweg meerdere van deze
      // vakjes passeerde.
      if (actionCellCrossed){
        const reward = drawActionCellReward(player, deck, rand);
        if (reward.drawn) extra.actionCellDraws++;
        else if (reward.handFull) extra.handFullOnActionCell++;
      }

      // meestal 0 of 1 opdracht; zelden 2 (de resterende stappen na de 1e voerden toevallig
      // ook door de 2e) — zie resolveMove. Elke gebankte opdracht krijgt zijn eigen boekhouding
      // (stats, kaarttrekking, winst-check), in de volgorde waarin ze onderweg geraakt zijn.
      for (let b = 0; b < move.bankedCount; b++){
        const label = player.order[player.nextIdx];
        const qs = questStats[label];
        qs.turns += player.turnsOnTarget;
        qs.count++;
        // "Pech-reeksen": hoeveel beurten zat deze speler achter deze opdracht aan? (0 = een 2e
        // opdracht in dezelfde beurt, die telt hier niet als zoektocht)
        if (player.turnsOnTarget > 0){
          extra.searchHist[Math.min(player.turnsOnTarget, SIM_SEARCH_HIST_MAX)]++;
          if (player.turnsOnTarget > player.longestSearch) player.longestSearch = player.turnsOnTarget;
          if (player.turnsOnTarget > extra.longestSearch) extra.longestSearch = player.turnsOnTarget;
        }
        player.completed++;
        player.nextIdx++;
        player.turnsOnTarget = 0;
        // beloning: een kaart trekken, als de hand niet al vol is
        if (player.cards.length < ACTION_CARD_HAND_MAX){
          const drawn = drawActionCard(deck, rand);
          if (drawn){ player.cards.push(drawn); extra.cardDraws++; }
        } else {
          extra.handFullOnBank++;
        }
        // rank wordt NIET meteen toegekend — pas ná deze hele ronde (zie resolveRoundFinishers
        // hierboven), zodat wie later in de beurtvolgorde zit deze ronde nog evenveel kans krijgt
        if (player.completed >= SIM_QUESTS_TO_WIN){
          player.finishTurn = turnCount;
          roundFinishers.push(player);
          break; // binnen: een eventuele 2e bank in dezelfde beurt doet er niet meer toe
        }
      }
      if (turnCount >= SIM_MAX_TURNS){ hitTurnCap = true; break; }
    }

    // "Kan de achterste nog terugkomen?": de stand aan het eind van de ronde waarin de eerste
    // speler zijn 3e opdracht haalt (= halverwege) — aan het eind van het potje vergeleken met
    // wie er won
    if (!halfway && players.some(p => p.completed >= SIM_QUESTS_TO_WIN / 2)) halfway = players.map(p => p.completed);

    if (roundFinishers.length){
      if (finished === 0){
        // spanning meten bij de EERSTE keer dat iemand deze potje binnenkomt, over de spelers
        // die deze ronde niet ook al finishten
        let runnerUp = 0;
        for (const p of players) if (!roundFinishers.includes(p)) runnerUp = Math.max(runnerUp, p.completed);
        const gap = SIM_QUESTS_TO_WIN - runnerUp;
        extra.winGapSum += gap;
        extra.winGapCount++;
        if (gap === 1) extra.nailBiters++;
      }
      resolveRoundFinishers(roundFinishers, finished);
      finished += roundFinishers.length;
      if (finished >= finishTarget){
        // de achterblijver(s) hebben verloren zonder dat ze nog iets kunnen doen
        for (const p of players) if (!p.rank) p.rank = finished + 1;
        recordGameEndStats(players, halfway, extra);
        // "meeste teleporteerder wint": alleen potjes met één duidelijke koploper in sprongen
        if (extra.portal){
          const most = Math.max(...portalJumpsBy);
          const top = players.filter(p => portalJumpsBy[p.idx] === most);
          if (most > 0 && top.length === 1){
            extra.portal.topGames++;
            extra.portal.topWins += rankOverlapFraction(top[0].rank, top[0].rankShare || 1, 1);
          }
        }
        return { stuck: false, turns: turnCount, players };
      }
    }
    if (hitTurnCap) return { stuck: true, turns: turnCount, players };
  }
  return { stuck: true, turns: turnCount, players };
}

// ---------- UI ----------
const simCountEl = document.getElementById('simCount');
const simStatusEl = document.getElementById('simStatus');
const simResultsEl = document.getElementById('simResults');
const btnSimulate = document.getElementById('btnSimulate');
// ---------- rolteller "Aantal potjes" (gekozen ontwerp B, zie index.html) ----------
// #simCount (verborgen) is de bron; dit tekent 5 rolcijfers die naar hun cijfer schuiven
// (transform, geen herberekening van de opmaak), voorloopnullen gedimd. −100/+100: klik = 100,
// ingedrukt houden telt steeds sneller door (na 12 stappen per 500). Pijltjestoetsen op de teller
// werken ook. Snelkeuzes zetten het getal in één keer.
const SIM_COUNT_MIN = 100, SIM_COUNT_MAX = 20000, SIM_COUNT_STEP = 100;
const SIM_COUNT_DIGITS = 5;
const SIM_COUNT_PRESETS = [500, 1000, 2000, 5000, 10000];
const simDigitsEl = document.getElementById('simDigits');
const simPresetsEl = document.getElementById('simPresets');
function simCountClamp(n){
  if (!Number.isFinite(n)) n = 2000;
  return Math.max(SIM_COUNT_MIN, Math.min(SIM_COUNT_MAX, Math.round(n / SIM_COUNT_STEP) * SIM_COUNT_STEP));
}
if (simDigitsEl){
  simDigitsEl.innerHTML = Array.from({ length: SIM_COUNT_DIGITS }, () =>
    `<span class="sim-digit"><span class="sim-reel">${'0123456789'.split('').map(d => `<i>${d}</i>`).join('')}</span></span>`
  ).join('');
}
function simCounterRender(){
  if (!simCountEl || !simDigitsEl) return;
  const n = simCountClamp(parseInt(simCountEl.value, 10));
  const s = String(n).padStart(SIM_COUNT_DIGITS, '0');
  const lead = SIM_COUNT_DIGITS - String(n).length;
  [...simDigitsEl.children].forEach((d, i) => {
    d.classList.toggle('is-lead', i < lead);
    // één cijfer = 10% van de rol omhoog
    d.firstChild.style.transform = `translateY(${-10 * Number(s[i])}%)`;
  });
  simDigitsEl.setAttribute('aria-valuenow', String(n));
  simDigitsEl.setAttribute('aria-valuetext', `${n.toLocaleString('nl-NL')} potjes`);
  if (simPresetsEl){
    simPresetsEl.innerHTML = SIM_COUNT_PRESETS.map(p =>
      `<button type="button" class="sim-preset${p === n ? ' is-on' : ''}" data-sim-preset="${p}">${p.toLocaleString('nl-NL')}</button>`
    ).join('');
  }
}
function simCountSet(n){
  if (!simCountEl) return;
  simCountEl.value = String(simCountClamp(n));
  simCounterRender();
}
function simCountStep(dir, size = SIM_COUNT_STEP){
  simCountSet(parseInt(simCountEl.value, 10) + dir * size);
}
{
  let holdTimer = null;
  const stopHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  for (const btn of document.querySelectorAll('[data-sim-step]')){
    const dir = Number(btn.dataset.simStep);
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      simCountStep(dir);
      let delay = 380, n = 0;
      const tick = () => {
        n++;
        simCountStep(dir, n > 12 ? 5 * SIM_COUNT_STEP : SIM_COUNT_STEP);
        delay = Math.max(45, delay * 0.8);
        holdTimer = setTimeout(tick, delay);
      };
      holdTimer = setTimeout(tick, delay);
    });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, stopHold);
    // toetsenbord (Enter/spatie op de knop): de click zonder pointerdown ervoor
    btn.addEventListener('click', (e) => { if (e.detail === 0) simCountStep(dir); });
  }
  if (simDigitsEl) simDigitsEl.addEventListener('keydown', (e) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (dir){ e.preventDefault(); simCountStep(dir); }
  });
  if (simPresetsEl) simPresetsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sim-preset]');
    if (b) simCountSet(Number(b.dataset.simPreset));
  });
  simCounterRender();
}
// ---------- "Datastroom" in het simulatievak (gekozen variant 3 uit 8, 2026-10) ----------
// Kolommen cijfers regenen naar beneden; een deel ervan "landt" en stapelt zich op tot een
// staafdiagram dat vol is als de simulatie klaar is (hoeveel er al liggen = de voortgang). De vorm
// is elke keer anders en zegt niets over de uitslag: het is sfeer. Alles beweegt via Web Animations
// en transitions op transform/opacity, zodat de browser het afspeelt terwijl runSimulationBatch in
// brokken van 30 ms rekent (zie het blok in styles.css). Opmeten gebeurt één keer, bij de start.
const SIM_STREAM_CELL = 16;       // = de 16px in .sim-stream/.sim-stack/.sim-drop (styles.css)
const SIM_STREAM_DONE_MS = 700;   // na het laatste brok: het volle diagram nog even in beeld
const simStream = (() => {
  const root = document.getElementById('simStream');
  if (!root) return null;
  const GL = '0123456789ABCDEF', C = SIM_STREAM_CELL, TRAIL = 7;
  let cols = 0, rows = 0, H = 0, tgt = [], bars = [], pend = [], barEls = [];
  let total = 0, landed = 0, inflight = 0, rainTimer = null, run = 0, done = false;
  const glyph = () => GL[Math.floor(Math.random() * GL.length)];
  // kleur per plek in de kolom: bovenste cijfer bijna wit, naar onder via blauw naar paars
  const RAMP = [[234, 249, 255], [143, 224, 255], [79, 184, 224], [124, 92, 255]];
  function color(t){
    const x = Math.min(.999, t) * (RAMP.length - 1), i = Math.floor(x), f = x - i;
    const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
    return `rgba(${c[0]},${c[1]},${c[2]},${(.95 - t * .45).toFixed(2)})`;
  }
  // een staaf is een vaste kolom cijfers die omhoog schuift: bars[c] cijfers in beeld
  function setBar(c){ barEls[c].style.transform = `translateY(${((rows - bars[c]) / rows * 100).toFixed(3)}%)`; }
  function drop(c, land){
    // vak niet zichtbaar bij de start (bv. ander tabblad): dan geen regen, anders deelt de
    // snelheid door 0 en weigert animate() de duur (gooide de hele simulatie om)
    if (!H || !cols) return;
    const el = document.createElement('span');
    el.className = 'sim-drop';
    el.textContent = Array.from({ length: TRAIL }, glyph).join('\n');
    root.appendChild(el);
    const x = c * C, y0 = -TRAIL * C - Math.random() * H * 0.3;
    let y1;
    if (land){ y1 = H - (bars[c] + pend[c]) * C - TRAIL * C; pend[c]++; inflight++; }
    else y1 = H * (0.25 + Math.random() * 0.35) - TRAIL * C;
    const speed = (land ? 0.35 + Math.random() * 0.35 : 0.25 + Math.random() * 0.3) * H / 1000;   // px per ms
    const at = (y, o) => ({ transform: `translate(${x}px, ${y.toFixed(1)}px)`, opacity: o });
    const kf = land ? [at(y0, 1), at(y1, 1)] : [at(y0, 1), { ...at(y0 + (y1 - y0) * 0.7, 1), offset: 0.7 }, at(y1, 0)];
    const me = run;
    el.animate(kf, { duration: Math.max(300, (y1 - y0) / speed), easing: 'linear' }).onfinish = () => {
      el.remove();
      if (!land || me !== run) return;
      pend[c]--; inflight--;
      if (!done){ bars[c]++; landed++; setBar(c); }
    };
  }
  function clearDrops(){ root.querySelectorAll('.sim-drop').forEach(el => el.remove()); }

  function start(){
    stop();
    run++; done = false; landed = 0; inflight = 0;
    clearDrops();
    H = root.clientHeight;
    cols = Math.max(1, Math.floor(root.clientWidth / C));
    rows = Math.max(4, Math.min(15, Math.floor(H / C) - 1));
    const ph = Math.random() * 6;
    tgt = Array.from({ length: cols }, (_, i) => Math.max(1, Math.round(Math.min(1, Math.max(0.08,
      0.35 + 0.3 * Math.sin(i * 0.28 + ph) + 0.25 * Math.sin(i * 0.11 - ph * 0.7) + (Math.random() - 0.5) * 0.12)) * rows)));
    total = tgt.reduce((a, b) => a + b, 0);
    bars = new Array(cols).fill(0); pend = new Array(cols).fill(0);
    let html = '';
    for (let c = 0; c < cols; c++){
      let cells = '';
      for (let k = 0; k < rows; k++) cells += `<b style="color:${color(k / (rows - 1))}">${glyph()}</b>`;
      html += `<div class="sim-stack" style="left:${c * C}px;height:${rows * C}px"><i style="transform:translateY(100%)">${cells}</i></div>`;
    }
    root.innerHTML = html;
    barEls = [...root.querySelectorAll('.sim-stack > i')];
    // sfeerregen die niet landt (vervaagt halverwege)
    rainTimer = setInterval(() => { if (root.childElementCount < cols + 30) drop(Math.floor(Math.random() * cols), false); }, 140);
  }
  // frac = gedaan/totaal; er vallen zoveel landers dat het diagram precies meegroeit
  function progress(frac){
    if (done || !cols) return;
    const need = Math.round(frac * total) - landed - inflight;
    for (let n = 0; n < Math.min(need, 8); n++){
      const open = [];
      for (let c = 0; c < cols; c++) if (bars[c] + pend[c] < tgt[c]) open.push(c);
      if (!open.length) break;
      drop(open[Math.floor(Math.random() * open.length)], true);
    }
  }
  function complete(){
    done = true;
    for (let c = 0; c < cols; c++){ bars[c] = tgt[c]; setBar(c); }
  }
  // pas na het uitfaden de vallende cijfers weghalen (anders verdwijnen ze zichtbaar)
  function stop(){
    clearInterval(rainTimer); rainTimer = null;
    const me = run;
    setTimeout(() => { if (me === run) clearDrops(); }, GEN_FADE_MS);
  }
  return { start, progress, complete, stop };
})();

// "Aan het simuleren"-vakje: de datastroom hierboven + aftellende tijd (createProgressLoader in
// 80-controls.js); vervangt de oude voortgangsbalk en later de ring met radar (gebruikerswens)
const simStageEl = document.getElementById('simStage');
const simLoaderEl = document.getElementById('simLoader');
const simLoaderCountEl = document.getElementById('simLoaderCount');
const simLoader = simLoaderEl ? createProgressLoader(simLoaderEl) : null;
function showSimLoader(){
  if (!simLoader) return;
  clearTimeout(simHoldTimer);
  simStageEl.classList.remove('is-holding');
  simStageEl.classList.add('is-running');
  simLoader.start();
  if (simStream) simStream.start();   // na is-running: dan heeft het vak zijn maat
}
let simHoldTimer = null;
function hideSimLoader(){
  if (!simLoader || !simStageEl.classList.contains('is-running')) return;
  // de ruimte nog even vasthouden tot het vakje helemaal uitgefaded is (anders klapt het vak
  // dicht terwijl het vakje nog half zichtbaar over de rand hangt, bv. na "Stoppen")
  simStageEl.classList.add('is-holding');
  simStageEl.classList.remove('is-running');
  simLoader.stop();
  if (simStream) simStream.stop();
  clearTimeout(simHoldTimer);
  simHoldTimer = setTimeout(() => simStageEl.classList.remove('is-holding'), GEN_FADE_MS);
}
let simRunning = false;   // voorkomt twee overlappende potjes-reeksen bij dubbelklikken
let simRunId = 0;         // verhoogd bij elke nieuwe run/bordwijziging; een verouderde
                           // in-brokken-lopende run herkent hieraan dat hij moet stoppen
let simDone = 0, simTotal = 0;   // voortgang van de lopende run, voor de melding na "Stoppen"

// knop "Stoppen" onder de voortgangsbalk (gebruikerswens): zelfde mechanisme als een
// bordwijziging — simRunId verhogen, dan stopt de lopende run bij zijn volgende brok vanzelf
function stopSimulation(){
  if (!simRunning) return;
  simRunId++;
  simRunning = false;
  hideSimLoader();
  if (btnSimulate) btnSimulate.disabled = false;
  simResultsEl.innerHTML = '';
  simStatusEl.innerHTML = `<span class="sub sim-stopped">Simulatie gestopt na ${simDone.toLocaleString('nl-NL')} van ${simTotal.toLocaleString('nl-NL')} potjes.</span>`;
}
{
  const btnSimStop = document.getElementById('btnSimStop');
  if (btnSimStop) btnSimStop.addEventListener('click', stopSimulation);
}

// wordt aangeroepen door alles wat de indeling wijzigt (genereren, herstellen,
// slepen, draaien, tegel-editor) — de cijfers horen bij een specifieke indeling en
// worden ongeldig zodra die verandert. Tabwisselingen raken dit niet aan (die
// laten de tab-inhoud gewoon in de DOM staan).
function clearSimResults(){
  // een lopende stap-voor-stap-pion hoort niet op een bord dat onder hem vandaan verandert
  stopWalkSimulation();
  stopSoloGame();
  // de batch-simulatie rekent nu in brokken (zie runSimulationBatch), dus loopt niet meer
  // per se blokkerend af vóórdat de gebruiker iets anders kan aanklikken — een lopende reeks
  // potjes voor de OUDE indeling mag straks niet alsnog deze melding overschrijven
  simRunId++;
  hideSimLoader();
  simRunning = false;
  if (btnSimulate) btnSimulate.disabled = false;
  // zelfde verhaal voor een lopende bord-generatie (zie applyGeneratedLayout in 80-controls.js):
  // die rekent ook in brokken, dus een tegel slepen/draaien terwijl er nog gegenereerd wordt
  // moet de balk/knoppen direct resetten — de simRunId-check daar zorgt dat het resultaat van
  // die verouderde run straks ook niet meer wordt toegepast.
  if (typeof hideGenProgress === 'function') hideGenProgress();
  if (!simResultsEl) return;
  simResultsEl.innerHTML = '';
  // Alleen als er al eens een simulatie is gedraaid zijn er "oude" cijfers om voor te waarschuwen
  // — niet bij het openen of het eerste genereren (gebruikersmelding: stond er meteen al).
  // Gecentreerd onder de knop, net als de rest van dat vak.
  simStatusEl.innerHTML = simHasRun
    ? `<span class="sub sim-stopped">Indeling gewijzigd — draai de simulatie opnieuw voor cijfers die bij dit bord horen.</span>`
    : '';
}
// var (geen let): clearSimResults kan al lopen voordat deze regel geladen is
var simHasRun = false;   // wordt true zodra er een uitslag is getoond (renderSimResults)

// 95%-foutmarge (in procentpunten) op een winpercentage uit `wins` van `n` potjes.
function simMarginOfError(wins, n){
  if (!n) return 0;
  const p = wins / n;
  return 1.96 * Math.sqrt(p * (1 - p) / n) * 100;
}

function renderHistogram(gameLengths){
  if (!gameLengths.length) return '';
  const min = Math.min(...gameLengths), max = Math.max(...gameLengths);
  const binCount = Math.min(SIM_HISTOGRAM_BINS, Math.max(1, max - min + 1));
  const binWidth = Math.max(1, (max - min + 1) / binCount);
  const counts = new Array(binCount).fill(0);
  for (const v of gameLengths){
    const bin = Math.min(binCount - 1, Math.floor((v - min) / binWidth));
    counts[bin]++;
  }
  const maxCount = Math.max(...counts);
  const bars = counts.map((c, i) => {
    const lo = Math.round(min + i * binWidth), hi = Math.round(min + (i + 1) * binWidth - 1);
    const h = maxCount ? Math.round((c / maxCount) * 100) : 0;
    const label = i === 0 || i === binCount - 1 || i === Math.floor(binCount / 2) ? `<span class="sim-hist-tick">${lo}</span>` : '';
    return `<div class="sim-hist-bar-wrap" title="${lo}–${hi} beurten: ${c} potjes"><div class="sim-hist-bar" style="height:${h}%"></div>${label}</div>`;
  }).join('');
  return `<div class="sim-hist">${bars}</div>`;
}

// sequentiële amber-verloopkleur (één kleur, licht->donker/fel naar bezoekfrequentie) —
// vlakken zonder bezoek blijven dicht bij het paneel, vlakken buiten het bord blijven
// het bestaande "onbenutte sjabloonplek"-donker.
function heatColor(t){
  const c0 = [26, 33, 42], c1 = [255, 181, 69];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// afstand tot de dichtstbijzijnde opdracht per cel, op de HUIDIGE (mogelijk gedraaide) indeling
// — multi-bron BFS vanaf alle opdrachtvakjes tegelijk, zelfde idee als questCoverageScore in
// 70-generator.js maar dan op de getoonde graph i.p.v. de ongedraaide generator-kandidaat.
function computeQuestDistances(graph){
  const dist = new Int32Array(graph.N).fill(-1);
  const queue = [];
  for (const k of Object.values(graph.questCells)){ dist[k] = 0; queue.push(k); }
  let qi = 0;
  while (qi < queue.length){
    const ck = queue[qi++];
    const d = dist[ck];
    const neigh = graph.adjKey[ck];
    for (let j = 0; j < neigh.length; j++){
      const nk = neigh[j];
      if (dist[nk] !== -1) continue;
      dist[nk] = d + 1;
      queue.push(nk);
    }
  }
  return dist;
}

// Elke sectie van de uitslag is een <details>. De conclusie bovenaan blijft altijd staan; het
// bewijsmateriaal eronder staat standaard open (klap je zelf in als je het niet wilt zien) —
// zonder <details> was de uitslag ~3900px aan tabellen achter elkaar, allemaal even zwaar
// opgemaakt, dus blijft het wel indeelbaar per sectie.
// De kaarten staan in vaste kolommen (.sim-col): 3 op een breed scherm, 2 op een laptop, 1 op een
// telefoon (kolom minstens 420px). Vroeger deed CSS `columns` dat, maar die verdeelt bij elk
// in-/uitklappen alles opnieuw en dan sprong een kaart van links naar het midden
// (gebruikersmelding). Nu verdelen we één keer, op de UITGEKLAPTE hoogtes, en blijft dat zo tot
// het aantal kolommen verandert (venster smaller/breder). Verdeling zoals krantenkolommen: op
// volgorde van boven naar beneden, links eerst, met de hoogste kolom zo laag mogelijk.
const SIM_COL_MIN_W = 420, SIM_COL_GAP = 14;
function layoutSimSections(){
  const wrap = simResultsEl && simResultsEl.querySelector('.sim-sections');
  if (!wrap || !wrap.offsetWidth) return;   // onzichtbaar tabblad: bij terugkeer opnieuw
  const W = wrap.clientWidth;
  const n = Math.max(1, Math.min(3, Math.floor((W + SIM_COL_GAP) / (SIM_COL_MIN_W + SIM_COL_GAP))));
  if (+wrap.dataset.cols === n) return;
  const sections = [...wrap.querySelectorAll('details.sim-section')];
  sections.forEach((d, i) => { if (d.dataset.idx === undefined) d.dataset.idx = i; });
  sections.sort((a, b) => a.dataset.idx - b.dataset.idx);
  // kolommen opbouwen; alles eerst in kolom 1 (zelfde breedte als de rest) om te meten
  const cols = Array.from({ length: n }, () => {
    const c = document.createElement('div'); c.className = 'sim-col'; return c;
  });
  wrap.replaceChildren(...cols);
  const wasOpen = sections.map(d => d.open);
  sections.forEach(d => { d.open = true; cols[0].appendChild(d); });
  const h = sections.map(d => d.offsetHeight + SIM_COL_GAP);
  sections.forEach((d, i) => { d.open = wasOpen[i]; });
  // beste opsplitsing in n aaneengesloten stukken (max. 3 kolommen, ~12 kaarten: gewoon alles proberen)
  const k = sections.length;
  const pre = [0]; for (const x of h) pre.push(pre[pre.length - 1] + x);
  const sum = (a, b) => pre[b] - pre[a];
  let best = { score: Infinity, cuts: [] };
  if (n === 1) best.cuts = [];
  else if (n === 2){
    for (let a = 1; a < k; a++){
      const s = Math.max(sum(0, a), sum(a, k));
      if (s < best.score) best = { score: s, cuts: [a] };
    }
  } else {
    for (let a = 1; a < k - 1; a++) for (let b = a + 1; b < k; b++){
      const s = Math.max(sum(0, a), sum(a, b), sum(b, k));
      if (s < best.score) best = { score: s, cuts: [a, b] };
    }
  }
  const bounds = [0, ...best.cuts, k];
  for (let c = 0; c < n; c++){
    for (let i = bounds[c]; i < bounds[c + 1]; i++) cols[c].appendChild(sections[i]);
  }
  wrap.dataset.cols = n;
}
{
  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(layoutSimSections, 150); });
}

let simSectionOpened = false;
function simSectionOpen(title){
  const close = simSectionOpened ? '</div></details>' : '';
  simSectionOpened = true;
  return `${close}<details class="sim-section" open><summary class="sim-subhead">${title}</summary><div class="sim-section-body">`;
}
function simSectionCloseAll(){
  const close = simSectionOpened ? '</div></details>' : '';
  simSectionOpened = false;
  return close;
}

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

function renderColdZones(graph, heatmap){
  const rows = coldZoneRows(graph, heatmap);
  const tableRows = rows.slice(0, 5).map(r => {
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

  simSectionOpened = false;
  // geen regel "N potjes gesimuleerd op indeling …" meer (gebruikerswens); alleen als er potjes
  // vastliepen een korte uitleg dat die niet meetellen
  let html = stuckCount
    ? `<p class="hint"><span style="color:var(--danger)">${stuckCount} vastgelopen</span> (afgekapt na ${SIM_MAX_TURNS} beurten, niet meegeteld in de percentages).</p>`
    : '';

  // De twaalf secties hieronder zijn het bewijsmateriaal; deze vier vakjes beantwoorden de
  // vraag waar je de simulatie eigenlijk voor draait — is dit bord goed genoeg om te spelen?
  const coldest = coldZoneRows(graph, heatmap)[0];
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
    verdictItem(coldest && coldest.share > 0 ? 'ok' : 'bad',
      'Dode tegels',
      coldest && coldest.share > 0 ? 'geen' : 'ja',
      coldest
        ? `stilste tegel: ${letterForSlot(coldest.slotIdx)} — ${ROOM_NAMES[coldest.tid] || ('Gang ' + coldest.tid)} met ${nl(coldest.share, 1)}% van het verkeer`
        : '—') +
    verdictItem('ok', 'Speelduur', `${Math.round(avg)} beurten`,
      `alle spelers samen — ${nl(avg / SIM_START_LABELS.length, 1)} beurten per speler · mediaan ${median} · min ${min} · max ${max}`) +
    `</div>`;

  html += `<div class="sim-expand-row"><button type="button" class="small ghost" id="btnSimExpand" aria-expanded="true">Alle details inklappen</button></div>`;
  // alle secties hieronder als kaarten in kolommen (zie .sim-sections in styles.css)
  html += `<div class="sim-sections">`;

  html += simSectionOpen('Eerlijkheid per startpositie');
  html += `<table class="sim-table"><thead><tr><th>Startpositie</th><th>Winst% (±95%-marge)</th><th>Gem. beurten tot winst</th></tr></thead><tbody>${rows}</tbody></table>`;
  html += `<p class="hint">Balans: ${verdict} (spreiding <b>${nl(spread, 1)}</b> procentpunt, gem. foutmarge ±<b>${nl(avgMoe, 1)}</b>).</p>`;

  // Nu er wordt doorgespeeld tot de nummer 3 binnen is, ligt van elk potje de hele
  // klassering vast. Alleen naar winst kijken verbergt een startpositie die zelden wint
  // maar wel structureel derde of vierde wordt.
  const rankRows = SIM_START_LABELS.map(lbl => {
    const counts = startRanks[lbl];
    const total = counts.reduce((a, b) => a + b, 0);
    const cells = counts.map(c => `<td class="num">${total ? nl((c / total * 100), 1) : '0,0'}%</td>`).join('');
    const avgRank = total ? counts.reduce((s, c, i) => s + c * (i + 1), 0) / total : 0;
    return `<tr><td>${lbl}</td>${cells}<td class="num">${nl(avgRank, 2)}</td></tr>`;
  }).join('');
  html += simSectionOpen('Eindklassering per startpositie');
  html += `<table class="sim-table"><thead><tr><th>Startpositie</th><th>1e</th><th>2e</th><th>3e</th><th>4e</th><th>Gem. plaats</th></tr></thead><tbody>${rankRows}</tbody></table>`;
  html += `<p class="hint">Er wordt doorgespeeld tot de <b>nummer 3</b> binnen is; de laatste speler is dan automatisch vierde. Bij een eerlijk bord ligt elke kolom rond de 25% en de gemiddelde plaats rond de 2,50.</p>`;

  html += simSectionOpen('Eerlijkheid per beurtvolgorde');
  html += `<table class="sim-table"><thead><tr><th>Beurtvolgorde</th><th>Winst%</th></tr></thead><tbody>${seatRows}</tbody></table>`;

  html += simSectionOpen('Eerlijkheid per opdrachtvakje');
  html += `<table class="sim-table"><thead><tr><th>Opdracht</th><th>Gem. beurten om te bereiken</th><th>Keer bereikt</th></tr></thead><tbody>${questRows}</tbody></table>`;
  html += `<p class="hint">Hoe hoger het gemiddelde, hoe afgelegener dat opdrachtvakje ligt vanaf waar spelers 'm meestal moeten benaderen.</p>`;

  html += simSectionOpen('Speelduur');
  // `gameLengths` telt de beurten van ALLE spelers bij elkaar op — dat is de lengte van het
  // potje, niet wat één speler doet. De beurten gaan om de beurt rond, dus delen door het
  // aantal spelers geeft precies hoeveel keer jij aan de beurt komt (hooguit één beurt
  // verschil tussen de eerste en de laatste in de volgorde).
  const spelers = SIM_START_LABELS.length;
  // mediaan/min/max zijn hele beurten; alleen het gemiddelde heeft een decimaal nodig
  const duurRij = (label, totaal) =>
    `<tr><td>${label}</td><td class="num">${nl(totaal, Number.isInteger(totaal) ? 0 : 1)}</td><td class="num">${nl(totaal / spelers, 1)}</td></tr>`;
  html += `<p class="hint">Van de eerste worp tot de nummer 3 binnen is. De linkerkolom is het hele potje, de rechter hoe vaak één speler aan de beurt komt (${spelers} spelers, om de beurt).</p>`;
  html += `<table class="sim-table"><thead><tr><th>Speelduur</th><th>Beurten totaal</th><th>Per speler</th></tr></thead><tbody>` +
    duurRij('Gemiddeld', avg) +
    duurRij('Mediaan', median) +
    duurRij('Kortste potje', min) +
    duurRij('Langste potje', max) +
    `</tbody></table>`;
  html += renderHistogram(gameLengths);

  html += simSectionOpen('Spanning en blokkeren');
  html += `<p class="hint">De nummer 2 stond bij winst gemiddeld <b>${nl(avgGap, 1)}</b> opdracht(en) achter — <b>${nl(nailBiterPct, 0)}%</b> van de potjes werd met precies 1 opdracht verschil beslist. In <b>${nl(blockedPct, 1)}%</b> van de beurten kwam een speler ergens in zijn zoektocht naar de beste route een bezet vakje tegen (niet per se de uiteindelijk gekozen route).</p>`;

  // percentage met een klein balkje erachter (schaal: `max` = volle breedte)
  const barCell = (pct, max) =>
    `<td class="num sim-bar-cell"><span class="sim-bar" style="--w:${max ? Math.min(100, pct / max * 100).toFixed(1) : 0}"></span>${nl(pct, 1)}%</td>`;

  // ---------- Kan de achterste nog terugkomen? ----------
  const cbN = extra.comebackGames;
  const cbPct = (i) => cbN ? extra.comebackHist[i] / cbN * 100 : 0;
  const cbMax = Math.max(...[0, 1, 2, 3].map(cbPct));
  const cbRows = [['Stond voor (of gedeeld)', 0], ['1 opdracht achter', 1], ['2 opdrachten achter', 2], ['3 of meer achter', 3]]
    .map(([label, i]) => `<tr><td>${label}</td>${barCell(cbPct(i), cbMax)}</tr>`).join('');
  html += simSectionOpen('Kan de achterste nog terugkomen?');
  html += `<p class="hint">Halverwege is het eind van de ronde waarin de eerste speler zijn ${SIM_QUESTS_TO_WIN / 2}e opdracht haalt. Hoe ver lag de latere winnaar toen achter op de koploper?</p>`;
  html += `<table class="sim-table"><thead><tr><th>Winnaar halverwege</th><th>Potjes</th></tr></thead><tbody>${cbRows}</tbody></table>`;
  html += `<p class="hint">In <b>${nl(100 - cbPct(0), 0)}%</b> van de potjes won iemand die halverwege níet (mede)koploper was — hoe hoger, hoe langer een potje spannend blijft.</p>`;

  // ---------- Pech-reeksen ----------
  const sh = extra.searchHist;
  const shTotal = sh.reduce((a, b) => a + b, 0);
  const shSum = (from, to) => { let s = 0; for (let i = from; i <= Math.min(to, SIM_SEARCH_HIST_MAX); i++) s += sh[i]; return s; };
  const shAvg = shTotal ? sh.reduce((s, c, i) => s + c * i, 0) / shTotal : 0;
  const shBuckets = [['1 beurt', 1, 1], ['2 beurten', 2, 2], ['3 beurten', 3, 3], ['4–5 beurten', 4, 5],
    ['6–7 beurten', 6, 7], [`${SIM_LONG_SEARCH}–${SIM_SEARCH_HIST_MAX - 1} beurten`, SIM_LONG_SEARCH, SIM_SEARCH_HIST_MAX - 1],
    [`${SIM_SEARCH_HIST_MAX} of meer`, SIM_SEARCH_HIST_MAX, SIM_SEARCH_HIST_MAX]];
  const shPcts = shBuckets.map(([, a, b]) => shTotal ? shSum(a, b) / shTotal * 100 : 0);
  const shMax = Math.max(...shPcts);
  const shRows = shBuckets.map(([label], i) => `<tr><td>${label}</td>${barCell(shPcts[i], shMax)}</tr>`).join('');
  const longPct = played ? extra.gamesWithLongSearch / played * 100 : 0;
  html += simSectionOpen('Pech-reeksen');
  html += `<p class="hint">Hoeveel eigen beurten zat een speler achter één opdracht aan, tot hij 'm had? Gemiddeld <b>${nl(shAvg, 1)}</b>; de langste zoektocht duurde <b>${extra.longestSearch}</b> beurten.</p>`;
  html += `<table class="sim-table"><thead><tr><th>Zoektocht duurde</th><th>Opdrachten</th></tr></thead><tbody>${shRows}</tbody></table>`;
  html += `<p class="hint">In <b>${nl(longPct, 0)}%</b> van de potjes zat minstens één speler ${SIM_LONG_SEARCH} beurten of langer achter dezelfde opdracht aan — zo'n reeks voelt aan tafel als pech, ook als het gemiddelde klopt.</p>`;

  // ---------- energie ----------
  // Zolang er niets uitgegeven wordt, is dit een nulmeting: hoeveel komt er binnen, hoe snel
  // zit je aan het plafond en hoe vaak kun je een actie van N energie betalen. Precies de
  // cijfers die je nodig hebt om te bepalen wat zo'n actie mag kosten.
  const energyTurns = extra.energyLevels.reduce((a, b) => a + b, 0);
  const energyAvg = energyTurns
    ? extra.energyLevels.reduce((s, c, lvl) => s + c * lvl, 0) / energyTurns : 0;
  const energyAtCap = energyTurns ? (extra.energyLevels[ENERGY_MAX] / energyTurns * 100) : 0;
  const energyWastePct = extra.energyRolled ? (extra.energyWasted / extra.energyRolled * 100) : 0;
  const energyPerTurn = energyTurns ? (extra.energyRolled / energyTurns) : 0;

  // kans dat je aan het begin van een beurt minstens N energie hebt = kans dat je een actie
  // van N kunt betalen
  let atLeast = 0;
  const affordRows = [];
  for (let lvl = ENERGY_MAX; lvl >= 1; lvl--){
    atLeast += extra.energyLevels[lvl];
    affordRows.unshift(`<tr><td>${lvl} energie</td><td class="num">${energyTurns ? nl((atLeast / energyTurns * 100), 1) : '0,0'}%</td></tr>`);
  }
  const maxLevel = Math.max(...extra.energyLevels);
  const energyBars = Array.from(extra.energyLevels, (c, lvl) => {
    const h = maxLevel ? Math.round((c / maxLevel) * 100) : 0;
    const tick = (lvl % 2 === 0) ? `<span class="sim-hist-tick">${lvl}</span>` : '';
    return `<div class="sim-hist-bar-wrap" title="${lvl} energie: ${energyTurns ? nl((c / energyTurns * 100), 1) : 0}% van de beurten"><div class="sim-hist-bar energy" style="height:${h}%"></div>${tick}</div>`;
  }).join('');

  // Welke actie wint? Elk potje heeft precies één speler per strategie, willekeurig over de
  // startposities verdeeld, dus dit is een zuiver onderling toernooi.
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
  html += simSectionOpen('Welke energie-actie wint?');
  html += `<table class="sim-table"><thead><tr><th>Strategie</th><th>Winst% (±95%-marge)</th><th>Top 2</th><th>Gem. plaats</th><th>Keer ingezet</th></tr></thead><tbody>${stratRows}</tbody></table>`;
  html += `<p class="hint">4 spelers, ${ENERGY_STRATEGIES.length} strategieën — elk potje speelt elke strategie één keer, geloot over de startposities (zie pickEnergyStrategies). "Geen energie" (nooit uitgeven) telt niet mee: dat komt in het echt niet voor en trok het plafondverlies hierboven kunstmatig omhoog. Bots spelen met dezelfde tijdsregels als jij: een energie-actie kies je vóór de worp, en de energiesteen van deze beurt geef je pas volgende beurt uit. Herprioritering zet een bot in als zijn opdracht verder dan ${REORDER_PEEK_THRESHOLD} vakjes weg ligt (hij bekijkt dan zijn volgende kaart en wisselt als die dichterbij ligt), de laarzen als een rechte lijn hem dichter bij zijn doel brengt, en Noodtransport als zijn doel verder dan ${JUMP_BOT_MIN_DIST} vakjes weg ligt. Bij gelijkwaardige strategieën staat iedereen op 25% winst en gemiddelde plaats 2,50; wie daar significant boven zit, is te sterk.</p>`;

  // ---------- Wat levert een energie-actie op? ----------
  const pctOf = (a, b) => b ? a / b * 100 : 0;
  const yieldText = (id, st) => {
    if (!st.uses) return '—';
    if (id === 'boost') return `+${nl(st.steps / st.uses, 1)} stappen (3e steen)`;
    if (id === 'reorder') return `wisselt in ${nl(pctOf(st.swaps, st.uses), 0)}% · scheelt dan gem. ${nl(st.swaps ? st.saved / st.swaps : 0, 1)} vakjes`;
    if (id === 'gravity') return `gem. ${nl(st.steps / st.uses, 1)} vakjes rechtdoor · ${nl(pctOf(st.direct, st.uses), 0)}% pakt meteen de opdracht`;
    if (id === 'jump') return `gem. ${nl(st.steps / st.uses, 1)} vakjes gesprongen · ${nl(pctOf(st.direct, st.uses), 0)}% landt precies op de opdracht`;
    if (id === 'portal') return 'elke bot schiet als het hem ≥' + PORTAL_BOT_MIN_GAIN + ' stappen scheelt';
    return '—';
  };
  const yieldRows = [...ENERGY_STRATEGIES, 'portal'].filter(id => extra.energyStats[id]).map(id => {
    const st = extra.energyStats[id];
    return `<tr><td>${ENERGY_ACTIONS[id].name}<span class="sub">${yieldText(id, st)}</span></td>` +
      `<td class="num">${nl(played ? st.uses / played : 0, 1)}</td>` +
      `<td class="num">${nl(pctOf(st.banked, st.uses), 0)}%</td></tr>`;
  }).join('') +
    `<tr><td>Geen energie-actie<span class="sub">ter vergelijking: een beurt zonder actie</span></td><td class="num">—</td>` +
    `<td class="num">${nl(pctOf(extra.noEnergyBanked, extra.noEnergyTurns), 0)}%</td></tr>`;
  html += simSectionOpen('Wat levert een energie-actie op?');
  html += `<p class="hint">Per keer dat een bot de actie inzet. "Opdracht gehaald" is hoe vaak hij in die beurt een opdracht pakte — vergelijk met een beurt zonder actie.</p>`;
  html += `<table class="sim-table"><thead><tr><th>Actie</th><th>Per potje</th><th>Opdracht gehaald</th></tr></thead><tbody>${yieldRows}</tbody></table>`;

  // ---------- Portalen ----------
  // De vier meetpunten uit de analyse "Axiom-9 Portalen", met de grens die daar vooraf is gezet.
  // De winstkans van de vier acties en de potjeslengte staan al hierboven (Welke energie-actie
  // wint?, Speelduur); eerlijkheid per startpositie bovenaan.
  const pt = extra.portal;
  if (pt){
    const okTag = (ok, warn) => ok ? '<span class="ok">✓ goed</span>' : warn ? '<span style="color:var(--amber)">≈ randgeval</span>' : '<span class="bad">✕ buiten de grens</span>';
    const questPct = pctOf(pt.jumpQuests, pt.quests);
    const topPct = pctOf(pt.topWins, pt.topGames);
    const stealPct = pctOf(pt.steals, pt.shots);
    const otherPct = pctOf(pt.jumpsOther, pt.jumps);
    const rows = [
      ['Portaalschoten per potje', nl(played ? pt.shots / played : 0, 1), `waarvan <b>${nl(stealPct, 0)}%</b> een portaal van een ander verplaatst ("stelen")`, ''],
      ['Portaalsprongen per potje', nl(played ? pt.jumps / played : 0, 1), `<b>${nl(otherPct, 0)}%</b> door iemand die geen van beide portalen legde`, ''],
      ['Opdrachten in een beurt met een portaalsprong', nl(questPct, 1) + '%', 'grens: hooguit 5% (10% = randgeval)', okTag(questPct <= 5, questPct <= 10)],
      ['Meeste teleporteerder wint', nl(topPct, 1) + '%', `grens: hooguit 30% (35% = randgeval) · ${pt.topGames} potjes met één duidelijke koploper in sprongen`, okTag(topPct <= 30, topPct <= 35)],
    ].map(([label, val, sub, tag]) => `<tr><td>${label}<span class="sub">${sub}</span></td><td class="num">${val}</td><td>${tag}</td></tr>`).join('');
    html += simSectionOpen('Portalen');
    html += `<p class="hint">Bij de start liggen er twee portalen, minstens ${PORTAL_START_MIN_DIST} stappen uit elkaar. Met het <b>Portaalkanon</b> (${ENERGY_ACTIONS.portal.cost} energie) schiet een speler er een naar de muur; stap je in een portaal, dan kom je uit het andere en stopt je zet. Elke bot schiet als het hem minstens ${PORTAL_BOT_MIN_GAIN} stappen scheelt, welke strategie hij ook heeft. Wint de speler die het vaakst teleporteerde veel vaker dan 25%, dan beslissen de portalen het potje.</p>`;
    html += `<table class="sim-table"><thead><tr><th>Meetpunt</th><th>Waarde</th><th>Oordeel</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ---------- beloningskaarten ----------
  // Winst% van wie het kristal speelde: 25% is gemiddeld (4 spelers). Boven 31% = verdacht sterk,
  // onder 19% = zwak. Let op: wie vooraan ligt krijgt vaker kristallen (elke opdracht levert er een
  // op), dus alle kristallen zitten wat boven de 25%; het gaat om de uitschieters.
  const cardRows = ACTION_CARD_IDS.map(id => {
    const act = ACTION_CARDS[id];
    const uses = extra.cardUses[id];
    const perGame = played ? (uses / played) : 0;
    const w = extra.cardWin[id];
    const winPct = w.games ? w.wins / w.games * 100 : 0;
    const tag = !w.games ? '—' : winPct > 31 ? '<span class="bad">✕ te sterk</span>'
      : winPct < 19 ? '<span style="color:var(--amber)">≈ zwak</span>' : '<span class="ok">✓ in balans</span>';
    return `<tr><td>${act.name} <span class="sub">${act.hint}</span></td><td class="num">${nl(perGame, 2)}</td><td class="num">${w.games ? nl(winPct, 1) + '%' : '—'}</td><td>${tag}</td></tr>`;
  }).join('');
  const drawsPerGame = played ? (extra.cardDraws / played) : 0;
  const handFullPct = extra.cardDraws + extra.handFullOnBank
    ? (extra.handFullOnBank / (extra.cardDraws + extra.handFullOnBank) * 100) : 0;
  const actionCellDrawsPerGame = played ? (extra.actionCellDraws / played) : 0;
  const actionCellHandFullPct = extra.actionCellDraws + extra.handFullOnActionCell
    ? (extra.handFullOnActionCell / (extra.actionCellDraws + extra.handFullOnActionCell) * 100) : 0;
  html += simSectionOpen('Kristallen');
  const deckSize = ACTION_CARD_IDS.reduce((n, id) => n + actionCardCopies(id), 0);
  html += `<p class="hint">Wie een opdracht bereikt krijgt een kristal uit een gedeelde stapel van ${deckSize} (${ACTION_CARD_IDS.length} soorten, van elk 2, Portaalsleutel ${actionCardCopies('portalkey')}), tenzij de kluis al vol is (max ${ACTION_CARD_HAND_MAX}). Gemiddeld <b>${nl(drawsPerGame, 1)}</b> kristallen gekregen per potje via opdrachten (alle 4 spelers samen); <b>${nl(handFullPct, 1)}%</b> van die kansen ging verloren aan een volle kluis.</p>`;
  html += `<p class="hint">Elke gangtegel heeft ook een <b>kristalvakje</b>: loop je daar overheen (je beurt stopt er niet voor), dan krijg je er net zo een kristal bij — hooguit 1x per beurt, ook als je meerdere van deze vakjes passeert. Gemiddeld <b>${nl(actionCellDrawsPerGame, 1)}</b> kristallen gekregen per potje via kristalvakjes; <b>${nl(actionCellHandFullPct, 1)}%</b> van die kansen ging verloren aan een volle kluis.</p>`;
  html += `<table class="sim-table"><thead><tr><th>Kristal</th><th>Keer gebruikt per potje</th><th>Wint wie hem speelt</th><th>Oordeel</th></tr></thead><tbody>${cardRows}</tbody></table>`;
  html += `<p class="hint">"Wint wie hem speelt": van de spelers die dit kristal in een potje minstens één keer gebruikten, het deel dat dat potje won. Gemiddeld is 25%. Wie vooroploopt krijgt vaker kristallen, dus iets erboven is normaal; boven 31% is een kristal waarschijnlijk te sterk, onder 19% te zwak.</p>`;

  html += simSectionOpen('Energie');
  html += `<p class="hint">De energiesteen (<b>${ENERGY_DIE_FACES.map(f => f || '–').join(' ')}</b>) rolt elke beurt mee, gemiddeld <b>${nl(energyPerTurn, 2)}</b> per beurt, met een plafond van <b>${ENERGY_MAX}</b>. Wat je gooit, kun je pas volgende beurt uitgeven. Onderstaande cijfers zijn over de ${ENERGY_STRATEGIES.length} bot-strategieën samen (${ENERGY_STRATEGIES.map(id => ENERGY_ACTIONS[id].name).join(' / ')}) — "Geen energie" telt hier niet mee, want die speler komt in het echt niet voor.</p>`;
  html += `<p class="hint">Een speler heeft gemiddeld <b>${nl(energyAvg, 1)}</b> energie op zak, staat <b>${nl(energyAtCap, 1)}%</b> van zijn beurten op het plafond, en <b>${nl(energyWastePct, 1)}%</b> van alle gerolde energie gaat daardoor verloren.</p>`;
  html += `<p class="hint" style="margin-top:10px;">Verdeling van de energievoorraad over alle beurten (0 links, ${ENERGY_MAX} rechts):</p>`;
  html += `<div class="sim-hist">${energyBars}</div>`;
  html += `<table class="sim-table"><thead><tr><th>Kosten van een actie</th><th>Aandeel beurten waarin je 'm kunt betalen</th></tr></thead><tbody>${affordRows.join('')}</tbody></table>`;

  html += simSectionOpen('Drukte op het bord');
  html += `<p class="hint">Hoe vaak elk vakje betreden werd over alle ${played} meegetelde potjes — laat bottleneck-gangen en nauwelijks gebruikte hoekjes zien.</p>`;
  html += renderHeatmap(graph, heatmap);
  html += `<p class="hint" style="margin-top:12px;">Koudste tegels — de kandidaten voor een "lus zonder opdracht waar niemand komt":</p>`;
  html += renderColdZones(graph, heatmap);

  html += simSectionCloseAll() + `</div>`;
  simResultsEl.innerHTML = html;
  layoutSimSections();

  const expandBtn = document.getElementById('btnSimExpand');
  expandBtn.addEventListener('click', () => {
    const sections = simResultsEl.querySelectorAll('details.sim-section');
    const open = expandBtn.getAttribute('aria-expanded') !== 'true';
    sections.forEach(d => { d.open = open; });
    expandBtn.setAttribute('aria-expanded', String(open));
    expandBtn.textContent = open ? 'Alle details inklappen' : 'Alle details uitklappen';
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

function formatSimSeconds(ms){
  const s = ms / 1000;
  return s < 10 ? `${nl(s, 1)} seconden` : `${Math.round(s)} seconden`;
}

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
      // het diagram afmaken en even laten staan, en het vakje minstens helemaal laten infaden;
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
