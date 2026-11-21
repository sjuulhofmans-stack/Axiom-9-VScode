# Kristallen, kluis, energievak en oprapen

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

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
  Terugtrekbevel (= dubbel met Duwstoot), Signaalstoring.
  Kristalvakje bij Noodtransport (spelregel van de maker, 2026-11): alleen het vakje waar je LANDT
  telt, niet wat je overvliegt — voor mens en bot (`crystalPathOf` in 95-simulate.js).
  Bot-keuzes voor de nieuwe zitten in
  gedeelde functies in 95-simulate.js (`pickEnergyLeakTarget`, `botWantsTwinEnergy`,
  `botPickDieValue`; Portaalsleutel via `botPreRollMove` als kind 'portalCard').
  Meting: de simulatie toont per kristal "Wint wie hem speelt" (25% = gemiddeld, >31% te sterk,
  <19% zwak). Eerste meting (2000 potjes): alle 15 tussen 22,7 en 27,7%.
  Gelijkgetrokken mens/bot (2026-11): een bot krijgt de buit van Energielek pas na zijn zet
  (`energyLeakTake` → pendingEnergy), een Condensator blijft bij een energieworp van 0 staan (ook bij
  bots), Kortsluiting blokkeert ook de Dubbele steen van een bot, en bij Dubbele steen rekent de bot
  met de verwachte worp (`BOT_TWIN_EXPECTED_ROLL`). Gemeten daarna (4000 potjes): kristallen
  21,3–27,9%, energie-acties 23,5–26,3%.
  Kortsluiting op een mens deed tot 2026-10 niets (alleen bots misten hun steen); nu ook voor de
  mens, in `soloRollEnergyForTurn`. In de code heten ze nog `ACTION_CARDS`, `p.cards`,
  `actionCells` enz. — bewust niet hernoemd. Nieuwe zichtbare tekst dus altijd "kristal".
  **Ontwerp** (`96c-crystals.js`, sinds 2026-11 variant 3+ uit artifact "Axiom-9 Energie en kluis"):
  een langgerekte zeshoek, rand in de kleur van de soort (`ACTION_CARD_TINTS`), en daarop ALLEEN het
  icoon en de naam (`crystalArtSvg`: één SVG, een lange naam wordt smaller gezet i.p.v. midden in een
  woord af te breken; na een streepje/spatie 2 regels). Klein (`size:'sm'`) alleen het icoon, groter
  en lichter. Soort, moment en uitleg staan NIET meer op het kristal maar in het uitlegvak van de
  kluis (`crystalInfoHtml`): links Soort (`CRYSTAL_CATS`) + Wanneer (`CRYSTAL_WHEN_LONG`), rechts
  `ACTION_CARD_INFO` (95-simulate.js; langer dan `text`, die blijft voor de spelregels/logregels).
  Vitrine Speelkaarten: bijschrift naam + moment; vergroot ook de uitleg.
  Getekend uit de gegevens, geen plaatjes meer. **`when` is de enige bron** voor wanneer een
  kristal mag: zowel het moment in het uitlegvak (`CRYSTAL_WHEN_LONG`) als de regel in
  `soloCardBlockReason` lezen het ('pre' vóór de worp, 'any' vóór of na, 'start' na de worp
  maar vóór je eerste stap, 'post' tijdens je zet, 'auto' vanzelf aangeboden).
  **Kluis = tabblad** (variant C "Tabbladen in de kolom", gekozen uit 6, artifact "Axiom-9
  Kluisvarianten", 2026-11; vervangt "de kluis staat altijd groot onderaan"). Onder het dobbelvak
  `#walkSideTabs` met Energie | Kluis (aantal x/3); elk tabblad krijgt de hele rest van de kolom
  (`.has-vault.tab-energy` / `.tab-vault` op #walkSideStack, gezet in `crystalSyncStack`, blok
  `ZIJKOLOM: TABBLADEN` onderaan styles.css). De "of"-regels zijn dan weg. Het tabblad Kluis pulst
  (`.can`, crystalPulse) als je nu een kristal kunt spelen. **Vanzelf wisselen alleen op het moment
  dat een vervolgkeuze verschijnt** (daarna mag je zelf weer wisselen): een keuze na een kristal
  (`#walkCardActions`, doelwit/Zelf kiezen/Blinde Vlek, staat als laag ín de kluis) → Kluis; een
  keuze in het energievak (alles in #walkSoloActions zonder `.is-actions`: richting, kleur, sprong,
  Herprioritering; ook na de Portaalsleutel) → Energie. Opgeraapt terwijl Energie open staat: het
  kristal vliegt naar het tabblad Kluis (`crystalSlotEl`), gloed/schudden op het tabblad
  (`crystalVaultShownEl`). Nieuw potje = tabblad Energie.
  **De kluis = "Eén kaart" met zijrail** (gekozen 2026-11, variant 3+; blok `KLUIS "EEN KAART" MET
  ZIJRAIL` in styles.css, `crystalRenderVault`). Links een rail: 3 vakjes van gelijke hoogte met elk
  een klein kristal, VAST KADER rondom het gekozen (geen pulserende gloed of lijntje meer); kan het nu
  niet, dan alleen het kristal gedimd, niet het kader. Onderaan de rail het SCHROEVENDRAAIER-VAKJE met
  de tekst "Schroeven-draaier" erboven (`#crystalTool`; koper + gloed als je hem hebt
  (`p.screwdriver`, via opts `tool`), anders gestippeld grijs). Het vakje is klikbaar
  (`crystalSel = 'tool'`): dan staat de schroevendraaier groot op de plek van het kristal en in het
  uitlegvak alleen zijn uitleg; Gebruik/Afleggen staan uit. Rechts: groot kristal (houdt zijn kleur,
  ook als het nu niet kan), dat een stukje in het uitlegvak steekt (rand + zweem in de kleur van de
  soort, `.crystal-card.crystal--<soort>`), daaronder de reden (2 regels vast) en Gebruik/Afleggen
  even breed als het vak. Geen kopregel "Kluis x/3" (staat op het tabblad). Icoon van de
  schroevendraaier overal (`crystalDriverSvg`: gekozen icoon 1 "schuin, twee kleuren"; 'mono' in de
  energie-actie en de kruip-knop, 'color' op het spelerskaartje). **Gemeten** met alle 16 kristallen
  (in drietallen), de schroevendraaier gekozen, met/zonder schroevendraaier en 0–3 kristallen:
  1920×889 en 1440×780 telkens exact dezelfde plek voor rail, kristal, uitlegvak, reden en knoppen;
  uitleg past (vak 140px Full HD, 150px laptop; langste = Schroevendraaier ±240 tekens); pagina
  scrolt niet. Langere uitleg in `ACTION_CARD_INFO`? Opnieuw meten.
  De energie-acties staan ONDER ELKAAR (de 2x2-tegels stonden scheef; alleen de
  laarzen-richtingen zijn nog 2x2). Dobbelvak 134px vast; het open tabblad vult de rest, dus de
  kolom houdt zijn vaste hoogte (even hoog als het bord) en niets verschuift bij dobbelen of
  wisselen. Met de tabbladen staat de uitlegregel bij elke actie ook op een laptop weer in beeld.
  Gemeten (vijf acties, 2026-11): 1920×889 kolom 736 = bord, tabblad 544px, inhoud 542;
  1440×780 kolom 559 = bord, tabblad 367px, acties mét uitleg tot 124px boven de onderrand (ruimte
  voor de 6e actie), pagina scrolt niet. Iets toevoegen in de zijkolom? Opnieuw meten.
  **Energiebalk = stroomcircuit** (gekozen uit 10 ontwerpen): 10 knooppunten (`.ec-node`) aan
  één leiding (`.ec-seg`), opgebouwd in `soloRenderEnergyOverview`. Opladen: stroom over het
  leidingstukje, knooppunt ploft aan met een ring; leeglopen: van achteren af, flakkeren +
  amber ring; puls: lichtpakketje (`.ec-track`) elke 2,4 s over de volle leiding. Eén
  knooppunt per `ENERGY_STEP_MS`. Het getal staat rechts met een vaste breedte (verspringt niet
  bij 10). De energiebolletjes landen op de knooppunten (`walkEnergyNodes`). Acties = icoonrijen
  (`ENERGY_ACTION_ICONS`, `renderEnergySoloButton` in 97-solo.js).
  **Energievak = staande meter + uitlegvak** (gekozen 2026-11: variant 3 met het uitlegvak van
  variant 6, artifact "Axiom-9 Energie en kluis"; blok `ENERGIEVAK: STAANDE METER + UITLEGVAK`
  onderaan styles.css). Met de tabbladen (.has-vault) staat het circuit RECHTOP links in het
  energievak (knooppunt 1 onderaan, getal erboven, bliksempje eronder; zelfde elementen en
  animaties, alleen scaleY / `ecPacketUp`). Rechts de acties als korte rijen (icoon, naam, prijs;
  de uitlegregel per rij is weg) met daaronder een uitlegvak met VASTE hoogte: de actie waar je
  muis/focus op staat, anders de eerste die je kunt kiezen (`soloEnergyNoteHtml`/`soloEnergyNoteShow`,
  tekst uit `RULES_ENERGY_TEXT` in 98c-rules.js). Kop van het vak: "5 energie · houdt 2 over", of in
  rood waarom het niet kan. Kun je niets betalen: "Te weinig energie" in het vak. Gemeten (7
  energie): 1920×889 rijen 62px, vak 112px; 1440×780 rijen 37px, vak 102px (de langste uitleg,
  laarzen en schroevendraaier, heeft 100px nodig); kolom = bord, niets scrolt of wordt afgeknipt.
  Langere tekst in `RULES_ENERGY_TEXT`? Opnieuw meten (`--note-h`).
  **Oprapen** (`crystalEvent`, op elke plek waar iemand een kristal krijgt of een volle kluis
  heeft): eigen kristal groeit uit het vakje en vliegt in een boog naar je kluis ("Nieuw" tot je
  erop klikt); kluis vol = zilver vraagteken-kristal dat uit elkaar knalt (bewust niet het
  kristal dat je had gekregen: dat blijft op de stapel en zou de volgende trekking verklappen);
  een ander = anoniem zilver kristalletje naar diens spelerskaartje, nooit kleur of naam.
  Nagespeelde bot-beurten spelen het af als de pion er langskomt (`replay.crystals`).
