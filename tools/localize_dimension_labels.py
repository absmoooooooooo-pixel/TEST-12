#!/usr/bin/env python3
"""Localize every dimension label printed inside the static drawings.

The English page keeps the conventional Latin initials (L, W, T, OD, SF, ID).
Every other language prints the complete dimension name in that language, and a
dimension keeps the same name on every page: the mapping comes from the shared
technical terminology, so the drawing label, the field legend and the formula
all read the same word.

Chinese is the reference: 长, 宽, 厚, 外径, 内径, 母线长, 对边宽.

Usage:
    python tools/localize_dimension_labels.py            # rewrite the pages
    python tools/localize_dimension_labels.py --check     # report only
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import i18n_paths as paths  # noqa: E402
import technical_i18n_data as data  # noqa: E402

ROOT = paths.PROJECT_ROOT
I18N_DIR = paths.I18N_DIR
LANGUAGES = ["mr", "hi", "de", "es", "fr", "ja", "zh", "pt", "ar"]

TEXT_RE = re.compile(r"(<text\b[^>]*>)(.*?)(</text>)", re.S)
ID_RE = re.compile(r'\bid="([^"]+)"')

# English wording of each semantic dimension key used by the drawings.
DIMENSION_EN = {
    "length": "Length",
    "width": "Width",
    "height": "Height",
    "overallHeight": "Overall Height",
    "outerHeight": "Outer Height",
    "innerHeight": "Inner Height",
    "outerWidth": "Outer Width",
    "thickness": "Thickness",
    "diameter": "Diameter",
    "outerDiameter": "Outer Diameter",
    "innerDiameter": "Inner Diameter",
    "insideDiameter": "Inside Diameter",
    "radius": "Radius",
    "knuckleRadius": "Knuckle Radius",
    "straightFace": "Straight Face",
    "acrossFlats": "Across Flats",
    "acrossCorners": "Across Corners",
    "holeDiameter": "Hole Diameter",
    "slantHeight": "Slant Height",
    "plateThickness": "Plate Thickness",
    "shellThickness": "Shell Thickness",
    "weight": "Weight",
    "volume": "Volume",
    "density": "Density",
    "pitch": "Thread Pitch",
    "threadLength": "Thread Length",
    "headHeight": "Head Height",
    "headDiameter": "Head Diameter",
    "headAcrossFlats": "Head Across Flats",
    "neckAcrossFlats": "Neck Across Flats",
    "neckHeight": "Neck Height",
    "nutHeight": "Nut Height",
    "nominalDiameter": "Nominal Thread Diameter",
    "boltHoleCount": "Bolt Holes",
    "boltHoleDiameter": "Bolt Hole Diameter",
    "pitchCircleDiameter": "Pitch Circle Diameter",
    "developedSurfaceArea": "Developed Surface Area",
    "baseDiameter": "Base Diameter",
    "flangeWidth": "Flange Width",
    "flangeThickness": "Flange Thickness",
    "webThickness": "Web Thickness",
    "firstParallelSide": "First Parallel Side",
    "secondParallelSide": "Second Parallel Side",
    "perpendicularHeight": "Perpendicular Height",
    "base": "Base",
    "verticalLeg": "Vertical Leg",
    "horizontalLeg": "Horizontal Leg",
    "socketDepth": "Socket Depth",
    "socketWidth": "Socket Width",
    "largeEndDiameter": "Large End Diameter",
    "smallEndDiameter": "Small End Diameter",
    "lateralArea": "Lateral Surface Area",
    "threadLength2": "Second Thread Length",
}

# Same table as frontend/i18n/technical-language.js: names whose English
# wording is not part of a language's shared term list.
EXTRA_NAMES = {
    "es": {
        "radius": "Radio",
        "neckAcrossFlats": "Ancho entre caras del cuello",
        "headAcrossFlats": "Ancho entre caras de la cabeza",
        "pitchCircleDiameter": "Diámetro del círculo de pernos",
        "developedSurfaceArea": "Área de superficie desarrollada",
        "acrossCorners": "Diagonal entre vértices",
        "nutHeight": "Altura de la tuerca",
        "headHeight": "Altura de la cabeza",
        "nominalDiameter": "Diámetro nominal",
        "socketDepth": "Profundidad de la llave",
        "socketWidth": "Ancho de la llave",
    },
    "de": {
        "radius": "Radius",
        "neckAcrossFlats": "Schlüsselweite Hals",
        "headAcrossFlats": "Schlüsselweite Kopf",
        "pitchCircleDiameter": "Teilkreisdurchmesser",
        "developedSurfaceArea": "Abgewickelte Oberfläche",
        "acrossCorners": "Eckenmaß",
        "nutHeight": "Mutterhöhe",
        "headHeight": "Kopfhöhe",
        "nominalDiameter": "Nenndurchmesser",
        "socketDepth": "Schlüsseltiefe",
        "socketWidth": "Schlüsselweite",
    },
    "fr": {
        "radius": "Rayon",
        "neckAcrossFlats": "Sur plats du col",
        "headAcrossFlats": "Sur plats de tête",
        "pitchCircleDiameter": "Diamètre du cercle de perçage",
        "developedSurfaceArea": "Surface développée",
        "acrossCorners": "Diagonale entre sommets",
        "nutHeight": "Hauteur d'écrou",
        "headHeight": "Hauteur de tête",
        "nominalDiameter": "Diamètre nominal",
        "socketDepth": "Profondeur de douille",
        "socketWidth": "Largeur de douille",
    },
    "pt": {
        "radius": "Raio",
        "neckAcrossFlats": "Entre faces do colo",
        "headAcrossFlats": "Entre faces da cabeça",
        "pitchCircleDiameter": "Diâmetro do círculo de furação",
        "developedSurfaceArea": "Área da superfície desenvolvida",
        "acrossCorners": "Diagonal entre vértices",
        "nutHeight": "Altura da porca",
        "headHeight": "Altura da cabeça",
        "nominalDiameter": "Diâmetro nominal",
        "socketDepth": "Profundidade do soquete",
        "socketWidth": "Largura do soquete",
    },
}


def load_dictionary(language: str) -> dict:
    source = (I18N_DIR / language / ("dict-%s.js" % language)).read_text(encoding="utf-8")
    match = re.search(r"=(\{.*\});?\s*$", source, re.S)
    if not match:
        raise SystemExit("cannot read dictionary: %s" % language)
    return json.loads(match.group(1))


DICTIONARIES = {language: load_dictionary(language) for language in LANGUAGES}


def dimension_name(language: str, semantic: str) -> str:
    """The complete dimension name this language prints in its drawings."""
    english = DIMENSION_EN.get(semantic, semantic)
    dictionary = DICTIONARIES[language]
    technical = (dictionary.get("technical") or {}).get("dimensions") or {}

    if technical.get(semantic):
        return technical[semantic]

    extra = EXTRA_NAMES.get(language, {})
    if extra.get(semantic):
        return extra[semantic]

    for table in ("terms", "strings"):
        value = (dictionary.get(table) or {}).get(english)
        if value and value != english:
            return value

    return english


def label_map(calculator: str, language: str) -> dict[str, str]:
    """English drawing token -> the label this language prints for it."""
    tokens = data.PAGE_TOKENS.get(calculator) or {}
    return {token: dimension_name(language, semantic) for token, semantic in tokens.items()}


def english_labels(calculator: str) -> tuple[dict[str, str], list[str]]:
    """Drawing id -> English token, plus every label in document order.

    The language pages are translated copies of the English drawing, so a label
    without an id (the slant height of a truncated cone, for example) is
    matched by its position in the same SVG.
    """
    page = ROOT / "frontend" / "calculators" / calculator / "index.html"
    if not page.exists():
        return {}, []
    labels: dict[str, str] = {}
    ordered: list[str] = []
    for match in TEXT_RE.finditer(page.read_text(encoding="utf-8")):
        text = match.group(2).strip()
        ordered.append(text)
        found = ID_RE.search(match.group(1))
        if found:
            labels[found.group(1)] = text
    return labels, ordered


def rewrite_page(
    path: Path,
    mapping: dict[str, str],
    english: tuple[dict[str, str], list[str]],
    check_only: bool,
) -> list[tuple[str, str]]:
    html = path.read_text(encoding="utf-8")
    changes: list[tuple[str, str]] = []
    by_id, ordered = english
    index = 0

    def replace(match: re.Match) -> str:
        nonlocal index
        position = index
        index += 1
        opening, body, closing = match.group(1), match.group(2), match.group(3)
        current = body.strip()
        found = ID_RE.search(opening)

        if found:
            token = by_id.get(found.group(1))
        else:
            token = ordered[position] if position < len(ordered) else None

        wanted = mapping.get(token) if token else None

        if not wanted or wanted == current:
            return match.group(0)

        changes.append((current, wanted))
        lead = body[: len(body) - len(body.lstrip())]
        trail = body[len(body.rstrip()):]
        return opening + lead + wanted + trail + closing

    updated = TEXT_RE.sub(replace, html)

    if changes and not check_only:
        path.write_text(updated, encoding="utf-8")

    return changes


def main() -> int:
    check_only = "--check" in sys.argv
    total = 0
    per_language: dict[str, int] = {}

    for calculator in sorted(data.PAGE_TOKENS):
        if calculator == "plate":
            # The plate page keeps single-letter symbols instead of full names;
            # tools/localize_plate_dimensions.py owns its dimension text.
            continue
        english = english_labels(calculator)
        for language in LANGUAGES:
            page = ROOT / language / "calculators" / calculator / "index.html"
            if not page.exists():
                continue
            changes = rewrite_page(page, label_map(calculator, language), english, check_only)
            if changes:
                total += len(changes)
                per_language[language] = per_language.get(language, 0) + len(changes)
                if total <= 40:
                    print("%-18s %-3s %s" % (
                        calculator, language,
                        ", ".join("%s -> %s" % pair for pair in changes[:6]),
                    ))

    verb = "would rewrite" if check_only else "rewrote"
    print("%s %d labels across %d languages" % (verb, total, len(per_language)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
