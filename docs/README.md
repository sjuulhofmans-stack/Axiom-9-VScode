# Axiom-9: documentatie

Hier staat alles wat te lang is voor [CLAUDE.md](../CLAUDE.md): de gekozen ontwerpen, de metingen,
en de redenen achter elke keuze. Op 2026-11-21 letterlijk uit de oude CLAUDE.md overgenomen;
daar is niets uit weggelaten.

| Bestand | Waarover |
|---|---|
| [structuur-per-bestand.md](structuur-per-bestand.md) | wat elk bronbestand doet en welk ontwerp er gekozen is |
| [waar-zit-wat.md](waar-zit-wat.md) | volledige tabel "Ik wil … → bestand" |
| [bord-en-bordbouwer.md](bord-en-bordbouwer.md) | tegels, doorgangen, bordbouwer (+ metingen), beweging |
| [kristallen-kluis-energievak.md](kristallen-kluis-energievak.md) | kristallen, kluis, energiebalk/-vak, oprapen |
| [multiplayer.md](multiplayer.md) | wat de host meestuurt, geheimen, kliks van gasten |
| [energie.md](energie.md) | kristalvakje in de gang, energie-acties en hun balans |
| [portalen.md](portalen.md) | Portaalkanon, regels, uiterlijk, metingen |
| [begin-potje.md](begin-potje.md) | wie begint, startvak kiezen |
| [controlelijst.md](controlelijst.md) | alles wat je na een wijziging kunt nakijken (15 punten) |
| [prestatie.md](prestatie.md) | wat het speelscherm laat haperen en wat niet |
| [nog-te-doen-en-roosters.md](nog-te-doen-en-roosters.md) | roosters/schroevendraaier, open punten |
| [printen.md](printen.md) | het bord op 6 A4'tjes printen (knop bij de seed) |
| [analyse.md](analyse.md) | de grote code-analyse (genummerde punten, bv. "nr. 35") |

## Oude bestandsnamen

In deze teksten en in commentaar in de code staan nog de namen van vóór 2026-11-21:

| Oud | Nu |
|---|---|
| `src/js/95-simulate.js` | `src/js/95a-sim-basis.js` … `95k-sim-uitslag.js` |
| `src/js/97-solo.js` | `src/js/97a-solo-opzet.js` … `97h-solo-opening.js` |
| `src/styles.css` | `src/css/01-basis.css` … `26-zijkolom-kluis-energievak.css` |
| `src/rules.css` | `src/css/27-spelregels.css` |
| `analyse.md` (hoofdmap) | `docs/analyse.md` |
| `Opdrachtkaarten.pdf` (hoofdmap) | `ontwerp/Opdrachtkaarten.pdf` (alleen OneDrive) |

"Blok X onderaan styles.css" vind je het snelst door op de naam van het blok te zoeken (Grep in `src/css`).

## Nieuwe docs schrijven

Een nieuwe ontwerpkeuze of meting komt in het docs-bestand van dat onderwerp (of een nieuw bestand +
een regel in deze tabel). In CLAUDE.md alleen iets wat in **elke** chat nodig is.
