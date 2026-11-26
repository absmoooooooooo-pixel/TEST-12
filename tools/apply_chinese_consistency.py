#!/usr/bin/env python3
"""Apply the corrected Chinese-language completeness level to all languages.

The Chinese dictionary already localizes standalone technical dimension symbols
(L, W, H, T, ...), the weight-equation prefix (W =) and the pound button term.
Several languages still ship identity values for those keys, which leaves
English notation in drawings and formula fragments. This script fills those
gaps with language-native terminology and aligns the KG/LB button vocabulary.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "frontend" / "i18n"

SYMBOLS = {
    "de": {
        "L": "Länge", "W": "Breite", "H": "Höhe", "T": "Dicke",
        "B": "Breite", "A": "Schlüsselweite", "D": "Durchmesser",
        "d": "Lochdurchmesser", "OD": "Außen-Ø", "t": "Dicke",
        "s": "Schlüsselweite", "f": "Flanschdicke", "w": "Stegdicke",
        "Tf": "Flanschdicke", "Tw": "Stegdicke", "×H": "×Höhe",
        ", T": ", Dicke", ")×T": ")×Dicke", "− A": "− Schlüsselweite",
        "W =": "Gewicht =",
    },
    "es": {
        "L": "Longitud", "W": "Ancho", "H": "Altura", "T": "Espesor",
        "B": "Ancho", "A": "Entre caras", "D": "Diámetro",
        "d": "Diámetro de agujero", "OD": "Diámetro exterior", "t": "Espesor",
        "s": "Entre caras", "f": "Espesor de brida", "w": "Espesor de alma",
        "Tf": "Espesor de brida", "Tw": "Espesor de alma", "×H": "×Altura",
        ", T": ", Espesor", ")×T": ")×Espesor", "− A": "− Entre caras",
        "W =": "Peso =",
    },
    "fr": {
        "L": "Longueur", "W": "Largeur", "H": "Hauteur", "T": "Épaisseur",
        "B": "Largeur", "A": "Sur plats", "D": "Diamètre",
        "d": "Diamètre de trou", "OD": "Diamètre extérieur", "t": "Épaisseur",
        "s": "Sur plats", "f": "Épaisseur de bride", "w": "Épaisseur d'âme",
        "Tf": "Épaisseur de bride", "Tw": "Épaisseur d'âme", "×H": "×Hauteur",
        ", T": ", Épaisseur", ")×T": ")×Épaisseur", "− A": "− Sur plats",
        "W =": "Poids =",
    },
    "pt": {
        "L": "Comprimento", "W": "Largura", "H": "Altura", "T": "Espessura",
        "B": "Largura", "A": "Entre faces", "D": "Diâmetro",
        "d": "Diâmetro do furo", "OD": "Diâmetro externo", "t": "Espessura",
        "s": "Entre faces", "f": "Espessura do flange", "w": "Espessura da alma",
        "Tf": "Espessura do flange", "Tw": "Espessura da alma", "×H": "×Altura",
        ", T": ", Espessura", ")×T": ")×Espessura", "− A": "− Entre faces",
        "W =": "Peso =",
    },
}

POUND_LABELS = {
    "en": ("LB", "lb"),
    "mr": ("पाउंड", "पाउंड"),
    "hi": ("पाउंड", "पाउंड"),
    "de": ("lb", "lb"),
    "es": ("lb", "lb"),
    "fr": ("lb", "lb"),
    "ja": ("ポンド", "ポンド"),
    "zh": ("磅", "磅"),
    "pt": ("lb", "lb"),
    "ar": ("رطل", "رطل"),
}


def main() -> None:
    changed = 0
    for code in ("de", "es", "fr", "pt"):
        path = I18N / f"{code}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for key, value in SYMBOLS[code].items():
            if data["strings"].get(key) != value:
                data["strings"][key] = value
                changed += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for code, (term, label) in POUND_LABELS.items():
        path = I18N / f"{code}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        if data["terms"].get("LB") != term:
            data["terms"]["LB"] = term
            changed += 1
        if data["strings"].get("LB") != label:
            data["strings"]["LB"] = label
            changed += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"chinese-consistency dictionary updates: {changed}")


if __name__ == "__main__":
    main()
