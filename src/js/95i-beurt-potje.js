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
  // echt uitgegeven energie (voor "Energie verbruikt"): vroeger berekend als erbij − over, en dan
  // telde energie die een ander je met Energielek afpakte als "verbruikt"
  if (player && player.stats && ENERGY_ACTIONS[kind]) player.stats.energySpent = (player.stats.energySpent || 0) + ENERGY_ACTIONS[kind].cost;
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
// ---------- één bot-beurt, gedeeld door alle drie de modi (nr. 35 uit analyse.md, 2026-11) ----------
// Vroeger stond deze beurt drie keer bijna gelijk in de code (simulateOneGame, de lus van
// Automatisch in 96-walk.js en soloResolveBotTurn in 97-solo.js), en elke afwijking daartussen was
// een fout (bots die in de ene modus wél en in de andere niet iets mochten). Nu:
//   botPlanTurn   = alle keuzes en spelregels tot en met de zet (kristallen, energie-actie, worp,
//                   Zelf kiezen, Koerscorrectie, Zonnezeil, Blinde Vlek). De pion staat daarna nog
//                   op zijn oude plek; geduwde tegenstanders en portalen zijn al verplaatst.
//   botFinishTurn = de zet afronden: pion neerzetten, kristalvakje, energiesteen bijschrijven,
//                   opdrachten afboeken met hun kristal.
// Elke modus doet daarna ALLEEN nog log, animatie en zijn eigen telling. Een spelregel voor bots
// aanpassen = hier, en nergens anders.
// ctx = { graph, players, player, rand, deck, queue, extra }
//   queue: de opdrachtenstapel van de speler (batch: player.order, Zelf spelen/Automatisch: player.deck)
//   extra: alleen de batch-simulatie (tellers voor de uitslag); anders weglaten.
// De tellers per speler (player.stats) lopen hier ook mee; de batch-speler heeft er geen.
function botPlanTurn(ctx){
  const { graph, players, player, rand, deck, queue, extra } = ctx;
  const pIdx = player.idx;
  const r = { startPos: player.pos, locked: false, energyRoll: 0, condenserCashed: false, pendingEnergy: 0,
              cards: [], energyUsed: null, reorder: null, pre: null, portal: null,
              dice: [], d1: 0, d2: 0, d3: null, roll: 0, rollPenalty: 0, rollMove: null, move: null,
              portalJumps: 0, cellIdx: -1, targets: null, targetLabel: null, targetKey: undefined };
  // Energie-acties en kristallen hebben ELK hun eigen slot per beurt (max 1 van elk). Drie
  // kristallen zijn een GRATIS variant van een energie-actie (Stuwlading↔Stuwstoot: allebei een 3e
  // loopsteen; laarzen-kristal↔laarzen: één sprint; Portaalsleutel↔Portaalkanon: één portaalschot)
  // — die blijven elkaar binnen hún ene moment uitsluiten (kristal gaat voor, is gratis).
  let energyActionUsed = false, cardActionUsed = false;
  const playCard = (id, info) => {
    useActionCard(player, id, deck, extra);
    cardActionUsed = true;
    r.cards.push(Object.assign({ id }, info));
  };
  const payEnergy = (id) => {
    player.energy -= ENERGY_ACTIONS[id].cost;
    player.actionUses++;
    energyActionUsed = true;
    r.energyUsed = id;
    statsUseEnergy(player, id);
  };
  const has = id => player.cards.includes(id);

  // Vergrendeling: geraakt in een vorige beurt = NU geen energie- en geen kristalslot
  if (player.lockedNextTurn){
    player.lockedNextTurn = false;
    energyActionUsed = cardActionUsed = true;
    r.locked = true;
  }

  // 1. energiesteen rolt mee (tenzij Kortsluiting), maar telt pas NA de zet bij — wat je nu gooit,
  //    geef je pas volgende beurt uit (zie de tijdsregels bovenaan dit bestand)
  const shorted = player.skipEnergyRoll;   // dan ook geen Dubbele steen (net als bij de mens)
  let pendingEnergy = 0;
  if (player.skipEnergyRoll){
    player.skipEnergyRoll = false;
  } else {
    r.energyRoll = simRollEnergy(rand);
    pendingEnergy = r.energyRoll;
    if (player.stats) player.stats.energyRolled += r.energyRoll;
    // Condensator van vorige beurt: deze steen telt dubbel; bij een 0 blijft hij staan (net als bij de mens)
    if (player.condenserPending && r.energyRoll > 0){
      player.condenserPending = false;
      pendingEnergy += r.energyRoll;
      r.condenserCashed = true;
    }
  }
  if (extra) extra.energyRolled += pendingEnergy;

  // 1b. kristallen rond de energiefase. De Condensator is een investering voor je VOLGENDE beurt:
  //     een bot zet hem in zodra er ruimte is om te groeien en er nog geen klaarstaat.
  if (!cardActionUsed && has('condenser') && !player.condenserPending && player.energy < ENERGY_MAX){
    player.condenserPending = true;
    playCard('condenser');
  }
  if (!cardActionUsed && has('short')){
    const victim = pickShortCircuitTarget(players, pIdx, rand);
    if (victim){ victim.skipEnergyRoll = true; playCard('short', { victim }); }
  }
  // Energielek: alleen als er bij een ander minstens 2 te halen valt en er bij jezelf ruimte is
  if (!cardActionUsed && has('leak') && player.energy < ENERGY_MAX){
    const victim = pickEnergyLeakTarget(players, pIdx, rand);
    if (victim && victim.energy >= ENERGY_LEAK_AMOUNT){
      const taken = energyLeakTake(victim);   // pas na de zet erbij, zie energyLeakTake
      pendingEnergy += taken;
      playCard('leak', { victim, taken });
    }
  }
  // Dubbele steen (vóór de worp): een tweede energiesteen, telt net als de eerste pas na de zet
  if (!cardActionUsed && !shorted && has('twin') && botWantsTwinEnergy(player, BOT_TWIN_EXPECTED_ROLL)){
    const second = simRollEnergy(rand);
    pendingEnergy += second;
    if (extra) extra.energyRolled += second;
    if (player.stats) player.stats.energyRolled += second;
    playCard('twin', { second });
  }
  if (!cardActionUsed && has('ration') && player.energy < ENERGY_MAX){
    simGainEnergy(player, 3);
    playCard('ration');
  }
  // 1c. hinder-kristallen tegen de koploper (zelfde eerlijke keuze als Kortsluiting)
  if (!cardActionUsed && has('lockdown')){
    const victim = pickLeaderTarget(players, pIdx, p => p.lockedNextTurn, rand);
    if (victim){ victim.lockedNextTurn = true; playCard('lockdown', { victim }); }
  }
  if (!cardActionUsed && has('outage')){
    const victim = pickLeaderTarget(players, pIdx, p => p.rollPenalty > 0, rand);
    if (victim){ victim.rollPenalty = 2; playCard('outage', { victim }); }
  }
  // Duwstoot: vereist een AANGRENZENDE tegenstander
  if (!cardActionUsed && has('shove')){
    const shove = pickShoveMove(graph, players, pIdx, rand);
    if (shove){ shove.player.pos = shove.toKey; playCard('shove', { victim: shove.player }); }
  }

  // 2. doel: Herprioritering (energie) = betalen, volgende opdracht bekijken, wisselen als die
  //    dichterbij ligt. Je betaalt ook als wisselen niets oplevert (zie botWantsReorderPeek).
  //    energyReorderTarget werkt op `order`: dit hulpje wijst naar dezelfde stapel (geen kopie).
  let targetLabel = queue[player.nextIdx];
  const shim = { order: queue, nextIdx: player.nextIdx };
  if (!energyActionUsed && botStrategyNow(graph, player) === 'reorder' && player.energy >= ENERGY_ACTIONS.reorder.cost
      && botWantsReorderPeek(graph, shim, player.pos)){
    payEnergy('reorder');
    const before = targetLabel;
    const swapped = energyReorderTarget(graph, shim, player.pos);
    r.reorder = { before, swapped };
    if (swapped !== null){
      if (extra){
        // voor "Wat levert een energie-actie op?": hoeveel vakjes scheelt de wissel?
        const stamp = simBfsDistances(graph, player.pos);
        const st = extra.energyStats.reorder;
        st.swaps++;
        st.saved += simDistLookup(stamp, graph.questCells[before]) - simDistLookup(stamp, graph.questCells[swapped]);
      }
      targetLabel = swapped;
    }
  }
  r.targetLabel = targetLabel;
  r.targetKey = graph.questCells[targetLabel];
  // volledige rij nog te halen opdrachtvakjes, te beginnen bij het huidige doel — resolveMove loopt
  // na targets[0] door en toetst de resterende stappen meteen aan targets[1], enz.
  const targets = [];
  for (let i = player.nextIdx; i < queue.length; i++) targets.push(graph.questCells[queue[i]]);
  r.targets = targets;

  const occupied = new Set();
  for (const other of players) if (other.idx !== pIdx && simOnBoard(other)) occupied.add(other.pos);

  // 2b. schroevendraaier (zie ROOSTERS): het kristal (gratis) gaat voor de energie-actie. Een bot
  //     koopt alleen als het hem minstens GRATE_BOT_MIN_GAIN stappen scheelt naar zijn opdracht.
  if (graph.grates && graph.grates.length && !player.screwdriver && !player.noGrate && targets.length){
    const gain = grateGain(graph, player.pos, targets[0]);
    if (!cardActionUsed && has('driver') && gain >= GRATE_BOT_MIN_GAIN){
      player.screwdriver = true;
      playCard('driver');
      r.driver = 'card';
    } else if (!energyActionUsed && botStrategyNow(graph, player) === 'driver' && player.energy >= ENERGY_ACTIONS.driver.cost){
      payEnergy('driver');
      player.screwdriver = true;
      r.driver = 'energy';
    }
    if (r.driver && extra && extra.grate){
      if (r.driver === 'card') extra.grate.cardBuys++; else extra.grate.buys++;
    }
  }

  // 3. vóór de worp: Noodtransport, Zwaartekracht-laarzen of een portaalschot (energie of kristal),
  //    de keuze in botPreRollMove. Een sprong precies op je opdracht beëindigt de beurt; anders gooi
  //    je daarna vanaf je nieuwe plek. Haalt een sprint je 6e opdracht, dan valt er niets meer te gooien.
  const pre = botPreRollMove(graph, player, occupied, targets, !energyActionUsed, !cardActionUsed);
  r.pre = pre;
  if (pre){
    if (pre.kind === 'bootsCard' || pre.kind === 'portalCard'){
      playCard(pre.kind === 'bootsCard' ? 'boots' : 'portalkey');
    } else {
      payEnergy(pre.kind);
      const st = extra && extra.energyStats[pre.kind];
      if (st){
        st.steps += pre.path.length - 1;
        if (pre.bankedCount) st.direct++;
      }
    }
    if (preIsPortal(pre)){
      const before = { cells: graph.portals.cells.slice(), owner: graph.portals.owner.slice() };
      const placed = portalPlace(graph, pre.shot.key, pre.shot.color, pIdx);
      r.portal = { placed, before, after: { cells: graph.portals.cells.slice(), owner: graph.portals.owner.slice() } };
      if (extra && extra.portal){ extra.portal.shots++; if (placed.stolen) extra.portal.steals++; }
      if (player.stats) player.stats.portalShots = (player.stats.portalShots || 0) + 1;
    } else if (pre.kind !== 'jump' && player.stats){
      player.stats.dashSteps += pre.path.length - 1;
    }
  }
  const rollFrom = pre ? pre.key : player.pos;
  const rollTargets = pre ? targets.slice(pre.bankedCount) : targets;
  if (pre && (pre.endsTurn || player.completed + pre.bankedCount >= SIM_QUESTS_TO_WIN)){
    r.move = { key: pre.key, path: pre.path, stepsUsed: pre.path.length - 1, bankedCount: pre.bankedCount,
               bankedQuest: pre.bankedCount > 0, wasBlocked: pre.wasBlocked, teleported: pre.kind === 'jump' };
  } else {
    // 4. de worp: loopstenen, met Stuwlading (kristal) of Stuwstoot (energie) als derde steen.
    //    Stroomonderbreking trekt er ná alle stenen 2 stappen af (minimaal 1 blijft over).
    const dieVals = [simRollD6(rand, player), simRollD6(rand, player)];
    statsRecordRoll(player, dieVals[0] + dieVals[1]);
    if (!cardActionUsed && has('boostcell')){
      dieVals.push(simRollD6(rand, player));
      playCard('boostcell');
    } else if (!energyActionUsed && botStrategyNow(graph, player) === 'boost' && player.energy >= ENERGY_ACTIONS.boost.cost){
      const extraDie = simRollD6(rand, player);
      dieVals.push(extraDie);
      payEnergy('boost');
      if (extra) extra.energyStats.boost.steps += extraDie;
    }
    const dice = dieVals.length;
    const sum = () => dieVals.reduce((a, b) => a + b, 0);
    let roll = sum(), rollPenalty = 0;
    if (player.rollPenalty){
      rollPenalty = player.rollPenalty;
      roll = Math.max(1, roll - rollPenalty);
      player.rollPenalty = 0;
    }
    r.dice.push({ vals: dieVals.slice(), roll, why: 'roll' });
    const sd = !!player.screwdriver;   // met een schroevendraaier rekent de zet kruipen mee
    let move = resolveMove(graph, rollFrom, roll, occupied, rollTargets, rand, undefined, sd);
    // Zelf kiezen: één steen een andere waarde als dat een opdracht of duidelijk winst oplevert
    if (!move.bankedQuest && !cardActionUsed && has('pick')){
      const pk = botPickDieValue(graph, rollFrom, dieVals, rollPenalty, occupied, rollTargets, rand, move, sd);
      if (pk){
        const was = dieVals[pk.idx];
        dieVals[pk.idx] = pk.value;
        roll = pk.roll;
        move = pk.move;
        playCard('pick', { was, value: pk.value, roll });
        r.dice.push({ vals: dieVals.slice(), roll, why: 'pick' });
      }
    }
    // Koerscorrectie: een tegenvallende worp (onder 3,5 per steen) overdoen; de nieuwe telt, ook
    // als die slechter is. Een Stroomonderbreking geldt ook voor de nieuwe worp.
    if (!move.bankedQuest && !cardActionUsed && has('reroll') && roll < dice * 3.5){
      for (let d = 0; d < dice; d++){
        dieVals[d] = simRollD6(rand, player);
        if (d === 1) statsRecordRoll(player, dieVals[0] + dieVals[1]);
      }
      roll = sum();
      if (rollPenalty) roll = Math.max(1, roll - rollPenalty);
      playCard('reroll', { roll });
      r.dice.push({ vals: dieVals.slice(), roll, why: 'reroll' });
      move = resolveMove(graph, rollFrom, roll, occupied, rollTargets, rand, undefined, sd);
    }
    // Zonnezeil (direct na de worp): energie gelijk aan de laagste steen, als er ruimte is
    if (!cardActionUsed && has('solar') && player.energy + pendingEnergy < ENERGY_MAX){
      const g = simGainEnergy(player, solarGain(dieVals));
      if (extra) extra.energyWasted += g.wasted;
      playCard('solar', { gained: g.gained });
    }
    // 5. Blinde Vlek: een geblokkeerde worp opnieuw uitrekenen, door tegenstanders heen (maar er
    //    niet op eindigen). Geen enkel vrij eindvakje = resolveMove geeft null, de zet blijft staan.
    if (!move.bankedQuest && !cardActionUsed && has('blind') && move.wasBlocked){
      const retry = resolveMove(graph, rollFrom, roll, SIM_EMPTY_SET, rollTargets, rand, occupied, sd);
      if (retry && retry.key !== move.key){ move = retry; playCard('blind'); }
    }
    // gekropen: de schroevendraaier is op (zie ROOSTERS)
    if (move.usedSd){
      player.screwdriver = false;
      player.grateUses = (player.grateUses || 0) + 1;
      r.crawled = true;
      if (player.stats) player.stats.crawls = (player.stats.crawls || 0) + 1;
      if (extra && extra.grate){ extra.grate.uses++; extra.grate.useQuests += (pre ? pre.bankedCount : 0) + move.bankedCount; }
    }
    r.rollMove = move;
    r.move = mergePreRollMove(pre, move);
    r.d1 = dieVals[0]; r.d2 = dieVals[1]; r.d3 = dice > 2 ? dieVals[2] : null;
    r.roll = roll; r.rollPenalty = rollPenalty;
    r.portalJumps = pathPortalJumps(graph, move.path);
    if (player.stats){
      player.stats.walkSteps += move.path.length - 1 - r.portalJumps - pathGrateJumps(graph, move.path);
      if (r.portalJumps) player.stats.portalJumps = (player.stats.portalJumps || 0) + r.portalJumps;
    }
  }
  r.pendingEnergy = pendingEnergy;
  // het kristalvakje van deze beurt (hooguit 1), als plek in r.move.path. Noodtransport: alleen het
  // vakje waar je LANDT telt, niet wat je overvliegt (spelregel van de maker, zie crystalPathOf).
  const path = r.move.path;
  const from = pre && pre.kind === 'jump' ? Math.max(1, pre.path.length - 1) : 1;
  for (let i = from; i < path.length; i++) if (graph.actionCells.has(path[i])){ r.cellIdx = i; break; }
  return r;
}

// De zet van botPlanTurn afronden. Volgorde: kristalvakje, energiesteen, opdrachten (elk met een
// kristal als de kluis niet vol is; nooit verder dan 6). Vult r.cellReward, r.energyGain, r.bank
// (stapel en stand vóór het afboeken, voor het naspelen) en r.banked aan.
function botFinishTurn(ctx, r){
  const { graph, player, rand, deck, queue, extra } = ctx;
  player.pos = r.move.key;
  r.cellReward = null;
  if (r.cellIdx >= 0){
    const reward = drawActionCellReward(player, deck, rand);
    r.cellReward = { key: r.move.path[r.cellIdx], idx: r.cellIdx, drawn: reward.drawn, handFull: reward.handFull };
    if (extra){
      if (reward.drawn) extra.actionCellDraws++;
      else if (reward.handFull) extra.handFullOnActionCell++;
    }
  }
  r.energyGain = r.pendingEnergy ? simGainEnergy(player, r.pendingEnergy) : { gained: 0, wasted: 0 };
  if (extra) extra.energyWasted += r.energyGain.wasted;
  r.bank = { seq: queue.slice(player.nextIdx), completed: player.completed };
  r.banked = [];
  const bankN = Math.min(r.move.bankedCount, SIM_QUESTS_TO_WIN - player.completed);
  for (let n = 0; n < bankN; n++){
    const label = queue[player.nextIdx];
    const ev = { label, key: graph.questCells[label], drawn: null, full: false };
    player.completed++;
    player.nextIdx++;
    if (player.cards.length < ACTION_CARD_HAND_MAX){
      const drawn = drawActionCard(deck, rand);
      if (drawn){ player.cards.push(drawn); ev.drawn = drawn; if (extra) extra.cardDraws++; }
    } else {
      ev.full = true;
      if (extra) extra.handFullOnBank++;
    }
    r.banked.push(ev);
  }
  return r;
}

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
    screwdriver: false,    // heeft een schroevendraaier (zie ROOSTERS)
    grateUses: 0,          // keer gekropen dit potje
    rank: 0,       // 0 = nog aan het spelen; 1..4 = binnengekomen op die plaats
    finishTurn: 0, // beurtnummer waarop deze speler binnenkwam
  }));
  const turnOrder = simShuffle([0, 1, 2, 3], rand);
  for (let s = 0; s < turnOrder.length; s++) players[turnOrder[s]].seat = s;
  // strategieën loten, zodat "welke actie wint" niet vervuild wordt door de startpositie
  const strategies = pickEnergyStrategies(rand);
  for (let i = 0; i < players.length; i++) players[i].strategy = strategies[i];
  if (SIM_SETUP_HOOK) SIM_SETUP_HOOK(players, rand);   // alleen voor metingen vanuit de console
  const deck = buildActionDeck(rand);   // één gedeelde stapel voor het hele potje
  portalSetup(graph, rand);             // vier portalen liggen al bij de start (zie PORTALEN)
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
      extra.energyLevels[player.energy]++;   // energie aan het begin van de beurt
      // de hele beurt: keuzes, worp en zet (gedeeld met Automatisch en Zelf spelen, zie botPlanTurn)
      const ctx = { graph, players, player, rand, deck, queue: player.order, extra };
      const r = botFinishTurn(ctx, botPlanTurn(ctx));
      const move = r.move;

      extra.totalTurns++;
      if (move.wasBlocked) extra.blockedTurns++;
      for (let p = 1; p < move.path.length; p++) heatmap[move.path[p]]++;
      // portalen: sprongen tellen, en wie er gebruik van maakt (eigen portaal of dat van een ander)
      if (extra.portal){
        const jumps = pathPortalJumps(graph, move.path);
        extra.portal.quests += move.bankedCount;
        if (jumps){
          const P = graph.portals, own = P.owner.includes(pIdx);
          extra.portal.jumps += jumps;
          if (!own) extra.portal.jumpsOther += jumps;
          extra.portal.jumpQuests += move.bankedCount;
          portalJumpsBy[pIdx] += jumps;
        }
      }
      // "Wat levert een energie-actie op?": haalde deze beurt een opdracht, mét of zonder actie
      if (r.energyUsed){
        const st = extra.energyStats[r.energyUsed];
        if (st){
          st.uses++;
          if (move.bankedQuest) st.banked++;
        }
      } else {
        extra.noEnergyTurns++;
        if (move.bankedQuest) extra.noEnergyBanked++;
      }

      // afgeboekte opdrachten (meestal 0 of 1, zelden 2): elk zijn eigen boekhouding, in de
      // volgorde waarin ze onderweg geraakt zijn. Het kristal is al getrokken (botFinishTurn).
      player.turnsOnTarget++;
      for (const ev of r.banked){
        const qs = questStats[ev.label];
        qs.turns += player.turnsOnTarget;
        qs.count++;
        // "Pech-reeksen": hoeveel beurten zat deze speler achter deze opdracht aan? (0 = een 2e
        // opdracht in dezelfde beurt, die telt hier niet als zoektocht)
        if (player.turnsOnTarget > 0){
          extra.searchHist[Math.min(player.turnsOnTarget, SIM_SEARCH_HIST_MAX)]++;
          if (player.turnsOnTarget > player.longestSearch) player.longestSearch = player.turnsOnTarget;
          if (player.turnsOnTarget > extra.longestSearch) extra.longestSearch = player.turnsOnTarget;
        }
        player.turnsOnTarget = 0;
      }
      // rank wordt NIET meteen toegekend — pas ná deze hele ronde (zie resolveRoundFinishers),
      // zodat wie later in de beurtvolgorde zit deze ronde nog evenveel kans krijgt
      if (r.banked.length && player.completed >= SIM_QUESTS_TO_WIN){
        player.finishTurn = turnCount;
        roundFinishers.push(player);
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
        // "meeste kruiper wint": idem voor de roosters
        if (extra.grate){
          const most = Math.max(...players.map(p => p.grateUses || 0));
          const top = players.filter(p => (p.grateUses || 0) === most);
          if (most > 0 && top.length === 1){
            extra.grate.topGames++;
            extra.grate.topWins += rankOverlapFraction(top[0].rank, top[0].rankShare || 1, 1);
          }
        }
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

