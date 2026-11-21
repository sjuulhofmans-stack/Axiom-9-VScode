# Controleren of het nog werkt (volledige lijst)

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

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
4. Een tegel over een andere slepen → hij komt los en volgt de muis, de andere tegel schuift alvast opzij;
   loslaten = wisselen. Rood kader = niet toegestaan (dan blijft de andere liggen en gaat de tegel terug).
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
7. Onderaan de simulatie: kaart "Koudste tegels" (tabel achter Details) — geen enkele tegel mag onder
   0,5% verkeer staan (de hoekgangen zitten rond 2–3%). Gebeurt dat toch, dan klopt de
   voorspelling in `genEvaluate` (`70-generator.js`) niet meer.
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
    Lobby: balk Spel hosten | Deelnemen met drie kaarten eronder, net als Spelen (zie "Drie
    kaarten" in de tabel bovenaan). Check: "Kamer aanmaken" geeft een kamercode + een
    spelerskaartje in dezelfde 2-koloms stijl als de Zelf-spelen-opzet, chat
    staat eronder (niet meer ernaast). Laat een tweede speler meedoen, start
    een potje (de chat staat dan als eigen 4e kolom rechts, de zijkolom met
    dobbelen/energie/kaarten blijft volledig zichtbaar; "Verlaat potje" staat
    rechtsboven in de kop), en klik daarna op "Verlaat potje". **Host**: terug naar déze
    multiplayer-lobby (kamercode/spelers nog intact), niet naar de modus Automatisch. **Gast**
    (gekozen 2026-11, "wat het beste is zonder glitches"): gaat helemaal uit de kamer, met code en
    naam nog ingevuld; de host maakt van zijn plek een bot en haalt hem uit de kamer
    (`mpOnPeerLeave`). Tijdens een potje laat de host niemand nieuw toe (reden 'bezig'); na het
    potje kan de gast met Deelnemen terug (zelfde naam mag weer). Speel ook een potje uit: host én
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
    over de volle hoogte. Onder 900 breed (telefoon) één kolom: brug (kleinere stoelen/tafel),
    knoppen, chat, avatar-maker (sinds 2026-11). Komt er iemand binnen: **BAM** (`mpBridgeJoin`) — dikke ring in zijn
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
    De kop is dan HELEMAAL weg (2026-11, gebruikerswens: "de volledige ruimte benutten"). Aan de
    linkerrand staat een lipje (`#playEdge`, 18×120px, blauwe rand + gloed die rustig "ademt" in
    opacity): muis tegen de rand (80 ms) = het menu schuift uit over het spel heen (0,65 s, zachte
    uitloop; donkere laag faadt mee in 0,6 s), muis het menu uit = na 300 ms dicht; klikken/tikken
    op het lipje werkt ook (touchscreen). In het menu de tabbladen en daaronder "Dit potje" met de
    spelknoppen (Tempo/Pauze/Stoppen, Nieuw potje, Verlaat potje; `#playMenuActions`), in dezelfde
    stijl als de tabbladen. Een ANDER tabblad kiezen tijdens een potje = eerst de vraag "Wil je het
    huidige potje stoppen?" (`#walkLeaveConfirm`, `tabAskSwitch` in 80-controls.js; niet als het
    potje al af is). Ja = rustige fade over het hele scherm (`playStartFade`, net als bij het
    starten), daarachter stopt het potje en wisselt het tabblad. Stoppen/Nieuw potje/Terug naar
    lobby gebruiken dezelfde fade (`walkFadeToLobby(behind)` in 96-walk.js).
    `playMenuSetOpen` in 80-controls.js; dicht ook met ✕, Escape, klik ernaast, een tabblad of een
    spelknop. Op het winscherm staat "Terug naar lobby" naast Statistieken (`soloEndgameToLobby`),
    want na afloop zit die knop anders alleen in het menu. Pagina op volle breedte, bord tot 34px
    per vakje ("altijd zo groot mogelijk"); hoogte boven/onder het bord = `--play-chrome` (184px,
    was 224 met de smalle balk; gemeten 1920×889: vakjes 20,8 → 22px, onderaan 4px over, niets scrolt). Kolomminima:
    links 280px, zijkolom 370px (smaller breken opdrachtnaam/energietegels af); Multiplayer
    270 / 370 / chat 230px. Tussen 1361 en 1520 breed staat de chat in Multiplayer als eigen regel
    ONDER het speelscherm (anders viel het bord rechts ±42px af op 1440×780; sinds 2026-11). Gemeten: Full HD ±21px, 1440×780 ±15px, Multiplayer op Full HD even
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
12. Zelf spelen → tabblad Energie toont de acties op prijs (Stuwstoot 4,
    Herprioritering 4, Zwaartekracht-laarzen 5, Portaalkanon 5, Schroevendraaier 5, Noodtransport 10)
    naast een staande energiemeter, met onderaan het uitlegvak (muis op een actie = zijn uitleg, en
    de knooppunten die hij kost knipperen bovenaan de meter). De lijst vult de kolom (rijen max.
    62px); gemeten 1920×889 rijen 62px, 1440×780 rijen 37px, niets scrolt. Boven de meter staat het
    getal NAAST "/ 10" op één regel (gebruikerswens 2026-11; stond onder elkaar): meterkolom 76px
    (laptop 66px), cijfer 26px (laptop 22px), GEEN vaste breedte (die schoof "1 / 10" 6px uit het
    midden). Gemeten 1920×945 en 1440×780: "10 / 10" 54 resp. 48px breed, één regel, midden van de
    tekst exact boven de lijn van de meter bij 1, 7 en 10, alle actienamen nog volledig leesbaar.
    Na de worp en tijdens beurten van bots blijven de energie-acties staan, uitgegrijsd met de reden
    ("kies je vóór het dobbelen" / "niet jouw beurt") + uitlegvak (gebruikerswens 2026-11; was: vak
    leeg). Eén plek: `soloEnergyRestFill` + MutationObserver in 97-solo.js, herkenbaar aan [data-rest],
    gaat in Multiplayer niet mee naar de gast. Een echte keuze (kruip-aanbod, laarzen, portaal …) komt
    ervoor in de plaats. Schroevendraaier → op een rooster staan →
    knop "Kruip door de luchtschacht" → vrije roosters lichten op (rest gedimd, je doel niet) → klik →
    rooster schroeft los, koperen lichtje, je loopt met dezelfde stappen door; icoon op je spelerskaartje
    tot je kruipt. Op het bord liggen een
    blauwe en een rode portaalring; Portaalkanon → richting (knop of klik) → kleur ("ligt er sinds
    de start" / "gelegd door X") → lichtspoor + nieuw portaal, daarna gooi je. Loop je in een
    portaal: pion draait als een kolk weg, lichtje in de portaalkleur naar het andere portaal (zelfde
    tempo als kruipen), schokgolven, pion draait eruit en loopt met je resterende stappen door
    (`walkPortalPawn` = `walkCrawlFx` met kind 'portal', 96-walk.js; sinds 2026-11, daarvoor floepte
    je in één keer over). Simulatie → blok "Portalen" met
    schoten/gestolen/sprongen en twee oordelen (opdrachten via portaal ≤30%, meeste
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
    Energie, Energie-acties, Kristallen) elk als eigen tabel met vakjes,
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
    het hoofdstuk in beeld licht op), rechts bij 10 van de 13 hoofdstukken een animatie die in een lus
    loopt, alleen als hij in beeld is. Animaties = Web Animations op transform/opacity met een vaste
    duur per scène (`rTrack`/`rShow`/`rWalk`); niets opvragen uit de opmaak. De scènes gebruiken de
    ECHTE spelonderdelen (gebruikersmelding 2026-11: "animaties kloppen niet met het spel"): stenen via
    `diceDieHtml`/`diceEnergyDieHtml`, portaal = `.walk-portal`, pionkleuren `WALK_PLAYER_COLORS`,
    vakjes los met 1px ertussen in `--walk`/`--quest`, kristal = langgerekte zeshoek. Verandert zo'n
    onderdeel in het spel, kijk dan of de scène meeloopt. Een pion loopt alleen over vloervakjes; in
    de scène Doorgangen liggen de twee tegels tegen elkaar aan (geen lege kolom ertussen). Check: console leeg, alle
    scènes bewegen, en de kop met 6 tabbladen overlapt de titel niet (gemeten op 1920, 1730, 1600,
    1505, 1440, 1366 en 1320 breed).
