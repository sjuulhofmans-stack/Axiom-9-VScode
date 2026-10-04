#!/usr/bin/env python3
"""
Bouwt de losse bronbestanden samen tot EEN zelfstandig HTML-bestand.

    python3 build.py

Resultaat: dist/axiom9.html  (werkt offline, kan gemaild/gedeeld worden — behalve het
tabblad "Multiplayer": dat laadt Trystero pas runtime vanaf een CDN en heeft dus internet
nodig zodra je het daadwerkelijk gebruikt, de rest van de tool blijft 100% lokaal)

Waarom een build-stap?
  Het logo is ~800 KB base64. Zolang dat in hetzelfde bestand zit als de code,
  moet dat hele blok meeverhuizen bij elke wijziging. Nu staat het apart in
  src/assets/logo.b64 en wordt het alleen bij het bouwen ingevoegd.
"""

import base64
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

# Volgorde is belangrijk: 00 eerst (data), daarna regels, dan UI.
JS_ORDER = [
    "00-data.js",
    "05-card-art.js",
    "06-chants.js",
    "10-rules.js",
    "20-connectivity.js",
    "30-random.js",
    "40-board.js",
    "50-interaction.js",
    "60-palette.js",
    "70-generator.js",
    "80-controls.js",
    "90-editor.js",
    "95-simulate.js",
    "96-walk.js",
    "96b-intro.js",
    "97-solo.js",
    "98-cards.js",
    "98b-avatar.js",
    "99-multiplayer.js",
]


def read(path: pathlib.Path) -> str:
    if not path.exists():
        sys.exit(f"FOUT: ontbrekend bestand {path}")
    return path.read_text(encoding="utf-8")


def read_optional_b64(path: pathlib.Path) -> str:
    """Zelfde tolerantie als build_chants() hieronder: dit is decoratie voor een easter egg,
    geen spelregel — ontbreekt het bestand, dan bouwt de tool gewoon door en blijft de
    bijbehorende afbeelding/geluid leeg (de easter egg doet dan simpelweg niets, i.p.v. dat de
    hele build breekt zoals bij tiles.json/logo.b64 wél hoort)."""
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


CHANT_MIME = {".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav"}


def build_chants() -> dict:
    """src/assets/chants/<naam>.<mp3|ogg|wav> -> {naam: data-URI}. Puur numerieke bestandsnamen
    (1.mp3, 2.mp3, ...) zijn de originele Age of Empires-taunts (getal intypen in de chat = die
    taunt afspelen, zie mpSendChatMessage in 99-multiplayer.js); een naam zoals paintracer.ogg is
    een los easter-eggetje dat via playChant('paintracer') wordt opgezocht i.p.v. via een getal —
    zelfde CHANT_AUDIO-tabel, alleen de sleutel verschilt (en, zoals hier, evengoed een ander
    audioformaat: het mimetype hangt gewoon van de bestandsextensie af, zie CHANT_MIME). Optioneel:
    ontbreekt de map of een bestand, dan speelt dat stukje straks gewoon niet af (geen harde
    build-fout, in tegenstelling tot tiles.json — dit is decoratie, geen spelregel)."""
    chants_dir = SRC / "assets" / "chants"
    chants = {}
    if chants_dir.exists():
        for f in sorted(chants_dir.iterdir()):
            mime = CHANT_MIME.get(f.suffix.lower())
            if not mime:
                continue
            data = base64.b64encode(f.read_bytes()).decode("ascii")
            key = int(f.stem) if f.stem.isdigit() else f.stem
            chants[key] = f"data:{mime};base64,{data}"
    return chants


def build() -> pathlib.Path:
    template = read(SRC / "index.html")
    css = read(SRC / "styles.css")
    logo = read(SRC / "assets" / "logo.b64").strip()
    bigdaddy = read(SRC / "assets" / "bigdaddy.b64").strip()
    # los lijf + los wiel (i.p.v. één vlakke afbeelding), zodat het wiel apart kan ronddraaien —
    # zie .partycar-wheel/@keyframes partycarSpin in styles.css.
    partycar_body = read_optional_b64(SRC / "assets" / "partycar-body.b64")
    partycar_wheel = read_optional_b64(SRC / "assets" / "partycar-wheel.b64")
    kaboem = read_optional_b64(SRC / "assets" / "kaboem.b64")
    chants = build_chants()

    # --- tegeldata controleren en injecteren ---
    tiles_raw = read(SRC / "data" / "tiles.json")
    try:
        tiles = json.loads(tiles_raw)
    except json.JSONDecodeError as e:
        sys.exit(f"FOUT: tiles.json is geen geldige JSON -> {e}")

    missing = [str(k) for k in range(1, 21) if str(k) not in tiles.get("tiles", {})]
    if missing:
        sys.exit(f"FOUT: tegels ontbreken in tiles.json: {', '.join(missing)}")

    js_parts = []
    for name in JS_ORDER:
        chunk = read(SRC / "js" / name)
        js_parts.append(f"// ===== {name} =====\n{chunk}")
    js = "\n\n".join(js_parts)
    js = js.replace("{{TILES}}", json.dumps(tiles, separators=(",", ":")))
    js = js.replace("{{CHANTS}}", json.dumps(chants, separators=(",", ":")))
    js = js.replace("{{BIGDADDY}}", bigdaddy)
    js = js.replace("{{PARTYCAR_BODY}}", partycar_body)
    js = js.replace("{{PARTYCAR_WHEEL}}", partycar_wheel)
    js = js.replace("{{KABOEM}}", kaboem)

    if "{{TILES}}" in js:
        sys.exit("FOUT: {{TILES}} placeholder niet vervangen")
    if "{{CHANTS}}" in js:
        sys.exit("FOUT: {{CHANTS}} placeholder niet vervangen")
    if "{{BIGDADDY}}" in js:
        sys.exit("FOUT: {{BIGDADDY}} placeholder niet vervangen")
    if "{{PARTYCAR_BODY}}" in js:
        sys.exit("FOUT: {{PARTYCAR_BODY}} placeholder niet vervangen")
    if "{{PARTYCAR_WHEEL}}" in js:
        sys.exit("FOUT: {{PARTYCAR_WHEEL}} placeholder niet vervangen")
    if "{{KABOEM}}" in js:
        sys.exit("FOUT: {{KABOEM}} placeholder niet vervangen")

    html = template.replace("{{CSS}}", css)
    html = html.replace("{{JS}}", js)
    html = html.replace("{{LOGO}}", f"data:image/png;base64,{logo}")

    for leftover in re.findall(r"\{\{[A-Z]+\}\}", html):
        sys.exit(f"FOUT: placeholder {leftover} niet vervangen")

    DIST.mkdir(exist_ok=True)
    out = DIST / "axiom9.html"
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    out = build()
    kb = out.stat().st_size / 1024
    code_kb = sum(
        (SRC / "js" / n).stat().st_size for n in JS_ORDER
    ) / 1024 + (SRC / "styles.css").stat().st_size / 1024
    n_chants = len(build_chants())
    print(f"Gebouwd: {out}  ({kb:.0f} KB, waarvan {code_kb:.0f} KB code, {n_chants} taunts)")
