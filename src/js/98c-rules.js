// ===================== TABBLAD SPELREGELS =====================
// Alle spelregels kort op een rij, van het opbouwen van het bord tot het einde van het potje.
// Bij een deel van de hoofdstukken staat rechts een kleine animatie die laat zien wat de regel
// betekent. Opmaak: src/rules.css (los bestand, door build.py achter styles.css geplakt).
//
// Waar het kan komt de tekst uit de spelgegevens zelf, zodat de regels niet achterlopen:
//   - energie-acties + prijs uit ENERGY_ACTIONS (95-simulate.js), op prijs gesorteerd
//   - kristallen uit ACTION_CARDS / ACTION_CARD_TINTS / CRYSTAL_WHEN / CRYSTAL_CATS
//   - getallen uit ENERGY_DIE_FACES, ENERGY_MAX, ACTION_CARD_HAND_MAX, SIM_QUESTS_TO_WIN
// Nieuwe energie-actie of nieuw kristal? Dan staat hij hier vanzelf bij. Een eigen korte zin
// voor een energie-actie zet je in RULES_ENERGY_TEXT (anders wordt `hint` gebruikt).
//
// Animaties: alleen Web Animations op transform/opacity (zie "Prestatie" in CLAUDE.md), elke
// scène is één lus van vaste duur. Ze lopen alleen als de scène in beeld is (IntersectionObserver)
// en het tabblad open staat; anders staan ze stil. Opgebouwd bij het eerste openen van het tabblad.

const RULES_ENERGY_TEXT = {
  boost:   'Gooi deze beurt met 3 loopstenen in plaats van 2.',
  reorder: 'Bekijk je volgende opdracht en kies welke van de twee je eerst doet.',
  gravity: `Schiet eerst rechtdoor tot een muur of pion, hooguit ${typeof GRAVITY_DASH_STEPS !== 'undefined' ? GRAVITY_DASH_STEPS : 8} vakjes. Kom je op je opdracht, dan stop je daar. Daarna gooi je.`,
  portal:  'Schiet een portaal rechtdoor tot de muur of tot vóór een pion, en kies welke kleur je verplaatst. Daarna gooi je.',
  jump:    `Spring eerst vrij naar een vakje binnen ${typeof ENERGY_JUMP_RANGE !== 'undefined' ? ENERGY_JUMP_RANGE : 11} stappen, over pionnen heen. Daarna gooi je.`,
};
const RULES_TINT_COLOR = { amber: 'var(--amber)', start: 'var(--start)', quest: 'var(--quest)', danger: 'var(--danger)', dim: 'var(--text-dim)' };
const RULES_WHEN_TEXT = {
  pre:   'Aan het begin van je beurt, voordat je dobbelt.',
  any:   'Voor het dobbelen of erna, zolang je beurt loopt.',
  start: 'Na het dobbelen, maar voordat je je eerste stap zet.',
  post:  'Na het dobbelen, ook tussen je stappen door.',
  auto:  'Je kiest hem niet zelf: het spel biedt hem aan zodra het kan.',
};

let rulesBuilt = false;
let rulesScenes = [];          // { stage, anims: Animation[], visible }
let rulesObserver = null;

// ---------- teksten ----------
function rulesSections(){
  const win = typeof SIM_QUESTS_TO_WIN !== 'undefined' ? SIM_QUESTS_TO_WIN : 6;
  const hand = typeof ACTION_CARD_HAND_MAX !== 'undefined' ? ACTION_CARD_HAND_MAX : 3;
  const eMax = typeof ENERGY_MAX !== 'undefined' ? ENERGY_MAX : 10;
  const faces = (typeof ENERGY_DIE_FACES !== 'undefined' ? ENERGY_DIE_FACES : [0, 1, 1, 2, 2, 3]).join(', ');
  const nCrystalKinds = typeof ACTION_CARD_IDS !== 'undefined' ? ACTION_CARD_IDS.length : 18;

  const energyRows = Object.entries(ENERGY_ACTIONS)
    .filter(([id]) => id !== 'none')
    .sort((a, b) => a[1].cost - b[1].cost)
    .map(([id, a]) => `<li class="rules-energy-row"><span class="rules-cost">${a.cost}</span>
        <span><b>${a.name}</b> ${RULES_ENERGY_TEXT[id] || (a.hint.charAt(0).toUpperCase() + a.hint.slice(1) + '.')}</span></li>`)
    .join('');

  return [
    { id: 'doel', title: 'Doel van het spel', scene: 'goal', html: `
      <ul class="rules-list">
        <li>Voltooi als eerste <b>${win} opdrachten</b>.</li>
        <li>Je speelt met 2 tot 4 spelers. Iedereen heeft een eigen stapel van 9 opdrachten.</li>
        <li>Je doet je opdrachten één voor één, in de volgorde van je stapel.</li>
      </ul>` },

    { id: 'bord', title: 'Het bord opbouwen', scene: 'board', html: `
      <ul class="rules-list">
        <li>Het bord bestaat uit <b>20 tegels</b> van 8 × 8 vakjes, in 4 rijen van 5. De plekken heten A t/m T.</li>
        <li>Er zijn <b>10 kamers</b> en <b>10 gangen</b>. Een kamer heeft een opdrachtvakje, een gang een kristalvakje.</li>
        <li>Je mag elke tegel een kwartslag draaien, zo vaak als je wilt.</li>
        <li><b>Hibernatie</b> heeft de 4 startvakjes en ligt binnenin: op G, H, I, L, M of N.</li>
        <li>Op een <b>hoek</b> (A, E, P en T) mag geen doorgang naar de rand van het bord wijzen.</li>
        <li>Elke doorgang sluit aan op een doorgang van de buurtegel. Er zijn geen doodlopende naden.</li>
        <li>Alle 20 tegels moeten met elkaar verbonden zijn.</li>
      </ul>
      <p class="rules-tip">Tip: het tabblad <b>Speelbord genereren</b> legt zo'n bord automatisch voor je.</p>` },

    { id: 'doorgang', title: 'Doorgangen', scene: 'doors', html: `
      <ul class="rules-list">
        <li>Midden op elke zijde van een tegel liggen twee <b>deurvakjes</b>.</li>
        <li>Zijn ze allebei vloer, dan is die zijde een <b>doorgang</b>. Is er één leeg, dan is het een muur.</li>
        <li>Liggen twee doorgangen tegen elkaar, dan loop je zo van de ene tegel naar de andere.</li>
      </ul>` },

    { id: 'klaar', title: 'Klaarzetten', html: `
      <ul class="rules-list">
        <li>Iedereen schudt zijn eigen <b>9 opdrachtkaarten</b> en legt ze gedekt neer.</li>
        <li>Je eerste opdracht blijft geheim tot jij je startvak mag kiezen.</li>
        <li>De <b>kristallen</b> vormen één gedeelde, geschudde stapel: ${nCrystalKinds} soorten, van elk 2.</li>
        <li>Leg het <b>blauwe</b> en het <b>rode portaal</b> op twee gewone vakjes, minstens ${typeof PORTAL_START_MIN_DIST !== 'undefined' ? PORTAL_START_MIN_DIST : 16} stappen uit elkaar.</li>
        <li>Iedereen begint met <b>0 energie</b> en een lege kluis.</li>
      </ul>` },

    { id: 'begin', title: 'Wie begint?', scene: 'opening', html: `
      <ul class="rules-list">
        <li>Iedereen gooit met 2 stenen.</li>
        <li>Wie het hoogst gooit, kiest als eerste een vrij startvak in Hibernatie. Daarna de rest, van hoog naar laag.</li>
        <li>Gooien spelers gelijk, dan gooien alleen die spelers opnieuw.</li>
        <li>De volgorde van kiezen is ook de <b>beurtvolgorde</b> van het hele potje.</li>
      </ul>
      <p class="rules-tip">Tip: kies het startvak dat het dichtst bij je eerste opdracht ligt.</p>` },

    { id: 'beurt', title: 'Je beurt', scene: 'turn', html: `
      <ol class="rules-steps">
        <li><b>Energie-actie</b> (mag). Kies er hooguit één en zet hem meteen in, vóór je gooit.</li>
        <li><b>Dobbelen.</b> Gooi de 2 loopstenen en de energiesteen.</li>
        <li><b>Lopen.</b> Zet precies zoveel stappen als de loopstenen samen aangeven.</li>
      </ol>
      <ul class="rules-list">
        <li>Je mag per beurt hooguit <b>1 kristal</b> spelen of afleggen, op het moment dat op het kristal staat.</li>
      </ul>` },

    { id: 'bewegen', title: 'Bewegen', scene: 'move', html: `
      <ul class="rules-list">
        <li>Je loopt alleen <b>recht</b>: horizontaal of verticaal, nooit schuin.</li>
        <li>Je loopt <b>precies</b> het gegooide aantal stappen.</li>
        <li><b>Niet omkeren:</b> je stapt nooit terug naar het vakje waar je net vandaan kwam.</li>
        <li>Een vakje met een andere pion is <b>bezet</b>. Je kunt er niet op en niet doorheen.</li>
        <li>Lege vakjes zijn muur. Daar kun je niet in.</li>
        <li>Loop je vast voordat je stappen op zijn, dan stop je op het laatste vakje dat je haalde.</li>
      </ul>` },

    { id: 'opdracht', title: 'Opdrachten', scene: 'quest', html: `
      <ul class="rules-list">
        <li>Kom je op het opdrachtvakje van je <b>huidige</b> opdracht, dan is die voltooid. Erover lopen telt ook.</li>
        <li>Je zet stopt daar niet: je loopt met de rest van je stappen gewoon door.</li>
        <li>Kom je daarbij ook langs je volgende opdracht, dan telt die ook meteen.</li>
        <li>Voor elke voltooide opdracht krijg je een <b>kristal</b>.</li>
        <li>Daarna draai je je volgende opdrachtkaart om.</li>
      </ul>` },

    { id: 'energie', title: 'Energie', scene: 'energy', html: `
      <ul class="rules-list">
        <li>De energiesteen heeft de kanten <b>${faces}</b>. Wat je gooit, krijg je erbij.</li>
        <li>Je hebt hoogstens <b>${eMax} energie</b>. Wat erboven komt, valt weg.</li>
        <li>Wat je deze beurt gooit, kun je pas <b>volgende beurt</b> uitgeven.</li>
        <li>Een energie-actie kies je vóór je gooit, hooguit één per beurt:</li>
      </ul>
      <ul class="rules-energy">${energyRows}</ul>` },

    { id: 'portaal', title: 'Portalen', scene: 'portal', html: `
      <ul class="rules-list">
        <li>Er liggen altijd twee portalen op het bord: een <b>blauwe</b> en een <b>rode</b>. Ze zijn van iedereen.</li>
        <li>Stap je in een portaal, dan kom je uit het andere en <b>stopt je zet</b> daar. De rest van je worp vervalt.</li>
        <li>Staat er een pion op een van de twee portalen, dan werkt het paar niet.</li>
        <li>Met de energie-actie <b>Portaalkanon</b> verplaats je een portaal. Het vliegt rechtdoor tot de muur of tot vóór een pion.</li>
        <li>Je kiest zelf welke kleur je verplaatst, ook als een ander hem legde.</li>
        <li>Een portaal landt nooit op een opdracht-, start- of kristalvakje.</li>
        <li>Noodtransport, de laarzen en duwkaarten gaan gewoon over een portaal heen.</li>
      </ul>` },

    { id: 'kristal', title: 'Kristallen', scene: 'crystal', html: `
      <ul class="rules-list">
        <li>Je krijgt een kristal als je een <b>opdracht voltooit</b>.</li>
        <li>Loop je over het paarse <b>kristalvakje</b> van een gang, dan krijg je er ook een. Je zet stopt daar niet voor.</li>
        <li>Kristalvakjes geven hooguit <b>1 kristal per beurt</b>, ook als je er meer passeert.</li>
        <li>Je kluis houdt hoogstens <b>${hand} kristallen</b>. Is hij vol, dan krijg je niets en blijft het kristal op de stapel.</li>
        <li>Je mag per beurt hooguit 1 kristal spelen of afleggen.</li>
        <li>Gebruikte kristallen gaan naar de aflegstapel. Is de stapel op, dan schud je de aflegstapel.</li>
        <li>Anderen zien alleen hoeveel kristallen je hebt, niet welke.</li>
      </ul>
      <h4 class="rules-sub">Wanneer mag een kristal?</h4>
      <p class="rules-note">Bovenin elk kristal staat het moment:</p>
      <ul class="rules-when">${Object.entries(CRYSTAL_WHEN).map(([k, label]) =>
        `<li><span class="rules-when-pill">${label}</span>${RULES_WHEN_TEXT[k] || ''}</li>`).join('')}</ul>
      <h4 class="rules-sub">Alle kristallen</h4>
      ${rulesCrystalTable()}` },

    { id: 'einde', title: 'Einde van het potje', scene: 'end', html: `
      <ul class="rules-list">
        <li>Wie als eerste ${win} opdrachten voltooit, is <b>1e</b> en gaat van het bord.</li>
        <li>De anderen spelen door tot alleen de laatste plaats nog over is.</li>
        <li>Een ronde wordt altijd helemaal uitgespeeld. Haalt iemand anders in dezelfde ronde ook zijn ${win}e opdracht, dan wint wie de meeste energie over heeft.</li>
        <li>Nog gelijk? Dan telt het aantal kristallen. Is ook dat gelijk, dan delen ze de plaats.</li>
      </ul>` },
  ];
}

function rulesCrystalTable(){
  const groups = {};
  for (const id of Object.keys(ACTION_CARDS)){
    const tint = ACTION_CARD_TINTS[id] || 'dim';
    (groups[tint] = groups[tint] || []).push(id);
  }
  return `<div class="rules-crystals">${Object.keys(CRYSTAL_CATS).filter(t => groups[t]).map(tint => `
    <div class="rules-crystal-group" style="--tint:${RULES_TINT_COLOR[tint] || 'var(--text-dim)'}">
      <div class="rules-crystal-cat">${CRYSTAL_CATS[tint]}</div>
      ${groups[tint].map(id => {
        const c = ACTION_CARDS[id];
        return `<div class="rules-crystal-row"><span class="rules-hex"></span>
          <span class="rules-crystal-name">${c.name}</span>
          <span class="rules-crystal-when">${CRYSTAL_WHEN[c.when] || ''}</span>
          <span class="rules-crystal-text">${c.text}</span></div>`;
      }).join('')}
    </div>`).join('')}</div>`;
}

// ---------- opbouw ----------
function renderRulesTab(){
  if (!rulesBuilt){
    rulesBuilt = true;
    const root = document.getElementById('rulesContent');
    const nav = document.getElementById('rulesNav');
    const sections = rulesSections();
    nav.innerHTML = sections.map((s, i) =>
      `<a href="#rules-${s.id}" data-rules-id="${s.id}"><span>${i + 1}</span>${s.title}</a>`).join('');
    root.innerHTML = sections.map((s, i) => `
      <section class="rules-section${s.scene ? ' has-scene' : ''}" id="rules-${s.id}">
        <div class="rules-text">
          <h3><span class="rules-num">${i + 1}</span>${s.title}</h3>
          ${s.html}
        </div>
        ${s.scene ? `<div class="rules-stage" data-scene="${s.scene}"></div>` : ''}
      </section>`).join('');
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-rules-id]');
      if (!a) return;
      e.preventDefault();
      const target = document.getElementById('rules-' + a.dataset.rulesId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    for (const stage of root.querySelectorAll('.rules-stage')){
      const build = RULES_SCENES[stage.dataset.scene];
      let anims = [];
      try { anims = build ? build(stage) : []; } catch (err){ console.error('Spelregels-animatie', stage.dataset.scene, err); }
      anims.forEach(a => a.pause());
      rulesScenes.push({ stage, anims, visible: false });
    }
    rulesObserver = new IntersectionObserver((entries) => {
      for (const en of entries){
        const sc = rulesScenes.find(s => s.stage === en.target);
        if (!sc) continue;
        sc.visible = en.isIntersecting;
        sc.anims.forEach(a => sc.visible ? a.play() : a.pause());
      }
    }, { threshold: 0.15 });
    rulesScenes.forEach(s => rulesObserver.observe(s.stage));
    rulesWatchNav(sections);
  }
}

// het hoofdstuk dat bovenin beeld staat, licht op in de inhoudsopgave
function rulesWatchNav(sections){
  const links = [...document.querySelectorAll('#rulesNav a')];
  const io = new IntersectionObserver((entries) => {
    for (const en of entries){
      if (!en.isIntersecting) continue;
      const id = en.target.id.replace('rules-', '');
      links.forEach(l => l.classList.toggle('active', l.dataset.rulesId === id));
    }
  }, { rootMargin: '-20% 0px -70% 0px' });
  sections.forEach(s => { const el = document.getElementById('rules-' + s.id); if (el) io.observe(el); });
}

// ---------- hulpjes voor de animaties ----------
function rEl(parent, cls, html = '', style = ''){
  const el = document.createElement('div');
  el.className = cls;
  if (html) el.innerHTML = html;
  if (style) el.style.cssText = style;
  parent.appendChild(el);
  return el;
}
// Lus van `dur` ms. `pts` = [[t, waarde], ...] met t tussen 0 en 1: op t springt de eigenschap
// (met een korte overgang van `ease` lang) naar de nieuwe waarde. Begin- en eindwaarde zijn gelijk
// aan `start` tenzij een punt dat anders zegt, dus de lus loopt naadloos.
function rTrack(el, prop, start, pts, dur, ease = 0.02){
  const frames = [{ offset: 0, [prop]: start }];
  let cur = start;
  for (const [t, v] of pts){
    const t0 = Math.max(frames[frames.length - 1].offset, Math.min(1, t));
    const t1 = Math.min(1, t0 + ease);
    frames.push({ offset: t0, [prop]: cur, easing: 'ease-out' });
    frames.push({ offset: t1, [prop]: v });
    cur = v;
  }
  frames.push({ offset: 1, [prop]: cur });
  return el.animate(frames, { duration: dur, iterations: Infinity, fill: 'both' });
}
// zichtbaar van tIn tot tOut (met een kleine groei bij het verschijnen als pop = true)
function rShow(el, tIn, tOut, dur, pop = false){
  const a = [rTrack(el, 'opacity', 0, [[tIn, 1], [tOut, 0]], dur, 0.025)];
  if (pop) a.push(rTrack(el, 'transform', 'scale(.4)', [[tIn, 'scale(1)'], [tOut + 0.03, 'scale(.4)']], dur, 0.04));
  return a;
}
// pion over een pad van [kolom, rij]-vakjes; translate in % van de pion zelf (= 1 vakje)
function rWalk(el, path, tStart, tStep, dur){
  const tf = ([c, r]) => `translate(${c * 100}%, ${r * 100}%)`;
  const frames = [{ offset: 0, transform: tf(path[0]) }, { offset: tStart, transform: tf(path[0]), easing: 'ease-in-out' }];
  path.slice(1).forEach((p, i) => frames.push({ offset: Math.min(1, tStart + (i + 1) * tStep), transform: tf(p), easing: 'ease-in-out' }));
  frames.push({ offset: 1, transform: tf(path[path.length - 1]) });
  return el.animate(frames, { duration: dur, iterations: Infinity, fill: 'both' });
}
// klein vakjesraster: '#' = muur (leeg), '.' = vloer, 'Q' = opdracht, 'C' = kristalvakje
function rGrid(parent, rows, cell){
  const g = rEl(parent, 'rg', '', `--rc:${cell}px;width:${rows[0].length * cell}px;height:${rows.length * cell}px`);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '#') return;
    const cls = ch === 'Q' ? ' is-quest' : ch === 'C' ? ' is-crystal' : ch === 'D' ? ' is-door' : '';
    rEl(g, 'rg-cell' + cls, ch === 'C' ? '<i></i>' : '', `left:${c * cell}px;top:${r * cell}px`);
  }));
  return g;
}
function rAt(parent, cls, c, r, cell, html = ''){
  return rEl(parent, cls, html, `left:${c * cell}px;top:${r * cell}px;width:${cell}px;height:${cell}px`);
}
function rPawn(parent, color, cell){
  const p = rEl(parent, 'rg-pawn', '<i></i>', `width:${cell}px;height:${cell}px;--pc:${color}`);
  return p;
}
function rCaption(stage, texts, dur){
  // texts: [[tIn, tOut, tekst], ...] — onder de scène, telkens één zichtbaar
  const box = rEl(stage, 'rules-cap');
  const anims = [];
  for (const [a, b, t] of texts) anims.push(...rShow(rEl(box, 'rules-cap-line', t), a, b, dur));
  return anims;
}
const RULES_HEX = '<svg viewBox="0 0 48 48"><polygon points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5"/></svg>';
function rDie(parent, value){
  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[value] || [];
  return rEl(parent, 'rules-die', Array.from({ length: 9 }, (_, i) => `<i${pips.includes(i) ? ' class="on"' : ''}></i>`).join(''));
}

// ---------- de scènes ----------
const RULES_SCENES = {
  // 6 zeshoekjes lopen vol, daarna "Gewonnen"
  goal(stage){
    const D = 7000, anims = [];
    const scene = rEl(stage, 'rules-scene rs-goal');
    const row = rEl(scene, 'rs-hexrow');
    for (let i = 0; i < 6; i++){
      const h = rEl(row, 'rs-hex', RULES_HEX);
      const fill = rEl(h, 'rs-hex-fill', RULES_HEX + '<b>✓</b>');
      anims.push(...rShow(fill, 0.08 + i * 0.1, 0.93, D, true));
    }
    const win = rEl(scene, 'rs-win', 'Gewonnen!');
    anims.push(...rShow(win, 0.7, 0.93, D, true));
    anims.push(...rCaption(stage, [[0.02, 0.66, 'Elke voltooide opdracht vult een vakje'], [0.68, 0.95, 'Als eerste 6 = winnaar']], D));
    return anims;
  },

  // 20 tegels vallen op hun plek, hoeken oranje, binnenring groen, Hibernatie landt op H
  board(stage){
    const D = 8500, anims = [], S = 44, G = 4;
    const scene = rEl(stage, 'rules-scene');
    const grid = rEl(scene, 'rs-board', '', `width:${5 * S + 4 * G}px;height:${4 * S + 3 * G}px`);
    const letters = 'ABCDEFGHIJKLMNOPQRST';
    const corners = [0, 4, 15, 19], inner = [6, 7, 8, 11, 12, 13];
    for (let i = 0; i < 20; i++){
      const c = i % 5, r = Math.floor(i / 5);
      const tile = rEl(grid, 'rs-tile', `<span>${letters[i]}</span>`, `left:${c * (S + G)}px;top:${r * (S + G)}px;width:${S}px;height:${S}px`);
      const t = 0.03 + i * 0.022;
      anims.push(rTrack(tile, 'opacity', 0, [[t, 1], [0.95, 0]], D, 0.03));
      anims.push(rTrack(tile, 'transform', 'translateY(-14px) scale(.8)', [[t, 'none'], [0.98, 'translateY(-14px) scale(.8)']], D, 0.04));
      if (corners.includes(i)) anims.push(...rShow(rEl(tile, 'rs-tile-corner'), 0.52, 0.66, D));
      if (inner.includes(i)) anims.push(...rShow(rEl(tile, 'rs-tile-inner'), 0.68, 0.93, D));
    }
    const hib = rEl(grid, 'rs-hib', '<i></i><i></i><i></i><i></i>', `left:${2 * (S + G)}px;top:${1 * (S + G)}px;width:${S}px;height:${S}px`);
    anims.push(rTrack(hib, 'opacity', 0, [[0.76, 1], [0.93, 0]], D, 0.03));
    anims.push(rTrack(hib, 'transform', 'translateY(-30px) scale(1.4)', [[0.76, 'none'], [0.96, 'translateY(-30px) scale(1.4)']], D, 0.05));
    anims.push(...rCaption(stage, [
      [0.02, 0.5, '20 tegels in 4 rijen van 5'],
      [0.52, 0.66, 'Hoeken: geen doorgang naar buiten'],
      [0.68, 0.95, 'Hibernatie ligt binnenin'],
    ], D));
    return anims;
  },

  // twee tegels: deurvakjes lichten op, de naad wordt een doorgang, een pion loopt erdoor
  doors(stage){
    const D = 7500, anims = [], C = 12;
    const rows = [];
    for (let r = 0; r < 8; r++){
      let s = '';
      for (let c = 0; c < 17; c++){
        const lc = c, rc = c - 9;
        let ch = '#';
        if (c < 8){
          if (r >= 1 && r <= 6 && lc >= 1 && lc <= 6) ch = '.';
          if ((r === 3 || r === 4) && lc === 7) ch = 'D';
          if (r === 0 && (lc === 3 || lc === 4)) ch = 'D';
        } else if (c > 8){
          if (r >= 1 && r <= 6 && rc >= 1 && rc <= 6) ch = '.';
          if ((r === 3 || r === 4) && rc === 0) ch = 'D';
          if (r === 7 && (rc === 3 || rc === 4)) ch = 'D';
          if (r === 0 && rc === 3) ch = 'D';   // maar één deurvakje: geen doorgang
        }
        s += ch;
      }
      rows.push(s);
    }
    const scene = rEl(stage, 'rules-scene');
    const g = rGrid(scene, rows, C);
    g.classList.add('rs-doors');
    // tegelranden
    rEl(g, 'rs-tile-outline', '', `left:0;top:0;width:${8 * C}px;height:${8 * C}px`);
    rEl(g, 'rs-tile-outline', '', `left:${9 * C}px;top:0;width:${8 * C}px;height:${8 * C}px`);
    // deurvakjes oplichten
    g.querySelectorAll('.rg-cell.is-door').forEach(d => anims.push(...rShow(rEl(d, 'rs-door-glow'), 0.08, 0.93, D)));
    // de doorgang (naad tussen de tegels) wordt groen
    anims.push(...rShow(rEl(g, 'rs-seam', '', `left:${7 * C}px;top:${3 * C}px;width:${3 * C}px;height:${2 * C}px`), 0.3, 0.93, D));
    // halve deur rechtsboven: rood
    anims.push(...rShow(rAt(g, 'rs-bad', 12, 0, C, '✕'), 0.3, 0.93, D, true));
    const pawn = rPawn(g, 'var(--amber)', C);
    const path = [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 3]];
    anims.push(rWalk(pawn, path, 0.42, 0.045, D));
    anims.push(rTrack(pawn, 'opacity', 0, [[0.36, 1], [0.93, 0]], D, 0.03));
    anims.push(...rCaption(stage, [
      [0.02, 0.28, 'Twee deurvakjes midden op een zijde'],
      [0.3, 0.95, 'Beide vloer = doorgang · één leeg = muur'],
    ], D));
    return anims;
  },

  // drie spelers gooien, rijen schuiven naar de nieuwe volgorde
  opening(stage){
    const D = 8000, anims = [], H = 46;
    const scene = rEl(stage, 'rules-scene');
    const list = rEl(scene, 'rs-open', '', `height:${3 * H}px`);
    const players = [
      { name: 'Rood', color: '#ff6b6b', d: [4, 3], to: 1 },
      { name: 'Blauw', color: '#4fb8e0', d: [6, 5], to: 0 },
      { name: 'Groen', color: '#55d68a', d: [2, 3], to: 2 },
    ];
    players.forEach((p, i) => {
      const row = rEl(list, 'rs-open-row', `<span class="rs-dot" style="background:${p.color}"></span><span class="rs-open-name">${p.name}</span>`, `top:${i * H}px`);
      const dice = rEl(row, 'rs-open-dice');
      p.d.forEach((v, k) => {
        const slot = rEl(dice, 'rs-die-slot');
        const q = rEl(slot, 'rules-die is-q', '?');
        const die = rDie(slot, v);
        const t = 0.1 + i * 0.09 + k * 0.03;
        anims.push(rTrack(q, 'opacity', 1, [[t, 0], [0.95, 1]], D));
        anims.push(...rShow(die, t, 0.93, D, true));
      });
      const sum = rEl(row, 'rs-open-sum');
      anims.push(...rShow(rEl(sum, 'rs-sum-val', String(p.d[0] + p.d[1])), 0.16 + i * 0.09 + 0.03, 0.93, D, true));
      const tag = rEl(row, 'rs-open-tag', ['1e kiest', '2e', '3e'][p.to]);
      anims.push(...rShow(tag, 0.66 + p.to * 0.05, 0.93, D, true));
      const dy = (p.to - i) * H;
      anims.push(rTrack(row, 'transform', 'none', [[0.48, `translateY(${dy}px)`], [0.95, 'none']], D, 0.12));
    });
    anims.push(...rCaption(stage, [
      [0.02, 0.46, 'Iedereen gooit 2 stenen'],
      [0.48, 0.95, 'Hoogste kiest als eerste een startvak'],
    ], D));
    return anims;
  },

  // de drie stappen van een beurt, om de beurt uitgelicht
  turn(stage){
    const D = 9000, anims = [], H = 56;
    const scene = rEl(stage, 'rules-scene');
    const list = rEl(scene, 'rs-turn', '', `height:${3 * H}px`);
    const hl = rEl(list, 'rs-turn-hl', '', `height:${H - 8}px`);
    anims.push(rTrack(hl, 'transform', 'translateY(0px)', [[0.33, `translateY(${H}px)`], [0.64, `translateY(${2 * H}px)`], [0.96, 'translateY(0px)']], D, 0.04));
    const steps = [
      ['1', 'Energie-actie', 'mag, vóór je gooit'],
      ['2', 'Dobbelen', '2 loopstenen + energiesteen'],
      ['3', 'Lopen', 'precies je worp · hooguit 1 kristal'],
    ];
    steps.forEach(([n, t, sub], i) => rEl(list, 'rs-turn-row', `<span class="rs-turn-n">${n}</span><span><b>${t}</b><small>${sub}</small></span>`, `top:${i * H}px;height:${H - 8}px`));
    // kleine illustraties rechts in elke rij
    const bolt = rEl(list, 'rs-turn-ico', '⚡', `top:${0 * H}px;height:${H - 8}px`);
    anims.push(rTrack(bolt, 'opacity', 0.25, [[0.04, 1], [0.32, 0.25]], D));
    const dice = rEl(list, 'rs-turn-ico rs-turn-dice', '', `top:${1 * H}px;height:${H - 8}px`);
    rDie(dice, 3); rDie(dice, 4);
    anims.push(rTrack(dice, 'opacity', 0.25, [[0.35, 1], [0.63, 0.25]], D));
    anims.push(rTrack(dice, 'transform', 'rotate(0deg)', [[0.35, 'rotate(-12deg)'], [0.4, 'rotate(0deg)']], D, 0.03));
    const feet = rEl(list, 'rs-turn-ico', '7 →', `top:${2 * H}px;height:${H - 8}px`);
    anims.push(rTrack(feet, 'opacity', 0.25, [[0.66, 1], [0.95, 0.25]], D));
    anims.push(...rCaption(stage, [[0.02, 0.95, 'Elke beurt in deze volgorde']], D));
    return anims;
  },

  // pion loopt 7 stappen, bezet vakje licht rood op
  move(stage){
    const D = 9000, anims = [], C = 30;
    const rows = ['.......', '.##.##.', '.......', '.##.##.', '.......'];
    const scene = rEl(stage, 'rules-scene');
    const g = rGrid(scene, rows, C);
    const path = [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]];
    const t0 = 0.16, st = 0.075;
    // voetstappen 1..7
    path.slice(1).forEach(([c, r], i) => anims.push(...rShow(rAt(g, 'rs-step', c, r, C, String(i + 1)), t0 + (i + 1) * st, 0.93, D, true)));
    // tegenstander + rode ring zodra je ernaast staat
    rAt(g, 'rg-pawn is-static', 1, 2, C, '<i></i>').style.setProperty('--pc', '#4fb8e0');
    anims.push(...rShow(rAt(g, 'rs-blocked', 1, 2, C), t0 + 2 * st, t0 + 4 * st, D));
    const pawn = rPawn(g, 'var(--amber)', C);
    anims.push(rWalk(pawn, path, t0, st, D));
    anims.push(rTrack(pawn, 'opacity', 0, [[0.04, 1], [0.93, 0]], D));
    // worp
    const roll = rEl(scene, 'rs-roll');
    rDie(roll, 3); rDie(roll, 4);
    rEl(roll, 'rs-roll-sum', '= 7');
    anims.push(...rShow(roll, 0.04, 0.93, D, true));
    anims.push(...rCaption(stage, [
      [0.02, 0.3, 'Je gooit 7: je loopt precies 7 stappen'],
      [0.3, 0.46, 'Bezet vakje: daar kun je niet langs'],
      [0.46, 0.95, 'Alleen recht, nooit schuin of terug'],
    ], D));
    return anims;
  },

  // over het opdrachtvakje heen: vinkje, vakje vult, en de pion loopt door
  quest(stage){
    const D = 8000, anims = [], C = 30;
    const scene = rEl(stage, 'rules-scene');
    const g = rGrid(scene, ['....Q...'], C);
    const t0 = 0.14, st = 0.075;
    const pawn = rPawn(g, 'var(--amber)', C);
    const path = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]];
    anims.push(rWalk(pawn, path, t0, st, D));
    anims.push(rTrack(pawn, 'opacity', 0, [[0.04, 1], [0.93, 0]], D));
    const tHit = t0 + 4 * st;
    anims.push(...rShow(rAt(g, 'rs-done', 4, 0, C, '✓'), tHit, 0.93, D, true));
    const plus = rAt(g, 'rs-plus', 4, 0, C, '+1 kristal');
    anims.push(rTrack(plus, 'opacity', 0, [[tHit + 0.02, 1], [tHit + 0.2, 0]], D, 0.03));
    anims.push(rTrack(plus, 'transform', 'translateY(0px)', [[tHit + 0.02, 'translateY(-26px)'], [0.97, 'translateY(0px)']], D, 0.2));
    const row = rEl(scene, 'rs-hexrow is-small');
    for (let i = 0; i < 6; i++){
      const h = rEl(row, 'rs-hex', RULES_HEX);
      const fill = rEl(h, 'rs-hex-fill', RULES_HEX + '<b>✓</b>');
      if (i < 2) fill.style.opacity = '1';
      else if (i === 2) anims.push(...rShow(fill, tHit, 0.93, D, true));
    }
    anims.push(...rCaption(stage, [
      [0.02, tHit - 0.01, 'Je gooit 6, je opdracht ligt 4 verder'],
      [tHit, 0.95, 'Voltooid! En je loopt gewoon door'],
    ], D));
    return anims;
  },

  // energiesteen rolt, twee knooppunten laden op; volgende beurt Stuwstoot (−4)
  energy(stage){
    const D = 9500, anims = [];
    const scene = rEl(stage, 'rules-scene');
    const die = rEl(scene, 'rs-edie');
    const faces = [3, 1, 0, 2, 1, 3, 2];
    faces.forEach((v, i) => {
      const f = rEl(die, 'rs-edie-face', `<span>${v}</span>`);
      const tIn = 0.04 + i * 0.03, last = i === faces.length - 1;
      anims.push(rTrack(f, 'opacity', 0, [[tIn, 1], [last ? 0.93 : tIn + 0.03, 0]], D, 0.005));
    });
    rEl(die, 'rs-edie-bolt', '⚡');
    const bar = rEl(scene, 'rs-ebar');
    const startLit = 3, gain = 2, cost = 4;
    for (let i = 0; i < 10; i++){
      const node = rEl(bar, 'rs-enode');
      const lit = rEl(node, 'rs-enode-lit');
      const pts = [];
      let initial = i < startLit ? 1 : 0;
      if (i >= startLit && i < startLit + gain) pts.push([0.3 + (i - startLit) * 0.04, 1]);
      const after = startLit + gain;            // 5 aan
      if (i < after && i >= after - cost) pts.push([0.66 + (after - 1 - i) * 0.03, 0]);
      if (i < startLit && i >= after - cost) pts.push([0.95, 1]);
      anims.push(rTrack(lit, 'opacity', initial, pts, D, 0.02));
    }
    const num = rEl(scene, 'rs-enum');
    [[0, 0.32, '3'], [0.32, 0.68, '5'], [0.68, 0.97, '1']].forEach(([a, b, t]) => {
      const s = rEl(num, 'rs-enum-v', t);
      if (a === 0) anims.push(rTrack(s, 'opacity', 1, [[b, 0], [0.97, 1]], D));
      else anims.push(...rShow(s, a, b, D));
    });
    const act = rEl(scene, 'rs-eact', '<b>Stuwstoot</b> −4 · 3 loopstenen');
    anims.push(...rShow(act, 0.62, 0.93, D, true));
    anims.push(...rCaption(stage, [
      [0.02, 0.28, 'De energiesteen rolt: 2'],
      [0.3, 0.58, '+2 energie, voor je volgende beurt'],
      [0.6, 0.95, 'Volgende beurt, vóór het gooien: uitgeven'],
    ], D));
    return anims;
  },

  // pion stapt in het blauwe portaal, komt uit het rode en stopt; de rest van de worp vervalt
  portal(stage){
    const D = 8500, anims = [], C = 30;
    const scene = rEl(stage, 'rules-scene');
    const g = rGrid(scene, ['........', '###.####', '........'], C);
    const blue = rAt(g, 'rs-portal', 5, 0, C, '<i></i>');
    const red = rAt(g, 'rs-portal is-red', 2, 2, C, '<i></i>');
    [blue, red].forEach(p => anims.push(rTrack(p.firstChild, 'opacity', 0.55, [[0.1, 1], [0.2, 0.55], [0.3, 1], [0.4, 0.55], [0.5, 1], [0.95, 0.55]], D, 0.05)));
    const t0 = 0.14, st = 0.075;
    const pawn = rPawn(g, 'var(--amber)', C);
    const path = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
    anims.push(rWalk(pawn, path, t0, st, D));
    const tIn = t0 + 5 * st;          // op het blauwe portaal
    anims.push(rTrack(pawn, 'opacity', 0, [[0.04, 1], [tIn + 0.02, 0]], D, 0.03));
    const out = rPawn(g, 'var(--amber)', C);
    out.style.transform = 'translate(200%, 200%)';
    anims.push(rTrack(out, 'opacity', 0, [[tIn + 0.05, 1], [0.93, 0]], D, 0.03));
    anims.push(...rShow(rAt(g, 'rs-stop', 2, 2, C, 'stop'), tIn + 0.08, 0.93, D, true));
    const roll = rEl(scene, 'rs-roll');
    rDie(roll, 3); rDie(roll, 5);
    rEl(roll, 'rs-roll-sum', '= 8');
    anims.push(...rShow(roll, 0.04, 0.93, D, true));
    anims.push(...rShow(rEl(scene, 'rs-lost', '3 stappen vervallen'), tIn + 0.1, 0.93, D, true));
    anims.push(...rCaption(stage, [
      [0.02, tIn - 0.01, 'Je gooit 8 en loopt naar het blauwe portaal'],
      [tIn, 0.95, 'Uit het rode portaal: je zet stopt daar'],
    ], D));
    return anims;
  },

  // kristalvakje: kristal vliegt naar de kluis; het tweede vakje geeft niets meer
  crystal(stage){
    const D = 8500, anims = [], C = 30;
    const scene = rEl(stage, 'rules-scene rs-crys');
    const vault = rEl(scene, 'rs-vault');
    const slots = [0, 1, 2].map(() => rEl(vault, 'rs-slot', RULES_HEX));
    const g = rGrid(scene, ['..C...C..'], C);
    const t0 = 0.14, st = 0.07;
    const pawn = rPawn(g, 'var(--amber)', C);
    const path = Array.from({ length: 9 }, (_, i) => [i, 0]);
    anims.push(rWalk(pawn, path, t0, st, D));
    anims.push(rTrack(pawn, 'opacity', 0, [[0.04, 1], [0.93, 0]], D));
    const tHit = t0 + 2 * st, tHit2 = t0 + 6 * st;
    // vliegend kristal: van vakje 2 naar plek 1 van de kluis (kluis en raster allebei gecentreerd)
    const fly = rAt(g, 'rs-fly', 2, 0, C, RULES_HEX);
    // kluis = 3 plekken van 34px met 6px ertussen, 26px boven het raster (zie .rs-vault in rules.css)
    const gridW = 9 * C, vaultW = 3 * 34 + 2 * 6;
    const dx = (gridW - vaultW) / 2 + 17 - (2 * C + C / 2), dy = -(26 + 17 + C / 2);
    anims.push(rTrack(fly, 'opacity', 0, [[tHit, 1], [tHit + 0.16, 0], [0.97, 0]], D, 0.02));
    anims.push(rTrack(fly, 'transform', 'translate(0px, 0px) scale(1)', [[tHit + 0.01, `translate(${dx}px, ${dy}px) scale(1.25)`], [0.97, 'translate(0px, 0px) scale(1)']], D, 0.15));
    const got = rEl(slots[0], 'rs-slot-fill', RULES_HEX);
    anims.push(...rShow(got, tHit + 0.15, 0.93, D, true));
    // eerste kristalvakje is leeg na het oprapen
    const firstGem = g.querySelectorAll('.rg-cell.is-crystal i')[0];
    anims.push(rTrack(firstGem, 'opacity', 1, [[tHit, 0.15], [0.95, 1]], D));
    // tweede: geeft niets meer deze beurt
    anims.push(...rShow(rAt(g, 'rs-no', 6, 0, C, '✕'), tHit2, 0.93, D, true));
    anims.push(...rCaption(stage, [
      [0.02, tHit - 0.01, 'Over een kristalvakje lopen…'],
      [tHit, tHit2 - 0.01, '…kristal naar je kluis, en je loopt door'],
      [tHit2, 0.95, 'Hooguit 1 kristal per beurt van vakjes'],
    ], D));
    return anims;
  },

  // vier spelers lopen vol tot 6; de plaatsen vallen één voor één, de laatste vanzelf
  end(stage){
    const D = 9500, anims = [];
    const scene = rEl(stage, 'rules-scene');
    const list = rEl(scene, 'rs-end');
    const players = [
      { name: 'Rood', color: '#ff6b6b', done: 0.38, rank: '1e' },
      { name: 'Blauw', color: '#4fb8e0', done: 0.55, rank: '2e' },
      { name: 'Groen', color: '#55d68a', done: 0.7, rank: '3e' },
      { name: 'Geel', color: '#ffd84f', done: null, upto: 4, rank: '4e' },
    ];
    players.forEach((p) => {
      const row = rEl(list, 'rs-end-row', `<span class="rs-dot" style="background:${p.color}"></span><span class="rs-open-name">${p.name}</span>`);
      const pips = rEl(row, 'rs-end-pips');
      const n = p.done ? 6 : p.upto;
      const tEnd = p.done || 0.62;
      for (let i = 0; i < 6; i++){
        const pip = rEl(pips, 'rs-pip');
        if (i < n){
          const lit = rEl(pip, 'rs-pip-lit', '', `background:${p.color}`);
          anims.push(...rShow(lit, 0.05 + (tEnd - 0.05) * (i + 1) / n, 0.93, D));
        }
      }
      const tag = rEl(row, 'rs-open-tag' + (p.rank === '1e' ? ' is-gold' : ''), p.rank);
      anims.push(...rShow(tag, p.done || 0.74, 0.93, D, true));
    });
    anims.push(...rCaption(stage, [
      [0.02, 0.37, 'Wie als eerste 6 opdrachten heeft…'],
      [0.38, 0.72, '…is 1e. De rest speelt door'],
      [0.74, 0.95, 'Plaats 4 ligt vast: het potje is klaar'],
    ], D));
    return anims;
  },
};
