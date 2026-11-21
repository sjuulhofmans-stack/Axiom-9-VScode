# Begin van een potje

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

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
