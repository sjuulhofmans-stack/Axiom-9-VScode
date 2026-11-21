# Kristalvakje in de gang en energie-acties

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

- Elke **gangtegel** heeft precies 1 actiekaartvakje (labels `4.1`–`4.10`,
  analoog aan het opdrachtvakje in een kamer — zie `tileValidationIssues` in
  `90-editor.js`). Loop je er tijdens je beurt overheen, dan trek je een
  beloningskaart net als bij een voltooide opdracht, maar anders dan een
  opdrachtvakje **onderbreekt het de zet niet** en levert het **hooguit 1
  kaart per beurt** op, ook als je onderweg meerdere van deze vakjes
  passeert — geen heen-en-weer lopen voor een 2e kaart. Gedeelde logica:
  `graph.actionCells` (in `buildSimGraph`),
  `pathHasActionCell` en `drawActionCellReward` in `95-simulate.js`; elke
  spelmodus (`95-simulate.js`, `96-walk.js`, `97-solo.js`) houdt zelf een
  per-beurt vlag bij (bv. `actionCellDrawnThisTurn`) omdat animatie/bot-logica
  per modus verschilt. Max. handgrootte: `ACTION_CARD_HAND_MAX` (nu 3).
- **Energie** (`ENERGY_ACTIONS` in `95-simulate.js`): energiesteen 0-1-1-2-2-3
  (gem. 1,5), plafond 10. Een energie-actie kies je **vóór je gooit**, hooguit
  één per beurt; wat de energiesteen oplevert geef je pas **volgende beurt** uit.
  Dat geldt voor mens én bot in alle drie de modi (vroeger mochten bots meteen
  uitgeven en Noodtransport ná de worp doen — dat maakte de simulatie te gunstig).
  **Herworp is weggehaald (2026-11-20, keuze van de maker, niet terugzetten zonder de maker)**: een
  energie-actie (1) ná de worp om één loopsteen opnieuw te gooien. Het aanbod verscheen na elke
  worp in het energievak en de lijst met acties sprong dan telkens weg: "verwarrend, rare functie".
  (Gemeten toen: worp onder de 7 40 → 32%, potjes 65,0 → 63,4 beurten.) Meetknop die bleef:
  `SIM_SETUP_HOOK` (95-simulate.js, per potje spelers aanpassen voor een vergelijking).
  Vier acties: Stuwstoot (4, 3 loopstenen), Herprioritering (4, eerst je volgende
  opdrachtkaart bekijken en dan kiezen of je wisselt), Zwaartekracht-laarzen (5,
  eerst tot 8 vakjes rechtdoor tot een muur/pion, dan gooien) en Noodtransport
  (10, eerst vrij springen tot 11 vakjes, dan gooien). De laarzen **stoppen** op
  het opdrachtvakje van die beurt als ze er onderweg op komen (spelregel van de
  maker; bij een gewone worp loop je juist door). De actiekaart
  Zwaartekracht-laarzen is de gratis versie van de energie-actie (één sprint per
  beurt). Gemeten in balans over 4 borden × 4000 potjes: 24,8 / 24,6 / 25,5 /
  25,1% (Noodtransport op 13 was op elk bord te sterk, 26,6–28,3%); de
  prijs-sweep en de afgewezen alternatieven (rijkere steen, plafond 15, laarzen
  die de worp vervangen, Bijsturen, Dubbelworp, Sabotage, energie → kaart) staan
  bovenin `95-simulate.js` — niet opnieuw voorstellen zonder nieuwe meting. De
  bot-keuze vóór de worp zit in **één** gedeelde functie (`botPreRollMove`),
  zodat simulatie, Automatisch en Zelf spelen niet uit elkaar lopen.
  Extra bot-strategie **Slim** (`'smart'`; standaard voor alle bots in Zelf spelen en
  Multiplayer, in Automatisch te kiezen via Energie-inzet → "iedereen slim"):
  kiest aan het begin van elke eigen beurt zelf een actie of spaart (`botStrategyNow`/
  `botSmartPick` in 95-simulate.js); alle strategie-checks lopen via `botStrategyNow`. Zit
  bewust niet in `ENERGY_STRATEGIES` (de batch-simulatie meet de vaste strategieën).
