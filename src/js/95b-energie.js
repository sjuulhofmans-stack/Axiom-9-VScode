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
  portal:  { cost: 5,  name: 'Portaalkanon',    hint: 'schiet een portaal tot de muur, dan gooien',
             note: 'Kies een richting: het portaal vliegt rechtdoor tot de muur of tot vóór een pion. Daarna kies je of je het blauwe of het rode portaal verplaatst. Stapt iemand in een portaal, dan komt hij uit het andere en loopt hij met de rest van zijn worp door. Staat er een pion op een portaal, dan werkt het paar niet.' },
  driver:  { cost: 5,  name: 'Schroevendraaier', hint: 'kruip door een rooster naar een ander rooster',
             note: 'Je krijgt een schroevendraaier (je kunt er één tegelijk hebben, iedereen ziet het). Sta je op een rooster, ook midden in je zet, dan mag je erin kruipen: dat kost geen stap. Je kiest een vrij rooster als uitgang en loopt met de rest van je worp door. Daarna is de schroevendraaier op.' },
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

