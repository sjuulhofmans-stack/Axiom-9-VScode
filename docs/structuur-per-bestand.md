# Structuur per bestand (met de gekozen ontwerpen)

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

## Structuur

```
src/
  index.html          HTML-skelet met placeholders {{CSS}} {{JS}} {{LOGO}}
  styles.css          alle opmaak (~77 KB)
  rules.css           opmaak van het tabblad Spelregels (+ de iets compactere tabbladen in de kop);
                      build.py plakt hem achter styles.css
  assets/logo.b64     logo als base64 — hier zelden iets aan doen
  assets/favicon.svg  tabbladicoon (kruistegel met opdrachtvakje); build.py bakt hem in als data-URI ({{FAVICON}})
  assets/orbitron900.b64  lettertype Orbitron 900 voor de startanimatie (ingebakken, werkt offline)
  assets/bigdaddy.b64, partycar-*.b64, kaboem.b64, chants/  plaatjes en geluiden voor de taunts (06-chants.js)
  data/tiles.json     de 20 tegels + de vorm van een tegel (pattern)
  js/
    00-data.js        laadt tiles.json, bouwt tileLookup, globale state (layout, selectedSlot)
    05-card-art.js    kleur + icoon per opdrachtkaart
    06-chants.js      de taunts (playChant): typ een cijfer in de chat; plaatjes/geluiden uit assets/ (de oude Canva-plaatjes van de actiekaarten zijn weg)
    10-rules.js       plaatsingsregels, rotatie, kamer-/opdrachtnamen, welke tegel mag waar
    20-connectivity.js naden tussen tegels + bereikbaarheid op vakjesniveau
    30-random.js      seeded random (mulberry32) — zelfde seed = zelfde bord
    40-board.js       het bord tekenen, contour, naadmarkeringen, statusregel
    50-interaction.js slepen om tegels te verwisselen, selecteren. Opzet = "Plaats maken" (gekozen variant 2
                      uit 4, artifact "Axiom-9 Tegels verschuiven", 2026-11): selectie = één kader om de HELE
                      tegel (`mapRing` in 40-board.js, zelfde `.walk-room-ring` als de opdrachtkamer in een potje);
                      oppakken = zwevende kopie (`.tile-float`) die de muis volgt en meekantelt, de tegel waar je
                      boven hangt schuift alvast naar de vrije plek, loslaten = veertje. Tijdens het slepen wordt
                      het bord NIET opnieuw getekend (renderBoard was de hapering); pas één keer bij het loslaten
    60-palette.js     het register onderaan (twee rijen: Kamers / Gangen). Kaartje = "Tekentafel" (gekozen
                      variant 2 uit 4, artifact "Axiom-9 Kamerkaartjes", 2026-10): grote VASTE naam (geen
                      naamveld meer: de namen staan vast, gebruikerswens), tegel op ruitjespapier, bij muis-erop
                      "Bewerken" over de tegel (zonder muis: potloodje in de hoek). Geen nummer/positieletter
    70-generator.js   bordbouwer: zoekt een geldig bord (elke tegel mag draaien), schuift en draait daarna
                      tegels en kiest op één weegscore met een voorspelling van het verkeer
    80-controls.js    knoppen: seed, dobbelsteen, vorige indeling, draaien, legenda; bij het openen
                      meteen een willekeurige kaart (met "Aan het genereren"-vakje i.p.v. het bord)
    90-editor.js      tegel-editor (vakjes aan/uit klikken). Opzet = "Werkbank" (gekozen variant 1 uit 6,
                      artifact "Axiom-9 Tegeleditor", 2026-10): grote naam, tegel met 4 lipjes die oplichten
                      als die doorgang open is, voorproefje bij muis-erop, rechts gereedschap + controle,
                      onderaan Herstel | melding | Opslaan. ALLES VASTE MAAT (gebruikerswens): het
                      nummer-veld blijft staan (.is-off = onzichtbaar), melding heeft vaste hoogte (#editorMsg,
                      ook de fout bij opslaan staat daar). Gemeten: niets verschuift bij gereedschap
                      wisselen, klikken, foutmelding of Herstel
    95-simulate.js    batch-spelsimulatie (2xD6, geen U-turn, bezette vakjes blokkeren)
    96-walk.js        tabblad "Spelen": modus Automatisch, automatische simulatie van 1-4 spelers
    96b-intro.js      startanimatie na "Start spel", variant "Titan" (2026-10): traag aftellen met zware dreun,
                      schudden + opbouw, BAM, hyperjump, het zwarte gat in met een gong (gekozen uit 15
                      geluiden; ±10,6 s) + vinkje in de lobby. Overgang naar het spel: een zwart gordijn
                      over het HELE scherm (`.start-intro-curtain`) gaat mee dicht met de duik, daaronder
                      wisselen kop/achtergrond/bord, pas na 2 getekende beeldjes faadt het in 0,8 s weg.
                      Startanimatie UIT: `playStartFade` (zelfde file): hele scherm 0,65 s naar donker,
                      daarachter naar het speelscherm, na 2 beeldjes 0,9 s infaden (was: "floept pats boem";
                      Multiplayer: host stuurt 'intro' met { fade: true }, gast faadt in zodra het potje er is)
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
    98c-rules.js      tabblad Spelregels: 13 hoofdstukken (bord opbouwen t/m einde) + kleine animaties
    99-multiplayer.js tabblad "Multiplayer": lobby + peer-to-peer spelen met vrienden (WebRTC)
build.py              plakt alles tot dist/axiom9.html
dist/axiom9.html      GEBOUWD — niet handmatig bewerken
```

De JS-bestanden worden in bovenstaande volgorde achter elkaar geplakt in één
`<script>`. Er zijn dus geen imports/exports; alles deelt één scope. Nieuwe
functies moeten gedefinieerd staan vóór de plek waar ze bij het laden worden
aangeroepen (functiedeclaraties worden gehoist, `const`/`let` niet).
