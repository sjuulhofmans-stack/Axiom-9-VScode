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
  // gratis versie van de energie-actie Schroevendraaier (zie ROOSTERS hieronder); 'any', zodat je
  // hem ook kunt spelen op het moment dat je op een rooster staat
  driver:    { name: 'Schroevendraaier',      when: 'any',   text: 'Krijg gratis een schroevendraaier',        hint: 'gratis schroevendraaier' },
};
// De uitleg in het UITLEGVAK onder het grote kristal in de kluis (en bij het vergroten in de vitrine
// Speelkaarten). Sinds 2026-11 staat er op het kristal zelf alleen nog het icoon en de naam (artifact
// "Axiom-9 Energie en kluis", variant 3+). Langer dan `text`, maar het vak heeft een VASTE hoogte:
// gemeten past ±240 tekens (Schroevendraaier) precies op de laptop. Langer? Eerst meten (zie CLAUDE.md).
const ACTION_CARD_INFO = {
  boots:     `Schiet eerst rechtdoor tot een muur of pion, hooguit ${GRAVITY_DASH_STEPS} vakjes. Kom je op je opdracht, dan telt die en stop je daar. Daarna gooi je gewoon. Niet samen met de energie-actie Zwaartekracht-laarzen.`,
  ration:    `Je krijgt meteen 3 energie erbij, tot het maximum van ${ENERGY_MAX}. Handig vlak voordat je een dure energie-actie wilt kiezen.`,
  short:     'Kies een tegenstander. Bij zijn volgende worp levert zijn energiesteen niets op.',
  blind:     'Blokkeert een speler je route, dan mag je door hem heen lopen. Op een speler eindigen mag niet. Je krijgt dit vanzelf aangeboden als het je zet redt.',
  shove:     `Staat er een speler direct naast je, dan duw je hem ${SHOVE_DISTANCE} vakjes van je af. Zo blokkeert hij je route niet meer, of zet je hem verder van zijn opdracht.`,
  boostcell: 'Je gooit deze beurt met drie loopstenen in plaats van twee, gratis. Niet samen met de energie-actie Stuwstoot in dezelfde beurt.',
  condenser: 'Bij je volgende beurt telt je energiesteen dubbel. Gooi je dan een 0, dan blijft hij staan voor de beurt daarna.',
  reroll:    'Gooi je loopstenen opnieuw, voordat je je eerste stap zet. De nieuwe worp telt, ook als die lager is.',
  lockdown:  'Kies een tegenstander. In zijn volgende beurt mag hij geen energie-actie en geen kristal inzetten.',
  outage:    'Kies een tegenstander. Bij zijn volgende worp loopt hij 2 stappen minder.',
  leak:      `Pak ${ENERGY_LEAK_AMOUNT} energie van een tegenstander naar keuze. Je krijgt ze na je zet, net als de energie van je energiesteen.`,
  twin:      'Je gooit deze beurt met twee energiestenen en krijgt de energie van allebei.',
  solar:     `Direct na je worp krijg je energie gelijk aan je laagste loopsteen, tot het maximum van ${ENERGY_MAX}.`,
  portalkey: 'Verplaats gratis een portaal, net als met het Portaalkanon: kies een richting, het portaal vliegt rechtdoor tot de muur of tot vóór een pion. Daarna gooi je.',
  pick:      'Geef één van je loopstenen een waarde naar keuze, voordat je je eerste stap zet.',
  driver:    'Je krijgt meteen een schroevendraaier, zonder energie te betalen. Sta je op een rooster, ook midden in je zet, dan kruip je erin en kom je bij een ander rooster naar keuze weer boven. Je kunt er één tegelijk hebben.',
};
for (const id in ACTION_CARD_INFO) if (ACTION_CARDS[id]) ACTION_CARDS[id].info = ACTION_CARD_INFO[id];
// Hoeveel exemplaren van een kristal er in de stapel zitten; niet genoemd = 2 (zie buildActionDeck).
const ACTION_CARD_COPIES = { portalkey: 5 };
function actionCardCopies(id){ return ACTION_CARD_COPIES[id] || 2; }
// kort moment, per `when` (vitrine Speelkaarten, spelregels)
const CRYSTAL_WHEN = { pre: 'Vóór je gooit', any: 'Vóór of na', start: 'Direct na worp', post: 'Na je worp', auto: 'Vanzelf' };
// moment in het uitlegvak van de kluis (daar is iets meer ruimte)
const CRYSTAL_WHEN_LONG = { pre: 'Vóór je gooit', any: 'Vóór of na je worp', start: 'Direct na je worp', post: 'Na je worp', auto: 'Vanzelf, als het kan' };
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
  blind: 'quest', portalkey: 'quest', pick: 'quest', driver: 'quest',
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
  // schroevendraaier (gekozen icoon A): het gereedschap zelf, schuin
  driver: `<rect x="7" y="28" width="10" height="17" rx="3.5" transform="rotate(45 12 36.5)"/>
    <line x1="17.5" y1="30.5" x2="36" y2="12"/><line x1="36" y1="12" x2="40.5" y2="7.5" stroke-width="4.5"/>`,
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
// Welke vakjes van een zet tellen voor een kristal? Bij Noodtransport (pre.kind 'jump') spring je
// vrij: alleen het vakje waar je landt telt, niet wat je overvliegt (spelregel van de maker, 2026-11;
// de mens kreeg al alleen het landingsvakje). `path` = de hele zet (mergePreRollMove: eerst het
// sprongpad, dan de worp vanaf de landing).
function crystalPathOf(path, pre){
  if (!pre || pre.kind !== 'jump' || !pre.path || pre.path.length < 2) return path;
  return [pre.path[0]].concat(path.slice(pre.path.length - 1));
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
