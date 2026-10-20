// ---------- avatars (Multiplayer-lobby) ----------
// Gebruikerswens: in de kamer staan boven de chat 4 vierkante vakjes met het hoofd van een
// ruimtepoppetje per speler; rechts een editor met twee tabbladen: Karakter (5 stuks) en
// Accessoires (5 brillen + 5 hoedjes, pas te kiezen als je een karakter hebt). Een gekozen item
// staat meteen op je avatar. Alles is platte SVG in een vak van 100×100 (geen verlopen/ids, zodat
// tientallen kopieën op één pagina elkaar nooit storen). Alle hoofden hebben de ogen op dezelfde
// plek (40,54) en (60,54) en de bovenkant van het hoofd rond y=26, zodat elke bril en elk hoedje
// op elk karakter past.
//
// Een avatar is { c, e, g, h }: index in AVATAR_CHARS, AVATAR_FACES (gezicht, standaard 0),
// AVATAR_GLASSES (-1 = geen) en AVATAR_HATS (-1 = geen). Gaat mee in de lobby-zitplaatsen (mp.seats[i].avatar, zie 99-multiplayer.js) en
// wordt per browser onthouden (localStorage, alleen voor het gemak).

function avatarStarPts(cx, cy, R, r){
  const pts = [];
  for (let i = 0; i < 10; i++){
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// kraag van het ruimtepak onder elk hoofd (kleur per karakter)
const avatarCollar = (suit, stripe, neck) =>
  `<rect x="43" y="74" width="14" height="12" fill="${neck}"/>` +
  `<path d="M24 100 Q24 83 50 83 Q76 83 76 100 Z" fill="${suit}"/>` +
  `<path d="M27 95 Q50 85 73 95" stroke="${stripe}" stroke-width="3" fill="none"/>`;

// 12 karakters (gebruikerswens 2026-10: eerst 5, toen 10, toen 12 — rijen van 4 in de editor) — elk alleen het HOOFD, zonder mond en
// wenkbrauwen; die komen uit het gekozen gezicht (AVATAR_FACES hieronder), in de kleuren van het
// karakter: mc = mondlijn, md = open mond, bc = wenkbrauwen. De eerste 5 staan op dezelfde plek
// als vroeger, dus eerder gekozen avatars ({c,g,h} zonder gezicht) blijven gewoon werken (gezicht 0).
const AVATAR_CHARS = [
  { name: 'Kadet', mc: '#8a4a3a', md: '#7a2f25', bc: '#5a3825', svg:
    avatarCollar('#dfe6ee', '#ff8a3d', '#e2b48c') +
    `<ellipse cx="27" cy="56" rx="4" ry="6" fill="#e9b98f"/><ellipse cx="73" cy="56" rx="4" ry="6" fill="#e9b98f"/>` +
    `<ellipse cx="50" cy="54" rx="23" ry="26" fill="#f1c7a0"/>` +
    `<path d="M27 50 Q25 26 50 26 Q75 26 73 50 Q70 36 58 34 Q50 40 40 35 Q30 38 27 50Z" fill="#5a3825"/>` +
    `<ellipse cx="40" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/><ellipse cx="60" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/>` +
    `<circle cx="41" cy="52.8" r="1" fill="#fff"/><circle cx="61" cy="52.8" r="1" fill="#fff"/>` +
    `<circle cx="34" cy="63" r="3" fill="#f39a8a" opacity=".45"/><circle cx="66" cy="63" r="3" fill="#f39a8a" opacity=".45"/>` },
  { name: 'Zorp', mc: '#2f6b25', md: '#1f4a18', bc: '#3f8f30', svg:
    avatarCollar('#6c5ce7', '#a29bfe', '#79cc5f') +
    `<path d="M50 23 C73 23 80 37 78 50 C76 66 62 82 50 82 C38 82 24 66 22 50 C20 37 27 23 50 23Z" fill="#8be06f"/>` +
    `<circle cx="36" cy="34" r="2.5" fill="#6fc55a"/><circle cx="62" cy="31" r="3.5" fill="#6fc55a"/><circle cx="68" cy="40" r="2" fill="#6fc55a"/>` +
    `<ellipse cx="39" cy="54" rx="8" ry="5.5" transform="rotate(25 39 54)" fill="#111"/>` +
    `<ellipse cx="61" cy="54" rx="8" ry="5.5" transform="rotate(-25 61 54)" fill="#111"/>` +
    `<circle cx="37" cy="52" r="1.6" fill="#fff"/><circle cx="59" cy="52" r="1.6" fill="#fff"/>` +
    `<circle cx="48" cy="64" r=".9" fill="#2f6b25"/><circle cx="52" cy="64" r=".9" fill="#2f6b25"/>` },
  { name: 'B-0T', mc: '#4ff0ff', md: '#0d2a33', bc: '#4ff0ff', svg:
    avatarCollar('#4b5563', '#4ff0ff', '#7d8a98') +
    `<rect x="21" y="46" width="7" height="16" rx="2" fill="#6b7785"/><rect x="72" y="46" width="7" height="16" rx="2" fill="#6b7785"/>` +
    `<rect x="27" y="27" width="46" height="52" rx="9" fill="#a9b6c4"/>` +
    `<rect x="31" y="30" width="38" height="5" rx="2.5" fill="#c8d3de"/>` +
    `<circle cx="32" cy="74" r="1.6" fill="#7d8a98"/><circle cx="68" cy="74" r="1.6" fill="#7d8a98"/>` +
    `<rect x="38" y="63" width="24" height="12" rx="3" fill="#3b4652"/>` +
    `<circle cx="40" cy="54" r="6.5" fill="#0d2a33"/><circle cx="60" cy="54" r="6.5" fill="#0d2a33"/>` +
    `<circle cx="40" cy="54" r="3.8" fill="#4ff0ff"/><circle cx="60" cy="54" r="3.8" fill="#4ff0ff"/>` },
  { name: 'Nebula', mc: '#4a3fb0', md: '#2d257a', bc: '#e8f1ff', svg:
    avatarCollar('#1f2a44', '#ffd166', '#7a70e0') +
    `<path d="M29 52 L13 38 L22 64 Z" fill="#6f66d8"/><path d="M71 52 L87 38 L78 64 Z" fill="#6f66d8"/>` +
    `<ellipse cx="50" cy="54" rx="22" ry="26" fill="#8f86f5"/>` +
    `<path d="M29 46 Q32 25 52 26 Q71 27 72 46 Q62 34 50 37 Q39 33 29 46Z" fill="#e8f1ff"/>` +
    `<path d="M50 38 L53.5 42.5 L50 47 L46.5 42.5Z" fill="#ffd166"/>` +
    `<ellipse cx="40" cy="54" rx="4.4" ry="3.6" fill="#ffe066"/><ellipse cx="60" cy="54" rx="4.4" ry="3.6" fill="#ffe066"/>` +
    `<rect x="39.4" y="51" width="1.3" height="6" rx=".6" fill="#222"/><rect x="59.4" y="51" width="1.3" height="6" rx=".6" fill="#222"/>` },
  { name: 'Cyborg', mc: '#7a4a35', md: '#5a2a1a', bc: '#2b2b2b', svg:
    avatarCollar('#2b2f36', '#ff3b3b', '#b97f5a') +
    `<ellipse cx="27" cy="56" rx="4" ry="6" fill="#b97f5a"/>` +
    `<ellipse cx="50" cy="54" rx="23" ry="26" fill="#c98e66"/>` +
    `<path d="M27.5 47 Q27 27 50 27 Q73 27 72.5 47 Q60 38 50 38 Q40 38 27.5 47Z" fill="#2b2b2b"/>` +
    `<path d="M51 30 Q72 31 73 54 Q72 75 52 80 Z" fill="#8e9aa8"/>` +
    `<rect x="73" y="50" width="5" height="12" rx="1.5" fill="#6b7785"/>` +
    `<circle cx="66" cy="40" r="1.3" fill="#5d6875"/><circle cx="68" cy="68" r="1.3" fill="#5d6875"/><circle cx="56" cy="75" r="1.3" fill="#5d6875"/>` +
    `<circle cx="60" cy="54" r="6" fill="#3a3f47"/><circle cx="60" cy="54" r="3.6" fill="#ff3b3b"/><circle cx="60" cy="54" r="1.4" fill="#ffd0d0"/>` +
    `<ellipse cx="40" cy="54" rx="3" ry="3.4" fill="#2a1f1a"/><circle cx="41" cy="52.8" r="1" fill="#fff"/>` },
  // ---- 5 nieuwe ----
  { name: 'Luna', mc: '#5a2a1c', md: '#3d160c', bc: '#2b1a12', svg:
    avatarCollar('#e7ecf3', '#5ad1ff', '#7a4a2e') +
    `<circle cx="29" cy="30" r="9" fill="#2b1a12"/><circle cx="71" cy="30" r="9" fill="#2b1a12"/>` +
    `<circle cx="29" cy="30" r="3" fill="#5ad1ff"/><circle cx="71" cy="30" r="3" fill="#5ad1ff"/>` +
    `<ellipse cx="27" cy="57" rx="4" ry="6" fill="#7d4f33"/><ellipse cx="73" cy="57" rx="4" ry="6" fill="#7d4f33"/>` +
    `<ellipse cx="50" cy="55" rx="23" ry="26" fill="#8d5a3b"/>` +
    `<path d="M27 50 Q26 27 50 27 Q74 27 73 50 Q66 35 50 37 Q34 35 27 50Z" fill="#2b1a12"/>` +
    `<ellipse cx="40" cy="54" rx="3.2" ry="3.8" fill="#1a1210"/><ellipse cx="60" cy="54" rx="3.2" ry="3.8" fill="#1a1210"/>` +
    `<circle cx="41" cy="52.6" r="1.1" fill="#fff"/><circle cx="61" cy="52.6" r="1.1" fill="#fff"/>` +
    `<circle cx="33" cy="63" r="1" fill="#d99a72"/><circle cx="36" cy="65" r="1" fill="#d99a72"/><circle cx="67" cy="63" r="1" fill="#d99a72"/><circle cx="64" cy="65" r="1" fill="#d99a72"/>` },
  { name: 'Krak', mc: '#7a1f48', md: '#5a0f30', bc: '#b83a72', svg:
    avatarCollar('#1e3a5f', '#ff6fae', '#d9578f') +
    `<path d="M33 74 Q24 82 30 90 M43 78 Q38 88 44 94 M57 78 Q62 88 56 94 M67 74 Q76 82 70 90" stroke="#f0679f" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path d="M50 22 C74 22 80 40 78 56 C77 70 66 80 50 80 C34 80 23 70 22 56 C20 40 26 22 50 22Z" fill="#f0679f"/>` +
    `<circle cx="34" cy="38" r="3" fill="#d9578f"/><circle cx="64" cy="32" r="4" fill="#d9578f"/><circle cx="70" cy="45" r="2.2" fill="#d9578f"/><circle cx="28" cy="52" r="2" fill="#d9578f"/>` +
    `<circle cx="40" cy="54" r="6.2" fill="#fff"/><circle cx="60" cy="54" r="6.2" fill="#fff"/>` +
    `<circle cx="41" cy="55" r="3.4" fill="#2a0f1f"/><circle cx="61" cy="55" r="3.4" fill="#2a0f1f"/>` +
    `<circle cx="42" cy="53.6" r="1.1" fill="#fff"/><circle cx="62" cy="53.6" r="1.1" fill="#fff"/>` },
  { name: 'Pixel', mc: '#e9ffff', md: '#0f4a57', bc: '#e9ffff', svg:
    avatarCollar('#0f2733', '#4ff0ff', '#2a8ca0') +
    `<rect x="27" y="28" width="46" height="50" rx="4" fill="#4ff0ff" fill-opacity=".32" stroke="#4ff0ff" stroke-width="2"/>` +
    `<path d="M29 36 H71 M29 44 H71 M29 52 H71 M29 60 H71 M29 68 H71" stroke="#4ff0ff" stroke-opacity=".22" stroke-width="1.5"/>` +
    `<rect x="31" y="31" width="8" height="3" fill="#e9ffff" fill-opacity=".6"/>` +
    `<rect x="36.5" y="50.5" width="7" height="7" fill="#e9ffff"/><rect x="56.5" y="50.5" width="7" height="7" fill="#e9ffff"/>` },
  { name: 'Comet', mc: '#7a3a12', md: '#5a2408', bc: '#c46a22', svg:
    avatarCollar('#33415c', '#ffb545', '#e08a3c') +
    `<path d="M27 42 L29 17 L46 32Z" fill="#f0953f"/><path d="M73 42 L71 17 L54 32Z" fill="#f0953f"/>` +
    `<path d="M31 37 L32 24 L41 32Z" fill="#ffd0a8"/><path d="M69 37 L68 24 L59 32Z" fill="#ffd0a8"/>` +
    `<ellipse cx="50" cy="55" rx="25" ry="25" fill="#f5a04a"/>` +
    `<path d="M45 31 L47 40 M50 30 L50 40 M55 31 L53 40" stroke="#d9782a" stroke-width="2.4" stroke-linecap="round"/>` +
    `<ellipse cx="50" cy="66" rx="11" ry="7.5" fill="#ffe3c4"/>` +
    `<path d="M47 61.5 L53 61.5 L50 64.5Z" fill="#e0607a"/>` +
    `<path d="M38 64 L26 62 M38 67 L26 69 M62 64 L74 62 M62 67 L74 69" stroke="#fff" stroke-opacity=".8" stroke-width="1.1"/>` +
    `<ellipse cx="40" cy="54" rx="4" ry="4.5" fill="#7fd04a"/><ellipse cx="60" cy="54" rx="4" ry="4.5" fill="#7fd04a"/>` +
    `<ellipse cx="40" cy="54" rx="1.3" ry="3.6" fill="#1a1a1a"/><ellipse cx="60" cy="54" rx="1.3" ry="3.6" fill="#1a1a1a"/>` },
  { name: 'Rots', mc: '#3a342c', md: '#26211b', bc: '#4a4236', svg:
    avatarCollar('#4a4036', '#9be15d', '#6d6458') +
    `<path d="M30 30 L48 24 L68 28 L77 46 L75 68 L62 81 L40 81 L25 68 L23 46Z" fill="#8a8378"/>` +
    `<path d="M30 30 L48 24 L68 28 L60 33 L44 31Z" fill="#9c958a"/>` +
    `<path d="M66 36 L70 44 L66 50 M31 62 L36 66 L33 72 M52 76 L55 80" stroke="#6d6458" stroke-width="1.6" fill="none"/>` +
    `<path d="M38 27 Q47 19 58 26 Q50 29 38 27Z" fill="#7cc552"/><circle cx="62" cy="27" r="2.4" fill="#7cc552"/>` +
    `<circle cx="40" cy="54" r="4.6" fill="#2d2a26"/><circle cx="60" cy="54" r="4.6" fill="#2d2a26"/>` +
    `<circle cx="40" cy="54" r="2.6" fill="#9be15d"/><circle cx="60" cy="54" r="2.6" fill="#9be15d"/>` },
  { name: 'Kristal', mc: '#4a1f7a', md: '#3a1060', bc: '#efe0ff', svg:
    avatarCollar('#2a1f4a', '#d9b3ff', '#9b6ee8') +
    `<path d="M50 22 L72 34 L77 58 L62 80 L38 80 L23 58 L28 34Z" fill="#b57bef"/>` +
    `<path d="M50 22 L72 34 L50 43 L28 34Z" fill="#dcc0ff" fill-opacity=".75"/>` +
    `<path d="M23 58 L38 80 L45 64Z" fill="#8a4fd6"/><path d="M77 58 L62 80 L55 64Z" fill="#9a62e0"/>` +
    `<path d="M28 34 L23 58 L34 50Z" fill="#c99bf5"/>` +
    `<circle cx="40" cy="54" r="6.5" fill="#fff" fill-opacity=".22"/><circle cx="60" cy="54" r="6.5" fill="#fff" fill-opacity=".22"/>` +
    `<path d="M40 50 L43.5 54 L40 58 L36.5 54Z" fill="#fff"/><path d="M60 50 L63.5 54 L60 58 L56.5 54Z" fill="#fff"/>` },
  { name: 'Baard', mc: '#6a2a14', md: '#4a1608', bc: '#a8441f', svg:
    avatarCollar('#3b5a7a', '#ffd23f', '#e2b48c') +
    `<ellipse cx="27" cy="56" rx="4" ry="6" fill="#e9b98f"/><ellipse cx="73" cy="56" rx="4" ry="6" fill="#e9b98f"/>` +
    `<ellipse cx="50" cy="54" rx="23" ry="26" fill="#f1c7a0"/>` +
    `<path d="M27 49 Q26 26 50 26 Q74 26 73 49 Q68 34 50 34 Q32 34 27 49Z" fill="#c4552a"/>` +
    `<path d="M27 58 Q28 85 50 87 Q72 85 73 58 Q67 75 50 75 Q33 75 27 58Z" fill="#c4552a"/>` +
    `<path d="M40 64 Q50 59.5 60 64 Q50 66 40 64Z" fill="#a8441f"/>` +
    `<ellipse cx="40" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/><ellipse cx="60" cy="54" rx="3" ry="3.6" fill="#2a1f1a"/>` +
    `<circle cx="41" cy="52.8" r="1" fill="#fff"/><circle cx="61" cy="52.8" r="1" fill="#fff"/>` },
];
// 8 gezichtsuitdrukkingen (gebruikerswens): wenkbrauwen + mond, passen op elk karakter
const avatarBrows = (c, d) => `<path d="${d}" stroke="${c.bc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
const avatarLine = (c, d) => `<path d="${d}" stroke="${c.mc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
const AVATAR_FACES = [
  { name: 'Blij', svg: c => avatarBrows(c, 'M35 47 Q40 45 44 47 M56 47 Q60 45 65 47') + avatarLine(c, 'M43 67 Q50 73 57 67') },
  { name: 'Lachen', svg: c => avatarBrows(c, 'M35 46 Q40 43.5 44 46 M56 46 Q60 43.5 65 46') +
      `<path d="M41 65 Q50 79 59 65 Z" fill="${c.md}"/><path d="M45.5 72.5 Q50 75 54.5 72.5" stroke="#ff8fa0" stroke-width="2.6" fill="none" stroke-linecap="round"/>` },
  { name: 'Verbaasd', svg: c => avatarBrows(c, 'M34 44 Q40 40 45 43 M55 43 Q60 40 66 44') + `<ellipse cx="50" cy="69" rx="3.6" ry="4.6" fill="${c.md}"/>` },
  { name: 'Stoer', svg: c => avatarBrows(c, 'M35 46 L44 47.5 M56 47.5 L65 45') + avatarLine(c, 'M44 69 Q52 71 57 66') },
  { name: 'Boos', svg: c => avatarBrows(c, 'M34 44 L45 48 M66 44 L55 48') + avatarLine(c, 'M44 71 Q50 66 56 71') },
  { name: 'Tong uit', svg: c => avatarBrows(c, 'M35 47 Q40 45 44 47 M56 47 Q60 45 65 47') +
      `<path d="M49 69 Q49 77 53.5 77 Q58 77 57 69Z" fill="#ff7a8f" stroke="${c.md}" stroke-width="1"/>` + avatarLine(c, 'M43 67 Q50 71.5 58 67') },
  { name: 'Grijns', svg: c => avatarBrows(c, 'M35 46 Q40 44 44 46 M56 46 Q60 44 65 46') +
      `<path d="M40 65 Q50 77 60 65 Z" fill="${c.md}"/><path d="M41.5 65.6 L58.5 65.6 L57 69 L43 69Z" fill="#fff"/>` +
      `<path d="M46 65.6 V69 M50 65.6 V69 M54 65.6 V69" stroke="${c.md}" stroke-width=".8"/>` },
  { name: 'Verdrietig', svg: c => avatarBrows(c, 'M35 45 L44 42.5 M56 42.5 L65 45') + avatarLine(c, 'M44 71.5 Q50 66.5 56 71.5') +
      `<path d="M37 59 Q35.5 62 37 63.5 Q38.5 62 37 59Z" fill="#7fd6ff"/>` },
];

// box = uitsnede (viewBox) waarmee het item los als plaatje in de editor staat
const AVATAR_GLASSES = [
  { name: 'Vizier', box: '22 40 56 28', svg:
    `<rect x="26" y="46" width="48" height="15" rx="7.5" fill="#4ff0ff" fill-opacity=".55" stroke="#1d8fa8" stroke-width="2"/>` +
    `<path d="M31 50 L45 50" stroke="#fff" stroke-opacity=".85" stroke-width="2" stroke-linecap="round"/>` },
  { name: 'Pilotenbril', box: '22 40 56 28', svg:
    `<path d="M23 54 L31 54 M69 54 L77 54" stroke="#5a3a22" stroke-width="4"/>` +
    `<circle cx="40" cy="54" r="8.5" fill="#7fd6ff" fill-opacity=".45" stroke="#c9963a" stroke-width="3"/>` +
    `<circle cx="60" cy="54" r="8.5" fill="#7fd6ff" fill-opacity=".45" stroke="#c9963a" stroke-width="3"/>` +
    `<path d="M48 53 Q50 50.5 52 53" stroke="#c9963a" stroke-width="2.5" fill="none"/>` +
    `<path d="M36 50 L39 48 M56 50 L59 48" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` },
  { name: 'Sterrenbril', box: '22 40 56 28', svg:
    `<path d="M29 52 L25 50 M71 52 L75 50" stroke="#ff5fd2" stroke-width="2" stroke-linecap="round"/>` +
    `<polygon points="${avatarStarPts(40, 54.5, 11, 5)}" fill="#ff5fd2" fill-opacity=".85" stroke="#ffe1f6" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<polygon points="${avatarStarPts(60, 54.5, 11, 5)}" fill="#ff5fd2" fill-opacity=".85" stroke="#ffe1f6" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<path d="M47 53 Q50 51 53 53" stroke="#ffe1f6" stroke-width="1.6" fill="none"/>` },
  { name: 'Scanner', box: '22 34 62 34', svg:
    `<path d="M68 53 L77 51 L82 40" stroke="#d8dee6" stroke-width="2.2" fill="none" stroke-linejoin="round"/>` +
    `<circle cx="82" cy="38.5" r="2.4" fill="#ff3355"/>` +
    `<circle cx="60" cy="54" r="8.5" fill="#ff3355" fill-opacity=".55" stroke="#d8dee6" stroke-width="2.6"/>` +
    `<path d="M60 48 V60 M54 54 H66" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>` },
  { name: 'Neonbril', box: '22 40 56 28', svg:
    `<path d="M26 51 L28 49 M74 51 L72 49" stroke="#39ff88" stroke-width="2"/>` +
    `<path d="M28 49 L48 49 L46 60 L31 60 Z" fill="#111" stroke="#39ff88" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M52 49 L72 49 L69 60 L54 60 Z" fill="#111" stroke="#39ff88" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M48 51 L52 51" stroke="#39ff88" stroke-width="2"/>` +
    `<path d="M32 52 L38 52" stroke="#39ff88" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>` },
  { name: 'Monocle', box: '22 40 60 38', svg:
    `<circle cx="60" cy="54" r="8.5" fill="#cfefff" fill-opacity=".3" stroke="#d4a63a" stroke-width="2.6"/>` +
    `<path d="M56 50 L59 48" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M67 59 Q76 66 72 76" stroke="#d4a63a" stroke-width="1.4" fill="none" stroke-dasharray="2 1.5"/>` },
  { name: 'Ooglap', box: '22 34 58 32', svg:
    `<path d="M25 47 L75 39" stroke="#8a95a3" stroke-width="3.6"/><path d="M25 47 L75 39" stroke="#1a1a1a" stroke-width="2"/>` +
    `<ellipse cx="40" cy="54" rx="8.5" ry="7.5" fill="#1a1a1a" stroke="#8a95a3" stroke-width="1.4"/>` +
    `<path d="M36 52 L43 52" stroke="#444" stroke-width="1.2" stroke-linecap="round"/>` },
  { name: '3D-bril', box: '22 40 56 28', svg:
    `<path d="M24 52 L28 51 M72 51 L76 52" stroke="#f2f2f2" stroke-width="2.4"/>` +
    `<rect x="28" y="47" width="20" height="14" rx="2" fill="#ff3b5c" fill-opacity=".75" stroke="#f2f2f2" stroke-width="2.4"/>` +
    `<rect x="52" y="47" width="20" height="14" rx="2" fill="#3bd8ff" fill-opacity=".75" stroke="#f2f2f2" stroke-width="2.4"/>` +
    `<path d="M48 52 L52 52" stroke="#f2f2f2" stroke-width="2.4"/>` },
];

const AVATAR_HATS = [
  { name: 'Ruimtehelm', box: '0 0 100 100', svg:
    `<circle cx="50" cy="55" r="40" fill="#bfefff" fill-opacity=".13" stroke="#cfefff" stroke-width="2.5"/>` +
    `<path d="M24 34 Q32 21 45 17" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none" stroke-opacity=".75"/>` +
    `<path d="M72 82 Q78 76 81 69" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" stroke-opacity=".4"/>` +
    `<rect x="22" y="87" width="56" height="9" rx="4" fill="#9aa7b5" stroke="#6b7785" stroke-width="1.5"/>` },
  { name: 'Antennes', box: '18 2 64 44', svg:
    `<path d="M37 31 Q32 18 29 10 M63 31 Q68 18 71 10" stroke="#444c58" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="29" cy="9" r="4.2" fill="#7dff6a" stroke="#3fae36" stroke-width="1.2"/>` +
    `<circle cx="71" cy="9" r="4.2" fill="#7dff6a" stroke="#3fae36" stroke-width="1.2"/>` +
    `<path d="M27 41 Q50 22 73 41" stroke="#444c58" stroke-width="5" fill="none" stroke-linecap="round"/>` },
  { name: 'Kapiteinspet', box: '20 10 60 40', svg:
    `<path d="M26 38 Q26 17 50 17 Q74 17 74 38 Z" fill="#1f3a6b"/>` +
    `<rect x="25" y="34" width="50" height="6" rx="2" fill="#d4a63a"/>` +
    `<path d="M29 40 Q50 50 71 40 Q50 45 29 40Z" fill="#11213f"/>` +
    `<polygon points="${avatarStarPts(50, 26.5, 6.5, 2.8)}" fill="#ffd23f"/>` },
  { name: 'Mini-UFO', box: '26 0 48 38', svg:
    `<path d="M42 21 L35 34 L65 34 L58 21Z" fill="#9dff8a" fill-opacity=".28"/>` +
    `<path d="M41 17 Q50 3 59 17Z" fill="#9fe6ff" fill-opacity=".85" stroke="#cfefff" stroke-width="1"/>` +
    `<ellipse cx="50" cy="18" rx="17" ry="5" fill="#8e9aa8" stroke="#5d6875" stroke-width="1.5"/>` +
    `<circle cx="39" cy="18.5" r="1.4" fill="#ffd23f"/><circle cx="46" cy="19.5" r="1.4" fill="#ffd23f"/>` +
    `<circle cx="54" cy="19.5" r="1.4" fill="#ffd23f"/><circle cx="61" cy="18.5" r="1.4" fill="#ffd23f"/>` },
  { name: 'Saturnus', box: '26 2 48 34', svg:
    `<circle cx="50" cy="18" r="10" fill="#f0a35e"/>` +
    `<path d="M41 15 Q50 18 59 15 M41.5 21 Q50 23.5 58.5 21" stroke="#d9823f" stroke-width="1.8" fill="none"/>` +
    `<ellipse cx="50" cy="19" rx="20" ry="5" fill="none" stroke="#ffe2a8" stroke-width="2.6" transform="rotate(-12 50 19)"/>` },
  { name: 'Koptelefoon', box: '14 12 72 56', svg:
    `<path d="M24 54 Q23 18 50 18 Q77 18 76 54" stroke="#2f343c" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<rect x="17" y="45" width="11" height="19" rx="5" fill="#ff5fd2" stroke="#2f343c" stroke-width="2"/>` +
    `<rect x="72" y="45" width="11" height="19" rx="5" fill="#ff5fd2" stroke="#2f343c" stroke-width="2"/>` },
  { name: 'Kroon', box: '26 6 48 30', svg:
    `<path d="M32 31 L31 15 L41 23 L50 10 L59 23 L69 15 L68 31Z" fill="#ffd23f" stroke="#c99a1e" stroke-width="1.4" stroke-linejoin="round"/>` +
    `<circle cx="41" cy="27" r="2" fill="#ff3b5c"/><circle cx="50" cy="26" r="2.4" fill="#3bd8ff"/><circle cx="59" cy="27" r="2" fill="#39ff88"/>` },
  { name: 'Pet', box: '22 12 66 30', svg:
    `<path d="M27 37 Q26 18 50 18 Q74 18 73 37Z" fill="#e8463c"/>` +
    `<path d="M50 18 L50 37" stroke="#c4352d" stroke-width="1.4"/><circle cx="50" cy="18.5" r="2" fill="#c4352d"/>` +
    `<path d="M62 33 L86 35 Q87 40 74 40 L62 38Z" fill="#b8322a"/>` },
];

function avatarClean(av){
  if (!av || typeof av !== 'object') return null;
  const ok = (v, list, allowNone) => Number.isInteger(v) && v >= (allowNone ? -1 : 0) && v < list.length;
  if (!ok(av.c, AVATAR_CHARS, false)) return null;
  return { c: av.c, e: ok(av.e, AVATAR_FACES, false) ? av.e : 0,
    g: ok(av.g, AVATAR_GLASSES, true) ? av.g : -1, h: ok(av.h, AVATAR_HATS, true) ? av.h : -1 };
}
function avatarSvg(av){
  av = avatarClean(av);
  if (!av) return '';
  return `<svg class="av-svg" viewBox="0 0 100 100" aria-hidden="true">` +
    AVATAR_CHARS[av.c].svg + AVATAR_FACES[av.e].svg(AVATAR_CHARS[av.c]) +
    (av.g >= 0 ? AVATAR_GLASSES[av.g].svg : '') +
    (av.h >= 0 ? AVATAR_HATS[av.h].svg : '') +
  `</svg>`;
}
function avatarItemSvg(item){
  return `<svg class="av-svg" viewBox="${item.box || '0 0 100 100'}" aria-hidden="true">${item.svg}</svg>`;
}

// ---------- mijn avatar (per browser onthouden) ----------
const AVATAR_STORE_KEY = 'axiom9-avatar';
let avatarMine = null;
try { avatarMine = avatarClean(JSON.parse(localStorage.getItem(AVATAR_STORE_KEY) || 'null')); } catch (e){ avatarMine = null; }
let avatarTab = 'char';
function avatarSetMine(av){
  avatarMine = avatarClean(av);
  try { localStorage.setItem(AVATAR_STORE_KEY, JSON.stringify(avatarMine)); } catch (e){}
  avatarRenderEditor();
  // 99-multiplayer.js: naar de host/iedereen in de kamer
  if (typeof mpOnMyAvatarChanged === 'function') mpOnMyAvatarChanged();
}

// ---------- de editor (linkerkolom in de kamer, gekozen ontwerp "De brug") ----------
// Eén raster van 4 vaste kolommen voor ALLE keuzes (gebruikerswens: "alle selecteerbare opties op
// dezelfde lijn"): tab Karakter = groep Karakter (12) + groep Gezicht (8, ingezoomd op het gezicht
// van je eigen karakter); tab Accessoires = groep Bril (8) + groep Hoedje (8). Elke groep heeft
// een kopje met rechts wat je nu gekozen hebt. Geen voorvertoning: je ziet jezelf al op de brug.
function avatarRenderEditor(){
  const tabsEl = document.getElementById('mpAvatarTabs');
  const gridEl = document.getElementById('mpAvatarGrid');
  if (!tabsEl || !gridEl) return;
  const hasChar = !!avatarMine;
  if (!hasChar) avatarTab = 'char';
  for (const b of tabsEl.querySelectorAll('[data-av-tab]')){
    b.classList.toggle('active', b.dataset.avTab === avatarTab);
    if (b.dataset.avTab === 'items'){
      b.classList.toggle('is-locked', !hasChar);
      b.title = hasChar ? '' : 'Kies eerst een karakter';
    }
  }
  const btn = (kind, i, item, on, svg) =>
    `<button type="button" class="av-pick${on ? ' is-on' : ''}" data-av-kind="${kind}" data-av-i="${i}"` +
    ` title="${item.name}" aria-label="${item.name}" aria-pressed="${on}">${svg}</button>`;
  const head = (title, picked) => `<span class="av-sub">${title}<em>${picked}</em></span>`;
  const face = hasChar ? avatarMine.e : 0;
  let html;
  if (avatarTab === 'char'){
    html = head('Karakter', hasChar ? AVATAR_CHARS[avatarMine.c].name : 'kies er een') +
      AVATAR_CHARS.map((ch, i) => btn('c', i, ch, hasChar && avatarMine.c === i, avatarSvg({ c: i, e: face, g: -1, h: -1 }))).join('');
    if (hasChar){
      html += head('Gezicht', AVATAR_FACES[face].name) + AVATAR_FACES.map((f, i) =>
        btn('e', i, f, face === i, avatarSvg({ c: avatarMine.c, e: i, g: -1, h: -1 }).replace('viewBox="0 0 100 100"', 'viewBox="22 34 56 46"'))).join('');
    }
  } else {
    html = head('Bril', avatarMine.g >= 0 ? AVATAR_GLASSES[avatarMine.g].name : 'geen') +
      AVATAR_GLASSES.map((g, i) => btn('g', i, g, avatarMine.g === i, avatarItemSvg(g))).join('') +
      head('Hoedje', avatarMine.h >= 0 ? AVATAR_HATS[avatarMine.h].name : 'geen') +
      AVATAR_HATS.map((h, i) => btn('h', i, h, avatarMine.h === i, avatarItemSvg(h))).join('');
  }
  gridEl.className = 'av-grid';
  gridEl.innerHTML = html;
}
{
  const tabsEl = document.getElementById('mpAvatarTabs');
  const gridEl = document.getElementById('mpAvatarGrid');
  if (tabsEl) tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-av-tab]');
    if (!b) return;
    if (b.dataset.avTab === 'items' && !avatarMine){
      // even laten zien waarom het niet kan: de karakters lichten op
      if (gridEl){ gridEl.classList.remove('av-nudge'); void gridEl.offsetWidth; gridEl.classList.add('av-nudge'); }
      return;
    }
    avatarTab = b.dataset.avTab;
    avatarRenderEditor();
  });
  if (gridEl) gridEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-av-kind]');
    if (!b) return;
    const i = parseInt(b.dataset.avI, 10);
    const kind = b.dataset.avKind;
    if (kind === 'c'){
      // ander karakter: gezicht, bril en hoedje blijven gewoon zoals ze waren
      avatarSetMine({ c: i, e: avatarMine ? avatarMine.e : 0, g: avatarMine ? avatarMine.g : -1, h: avatarMine ? avatarMine.h : -1 });
    } else if (kind === 'e' && avatarMine){
      avatarSetMine({ ...avatarMine, e: i });
    } else if (avatarMine){
      // nog eens klikken op wat je al op hebt = weer af
      const next = { ...avatarMine };
      next[kind] = next[kind] === i ? -1 : i;
      avatarSetMine(next);
    }
  });
  avatarRenderEditor();
}

// ---------- de 4 vakjes boven de chat ----------
// seats = mp.seats (naam, peerId, avatar); altijd 4 vakjes, plekken voorbij het spelersaantal
// van de kamer blijven leeg en gedimd
function avatarRowHtml(seats, total, myPeerId){
  let html = '';
  for (let i = 0; i < 4; i++){
    const seat = seats[i];
    const color = WALK_PLAYER_COLORS[i % WALK_PLAYER_COLORS.length];
    if (!seat){
      html += `<div class="mp-avatar is-empty${i >= total ? ' is-unused' : ''}" style="--pc:${color}"></div>`;
      continue;
    }
    const svg = avatarSvg(seat.avatar);
    const you = seat.peerId === myPeerId;
    html += `<div class="mp-avatar${you ? ' is-you' : ''}" style="--pc:${color}">` +
      (svg || `<span class="mp-avatar-none">${you ? 'Kies rechts<br>een karakter' : 'Nog geen<br>avatar'}</span>`) +
      `<span class="mp-avatar-name">${mpEscapeHtml(seat.name)}</span></div>`;
  }
  return html;
}
