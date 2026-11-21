# Prestatie (gemeten, niet opnieuw invoeren)

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

## Prestatie (gemeten, niet opnieuw invoeren)

- Geen geanimeerde of veel gebruikte CSS-`filter` (drop-shadow) en geen `:has()` in het speelscherm:
  dat liet de browser het dobbelvak/de zijkolom elk beeldje opnieuw tekenen of herberekenen
  (gemeten: 20–26 i.p.v. 41–44 beeldjes/s, tot 74 haperingen per minuut). Gloed = een halo-
  cirkeltje of een laagje dat alleen in `opacity` pulst; zichtbaarheid via een klasse die JS zet.
- Iets wat bewegen moet: `transform`/`opacity` met `will-change`. Tijdens het draaien wisselen de
  dobbelsteenkanten via `data-face` (valt buiten de MutationObserver van de pulsen).
- Niets opnieuw in de DOM zetten als het niet veranderd is (`crystalSetHtml`, `data-key` op
  #walkDice): elke DOM-wijziging in #tabWalk laat `syncAllPulses` draaien (±5 ms).
- **Geen animatie op iets anders dan `transform`/`opacity`** in het speelscherm, ook niet
  "even": `top` (de glans in de energiecellen deed dat oneindig → elk beeldje de opmaak opnieuw),
  `box-shadow` (de pulsen; nu een vaste gloed op `::after` die alleen in opacity pulst) en
  `filter`. Gemeten in een potje: dat was de oorzaak van haperende dobbelstenen en energie,
  terwijl "Wie begint?" (waar het energievak verborgen is) wel vloeiend liep. Controle: in de
  console alle `document.getAnimations()` langslopen en de keyframe-eigenschappen bekijken.
- **Geen `void el.offsetWidth` / `getComputedStyle` / `getBoundingClientRect` midden in een
  beurt**: één gedwongen herberekening van de opmaak kost hier ±7 ms. Een animatie opnieuw
  starten = `el.animate(...)` of `anim.currentTime = 0`; posities vooraf in één keer opmeten.
- Bewegingen van de dobbelstenen en energiebolletjes zijn **Web Animations** (`el.animate`) met
  een bekende starttijd (`diceMotion`, `odState` in 96d-dice.js): de hoek wordt uitgerekend, niet
  opgevraagd, en elke beweging gaat naadloos over in de volgende (wiebelen → rollen, tollen →
  uitrollen). Niet terug naar CSS-animaties of JS die elk beeldje een positie zet.
