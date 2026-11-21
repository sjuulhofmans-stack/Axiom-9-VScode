# Printen: het bord op 6 A4'tjes

Knop **Printen** naast de seed op het tabblad Kaart (`btnPrintBoard`). Code: `src/js/85-print.js`,
opmaak: `src/css/28-printen.css`. Gebouwd 2026-11-21 (gebruikerswens: "op 6 A4'tjes, strak tegen
elkaar, niet knippen, met een plakbandje aan elkaar, speelbaar, zo min mogelijk inkt").

## Opzet

- 3 bladen naast elkaar × 2 onder elkaar, **A4 staand**. Het bord is 40 × 32 vakjes; per blad
  13 | 14 | 13 vakjes breed (`PRINT_COLS`) en 16 hoog (`PRINT_ROWS`). Zo valt elke naad precies op
  een lijn tussen twee vakjes.
- Vakje = (210 − 2 × 8) / 14 = **13,86 mm**. Bord = 554 × 443 mm. Pionnen dus hooguit ±12 mm.
- **Printerrand:** een printer kan niet tot de papierrand printen. Aan de kanten die tegen een
  ander blad komen loopt het bord tot `PRINT_M` (8 mm) van de rand. Die lege rand vouw je naar
  achteren: rechts bij de linker en middelste kolom, onder bij de bovenste rij. De vouw ligt dan
  precies op de rand van het bord; je legt hem op de eerste lijn van het buurblad, waarvan de lege
  rand er gewoon onder schuift. Knippen langs de stippellijn mag ook.
- Inkt: gangen wit, kamers heel lichtgrijs (`#efefef`), dunne grijze vakjeslijnen, dikke zwarte
  lijn waar vloer ophoudt (muur). Kleur alleen op de speciale vakjes, en die zijn ook in zwart-wit
  te herkennen: opdracht = nummer 1–9, start = S1–S4, kristal = zeshoek, rooster = spijltjes.
- Vrije ruimte (±59 mm): boven de bovenste rij titel + seed (blad 1), uitleg hoe je het legt
  (blad 2) en de lijst met opdrachten (blad 3); onder de onderste rij de legenda (blad 5). Elk blad
  heeft "Blad x van 6 · boven/onder links/midden/rechts".
- Techniek: één SVG van het hele bord in millimeters (`printBoardSvg`, in `<defs>`), elk blad toont
  er zijn stuk van met `<use>`. `@page { size: A4 portrait; margin: 0 }`; tijdens het printen
  (`body.is-printing`) is alleen `#printRoot` zichtbaar; na `afterprint` gaat alles weer weg.

## Controleren

Het printvenster blokkeert de browserbesturing. Controleer daarom met een PDF uit headless Chrome:
kopieer `dist/axiom9.html`, zet vlak voor `</body>` een script dat na ±15 s `printSheetsHtml()` in een
`#printRoot` zet en `is-printing` op body zet, en draai
`chrome --headless=new --no-pdf-header-footer --virtual-time-budget=30000 --user-data-dir=<tijdelijk> --print-to-pdf=bord.pdf test.html`.
Gemeten 2026-11-21: 6 pagina's, naden op de vakjeslijnen, niets overlapt, kleuren komen mee.

## Niet geprint (bewust)

- Portalen: die worden bij de start van een potje willekeurig gelegd; op tafel = losse fiches.
- Kaarten, kristallen, energiemeter: andere onderdelen van het spel (tabblad Speelkaarten).
