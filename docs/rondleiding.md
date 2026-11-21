# Rondleiding op het bord

Knop **Rondleiding** bovenaan de inhoudsopgave van het tabblad Spelregels (`#btnTour`). Code:
`src/js/98d-tour.js`, opmaak: `src/css/29-rondleiding.css`. Gebouwd 2026-11-21 (gebruikerswens: de
spelregels zijn vrij theoretisch; laat het op een echt bord zien, per onderdeel in de schijnwerper
met een kort tekstvak, animatie in een lus tot je naar de volgende stap gaat).

## Opzet

- Eén scherm over alles heen (`#tourOverlay`): links het bord van het tabblad Kaart (dezelfde
  `.cell`-klassen als op Spelen, dus het ziet er precies zo uit), rechts een tekstvak met stap x/11,
  titel, 2 korte alinea's, een extra vakje (stenen, energiemeter, lijst …), stippen om te springen en
  Vorige/Volgende. Escape/✕ = dicht, pijltjes = vorige/volgende. Laatste knop "Start een potje" gaat
  naar het tabblad Spelen.
- Schijnwerper: `#tourBoard.is-spot` + `.tour-hi` op de vakjes die meedoen, de rest dimt (opacity).
- Pion = één los element (`.tour-pawn`) dat via `--c`/`--r` over het raster schuift.
- Elke stap is `{ title, text, play(t) }` in `TOUR_STEPS`. `play` is een async lus; `tourSleep` geeft
  false zodra je van stap wisselt, dan stopt de lus. `tourClearStep` ruimt alles van de stap op.
  Een stap start alleen als hij nog aan de beurt is (anders liep bij snel doorklikken een oude stap
  door, gezien bij het testen).
- Routes worden op het bord zelf uitgerekend (`tourBfs`, `tourRouteThrough`: over een vakje heen
  zonder U-turn), dus het werkt op elke kaart.

## De 11 stappen

1. Welkom aan boord: kamers en gangen om de beurt in de schijnwerper.
2. Wie begint?: de 4 startvakjes, pionnen verschijnen.
3. Je opdrachten: de 9 opdrachtvakjes, ring loopt langs met naam + kamer.
4. Dobbelen en lopen: 3 + 4, pion loopt 7 stappen vanaf S1.
5. Een opdracht halen: pion loopt over het opdrachtvakje heen (vinkje) en loopt door.
6. Energie: energiesteen + meter tot `ENERGY_MAX`.
7. Energie uitgeven: lijst van `ENERGY_ACTIONS` op prijs, de laarzen schieten rechtdoor.
8. Kristallen: pion loopt over een kristalvakje, kristal vliegt op.
9. Portalen: blauw en rood op twee verre gangvakjes, pion springt over en loopt door.
10. Roosters: met de schroevendraaier van rooster naar rooster.
11. Winnen: 6 zeshoekjes vullen zich.

Getallen (stenen, max. energie, kluis, opdrachten om te winnen, prijzen) komen uit de spelgegevens.
Verandert een spelregel? Pas de tekst van die stap aan.

## Gecontroleerd (2026-11-21, 1920 breed)

Alle 11 stappen lopen zonder fouten in de console; bord 1070 × 856 px naast een tekstvak van 380 px;
snel 6× op Volgende klikken laat geen resten van eerdere stappen achter.
