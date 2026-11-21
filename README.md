# Axiom-9 Map Generator

Bouwen:

    python build.py

Open daarna `dist/axiom9.html` in je browser. Dat bestand is zelfstandig:
geen internet nodig, je kunt het mailen of op een USB-stick zetten.

Bewerk nooit `dist/axiom9.html` zelf: bewerk `src/` (zie CLAUDE.md). Uitleg, metingen en
ontwerpkeuzes staan in [docs/](docs/README.md). Bij elke push naar master bouwt GitHub het spel
opnieuw en zet het online (`.github/workflows/bouwen.yml`).
