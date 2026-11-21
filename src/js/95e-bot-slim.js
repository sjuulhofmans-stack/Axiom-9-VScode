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
  // vaste strategie: wel een portaal of een schroevendraaier als dat loont ("niemand geeft uit"
  // blijft niets uitgeven); levert allebei iets op, dan wint wat de meeste stappen scheelt
  if (player.strategy !== 'smart'){
    if (player.strategy === 'none') return player.strategy;
    const portal = botPortalWanted(graph, player);
    if (botDriverWanted(graph, player) && !(portal && (player._portalGain || 0) >= player._driverGain)) return 'driver';
    return portal ? 'portal' : player.strategy;
  }
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
  let shot = null;
  if (E >= ENERGY_ACTIONS.portal.cost && !player.noPortal && graph.portals){
    const targets = [];
    for (let i = player.nextIdx; i < deck.length; i++) if (deck[i] != null) targets.push(graph.questCells[deck[i]]);
    shot = botPortalShot(graph, player, null, targets);
  }
  // schroevendraaier: als hij meer scheelt dan een sprint én dan een portaalschot (zie ROOSTERS)
  if (botDriverWanted(graph, player) && player._driverGain > dashGain && (!shot || player._driverGain >= shot.gain)) return 'driver';
  if (shot && shot.gain > dashGain) return 'portal';
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

