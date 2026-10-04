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

## Structuur

```
src/
  index.html          HTML-skelet met placeholders {{CSS}} {{JS}} {{LOGO}}
  styles.css          alle opmaak (~77 KB)
  assets/logo.b64     logo als base64 — hier zelden iets aan doen
  data/tiles.json     de 20 tegels + de vorm van een tegel (pattern)
  js/
    00-data.js        laadt tiles.json, bouwt tileLookup, globale state (layout, selectedSlot)
    05-card-art.js    illustraties/vector-art voor de opdracht- en actiekaarten
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
    96b-intro.js      startanimatie na "Start spel" (aftellen 3-2-1, hyperjump, zwart gat) + vinkje in de lobby
    97-solo.js        tabblad "Spelen": modus Zelf spelen, eigen speler besturen tussen bots, energiekaarten
    98-cards.js       kaartvenster/zoom voor opdracht- en actiekaarten
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
| een knop toevoegen                          | `index.html` + `80-controls.js` |
| iets aan de tegel-editor                    | `90-editor.js`        |
| de spelsimulatie aanpassen                  | `95-simulate.js`      |
| een energie-actie of de prijs ervan aanpassen | `95-simulate.js` (`ENERGY_ACTIONS`, `botPreRollMove`) + knoppen in `97-solo.js` (`soloRenderActionPanel`/`soloUseEnergyAction`) |
| iets aan "Spelen" → Automatisch (pion, tempo) | `96-walk.js`   |
| de modus-schakelaar zelf (Automatisch/Zelf spelen) | `97-solo.js` (`setWalkMode`) |
| het tabblad Multiplayer (deelt #tabWalk met Spelen) | `80-controls.js` (`switchTab`, tab `multi`) |
| de namen van de bots (alle modi)             | `96-walk.js` (`BOT_NAMES`, `pickBotNames`) |
| het actiekaartvakje van een gang verplaatsen | tegel-editor in de tool (of `src/data/tiles.json`, labels `4.1`–`4.10`) |

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
  Extra bot-strategie **Slim** (`'smart'`, Automatisch → Energie-inzet → "iedereen slim"):
  kiest aan het begin van elke eigen beurt zelf een actie of spaart (`botStrategyNow`/
  `botSmartPick` in 95-simulate.js); alle strategie-checks lopen via `botStrategyNow`. Zit
  bewust niet in `ENERGY_STRATEGIES` (de batch-simulatie meet de vaste strategieën).
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
   faadt uit, in het bordvak verschijnt "Aan het genereren" met een voortgangsring en
   aftellende tijd, daarna faadt de nieuwe kaart in (0,9 s, GEN_FADE_MS). Onder de knoppen
   staat normaal niets; alleen bij een fout (mislukte indeling, kan niet draaien/wisselen)
   een korte rode melding. Niets verschuift tijdens het genereren.
2. Onbereikbare vakjes (bv. na een tegel-bewerking) krijgen een roze/magenta rand
   direct op het bord — geen apart paneel, dit is de enige indicatie.
3. Een tegel selecteren → draaiknoppen gaan per **90°** (niet 180).
4. Een tegel over een andere slepen → wisselt om, rood kader = niet toegestaan.
5. Browserconsole moet leeg zijn.
6. Paneel Simulatie → "Draai simulatie" → 4 startposities laten allemaal winst
   zien, "vastgelopen potjes" is 0 of bijna 0.
7. Onderaan de simulatie: tabel "koudste tegels" — geen enkele tegel mag op
   0,0% verkeer staan. Gebeurt dat toch, dan is er een dode lus ontstaan en
   klopt `deadTileCount` in `70-generator.js` niet meer.
8. Tabblad "Spelen" → modus "Automatisch" → "Start spel" → de pion loopt
   zichtbaar, de dobbelstenen rollen, en het potje eindigt met hetzelfde
   winscherm als Zelf spelen (embleem in winnaarskleur + klassement plaats/naam/opdrachten, "Toon kaart"/"Toon
   uitslag"); de knop rechtsboven heet dan "Terug naar lobby" en werkt.
   Tempo moet je tijdens het lopen kunnen wijzigen (schuif
   rechtsboven naast Pauze/Stoppen); "Stoppen"
   moet de pion echt stilzetten (geen achtergrondlus die doorloopt).
9. Elke gangtegel heeft één paars actiekaartvakje op het bord (legenda
   "Actiekaartvakje (4.x)"). Loopt een pion er tijdens "Zelf spelen"
   overheen, dan verschijnt een logregel "trekt een beloningskaart" en loopt
   de pion gewoon door — de beurt stopt er niet voor.
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
    `mpBroadcastState`).
11. Speelscherm op ±1400px breed (laptop/half scherm): alles in beeld, niets
    afgeknipt — het bord krimpt daar mee (zie `--wcell` in `styles.css`),
    onder 1360px staat alles onder elkaar. `--wcell` schaalt óók met de
    schermhoogte: vanaf ±780px zichtbare hoogte (o.a. Full HD met
    browserbalken, 1440×780) moet het hele speelscherm zonder scrollen passen.
    "Toon legenda"/"Toon log" staan onderaan de linkerkolom (gelijk met de
    onderrand van het bord), niet meer onder het bord; het opdrachtenoverzicht
    staat naast het bord altijd compact (naam + kamer op één regel). Minimum is
    13px per vakje; daaronder scrolt het nog. De tabbladen staan in de kop naast
    logo + titel (op een smal scherm op een eigen regel eronder). De
    spelerskaarten boven het bord zijn één regel: naam groot (nooit afgekapt),
    rechts Voltooid / Energie / Kaarten; "aan zet" en de eindplaats als tabje op
    de rand. Verandert de hoogte boven/onder het bord, pas dan de 300px in
    `--wcell` (styles.css) aan.
12. Zelf spelen → energie-paneel toont 4 acties op prijs (Stuwstoot 4,
    Herprioritering 4, Zwaartekracht-laarzen 5, Noodtransport 10).
    Herprioritering laat je huidige én volgende opdracht zien en vraagt welke
    eerst; de laarzen tonen de richtingen als knoppen én omrand op het bord, en
    daarna gooi je gewoon. De kaart Zwaartekracht-laarzen kan alleen vóór het
    dobbelen en blokkeert de laarzen-actie in dezelfde beurt. Simulatie →
    "Welke energie-actie wint?" toont alle vier rond de 25%.
13. Begin van een potje (Zelf spelen met bots): lobby toont alleen namen. Na
    "Start spel" is de rechterkolom één groot paneel tot onderaan het bord;
    jij gooit via de knop, bots vanzelf; bovenaan staat ieders opdracht als
    "opdracht nog geheim". Bij gelijke worp gooien alleen die spelers opnieuw.
    Bij het kiezen staat de opdracht van wie kiest op het bord en gloeien de
    vrije startvakjes (klikbaar, of via de knoppen in het paneel). Daarna komt
    de gewone kolom (dobbelen/energie/kaarten) terug en is de beurtvolgorde
    gelijk aan de kiesvolgorde. In Multiplayer moet een gast op zijn eigen
    scherm kunnen gooien en kiezen.
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

## Nog te doen

- Een **5e energie-actie** (later te bedenken). Ideeën die nog niet gemeten
  konden worden omdat bots ze niet zinnig spelen: een schild tegen de volgende
  hinderkaart, of een energieversperring op een gang naar keuze.

- Elke opdracht (2.1–2.9) heeft nu een naam (`QUEST_NAMES` in `10-rules.js`,
  zichtbaar in het paneel "Opdrachten" en in de simulatie-uitslag) zodat de
  fysieke opdrachtkaarten een titel hebben. De speelregel zelf is nog steeds
  de tijdelijke testregel: een opdracht telt als voltooid zodra je op het
  vakje staat, zonder verdere actie of inhoud.
