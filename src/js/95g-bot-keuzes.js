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
// bot-beurten in Zelf spelen), zodat die nooit uit elkaar lopen. Volgorde: eerst een portaalschot (Portaalsleutel-kristal, dan het Portaalkanon), dan Noodtransport
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
    // met de pionnen erbij kan het schot toch niet (botPortalWanted rekent zonder pionnen): dan
    // deze beurt terug naar de eigen strategie, anders deed een vaste-strategie-bot helemaal niets
    player._portalWant = false;
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
// stand wordt er geloot, zie pickLeaderTarget), voor zover die nog meespeelt en niet al geraakt is.
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
  const taken = energyLeakTake(victim);
  const gain = simGainEnergy(thief, taken);
  return { taken, gained: gain.gained };
}
// Bots spelen Energielek vóór hun worp (de mens pas erna, `when: 'post'`). Daarom pakken ze het af
// maar krijgen ze het pas na de zet bij, samen met hun energiesteen (pendingEnergy): zo geven ze het,
// net als de mens, pas volgende beurt uit. Vroeger betaalden ze er dezelfde beurt al een actie mee.
function energyLeakTake(victim){
  const taken = Math.min(ENERGY_LEAK_AMOUNT, victim.energy);
  victim.energy -= taken;
  return taken;
}
// Dubbele steen: een bot speelt hem als de tweede energiesteen niet tegen het plafond wegvalt
// (`pending` = wat hij deze beurt al gooide en nog bij krijgt) en zijn steen niet uitgeschakeld is.
function botWantsTwinEnergy(player, pending){
  return !player.skipEnergyRoll && player.energy + (pending || 0) + 3 <= ENERGY_MAX;
}
// Dubbele steen mag alleen vóór het gooien: een mens weet zijn energiesteen dan nog niet. De bot
// rekent daarom met de gemiddelde worp (0-1-1-2-2-3 → 1,5, afgerond 2) i.p.v. met wat hij al gooide.
const BOT_TWIN_EXPECTED_ROLL = 2;
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
// Meetknop (let, voor de console): SIM_SETUP_HOOK mag in de batch-simulatie per potje spelers
// aanpassen (bv. een eigenschap op één speler zetten voor een vergelijking).
// (De energie-actie Herworp, ná de worp één steen opnieuw, is op 2026-11-20 weer weggehaald:
// gebruikerswens, "verwarrend dat het energievak na het dobbelen telkens wegspringt".)
let SIM_SETUP_HOOK = null;
// Zelf kiezen: probeer elke steen op elke andere waarde en neem de beste zet. Alleen als dat
// duidelijk beter is dan de huidige zet (een opdracht erbij, of minstens 2 vakjes dichterbij);
// anders null en houdt de bot het kristal. `penalty` = Stroomonderbreking (geldt ook voor de nieuwe worp).
function botPickDieValue(graph, fromKey, dieVals, penalty, occupied, targets, rand, current, crawl){
  const base = dieVals.reduce((a, b) => a + b, 0);
  let best = null, bestScore = botMoveScore(graph, current, targets) + 1;
  const tried = new Set();
  for (let i = 0; i < dieVals.length; i++){
    for (let v = 1; v <= 6; v++){
      if (v === dieVals[i]) continue;
      const roll = Math.max(1, base - dieVals[i] + v - (penalty || 0));
      if (tried.has(roll)) continue;             // zelfde aantal stappen = zelfde zet
      tried.add(roll);
      const move = resolveMove(graph, fromKey, roll, occupied, targets, rand, undefined, crawl);
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

