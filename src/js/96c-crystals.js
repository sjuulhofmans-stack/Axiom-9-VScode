// ---------- kristallen: tekenen, de kluis, en de animaties bij het oprapen ----------
// Op het scherm heten de actiekaarten "kristallen" (zie CLAUDE.md). Dit bestand doet alles wat
// je ervan ZIET; de spelregels blijven waar ze waren (95-simulate.js / 96-walk.js / 97-solo.js).
//
//   renderCrystal(id)        één kristal: zeshoek, rand in de kleur van de soort, bovenin het
//                            moment (CRYSTAL_WHEN), icoon, naam, uitleg, onderin de soort
//   crystalRenderVault(...)  de kluis in de zijkolom: groot het gekozen kristal, ernaast de drie
//                            plekken, de reden waarom het nu (niet) kan, Gebruik/Afleggen
//   crystalEvent(...)        iemand raapt een kristal op (of zijn kluis is vol): bij jezelf groeit
//                            het kristal uit het vakje en vliegt het in een boog naar je kluis (of
//                            knalt het uit elkaar), bij een ander glijdt er anoniem een zilver
//                            kristalletje naar diens spelerskaartje — je ziet dát, niet wát
//   crystalPipsHtml(p)       de drie zeshoekjes op een spelerskaartje (renderWalkScore)
//
// Staat in de bouwvolgorde bewust VÓÓR 97-solo.js: die roept bij het laden al setWalkMode('auto')
// aan, en via stopSoloGame/stopWalkSimulation komt dat bij crystalResetVault() — de consts
// hieronder moeten dan al bestaan. Zelf gebruikt dit bestand bij het laden alleen 95-simulate.js
// (ACTION_CARDS e.d.); al het andere (soloPlayers, mp, btnCardPlay, …) pas tijdens het spelen.

// ---------- vorm ----------
// Langgerekte zeshoek met de punt boven, viewBox 200×290. De rechte zijkanten lopen van 21% tot
// 79% van de hoogte; daar staan naam en uitleg. Zelfde punten als de CSS-clip-path van .crystal-hex.
const CRYSTAL_OUT = [[100,4],[196,62],[196,228],[100,286],[4,228],[4,62]];
const CRYSTAL_IN = CRYSTAL_OUT.map(([x, y]) => [100 + (x-100)*.84, 145 + (y-145)*.84]);
const CRYSTAL_FACETS = [.30, .16, .08, .05, .10, .20];   // facet-licht: linksboven het felst
const crystalPts = a => a.map(p => p.join(',')).join(' ');
const CRYSTAL_ICON_MYSTERY = `<path d="M17 17 Q17 9 24 9 Q31 9 31 16 Q31 21 26 23 Q24 24 24 28 L24 30"/><circle cx="24" cy="37" r="2.2" fill="currentColor" stroke="none"/>`;

function crystalShapeSvg(empty){
  if (empty){
    return `<svg class="crystal-shape" viewBox="0 0 200 290" aria-hidden="true"><polygon points="${crystalPts(CRYSTAL_OUT)}" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="4" stroke-dasharray="9 8"/></svg>`;
  }
  let facets = '';
  for (let i = 0; i < 6; i++){
    const j = (i + 1) % 6;
    facets += `<polygon points="${crystalPts([CRYSTAL_OUT[i], CRYSTAL_OUT[j], CRYSTAL_IN[j], CRYSTAL_IN[i]])}" fill="currentColor" fill-opacity="${CRYSTAL_FACETS[i]}"/>`;
  }
  return `<svg class="crystal-shape" viewBox="0 0 200 290" aria-hidden="true">
    <polygon points="${crystalPts(CRYSTAL_OUT)}" fill="#0d1218"/>${facets}
    <polygon points="${crystalPts(CRYSTAL_IN)}" fill="#0d1218"/>
    <polygon points="${crystalPts(CRYSTAL_IN)}" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".45" stroke-width="1.2"/>
    <polygon points="${crystalPts(CRYSTAL_OUT)}" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/>
    <line x1="${CRYSTAL_IN[5][0]}" y1="${CRYSTAL_IN[5][1]}" x2="${CRYSTAL_IN[0][0]}" y2="${CRYSTAL_IN[0][1]}" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>
  </svg>`;
}
const crystalIconSvg = inner =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// Eén kristal (sinds 2026-11, artifact "Axiom-9 Energie en kluis", variant 3+): op het kristal staan
// alleen nog het icoon en de naam. Soort, moment en uitleg staan in het uitlegvak eronder
// (crystalInfoHtml). size 'lg' = icoon + naam, 'sm' = alleen het icoon (de plekjes in de kluis).
// `tag`/`attrs` maken er een knop van; `state` zijn extra klassen (is-locked, is-picked, is-new).
function renderCrystal(id, { size = 'lg', state = '', tag = 'div', attrs = '' } = {}){
  const cat = ACTION_CARD_TINTS[id];
  const inner = size === 'sm'
    ? `<span class="crystal-layer"><span class="crystal-ico">${crystalIconSvg(ACTION_CARD_ICONS[id])}</span></span>`
    : crystalArtSvg(id);
  return `<${tag} class="crystal crystal--${size} crystal--${cat} ${state}" ${attrs}>${crystalShapeSvg(false)}${inner}</${tag}>`;
}
// icoon + lijntje + naam als één SVG in dezelfde 200×290 als de vorm: schaalt in z'n geheel mee, en
// een lange naam wordt smaller gezet (textLength) in plaats van midden in een woord af te breken
// (zo stond er vroeger "SCHROEVENDRAAI / ER"). Na een streepje of spatie mag de naam op 2 regels.
function crystalNameLines(name){
  const u = name.toUpperCase();
  const dash = u.indexOf('-');
  if (dash > 0) return [u.slice(0, dash + 1), u.slice(dash + 1)];
  if (u.length > 11 && u.indexOf(' ') > 0) return u.split(' ');
  return [u];
}
function crystalArtSvg(id){
  const lines = crystalNameLines(ACTION_CARDS[id].name);
  const two = lines.length > 1, fs = two ? 22 : 24, y0 = two ? 194 : 206, maxW = 150;
  const s = 88 / 48, iy = two ? 112 : 120;
  const text = lines.map((l, i) => {
    const fit = l.length * fs * .55 > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="100" y="${y0 + i * (fs + 3)}" text-anchor="middle" font-size="${fs}"${fit}>${l}</text>`;
  }).join('');
  const ly = two ? 166 : 176;
  return `<svg class="crystal-art" viewBox="0 0 200 290" aria-hidden="true">
    <g transform="translate(${100 - 44},${iy - 44}) scale(${s})" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${ACTION_CARD_ICONS[id]}</g>
    <line x1="74" y1="${ly}" x2="126" y2="${ly}" stroke="currentColor" stroke-opacity=".6" stroke-width="1.5"/>${text}</svg>`;
}
// De schroevendraaier (gekozen icoon 1 "schuin, twee kleuren", 2026-11): gevuld, koperen handvat
// met groeven, zilveren schacht. mode 'color' = je hebt hem, 'off' = grijs (je hebt hem niet),
// 'mono' = in de tekstkleur (energie-actie en kruip-knop). Losstaand (geen andere consts nodig):
// WALK_DRIVER_SVG in 96-walk.js roept hem al tijdens het laden aan.
function crystalDriverSvg(mode = 'color'){
  const h = mode === 'mono' ? 'currentColor' : mode === 'off' ? '#7d8a99' : '#ff9f5c';
  const m = mode === 'mono' ? 'currentColor' : mode === 'off' ? '#7d8a99' : '#e6edf3';
  const d = mode === 'mono' ? '#000' : '#1a0f08';
  return `<svg class="driver-ico" viewBox="0 0 48 48" aria-hidden="true"><g stroke="none" transform="rotate(45 24 24) translate(0 1) scale(.92) translate(2 2)">` +
    `<rect x="17" y="2" width="14" height="20" rx="6" fill="${h}"/>` +
    `<rect x="20.6" y="5" width="2" height="14" rx="1" fill="${d}" opacity=".35"/><rect x="25.4" y="5" width="2" height="14" rx="1" fill="${d}" opacity=".35"/>` +
    `<rect x="19.5" y="21" width="9" height="4" rx="1" fill="${m}"${mode === 'mono' ? ' opacity=".75"' : ''}/>` +
    `<rect x="22.2" y="24" width="3.6" height="15" fill="${m}"${mode === 'mono' ? ' opacity=".75"' : ''}/>` +
    `<path d="M21.4 38.5h5.2l-.8 7h-3.6z" fill="${m}"${mode === 'mono' ? ' opacity=".75"' : ''}/></g></svg>`;
}
// lege plek (gestippeld); met `hint` het grote lege kristal van een lege kluis
function renderCrystalEmpty({ size = 'sm', attrs = '', hint = false } = {}){
  const inner = hint
    ? `<span class="crystal-layer crystal-layer--empty">
        <span class="crystal-ico">${crystalIconSvg('<polygon points="24,4 41,13.5 41,34.5 24,44 7,34.5 7,13.5"/><polygon points="24,12 34,17.5 34,30.5 24,36 14,30.5 14,17.5" fill="currentColor" fill-opacity=".25"/>')}</span>
        <span class="crystal-name">Nog geen kristallen</span>
        <span class="crystal-rule"></span>
        <span class="crystal-txt">Loop over een kristalvakje in een gang of voltooi een opdracht</span>
      </span>`
    : '';
  return `<div class="crystal crystal--${size} crystal--empty" ${attrs}>${crystalShapeSvg(true)}${inner}</div>`;
}
// het "kluis vol"-kristal: zilver met een vraagteken. Bewust NIET het kristal dat je zou hebben
// gekregen — als je kluis vol is trek je niet, dat kristal blijft bovenop de stapel liggen, en
// laten zien welk het is zou verklappen wat de volgende speler krijgt.
function renderCrystalMystery(){
  return `<div class="crystal crystal--lg crystal--mystery">
    ${crystalShapeSvg(false)}
    <span class="crystal-layer crystal-layer--empty">
      <span class="crystal-ico">${crystalIconSvg(CRYSTAL_ICON_MYSTERY)}</span>
      <span class="crystal-name">Kluis vol</span>
      <span class="crystal-rule"></span>
      <span class="crystal-txt">Gebruik of leg eerst een kristal af</span>
    </span>
  </div>`;
}

// ---------- de kluis ----------
let crystalSel = null;            // welke plek (0-2) is gekozen; 'tool' = de schroevendraaier; null = niets
let crystalFocusShown = '';       // wat er nu groot staat — alleen bij een wissel opnieuw tekenen
const crystalHiddenSlots = new Set();   // plekken waar een kristal nog naartoe vliegt
const crystalNew = new Map();     // id -> aantal "Nieuw"-labels (tot je erop klikt)
const crystalVaultFocusEl = document.getElementById('crystalFocus');
const crystalVaultRailEl = document.getElementById('crystalRail');
const crystalVaultListEl = document.getElementById('crystalList');
const crystalVaultWhyEl = document.getElementById('crystalWhy');
const crystalVaultCountEl = document.getElementById('walkCardVaultCount');
const crystalVaultToolEl = document.getElementById('crystalTool');
const crystalVaultInfoEl = document.getElementById('crystalInfo');
const crystalVaultCardEl = document.getElementById('crystalCard');

// ---------- het uitlegvak onder het grote kristal ----------
// Links soort + moment, rechts wat het kristal doet (ACTION_CARDS[id].info). Voor de schroevendraaier
// en een lege kluis alleen de uitleg. Het vak heeft een VASTE hoogte (styles.css, KLUIS "EEN KAART").
const CRYSTAL_TOOL_INFO_HAS = 'Sta je op een rooster, ook midden in je zet, dan kruip je erin zonder een stap te gebruiken. Je komt boven bij een ander vrij rooster naar keuze en loopt met de rest van je worp door. Daarna is de schroevendraaier op.';
const CRYSTAL_TOOL_INFO_NO = 'Je hebt geen schroevendraaier. Je krijgt er een met de energie-actie Schroevendraaier of met het kristal Schroevendraaier. Daarmee kruip je van rooster naar rooster.';
function crystalInfoHtml(id, tool){
  const single = t => `<div class="crystal-info-grid is-single"><div class="crystal-info-text"><p>${t}</p></div></div>`;
  if (id === 'tool') return single(tool ? CRYSTAL_TOOL_INFO_HAS : CRYSTAL_TOOL_INFO_NO);
  if (!id) return single(`Nog geen kristallen. Loop over een kristalvakje in een gang of voltooi een opdracht. Je kunt er ${ACTION_CARD_HAND_MAX} tegelijk bewaren.`);
  const c = ACTION_CARDS[id];
  return `<div class="crystal-info-grid"><div class="crystal-info-meta">` +
    `<span class="crystal-info-k"><i>Soort</i><b class="is-cat">${CRYSTAL_CATS[ACTION_CARD_TINTS[id]]}</b></span>` +
    `<span class="crystal-info-k"><i>Wanneer</i><b>${CRYSTAL_WHEN_LONG[c.when]}</b></span></div>` +
    `<div class="crystal-info-text"><p>${c.info || c.text}</p></div></div>`;
}
// de schroevendraaier groot op de plek van het kristal (als je zijn vakje in de rail kiest)
function crystalToolBigHtml(tool){
  return `<div class="crystal-toolbig${tool ? '' : ' is-off'}"><span class="crystal-toolbig-box">${crystalDriverSvg(tool ? 'color' : 'off')}</span>` +
    `<span class="crystal-toolbig-name">Schroevendraaier</span></div>`;
}

// `cards` = de kristallen van wie deze kluis is. opts:
//   reason(id)   waarom dit kristal nu niet kan (string) of null — alleen als je aan zet bent
//   canDiscard   mag je nu afleggen
//   idle         je bent niet aan zet: alles gedimd, met deze tekst
//   tool         heeft deze speler een schroevendraaier (het vakje onderaan de rail)
function crystalRenderVault(cards, { reason = () => null, canDiscard = false, idle = null, tool = false } = {}){
  if (!crystalVaultRailEl) return;
  const shown = i => cards[i] !== undefined && !crystalHiddenSlots.has(i);
  if (crystalSel !== null && crystalSel !== 'tool' && !shown(crystalSel)) crystalSel = null;
  if (crystalSel === null){
    for (let i = 0; i < cards.length; i++) if (shown(i)){ crystalSel = i; break; }
  }
  const isTool = crystalSel === 'tool';
  const why = id => idle || reason(id);

  // "Nieuw"-labels per id verdelen over de plekken met dat id. Elk plekje staat in een eigen vakje
  // (.crystal-slot) van gelijke hoogte; het gekozen kristal krijgt een kader rondom (is-picked)
  const newLeft = new Map(crystalNew);
  let rail = '';
  for (let i = 0; i < ACTION_CARD_HAND_MAX; i++){
    if (!shown(i)){ rail += `<span class="crystal-slot">${renderCrystalEmpty({ attrs: `data-slot="${i}"` })}</span>`; continue; }
    const id = cards[i];
    const isNew = (newLeft.get(id) || 0) > 0;
    if (isNew) newLeft.set(id, newLeft.get(id) - 1);
    const st = (why(id) ? ' is-locked' : '') + (i === crystalSel ? ' is-picked' : '') + (isNew ? ' is-new' : '');
    rail += `<span class="crystal-slot">` + renderCrystal(id, { size: 'sm', tag: 'button', state: st,
      attrs: `type="button" data-i="${i}" data-slot="${i}" data-id="${id}" role="option" aria-selected="${i === crystalSel}" title="${ACTION_CARDS[id].name}" aria-label="${ACTION_CARDS[id].name}"` }) + `</span>`;
  }
  crystalSetHtml(crystalVaultRailEl, rail);
  // het schroevendraaier-vakje onderaan de rail: klikbaar, zoals een kristal
  if (crystalVaultToolEl){
    crystalSetHtml(crystalVaultToolEl, `<span class="crystal-tool-label${tool ? ' is-on' : ''}">Schroeven-<br>draaier</span>` +
      `<button type="button" class="crystal-tool-slot${tool ? ' is-on' : ''}${isTool ? ' is-picked' : ''}" data-tool="1" aria-pressed="${isTool}" ` +
      `title="${tool ? 'Je hebt een schroevendraaier' : 'Geen schroevendraaier'}" aria-label="Schroevendraaier">${crystalDriverSvg(tool ? 'color' : 'off')}</button>`);
  }
  // compacte kluis: dezelfde plekken als rijtjes met naam, anders weet je vóór het dobbelen niet
  // welk icoontje welk kristal is (gebruikersmelding). Gedimd = nu niet; de reden staat in de tooltip.
  if (crystalVaultListEl){
    const newLeft2 = new Map(crystalNew);
    let list = '';
    for (let i = 0; i < ACTION_CARD_HAND_MAX; i++){
      if (!shown(i)){ list += `<div class="crystal-row is-empty" data-slot="${i}"><span class="crystal-row-hex"></span><span class="crystal-row-name">Lege plek</span></div>`; continue; }
      const cid = cards[i], why2 = why(cid);
      const isNew = (newLeft2.get(cid) || 0) > 0;
      if (isNew) newLeft2.set(cid, newLeft2.get(cid) - 1);
      const st = (why2 ? ' is-locked' : '') + (i === crystalSel ? ' is-picked' : '') + (isNew ? ' is-new' : '');
      const tip = `${ACTION_CARDS[cid].name} — ${ACTION_CARDS[cid].text}${why2 ? ` (nu niet: ${why2})` : ''}`;
      list += `<button type="button" class="crystal-row crystal--${ACTION_CARD_TINTS[cid]}${st}" data-i="${i}" data-slot="${i}" data-id="${cid}" role="option" aria-selected="${i === crystalSel}" title="${tip}">`
        + `<span class="crystal-row-hex"></span><span class="crystal-row-name">${ACTION_CARDS[cid].name}</span></button>`;
    }
    crystalSetHtml(crystalVaultListEl, list);
  }
  const count = cards.filter((_, i) => shown(i)).length;
  if (crystalVaultCountEl) crystalSetText(crystalVaultCountEl, `${count} / ${ACTION_CARD_HAND_MAX}`);
  if (crystalTabCountEl) crystalSetText(crystalTabCountEl, `${count} / ${ACTION_CARD_HAND_MAX}`);
  // tabblad Kluis pulst als je nu een kristal kunt spelen (alleen te zien als Energie open staat)
  const canNow = !idle && cards.some((c, i) => shown(i) && !reason(c));
  if (crystalTabVaultEl && crystalTabVaultEl.classList.contains('can') !== canNow) crystalTabVaultEl.classList.toggle('can', canNow);

  const id = isTool || crystalSel === null ? null : cards[crystalSel];
  const r = id ? why(id) : null;
  const focusKey = isTool ? `tool|${tool ? 1 : 0}` : id ? `${id}|${r ? 1 : 0}` : 'empty';
  if (focusKey !== crystalFocusShown){
    const swapped = crystalFocusShown !== '' && crystalFocusShown.split('|')[0] !== focusKey.split('|')[0];
    crystalFocusShown = focusKey;
    crystalVaultFocusEl.innerHTML = isTool ? crystalToolBigHtml(tool)
      : id ? renderCrystal(id, { state: r ? 'is-locked' : '' })
      : renderCrystalEmpty({ size: 'lg' });
    // het kristal is net nieuw in de DOM gezet, dus zijn animatie start vanzelf opnieuw: geen
    // offsetWidth-truc nodig (die dwong midden in een beurt de opmaak opnieuw, zie Prestatie in CLAUDE.md)
    crystalVaultFocusEl.classList.toggle('is-swap', !!swapped);
  }
  // uitlegvak + de kleur van de kaart (rand en zweem in de kleur van de soort; koper bij de schroevendraaier)
  if (crystalVaultInfoEl) crystalSetHtml(crystalVaultInfoEl, crystalInfoHtml(isTool ? 'tool' : id, tool));
  if (crystalVaultCardEl){
    const cls = 'crystal-card ' + (isTool ? 'crystal--tool' : id ? `crystal--${ACTION_CARD_TINTS[id]}` : 'crystal--empty');
    if (crystalVaultCardEl.className !== cls) crystalVaultCardEl.className = cls;
  }
  if (crystalVaultWhyEl.classList.contains('is-no') !== !!r) crystalVaultWhyEl.classList.toggle('is-no', !!r);
  // .crystal-vault-sel (de naam) is alleen te zien in de compacte kluis (vóór het dobbelen, als het
  // energievak de ruimte nodig heeft) — in de gewone kluis staat de naam al op het grote kristal
  crystalSetHtml(crystalVaultWhyEl, isTool ? (tool ? 'Op een rooster verschijnt de knop Kruipen vanzelf.' : 'Niet in je bezit.')
    : !id ? `Je kunt er <b>${ACTION_CARD_HAND_MAX}</b> tegelijk bewaren.`
    : `<span class="crystal-vault-sel">${ACTION_CARDS[id].name}</span>`
      + (r ? `<b>Nu niet.</b> ${r.charAt(0).toUpperCase() + r.slice(1)}.` : `<b>Nu te gebruiken</b>`));
  if (btnCardPlay && btnCardPlay.disabled !== (!id || !!r)) btnCardPlay.disabled = !id || !!r;
  const noDiscard = !id || !!idle || !canDiscard;
  if (btnCardDiscard && btnCardDiscard.disabled !== noDiscard) btnCardDiscard.disabled = noDiscard;
  crystalSyncStack();
}
// HTML/tekst alleen zetten als hij echt anders is: elke wijziging in #tabWalk laat de
// MutationObserver van de pulsen (97-solo.js) syncAllPulses draaien, en die kost een paar ms
const crystalHtmlCache = new WeakMap();
function crystalSetHtml(el, html){
  if (crystalHtmlCache.get(el) === html) return;
  crystalHtmlCache.set(el, html);
  el.innerHTML = html;
}
function crystalSetText(el, text){ if (el.textContent !== text) el.textContent = text; }

// ---------- klassen op de zijkolom (i.p.v. CSS :has(), dat bij elke kleine DOM-wijziging de hele
// kolom liet herberekenen — gemeten: merkbaar hakkelig) ----------
//   has-vault     de kluis staat er: kolom even hoog als het bord, met de tabbladen Energie | Kluis
//   tab-energy / tab-vault   welk tabblad open is (gekozen variant C, 2026-11)
const crystalStackEl = document.getElementById('walkSideStack');
const crystalSoloActionsEl = document.getElementById('walkSoloActions');
const crystalCardActionsEl = document.getElementById('walkCardActions');
const crystalTabEnergyEl = document.getElementById('walkTabEnergy');
const crystalTabVaultEl = document.getElementById('walkTabVault');
const crystalTabCountEl = document.getElementById('walkTabVaultCount');
// Welk tabblad open is. Kiest de speler zelf; alleen een vervolgkeuze zet het vanzelf om: de keuze
// na een kristal (doelwit, Zelf kiezen, Blinde Vlek; #walkCardActions staat in de kluis) opent
// Kluis, een keuze in het energievak (richting, kleur, sprongdoel, Herprioritering) opent Energie.
let crystalTab = 'energy';
let crystalForcedTab = '';   // welke vervolgkeuze er bij de vorige controle openstond
function crystalSetTab(tab){ crystalTab = tab; crystalSyncStack(); }
function crystalSyncStack(){
  if (!crystalStackEl) return;
  const vault = document.getElementById('walkCardVault');
  const set = (cls, on) => { if (crystalStackEl.classList.contains(cls) !== on) crystalStackEl.classList.toggle(cls, on); };
  const hasVault = !!vault && !vault.hidden;
  set('has-vault', hasVault);
  // alleen op het moment dat zo'n keuze verschijnt; daarna mag je zelf weer wisselen
  const forced = crystalCardActionsEl && crystalCardActionsEl.childElementCount ? 'vault'
    : crystalSoloActionsEl && crystalSoloActionsEl.childElementCount && !crystalSoloActionsEl.querySelector('.is-actions') ? 'energy' : '';
  if (forced && forced !== crystalForcedTab) crystalTab = forced;
  crystalForcedTab = forced;
  const onVault = hasVault && crystalTab === 'vault';
  set('tab-vault', onVault);
  set('tab-energy', hasVault && !onVault);
  for (const [el, on] of [[crystalTabEnergyEl, !onVault], [crystalTabVaultEl, onVault]]){
    if (el && el.getAttribute('aria-selected') !== String(on)) el.setAttribute('aria-selected', String(on));
  }
}
const crystalTabsEl = document.getElementById('walkSideTabs');
if (crystalTabsEl) crystalTabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) crystalSetTab(b.dataset.tab);
});
// wat je ziet van de kluis: de kluis zelf, of het tabblad als Energie open staat (voor de gloed bij
// oprapen en het schudden bij een volle kluis)
function crystalVaultShownEl(){
  const vault = document.getElementById('walkCardVault');
  return vault && vault.getClientRects().length ? vault : (crystalTabVaultEl || vault);
}
for (const el of [crystalSoloActionsEl, crystalCardActionsEl]){
  if (el) new MutationObserver(crystalSyncStack).observe(el, { childList: true });
}
function crystalSelectedId(cards){ return crystalSel === null ? null : (cards[crystalSel] || null); }
// nieuw potje: kluis-UI terug naar af
function crystalResetVault(){
  crystalSel = null; crystalFocusShown = ''; crystalTab = 'energy'; crystalForcedTab = '';
  crystalHiddenSlots.clear(); crystalNew.clear(); crystalAnonPending.clear();
  crystalFxClear();
}
// opnieuw tekenen via de juiste route (in multiplayer is "mijn" kluis niet die van wie aan zet is)
function crystalRefreshVault(){
  if (typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game') mpRefreshCardVault();
  else soloRefreshCardVault();
}
for (const crystalPickEl of [crystalVaultRailEl, crystalVaultListEl]) if (crystalPickEl){
  crystalPickEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-i]');
    if (!btn) return;
    crystalSel = parseInt(btn.dataset.i, 10);
    // bekeken = niet meer "nieuw" (op id, want plekken schuiven op als je er een gebruikt)
    const cardId = btn.dataset.id;
    if (btn.classList.contains('is-new') && crystalNew.get(cardId)) crystalNew.set(cardId, crystalNew.get(cardId) - 1);
    crystalRefreshVault();
    const again = crystalPickEl.querySelector(`button[data-i="${crystalSel}"]`);
    if (again) again.focus();
  });
}
// het schroevendraaier-vakje: groot in het midden, met alleen zijn uitleg
if (crystalVaultToolEl){
  crystalVaultToolEl.addEventListener('click', (e) => {
    if (!e.target.closest('button[data-tool]')) return;
    crystalSel = 'tool';
    crystalRefreshVault();
    const again = crystalVaultToolEl.querySelector('button[data-tool]');
    if (again) again.focus();
  });
}

// ---------- zeshoekjes op de spelerskaartjes ----------
// Bij jezelf in de kleur van de soort; bij een ander altijd zilver (je weet dát, niet wát).
const crystalAnonPending = new Map();   // spelerIdx -> aantal zilveren kristalletjes onderweg
function crystalPipsHtml(p, isMe){
  const pending = isMe ? crystalHiddenSlots.size : (crystalAnonPending.get(p.idx) || 0);
  const cards = (p.cards || []).filter((_, i) => !(isMe && crystalHiddenSlots.has(i)));
  const n = Math.max(0, Math.min(ACTION_CARD_HAND_MAX, (isMe ? cards.length : p.cards.length - pending)));
  let html = '';
  for (let i = 0; i < ACTION_CARD_HAND_MAX; i++){
    const on = i < n;
    const cls = !on ? '' : isMe && cards[i] ? ` on crystal--${ACTION_CARD_TINTS[cards[i]]}` : ' on anon';
    html += `<span class="crystal-pip${cls}" data-pip="${i}"></span>`;
  }
  return `<span class="crystal-pips" data-pips="${p.idx}" aria-label="${p.cards.length} van ${ACTION_CARD_HAND_MAX} kristallen">${html}</span>`;
}
// alleen de zeshoekjes van één speler bijwerken (na een landing), zonder de hele balk opnieuw
function crystalRepaintPips(player){
  const me = crystalIsMe(player);
  for (const el of document.querySelectorAll(`.crystal-pips[data-pips="${player.idx}"]`)){
    el.outerHTML = crystalPipsHtml(player, me);
  }
}
function crystalIsMe(p){
  if (!p) return false;
  if (typeof mp !== 'undefined' && mp.active && mp.phase === 'in-game') return p.idx === mp.myIdx;
  return !!p.isHuman;   // Zelf spelen: elke mens aan dit scherm is "jij"
}
// het zichtbare zeshoekjes-rijtje van een speler (staat in twee balken, één ervan is verborgen)
function crystalPipsTarget(idx, slot){
  for (const el of document.querySelectorAll(`.crystal-pips[data-pips="${idx}"]`)){
    if (!el.getClientRects().length) continue;
    return el.querySelector(`[data-pip="${slot}"]`) || el;
  }
  return null;
}

// ---------- gebeurtenissen ----------
// Wordt aangeroepen op elke plek waar iemand een kristal krijgt (kind 'gain', NA het toevoegen
// aan player.cards) of had moeten krijgen maar zijn kluis vol was (kind 'full'). `key` = het
// vakje waar het gebeurde (kristalvakje of opdrachtvakje).
//  - Bot-beurten die straks zichtbaar nagespeeld worden: niet nu, maar wanneer de pion daar
//    langskomt (crystalDeferred, zie soloAdvanceLoop/soloAnimateBotTurn in 97-solo.js).
//  - Multiplayer-host: ook in de uitzending (alleen wie/waar/wat-soort, nooit welk kristal),
//    zodat elke gast het zelf kan afspelen — z'n eigen kristal vol, dat van een ander anoniem.
let crystalDeferred = null;
let crystalMpSeq = 0;
let crystalMpLog = [];
function crystalEvent(player, key, kind){
  if (!player) return;
  const ev = { idx: player.idx, key, kind };
  if (crystalDeferred){ crystalDeferred.push(ev); return; }
  if (typeof mp !== 'undefined' && mp.active && mp.isHost && mp.phase === 'in-game'){
    crystalMpLog.push({ ...ev, seq: ++crystalMpSeq });
    if (crystalMpLog.length > 12) crystalMpLog = crystalMpLog.slice(-12);
  }
  crystalPlay(ev);
}
function crystalPlay(ev){
  const player = soloPlayers[ev.idx];
  if (!player || !soloGraph) return;
  if (crystalIsMe(player)){
    if (ev.kind === 'full') crystalFxFull(ev.key);
    else crystalFxGain(ev.key, player.cards.length - 1, player);
  } else {
    crystalFxAnon(ev.key, player, ev.kind === 'full');
  }
}
// gast: nieuwe gebeurtenissen uit een uitzending afspelen (de allereerste keer alleen bijlezen)
let crystalMpSeen = null;
function crystalMpApply(log){
  if (!Array.isArray(log)) return;
  const top = log.reduce((m, e) => Math.max(m, e.seq), crystalMpSeen || 0);
  if (crystalMpSeen === null){ crystalMpSeen = top; return; }
  for (const ev of log) if (ev.seq > crystalMpSeen) crystalPlay(ev);
  crystalMpSeen = top;
}
function crystalMpReset(){ crystalMpSeq = 0; crystalMpLog = []; crystalMpSeen = null; }

// ---------- animaties ----------
const crystalReduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const crystalEaseBack = t => 1 + 2.4*Math.pow(t-1, 3) + 1.4*Math.pow(t-1, 2);
const crystalEaseInOut = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
const crystalLerp = (a, b, t) => a + (b-a)*t;
const crystalCenter = r => [r.left + r.width/2, r.top + r.height/2];
const crystalBez = (A, P, C, k) => [(1-k)*(1-k)*A[0] + 2*(1-k)*k*P[0] + k*k*C[0], (1-k)*(1-k)*A[1] + 2*(1-k)*k*P[1] + k*k*C[1]];
const CRYSTAL_FLY_W = 200, CRYSTAL_FLY_H = 290;
const crystalFrames = new Set();   // lopende requestAnimationFrame-lussen (om te kunnen stoppen)
const crystalTimers = new Set();
function crystalLater(fn, ms){ const t = setTimeout(() => { crystalTimers.delete(t); fn(); }, ms); crystalTimers.add(t); }
function crystalLoop(step){
  const box = { id: 0 };
  // performance.now() i.p.v. de tijdstempel van requestAnimationFrame: de begintijd (t0) wordt
  // ook met performance.now() gemeten, en zo lopen ze gegarandeerd op dezelfde klok
  const tick = () => { crystalFrames.delete(box.id); if (step(performance.now()) !== false){ box.id = requestAnimationFrame(tick); crystalFrames.add(box.id); } };
  box.id = requestAnimationFrame(tick); crystalFrames.add(box.id);
}
function crystalFxClear(){
  for (const id of crystalFrames) cancelAnimationFrame(id);
  crystalFrames.clear();
  for (const t of crystalTimers) clearTimeout(t);
  crystalTimers.clear();
  document.querySelectorAll('.crystal-fx').forEach(el => el.remove());
}
function crystalFxEl(cls, x, y, tint, vars = {}){
  const el = document.createElement('div');
  el.className = 'crystal-fx ' + cls;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.setProperty('--tint', tint);
  for (const k in vars) el.style.setProperty(k, vars[k]);
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  return el;
}
function crystalBurst(x, y, tint, sparks, spread){
  crystalFxEl('crystal-burst', x, y, tint);
  for (let k = 0; k < sparks; k++){
    const a = k/sparks*Math.PI*2, d = spread + Math.random()*spread*.75;
    crystalFxEl('crystal-spark', x, y, tint, { '--dx': Math.cos(a)*d + 'px', '--dy': Math.sin(a)*d + 'px' });
  }
}
function crystalCellEl(key, graph = soloGraph){
  if (key === undefined || key === null || !graph) return null;
  try { const el = walkCellDiv(graph, key); return el && el.getClientRects().length ? el : null; }
  catch (e){ return null; }
}
// piekpunt boven het vakje, maar het hele kristal moet in beeld blijven
function crystalPeak(A){
  const m = 12, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  return [Math.min(Math.max(A[0], CRYSTAL_FLY_W/2 + m), vw - CRYSTAL_FLY_W/2 - m),
          Math.min(Math.max(A[1] - 110, CRYSTAL_FLY_H/2 + m + 24), vh - CRYSTAL_FLY_H/2 - m)];
}
function crystalFlyer(html, tint){
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const el = wrap.firstElementChild;
  el.classList.add('crystal-fx', 'crystal-flyer');
  el.style.setProperty('--tint', tint);
  document.body.appendChild(el);
  return el;
}
function crystalLabel(text, tint){
  const el = document.createElement('div');
  el.className = 'crystal-fx crystal-flyer-label';
  el.textContent = text;
  el.style.setProperty('--tint', tint);
  document.body.appendChild(el);
  return el;
}
const crystalTint = id => `var(--crystal-${ACTION_CARD_TINTS[id]})`;

// jij raapt een kristal op: groeien uit het vakje, even tonen, in een boog naar je kluis
function crystalFxGain(fromKey, slot, owner){
  const id = owner && owner.cards[slot];
  if (!id) return;
  crystalNew.set(id, (crystalNew.get(id) || 0) + 1);
  const cell = crystalCellEl(fromKey);
  const land = () => {
    crystalHiddenSlots.delete(slot);
    crystalSel = slot;
    crystalRefreshVault();
    if (owner) crystalRepaintPips(owner);
    const el = crystalSlotEl(slot);
    if (el) el.classList.add('is-landing');
    const vault = crystalVaultShownEl();
    // gloed = laagje dat in opacity in/uit faadt (styles.css), dus geen herstart via offsetWidth nodig
    if (vault){ vault.classList.add('is-glow'); crystalLater(() => vault.classList.remove('is-glow'), 900); }
  };
  if (crystalReduceMotion() || !cell){ land(); return; }
  crystalHiddenSlots.add(slot);
  crystalRefreshVault();
  if (owner) crystalRepaintPips(owner);

  const tint = crystalTint(id);
  const fromR = cell.getBoundingClientRect(), A = crystalCenter(fromR), B = crystalPeak(A);
  const s0 = fromR.width / CRYSTAL_FLY_W;
  const el = crystalFlyer(renderCrystal(id), tint);
  const label = crystalLabel('Kristal opgeraapt!', tint);
  label.style.transform = `translate(${B[0]}px,${B[1] - CRYSTAL_FLY_H/2 - 22}px) translateX(-50%)`;
  crystalBurst(A[0], A[1], tint, 10, 40);
  const T_GROW = 550, T_HOLD = 1000, T_FLY = 950, t0 = performance.now();
  let lastSpark = 0, flying = false;
  const place = (x, y, s, r) => { el.style.transform = `translate(${x - CRYSTAL_FLY_W/2}px,${y - CRYSTAL_FLY_H/2}px) scale(${s}) rotate(${r}deg)`; };
  crystalLoop(now => {
    if (!el.isConnected) return false;
    const t = now - t0;
    if (t < T_GROW){
      const k = crystalEaseBack(t / T_GROW);
      place(crystalLerp(A[0], B[0], k), crystalLerp(A[1], B[1], k), Math.max(.05, crystalLerp(s0, 1, k)), crystalLerp(-35, 0, Math.min(1, k)));
      return;
    }
    if (t < T_GROW + T_HOLD){
      const k = (t - T_GROW) / T_HOLD;
      label.style.opacity = 1;
      place(B[0], B[1] - Math.sin(k*Math.PI*2)*5, 1 + Math.sin(k*Math.PI)*.03, 0);
      return;
    }
    if (!flying){ flying = true; el.classList.add('is-flying'); label.style.opacity = 0; crystalLater(() => label.remove(), 300); }
    // doel elke frame opnieuw meten: de pagina kan intussen gescrold of verschoven zijn
    const toEl = crystalSlotEl(slot);
    if (!toEl){ el.remove(); land(); return false; }
    const toR = toEl.getBoundingClientRect(), C = crystalCenter(toR);
    // in de compacte kluis is het doel een rijtje: krimpen tot de hoogte daarvan
    const sEnd = toEl.classList.contains('crystal-row') || toEl === crystalTabVaultEl ? toR.height * 1.6 / CRYSTAL_FLY_H : toR.width / CRYSTAL_FLY_W;
    const dist = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const P = [(B[0] + C[0]) / 2, Math.min(B[1], C[1]) - Math.max(80, dist * .35)];
    const k = crystalEaseInOut(Math.min(1, (t - T_GROW - T_HOLD) / T_FLY));
    const [x, y] = crystalBez(B, P, C, k);
    const dx = 2*(1-k)*(P[0] - B[0]) + 2*k*(C[0] - P[0]);   // horizontale snelheid -> kantelen in de bocht
    place(x, y, crystalLerp(1, sEnd, k), Math.max(-14, Math.min(14, dx/40)) * Math.sin(k*Math.PI));
    if (now - lastSpark > 35 && k < .95){
      lastSpark = now;
      crystalFxEl('crystal-spark', x, y, tint, { '--dx': (Math.random()*30 - 15) + 'px', '--dy': (Math.random()*30 + 5) + 'px' });
    }
    if (k >= 1){ el.remove(); crystalFxEl('crystal-burst', C[0], C[1], tint); land(); return false; }
  });
}

// het zichtbare plekje in de kluis (de rail in de gewone kluis, een rijtje in de compacte); staat
// het tabblad Energie open, dan het tabblad Kluis
function crystalSlotEl(slot){
  for (const el of document.querySelectorAll(`#walkCardVault [data-slot="${slot}"]`)){
    if (el.getClientRects().length) return el;
  }
  return crystalTabVaultEl && crystalTabVaultEl.getClientRects().length ? crystalTabVaultEl : null;
}

// jouw kluis is vol: een zilver vraagteken-kristal groeit uit het vakje, trilt, en knalt in 12 scherven
function crystalFxFull(fromKey){
  const shake = () => {
    const vault = crystalVaultShownEl();
    if (!vault) return;
    // rode gloed via de klasse (opacity), het schudden als Web Animation: die start elke keer
    // opnieuw zonder offsetWidth-truc (zie Prestatie in CLAUDE.md)
    vault.classList.add('is-full');
    if (!crystalReduceMotion() && typeof vault.animate === 'function'){
      vault.animate([{ transform: 'none' }, { transform: 'translateX(-6px)', offset: .15 }, { transform: 'translateX(6px)', offset: .35 },
        { transform: 'translateX(-4px)', offset: .55 }, { transform: 'translateX(3px)', offset: .75 }, { transform: 'none' }], { duration: 500 });
    }
    crystalLater(() => vault.classList.remove('is-full'), 1100);
  };
  const cell = crystalCellEl(fromKey);
  if (crystalReduceMotion() || !cell){ shake(); return; }
  const tint = 'var(--crystal-anon)';
  const fromR = cell.getBoundingClientRect(), A = crystalCenter(fromR), B = crystalPeak(A);
  const s0 = fromR.width / CRYSTAL_FLY_W;
  const el = crystalFlyer(renderCrystalMystery(), tint);
  const label = crystalLabel('Kluis vol!', 'var(--danger)');
  label.style.transform = `translate(${B[0]}px,${B[1] - CRYSTAL_FLY_H/2 - 22}px) translateX(-50%)`;
  crystalBurst(A[0], A[1], tint, 10, 40);
  const T_GROW = 550, T_HOLD = 1150, T_SHAKE = 380, t0 = performance.now();
  const place = (x, y, s, r) => { el.style.transform = `translate(${x - CRYSTAL_FLY_W/2}px,${y - CRYSTAL_FLY_H/2}px) scale(${s}) rotate(${r}deg)`; };
  crystalLoop(now => {
    if (!el.isConnected) return false;
    const t = now - t0;
    if (t < T_GROW){
      const k = crystalEaseBack(t / T_GROW);
      place(crystalLerp(A[0], B[0], k), crystalLerp(A[1], B[1], k), Math.max(.05, crystalLerp(s0, 1, k)), crystalLerp(-35, 0, Math.min(1, k)));
      return;
    }
    if (t < T_GROW + T_HOLD){
      const left = T_GROW + T_HOLD - t;
      label.style.opacity = 1;
      if (left < T_SHAKE){
        // vlak voor het knallen: steeds harder trillen en opzwellen
        const f = 1 - left / T_SHAKE;
        el.classList.add('is-cracking');
        place(B[0] + (Math.random()*2 - 1)*7*f, B[1] + (Math.random()*2 - 1)*5*f, 1 + .06*f, (Math.random()*2 - 1)*5*f);
      } else {
        place(B[0], B[1] - Math.sin((t - T_GROW) / T_HOLD * Math.PI * 2) * 5, 1, 0);
      }
      return;
    }
    el.remove();
    label.style.opacity = 0; crystalLater(() => label.remove(), 300);
    crystalShatter(B[0], B[1], tint);
    shake();
    return false;
  });
}
// 12 scherven: elk zijvlak van de zeshoek in twee driehoeken, vanuit het midden naar buiten
function crystalShatter(x, y, tint){
  const C = [100, 145];
  for (let i = 0; i < 6; i++){
    const a = CRYSTAL_OUT[i], b = CRYSTAL_OUT[(i+1) % 6], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (const tri of [[C, a, m], [C, m, b]]){
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const len = Math.hypot(cx - C[0], cy - C[1]) || 1;
      const d = 130 + Math.random()*110, dx = (cx - C[0]) / len * d, dy = (cy - C[1]) / len * d;
      const r = (Math.random()*2 - 1) * 220;
      const el = document.createElement('div');
      el.className = 'crystal-fx crystal-shard';
      el.style.setProperty('--tint', tint);
      el.style.left = (x - 100) + 'px'; el.style.top = (y - 145) + 'px';
      el.style.clipPath = `polygon(${tri.map(p => `${p[0]}px ${p[1]}px`).join(',')})`;
      el.style.transformOrigin = `${cx}px ${cy}px`;
      document.body.appendChild(el);
      const anim = el.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx*.7}px,${dy*.7 - 20}px) rotate(${r*.6}deg)`, opacity: 1, offset: .45 },
        { transform: `translate(${dx}px,${dy + 160}px) rotate(${r}deg) scale(.6)`, opacity: 0 },
      ], { duration: 1100, easing: 'cubic-bezier(.15,.75,.4,1)' });
      anim.onfinish = () => el.remove();
    }
  }
  crystalBurst(x, y, tint, 16, 60);
}

// een ander raapt op: klein, kort en anoniem. Geen kleur, geen icoon, geen naam — een zilver
// kristalletje komt met een glinstering uit het vakje en glijdt naar diens spelerskaartje.
// Kluis vol bij een ander: het kristalletje springt op en spat zachtjes uiteen.
function crystalFxAnon(fromKey, player, full, fast = false, graph = soloGraph){
  const cell = crystalCellEl(fromKey, graph);
  const slot = Math.max(0, Math.min(ACTION_CARD_HAND_MAX - 1, player.cards.length - 1));
  const finish = () => {
    if (full) return;
    crystalAnonPending.set(player.idx, Math.max(0, (crystalAnonPending.get(player.idx) || 0) - 1));
    crystalRepaintPips(player);
    const pip = crystalPipsTarget(player.idx, slot);
    if (pip) pip.classList.add('is-landing');
  };
  // `fast` (Automatisch op hoge snelheid): geen vlucht, alleen het zeshoekje dat erbij komt
  if (crystalReduceMotion() || !cell || fast){ if (!full) crystalRepaintPips(player); return; }
  if (!full){ crystalAnonPending.set(player.idx, (crystalAnonPending.get(player.idx) || 0) + 1); crystalRepaintPips(player); }
  const tint = 'var(--crystal-anon)';
  const fromR = cell.getBoundingClientRect(), A = crystalCenter(fromR);
  const W = fromR.width * 1.7;
  const el = document.createElement('div');
  el.className = 'crystal-fx crystal-anon';
  el.style.width = W + 'px';
  el.innerHTML = crystalShapeSvg(false);
  document.body.appendChild(el);
  crystalFxEl('crystal-burst is-small', A[0], A[1], tint);
  const B = [A[0], A[1] - fromR.width * 1.6];
  const T_RISE = 380, T_HOLD = 420, T_FLY = 700, t0 = performance.now();
  let lastSpark = 0;
  const place = (x, y, s, o) => { el.style.transform = `translate(${x - W/2}px,${y - W*1.45/2}px) scale(${s})`; el.style.opacity = o; };
  crystalLoop(now => {
    if (!el.isConnected){ finish(); return false; }
    const t = now - t0;
    if (t < T_RISE){
      const k = crystalEaseBack(t / T_RISE);
      place(A[0], crystalLerp(A[1], B[1], k), Math.max(.1, crystalLerp(.4, 1, k)), Math.min(1, t / 150));
      return;
    }
    if (t < T_RISE + T_HOLD){
      el.classList.add('is-shine');
      place(B[0], B[1] - Math.sin((t - T_RISE) / T_HOLD * Math.PI) * 3, 1, 1);
      return;
    }
    if (full){
      el.remove();
      for (let k = 0; k < 8; k++){
        const a = k/8*Math.PI*2, d = 14 + Math.random()*10;
        crystalFxEl('crystal-spark is-small', B[0], B[1], tint, { '--dx': Math.cos(a)*d + 'px', '--dy': Math.sin(a)*d + 'px' });
      }
      return false;
    }
    const pip = crystalPipsTarget(player.idx, slot);
    if (!pip){ el.remove(); finish(); return false; }
    const toR = pip.getBoundingClientRect(), C = crystalCenter(toR);
    const P = [(B[0] + C[0]) / 2, Math.min(B[1], C[1]) - 40];
    const k = crystalEaseInOut(Math.min(1, (t - T_RISE - T_HOLD) / T_FLY));
    const [x, y] = crystalBez(B, P, C, k);
    place(x, y, crystalLerp(1, toR.width / W, k), 1);
    if (now - lastSpark > 60 && k < .9){
      lastSpark = now;
      crystalFxEl('crystal-spark is-small', x, y, tint, { '--dx': (Math.random()*16 - 8) + 'px', '--dy': (Math.random()*14 + 4) + 'px' });
    }
    if (k >= 1){ el.remove(); finish(); return false; }
  });
}
