# Nog te doen + roosters/schroevendraaier

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

## Nog te doen

- **Roosters + schroevendraaier (6e energie-actie) — GEBOUWD 2026-11** (artifact "Axiom-9
  Roosters", meting 2026-11: 35 varianten × 8.000 potjes, meetscript los van het project). Code: blok
  ROOSTERS in `95-simulate.js` (`resolveMoveCrawl` = de zet met schroevendraaier als extra toestand,
  `grateGain`/`botDriverWanted`, kopen in `botPlanTurn` stap 2b, `r.crawled`), labels 5.1–5.10 in
  tiles.json (`GRATE_LABELS`, `cellType` 'grate'), editor-gereedschap Roostervakje + controle in
  `tileValidationIssues`, legendaregel (9 regels van 30px, gemeten 1920/1440/1366: niets afgekapt).
  Mens: blok ROOSTERS in `97-solo.js` (`soloCrawlOfferHtml` in het energievak tijdens de zet, fase
  'crawl-pick' = schijnwerper `#walkBoard.is-grate-pick`, fase 'crawling', `soloStepsDone`: ook na je
  laatste stap mag je nog kruipen). Animatie `walkCrawlFx`/`walkCrawlPawn` (96-walk.js; pion even in
  `walkFlyingIdx`), ook bij bot-replays en bij de gast (`mpPortalJumpFxFromState`). Multiplayer-intents
  crawlStart/crawlPick/crawlCancel/crawlStop. Spelerskaartje: icoon als `p.screwdriver`. Simulatie-uitslag:
  kaart "Roosters" naast Portalen ("Wat levert een actie op?" staat daarom over de volle breedte).
  Spelregels: hoofdstuk 'rooster'. Nagemeten met de echte code (4 borden × 1.500): 66,6 beurten, 5,4×
  kruipen per potje, startposities 24,8–25,2%, 0 vast. Getest: zes acties passen op 1440×780 (84px
  over), potjes Zelf spelen en Automatisch uitgespeeld zonder fouten; Multiplayer nog niet met twee
  vensters getest. Keuzes van
  de maker (2026-11): terug naar **2 portalen** (één paar blauw ↔ rood), Portaalkanon 5,
  **schroevendraaier 5 energie**, plus een kristal Schroevendraaier (2 in de stapel). Elke gangtegel
  één roostervakje, nooit tegen (ook niet schuin naast) het kristalvakje; een portaal ligt nooit op
  een rooster. Kopen vóór je worp (telt als je energie-actie), max. één tegelijk, iedereen ziet dat je
  hem hebt. Sta je op een rooster (ook midden in je zet), dan mag je kiezen of je kruipt; kost geen
  stap; uit bij een vrij rooster naar keuze en **doorlopen** met de rest van je worp; daarna is hij op
  (opnieuw kopen). Laarzen lopen over een rooster heen; Duwstoot mag iemand op een rooster duwen.
  Uiterlijk: rooster **D4** (donker vak met koperen kader), icoon schroevendraaier **A**, uitgang kiezen
  = **schijnwerper**, kruipspoor = **rechte lijn**, openen = **losschroeven**. Gemeten: 66,6 beurten
  (nu met 4 portalen 64,6), 5,5× kruipen per potje, Stuwstoot zakt naar 17%, Noodtransport 33% —
  balans: zie hieronder. De ruimte voor de 6e actie is er sinds de kluis een tabblad is (zie
  **Kluis = tabblad** hierboven). Balansmeting (4 borden × 3.000, winst% Stuwstoot / Herpr. /
  laarzen / Noodtr.): gekozen opzet 17,1 / 26,9 / 23,5 / 32,5; Noodtransport bereik 9 of 10 of prijs 9
  helpt nauwelijks (31–33); Stuwstoot 3 → 19,4; Stuwstoot = 2 extra stenen voor 4 → 31,7 (te sterk),
  voor 5 → 28,5, voor 6 → 27,1, **voor 7 → 26,2 / 24,9 / 20,5 / 28,4** (alle vier binnen 19–31%).
  Keuze nog aan de maker.
- De 5e energie-actie is het **Portaalkanon** geworden (zie Portalen hierboven); het
  portaalkristal is er sinds 2026-10 als **Portaalsleutel**. Andere ideeën die nog niet gemeten konden worden omdat bots ze niet zinnig spelen: een schild
  tegen de volgende hinderkaart, of een energieversperring op een gang naar keuze.

**Opdrachten zijn af, niet meer voorstellen**: kom je op je opdrachtvakje, dan heb je de opdracht.
Punt. Er komt bewust geen extra actie, inhoud of doel bij (beslissing van de maker, 2026-11). De
namen (`QUEST_NAMES` in `10-rules.js`) zijn alleen de titel op de fysieke opdrachtkaart.
