# Axiom-9 Map Generator

Bordspel-tool voor het spel Axiom-9. Het bord bestaat uit **20 tegels van 8×8 vakjes** in een
raster van 4 rijen × 5 kolommen (posities A t/m T, van links naar rechts, rij voor rij).

Dit bestand is bewust kort: het wordt in elke chat helemaal gelezen. De uitgebreide uitleg,
metingen en ontwerpkeuzes staan per onderwerp in [docs/](docs/README.md). **Werk je aan een
onderwerp uit de tabel "Lees eerst", lees dan eerst dat docs-bestand.**

## Werkregels

- **Begin van elke chat: eerst `git pull`.** Er wordt op twee computers gewerkt (pc en laptop).
- **Bewerk NOOIT `dist/axiom9.html`** (gebouwd, ±3 MB). Bewerk `src/` en draai `python build.py`
  (op Windows `python`, niet `python3`).
- **Na elke afgeronde wijziging: committen én pushen** (`git push origin master`), zonder te vragen.
  Een GitHub Action (`.github/workflows/bouwen.yml`) bouwt het spel bij elke push en zet het op de
  tak `gh-pages`.
  **Overgang (2026-11-21):** zolang GitHub Pages nog vanaf `master` publiceert, moet `dist/axiom9.html`
  nog mee gecommit worden. Staat Pages op `gh-pages` (Settings → Pages → Branch: gh-pages, / (root)),
  dan `git rm --cached dist/axiom9.html`, `dist/` in `.gitignore`, en deze overgangsregel weghalen.
- Soms werkt er tegelijk een tweede sessie in dezelfde map: commit alleen je eigen wijzigingen
  (`git diff --stat` per bestand bekijken vóór je commit).
- Verander je een spelregel in de code? Pas dan ook de tekst in `98c-rules.js` aan (tabblad Spelregels),
  de stap in de rondleiding (`98d-tour.js`) en het docs-bestand van dat onderwerp. Nieuwe meting of ontwerpkeuze? Die hoort in `docs/`, niet hier.

## Hoe de code in elkaar zit

`build.py` plakt **alle** `src/js/*.js` op naamvolgorde achter elkaar in één `<script>` en alle
`src/css/*.css` op naamvolgorde in één `<style>`, en bakt plaatjes/geluid/tegels in
(`{{CSS}}`, `{{JS}}`, `{{LOGO}}` enz. in `src/index.html`). Er zijn dus geen imports: alles deelt één
scope. Functiedeclaraties worden gehoist, `const`/`let` niet: iets wat bij het laden al nodig is
moet in een eerder bestand staan. **Nieuw bestand = alleen het goede nummer geven** (bv. `95l-…`
komt na `95k-…` en vóór `96-…`); er is geen lijst om bij te werken. Bij CSS telt de volgorde ook
(latere regels winnen).

```
src/index.html          HTML-skelet + alle knoppen/vakken
src/data/tiles.json     de 20 tegels (vakjes + labels 2.x opdracht, 3.x start, 4.x kristal, 5.x rooster)
src/assets/             logo, favicon, lettertype, plaatjes en geluiden (chants/) voor de taunts
src/js/
  00-data  05-card-art  06-chants  10-rules  20-connectivity  30-random      basis + regels
  40-board  50-interaction  60-palette                                      tabblad Kaart
  70-generator                                                              bordbouwer
  80-controls                                                               knoppen, tabbladen, speelmenu
  85-print                                                                  bord printen op 6 A4'tjes
  90-editor                                                                 tegel-editor + legenda
  95a-sim-basis  95b-energie  95c-portalen  95d-roosters  95e-bot-slim      spelregels + bots,
  95f-kristallen  95g-bot-keuzes  95h-bewegen  95i-beurt-potje              gedeeld door alle modi
  95j-sim-scherm  95k-sim-uitslag                                           tabblad Simulatie
  96-walk  96b-intro  96c-crystals  96d-dice                                speelscherm, Automatisch
  97a-solo-opzet  97b-solo-bord-score  97c-solo-energie  97d-solo-kluis     Zelf spelen
  97e-solo-acties  97f-solo-beurt  97g-solo-einde  97h-solo-opening
  98-cards  98b-avatar  98c-rules  98d-tour  99-multiplayer                 overige tabbladen (98d = rondleiding)
src/css/01-basis … 29-rondleiding.css  één bestand per onderdeel, naam zegt wat erin staat
docs/                   uitleg, metingen en ontwerpkeuzes per onderwerp
ontwerp/                (alleen in OneDrive, niet in git) bronbestanden, originelen, Opdrachtkaarten.pdf
```

Oude namen in commentaar en in docs: `95-simulate.js` = de `95a…95k`-bestanden, `97-solo.js` = de
`97a…97h`-bestanden, `styles.css`/`rules.css` = `src/css/`. Zoek een functie of blok gewoon met Grep.

## Lees eerst

| Werk je aan… | Code | Lees eerst |
|---|---|---|
| tegels, bordbouwer, beweging, wat waar mag liggen | `10-rules`, `20-connectivity`, `70-generator`, `95h-bewegen` | [bord-en-bordbouwer](docs/bord-en-bordbouwer.md) |
| energie-acties, prijzen, energiebalk | `95b-energie`, `97c-solo-energie`, `96d-dice` | [energie](docs/energie.md) |
| kristallen, kluis, oprapen, energievak | `95f-kristallen`, `96c-crystals`, `97d-solo-kluis` | [kristallen-kluis-energievak](docs/kristallen-kluis-energievak.md) |
| portalen | `95c-portalen`, `96-walk` (`walkPaintPortals`), `97e-solo-acties` | [portalen](docs/portalen.md) |
| roosters / schroevendraaier | `95d-roosters`, `97e-solo-acties`, `96-walk` (`walkCrawlFx`) | [nog-te-doen-en-roosters](docs/nog-te-doen-en-roosters.md) |
| wat een bot doet | `95e-bot-slim`, `95g-bot-keuzes`, `95i-beurt-potje` (`botPlanTurn`/`botFinishTurn`) | [kristallen…](docs/kristallen-kluis-energievak.md), [energie](docs/energie.md) |
| begin van een potje (wie begint, startvak kiezen) | `97h-solo-opening`, `96-walk` | [begin-potje](docs/begin-potje.md) |
| multiplayer | `99-multiplayer` | [multiplayer](docs/multiplayer.md) + punt 10 van de [controlelijst](docs/controlelijst.md) |
| simulatie en de uitslag | `95i-beurt-potje`, `95j-sim-scherm`, `95k-sim-uitslag` | punt 6–7 van de [controlelijst](docs/controlelijst.md) |
| knoppen, lobby, legenda, cursor, kaders, speelweergave | `80-controls`, `src/css/` | [waar-zit-wat](docs/waar-zit-wat.md) |
| de rondleiding op het bord | `98d-tour`, `src/css/29-rondleiding.css` | [rondleiding](docs/rondleiding.md) |
| het bord printen (6 A4'tjes) | `85-print`, `src/css/28-printen.css` | [printen](docs/printen.md) |
| iets wat beweegt of animeert | — | [prestatie](docs/prestatie.md) |

De volledige tabel "Waar moet ik zijn?" staat in [docs/waar-zit-wat.md](docs/waar-zit-wat.md).

## Spelregels in het kort

- Bewegen alleen horizontaal/verticaal. 2×D6 = precies zoveel stappen lopen, geen U-turn, andere
  pionnen blokkeren. Wie als eerste 6 opdrachten haalt, wint. Op je opdrachtvakje loop je met de rest
  van je worp door.
- Een tegelzijde is een doorgang als beide deurvakjes gevuld zijn: N=(0,3)(0,4), Z=(7,3)(7,4),
  W=(3,0)(4,0), O=(3,7)(4,7). Op een hoek (A, E, P, T) wijst geen doorgang het bord af.
- Tegel 8 (Hibernatie) = de vier startvakjes 3.1–3.4, ligt binnenin (G/H/I/L/M/N) en heeft als enige
  kamer geen opdrachtvakje.
- Elke gangtegel heeft 1 kristalvakje (4.x, hooguit 1 kristal per beurt, zet stopt niet) en 1
  roostervakje (5.x). Kluis max. 3 kristallen.
- Energiesteen 0-1-1-2-2-3, max. 10. Eén energie-actie per beurt, **vóór** je gooit; wat de steen
  geeft, geef je pas volgende beurt uit (mens én bot, alle modi).
- Eén portaalpaar (blauw ↔ rood); na een portaal of rooster loop je door met de rest van je worp.
- Op het scherm heet het **"kristal"**, nooit "actiekaart" (in de code nog `ACTION_CARDS`, `p.cards`:
  bewust niet hernoemd).

## Beslissingen van de maker: niet terugdraaien of opnieuw voorstellen

- **Opdrachten zijn af**: op je opdrachtvakje = opdracht gehaald. Geen extra actie, inhoud of doel.
- **Herworp** (energie-actie) is weggehaald, niet terugzetten.
- **Weggehaalde kristallen**: Snelroute, Herkalibratie, Kristalruil, Vooruitblik, Prioriteitspas,
  Noodbarrière, Terugtrekbevel, Signaalstoring.
- Kamernamen staan vast (alleen in `ROOM_NAMES`, niet in de tool te wijzigen).
- Afgewezen energie-ideeën (rijkere steen, plafond 15, …) staan bovenin `95b-energie.js`: niet opnieuw
  voorstellen zonder nieuwe meting.
- Gekozen ontwerpen (knoppen, cursor, kluis, dobbelstenen, lobby, …) staan per onderdeel in `docs/`.
  Niet zomaar veranderen; verandert er iets, dan opnieuw meten op 1920×945 en 1440×780.

## Prestatie (speelscherm)

Alleen `transform`/`opacity` animeren (nooit `top`, `box-shadow`, `filter`); geen `:has()`; geen
`getBoundingClientRect`/`getComputedStyle`/`offsetWidth` midden in een beurt; niets opnieuw in de DOM
zetten als het niet veranderd is. Details en metingen: [docs/prestatie.md](docs/prestatie.md).

## Controleren of het nog werkt

Na `python build.py` `dist/axiom9.html` openen en minimaal kijken naar:
1. Browserconsole leeg.
2. "Genereer nieuwe map" geeft een nieuwe kaart. Onbereikbare vakjes krijgen een magenta rand.
3. Simulatie: alle 4 startposities winnen een eerlijk deel, 0 vastgelopen potjes, geen tegel < 0,5%.
4. Spelen → Automatisch en Zelf spelen: een potje loopt tot het winscherm.
5. Raakt de wijziging multiplayer: host + gast testen.
6. Niets op het scherm verschuift of loopt over (1920×945 en 1440×780).

De volledige lijst (15 punten) staat in [docs/controlelijst.md](docs/controlelijst.md).
