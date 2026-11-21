# Portalen / Portaalkanon

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

- **Portalen / Portaalkanon** (5e energie-actie, prijs 5, 2026-10; blok PORTALEN in
  `95-simulate.js`). **Sinds de roosters (2026-11, keuze van de maker) weer één paar: blauw ↔ rood**
  (`PORTAL_NAMES`; het tweede paar terugzetten = twee namen/klassen erbij). Wat hieronder over twee
  paren staat is de geschiedenis. Er lagen **vier portalen in twee paren** op het bord, blauw ↔ rood en
  groen ↔ geel, gedeeld door iedereen; bij de start al, de twee van een paar ≥16 stappen uit elkaar
  en ≥6 van het andere paar (`portalSetup`). **Twee paren + prijs 5 (was één paar, prijs 7) is een
  keuze van de maker (2026-11): "portalen moeten meer gebruikt worden, het voelt telkens te ver
  weg".** Gemeten (3 borden × 2.000 potjes), oud → nieuw: schoten per potje 4,8 → 8,8, sprongen
  10,1 → 16,8, opdrachten in een beurt met een sprong 11,8 → 23,7% (grens in de simulatiekaart
  daarom 30%), potjes 75,3 → 64,7 beurten (−14%), meeste teleporteerder wint 24%, startposities
  24,2–25,9%, 0 vastgelopen. Energie-acties Stuwstoot / Herprioritering / laarzen / Noodtransport:
  21,4 / 28,2 / 24,1 / 26,2 → 19,7 / 27,8 / 23,8 / 28,8 (Stuwstoot zakt, Noodtransport stijgt; bij
  twee paren op prijs 7: 21,7 / 27,0 / 21,6 / 29,6, op 6: 20,0 / 28,7 / 22,5 / 28,8 — de prijs
  maakt daar weinig uit, het tweede paar wel). Geen paars portaal: dat is de kleur van de
  kristalvakjes. In de code: `P.cells`/`P.owner` hebben 4 plekken, de partner van kleur `c` is
  `c ^ 1`, namen/klassen in `PORTAL_NAMES`/`PORTAL_CLASSES`, `portalColorAt`. De cijfers verderop
  in dit blok zijn van vóór deze wijziging. Kanon = vóór de worp een
  richting kiezen, het portaal vliegt rechtdoor tot de muur of vóór een pion en landt op het
  verste gewone vakje (nooit op opdracht/start/kristal of het andere portaal), daarna kies je
  welke van de vier kleuren je verplaatst (2×2 knoppen, gemeten 1920×960 en 1440×780: past in het
  vaste energievak, niets afgekapt); de rest blijft liggen, ook als een ander hem legde (stelen).
  Stap je in een portaal, dan kom je uit het andere en **loop je met de rest van je worp door**, in
  elke richting (instappen = 1 stap). Spelregel van de maker sinds 2026-11 ("stoppen voelde als
  verloren stappen en frustratie"); daarvoor stopte de zet in het portaal. Gemeten bij de wissel
  (2 borden × 3.000 potjes, stoppen → doorlopen): potjes 77 → 72 en 85 → 78 beurten (−7%),
  opdrachten in een beurt met een sprong 3,1 → 10,6 / 11,5% (de oude grens van 5% in de
  simulatiekaart "Portalen" staat daardoor op rood), meeste teleporteerder wint 17/20 → 26%
  (grens 30%), energie-acties 23,2–27,7 / 21,0–29,6%, startposities nog eerlijk. Pion op een portaal = dat
  paar werkt niet (het andere wel). Noodtransport, laarzen en duwkaarten
  negeren portalen. Techniek: `adjKey` blijft het gewone bord; alleen `resolveMove` (in de DP is de
  uitgang een gewone toestand met richting `SIM_DIR_FREE` = mag alle kanten op; `layersVia` onthoudt
  de ingang voor het pad), `simBfsDistances` (de twee van een paar tellen als één vakje; `noPortal` voor Noodtransport)
  en `soloLegalNextCells` (mens) kijken naar `graph.portals = { cells: [blauw, rood, groen, geel], owner }`.
  Een pad door een portaal bevat ingang én uitgang (twee vakjes die niet naast elkaar liggen =
  `portalIsJump`); tel die stap niet als gelopen vakje. **Elke bot mag schieten** (ook vaste
  strategieën, via `botStrategyNow` → `botPortalWanted`) als het ≥6 stappen scheelt
  (`botPortalShot`); de Slim-bot alleen als het meer oplevert dan een sprint (`botSmartPick`).
  Bord: `walkPaintPortals`/`walkPortalShotFx`/`walkPortalPawn` (96-walk.js), opmaak blok
  PORTALEN onderaan styles.css (alleen transform/opacity). Uiterlijk gekozen uit 10 + 10
  varianten (artifact "Axiom-9 Portaalontwerpen", 2026-10): portaal = **gyroscoop** (tweede
  ronde, variant 16 uit 20, artifact "Axiom-9 Portaalvormen": twee ringen die samen om een felle
  kern draaien; de ovale poort uit de eerste ronde viel af), schot = **komeet** (kop + staart van 6 lichtjes, rechte lijn naar de
  muur, 2 schokgolven, portaal ploft open), bewust LANGZAAM (gebruikerswens: "zodat je echt goed
  ziet wat er gebeurt"): 130 ms per vakje, 0,7–1,7 s, op de snelste Automatisch-standen ×0,45
  (`PORTAL_COMET_MS_PER_CELL`). De komeet meet niets op: elk lichtje is een vakje groot en schuift
  in % van zichzelf + 1px gap per vakje. Zelf spelen: fases `portal-aim`
  (richting, knop of klik op het bord) en `portal-color`. Multiplayer: `portals` (plek + eigenaar)
  zit in de start én in elke stand (`mpPortalSnapshot`/`mpApplyPortals`), bot-beurten dragen
  `replay.portalShot` (voor/na), intents `portalAim`/`portalColor`.
  **Gekozen na een analyse van 44 varianten × 10.000 potjes** (artifact "Axiom-9 Portalen"):
  doorlopen na een portaal = te sterk (potjes 6–11% korter, tot 10% van de opdrachten via een
  portaal); vrij plaatsen binnen 10 = te veel controle; vast of zwervend = puur toeval; "niet bij
  een opdracht" deed bijna niets. Nagemeten na het inbouwen (4 borden × 10.000, elke bot mag
  schieten), winst% Stuwstoot / Herprioritering / laarzen / Noodtransport:
  zonder portaal 24,7 / 23,8 / 25,8 / 25,6 (85,8 beurten) · prijs 6: 22,9 / 25,3 / 23,6 / 28,1
  (Noodtransport te sterk) · **prijs 7: 23,8 / 25,2 / 24,7 / 26,4** (82,9 beurten, −3,4%) ·
  prijs 8: 23,7 / 24,9 / 24,9 / 26,5. Bij 7: 2,6 schoten per potje, 27% gestolen, 3,0% van de
  opdrachten in een beurt met een sprong, meeste teleporteerder wint 16,6%. Slim-bots: 1,1
  schoten per potje bij 7; een Slim-bot zónder portaal wint 24,7% tegen drie mét (geen merkbaar
  voordeel); laarzen-gebruik zakt van 8,2 naar 6,3 per potje. Speeltest met mensen nog te doen:
  wordt er gestolen, voelt 7 te duur (dan eerst 6, niet lager), worden potjes niet te kort.
