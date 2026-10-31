# Axiom-9 Map Generator

Bordspel-tool voor het spel Axiom-9. Het bord bestaat uit **20 tegels van 8×8 vakjes**
in een raster van 4 rijen × 5 kolommen (posities A t/m T, van links naar rechts, rij voor rij).

## Belangrijkste regel voor wie hieraan werkt

**Bewerk NOOIT `dist/axiom9.html`.** Dat is het gebouwde eindresultaat (±1,5 MB,
waarvan ±790 KB het logo en ±240 KB de kaartillustraties). Bewerk altijd de
bronbestanden in `src/` en draai daarna:

```
python build.py
```

(Op Mac/Linux heet dit vaak `python3 build.py` — op Windows installeert de officiële
Python-installer geen apart `python3`-commando, dus daar is het gewoon `python`.)

Dit is precies waarom het project is opgesplitst: één wijziging in de knopjes hoeft
niet het hele logo mee te slepen.

**Aan het begin van elke chat: eerst `git pull`**, vóór je iets leest of wijzigt. Er wordt
gewerkt op twee computers (pc en laptop); zo begin je altijd met de nieuwste versie.

**Na elke afgeronde wijziging: altijd committen én pushen** naar GitHub (`git push origin
master`), zonder het eerst te vragen (gebruikerswens 2026-10). De online versie (GitHub Pages)
komt uit master, dus pas na de push staat de nieuwe versie online.

## Structuur

```
src/
  index.html          HTML-skelet met placeholders {{CSS}} {{JS}} {{LOGO}}
  styles.css          alle opmaak (~77 KB)
  rules.css           opmaak van het tabblad Spelregels (+ de iets compactere tabbladen in de kop);
                      build.py plakt hem achter styles.css
  assets/logo.b64     logo als base64 — hier zelden iets aan doen
  assets/orbitron900.b64  lettertype Orbitron 900 voor de startanimatie (ingebakken, werkt offline)
  data/tiles.json     de 20 tegels + de vorm van een tegel (pattern)
  js/
    00-data.js        laadt tiles.json, bouwt tileLookup, globale state (layout, selectedSlot)
    05-card-art.js    kleur + icoon per opdrachtkaart (de oude Canva-plaatjes van de actiekaarten zijn weg)
    10-rules.js       plaatsingsregels, rotatie, kamer-/opdrachtnamen, welke tegel mag waar
    20-connectivity.js naden tussen tegels + bereikbaarheid op vakjesniveau
    30-random.js      seeded random (mulberry32) — zelfde seed = zelfde bord
    40-board.js       het bord tekenen, contour, naadmarkeringen, statusregel
    50-interaction.js slepen om tegels te verwisselen, selecteren
    60-palette.js     het register onderaan (twee tabellen: Kamers / Gangen)
    70-generator.js   backtracking-solver die een geldige indeling zoekt
    80-controls.js    knoppen: seed, dobbelsteen, vorige indeling, draaien, legenda; bij het openen
                      meteen een willekeurige kaart (met "Aan het genereren"-vakje i.p.v. het bord)
    90-editor.js      tegel-editor (vakjes aan/uit klikken)
    95-simulate.js    batch-spelsimulatie (2xD6, geen U-turn, bezette vakjes blokkeren)
    96-walk.js        tabblad "Spelen": modus Automatisch, automatische simulatie van 1-4 spelers
    96b-intro.js      startanimatie na "Start spel", variant "Titan" (2026-10): traag aftellen met zware dreun,
                      schudden + opbouw, BAM, hyperjump, het zwarte gat in met een gong (gekozen uit 15
                      geluiden; ±10,6 s) + vinkje in de lobby. Overgang naar het spel: een zwart gordijn
                      over het HELE scherm (`.start-intro-curtain`) gaat mee dicht met de duik, daaronder
                      wisselen kop/achtergrond/bord, pas na 2 getekende beeldjes faadt het in 0,8 s weg
    96c-crystals.js   kristallen: tekenen (renderCrystal), de kluis, de animaties bij oprapen, zeshoekjes op
                      de spelerskaartjes. Staat bewust vóór 97-solo.js (zie de kop van het bestand)
    96d-dice.js       dobbelvak: stenen "Pantser" (afgeschuind, ruitstippen), wachten = puls, gooien =
                      teleport (lichtstraal + ring in `.sd-cell`); gekozen uit 10+10+10 varianten, artifact
                      "Axiom-9 Dobbelstenen" (2026-10). Ook "Wie begint?" (zelfde 42px, zelfde puls/teleport).
                      Puls = 1,9 s met starttijd 0, gelijk met de dobbelknop (axPulseBtn). Elke worp rolt
                      eerst even (bot: tollen, eigen worp: `DICE_ROLL_MS`) en teleporteert dan.
                      Energiesteen met bliksems + "+2", teller Gegooid/Nog te zetten + stappenbalk,
                      energiebolletjes naar de balk
    97-solo.js        tabblad "Spelen": modus Zelf spelen, eigen speler besturen tussen bots, energiekaarten
    98-cards.js       tabblad Speelkaarten: vitrine + zoom voor opdrachtkaarten en kristallen
    98b-avatar.js     avatars in de multiplayer-kamer: 5 karakters, 5 brillen, 5 hoedjes (SVG) + editor
    98c-rules.js      tabblad Spelregels: 12 hoofdstukken (bord opbouwen t/m einde) + kleine animaties
    99-multiplayer.js tabblad "Multiplayer": lobby + peer-to-peer spelen met vrienden (WebRTC)
build.py              plakt alles tot dist/axiom9.html
dist/axiom9.html      GEBOUWD — niet handmatig bewerken
```

De JS-bestanden worden in bovenstaande volgorde achter elkaar geplakt in één
`<script>`. Er zijn dus geen imports/exports; alles deelt één scope. Nieuwe
functies moeten gedefinieerd staan vóór de plek waar ze bij het laden worden
aangeroepen (functiedeclaraties worden gehoist, `const`/`let` niet).

## Waar moet ik zijn?

| Ik wil...                                  | Bestand              |
|--------------------------------------------|----------------------|
| een tegel van vorm veranderen               | `src/data/tiles.json` |
| een kamer hernoemen / kamer↔gang wisselen   | `10-rules.js` (`ROOM_NAMES`) |
| een opdracht hernoemen (2.1–2.9)            | `10-rules.js` (`QUEST_NAMES`) — puur thematisch, geen spelregel |
| regel wijzigen over waar een tegel mag liggen | `10-rules.js` (`canTileGoInSlot`) |
| de generator slimmer/anders maken           | `70-generator.js`     |
| kleuren, formaat vakjes, mobiel             | `styles.css`          |
| de blauwe hoofdknoppen (alle `button.primary`) | `styles.css` (`button.primary`): "glas + hoofdletters", gekozen optie 9 uit 9 (2026-10). Eén stijl én één lettergrootte (13px, ook groot/klein) voor alle 14 + de modusknoppen Automatisch/Zelf spelen (`.walk-mode-btn`); grote knoppen zijn alleen breder/hoger. Geen eigen `font-size` per knop toevoegen (gemeten: overal 13px, niets loopt uit een knop op 1440 en 1920 breed) |
| een knop toevoegen                          | `index.html` + `80-controls.js` |
| de **console**-knoppen in de lobby (Spelen + Spel hosten; gekozen variant 3 "Console" uit 6, artifact "Axiom-9 Lobbyvarianten", 2026-10, in de glazen knopstijl van de eerdere schuifrail; de schuifrail zelf viel af) | `segmentSelect` onderaan `80-controls.js` + `.seg-*` in `styles.css`: losse knoppen met ALLEEN tekst, gekozen = glas; `data-rail="vert"` = één lijst onder elkaar (Energie-inzet). Geen lampjes/bolletjes, geen stand naast het label en geen meter (gebruikerswens 2026-10). Modusknoppen Automatisch/Zelf spelen = dezelfde knoppen. De `<select>` (Tempo: `<input type=range>` met `data-labels`) in index.html blijft verborgen de bron; op een optie `data-short` (woord op de knop), `data-note` (regeltje eronder), `data-cost` (prijs, bij Energie-inzet uit ENERGY_ACTIONS in 96-walk.js). Geen glijdend schuifje/animatie meer. "Startanimatie tonen" staat bij Automatisch met `margin:auto` precies tussen de Tempo-balk en "Start spel" (`--lobby-gap`); Zelf spelen neemt diezelfde hoogte over (gemeten afstand tot de knop, `walkIntroMeasureAuto`/`walkIntroPlace` in 97-solo.js). Nieuwe keuze = element toevoegen en het id in de lijst onder `segmentSelect` zetten |
| een spelregel-tekst of -animatie aanpassen  | `98c-rules.js` (`rulesSections` = teksten, `RULES_SCENES` = animaties) + `rules.css`. Energie-acties, kristallen en getallen (6 opdrachten, max. 10 energie, kluis 3, afstand tussen de portalen bij de start) komen uit de spelgegevens, dus die lopen vanzelf mee; een eigen korte zin voor een energie-actie in `RULES_ENERGY_TEXT`. Verander je een spelregel in de code, pas dan ook de tekst hier aan |
| iets aan de tegel-editor                    | `90-editor.js`        |
| de spelsimulatie aanpassen                  | `95-simulate.js`      |
| een energie-actie of de prijs ervan aanpassen | `95-simulate.js` (`ENERGY_ACTIONS`, `botPreRollMove`) + knoppen in `97-solo.js` (`soloRenderActionPanel`/`soloUseEnergyAction`) |
| iets aan de portalen (regels, bot-keuze, hoe ze eruitzien) | regels + bot: blok PORTALEN in `95-simulate.js`; bord/animatie: `walkPaintPortals` e.v. in `96-walk.js` + blok PORTALEN onderaan `styles.css`; keuze van de mens: `soloEnterPortalAim` e.v. in `97-solo.js` |
| iets aan "Spelen" → Automatisch (pion, tempo) | `96-walk.js`   |
| de modus-schakelaar zelf (Automatisch/Zelf spelen) | `97-solo.js` (`setWalkMode`) |
| het tabblad Multiplayer (deelt #tabWalk met Spelen) | `80-controls.js` (`switchTab`, tab `multi`) |
| de namen van de bots (alle modi)             | `96-walk.js` (`BOT_NAMES`, `pickBotNames`) |
| het kristalvakje van een gang verplaatsen | tegel-editor in de tool (of `src/data/tiles.json`, labels `4.1`–`4.10`) |
| een kristal toevoegen / tekst of moment aanpassen | `95-simulate.js`: `ACTION_CARDS` (name/text/when/hint) + `ACTION_CARD_TINTS` + `ACTION_CARD_ICONS`; hoeveel er in de stapel zitten in `ACTION_CARD_COPIES` (standaard 2). Daarna de bot-keuze in alle drie de modi (simulateOneGame, 96-walk.js, soloResolveBotTurn) en de mens in `soloPlayCard`/`soloCardBlockReason` (97-solo.js) |
| hoe een kristal, de kluis of het oprapen eruitziet | `96c-crystals.js` + het kristallen-blok onderaan `styles.css` |
| de dobbelstenen, de stappenteller of de energiebolletjes | `96d-dice.js` + het dobbelstenen-blok onderaan `styles.css` |
| de kaders/vlakken ("zwevende kolommen", gekozen variant 5 uit 6, 2026-10; sinds 2026-10 op de HELE pagina, niet alleen tijdens een potje) | blok `"ZWEVENDE KOLOMMEN" OP DE HELE PAGINA` onderaan `styles.css`: `--page-bg` = `#070a0e`, elke `.panel`/pop-up één kaart zonder rand of amber lijntje, het generatorbord zonder stalen kader. Tijdens een potje (`body.is-playing`) ook: spelerskaarten, beide zijkolommen, bord en chat elk één kaart (`--panel`, ronde hoeken, zachte schaduw) op `#070a0e`, alles binnenin plat. Randen houden hun DIKTE (alleen kleur transparent), zodat alle gemeten maten gelijk blijven — gemeten 1920×960 en 1440×780: identiek aan vóór de wijziging |
| de speelweergave (smalle balk, ☰-menu, bordgrootte tijdens een potje) | `body.is-playing` in `styles.css` + `playMenuSetOpen` (80-controls.js) + `walkPauseStopSyncVisibility` (96-walk.js) |

## Spelregels die in de code zitten

- Beweging is **horizontaal/verticaal**, nooit diagonaal.
- Een zijde van een tegel is een **doorgang** als beide deurvakjes gevuld zijn.
  Deurvakjes: N=(0,3)(0,4), Z=(7,3)(7,4), W=(3,0)(4,0), O=(3,7)(4,7).
- Op een **hoekpositie** (A, E, P, T) mag geen doorgang het bord af wijzen. Dat kan
  alleen een tegel met precies 2 open zijden die aan elkaar grenzen (niet tegenover
  elkaar) — met de huidige tegelset zijn dat tegel 1, 5, 16 en 20. Via rotatie kan
  elk van die vier op elke hoek terechtkomen (`isCornerCapable` in `10-rules.js`).
- **7 tegels hebben alle vier de zijden open** (tegels 7, 8, 9, 10, 11, 13, 17).
  Alleen tegel **8** (Hibernatie, zie hieronder) ligt gedwongen binnenin op
  G/H/I/L/M/N — voor de rest is er bewust **geen** regel die 4-weg-tegels
  naar binnen dwingt, zie de "Niet doen"-paragraaf verderop.
- Tegel **8** (Hibernatie) bevat de vier startposities 3.1–3.4 en hoort ook binnenin.
  Als enige kamertegel heeft hij bewust **geen** opdrachtvakje — de tegel-editor
  staat dat uitzonderlijk toe (zie `tileValidationIssues` in `90-editor.js`).
- De generator zoekt een indeling **zonder doodlopende naden** en waarbij alle
  20 tegels met elkaar verbonden zijn. Kandidaten (pool van 20) worden daarna
  gerangschikt op (1) `deadTileCount`; (2) kamers achter een wurgpunt;
  (3) `roomIsolationScore` — hoeveel gangen je hoogstens moet passeren van een
  kamer naar de dichtstbijzijnde andere kamer; (4) `questSpacingScore.minDist` —
  kortste loopafstand tussen twee opdrachtvakjes, zo groot mogelijk;
  (5) `questCoverageScore`; (6) eerlijkheid startposities. Zie `70-generator.js`.
  **Waarom `deadTileCount` bovenaan staat:** "dicht bij een opdracht" bleek niet
  genoeg — een buitenrand-lus kan 5 stappen van een opdracht liggen en toch 0
  bezoeken krijgen, omdat spelers alleen van opdracht naar opdracht reizen. De
  test is gevalideerd tegen de simulatie: hij wees exact de tegels aan die 0–17
  bezoeken kregen terwijl de rest er 4000+ had.
  **Niet doen — 4-weg-tegels verplicht binnenin.** Klinkt logisch (meer grid),
  maar is gemeten over 248 indelingen en pakt averechts uit: gemiddeld 4,0-4,4
  dode tegels i.p.v. 2,6-2,9, en het aandeel indelingen zónder dode tegel zakt
  van ~17% naar ~4%. Reden: de 4-weg-tegels zijn de knooppunten; sluit je die
  allemaal in het midden op, dan houdt de buitenring alleen 2- en 3-weg-tegels
  over en dat is precies de gangenlus waar niemand komt. Twee ervan (7
  Serverruimte, 17 Kernreactor) dragen bovendien een opdracht, dus centraal
  vastzetten haalt de reden weg om naar buiten te lopen.
- Spelsimulatie (`95-simulate.js`): 2×D6 = exact aantal te lopen stappen, geen
  U-turn, bezette vakjes (andere spelers) blokkeren. Land je onderweg op je
  eigen opdrachtvakje, dan loop je met de resterende stappen gewoon door — de
  beurt stopt er **niet meer** voor (vroeger wel; sinds 2026-08 vervalt de rest
  van de worp niet meer, want dat voelde als verspilde stappen). Voert de rest
  toevallig ook door de VOLGENDE opdracht, dan pak je die in dezelfde beurt
  meteen mee (zeldzaam: ±0,3% van alle opdracht-momenten). Zie `resolveMove`/
  `pickEnd`: `targets` is de rij nog te halen opdrachtvakjes vanaf het huidige
  doel, en `bankedCount` in het resultaat zegt hoeveel er deze beurt zijn
  gehaald. Elke speler heeft een eigen geschud stapeltje opdrachten 1–9
  (labels `2.1`–`2.9`); wie als eerste 6 opdrachten voltooit wint. Draait altijd
  op de indeling die op dat moment in de tool staat.
- **Naam op het scherm: "kristal(len)"**, niet meer "actiekaart" (sinds 2026-10; de speler
  bewaart ze in zijn "kluis", max 3).
  **De set (2026-10, gekozen door de maker)**: 15 soorten, van elk 2, Portaalsleutel 5 = 33.
  Beweging: Zwaartekracht-laarzen, Stuwlading, Koerscorrectie. Energie: Noodrantsoen,
  Condensator, Energielek (pak 2 van een ander), Dubbele steen (2 energiestenen), Zonnezeil
  (energie = laagste loopsteen). Nut: Blinde Vlek, Portaalsleutel (gratis Portaalkanon, één
  portaalschot per beurt), Zelf kiezen (één loopsteen een waarde naar keuze; mens kiest in het
  kristalvak, fase 'die-pick', multiplayer-intent 'pickDie'). Verstoring: Kortsluiting,
  Duwstoot, Vergrendeling, Stroomonderbreking. **Weggehaald, niet terugzetten zonder de maker**:
  Snelroute, Herkalibratie, Kristalruil, Vooruitblik, Prioriteitspas, Noodbarrière,
  Terugtrekbevel (= dubbel met Duwstoot), Signaalstoring. Bot-keuzes voor de nieuwe zitten in
  gedeelde functies in 95-simulate.js (`pickEnergyLeakTarget`, `botWantsTwinEnergy`,
  `botPickDieValue`; Portaalsleutel via `botPreRollMove` als kind 'portalCard').
  Meting: de simulatie toont per kristal "Wint wie hem speelt" (25% = gemiddeld, >31% te sterk,
  <19% zwak). Eerste meting (2000 potjes): alle 15 tussen 22,7 en 27,7%.
  Kortsluiting op een mens deed tot 2026-10 niets (alleen bots misten hun steen); nu ook voor de
  mens, in `soloRollEnergyForTurn`. In de code heten ze nog `ACTION_CARDS`, `p.cards`,
  `actionCells` enz. — bewust niet hernoemd. Nieuwe zichtbare tekst dus altijd "kristal".
  **Ontwerp** (`96c-crystals.js`): een langgerekte zeshoek, rand in de kleur van de soort
  (`ACTION_CARD_TINTS`), bovenin het moment, icoon, naam, één zin (`text`), onderin de soort.
  Getekend uit de gegevens, geen plaatjes meer. **`when` is de enige bron** voor wanneer een
  kristal mag: zowel het label op het kristal (`CRYSTAL_WHEN`) als de regel in
  `soloCardBlockReason` lezen het ('pre' vóór de worp, 'any' vóór of na, 'start' na de worp
  maar vóór je eerste stap, 'post' tijdens je zet, 'auto' vanzelf aangeboden).
  **Kluis**: altijd open in de zijkolom, onderaan gelijk met het bord. Groot het gekozen
  kristal, ernaast de 3 plekken, de reden waarom het nu (niet) kan, Gebruik/Afleggen. Alleen
  het gekozen plekje pulst (`crystalPulse`, zelfde ritme als de dobbelknop). De kluis staat
  ALTIJD groot (gebruikerswens), ook vóór het dobbelen en tijdens een doelwit-/richtingkeuze.
  De energie-acties staan weer ONDER ELKAAR (gebruikerswens: de 2x2-tegels stonden scheef en de
  tekst liep door het vak; alleen de laarzen-richtingen zijn nog 2x2); het grote kristal schaalt
  met `--wcell`. Dobbelvak (134px) en energievak hebben een VASTE hoogte, vóór én na de worp —
  anders schuift de kolom bij het dobbelen (gebruikersmelding). Energievak: 300px met icoonrijen
  + uitlegregel (Full HD, gemeten max. 298px bij 0 energie), en onder 865px hoogte of 1630px
  breedte 196px: kleine iconen, geen uitlegregel (tooltip) (`.is-actions` in styles.css).
  Gemeten: kolom = bordhoogte op 1440×780 (559px), 1920×870 (717px) én 1920×960. Iets
  toevoegen in de zijkolom? Opnieuw meten.
  **Energiebalk = stroomcircuit** (gekozen uit 10 ontwerpen): 10 knooppunten (`.ec-node`) aan
  één leiding (`.ec-seg`), opgebouwd in `soloRenderEnergyOverview`. Opladen: stroom over het
  leidingstukje, knooppunt ploft aan met een ring; leeglopen: van achteren af, flakkeren +
  amber ring; puls: lichtpakketje (`.ec-track`) elke 2,4 s over de volle leiding. Eén
  knooppunt per `ENERGY_STEP_MS`. Het getal staat rechts met een vaste breedte (verspringt niet
  bij 10). De energiebolletjes landen op de knooppunten (`walkEnergyNodes`). Acties = icoonrijen
  (`ENERGY_ACTION_ICONS`, `renderEnergySoloButton` in 97-solo.js).
  **Oprapen** (`crystalEvent`, op elke plek waar iemand een kristal krijgt of een volle kluis
  heeft): eigen kristal groeit uit het vakje en vliegt in een boog naar je kluis ("Nieuw" tot je
  erop klikt); kluis vol = zilver vraagteken-kristal dat uit elkaar knalt (bewust niet het
  kristal dat je had gekregen: dat blijft op de stapel en zou de volgende trekking verklappen);
  een ander = anoniem zilver kristalletje naar diens spelerskaartje, nooit kleur of naam.
  Nagespeelde bot-beurten spelen het af als de pion er langskomt (`replay.crystals`).
  **Kaart in multiplayer**: de host stuurt bij de start `layout` (welke tegel waar) ÉN `rotation`
  (tileRotation per tegel) ÉN `tiles` (de vakjes per tegel, voor als de host tegels bewerkte) mee;
  de gast neemt alle drie over in `mpApplyHostMap` (99-multiplayer.js). Vroeger alleen `layout`,
  waardoor elke gast zijn eigen draaiing gebruikte (gebruikersmelding 2026-10: "niet iedereen ziet
  dezelfde map, sommige tegels zitten verkeerd"). Nieuwe kaart-instelling? Ook hier meesturen.
  **Gast: dobbelvak bij een nieuwe beurt** — `mpApplyState` zet in de fases 'choose-action' en
  'rolling' het dobbelvak terug naar "?" (`renderSoloDicePending`), net als de host in
  soloBeginHumanTurn. Anders hield .walk-hud de klasse .has-result van de vorige worp en verborg de
  opmaak de knoppen Dobbelen/Gooi: de gast kon niet meer dobbelen en het potje liep vast
  (gebruikersmelding 2026-10). **#mpWaitTurn** ("X is aan zet — even wachten") staat in het
  energievak (#walkSoloPanel), niet in het dobbelvak: dat heeft een vaste hoogte en de melding viel
  dan over de energiebalk heen. **Testen zonder twee computers**: een testpagina met twee iframes
  (host + gast) en een nagebootste Trystero via BroadcastChannel (`mpTrysteroMod` vervangen vóór
  mpHostCreate/mpJoinConnect) + een automatische speler per venster vond beide fouten; na de
  oplossing 5 potjes van 48–67 beurten zonder vastlopen of fouten.
  **Geheim in multiplayer**: de host stuurt de stand per gast apart (`mpSendPerGuest`); in
  `mpPublicPlayer` ziet elke gast alleen zijn eigen kristallen, van anderen alleen het aantal.
  Logregels noemen in multiplayer en bij bots nooit welk kristal er werd opgeraapt.
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
- **Portalen / Portaalkanon** (5e energie-actie, prijs 7, 2026-10; blok PORTALEN in
  `95-simulate.js`). Er liggen altijd een blauw en een rood portaal op het bord, gedeeld door
  iedereen; bij de start al, ≥16 stappen uit elkaar (`portalSetup`). Kanon = vóór de worp een
  richting kiezen, het portaal vliegt rechtdoor tot de muur of vóór een pion en landt op het
  verste gewone vakje (nooit op opdracht/start/kristal of het andere portaal), daarna kies je
  welke kleur je verplaatst; de andere blijft liggen, ook als een ander hem legde (stelen).
  Stap je in een portaal, dan kom je uit het andere en **stopt je zet** (instappen = 1 stap, de
  rest vervalt). Pion op een portaal = het paar werkt niet. Noodtransport, laarzen en duwkaarten
  negeren portalen. Techniek: `adjKey` blijft het gewone bord; alleen `resolveMove` (stop-regel,
  `pickPortalEnd`), `simBfsDistances` (A en B tellen als één vakje; `noPortal` voor Noodtransport)
  en `soloLegalNextCells` (mens) kijken naar `graph.portals = { cells: [blauw, rood], owner }`.
  Een pad door een portaal bevat ingang én uitgang (twee vakjes die niet naast elkaar liggen =
  `portalIsJump`); tel die stap niet als gelopen vakje. **Elke bot mag schieten** (ook vaste
  strategieën, via `botStrategyNow` → `botPortalWanted`) als het ≥6 stappen scheelt
  (`botPortalShot`); de Slim-bot alleen als het meer oplevert dan een sprint (`botSmartPick`).
  Bord: `walkPaintPortals`/`walkPortalShotFx`/`walkPortalJumpFx` (96-walk.js), opmaak blok
  PORTALEN onderaan styles.css (alleen transform/opacity). Uiterlijk gekozen uit 10 + 10
  varianten (artifact "Axiom-9 Portaalontwerpen", 2026-10): portaal = **gyroscoop** (tweede
  ronde, variant 16 uit 20, artifact "Axiom-9 Portaalvormen": twee ringen die samen om een felle
  kern draaien; de ovale poort uit de eerste ronde viel af), schot = **komeet** (kop + staart van 6 lichtjes, rechte lijn naar de
  muur, 2 schokgolven, portaal ploft open), bewust LANGZAAM (gebruikerswens: "zodat je echt goed
  ziet wat er gebeurt"): 130 ms per vakje, 0,7–1,7 s, op de snelste Automatisch-standen ×0,45
  (`PORTAL_COMET_MS_PER_CELL`). De komeet meet niets op: elk lichtje is een vakje groot en schuift
  in % van zichzelf + 1px gap per vakje. Zelf spelen: fases `portal-aim`
  (richting, knop of klik op het bord) en `portal-color`. Multiplayer: `portals` (plek + eigenaar)
  zit in de start én in elke stand (`mpPortalSnapshot`/`mpApplyPortals`), bot-beurten dragen
  `replay.portalShot` (voor/na), intents `portalAim`/`portalColor`.
  **Gekozen na een analyse van 44 varianten × 10.000 potjes** (artifact "Axiom-9 Portalen"):
  doorlopen na een portaal = te sterk (potjes 6–11% korter, tot 10% van de opdrachten via een
  portaal); vrij plaatsen binnen 10 = te veel controle; vast of zwervend = puur toeval; "niet bij
  een opdracht" deed bijna niets. Nagemeten na het inbouwen (4 borden × 10.000, elke bot mag
  schieten), winst% Stuwstoot / Herprioritering / laarzen / Noodtransport:
  zonder portaal 24,7 / 23,8 / 25,8 / 25,6 (85,8 beurten) · prijs 6: 22,9 / 25,3 / 23,6 / 28,1
  (Noodtransport te sterk) · **prijs 7: 23,8 / 25,2 / 24,7 / 26,4** (82,9 beurten, −3,4%) ·
  prijs 8: 23,7 / 24,9 / 24,9 / 26,5. Bij 7: 2,6 schoten per potje, 27% gestolen, 3,0% van de
  opdrachten in een beurt met een sprong, meeste teleporteerder wint 16,6%. Slim-bots: 1,1
  schoten per potje bij 7; een Slim-bot zónder portaal wint 24,7% tegen drie mét (geen merkbaar
  voordeel); laarzen-gebruik zakt van 8,2 naar 6,3 per potje. Speeltest met mensen nog te doen:
  wordt er gestolen, voelt 7 te duur (dan eerst 6, niet lager), worden potjes niet te kort.
- **Begin van een potje** (Zelf spelen, Multiplayer én Automatisch): in de lobby
  kies je géén startpositie meer, je ziet alleen spelers en namen. Het potje
  begint met dobbelen (2 stenen, geen energiesteen) wie begint; de hoogste kiest
  als eerste een startpositie, daarna aflopend, en die volgorde is meteen de
  beurtvolgorde. Gelijk op welke plek dan ook → alleen die spelers gooien
  opnieuw (`openingSplitBucket` in `95-simulate.js`). Je eerste opdracht is
  geheim (`p.questHidden`, ook niet meegestuurd in Multiplayer) tot je mag
  kiezen; dan staat hij op het bord en gloeien de vrije startvakjes. Bots kiezen
  de vrije startpositie het dichtst bij hun eerste opdracht (`botPickStartLabel`).
  Weergave: `renderOpeningPanel` in `96-walk.js` (de hele rechterkolom),
  logica: `soloBeginOpening` e.v. in `97-solo.js`, Automatisch: `walkRunOpening`.
  De batch-simulatie houdt bewust vaste startposities: die meet juist de
  eerlijkheid **per** startpositie.

## Controleren of het nog werkt

Na een wijziging altijd `python build.py` en dan `dist/axiom9.html` openen.
Check minimaal:
1. "Genereer nieuwe map" → willekeurige nieuwe kaart (geen dobbelsteentje meer; het
   seed-veld is alleen-lezen en toont de huidige seed), seed ook rechtsboven. De kaart
   faadt uit, in het bordvak verschijnt het **sterrenbeeld** (gekozen variant 8 uit 8, 2026-10;
   `genNet` in 80-controls.js, blok `.gen-net` in styles.css): één ster per tegelplek, precies
   over het bord gelegd (`genNetPlace`). Verbindingen groeien mee met de voortgang, soms een rode
   lijn die terugtrekt (terugsporen). Geen tekst eronder en geen zoom: het netwerk is van begin tot
   eind precies even groot als het bord (gebruikerswens 2026-10). Klaar → golf vanaf Hibernatie op
   de nieuwe kaart, sterren blauw (kamer) / paars (gang), daarna faadt de nieuwe kaart in (0,9 s, GEN_FADE_MS). Alleen transform/opacity
   (de generator rekent op dezelfde draad). Tijdens het genereren zijn de tabbladen Simulatie, Spelen
   en Multiplayer uitgefaded en disabled (`genLockTabs`, ook al in index.html). Onder de knoppen
   staat normaal niets; alleen bij een fout (mislukte indeling, kan niet draaien/wisselen)
   een korte rode melding. Niets verschuift tijdens het genereren.
2. Onbereikbare vakjes (bv. na een tegel-bewerking) krijgen een roze/magenta rand
   direct op het bord — geen apart paneel, dit is de enige indicatie.
3. Een tegel selecteren → draaiknoppen gaan per **90°** (niet 180).
4. Een tegel over een andere slepen → wisselt om, rood kader = niet toegestaan.
5. Browserconsole moet leeg zijn.
6. Paneel Simulatie: het aantal potjes is een **rolteller** (gekozen ontwerp B uit 4, sinds 2026-10):
   5 rolcijfers (voorloopnullen gedimd; een hoger cijfer komt van BOVEN binnen en 9 → 0 rolt door als
   een kilometerteller, `simReelMove`: rol = 3x 9..0, beweging is een Web Animation), −100/+100 ernaast (ingedrukt houden = steeds sneller,
   na 12 stappen per 500) en daarbuiten −1000 links / +1000 rechts (`data-sim-size`, altijd per 1000), pijltjestoetsen op de teller, snelkeuzes 500/1.000/2.000/5.000/10.000
   en een brede startknop. Bron blijft het verborgen veld #simCount (100–20.000, stap 100);
   weergave `simCounterRender`/`simCountSet` in 95-simulate.js, opmaak `.sim-*` bovenin styles.css.
   "Draai simulatie" → 4 startposities laten allemaal winst
   zien, "vastgelopen potjes" is 0 of bijna 0. Tijdens het rekenen staat er een
   "Aan het simuleren"-vakje met de **tijdring** (gekozen 2026-10 via Zwaartekracht → variant 2 uit 20;
   `simStream` in 95-simulate.js, `#simRing`/`.sim-ring`): zwart gat met gloeiende schijf, deeltjes
   spiraleren erin, 60 streepjes rond het gat gloeien met de klok mee op (= voortgang); géén getal in
   de kern (eerst seconden, op verzoek weer weg). Alleen Web
   Animations/transitions op transform/opacity, want de simulatie rekent in brokken van 30 ms op
   dezelfde draad. Eronder alleen potjesteller en "Stoppen" (`button.primary`, zelfde stijl als de
   andere knoppen); bij klaar staat de volle ring nog 0,7 s, dan faadt de uitslag in.
7. Onderaan de simulatie: tabel "koudste tegels" — geen enkele tegel mag op
   0,0% verkeer staan. Gebeurt dat toch, dan is er een dode lus ontstaan en
   klopt `deadTileCount` in `70-generator.js` niet meer.
8. Tabblad "Spelen" → modus "Automatisch" → "Start spel" → de pion loopt
   zichtbaar, de dobbelstenen rollen, en het potje eindigt met hetzelfde
   winscherm als Zelf spelen (embleem in winnaarskleur + klassement plaats/naam/opdrachten, "Toon kaart"/"Toon
   uitslag"); de knop rechtsboven heet dan "Terug naar lobby" en werkt.
   Na afloop is de zijkolom (dobbelen/energie/kluis) en het opdrachtenoverzicht leeg, en zijn
   "Toon legenda"/"Toon log" (plus de legenda en het log zelf) weg, ook na
   "Toon kaart" (`.is-game-over` op .walk-play-layout, `soloSetGameOverView` in 97-solo.js;
   weer weg via `soloHideEndgame` bij een nieuw potje/stoppen).
   Tempo moet je tijdens het lopen kunnen wijzigen (schuif
   rechtsboven naast Pauze/Stoppen); "Stoppen"
   moet de pion echt stilzetten (geen achtergrondlus die doorloopt).
9. Elke gangtegel heeft één paars kristalvakje (een zeshoekje binnen het vierkante
   vakje; legenda "Kristalvakje (4.x)"). Loopt jouw pion er tijdens "Zelf spelen"
   overheen, dan groeit het kristal uit het vakje en vliegt het naar je kluis, en
   loopt de pion gewoon door — de beurt stopt er niet voor. Kluis vol: zilver
   kristal knalt uit elkaar en de kluis schudt rood. Een bot die opraapt: klein
   zilver kristalletje naar zijn spelerskaartje, en in het log geen naam.
   De kluis staat altijd in de zijkolom (ook leeg, gestippeld) en mag nooit onder
   het bord uitsteken; de knoppen Gebruik/Afleggen verspringen niet.
10. Tabblad "Multiplayer" (eigen tabblad naast Spelen; gebruikt hetzelfde vak
    #tabWalk in de modus 'multi', Spelen heeft alleen Automatisch/Zelf spelen).
    Lobby: grote knop "Spel hosten", lijn "of", daaronder meteen naam + spelcode
    + "Deelnemen aan spel". Check: "Spel hosten" geeft een kamercode + een
    spelerskaartje in dezelfde 2-koloms stijl als de Zelf-spelen-opzet, chat
    staat eronder (niet meer ernaast). Laat een tweede speler meedoen, start
    een potje (de chat staat dan als eigen 4e kolom rechts, de zijkolom met
    dobbelen/energie/kaarten blijft volledig zichtbaar; "Verlaat potje" staat
    rechtsboven in de kop), en klik daarna (als host én als gast) op "Verlaat potje" —
    dat moet terugkeren naar déze multiplayer-lobby (kamercode/spelers nog
    intact), niet naar de modus Automatisch. Speel ook een potje uit: host én
    gast krijgen het winscherm met klassement, en "Terug naar lobby" (dezelfde
    knop) brengt beiden terug naar de kamer. Een gast met een naam die al in
    de kamer zit (ook met andere hoofdletters) wordt geweigerd: terug naar het
    formulier met rood naamveld (`mpHostOnHello` / `mpJoinRejected`). Speel als
    gast een hinderkaart (bv. Stroomonderbreking): je krijgt de doelwit-keuze te
    zien, net als het Blinde-Vlek-aanbod (`ownerUi.cardActionsHtml` in
    `mpBroadcastState`). Kamer (host én gast, zelfde opbouw): code + Kopieer,
    één vak per plek (naam in spelerkleur, "Host" rechts, lege plek golvend
    "Wachten op speler"), knoppen vast onderaan gelijk met de chat. De gast
    heeft onderaan een statusbalk: na 10 s volle kamer wordt die "Stuur host
    herinnering" (taunt 14, daarna 5 s afkoelen) — `mpUpdateWaitStatus`.
    Host-keuze "Beurten van de bots" (Laten zien): de host stuurt per bot-beurt één
    'botturn'-bericht (`mpOnBotReplay`) en zendt tijdens soloPhase 'bots' géén stand; elke
    gast speelt de beurt zelf na (`mpClientOnBotTurn` → `soloAnimateBotTurn`). Check: bij de
    gast loopt de bot-pion vloeiend, en het log is gelijk aan dat van de host (geen dubbele regels).
    Kamer = **"De brug"** (gekozen ontwerp, 2026-10; `#mpRoomLayout.is-room` in styles.css):
    links boven de avatar-maker (van boven tot aan de knoppen), links onder in de hoek de knoppen
    (Spel starten/afbreken of wachtstatus/Verlaten), midden de brug (`mpRenderBridge`: tafel met
    code + Kopieer + "x / y aan boord" die als sonar pulst, 4 stoelen in de hoeken), rechts de chat
    over de volle hoogte. Komt er iemand binnen: **BAM** (`mpBridgeJoin`) — dikke ring in zijn
    kleur, tafel flitst, stoel klapt open, naam groot in beeld + chatregel "X is aan boord"; pas
    bijhouden zodra je zelf aan boord bent (anders kreeg een gast een BAM voor iedereen + zichzelf).
    Avatar = { c, e, g, h }: 12 karakters (nieuw: Luna, Krak, Pixel, Comet, Rots, Kristal, Baard),
    8 gezichten (Blij, Lachen, Verbaasd, Stoer, Boos, Tong uit, Grijns, Verdrietig; `AVATAR_FACES`),
    8 brillen, 8 hoedjes; een karakter is alleen het hoofd, het gezicht tekent wenkbrauwen + mond in
    de kleuren van het karakter. Oude avatars zonder `e` krijgen gezicht 0. Editor = één raster van
    4 kolommen (Karakter + Gezicht | Bril + Hoedje), dus elke groep 12 of 8 stuks — nieuwe items
    altijd per 4 toevoegen, en ACHTERAAN (de index is wat er bewaard/verstuurd wordt). Stoelen op
    de brug zijn 4 blijvende elementen die elk apart worden bijgewerkt (anders begon "Wachten…"
    opnieuw te golven zodra iemand iets aan zijn avatar veranderde). Eerst een karakter (tab Accessoires zit tot dan op slot), daarna de rest —
    staat meteen op je stoel en bij de anderen (gast → 'avatar'-bericht → host zet `seat.avatar`
    en stuurt de lijst rond).
    Nog een keer klikken op een item = weer af. Wordt per browser onthouden (localStorage).
11. **Speelweergave** (alle drie de modi, zolang er een potje in beeld is): `body.is-playing`
    (gezet in `walkPauseStopSyncVisibility`, 96-walk.js; in Multiplayer ook `is-mp-game`).
    De grote kop is dan een smalle balk: links "☰ Menu" + klein logo, rechts de spelknoppen
    (Tempo/Pauze/Stoppen, Nieuw potje, Verlaat potje). De tabbladen schuiven links uit over het
    spel heen (`playMenuSetOpen` in 80-controls.js; dicht met ✕, Escape, klik ernaast of een
    tabblad kiezen). Pagina op volle breedte, bord tot 34px per vakje ("altijd zo groot
    mogelijk"); hoogte boven/onder het bord = `--play-chrome` (224px, gemeten). Kolomminima:
    links 280px, zijkolom 370px (smaller breken opdrachtnaam/energietegels af); Multiplayer
    270 / 370 / chat 230px. Gemeten: Full HD ±21px, 1440×780 ±15px, Multiplayer op Full HD even
    groot als de rest. Buiten een potje blijft de gewone kop.
    Speelscherm op ±1400px breed (laptop/half scherm): alles in beeld, niets
    afgeknipt — het bord krimpt daar mee (zie `--wcell` in `styles.css`),
    onder 1360px staat alles onder elkaar. `--wcell` schaalt óók met de
    schermhoogte: vanaf ±780px zichtbare hoogte (o.a. Full HD met
    browserbalken, 1440×780) moet het hele speelscherm zonder scrollen passen.
    "Toon legenda"/"Toon log" zijn VOOR NU VERBORGEN (gebruikerswens 2026-10: staan in de weg,
    komen later op een andere manier terug): één CSS-regel bij `.walk-extras-toggle` in
    styles.css verbergt de knoppen + #walkLegend + #walkLog; walkLog() schrijft gewoon door.
    Het opdrachtenoverzicht
    is een **afvinklijst met kleurstroken** (gekozen uit 4 ontwerpen; `soloRenderQuestChecklist`):
    geen 2.x-nummers meer (de opdrachtkaarten krijgen later alleen naam + opdracht), streep +
    rondje in de opdrachtkleur, groen vinkje = voltooid, kloppende stip + "actief" = huidig doel;
    hover = spieken (rand in jouw kleur + oogje). Erboven (Zelf spelen + Multiplayer) de
    **missiestrook** (gekozen ontwerp D uit 4, 2026-10; `soloMissionHtml` in 97-solo.js, `.mission-*`
    in styles.css): volgorde pillen Beurt / Stand → kopje "Opdrachten voltooid" (geen los x/6-getal
    meer) → 6 zeshoekjes; overal 14px tussen de regels en alle tekst in pillen + kopje 15px
    (gemeten: tekst exact gecentreerd in de pillen). De zeshoekjes aan een
    lijn (groen + vinkje = voltooid; de actieve opdracht ook groen, NIET de kamerkleur, met een
    sonarpuls: 2 ringen op `.mission-slot.is-next`, `missionSonar`, alleen transform/opacity) en groot
    "Opdrachten voltooid x / 6". De opdrachtkaart en de 3 tegels zijn daar weg (de kaarten zijn voor
    de fysieke versie); `.walk-info-panel.is-mission` verbergt #walkQuestCard/#walkMeta/#walkScoreActive.
    Automatisch toont ze nog wel. Gemeten 1920×960 en 1440×780: kolom = bordhoogte, niets scrollt. Alle rijen even brede
    rand/streep, zodat rondjes en namen exact onder elkaar staan (gemeten). Onder 865px hoogte of
    1630px breedte naam + kamer op één regel; nooit scrollen (gemeten 1920×900 en 1440×780). Minimum is
    13px per vakje; daaronder scrolt het nog. De tabbladen staan in de kop naast
    logo + titel (op een smal scherm op een eigen regel eronder; tijdens een potje in het ☰-menu). De
    spelerskaarten boven het bord zijn één regel: naam groot (nooit afgekapt),
    rechts Voltooid / Energie / Kaarten; "aan zet" en de eindplaats als tabje op
    de rand. Verandert de hoogte boven/onder het bord, pas dan de 300px in
    `--wcell` (styles.css) aan.
12. Zelf spelen → energie-paneel toont 5 acties op prijs (Stuwstoot 4,
    Herprioritering 4, Zwaartekracht-laarzen 5, Portaalkanon 7, Noodtransport 10), in hetzelfde
    vaste vak (gemeten: 1920×960 nog 40px ruimte, 1440×780 nog 24px). Op het bord liggen een
    blauwe en een rode portaalring; Portaalkanon → richting (knop of klik) → kleur ("ligt er sinds
    de start" / "gelegd door X") → lichtspoor + nieuw portaal, daarna gooi je. Loop je in een
    portaal: flits, je komt uit het andere en je zet stopt. Simulatie → blok "Portalen" met
    schoten/gestolen/sprongen en twee oordelen (opdrachten via portaal ≤5%, meeste
    teleporteerder wint ≤30%).
    Herprioritering laat je huidige én volgende opdracht zien en vraagt welke
    eerst; de laarzen tonen de richtingen als knoppen én omrand op het bord, en
    daarna gooi je gewoon. De kaart Zwaartekracht-laarzen kan alleen vóór het
    dobbelen en blokkeert de laarzen-actie in dezelfde beurt. Simulatie →
    "Welke energie-actie wint?" toont alle vier rond de 25%.
13. Lobby Zelf spelen = **bemanningslijst** (gekozen ontwerp B uit 4, sinds 2026-10; vervangt de
    keuzelijsten Aantal spelers/Aantal bots): altijd 4 rijen (lege plekken gestippeld), eerst de
    mensen (plek 1 = "jij"), dan de bots; achter een bot alleen het woordje "bot" (gebruikerswens,
    geen icoon). "+ Speler"/"+ Bot" (uit bij 4), ✕ haalt precies die plek weg; botnamen en
    ingevulde namen blijven staan. Elke rij = vijf VASTE vakjes (gebruikerswens, "niets mag
    verschuiven"): dik nummer 28px | bolletje 12px | naamvak (rest, 38px hoog; bij een bot een
    gestippeld vak van dezelfde maat) | rolvak jij/speler/bot 96px | verwijdervak 38×38 (bij jou
    uitgezet maar wel aanwezig). Gemeten: alle rijen exact gelijk, ook met een lange naam. De
    aparte kolom "In het schip" is op verzoek weer weggehaald (dubbel met de lijst). Code:
    `soloHumanCount`/`soloBotCount`/`soloBotNames`, `soloRenderSetupUI`, `soloCrewAdd`/`soloCrewRemove`
    (97-solo.js), opmaak `.crew-*` in styles.css.
    Begin van een potje (Zelf spelen met bots): lobby toont alleen namen. Na
    "Start spel" is de rechterkolom één groot paneel tot onderaan het bord;
    jij gooit via de knop, bots vanzelf; bovenaan staat ieders opdracht als
    "opdracht nog geheim". Bij gelijke worp gooien alleen die spelers opnieuw.
    Bij het kiezen staat de opdracht van wie kiest op het bord en lichten de
    vrije startvakjes op met een **schijnwerper** (gekozen ontwerp C + de ring van D, 2026-10;
    `walkGlowStarts`/`walkClearStartGlow` in 96-walk.js): rest van het bord gedimd behalve de
    startkamer (`.walk-spot`) en het doel (`.walk-target`), vrije vakjes in de kleur van wie
    kiest met een draaiende ring van RONDJES (geen streepjes: leek op een verkeerd symbool) en
    een dobberend pijltje. Kiezen kan ALLEEN op het bord; de 3.x-knoppen in het paneel zijn weg,
    en het paneel noemt geen 3.x-labels meer ("gekozen").
    Wie kiest, ziet in het paneel groot "Jouw eerste opdracht: <naam> in de <kamer>" in de kleur
    van die opdracht (`walkOpeningGoalHtml`), en op het gedimde bord een draaiende ring om het
    opdrachtvakje (`#walkBoard.is-start-pick .cell.walk-target::before`) — gebruikersmelding: in
    Multiplayer zag je je eerste opdracht niet goed, dus ook niet welk startvak het handigst is.
    Na het kiezen **vliegt de pion als komeet** naar zijn startvak (gekozen variant A, 2026-10;
    `walkCometToStart` in 96-walk.js): vanaf zijn bolletje in het kiespaneel in een boog met een
    staart van lichtjes, landing met twee schokgolven. Geen grote naam in beeld (gebruikerswens).
    Tijdens de vlucht staat de pion niet op het bord (`walkFlyingIdx`, paintWalkPawns slaat hem
    over) en wacht het spel met de volgende: `soloOpeningDoPick` verhoogt `op.pickPos` pas na de
    landing. Multiplayer-gasten zien een nieuwe keuze in de stand en spelen dezelfde komeet af
    (mpApplyState); Automatisch wacht er ook op (walkRunOpening). Vangnet: landing na 950+400 ms. Daarna komt
    de gewone kolom (dobbelen/energie/kaarten) terug en is de beurtvolgorde
    gelijk aan de kiesvolgorde. In Multiplayer moet een gast op zijn eigen
    scherm kunnen gooien en kiezen. Elke speler heeft een groot vak met vaste plekken voor 2
    stenen + de som (vaag "?" zolang je niet gooide; "gooit"/"gelijk" is een tabje op de rand),
    dus de stenen verspringen nooit. Wachten = stenen pulseren; bij de klik rollen ze en zodra de
    worp bekend is teleporteren ze (verdwijnen in een lichtstraal, komen terug met de uitkomst)
    (`openingDiceSet` in 96d-dice.js, per speler, omdat het paneel bij elke stap opnieuw wordt
    opgebouwd). Zelfde puls (`DICE_PULSE_FRAMES`) en teleport (`diceTeleport`) als in het
    dobbelvak, en even groot (42px, `--od`; gebruikerswens 2026-10).
    Na een dobbelronde schuiven de rijen langs elkaar naar de nieuwe volgorde (`openingShuffle`,
    1,3 s, pas als de stenen stilliggen); het potje wacht daarop (`openingBusyMs`). Bij het
    kiezen blijven dezelfde rijen staan, mét de worp; "kiest nu"/"start 3.x" zijn tabjes.
14. Winscherm → knop "Statistieken" opent een grote pop-up over het scherm
    (Escape/klik ernaast/Sluiten = dicht): bovenaan elke speler een eigen
    kolom, daaronder 6 categorieën (Algemeen, Dobbelstenen, Verplaatsing,
    Energie, Energie-acties, Actiekaarten) elk als eigen tabel met vakjes,
    hoogstens 3 naast elkaar. Past zonder scrollen op ±1400px. Tellers:
    `newPlayerStats` (95-simulate.js), lopen mee via `simRollD6(rand, player)`,
    `simGainEnergy` en `useActionCard`; afgeleide waarden en de indeling in
    `SOLO_STATS_GROUPS` (97-solo.js). Knop "Grafieken" in dezelfde pop-up: voortgang
    en energie per beurt (lijnen), worpen-verdeling 2–12 (staafjes) en per speler
    energie-acties/kaarten/vakjes (gestapelde balken). Data: `stats.hist`/`rolls`/
    `energyUse`/`cardUse`, gevuld via `statsTurnSnapshot`, `statsRecordRoll` en
    `statsUseEnergy` (95-simulate.js) — nieuwe plek waar gedobbeld of energie
    uitgegeven wordt? Daar ook die aanroep toevoegen.

15. Tabblad **Spelregels** (sinds 2026-10, `98c-rules.js`): links de hoofdstukken (blijft staan,
    het hoofdstuk in beeld licht op), rechts bij 10 van de 12 hoofdstukken een animatie die in een lus
    loopt, alleen als hij in beeld is. Animaties = Web Animations op transform/opacity met een vaste
    duur per scène (`rTrack`/`rShow`/`rWalk`); niets opvragen uit de opmaak. Check: console leeg, alle
    scènes bewegen, en de kop met 6 tabbladen overlapt de titel niet (gemeten op 1920, 1730, 1600,
    1505, 1440, 1366 en 1320 breed).

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

## Nog te doen

- De 5e energie-actie is het **Portaalkanon** geworden (zie Portalen hierboven); het
  portaalkristal is er sinds 2026-10 als **Portaalsleutel**. Andere ideeën die nog niet gemeten konden worden omdat bots ze niet zinnig spelen: een schild
  tegen de volgende hinderkaart, of een energieversperring op een gang naar keuze.

- Elke opdracht (2.1–2.9) heeft nu een naam (`QUEST_NAMES` in `10-rules.js`,
  zichtbaar in het paneel "Opdrachten" en in de simulatie-uitslag) zodat de
  fysieke opdrachtkaarten een titel hebben. De speelregel zelf is nog steeds
  de tijdelijke testregel: een opdracht telt als voltooid zodra je op het
  vakje staat, zonder verdere actie of inhoud.
