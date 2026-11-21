# Multiplayer: wat de host meestuurt en waarom

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

  **Kaart in multiplayer**: de host stuurt bij de start `layout` (welke tegel waar) ÉN `rotation`
  (tileRotation per tegel) ÉN `tiles` (de vakjes per tegel, voor als de host tegels bewerkte) mee;
  de gast neemt alle drie over in `mpApplyHostMap` (99-multiplayer.js). Vroeger alleen `layout`,
  waardoor elke gast zijn eigen draaiing gebruikte (gebruikersmelding 2026-10: "niet iedereen ziet
  dezelfde map, sommige tegels zitten verkeerd"). Nieuwe kaart-instelling? Ook hier meesturen.
  **Gast: dobbelvak bij een nieuwe beurt** — `mpApplyState` zet in de fases 'choose-action' en
  'rolling' het dobbelvak terug naar "?" (`renderSoloDicePending`), net als de host in
  soloBeginHumanTurn. Anders hield .walk-hud de klasse .has-result van de vorige worp en verborg de
  opmaak de knoppen Dobbelen/Gooi: de gast kon niet meer dobbelen en het potje liep vast
  (gebruikersmelding 2026-10). **#mpWaitTurn** ("X is aan zet — even wachten") staat in het
  energievak (#walkSoloPanel), niet in het dobbelvak: dat heeft een vaste hoogte en de melding viel
  dan over de energiebalk heen. **Testen zonder twee computers**: een testpagina met twee iframes
  (host + gast) en een nagebootste Trystero via BroadcastChannel (`mpTrysteroMod` vervangen vóór
  mpHostCreate/mpJoinConnect) + een automatische speler per venster vond beide fouten; na de
  oplossing 5 potjes van 48–67 beurten zonder vastlopen of fouten.
  **Klik van een gast** (`mpHandleIntent`): de host voert hem uit bij dezelfde `stateVersion`, óf als
  `mpIntentContext()` (fase, plek, stappen, energie, kristallen, openstaande keuze) bij de host nog gelijk
  is aan wat de gast meestuurde. Zonder dat laatste verdween ±1 op de 300 kliks (2026-11). Nieuwe
  beurt-toestand die bepaalt of een klik nog klopt? Ook in `mpIntentContext` zetten.
  **Geheim in multiplayer**: de host stuurt de stand per gast apart (`mpSendPerGuest`); in
  `mpPublicPlayer` ziet elke gast alleen zijn eigen kristallen, van anderen alleen het aantal.
  Logregels noemen in multiplayer en bij bots nooit welk kristal er werd opgeraapt.
