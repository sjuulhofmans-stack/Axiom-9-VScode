# Analyse Axiom-9 — fase 1 (alleen onderzoek)

Datum: 2026-11-08.

## Stand van het oplossen

| Portie | Status | Nummers |
|---|---|---|
| 1 | **opgelost** 2026-11-08 | 1, 2, 3, 4, 5, 6, 7 (en meteen 38) |
| 2 | **opgelost** 2026-11-08 | 9 (draaien/wisselen/editor liggen stil tijdens het genereren, plus V8), 10 (echte ruil + controle van de andere tegel bij Opslaan), 11, 12 |
| 3 | **opgelost** 2026-11-08 | 8 (keuzevak als laag in de kluis), 13 (chat onder het bord op 1361–1520 breed), 19, 20, 42. Gemeten op 1920×960 en 1440×780 |
| 4 | **opgelost** 2026-11-08 | 14, 16, 17, 36, 37, 39, 40 (38 al in portie 1). **15 wacht op een keuze.** Balans daarna (4000 potjes): kristallen 21,3–27,9%, energie-acties 23,5–26,3%, startposities 23,9–26,3% |
| 5 | **opgelost** 2026-11-08 | 18, 25, 26, 27, 41, 43, 44, 51, 52, 53, 54, 55, en 29 (legenda-uitleg past nu op 1280/1366/1440/1920) |
| 6 | **opgelost** 2026-11-08 | 22, 23, 24, 30, 48. Gemeten op 400×800 en 360×740: geen zijwaarts scrollen, niets afgekapt |
| 7 | **opgelost** 2026-11-08 | 28 (hoektegels draaien bij het wisselen vanzelf goed), 32, 45, 46, 47, 56 |
| 8 en 9 | nog te doen | zie onderaan |

Getest in Chrome: console leeg, Zelf spelen en Automatisch helemaal uitgespeeld, 500 potjes simulatie,
Multiplayer host + gast (gast vertrekt, nieuw potje start gewoon, portalen staan op het bord).

## Hoe is er onderzocht

- Eerst `git pull` (was al actueel) en `python build.py`.
- Zeven onderzoekers werkten tegelijk, één per onderdeel. Elk las de code in `src/` en gebruikte de gebouwde
  pagina in echte Chrome via een lokale server op drie maten: 1920×960, 1440×780 en 400×800. Ze klikten
  rond, speelden potjes uit, hielden de console in de gaten en maten posities, overlopende tekst, scrollen en
  animaties.
- Multiplayer is getest met twee Chrome-vensters en een nagebootste Trystero via BroadcastChannel, met een
  automatische speler per venster. Twee potjes host + gast + 2 bots zijn helemaal uitgespeeld.
- Om snel bij zeldzame situaties te komen, is soms de spelstand via de console aangepast (bv. energie op 10 of
  een kristal in de kluis). Dat staat bij de bevinding.
- Wat CLAUDE.md een bewuste keuze noemt, telt niet als fout. Het staat er alleen in als de code het anders doet.
- Elke bevinding is door de onderzoeker zelf nagespeeld of in de code nagelezen. De belangrijkste (nr. 1–7,
  9, 11, 14) heb ik daarna zelf nog in de code gecontroleerd. Dubbele meldingen van verschillende onderzoekers
  zijn samengevoegd.

**Niet getest:** de echte internetverbinding van Multiplayer (alleen nagebootst), 3 of 4 echte mensen tegelijk,
een host die echt wegvalt, en echte touchschermen.

**Wat overal goed was:** de console bleef in alle tests op alle tabbladen en maten leeg. Nergens scrolt de
pagina zijwaarts, behalve waar dat hieronder staat. Nergens staat nog "actiekaart" in beeld, en van de
weggehaalde kristallen is geen code of tekst over. Stoppen in Automatisch zet echt alles stil. Elke
gegenereerde kaart was geldig. Host en gast zagen dezelfde kaart en precies hetzelfde log, en er lekte geen
geheim.

## Telling

| Ernst | Aantal |
|---|---|
| KRITIEK | 1 |
| HOOG | 12 |
| MIDDEN | 22 |
| LAAG | 23 |
| Vermoedens (apart) | 15 |

Ernst: KRITIEK = spel loopt vast of geeft een fout resultaat · HOOG = duidelijk fout · MIDDEN = opvallend of
rommelig · LAAG = kleinigheid of idee. Klus: klein = een paar regels · middel = een paar uur · groot = meerdere
sessies.

---

## KRITIEK

### 1. Multiplayer: een gast die tijdens een potje vertrekt, blijft als "spook" in de kamer
- **Onderdeel:** Multiplayer · **Ernst:** KRITIEK · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** vertrekt een gast tijdens een potje, dan maakt de host er netjes een bot van. Maar zijn plek
  in de kamer blijft staan. Start de host daarna een nieuw potje, dan telt die plek weer als mens. Het spel
  wacht dan eeuwig op zijn worp, al bij "Wie begint?". De gast kan ook niet terugkomen met dezelfde naam, want
  die is "al bezet".
- **Hoe zie je het:** host + gast starten een potje. De gast klikt "Verlaat potje". De host verlaat ook het potje
  en klikt "Spel starten". Het nieuwe potje blijft hangen met de gast aan zet.
- **Waar:** `src/js/99-multiplayer.js` r. 905–935 (`mpOnPeerLeave`: de tak voor een lopend potje past
  `mp.seats` niet aan) en r. 967–996 (`mpHostStartGame` neemt `mp.seats` blind over).
- **Voorstel:** in de tak voor een lopend potje ook de plek uit `mp.seats` halen. Als vangnet neemt
  `mpHostStartGame` alleen plekken mee die nog verbonden zijn.

---

## HOOG

### 2. Multiplayer: de portalen zijn onzichtbaar tot het eerste portaalschot
- **Onderdeel:** Multiplayer · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** de portalen bestaan wel in het spel, maar staan bij host én gast niet op het bord. Spelers
  stappen er dus "per ongeluk" in. Ze worden eerst getekend, en meteen daarna wist het opnieuw opbouwen van het
  bord ze weer.
- **Hoe zie je het:** start een potje en kijk naar het bord: geen blauwe of rode ring.
- **Waar:** `src/js/99-multiplayer.js` r. 1026 (tekenen) → r. 1037 `mpEnterPlayView` → r. 1624
  `renderWalkBoard()`, dat via `src/js/96-walk.js` r. 271 de portalen wist. Bij de gast hetzelfde (r. 1118–1140).
  Latere standen helpen niet, want `mpApplyPortals` stopt als er niets veranderd is.
- **Voorstel:** in `mpEnterPlayView` na `renderWalkBoard()` meteen `walkPaintPortals(soloGraph)` aanroepen.

### 3. Zelf spelen: een vergrendelde speler kan toch een energie-actie inzetten
- **Onderdeel:** Zelf spelen (ook gasten in Multiplayer) · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** na Vergrendeling hoort je beurt geen energie-actie te hebben. Het energiepaneel en
  `soloUseEnergyAction` controleren dat niet. Alle vijf knoppen staan aan en Stuwstoot werkt gewoon. Bij een
  kristal staat daarbij een verkeerde reden ("je hebt al een kristal gebruikt").
- **Hoe zie je het:** vergrendelde beurt nagebootst met 10 energie. Daarna Stuwstoot geklikt: energie 10 → 6, drie stenen.
- **Waar:** `src/js/97-solo.js` r. 884–903 (`soloRenderActionPanel`), r. 1339–1346 (`soloUseEnergyAction`), r. 2145–2150.
- **Voorstel:** bovenaan `soloUseEnergyAction` stoppen als `soloEnergyActionUsed()`. In het paneel alle knoppen
  dicht met de reden "je bent vergrendeld", en dezelfde reden in `soloCardBlockReason`.

### 4. Zelf spelen: met Blinde Vlek kan je zet eindigen óp een andere pion
- **Onderdeel:** Zelf spelen · **Ernst:** HOOG · **Zekerheid:** zeker (twee onderzoekers, allebei in de browser nagespeeld) · **Klus:** klein–middel
- **Wat is er mis:** op het kristal staat "loop door spelers heen, maar stop er niet op". Bij bots klopt dat. Bij
  de mens negeert na "Ja, speel Blinde Vlek" elke stap de pionnen, ook de laatste. Daarna stonden twee pionnen
  op één vakje. Andersom kun je na die ene stap niet verder door spelers heen, want de volgende stap rekent weer
  mét pionnen.
- **Waar:** `src/js/97-solo.js` r. 1886–1895 (`soloResolveBlindOffer`), r. 1970–1972 (`soloHandleMoveClick`), r. 1833–1835 (`soloAdvanceMovePhase`).
- **Voorstel:** zolang Blinde Vlek gespeeld is, elke stap zonder pionnen berekenen. Een bezet vakje mag alleen
  als er daarna nog minstens 1 stap over is. Dat is dezelfde regel als bij de bots.

### 5. Zelf spelen: Noodtransport van de mens telt dwars door de portalen
- **Onderdeel:** Zelf spelen + Multiplayer · **Ernst:** HOOG · **Zekerheid:** zeker (gemeten) · **Klus:** klein
- **Wat is er mis:** volgens de spelregels en CLAUDE.md negeert Noodtransport de portalen. Bij bots klopt dat. Bij
  de mens tellen de twee portalen als één vakje. Daardoor kan hij veel verder springen dan 11.
- **Hoe zie je het:** vanaf een startvak zijn 138 vakjes bereikbaar in plaats van 102. Met een portaal naast je zijn het er 195.
- **Waar:** `src/js/97-solo.js` r. 1654. Ter vergelijking de bot in `src/js/95-simulate.js` r. 243.
- **Voorstel:** `simBfsDistances(soloGraph, solo().pos, true)`.

### 6. Bots in Zelf spelen en Multiplayer krijgen maar 1 kristal als ze 2 opdrachten in één beurt halen
- **Onderdeel:** regels tussen de modi · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** overal elders geeft elke voltooide opdracht een kristal: in de simulatie, in Automatisch en
  bij de mens. Alleen de bot-beurt in Zelf spelen trekt er hoogstens één. Het is zeldzaam, maar het is een
  andere regel.
- **Waar:** `src/js/97-solo.js` r. 2417–2422 (één `drawActionCard`, geen lus). Vergelijk `src/js/96-walk.js` r. 1588–1600.
- **Voorstel:** een lus over het aantal gehaalde opdrachten, net als in 96-walk.js (zie ook nr. 35 en 38).

### 7. Kortsluiting houdt een bot niet tegen bij Dubbele steen (de mens wel)
- **Onderdeel:** regels tussen de modi · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** `botWantsTwinEnergy` kijkt of de bot getroffen is door Kortsluiting. Maar die vlag is op dat
  moment in alle drie de modi al teruggezet. Een getroffen bot speelt dus toch Dubbele steen en krijgt een
  tweede energiesteen. De mens wordt in die situatie geweigerd.
- **Waar:** `src/js/95-simulate.js` r. 1419–1420 en 1462 (controle r. 899–901) · `src/js/96-walk.js` r. 1250–1251
  en 1289 · `src/js/97-solo.js` r. 2196 en 2234.
- **Voorstel:** de vlag vóór het terugzetten in een lokale variabele bewaren en die meegeven. Daarna de kristalmeting opnieuw draaien.

### 8. Zelf spelen: het keuzevak voor doelwit, Zelf kiezen of Blinde Vlek steekt onder het bord uit
- **Onderdeel:** Zelf spelen (ook Multiplayer) · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** middel
- **Wat is er mis:** dit keuzevak (`#walkCardActions`) komt onder de kluis. Sinds de kluis altijd groot is, past
  het niet meer. De pagina gaat scrollen, de 3e doelwitknop valt half weg en de kluis met Gebruik/Afleggen
  springt omhoog. Dat gaat in tegen twee regels uit CLAUDE.md: de kluis steekt nooit onder het bord uit en de
  knoppen verspringen niet.
- **Hoe zie je het:** dobbel en speel Kortsluiting of Zelf kiezen.

  | Scherm | Onder het bord | Kluis springt |
  |---|---|---|
  | 1920×960 | 55 px | 78–100 px |
  | 1440×780 | 174 px | 78–100 px |

- **Waar:** `src/js/97-solo.js` r. 111 (`soloRenderCardActionsPanel`), 1129, 1208, 1872 · `src/index.html` r. 659 ·
  `src/styles.css` r. 1451, 2684, 4037.
- **Voorstel:** de keuze tonen in het energievak, dat tijdens het lopen leeg is en een vaste hoogte heeft. De
  laarzen- en portaalkeuze staan daar ook al. Daarna opnieuw meten op beide maten.

### 9. Speelbord: draaien of de tegel-editor gebruiken tijdens het genereren maakt het bord kapot
- **Onderdeel:** Speelbord genereren · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein (alleen knoppen uit) tot middel
- **Wat is er mis:** de generator rekent met dezelfde draaiingen als het bord. Terwijl hij rekent, zet hij die
  steeds op 0. Draai je intussen een tegel of wijzig je iets in de editor, dan wordt het genereren
  afgebroken. Dan gebeurt er drie dingen:
  - Het oude bord verschijnt met alle draaiingen op 0. Gemeten: 8 doodlopende naden en 19 onbereikbare vakjes.
  - De generator rekent op de achtergrond door en zet aan het eind de draaiingen van een kaart die niet gebruikt wordt.
  - Het seed-veld toont een andere seed dan het bord.
- **Hoe zie je het:** selecteer een tegel, klik "Genereer nieuwe map" en klik binnen een paar seconden "90° rechts".
- **Waar:** `src/js/70-generator.js` r. 593–676 (`constrainedShuffleAsync`) · `src/js/80-controls.js` r. 207–314.
- **Voorstel:** snelste stap: tijdens het genereren de draaiknoppen en "Bewerken" in het register uitzetten.
  Beter: de generator een eigen draaiingstabel geven en hem laten stoppen als hij is afgebroken.

### 10. Tegel-editor: een "al in gebruik"-nummer kiezen laat een andere tegel kapot achter
- **Onderdeel:** Speelbord / tegel-editor · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** je kunt een opdracht- of kristalnummer kiezen dat al bij een andere tegel hoort. De editor
  haalt het daar weg, maar controleert bij Opslaan alleen de open tegel. Zo heeft een andere kamer opeens geen
  opdrachtvakje, zonder melding. Pas bij Simulatie of Spelen staat er "ontbreekt op het bord".
- **Hoe zie je het:** open Cafetaria → Opdrachtvakje → kies "2.2 (al in gebruik)" → zet het op een vakje → wis
  het oude vakje → Opslaan. Motor 1 heeft nu geen opdracht meer.
- **Waar:** `src/js/90-editor.js` r. 215–226 (`attemptCloseTileEditor`) en r. 316–330 (`paintCell`).
- **Voorstel:** bij Opslaan ook de tegels controleren waar een nummer is weggehaald, en de fout noemen
  ("Motor 1 heeft nu geen opdrachtvakje meer"). Of alleen een echte ruil toestaan.

### 11. Automatisch: van tabblad wisselen tijdens de startanimatie start toch een potje, zonder Stoppen-knop
- **Onderdeel:** Spelen → Automatisch · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein–middel
- **Wat is er mis:** na de animatie start het potje zonder te controleren of je nog op Spelen → Automatisch zit.
  Wissel je naar Multiplayer, dan start daar een Automatisch-potje. De multiplayer-lobby is dan weg, en Pauze,
  Stoppen en Tempo zijn verborgen. Wissel je naar een ander tabblad, dan start het potje ongezien op de
  achtergrond en valt het zwarte gordijn over dat tabblad.
- **Hoe zie je het:** Spelen → Automatisch → Start spel → na 2 s op Multiplayer klikken → 11 s wachten.
- **Waar:** `src/js/96-walk.js` r. 169–187 (`walkTryStart`) · `src/js/96b-intro.js` r. 207–217 en 468–492.
- **Voorstel:** na de animatie alleen starten als je nog op dezelfde plek bent. Of de tabbladen op slot zetten
  zolang de animatie loopt, zoals tijdens het genereren.

### 12. Automatisch: een nieuwe kaart maken tijdens een potje laat je vastzitten in een leeg speelscherm
- **Onderdeel:** Spelen → Automatisch · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** het potje stopt netjes, maar het speelscherm blijft open. Pauze en Stoppen worden grijs en er
  is geen knop terug naar de lobby. Eruit kom je alleen via ☰ Menu → Multiplayer → Spelen.
- **Hoe zie je het:** start een potje → ☰ Menu → Speelbord genereren → Genereer nieuwe map → ☰ Menu → Spelen.
- **Waar:** `src/js/96-walk.js` r. 1107–1115 (`stopWalkSimulation`) · `src/js/95-simulate.js` r. 2010–2013.
- **Voorstel:** bij stoppen via een nieuwe kaart meteen terug naar de lobby. Zelf spelen even nalopen op hetzelfde pad.

### 13. Multiplayer: het bord wordt rechts afgeknipt op schermen van ±1360 tot ±1505 breed
- **Onderdeel:** Multiplayer · **Ernst:** HOOG · **Zekerheid:** zeker · **Klus:** middel
- **Wat is er mis:** op 1440×780 valt ±42 px van het bord weg, een groot deel van de rechter tegelkolom. Onder
  het bord blijft intussen ±230 px leeg. De vakjes zakken naar hun minimum van 11 px, maar dat is nog te breed.
  CLAUDE.md zegt dat op ±1400 breed niets afgeknipt mag worden. Voor Multiplayer is alleen Full HD gemeten.
- **Waar:** `src/styles.css` r. 1468–1470 (`--wcell` in Multiplayer, kolommen 270/370/230).
- **Voorstel:** onder ±1520 breed de chat onder de zijkolom zetten, of smaller of inklapbaar maken. Daarna meten op 1440×780 en 1366×768.

---

## MIDDEN

### 14. Bots spelen Energielek vóór hun energie-actie en geven de buit meteen uit
- **Onderdeel:** regels tussen de modi · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** Energielek mag pas na het dobbelen ("Na je worp"). De mens geeft de 2 gestolen energie dus pas
  volgende beurt uit. Bots spelen hem in alle drie de modi vóór hun energie-actie, dus ze betalen er in dezelfde
  beurt al mee. CLAUDE.md wilde juist dat bots en mensen dezelfde tijdsregels hebben.
- **Waar:** `src/js/95-simulate.js` r. 587 (`when: 'post'`), r. 1452–1460, pas daarna 1506/1538/1578 ·
  `src/js/96-walk.js` r. 1279 · `src/js/97-solo.js` r. 2225.
- **Voorstel:** het Energielek-blok in alle drie de modi naar ná de energie-actie verplaatsen. Daarna de kristalmeting opnieuw draaien.

### 15. Noodtransport: bots rapen kristallen op langs de sprong, de mens alleen waar hij landt
- **Onderdeel:** regels tussen de modi · **Zekerheid:** zeker (11 van 462 sprongen, ±2,4%) · **Klus:** klein
- **Wat is er mis:** voor een bot telt elk kristalvakje op de route van de sprong. Voor de mens telt alleen het landingsvakje.
- **Waar:** `src/js/95-simulate.js` r. 264–276 en 1647 · `src/js/96-walk.js` r. 1387 en 1443 · `src/js/97-solo.js` r. 2401 tegenover r. 1677.
- **Voorstel:** **keuze voor de maker.** Waarschijnlijk telt alleen de landingsplek, want je springt "vrij". Dan bij een sprong alleen het laatste vakje controleren.

### 16. Bots raken hun Condensator kwijt bij een energieworp van 0, de mens niet
- **Onderdeel:** regels tussen de modi · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** bij de mens blijft de Condensator staan als de energiesteen 0 gooit. Bij bots is hij dan meteen op, dus in 1 op de 6 beurten.
- **Waar:** mens `src/js/97-solo.js` r. 1783 · bots `src/js/95-simulate.js` r. 1427, `src/js/96-walk.js` r. 1257, `src/js/97-solo.js` r. 2202.
- **Voorstel:** één regel kiezen en die op alle vier de plekken gebruiken.

### 17. Automatisch: statistiek "Portalen geschoten / door gestapt" staat altijd op 0 / 0
- **Onderdeel:** Spelen → Automatisch · **Zekerheid:** zeker · **Klus:** klein
- **Waar:** `src/js/96-walk.js` r. 1429–1435 (schot) en r. 1548 (sprongen worden daar al geteld, maar niet bewaard).
- **Voorstel:** op die twee plekken de tellers `portalShots` en `portalJumps` ophogen, zoals in 97-solo.js.

### 18. Simulatie: "Dode tegels: geen" terwijl twee tegels bijna geen verkeer hebben
- **Onderdeel:** Simulatie · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** het oordeel kijkt alleen of een tegel méér dan 0 verkeer heeft. In een run van 2000 potjes
  hadden twee gangen elk 0,1%, dertig keer minder dan de volgende tegel. Toch stond er groen "geen".
- **Waar:** `src/js/95-simulate.js` r. 2307–2312.
- **Voorstel:** een drempel ten opzichte van de andere tegels, bijvoorbeeld onder 0,5% van het verkeer = dood, en dan het aantal tonen.

### 19. Zelf spelen: het woordje "of" onder het energievak duwt de kluis onder het bord
- **Onderdeel:** Zelf spelen · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** heb je vóór de worp een bruikbaar kristal, dan verschijnt "of". Op 1440×780 duwt dat de kluis
  19 px onder het bord en verspringen Gebruik/Afleggen. Het "of" blijft ook na het dobbelen staan.
- **Waar:** `src/js/97-solo.js` r. 917–923 en 1034–1037 · `src/index.html` r. 631.
- **Voorstel:** "of" verbergen buiten de keuzefase, en het geen hoogte laten innemen.

### 20. Missiestrook na afloop klopt niet
- **Onderdeel:** Zelf spelen + Multiplayer · **Zekerheid:** zeker (twee onderzoekers) · **Klus:** klein
- **Wat is er mis:** na het winscherm blijft "Bezig met opdracht 5 van 6" staan, met de puls. Wordt de strook wel
  opnieuw getekend, dan krijgt een verliezer met 5/6 de tekst "Alle 6 opdrachten voltooid". De tekst kijkt naar
  de eindplaats in plaats van naar het aantal opdrachten.
- **Waar:** `src/js/97-solo.js` r. 550–552 (`soloMissionHtml`) en r. 3142–3158 (`soloEndGame`).
- **Voorstel:** de tekst laten afhangen van het aantal voltooide opdrachten, en de strook bij het einde opnieuw tekenen.

### 21. Multiplayer: "Verlaat potje" als gast gooit je de kamer uit
- **Onderdeel:** Multiplayer · **Zekerheid:** zeker · **Klus:** middel
- **Wat is er mis:** CLAUDE.md (controle 10) zegt dat host én gast terugkomen in de kamer, met code en spelers
  intact. Voor de gast klopt dat niet: hij komt op het beginscherm en de verbinding is weg. Het commentaar in de
  code noemt dit juist bewust gedrag, dus code en CLAUDE.md spreken elkaar tegen.
- **Waar:** `src/js/99-multiplayer.js` r. 1651–1675 (`mpLeaveGame`).
- **Voorstel:** **keuze voor de maker:** code aanpassen aan CLAUDE.md, of CLAUDE.md aan de code. Let op nr. 1.

### 22. Multiplayer: de kamer is op een telefoon onbruikbaar
- **Onderdeel:** Multiplayer · **Zekerheid:** zeker · **Klus:** middel
- **Wat is er mis:** op 400 breed is de brug 0 px breed. Je ziet geen code en geen stoelen, en de chat valt rechts weg.
- **Waar:** `src/styles.css` r. 4127–4132.
- **Voorstel:** onder ±900 breed één kolom: brug, chat, avatar-maker.

### 23. Telefoon: op het tabblad Kaart valt de rechterkant van het bord weg
- **Onderdeel:** Speelbord · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** de vakjesgrootte onder 640 px houdt geen rekening met de rand van het bordvak. Het bord is ±44 px te breed en je moet zijwaarts schuiven.
- **Waar:** `src/styles.css` r. 3294.
- **Voorstel:** `(100vw - 95px)` wordt `(100vw - 135px)`, net als bij het speelbord. Daarna meten op 360, 400 en 600.

### 24. Telefoon: de Tempo-schuif ligt over ☰ Menu en het logo
- **Onderdeel:** speelweergave · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** op 400 breed ligt de schuif over de Menu-knop en het logo. Na afloop schuift hij deels buiten beeld.
- **Waar:** `src/styles.css` r. 176–181, 244 en 256–258.
- **Voorstel:** onder ±640 px de schuif in de kop verbergen of op een eigen regel zetten, en het logo verbergen.

### 25. Spelregels: de titel van een hoofdstuk valt onder de kop tussen ±1100 en 1300 breed en op een telefoon
- **Onderdeel:** Spelregels · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** `rules.css` rekent met een kop van 96 px. Op die breedtes is de kop 124–138 px hoog. Klik je op
  een hoofdstuk, dan verdwijnt de titel onder de kop.
- **Waar:** `src/rules.css` r. 7, 26 en 82.
- **Voorstel:** de kophoogte per breedte instellen, of als variabele uit JS halen.

### 26. Kristal "Stroomonderbreking": de naam breekt midden in het woord af
- **Onderdeel:** Speelkaarten + kluis · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** er staat "STROOMONDERBR / EKING", in de vitrine, de zoom en de kluis, op elke maat.
- **Waar:** `src/js/96c-crystals.js` r. 54 · `src/styles.css` r. 3722–3725.
- **Voorstel:** een zacht afbreekstreepje: `Stroom&shy;onderbreking`.

### 27. Spelregel Noodtransport mist "land je op je opdracht, dan is je beurt klaar"
- **Onderdeel:** Spelregels · **Zekerheid:** zeker (twee onderzoekers) · **Klus:** klein
- **Wat is er mis:** de regel zegt alleen "Daarna gooi je". Bij mens en bot eindigt de beurt als je precies op je opdracht landt. De tooltip zegt het wel goed.
- **Waar:** `src/js/98c-rules.js` r. 22.
- **Voorstel:** "… Land je op je opdracht, dan is je beurt klaar; anders gooi je daarna."

### 28. Speelbord: twee hoektegels verwisselen kan nooit, maar de melding zegt "probeer eerst te draaien"
- **Onderdeel:** Speelbord · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** op een hoek kun je een tegel niet draaien, dus het advies is onuitvoerbaar.
- **Waar:** `src/js/40-board.js` r. 229–255 · `src/js/10-rules.js` r. 91–101.
- **Voorstel:** bij een wissel tussen twee hoeken beide tegels meteen goed draaien. Of anders de melding aanpassen.

### 29. Legenda: uitleg wordt afgeknipt op 1440×780 en 1366×768
- **Onderdeel:** Speelbord · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** het uitlegvak heeft een vaste hoogte van 76 px. Bij "Naad geblokkeerd" en "Positieletter" valt de laatste regel weg. CLAUDE.md mat alleen 1920×945.
- **Waar:** `src/index.html` r. 166–167 · `src/styles.css` r. 584 e.v.
- **Voorstel:** de twee teksten inkorten, of de hoogte afstemmen op de smalste kolom en opnieuw meten.

### 30. Tegel-editor: foutmelding onleesbaar op een telefoon
- **Onderdeel:** Speelbord · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** op 400 breed blijft er tussen Herstel en Opslaan maar 48 px over voor de melding.
- **Waar:** `src/styles.css` (`.editor-foot` / `.editor-msg`) · `src/index.html` r. 773–777.
- **Voorstel:** onder ±640 px de melding op een eigen regel boven de knoppen, met vaste hoogte.

### 31. Genereren duurt 7–13 seconden, niet ±2 seconden
- **Onderdeel:** Speelbord · **Zekerheid:** zeker · **Klus:** middel
- **Wat is er mis:** het commentaar en CLAUDE.md zeggen ±2 s. Ruim drie kwart van de tijd gaat naar pogingen die mislukken: 99 van de 159.
- **Waar:** `src/js/70-generator.js` r. 54–98 en 600.
- **Voorstel:** een lager stappenbudget per poging proberen en meten hoeveel kandidaten er dan nog uitkomen. De pool van 60 is een bewuste keuze en blijft.

### 32. Een hoektegel bewerken tot drie doorgangen: geen waarschuwing, en elke nieuwe kaart mislukt
- **Onderdeel:** Speelbord / tegel-editor · **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** er zijn precies 4 tegels die op een hoek passen. Maak je er één ongeschikt, dan keurt de editor
  dat goed. Daarna mislukt elke kaart, en de tool blijft zeggen "probeer een nieuwe map".
- **Waar:** `src/js/90-editor.js` r. 86–155 · `src/js/80-controls.js` r. 246–248.
- **Voorstel:** in de editor waarschuwen als er minder dan 4 hoektegels overblijven, en in de genereer-melding de oorzaak noemen.

### 33. Speelscherm: animaties op box-shadow, filter en background-position (tegen de prestatieregel)
- **Onderdeel:** prestatie · **Zekerheid:** zeker dat het tegen de regel ingaat. Of het merkbaar hapert, is niet gemeten. · **Klus:** middel
- **Wat is er mis:**
  - De stappenbalk in het dobbelvak verandert bij elke stap met een overgang op box-shadow (`src/styles.css` r. 4002–4003).
  - De kluis gloeit via box-shadow (r. 3768, 3835, 3838).
  - De zeshoekjes op de spelerskaartjes animeren `filter: drop-shadow` (r. 3850).
  - Het zilveren kristal animeert background-position (r. 3897).
  - Elke kristalvorm heeft een vaste drop-shadow (r. 3707).
  - Midden in een beurt wordt `void offsetWidth` gebruikt (`src/js/96c-crystals.js` r. 161, 393, 458).
  - De opdrachtenlijst wordt bij elke stap helemaal opnieuw gebouwd (`src/js/97-solo.js` r. 603). Daardoor valt spieken tijdens het lopen steeds even weg.
- **Voorstel:** gloed als laagje dat alleen in opacity pulst, glans via transform, `el.animate()` in plaats van
  offsetWidth, en de opdrachtenlijst alleen vernieuwen als er iets veranderd is.

### 34. `:has()` in het speelscherm (tegen de prestatieregel), één regel is ook dood
- **Onderdeel:** prestatie · **Zekerheid:** zeker. Het gemeten effect is klein: ±15% stijlberekening, geen verschil in beeldjes per seconde. · **Klus:** klein
- **Waar:** `src/styles.css` r. 206–207, 2056 (vijf keer `:has` op de linkerkolom) en 2188. Regel 2188 verwijst naar de klasse `walk-mp-leave-row`, die niet meer bestaat.
- **Voorstel:** JS een klasse laten zetten, bv. `.is-empty`, en regel 2188 weghalen.

### 35. De bot-beurt staat drie keer bijna gelijk gekopieerd
- **Onderdeel:** code algemeen · **Zekerheid:** zeker · **Klus:** groot
- **Wat is er mis:** `simulateOneGame`, de lus in Automatisch en `soloResolveBotTurn` bevatten elk ±200 dezelfde
  regels. Het afboeken van een opdracht met het trekken van een kristal staat er vijf keer in. Nr. 6, 7, 14, 16
  en 38 zijn precies afwijkingen die hieruit ontstaan.
- **Waar:** `src/js/95-simulate.js` r. 1387–1715 · `src/js/96-walk.js` r. 1216–1620 · `src/js/97-solo.js` r. 2173–2441.
- **Voorstel:** de beslis- en rekenkant van een bot-beurt in één gedeelde functie in 95-simulate.js, zoals
  `botPreRollMove` al is. Die geeft een verslag terug, en elke modus doet alleen nog log, animatie en statistiek.

---

## LAAG

### 36. Simulatie: een bot met vaste strategie doet een hele beurt niets als zijn portaalschot niet kan
- **Zekerheid:** zeker (±11% van de beurten waarin hij wil schieten) · **Klus:** klein
- **Waar:** `src/js/95-simulate.js` r. 455–466 (rekent zonder pionnen), 485, 820–823.
- **Voorstel:** de echte bezetting meegeven, of bij een mislukt schot terugvallen op de eigen strategie.

### 37. Bots kijken al naar hun energiesteen voordat ze Dubbele steen kiezen
- **Zekerheid:** zeker (klein effect, alleen rond het plafond) · **Klus:** klein
- **Waar:** `src/js/95-simulate.js` r. 899–901 en 1462 · `src/js/96-walk.js` r. 1289 · `src/js/97-solo.js` r. 2234.
- **Voorstel:** eerst beslissen, dan pas de energiesteen gooien. Kan samen met nr. 7.

### 38. Een bot op 5/6 die 2 opdrachten in één beurt haalt, komt op 7/6
- **Zekerheid:** zeker (zeldzaam) · **Klus:** klein
- **Waar:** `src/js/96-walk.js` r. 1579 · `src/js/97-solo.js` r. 2415. De simulatie en de mens stoppen wel netjes bij 6.
- **Voorstel:** het aantal gehaalde opdrachten afkappen op wat er nog nodig is.

### 39. Energielek mag bij de mens met volle energie, dan valt alles weg
- **Zekerheid:** zeker · **Klus:** klein
- **Waar:** `src/js/97-solo.js` r. 1005. Bots doen het niet.
- **Voorstel:** Energielek toevoegen aan de regel die Noodrantsoen en Zonnezeil bij volle energie tegenhoudt.

### 40. Statistiek "Energie verbruikt" telt energie mee die een ander je afpakte
- **Zekerheid:** zeker · **Klus:** klein
- **Waar:** `src/js/97-solo.js` r. 2718–2719.
- **Voorstel:** een eigen teller die alleen ophoogt als je een energie-actie betaalt.

### 41. Er staan nog 2.x- en 3.x-nummers in beeld
- **Zekerheid:** zeker · **Klus:** klein
- **Waar:** `src/js/97-solo.js` r. 1134 (doelwitkeuze toont "3.2"), 1613, 1628, 1633 (Herprioritering "Houd 2.4").
- **Voorstel:** alleen naam en kamer tonen. Bij het doelwit bijvoorbeeld "1/6 · 4 energie".

### 42. Grafieken-pop-up scrolt op 1440×780
- **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** 808 px inhoud in een vak van 716 px. CLAUDE.md zegt "past zonder scrollen op ±1400".
- **Waar:** `src/js/97-solo.js` r. 2881 + `.sc-*` in styles.css.
- **Voorstel:** de grafieken iets lager maken.

### 43. Simulatie: "Keer ingezet" telt portaalschoten mee, de andere tabel niet
- **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** daardoor staat Noodtransport in de ene tabel op 2,6 per potje en in de andere op 1,5.
- **Waar:** `src/js/95-simulate.js` r. 1549, 2434, 2681.
- **Voorstel:** portaalschoten apart tellen, of de kolom hernoemen.

### 44. Simulatie: tabel "Koudste tegels" lijkt niet gesorteerd
- **Zekerheid:** zeker · **Klus:** klein
- **Wat is er mis:** hij sorteert op bezoeken per vakje, maar toont het aandeel van de hele tegel.
- **Waar:** `src/js/95-simulate.js` r. 2198 en 2206.
- **Voorstel:** de kolom tonen waarop gesorteerd wordt.

### 45. Simulatie: Home, End, PageUp en PageDown doen niets op de rolteller
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/js/95-simulate.js` r. 1870–1873.
- **Voorstel:** PageUp/PageDown = ±1000, Home = 100, End = 20.000.

### 46. Automatisch: Pauze laat de komeet en het portaalschot toch afmaken
- **Zekerheid:** zeker · **Klus:** klein
- **Waar:** `src/js/96-walk.js` r. 917–921 en 1432 · `src/styles.css` r. 2007, 2023, 4283, 4287.
- **Voorstel:** na de komeet en het schot op de pauze wachten, en deze animaties ook pauzeren.

### 47. Na afloop blijven Tempo en een grijze Pauze in de kop staan
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/js/96-walk.js` r. 87–96 en 1668–1671.
- **Voorstel:** na afloop alleen "Terug naar lobby" tonen.

### 48. Telefoon: de tempoknoppen in de lobby zijn afgekapt ("HEE…", "NOR…")
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/index.html` r. 296 + `.seg-*` in styles.css.
- **Voorstel:** op een smal scherm kortere labels, of twee rijen.

### 49. Automatisch: lege linkerkaart tijdens "Wie begint?" en op het winscherm
- **Zekerheid:** zeker dat het zo is · **Klus:** klein
- **Wat is er mis:** links staat een lege donkere kaart en rechts niets, dus het beeld oogt scheef.
- **Waar:** `.walk-status-col` in styles.css · `src/js/96-walk.js` r. 569–581.
- **Voorstel:** **keuze voor de maker** (kan bewust zijn): de kaart doorzichtig maken als hij leeg is. De breedte blijft dan gelijk.

### 50. Multiplayer: een klik van de gast wordt af en toe genegeerd
- **Zekerheid:** zeker (1 van de 304 klikken) · **Klus:** klein
- **Wat is er mis:** de host neemt een klik alleen aan als de stand niet net veranderd is.
- **Waar:** `src/js/99-multiplayer.js` r. 1573.
- **Voorstel:** een verouderde klik opnieuw beoordelen in plaats van weggooien. De handlers controleren zelf al of hij nog geldig is.

### 51. Spelregels: hoofdstuk 12 "Einde van het potje" licht in de navigatie nooit op
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/js/98c-rules.js` r. 240–250.
- **Voorstel:** onderaan de pagina het laatste hoofdstuk actief maken.

### 52. Kleine fouten in de spelregeltekst
- **Zekerheid:** zeker · **Klus:** klein
  - "Een kamer heeft een opdrachtvakje" klopt niet voor Hibernatie (`src/js/98c-rules.js` r. 66).
  - "Wie als eerste 6 haalt, is 1e" spreekt de regel over het uitspelen van de ronde tegen (r. 168, animatie r. 664–665).
  - "duwkaarten" moet "het kristal Duwstoot" zijn (r. 146).
  - "2 tot 4 spelers", terwijl de tool 1 speler toestaat (r. 59). Waarschijnlijk bewust voor oefenen.
  - In de simulatie-uitleg staat een functienaam: "(zie pickEnergyStrategies)" (`src/js/95-simulate.js` r. 2444).

### 53. Spelregels: prijsbolletje "10" duwt de naam Noodtransport 8 px opzij
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/rules.css` r. 61–65.
- **Voorstel:** een vaste breedte voor het bolletje.

### 54. Speelkaarten: de uitleg over kristallen is met de hand getypt
- **Zekerheid:** zeker. De aantallen kloppen nu, maar lopen niet mee bij een wijziging. · **Klus:** klein
- **Waar:** `src/index.html` r. 709.
- **Voorstel:** de zin opbouwen uit de spelgegevens, zoals het tabblad Spelregels al doet.

### 55. Legenda: uitleg "Positieletter" noemt oranje niet
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/index.html` r. 167.
- **Voorstel:** "… oranje = rand". Let op nr. 29: de tekst wordt dan langer.

### 56. Tegel-editor: bij losse vakjes wordt de hele tegel rood
- **Zekerheid:** zeker · **Klus:** klein · **Waar:** `src/js/90-editor.js` r. 101–103.
- **Voorstel:** alleen de vakjes markeren die los liggen.

### 57. Dode code
- **Zekerheid:** zeker (elke naam over alle bestanden nagezocht, ook opgebouwde namen) · **Klus:** middel
  - JS: `OTHER_SLOTS`, `paletteRoomsEl`, `paletteCorrEl` (`src/js/10-rules.js` r. 47, 197–198), `formatSimSeconds`
    (`95-simulate.js` r. 2556), `PULSE_DURATION_MS` (`97-solo.js` r. 79), `avatarRowHtml` (`98b-avatar.js` r. 346–365).
  - `renderBoard` bouwt bij elke tekenbeurt een verborgen statusregel en roept registers aan die niet meer
    bestaan (`src/js/40-board.js` r. 156–192). Het register wordt bij elke sleepbeweging helemaal opnieuw gebouwd (`60-palette.js` r. 438–472).
  - CSS: ongeveer 40 klassen van oude ontwerpen, zoals de oude kaartkluis, de oude dobbelstenen `.walk-die*`,
    `card-drawn*`, `action-card--*` (op `--lg` en `--plain` na), `gen-dots` en `mp-avatars`. Samen een paar honderd regels in styles.css.
- **Voorstel:** weghalen, daarna het speelscherm even nalopen.

### 58. CLAUDE.md en commentaar lopen achter
- **Zekerheid:** zeker · **Klus:** klein
  - Volgens CLAUDE.md is de generator-pool 20, met 6 criteria. In de code is de pool 60, met 10 criteria (`src/js/70-generator.js` r. 539–559, 600).
  - De structuurlijst mist `06-chants.js` en de assets `bigdaddy.b64`, `partycar-*.b64`, `kaboem.b64` en `chants/`.
  - Controle 14 noemt de categorie "Actiekaarten". In de code heet die "Kristallen".
  - Verouderd commentaar in de code:
    - `95-simulate.js` r. 873–874: er wordt geloot, niet de eerste speler gekozen.
    - `95-simulate.js` r. 802–806: de volgorde klopt niet meer.
    - `index.html` r. 329.
    - `97-solo.js` r. 2791: "18 actiekaarten".
    - `styles.css` r. 1552 en 4037.

---

## Vermoedens (niet hard bewezen, apart gehouden)

| # | Onderdeel | Vermoeden | Waar |
|---|---|---|---|
| V1 | Multiplayer | Eén keer stond een potje ±60 s stil en liep daarna vanzelf door. Het kwam niet terug en kan aan de testspeler liggen. Advies: zelf een lang potje met 2 mensen spelen. | — |
| V2 | Multiplayer | Een gast kan met een zelfgemaakt bericht overal heen springen met Noodtransport. De functie controleert fase en bereik niet. | `97-solo.js` r. 1665, `99-multiplayer.js` r. 1566 |
| V3 | Multiplayer | De herinneringsknop van de gast komt na een potje misschien pas laat terug. | `99-multiplayer.js` r. 732, 855 |
| V4 | regels | Een bot kan maar één verplaatsing vóór de worp doen. Een mens kan er twee combineren, bv. Portaalsleutel + laarzen. De simulatie meet dan een zwakkere speler dan een slimme mens. | `97-solo.js` r. 1452–1458 |
| V5 | regels | Bots spelen "Na je worp"-kristallen al vóór hun worp. Bij Duwstoot geeft dat een klein voordeel. | 3 bot-varianten |
| V6 | Automatisch | Het log noemt welk kristal een bot opraapt, en een schot met de Portaalsleutel heet "Portaalkanon". Waarschijnlijk bewust, want er speelt geen mens mee en het log is verborgen. | `96-walk.js` r. 1391, 1431, 1593 |
| V7 | Automatisch | Op tempo Normaal duurt het ±27 s voordat de eerste pion loopt. | `96-walk.js` r. 859–929 |
| V8 | Speelbord | "Vorige indeling" en direct daarna "Genereer" kunnen door elkaar lopen. | `80-controls.js` r. 207–216, 281–298 |
| V9 | Speelbord | Op een touchscherm blijft de legenda "uitgelicht" na een tik. | `90-editor.js` r. 399–410 |
| V10 | Simulatie | 20.000 potjes duurt ruwweg 7–15 minuten, en dat zie je vooraf nergens. | `95-simulate.js` r. 1767 |
| V11 | Simulatie | Op een telefoon worden de snelkeuze-knopjes hoge ovalen, waarschijnlijk bewust voor touch. | `styles.css` r. 3275 |
| V12 | Zelf spelen | Gebruik/Afleggen zien er bij een lege kluis even fel uit als wanneer ze werken. | — |
| V13 | Spelregels | Na het wisselen van tabblad springt de scrollpositie. | `80-controls.js` (`switchTab`) |
| V14 | Spelregels | In de animatie "Je beurt" staat "hooguit 1 kristal" bij Lopen, alsof je pas dan een kristal mag spelen. | `98c-rules.js` r. 457 |
| V15 | Speelkaarten | Het zoomvenster heeft geen sluitknop en geen focusbeheer. Met muis en Escape werkt het wel. | `index.html` r. 720–726 |

---

## Samenvatting

### De 5 belangrijkste punten

1. **Multiplayer loopt vast na een vertrokken gast (nr. 1).** Het volgende potje wacht eeuwig op iemand die er niet meer is. Kleine klus.
2. **Multiplayer: portalen onzichtbaar (nr. 2).** Spelers stappen in iets wat ze niet zien. Eén regel code.
3. **Mens en bot spelen met andere regels (nr. 3–7, 14–16).** Bij Noodtransport via portalen, Blinde Vlek,
   Vergrendeling, kristallen bij twee opdrachten, Kortsluiting + Dubbele steen, Energielek en Condensator. Elk
   apart is klein. Samen maken ze de simulatie minder betrouwbaar, en de oorzaak is de gekopieerde bot-beurt (nr. 35).
4. **De zijkolom in Zelf spelen houdt zich niet aan de vaste maten (nr. 8, 19).** Het keuzevak en het "of" duwen de kluis onder het bord.
5. **Vastlopers door navigatie (nr. 9, 11, 12).** Tijdens het genereren draaien, tijdens de startanimatie van tabblad wisselen, of tijdens een potje een nieuwe kaart maken.

### Voorstel voor de volgorde, in porties

| Portie | Wat | Nummers | Grootte |
|---|---|---|---|
| 1 | **Vastlopers en eenregelige spelfouten.** Daarna de simulatie opnieuw draaien. | 1, 2, 3, 4, 5, 6, 7 | klein |
| 2 | **Navigatie die vastloopt** | 9, 10, 11, 12 | klein–middel |
| 3 | **Vaste maten in het speelscherm.** Daarna meten op 1920×960, 1440×780 en 1366×768. | 8, 19, 20, 13, 42 | middel |
| 4 | **Bots gelijktrekken met de mens.** Eerst de twee keuzes hieronder, daarna een nieuwe balansmeting. | 14, 15, 16, 17, 36, 37, 38, 39, 40 | klein |
| 5 | **Teksten en spelregels** | 26, 27, 52, 51, 53, 54, 55, 41, 25, 18, 43, 44 | klein |
| 6 | **Telefoon** | 22, 23, 24, 30, 48 | middel |
| 7 | **Speelbord en editor** | 28, 29, 32, 56, 45, 46, 47 | klein |
| 8 | **Prestatie en opruimen** | 33, 34, 57, 58 | middel |
| 9 | **Groot, later** | 35 (bot-beurt samenvoegen, voorkomt nieuwe afwijkingen), 31 (generator sneller) | groot |

**Eerst een keuze van de maker nodig:**
- nr. 15: telt een kristal op de route van Noodtransport mee?
- nr. 21: moet een gast na "Verlaat potje" in de kamer blijven?
- nr. 49: blijft de lege linkerkaart staan?
