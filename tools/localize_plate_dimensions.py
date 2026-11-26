#!/usr/bin/env python3
"""Print language-appropriate dimension symbols on the Plate Weight Calculator.

The English plate page keeps the conventional Latin initials L, W, T. Every
other language prints its own engineering notation in the drawing, in the
input labels and in the formula, and the same symbol is used everywhere:

    language   length   width   thickness
    en         L        W       T
    de         L        B       D      (Länge, Breite, Dicke)
    es         L        A       E      (Longitud, Ancho, Espesor)
    fr         L        l       e      (Longueur, largeur, épaisseur)
    pt         C        L       E      (Comprimento, Largura, Espessura)
    hi         लं       चौ      मो     (लंबाई, चौड़ाई, मोटाई)
    mr         लां      रुं     जाड    (लांबी, रुंदी, जाडी)
    ja         長       幅      厚     (長さ, 幅, 厚さ)
    zh         长       宽      厚     (长度, 宽度, 厚度)
    ar         ط        ع       س      (الطول, العرض, السماكة)

The drawing shows the symbol only; the input labels and the worked example
show the full translated name with the symbol in brackets, exactly as the
English page does with "Length (L)". Placeholders, units, arrows, geometry,
formulas and calculations are untouched.

The strings that carry a symbol are marked data-i18n-skip, because they are
already printed in the page's language and the shared dictionaries translate
the bare letters (L -> Länge) for the other calculators. Without the marker the
runtime translator would turn the symbol back into a word.

Usage:
    python tools/localize_plate_dimensions.py            # rewrite the pages
    python tools/localize_plate_dimensions.py --check    # report only
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

LANGUAGES = ["en", "hi", "mr", "de", "es", "fr", "ja", "zh", "pt", "ar"]

SYMBOLS = {
    "en": {"L": "L", "W": "W", "T": "T"},
    "de": {"L": "L", "W": "B", "T": "D"},
    "es": {"L": "L", "W": "A", "T": "E"},
    "fr": {"L": "L", "W": "l", "T": "e"},
    "pt": {"L": "C", "W": "L", "T": "E"},
    "hi": {"L": "लं", "W": "चौ", "T": "मो"},
    "mr": {"L": "लां", "W": "रुं", "T": "जाड"},
    "ja": {"L": "長", "W": "幅", "T": "厚"},
    "zh": {"L": "长", "W": "宽", "T": "厚"},
    "ar": {"L": "ط", "W": "ع", "T": "س"},
}

TOKEN_RE = re.compile(r"(?<![^\W\d_])[LWT](?![^\W\d_])", re.UNICODE)
DIM_IDS = ("dimL", "dimW", "dimT")
DIM_KEY = {"dimL": "L", "dimW": "W", "dimT": "T"}
DIM_FIELD = {"L": "length", "W": "width", "T": "thickness"}
SOURCE_MAP_RE = re.compile(
    r'(<script type="application/json" id="mw-i18n-sources">)(.*?)(</script>)', re.S
)


def page_path(language: str) -> Path:
    if language == "en":
        return ROOT / "frontend" / "calculators" / "plate" / "index.html"
    return ROOT / language / "calculators" / "plate" / "index.html"


def symbol_name(text: str) -> str:
    """Strip the " (X)" suffix so a label can be reprinted with its symbol."""
    return re.sub(r"\s*\([^()]*\)\s*$", "", text).strip()


def swap_tokens(text: str, symbols: dict[str, str]) -> str:
    return TOKEN_RE.sub(lambda match: symbols[match.group(0)], text)


def add_attribute(tag: str, name: str, value: str | None = None) -> str:
    if re.search(r"\b" + name + r"\b", tag):
        return tag
    inserted = name if value is None else '%s="%s"' % (name, value)
    return tag[: -1] + " " + inserted + tag[-1:]


def label_text(name: str, symbol: str) -> str:
    """"Länge (L)"; a language whose symbol is the name itself prints it once."""
    if name == symbol:
        return name
    return "%s (%s)" % (name, symbol)


def patch_text_element(source: str, dim_id: str, symbol: str, changes: list) -> str:
    pattern = re.compile(r'(<text id="%s")([^>]*)(>)(.*?)(</text>)' % dim_id, re.S)

    def replace(match):
        opening, attrs, close, body, closing = match.groups()
        attrs = add_attribute(attrs + ">", "data-dim-symbol", symbol)[:-1]
        attrs = add_attribute(attrs + ">", "data-i18n-skip")[:-1]
        new_body = symbol
        if body != new_body:
            changes.append((body, new_body))
        return opening + attrs + close + new_body + closing

    return pattern.sub(replace, source)


def patch_label(source: str, field: str, symbol: str, changes: list) -> str:
    pattern = re.compile(r'(<label for="%s")([^>]*)(>)(.*?)(</label>)' % field, re.S)

    def replace(match):
        opening, attrs, close, body, closing = match.groups()
        attrs = add_attribute(attrs + ">", "data-i18n-skip")[:-1]
        current = body.strip()
        new_body = label_text(symbol_name(current), symbol)
        if body != new_body:
            changes.append((body, new_body))
        return opening + attrs + close + new_body + closing

    return pattern.sub(replace, source)


def patch_example_labels(source: str, symbols: dict[str, str], changes: list) -> str:
    """The three dimension labels of the worked example, in document order."""
    wanted = [symbols["L"], symbols["W"], symbols["T"]]
    state = {"index": 0}
    pattern = re.compile(r'(<span class="example-value-label")([^>]*)(>)(.*?)(</span>)', re.S)

    def replace(match):
        opening, attrs, close, body, closing = match.groups()
        index = state["index"]
        state["index"] += 1
        if index >= len(wanted):
            return match.group(0)
        attrs = add_attribute(attrs + ">", "data-i18n-skip")[:-1]
        new_body = label_text(symbol_name(body), wanted[index])
        if body != new_body:
            changes.append((body, new_body))
        return opening + attrs + close + new_body + closing

    return pattern.sub(replace, source)


def owned(attrs: str) -> bool:
    """A marker set by a previous run; the string must not swap twice."""
    return "data-i18n-skip" in attrs


def patch_paragraph(source: str, class_name: str, symbols: dict[str, str], changes: list) -> str:
    pattern = re.compile(r'(<p class="%s")([^>]*)(>)(.*?)(</p>)' % class_name, re.S)

    def replace(match):
        opening, attrs, close, body, closing = match.groups()
        if owned(attrs):
            return match.group(0)
        new_body = swap_tokens(body, symbols)
        if new_body == body:
            return match.group(0)
        attrs = add_attribute(attrs + ">", "data-i18n-skip")[:-1]
        changes.append((body, new_body))
        return opening + attrs + close + new_body + closing

    return pattern.sub(replace, source)


def patch_faq(source: str, symbols: dict[str, str], changes: list) -> str:
    """The FAQ answer that repeats the formula; other answers stay untouched."""
    pattern = re.compile(r"(<p>)([^<]*?(?:\u00d7|&times;)[^<]*?)(</p>)")

    def replace(match):
        opening, body, closing = match.groups()
        if not TOKEN_RE.search(body):
            return match.group(0)
        new_body = swap_tokens(body, symbols)
        if new_body == body:
            return match.group(0)
        changes.append((body, new_body))
        return '<p data-i18n-skip>' + new_body + closing

    return pattern.sub(replace, source)


def patch_aria(source: str, symbols: dict[str, str], changes: list) -> str:
    pattern = re.compile(r'(<svg class="shape-diagram diagram-view"[^>]*?aria-label=")([^"]*)(")([^>]*>)')

    def replace(match):
        opening, value, quote, rest = match.groups()
        if "data-i18n-skip" in match.group(0):
            return match.group(0)
        new_value = swap_tokens(value, symbols)
        if new_value == value:
            return match.group(0)
        changes.append((value, new_value))
        return opening + new_value + quote + rest

    return pattern.sub(replace, source)


def mark_aria_skip(source: str) -> str:
    """Keep the two drawing descriptions out of the shared dictionary."""
    return re.sub(
        r'<svg class="shape-diagram diagram-view"(?![^>]*data-i18n-skip)',
        '<svg class="shape-diagram diagram-view" data-i18n-skip',
        source,
    )


def patch_group_aria(source: str, symbols: dict[str, str], changes: list) -> str:
    pattern = re.compile(r'(<div class="diagram-views")([^>]*?)(aria-label=")([^"]*)(")')

    def replace(match):
        opening, attrs, label_open, value, quote = match.groups()
        if owned(attrs):
            return match.group(0)
        new_value = swap_tokens(value, symbols)
        if new_value == value:
            return match.group(0)
        changes.append((value, new_value))
        return opening + attrs + "data-i18n-skip " + label_open + new_value + quote

    return pattern.sub(replace, source)


def patch_source_map(source: str, changes: list) -> str:
    """Keep the page's own English-source map pointing at the new strings."""
    if not changes:
        return source
    match = SOURCE_MAP_RE.search(source)
    if not match:
        return source
    try:
        data = json.loads(match.group(2))
    except json.JSONDecodeError:
        return source

    pairs = {}
    for old, new in changes:
        pairs[old.strip()] = new.strip()

    changed = False
    for section in ("text", "attrs"):
        table = data.get(section)
        if not isinstance(table, dict):
            continue
        for old, new in pairs.items():
            if old in table and old != new:
                table[new] = table.pop(old)
                changed = True
    if not changed:
        return source

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return source[: match.start(2)] + payload + source[match.end(2):]


def patch_page(language: str, check_only: bool) -> tuple[list, list]:
    path = page_path(language)
    source = path.read_text(encoding="utf-8")
    symbols = SYMBOLS[language]
    changes: list = []

    updated = source
    for dim_id in DIM_IDS:
        updated = patch_text_element(updated, dim_id, symbols[DIM_KEY[dim_id]], changes)
    for key in ("L", "W", "T"):
        updated = patch_label(updated, DIM_FIELD[key], symbols[key], changes)
    updated = patch_example_labels(updated, symbols, changes)
    updated = patch_paragraph(updated, "formula-equation", symbols, changes)
    updated = patch_paragraph(updated, "formula-legend", symbols, changes)
    updated = patch_faq(updated, symbols, changes)
    updated = patch_aria(updated, symbols, changes)
    updated = patch_group_aria(updated, symbols, changes)
    updated = mark_aria_skip(updated)
    updated = patch_source_map(updated, changes)

    if updated != source and not check_only:
        path.write_text(updated, encoding="utf-8", newline="")

    return changes, source.splitlines()


def leftovers(language: str, source: str) -> list[str]:
    """Visible text that still carries an English letter this language rejects."""
    allowed = set(SYMBOLS[language].values())
    body = re.sub(r"<script\b.*?</script>", "", source, flags=re.S)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    found = []
    for chunk in re.findall(r">([^<>]+)<", body):
        for token in TOKEN_RE.findall(chunk):
            if token not in allowed:
                found.append(chunk.strip()[:120])
                break
    return found


def main() -> int:
    check_only = "--check" in sys.argv
    total = 0
    for language in LANGUAGES:
        changes, _ = patch_page(language, check_only)
        total += len(changes)
        print("%-3s %2d strings %s" % (
            language,
            len(changes),
            " | ".join("%s -> %s" % pair for pair in changes[:4]),
        ))
    print("%s %d strings on %d plate pages" % (
        "would rewrite" if check_only else "rewrote", total, len(LANGUAGES)))

    problems = []
    for language in LANGUAGES:
        source = page_path(language).read_text(encoding="utf-8")
        for text in leftovers(language, source):
            problems.append("%s: %s" % (language, text))
    if problems:
        print("leftover dimension text:")
        for problem in problems:
            print("  " + problem)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
