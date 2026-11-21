# Bord, tegels, bordbouwer en beweging

> Letterlijk overgenomen uit de oude CLAUDE.md (2026-11-21). Oude bestandsnamen in deze tekst:
> `95-simulate.js` = nu `src/js/95a…95k-*.js`, `97-solo.js` = nu `src/js/97a…97h-*.js`,
> `styles.css` / `rules.css` = nu `src/css/01…27-*.css`. Zie [README.md](README.md).

## Spelregels die in de code zitten

- Beweging is **horizontaal/verticaal**, nooit diagonaal.
- Een zijde van een tegel is een **doorgang** als beide deurvakjes gevuld zijn.
  Deurvakjes: N=(0,3)(0,4), Z=(7,3)(7,4), W=(3,0)(4,0), O=(3,7)(4,7).
- Op een **hoekpositie** (A, E, P, T) mag geen doorgang het bord af wijzen. Dat kan
  alleen een tegel met precies 2 open zijden die aan elkaar grenzen (niet tegenover
  elkaar) — met de huidige tegelset zijn dat tegel 1, 5, 16 en 20. Via rotatie kan
  elk van die vier op elke hoek terechtkomen (`isCornerCapable` in `10-rules.js`).
- **7 tegels hebben alle vier de zijden open** (tegels 7, 8, 9, 10, 11, 13, 17).
  Alleen tegel **8** (Hibernatie, zie hieronder) ligt gedwongen binnenin op
  G/H/I/L/M/N — voor de rest is er bewust **geen** regel die 4-weg-tegels
  naar binnen dwingt, zie de "Niet doen"-paragraaf verderop.
- Tegel **8** (Hibernatie) bevat de vier startposities 3.1–3.4 en hoort ook binnenin.
  Als enige kamertegel heeft hij bewust **geen** opdrachtvakje — de tegel-editor
  staat dat uitzonderlijk toe (zie `tileValidationIssues` in `90-editor.js`).
- **Bordbouwer** (`70-generator.js`, herschreven 2026-11 na de analyse in artifact "Axiom-9
  Bordanalyse"). Elke naad klopt (open tegen open, dicht tegen dicht), alle 20 tegels hangen aan
  elkaar, en **elke tegel mag gedraaid worden** (vroeger alleen de hoeken). Stappen: `genSearch`
  legt met terugsporen een geldig bord binnen een budget aan **deuren die het bord af wijzen**
  (om en om 1 of 3; 0 kan niet, de tegels hebben samen 63 deuren en er passen er 62);
  `genAnneal`-lus in `constrainedShuffleAsync` wisselt daarna tegels met dezelfde deurvorm en draait
  4-weg-tegels (`genMutate`), 8 pogingen × 700 stappen, het bord met de hoogste **weegscore**
  (`genScore`) wint. De score komt uit `genEvaluate`: een voorspelling van het verkeer per tegel
  (kortste routes opdracht→opdracht 5/6 en start→opdracht 1/6, gelijk verdeeld over alle even korte
  routes) + opdrachten even ver + starts even ver + kamers niet tegen elkaar + opdrachten niet
  naast elkaar − stompjes. Zelfde seed = zelfde bord (alles op de seeded rand). Rekent gemeten
  ±3,5 s per kaart (klik tot klaar ±6 s met animatie) (gebruiker: "mag best iets langer duren").
  **Gemeten (oud: 60 borden, nieuw: 40 borden uit de tool; elk 400 potjes met de echte simulatie),
  oud → nieuw:** borden met een dode tegel (<0,5% verkeer) 35% → 0%; koudste tegel gemiddeld
  1,2% → 2,3% (slechtste bord 0,04% → 1,4%); drukste tegel 8,9% → 7,6%; deuren naar buiten
  7,3 → 2,1; vakjes waar bijna niemand komt 92 → 48 van de 564; verschil makkelijkste/moeilijkste
  opdracht 0,90 → 0,66 beurten; kamers tegen elkaar 2,4 → 2,4; potjes 75 → 75 beurten;
  startposities even eerlijk; 0 vastgelopen. Het gewicht "kamers niet tegen elkaar" staat bewust op
  1,0: bij 0,4 lagen er 3,9 kamerparen tegen elkaar (gebruikerswens: kamers spreiden).
  **De vier fouten in de oude bouwer (niet opnieuw maken):** (1) de dode-tegel-test telde elk
  vakje met een label als bron, dus ook de kristalvakjes 4.x — elke gang had er zelf één en was
  nooit "dood" (60/60 borden goedgekeurd); alleen 2.x en 3.x zijn bron/doel. (2) Tien regels strikt
  op volgorde: regel 2 was bijna nooit gelijk, dus regel 3–10 deden nooit mee — daarom nu één
  weegscore. (3) Deuren naar buiten werden niet geteld. (4) Tegels werden niet gedraaid (2.860
  i.p.v. 57.202 deurpatronen).
  **Bekende grens:** de twee hoekgangen (tegel 1 en 16) blijven de koudste tegels (±2,5% van het
  verkeer; eerlijk deel is 5%): een hoek ligt nooit op een kortste route. Alleen een opdracht op
  die twee tegels verhelpt dat (gemeten: 5,8%, maar dan liggen er vaker kamers tegen elkaar) —
  keuze van de maker, nog niet gedaan.
  De voorspelling schat te hoog bij tegels die "één van meerdere even korte routes" zijn. Gewichten
  in `genScore` veranderen? Opnieuw meten met de simulatie.
  De oude regel "4-weg-tegels niet verplicht binnenin" gold voor de oude bouwer zonder draaien; bij
  een volledig open bord (budget 1) liggen er vanzelf zes van de zeven binnenin en dat meet juist
  het gelijkmatigst.
- Spelsimulatie (`95-simulate.js`): 2×D6 = exact aantal te lopen stappen, geen
  U-turn, bezette vakjes (andere spelers) blokkeren. Land je onderweg op je
  eigen opdrachtvakje, dan loop je met de resterende stappen gewoon door — de
  beurt stopt er **niet meer** voor (vroeger wel; sinds 2026-08 vervalt de rest
  van de worp niet meer, want dat voelde als verspilde stappen). Voert de rest
  toevallig ook door de VOLGENDE opdracht, dan pak je die in dezelfde beurt
  meteen mee (zeldzaam: ±0,3% van alle opdracht-momenten). Zie `resolveMove`/
  `pickEnd`: `targets` is de rij nog te halen opdrachtvakjes vanaf het huidige
  doel, en `bankedCount` in het resultaat zegt hoeveel er deze beurt zijn
  gehaald. Elke speler heeft een eigen geschud stapeltje opdrachten 1–9
  (labels `2.1`–`2.9`); wie als eerste 6 opdrachten voltooit wint. Draait altijd
  op de indeling die op dat moment in de tool staat.
